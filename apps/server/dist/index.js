import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { DatabaseService, extractParticipantIdsFromConvId, toCanonicalConvId } from './db/database.js';
import { mongoDb } from './db/mongoDatabase.js';
import { RoomSyncManager } from './sync/RoomSyncManager.js';
import { GameRoomManager } from './games/GameRoomManager.js';
import { GAME_DEFINITIONS } from './games/GameDefinitions.js';
import { PresenceManager } from './services/PresenceManager.js';
import { detectProviderFromUrl } from '@synccinema/common';
import { mongoLogger } from './services/mongoLogger.js';
function resolveGameType(raw) {
    const lower = (raw || '').toLowerCase();
    if (lower.includes('doodle') || lower.includes('pictionary') || lower.includes('draw'))
        return 'doodle-duel';
    if (lower.includes('tambola') || lower.includes('housie'))
        return 'tambola';
    if (lower.includes('bingo'))
        return 'bingo';
    if (lower.includes('tic'))
        return 'tic-tac-toe';
    if (lower.includes('four') || lower.includes('connect'))
        return 'four-in-a-row';
    if (lower.includes('chess'))
        return 'chess';
    return 'ludo';
}
function getGameBasePath(gameType) {
    if (gameType === 'doodle-duel')
        return '/games/doodle-duel';
    if (gameType === 'bingo')
        return '/games/bingo';
    if (gameType === 'tambola')
        return '/games/tambola';
    if (gameType === 'tic-tac-toe')
        return '/games/tic-tac-toe';
    if (gameType === 'four-in-a-row')
        return '/games/four-in-a-row';
    if (gameType === 'chess')
        return '/games/chess';
    return '/games/ludo';
}
const JWT_SECRET = process.env.JWT_SECRET || 'synccinema-development-super-secret-key-32chars!';
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
export async function createServer(dbPath = './synccinema.db') {
    const app = fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info'
        }
    });
    try {
        await mongoDb.connect();
    }
    catch (err) {
        console.error('MongoDB connection notice:', err);
    }
    const db = new DatabaseService(dbPath);
    const syncManager = new RoomSyncManager(db);
    const gameRoomManager = new GameRoomManager(db);
    const presenceManager = new PresenceManager(mongoDb);
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
        return reply.code(403).send({ error: 'Guest access is disabled. Please sign in or create an account to access Watch.' });
    });
    // Check email endpoint for passwordless or adaptive login
    app.post('/api/auth/check-email', async (request, reply) => {
        const body = (request.body || {});
        if (!body.email) {
            return reply.code(400).send({ error: 'Email is required' });
        }
        const normalized = body.email.trim().toLowerCase();
        const existing = await mongoDb.getUserByEmail(normalized);
        if (!existing) {
            return { exists: false };
        }
        return {
            exists: true,
            hasPassword: Boolean(existing.passwordHash),
            displayName: existing.user.displayName,
            avatarUrl: existing.user.avatarUrl
        };
    });
    app.post('/api/auth/login', async (request, reply) => {
        const body = (request.body || {});
        if (!body.email) {
            return reply.code(400).send({ error: 'Email is required' });
        }
        const normalized = body.email.trim().toLowerCase();
        const existing = await mongoDb.getUserByEmail(normalized);
        if (!existing) {
            return reply.code(404).send({ error: 'No account found with this email. Please sign up to get started.' });
        }
        // Check if account has a password set
        if (!existing.passwordHash) {
            return reply.code(400).send({
                error: 'No password is set for this account yet. Please create a password to continue.',
                needsPasswordSetup: true
            });
        }
        if (!body.password) {
            return reply.code(400).send({ error: 'Password is required' });
        }
        if (body.password !== existing.passwordHash) {
            return reply.code(401).send({ error: 'Incorrect password. Please try again or reset your password.' });
        }
        const user = existing.user;
        const token = app.jwt.sign({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            isAnonymous: false
        });
        await mongoLogger.logAuthLogin(user.id, user.email || '', user.displayName);
        return { token, user };
    });
    // Set or Reset Password endpoint
    app.post('/api/auth/set-password', async (request, reply) => {
        const body = (request.body || {});
        if (!body.email || !body.newPassword) {
            return reply.code(400).send({ error: 'Email and new password are required' });
        }
        if (body.newPassword.length < 6) {
            return reply.code(400).send({ error: 'Password must be at least 6 characters long' });
        }
        const normalized = body.email.trim().toLowerCase();
        const existing = await mongoDb.getUserByEmail(normalized);
        if (!existing) {
            return reply.code(404).send({ error: 'No account found with this email' });
        }
        await mongoDb.setPassword(normalized, body.newPassword);
        const updated = await mongoDb.getUserByEmail(normalized);
        const user = updated?.user || existing.user;
        const token = app.jwt.sign({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            isAnonymous: false
        });
        await mongoLogger.logAuthLogin(user.id, user.email || '', user.displayName);
        return { token, user, message: 'Password updated successfully!' };
    });
    app.post('/api/auth/register', async (request, reply) => {
        const body = request.body;
        if (!body.email || !body.displayName) {
            return reply.code(400).send({ error: 'Email and display name required' });
        }
        const normalized = body.email.trim().toLowerCase();
        const existing = await mongoDb.getUserByEmail(normalized);
        if (existing) {
            return reply.code(409).send({ error: 'Email already registered. Please log in.' });
        }
        let calculatedAge = body.age;
        if (calculatedAge == null && body.dateOfBirth) {
            const birth = new Date(body.dateOfBirth);
            if (!isNaN(birth.getTime())) {
                const diffMs = Date.now() - birth.getTime();
                calculatedAge = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
            }
        }
        const userId = `usr_${nanoid(10)}`;
        const userPayload = {
            id: userId,
            email: normalized,
            displayName: body.displayName.trim(),
            avatarUrl: body.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
            isAnonymous: false,
            dateOfBirth: body.dateOfBirth,
            anniversaryDate: body.isMarried ? body.anniversaryDate : undefined,
            isMarried: Boolean(body.isMarried),
            age: calculatedAge,
            createdAt: new Date().toISOString()
        };
        const user = await mongoDb.createUser(userPayload, body.password);
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
            const user = await mongoDb.getUserById(payload.id);
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            return { user };
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    app.put('/api/auth/profile', async (request, reply) => {
        try {
            const payload = (await request.jwtVerify());
            const body = request.body;
            let calculatedAge = body.age;
            if (calculatedAge == null && body.dateOfBirth) {
                const birth = new Date(body.dateOfBirth);
                if (!isNaN(birth.getTime())) {
                    const diffMs = Date.now() - birth.getTime();
                    calculatedAge = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
                }
            }
            const isMarried = body.isMarried !== undefined
                ? body.isMarried
                : (body.relationshipStatus === 'married');
            const updateData = {
                displayName: body.displayName?.trim(),
                avatarUrl: body.avatarUrl,
                dateOfBirth: body.dateOfBirth,
                anniversaryDate: body.anniversaryDate,
                isMarried,
                relationshipStatus: body.relationshipStatus,
                gender: body.gender,
                pronouns: body.pronouns,
                location: body.location?.trim(),
                bio: body.bio?.trim(),
                favoriteGenres: body.favoriteGenres,
                viewingVibe: body.viewingVibe,
                age: calculatedAge
            };
            const updated = await mongoDb.updateUser(payload.id, updateData);
            if (!updated) {
                return reply.code(404).send({ error: 'User not found' });
            }
            return { user: updated };
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    // Get Partner Sync Code / Username change status & quota
    app.get('/api/user/partner-code/status', async (request, reply) => {
        try {
            const user = await getRequestUser(request);
            const status = await mongoDb.getPartnerCodeStatus(user.id);
            return { success: true, ...status };
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    // Change Partner Sync Code / Username with 3 times in 90 days rate-limit
    app.put('/api/user/partner-code', async (request, reply) => {
        try {
            const user = await getRequestUser(request);
            const body = (request.body || {});
            if (!body.newCode) {
                return reply.code(400).send({ success: false, error: 'New username / partner code is required.' });
            }
            const result = await mongoDb.changePartnerCode(user.id, body.newCode);
            if (!result.success) {
                return reply.code(400).send({ success: false, error: result.error });
            }
            return { success: true, partnerCode: result.partnerCode, changesRemaining: result.changesRemaining };
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
            if (!user || user.isAnonymous) {
                return reply.code(401).send({ error: 'Authentication required. Please sign in to create a room.' });
            }
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
        await mongoDb.deleteUserData(user.id);
        db.deleteUserData(user.id);
        return { success: true, message: 'All personal viewing and chat records permanently erased' };
    });
    // --- Helper to extract or provision User from request ---
    async function getRequestUser(request) {
        const decoded = await request.jwtVerify();
        if (!decoded || decoded.isAnonymous) {
            const err = new Error('Authentication required');
            err.statusCode = 401;
            throw err;
        }
        let user = await mongoDb.getUserById(decoded.id);
        if (user) {
            if (!user.partnerCode) {
                user.partnerCode = await mongoDb.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, false, user.email);
            }
            return user;
        }
        const partnerCode = await mongoDb.ensureUserPartnerCode(decoded.id, decoded.displayName, decoded.avatarUrl, false, decoded.email);
        user = await mongoDb.getUserById(decoded.id);
        if (user)
            return user;
        return {
            id: decoded.id,
            displayName: decoded.displayName || 'User',
            avatarUrl: decoded.avatarUrl,
            isAnonymous: false,
            partnerCode,
            createdAt: new Date().toISOString()
        };
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
        const partner = await mongoDb.getPartner(user.id);
        const partnerOnline = partner ? isUserOnline(partner.partnerUserId) : false;
        return {
            user: {
                ...user,
                partnerCode: user.partnerCode || (await mongoDb.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email))
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
        const partner = await mongoDb.getPartner(user.id);
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
        const partner = await mongoDb.getPartner(user.id);
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
        let code = body.partnerCode;
        if (!code && (body.friendUserId || body.userId)) {
            const targetUser = await mongoDb.getUserById(body.friendUserId || body.userId);
            if (targetUser?.partnerCode) {
                code = targetUser.partnerCode;
            }
        }
        if (!code) {
            return reply.code(400).send({ error: 'Partner Code or Friend ID is required' });
        }
        try {
            const partner = await mongoDb.connectPartner(user.id, code);
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
        await mongoDb.disconnectPartner(user.id);
        return { success: true, message: 'Partner disconnected' };
    });
    // =====================================================================
    // Friends & Snapchat-Style Streaks Endpoints
    // =====================================================================
    app.get('/api/friends', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const friends = await mongoDb.getFriendsWithStreaks(user.id, (id) => isUserOnline(id));
        const requests = await mongoDb.getFriendRequests(user.id);
        return {
            friends,
            requests,
            pendingRequestsCount: requests.incoming.length,
            myFriendCode: user.partnerCode || (await mongoDb.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email))
        };
    });
    app.get('/api/friends/requests', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const requests = await mongoDb.getFriendRequests(user.id);
        return {
            success: true,
            ...requests
        };
    });
    app.get('/api/friends/discover', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const { search } = request.query;
        const users = await mongoDb.getDiscoverableUsers(user.id, search);
        return {
            success: true,
            users
        };
    });
    app.post('/api/friends/add', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.friendCode) {
            return reply.code(400).send({ error: 'Friend Code is required' });
        }
        try {
            const result = await mongoDb.sendFriendRequest(user.id, body.friendCode);
            if (result.friend) {
                result.friend.friendUser.isOnline = isUserOnline(result.friend.friendUser.id);
            }
            return {
                success: true,
                status: result.status,
                friend: result.friend,
                message: result.message
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to send friend request' });
        }
    });
    app.post('/api/friends/requests/accept', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.senderUserId) {
            return reply.code(400).send({ error: 'senderUserId is required' });
        }
        try {
            const friend = await mongoDb.acceptFriendRequest(user.id, body.senderUserId);
            friend.friendUser.isOnline = isUserOnline(friend.friendUser.id);
            return {
                success: true,
                friend,
                message: `Accepted request from ${friend.friendUser.displayName}`
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to accept friend request' });
        }
    });
    app.post('/api/friends/requests/decline', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.senderUserId) {
            return reply.code(400).send({ error: 'senderUserId is required' });
        }
        await mongoDb.declineFriendRequest(user.id, body.senderUserId);
        return {
            success: true,
            message: 'Friend request declined'
        };
    });
    app.post('/api/friends/requests/cancel', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.targetUserId) {
            return reply.code(400).send({ error: 'targetUserId is required' });
        }
        await mongoDb.cancelFriendRequest(user.id, body.targetUserId);
        return {
            success: true,
            message: 'Friend request cancelled'
        };
    });
    app.delete('/api/friends/:friendUserId', async (request, reply) => {
        const user = await getRequestUser(request);
        const { friendUserId } = request.params;
        if (!friendUserId) {
            return reply.code(400).send({ error: 'friendUserId is required' });
        }
        await mongoDb.removeFriend(user.id, friendUserId);
        return { success: true, message: 'Friend removed' };
    });
    // =====================================================================
    // Watch Direct Chat Endpoints
    // =====================================================================
    app.get('/api/chat/messages', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const { conversationId, limit, before, after } = request.query;
        if (!conversationId) {
            return reply.code(400).send({ error: 'conversationId is required' });
        }
        const maxLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500) : 100;
        const messages = await mongoDb.getDirectChatMessages(conversationId, user.id, {
            limit: maxLimit,
            before,
            after
        });
        return {
            success: true,
            messages,
            hasMore: messages.length >= maxLimit,
            latestTimestamp: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
            earliestTimestamp: messages.length > 0 ? messages[0].createdAt : null
        };
    });
    app.post('/api/chat/messages', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.conversationId || !body.content) {
            return reply.code(400).send({ error: 'conversationId and content are required' });
        }
        let recipientId = body.recipientId;
        if (!recipientId && body.conversationId) {
            const { otherUserId } = extractParticipantIdsFromConvId(body.conversationId, user.id);
            if (otherUserId) {
                recipientId = otherUserId;
            }
        }
        const canonicalConvId = (recipientId && user.id)
            ? toCanonicalConvId(user.id, recipientId)
            : body.conversationId;
        const isRecipientOnline = recipientId ? presenceManager.isUserOnline(recipientId) : false;
        const status = isRecipientOnline ? 'delivered' : 'sent';
        const messageId = body.id || `msg_${Date.now()}_${nanoid(6)}`;
        const msg = {
            id: messageId,
            conversationId: canonicalConvId,
            senderId: user.id,
            senderName: body.senderName || user.displayName,
            senderAvatar: body.senderAvatar || user.avatarUrl || undefined,
            recipientId,
            type: body.type || 'text',
            content: body.content,
            mediaUrl: body.mediaUrl,
            metadata: body.metadata,
            replyTo: body.replyTo,
            status,
            createdAt: body.createdAt || new Date().toISOString()
        };
        await mongoDb.saveDirectChatMessage(msg);
        // Guarantee delivery to recipient sockets even if sender WebSocket was offline/reconnecting
        if (recipientId) {
            presenceManager.sendToUser(recipientId, {
                type: 'chat:message',
                message: msg
            });
        }
        return { success: true, message: msg };
    });
    app.post('/api/chat/read', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.conversationId) {
            return reply.code(400).send({ error: 'conversationId is required' });
        }
        const updatedMessages = await mongoDb.markDirectMessagesAsRead(body.conversationId, user.id);
        if (body.senderId) {
            const canonicalConvId = `conv_${[user.id, body.senderId].sort().join('_')}`;
            presenceManager.sendToUser(body.senderId, {
                type: 'chat:status_update',
                conversationId: canonicalConvId,
                status: 'read',
                messageIds: updatedMessages.map((m) => m.id)
            });
            if (body.conversationId !== canonicalConvId) {
                presenceManager.sendToUser(body.senderId, {
                    type: 'chat:status_update',
                    conversationId: body.conversationId,
                    status: 'read',
                    messageIds: updatedMessages.map((m) => m.id)
                });
            }
        }
        return { success: true, count: updatedMessages.length };
    });
    app.post('/api/chat/view-once-opened', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.messageId) {
            return reply.code(400).send({ error: 'messageId is required' });
        }
        const details = await mongoDb.markDirectMessageViewOnceOpened(body.messageId);
        if (details) {
            const targetUser = details.senderId === user.id ? details.recipientId : details.senderId;
            if (targetUser) {
                presenceManager.sendToUser(targetUser, {
                    type: 'chat:view_once_opened',
                    conversationId: details.conversationId || body.conversationId,
                    messageId: body.messageId,
                    openedBy: user.id
                });
            }
        }
        return { success: true };
    });
    app.post('/api/streaks/record', async (request, reply) => {
        const user = await getRequestUser(request);
        presenceManager.recordHeartbeat(user.id);
        const body = (request.body || {});
        if (!body.friendUserId) {
            return reply.code(400).send({ error: 'friendUserId is required' });
        }
        const result = await mongoDb.recordSessionBetweenUsers(user.id, body.friendUserId, body.minutes || 1);
        return {
            success: true,
            status: result.status,
            streak: result.streak
        };
    });
    // =====================================================================
    // Human-Only Game Rooms & Matchmaking Endpoints
    // =====================================================================
    // Get active games of connected friends (Waiting in lobby or Playing)
    app.get('/api/games/active-friends', async (request, reply) => {
        try {
            const user = await getRequestUser(request);
            const friends = await mongoDb.getFriendsWithStreaks(user.id);
            const activeFriends = [];
            for (const f of friends) {
                const friendId = f.friendUser.id;
                const activeGame = gameRoomManager.getUserActiveGame(friendId);
                if (activeGame) {
                    const gameTitle = GAME_DEFINITIONS[activeGame.gameType]?.name || activeGame.gameType;
                    activeFriends.push({
                        friend: {
                            id: f.friendUser.id,
                            displayName: f.friendUser.displayName,
                            avatarUrl: f.friendUser.avatarUrl,
                            partnerCode: f.friendUser.partnerCode,
                            isOnline: true
                        },
                        game: {
                            roomId: activeGame.roomId,
                            roomCode: activeGame.roomCode,
                            gameType: activeGame.gameType,
                            gameTitle,
                            status: activeGame.status,
                            playerCount: activeGame.playerCount,
                            maxPlayers: activeGame.maxPlayers,
                            isHost: activeGame.hostUserId === friendId,
                            joinUrl: `/games/${activeGame.gameType === 'four-in-a-row' ? 'four-in-a-row' : activeGame.gameType}?room=${encodeURIComponent(activeGame.roomCode)}`
                        }
                    });
                }
            }
            return { success: true, activeFriends };
        }
        catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || 'Failed to fetch active friends in games' });
        }
    });
    // Play with Partner / Friend (Deterministic Smart Pairing or Custom Room Creation)
    app.post('/api/games/partner/play', async (request, reply) => {
        try {
            const user = await getRequestUser(request);
            const body = (request.body || {});
            const gameType = resolveGameType(body.gameType);
            let targetUser = null;
            const targetId = body.targetUserId || body.friendUserId;
            if (targetId) {
                targetUser = await mongoDb.getUserById(targetId);
            }
            else if (body.partnerCode) {
                targetUser = await mongoDb.getUserByPartnerCode(body.partnerCode);
            }
            let partnerUserId = null;
            if (targetUser && targetUser.id !== user.id) {
                partnerUserId = targetUser.id;
                try {
                    if (targetUser.partnerCode) {
                        await mongoDb.connectPartner(user.id, targetUser.partnerCode);
                    }
                }
                catch { }
            }
            else {
                const partner = await mongoDb.getPartner(user.id);
                if (partner) {
                    partnerUserId = partner.partnerUserId;
                }
            }
            const gameBasePath = getGameBasePath(gameType);
            // 1. Check if partner is ALREADY waiting in an open game room
            if (partnerUserId) {
                const partnerWaitingRoom = db.findUserWaitingGameRoom(partnerUserId);
                if (partnerWaitingRoom &&
                    partnerWaitingRoom.gameType === gameType &&
                    partnerWaitingRoom.status === 'WAITING' &&
                    partnerWaitingRoom.players.length < partnerWaitingRoom.maxPlayers) {
                    try {
                        const joined = gameRoomManager.joinRoom(partnerWaitingRoom.roomCode, user);
                        return {
                            success: true,
                            room: joined,
                            joinedPartnerRoom: true,
                            inviteUrl: `${gameBasePath}?room=${joined.roomCode}`
                        };
                    }
                    catch (joinErr) {
                        console.warn(`[PartnerPlay] Failed to join partner's waiting room ${partnerWaitingRoom.roomCode}:`, joinErr);
                    }
                }
            }
            // 2. Check if current user ALREADY has an open waiting game room
            const myWaitingRoom = db.findUserWaitingGameRoom(user.id);
            if (myWaitingRoom && myWaitingRoom.gameType === gameType && myWaitingRoom.status === 'WAITING') {
                if (partnerUserId) {
                    const invitePayload = {
                        id: `ginvite_${nanoid(8)}`,
                        fromUserId: user.id,
                        fromDisplayName: user.displayName,
                        fromPartnerCode: user.partnerCode,
                        roomCode: myWaitingRoom.roomCode,
                        gameType: myWaitingRoom.gameType,
                        timestamp: Date.now()
                    };
                    presenceManager.sendToUser(partnerUserId, {
                        type: 'partner:game_invite',
                        payload: invitePayload
                    });
                }
                return {
                    success: true,
                    room: myWaitingRoom,
                    joinedPartnerRoom: false,
                    inviteUrl: `${gameBasePath}?room=${myWaitingRoom.roomCode}`
                };
            }
            // 3. Otherwise, create a dedicated 2-player game room for the host
            const created = gameRoomManager.createGameRoom({
                hostUser: user,
                gameType,
                maxPlayers: 2,
                isPrivate: true
            });
            if (partnerUserId) {
                const invitePayload = {
                    id: `ginvite_${nanoid(8)}`,
                    fromUserId: user.id,
                    fromDisplayName: user.displayName,
                    fromPartnerCode: user.partnerCode,
                    roomCode: created.roomCode,
                    gameType,
                    timestamp: Date.now()
                };
                presenceManager.sendToUser(partnerUserId, {
                    type: 'partner:game_invite',
                    payload: invitePayload
                });
            }
            return {
                success: true,
                room: created,
                joinedPartnerRoom: false,
                inviteUrl: `${gameBasePath}?room=${created.roomCode}`
            };
        }
        catch (err) {
            console.error('[PartnerPlay] Error creating/joining partner game:', err);
            return reply.code(err.statusCode || 500).send({
                error: err.message || 'Failed to start match with partner'
            });
        }
    });
    // Join Any Room / Matchmaking (2, 3, or 4 players - ZERO BOTS)
    app.post('/api/games/matchmake', async (request, reply) => {
        const user = await getRequestUser(request);
        const body = (request.body || {});
        const gameType = resolveGameType(body.gameType);
        const maxPlayers = gameType === 'ludo' ? (Number(body.maxPlayers) || 2) : 2;
        const gameBasePath = getGameBasePath(gameType);
        try {
            // If user has a partner who is waiting in a matching room, pair them together!
            const partner = await mongoDb.getPartner(user.id);
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
        const gameType = resolveGameType(body.gameType);
        const def = GAME_DEFINITIONS[gameType];
        let maxPlayers = Number(body.maxPlayers) || (def?.playerOptions ? def.playerOptions[0] : 2);
        if (def && !def.playerOptions.includes(maxPlayers)) {
            maxPlayers = def.playerOptions.includes(Number(body.maxPlayers)) ? Number(body.maxPlayers) : def.playerOptions[0];
        }
        const gameBasePath = getGameBasePath(gameType);
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
        const cleanCode = (code || '').trim().toUpperCase();
        const room = gameRoomManager.getRoomByCode(cleanCode) || db.getGameRoomByCode(cleanCode);
        if (!room) {
            return reply.code(404).send({ error: `Game room "${cleanCode}" not found or expired` });
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
        const cleanCode = (code || '').trim().toUpperCase();
        const user = await getRequestUser(request);
        try {
            const room = gameRoomManager.joinRoom(cleanCode, user);
            return {
                success: true,
                room,
                inviteUrl: `${getGameBasePath(room.gameType)}?room=${room.roomCode}`
            };
        }
        catch (err) {
            return reply.code(400).send({ error: err.message || 'Failed to join game room' });
        }
    });
    // Invite Connected Partner to a Game Room
    app.post('/api/games/partner/invite', async (request, reply) => {
        const user = await getRequestUser(request);
        const partner = await mongoDb.getPartner(user.id);
        if (!partner) {
            return reply.code(400).send({ error: 'No connected partner found to invite' });
        }
        const body = (request.body || {});
        if (!body.roomCode) {
            return reply.code(400).send({ error: 'Room code is required' });
        }
        const gameType = resolveGameType(body.gameType);
        const invitePayload = {
            id: `ginvite_${nanoid(8)}`,
            fromUserId: user.id,
            fromDisplayName: user.displayName,
            fromPartnerCode: user.partnerCode,
            roomCode: body.roomCode.toUpperCase(),
            gameType,
            timestamp: Date.now()
        };
        // Also support targetPartnerCode from body if specified
        const targetCode = request.body?.targetPartnerCode;
        let targetUserId = partner.partnerUserId;
        if (targetCode) {
            const explicitUser = await mongoDb.getUserByPartnerCode(targetCode);
            if (explicitUser) {
                targetUserId = explicitUser.id;
            }
        }
        const sentInPresence = presenceManager.sendToUser(targetUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        const sentInGame = gameRoomManager.sendToUser(targetUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        const sentInParty = syncManager.sendToUser(targetUserId, {
            type: 'partner:game_invite',
            payload: invitePayload
        });
        return {
            success: true,
            deliveredLive: sentInPresence || sentInGame || sentInParty,
            invite: invitePayload
        };
    });
    // Partner Ping Endpoint (Used across games and lobby)
    app.post('/api/games/partner/ping', async (request, reply) => {
        const body = (request.body || {});
        if (!body.targetCode) {
            return reply.code(400).send({ error: 'Target partner code is required' });
        }
        const targetUser = await mongoDb.getUserByPartnerCode(body.targetCode.toUpperCase());
        if (!targetUser) {
            return reply.code(404).send({ error: 'Partner code not found' });
        }
        const pingPayload = {
            id: `ping_${nanoid(8)}`,
            fromCode: body.fromCode || 'ANON',
            fromName: body.fromName || 'Your Partner',
            targetCode: body.targetCode.toUpperCase(),
            roomCode: body.roomCode ? body.roomCode.toUpperCase() : undefined,
            gameType: body.gameType || 'ludo',
            customMessage: body.customMessage,
            createdAt: Date.now(),
            read: false
        };
        const sentInPresence = presenceManager.sendToUser(targetUser.id, {
            type: 'partner:ping',
            payload: pingPayload
        });
        const sentInGame = gameRoomManager.sendToUser(targetUser.id, {
            type: 'partner:ping',
            payload: pingPayload
        });
        const sentInParty = syncManager.sendToUser(targetUser.id, {
            type: 'partner:ping',
            payload: pingPayload
        });
        return {
            success: true,
            deliveredLive: sentInPresence || sentInGame || sentInParty,
            ping: pingPayload
        };
    });
    // Partner Friendly Nudge Endpoint
    app.post('/api/friends/nudge', async (request, reply) => {
        const user = await getRequestUser(request);
        const body = (request.body || {});
        if (!body.targetPartnerCode) {
            return reply.code(400).send({ error: 'Target partner code is required' });
        }
        const targetUser = await mongoDb.getUserByPartnerCode(body.targetPartnerCode.toUpperCase());
        if (!targetUser) {
            return reply.code(404).send({ error: 'Target partner not found' });
        }
        const nudgePayload = {
            id: `nudge_${nanoid(8)}`,
            fromUserId: user.id,
            fromName: user.displayName,
            fromPartnerCode: user.partnerCode,
            fromAvatar: user.avatarUrl,
            message: body.message,
            category: body.category || 'nudge',
            link: body.link || '/friends',
            timestamp: Date.now()
        };
        const sentInPresence = presenceManager.sendToUser(targetUser.id, {
            type: 'partner:nudge',
            payload: nudgePayload
        });
        const sentInGame = gameRoomManager.sendToUser(targetUser.id, {
            type: 'partner:nudge',
            payload: nudgePayload
        });
        const sentInParty = syncManager.sendToUser(targetUser.id, {
            type: 'partner:nudge',
            payload: nudgePayload
        });
        return {
            success: true,
            deliveredLive: sentInPresence || sentInGame || sentInParty,
            nudge: nudgePayload
        };
    });
    // Legacy Partner Lookup compatibility
    app.get('/api/games/partner/:code', async (request, reply) => {
        const { code } = request.params;
        const targetUser = await mongoDb.getUserByPartnerCode(code);
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
    // --- Plans Endpoints ---
    app.get('/api/plans', async (request, reply) => {
        const plans = await mongoDb.getPlans();
        return { plans };
    });
    app.post('/api/plans', async (request, reply) => {
        let user = null;
        try {
            user = await request.jwtVerify();
        }
        catch { }
        const body = (request.body || {});
        if (!body.title) {
            return reply.code(400).send({ error: 'Title is required' });
        }
        const planId = body.id || `plan-${Date.now()}`;
        const plan = await mongoDb.createPlan({
            ...body,
            id: planId,
            hostId: user?.id || body.hostId || 'u1'
        });
        return { success: true, plan };
    });
    app.get('/api/plans/:id', async (request, reply) => {
        const { id } = request.params;
        const plan = await mongoDb.getPlanById(id);
        if (!plan) {
            return reply.code(404).send({ error: 'Plan not found' });
        }
        return { plan };
    });
    app.put('/api/plans/:id', async (request, reply) => {
        const { id } = request.params;
        const updates = (request.body || {});
        const plan = await mongoDb.updatePlan(id, updates);
        if (!plan) {
            return reply.code(404).send({ error: 'Plan not found' });
        }
        return { success: true, plan };
    });
    app.post('/api/plans/:id/rsvp', async (request, reply) => {
        const { id } = request.params;
        const body = (request.body || {});
        const plan = await mongoDb.getPlanById(id);
        if (!plan) {
            return reply.code(404).send({ error: 'Plan not found' });
        }
        const participants = [...(plan.participants || [])];
        const idx = participants.findIndex((p) => p.userId === body.userId);
        if (idx >= 0) {
            participants[idx] = {
                ...participants[idx],
                status: body.status,
                displayName: body.displayName || participants[idx].displayName,
                avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : participants[idx].avatarUrl
            };
        }
        else {
            participants.push({
                userId: body.userId,
                displayName: body.displayName || 'Friend',
                avatarUrl: body.avatarUrl,
                status: body.status,
                isHost: false
            });
        }
        const updated = await mongoDb.updatePlan(id, { participants });
        return { success: true, plan: updated };
    });
    app.post('/api/plans/:id/vote', async (request, reply) => {
        const { id } = request.params;
        const { optionId, userId } = (request.body || {});
        const plan = await mongoDb.getPlanById(id);
        if (!plan || !plan.voting) {
            return reply.code(404).send({ error: 'Plan or voting not found' });
        }
        const options = plan.voting.options.map((opt) => {
            const votes = opt.votes || [];
            if (opt.id === optionId) {
                if (!votes.includes(userId)) {
                    return { ...opt, votes: [...votes, userId] };
                }
                return opt;
            }
            else {
                return { ...opt, votes: votes.filter((v) => v !== userId) };
            }
        });
        const updated = await mongoDb.updatePlan(id, {
            voting: { ...plan.voting, options }
        });
        return { success: true, plan: updated };
    });
    app.post('/api/plans/:id/chat', async (request, reply) => {
        const { id } = request.params;
        const body = (request.body || {});
        const plan = await mongoDb.getPlanById(id);
        if (!plan) {
            return reply.code(404).send({ error: 'Plan not found' });
        }
        const newMsg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            userId: body.userId,
            displayName: body.displayName || 'Member',
            avatarUrl: body.avatarUrl,
            text: body.text,
            createdAt: Date.now()
        };
        const chatMessages = [...(plan.chatMessages || []), newMsg];
        const updated = await mongoDb.updatePlan(id, { chatMessages });
        return { success: true, message: newMsg, plan: updated };
    });
    app.delete('/api/plans/:id', async (request, reply) => {
        const { id } = request.params;
        const plan = await mongoDb.getPlanById(id);
        if (!plan) {
            return reply.code(404).send({ error: 'Plan not found' });
        }
        const deleted = await mongoDb.deletePlan(id);
        return { success: deleted, id };
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
        // Extract auth from query params: ?token=...
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        if (!token) {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' }
            }));
            ws.close(4001, 'AUTH_REQUIRED');
            return;
        }
        let user;
        try {
            const decoded = app.jwt.verify(token);
            if (!decoded || decoded.isAnonymous) {
                throw new Error('Anonymous users not allowed');
            }
            user = {
                id: decoded.id,
                displayName: decoded.displayName,
                avatarUrl: decoded.avatarUrl
            };
        }
        catch {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' }
            }));
            ws.close(4001, 'AUTH_REQUIRED');
            return;
        }
        syncManager.handleConnection(ws, room, user);
    });
    // --- Real-Time Game Room WebSocket Endpoint ---
    app.get('/ws/games/:code', { websocket: true }, async (connection, req) => {
        const ws = connection.socket || connection;
        const { code } = req.params;
        const cleanCode = (code || '').trim().toUpperCase();
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const requestedGameType = url.searchParams.get('gameType');
        if (!token) {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' }
            }));
            ws.close(4001, 'AUTH_REQUIRED');
            return;
        }
        let user;
        try {
            const decoded = app.jwt.verify(token);
            if (!decoded || decoded.isAnonymous) {
                throw new Error('Anonymous users not allowed');
            }
            const dbUser = (await mongoDb.getUserById(decoded.id)) || db.getUserById(decoded.id);
            user = {
                id: decoded.id,
                displayName: dbUser?.displayName || decoded.displayName || 'Player',
                avatarUrl: dbUser?.avatarUrl || decoded.avatarUrl || null
            };
            await mongoDb.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl || undefined, false, decoded.email);
        }
        catch {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' }
            }));
            ws.close(4001, 'AUTH_REQUIRED');
            return;
        }
        let room = gameRoomManager.getRoomByCode(cleanCode);
        // If room does not exist in memory/db yet, auto-create it seamlessly
        if (!room) {
            try {
                const resolvedGame = resolveGameType(requestedGameType || cleanCode);
                const def = GAME_DEFINITIONS[resolvedGame];
                const maxPlayers = resolvedGame === 'ludo' ? 4 : (resolvedGame === 'tambola' ? 20 : (def?.playerOptions[0] || 2));
                room = gameRoomManager.createGameRoom({
                    hostUser: user,
                    gameType: resolvedGame,
                    maxPlayers,
                    customCode: cleanCode
                });
                console.log(`[GameRoom] Auto-created game room "${cleanCode}" for ${resolvedGame} hosted by ${user.displayName} (${user.id})`);
            }
            catch (err) {
                console.error(`[GameRoom] Failed to auto-create room ${cleanCode}:`, err);
            }
        }
        if (!room) {
            ws.send(JSON.stringify({
                type: 'error:notification',
                payload: { code: 'GAME_ROOM_NOT_FOUND', message: 'Game room does not exist' }
            }));
            ws.close();
            return;
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
