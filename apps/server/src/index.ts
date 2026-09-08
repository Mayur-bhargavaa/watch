import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { DatabaseService } from './db/database.js';
import { RoomSyncManager } from './sync/RoomSyncManager.js';
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
    const body = request.body as { email?: string; password?: string; displayName?: string };
    if (!body.email || !body.displayName) {
      return reply.code(400).send({ error: 'Email and display name required' });
    }

    const existing = db.getUserByEmail(body.email);
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const userId = `usr_${nanoid(10)}`;
    const user = db.createUser(
      {
        id: userId,
        email: body.email,
        displayName: body.displayName,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        isAnonymous: false,
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
    };

    const roomId = `room_${nanoid(12)}`;
    const slug = nanoid(8).toLowerCase();
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

  return { app, db, syncManager };
}

// Direct execution entrypoint
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { app } = await createServer();
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🎬 SyncCinema Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
