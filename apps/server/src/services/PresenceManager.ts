import { WebSocket } from 'ws';
import { extractParticipantIdsFromConvId, toCanonicalConvId } from '../db/database.js';

export class PresenceManager {
  private db?: any;
  // userId -> Set of active WebSockets (one user could have multiple tabs/devices)
  private userSockets = new Map<string, Set<WebSocket>>();
  // userId -> timestamp (ms) of last activity/heartbeat
  private lastSeen = new Map<string, number>();

  constructor(db?: any) {
    this.db = db;
  }

  /**
   * Registers a client's global presence WebSocket
   */
  public registerSocket(
    ws: WebSocket,
    user: { id: string; displayName: string; partnerCode?: string; avatarUrl?: string | null; photoUrl?: string | null; avatar?: string | null }
  ): void {
    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id)!.add(ws);
    this.lastSeen.set(user.id, Date.now());

    // Send initial connection ack + list of currently online user IDs
    try {
      const onlineUserIds = Array.from(this.userSockets.keys());
      ws.send(
        JSON.stringify({
          type: 'presence:connected',
          userId: user.id,
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
    this.broadcastToOthers(user.id, {
      type: 'presence:user_status',
      userId: user.id,
      isOnline: true
    });

    // If any unread direct messages were pending for this user, deliver them now
    if (this.db && typeof this.db.markDirectMessagesAsDelivered === 'function') {
      try {
        const deliveredMsgs = this.db.markDirectMessagesAsDelivered(user.id);
        if (Array.isArray(deliveredMsgs) && deliveredMsgs.length > 0) {
          for (const d of deliveredMsgs) {
            // Deliver the message to this user
            this.sendToUser(user.id, {
              type: 'chat:message',
              message: d
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

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || !msg.type) return;

        // Heartbeat
        if (msg.type === 'presence:heartbeat' || msg.type === 'presence:ping') {
          this.recordHeartbeat(user.id);
          ws.send(JSON.stringify({ type: 'presence:ack', timestamp: Date.now() }));
        }

        // Live Direct Chat Message
        if (msg.type === 'chat:send' && msg.message) {
          const chatMsg = msg.message;
          let recipientId = chatMsg.recipientId;
          if (!recipientId && chatMsg.conversationId) {
            const { otherUserId } = extractParticipantIdsFromConvId(chatMsg.conversationId, user.id);
            if (otherUserId) {
              recipientId = otherUserId;
            }
          }

          const canonicalConvId = recipientId ? toCanonicalConvId(user.id, recipientId) : chatMsg.conversationId;

          // Attempt direct delivery to recipient sockets
          let isDelivered = false;
          if (recipientId) {
            isDelivered = this.sendToUser(recipientId, {
              type: 'chat:message',
              message: {
                ...chatMsg,
                conversationId: canonicalConvId,
                senderId: user.id,
                senderName: chatMsg.senderName || user.displayName,
                recipientId,
                status: 'delivered',
                createdAt: chatMsg.createdAt || new Date().toISOString()
              }
            });
          }

          const status = isDelivered ? 'delivered' : 'sent';
          const finalMsg = {
            ...chatMsg,
            conversationId: canonicalConvId,
            senderId: user.id,
            senderName: chatMsg.senderName || user.displayName,
            recipientId,
            status,
            createdAt: chatMsg.createdAt || new Date().toISOString()
          };

          if (this.db && typeof this.db.saveDirectChatMessage === 'function') {
            try {
              this.db.saveDirectChatMessage(finalMsg);
            } catch (e) {
              console.error('Failed to persist direct message:', e);
            }
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
          if (chatMsg.conversationId && chatMsg.conversationId !== canonicalConvId) {
            ws.send(
              JSON.stringify({
                type: 'chat:status_update',
                messageId: finalMsg.id,
                conversationId: chatMsg.conversationId,
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
              this.db.markDirectMessagesAsRead(conversationId, user.id);
            } catch {}
          }
          if (senderId) {
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
              const details = this.db.markDirectMessageViewOnceOpened(messageId);
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
            callerName: callerName || user.displayName || 'User',
            callerAvatar: callerAvatar || user.avatarUrl,
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
      } catch (e) {}
    });

    ws.on('close', () => {
      const set = this.userSockets.get(user.id);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.userSockets.delete(user.id);
          this.lastSeen.set(user.id, Date.now());

          // Broadcast that user is now OFFLINE to other connected users
          this.broadcastToOthers(user.id, {
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
  public sendToUser(userId: string, message: any): boolean {
    const sockets = this.userSockets.get(userId);
    let sent = false;
    if (sockets && sockets.size > 0) {
      const payload = JSON.stringify(message);
      for (const s of sockets) {
        if (s.readyState === 1) {
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
