import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { KeyedLimiter } from '../util/rateLimit.js';
import { cleanThemeId, type ChatThemeStore } from '../services/chatTheme.js';

export interface ChatThemeDeps {
  store: ChatThemeStore;
  areConnected(a: string, b: string): Promise<boolean>;
  /** the canonical conversation id of two users */
  convId(a: string, b: string): string;
  /** tells both people live (never throws) */
  tell(userIds: string[], payload: object): void;
  now?: () => number;
}

/** `GET /api/chat/theme?userId=<friend>` and `PUT /api/chat/theme { userId, themeId|null }`: the look of one chat, shared by both people. */
export async function registerChatThemeRoutes(app: FastifyInstance, deps: ChatThemeDeps): Promise<void> {
  const limiter = new KeyedLimiter(30, 60_000);
  const now = deps.now ?? Date.now;
  const userOf = async (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null> => {
    try {
      let u = request.user as any;
      if (!u) u = await request.jwtVerify();
      if (!u || u.isAnonymous || typeof u.id !== 'string') throw new Error('anon');
      return { id: u.id };
    } catch {
      reply.code(401).send({ error: 'Authentication required' });
      return null;
    }
  };
  const friendOf = async (me: string, raw: unknown, reply: FastifyReply): Promise<string | null> => {
    const other = typeof raw === 'string' ? raw.slice(0, 64) : '';
    if (!other || other === me) { reply.code(400).send({ error: 'Choose a chat.' }); return null; }
    if (!(await deps.areConnected(me, other))) { reply.code(403).send({ error: 'You can only change the theme of a chat with a friend.' }); return null; }
    return other;
  };

  app.get('/api/chat/theme', async (request, reply) => {
    const me = await userOf(request, reply);
    if (!me) return reply;
    const other = await friendOf(me.id, (request.query as any)?.userId, reply);
    if (!other) return reply;
    reply.header('Cache-Control', 'no-store');
    const row = await deps.store.get(deps.convId(me.id, other));
    return { themeId: row?.themeId ?? null, setBy: row?.setBy ?? null };
  });

  app.put('/api/chat/theme', async (request, reply) => {
    const me = await userOf(request, reply);
    if (!me) return reply;
    if (limiter.hit(`t:${me.id}`)) return reply.code(429).send({ error: 'Too many changes. Please slow down.' });
    const body = (request.body ?? {}) as any;
    const themeId = cleanThemeId(body.themeId);
    if (themeId === undefined) return reply.code(400).send({ error: 'Unknown theme.' });
    const other = await friendOf(me.id, body.userId, reply);
    if (!other) return reply;
    const conversationId = deps.convId(me.id, other);
    await deps.store.set(conversationId, themeId, me.id, now());
    deps.tell([me.id, other], { type: 'chat:theme', conversationId, themeId, by: me.id, users: [me.id, other] });
    return { success: true, themeId };
  });
}
