import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { DatabaseService } from './db/database.js';
import { RoomSyncManager } from './sync/RoomSyncManager.js';
import { GameRoomManager } from './games/GameRoomManager.js';
import { PresenceManager } from './services/PresenceManager.js';
import { detectProviderFromUrl, User, GameType } from '@synccinema/common';
import { mongoLogger } from './services/mongoLogger.js';

function resolveGameType(raw?: string): GameType {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('doodle') || lower.includes('pictionary') || lower.includes('draw')) return 'doodle-duel';
  if (lower.includes('tambola') || lower.includes('housie')) return 'tambola';
  if (lower.includes('bingo')) return 'bingo';
  if (lower.includes('tic')) return 'tic-tac-toe';
  if (lower.includes('four') || lower.includes('connect')) return 'four-in-a-row';
  return 'ludo';
}

function getGameBasePath(gameType: string): string {
  if (gameType === 'doodle-duel') return '/games/doodle-duel';
  if (gameType === 'bingo') return '/games/bingo';
  if (gameType === 'tambola') return '/games/tambola';
  if (gameType === 'tic-tac-toe') return '/games/tic-tac-toe';
  if (gameType === 'four-in-a-row') return '/games/four-in-a-row';
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

  const db = new DatabaseService(dbPath);
  const syncManager = new RoomSyncManager(db);
  const gameRoomManager = new GameRoomManager(db);
  const presenceManager = new PresenceManager(db);

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
    const body = (request.body || {}) as { displayName?: string };
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
    const body = (request.body || {}) as { email?: string; password?: string; displayName?: string };
    if (!body.email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    const existing = db.getUserByEmail(body.email);
    let user: any;
    if (!existing) {
      // Auto-register user on initial sign-in if not yet created
      const userId = `usr_${nanoid(10)}`;
      const displayName = body.displayName?.trim() || body.email.split('@')[0] || `User_${nanoid(4)}`;
      user = db.createUser(
        {
          id: userId,
          email: body.email,
          displayName,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          isAnonymous: false,
          createdAt: new Date().toISOString()
        },
        body.password
      );
      await mongoLogger.logAuthRegister(user.id, user.email || '', user.displayName);
    } else {
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
    const body = request.body as {
      email?: string;
      password?: string;
      displayName?: string;
      avatarUrl?: string;
      dateOfBirth?: string;
      anniversaryDate?: string;
      isMarried?: boolean;
      age?: number;
    };
    if (!body.email || !body.displayName) {
      return reply.code(400).send({ error: 'Email and display name required' });
    }

    const existing = db.getUserByEmail(body.email);
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' });
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
    const user = db.createUser(
      {
        id: userId,
        email: body.email,
        displayName: body.displayName,
        avatarUrl: body.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        isAnonymous: false,
        dateOfBirth: body.dateOfBirth,
        anniversaryDate: body.isMarried ? body.anniversaryDate : undefined,
        isMarried: Boolean(body.isMarried),
        age: calculatedAge,
        createdAt: new Date().toISOString()
      },
      body.password // in production, hash with argon2/bcrypt
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
      const payload = (await request.jwtVerify()) as any;
      const user = db.getUserById(payload.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return { user };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.put('/api/auth/profile', async (request, reply) => {
    try {
      const payload = (await request.jwtVerify()) as any;
      const body = request.body as {
        displayName?: string;
        avatarUrl?: string;
        dateOfBirth?: string;
        anniversaryDate?: string;
        isMarried?: boolean;
        relationshipStatus?: string;
        gender?: string;
        pronouns?: string;
        location?: string;
        bio?: string;
        favoriteGenres?: string[];
        viewingVibe?: string;
        age?: number;
      };

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

      const updated = db.updateUser(payload.id, {
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
      });

      if (!updated) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return { user: updated };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Get Partner Sync Code / Username change status & quota
  app.get('/api/user/partner-code/status', async (request, reply) => {
    try {
      const user = await getRequestUser(request);
      const status = db.getPartnerCodeStatus(user.id);
      return { success: true, ...status };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Change Partner Sync Code / Username with 3 times in 90 days rate-limit
  app.put('/api/user/partner-code', async (request, reply) => {
    try {
      const user = await getRequestUser(request);
      const body = (request.body || {}) as { newCode?: string };
      if (!body.newCode) {
        return reply.code(400).send({ success: false, error: 'New username / partner code is required.' });
      }
      const result = db.changePartnerCode(user.id, body.newCode);
      if (!result.success) {
        return reply.code(400).send({ success: false, error: result.error });
      }
      return { success: true, partnerCode: result.partnerCode, changesRemaining: result.changesRemaining };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/api/user/rooms', async (request, reply) => {
    try {
      const payload = (await request.jwtVerify()) as any;
      const rooms = db.getRoomsByHost(payload.id);
      return { rooms };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // --- Room Routes ---
  app.post('/api/rooms', async (request, reply) => {
    let user: any;
    try {
      user = await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Authentication required. Please sign in to create a room.' });
    }

    const body = (request.body || {}) as {
      title?: string;
      sourceUrl?: string;
      mediaTitle?: string;
      privacy?: 'PUBLIC' | 'INVITE_ONLY' | 'PRIVATE';
      activityMode?: 'CINEMA' | 'GAMING';
      roomCode?: string;
      slug?: string;
    };

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
      state: 'PAUSED' as const,
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
    const { slug } = request.params as { slug: string };
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
    const { slug } = request.params as { slug: string };
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
    const user = await request.jwtVerify() as { id: string };
    db.deleteUserData(user.id);
    return { success: true, message: 'All personal viewing and chat records permanently erased' };
  });

  // --- Helper to extract or provision User from request ---
  async function getRequestUser(request: any): Promise<User> {
    try {
      const decoded = await request.jwtVerify() as any;
      let user = db.getUserById(decoded.id);
      if (user) {
        if (!user.partnerCode) {
          user.partnerCode = db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email);
        }
        return user;
      }
      const partnerCode = db.ensureUserPartnerCode(decoded.id, decoded.displayName, decoded.avatarUrl, decoded.isAnonymous, decoded.email);
      user = db.getUserById(decoded.id);
      if (user) return user;
      return {
        id: decoded.id,
        displayName: decoded.displayName || 'Player',
        avatarUrl: decoded.avatarUrl,
        isAnonymous: Boolean(decoded.isAnonymous),
        partnerCode,
        createdAt: new Date().toISOString()
      };
    } catch {
      const body = (request.body || {}) as any;
      const query = (request.query || {}) as any;
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

  const isUserOnline = (userId: string): boolean => {
    return (
      presenceManager.isUserOnline(userId) ||
      gameRoomManager.isUserOnline(userId) ||
      syncManager.isUserOnline(userId).online
    );
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
    const body = (request.body || {}) as { partnerCode?: string; friendUserId?: string; userId?: string };
    let code = body.partnerCode;
    if (!code && (body.friendUserId || body.userId)) {
      const targetUser = db.getUserById(body.friendUserId || body.userId!);
      if (targetUser?.partnerCode) {
        code = targetUser.partnerCode;
      }
    }
    if (!code) {
      return reply.code(400).send({ error: 'Partner Code or Friend ID is required' });
    }
    try {
      const partner = db.connectPartner(user.id, code);
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
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to connect partner' });
    }
  });

  app.delete('/api/user/partner', async (request, reply) => {
    const user = await getRequestUser(request);
    db.disconnectPartner(user.id);
    return { success: true, message: 'Partner disconnected' };
  });

  // =====================================================================
  // Friends & Snapchat-Style Streaks Endpoints
  // =====================================================================

  app.get('/api/friends', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const friends = db.getFriendsWithStreaks(user.id, (id) => isUserOnline(id));
    const requests = db.getFriendRequests(user.id);
    return {
      friends,
      requests,
      pendingRequestsCount: requests.incoming.length,
      myFriendCode: user.partnerCode || db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email)
    };
  });

  app.get('/api/friends/requests', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const requests = db.getFriendRequests(user.id);
    return {
      success: true,
      ...requests
    };
  });

  app.get('/api/friends/discover', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const { search } = request.query as { search?: string };
    const users = db.getDiscoverableUsers(user.id, search);
    return {
      success: true,
      users
    };
  });

  app.post('/api/friends/add', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { friendCode?: string };
    if (!body.friendCode) {
      return reply.code(400).send({ error: 'Friend Code is required' });
    }
    try {
      const result = db.sendFriendRequest(user.id, body.friendCode);
      if (result.friend) {
        result.friend.friendUser.isOnline = isUserOnline(result.friend.friendUser.id);
      }
      return {
        success: true,
        status: result.status,
        friend: result.friend,
        message: result.message
      };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to send friend request' });
    }
  });

  app.post('/api/friends/requests/accept', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { senderUserId?: string };
    if (!body.senderUserId) {
      return reply.code(400).send({ error: 'senderUserId is required' });
    }
    try {
      const friend = db.acceptFriendRequest(user.id, body.senderUserId);
      friend.friendUser.isOnline = isUserOnline(friend.friendUser.id);
      return {
        success: true,
        friend,
        message: `Accepted request from ${friend.friendUser.displayName}`
      };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to accept friend request' });
    }
  });

  app.post('/api/friends/requests/decline', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { senderUserId?: string };
    if (!body.senderUserId) {
      return reply.code(400).send({ error: 'senderUserId is required' });
    }
    db.declineFriendRequest(user.id, body.senderUserId);
    return {
      success: true,
      message: 'Friend request declined'
    };
  });

  app.post('/api/friends/requests/cancel', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { targetUserId?: string };
    if (!body.targetUserId) {
      return reply.code(400).send({ error: 'targetUserId is required' });
    }
    db.cancelFriendRequest(user.id, body.targetUserId);
    return {
      success: true,
      message: 'Friend request cancelled'
    };
  });

  app.delete('/api/friends/:friendUserId', async (request, reply) => {
    const user = await getRequestUser(request);
    const { friendUserId } = request.params as { friendUserId: string };
    if (!friendUserId) {
      return reply.code(400).send({ error: 'friendUserId is required' });
    }
    db.removeFriend(user.id, friendUserId);
    return { success: true, message: 'Friend removed' };
  });

  // =====================================================================
  // Watch Direct Chat Endpoints
  // =====================================================================

  app.get('/api/chat/messages', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const { conversationId } = request.query as { conversationId?: string };
    if (!conversationId) {
      return reply.code(400).send({ error: 'conversationId is required' });
    }
    const messages = db.getDirectChatMessages(conversationId, user.id, 100);
    return { success: true, messages };
  });

  app.post('/api/chat/messages', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as any;
    if (!body.conversationId || !body.content) {
      return reply.code(400).send({ error: 'conversationId and content are required' });
    }

    let recipientId = body.recipientId;
    if (!recipientId && body.conversationId.startsWith('conv_')) {
      recipientId = body.conversationId.replace('conv_', '');
    }

    const isRecipientOnline = recipientId ? presenceManager.isUserOnline(recipientId) : false;
    const status = isRecipientOnline ? 'delivered' : 'sent';
    const messageId = body.id || `msg_${Date.now()}_${nanoid(6)}`;

    const msg = {
      id: messageId,
      conversationId: body.conversationId,
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

    db.saveDirectChatMessage(msg);

    // NOTE: Do NOT re-deliver to recipient here.
    // The WebSocket chat:send handler already delivers the message in real-time.
    // Delivering here too causes the recipient to receive the same message twice,
    // resulting in duplicate unread badges and double notifications.

    return { success: true, message: msg };
  });

  app.post('/api/chat/read', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { conversationId?: string; senderId?: string };
    if (!body.conversationId) {
      return reply.code(400).send({ error: 'conversationId is required' });
    }
    const updatedMessages = db.markDirectMessagesAsRead(body.conversationId, user.id);
    if (body.senderId) {
      presenceManager.sendToUser(body.senderId, {
        type: 'chat:status_update',
        conversationId: body.conversationId,
        status: 'read',
        messageIds: updatedMessages.map((m) => m.id)
      });
    }
    return { success: true, count: updatedMessages.length };
  });

  app.post('/api/chat/view-once-opened', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { messageId?: string; conversationId?: string };
    if (!body.messageId) {
      return reply.code(400).send({ error: 'messageId is required' });
    }
    const details = db.markDirectMessageViewOnceOpened(body.messageId);
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
    const body = (request.body || {}) as { friendUserId?: string; minutes?: number };
    if (!body.friendUserId) {
      return reply.code(400).send({ error: 'friendUserId is required' });
    }
    const result = db.recordSessionBetweenUsers(user.id, body.friendUserId, body.minutes || 1);
    return {
      success: true,
      status: result.status,
      streak: result.streak
    };
  });

  // =====================================================================
  // Human-Only Game Rooms & Matchmaking Endpoints
  // =====================================================================

  // Play with Partner / Friend (Deterministic Smart Pairing)
  app.post('/api/games/partner/play', async (request, reply) => {
    const user = await getRequestUser(request);
    const body = (request.body || {}) as {
      gameType?: string;
      targetUserId?: string;
      friendUserId?: string;
      partnerCode?: string;
    };
    const gameType: GameType = resolveGameType(body.gameType);

    let targetUser: any = null;
    const targetId = body.targetUserId || body.friendUserId;
    if (targetId) {
      targetUser = db.getUserById(targetId);
    } else if (body.partnerCode) {
      targetUser = db.getUserByPartnerCode(body.partnerCode);
    }

    let partnerUserId: string;

    if (targetUser && targetUser.id !== user.id) {
      partnerUserId = targetUser.id;
      // Also ensure connected in partner_connections so updated_at makes them primary
      try {
        if (targetUser.partnerCode) {
          db.connectPartner(user.id, targetUser.partnerCode);
        }
      } catch {}
    } else {
      const partner = db.getPartner(user.id);
      if (!partner) {
        return reply.code(400).send({ error: 'No partner or friend selected. Please choose a friend to play with.' });
      }
      partnerUserId = partner.partnerUserId;
    }

    const gameBasePath = getGameBasePath(gameType);

    // 1. Check if partner is ALREADY waiting in an open game room
    const partnerWaitingRoom = db.findUserWaitingGameRoom(partnerUserId);
    if (
      partnerWaitingRoom &&
      partnerWaitingRoom.gameType === gameType &&
      partnerWaitingRoom.status === 'WAITING' &&
      partnerWaitingRoom.players.length < partnerWaitingRoom.maxPlayers
    ) {
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
      presenceManager.sendToUser(partnerUserId, {
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
    presenceManager.sendToUser(partnerUserId, {
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
    const body = (request.body || {}) as { gameType?: string; maxPlayers?: number };
    const gameType: GameType = resolveGameType(body.gameType);
    const maxPlayers = gameType === 'ludo' ? ((Number(body.maxPlayers) || 2) as 2 | 3 | 4) : 2;
    const gameBasePath = getGameBasePath(gameType);

    try {
      // If user has a partner who is waiting in a matching room, pair them together!
      const partner = db.getPartner(user.id);
      if (partner) {
        const partnerRoom = db.findUserWaitingGameRoom(partner.partnerUserId);
        if (
          partnerRoom &&
          partnerRoom.gameType === gameType &&
          partnerRoom.maxPlayers === maxPlayers &&
          partnerRoom.players.length < partnerRoom.maxPlayers
        ) {
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
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to matchmake' });
    }
  });

  // Create temporary Game Room (with temporary Room Code)
  app.post('/api/games/rooms', async (request, reply) => {
    const user = await getRequestUser(request);
    const body = (request.body || {}) as {
      gameType?: string;
      maxPlayers?: number;
      isPrivate?: boolean;
      customCode?: string;
    };
    const gameType: GameType = resolveGameType(body.gameType);
    const maxPlayers = gameType === 'ludo' ? ((Number(body.maxPlayers) || 2) as 2 | 3 | 4) : 2;
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
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to create game room' });
    }
  });

  // Get Game Room details by temporary room code
  app.get('/api/games/rooms/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
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
    const { code } = request.params as { code: string };
    const user = await getRequestUser(request);
    try {
      const room = gameRoomManager.joinRoom(code, user);
      return {
        success: true,
        room,
        inviteUrl: `${getGameBasePath(room.gameType)}?room=${room.roomCode}`
      };
    } catch (err: any) {
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
    const body = (request.body || {}) as { roomCode: string; gameType?: string };
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
    const targetCode = (request.body as any)?.targetPartnerCode;
    let targetUserId = partner.partnerUserId;
    if (targetCode) {
      const explicitUser = db.getUserByPartnerCode(targetCode);
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
    const body = (request.body || {}) as {
      targetCode: string;
      fromCode?: string;
      fromName?: string;
      roomCode?: string;
      gameType?: string;
    };

    if (!body.targetCode) {
      return reply.code(400).send({ error: 'Target partner code is required' });
    }

    const targetUser = db.getUserByPartnerCode(body.targetCode.toUpperCase());
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
      customMessage: (body as any).customMessage,
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

  // Dedicated Live Nudge & Roast Endpoint
  app.post('/api/notifications/nudge', async (request, reply) => {
    const user = await getRequestUser(request);
    const body = (request.body || {}) as {
      targetPartnerCode: string;
      message?: string;
      category?: string;
      link?: string;
    };

    if (!body.targetPartnerCode) {
      return reply.code(400).send({ error: 'Target partner code is required' });
    }

    const targetUser = db.getUserByPartnerCode(body.targetPartnerCode.toUpperCase());
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
    const { code } = request.params as { code: string };
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

  // --- Plans Endpoints ---
  app.get('/api/plans', async (request, reply) => {
    const plans = db.getPlans();
    return { plans };
  });

  app.post('/api/plans', async (request, reply) => {
    let user: any = null;
    try {
      user = await request.jwtVerify();
    } catch {}

    const body = (request.body || {}) as any;
    if (!body.title) {
      return reply.code(400).send({ error: 'Title is required' });
    }

    const planId = body.id || `plan-${Date.now()}`;
    const plan = db.createPlan({
      ...body,
      id: planId,
      hostId: user?.id || body.hostId || 'u1'
    });

    return { success: true, plan };
  });

  app.get('/api/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = db.getPlanById(id);
    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }
    return { plan };
  });

  app.put('/api/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = (request.body || {}) as any;
    const plan = db.updatePlan(id, updates);
    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }
    return { success: true, plan };
  });

  app.post('/api/plans/:id/rsvp', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      userId: string;
      displayName?: string;
      avatarUrl?: string;
      status: string;
    };
    const plan = db.getPlanById(id);
    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }

    const participants = [...(plan.participants || [])];
    const idx = participants.findIndex((p: any) => p.userId === body.userId);
    if (idx >= 0) {
      participants[idx] = {
        ...participants[idx],
        status: body.status,
        displayName: body.displayName || participants[idx].displayName,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : participants[idx].avatarUrl
      };
    } else {
      participants.push({
        userId: body.userId,
        displayName: body.displayName || 'Friend',
        avatarUrl: body.avatarUrl,
        status: body.status,
        isHost: false
      });
    }

    const updated = db.updatePlan(id, { participants });
    return { success: true, plan: updated };
  });

  app.post('/api/plans/:id/vote', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { optionId, userId } = (request.body || {}) as { optionId: string; userId: string };
    const plan = db.getPlanById(id);
    if (!plan || !plan.voting) {
      return reply.code(404).send({ error: 'Plan or voting not found' });
    }

    const options = plan.voting.options.map((opt: any) => {
      const votes = opt.votes || [];
      if (opt.id === optionId) {
        if (!votes.includes(userId)) {
          return { ...opt, votes: [...votes, userId] };
        }
        return opt;
      } else {
        return { ...opt, votes: votes.filter((v: string) => v !== userId) };
      }
    });

    const updated = db.updatePlan(id, {
      voting: { ...plan.voting, options }
    });
    return { success: true, plan: updated };
  });

  app.post('/api/plans/:id/chat', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const plan = db.getPlanById(id);
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
    const updated = db.updatePlan(id, { chatMessages });
    return { success: true, message: newMsg, plan: updated };
  });

  app.delete('/api/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = db.getPlanById(id);
    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }
    const deleted = db.deletePlan(id);
    return { success: deleted, id };
  });

  // --- Real-Time WebSocket Endpoint ---
  app.get('/ws/rooms/:slug', { websocket: true }, (connection: any, req) => {
    const ws: any = connection.socket || connection;
    const { slug } = req.params as { slug: string };
    const room = syncManager.getRoom(slug);

    if (!room) {
      ws.send(
        JSON.stringify({
          type: 'error:notification',
          payload: { code: 'ROOM_NOT_FOUND', message: 'Room does not exist' }
        })
      );
      ws.close();
      return;
    }

    // Extract auth from query params: ?token=... or ?guestName=...&guestId=...
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const guestName = url.searchParams.get('guestName');
    const guestIdParam = url.searchParams.get('guestId');

    let user: { id: string; displayName: string; avatarUrl?: string | null };

    if (token) {
      try {
        const decoded = app.jwt.verify(token) as any;
        user = {
          id: decoded.id,
          displayName: decoded.displayName,
          avatarUrl: decoded.avatarUrl
        };
      } catch {
        const guestId = guestIdParam || `guest_${nanoid(8)}`;
        user = {
          id: guestId,
          displayName: guestName || `Guest_${nanoid(4)}`,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`
        };
      }
    } else {
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
  app.get('/ws/games/:code', { websocket: true }, (connection: any, req) => {
    const ws: any = connection.socket || connection;
    const { code } = req.params as { code: string };
    const room = gameRoomManager.getRoomByCode(code.toUpperCase());

    if (!room) {
      ws.send(
        JSON.stringify({
          type: 'error:notification',
          payload: { code: 'GAME_ROOM_NOT_FOUND', message: 'Game room does not exist' }
        })
      );
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const guestName = url.searchParams.get('guestName');
    const guestIdParam = url.searchParams.get('guestId');

    let user: { id: string; displayName: string; avatarUrl?: string | null };

    if (token) {
      try {
        const decoded = app.jwt.verify(token) as any;
        user = {
          id: decoded.id,
          displayName: decoded.displayName || 'Player',
          avatarUrl: decoded.avatarUrl
        };
        db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl || undefined, Boolean(decoded.isAnonymous), decoded.email);
      } catch {
        const guestId = guestIdParam || `guest_${nanoid(8)}`;
        user = {
          id: guestId,
          displayName: guestName || `Guest_${nanoid(4)}`,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`
        };
        db.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, true);
      }
    } else {
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
  app.get('/ws/presence', { websocket: true }, (connection: any, req) => {
    const ws: any = connection.socket || connection;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const guestName = url.searchParams.get('guestName');
    const guestIdParam = url.searchParams.get('guestId');

    let user: { id: string; displayName: string; partnerCode?: string; avatarUrl?: string | null };

    if (token) {
      try {
        const decoded = app.jwt.verify(token) as any;
        user = {
          id: decoded.id,
          displayName: decoded.displayName,
          partnerCode: decoded.partnerCode,
          avatarUrl: decoded.avatarUrl
        };
      } catch {
        const guestId = guestIdParam || `guest_${nanoid(8)}`;
        user = {
          id: guestId,
          displayName: guestName || `Guest_${nanoid(4)}`
        };
      }
    } else {
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
const isMainModule =
  process.argv[1] === new URL(import.meta.url).pathname ||
  process.argv[1]?.endsWith('/index.js') ||
  process.argv[1]?.endsWith('/index.ts') ||
  Boolean(process.env.pm_id);

if (isMainModule) {
  const { app } = await createServer();
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🎬 SyncCinema Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
