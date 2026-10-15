import { prepareDirectMessage } from './directMessage.js';
import { SocketGuard } from '../util/socketGuard.js';
import { WebSocket } from 'ws';
import { extractParticipantIdsFromConvId, toCanonicalConvId } from '../db/database.js';
import { MongoDatabaseService } from '../db/mongoDatabase.js';
import { DatabaseService } from '../db/database.js';
import { ActiveDeviceSession, DeviceType, previewMessageText } from '@synccinema/common';

export interface ClientSocketInfo {
  ws: WebSocket;
  deviceId?: string;
  deviceType?: DeviceType;
  deviceToken?: string;
  browserName?: string;
  connectedAt: number;
}

export class PresenceManager {
  private db?: MongoDatabaseService;
  private sqliteDb?: DatabaseService;
  // userId -> Set of active WebSockets (one user could have multiple tabs/devices)
  private userSockets = new Map<string, Set<WebSocket>>();
  // socket -> device metadata
  private socketInfo = new WeakMap<WebSocket, ClientSocketInfo>();
  // userId -> active device session for notifications
  private userActiveDevices = new Map<string, ActiveDeviceSession>();
  // userId -> timestamp (ms) of last activity/heartbeat
  private lastSeen = new Map<string, number>();

  // Called when a message/event could not be delivered live (user has no open socket): used for Web Push
  private offlineNotifier: ((userId: string, payload: { title: string; body: string; tag?: string; url?: string; renotify?: boolean }) => void) | null = null;

  public setOfflineNotifier(fn: PresenceManager['offlineNotifier']): void {
    this.offlineNotifier = fn;
  }

  /** True when `deviceId` currently has an open presence socket for this user. */
  private deviceIsLive(userId: string, deviceId?: string): boolean {
    if (!deviceId) return false;
    for (const ws of this.userSockets.get(userId) || []) {
      if (ws.readyState === 1 && this.socketInfo.get(ws)?.deviceId === deviceId) return true;
    }
    return false;
  }

  /**
   * The "active device" only means something while that device is connected. When its last socket closes, hand the
   * role to another connected device, or clear it, so a phone that was turned off can no longer silence the laptop.
   */
  private async reconcileActiveDevice(userId: string): Promise<void> {
    const active = this.userActiveDevices.get(userId);
    if (!active || this.deviceIsLive(userId, active.deviceId)) return;

    let next: ActiveDeviceSession | null = null;
    let newest = 0;
    for (const ws of this.userSockets.get(userId) || []) {
      const info = this.socketInfo.get(ws);
      if (ws.readyState === 1 && info?.deviceId && info.connectedAt >= newest) {
        newest = info.connectedAt;
        next = { deviceId: info.deviceId, deviceType: info.deviceType || 'desktop', deviceToken: info.deviceToken, browserName: info.browserName, lastActiveAt: Date.now() };
      }
    }
    if (next) {
      await this.setActiveDevice(userId, next);
      return;
    }
    this.userActiveDevices.delete(userId);
    this.sendToUser(userId, { type: 'presence:active_device_changed', userId, activeDevice: null });
  }

  // userId -> accepted friends / partner ids (30s cache); presence & call signalling never reach strangers
  private relatedCache = new Map<string, { ids: Set<string>; at: number }>();

  constructor(db?: MongoDatabaseService, sqliteDb?: DatabaseService) {
    this.db = db;
    this.sqliteDb = sqliteDb;
  }

  private async relatedIds(userId: string): Promise<Set<string>> {
    const cached = this.relatedCache.get(userId);
    if (cached && Date.now() - cached.at < 30_000) return cached.ids;
    const ids = new Set<string>();
    try {
      const friends = (await this.db?.getFriendsWithStreaks(userId)) || [];
      for (const f of friends) ids.add(f.friendUser.id);
      const partner = await this.db?.getPartner(userId);
      if (partner) ids.add(partner.partnerUserId);
    } catch {}
    this.relatedCache.set(userId, { ids, at: Date.now() });
    return ids;
  }

  private async isRelated(a: string, b: string): Promise<boolean> {
    return (await this.relatedIds(a)).has(b);
  }

  /** Presence updates are only pushed to the user's friends/partner, not to every connected socket. */
  private async broadcastToRelated(userId: string, message: any): Promise<void> {
    for (const id of await this.relatedIds(userId)) this.sendToUser(id, message);
  }

  /**
   * Sets and broadcasts the active device session for a user
   */
  public async setActiveDevice(userId: string, device: ActiveDeviceSession): Promise<void> {
    this.userActiveDevices.set(userId, device);
    if (this.db) {
      try {
        await this.db.updateUserActiveDevice(userId, device);
      } catch (err) {
        console.error('Failed to update active device in mongo:', err);
      }
    }
    if (this.sqliteDb) {
      try {
        this.sqliteDb.updateUserActiveDevice(userId, device);
      } catch {}
    }

    // Broadcast active device change to all connected sockets of this user
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      const payload = JSON.stringify({
        type: 'presence:active_device_changed',
        userId,
        activeDevice: device
      });
      for (const s of sockets) {
        if (s.readyState === 1) {
          try {
            s.send(payload);
          } catch {}
        }
      }
    }
  }

  public getActiveDevice(userId: string): ActiveDeviceSession | undefined {
    return this.userActiveDevices.get(userId);
  }

  /**
   * Registers a client's global presence WebSocket
   */
  public async registerSocket(
    ws: WebSocket,
    user: { id: string; displayName: string; partnerCode?: string; avatarUrl?: string | null; photoUrl?: string | null; avatar?: string | null },
    clientDevice?: {
      deviceId?: string;
      deviceType?: DeviceType;
      deviceToken?: string;
      browserName?: string;
    }
  ): Promise<void> {
    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id)!.add(ws);
    this.lastSeen.set(user.id, Date.now());

    if (clientDevice) {
      this.socketInfo.set(ws, {
        ws,
        deviceId: clientDevice.deviceId,
        deviceType: clientDevice.deviceType || 'desktop',
        deviceToken: clientDevice.deviceToken,
        browserName: clientDevice.browserName,
        connectedAt: Date.now()
      });
    }

    // Current active device: only a device that is actually connected counts. (The one saved in the database may be a
    // phone that is switched off; adopting it used to mute notifications on the laptop forever.)
    let activeDev = this.userActiveDevices.get(user.id);
    if (activeDev && !this.deviceIsLive(user.id, activeDev.deviceId)) {
      this.userActiveDevices.delete(user.id);
      activeDev = undefined;
    }

    // If connecting from mobile, or if no active device is set yet, record this device as active
    if (clientDevice && (clientDevice.deviceType === 'mobile' || !activeDev)) {
      const newActive: ActiveDeviceSession = {
        deviceId: clientDevice.deviceId || `device_${Date.now()}`,
        deviceType: clientDevice.deviceType || 'desktop',
        deviceToken: clientDevice.deviceToken,
        browserName: clientDevice.browserName,
        lastActiveAt: Date.now()
      };
      await this.setActiveDevice(user.id, newActive);
      activeDev = newActive;
    }

    // Send initial connection ack + activeDevice + list of currently online user IDs
    try {
      const related = await this.relatedIds(user.id);
      const onlineUserIds = Array.from(this.userSockets.keys()).filter((id) => related.has(id));
      ws.send(
        JSON.stringify({
          type: 'presence:connected',
          userId: user.id,
          activeDevice: activeDev || null,
          timestamp: Date.now()
        })
      );
      ws.send(
        JSON.stringify({
          type: 'presence:initial_online_users',
          userIds: onlineUserIds
        })
      );
    } catch (e) {}

    // Broadcast that this user is now ONLINE to all other active connected users
    void this.broadcastToRelated(user.id, {
      type: 'presence:user_status',
      userId: user.id,
      isOnline: true
    });

    // If any unread direct messages were pending for this user, deliver them now
    if (this.db && typeof this.db.markDirectMessagesAsDelivered === 'function') {
      try {
        const deliveredMsgs = await Promise.resolve(this.db.markDirectMessagesAsDelivered(user.id));
        if (Array.isArray(deliveredMsgs) && deliveredMsgs.length > 0) {
          for (const d of deliveredMsgs) {
            // Deliver the message to this user
            // `backlog` = it was waiting while the user was offline (the client summarises these instead of alerting per message)
            this.sendToUser(user.id, {
              type: 'chat:message',
              message: d,
              backlog: true
            });
            // Update sender that message reached the device
            if (d.senderId) {
              this.sendToUser(d.senderId, {
                type: 'chat:status_update',
                messageId: d.id,
                conversationId: d.conversationId,
                status: 'delivered'
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to update delivered message status:', err);
      }
    }

    const guard = new SocketGuard(ws, { label: 'presence', ratePerSec: 30, burst: 100 }, `${user.displayName} (${user.id})`);
    ws.on('message', async (raw) => {
      try {
        const msg: any = guard.accept(raw);
        if (!msg) return;

        // Typing / call signalling may only target friends or the partner (stops call/typing spam & probing)
        const peerId =
          msg.type === 'chat:typing' || msg.type === 'call:invite' ? msg.recipientId
          : msg.type === 'call:accept' || msg.type === 'call:reject' ? msg.callerId
          : msg.type === 'call:end' || msg.type === 'call:signal' ? msg.targetUserId
          : undefined;
        if (peerId !== undefined && (typeof peerId !== 'string' || !(await this.isRelated(user.id, peerId)))) return;

        // Heartbeat
        if (msg.type === 'presence:heartbeat' || msg.type === 'presence:ping') {
          this.recordHeartbeat(user.id);
          ws.send(JSON.stringify({ type: 'presence:ack', timestamp: Date.now() }));
        }

        // Explicit or client-driven device activation
        if (msg.type === 'presence:activate_device') {
          const clientInfo = this.socketInfo.get(ws);
          const devType = msg.deviceType || clientInfo?.deviceType || 'desktop';
          const newActive: ActiveDeviceSession = {
            deviceId: msg.deviceId || clientInfo?.deviceId || `device_${Date.now()}`,
            deviceType: devType,
            deviceToken: msg.deviceToken || clientInfo?.deviceToken,
            browserName: msg.browserName || clientInfo?.browserName,
            lastActiveAt: Date.now()
          };
          await this.setActiveDevice(user.id, newActive);
        }

        // Live Direct Chat Message (same validation/sanitisation path as the HTTP endpoint)
        if (msg.type === 'chat:send' && msg.message && this.db) {
          const prepared = await prepareDirectMessage(
            this.db as any,
            { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl || user.photoUrl || user.avatar },
            msg.message,
            (id) => this.hasLiveSocket(id)
          );
          if (!prepared.ok) {
            ws.send(JSON.stringify({ type: 'error:notification', payload: { code: 'CHAT_REJECTED', message: prepared.error } }));
            return;
          }
          const finalMsg: any = prepared.msg;
          const canonicalConvId = finalMsg.conversationId;
          let status = finalMsg.status;

          const delivered = this.sendToUser(prepared.recipientId, {
            type: 'chat:message',
            message: finalMsg
          });
          if (delivered) {
            status = 'delivered';
            finalMsg.status = 'delivered';
          } else {
            // Recipient has no open tab: fall back to an OS-level push notification (if they enabled it)
            this.offlineNotifier?.(prepared.recipientId, {
              title: user.displayName,
              body: previewMessageText(finalMsg.content, finalMsg.type),
              tag: `chat:${finalMsg.conversationId}`,
              renotify: true,
              url: `/chat?userId=${encodeURIComponent(user.id)}`
            });
          }

          try {
            await Promise.resolve(this.db.saveDirectChatMessage(finalMsg));
          } catch (e) {
            console.error('Failed to persist direct message:', e);
          }

          // Acknowledge back to sender with updated status (sent or delivered)
          ws.send(
            JSON.stringify({
              type: 'chat:status_update',
              messageId: finalMsg.id,
              conversationId: canonicalConvId,
              status
            })
          );
          const clientConvId = msg.message.conversationId;
          if (typeof clientConvId === 'string' && clientConvId !== canonicalConvId) {
            ws.send(
              JSON.stringify({
                type: 'chat:status_update',
                messageId: finalMsg.id,
                conversationId: clientConvId,
                status
              })
            );
          }
        }

        // Read receipt
        if (msg.type === 'chat:read') {
          const { conversationId, messageIds, senderId } = msg;
          if (this.db && conversationId && typeof this.db.markDirectMessagesAsRead === 'function') {
            try {
              await Promise.resolve(this.db.markDirectMessagesAsRead(conversationId, user.id));
            } catch {}
          }
          if (typeof senderId === 'string' && (await this.isRelated(user.id, senderId))) {
            const canonicalConvId = `conv_${[user.id, senderId].sort().join('_')}`;
            this.sendToUser(senderId, {
              type: 'chat:status_update',
              conversationId: canonicalConvId,
              messageIds,
              status: 'read'
            });
            if (conversationId && conversationId !== canonicalConvId) {
              this.sendToUser(senderId, {
                type: 'chat:status_update',
                conversationId,
                messageIds,
                status: 'read'
              });
            }
          }
        }

        // View-once photo opened receipt
        if (msg.type === 'chat:view_once_opened') {
          const { conversationId, messageId } = msg;
          if (messageId && this.db && typeof this.db.markDirectMessageViewOnceOpened === 'function') {
            try {
              const details = await Promise.resolve(this.db.markDirectMessageViewOnceOpened(messageId, user.id));
              if (details) {
                const targetUser = details.senderId === user.id ? details.recipientId : details.senderId;
                if (targetUser) {
                  this.sendToUser(targetUser, {
                    type: 'chat:view_once_opened',
                    conversationId: details.conversationId || conversationId,
                    messageId,
                    openedBy: user.id
                  });
                }
              }
            } catch {}
          }
        }

        // Typing indicator
        if (msg.type === 'chat:typing' && msg.recipientId) {
          this.sendToUser(msg.recipientId, {
            type: 'chat:typing',
            conversationId: msg.conversationId,
            fromUserId: user.id,
            isTyping: Boolean(msg.isTyping)
          });
        }

        // --- Real-Time Call Signaling (Voice & Video) ---
        if (msg.type === 'call:invite') {
          const { callId, recipientId, callType, callerName, callerAvatar } = msg;
          if (!recipientId) return;

          const isOnline = this.isUserOnline(recipientId);
          if (!isOnline) {
            ws.send(
              JSON.stringify({
                type: 'call:ended',
                callId,
                recipientId,
                reason: 'offline'
              })
            );
            return;
          }

          // Route incoming call alert to recipient's active socket(s)
          this.sendToUser(recipientId, {
            type: 'call:incoming',
            callId,
            callerId: user.id,
            callerName: user.displayName || 'User', // never trust a client-supplied caller identity
            callerAvatar: user.avatarUrl,
            callType: callType || 'voice'
          });

          // Confirm to caller that recipient device is ringing
          ws.send(
            JSON.stringify({
              type: 'call:ringing',
              callId,
              recipientId
            })
          );
        }

        if (msg.type === 'call:accept') {
          const { callId, callerId } = msg;
          if (callerId) {
            this.sendToUser(callerId, {
              type: 'call:accepted',
              callId,
              responderId: user.id,
              responderName: user.displayName,
              responderAvatar: user.avatarUrl
            });
          }
        }

        if (msg.type === 'call:reject') {
          const { callId, callerId, reason } = msg;
          if (callerId) {
            this.sendToUser(callerId, {
              type: 'call:ended',
              callId,
              responderId: user.id,
              reason: reason || 'declined'
            });
          }
        }

        if (msg.type === 'call:end') {
          const { callId, targetUserId, reason } = msg;
          if (targetUserId) {
            this.sendToUser(targetUserId, {
              type: 'call:ended',
              callId,
              reason: reason || 'ended'
            });
          }
        }

        if (msg.type === 'call:signal') {
          const { callId, targetUserId, signal } = msg;
          if (targetUserId && signal) {
            this.sendToUser(targetUserId, {
              type: 'call:signal',
              callId,
              senderId: user.id,
              signal
            });
          }
        }
      } catch (e) {
        guard.failed('presence', e);
      }
    });

    ws.on('close', () => {
      const set = this.userSockets.get(user.id);
      if (set) {
        set.delete(ws);
        void this.reconcileActiveDevice(user.id);
        if (set.size === 0) {
          this.userSockets.delete(user.id);
          this.lastSeen.set(user.id, Date.now());

          // Broadcast that user is now OFFLINE to other connected users
          void this.broadcastToRelated(user.id, {
            type: 'presence:user_status',
            userId: user.id,
            isOnline: false,
            lastSeen: new Date().toISOString()
          });
        }
      }
    });

    ws.on('error', () => {
      const set = this.userSockets.get(user.id);
      if (set) {
        set.delete(ws);
      }
    });
  }

  /**
   * Records a heartbeat from a user (HTTP or WS)
   */
  public recordHeartbeat(userId: string): void {
    this.lastSeen.set(userId, Date.now());
  }

  /** True only with an open presence socket (a recent heartbeat is not enough to call a message "delivered"). */
  public hasLiveSocket(userId: string): boolean {
    for (const s of this.userSockets.get(userId) || []) if (s.readyState === 1) return true;
    return false;
  }

  /**
   * Checks if user is currently online (has open socket or sent heartbeat in last 25s)
   */
  public isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      for (const s of sockets) {
        if (s.readyState === 1) return true;
      }
    }
    const last = this.lastSeen.get(userId);
    if (last && Date.now() - last < 25000) {
      return true;
    }
    return false;
  }

  /**
   * Delivers a live message to a user across any of their active presence sockets
   */
  public sendToUser(userId: string, message: any, options?: { onlyActiveDevice?: boolean }): boolean {
    const sockets = this.userSockets.get(userId);
    let sent = false;
    if (sockets && sockets.size > 0) {
      const activeDev = this.userActiveDevices.get(userId);
      const enhancedMsg = activeDev
        ? { ...message, _activeDevice: activeDev }
        : message;
      const payload = JSON.stringify(enhancedMsg);

      for (const s of sockets) {
        if (s.readyState === 1) {
          if (options?.onlyActiveDevice && activeDev) {
            const info = this.socketInfo.get(s);
            if (info && info.deviceId && info.deviceId !== activeDev.deviceId) {
              continue;
            }
          }
          try {
            s.send(payload);
            sent = true;
          } catch (e) {}
        }
      }
    }
    return sent;
  }

  /**
   * Broadcasts a message to all connected users except the sender
   */
  public broadcastToOthers(excludeUserId: string, message: any): void {
    const payload = JSON.stringify(message);
    for (const [uid, sockets] of this.userSockets.entries()) {
      if (uid === excludeUserId) continue;
      for (const s of sockets) {
        if (s.readyState === 1) {
          try {
            s.send(payload);
          } catch (e) {}
        }
      }
    }
  }
}
