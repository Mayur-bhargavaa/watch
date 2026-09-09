import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { DatabaseService } from './db/database.js';
import { RoomSyncManager } from './sync/RoomSyncManager.js';
import { GameRoomManager } from './games/GameRoomManager.js';
import { PresenceManager } from './services/PresenceManager.js';
import { detectProviderFromUrl } from '@synccinema/common';
import { mongoLogger } from './services/mongoLogger.js';
const JWT_SECRET = process.env.JWT_SECRET || 'synccinema-development-super-secret-key-32chars!';
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
export async function createServer(dbPath = './synccinema.db') {
    const app = fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info'
        }
    });
    const db = new DatabaseService(dbPath);
    const syncManager = new RoomSyncManager(db);
    const gameRoomManager = new GameRoomManager(db);
    const presenceManager = new PresenceManager();
    await app.register(cors, {
        origin: true,
        credentials: true
    });
    await app.register(fastifyJwt, {
        secret: JWT_SECRET
    });
    await app.register(fastifyWebsocket, {
        options: { maxPayload: 1048576 } // 1MB
    });
    // --- Health Check ---
    app.get('/api/health', async () => {
        return {
            status: 'ok',
            service: 'synccinema-server',
            timestamp: Date.now()
        };
    });
    // --- Auth Routes ---
    app.post('/api/auth/guest', async (request, reply) => {
        const body = (request.body || {});
        const guestId = `guest_${nanoid(8)}`;
        const displayName = body.displayName?.trim() || `MovieFan_${nanoid(4)}`;
        const user = db.createUser({
            id: guestId,
            displayName,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
            isAnonymous: true,
            createdAt: new Date().toISOString()
        });
        const token = app.jwt.sign({
            id: user.id,
            displayName: user.displayName,
            isAnonymous: true
        });
        await mongoLogger.logAuthLogin(user.id, 'guest@stitchbyte.local', user.displayName);
        return { token, user };
    });
    app.post('/api/auth/login', async (request, reply) => {
        const body = (request.body || {});
        if (!body.email) {
            return reply.code(400).send({ error: 'Email is required' });
        }
        const existing = db.getUserByEmail(body.email);
        let user;
        if (!existing) {
            // Auto-register user on initial sign-in if not yet created
            const userId = `usr_${nanoid(10)}`;
            const displayName = body.displayName?.trim() || body.email.split('@')[0] || `User_${nanoid(4)}`;
            user = db.createUser({
                id: userId,
                email: body.email,
                displayName,
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                isAnonymous: false,
                createdAt: new Date().toISOString()
            }, body.password);
            await mongoLogger.logAuthRegister(user.id, user.email || '', user.displayName);
        }
        else {
            user = existing.user;
        }
        const token = app.jwt.sign({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            isAnonymous: false
        });
        await mongoLogger.logAuthLogin(user.id, user.email || '', user.displayName);
        return { token, user };
    });
    app.post('/api/auth/register', async (request, reply) => {
        const body = request.body;
        if (!body.email || !body.displayName) {
            return reply.code(400).send({ error: 'Email and display name required' });
        }
        const existing = db.getUserByEmail(body.email);
        if (existing) {
            return reply.code(409).send({ error: 'Email already registered' });
        }
        const userId = `usr_${nanoid(10)}`;
        const user = db.createUser({
            id: userId,
            email: body.email,
            displayName: body.displayName,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
            isAnonymous: false,
            createdAt: new Date().toISOString()
        }, body.password // in production, hash with argon2/bcrypt
        );
        const token = app.jwt.sign({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            isAnonymous: false
        });
        await mongoLogger.logAuthRegister(user.id, user.email || '', user.displayName);
        return { token, user };
    });
    app.get('/api/auth/me', async (request, reply) => {
        try {
            const payload = (await request.jwtVerify());
            const user = db.getUserById(payload.id);
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            return { user };
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    app.get('/api/user/rooms', async (request, reply) => {
        try {
            const payload = (await request.jwtVerify());
            const rooms = db.getRoomsByHost(payload.id);
            return { rooms };
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    // --- Room Routes ---
    app.post('/api/rooms', async (request, reply) => {
        let user;
        try {
            user = await request.jwtVerify();
        }
        catch {
            return reply.code(401).send({ error: 'Authentication required. Please sign in to create a room.' });
        }
        const body = (request.body || {});
        const roomId = `room_${nanoid(12)}`;
        const customCode = (body.roomCode || body.slug)?.trim().toLowerCase();
        const slug = customCode ? customCode.replace(/[^a-z0-9_-]/g, '') : nanoid(8).toLowerCase();
        const sourceUrl = body.sourceUrl?.trim() || '';
        const detected = sourceUrl ? detectProviderFromUrl(sourceUrl) : null;
        const media = (sourceUrl && detected) ? db.createOrGetMedia({
            id: `med_${nanoid(10)}`,
            provider: detected.provider,
            providerMediaId: detected.providerMediaId,
            sourceUrl,
            title: body.mediaTitle || 'Watch Party Presentation',
            durationSeconds: 0
        }) : null;
        const initialPlaybackState = {
            roomId,
            state: 'PAUSED',
            position: 0,
            serverTimestamp: Date.now(),
            playbackRate: 1.0,
            version: 1,
            updatedBy: user.id
        };
        const room = {
            id: roomId,
            slug,
            title: body.title || (body.activityMode === 'GAMING' ? 'Party Game Lounge' : 'Movie Night'),
            hostId: user.id,
            privacy: body.privacy || 'INVITE_ONLY',
            isLocked: false,
            currentMedia: media,
            playbackState: initialPlaybackState,
            activityMode: body.activityMode || 'CINEMA',
            createdAt: new Date().toISOString()
        };
        db.createRoom(room);
        syncManager.registerRoom(room);
        await mongoLogger.logRoomCreated(room.id, room.slug, user.id, room.title, room.activityMode);
        return {
            room,
            inviteUrl: `/room/${slug}`
        };
    });
    app.get('/api/rooms/:slug', async (request, reply) => {
        const { slug } = request.params;
        const room = syncManager.getRoom(slug);
        if (!room) {
            return reply.code(404).send({ error: 'Room not found or has ended' });
        }
        const members = db.getRoomMembers(room.id);
        const activeCount = syncManager.getConnectedClientsCount(room.id);
        return {
            room,
            members,
            maxCapacity: 6,
            activeCount,
            isFull: activeCount >= 6
        };
    });
    // --- Post-Watch Recap & Reaction Heatmaps ---
    app.get('/api/rooms/:slug/recap', async (request, reply) => {
        const { slug } = request.params;
        const room = syncManager.getRoom(slug);
        if (!room) {
            return reply.code(404).send({ error: 'Room not found' });
        }
        const heatmap = db.getReactionHeatmap(room.id, 15);
        const recentChat = db.getRecentChatMessages(room.id, 100);
        const members = db.getRoomMembers(room.id);
        return {
            room,
            heatmap,
            members,
            topMoments: heatmap.sort((a, b) => b.count - a.count).slice(0, 5),
            chatHighlights: recentChat.filter(c => c.mediaTimestamp !== null).slice(0, 10)
        };
    });
    // --- GDPR / Privacy Deletion ---
    app.delete('/api/privacy/data', async (request, reply) => {
        const user = await request.jwtVerify();
        db.deleteUserData(user.id);
        return { success: true, message: 'All personal viewing and chat records permanently erased' };
    });
    // --- Helper to extract or provision User from request ---
    async function getRequestUser(request) {
        try {
            const decoded = await request.jwtVerify();
            let user = db.getUserById(decoded.id);
            if (user) {
                if (!user.partnerCode) {
                    user.partnerCode = db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email);
                }
                return user;
            }
            const partnerCode = db.ensureUserPartnerCode(decoded.id, decoded.displayName, decoded.avatarUrl, decoded.isAnonymous, decoded.email);
            user = db.getUserById(decoded.id);
            if (user)
                return user;
            return {
                id: decoded.id,
                displayName: decoded.displayName || 'Player',
                avatarUrl: decoded.avatarUrl,
                isAnonymous: Boolean(decoded.isAnonymous),
                partnerCode,
                createdAt: new Date().toISOString()
            };
        }
        catch {
            const body = (request.body || {});
            const query = (request.query || {});
            const userId = body.userId || query.userId || `guest_${nanoid(8)}`;
            const displayName = body.displayName || query.displayName || 'Player';
            let user = db.getUserById(userId);
            if (!user) {
                user = db.createUser({
                    id: userId,
                    displayName,
                    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
                    isAnonymous: true,
                    createdAt: new Date().toISOString()
                });
            }
            return user;
        }
    }
    // =====================================================================
    // User Profile & Permanent Partner Code Endpoints
    // =====================================================================
    const isUserOnline = (userId) => {
        return (presenceManager.isUserOnline(userId) ||
            gameRoomManager.isUserOnline(userId) ||
            syncManager.isUserOnline(userId).online);
    };
    app.get('/api/user/me', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const partner = db.getPartner(user.id);
        const partnerOnline = partner ? isUserOnline(partner.partnerUserId) : false;
        return {
            user: {
                ...user,
                partnerCode: user.partnerCode || db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email)
            },
            partner: partner ? {
                id: partner.partnerUser?.id || partner.partnerUserId,
                displayName: partner.partnerUser?.displayName || 'Partner',
                partnerCode: partner.partnerUser?.partnerCode || '',
                avatarUrl: partner.partnerUser?.avatarUrl || null,
                online: partnerOnline,
                connectionId: partner.id
            } : null
        };
    });
    app.post('/api/user/heartbeat', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const partner = db.getPartner(user.id);
        const partnerOnline = partner ? isUserOnline(partner.partnerUserId) : false;
        return {
            status: 'ok',
            isOnline: true,
            myPartnerCode: user.partnerCode,
            partner: partner ? {
                id: partner.partnerUser?.id || partner.partnerUserId,
                displayName: partner.partnerUser?.displayName || 'Partner',
                partnerCode: partner.partnerUser?.partnerCode || '',
                avatarUrl: partner.partnerUser?.avatarUrl || null,
                online: partnerOnline,
                connectionId: partner.id
            } : null
        };
    });
    app.get('/api/user/partner', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const partner = db.getPartner(user.id);
        if (!partner) {
            return { partner: null };
        }
        const isOnline = isUserOnline(partner.partnerUserId);
        return {
            partner: {
                id: partner.partnerUser?.id || partner.partnerUserId,
                displayName: partner.partnerUser?.displayName || 'Partner',
                partnerCode: partner.partnerUser?.partnerCode || '',
                avatarUrl: partner.partnerUser?.avatarUrl || null,
                online: isOnline,
                connectionId: partner.id
            }
        };
    });
    app.post('/api/user/partner/connect', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.partnerCode) {
            return reply.code(400).send({ error: 'Partner Code is required' });
        }
        try {
            const partner = db.connectPartner(user.id, body.partnerCode);
            const isOnline = isUserOnline(partner.partnerUserId);
            return {
                success: true,
                partner: {
                    id: partner.partnerUser?.id || partner.partnerUserId,
                    displayName: partner.partnerUser?.displayName || 'Partner',
                    partnerCode: partner.partnerUser?.partnerCode || '',
                    avatarUrl: partner.partnerUser?.avatarUrl || null,
                    online: isOnline,
                    connectionId: partner.id
                }
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to connect partner' });
        }
    });
    app.delete('/api/user/partner', async (request, reply) => {
        const user = await getRequestUser(request);
        db.disconnectPartner(user.id);
        return { success: true, message: 'Partner disconnected' };
    });
    // =====================================================================
    // Human-Only Game Rooms & Matchmaking Endpoints
    // =====================================================================
    // Play with Partner (Deterministic Smart Pairing)
    app.post('/api/games/partner/play', async (request, reply) => {
        const user = await getRequestUser(request);
        const body = (request.body || {});
        const rawGameType = body.gameType || 'ludo';
        const gameType = rawGameType === 'four-in-a-row' || rawGameType === 'connect4' ? 'four-in-a-row' : 'ludo';
        const partner = db.getPartner(user.id);
        if (!partner) {
            return reply.code(400).send({ error: 'No partner connected. Please connect a partner first.' });
        }
        const gameBasePath = gameType === 'four-in-a-row' ? '/games/four-in-a-row' : '/games/ludo';
        // 1. Check if partner is ALREADY waiting in an open game room
        const partnerWaitingRoom = db.findUserWaitingGameRoom(partner.partnerUserId);
        if (partnerWaitingRoom &&
            partnerWaitingRoom.gameType === gameType &&
            partnerWaitingRoom.status === 'WAITING' &&
            partnerWaitingRoom.players.length < partnerWaitingRoom.maxPlayers) {
            const joined = gameRoomManager.joinRoom(partnerWaitingRoom.roomCode, user);
            return {
                success: true,
                room: joined,
                joinedPartnerRoom: true,
                inviteUrl: `${gameBasePath}?room=${joined.roomCode}`
            };
        }
        // 2. Check if current user ALREADY has an open waiting game room
        const myWaitingRoom = db.findUserWaitingGameRoom(user.id);
        if (myWaitingRoom && myWaitingRoom.gameType === gameType && myWaitingRoom.status === 'WAITING') {
            const invitePayload = {
                id: `ginvite_${nanoid(8)}`,
                fromUserId: user.id,
                fromDisplayName: user.displayName,
                fromPartnerCode: user.partnerCode,
                roomCode: myWaitingRoom.roomCode,
                gameType: myWaitingRoom.gameType,
                timestamp: Date.now()
            };
            presenceManager.sendToUser(partner.partnerUserId, {
                type: 'partner:game_invite',
                payload: invitePayload
            });
            return {
                success: true,
                room: myWaitingRoom,
                joinedPartnerRoom: false,
                inviteUrl: `${gameBasePath}?room=${myWaitingRoom.roomCode}`
            };
        }
        // 3. Otherwise, create a dedicated 2-player game room for the partners
        const created = gameRoomManager.createGameRoom({
            hostUser: user,
            gameType,
            maxPlayers: 2,
            isPrivate: true
        });
        const invitePayload = {
            id: `ginvite_${nanoid(8)}`,
            fromUserId: user.id,
            fromDisplayName: user.displayName,
            fromPartnerCode: user.partnerCode,
            roomCode: created.roomCode,
            gameType,
            timestamp: Date.now()
        };
        presenceManager.sendToUser(partner.partnerUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        return {
            success: true,
            room: created,
            joinedPartnerRoom: false,
            inviteUrl: `${gameBasePath}?room=${created.roomCode}`
        };
    });
    // Join Any Room / Matchmaking (2, 3, or 4 players - ZERO BOTS)
    app.post('/api/games/matchmake', async (request, reply) => {
        const user = await getRequestUser(request);
        const body = (request.body || {});
        const rawGameType = body.gameType || 'ludo';
        const gameType = rawGameType === 'four-in-a-row' || rawGameType === 'connect4' ? 'four-in-a-row' : 'ludo';
        const maxPlayers = gameType === 'four-in-a-row' ? 2 : (Number(body.maxPlayers) || 2);
        const gameBasePath = gameType === 'four-in-a-row' ? '/games/four-in-a-row' : '/games/ludo';
        try {
            // If user has a partner who is waiting in a matching room, pair them together!
            const partner = db.getPartner(user.id);
            if (partner) {
                const partnerRoom = db.findUserWaitingGameRoom(partner.partnerUserId);
                if (partnerRoom &&
                    partnerRoom.gameType === gameType &&
                    partnerRoom.maxPlayers === maxPlayers &&
                    partnerRoom.players.length < partnerRoom.maxPlayers) {
                    const joined = gameRoomManager.joinRoom(partnerRoom.roomCode, user);
                    return {
                        success: true,
                        room: joined,
                        joinedExisting: true,
                        inviteUrl: `${gameBasePath}?room=${joined.roomCode}`
                    };
                }
            }
            const result = gameRoomManager.matchmakeOrHost(user, gameType, maxPlayers);
            return {
                success: true,
                room: result.room,
                joinedExisting: result.joinedExisting,
                inviteUrl: `${gameBasePath}?room=${result.room.roomCode}`
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to matchmake' });
        }
    });
    // Create temporary Game Room (with temporary Room Code)
    app.post('/api/games/rooms', async (request, reply) => {
        const user = await getRequestUser(request);
        const body = (request.body || {});
        const rawGameType = body.gameType || 'ludo';
        const gameType = rawGameType === 'four-in-a-row' || rawGameType === 'connect4' ? 'four-in-a-row' : 'ludo';
        const maxPlayers = gameType === 'four-in-a-row' ? 2 : (Number(body.maxPlayers) || 2);
        const gameBasePath = gameType === 'four-in-a-row' ? '/games/four-in-a-row' : '/games/ludo';
        try {
            const room = gameRoomManager.createGameRoom({
                hostUser: user,
                gameType,
                maxPlayers,
                isPrivate: body.isPrivate,
                customCode: body.customCode
            });
            return {
                success: true,
                room,
                inviteUrl: `${gameBasePath}?room=${room.roomCode}`
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to create game room' });
        }
    });
    // Get Game Room details by temporary room code
    app.get('/api/games/rooms/:code', async (request, reply) => {
        const { code } = request.params;
        const room = db.getGameRoomByCode(code);
        if (!room) {
            return reply.code(404).send({ error: `Game room "${code}" not found or expired` });
        }
        return {
            room,
            isFull: room.players.length >= room.maxPlayers,
            canJoin: room.status === 'WAITING' && room.players.length < room.maxPlayers
        };
    });
    // Join Game Room by temporary room code
    app.post('/api/games/rooms/:code/join', async (request, reply) => {
        const { code } = request.params;
        const user = await getRequestUser(request);
        try {
            const room = gameRoomManager.joinRoom(code, user);
            return {
                success: true,
                room,
                inviteUrl: `/games/ludo?room=${room.roomCode}`
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to join game room' });
        }
    });
    // Invite Connected Partner to a Game Room
    app.post('/api/games/partner/invite', async (request, reply) => {
        const user = await getRequestUser(request);
        const partner = db.getPartner(user.id);
        if (!partner) {
            return reply.code(400).send({ error: 'No connected partner found to invite' });
        }
        const body = (request.body || {});
        if (!body.roomCode) {
            return reply.code(400).send({ error: 'Room code is required' });
        }
        const invitePayload = {
            id: `ginvite_${nanoid(8)}`,
            fromUserId: user.id,
            fromDisplayName: user.displayName,
            fromPartnerCode: user.partnerCode,
            roomCode: body.roomCode.toUpperCase(),
            gameType: body.gameType || 'ludo',
            timestamp: Date.now()
        };
        const sentInPresence = presenceManager.sendToUser(partner.partnerUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        const sentInGame = gameRoomManager.sendToUser(partner.partnerUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        const sentInParty = syncManager.sendToUser(partner.partnerUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        return {
            success: true,
            deliveredLive: sentInPresence || sentInGame || sentInParty,
            invite: invitePayload
        };
    });
    // Legacy Partner Lookup compatibility
    app.get('/api/games/partner/:code', async (request, reply) => {
        const { code } = request.params;
        const targetUser = db.getUserByPartnerCode(code);
        if (!targetUser) {
            return { found: false, online: false, partnerCode: code };
        }
        const isOnline = isUserOnline(targetUser.id);
        return {
            found: true,
            online: isOnline,
            partner: {
                code: targetUser.partnerCode,
                displayName: targetUser.displayName,
                avatarUrl: targetUser.avatarUrl
            }
        };
    });
    // --- Real-Time WebSocket Endpoint ---
    app.get('/ws/rooms/:slug', { websocket: true }, (connection, req) => {
        const ws = connection.socket || connection;
        const { slug } = req.params;
        const room = syncManager.getRoom(slug);
        if (!room) {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room does not exist' }
            }));
            ws.close();
            return;
        }
        // Extract auth from query params: ?token=... or ?guestName=...&guestId=...
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const guestName = url.searchParams.get('guestName');
        const guestIdParam = url.searchParams.get('guestId');
        let user;
        if (token) {
            try {
                const decoded = app.jwt.verify(token);
                user = {
                    id: decoded.id,
                    displayName: decoded.displayName,
                    avatarUrl: decoded.avatarUrl
                };
            }
            catch {
                const guestId = guestIdParam || `guest_${nanoid(8)}`;
                user = {
                    id: guestId,
                    displayName: guestName || `Guest_${nanoid(4)}`,
                    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`
                };
            }
        }
        else {
            const guestId = guestIdParam || `guest_${nanoid(8)}`;
            user = {
                id: guestId,
                displayName: guestName || `Guest_${nanoid(4)}`,
                avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`
            };
        }
        syncManager.handleConnection(ws, room, user);
    });
    // --- Real-Time Game Room WebSocket Endpoint ---
    app.get('/ws/games/:code', { websocket: true }, (connection, req) => {
        const ws = connection.socket || connection;
        const { code } = req.params;
        const room = gameRoomManager.getRoomByCode(code.toUpperCase());
        if (!room) {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'GAME_ROOM_NOT_FOUND', message: 'Game room does not exist' }
            }));
            ws.close();
            return;
        }
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const guestName = url.searchParams.get('guestName');
        const guestIdParam = url.searchParams.get('guestId');
        let user;
        if (token) {
            try {
                const decoded = app.jwt.verify(token);
                user = {
                    id: decoded.id,
                    displayName: decoded.displayName || 'Player',
                    avatarUrl: decoded.avatarUrl
                };
                db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl || undefined, Boolean(decoded.isAnonymous), decoded.email);
            }
            catch {
                const guestId = guestIdParam || `guest_${nanoid(8)}`;
                user = {
                    id: guestId,
                    displayName: guestName || `Guest_${nanoid(4)}`,
                    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`
                };
                db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, true);
            }
        }
        else {
            const guestId = guestIdParam || `guest_${nanoid(8)}`;
            user = {
                id: guestId,
                displayName: guestName || `Guest_${nanoid(4)}`,
                avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`
            };
            db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, true);
        }
        gameRoomManager.registerClient(ws, room.id, user);
    });
    // --- Real-Time Global Presence WebSocket Endpoint ---
    app.get('/ws/presence', { websocket: true }, (connection, req) => {
        const ws = connection.socket || connection;
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const guestName = url.searchParams.get('guestName');
        const guestIdParam = url.searchParams.get('guestId');
        let user;
        if (token) {
            try {
                const decoded = app.jwt.verify(token);
                user = {
                    id: decoded.id,
                    displayName: decoded.displayName,
                    partnerCode: decoded.partnerCode,
                    avatarUrl: decoded.avatarUrl
                };
            }
            catch {
                const guestId = guestIdParam || `guest_${nanoid(8)}`;
                user = {
                    id: guestId,
                    displayName: guestName || `Guest_${nanoid(4)}`
                };
            }
        }
        else {
            const guestId = guestIdParam || `guest_${nanoid(8)}`;
            user = {
                id: guestId,
                displayName: guestName || `Guest_${nanoid(4)}`
            };
        }
        presenceManager.registerSocket(ws, user);
    });
    return { app, db, syncManager, gameRoomManager, presenceManager };
}
// Direct execution entrypoint
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname ||
    process.argv[1]?.endsWith('/index.js') ||
    process.argv[1]?.endsWith('/index.ts') ||
    Boolean(process.env.pm_id);
if (isMainModule) {
    const { app } = await createServer();
    try {
        const address = await app.listen({ port: PORT, host: HOST });
        console.log(`🎬 SyncCinema Server running at ${address}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
