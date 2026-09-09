import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import {
  Room,
  RoomMember,
  RoomPlaybackState,
  Reaction,
  ChatMessage,
  Role,
  WSMessage,
  SyncPingPayload,
  SyncPongPayload,
  PlaybackCommandPayload,
  ReactionSendPayload,
  ChatSendPayload,
  MediaChangePayload,
  VoiceSignalPayload,
  VoiceStatePayload,
  calculateAuthoritativePosition
} from '@synccinema/common';
import { DatabaseService } from '../db/database.js';
import { mongoLogger } from '../services/mongoLogger.js';

export interface ConnectedClient {
  socket: WebSocket;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  roomId: string;
  role: Role;
  joinedAt: number;
  lastReactionTime: number;
  reactionCountInWindow: number;
  lastChatMessageTime: number;
  isAlive: boolean;
}

export class RoomSyncManager {
  private db: DatabaseService;
  // roomId -> Set of connected clients
  private roomClients = new Map<string, Set<ConnectedClient>>();
  // userId -> ConnectedClient
  private userClients = new Map<string, ConnectedClient>();
  // roomId -> Cached active room
  private activeRooms = new Map<string, Room>();
  // roomId -> Screen presenter info
  private activeScreenPresenters = new Map<string, { userId: string; displayName: string }>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService) {
    this.db = db;
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [roomId, clients] of this.roomClients.entries()) {
        const room = this.activeRooms.get(roomId);
        for (const client of Array.from(clients)) {
          if (!client.isAlive) {
            try {
              client.socket.terminate();
            } catch {}
            if (room) {
              this.handleDisconnection(client, room, 'DISCONNECTED');
            }
            continue;
          }
          client.isAlive = false;
          try {
            client.socket.ping();
          } catch {}
        }
      }
    }, 15000);
    this.heartbeatInterval.unref();
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getRoom(roomId: string): Room | null {
    if (this.activeRooms.has(roomId)) {
      return this.activeRooms.get(roomId)!;
    }
    const fromDb = this.db.getRoomBySlug(roomId); // slug or id
    if (fromDb) {
      this.activeRooms.set(fromDb.id, fromDb);
      return fromDb;
    }
    return null;
  }

  registerRoom(room: Room): void {
    this.activeRooms.set(room.id, room);
    if (!this.roomClients.has(room.id)) {
      this.roomClients.set(room.id, new Set());
    }
  }

  getConnectedClientsCount(roomId: string): number {
    const clients = this.roomClients.get(roomId);
    if (!clients) return 0;
    const active = Array.from(clients).filter(c => c.socket.readyState === WebSocket.OPEN);
    const uniqueUsers = new Set(active.map(c => c.userId));
    return uniqueUsers.size;
  }

  // --- WebSocket Connection Lifecycle ---
  handleConnection(
    socket: WebSocket,
    room: Room,
    user: { id: string; displayName: string; avatarUrl?: string | null }
  ): ConnectedClient | null {
    let clientSet = this.roomClients.get(room.id);
    if (!clientSet) {
      clientSet = new Set();
      this.roomClients.set(room.id, clientSet);
    }

    // Clean up any closed or disconnected sockets from clientSet
    for (const c of Array.from(clientSet)) {
      if (c.socket.readyState !== WebSocket.OPEN && c.socket.readyState !== WebSocket.CONNECTING) {
        clientSet.delete(c);
        this.userClients.delete(c.userId);
      }
    }

    // If this user already has an active connection in this room (reconnect or reload),
    // close the previous socket and replace it so they don't consume multiple seats
    for (const existingClient of Array.from(clientSet)) {
      if (existingClient.userId === user.id && existingClient.socket !== socket) {
        try {
          existingClient.socket.close(1000, 'Replaced by new connection');
        } catch {}
        clientSet.delete(existingClient);
      }
    }

    // Strict maximum limit: exactly 6 participants per room
    const MAX_ROOM_CAPACITY = 6;
    const activeUserIds = new Set(
      Array.from(clientSet)
        .filter((c) => c.socket.readyState === WebSocket.OPEN || c.socket.readyState === WebSocket.CONNECTING)
        .map((c) => c.userId)
    );

    if (!activeUserIds.has(user.id) && activeUserIds.size >= MAX_ROOM_CAPACITY) {
      try {
        socket.send(
          JSON.stringify({
            type: 'error:notification',
            roomId: room.id,
            timestamp: Date.now(),
            payload: {
              code: 'ROOM_CAPACITY_REACHED',
              message: 'This watch party is full (6/6 participants). Only 6 participants are allowed per room.'
            }
          })
        );
        socket.close(1008, 'ROOM_CAPACITY_REACHED');
      } catch {}
      return null;
    }

    // Determine role (first person or room.hostId is HOST)
    const isHost = room.hostId === user.id;
    const role: Role = isHost ? 'HOST' : 'PARTICIPANT';

    const member: RoomMember = {
      id: nanoid(),
      roomId: room.id,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role,
      status: 'WATCHING',
      joinedAt: new Date().toISOString(),
      isConnected: true
    };

    // Ensure user exists in users table (for foreign key constraints)
    if (!this.db.getUserById(user.id)) {
      this.db.createUser({
        id: user.id,
        email: undefined,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || undefined,
        isAnonymous: true,
        createdAt: new Date().toISOString()
      });
    }

    // Save to database
    this.db.upsertMember(member);

    const client: ConnectedClient = {
      socket,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roomId: room.id,
      role,
      joinedAt: Date.now(),
      lastReactionTime: 0,
      reactionCountInWindow: 0,
      lastChatMessageTime: 0,
      isAlive: true
    };

    socket.on('pong', () => {
      client.isAlive = true;
    });

    clientSet.add(client);
    this.userClients.set(user.id, client);

    // Send initial authoritative snapshot to the newly joined client
    this.sendStateSnapshot(client, room);

    // Notify other peers in the room
    this.broadcastToRoom(
      room.id,
      {
        type: 'presence:update',
        roomId: room.id,
        senderId: user.id,
        timestamp: Date.now(),
        payload: {
          member,
          status: 'JOINED'
        }
      },
      client // exclude self
    );

    mongoLogger.logUserJoined(room.id, user.id, user.displayName, role);

    // Setup message handler
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        this.routeMessage(client, room, msg);
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    });

    socket.on('close', () => {
      this.handleDisconnection(client, room);
    });

    socket.on('error', (err) => {
      console.error(`Socket error for user ${user.id}:`, err);
    });

    return client;
  }

  private handleDisconnection(client: ConnectedClient, room: Room, status: 'DISCONNECTED' | 'LEFT' = 'DISCONNECTED'): void {
    const clientSet = this.roomClients.get(room.id);
    if (clientSet) {
      clientSet.delete(client);
      if (clientSet.size === 0) {
        this.roomClients.delete(room.id);
      }
    }
    this.userClients.delete(client.userId);
    this.db.setMemberDisconnected(room.id, client.userId);

    mongoLogger.logUserLeft(room.id, client.userId, status);

    // Broadcast presence update
    this.broadcastToRoom(room.id, {
      type: 'presence:update',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        member: {
          id: nanoid(),
          roomId: room.id,
          userId: client.userId,
          displayName: client.displayName,
          avatarUrl: client.avatarUrl,
          role: client.role,
          joinedAt: new Date(client.joinedAt).toISOString(),
          isConnected: false
        },
        status
      }
    });

    // Clean up screen share if this client was sharing
    const activePresenter = this.activeScreenPresenters.get(room.id);
    if (activePresenter && activePresenter.userId === client.userId) {
      this.activeScreenPresenters.delete(room.id);
      this.broadcastToRoom(room.id, {
        type: 'screen:state',
        roomId: room.id,
        senderId: client.userId,
        timestamp: Date.now(),
        payload: {
          isSharing: false,
          presenterId: null,
          presenterName: null
        }
      });
    }

    // If the host disconnected, check if host migration is needed
    if (client.role === 'HOST' && clientSet && clientSet.size > 0) {
      // Pick first eligible member as new host
      const nextHost = Array.from(clientSet)[0];
      nextHost.role = 'HOST';
      room.hostId = nextHost.userId;
      this.db.updateRoomHost(room.id, nextHost.userId);
      this.db.updateMemberRole(room.id, nextHost.userId, 'HOST');

      this.broadcastToRoom(room.id, {
        type: 'host:update',
        roomId: room.id,
        senderId: 'SYSTEM',
        timestamp: Date.now(),
        payload: {
          newHostId: nextHost.userId,
          newHostName: nextHost.displayName
        }
      });
    }
  }

  private handleRoomLeave(client: ConnectedClient, room: Room): void {
    this.handleDisconnection(client, room, 'LEFT');
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close(1000, 'User left');
      }
    } catch {}
  }

  private handleRoomEnd(client: ConnectedClient, room: Room): void {
    if (client.role !== 'HOST') {
      this.sendError(client.socket, 'FORBIDDEN', 'Only the host can end the room for everyone');
      return;
    }

    // Broadcast room:ended to everyone in the room
    this.broadcastToRoom(room.id, {
      type: 'room:ended',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        reason: 'HOST_ENDED',
        message: 'The host has ended the watch party.'
      }
    });

    try {
      this.db.endRoom(room.id);
    } catch {}

    const clients = this.roomClients.get(room.id);
    if (clients) {
      for (const c of Array.from(clients)) {
        this.userClients.delete(c.userId);
        this.db.setMemberDisconnected(room.id, c.userId);
        try {
          if (c.socket.readyState === WebSocket.OPEN) {
            c.socket.close(1000, 'Room ended by host');
          }
        } catch {}
      }
      this.roomClients.delete(room.id);
    }
    this.activeScreenPresenters.delete(room.id);
    this.activeRooms.delete(room.id);
    this.activeRooms.delete(room.slug);
  }

  // --- Message Router ---
  private routeMessage(client: ConnectedClient, room: Room, msg: WSMessage<any>): void {
    switch (msg.type) {
      case 'room:leave':
        this.handleRoomLeave(client, room);
        break;

      case 'room:end':
        this.handleRoomEnd(client, room);
        break;

      case 'sync:ping':
        this.handleSyncPing(client, msg.payload);
        break;

      case 'room:get_state':
        this.sendStateSnapshot(client, room);
        break;

      case 'playback:command':
        this.handlePlaybackCommand(client, room, msg.payload);
        break;

      case 'reaction:send':
        this.handleReactionSend(client, room, msg.payload);
        break;

      case 'chat:send':
        this.handleChatSend(client, room, msg.payload);
        break;

      case 'chat:delete':
        this.handleChatDelete(client, room, msg.payload);
        break;

      case 'chat:typing':
        this.broadcastToRoom(room.id, {
          type: 'chat:typing',
          roomId: room.id,
          senderId: client.userId,
          timestamp: Date.now(),
          payload: {
            userId: client.userId,
            userName: client.displayName,
            isTyping: Boolean(msg.payload?.isTyping)
          }
        }, client);
        break;

      case 'presence:state':
        this.handlePresenceState(client, room, msg.payload);
        break;

      case 'media:change':
        this.handleMediaChange(client, room, msg.payload);
        break;

      case 'host:transfer':
        this.handleHostTransfer(client, room, msg.payload);
        break;

      case 'voice:signal':
      case 'webrtc:signal':
        this.handleVoiceSignal(client, room, msg.payload);
        break;

      case 'voice:state':
        this.handleVoiceState(client, room, msg.payload);
        break;

      case 'camera:state':
        this.handleCameraState(client, room, msg.payload);
        break;

      case 'screen:state':
        this.handleScreenState(client, room, msg.payload);
        break;

      case 'game:action':
        this.handleGameAction(client, room, msg.payload);
        break;

      case 'countdown:start':
        this.broadcastToRoom(room.id, {
          type: 'countdown:start',
          roomId: room.id,
          senderId: client.userId,
          timestamp: Date.now(),
          payload: msg.payload || {}
        });
        break;

      case 'room:theme':
        this.handleRoomTheme(client, room, msg.payload);
        break;

      default:
        console.warn(`Unhandled WS message type: ${msg.type}`);
    }
  }

  // --- 1. Clock Sync (NTP-lite) ---
  private handleSyncPing(client: ConnectedClient, payload: SyncPingPayload): void {
    const response: WSMessage<SyncPongPayload> = {
      type: 'sync:pong',
      roomId: client.roomId,
      timestamp: Date.now(),
      payload: {
        t1: payload.t1,
        serverTime: Date.now()
      }
    };
    this.send(client.socket, response);
  }

  // --- 2. Playback State Machine ---
  private handlePlaybackCommand(
    client: ConnectedClient,
    room: Room,
    payload: PlaybackCommandPayload
  ): void {
    // Check permission: only HOST or CO_HOST can command playback
    if (client.role !== 'HOST' && client.role !== 'CO_HOST') {
      this.sendError(client.socket, 'UNAUTHORIZED', 'Only the room host or co-hosts can control playback');
      return;
    }

    const currentServerTime = Date.now();
    const currentState = room.playbackState;

    // Calculate updated position
    let newPosition = payload.position;
    if (payload.action === 'PAUSE' && currentState.state === 'PLAYING') {
      // If pausing, capture exact current authoritative time
      newPosition = calculateAuthoritativePosition(currentState, currentServerTime);
    }

    const updatedState: RoomPlaybackState = {
      roomId: room.id,
      state: payload.action === 'PLAY' ? 'PLAYING' : 'PAUSED',
      position: Math.max(0, newPosition),
      serverTimestamp: currentServerTime,
      playbackRate: 1.0,
      version: currentState.version + 1,
      updatedBy: client.userId
    };

    // Update in-memory & database
    room.playbackState = updatedState;
    this.db.updatePlaybackState(updatedState);
    this.db.logPlaybackEvent(nanoid(), updatedState, payload.action);
    mongoLogger.logPlaybackCommand(room.id, client.userId, payload.action, updatedState.position);

    // Broadcast authoritative update to ALL participants (including sender for ack)
    this.broadcastToRoom(room.id, {
      type: 'playback:update',
      roomId: room.id,
      senderId: client.userId,
      timestamp: currentServerTime,
      payload: {
        playbackState: updatedState,
        actorId: client.userId
      }
    });
  }

  // --- 3. Reactions & Rate Limiting ---
  private handleReactionSend(
    client: ConnectedClient,
    room: Room,
    payload: ReactionSendPayload
  ): void {
    const now = Date.now();

    // Anti-spam: max 10 reactions per second
    if (now - client.lastReactionTime < 1000) {
      client.reactionCountInWindow++;
      if (client.reactionCountInWindow > 10) {
        return; // drop spam reactions silently
      }
    } else {
      client.lastReactionTime = now;
      client.reactionCountInWindow = 1;
    }

    const reaction: Reaction = {
      id: nanoid(),
      roomId: room.id,
      userId: client.userId,
      userName: client.displayName,
      mediaId: room.currentMedia?.id || 'unknown',
      reactionCode: payload.code,
      emoji: payload.emoji,
      mediaTimestamp: payload.mediaTimestamp,
      serverTimestamp: now,
      createdAt: new Date(now).toISOString()
    };

    // Save reaction to database for post-watch heatmap analytics
    this.db.insertReaction(reaction);

    // Broadcast reaction immediately to all room members
    this.broadcastToRoom(room.id, {
      type: 'reaction:broadcast',
      roomId: room.id,
      senderId: client.userId,
      timestamp: now,
      payload: reaction
    });
  }

  // --- 4. Chat & Moderation ---
  private handleChatSend(
    client: ConnectedClient,
    room: Room,
    payload: ChatSendPayload
  ): void {
    const now = Date.now();

    // Anti-spam: max 1 message every 200ms
    if (now - client.lastChatMessageTime < 200) {
      return;
    }
    client.lastChatMessageTime = now;

    // Sanitize message content
    const sanitized = payload.content.trim().slice(0, 1000);
    if (!sanitized) return;

    const chatMsg: ChatMessage = {
      id: nanoid(),
      roomId: room.id,
      userId: client.userId,
      userName: client.displayName,
      userAvatar: client.avatarUrl,
      content: sanitized,
      mediaTimestamp: payload.mediaTimestamp ?? null,
      isDeleted: false,
      createdAt: new Date(now).toISOString()
    };

    this.db.insertChatMessage(chatMsg);

    this.broadcastToRoom(room.id, {
      type: 'chat:message',
      roomId: room.id,
      senderId: client.userId,
      timestamp: now,
      payload: chatMsg
    });
  }

  private handleChatDelete(
    client: ConnectedClient,
    room: Room,
    payload: { messageId: string }
  ): void {
    if (client.role !== 'HOST' && client.role !== 'CO_HOST') {
      this.sendError(client.socket, 'UNAUTHORIZED', 'Only host or co-host can delete chat messages');
      return;
    }

    this.db.deleteChatMessage(payload.messageId);

    this.broadcastToRoom(room.id, {
      type: 'chat:deleted',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: { messageId: payload.messageId }
    });
  }

  private handlePresenceState(
    client: ConnectedClient,
    room: Room,
    payload: { status: 'ONLINE' | 'CONNECTING' | 'WATCHING' | 'AWAY' }
  ): void {
    this.broadcastToRoom(room.id, {
      type: 'presence:state_update',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        userId: client.userId,
        status: payload.status
      }
    });
  }

  // --- 5. Media Change ---
  private handleMediaChange(
    client: ConnectedClient,
    room: Room,
    payload: MediaChangePayload
  ): void {
    if (client.role !== 'HOST' && client.role !== 'CO_HOST') {
      this.sendError(client.socket, 'UNAUTHORIZED', 'Only host can change room content');
      return;
    }

    const media = this.db.createOrGetMedia({
      id: nanoid(),
      provider: payload.provider,
      providerMediaId: payload.providerMediaId,
      sourceUrl: payload.sourceUrl,
      title: payload.title,
      posterUrl: payload.posterUrl,
      durationSeconds: payload.durationSeconds || 0
    });

    room.currentMedia = media;
    this.db.updateRoomMedia(room.id, media.id);

    // Reset playback position to 0
    const updatedState: RoomPlaybackState = {
      roomId: room.id,
      state: 'PAUSED',
      position: 0,
      serverTimestamp: Date.now(),
      playbackRate: 1.0,
      version: room.playbackState.version + 1,
      updatedBy: client.userId
    };
    room.playbackState = updatedState;
    this.db.updatePlaybackState(updatedState);

    this.broadcastToRoom(room.id, {
      type: 'media:updated',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        media,
        playbackState: updatedState
      }
    });
  }

  // --- 6. Host Transfer ---
  private handleHostTransfer(
    client: ConnectedClient,
    room: Room,
    payload: { targetUserId: string }
  ): void {
    if (client.role !== 'HOST') {
      this.sendError(client.socket, 'UNAUTHORIZED', 'Only current host can transfer host permissions');
      return;
    }

    const targetClient = this.userClients.get(payload.targetUserId);
    if (!targetClient || targetClient.roomId !== room.id) {
      this.sendError(client.socket, 'NOT_FOUND', 'Target user is not connected in this room');
      return;
    }

    client.role = 'PARTICIPANT';
    targetClient.role = 'HOST';
    room.hostId = targetClient.userId;

    this.db.updateRoomHost(room.id, targetClient.userId);
    this.db.updateMemberRole(room.id, client.userId, 'PARTICIPANT');
    this.db.updateMemberRole(room.id, targetClient.userId, 'HOST');

    this.broadcastToRoom(room.id, {
      type: 'host:update',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        newHostId: targetClient.userId,
        newHostName: targetClient.displayName
      }
    });
  }

  // --- 7. WebRTC Voice & Screen Signaling Mesh ---
  private handleVoiceSignal(
    client: ConnectedClient,
    room: Room,
    payload: VoiceSignalPayload
  ): void {
    const target = this.userClients.get(payload.targetUserId);
    if (!target || target.roomId !== room.id) {
      return;
    }

    const relayPayload = {
      fromUserId: client.userId,
      signal: payload.signal
    };

    // Direct relay to target peer as webrtc:signal
    this.send(target.socket, {
      type: 'webrtc:signal',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: relayPayload
    });
  }

  private handleVoiceState(
    client: ConnectedClient,
    room: Room,
    payload: VoiceStatePayload
  ): void {
    this.broadcastToRoom(
      room.id,
      {
        type: 'voice:state',
        roomId: room.id,
        senderId: client.userId,
        timestamp: Date.now(),
        payload: {
          userId: client.userId,
          ...payload
        }
      },
      client
    );
  }

  private handleCameraState(
    client: ConnectedClient,
    room: Room,
    payload: { isCameraOn: boolean }
  ): void {
    this.broadcastToRoom(
      room.id,
      {
        type: 'camera:state',
        roomId: room.id,
        senderId: client.userId,
        timestamp: Date.now(),
        payload: {
          userId: client.userId,
          isCameraOn: Boolean(payload.isCameraOn)
        }
      },
      client
    );
  }

  private handleScreenState(
    client: ConnectedClient,
    room: Room,
    payload: { isSharing: boolean; presenterName?: string }
  ): void {
    if (payload.isSharing) {
      this.activeScreenPresenters.set(room.id, {
        userId: client.userId,
        displayName: client.displayName
      });
    } else {
      const curr = this.activeScreenPresenters.get(room.id);
      if (curr && curr.userId === client.userId) {
        this.activeScreenPresenters.delete(room.id);
      }
    }

    this.broadcastToRoom(room.id, {
      type: 'screen:state',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        isSharing: Boolean(payload.isSharing),
        presenterId: payload.isSharing ? client.userId : null,
        presenterName: payload.isSharing ? client.displayName : null
      }
    });
  }

  private handleRoomTheme(client: ConnectedClient, room: Room, payload: { themeId: string }): void {
    if (!payload?.themeId) return;
    room.themeId = payload.themeId;
    try {
      this.db.updateRoomTheme(room.id, payload.themeId);
    } catch {}

    this.broadcastToRoom(room.id, {
      type: 'room:theme',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload: {
        themeId: payload.themeId,
        updatedBy: client.displayName
      }
    });
  }

  // --- Helpers ---
  private sendStateSnapshot(client: ConnectedClient, room: Room): void {
    const clientsInRoom = this.roomClients.get(room.id);
    const activeUserIds = new Set(
      Array.from(clientsInRoom || [])
        .filter((c) => c.socket.readyState === WebSocket.OPEN || c.socket.readyState === WebSocket.CONNECTING)
        .map((c) => c.userId)
    );
    activeUserIds.add(client.userId);

    const allDbMembers = this.db.getRoomMembers(room.id);
    // Return only active members who have a connected socket, strictly capped at 6
    const members = allDbMembers
      .filter((m) => activeUserIds.has(m.userId))
      .slice(0, 6);

    const recentChat = this.db.getRecentChatMessages(room.id, 50);
    const recentReactions = this.db.getRecentReactions(room.id, 30);

    const snapshotMessage: WSMessage = {
      type: 'room:state',
      roomId: room.id,
      timestamp: Date.now(),
      payload: {
        room,
        members,
        myRole: client.role,
        myUserId: client.userId,
        serverTimestamp: Date.now(),
        recentChat,
        recentReactions,
        activeScreenPresenter: this.activeScreenPresenters.get(room.id) || null
      }
    };
    this.send(client.socket, snapshotMessage);
  }

  private broadcastToRoom(
    roomId: string,
    message: WSMessage<any>,
    excludeClient?: ConnectedClient
  ): void {
    const clients = this.roomClients.get(roomId);
    if (!clients) return;

    const data = JSON.stringify(message);
    for (const client of clients) {
      if (excludeClient && client === excludeClient) continue;
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(data);
      }
    }
  }

  private send(socket: WebSocket, message: WSMessage<any>): void {
    const data = JSON.stringify(message);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    } else if (socket.readyState === WebSocket.CONNECTING) {
      socket.once('open', () => {
        socket.send(data);
      });
    }
  }

  private handleGameAction(client: ConnectedClient, room: Room, payload: any): void {
    // Broadcast the game action/state to all participants in the room
    this.broadcastToRoom(room.id, {
      type: 'game:action',
      roomId: room.id,
      senderId: client.userId,
      timestamp: Date.now(),
      payload
    });

    if (payload && payload.action) {
      mongoLogger.logGameEvent(
        room.id,
        client.userId,
        payload.gameType || 'trivia',
        payload.action,
        payload
      );
    }
  }

  private sendError(socket: WebSocket, code: string, message: string): void {
    this.send(socket, {
      type: 'error:notification',
      roomId: '',
      timestamp: Date.now(),
      payload: { code, message }
    });
  }

  public isUserOnline(userId: string): { online: boolean; displayName?: string; roomId?: string } {
    const client = this.userClients.get(userId);
    if (client && client.isAlive) {
      return { online: true, displayName: client.displayName, roomId: client.roomId };
    }
    return { online: false };
  }

  public getConnectedUsers(): Array<{ userId: string; displayName: string; roomId: string }> {
    const list: Array<{ userId: string; displayName: string; roomId: string }> = [];
    for (const client of this.userClients.values()) {
      if (client.isAlive) {
        list.push({ userId: client.userId, displayName: client.displayName, roomId: client.roomId });
      }
    }
    return list;
  }

  public sendToUser(userId: string, message: any): boolean {
    const client = this.userClients.get(userId);
    if (client && client.socket.readyState === 1) {
      client.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}

