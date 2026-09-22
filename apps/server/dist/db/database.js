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
        partner_code TEXT,
        date_of_birth TEXT,
        anniversary_date TEXT,
        is_married INTEGER DEFAULT 0,
        relationship_status TEXT,
        gender TEXT,
        pronouns TEXT,
        location TEXT,
        bio TEXT,
        favorite_genres TEXT,
        viewing_vibe TEXT,
        age INTEGER,
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

      CREATE TABLE IF NOT EXISTS friendships (
        id TEXT PRIMARY KEY,
        user_id_1 TEXT NOT NULL,
        user_id_2 TEXT NOT NULL,
        status TEXT DEFAULT 'ACCEPTED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id_1, user_id_2),
        FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON friendships(user_id_1);
      CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user_id_2);

      CREATE TABLE IF NOT EXISTS friend_streaks (
        id TEXT PRIMARY KEY,
        user_id_1 TEXT NOT NULL,
        user_id_2 TEXT NOT NULL,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_watched_date TEXT,
        total_minutes_watched INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id_1, user_id_2),
        FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_friend_streaks_users ON friend_streaks(user_id_1, user_id_2);

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

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        title TEXT NOT NULL,
        emoji TEXT,
        type TEXT,
        date TEXT,
        date_formatted TEXT,
        time TEXT,
        end_time TEXT,
        timezone TEXT,
        description TEXT,
        activities TEXT,
        participants TEXT,
        voting TEXT,
        reminder TEXT,
        recurring TEXT,
        chat_messages TEXT,
        created_at INTEGER,
        is_past INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_plans_host ON plans(host_id);
      CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(date);

      CREATE TABLE IF NOT EXISTS direct_chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        sender_avatar TEXT,
        recipient_id TEXT,
        type TEXT DEFAULT 'text',
        content TEXT NOT NULL,
        media_url TEXT,
        metadata TEXT,
        reply_to TEXT,
        status TEXT DEFAULT 'sent',
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_direct_chat_conv ON direct_chat_messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_direct_chat_recip ON direct_chat_messages(recipient_id, status);
      CREATE INDEX IF NOT EXISTS idx_direct_chat_sender ON direct_chat_messages(sender_id, created_at);
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
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN date_of_birth TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN anniversary_date TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN is_married INTEGER DEFAULT 0");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN age INTEGER");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN relationship_status TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN gender TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN pronouns TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN location TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN bio TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN favorite_genres TEXT");
        }
        catch { }
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN viewing_vibe TEXT");
        }
        catch { }
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS username_change_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          old_code TEXT NOT NULL,
          new_code TEXT NOT NULL,
          changed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_username_history_user ON username_change_history(user_id, changed_at);
      `);
        }
        catch { }
        // Auto-migrate any partner_connections into friendships
        try {
            this.db.exec(`
        INSERT OR IGNORE INTO friendships (id, user_id_1, user_id_2, status, created_at, updated_at)
        SELECT id, user_id, partner_user_id, status, created_at, updated_at
        FROM partner_connections;
      `);
        }
        catch { }
        // On server startup, reset any stale connected status from previous runs
        try {
            this.db.exec("UPDATE room_members SET is_connected = 0 WHERE is_connected = 1");
            this.db.exec("UPDATE game_room_players SET is_connected = 0 WHERE is_connected = 1");
        }
        catch { }
        // Ensure real plan plan-1789841556778 is initialized with real participants
        try {
            const existing = this.getPlanById('plan-1789841556778');
            if (!existing) {
                this.createPlan({
                    id: 'plan-1789841556778',
                    hostId: 'usr_hN35KGS9RX',
                    title: 'Friday Movie & Game Night',
                    emoji: '🍿',
                    type: 'movie',
                    date: '2026-09-27',
                    dateFormatted: 'Sunday, September 27',
                    time: '9:00 PM',
                    endTime: '12:30 AM',
                    timezone: 'IST',
                    description: 'Watching a movie together and then jumping straight into a Ludo showdown!',
                    activities: [
                        {
                            id: 'act-1',
                            type: 'movie',
                            time: '9:00 PM',
                            title: 'Interstellar',
                            subtitle: '2h 49m · Watch Together',
                            actionLabel: 'Enter Cinema',
                            actionUrl: '/dashboard?autojoin=interstellar',
                            movieDetails: {
                                title: 'Interstellar',
                                duration: '2h 49m',
                                provider: 'youtube',
                                posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80'
                            }
                        },
                        {
                            id: 'act-2',
                            type: 'game',
                            time: '11:50 PM',
                            title: 'Ludo Party',
                            subtitle: '2–4 Players · Classic Board Game',
                            actionLabel: 'Play Together',
                            actionUrl: '/games/ludo'
                        },
                        {
                            id: 'act-3',
                            type: 'hangout',
                            time: '12:30 AM',
                            title: 'Late Night Chat',
                            subtitle: 'Open Discussion · Voice / Video',
                            actionLabel: 'Join Chat',
                            actionUrl: '/rooms'
                        }
                    ],
                    participants: [
                        {
                            userId: 'usr_hN35KGS9RX',
                            displayName: 'Mayur Bhargava',
                            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
                            status: 'GOING',
                            isHost: true
                        },
                        {
                            userId: 'usr_-jq7XMcBhu',
                            displayName: 'Mayur. 1',
                            avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
                            status: 'GOING'
                        },
                        {
                            userId: 'usr_rahul',
                            displayName: 'Rahul',
                            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
                            status: 'GOING'
                        },
                        {
                            userId: 'usr_mansi',
                            displayName: 'Mansi',
                            avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
                            status: 'GOING'
                        },
                        {
                            userId: 'usr_dhruv',
                            displayName: 'Dhruv',
                            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
                            status: 'GOING'
                        },
                        {
                            userId: 'usr_kunal',
                            displayName: 'Kunal',
                            avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
                            status: 'CANT_GO'
                        }
                    ],
                    reminder: '30m',
                    recurring: 'none',
                    chatMessages: [
                        {
                            id: 'm1',
                            userId: 'usr_rahul',
                            displayName: 'Rahul',
                            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
                            text: "Can't wait for this! 🚀",
                            createdAt: Date.now() - 120000
                        },
                        {
                            id: 'm2',
                            userId: 'usr_mansi',
                            displayName: 'Mansi',
                            avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
                            text: 'Interstellar is perfect! ✨',
                            createdAt: Date.now() - 300000
                        },
                        {
                            id: 'm3',
                            userId: 'usr_dhruv',
                            displayName: 'Dhruv',
                            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
                            text: 'Ludo after is crazy 😂',
                            createdAt: Date.now() - 480000
                        }
                    ]
                });
            }
        }
        catch (e) {
            console.error('Failed to ensure default plan-1789841556778:', e.message);
        }
    }
    clearAllUsers() {
        try {
            this.db.exec(`
        DELETE FROM reactions;
        DELETE FROM chat_messages;
        DELETE FROM room_members;
        DELETE FROM partner_connections;
        DELETE FROM game_room_players;
        DELETE FROM playback_events;
        DELETE FROM rooms;
        DELETE FROM game_rooms;
        DELETE FROM users;
        VACUUM;
      `);
        }
        catch (e) {
            console.error('Failed to clear users database:', e.message);
        }
    }
    resetAllMembersDisconnected() {
        try {
            this.db.exec("UPDATE room_members SET is_connected = 0 WHERE is_connected = 1");
        }
        catch { }
    }
    // --- Users ---
    createUser(user, passwordHash) {
        const partnerCode = user.partnerCode || this.generateUniquePartnerCode(user.displayName);
        const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, avatar_url, is_anonymous, partner_code, date_of_birth, anniversary_date, is_married, age, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        partner_code = COALESCE(users.partner_code, excluded.partner_code),
        date_of_birth = COALESCE(excluded.date_of_birth, users.date_of_birth),
        anniversary_date = COALESCE(excluded.anniversary_date, users.anniversary_date),
        is_married = COALESCE(excluded.is_married, users.is_married),
        age = COALESCE(excluded.age, users.age)
    `);
        stmt.run(user.id, user.email || null, passwordHash || null, user.displayName, user.avatarUrl || null, user.isAnonymous ? 1 : 0, partnerCode, user.dateOfBirth || null, user.anniversaryDate || null, user.isMarried ? 1 : 0, user.age != null ? user.age : null, user.createdAt);
        const saved = this.getUserById(user.id);
        return saved || {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            isAnonymous: Boolean(user.isAnonymous),
            partnerCode,
            dateOfBirth: user.dateOfBirth,
            anniversaryDate: user.anniversaryDate,
            isMarried: user.isMarried,
            age: user.age,
            createdAt: user.createdAt
        };
    }
    mapUserRow(row) {
        const partnerCode = row.partner_code || this.ensureUserPartnerCode(row.id, row.display_name);
        let favoriteGenres = [];
        if (row.favorite_genres) {
            try {
                favoriteGenres = JSON.parse(row.favorite_genres);
            }
            catch { }
        }
        return {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            isAnonymous: Boolean(row.is_anonymous),
            partnerCode,
            dateOfBirth: row.date_of_birth || null,
            anniversaryDate: row.anniversary_date || null,
            isMarried: row.is_married != null ? Boolean(row.is_married) : null,
            relationshipStatus: row.relationship_status || null,
            gender: row.gender || null,
            pronouns: row.pronouns || null,
            location: row.location || null,
            bio: row.bio || null,
            favoriteGenres,
            viewingVibe: row.viewing_vibe || null,
            age: row.age != null ? Number(row.age) : null,
            createdAt: row.created_at
        };
    }
    getUserById(id) {
        const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return null;
        return this.mapUserRow(row);
    }
    getUserByEmail(email) {
        const stmt = this.db.prepare(`SELECT * FROM users WHERE email = ?`);
        const row = stmt.get(email);
        if (!row)
            return null;
        return {
            user: this.mapUserRow(row),
            passwordHash: row.password_hash
        };
    }
    updateUser(id, updates) {
        const existing = this.getUserById(id);
        if (!existing)
            return null;
        const stmt = this.db.prepare(`
      UPDATE users SET
        display_name = COALESCE(?, display_name),
        avatar_url = COALESCE(?, avatar_url),
        date_of_birth = COALESCE(?, date_of_birth),
        anniversary_date = COALESCE(?, anniversary_date),
        is_married = COALESCE(?, is_married),
        relationship_status = COALESCE(?, relationship_status),
        gender = COALESCE(?, gender),
        pronouns = COALESCE(?, pronouns),
        location = COALESCE(?, location),
        bio = COALESCE(?, bio),
        favorite_genres = COALESCE(?, favorite_genres),
        viewing_vibe = COALESCE(?, viewing_vibe),
        age = COALESCE(?, age)
      WHERE id = ?
    `);
        stmt.run(updates.displayName ?? null, updates.avatarUrl ?? null, updates.dateOfBirth ?? null, updates.anniversaryDate ?? null, updates.isMarried !== undefined ? (updates.isMarried ? 1 : 0) : null, updates.relationshipStatus ?? null, updates.gender ?? null, updates.pronouns ?? null, updates.location ?? null, updates.bio ?? null, updates.favoriteGenres !== undefined ? JSON.stringify(updates.favoriteGenres) : null, updates.viewingVibe ?? null, updates.age ?? null, id);
        return this.getUserById(id);
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
        role = excluded.role,
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
    // --- Watch Direct Chat Engine ---
    saveDirectChatMessage(msg) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO direct_chat_messages (
        id, conversation_id, sender_id, sender_name, sender_avatar, recipient_id,
        type, content, media_url, metadata, reply_to, status, is_deleted, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);
        stmt.run(msg.id, msg.conversationId, msg.senderId, msg.senderName || null, msg.senderAvatar || null, msg.recipientId || null, msg.type || 'text', msg.content, msg.mediaUrl || null, msg.metadata ? JSON.stringify(msg.metadata) : null, msg.replyTo ? JSON.stringify(msg.replyTo) : null, msg.status || 'sent', msg.createdAt || new Date().toISOString());
    }
    getDirectChatMessages(conversationId, currentUserId, limit = 100) {
        let otherId = null;
        if (conversationId.startsWith('conv_')) {
            otherId = conversationId.replace('conv_', '');
        }
        let rows;
        if (currentUserId && otherId && otherId !== currentUserId) {
            rows = this.db.prepare(`
        SELECT * FROM direct_chat_messages
        WHERE is_deleted = 0
          AND (
            conversation_id = ?
            OR conversation_id = ?
            OR (sender_id = ? AND recipient_id = ?)
            OR (sender_id = ? AND recipient_id = ?)
          )
        ORDER BY created_at ASC
        LIMIT ?
      `).all(conversationId, `conv_${currentUserId}`, currentUserId, otherId, otherId, currentUserId, limit);
        }
        else {
            rows = this.db.prepare(`
        SELECT * FROM direct_chat_messages
        WHERE conversation_id = ? AND is_deleted = 0
        ORDER BY created_at ASC
        LIMIT ?
      `).all(conversationId, limit);
        }
        return rows.map((r) => ({
            id: r.id,
            conversationId: r.conversation_id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            senderAvatar: r.sender_avatar,
            recipientId: r.recipient_id,
            type: r.type,
            content: r.content,
            mediaUrl: r.media_url,
            metadata: r.metadata ? (() => { try {
                return JSON.parse(r.metadata);
            }
            catch {
                return undefined;
            } })() : undefined,
            replyTo: r.reply_to ? (() => { try {
                return JSON.parse(r.reply_to);
            }
            catch {
                return undefined;
            } })() : undefined,
            status: r.status,
            createdAt: r.created_at
        }));
    }
    updateDirectChatMessageStatus(messageId, status) {
        this.db.prepare(`UPDATE direct_chat_messages SET status = ? WHERE id = ?`).run(status, messageId);
    }
    markDirectMessagesAsDelivered(recipientId) {
        const messages = this.db.prepare(`
      SELECT id, conversation_id as conversationId, sender_id as senderId
      FROM direct_chat_messages
      WHERE recipient_id = ? AND status = 'sent' AND is_deleted = 0
    `).all(recipientId);
        if (messages.length > 0) {
            this.db.prepare(`
        UPDATE direct_chat_messages
        SET status = 'delivered'
        WHERE recipient_id = ? AND status = 'sent' AND is_deleted = 0
      `).run(recipientId);
        }
        return messages;
    }
    markDirectMessagesAsRead(conversationId, readerUserId) {
        const messages = this.db.prepare(`
      SELECT id, sender_id as senderId
      FROM direct_chat_messages
      WHERE conversation_id = ? AND sender_id != ? AND status != 'read' AND is_deleted = 0
    `).all(conversationId, readerUserId);
        if (messages.length > 0) {
            this.db.prepare(`
        UPDATE direct_chat_messages
        SET status = 'read'
        WHERE conversation_id = ? AND sender_id != ? AND status != 'read' AND is_deleted = 0
      `).run(conversationId, readerUserId);
        }
        return messages;
    }
    markDirectMessageViewOnceOpened(messageId) {
        try {
            const row = this.db.prepare(`
        SELECT conversation_id as conversationId, sender_id as senderId, recipient_id as recipientId, metadata
        FROM direct_chat_messages
        WHERE id = ? AND is_deleted = 0
      `).get(messageId);
            if (!row)
                return null;
            let meta = {};
            if (row.metadata) {
                try {
                    meta = JSON.parse(row.metadata);
                }
                catch {
                    meta = {};
                }
            }
            meta.viewOnceOpened = true;
            meta.viewOnceOpenedAt = new Date().toISOString();
            this.db.prepare(`
        UPDATE direct_chat_messages
        SET metadata = ?
        WHERE id = ?
      `).run(JSON.stringify(meta), messageId);
            return {
                conversationId: row.conversationId,
                senderId: row.senderId,
                recipientId: row.recipientId
            };
        }
        catch {
            return null;
        }
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
    getPartnerCodeStatus(userId) {
        const userRow = this.db.prepare('SELECT partner_code FROM users WHERE id = ?').get(userId);
        const currentCode = userRow?.partner_code || '';
        // Calculate changes in the last 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const rows = this.db.prepare(`
      SELECT changed_at
      FROM username_change_history
      WHERE user_id = ? AND changed_at >= ?
      ORDER BY changed_at ASC
    `).all(userId, ninetyDaysAgo);
        const changesUsed = rows.length;
        const maxChanges = 3;
        const changesRemaining = Math.max(0, maxChanges - changesUsed);
        const canChange = changesUsed < maxChanges;
        let nextAvailableAt = null;
        if (changesUsed >= maxChanges && rows.length > 0) {
            const oldestChangeTime = new Date(rows[0].changed_at).getTime();
            const unlockTime = oldestChangeTime + 90 * 24 * 60 * 60 * 1000;
            nextAvailableAt = new Date(unlockTime).toISOString();
        }
        return {
            currentCode,
            changesUsed,
            changesRemaining,
            maxChanges,
            periodDays: 90,
            canChange,
            nextAvailableAt
        };
    }
    changePartnerCode(userId, requestedCode) {
        const cleanCode = requestedCode.trim().toUpperCase();
        // 1. Validation (alphanumeric, underscores, hyphens; 3-16 chars)
        if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 16) {
            return { success: false, error: 'Username must be between 3 and 16 characters.' };
        }
        if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
            return { success: false, error: 'Username can only contain letters, numbers, hyphens and underscores.' };
        }
        // 2. Check current status and rate limit (3 changes in 90 days)
        const status = this.getPartnerCodeStatus(userId);
        if (status.currentCode && status.currentCode.toUpperCase() === cleanCode) {
            return { success: false, error: 'New username must be different from your current username.' };
        }
        if (!status.canChange) {
            const nextDate = status.nextAvailableAt
                ? new Date(status.nextAvailableAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })
                : 'in 90 days';
            return {
                success: false,
                error: `You have reached the maximum limit of 3 changes in 90 days. You can change it again on ${nextDate}.`
            };
        }
        // 3. Check uniqueness across all users (case-insensitive)
        const existing = this.db.prepare('SELECT id FROM users WHERE partner_code = ? COLLATE NOCASE AND id != ?').get(cleanCode, userId);
        if (existing) {
            return { success: false, error: 'This username / partner code is already taken. Please choose another.' };
        }
        // 4. Update user's partner code
        this.db.prepare('UPDATE users SET partner_code = ? WHERE id = ?').run(cleanCode, userId);
        // 5. Insert into change history
        this.db.prepare(`
      INSERT INTO username_change_history (id, user_id, old_code, new_code, changed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(nanoid(), userId, status.currentCode || '', cleanCode, new Date().toISOString());
        const updatedStatus = this.getPartnerCodeStatus(userId);
        return {
            success: true,
            partnerCode: cleanCode,
            changesRemaining: updatedStatus.changesRemaining,
            changesUsed: updatedStatus.changesUsed
        };
    }
    getPartner(userId) {
        const stmt = this.db.prepare(`
      SELECT pc.*, u.display_name, u.avatar_url, u.partner_code
      FROM partner_connections pc
      JOIN users u ON u.id = pc.partner_user_id
      WHERE pc.user_id = ? AND pc.status = 'ACCEPTED'
      ORDER BY pc.updated_at DESC
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
    // Friends & Snapchat-Style Friend-to-Friend Streaks Engine
    // =====================================================================
    getCanonicalUserPair(userIdA, userIdB) {
        return [userIdA, userIdB].sort();
    }
    getYesterdayStr(dateStr) {
        const d = new Date(dateStr + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
    }
    sendFriendRequest(userId, targetFriendCode) {
        const targetUser = this.getUserByPartnerCode(targetFriendCode);
        if (!targetUser) {
            throw new Error('Friend Code not found. Please verify the code.');
        }
        if (targetUser.id === userId) {
            throw new Error('You cannot add yourself as a friend.');
        }
        // Check if already friends
        const existingAccepted = this.db.prepare(`
      SELECT * FROM friendships
      WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'ACCEPTED'
    `).get(userId, targetUser.id);
        if (existingAccepted) {
            throw new Error(`You are already friends with ${targetUser.displayName}.`);
        }
        // Check if targetUser already sent userId a pending request -> auto accept
        const incomingPending = this.db.prepare(`
      SELECT * FROM friendships
      WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'PENDING'
    `).get(targetUser.id, userId);
        if (incomingPending) {
            const friend = this.acceptFriendRequest(userId, targetUser.id);
            return {
                status: 'ACCEPTED',
                friend,
                message: `You and ${targetUser.displayName} are now friends! 🔥`
            };
        }
        // Check if user already sent a pending request
        const existingOutgoing = this.db.prepare(`
      SELECT * FROM friendships
      WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'PENDING'
    `).get(userId, targetUser.id);
        if (existingOutgoing) {
            return {
                status: 'PENDING',
                message: `Friend request to ${targetUser.displayName} is already pending.`
            };
        }
        const now = new Date().toISOString();
        const friendshipId = `fr_${nanoid(10)}`;
        const stmt = this.db.prepare(`
      INSERT INTO friendships (id, user_id_1, user_id_2, status, created_at, updated_at)
      VALUES (?, ?, ?, 'PENDING', ?, ?)
      ON CONFLICT(user_id_1, user_id_2) DO UPDATE SET
        status = 'PENDING',
        updated_at = excluded.updated_at
    `);
        stmt.run(friendshipId, userId, targetUser.id, now, now);
        return {
            status: 'PENDING',
            message: `Friend request sent to ${targetUser.displayName}!`
        };
    }
    acceptFriendRequest(userId, senderUserId) {
        const senderUser = this.getUserById(senderUserId);
        if (!senderUser) {
            throw new Error('User not found.');
        }
        const now = new Date().toISOString();
        const [u1, u2] = this.getCanonicalUserPair(userId, senderUserId);
        const friendshipId1 = `fr_${nanoid(10)}`;
        const friendshipId2 = `fr_${nanoid(10)}`;
        // Set reciprocal friendships to ACCEPTED
        const stmt = this.db.prepare(`
      INSERT INTO friendships (id, user_id_1, user_id_2, status, created_at, updated_at)
      VALUES (?, ?, ?, 'ACCEPTED', ?, ?)
      ON CONFLICT(user_id_1, user_id_2) DO UPDATE SET
        status = 'ACCEPTED',
        updated_at = excluded.updated_at
    `);
        stmt.run(friendshipId1, userId, senderUserId, now, now);
        stmt.run(friendshipId2, senderUserId, userId, now, now);
        // Ensure streak record exists
        const streakStmt = this.db.prepare(`
      INSERT OR IGNORE INTO friend_streaks (id, user_id_1, user_id_2, current_streak, longest_streak, last_watched_date, total_minutes_watched, created_at, updated_at)
      VALUES (?, ?, ?, 0, 0, NULL, 0, ?, ?)
    `);
        streakStmt.run(`stk_${nanoid(10)}`, u1, u2, now, now);
        // Also connect as partner if user has no active partner
        if (!this.getPartner(userId) && senderUser.partnerCode) {
            try {
                this.connectPartner(userId, senderUser.partnerCode);
            }
            catch { }
        }
        const todayStr = now.split('T')[0];
        const yesterdayStr = this.getYesterdayStr(todayStr);
        const streakRow = this.db.prepare(`
      SELECT * FROM friend_streaks WHERE user_id_1 = ? AND user_id_2 = ?
    `).get(u1, u2);
        const currentStreak = streakRow?.current_streak || 0;
        const lastDate = streakRow?.last_watched_date || null;
        const completedToday = lastDate === todayStr;
        const atRisk = !completedToday && lastDate === yesterdayStr && currentStreak > 0;
        return {
            friendshipId: friendshipId1,
            friendUser: {
                id: senderUser.id,
                displayName: senderUser.displayName,
                avatarUrl: senderUser.avatarUrl,
                partnerCode: senderUser.partnerCode || '',
                isOnline: false
            },
            streak: {
                currentStreak,
                longestStreak: streakRow?.longest_streak || 0,
                lastWatchedDate: lastDate,
                completedToday,
                atRisk,
                totalMinutesWatched: streakRow?.total_minutes_watched || 0
            },
            createdAt: now
        };
    }
    declineFriendRequest(userId, senderUserId) {
        const stmt = this.db.prepare(`
      DELETE FROM friendships
      WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'PENDING'
    `);
        stmt.run(senderUserId, userId);
    }
    cancelFriendRequest(userId, targetUserId) {
        const stmt = this.db.prepare(`
      DELETE FROM friendships
      WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'PENDING'
    `);
        stmt.run(userId, targetUserId);
    }
    getFriendRequests(userId) {
        const incomingRows = this.db.prepare(`
      SELECT f.id as request_id, f.created_at,
             u.id as user_id, u.display_name, u.avatar_url, u.partner_code
      FROM friendships f
      JOIN users u ON u.id = f.user_id_1
      WHERE f.user_id_2 = ? AND f.status = 'PENDING'
      ORDER BY f.created_at DESC
    `).all(userId);
        const outgoingRows = this.db.prepare(`
      SELECT f.id as request_id, f.created_at,
             u.id as user_id, u.display_name, u.avatar_url, u.partner_code
      FROM friendships f
      JOIN users u ON u.id = f.user_id_2
      WHERE f.user_id_1 = ? AND f.status = 'PENDING'
      ORDER BY f.created_at DESC
    `).all(userId);
        return {
            incoming: incomingRows.map(r => ({
                requestId: r.request_id,
                user: {
                    id: r.user_id,
                    displayName: r.display_name,
                    avatarUrl: r.avatar_url,
                    partnerCode: r.partner_code || ''
                },
                createdAt: r.created_at
            })),
            outgoing: outgoingRows.map(r => ({
                requestId: r.request_id,
                user: {
                    id: r.user_id,
                    displayName: r.display_name,
                    avatarUrl: r.avatar_url,
                    partnerCode: r.partner_code || ''
                },
                createdAt: r.created_at
            }))
        };
    }
    addFriend(userId, targetFriendCode) {
        const res = this.sendFriendRequest(userId, targetFriendCode);
        if (res.friend) {
            return res.friend;
        }
        // If pending, construct return
        const targetUser = this.getUserByPartnerCode(targetFriendCode);
        return {
            friendshipId: `pending_${nanoid(8)}`,
            friendUser: {
                id: targetUser.id,
                displayName: targetUser.displayName,
                avatarUrl: targetUser.avatarUrl,
                partnerCode: targetUser.partnerCode || targetFriendCode.toUpperCase(),
                isOnline: false
            },
            streak: {
                currentStreak: 0,
                longestStreak: 0,
                lastWatchedDate: null,
                completedToday: false,
                atRisk: false,
                totalMinutesWatched: 0
            },
            createdAt: new Date().toISOString()
        };
    }
    removeFriend(userId, friendUserId) {
        const stmt = this.db.prepare(`
      DELETE FROM friendships
      WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)
    `);
        stmt.run(userId, friendUserId, friendUserId, userId);
    }
    getDiscoverableUsers(currentUserId, search) {
        let query = `
      SELECT u.id, u.display_name, u.avatar_url, u.partner_code,
             (SELECT status FROM friendships WHERE user_id_1 = ? AND user_id_2 = u.id) as outgoing_status,
             (SELECT status FROM friendships WHERE user_id_1 = u.id AND user_id_2 = ?) as incoming_status
      FROM users u
      WHERE u.id != ?
        AND u.id NOT IN (
          SELECT user_id_2 FROM friendships WHERE user_id_1 = ? AND status = 'ACCEPTED'
        )
    `;
        const params = [currentUserId, currentUserId, currentUserId, currentUserId];
        if (search && search.trim()) {
            query += ` AND (u.display_name LIKE ? OR u.partner_code LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term);
        }
        query += ` ORDER BY u.created_at DESC LIMIT 60`;
        const rows = this.db.prepare(query).all(...params);
        return rows.map((row) => {
            let requestStatus = 'NONE';
            if (row.outgoing_status === 'PENDING') {
                requestStatus = 'SENT';
            }
            else if (row.incoming_status === 'PENDING') {
                requestStatus = 'RECEIVED';
            }
            let code = row.partner_code;
            if (!code) {
                code = this.ensureUserPartnerCode(row.id, row.display_name, row.avatar_url);
            }
            return {
                id: row.id,
                displayName: row.display_name,
                avatarUrl: row.avatar_url,
                partnerCode: code,
                requestStatus
            };
        });
    }
    getFriendsWithStreaks(userId, isOnlineCheck) {
        const stmt = this.db.prepare(`
      SELECT f.id as friendship_id, f.created_at as friendship_created_at,
             u.id as friend_id, u.display_name, u.avatar_url, u.partner_code
      FROM friendships f
      JOIN users u ON u.id = f.user_id_2
      WHERE f.user_id_1 = ? AND f.status = 'ACCEPTED'
      ORDER BY f.created_at DESC
    `);
        const rows = stmt.all(userId);
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = this.getYesterdayStr(todayStr);
        return rows.map((row) => {
            const [u1, u2] = this.getCanonicalUserPair(userId, row.friend_id);
            const streakRow = this.db.prepare(`
        SELECT * FROM friend_streaks WHERE user_id_1 = ? AND user_id_2 = ?
      `).get(u1, u2);
            const currentStreak = streakRow?.current_streak || 0;
            const lastDate = streakRow?.last_watched_date || null;
            const completedToday = lastDate === todayStr;
            const atRisk = !completedToday && lastDate === yesterdayStr && currentStreak > 0;
            return {
                friendshipId: row.friendship_id,
                friendUser: {
                    id: row.friend_id,
                    displayName: row.display_name,
                    avatarUrl: row.avatar_url,
                    partnerCode: row.partner_code || '',
                    isOnline: isOnlineCheck ? isOnlineCheck(row.friend_id) : false
                },
                streak: {
                    currentStreak,
                    longestStreak: streakRow?.longest_streak || 0,
                    lastWatchedDate: lastDate,
                    completedToday,
                    atRisk,
                    totalMinutesWatched: streakRow?.total_minutes_watched || 0
                },
                createdAt: row.friendship_created_at
            };
        });
    }
    recordSessionBetweenUsers(userIdA, userIdB, minutes = 1) {
        const [u1, u2] = this.getCanonicalUserPair(userIdA, userIdB);
        const now = new Date().toISOString();
        const todayStr = now.split('T')[0];
        const yesterdayStr = this.getYesterdayStr(todayStr);
        const existing = this.db.prepare(`
      SELECT * FROM friend_streaks WHERE user_id_1 = ? AND user_id_2 = ?
    `).get(u1, u2);
        if (!existing) {
            // First session ever between this pair! Starts Day 1 streak
            const id = `stk_${nanoid(10)}`;
            this.db.prepare(`
        INSERT INTO friend_streaks (id, user_id_1, user_id_2, current_streak, longest_streak, last_watched_date, total_minutes_watched, created_at, updated_at)
        VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?)
      `).run(id, u1, u2, todayStr, minutes, now, now);
            return {
                status: 'RESET_STARTED',
                streak: {
                    currentStreak: 1,
                    longestStreak: 1,
                    lastWatchedDate: todayStr,
                    completedToday: true,
                    totalMinutesWatched: minutes
                }
            };
        }
        const lastDate = existing.last_watched_date;
        const totalMinutes = (existing.total_minutes_watched || 0) + minutes;
        if (lastDate === todayStr) {
            // Already completed today!
            this.db.prepare(`
        UPDATE friend_streaks
        SET total_minutes_watched = ?, updated_at = ?
        WHERE user_id_1 = ? AND user_id_2 = ?
      `).run(totalMinutes, now, u1, u2);
            return {
                status: 'ALREADY_COMPLETED',
                streak: {
                    currentStreak: existing.current_streak,
                    longestStreak: existing.longest_streak,
                    lastWatchedDate: todayStr,
                    completedToday: true,
                    totalMinutesWatched: totalMinutes
                }
            };
        }
        if (lastDate === yesterdayStr) {
            // Watched yesterday -> consecutive day! Streak incremented
            const newStreak = existing.current_streak + 1;
            const longest = Math.max(existing.longest_streak, newStreak);
            this.db.prepare(`
        UPDATE friend_streaks
        SET current_streak = ?, longest_streak = ?, last_watched_date = ?, total_minutes_watched = ?, updated_at = ?
        WHERE user_id_1 = ? AND user_id_2 = ?
      `).run(newStreak, longest, todayStr, totalMinutes, now, u1, u2);
            return {
                status: 'EXTENDED',
                streak: {
                    currentStreak: newStreak,
                    longestStreak: longest,
                    lastWatchedDate: todayStr,
                    completedToday: true,
                    totalMinutesWatched: totalMinutes
                }
            };
        }
        // Missed a day -> Resets to Day 1
        const newStreak = 1;
        const longest = Math.max(existing.longest_streak, 1);
        this.db.prepare(`
      UPDATE friend_streaks
      SET current_streak = ?, longest_streak = ?, last_watched_date = ?, total_minutes_watched = ?, updated_at = ?
      WHERE user_id_1 = ? AND user_id_2 = ?
    `).run(newStreak, longest, todayStr, totalMinutes, now, u1, u2);
        return {
            status: 'RESET_STARTED',
            streak: {
                currentStreak: newStreak,
                longestStreak: longest,
                lastWatchedDate: todayStr,
                completedToday: true,
                totalMinutesWatched: totalMinutes
            }
        };
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
        const turnSeat = currentTurnSeat ?? gameState?.currentTurnSeat ?? null;
        if (winnerSeat !== undefined) {
            this.db.prepare('UPDATE game_rooms SET game_state = ?, current_turn_seat = ?, winner_seat = ? WHERE id = ?')
                .run(json, turnSeat, winnerSeat, roomId);
        }
        else {
            this.db.prepare('UPDATE game_rooms SET game_state = ?, current_turn_seat = ? WHERE id = ?')
                .run(json, turnSeat, roomId);
        }
    }
    // --- Plans Methods ---
    createPlan(plan) {
        const stmt = this.db.prepare(`
      INSERT INTO plans (
        id, host_id, title, emoji, type, date, date_formatted, time, end_time,
        timezone, description, activities, participants, voting, reminder, recurring, chat_messages, created_at, is_past
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(plan.id, plan.hostId || (plan.participants && plan.participants[0]?.userId) || 'u1', plan.title, plan.emoji || '✨', plan.type || 'custom', plan.date, plan.dateFormatted || plan.date, plan.time, plan.endTime || '', plan.timezone || 'IST', plan.description || '', JSON.stringify(plan.activities || []), JSON.stringify(plan.participants || []), plan.voting ? JSON.stringify(plan.voting) : null, plan.reminder || '30m', plan.recurring || 'none', JSON.stringify(plan.chatMessages || []), plan.createdAt || Date.now(), plan.isPast ? 1 : 0);
        return this.getPlanById(plan.id);
    }
    getPlans() {
        const rows = this.db.prepare('SELECT * FROM plans ORDER BY created_at DESC').all();
        return rows.map((r) => this.deserializePlan(r));
    }
    getPlanById(id) {
        const row = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
        if (!row)
            return null;
        return this.deserializePlan(row);
    }
    updatePlan(id, updates) {
        const plan = this.getPlanById(id);
        if (!plan)
            return null;
        const merged = { ...plan, ...updates };
        const stmt = this.db.prepare(`
      UPDATE plans SET
        title = ?,
        emoji = ?,
        type = ?,
        date = ?,
        date_formatted = ?,
        time = ?,
        end_time = ?,
        timezone = ?,
        description = ?,
        activities = ?,
        participants = ?,
        voting = ?,
        reminder = ?,
        recurring = ?,
        chat_messages = ?,
        is_past = ?
      WHERE id = ?
    `);
        stmt.run(merged.title, merged.emoji, merged.type, merged.date, merged.dateFormatted, merged.time, merged.endTime || '', merged.timezone, merged.description || '', JSON.stringify(merged.activities || []), JSON.stringify(merged.participants || []), merged.voting ? JSON.stringify(merged.voting) : null, merged.reminder || '30m', merged.recurring || 'none', JSON.stringify(merged.chatMessages || []), merged.isPast ? 1 : 0, id);
        return this.getPlanById(id);
    }
    deletePlan(id) {
        const res = this.db.prepare('DELETE FROM plans WHERE id = ?').run(id);
        return Boolean(res.changes && res.changes > 0);
    }
    deserializePlan(row) {
        return {
            id: row.id,
            hostId: row.host_id,
            title: row.title,
            emoji: row.emoji,
            type: row.type,
            date: row.date,
            dateFormatted: row.date_formatted,
            time: row.time,
            endTime: row.end_time,
            timezone: row.timezone,
            description: row.description,
            activities: row.activities ? JSON.parse(row.activities) : [],
            participants: row.participants ? JSON.parse(row.participants) : [],
            voting: row.voting ? JSON.parse(row.voting) : undefined,
            reminder: row.reminder,
            recurring: row.recurring,
            chatMessages: row.chat_messages ? JSON.parse(row.chat_messages) : [],
            createdAt: row.created_at,
            isPast: Boolean(row.is_past)
        };
    }
}
