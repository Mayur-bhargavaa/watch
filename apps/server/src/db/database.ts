import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  User,
  Room,
  RoomMember,
  MediaItem,
  RoomPlaybackState,
  Reaction,
  ChatMessage,
  Role,
  RoomPrivacy
} from '@synccinema/common';

export class DatabaseService {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    if (!dbPath || dbPath === ':memory:') {
      this.db = new DatabaseSync(':memory:');
    } else {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(dbPath);
    }
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        is_anonymous INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        host_id TEXT NOT NULL,
        privacy TEXT DEFAULT 'INVITE_ONLY',
        is_locked INTEGER DEFAULT 0,
        current_media_id TEXT,
        activity_mode TEXT DEFAULT 'CINEMA',
        created_at TEXT NOT NULL,
        ended_at TEXT,
        FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS room_members (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'PARTICIPANT',
        joined_at TEXT NOT NULL,
        left_at TEXT,
        is_connected INTEGER DEFAULT 1,
        UNIQUE(room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_media_id TEXT,
        source_url TEXT NOT NULL,
        title TEXT NOT NULL,
        poster_url TEXT,
        duration_seconds REAL DEFAULT 0.0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playback_states (
        room_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        position REAL NOT NULL,
        server_timestamp INTEGER NOT NULL,
        playback_rate REAL DEFAULT 1.0,
        version INTEGER NOT NULL,
        updated_by TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS playback_events (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        actor_id TEXT,
        action TEXT NOT NULL,
        position REAL NOT NULL,
        playback_rate REAL DEFAULT 1.0,
        server_timestamp INTEGER NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        media_id TEXT NOT NULL,
        reaction_code TEXT NOT NULL,
        emoji TEXT NOT NULL,
        media_timestamp REAL NOT NULL,
        server_timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT,
        content TEXT NOT NULL,
        media_timestamp REAL,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
      CREATE INDEX IF NOT EXISTS idx_reactions_room ON reactions(room_id, media_timestamp);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at);
    `);

    // Migration for existing databases
    try {
      this.db.exec("ALTER TABLE rooms ADD COLUMN activity_mode TEXT DEFAULT 'CINEMA'");
    } catch {
      // Column already exists
    }

    // On server startup, reset any stale connected status from previous runs
    try {
      this.db.exec("UPDATE room_members SET is_connected = 0 WHERE is_connected = 1");
    } catch {}
  }

  resetAllMembersDisconnected(): void {
    try {
      this.db.exec("UPDATE room_members SET is_connected = 0 WHERE is_connected = 1");
    } catch {}
  }

  // --- Users ---
  createUser(user: User, passwordHash?: string): User {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, avatar_url, is_anonymous, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.email || null,
      passwordHash || null,
      user.displayName,
      user.avatarUrl || null,
      user.isAnonymous ? 1 : 0,
      user.createdAt
    );
    return user;
  }

  getUserById(id: string): User | null {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      isAnonymous: Boolean(row.is_anonymous),
      createdAt: row.created_at
    };
  }

  getUserByEmail(email: string): { user: User; passwordHash?: string } | null {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE email = ?`);
    const row = stmt.get(email) as any;
    if (!row) return null;
    return {
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        isAnonymous: Boolean(row.is_anonymous),
        createdAt: row.created_at
      },
      passwordHash: row.password_hash
    };
  }

  // --- Media ---
  createOrGetMedia(media: MediaItem): MediaItem {
    const existing = this.db.prepare(`SELECT * FROM media WHERE source_url = ?`).get(media.sourceUrl) as any;
    if (existing) {
      return {
        id: existing.id,
        provider: existing.provider,
        providerMediaId: existing.provider_media_id,
        sourceUrl: existing.source_url,
        title: existing.title,
        posterUrl: existing.poster_url,
        durationSeconds: existing.duration_seconds
      };
    }
    const stmt = this.db.prepare(`
      INSERT INTO media (id, provider, provider_media_id, source_url, title, poster_url, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      media.id,
      media.provider,
      media.providerMediaId || null,
      media.sourceUrl,
      media.title,
      media.posterUrl || null,
      media.durationSeconds,
      new Date().toISOString()
    );
    return media;
  }

  getMediaById(id: string): MediaItem | null {
    const row = this.db.prepare(`SELECT * FROM media WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      providerMediaId: row.provider_media_id,
      sourceUrl: row.source_url,
      title: row.title,
      posterUrl: row.poster_url,
      durationSeconds: row.duration_seconds
    };
  }

  // --- Rooms ---
  createRoom(room: Room): void {
    const stmt = this.db.prepare(`
      INSERT INTO rooms (id, slug, title, description, host_id, privacy, is_locked, current_media_id, activity_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      room.id,
      room.slug,
      room.title,
      room.description || null,
      room.hostId,
      room.privacy,
      room.isLocked ? 1 : 0,
      room.currentMedia ? room.currentMedia.id : null,
      room.activityMode || 'CINEMA',
      room.createdAt
    );

    // Initial playback state
    this.updatePlaybackState(room.playbackState);
  }

  getRoomBySlug(slug: string): Room | null {
    const row = this.db.prepare(`SELECT * FROM rooms WHERE slug = ?`).get(slug) as any;
    if (!row) return null;
    const currentMedia = row.current_media_id ? this.getMediaById(row.current_media_id) : null;
    const playbackState = this.getPlaybackState(row.id);

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      hostId: row.host_id,
      privacy: row.privacy as RoomPrivacy,
      isLocked: Boolean(row.is_locked),
      currentMedia,
      playbackState: playbackState || {
        roomId: row.id,
        state: 'PAUSED',
        position: 0,
        serverTimestamp: Date.now(),
        playbackRate: 1.0,
        version: 0,
        updatedBy: row.host_id
      },
      activityMode: (row.activity_mode as 'CINEMA' | 'GAMING') || 'CINEMA',
      createdAt: row.created_at,
      endedAt: row.ended_at
    };
  }

  updateRoomMedia(roomId: string, mediaId: string): void {
    this.db.prepare(`UPDATE rooms SET current_media_id = ? WHERE id = ?`).run(mediaId, roomId);
  }

  updateRoomHost(roomId: string, newHostId: string): void {
    this.db.prepare(`UPDATE rooms SET host_id = ? WHERE id = ?`).run(newHostId, roomId);
  }

  endRoom(roomId: string): void {
    this.db.prepare(`UPDATE rooms SET ended_at = ? WHERE id = ?`).run(new Date().toISOString(), roomId);
  }

  getRoomsByHost(userId: string): Room[] {
    const rows = this.db.prepare(`SELECT * FROM rooms WHERE host_id = ? ORDER BY created_at DESC LIMIT 20`).all(userId) as any[];
    return rows.map(row => {
      const currentMedia = row.current_media_id ? this.getMediaById(row.current_media_id) : null;
      const playbackState = this.getPlaybackState(row.id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        hostId: row.host_id,
        privacy: row.privacy as RoomPrivacy,
        isLocked: Boolean(row.is_locked),
        currentMedia,
        playbackState: playbackState || {
          roomId: row.id,
          state: 'PAUSED',
          position: 0,
          serverTimestamp: Date.now(),
          playbackRate: 1.0,
          version: 0,
          updatedBy: row.host_id
        },
        activityMode: (row.activity_mode as 'CINEMA' | 'GAMING') || 'CINEMA',
        createdAt: row.created_at,
        endedAt: row.ended_at
      };
    });
  }

  // --- Playback State ---
  updatePlaybackState(state: RoomPlaybackState): void {
    const stmt = this.db.prepare(`
      INSERT INTO playback_states (room_id, state, position, server_timestamp, playback_rate, version, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        state = excluded.state,
        position = excluded.position,
        server_timestamp = excluded.server_timestamp,
        playback_rate = excluded.playback_rate,
        version = excluded.version,
        updated_by = excluded.updated_by
    `);
    stmt.run(
      state.roomId,
      state.state,
      state.position,
      state.serverTimestamp,
      state.playbackRate,
      state.version,
      state.updatedBy
    );
  }

  getPlaybackState(roomId: string): RoomPlaybackState | null {
    const row = this.db.prepare(`SELECT * FROM playback_states WHERE room_id = ?`).get(roomId) as any;
    if (!row) return null;
    return {
      roomId: row.room_id,
      state: row.state,
      position: row.position,
      serverTimestamp: row.server_timestamp,
      playbackRate: row.playback_rate,
      version: row.version,
      updatedBy: row.updated_by
    };
  }

  logPlaybackEvent(eventId: string, state: RoomPlaybackState, action: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO playback_events (id, room_id, actor_id, action, position, playback_rate, server_timestamp, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      eventId,
      state.roomId,
      state.updatedBy,
      action,
      state.position,
      state.playbackRate,
      state.serverTimestamp,
      state.version,
      new Date().toISOString()
    );
  }

  // --- Members ---
  upsertMember(member: RoomMember): void {
    const stmt = this.db.prepare(`
      INSERT INTO room_members (id, room_id, user_id, display_name, avatar_url, role, joined_at, is_connected)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id, user_id) DO UPDATE SET
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        is_connected = 1,
        left_at = NULL
    `);
    stmt.run(
      member.id,
      member.roomId,
      member.userId,
      member.displayName,
      member.avatarUrl || null,
      member.role,
      member.joinedAt,
      1
    );
  }

  setMemberDisconnected(roomId: string, userId: string): void {
    this.db.prepare(`
      UPDATE room_members SET is_connected = 0, left_at = ? WHERE room_id = ? AND user_id = ?
    `).run(new Date().toISOString(), roomId, userId);
  }

  updateMemberRole(roomId: string, userId: string, role: Role): void {
    this.db.prepare(`UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?`).run(role, roomId, userId);
  }

  getRoomMembers(roomId: string): RoomMember[] {
    const rows = this.db.prepare(`SELECT * FROM room_members WHERE room_id = ? AND is_connected = 1`).all(roomId) as any[];
    return rows.map(r => ({
      id: r.id,
      roomId: r.room_id,
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      role: r.role as Role,
      status: 'WATCHING',
      joinedAt: r.joined_at,
      isConnected: Boolean(r.is_connected)
    }));
  }

  // --- Reactions ---
  insertReaction(reaction: Reaction): void {
    const stmt = this.db.prepare(`
      INSERT INTO reactions (id, room_id, user_id, user_name, media_id, reaction_code, emoji, media_timestamp, server_timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      reaction.id,
      reaction.roomId,
      reaction.userId,
      reaction.userName,
      reaction.mediaId,
      reaction.reactionCode,
      reaction.emoji,
      reaction.mediaTimestamp,
      reaction.serverTimestamp,
      reaction.createdAt
    );
  }

  getRecentReactions(roomId: string, limit = 50): Reaction[] {
    const rows = this.db.prepare(`
      SELECT * FROM reactions WHERE room_id = ? ORDER BY server_timestamp DESC LIMIT ?
    `).all(roomId, limit) as any[];
    return rows.reverse().map(r => ({
      id: r.id,
      roomId: r.room_id,
      userId: r.user_id,
      userName: r.user_name,
      mediaId: r.media_id,
      reactionCode: r.reaction_code,
      emoji: r.emoji,
      mediaTimestamp: r.media_timestamp,
      serverTimestamp: r.server_timestamp,
      createdAt: r.created_at
    }));
  }

  // Aggregated reaction timeline / heatmap for Post-Watch Recap
  getReactionHeatmap(roomId: string, bucketSeconds = 15): Array<{
    bucketStart: number;
    count: number;
    topEmoji: string;
    reactionCounts: Record<string, number>;
  }> {
    const reactions = this.db.prepare(`
      SELECT media_timestamp, emoji FROM reactions WHERE room_id = ? ORDER BY media_timestamp ASC
    `).all(roomId) as any[];

    const buckets = new Map<number, { count: number; emojis: Record<string, number> }>();

    for (const r of reactions) {
      const bucket = Math.floor(r.media_timestamp / bucketSeconds) * bucketSeconds;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { count: 0, emojis: {} });
      }
      const b = buckets.get(bucket)!;
      b.count++;
      b.emojis[r.emoji] = (b.emojis[r.emoji] || 0) + 1;
    }

    return Array.from(buckets.entries()).map(([bucketStart, data]) => {
      let topEmoji = '🔥';
      let maxCount = 0;
      for (const [emoji, cnt] of Object.entries(data.emojis)) {
        if (cnt > maxCount) {
          maxCount = cnt;
          topEmoji = emoji;
        }
      }
      return {
        bucketStart,
        count: data.count,
        topEmoji,
        reactionCounts: data.emojis
      };
    });
  }

  // --- Chat ---
  insertChatMessage(msg: ChatMessage): void {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, room_id, user_id, user_name, user_avatar, content, media_timestamp, is_deleted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      msg.id,
      msg.roomId,
      msg.userId,
      msg.userName,
      msg.userAvatar || null,
      msg.content,
      msg.mediaTimestamp ?? null,
      msg.isDeleted ? 1 : 0,
      msg.createdAt
    );
  }

  getRecentChatMessages(roomId: string, limit = 100): ChatMessage[] {
    const rows = this.db.prepare(`
      SELECT * FROM chat_messages WHERE room_id = ? AND is_deleted = 0 ORDER BY created_at ASC LIMIT ?
    `).all(roomId, limit) as any[];
    return rows.map(r => ({
      id: r.id,
      roomId: r.room_id,
      userId: r.user_id,
      userName: r.user_name,
      userAvatar: r.user_avatar,
      content: r.content,
      mediaTimestamp: r.media_timestamp,
      isDeleted: Boolean(r.is_deleted),
      createdAt: r.created_at
    }));
  }

  deleteChatMessage(messageId: string): void {
    this.db.prepare(`UPDATE chat_messages SET is_deleted = 1 WHERE id = ?`).run(messageId);
  }

  // --- Privacy & GDPR Data Deletion ---
  deleteUserData(userId: string): void {
    const hostedRooms = this.db.prepare(`SELECT id FROM rooms WHERE host_id = ?`).all(userId) as any[];
    for (const r of hostedRooms) {
      this.db.prepare(`DELETE FROM playback_states WHERE room_id = ?`).run(r.id);
      this.db.prepare(`DELETE FROM playback_events WHERE room_id = ?`).run(r.id);
      this.db.prepare(`DELETE FROM reactions WHERE room_id = ?`).run(r.id);
      this.db.prepare(`DELETE FROM chat_messages WHERE room_id = ?`).run(r.id);
      this.db.prepare(`DELETE FROM room_members WHERE room_id = ?`).run(r.id);
      this.db.prepare(`DELETE FROM rooms WHERE id = ?`).run(r.id);
    }
    this.db.prepare(`DELETE FROM chat_messages WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM reactions WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM room_members WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
  }
}
