import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isCatalogImagePath, isWatchlistKey } from '@synccinema/common';
import { cleanSnapshot } from '../services/catalog/watchlist.js';
import { KeyedLimiter } from '../util/rateLimit.js';
import {
  addItem, addMember, createList, isMember, leaveList, removeItem, toggleVote, viewOf, LISTS_PER_USER,
  type Change, type SharedList, type SharedListStore
} from '../services/sharedLists.js';

export interface ListRouteDeps {
  store: SharedListStore;
  areFriends(a: string, b: string): Promise<boolean>;
  /** tells people about a change (a push when they are away); never throws */
  notify?(userIds: string[], note: { title: string; body: string; url: string }): void;
  now?: () => number;
  writesPerMin?: number;
}

type User = { id: string; displayName: string };

/** Shared watch lists: `/api/lists`. Members only; every read and write is checked against the list's member ids. */
export async function registerListRoutes(app: FastifyInstance, deps: ListRouteDeps): Promise<void> {
  const { store } = deps;
  const now = deps.now ?? Date.now;
  const limiter = new KeyedLimiter(deps.writesPerMin ?? 60, 60_000);

  const requireUser = async (request: FastifyRequest, reply: FastifyReply): Promise<User | null> => {
    try {
      let u = request.user as any;
      if (!u) u = await request.jwtVerify();
      if (!u || u.isAnonymous || typeof u.id !== 'string') throw new Error('anon');
      return { id: u.id, displayName: typeof u.displayName === 'string' ? u.displayName : 'A friend' };
    } catch {
      reply.code(401).send({ error: 'Authentication required' });
      return null;
    }
  };
  const err = (reply: FastifyReply, status: number, error: string) => reply.code(status).send({ error });
  const idOf = (request: FastifyRequest) => String((request.params as any)?.id ?? '').slice(0, 40);

  /** Loads the list, applies `change`, saves it; retries when somebody else saved in between. */
  async function mutate(id: string, userId: string, change: (l: SharedList) => Change<SharedList | null>): Promise<{ status: number; error: string } | { list: SharedList | null; before: SharedList }> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = await store.get(id);
      if (!before || !isMember(before, userId)) return { status: 404, error: 'List not found.' }; // not a member looks the same as missing
      const res = change(before);
      if (!res.ok) return { status: res.status, error: res.error };
      if (res.list === null) { await store.remove(id); return { list: null, before }; }
      if (await store.replace(res.list, before.rev)) return { list: { ...res.list, rev: before.rev + 1 }, before };
    }
    return { status: 409, error: 'The list changed while you were editing. Try again.' };
  }
  const others = (l: SharedList, me: string) => l.memberIds.filter((m) => m !== me);

  app.get('/api/lists', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    reply.header('Cache-Control', 'no-store');
    return { lists: (await store.listFor(user.id)).map((l) => viewOf(l, user.id)) };
  });

  app.post('/api/lists', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (limiter.hit(`l:${user.id}`)) return err(reply, 429, 'Too many requests. Please slow down.');
    const body = (request.body ?? {}) as any;
    const friendIds: string[] = Array.isArray(body.memberIds) ? body.memberIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 20) : [];
    const made = createList(user.id, body.name, friendIds, now());
    if (!made.ok) return err(reply, made.status, made.error);
    for (const f of made.list.memberIds.slice(1)) if (!(await deps.areFriends(user.id, f))) return err(reply, 403, 'You can only share a list with your friends.');
    if ((await store.countOwned(user.id)) >= LISTS_PER_USER) return err(reply, 409, `You can own up to ${LISTS_PER_USER} lists.`);
    await store.create(made.list);
    deps.notify?.(others(made.list, user.id), { title: `${user.displayName} started a list`, body: `“${made.list.name}” — add movies and vote on what to watch.`, url: `/lists/${made.list.id}` });
    return reply.code(201).send({ list: viewOf(made.list, user.id) });
  });

  app.get('/api/lists/:id', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    const l = await store.get(idOf(request));
    if (!l || !isMember(l, user.id)) return err(reply, 404, 'List not found.');
    reply.header('Cache-Control', 'no-store');
    return { list: viewOf(l, user.id) };
  });

  app.post('/api/lists/:id/items', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (limiter.hit(`l:${user.id}`)) return err(reply, 429, 'Too many requests. Please slow down.');
    const raw = (request.body ?? {}) as any;
    const snap = cleanSnapshot(raw);
    if (!snap || snap.mediaType !== raw.mediaType || (raw.posterPath && !isCatalogImagePath(raw.posterPath))) return err(reply, 400, 'Invalid title.');
    const res = await mutate(idOf(request), user.id, (l) => addItem(l, user.id, snap, now()));
    if ('error' in res) return err(reply, res.status, res.error);
    deps.notify?.(others(res.list!, user.id), { title: `${user.displayName} added ${snap.title}`, body: `to “${res.list!.name}”. Vote if you want to watch it.`, url: `/lists/${res.list!.id}` });
    return reply.code(201).send({ list: viewOf(res.list!, user.id) });
  });

  app.delete('/api/lists/:id/items/:titleKey', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (limiter.hit(`l:${user.id}`)) return err(reply, 429, 'Too many requests. Please slow down.');
    const key = (request.params as any)?.titleKey;
    if (!isWatchlistKey(key)) return err(reply, 400, 'Invalid title.');
    const res = await mutate(idOf(request), user.id, (l) => removeItem(l, user.id, key));
    if ('error' in res) return err(reply, res.status, res.error);
    return { list: viewOf(res.list!, user.id) };
  });

  app.post('/api/lists/:id/items/:titleKey/vote', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (limiter.hit(`l:${user.id}`)) return err(reply, 429, 'Too many requests. Please slow down.');
    const key = (request.params as any)?.titleKey;
    if (!isWatchlistKey(key)) return err(reply, 400, 'Invalid title.');
    const res = await mutate(idOf(request), user.id, (l) => toggleVote(l, user.id, key));
    if ('error' in res) return err(reply, res.status, res.error);
    return { list: viewOf(res.list!, user.id) };
  });

  app.post('/api/lists/:id/members', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (limiter.hit(`l:${user.id}`)) return err(reply, 429, 'Too many requests. Please slow down.');
    const userId = (request.body as any)?.userId;
    if (typeof userId !== 'string' || !userId) return err(reply, 400, 'Choose a friend to add.');
    if (!(await deps.areFriends(user.id, userId))) return err(reply, 403, 'You can only share a list with your friends.');
    const res = await mutate(idOf(request), user.id, (l) => addMember(l, user.id, userId));
    if ('error' in res) return err(reply, res.status, res.error);
    deps.notify?.([userId], { title: `${user.displayName} added you to a list`, body: `“${res.list!.name}” — add movies and vote on what to watch.`, url: `/lists/${res.list!.id}` });
    return { list: viewOf(res.list!, user.id) };
  });

  /** leave a list (the owner leaving passes it on; the last person leaving deletes it) */
  app.post('/api/lists/:id/leave', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    const res = await mutate(idOf(request), user.id, (l) => leaveList(l, user.id));
    if ('error' in res) return err(reply, res.status, res.error);
    return { success: true };
  });
}
