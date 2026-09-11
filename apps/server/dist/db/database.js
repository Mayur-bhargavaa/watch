import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
export class DatabaseService {
    db;
    constructor(dbPath) {
        if (!dbPath || dbPath === ':memory:') {
            this.db = new DatabaseSync(':memory:');
        }
        else {
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this.db = new DatabaseSync(dbPath);
        }
        this.initSchema();
    }
    initSchema() {
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
        theme_id TEXT DEFAULT 'default',
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
        reply_to TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
      CREATE INDEX IF NOT EXISTS idx_reactions_room ON reactions(room_id, media_timestamp);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at);

      CREATE TABLE IF NOT EXISTS partner_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        partner_user_id TEXT NOT NULL,
        status TEXT DEFAULT 'ACCEPTED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, partner_user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (partner_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_partner_conn_user ON partner_connections(user_id);
      CREATE INDEX IF NOT EXISTS idx_partner_conn_partner ON partner_connections(partner_user_id);

      CREATE TABLE IF NOT EXISTS game_rooms (
        id TEXT PRIMARY KEY,
        room_code TEXT UNIQUE NOT NULL,
        game_type TEXT NOT NULL,
        host_user_id TEXT NOT NULL,
        max_players INTEGER NOT NULL,
        min_players INTEGER NOT NULL,
        is_private INTEGER DEFAULT 0,
        status TEXT DEFAULT 'WAITING',
        game_state TEXT,
        current_turn_seat INTEGER DEFAULT 0,
        winner_seat INTEGER,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(room_code);
      CREATE INDEX IF NOT EXISTS idx_game_rooms_matching ON game_rooms(game_type, status, is_private, max_players);

      CREATE TABLE IF NOT EXISTS game_room_players (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        seat INTEGER NOT NULL,
        color TEXT NOT NULL,
        status TEXT DEFAULT 'WAITING',
        is_connected INTEGER DEFAULT 1,
        joined_at TEXT NOT NULL,
        UNIQUE(room_id, user_id),
        UNIQUE(room_id, seat),
        FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_game_players_room ON game_room_players(room_id);
    `);
        // Migration for existing databases
        try {
            this.db.exec("ALTER TABLE rooms ADD COLUMN activity_mode TEXT DEFAULT 'CINEMA'");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE rooms ADD COLUMN theme_id TEXT DEFAULT 'default'");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE chat_messages ADD COLUMN reply_to TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN partner_code TEXT");
            this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_partner_code ON users(partner_code)");
        }
        catch { }
        // On server startup, reset any stale connected status from previous runs
        try {
            this.db.exec("UPDATE room_members SET is_connected = 0 WHERE is_connected = 1");
            this.db.exec("UPDATE game_room_players SET is_connected = 0 WHERE is_connected = 1");
        }
        catch { }
    }
    resetAllMembersDisconnected() {
        try {
            this.db.exec("UPDATE room_members SET is_connected = 0 WHERE is_connected = 1");
        }
        catch { }
    }
    // --- Users ---
    createUser(user, passwordHash) {
        const partnerCode = this.generateUniquePartnerCode(user.displayName);
        const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, avatar_url, is_anonymous, partner_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        partner_code = COALESCE(users.partner_code, excluded.partner_code)
    `);
        stmt.run(user.id, user.email || null, passwordHash || null, user.displayName, user.avatarUrl || null, user.isAnonymous ? 1 : 0, partnerCode, user.createdAt);
        const saved = this.getUserById(user.id);
        return saved || {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            isAnonymous: Boolean(user.isAnonymous),
            partnerCode,
            createdAt: user.createdAt
        };
    }
    getUserById(id) {
        const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return null;
        const partnerCode = row.partner_code || this.ensureUserPartnerCode(row.id, row.display_name);
        return {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            isAnonymous: Boolean(row.is_anonymous),
            partnerCode,
            createdAt: row.created_at
        };
    }
    getUserByEmail(email) {
        const stmt = this.db.prepare(`SELECT * FROM users WHERE email = ?`);
        const row = stmt.get(email);
        if (!row)
            return null;
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
    createOrGetMedia(media) {
        const existing = this.db.prepare(`SELECT * FROM media WHERE source_url = ?`).get(media.sourceUrl);
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
        stmt.run(media.id, media.provider, media.providerMediaId || null, media.sourceUrl, media.title, media.posterUrl || null, media.durationSeconds, new Date().toISOString());
        return media;
    }
    getMediaById(id) {
        const row = this.db.prepare(`SELECT * FROM media WHERE id = ?`).get(id);
        if (!row)
            return null;
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
    createRoom(room) {
        const stmt = this.db.prepare(`
      INSERT INTO rooms (id, slug, title, description, host_id, privacy, is_locked, current_media_id, activity_mode, theme_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(room.id, room.slug, room.title, room.description || null, room.hostId, room.privacy, room.isLocked ? 1 : 0, room.currentMedia ? room.currentMedia.id : null, room.activityMode || 'CINEMA', room.themeId || 'default', room.createdAt);
        // Initial playback state
        this.updatePlaybackState(room.playbackState);
    }
    getRoomBySlug(slug) {
        const row = this.db.prepare(`SELECT * FROM rooms WHERE slug = ?`).get(slug);
        if (!row)
            return null;
        const currentMedia = row.current_media_id ? this.getMediaById(row.current_media_id) : null;
        const playbackState = this.getPlaybackState(row.id);
        return {
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            hostId: row.host_id,
            privacy: row.privacy,
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
            activityMode: row.activity_mode || 'CINEMA',
            themeId: row.theme_id || 'default',
            createdAt: row.created_at,
            endedAt: row.ended_at
        };
    }
    updateRoomMedia(roomId, mediaId) {
        this.db.prepare(`UPDATE rooms SET current_media_id = ? WHERE id = ?`).run(mediaId, roomId);
    }
    updateRoomTheme(roomId, themeId) {
        this.db.prepare(`UPDATE rooms SET theme_id = ? WHERE id = ?`).run(themeId, roomId);
    }
    updateRoomHost(roomId, newHostId) {
        this.db.prepare(`UPDATE rooms SET host_id = ? WHERE id = ?`).run(newHostId, roomId);
    }
    endRoom(roomId) {
        this.db.prepare(`UPDATE rooms SET ended_at = ? WHERE id = ?`).run(new Date().toISOString(), roomId);
    }
    getRoomsByHost(userId) {
        const rows = this.db.prepare(`SELECT * FROM rooms WHERE host_id = ? ORDER BY created_at DESC LIMIT 20`).all(userId);
        return rows.map(row => {
            const currentMedia = row.current_media_id ? this.getMediaById(row.current_media_id) : null;
            const playbackState = this.getPlaybackState(row.id);
            return {
                id: row.id,
                slug: row.slug,
                title: row.title,
                description: row.description,
                hostId: row.host_id,
                privacy: row.privacy,
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
                activityMode: row.activity_mode || 'CINEMA',
                themeId: row.theme_id || 'default',
                createdAt: row.created_at,
                endedAt: row.ended_at
            };
        });
    }
    // --- Playback State ---
    updatePlaybackState(state) {
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
        stmt.run(state.roomId, state.state, state.position, state.serverTimestamp, state.playbackRate, state.version, state.updatedBy);
    }
    getPlaybackState(roomId) {
        const row = this.db.prepare(`SELECT * FROM playback_states WHERE room_id = ?`).get(roomId);
        if (!row)
            return null;
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
    logPlaybackEvent(eventId, state, action) {
        const stmt = this.db.prepare(`
      INSERT INTO playback_events (id, room_id, actor_id, action, position, playback_rate, server_timestamp, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(eventId, state.roomId, state.updatedBy, action, state.position, state.playbackRate, state.serverTimestamp, state.version, new Date().toISOString());
    }
    // --- Members ---
    upsertMember(member) {
        const stmt = this.db.prepare(`
      INSERT INTO room_members (id, room_id, user_id, display_name, avatar_url, role, joined_at, is_connected)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id, user_id) DO UPDATE SET
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        is_connected = 1,
        left_at = NULL
    `);
        stmt.run(member.id, member.roomId, member.userId, member.displayName, member.avatarUrl || null, member.role, member.joinedAt, 1);
    }
    setMemberDisconnected(roomId, userId) {
        this.db.prepare(`
      UPDATE room_members SET is_connected = 0, left_at = ? WHERE room_id = ? AND user_id = ?
    `).run(new Date().toISOString(), roomId, userId);
    }
    updateMemberRole(roomId, userId, role) {
        this.db.prepare(`UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?`).run(role, roomId, userId);
    }
    getRoomMembers(roomId) {
        const rows = this.db.prepare(`SELECT * FROM room_members WHERE room_id = ? AND is_connected = 1`).all(roomId);
        return rows.map(r => ({
            id: r.id,
            roomId: r.room_id,
            userId: r.user_id,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            role: r.role,
            status: 'WATCHING',
            joinedAt: r.joined_at,
            isConnected: Boolean(r.is_connected)
        }));
    }
    // --- Reactions ---
    insertReaction(reaction) {
        const stmt = this.db.prepare(`
      INSERT INTO reactions (id, room_id, user_id, user_name, media_id, reaction_code, emoji, media_timestamp, server_timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(reaction.id, reaction.roomId, reaction.userId, reaction.userName, reaction.mediaId, reaction.reactionCode, reaction.emoji, reaction.mediaTimestamp, reaction.serverTimestamp, reaction.createdAt);
    }
    getRecentReactions(roomId, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM reactions WHERE room_id = ? ORDER BY server_timestamp DESC LIMIT ?
    `).all(roomId, limit);
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
    getReactionHeatmap(roomId, bucketSeconds = 15) {
        const reactions = this.db.prepare(`
      SELECT media_timestamp, emoji FROM reactions WHERE room_id = ? ORDER BY media_timestamp ASC
    `).all(roomId);
        const buckets = new Map();
        for (const r of reactions) {
            const bucket = Math.floor(r.media_timestamp / bucketSeconds) * bucketSeconds;
            if (!buckets.has(bucket)) {
                buckets.set(bucket, { count: 0, emojis: {} });
            }
            const b = buckets.get(bucket);
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
    insertChatMessage(msg) {
        const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, room_id, user_id, user_name, user_avatar, content, media_timestamp, reply_to, is_deleted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(msg.id, msg.roomId, msg.userId, msg.userName, msg.userAvatar || null, msg.content, msg.mediaTimestamp ?? null, msg.replyTo ? JSON.stringify(msg.replyTo) : null, msg.isDeleted ? 1 : 0, msg.createdAt);
    }
    getRecentChatMessages(roomId, limit = 100) {
        const rows = this.db.prepare(`
      SELECT * FROM chat_messages WHERE room_id = ? AND is_deleted = 0 ORDER BY created_at ASC LIMIT ?
    `).all(roomId, limit);
        return rows.map(r => ({
            id: r.id,
            roomId: r.room_id,
            userId: r.user_id,
            userName: r.user_name,
            userAvatar: r.user_avatar,
            content: r.content,
            mediaTimestamp: r.media_timestamp,
            replyTo: r.reply_to ? (() => {
                try {
                    return JSON.parse(r.reply_to);
                }
                catch {
                    return null;
                }
            })() : null,
            isDeleted: Boolean(r.is_deleted),
            createdAt: r.created_at
        }));
    }
    deleteChatMessage(messageId) {
        this.db.prepare(`UPDATE chat_messages SET is_deleted = 1 WHERE id = ?`).run(messageId);
    }
    // --- Privacy & GDPR Data Deletion ---
    deleteUserData(userId) {
        const hostedRooms = this.db.prepare(`SELECT id FROM rooms WHERE host_id = ?`).all(userId);
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
        this.db.prepare(`DELETE FROM partner_connections WHERE user_id = ? OR partner_user_id = ?`).run(userId, userId);
        this.db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    }
    // =====================================================================
    // Permanent Partner Codes & Persistent Connections
    // =====================================================================
    generateUniquePartnerCode(displayName) {
        const rawPrefix = (displayName || 'USER')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 5)
            .toUpperCase();
        const prefix = rawPrefix.length >= 3 ? rawPrefix : 'PLAYER';
        for (let attempt = 0; attempt < 10; attempt++) {
            const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
            const code = `${prefix}${suffix}`;
            const existing = this.db.prepare('SELECT id FROM users WHERE partner_code = ?').get(code);
            if (!existing) {
                return code;
            }
        }
        return `SB${nanoid(6).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
    }
    ensureUserPartnerCode(userId, displayName, avatarUrl, isAnonymous, email) {
        const row = this.db.prepare('SELECT partner_code, display_name FROM users WHERE id = ?').get(userId);
        if (row && row.partner_code) {
            return row.partner_code;
        }
        const name = displayName || (row ? row.display_name : 'Player');
        const newCode = this.generateUniquePartnerCode(name);
        if (!row) {
            this.db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, avatar_url, is_anonymous, partner_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, email || null, null, name, avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`, isAnonymous ? 1 : 0, newCode, new Date().toISOString());
        }
        else {
            this.db.prepare('UPDATE users SET partner_code = ? WHERE id = ?').run(newCode, userId);
        }
        return newCode;
    }
    getUserByPartnerCode(partnerCode) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE partner_code = ? COLLATE NOCASE');
        const row = stmt.get(partnerCode.trim().toUpperCase());
        if (!row)
            return null;
        return {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            isAnonymous: Boolean(row.is_anonymous),
            partnerCode: row.partner_code,
            createdAt: row.created_at
        };
    }
    getPartner(userId) {
        const stmt = this.db.prepare(`
      SELECT pc.*, u.display_name, u.avatar_url, u.partner_code
      FROM partner_connections pc
      JOIN users u ON u.id = pc.partner_user_id
      WHERE pc.user_id = ? AND pc.status = 'ACCEPTED'
      LIMIT 1
    `);
        const row = stmt.get(userId);
        if (!row)
            return null;
        return {
            id: row.id,
            userId: row.user_id,
            partnerUserId: row.partner_user_id,
            status: row.status,
            partnerUser: {
                id: row.partner_user_id,
                displayName: row.display_name,
                avatarUrl: row.avatar_url,
                partnerCode: row.partner_code || ''
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    connectPartner(userId, targetPartnerCode) {
        const targetUser = this.getUserByPartnerCode(targetPartnerCode);
        if (!targetUser) {
            throw new Error('Partner Code not found. Please verify the code and try again.');
        }
        if (targetUser.id === userId) {
            throw new Error('You cannot enter your own Partner Code.');
        }
        const now = new Date().toISOString();
        const connId1 = `pconn_${nanoid(10)}`;
        const connId2 = `pconn_${nanoid(10)}`;
        const insertStmt = this.db.prepare(`
      INSERT INTO partner_connections (id, user_id, partner_user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'ACCEPTED', ?, ?)
      ON CONFLICT(user_id, partner_user_id) DO UPDATE SET
        status = 'ACCEPTED',
        updated_at = excluded.updated_at
    `);
        insertStmt.run(connId1, userId, targetUser.id, now, now);
        insertStmt.run(connId2, targetUser.id, userId, now, now);
        return {
            id: connId1,
            userId,
            partnerUserId: targetUser.id,
            status: 'ACCEPTED',
            partnerUser: {
                id: targetUser.id,
                displayName: targetUser.displayName,
                avatarUrl: targetUser.avatarUrl,
                partnerCode: targetUser.partnerCode || targetPartnerCode.toUpperCase()
            },
            createdAt: now,
            updatedAt: now
        };
    }
    disconnectPartner(userId) {
        const stmt = this.db.prepare(`
      DELETE FROM partner_connections
      WHERE user_id = ? OR partner_user_id = ?
    `);
        stmt.run(userId, userId);
    }
    // =====================================================================
    // Human-Only Game Rooms & Matchmaking Engine
    // =====================================================================
    createGameRoom(room) {
        if (!this.getUserById(room.hostUserId)) {
            this.ensureUserPartnerCode(room.hostUserId, 'Host Player', `https://api.dicebear.com/7.x/bottts/svg?seed=${room.hostUserId}`, true);
        }
        const stmt = this.db.prepare(`
      INSERT INTO game_rooms (
        id, room_code, game_type, host_user_id, max_players, min_players,
        is_private, status, game_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(room.id, room.roomCode, room.gameType, room.hostUserId, room.maxPlayers, room.minPlayers, room.isPrivate ? 1 : 0, room.status, room.gameState ? JSON.stringify(room.gameState) : null, room.createdAt);
        return room;
    }
    getGameRoomByCode(code) {
        const row = this.db.prepare('SELECT * FROM game_rooms WHERE room_code = ? COLLATE NOCASE').get(code.trim().toUpperCase());
        if (!row)
            return null;
        const players = this.getGameRoomPlayers(row.id);
        let gameState = null;
        if (row.game_state) {
            try {
                gameState = JSON.parse(row.game_state);
            }
            catch { }
        }
        return {
            id: row.id,
            roomCode: row.room_code,
            gameType: row.game_type,
            hostUserId: row.host_user_id,
            maxPlayers: row.max_players,
            minPlayers: row.min_players,
            isPrivate: Boolean(row.is_private),
            status: row.status,
            players,
            gameState,
            createdAt: row.created_at,
            startedAt: row.started_at,
            finishedAt: row.finished_at
        };
    }
    getGameRoomById(id) {
        const row = this.db.prepare('SELECT * FROM game_rooms WHERE id = ?').get(id);
        if (!row)
            return null;
        const players = this.getGameRoomPlayers(row.id);
        let gameState = null;
        if (row.game_state) {
            try {
                gameState = JSON.parse(row.game_state);
            }
            catch { }
        }
        return {
            id: row.id,
            roomCode: row.room_code,
            gameType: row.game_type,
            hostUserId: row.host_user_id,
            maxPlayers: row.max_players,
            minPlayers: row.min_players,
            isPrivate: Boolean(row.is_private),
            status: row.status,
            players,
            gameState,
            createdAt: row.created_at,
            startedAt: row.started_at,
            finishedAt: row.finished_at
        };
    }
    findOpenWaitingGameRoom(gameType, maxPlayers, excludeUserId) {
        const rows = this.db.prepare(`
      SELECT * FROM game_rooms
      WHERE game_type = ? AND max_players = ? AND status = 'WAITING' AND is_private = 0
      ORDER BY created_at ASC
    `).all(gameType, maxPlayers);
        for (const row of rows) {
            const players = this.getGameRoomPlayers(row.id);
            if (players.length < row.max_players) {
                if (!excludeUserId || !players.some(p => p.userId === excludeUserId)) {
                    let gameState = null;
                    if (row.game_state) {
                        try {
                            gameState = JSON.parse(row.game_state);
                        }
                        catch { }
                    }
                    return {
                        id: row.id,
                        roomCode: row.room_code,
                        gameType: row.game_type,
                        hostUserId: row.host_user_id,
                        maxPlayers: row.max_players,
                        minPlayers: row.min_players,
                        isPrivate: false,
                        status: row.status,
                        players,
                        gameState,
                        createdAt: row.created_at,
                        startedAt: row.started_at,
                        finishedAt: row.finished_at
                    };
                }
            }
        }
        return null;
    }
    findUserWaitingGameRoom(userId) {
        const row = this.db.prepare(`
      SELECT gr.* FROM game_rooms gr
      JOIN game_room_players grp ON grp.room_id = gr.id
      WHERE grp.user_id = ? AND gr.status = 'WAITING'
      ORDER BY gr.created_at DESC
      LIMIT 1
    `).get(userId);
        if (!row)
            return null;
        return this.getGameRoomById(row.id);
    }
    getGameRoomPlayers(roomId) {
        const rows = this.db.prepare(`
      SELECT * FROM game_room_players
      WHERE room_id = ?
      ORDER BY seat ASC
    `).all(roomId);
        return rows.map(r => ({
            id: r.id,
            roomId: r.room_id,
            userId: r.user_id,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            seat: r.seat,
            color: r.color,
            status: r.status,
            isConnected: Boolean(r.is_connected),
            joinedAt: r.joined_at
        }));
    }
    addPlayerToGameRoom(roomId, user, seat, color) {
        if (!this.getUserById(user.id)) {
            this.ensureUserPartnerCode(user.id, user.displayName || 'Player', user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`, true);
        }
        const id = `gplayer_${nanoid(10)}`;
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO game_room_players (id, room_id, user_id, display_name, avatar_url, seat, color, status, is_connected, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', 1, ?)
      ON CONFLICT(room_id, user_id) DO UPDATE SET
        is_connected = 1,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url
    `);
        stmt.run(id, roomId, user.id, user.displayName, user.avatarUrl || null, seat, color, now);
        return {
            id,
            roomId,
            userId: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            seat,
            color,
            status: 'WAITING',
            isConnected: true,
            joinedAt: now
        };
    }
    removePlayerFromGameRoom(roomId, userId) {
        this.db.prepare('DELETE FROM game_room_players WHERE room_id = ? AND user_id = ?').run(roomId, userId);
    }
    setGamePlayerConnected(roomId, userId, isConnected) {
        this.db.prepare('UPDATE game_room_players SET is_connected = ? WHERE room_id = ? AND user_id = ?')
            .run(isConnected ? 1 : 0, roomId, userId);
    }
    updateGameRoomStatus(roomId, status, startedAt, finishedAt) {
        if (startedAt && finishedAt) {
            this.db.prepare('UPDATE game_rooms SET status = ?, started_at = ?, finished_at = ? WHERE id = ?')
                .run(status, startedAt, finishedAt, roomId);
        }
        else if (startedAt) {
            this.db.prepare('UPDATE game_rooms SET status = ?, started_at = ? WHERE id = ?')
                .run(status, startedAt, roomId);
        }
        else if (finishedAt) {
            this.db.prepare('UPDATE game_rooms SET status = ?, finished_at = ? WHERE id = ?')
                .run(status, finishedAt, roomId);
        }
        else {
            this.db.prepare('UPDATE game_rooms SET status = ? WHERE id = ?').run(status, roomId);
        }
    }
    updateGameRoomState(roomId, gameState, currentTurnSeat, winnerSeat) {
        const json = JSON.stringify(gameState);
        if (winnerSeat !== undefined) {
            this.db.prepare('UPDATE game_rooms SET game_state = ?, current_turn_seat = ?, winner_seat = ? WHERE id = ?')
                .run(json, currentTurnSeat ?? gameState.currentTurnSeat, winnerSeat, roomId);
        }
        else {
            this.db.prepare('UPDATE game_rooms SET game_state = ?, current_turn_seat = ? WHERE id = ?')
                .run(json, currentTurnSeat ?? gameState.currentTurnSeat, roomId);
        }
    }
}
