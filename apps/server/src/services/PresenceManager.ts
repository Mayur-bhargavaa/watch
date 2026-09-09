import { WebSocket } from 'ws';

export class PresenceManager {
  // userId -> Set of active WebSockets (one user could have 2 tabs open)
  private userSockets = new Map<string, Set<WebSocket>>();
  // userId -> timestamp (ms) of last activity/heartbeat
  private lastSeen = new Map<string, number>();

  /**
   * Registers a client's global presence WebSocket
   */
  public registerSocket(
    ws: WebSocket,
    user: { id: string; displayName: string; partnerCode?: string }
  ): void {
    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id)!.add(ws);
    this.lastSeen.set(user.id, Date.now());

    // Send initial ack
    try {
      ws.send(
        JSON.stringify({
          type: 'presence:connected',
          userId: user.id,
          timestamp: Date.now()
        })
      );
    } catch (e) {}

    ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'presence:heartbeat') {
          this.recordHeartbeat(user.id);
          ws.send(JSON.stringify({ type: 'presence:ack', timestamp: Date.now() }));
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      const set = this.userSockets.get(user.id);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.userSockets.delete(user.id);
        }
      }
      this.lastSeen.set(user.id, Date.now());
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
}
