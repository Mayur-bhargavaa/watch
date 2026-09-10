import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import {
  GameRoom,
  GameRoomPlayer,
  LudoColor,
  LudoGameState,
  GameRoomStatus,
  GameType
} from '@synccinema/common';
import { DatabaseService } from '../db/database.js';
import { GAME_DEFINITIONS } from './GameDefinitions.js';
import { LudoEngine } from './LudoEngine.js';
import { FourInARowEngine } from './FourInARowEngine.js';

interface ConnectedGameClient {
  socket: WebSocket;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  roomId: string;
  isAlive: boolean;
  lastChatMessageTime?: number;
}

export class GameRoomManager {
  private db: DatabaseService;
  // roomId -> Set of connected WebSocket clients
  private roomClients = new Map<string, Set<ConnectedGameClient>>();
  // userId -> ConnectedGameClient
  private userClients = new Map<string, ConnectedGameClient>();
  // userId -> disconnect grace timeout
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> active theme
  private roomThemes = new Map<string, string>();
  // roomId -> recent chat message history (up to 50)
  private roomChatHistory = new Map<string, any[]>();

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Generates a crisp, memorable temporary room code (e.g. LUDO-8F72 or FOUR-9B21)
   */
  public generateRoomCode(gameType = 'LUDO'): string {
    const prefix =
      gameType.toLowerCase().includes('four') || gameType.toLowerCase().includes('connect')
        ? 'FOUR'
        : gameType.toUpperCase();
    for (let i = 0; i < 10; i++) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${prefix}-${suffix}`;
      const existing = this.db.getGameRoomByCode(code);
      if (!existing) {
        return code;
      }
    }
    return `${prefix}-${nanoid(4).toUpperCase()}`;
  }

  /**
   * Creates a brand new game room for human players
   */
  public createGameRoom(params: {
    hostUser: { id: string; displayName: string; avatarUrl?: string | null };
    gameType: GameType;
    maxPlayers: number;
    isPrivate?: boolean;
    customCode?: string;
  }): GameRoom {
    const def = GAME_DEFINITIONS[params.gameType];
    if (!def) {
      throw new Error(`Unsupported game type: ${params.gameType}`);
    }

    if (!def.playerOptions.includes(params.maxPlayers)) {
      throw new Error(`Invalid player count for ${def.name}. Choose from: ${def.playerOptions.join(', ')}`);
    }

    const roomCode = params.customCode
      ? params.customCode.trim().toUpperCase()
      : this.generateRoomCode(params.gameType);

    const roomId = `groom_${nanoid(12)}`;
    const colors = def.colorAssignments[params.maxPlayers];
    const hostColor = colors[0]; // Host always takes seat 0 (Red)

    const room: GameRoom = {
      id: roomId,
      roomCode,
      gameType: params.gameType,
      hostUserId: params.hostUser.id,
      maxPlayers: params.maxPlayers,
      minPlayers: params.maxPlayers, // STRICT: Requires full human quota before starting
      isPrivate: Boolean(params.isPrivate),
      status: 'WAITING',
      players: [],
      gameState: null,
      theme: 'romantic',
      createdAt: new Date().toISOString()
    };

    this.db.createGameRoom(room);
    const hostPlayer = this.db.addPlayerToGameRoom(roomId, params.hostUser, 0, hostColor);
    room.players = [hostPlayer];

    return room;
  }

  /**
   * Smart Human-Only Matchmaking:
   * Finds an available waiting room with open slots or creates a new waiting room
   */
  public matchmakeOrHost(
    user: { id: string; displayName: string; avatarUrl?: string | null },
    gameType: GameType,
    maxPlayers: number
  ): { room: GameRoom; joinedExisting: boolean } {
    const openRoom = this.db.findOpenWaitingGameRoom(gameType, maxPlayers, user.id);

    if (openRoom) {
      // Join existing room
      const updatedRoom = this.joinRoom(openRoom.roomCode, user);
      return { room: updatedRoom, joinedExisting: true };
    }

    // No waiting human room found -> create new waiting room
    const created = this.createGameRoom({
      hostUser: user,
      gameType,
      maxPlayers,
      isPrivate: false
    });

    return { room: created, joinedExisting: false };
  }

  /**
   * Retrieves a room by its temporary room code
   */
  public getRoomByCode(roomCode: string): GameRoom | null {
    return this.db.getGameRoomByCode(roomCode);
  }

  /**
   * Joins a specific game room by its temporary room code
   */
  public joinRoom(
    roomCode: string,
    user: { id: string; displayName: string; avatarUrl?: string | null }
  ): GameRoom {
    const room = this.db.getGameRoomByCode(roomCode);
    if (!room) {
      throw new Error(`Room with code "${roomCode}" not found or has expired.`);
    }

    // Check if user is already in the room
    const existingPlayer = room.players.find(p => p.userId === user.id);
    if (existingPlayer) {
      // Rejoining own slot
      return room;
    }

    if (room.status !== 'WAITING') {
      throw new Error('This match has already started or ended. Cannot join.');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error(`Room is full (${room.players.length}/${room.maxPlayers} players).`);
    }

    const def = GAME_DEFINITIONS[room.gameType];
    const colors = def.colorAssignments[room.maxPlayers];

    // Find first unoccupied seat
    const takenSeats = new Set(room.players.map(p => p.seat));
    let assignedSeat = -1;
    for (let s = 0; s < room.maxPlayers; s++) {
      if (!takenSeats.has(s)) {
        assignedSeat = s;
        break;
      }
    }

    if (assignedSeat === -1) {
      throw new Error('No seats available in this game room.');
    }

    const assignedColor = colors[assignedSeat];
    const newPlayer = this.db.addPlayerToGameRoom(room.id, user, assignedSeat, assignedColor);
    room.players.push(newPlayer);

    // Broadcast player joined to all room participants
    this.broadcast(room.id, {
      type: 'game:player_joined',
      roomId: room.id,
      payload: {
        room,
        player: newPlayer,
        totalPlayers: room.players.length,
        maxPlayers: room.maxPlayers
      }
    });

    // Check if room is now full of real human players
    if (room.players.length === room.maxPlayers) {
      this.startGame(room);
    }

    return room;
  }

  /**
   * Starts the game when all required human players are present
   */
  private startGame(room: GameRoom): void {
    const playerConfigs = room.players.map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      seat: p.seat,
      color: p.color
    }));

    const now = new Date().toISOString();
    let initialState: any;

    if (room.gameType === 'four-in-a-row') {
      initialState = FourInARowEngine.createInitialState(playerConfigs, 0);
    } else {
      initialState = LudoEngine.createInitialState(playerConfigs, room.maxPlayers as any);
    }

    this.db.updateGameRoomStatus(room.id, 'PLAYING', now);
    this.db.updateGameRoomState(room.id, initialState, initialState.currentTurnSeat);

    room.status = 'PLAYING';
    room.gameState = initialState;
    room.startedAt = now;

    // Broadcast game start countdown & authoritative initial state
    this.broadcast(room.id, {
      type: 'game:started',
      roomId: room.id,
      payload: {
        room,
        gameState: initialState,
        message: 'All human players connected! Game starting now!'
      }
    });
  }

  /**
   * Handle Player Roll Dice Action
   */
  public handleRollDice(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = LudoEngine.rollDice(room.gameState, player.seat);
    this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);

    this.broadcast(room.id, {
      type: 'game:dice_rolled',
      roomId: room.id,
      payload: {
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        diceValue: result.diceValue,
        hasLegalMoves: result.hasLegalMoves,
        legalMoves: result.state.legalMoves,
        earnedBonusRoll: result.earnedBonusRoll,
        passedTurn: result.passedTurn,
        gameState: result.state
      }
    });
  }

  /**
   * Handle Player Move Token Action
   */
  public handleMoveToken(roomId: string, userId: string, tokenId: number): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = LudoEngine.moveToken(room.gameState, player.seat, tokenId);

    if (result.isWinner) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, player.seat);
    } else {
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);
    }

    this.broadcast(room.id, {
      type: 'game:token_moved',
      roomId: room.id,
      payload: {
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        tokenId,
        capturedToken: result.capturedToken,
        earnedBonusRoll: result.earnedBonusRoll,
        isWinner: result.isWinner,
        winnerColor: result.state.winnerColor,
        winnerUserId: result.state.winnerUserId,
        gameState: result.state
      }
    });
  }

  /**
   * Handle Rematch Action
   */
  public handleRematch(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    this.startGame(room);
  }

  /**
   * Handle Four In A Row Drop Disc Action
   */
  public handleDropDisc(roomId: string, userId: string, col: number): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = FourInARowEngine.dropDisc(
      room.gameState,
      player.seat,
      col,
      { userId: player.userId, displayName: player.displayName },
      room.players
    );

    if (result.isWinner) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, player.seat);
    } else {
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);
    }

    this.broadcast(room.id, {
      type: 'game:disc_dropped',
      roomId: room.id,
      payload: {
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        row: result.row,
        col: result.col,
        disc: result.disc,
        isWinner: result.isWinner,
        isDraw: result.isDraw,
        winningLine: result.state.winningLine,
        gameState: result.state
      }
    });
  }

  /**
   * Registers a WebSocket connection to a game room
   */
  public registerClient(
    socket: WebSocket,
    roomId: string,
    user: { id: string; displayName: string; avatarUrl?: string | null }
  ): void {
    // Clear any pending disconnect grace timer
    const timer = this.disconnectGraceTimers.get(user.id);
    if (timer) {
      clearTimeout(timer);
      this.disconnectGraceTimers.delete(user.id);
    }

    let clientsSet = this.roomClients.get(roomId);
    if (!clientsSet) {
      clientsSet = new Set();
      this.roomClients.set(roomId, clientsSet);
    } else {
      // Remove any existing/stale socket for this user in this room to prevent duplicate sends
      for (const existing of Array.from(clientsSet)) {
        if (existing.userId === user.id) {
          if (existing.socket !== socket) {
            try {
              existing.socket.close();
            } catch {}
          }
          clientsSet.delete(existing);
        }
      }
    }

    const client: ConnectedGameClient = {
      socket,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roomId,
      isAlive: true
    };

    clientsSet.add(client);
    this.userClients.set(user.id, client);
    this.db.setGamePlayerConnected(roomId, user.id, true);

    // Send full authoritative current state upon connection
    let room = this.db.getGameRoomById(roomId);
    if (room) {
      let myPlayer = room.players.find(p => p.userId === user.id);
      if (!myPlayer && room.status === 'WAITING' && room.players.length < room.maxPlayers) {
        try {
          room = this.joinRoom(room.roomCode, user);
          myPlayer = room.players.find(p => p.userId === user.id);
        } catch (e: any) {
          console.error(`[GameRoom] Error auto-joining room ${room.roomCode} for user ${user.id}:`, e);
          socket.send(JSON.stringify({
            type: 'error:notification',
            payload: { code: 'JOIN_FAILED', message: e?.message || 'Failed to join game room' }
          }));
        }
      }

      const currentRoom = this.db.getGameRoomById(roomId) || room;
      const theme = this.roomThemes.get(roomId) || currentRoom.theme || 'romantic';
      currentRoom.theme = theme;
      const chatHistory = this.roomChatHistory.get(roomId) || [];
      currentRoom.chatHistory = chatHistory;

      socket.send(JSON.stringify({
        type: 'game:sync',
        roomId,
        payload: {
          room: currentRoom,
          theme,
          chatHistory,
          myUserId: user.id,
          myPlayer: myPlayer || currentRoom.players.find(p => p.userId === user.id)
        }
      }));

      this.broadcast(roomId, {
        type: 'game:player_reconnected',
        roomId,
        payload: { userId: user.id, displayName: user.displayName, room: currentRoom }
      });
    }

    // Handle WebSocket messages
    socket.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleClientMessage(client, msg);
      } catch (err) {
        console.error('Failed to parse game client message:', err);
      }
    });

    socket.on('close', () => {
      this.handleClientDisconnection(client);
    });
  }

  private handleClientMessage(client: ConnectedGameClient, msg: any): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'game:roll_dice':
        this.handleRollDice(client.roomId, client.userId);
        break;

      case 'game:move_token':
        this.handleMoveToken(client.roomId, client.userId, msg.payload?.tokenId);
        break;

      case 'game:rematch':
        this.handleRematch(client.roomId, client.userId);
        break;

      case 'game:drop_disc':
        this.handleDropDisc(client.roomId, client.userId, Number(msg.payload?.column ?? msg.payload?.col));
        break;

      case 'game:chat': {
        const now = Date.now();
        if (client.lastChatMessageTime && now - client.lastChatMessageTime < 350) {
          break;
        }
        client.lastChatMessageTime = now;
        if (msg.payload?.content) {
          const chatMsg = {
            id: `gchat_${nanoid(8)}`,
            userId: client.userId,
            userName: client.displayName,
            avatarUrl: client.avatarUrl,
            content: String(msg.payload.content).slice(0, 300),
            timestamp: now
          };

          let history = this.roomChatHistory.get(client.roomId);
          if (!history) {
            history = [];
            this.roomChatHistory.set(client.roomId, history);
          }
          history.push(chatMsg);
          if (history.length > 50) history.shift();

          this.broadcast(client.roomId, {
            type: 'game:chat_message',
            roomId: client.roomId,
            payload: chatMsg
          });
        }
        break;
      }

      case 'game:change_theme': {
        const theme = String(msg.payload?.theme || 'romantic');
        this.roomThemes.set(client.roomId, theme);
        const r = this.db.getGameRoomById(client.roomId);
        if (r) r.theme = theme;
        this.broadcast(client.roomId, {
          type: 'game:theme_changed',
          roomId: client.roomId,
          payload: { theme }
        });
        break;
      }

      case 'game:typing': {
        this.broadcast(client.roomId, {
          type: 'game:typing',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            userName: client.displayName,
            isTyping: Boolean(msg.payload?.isTyping)
          }
        }, client.userId); // broadcast to other participants in room
        break;
      }

      case 'game:reaction':
        if (msg.payload?.emoji) {
          this.broadcast(client.roomId, {
            type: 'game:reaction_broadcast',
            roomId: client.roomId,
            payload: {
              userId: client.userId,
              userName: client.displayName,
              emoji: msg.payload.emoji,
              timestamp: Date.now()
            }
          });
        }
        break;

      case 'webrtc:signal':
      case 'voice:signal':
        if (msg.payload?.targetUserId && msg.payload?.signal) {
          this.sendToUser(msg.payload.targetUserId, {
            type: 'webrtc:signal',
            roomId: client.roomId,
            payload: {
              fromUserId: client.userId,
              signal: msg.payload.signal
            }
          });
        }
        break;

      case 'voice:state':
        this.broadcast(client.roomId, {
          type: 'voice:state',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            isMuted: Boolean(msg.payload?.isMuted)
          }
        }, client.userId);
        break;

      case 'camera:state':
        this.broadcast(client.roomId, {
          type: 'camera:state',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            isCameraOn: Boolean(msg.payload?.isCameraOn)
          }
        }, client.userId);
        break;

      case 'game:nudge':
        this.broadcast(client.roomId, {
          type: 'game:nudge',
          roomId: client.roomId,
          payload: {
            fromUserId: client.userId,
            fromDisplayName: client.displayName,
            targetUserId: msg.payload?.targetUserId,
            timestamp: Date.now()
          }
        });
        break;

      case 'game:leave':
        this.handleClientLeave(client);
        break;
    }
  }

  private handleClientLeave(client: ConnectedGameClient): void {
    const set = this.roomClients.get(client.roomId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        this.roomClients.delete(client.roomId);
      }
    }
    this.userClients.delete(client.userId);
    this.db.setGamePlayerConnected(client.roomId, client.userId, false);

    this.broadcast(client.roomId, {
      type: 'game:player_left',
      roomId: client.roomId,
      payload: {
        userId: client.userId,
        displayName: client.displayName,
        reason: 'LEFT'
      }
    });
  }

  private handleClientDisconnection(client: ConnectedGameClient): void {
    const set = this.roomClients.get(client.roomId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        this.roomClients.delete(client.roomId);
      }
    }
    this.userClients.delete(client.userId);
    this.db.setGamePlayerConnected(client.roomId, client.userId, false);

    // 30-second grace timer for human reconnection
    const graceTimer = setTimeout(() => {
      this.disconnectGraceTimers.delete(client.userId);
      const room = this.db.getGameRoomById(client.roomId);
      if (room && room.status === 'WAITING') {
        // If room is still waiting, free seat
        this.db.removePlayerFromGameRoom(room.id, client.userId);
        this.broadcast(room.id, {
          type: 'game:player_left',
          roomId: room.id,
          payload: { userId: client.userId, displayName: client.displayName }
        });
      }
    }, 30000);

    this.disconnectGraceTimers.set(client.userId, graceTimer);

    // Broadcast disconnected alert to other players
    this.broadcast(client.roomId, {
      type: 'game:player_disconnected',
      roomId: client.roomId,
      payload: {
        userId: client.userId,
        displayName: client.displayName,
        graceSeconds: 30
      }
    });
  }

  public isUserOnline(userId: string): boolean {
    const client = this.userClients.get(userId);
    return Boolean(client && client.socket.readyState === 1);
  }

  public sendToUser(userId: string, message: any): boolean {
    const client = this.userClients.get(userId);
    if (client && client.socket.readyState === 1) {
      client.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public broadcast(roomId: string, message: any, excludeUserId?: string): void {
    const clients = this.roomClients.get(roomId);
    if (!clients) return;
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.socket.readyState === 1) {
        try {
          client.socket.send(data);
        } catch {}
      }
    }
  }
}
