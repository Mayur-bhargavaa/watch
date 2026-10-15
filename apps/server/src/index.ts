import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { DatabaseService, extractParticipantIdsFromConvId, toCanonicalConvId } from './db/database.js';
import { mongoDb } from './db/mongoDatabase.js';
import { RoomSyncManager } from './sync/RoomSyncManager.js';
import { GameRoomManager } from './games/GameRoomManager.js';
import { GAME_DEFINITIONS, parseGameType } from './games/GameDefinitions.js';
import { PresenceManager } from './services/PresenceManager.js';
import { detectProviderFromUrl, User, GameType, ActiveDeviceSession } from '@synccinema/common';
import { mongoLogger } from './services/mongoLogger.js';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mailer } from './services/mailer.js';
import rateLimit from '@fastify/rate-limit';
import { sanitizeSvg, safeUrl, previewMessageText, isPlanPast, formatPlanDate, nextOccurrenceDate } from '@synccinema/common';
import { hashPassword, verifyPassword, dummyVerify, validatePassword, isHashed } from './util/password.js';
import { KeyedLimiter } from './util/rateLimit.js';
import { str, plainText, isEmail, safeAvatar, ROOM_CODE_RE } from './util/validate.js';
import { prepareDirectMessage } from './services/directMessage.js';
import { pushService, parseSubscription, MAX_SUBSCRIPTIONS_PER_USER, type PushPayload } from './services/pushService.js';
import { publicMessage } from './util/safeError.js';
import { createPlanSchema, updatePlanSchema, firstIssue, planSchedule, presentPlan, presentPlanPreview, isParticipant, RSVP_STATUSES, MAX_PARTICIPANTS, MAX_VOTE_OPTIONS } from './services/plans.js';
import { z } from 'zod';
import { TIER_INFO, tierAtLeast, BILLING_CURRENCIES, isPremiumAvatarUrl, type MembershipTier } from '@synccinema/common';
import * as billing from './services/billing.js';
import { COMING_SOON_GAMES, isComingSoonGame } from './games/comingSoon.js';
import { runGameLaunchJob } from './services/gameLaunch.js';

function resolveGameType(raw?: string): GameType {
  // Exact ids / explicit aliases only (GR-32). A room-code prefix ("TIC-AB12CD34") is accepted too. Empty input means Ludo;
  // anything else is rejected instead of silently becoming Ludo.
  const text = (raw || '').trim();
  if (!text) return 'ludo';
  const exact = parseGameType(text);
  if (exact) return exact as GameType;
  const PREFIXES: Record<string, GameType> = {
    ludo: 'ludo', four: 'four-in-a-row', tic: 'tic-tac-toe', tambola: 'tambola', bingo: 'bingo', doodle: 'doodle-duel', chess: 'chess', imposter: 'imposter', emoji: 'emoji-charades', mafia: 'mafia-night', quiz: 'quiz-show', murder: 'murder-mystery', arena: 'tournament', tournament: 'tournament'
  };
  const prefixed = PREFIXES[text.toLowerCase().split(/[-_]/)[0]];
  if (prefixed) return prefixed;
  const err: any = new Error('Unsupported game type');
  err.statusCode = 400;
  throw err;
}

function getGameBasePath(gameType: string): string {
  if (gameType === 'doodle-duel') return '/games/doodle-duel';
  if (gameType === 'bingo') return '/games/bingo';
  if (gameType === 'tambola') return '/games/tambola';
  if (gameType === 'tic-tac-toe') return '/games/tic-tac-toe';
  if (gameType === 'four-in-a-row') return '/games/four-in-a-row';
  if (gameType === 'chess') return '/games/chess';
  if (gameType === 'imposter') return '/games/imposter';
  if (gameType === 'mafia-night') return '/games/mafia';
  if (gameType === 'emoji-charades') return '/games/emoji-charades';
  if (gameType === 'quiz-show') return '/games/quiz-show';
  if (gameType === 'murder-mystery') return '/games/murder-mystery';
  if (gameType === 'tournament') return '/games/tournament';
  return '/games/ludo';
}

const JWT_SECRET: string = process.env.JWT_SECRET ?? '';
if (JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET must be set to a random string of at least 16 characters. Refusing to start without it.');
}
const SESSION_MAX_AGE_SEC = Number(process.env.SESSION_MAX_AGE_SEC) > 0 ? Number(process.env.SESSION_MAX_AGE_SEC) : 30 * 24 * 60 * 60;
const SESSION_COOKIE = 'sc_session';
/** What browser clients store instead of the real JWT (the real one lives only in the httpOnly cookie). */
const SESSION_PLACEHOLDER = 'cookie-session';
const COOKIE_SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : process.env.NODE_ENV === 'production';
const COOKIE_SAMESITE = (['lax', 'strict', 'none'].includes(String(process.env.COOKIE_SAMESITE)) ? process.env.COOKIE_SAMESITE : 'lax') as 'lax' | 'strict' | 'none';
const WEB_BASE_URL = (process.env.WEB_BASE_URL || DEFAULT_WEB_URL()).replace(/\/$/, '');
function DEFAULT_WEB_URL() { return (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',')[0].trim(); }
const RESET_TOKEN_TTL_MS = 30 * 60_000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60_000;
const WS_TICKET_TTL_MS = 30_000;
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3005'];
const CORS_ORIGINS = (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : DEFAULT_CORS_ORIGINS).map((o) => o.trim()).filter(Boolean);
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD) {
  // Fail at deploy time instead of running with development defaults
  if (!process.env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS must be set in production (comma separated list of your web origins).');
  }
  if (CORS_ORIGINS.some((o) => !o.startsWith('https://'))) {
    throw new Error('Every CORS_ORIGINS entry must be an https:// origin in production.');
  }
}
const envInt = (name: string, dflt: number) => (Number.isFinite(Number(process.env[name])) && process.env[name] ? Number(process.env[name]) : dflt);
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

export async function createServer(dbPath = './synccinema.db') {
  // Behind nginx / a load balancer every request comes from the proxy's address, so rate limits would be shared by
  // ALL users. TRUST_PROXY = "true" | number of proxy hops | comma separated proxy IPs/CIDRs.
  const rawTrust = (process.env.TRUST_PROXY || '').trim();
  const trustProxy: boolean | number | string[] =
    rawTrust === 'true' ? true : /^\d+$/.test(rawTrust) ? Number(rawTrust) : rawTrust ? rawTrust.split(',').map((x) => x.trim()) : false;
  if (IS_PROD && !trustProxy) {
    console.warn('⚠️  TRUST_PROXY is not set: if this server runs behind nginx/Cloudflare, all users share one rate-limit bucket.');
  }

  const app = fastify({
    trustProxy: trustProxy as any, // fastify accepts a hop count at runtime, its typings just omit it
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  });

  billing.assertBillingConfig(); // fail fast: mock refused in production, live needs its provider secrets

  if (IS_PROD && !mailer.isConfigured()) {
    throw new Error('Mail is not configured: set SMTP_HOST/SMTP_USER/SMTP_PASS (or SMTP_URL). Signup and password reset need it.');
  }
  try {
    await mailer.verify();
  } catch (err: any) {
    if (IS_PROD) throw new Error(`SMTP login failed: ${err?.message || err}`);
    console.warn('[mail] SMTP verification failed:', err?.message || err);
  }

  try {
    await mongoDb.connect();
  } catch (err) {
    console.error('MongoDB connection notice:', err);
  }

  const db = new DatabaseService(dbPath);
  const syncManager = new RoomSyncManager(db);
  const gameRoomManager = new GameRoomManager(db);
  const presenceManager = new PresenceManager(mongoDb, db);

  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });

  await app.register(cors, {
    // Only the configured web origins may make credentialed cross-origin calls (non-browser clients send no Origin).
    origin: (origin, cb) => cb(null, !origin || CORS_ORIGINS.includes(origin)),
    credentials: true
  });

  await app.register(rateLimit, {
    global: true,
    max: envInt('RATE_LIMIT_GLOBAL_MAX', 600),
    timeWindow: '1 minute'
  });

  await app.register(cookie);
  await app.register(fastifyJwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: SESSION_MAX_AGE_SEC },
    // Browser sessions authenticate with an httpOnly cookie; API clients may still send `Authorization: Bearer`
    cookie: { cookieName: SESSION_COOKIE, signed: false }
  });

  await app.register(fastifyWebsocket, {
    options: { maxPayload: 524288 } // 512KB (SocketGuard enforces the same cap)
  });

  // Never leak internals on 5xx
  app.setErrorHandler((err: any, request, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) request.log.error(err);
    reply.code(status).send({ error: status >= 500 ? 'Internal server error' : publicMessage(err, 'Request failed') });
  });

  // --- CSRF: a request that authenticates with the session cookie (no Authorization header) and changes state
  //     must come from an allowed origin, or (no Origin header) carry the custom X-Session-Mode header that a
  //     cross-site page cannot add without passing our CORS preflight. SameSite=Lax already blocks most cases.
  app.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    if (!request.url.startsWith('/api/') || request.headers.authorization) return;
    if (!(request.cookies && request.cookies[SESSION_COOKIE])) return;
    const origin = request.headers.origin;
    // With SameSite=None the browser attaches the cookie cross-site, so the Origin check is mandatory (no header fallback)
    const ok = origin ? CORS_ORIGINS.includes(origin) : COOKIE_SAMESITE !== 'none' && request.headers['x-session-mode'] === 'cookie';
    if (!ok) return reply.code(403).send({ error: 'Cross-site request blocked' });
  });

  // --- Global auth gate: every /api route needs a valid, non-anonymous JWT unless listed here ---
  const PUBLIC_ROUTES = new Set([
    'GET /api/health',
    'GET /api/billing/catalog',
    'POST /api/billing/webhooks/razorpay',
    'POST /api/billing/webhooks/stripe',
    'POST /api/auth/guest',
    'POST /api/auth/login',
    'POST /api/auth/register',
    'POST /api/auth/verify-email',
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'POST /api/auth/logout'
  ]);
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (!path.startsWith('/api/') || request.method === 'OPTIONS') return;
    if (PUBLIC_ROUTES.has(`${request.method} ${path}`)) return;
    try {
      const decoded = (await request.jwtVerify()) as any;
      if (!decoded || decoded.isAnonymous) throw new Error('anonymous');
    } catch {
      return reply.code(401).send({ error: 'Authentication required' });
    }
  });

  const loginLimiter = new KeyedLimiter(envInt('RATE_LIMIT_LOGIN_MAX', 10), 15 * 60_000);
  const authIpLimiter = new KeyedLimiter(envInt('RATE_LIMIT_AUTH_IP_MAX', 60), 15 * 60_000);
  const registerLimiter = new KeyedLimiter(envInt('RATE_LIMIT_REGISTER_MAX', 20), 60 * 60_000);
  const joinLimiter = new KeyedLimiter(envInt('RATE_LIMIT_JOIN_MAX', 30), 60_000);
  const resetEmailLimiter = new KeyedLimiter(envInt('RATE_LIMIT_RESET_EMAIL_MAX', 3), 60 * 60_000);
  // GR-22: pings / invites / nudges / partner-play are push-triggering: throttle per sender and per sender->target
  const partnerActionLimiter = new KeyedLimiter(envInt('RATE_LIMIT_PARTNER_ACTION_MAX', 30), 60_000);
  const partnerTargetLimiter = new KeyedLimiter(envInt('RATE_LIMIT_PARTNER_TARGET_MAX', 8), 60_000);
  const wsCreateLimiter = new KeyedLimiter(envInt('RATE_LIMIT_WS_CREATE_MAX', 10), 60_000);
  const discoverLimiter = new KeyedLimiter(envInt('RATE_LIMIT_DISCOVER_MAX', 30), 60_000);
  const tooMany = (reply: any) => reply.code(429).send({ error: 'Too many attempts. Please try again later.' });

  // --- Session cookie helpers -------------------------------------------------------------------
  const wantsCookie = (request: any) => request.headers['x-session-mode'] === 'cookie';
  const setSessionCookie = (reply: any, token: string) =>
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === 'none',
      sameSite: COOKIE_SAMESITE,
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC
    });
  /** Browser clients (X-Session-Mode: cookie) never receive the JWT in a response body; API clients still do. */
  const sessionResponse = (request: any, reply: any, token: string, user: any, extra: Record<string, unknown> = {}) => {
    if (wantsCookie(request)) {
      setSessionCookie(reply, token);
      return { token: SESSION_PLACEHOLDER, user, ...extra };
    }
    return { token, user, ...extra };
  };

  // --- One-time WebSocket tickets (so no JWT ever appears in a URL) -------------------------------
  const wsTickets = new Map<string, { user: { id: string; displayName: string; avatarUrl?: string | null }; exp: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of wsTickets) if (v.exp < now) wsTickets.delete(k);
  }, 60_000).unref();
  const consumeWsTicket = (ticket: string | null) => {
    if (!ticket) return null;
    const entry = wsTickets.get(ticket);
    wsTickets.delete(ticket); // single use
    return entry && entry.exp > Date.now() ? entry.user : null;
  };

  // --- Live delivery with Web Push fallback ---------------------------------------------------------------
  // A user may have a presence socket, a game socket and a cinema-room socket open at the same time. Events must be
  // delivered ONCE: presence first, the others only if the user has no presence socket (they used to get all three).
  await pushService.configure(mongoDb);
  const deliverLive = (userId: string, message: any): boolean =>
    presenceManager.sendToUser(userId, message) || gameRoomManager.sendToUser(userId, message) || syncManager.sendToUser(userId, message);
  /** OS-level notification for people with no open tab (only for users who subscribed to Web Push). */
  const pushOffline = (userId: string, payload: PushPayload) => {
    void pushService.notifyUser(mongoDb, userId, payload).catch((err) => console.warn('[push] failed:', err?.message || err));
  };
  presenceManager.setOfflineNotifier(pushOffline);
  // Tournament Arena: "Your match is ready" reaches a player who is not on a game page (an in-app notification, or a push banner when offline)
  gameRoomManager.setTournamentNotifier((userId, notice) => {
    const link = `${getGameBasePath(notice.gameType)}?room=${encodeURIComponent(notice.roomCode)}`;
    const delivered = deliverLive(userId, { type: 'game:launched', payload: { id: notice.id, title: notice.title, body: notice.body, link } });
    if (!delivered) pushOffline(userId, { title: notice.title, body: notice.body, tag: notice.id, url: link, requireInteraction: true });
  });
  // a server restart resumes the running tournaments: timers re-armed, match rooms that finished meanwhile are settled
  gameRoomManager.resumeTournaments();
  /** Game invite: live if connected, otherwise a push banner. Returns whether it was delivered live. */
  const sendInvite = (targetUserId: string, invitePayload: any): boolean => {
    // GR-22: never spam one target with invites (play-button mashing)
    if (partnerTargetLimiter.hit(`sendinv:${invitePayload.fromUserId}:${targetUserId}`)) return false;
    const live = deliverLive(targetUserId, { type: 'partner:game_invite', payload: invitePayload });
    if (!live) {
      pushOffline(targetUserId, {
        title: `${invitePayload.fromDisplayName} invited you to play`,
        body: `Room ${invitePayload.roomCode}. Tap to join.`,
        tag: `invite:${invitePayload.id}`,
        url: `${getGameBasePath(invitePayload.gameType)}?room=${encodeURIComponent(invitePayload.roomCode)}`,
        requireInteraction: true
      });
    }
    return live;
  };

  // --- Password-reset mail ---------------------------------------------------------------------
  const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
  const sendPasswordResetEmail = async (user: { id: string; email?: string | null; displayName: string }) => {
    if (!user.email) return;
    const token = randomBytes(32).toString('base64url');
    await mongoDb.savePasswordReset(sha256(token), user.id, Date.now() + RESET_TOKEN_TTL_MS);
    const link = `${WEB_BASE_URL}/login?reset=${token}`;
    await mailer.send({
      to: user.email,
      subject: 'Reset your Watch password',
      text: `Hi ${user.displayName},\n\nUse this link to choose a new password (valid for 30 minutes, works once):\n${link}\n\nIf you did not ask for this, you can ignore this email; your password has not changed.`
    });
  };

  // Cinema rooms/chat/games live in SQLite (FK to users) while accounts live in MongoDB. This keeps the SQLite copy
  // in step: it creates the user on first use AND refreshes name/avatar when they change in Mongo. Failures are
  // logged (never silently swallowed) because a missing mirror row makes room creation fail later with a FK error.
  const mirrorUserToSqlite = (u: { id: string; email?: string | null; displayName?: string; avatarUrl?: string | null }) => {
    try {
      const existing = db.getUserById(u.id);
      if (!existing) {
        db.createUser({
          id: u.id,
          email: u.email || undefined,
          displayName: u.displayName || 'User',
          avatarUrl: u.avatarUrl || undefined,
          isAnonymous: false,
          createdAt: new Date().toISOString()
        });
      } else if ((u.displayName && existing.displayName !== u.displayName) || (u.avatarUrl && existing.avatarUrl !== u.avatarUrl)) {
        db.updateUser(u.id, { displayName: u.displayName, avatarUrl: u.avatarUrl || undefined });
      }
    } catch (err) {
      console.warn(`[sync] could not mirror user ${u.id} into SQLite:`, (err as any)?.message || err);
    }
  };
  const ensureSqliteUser = mirrorUserToSqlite;
  const mirrorDevice = (userId: string, session: ActiveDeviceSession) => {
    try {
      db.updateUserActiveDevice(userId, session);
    } catch (err) {
      console.warn(`[sync] could not mirror active device for ${userId} into SQLite:`, (err as any)?.message || err);
    }
  };

  // --- Health Check ---
  // Liveness + readiness: a load balancer should stop sending traffic when MongoDB is unreachable (the answer is 503, not 200)
  app.get('/api/health', async (_request, reply) => {
    let database: 'ok' | 'down' = 'ok';
    try {
      await Promise.race([
        mongoDb.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000).unref())
      ]);
    } catch {
      database = 'down';
    }
    if (database === 'down') reply.code(503);
    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'synccinema-server',
      database,
      timestamp: Date.now()
    };
  });

  // --- Auth Routes ---
  app.post('/api/auth/guest', async (request, reply) => {
    return reply.code(403).send({ error: 'Guest access is disabled. Please sign in or create an account to access Watch.' });
  });

  const issueToken = (user: { id: string; email?: string | null; displayName: string }) =>
    app.jwt.sign({ id: user.id, email: user.email, displayName: user.displayName, isAnonymous: false });

  app.post('/api/auth/login', async (request, reply) => {
    const body = (request.body || {}) as {
      email?: unknown;
      password?: unknown;
      deviceInfo?: {
        deviceId?: string;
        deviceType?: 'mobile' | 'desktop' | 'tablet';
        deviceToken?: string;
        browserName?: string;
      };
    };
    if (!isEmail(body.email)) {
      return reply.code(400).send({ error: 'A valid email is required' });
    }
    const normalized = body.email.trim().toLowerCase();
    if (authIpLimiter.hit(`ip:${request.ip}`) || loginLimiter.hit(`${request.ip}:${normalized}`) || loginLimiter.hit(`acct:${normalized}`)) {
      return tooMany(reply);
    }

    const existing = await mongoDb.getUserByEmail(normalized);
    // One identical answer for: unknown email, wrong password, and account without a password yet.
    const invalid = () =>
      reply.code(401).send({
        error: 'Incorrect email or password. If you have not set a password yet, use "Forgot password" and we will email you a link.'
      });
    const password = typeof body.password === 'string' ? body.password : '';

    if (!existing) {
      await dummyVerify(password);
      return invalid();
    }

    if (!existing.passwordHash) {
      // Legacy/passwordless account: prove mailbox ownership by emailing a one-time link (never reveal this here).
      await dummyVerify(password);
      if (!resetEmailLimiter.hit(`reset:${normalized}`)) {
        void sendPasswordResetEmail({ ...existing.user, email: normalized }).catch((e) => request.log.error(e));
      }
      return invalid();
    }

    const check = await verifyPassword(password, existing.passwordHash);
    if (!check.ok) return invalid();
    if (check.needsRehash) {
      // Upgrade legacy plaintext rows to scrypt on successful login
      await mongoDb.setPassword(normalized, await hashPassword(password));
    }
    loginLimiter.reset(`${request.ip}:${normalized}`);

    const user = existing.user;
    if (body.deviceInfo && (body.deviceInfo.deviceId || body.deviceInfo.deviceType)) {
      const activeSession: ActiveDeviceSession = {
        deviceId: str(body.deviceInfo.deviceId, 100) || `device_${Date.now()}`,
        deviceType: (['mobile', 'desktop', 'tablet'] as const).includes(body.deviceInfo.deviceType as any) ? body.deviceInfo.deviceType! : 'desktop',
        deviceToken: str(body.deviceInfo.deviceToken, 4096),
        browserName: str(body.deviceInfo.browserName, 100),
        lastActiveAt: Date.now()
      };
      await mongoDb.updateUserActiveDevice(user.id, activeSession);
      mirrorDevice(user.id, activeSession);
      await presenceManager.setActiveDevice(user.id, activeSession);
      user.activeDevice = activeSession;
    }

    mirrorUserToSqlite(user);
    const token = issueToken(user);
    await mongoLogger.logAuthLogin(user.id, user.email || '', user.displayName);

    return sessionResponse(request, reply, token, user);
  });

  // Change password while signed in (needs the current password when the account has one).
  app.post('/api/auth/set-password', async (request, reply) => {
    const caller = (await request.jwtVerify()) as any;
    if (authIpLimiter.hit(`sp:${request.ip}`)) return tooMany(reply);
    const body = (request.body || {}) as { newPassword?: unknown; currentPassword?: unknown };
    const policyError = validatePassword(body.newPassword);
    if (policyError) {
      return reply.code(400).send({ error: policyError });
    }
    const email = typeof caller.email === 'string' ? caller.email.trim().toLowerCase() : '';
    const existing = email ? await mongoDb.getUserByEmail(email) : null;
    if (!existing || existing.user.id !== caller.id) {
      return reply.code(404).send({ error: 'Account not found' });
    }
    if (existing.passwordHash) {
      const check = await verifyPassword(typeof body.currentPassword === 'string' ? body.currentPassword : '', existing.passwordHash);
      if (!check.ok) {
        return reply.code(403).send({ error: 'Current password is incorrect.' });
      }
    }
    await mongoDb.setPasswordById(existing.user.id, await hashPassword(body.newPassword as string));
    const token = issueToken(existing.user);
    return sessionResponse(request, reply, token, existing.user, { message: 'Password updated successfully!' });
  });

  // Forgot password: always the same answer; the mail is sent in the background so timing doesn't leak either.
  app.post('/api/auth/forgot-password', async (request, reply) => {
    if (authIpLimiter.hit(`fp:${request.ip}`)) return tooMany(reply);
    const body = (request.body || {}) as { email?: unknown };
    if (!isEmail(body.email)) {
      return reply.code(400).send({ error: 'A valid email is required' });
    }
    const normalized = body.email.trim().toLowerCase();
    if (!resetEmailLimiter.hit(`reset:${normalized}`)) {
      void (async () => {
        const existing = await mongoDb.getUserByEmail(normalized);
        if (existing) {
          await sendPasswordResetEmail({ ...existing.user, email: normalized });
        } else if (!IS_PROD) {
          console.log(`\x1b[33m⚠️  [mail] reset requested for ${normalized} but no account has that email (the client is not told)\x1b[0m`);
        }
      })().catch((e) => request.log.error(e));
    } else {
      console.log(`\x1b[33m⚠️  [mail] reset email for ${normalized} SKIPPED: limit of ${envInt('RATE_LIMIT_RESET_EMAIL_MAX', 3)} per hour reached (restart the server or wait an hour)\x1b[0m`);
    }
    return { success: true, message: 'If an account exists for that email, a reset link is on its way.' };
  });

  // Reset password with the emailed single-use token (this is also how legacy password-less accounts get a password).
  app.post('/api/auth/reset-password', async (request, reply) => {
    if (authIpLimiter.hit(`rp:${request.ip}`)) return tooMany(reply);
    const body = (request.body || {}) as { token?: unknown; newPassword?: unknown };
    const policyError = validatePassword(body.newPassword);
    if (policyError) {
      return reply.code(400).send({ error: policyError });
    }
    if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 200) {
      return reply.code(400).send({ error: 'This reset link is invalid or has expired.' });
    }
    const userId = await mongoDb.consumePasswordReset(sha256(body.token));
    if (!userId) {
      return reply.code(400).send({ error: 'This reset link is invalid or has expired.' });
    }
    await mongoDb.setPasswordById(userId, await hashPassword(body.newPassword as string));
    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return reply.code(400).send({ error: 'This reset link is invalid or has expired.' });
    }
    if (user.email) loginLimiter.reset(`acct:${user.email.toLowerCase()}`);
    await mongoLogger.logAuthLogin(user.id, user.email || '', user.displayName);
    return sessionResponse(request, reply, issueToken(user), user, { message: 'Password updated successfully!' });
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: COOKIE_SECURE || COOKIE_SAMESITE === 'none', sameSite: COOKIE_SAMESITE });
    return { success: true };
  });

  // Exchange a legacy `Authorization: Bearer` token (old localStorage sessions) for the httpOnly cookie.
  app.post('/api/auth/session', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(400).send({ error: 'Send the existing token as a Bearer header' });
    }
    const decoded = (await request.jwtVerify()) as any;
    const user = await mongoDb.getUserById(decoded.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return sessionResponse(request, reply, auth.slice(7), user);
  });

  // Short-lived single-use ticket used instead of a JWT in WebSocket URLs.
  app.post('/api/auth/ws-ticket', async (request) => {
    const u = request.user as any;
    const ticket = randomBytes(24).toString('base64url');
    wsTickets.set(ticket, { user: { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }, exp: Date.now() + WS_TICKET_TTL_MS });
    return { ticket, expiresInMs: WS_TICKET_TTL_MS };
  });

  // Signup is verify-first: this endpoint ALWAYS answers the same way, whether or not the email is already
  // registered, so it cannot be used to discover who has an account. The account is only created when the
  // mailbox owner opens the emailed link (POST /api/auth/verify-email).
  app.post('/api/auth/register', async (request, reply) => {
    if (registerLimiter.hit(`reg:${request.ip}`)) return tooMany(reply);
    const body = (request.body || {}) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
      avatarUrl?: unknown;
      dateOfBirth?: unknown;
      anniversaryDate?: unknown;
      isMarried?: unknown;
      age?: unknown;
    };
    const displayName = plainText(body.displayName, 50);
    if (!isEmail(body.email) || !displayName) {
      return reply.code(400).send({ error: 'A valid email and a display name are required' });
    }
    const policyError = validatePassword(body.password);
    if (policyError) {
      return reply.code(400).send({ error: policyError });
    }

    const normalized = body.email.trim().toLowerCase();
    // Hash first so both branches spend the same CPU time
    const passwordHash = await hashPassword(body.password as string);
    const response = { pending: true, message: 'Check your email: we sent a link to finish creating your account.' };
    if (resetEmailLimiter.hit(`signup:${normalized}`)) return response; // silent per-address throttle

    const dateOfBirth = str(body.dateOfBirth, 40);
    let calculatedAge = typeof body.age === 'number' && body.age >= 0 && body.age <= 120 ? Math.floor(body.age) : undefined;
    if (calculatedAge == null && dateOfBirth) {
      const birth = new Date(dateOfBirth);
      if (!isNaN(birth.getTime())) {
        calculatedAge = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }
    }
    const pending = {
      email: normalized,
      displayName,
      passwordHash,
      avatarUrl: safeAvatar(body.avatarUrl) || null,
      dateOfBirth,
      anniversaryDate: body.isMarried ? str(body.anniversaryDate, 40) : undefined,
      isMarried: Boolean(body.isMarried),
      age: calculatedAge
    };

    void (async () => {
      const existing = await mongoDb.getUserByEmail(normalized);
      if (existing) {
        await mailer.send({
          to: normalized,
          subject: 'Someone tried to create a Watch account with your email',
          text: `Hi ${existing.user.displayName},\n\nSomeone (hopefully you) tried to sign up with this email address, but you already have an account.\n\nSign in at ${WEB_BASE_URL}/login. If you forgot your password, use "Forgot password" on that page.\n\nIf this was not you, you can ignore this email.`
        });
        return;
      }
      const token = randomBytes(32).toString('base64url');
      await mongoDb.savePendingRegistration(sha256(token), pending, Date.now() + VERIFY_TOKEN_TTL_MS);
      await mailer.send({
        to: normalized,
        subject: 'Confirm your email to finish creating your Watch account',
        text: `Hi ${displayName},\n\nConfirm your email to finish creating your account (the link works once and expires in 24 hours):\n${WEB_BASE_URL}/login?verify=${token}\n\nIf you did not sign up, you can ignore this email.`
      });
    })().catch((e) => request.log.error(e));

    return response;
  });

  app.post('/api/auth/verify-email', async (request, reply) => {
    if (authIpLimiter.hit(`ve:${request.ip}`)) return tooMany(reply);
    const body = (request.body || {}) as { token?: unknown };
    const invalid = () => reply.code(400).send({ error: 'This confirmation link is invalid or has expired. Please sign up again.' });
    if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 200) return invalid();

    const pending = await mongoDb.consumePendingRegistration(sha256(body.token));
    if (!pending) return invalid();
    if (await mongoDb.getUserByEmail(pending.email)) return invalid(); // someone else got there first

    const userId = `usr_${nanoid(10)}`;
    const user = await mongoDb.createUser(
      {
        id: userId,
        email: pending.email,
        displayName: pending.displayName,
        avatarUrl: pending.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        isAnonymous: false,
        dateOfBirth: pending.dateOfBirth,
        anniversaryDate: pending.anniversaryDate,
        isMarried: pending.isMarried,
        age: pending.age,
        createdAt: new Date().toISOString()
      },
      pending.passwordHash
    );
    ensureSqliteUser(user);
    await mongoLogger.logAuthRegister(user.id, user.email || '', user.displayName);
    return sessionResponse(request, reply, issueToken(user), user);
  });

  app.get('/api/auth/me', async (request, reply) => {
    try {
      const payload = (await request.jwtVerify()) as any;
      const user = await mongoDb.getUserById(payload.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return { user };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.put('/api/auth/profile', async (request, reply) => {
    const payload = (await request.jwtVerify()) as any;
    const body = (request.body || {}) as Record<string, unknown>;

    const dateOfBirth = str(body.dateOfBirth, 40);
    let calculatedAge = typeof body.age === 'number' && body.age >= 0 && body.age <= 120 ? Math.floor(body.age) : undefined;
    if (calculatedAge == null && dateOfBirth) {
      const birth = new Date(dateOfBirth);
      if (!isNaN(birth.getTime())) {
        const diffMs = Date.now() - birth.getTime();
        calculatedAge = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      }
    }

    const relationshipStatus = plainText(body.relationshipStatus, 40);
    const isMarried = typeof body.isMarried === 'boolean' ? body.isMarried : relationshipStatus === 'married';
    const genres = Array.isArray(body.favoriteGenres)
      ? body.favoriteGenres.slice(0, 20).map((g) => plainText(g, 40)).filter((g): g is string => Boolean(g))
      : undefined;
    const avatarUrl = body.avatarUrl === undefined ? undefined : safeAvatar(body.avatarUrl);
    if (body.avatarUrl !== undefined && !avatarUrl) {
      return reply.code(400).send({ error: 'avatarUrl must be an http(s) URL or a small base64 image' });
    }
    // Premium avatar styles need Watch+. Re-sending the avatar you already have is always fine (a downgrade keeps it).
    if (avatarUrl && isPremiumAvatarUrl(avatarUrl) && !TIER_INFO[(await entitlementOf(payload.id)).tier].limits.premiumAvatars) {
      const current = await mongoDb.getUserById(payload.id);
      if (current?.avatarUrl !== avatarUrl) {
        return reply.code(403).send({ error: 'Premium avatar styles are part of Watch+ (VIP Pass).', code: 'UPGRADE_REQUIRED' });
      }
    }

    const updated = await mongoDb.updateUser(payload.id, {
      displayName: plainText(body.displayName, 50) || undefined,
      avatarUrl,
      dateOfBirth,
      anniversaryDate: str(body.anniversaryDate, 40),
      isMarried,
      relationshipStatus,
      gender: plainText(body.gender, 40),
      pronouns: plainText(body.pronouns, 40),
      location: plainText(body.location, 100),
      bio: plainText(body.bio, 500),
      favoriteGenres: genres,
      viewingVibe: plainText(body.viewingVibe, 40),
      age: calculatedAge,
      discoverable: typeof body.discoverable === 'boolean' ? body.discoverable : undefined
    });

    if (!updated) {
      return reply.code(404).send({ error: 'User not found' });
    }
    mirrorUserToSqlite(updated);
    return { user: updated };
  });

  // Get Partner Sync Code / Username change status & quota
  app.get('/api/user/partner-code/status', async (request, reply) => {
    try {
      const user = await getRequestUser(request);
      const status = await mongoDb.getPartnerCodeStatus(user.id);
      return { success: true, ...status };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Change Partner Sync Code / Username with 3 times in 90 days rate-limit
  app.put('/api/user/partner-code', async (request, reply) => {
    try {
      const user = await getRequestUser(request);
      const body = (request.body || {}) as { newCode?: unknown };
      if (typeof body.newCode !== 'string' || !body.newCode) {
        return reply.code(400).send({ success: false, error: 'New username / partner code is required.' });
      }
      const result = await mongoDb.changePartnerCode(user.id, body.newCode);
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
    const user = (await request.jwtVerify()) as any;

    const body = (request.body || {}) as Record<string, unknown>;

    const privacy = (['PUBLIC', 'INVITE_ONLY', 'PRIVATE'] as const).includes(body.privacy as any) ? (body.privacy as 'PUBLIC' | 'INVITE_ONLY' | 'PRIVATE') : 'INVITE_ONLY';
    const activityMode: 'CINEMA' | 'GAMING' = body.activityMode === 'GAMING' ? 'GAMING' : 'CINEMA';

    const rawCode = str(body.roomCode, 64) || str(body.slug, 64);
    let slug: string;
    if (rawCode) {
      slug = rawCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (slug.length < 3 || slug.length > 40) {
        return reply.code(400).send({ error: 'Room code must be 3-40 characters (letters, digits, "-" or "_")' });
      }
      if (db.getRoomBySlug(slug)) {
        return reply.code(409).send({ error: 'That room code is already in use' });
      }
    } else {
      slug = nanoid(8).toLowerCase();
    }

    let sourceUrl = '';
    if (body.sourceUrl !== undefined && body.sourceUrl !== '') {
      const checked = safeUrl(body.sourceUrl);
      if (!checked) {
        return reply.code(400).send({ error: 'sourceUrl must be a valid http(s) URL' });
      }
      sourceUrl = checked;
    }
    const detected = sourceUrl ? detectProviderFromUrl(sourceUrl) : null;

    const roomId = `room_${nanoid(12)}`;
    // Rooms live in SQLite with a FOREIGN KEY to users; accounts live in MongoDB.
    ensureSqliteUser(user);

    const media = (sourceUrl && detected) ? db.createOrGetMedia({
      id: `med_${nanoid(10)}`,
      provider: detected.provider,
      providerMediaId: detected.providerMediaId,
      sourceUrl,
      title: plainText(body.mediaTitle, 200) || 'Watch Party Presentation',
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
      title: plainText(body.title, 100) || (activityMode === 'GAMING' ? 'Party Game Lounge' : 'Movie Night'),
      hostId: user.id,
      privacy,
      isLocked: false,
      currentMedia: media,
      playbackState: initialPlaybackState,
      activityMode,
      createdAt: new Date().toISOString()
    };

    try {
      db.createRoom(room);
    } catch (err: any) {
      if (/UNIQUE/i.test(String(err?.message))) {
        return reply.code(409).send({ error: 'That room code is already in use' });
      }
      throw err;
    }
    syncManager.registerRoom(room);

    await mongoLogger.logRoomCreated(room.id, room.slug, user.id, room.title, room.activityMode);

    return {
      room,
      inviteUrl: `/room/${slug}`
    };
  });

  /** PRIVATE rooms only show their roster/history to the host and people the host already admitted. */
  const canSeeRoomInternals = (room: { id: string; hostId: string; privacy: string }, userId: string) =>
    room.privacy !== 'PRIVATE' || room.hostId === userId || db.isRoomMember(room.id, userId);

  app.get('/api/rooms/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const me = (request.user as any).id as string;
    const room = syncManager.getRoom(slug);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found or has ended' });
    }
    const activeCount = syncManager.getConnectedClientsCount(room.id);
    const cap = TIER_INFO[(await entitlementOf(room.hostId).catch(() => ({ tier: 'free' as const }))).tier].limits.roomCapacity;
    if (!canSeeRoomInternals(room, me)) {
      return {
        room: { id: room.id, slug: room.slug, title: room.title, privacy: room.privacy, hostId: room.hostId, activityMode: room.activityMode, isLocked: room.isLocked, currentMedia: null },
        members: [],
        maxCapacity: cap,
        activeCount,
        isFull: activeCount >= cap
      };
    }
    const members = db.getRoomMembers(room.id);
    return {
      room,
      members,
      maxCapacity: cap,
      activeCount,
      isFull: activeCount >= cap
    };
  });

  // --- Post-Watch Recap & Reaction Heatmaps ---
  app.get('/api/rooms/:slug/recap', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const me = (request.user as any).id as string;
    const room = syncManager.getRoom(slug);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    if (!canSeeRoomInternals(room, me)) {
      return reply.code(403).send({ error: 'This room is private' });
    }

    const advanced = TIER_INFO[(await entitlementOf(me)).tier].limits.advancedRecaps;
    const heatmap = db.getReactionHeatmap(room.id, 15);
    const members = db.getRoomMembers(room.id);
    const top = [...heatmap].sort((a, b) => b.count - a.count);
    const totalReactions = heatmap.reduce((n, b) => n + b.count, 0);

    // Everyone gets the basic recap. Watch+ adds the full heatmap, chat highlights and per-person stats.
    if (!advanced) {
      return { room, members, advanced: false, totalReactions, topMoments: top.slice(0, 3) };
    }
    const recentChat = db.getRecentChatMessages(room.id, 100);
    return {
      room,
      members,
      advanced: true,
      totalReactions,
      heatmap,
      topMoments: top.slice(0, 5),
      chatHighlights: recentChat.filter(c => c.mediaTimestamp !== null).slice(0, 10),
      memberStats: db.getRoomMemberStats(room.id)
    };
  });

  // --- Personal watch stats (Watch+) ---
  app.get('/api/user/stats', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (!TIER_INFO[(await entitlementOf(me)).tier].limits.personalStats) {
      return reply.code(403).send({ error: 'Personal watch stats are part of Watch+ (VIP Pass).', code: 'UPGRADE_REQUIRED' });
    }
    return { stats: db.getUserWatchStats(me) };
  });

  // --- GDPR / Privacy Deletion ---
  app.delete('/api/privacy/data', async (request, reply) => {
    const user = await request.jwtVerify() as { id: string };
    await mongoDb.deleteUserData(user.id);
    db.deleteUserData(user.id);
    await mongoLogger.deleteUserLogs(user.id);
    return { success: true, message: 'All personal viewing and chat records permanently erased' };
  });

  // --- Helper to extract or provision User from request ---
  async function getRequestUser(request: any): Promise<User> {
    const decoded = await request.jwtVerify() as any;
    if (!decoded || decoded.isAnonymous) {
      const err: any = new Error('Authentication required');
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
    if (user) return user;
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

  const isUserOnline = (userId: string): boolean => {
    return (
      presenceManager.isUserOnline(userId) ||
      gameRoomManager.isUserOnline(userId) ||
      syncManager.isUserOnline(userId).online
    );
  };

  /** Entitlement from the stored subscription (never from client input). */
  const entitlementOf = async (userId: string) => billing.computeEntitlement(await mongoDb.getSubscription(userId));

  /**
   * VIP / Creator games (GAME_DEFINITIONS requiredHostTier): only a HOST with that pass may create a room. Guests of any pass may join
   * or watch one. Returns null when allowed, otherwise the body for a 403 UPGRADE_REQUIRED answer. The tier always comes from
   * the stored subscription, never from client input.
   */
  const vipHostRefusal = async (userId: string, gameType: string): Promise<{ error: string; code: 'UPGRADE_REQUIRED'; requiredTier: MembershipTier } | null> => {
    const required = GAME_DEFINITIONS[gameType]?.requiredHostTier;
    if (!required) return null;
    let tier: MembershipTier = 'free';
    try { tier = (await entitlementOf(userId)).tier; } catch { /* treat a lookup failure as the free tier */ }
    if (tierAtLeast(tier, required)) return null;
    return {
      error: required === 'creator'
        ? `${GAME_DEFINITIONS[gameType].name} is a Creator game: hosting needs the Creator Pass. You can still join a friend's game for free.`
        : `${GAME_DEFINITIONS[gameType].name} is a VIP game: hosting needs Watch+ (VIP Pass). You can still join a friend's game for free.`,
      code: 'UPGRADE_REQUIRED',
      requiredTier: required
    };
  };

  app.get('/api/user/me', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const partner = await mongoDb.getPartner(user.id);
    const partnerOnline = partner ? isUserOnline(partner.partnerUserId) : false;

    const ent = await entitlementOf(user.id);
    return {
      user: {
        ...user,
        partnerCode: user.partnerCode || (await mongoDb.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl, user.isAnonymous, user.email)),
        membership: { tier: ent.tier, badge: TIER_INFO[ent.tier].badge, badgeLabel: TIER_INFO[ent.tier].badgeLabel }
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

  // --- Partner requests: a partner code only lets you ASK; the other person must accept (GR-21) ---------------
  const partnerRequestLimiter = new KeyedLimiter(envInt('RATE_LIMIT_PARTNER_REQUEST_MAX', 10), 60 * 60_000);
  const partnerView = (partner: any) => ({
    id: partner.partnerUser?.id || partner.partnerUserId,
    displayName: partner.partnerUser?.displayName || 'Partner',
    partnerCode: partner.partnerUser?.partnerCode || '',
    avatarUrl: partner.partnerUser?.avatarUrl || null,
    online: isUserOnline(partner.partnerUserId),
    connectionId: partner.id
  });
  const notifyPartnerEvent = (targetUserId: string, type: 'partner:request' | 'partner:accepted', from: { id: string; displayName: string; avatarUrl?: string | null }) => {
    const title = type === 'partner:request' ? `${from.displayName} sent you a partner request` : `${from.displayName} accepted your partner request`;
    const payload = { id: `${type}:${from.id}`, fromUserId: from.id, fromDisplayName: from.displayName, fromAvatarUrl: from.avatarUrl || null, title, link: '/friends' };
    const live = deliverLive(targetUserId, { type, payload });
    if (!live) pushOffline(targetUserId, { title, body: 'Open Friends to respond.', tag: `${type}:${from.id}`, url: '/friends' });
  };

  app.post('/api/user/partner/connect', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { partnerCode?: unknown; friendUserId?: unknown; userId?: unknown };
    const code = typeof body.partnerCode === 'string' ? body.partnerCode.trim().slice(0, 40) : undefined;
    const targetId = typeof body.friendUserId === 'string' ? body.friendUserId : typeof body.userId === 'string' ? body.userId : undefined;
    if (!code && !targetId) {
      return reply.code(400).send({ error: 'Partner Code or Friend ID is required' });
    }
    if (partnerRequestLimiter.hit(`preq:${user.id}`)) return tooMany(reply);
    try {
      let target: any = null;
      if (code) {
        target = await mongoDb.getUserByPartnerCode(code.toUpperCase());
        if (!target) return reply.code(400).send({ error: 'Partner Code not found. Please verify the code and try again.' });
      } else if (targetId) {
        // Linking by user id (no secret code involved) requires an existing accepted friendship
        if (!(await mongoDb.areFriends(user.id, targetId))) {
          return reply.code(403).send({ error: 'You can only partner with an accepted friend' });
        }
        target = await mongoDb.getUserById(targetId);
        if (!target?.partnerCode) return reply.code(400).send({ error: 'Friend not found' });
      }
      if (target.id === user.id) return reply.code(400).send({ error: 'You cannot enter your own Partner Code.' });
      if (await mongoDb.arePartners(user.id, target.id)) {
        return reply.code(409).send({ error: `You are already partners with ${target.displayName}.` });
      }
      // Accepted friends already consented to each other: the link stays instant for them
      if (await mongoDb.areFriends(user.id, target.id)) {
        const partner = await mongoDb.connectPartner(user.id, target.partnerCode);
        return { success: true, requested: false, partner: partnerView(partner) };
      }
      const created = await mongoDb.createPartnerRequest(user.id, target.id);
      if (created.result === 'duplicate') return reply.code(409).send({ error: `You already sent ${target.displayName} a request. Waiting for them to accept.` });
      if (created.result === 'reverse') return reply.code(409).send({ error: `${target.displayName} already sent you a request. Accept it in Friends.` });
      if (created.result === 'cooldown') return reply.code(429).send({ error: 'You cannot send this request right now. Please try again later.' });
      notifyPartnerEvent(target.id, 'partner:request', user);
      return { success: true, requested: true, pending: true, recipient: { id: target.id, displayName: target.displayName, avatarUrl: target.avatarUrl || null } };
    } catch (err: any) {
      return reply.code(400).send({ error: publicMessage(err, 'Failed to connect partner') });
    }
  });

  app.get('/api/user/partner/requests', async (request) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    return { success: true, ...(await mongoDb.listPartnerRequests(user.id)) };
  });

  app.post('/api/user/partner/requests/accept', async (request, reply) => {
    const user = await getRequestUser(request);
    const id = (request.body as any)?.requesterUserId;
    if (typeof id !== 'string' || !id || id.length > 80) return reply.code(400).send({ error: 'requesterUserId is required' });
    const partner = await mongoDb.acceptPartnerRequest(id, user.id);
    if (!partner) return reply.code(404).send({ error: 'No pending request from this person' });
    notifyPartnerEvent(id, 'partner:accepted', user);
    return { success: true, partner: partnerView(partner) };
  });

  app.post('/api/user/partner/requests/decline', async (request, reply) => {
    const user = await getRequestUser(request);
    const id = (request.body as any)?.requesterUserId;
    if (typeof id !== 'string' || !id || id.length > 80) return reply.code(400).send({ error: 'requesterUserId is required' });
    if (!(await mongoDb.declinePartnerRequest(id, user.id))) return reply.code(404).send({ error: 'No pending request from this person' });
    return { success: true };
  });

  app.post('/api/user/partner/requests/cancel', async (request, reply) => {
    const user = await getRequestUser(request);
    const id = (request.body as any)?.recipientUserId;
    if (typeof id !== 'string' || !id || id.length > 80) return reply.code(400).send({ error: 'recipientUserId is required' });
    if (!(await mongoDb.cancelPartnerRequest(user.id, id))) return reply.code(404).send({ error: 'No pending request to this person' });
    return { success: true };
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
    if (discoverLimiter.hit(`disc:${user.id}`)) return tooMany(reply);
    const { search } = request.query as { search?: unknown };
    const term = typeof search === 'string' ? search.trim().slice(0, 50) : '';
    if (term && term.length < 2) {
      return { success: true, users: [] };
    }
    const users = await mongoDb.getDiscoverableUsers(user.id, term || undefined);
    return {
      success: true,
      users
    };
  });

  app.post('/api/friends/add', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { friendCode?: unknown };
    if (typeof body.friendCode !== 'string' || !body.friendCode.trim() || body.friendCode.length > 40) {
      return reply.code(400).send({ error: 'Friend Code is required' });
    }
    try {
      const result = await mongoDb.sendFriendRequest(user.id, body.friendCode.trim());
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
      return reply.code(400).send({ error: publicMessage(err, 'Failed to send friend request') });
    }
  });

  app.post('/api/friends/requests/accept', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { senderUserId?: unknown };
    if (typeof body.senderUserId !== 'string' || !body.senderUserId || body.senderUserId.length > 64) {
      return reply.code(400).send({ error: 'senderUserId is required' });
    }
    try {
      const friend = await mongoDb.acceptFriendRequest(user.id, body.senderUserId as string);
      friend.friendUser.isOnline = isUserOnline(friend.friendUser.id);
      return {
        success: true,
        friend,
        message: `Accepted request from ${friend.friendUser.displayName}`
      };
    } catch (err: any) {
      return reply.code(400).send({ error: publicMessage(err, 'Failed to accept friend request') });
    }
  });

  app.post('/api/friends/requests/decline', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { senderUserId?: unknown };
    if (typeof body.senderUserId !== 'string' || !body.senderUserId || body.senderUserId.length > 64) {
      return reply.code(400).send({ error: 'senderUserId is required' });
    }
    await mongoDb.declineFriendRequest(user.id, body.senderUserId as string);
    return {
      success: true,
      message: 'Friend request declined'
    };
  });

  app.post('/api/friends/requests/cancel', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { targetUserId?: unknown };
    if (typeof body.targetUserId !== 'string' || !body.targetUserId || body.targetUserId.length > 64) {
      return reply.code(400).send({ error: 'targetUserId is required' });
    }
    await mongoDb.cancelFriendRequest(user.id, body.targetUserId as string);
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
    await mongoDb.removeFriend(user.id, friendUserId);
    return { success: true, message: 'Friend removed' };
  });

  // =====================================================================
  // Watch Direct Chat Endpoints
  // =====================================================================

  app.get('/api/chat/messages', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const { conversationId, limit, before, after } = request.query as {
      conversationId?: string;
      limit?: string;
      before?: string;
      after?: string;
    };
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
    const prepared = await prepareDirectMessage(mongoDb, user, request.body, (id) => presenceManager.hasLiveSocket(id));
    if (!prepared.ok) {
      return reply.code(prepared.status).send({ error: prepared.error });
    }

    await mongoDb.saveDirectChatMessage(prepared.msg as any);

    // Guarantee delivery to recipient sockets even if sender WebSocket was offline/reconnecting
    const deliveredLive = presenceManager.sendToUser(prepared.recipientId, {
      type: 'chat:message',
      message: prepared.msg
    });
    if (!deliveredLive) {
      pushOffline(prepared.recipientId, {
        title: user.displayName,
        body: previewMessageText(prepared.msg.content as string, prepared.msg.type as string),
        tag: `chat:${prepared.msg.conversationId}`,
        renotify: true,
        url: `/chat?userId=${encodeURIComponent(user.id)}`
      });
    }

    return { success: true, message: prepared.msg };
  });

  app.post('/api/chat/read', async (request, reply) => {
    const user = await getRequestUser(request);
    presenceManager.recordHeartbeat(user.id);
    const body = (request.body || {}) as { conversationId?: string; senderId?: string };
    if (typeof body.conversationId !== 'string' || !body.conversationId) {
      return reply.code(400).send({ error: 'conversationId is required' });
    }
    const updatedMessages = await mongoDb.markDirectMessagesAsRead(body.conversationId, user.id);

    if (typeof body.senderId === 'string' && (await mongoDb.areConnected(user.id, body.senderId))) {
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
    const body = (request.body || {}) as { messageId?: string; conversationId?: string };
    if (!body.messageId) {
      return reply.code(400).send({ error: 'messageId is required' });
    }
    if (typeof body.messageId !== 'string') {
      return reply.code(400).send({ error: 'messageId is required' });
    }
    const details = await mongoDb.markDirectMessageViewOnceOpened(body.messageId, user.id);
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
    const body = (request.body || {}) as { friendUserId?: unknown; minutes?: unknown };
    if (typeof body.friendUserId !== 'string' || !body.friendUserId) {
      return reply.code(400).send({ error: 'friendUserId is required' });
    }
    if (!(await mongoDb.areFriends(user.id, body.friendUserId))) {
      return reply.code(403).send({ error: 'Streaks can only be recorded with accepted friends' });
    }
    const minutes = Math.min(Math.max(Math.floor(Number(body.minutes)) || 1, 1), 240);
    const result = await mongoDb.recordSessionBetweenUsers(user.id, body.friendUserId, minutes);
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

      const activeFriends: Array<{
        friend: {
          id: string;
          displayName: string;
          avatarUrl?: string | null;
          partnerCode?: string;
          isOnline: boolean;
          membershipTier?: string;
        };
        game: {
          roomId: string;
          roomCode: string;
          gameType: string;
          gameTitle: string;
          status: 'WAITING' | 'PLAYING';
          playerCount: number;
          maxPlayers: number;
          isHost: boolean;
          joinUrl: string;
          canSpectate: boolean;
          spectateUrl?: string;
          spectatorCount?: number;
        };
      }> = [];

      for (const f of friends) {
        const friendId = f.friendUser.id;
        const activeGame = gameRoomManager.getUserActiveGame(friendId);
        if (activeGame) {
          const gameTitle = GAME_DEFINITIONS[activeGame.gameType]?.name || activeGame.gameType;
          // Spectating: the owner is my friend (this loop), the room is PLAYING and I am not a player of it
          const watchable = activeGame.status === 'PLAYING' &&
            !db.getGameRoomById(activeGame.roomId)?.players.some(p => p.userId === user.id);
          const gamePath = `${activeGame.gameType === 'mafia-night' ? '/games/mafia' : `/games/${activeGame.gameType === 'four-in-a-row' ? 'four-in-a-row' : activeGame.gameType}`}?room=${encodeURIComponent(activeGame.roomCode)}`;
          activeFriends.push({
            friend: {
              id: f.friendUser.id,
              displayName: f.friendUser.displayName,
              avatarUrl: f.friendUser.avatarUrl,
              partnerCode: f.friendUser.partnerCode,
              isOnline: true,
              membershipTier: f.friendUser.membershipTier || 'free'
            },
            game: {
              roomId: activeGame.roomId,
              roomCode: activeGame.roomCode,
              gameType: activeGame.gameType,
              gameTitle,
              status: activeGame.status as 'WAITING' | 'PLAYING',
              playerCount: activeGame.playerCount,
              maxPlayers: activeGame.maxPlayers,
              isHost: activeGame.hostUserId === friendId,
              joinUrl: gamePath,
              canSpectate: watchable,
              ...(watchable ? { spectateUrl: `${gamePath}&spectate=1`, spectatorCount: gameRoomManager.spectatorCount(activeGame.roomId) } : {})
            }
          });
        }
      }

      return { success: true, activeFriends };
    } catch (err: any) {
      return reply.code(err.statusCode || 500).send({ error: publicMessage(err, 'Failed to fetch active friends in games') });
    }
  });

  // Play with Partner / Friend (Deterministic Smart Pairing or Custom Room Creation)
  app.post('/api/games/partner/play', async (request, reply) => {
    try {
      const user = await getRequestUser(request);
      if (partnerActionLimiter.hit(`play:${user.id}`)) return tooMany(reply);
      const body = (request.body || {}) as {
        gameType?: string;
        targetUserId?: string;
        friendUserId?: string;
        partnerCode?: string;
      };
      const gameType: GameType = resolveGameType(body.gameType);
      if (!GAME_DEFINITIONS[gameType]?.supportsPartnerMode) {
        return reply.code(400).send({ error: `${GAME_DEFINITIONS[gameType]?.name || 'This game'} is played in a group: create a room and share the code or invite friends.`, code: 'NOT_SUPPORTED' });
      }

      let targetUser: any = null;
      const targetIdRaw = body.targetUserId || body.friendUserId;
      const targetId = typeof targetIdRaw === 'string' ? targetIdRaw : undefined;
      if (targetId) {
        if (!(await mongoDb.areConnected(user.id, targetId))) {
          return reply.code(403).send({ error: 'You can only invite friends or your partner' });
        }
        targetUser = await mongoDb.getUserById(targetId);
      } else if (typeof body.partnerCode === 'string') {
        targetUser = await mongoDb.getUserByPartnerCode(body.partnerCode.slice(0, 40));
      }

      let partnerUserId: string | null = null;

      if (targetUser && targetUser.id !== user.id) {
        partnerUserId = targetUser.id;
        try {
          // A partner code never links people by itself (GR-21): ask them instead, best effort
          if (!targetId && !(await mongoDb.areConnected(user.id, targetUser.id)) && !partnerRequestLimiter.hit(`preq:${user.id}`)) {
            const created = await mongoDb.createPartnerRequest(user.id, targetUser.id);
            if (created.result === 'created') notifyPartnerEvent(targetUser.id, 'partner:request', user);
          }
        } catch (linkErr) {
          console.warn('[partner] auto-link failed (continuing without it):', (linkErr as any)?.message || linkErr);
        }
      } else {
        const partner = await mongoDb.getPartner(user.id);
        if (partner) {
          partnerUserId = partner.partnerUserId;
        }
      }

      const gameBasePath = getGameBasePath(gameType);

      // 1. Check if partner is ALREADY waiting in an open game room
      if (partnerUserId) {
        const partnerWaitingRoom = db.findUserWaitingGameRoom(partnerUserId);
        if (
          partnerWaitingRoom &&
          partnerWaitingRoom.gameType === gameType &&
          partnerWaitingRoom.status === 'WAITING' &&
          partnerWaitingRoom.players.length < partnerWaitingRoom.maxPlayers
        ) {
          try {
            const joined = gameRoomManager.joinRoom(partnerWaitingRoom.roomCode, user);
            return {
              success: true,
              room: joined,
              joinedPartnerRoom: true,
              inviteUrl: `${gameBasePath}?room=${joined.roomCode}`
            };
          } catch (joinErr: any) {
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
          sendInvite(partnerUserId, invitePayload);
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
        sendInvite(partnerUserId, invitePayload);
      }

      return {
        success: true,
        room: created,
        joinedPartnerRoom: false,
        inviteUrl: `${gameBasePath}?room=${created.roomCode}`
      };
    } catch (err: any) {
      console.error('[PartnerPlay] Error creating/joining partner game:', err);
      return reply.code(err.statusCode || 500).send({
        error: publicMessage(err, 'Failed to start match with partner')
      });
    }
  });

  // Join Any Room / Matchmaking (2, 3, or 4 players - ZERO BOTS)
  app.post('/api/games/matchmake', async (request, reply) => {
    const user = await getRequestUser(request);
    const body = (request.body || {}) as { gameType?: string; maxPlayers?: number };
    const gameType: GameType = resolveGameType(body.gameType);
    if (!GAME_DEFINITIONS[gameType]?.supportsPublicMatchmaking) {
      return reply.code(400).send({ error: `${GAME_DEFINITIONS[gameType]?.name || 'This game'} has no public matchmaking: create a room and invite friends with the code.`, code: 'NOT_SUPPORTED' });
    }
    const maxPlayers = gameType === 'ludo' ? ((Number(body.maxPlayers) || 2) as 2 | 3 | 4) : 2;
    const gameBasePath = getGameBasePath(gameType);

    try {
      // If user has a partner who is waiting in a matching room, pair them together!
      const partner = await mongoDb.getPartner(user.id);
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
      return reply.code(400).send({ error: publicMessage(err, 'Failed to matchmake') });
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
    const def = GAME_DEFINITIONS[gameType];
    const refusal = await vipHostRefusal(user.id, gameType);
    if (refusal) return reply.code(403).send(refusal);
    // Group games open with their biggest table (the host starts once enough people joined); the others with their first option
    let maxPlayers = Number(body.maxPlayers) || (def?.playerOptions ? (gameType === 'imposter' || gameType === 'emoji-charades' || gameType === 'mafia-night' || gameType === 'quiz-show' || gameType === 'murder-mystery' || gameType === 'tournament' ? def.maxPlayers : def.playerOptions[0]) : 2);
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
    } catch (err: any) {
      return reply.code(400).send({ error: publicMessage(err, 'Failed to create game room') });
    }
  });

  /** Spectator rule: the viewer is an accepted friend of at least one (non-left, non-bot) player of the room. */
  const isFriendOfAnyPlayer = async (viewerId: string, players: Array<{ userId: string; status?: string }>): Promise<boolean> => {
    for (const p of players) {
      if (p.userId === viewerId || p.status === 'LEFT' || p.userId.startsWith('bot_')) continue;
      try {
        if (await mongoDb.areFriends(viewerId, p.userId)) return true;
      } catch { /* treat a lookup failure as "not a friend" */ }
    }
    return false;
  };

  // Get Game Room details by temporary room code
  app.get('/api/games/rooms/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const cleanCode = (code || '').trim().toUpperCase();
    const user = await getRequestUser(request);
    const found = gameRoomManager.getRoomByCode(cleanCode) || db.getGameRoomByCode(cleanCode);
    if (!found) {
      return reply.code(404).send({ error: `Game room "${cleanCode}" not found or expired` });
    }
    // Only seated players see the game state, and only their own projection (no secret word / opponent boards) (GR-4)
    const isMember = found.players.some(p => p.userId === user.id);
    const room = isMember ? gameRoomManager.projectRoomFor(found, user.id) : { ...found, gameState: null };
    const spectatable = !isMember && found.status === 'PLAYING' && (await isFriendOfAnyPlayer(user.id, found.players));
    return {
      room,
      isFull: room.players.length >= room.maxPlayers,
      canJoin: room.status === 'WAITING' && room.players.length < room.maxPlayers,
      spectatable
    };
  });

  // Join Game Room by temporary room code
  app.post('/api/games/rooms/:code/join', async (request, reply) => {
    const { code } = request.params as { code: string };
    const cleanCode = (code || '').trim().toUpperCase().slice(0, 40);
    const user = await getRequestUser(request);
    if (joinLimiter.hit(`join:${user.id}`)) return tooMany(reply);
    try {
      const joined = gameRoomManager.joinRoom(cleanCode, user);
      const room = gameRoomManager.projectRoomFor(joined, user.id);
      return {
        success: true,
        room,
        inviteUrl: `${getGameBasePath(room.gameType)}?room=${room.roomCode}`
      };
    } catch (err: any) {
      return reply.code(400).send({ error: publicMessage(err, 'Failed to join game room') });
    }
  });

  // Invite Connected Partner to a Game Room
  app.post('/api/games/partner/invite', async (request, reply) => {
    const user = await getRequestUser(request);
    if (partnerActionLimiter.hit(`invite:${user.id}`)) return tooMany(reply);
    const partner = await mongoDb.getPartner(user.id);
    if (!partner) {
      return reply.code(400).send({ error: 'No connected partner found to invite' });
    }
    const body = (request.body || {}) as { roomCode: unknown; gameType?: string };
    if (typeof body.roomCode !== 'string' || !ROOM_CODE_RE.test(body.roomCode.trim().toUpperCase())) {
      return reply.code(400).send({ error: 'A valid room code is required' });
    }
    // GR-22: the room must exist, be joinable and include the inviter; the game type comes from the room, not the client
    const inviteRoom = gameRoomManager.getRoomByCode(body.roomCode.trim().toUpperCase()) || db.getGameRoomByCode(body.roomCode.trim().toUpperCase());
    if (!inviteRoom || inviteRoom.status !== 'WAITING' || !inviteRoom.players.some(p => p.userId === user.id)) {
      return reply.code(404).send({ error: 'That room is not open for invitations' });
    }
    const gameType = inviteRoom.gameType as GameType;

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
    if (typeof targetCode === 'string' && targetCode) {
      const explicitUser = await mongoDb.getUserByPartnerCode(targetCode.slice(0, 40));
      if (explicitUser) {
        if (!(await mongoDb.areConnected(user.id, explicitUser.id))) {
          return reply.code(403).send({ error: 'You can only invite friends or your partner' });
        }
        targetUserId = explicitUser.id;
      }
    }

    if (partnerTargetLimiter.hit(`invite:${user.id}:${targetUserId}`)) return tooMany(reply);
    const deliveredLive = sendInvite(targetUserId, invitePayload);

    return {
      success: true,
      deliveredLive,
      invite: invitePayload
    };
  });

  // Partner Ping Endpoint (Used across games and lobby). Sender identity comes from the token.
  app.post('/api/games/partner/ping', async (request, reply) => {
    const user = await getRequestUser(request);
    if (partnerActionLimiter.hit(`ping:${user.id}`)) return tooMany(reply);
    const body = (request.body || {}) as Record<string, unknown>;

    if (typeof body.targetCode !== 'string' || !body.targetCode) {
      return reply.code(400).send({ error: 'Target partner code is required' });
    }

    const targetUser = await mongoDb.getUserByPartnerCode(body.targetCode.slice(0, 40).toUpperCase());
    if (!targetUser) {
      return reply.code(404).send({ error: 'Partner code not found' });
    }
    if (!(await mongoDb.areConnected(user.id, targetUser.id))) {
      return reply.code(403).send({ error: 'You can only ping friends or your partner' });
    }
    if (partnerTargetLimiter.hit(`ping:${user.id}:${targetUser.id}`)) return tooMany(reply);

    const roomCode = typeof body.roomCode === 'string' && ROOM_CODE_RE.test(body.roomCode.trim().toUpperCase()) ? body.roomCode.trim().toUpperCase() : undefined;
    const pingPayload = {
      id: `ping_${nanoid(8)}`,
      fromCode: user.partnerCode || 'ANON',
      fromName: user.displayName,
      targetCode: body.targetCode.toUpperCase().slice(0, 40),
      roomCode,
      gameType: resolveGameType(typeof body.gameType === 'string' ? body.gameType : undefined),
      customMessage: plainText(body.customMessage, 200),
      createdAt: Date.now(),
      read: false
    };

    const deliveredLive = deliverLive(targetUser.id, { type: 'partner:ping', payload: pingPayload });
    if (!deliveredLive) {
      pushOffline(targetUser.id, {
        title: `${user.displayName} pinged you`,
        body: pingPayload.customMessage || (roomCode ? `Join room ${roomCode}` : 'Come hang out!'),
        tag: `ping:${pingPayload.id}`,
        url: roomCode ? `${getGameBasePath(pingPayload.gameType)}?room=${encodeURIComponent(roomCode)}` : '/friends'
      });
    }

    return {
      success: true,
      deliveredLive,
      ping: pingPayload
    };
  });

  // Partner Friendly Nudge Endpoint
  const nudgeHandler = async (request: any, reply: any) => {
    const user = await getRequestUser(request);
    if (partnerActionLimiter.hit(`nudge:${user.id}`)) return tooMany(reply);
    const body = (request.body || {}) as Record<string, unknown>;

    if (typeof body.targetPartnerCode !== 'string' || !body.targetPartnerCode) {
      return reply.code(400).send({ error: 'Target partner code is required' });
    }

    const targetUser = await mongoDb.getUserByPartnerCode(body.targetPartnerCode.slice(0, 40).toUpperCase());
    if (!targetUser) {
      return reply.code(404).send({ error: 'Target partner not found' });
    }
    if (!(await mongoDb.areConnected(user.id, targetUser.id))) {
      return reply.code(403).send({ error: 'You can only nudge friends or your partner' });
    }
    if (partnerTargetLimiter.hit(`nudge:${user.id}:${targetUser.id}`)) return tooMany(reply);

    const nudgePayload = {
      id: `nudge_${nanoid(8)}`,
      fromUserId: user.id,
      fromName: user.displayName,
      fromPartnerCode: user.partnerCode,
      fromAvatar: user.avatarUrl,
      message: plainText(body.message, 280) || '',
      category: typeof body.category === 'string' && /^[a-z_]{1,20}$/.test(body.category) ? body.category : 'nudge',
      link: safeUrl(body.link, { allowRelative: true, maxLength: 300 }) || '/friends',
      timestamp: Date.now()
    };

    const deliveredLive = deliverLive(targetUser.id, { type: 'partner:nudge', payload: nudgePayload });
    if (!deliveredLive) {
      pushOffline(targetUser.id, {
        title: `${user.displayName} sent you a nudge`,
        body: nudgePayload.message || 'Thinking of you!',
        tag: `nudge:${nudgePayload.id}`,
        url: nudgePayload.link
      });
    }

    return {
      success: true,
      deliveredLive,
      nudge: nudgePayload
    };
  };
  app.post('/api/friends/nudge', nudgeHandler);

  // Active Notification Device Registration & Switcher (always for the authenticated user)
  app.post('/api/notifications/device-token', async (request, reply) => {
    const { id: targetUserId } = (await request.jwtVerify()) as { id: string };

    const body = (request.body || {}) as Record<string, unknown>;

    const activeSession: ActiveDeviceSession = {
      deviceId: str(body.deviceId, 100) || `device_${Date.now()}`,
      deviceType: (['mobile', 'desktop', 'tablet'] as const).includes(body.deviceType as any) ? (body.deviceType as 'mobile' | 'desktop' | 'tablet') : 'desktop',
      deviceToken: str(body.deviceToken, 4096),
      browserName: str(body.browserName, 100),
      lastActiveAt: Date.now()
    };

    await mongoDb.updateUserActiveDevice(targetUserId, activeSession);
    mirrorDevice(targetUserId, activeSession);
    await presenceManager.setActiveDevice(targetUserId, activeSession);

    return { success: true, activeDevice: activeSession };
  });

  // --- Billing / subscriptions -------------------------------------------------------------------------------
  // Tiers are derived ONLY from the stored subscription (services/billing.ts computeEntitlement). Payments happen on
  // Razorpay / Stripe hosted pages; this server never sees card data. Webhooks are public but HMAC-verified on the raw
  // body and idempotent by event id. Mock endpoints exist only when BILLING_MODE=mock outside production.
  const billingLimiter = new KeyedLimiter(envInt('RATE_LIMIT_BILLING_MAX', 10), 60_000);
  const waitlistLimiter = new KeyedLimiter(envInt('RATE_LIMIT_WAITLIST_MAX', 10), 60 * 60_000);
  const notEnabled = (reply: any) => reply.code(503).send({ error: 'Payments are not enabled yet' });
  const checkoutSchema = z.object({
    tier: z.string().max(20),
    interval: z.enum(['monthly', 'yearly']),
    currency: z.enum(BILLING_CURRENCIES).optional()
  });
  const waitlistSchema = z.object({ tier: z.string().max(20) });
  const mockSchema = z.object({ tier: z.enum(['plus', 'creator']), interval: z.enum(['monthly', 'yearly']).default('monthly') });
  const planLimits = (tier: MembershipTier) => ({ ...TIER_INFO[tier].limits, hostedPlans: TIER_INFO[tier].limits.hostedPlans, recurringPlans: TIER_INFO[tier].limits.recurringPlans, roomCapacity: TIER_INFO[tier].limits.roomCapacity, premiumThemes: TIER_INFO[tier].limits.premiumThemes });

  app.get('/api/billing/catalog', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('vary', 'cf-ipcountry, x-vercel-ip-country, cloudfront-viewer-country, accept-language');
    return billing.buildCatalog(request.headers, (request.query || {}) as Record<string, any>);
  });

  app.get('/api/billing/me', async (request) => {
    const me = (request.user as any).id as string;
    const ent = await entitlementOf(me);
    return { ...ent, badge: TIER_INFO[ent.tier].badge, badgeLabel: TIER_INFO[ent.tier].badgeLabel, limits: planLimits(ent.tier), waitlist: await mongoDb.getBillingWaitlist(me), canPurchase: billing.canPurchase({ id: me, email: (request.user as any).email }), testMode: billing.testBypassFor({ id: me, email: (request.user as any).email }) };
  });

  // Last 20 recorded successful charges (date, amount, currency, status). Tax invoices come from the payment provider.
  app.get('/api/billing/history', async (request) => {
    const me = (request.user as any).id as string;
    return { payments: await mongoDb.listBillingPayments(me, 20), invoicesNote: 'Tax invoices are emailed by the payment provider.' };
  });

  app.post('/api/billing/checkout', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (billingLimiter.hit(`checkout:${me}`)) return tooMany(reply);
    const parsed = checkoutSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.code(400).send({ error: 'Choose a plan and a billing interval (monthly or yearly).' });
    const wantTier = parsed.data.tier;
    if (wantTier !== 'plus' && wantTier !== 'creator') return reply.code(400).send({ error: 'That plan cannot be purchased.' });
    if (billing.billingMode() === 'off') return notEnabled(reply);
    if (!billing.canPurchase({ id: me, email: (request.user as any).email })) return reply.code(403).send({ error: billing.NOT_IN_PILOT_MESSAGE, code: 'NOT_IN_PILOT' });
    const ent = await entitlementOf(me);
    if (ent.tier !== 'free') return reply.code(409).send({ error: 'You already have a paid plan. Cancel it first, then pick another.' });
    const region = billing.resolveRegion(request.headers, (request.query || {}) as Record<string, any>, parsed.data.currency);
    if (!billing.providerReady(region.provider, region.currency)) return notEnabled(reply);
    if (wantTier === 'creator' && !(region.provider === 'razorpay' && billing.creatorPurchasable())) return reply.code(400).send({ error: 'Communities & Creators is not available to buy yet. Join the waitlist instead.' });
    const { interval } = parsed.data;
    if (region.provider === 'mock') return { provider: 'mock', url: `${WEB_BASE_URL}/billing/success?mock=1` };
    if (region.provider === 'razorpay') {
      const r = await billing.razorpayCreateSubscription(me, interval, wantTier);
      return { provider: 'razorpay', url: r.url };
    }
    const existing = await mongoDb.getSubscription(me);
    const r = await billing.stripeCreateCheckout({ userId: me, interval, currency: region.currency, webBase: WEB_BASE_URL, customerId: existing?.provider === 'stripe' ? existing.providerCustomerId : null });
    return { provider: 'stripe', url: r.url };
  });

  const liveProviderGuard = (sub: any, reply: any): boolean => {
    if (sub.provider === 'mock') return billing.mockEnabled() || billing.testModeOn() ? true : (notEnabled(reply), false);
    if (!billing.providerReady(sub.provider)) return (notEnabled(reply), false);
    return true;
  };

  app.post('/api/billing/cancel', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (billingLimiter.hit(`cancel:${me}`)) return tooMany(reply);
    const sub = await mongoDb.getSubscription(me);
    const ent = billing.computeEntitlement(sub);
    if (!sub || ent.tier === 'free') return reply.code(409).send({ error: 'You do not have an active subscription.' });
    if (!ent.cancelAtPeriodEnd) {
      if (!liveProviderGuard(sub, reply)) return;
      if (sub.provider !== 'mock') {
        if (!sub.providerSubscriptionId) return reply.code(409).send({ error: 'This subscription cannot be cancelled here. Contact support.' });
        if (sub.provider === 'razorpay') await billing.razorpayCancel(sub.providerSubscriptionId);
        else await billing.stripeSetCancelAtPeriodEnd(sub.providerSubscriptionId, true);
      }
      await mongoDb.applySubscriptionPatch(me, { cancelAtPeriodEnd: true });
    }
    return { success: true, cancelAtPeriodEnd: true, renewsAt: ent.renewsAt };
  });

  app.post('/api/billing/resume', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (billingLimiter.hit(`resume:${me}`)) return tooMany(reply);
    const sub = await mongoDb.getSubscription(me);
    const ent = billing.computeEntitlement(sub);
    if (!sub || ent.tier === 'free' || !ent.cancelAtPeriodEnd) return reply.code(409).send({ error: 'There is no pending cancellation to undo.' });
    if (sub.provider === 'razorpay' || sub.status === 'canceled') {
      return reply.code(409).send({ error: 'This subscription has already ended with the payment provider. Start a new Watch+ subscription when your access ends.' });
    }
    if (!liveProviderGuard(sub, reply)) return;
    if (sub.provider === 'stripe') {
      if (!sub.providerSubscriptionId) return reply.code(409).send({ error: 'This subscription cannot be resumed here. Contact support.' });
      await billing.stripeSetCancelAtPeriodEnd(sub.providerSubscriptionId, false);
    }
    await mongoDb.applySubscriptionPatch(me, { cancelAtPeriodEnd: false });
    return { success: true };
  });

  app.post('/api/billing/portal', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (billingLimiter.hit(`portal:${me}`)) return tooMany(reply);
    const sub = await mongoDb.getSubscription(me);
    if (!sub || sub.provider !== 'stripe' || !sub.providerCustomerId || !billing.providerReady('stripe')) return reply.code(404).send({ error: 'No billing portal for this account.' });
    return { url: await billing.stripePortal(sub.providerCustomerId, WEB_BASE_URL) };
  });

  app.post('/api/billing/waitlist', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (waitlistLimiter.hit(`waitlist:${me}`)) return tooMany(reply);
    const parsed = waitlistSchema.safeParse(request.body || {});
    if (!parsed.success || parsed.data.tier !== 'creator') return reply.code(400).send({ error: 'Only the Communities & Creators plan has a waitlist.' });
    await mongoDb.addBillingWaitlist(me, 'creator');
    return { success: true };
  });

  // Mock endpoints (development and tests only): 404 unless BILLING_MODE=mock and NODE_ENV!=production
  app.post('/api/billing/mock/activate', async (request, reply) => {
    if (!billing.mockEnabled()) return reply.code(404).send({ error: 'Not found' });
    const me = (request.user as any).id as string;
    const parsed = mockSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.code(400).send({ error: 'tier (plus|creator) and interval (monthly|yearly) are required' });
    const days = parsed.data.interval === 'yearly' ? 365 : 30;
    await mongoDb.applySubscriptionPatch(me, {
      tier: parsed.data.tier, interval: parsed.data.interval, currency: 'USD', provider: 'mock', providerCustomerId: null, providerSubscriptionId: null,
      status: 'active', currentPeriodEnd: Date.now() + days * 24 * 60 * 60_000, cancelAtPeriodEnd: false
    });
    return { success: true };
  });
  // Owner testing (BILLING_TEST_USERS, never in production): switch a pass on/off without a payment provider.
  app.post('/api/billing/test/activate', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (!billing.testBypassFor({ id: me, email: (request.user as any).email })) return reply.code(404).send({ error: 'Not found' });
    const parsed = mockSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.code(400).send({ error: 'tier (plus|creator) and interval (monthly|yearly) are required' });
    const days = parsed.data.interval === 'yearly' ? 365 : 30;
    await mongoDb.applySubscriptionPatch(me, {
      tier: parsed.data.tier, interval: parsed.data.interval, currency: 'INR', provider: 'mock', providerCustomerId: null, providerSubscriptionId: null,
      status: 'active', currentPeriodEnd: Date.now() + days * 24 * 60 * 60_000, cancelAtPeriodEnd: false
    });
    return { success: true };
  });
  app.post('/api/billing/test/reset', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (!billing.testBypassFor({ id: me, email: (request.user as any).email })) return reply.code(404).send({ error: 'Not found' });
    await mongoDb.applySubscriptionPatch(me, { status: 'canceled', cancelAtPeriodEnd: true, currentPeriodEnd: Date.now() - 1000 });
    return { success: true };
  });
  app.post('/api/billing/mock/expire', async (request, reply) => {
    if (!billing.mockEnabled()) return reply.code(404).send({ error: 'Not found' });
    const me = (request.user as any).id as string;
    await mongoDb.applySubscriptionPatch(me, { status: 'canceled', cancelAtPeriodEnd: true, currentPeriodEnd: Date.now() - 1000 });
    return { success: true };
  });

  // Webhooks: their own encapsulated plugin so the JSON body arrives as the RAW buffer the signature is computed over
  // (other routes keep the normal JSON parser).
  await app.register(async (hooks) => {
    hooks.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 512 * 1024 }, (_req, body, done) => done(null, body));

    const process_ = async (provider: 'razorpay' | 'stripe', request: any, reply: any) => {
      const raw: Buffer = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const secret = process.env[provider === 'razorpay' ? 'RAZORPAY_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET'];
      if (!secret) return reply.code(503).send({ error: 'Webhook not configured' });
      const valid = provider === 'razorpay'
        ? billing.verifyRazorpaySignature(raw, request.headers['x-razorpay-signature'])
        : billing.verifyStripeSignature(raw, request.headers['stripe-signature']);
      if (!valid) return reply.code(400).send({ error: 'Invalid signature' });
      let event: any;
      try { event = JSON.parse(raw.toString('utf8')); } catch { return reply.code(400).send({ error: 'Invalid payload' }); }
      const mapped = provider === 'razorpay' ? billing.mapRazorpayEvent(event, request.headers['x-razorpay-event-id'], raw) : billing.mapStripeEvent(event);
      if (!mapped) return { received: true, ignored: true };
      if (!(await mongoDb.claimBillingEvent(mapped.eventId, provider))) return { received: true, duplicate: true };
      try {
        if (mapped.refund) {
          // Refunds are recorded for the operator and NEVER revoke access automatically (cancel in the dashboard if intended).
          let refundUser = await mongoDb.findPaymentUserByRefs(mapped.refund.refs);
          if (!refundUser && mapped.providerCustomerId) refundUser = (await mongoDb.findSubscriptionByCustomerId(mapped.providerCustomerId))?.['_id'] ?? null;
          await mongoDb.recordBillingAudit({ eventId: mapped.eventId, provider, type: 'refund', userId: refundUser, amount: mapped.refund.amount, currency: mapped.refund.currency, refs: mapped.refund.refs, refundId: mapped.refund.refundId });
          return { received: true, refund: true };
        }
        let userId = mapped.userId;
        if (!userId && mapped.providerSubscriptionId) userId = (await mongoDb.findSubscriptionByProviderId(mapped.providerSubscriptionId))?.['_id'] ?? null;
        if (!userId || !(await mongoDb.getUserById(userId))) return { received: true, ignored: true };
        const patch: Record<string, any> = { ...mapped.patch };
        if (mapped.providerSubscriptionId) patch.providerSubscriptionId = mapped.providerSubscriptionId;
        if (Object.keys(mapped.patch).length) await mongoDb.applySubscriptionPatch(userId, patch);
        if (mapped.payment) await mongoDb.recordBillingPayment({ eventId: mapped.eventId, userId, provider, ...mapped.payment });
      } catch (err) {
        await mongoDb.releaseBillingEvent(mapped.eventId).catch(() => {}); // let the provider retry
        throw err;
      }
      return { received: true };
    };
    hooks.post('/api/billing/webhooks/razorpay', (request, reply) => process_('razorpay', request, reply));
    hooks.post('/api/billing/webhooks/stripe', (request, reply) => process_('stripe', request, reply));
  });

  // --- Plans ----------------------------------------------------------------------------------------------
  // Everything is validated by zod (services/plans.ts); ids, host, participants, chat author and timestamps are always
  // set by the server. Only members can read a plan; others need the invite token that members can share.
  const planCreateLimiter = new KeyedLimiter(envInt('RATE_LIMIT_PLAN_CREATE_MAX', 20), 60 * 60_000);
  const planJoinLimiter = new KeyedLimiter(envInt('RATE_LIMIT_PLAN_JOIN_MAX', 20), 60_000);
  const planWriteLimiter = new KeyedLimiter(envInt('RATE_LIMIT_PLAN_WRITE_MAX', 120), 60_000);
  const planNotFound = (reply: any) => reply.code(404).send({ error: 'Plan not found' });
  const tokenMatches = (a: unknown, b: unknown) =>
    typeof a === 'string' && typeof b === 'string' && a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));

  /** Live in-app alert or, when the person has no tab open, a push banner. */
  const notifyPlanMembers = (userIds: string[], payload: { id: string; title: string; body: string; link: string }) => {
    for (const uid of new Set(userIds)) {
      const live = deliverLive(uid, { type: 'plan:notification', payload });
      if (!live) pushOffline(uid, { title: payload.title, body: payload.body, tag: `plan:${payload.id}`, url: payload.link });
    }
  };

  /** Friends of `hostId` from `ids`, as ready-to-store invited participants. */
  const buildInvitees = async (hostId: string, ids: string[], skip: Set<string>) => {
    const out: any[] = [];
    for (const id of ids) {
      if (id === hostId || skip.has(id)) continue;
      if (!(await mongoDb.areFriends(hostId, id))) continue;
      const u = await mongoDb.getUserById(id);
      if (!u) continue;
      skip.add(id);
      out.push({ userId: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl || null, status: 'INVITED', isHost: false });
    }
    return out;
  };

  /** presentPlan + each participant's membership tier (for badges). */
  const presentPlanT = async (doc: any, viewerId: string) => {
    const shaped: any = presentPlan(doc, viewerId);
    if (!shaped || !Array.isArray(shaped.participants)) return shaped;
    const tiers = await mongoDb.getMembershipTiers(shaped.participants.map((p: any) => p.userId));
    shaped.participants = shaped.participants.map((p: any) => ({ ...p, membershipTier: tiers.get(p.userId) || 'free' }));
    return shaped;
  };

  app.get('/api/plans', async (request) => {
    const me = (request.user as any).id as string;
    const plans = await mongoDb.getPlansForUser(me);
    const shaped = await Promise.all(plans.map((p: any) => presentPlanT(p, me)));
    shaped.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return { plans: shaped };
  });

  app.post('/api/plans', async (request, reply) => {
    const user = await getRequestUser(request);
    if (planCreateLimiter.hit(`plan:${user.id}`)) return tooMany(reply);
    const parsed = createPlanSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
    const input = parsed.data;
    if (isPlanPast(input)) return reply.code(400).send({ error: 'Pick a date and time in the future.' });
    const ent = await entitlementOf(user.id);
    const limits = TIER_INFO[ent.tier].limits;
    if (input.recurring !== 'none' && !limits.recurringPlans) {
      return reply.code(403).send({ error: 'Recurring plans are a Watch+ feature. Upgrade to repeat a plan weekly or monthly.', code: 'UPGRADE_REQUIRED', requiredTier: 'plus' });
    }
    if ((await mongoDb.countHostedPlans(user.id)) >= limits.hostedPlans) {
      return reply.code(403).send({
        error: ent.tier === 'free'
          ? `You can host up to ${limits.hostedPlans} plans on the free plan. Delete old ones, or upgrade to Watch+ to host up to ${TIER_INFO.plus.limits.hostedPlans}.`
          : `You can host up to ${limits.hostedPlans} plans. Delete old ones first.`,
        code: 'PLAN_LIMIT_REACHED',
        ...(ent.tier === 'free' ? { requiredTier: 'plus' } : {}),
        limit: limits.hostedPlans
      });
    }

    const id = `plan-${Date.now()}-${nanoid(6)}`;
    const seen = new Set<string>([user.id]);
    const invitees = await buildInvitees(user.id, input.invitedUserIds, seen);
    const now = Date.now();
    const { invitedUserIds: _ignored, voting, ...fields } = input;
    void _ignored;
    const doc = {
      ...fields,
      id,
      hostId: user.id, // never from the body
      activities: input.activities.map((a, i) => ({ ...a, id: a.id || `act-${i + 1}-${nanoid(4)}`, actionLabel: a.actionLabel || 'Open' })),
      participants: [{ userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl || null, status: 'GOING', isHost: true }, ...invitees],
      voting: voting
        ? {
            id: `vote-${nanoid(6)}`,
            question: voting.question,
            type: voting.type,
            isClosed: false,
            options: voting.options.map((o) => ({ id: o.id || `opt-${nanoid(6)}`, title: o.title, subtitle: o.subtitle, type: o.type || voting.type, votes: [] as string[] }))
          }
        : null,
      chatMessages: [
        { id: `msg-${now}-${nanoid(4)}`, userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl || null, text: `Hey everyone! I created "${input.title}". Let's make it awesome!`, createdAt: now }
      ],
      inviteToken: randomBytes(16).toString('base64url'),
      createdAt: now,
      reminderSentAt: null,
      ...planSchedule(input)
    };
    await mongoDb.createPlan(doc);

    if (invitees.length) {
      notifyPlanMembers(invitees.map((i) => i.userId), {
        id,
        title: `${user.displayName} invited you`,
        body: `${input.title}: ${formatPlanDate(input.date)}, ${input.time}`,
        link: `/plans/${id}`
      });
    }
    return { success: true, plan: await presentPlanT(doc, user.id) };
  });

  app.get('/api/plans/:id', async (request, reply) => {
    const me = (request.user as any).id as string;
    const { id } = request.params as { id: string };
    const invite = (request.query as any)?.invite;
    const plan = await mongoDb.getPlanById(id);
    if (!plan) return planNotFound(reply);
    if (isParticipant(plan, me)) return { plan: await presentPlanT(plan, me) };
    // Not a member: only someone holding the invite token gets even a preview. Otherwise the plan "does not exist".
    if (tokenMatches(invite, plan.inviteToken)) return { plan: presentPlanPreview(plan) };
    return planNotFound(reply);
  });

  app.put('/api/plans/:id', async (request, reply) => {
    const me = (request.user as any).id as string;
    const { id } = request.params as { id: string };
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, me)) return planNotFound(reply);
    if (plan.hostId !== me) return reply.code(403).send({ error: 'Only the host can edit this plan' });
    if (planWriteLimiter.hit(`pw:${me}`)) return tooMany(reply);

    const parsed = updatePlanSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
    if (parsed.data.recurring && parsed.data.recurring !== 'none' && parsed.data.recurring !== plan.recurring && !TIER_INFO[(await entitlementOf(me)).tier].limits.recurringPlans) {
      return reply.code(403).send({ error: 'Recurring plans are a Watch+ feature. Upgrade to repeat a plan weekly or monthly.', code: 'UPGRADE_REQUIRED', requiredTier: 'plus' });
    }
    const merged = { ...plan, ...parsed.data };
    const timeChanged = ['date', 'time', 'endTime', 'timezone', 'reminder'].some((k) => k in parsed.data);
    if (timeChanged && isPlanPast(merged)) return reply.code(400).send({ error: 'Pick a date and time in the future.' });

    const updates: Record<string, any> = { ...parsed.data };
    if (updates.activities) {
      updates.activities = updates.activities.map((a: any, i: number) => ({ ...a, id: a.id || `act-${i + 1}-${nanoid(4)}`, actionLabel: a.actionLabel || 'Open' }));
    }
    if (timeChanged) Object.assign(updates, planSchedule(merged), { reminderSentAt: null });
    const updated = await mongoDb.updatePlan(id, updates);
    if (timeChanged) {
      notifyPlanMembers(
        (plan.participants || []).map((p: any) => p.userId).filter((u: string) => u !== me),
        { id, title: `Plan updated: ${merged.title}`, body: `${formatPlanDate(merged.date)}, ${merged.time}`, link: `/plans/${id}` }
      );
    }
    return { success: true, plan: await presentPlanT(updated, me) };
  });

  app.post('/api/plans/:id/rsvp', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getRequestUser(request);
    const status = (request.body as any)?.status;
    if (!RSVP_STATUSES.includes(status) || status === 'INVITED') return reply.code(400).send({ error: 'Choose Going, Maybe or Can\'t go' });
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, user.id)) return planNotFound(reply); // not invited: no way in, no existence leak
    if (planWriteLimiter.hit(`pw:${user.id}`)) return tooMany(reply);
    if (plan.hostId === user.id && status === 'CANT_GO') return reply.code(400).send({ error: 'The host cannot decline their own plan. Delete it instead.' });
    await mongoDb.setPlanParticipantStatus(id, user.id, status);
    return { success: true, plan: await presentPlanT(await mongoDb.getPlanById(id), user.id) };
  });

  /** Opening a shared invite link: the token proves the host (or a member) shared it. */
  app.post('/api/plans/:id/join', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getRequestUser(request);
    if (planJoinLimiter.hit(`pj:${user.id}`)) return tooMany(reply);
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !tokenMatches((request.body as any)?.token, plan.inviteToken)) return planNotFound(reply);
    if (isPlanPast(plan)) return reply.code(400).send({ error: 'This plan is already over.' });
    if (!isParticipant(plan, user.id)) {
      const added = await mongoDb.addPlanParticipant(
        id,
        { userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl || null, status: 'INVITED', isHost: false },
        MAX_PARTICIPANTS
      );
      if (!added) return reply.code(409).send({ error: 'This plan is full.' });
      notifyPlanMembers([plan.hostId], { id, title: `${user.displayName} joined`, body: plan.title, link: `/plans/${id}` });
    }
    return { success: true, plan: await presentPlanT(await mongoDb.getPlanById(id), user.id) };
  });

  app.post('/api/plans/:id/invite', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getRequestUser(request);
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, user.id)) return planNotFound(reply);
    if (plan.hostId !== user.id) return reply.code(403).send({ error: 'Only the host can invite people' });
    if (planWriteLimiter.hit(`pw:${user.id}`)) return tooMany(reply);
    const ids = Array.isArray((request.body as any)?.userIds) ? ((request.body as any).userIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, MAX_PARTICIPANTS) : [];
    const skip = new Set<string>((plan.participants || []).map((p: any) => p.userId));
    const invitees = await buildInvitees(user.id, ids, skip);
    const added: string[] = [];
    for (const inv of invitees) if (await mongoDb.addPlanParticipant(id, inv, MAX_PARTICIPANTS)) added.push(inv.userId);
    if (added.length) {
      notifyPlanMembers(added, { id, title: `${user.displayName} invited you`, body: `${plan.title}: ${formatPlanDate(plan.date)}, ${plan.time}`, link: `/plans/${id}` });
    }
    return { success: true, invited: added.length, plan: await presentPlanT(await mongoDb.getPlanById(id), user.id) };
  });

  app.post('/api/plans/:id/leave', async (request, reply) => {
    const { id } = request.params as { id: string };
    const me = (request.user as any).id as string;
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, me)) return planNotFound(reply);
    if (plan.hostId === me) return reply.code(400).send({ error: 'The host cannot leave. Delete the plan instead.' });
    await mongoDb.removePlanParticipant(id, me);
    return { success: true };
  });

  app.post('/api/plans/:id/vote', async (request, reply) => {
    const { id } = request.params as { id: string };
    const me = (request.user as any).id as string;
    const { optionId } = (request.body || {}) as { optionId?: unknown };
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, me)) return planNotFound(reply);
    if (!plan.voting) return reply.code(404).send({ error: 'This plan has no poll' });
    if (plan.voting.isClosed) return reply.code(409).send({ error: 'Voting is closed' });
    if (typeof optionId !== 'string') return reply.code(400).send({ error: 'optionId is required' });
    if (planWriteLimiter.hit(`pw:${me}`)) return tooMany(reply);
    if (!(await mongoDb.setPlanVote(id, me, optionId))) return reply.code(404).send({ error: 'Option not found' });
    return { success: true, plan: await presentPlanT(await mongoDb.getPlanById(id), me) };
  });

  app.post('/api/plans/:id/vote-option', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getRequestUser(request);
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, user.id)) return planNotFound(reply);
    if (!plan.voting) return reply.code(404).send({ error: 'This plan has no poll' });
    const title = plainText((request.body as any)?.title, 80);
    if (!title) return reply.code(400).send({ error: 'title is required' });
    if (planWriteLimiter.hit(`pw:${user.id}`)) return tooMany(reply);
    const ok = await mongoDb.addPlanVoteOption(id, { id: `opt-${nanoid(6)}`, title, type: plan.voting.type, votes: [user.id] }, MAX_VOTE_OPTIONS);
    if (!ok) return reply.code(409).send({ error: 'The poll is closed or already has the maximum number of options' });
    return { success: true, plan: await presentPlanT(await mongoDb.getPlanById(id), user.id) };
  });

  app.post('/api/plans/:id/vote/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const me = (request.user as any).id as string;
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, me)) return planNotFound(reply);
    if (plan.hostId !== me) return reply.code(403).send({ error: 'Only the host can confirm the winner' });
    const option = (plan.voting?.options || []).find((o: any) => o.id === (request.body as any)?.optionId);
    if (!option) return reply.code(404).send({ error: 'Option not found' });
    await mongoDb.confirmPlanVote(id, option.title);
    return { success: true, plan: await presentPlanT(await mongoDb.getPlanById(id), me) };
  });

  app.post('/api/plans/:id/chat', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getRequestUser(request);
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, user.id)) return planNotFound(reply);
    const text = plainText((request.body as any)?.text, 1000);
    if (!text) return reply.code(400).send({ error: 'text is required' });
    if (planWriteLimiter.hit(`pw:${user.id}`)) return tooMany(reply);

    const newMsg = { id: `msg-${Date.now()}-${nanoid(4)}`, userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl || null, text, createdAt: Date.now() };
    await mongoDb.pushPlanChat(id, newMsg);
    return { success: true, message: newMsg };
  });

  app.delete('/api/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const me = (request.user as any).id as string;
    const plan = await mongoDb.getPlanById(id);
    if (!plan || !isParticipant(plan, me)) return planNotFound(reply);
    if (plan.hostId !== me) return reply.code(403).send({ error: 'Only the host can delete this plan' });
    const deleted = await mongoDb.deletePlan(id);
    return { success: deleted, id };
  });

  // Reminders and recurring plans. One tick per minute; `claimPlanReminder` makes each reminder fire exactly once
  // even if several server instances run.
  const runPlanScheduler = async (now = Date.now()) => {
    for (const plan of await mongoDb.getPlansWithReminderDue(now)) {
      if (!(await mongoDb.claimPlanReminder(plan._id))) continue;
      const who = (plan.participants || []).filter((p: any) => p.status !== 'CANT_GO').map((p: any) => p.userId);
      const minutes = Math.max(1, Math.round((plan.startsAt - now) / 60_000));
      const when = minutes >= 90 ? `in ${Math.round(minutes / 60)} hours` : `in ${minutes} min`;
      notifyPlanMembers(who, { id: plan.id || plan._id, title: `${plan.title} starts ${when}`, body: `${plan.time} (${plan.timezone})`, link: `/plans/${plan.id || plan._id}` });
    }
    for (const plan of await mongoDb.getFinishedRecurringPlans(now)) {
      let date = plan.date as string;
      let next = nextOccurrenceDate(date, plan.recurring);
      // catch up if the server was off for a few cycles
      while (next && planSchedule({ ...plan, date: next }).endsAt !== null && (planSchedule({ ...plan, date: next }).endsAt as number) < now) {
        date = next;
        next = nextOccurrenceDate(date, plan.recurring);
      }
      if (!next) continue;
      await mongoDb.rollPlanForward(plan._id, plan.endsAt, { date: next, ...planSchedule({ ...plan, date: next }) }, true);
    }
  };
  const planSchedulerTimer = setInterval(() => void runPlanScheduler().catch((err) => app.log.warn({ err }, 'plan scheduler failed')), 60_000);
  planSchedulerTimer.unref();
  app.addHook('onClose', async () => clearInterval(planSchedulerTimer));

  // --- "Notify me" for coming-soon games (GR-23) --------------------------------------------------------------
  // Owner flow: scripts/notify-game-launch.mjs flags interest rows `notifyPending`; this job sends one live/push
  // notification per flagged row and deletes it.
  const interestLimiter = new KeyedLimiter(envInt('RATE_LIMIT_GAME_INTEREST_MAX', 30), 60_000);
  const gameInterestId = (request: any) => {
    const raw = (request.body as any)?.gameId ?? (request.params as any)?.gameId;
    return isComingSoonGame(raw) ? raw : null;
  };
  app.get('/api/games/interest', async (request) => {
    const me = (request.user as any).id as string;
    return { success: true, gameIds: (await mongoDb.getGameInterest(me)).filter(isComingSoonGame) };
  });
  app.post('/api/games/interest', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (interestLimiter.hit(`interest:${me}`)) return tooMany(reply);
    const gameId = gameInterestId(request);
    if (!gameId) return reply.code(400).send({ error: 'This game is not on the coming-soon list.' });
    await mongoDb.addGameInterest(me, gameId);
    return { success: true, gameId, title: COMING_SOON_GAMES[gameId] };
  });
  app.delete('/api/games/interest/:gameId', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (interestLimiter.hit(`interest:${me}`)) return tooMany(reply);
    const gameId = gameInterestId(request);
    if (!gameId) return reply.code(400).send({ error: 'This game is not on the coming-soon list.' });
    await mongoDb.removeGameInterest(me, gameId);
    return { success: true, gameId };
  });
  const runGameLaunch = () => runGameLaunchJob(mongoDb, (userId, n) => {
    const live = deliverLive(userId, { type: 'game:launched', payload: n });
    if (!live) pushOffline(userId, { title: n.title, body: n.body, tag: n.id, url: n.link });
  });
  const gameLaunchTimer = setInterval(() => void runGameLaunch().catch((err) => app.log.warn({ err }, 'game launch job failed')), 60_000);
  gameLaunchTimer.unref();
  app.addHook('onClose', async () => clearInterval(gameLaunchTimer));

  // --- Web Push subscription management (all routes require a signed-in user via the global gate) ------------
  app.get('/api/push/config', async () => ({ enabled: pushService.isEnabled(), publicKey: pushService.publicKey }));

  app.post('/api/push/subscribe', async (request, reply) => {
    const me = (request.user as any).id as string;
    if (!pushService.isEnabled()) {
      return reply.code(503).send({ error: 'Push notifications are not enabled on this server' });
    }
    const sub = parseSubscription((request.body as any)?.subscription);
    if (!sub) {
      return reply.code(400).send({ error: 'Invalid push subscription' });
    }
    const existing = (await mongoDb.listPushSubscriptions(me)).some((s) => s.endpoint === sub.endpoint);
    if (!existing && (await mongoDb.countPushSubscriptions(me)) >= MAX_SUBSCRIPTIONS_PER_USER) {
      return reply.code(429).send({ error: `You can register at most ${MAX_SUBSCRIPTIONS_PER_USER} devices` });
    }
    await mongoDb.savePushSubscription(me, sub, request.headers['user-agent']);
    return { success: true };
  });

  app.post('/api/push/unsubscribe', async (request, reply) => {
    const me = (request.user as any).id as string;
    const endpoint = (request.body as any)?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length > 1000) {
      return reply.code(400).send({ error: 'endpoint is required' });
    }
    await mongoDb.deletePushSubscription(endpoint, me);
    return { success: true };
  });

  // --- Real-Time WebSocket Endpoint ---
  app.get('/ws/rooms/:slug', { websocket: true }, async (connection: any, req) => {
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

    // Auth: a one-time ticket from POST /api/auth/ws-ticket (never a JWT in the URL)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const user = consumeWsTicket(url.searchParams.get('ticket'));

    if (!user) {
      ws.send(
        JSON.stringify({
          type: 'error:notification',
          payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' }
        })
      );
      ws.close(4001, 'AUTH_REQUIRED');
      return;
    }

    // Capacity follows the HOST's pass, theme rights follow the person changing the theme.
    let capacity = TIER_INFO.free.limits.roomCapacity;
    let tier: MembershipTier = 'free';
    try {
      tier = (await entitlementOf(user.id)).tier;
      const hostTier = room.hostId === user.id ? tier : (await entitlementOf(room.hostId)).tier;
      capacity = TIER_INFO[hostTier].limits.roomCapacity;
    } catch {}
    if (ws.readyState !== 1) return;
    syncManager.handleConnection(ws, room, user, { capacity, tier });
  });

  // --- Real-Time Game Room WebSocket Endpoint ---
  app.get('/ws/games/:code', { websocket: true }, async (connection: any, req) => {
    const ws: any = connection.socket || connection;
    const { code } = req.params as { code: string };
    const cleanCode = (code || '').trim().toUpperCase();

    const url = new URL(req.url, `http://${req.headers.host}`);
    const requestedGameType = url.searchParams.get('gameType');

    const ticketUser = consumeWsTicket(url.searchParams.get('ticket'));
    if (!ticketUser) {
      ws.send(
        JSON.stringify({
          type: 'error:notification',
          payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' }
        })
      );
      ws.close(4001, 'AUTH_REQUIRED');
      return;
    }

    let user: { id: string; displayName: string; avatarUrl?: string | null };
    try {
      const dbUser = (await mongoDb.getUserById(ticketUser.id)) || db.getUserById(ticketUser.id);
      user = {
        id: ticketUser.id,
        displayName: dbUser?.displayName || ticketUser.displayName || 'Player',
        avatarUrl: dbUser?.avatarUrl || ticketUser.avatarUrl || null
      };
      await mongoDb.ensureUserPartnerCode(user.id, user.displayName, user.avatarUrl || undefined, false, undefined);
    } catch {
      ws.close(4001, 'AUTH_REQUIRED');
      return;
    }

    let room = gameRoomManager.getRoomByCode(cleanCode);

    // Unknown code: only create it when the client explicitly asks (?create=1), the code is well-formed,
    // and the user does not already host several open lobbies (prevents room squatting / DB flooding).
    if (!room && url.searchParams.get('create') === '1' && ROOM_CODE_RE.test(cleanCode) && db.countOpenGameRoomsByHost(user.id) < 5 && !wsCreateLimiter.hit(`wscreate:${user.id}`)) {
      try {
        const resolvedGame = resolveGameType(requestedGameType || cleanCode);
        const def = GAME_DEFINITIONS[resolvedGame];
        // VIP games: a free user cannot create the room through a direct link either (they can join existing ones)
        const refusal = await vipHostRefusal(user.id, resolvedGame);
        if (refusal) {
          ws.send(JSON.stringify({ type: 'error:notification', payload: { code: refusal.code, message: refusal.error, requiredTier: refusal.requiredTier } }));
          ws.close(4402, 'UPGRADE_REQUIRED');
          return;
        }
        const maxPlayers = resolvedGame === 'ludo' ? 4 : (resolvedGame === 'tambola' ? 20 : (resolvedGame === 'imposter' || resolvedGame === 'emoji-charades' || resolvedGame === 'mafia-night' || resolvedGame === 'quiz-show' || resolvedGame === 'murder-mystery' || resolvedGame === 'tournament' ? def.maxPlayers : (def?.playerOptions[0] || 2)));
        room = gameRoomManager.createGameRoom({
          hostUser: user,
          gameType: resolvedGame,
          maxPlayers,
          isPrivate: true, // a room created by a typo / direct link must not show up in public matchmaking (LU-9)
          customCode: cleanCode
        });
        console.log(`[GameRoom] Auto-created game room "${cleanCode}" for ${resolvedGame} hosted by ${user.displayName} (${user.id})`);
      } catch (err: any) {
        console.error(`[GameRoom] Failed to auto-create room ${cleanCode}:`, err);
      }
    }

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

    // Read-only spectating (?spectate=1): only friends of a player may watch a PLAYING / FINISHED room.
    // The manager does the status / cap / rate-limit checks; a seated player is always a normal player.
    const wantsSpectate = url.searchParams.get('spectate') === '1';
    let canSpectate = false;
    if (wantsSpectate && !room.players.some(p => p.userId === user.id)) {
      canSpectate = await isFriendOfAnyPlayer(user.id, room.players);
    }
    gameRoomManager.registerClient(ws, room.id, user, { spectate: wantsSpectate, canSpectate });
  });

  // --- Real-Time Global Presence WebSocket Endpoint ---
  app.get('/ws/presence', { websocket: true }, (connection: any, req) => {
    const ws: any = connection.socket || connection;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const deviceId = str(url.searchParams.get('deviceId'), 100);
    const rawType = url.searchParams.get('deviceType');
    const deviceType = rawType === 'mobile' || rawType === 'tablet' || rawType === 'desktop' ? rawType : undefined;
    const deviceToken = str(url.searchParams.get('deviceToken'), 4096);
    const browserName = str(url.searchParams.get('browserName'), 100);

    const ticketUser = consumeWsTicket(url.searchParams.get('ticket'));
    if (!ticketUser) {
      try {
        ws.send(JSON.stringify({ type: 'error:notification', payload: { code: 'AUTH_REQUIRED', message: 'Authentication required. Please sign in.' } }));
      } catch {}
      ws.close(4001, 'AUTH_REQUIRED');
      return;
    }
    const user: { id: string; displayName: string; partnerCode?: string; avatarUrl?: string | null } = {
      id: ticketUser.id,
      displayName: ticketUser.displayName,
      avatarUrl: ticketUser.avatarUrl
    };

    presenceManager.registerSocket(ws, user, {
      deviceId,
      deviceType,
      deviceToken,
      browserName
    });
  });

  return { app, db, mongoDb, syncManager, gameRoomManager, presenceManager, runPlanScheduler };
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
    // pm2 / docker stop send SIGTERM: close sockets and the HTTP server cleanly instead of dropping everyone mid-message
    for (const sig of ['SIGTERM', 'SIGINT'] as const) {
      process.once(sig, () => {
        console.log(`${sig} received, shutting down`);
        const force = setTimeout(() => process.exit(1), 8000);
        force.unref();
        app.close().finally(() => process.exit(0));
      });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
