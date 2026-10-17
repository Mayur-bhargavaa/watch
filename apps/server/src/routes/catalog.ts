import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CATALOG_SORTS,
  CATALOG_TYPES,
  MATCH_MODES,
  MATCH_MOODS,
  MATCH_TIMES,
  LINK_CATEGORY_MAX,
  LINK_PLATFORM_MAX,
  LINK_TAGLINE_MAX,
  LINK_TITLE_MAX,
  LINK_URL_MAX,
  WATCHLIST_MAX_ITEMS,
  capabilitiesForProvider,
  isTitleItem,
  isValidImagePath,
  isWatchlistKey,
  normalizeRegion,
  parseTitleKey,
  type CatalogMediaType,
  type MatchmakerRequest,
  type TitleRoomState
} from '@synccinema/common';
import { KeyedLimiter } from '../util/rateLimit.js';
import { detectCountry } from '../services/billing.js';
import { CATALOG_NOT_CONFIGURED, CatalogNotConfiguredError, type CatalogService } from '../services/catalog/service.js';
import { UpstreamError } from '../services/catalog/upstream.js';
import { cleanLink, cleanSnapshot, type NewWatchlistEntry, type WatchlistStore } from '../services/catalog/watchlist.js';
import { COLLECTION_SLUGS } from '../services/catalog/collections.js';
import { TITLE_PAYLOAD_SCHEMAS } from '../sync/schemas.js';
import type { TitleAction, TitleApplyResult } from '../sync/titleQueue.js';

/**
 * Cineverse REST routes. Registered with one line from index.ts:
 *   await registerCatalogRoutes(app, { catalog, watchlist, rooms });
 * Naming: the project's REST convention is `/api/...` (there is no /api/v1), so these are `/api/catalog/...`.
 * Auth: index.ts's global gate already requires a signed-in, non-anonymous user for every /api route that is not
 * on its public list; requireUser() re-checks so the plugin is safe on its own.
 */
export interface RoomTitleApi {
  apply(roomKey: string, user: { id: string; displayName: string }, action: TitleAction): Promise<TitleApplyResult & { roomFound: boolean }>;
  state(roomKey: string, userId: string): TitleRoomState | null;
}
export interface CatalogRouteDeps {
  catalog: CatalogService;
  watchlist: WatchlistStore;
  rooms?: RoomTitleApi;
  limits?: { catalogPerMin?: number; matchmakerPerMin?: number; watchlistWritesPerMin?: number };
}

// ---- validation helpers --------------------------------------------------------------------------------------------
const intStr = (min: number, max: number) => z.string().regex(/^\d{1,9}$/).transform(Number).pipe(z.number().int().min(min).max(max));
const regionStr = z.string().regex(/^[A-Za-z]{2}$/);
const providerStr = z.string().regex(/^[a-z0-9]{1,24}$/);
const mediaTypeP = z.enum(['movie', 'tv']);
const tmdbId = z.string().regex(/^\d{1,10}$/);

export const searchQuerySchema = z
  .object({
    q: z.string().max(100).optional(),
    type: z.enum(CATALOG_TYPES).default('all'),
    genre: intStr(1, 999999).optional(),
    year: z.string().regex(/^(19|20)\d{2}(-(19|20)\d{2})?$/).optional(),
    sort: z.enum(CATALOG_SORTS).default('popularity'),
    provider: providerStr.optional(),
    region: regionStr.optional(),
    page: intStr(1, 50).optional()
  })
  .strict();
export const trendingQuerySchema = z.object({ region: regionStr.optional(), type: z.enum(CATALOG_TYPES).default('all') }).strict();
export const regionOnlySchema = z.object({ region: regionStr.optional() }).strict();
export const recoQuerySchema = z.object({ region: regionStr.optional(), page: intStr(1, 10).optional() }).strict();
export const collectionQuerySchema = z
  .object({ region: regionStr.optional(), providers: z.string().max(200).regex(/^[a-z0-9,]*$/).optional() })
  .strict();
export const titleParamsSchema = z.object({ source: z.literal('tmdb'), mediaType: mediaTypeP, id: tmdbId }).strict();
export const matchmakerBodySchema = z
  .object({
    mood: z.enum(MATCH_MOODS),
    time: z.enum(MATCH_TIMES),
    genres: z.array(z.number().int().min(1).max(999999)).max(6).default([]),
    providers: z.array(providerStr).max(8).default([]),
    mode: z.enum(MATCH_MODES),
    seed: z.string().min(1).max(64),
    region: regionStr.optional()
  })
  .strict();
export const watchlistBodySchema = z
  .object({
    kind: z.literal('title').optional(),
    titleKey: z.string().min(1).max(40),
    title: z.string().min(1).max(300),
    posterPath: z.string().max(100).nullable().optional(),
    year: z.number().int().min(1800).max(2200).nullable().optional(),
    mediaType: mediaTypeP
  })
  .strict();
/** A link the person adds to the same list (https only; the server derives the key and validates every field again). */
export const watchlistLinkBodySchema = z
  .object({
    kind: z.literal('link'),
    title: z.string().min(1).max(LINK_TITLE_MAX),
    url: z.string().min(1).max(LINK_URL_MAX),
    platform: z.string().max(LINK_PLATFORM_MAX).nullable().optional(),
    thumbnail: z.string().max(500).nullable().optional(),
    category: z.string().max(LINK_CATEGORY_MAX).nullable().optional(),
    tagline: z.string().max(LINK_TAGLINE_MAX).nullable().optional()
  })
  .strict();
export const watchlistDeleteSchema = z.object({ titleKey: z.string().min(1).max(40) }).strict();
const slugRe = /^[A-Za-z0-9_-]{1,64}$/;
const roomParamsSchema = z.object({ slug: z.string().regex(slugRe) }).strict();
const roomActionParamsSchema = z.object({ slug: z.string().regex(slugRe), action: z.enum(['propose', 'vote', 'confirm', 'ready', 'clear']) }).strict();

/** Region for a request: explicit ?region=, else CDN country headers / Accept-Language (same helper as billing), else the default. */
export function regionFor(request: { headers: Record<string, any>; query?: any }, fallback: string): string {
  const explicit = typeof request.query?.region === 'string' ? normalizeRegion(request.query.region, '') : '';
  if (explicit) return explicit;
  return normalizeRegion(detectCountry(request.headers, {}), fallback);
}

function bad(reply: FastifyReply, err: z.ZodError) {
  const issue = err.issues[0];
  const unknown = issue?.code === 'unrecognized_keys';
  return reply.code(400).send({ error: unknown ? 'Unknown parameter' : `Invalid ${issue?.path.join('.') || 'request'}`, code: 'BAD_REQUEST' });
}

type User = { id: string; displayName: string };

export async function registerCatalogRoutes(app: FastifyInstance, deps: CatalogRouteDeps): Promise<void> {
  const { catalog, watchlist } = deps;
  const readLimiter = new KeyedLimiter(deps.limits?.catalogPerMin ?? 120, 60_000);
  const matchLimiter = new KeyedLimiter(deps.limits?.matchmakerPerMin ?? 20, 60_000);
  const writeLimiter = new KeyedLimiter(deps.limits?.watchlistWritesPerMin ?? 60, 60_000);

  const requireUser = async (request: FastifyRequest, reply: FastifyReply): Promise<User | null> => {
    try {
      let u = request.user as any;
      if (!u) u = await request.jwtVerify();
      if (!u || u.isAnonymous || typeof u.id !== 'string') throw new Error('anon');
      return { id: u.id, displayName: typeof u.displayName === 'string' ? u.displayName : 'Member' };
    } catch {
      reply.code(401).send({ error: 'Authentication required' });
      return null;
    }
  };
  const tooMany = (reply: FastifyReply) => reply.code(429).header('Retry-After', '30').send({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' });

  /** Wraps a catalog read: auth, rate limit, error mapping. Never leaks upstream details or keys. */
  const read =
    (limiter: KeyedLimiter, handler: (request: FastifyRequest, reply: FastifyReply, user: User) => Promise<unknown>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      if (limiter.hit(`u:${user.id}`) || limiter.hit(`ip:${request.ip}`)) return tooMany(reply);
      try {
        return await handler(request, reply, user);
      } catch (err) {
        if (err instanceof CatalogNotConfiguredError) return reply.code(503).send(CATALOG_NOT_CONFIGURED);
        if (err instanceof UpstreamError) {
          return reply.code(err.kind === 'circuit_open' ? 503 : 502).send({ error: 'The movie data provider is unavailable right now. Please retry.', code: 'CATALOG_UPSTREAM' });
        }
        throw err;
      }
    };
  const cacheable = (reply: FastifyReply) => reply.header('Cache-Control', 'private, max-age=30');
  const noStore = (reply: FastifyReply) => reply.header('Cache-Control', 'no-store');
  const region = (request: FastifyRequest) => regionFor(request as any, catalog.defaultRegion);

  // ---- status / genres -------------------------------------------------------------------------------------------
  app.get('/api/catalog/status', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    cacheable(reply);
    return { ...catalog.status(), region: region(request) };
  });

  app.get('/api/catalog/genres', read(readLimiter, async (_request, reply) => {
    cacheable(reply);
    return { genres: await catalog.genres() };
  }));

  // ---- search / trending -----------------------------------------------------------------------------------------
  app.get('/api/catalog/search', read(readLimiter, async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return bad(reply, parsed.error);
    const q = parsed.data;
    let yearFrom: number | null = null;
    let yearTo: number | null = null;
    if (q.year) {
      const [a, b] = q.year.split('-').map(Number);
      yearFrom = a;
      yearTo = b ?? a;
      if (yearTo < yearFrom) return reply.code(400).send({ error: 'Invalid year', code: 'BAD_REQUEST' });
    }
    const query = (q.q ?? '').trim();
    cacheable(reply);
    return catalog.search({ q: query || undefined, type: q.type, genre: q.genre, yearFrom, yearTo, sort: q.sort, provider: q.provider, region: region(request), page: q.page ?? 1 });
  }));

  app.get('/api/catalog/trending', read(readLimiter, async (request, reply) => {
    const parsed = trendingQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return bad(reply, parsed.error);
    cacheable(reply);
    return catalog.trending(parsed.data.type, region(request));
  }));

  // ---- titles ----------------------------------------------------------------------------------------------------
  app.get('/api/catalog/titles/:source/:mediaType/:id', read(readLimiter, async (request, reply) => {
    const p = titleParamsSchema.safeParse(request.params);
    const q = regionOnlySchema.safeParse(request.query ?? {});
    if (!p.success) return bad(reply, p.error);
    if (!q.success) return bad(reply, q.error);
    const r = region(request);
    const title = await catalog.details(p.data.mediaType, p.data.id, r);
    if (!title) return reply.code(404).send({ error: 'Title not found', code: 'NOT_FOUND' });
    const offers = await catalog.providersFor(p.data.mediaType, p.data.id, r);
    cacheable(reply);
    return {
      title: { ...title, providers: (offers ?? []).map((o) => ({ ...o, capabilities: capabilitiesForProvider(o.name) })) },
      availabilityEnabled: catalog.availabilityEnabled,
      availabilityVerified: offers !== null
    };
  }));

  app.get('/api/catalog/titles/:source/:mediaType/:id/providers', read(readLimiter, async (request, reply) => {
    const p = titleParamsSchema.safeParse(request.params);
    const q = regionOnlySchema.safeParse(request.query ?? {});
    if (!p.success) return bad(reply, p.error);
    if (!q.success) return bad(reply, q.error);
    const r = region(request);
    const offers = await catalog.providersFor(p.data.mediaType, p.data.id, r);
    cacheable(reply);
    return {
      region: r,
      availabilityEnabled: catalog.availabilityEnabled,
      verified: offers !== null,
      providers: (offers ?? []).map((o) => ({ ...o, capabilities: capabilitiesForProvider(o.name) }))
    };
  }));

  app.get('/api/catalog/titles/:source/:mediaType/:id/recommendations', read(readLimiter, async (request, reply) => {
    const p = titleParamsSchema.safeParse(request.params);
    const q = recoQuerySchema.safeParse(request.query ?? {});
    if (!p.success) return bad(reply, p.error);
    if (!q.success) return bad(reply, q.error);
    cacheable(reply);
    return catalog.recommendations(p.data.mediaType, p.data.id, region(request), q.data.page ?? 1);
  }));

  // ---- collections -----------------------------------------------------------------------------------------------
  app.get('/api/catalog/collections/:slug', read(readLimiter, async (request, reply, user) => {
    const slug = (request.params as any)?.slug;
    if (typeof slug !== 'string' || !COLLECTION_SLUGS.includes(slug)) return reply.code(404).send({ error: 'Unknown collection', code: 'NOT_FOUND' });
    const q = collectionQuerySchema.safeParse(request.query ?? {});
    if (!q.success) return bad(reply, q.error);
    const providers = (q.data.providers ?? '').split(',').filter(Boolean).slice(0, 8);
    let userSeeds: Array<{ mediaType: CatalogMediaType; id: string }> | undefined;
    let excludeKeys: Set<string> | undefined;
    if (slug === 'because-you-watched') {
      const items = (await watchlist.list(user.id)).filter(isTitleItem); // newest first, the caller's own list only; links have no catalog id
      userSeeds = items.slice(0, 3).map((i) => ({ mediaType: i.mediaType, id: parseTitleKey(i.titleKey)!.sourceId }));
      excludeKeys = new Set(items.map((i) => i.titleKey));
      noStore(reply);
    } else cacheable(reply);
    const result = await catalog.collection(slug, { region: region(request), providers, userSeeds, excludeKeys });
    return result ?? reply.code(404).send({ error: 'Unknown collection', code: 'NOT_FOUND' });
  }));

  // ---- matchmaker ------------------------------------------------------------------------------------------------
  app.post('/api/catalog/matchmaker', read(matchLimiter, async (request, reply) => {
    const body = matchmakerBodySchema.safeParse(request.body ?? {});
    if (!body.success) return bad(reply, body.error);
    const req: MatchmakerRequest = { ...body.data, region: body.data.region ? normalizeRegion(body.data.region, catalog.defaultRegion) : region(request) };
    noStore(reply);
    return catalog.matchmaker(req);
  }));

  // ---- watchlist (private: every query is scoped by the caller's id) ---------------------------------------------
  app.get('/api/catalog/watchlist', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (readLimiter.hit(`u:${user.id}`)) return tooMany(reply);
    noStore(reply);
    return { items: await watchlist.list(user.id), max: WATCHLIST_MAX_ITEMS };
  });

  app.post('/api/catalog/watchlist', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (writeLimiter.hit(`w:${user.id}`)) return tooMany(reply);
    const raw = (request.body ?? {}) as any;
    let entry: NewWatchlistEntry | null;
    if (raw && typeof raw === 'object' && raw.kind === 'link') {
      const body = watchlistLinkBodySchema.safeParse(raw);
      if (!body.success) return bad(reply, body.error);
      entry = cleanLink(body.data);
      if (!entry) return reply.code(400).send({ error: 'Invalid link', code: 'BAD_REQUEST' });
    } else {
      const body = watchlistBodySchema.safeParse(raw);
      if (!body.success) return bad(reply, body.error);
      const snap = cleanSnapshot(body.data);
      if (!snap || snap.mediaType !== body.data.mediaType || (body.data.posterPath && !isValidImagePath(body.data.posterPath))) {
        return reply.code(400).send({ error: 'Invalid title', code: 'BAD_REQUEST' });
      }
      entry = snap;
    }
    noStore(reply);
    const result = await watchlist.add(user.id, entry);
    if (result === 'cap') return reply.code(409).send({ error: `Your watchlist is full (${WATCHLIST_MAX_ITEMS} items)`, code: 'WATCHLIST_FULL' });
    return reply.code(result === 'added' ? 201 : 200).send({ ok: true, duplicate: result === 'duplicate', titleKey: entry.titleKey });
  });

  const removeHandler = async (request: FastifyRequest, reply: FastifyReply, key: unknown) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    if (writeLimiter.hit(`w:${user.id}`)) return tooMany(reply);
    if (!isWatchlistKey(key)) return reply.code(400).send({ error: 'Invalid item', code: 'BAD_REQUEST' });
    noStore(reply);
    return { ok: true, removed: await watchlist.remove(user.id, key as string) };
  };
  app.delete('/api/catalog/watchlist', async (request, reply) => {
    const q = watchlistDeleteSchema.safeParse(request.query ?? {});
    if (!q.success) return bad(reply, q.error);
    return removeHandler(request, reply, q.data.titleKey);
  });
  app.delete('/api/catalog/watchlist/:titleKey', async (request, reply) => removeHandler(request, reply, (request.params as any)?.titleKey));

  // ---- room party queue (REST twin of the WebSocket messages; same rules, same state machine) ---------------------
  if (deps.rooms) {
    const rooms = deps.rooms;
    app.get('/api/catalog/rooms/:slug/titles', async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      const p = roomParamsSchema.safeParse(request.params);
      if (!p.success) return bad(reply, p.error);
      const state = rooms.state(p.data.slug, user.id);
      if (!state) return reply.code(403).send({ error: 'Only people in this room can see its party queue', code: 'NOT_MEMBER' });
      noStore(reply);
      return { state, serverTime: Date.now() };
    });
    app.post('/api/catalog/rooms/:slug/titles/:action', async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return reply;
      if (writeLimiter.hit(`r:${user.id}`)) return tooMany(reply);
      const p = roomActionParamsSchema.safeParse(request.params);
      if (!p.success) return bad(reply, p.error);
      const type = `room:title_${p.data.action}`;
      const body = TITLE_PAYLOAD_SCHEMAS[type].safeParse(request.body ?? {});
      if (!body.success) return bad(reply, body.error);
      const res = await rooms.apply(p.data.slug, user, { type, payload: body.data } as TitleAction);
      noStore(reply);
      if (!res.roomFound) return reply.code(404).send({ error: 'Room not found', code: 'NOT_FOUND' });
      if (!res.ok) {
        const status = res.code === 'NOT_MEMBER' || res.code === 'FORBIDDEN' ? 403 : res.code === 'STALE_TITLE_STATE' ? 409 : res.code === 'NOT_FOUND' ? 404 : 400;
        return reply.code(status).send({ error: res.message, code: res.code, state: res.state });
      }
      return { ok: true, state: res.state };
    });
  }
}

/** Adapts the RoomSyncManager (the authority for room state) to the REST twin of the party-queue messages. */
export function roomTitleApi(sync: {
  applyTitleActionForUser: (roomKey: string, user: { id: string; displayName: string }, action: TitleAction) => Promise<TitleApplyResult & { roomFound: boolean }>;
  titleStateForUser: (roomKey: string, userId: string) => TitleRoomState | null;
}): RoomTitleApi {
  return { apply: (k, u, a) => sync.applyTitleActionForUser(k, u, a), state: (k, uid) => sync.titleStateForUser(k, uid) };
}
