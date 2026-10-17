import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { CatalogService, parseProviderOrder } from '../services/catalog/service.js';
import { MemoryWatchlistStore } from '../services/catalog/watchlist.js';
import { registerCatalogRoutes } from '../routes/catalog.js';
import { StreamingAvailabilityAdapter, normalizeStreamingOffers, refPath, safeLogoUrl } from '../services/catalog/adapters/streamingAvailability.js';
import { MemoryQuotaStore, MongoQuotaStore, QuotaGuard, UserLookupGuard, LookupCooldown, QuotaStopped, parseMonthlyLimit, utcMonth } from '../services/catalog/availabilityGuard.js';
import { UpstreamClient } from '../services/catalog/upstream.js';
import { fakeFetch, tmdbMovieDetails, wmOffers, wmSources } from './catalogFixtures.js';
import { tvmazeFixture } from './tvmazeFixtures.js';

const saShow = tvmazeFixture('streamingavailability-show');
const SA_KEY = 'sa-key-must-never-leak-789';
const noSleep = async () => {};
type Call = { url: string; headers?: Record<string, string> };

/** Fetch stub: records URL + headers, answers by substring, SA answers come from `sa()` so tests can change them. */
function stub(sa: () => { status: number; body: unknown; headers?: Record<string, string> } = () => ({ status: 200, body: saShow })) {
  const calls: Call[] = [];
  const extra: Array<[string, unknown, number?]> = [];
  const fn = async (url: string, init?: any) => {
    calls.push({ url, headers: init?.headers });
    const mk = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: status < 400, status, headers: { get: (h: string) => headers[h.toLowerCase()] ?? null }, json: async () => body });
    if (url.includes('api.movieofthenight.com')) {
      const r = sa();
      return mk(r.status, r.body, r.headers);
    }
    const hit = extra.find(([m]) => url.includes(m));
    if (hit) return mk(hit[2] ?? 200, hit[1]);
    if (url.includes('/movie/603')) return mk(200, tmdbMovieDetails);
    if (url.includes('api.watchmode.com/v1/search/')) return mk(200, { title_results: [{ id: 9 }] });
    if (url.includes('api.watchmode.com/v1/title/9/sources/')) return mk(200, wmOffers);
    if (url.includes('api.watchmode.com/v1/sources/')) return mk(200, wmSources);
    return mk(404, {});
  };
  return { fn: fn as any, calls, saCalls: () => calls.filter((c) => c.url.includes('movieofthenight')), route: (m: string, b: unknown, s?: number) => extra.unshift([m, b, s]) };
}
const mkSvc = (env: Record<string, string>, f: ReturnType<typeof stub>, extra: any = {}) =>
  new CatalogService({ TMDB_API_KEY: 'tmdb-k', TVMAZE_ENABLED: '0', ...env }, { fetchFn: f.fn, sleep: noSleep, backoffBaseMs: 1, ...extra });
const SA_ENV = { STREAMING_AVAILABILITY_API_KEY: SA_KEY };

// ---- mapping (doc-shaped fixture) ------------------------------------------------------------------------------------

test('SA mapping: verified only for the requested country, types honest, links https only, logos on the CDN host only', () => {
  const offers = normalizeStreamingOffers(saShow, 'IN');
  assert.deepEqual(offers.map((o) => `${o.type}:${o.id}`), ['subscription:hotstar', 'subscription:netflix', 'addon:apple:mubi', 'rent:prime']);
  assert.ok(offers.every((o) => o.verified === true));
  const netflix = offers.find((o) => o.id === 'netflix')!;
  assert.equal(netflix.destinationUrl, 'https://www.netflix.com/title/60011152/'); // duplicate quality rows collapse, first valid link kept
  assert.equal(netflix.logoUrl, 'https://media.movieofthenight.com/services/netflix/logo-light-theme.svg');
  assert.equal(offers.find((o) => o.id === 'prime')!.logoUrl, null); // off-host logo dropped
  assert.equal(offers.find((o) => o.id === 'hotstar')!.destinationUrl, null); // http link dropped, the offer stays
  assert.equal(offers.find((o) => o.type === 'addon')!.name, 'MUBI');
  assert.ok(!offers.some((o) => o.name === 'ZEE5')); // unknown type dropped
  assert.ok(!offers.some((o) => o.id === 'max')); // US row never leaks into IN
  assert.deepEqual(normalizeStreamingOffers(saShow, 'US').map((o) => o.id), ['max']);
  assert.deepEqual(normalizeStreamingOffers(saShow, 'DE'), []); // title known, no service there: verified empty
  for (const bad of [null, {}, { streamingOptions: null }, { streamingOptions: { in: 'x' } }, { streamingOptions: { in: [null, 5, { service: {}, type: 'free' }] } }]) {
    assert.deepEqual(normalizeStreamingOffers(bad, 'IN'), []);
  }
  assert.equal(safeLogoUrl('https://media.movieofthenight.com/services/x/logo.svg'), 'https://media.movieofthenight.com/services/x/logo.svg');
  assert.equal(safeLogoUrl('http://media.movieofthenight.com/x.svg'), null);
  assert.equal(safeLogoUrl('https://media.movieofthenight.com.evil.example/x.svg'), null);
});

test('SA request: v4 base, X-API-Key header, tmdb style ids and imdb ids, lower-case country, 404 is unknown', async () => {
  const f = stub();
  const http = new UpstreamClient({ name: 'sa', fetchFn: f.fn, sleep: noSleep });
  const a = new StreamingAvailabilityAdapter({ apiKey: 'K' }, http);
  assert.equal(a.configured, true);
  await a.offers({ kind: 'tmdb', mediaType: 'movie', id: '603' }, 'IN');
  await a.offers({ kind: 'tmdb', mediaType: 'tv', id: '1396' }, 'IN');
  await a.offers({ kind: 'imdb', id: 'tt0068646' }, 'IN');
  assert.equal(f.calls[0].url, 'https://api.movieofthenight.com/v4/shows/movie/603?country=in&series_granularity=show&output_language=en');
  assert.equal(f.calls[1].url.split('?')[0], 'https://api.movieofthenight.com/v4/shows/tv/1396');
  assert.equal(f.calls[2].url.split('?')[0], 'https://api.movieofthenight.com/v4/shows/tt0068646');
  assert.equal(f.calls[0].headers!['X-API-Key'], 'K');
  assert.ok(!f.calls[0].url.includes('K&') && !f.calls[0].url.toLowerCase().includes('apikey')); // the key is a header, never in the URL
  assert.equal(refPath({ kind: 'tmdb', mediaType: 'movie', id: '1/../2' }), null);
  assert.equal(refPath({ kind: 'imdb', id: 'nm123' }), null);
  assert.equal(await a.offers({ kind: 'imdb', id: 'bad' }, 'IN'), null);
  assert.equal(await a.offers({ kind: 'tmdb', mediaType: 'movie', id: '1' }, 'in'), null);
  assert.equal(f.calls.length, 3); // invalid ids were never sent
  const f404 = stub(() => ({ status: 404, body: {} }));
  const a2 = new StreamingAvailabilityAdapter({ apiKey: 'K' }, new UpstreamClient({ name: 'sa', fetchFn: f404.fn, sleep: noSleep }));
  assert.equal(await a2.offers({ kind: 'tmdb', mediaType: 'movie', id: '5' }, 'IN'), null);
});

// ---- quota counter -----------------------------------------------------------------------------------------------------

test('quota: the conditional increment is atomic, never passes the soft stop under concurrency', async () => {
  const store = new MemoryQuotaStore();
  const results = await Promise.all(Array.from({ length: 1200 }, () => store.tryConsume('streamingavailability', '2026-10', 900)));
  assert.equal(results.filter(Boolean).length, 900);
  assert.equal(await store.count('streamingavailability', '2026-10'), 900);
});

/** A tiny fake of the Mongo collection with the same atomic semantics as the real conditional findOneAndUpdate. */
function fakeMongoCol(shape: 'doc' | 'value') {
  const docs = new Map<string, any>();
  let upserts = 0;
  return {
    docs,
    get upserts() { return upserts; },
    async findOne(q: any) { return docs.get(q._id) ?? null; },
    async updateOne(q: any, u: any, o: any) {
      if (docs.has(q._id)) return {};
      if (o?.upsert) { upserts++; docs.set(q._id, { _id: q._id, ...u.$setOnInsert }); }
      return {};
    },
    async findOneAndUpdate(q: any, u: any) {
      const d = docs.get(q._id);
      const ok = d && (q.count?.$lt === undefined || d.count < q.count.$lt);
      if (ok) d.count += u.$inc.count;
      return shape === 'doc' ? (ok ? { ...d } : null) : { value: ok ? { ...d } : null };
    }
  };
}
test('quota: Mongo store keeps ONE document per provider per UTC month and stops at the soft limit (both driver return shapes)', async () => {
  for (const shape of ['doc', 'value'] as const) {
    const col = fakeMongoCol(shape);
    const store = new MongoQuotaStore(() => col as any);
    const res = await Promise.all(Array.from({ length: 30 }, () => store.tryConsume('streamingavailability', '2026-10', 9)));
    assert.equal(res.filter(Boolean).length, 9, shape);
    assert.equal(await store.count('streamingavailability', '2026-10'), 9);
    assert.equal(await store.tryConsume('streamingavailability', '2026-11', 9), true); // a new month is a new document
    assert.deepEqual([...col.docs.keys()].sort(), ['streamingavailability:2026-10', 'streamingavailability:2026-11']);
    assert.equal(col.docs.get('streamingavailability:2026-10').month, '2026-10');
  }
});

test('quota guard: soft stop at 90%, month rollover (injected clock), a failing store means "do not call"', async () => {
  let now = Date.parse('2026-10-31T23:59:00Z');
  const store = new MemoryQuotaStore();
  const g = new QuotaGuard({ provider: 'streamingavailability', store, limit: 10, now: () => now, readCacheMs: 0 });
  assert.equal(g.stopAt, 9);
  for (let i = 0; i < 9; i++) await g.consume();
  assert.equal(await g.isLow(), true);
  await assert.rejects(g.consume(), QuotaStopped);
  assert.equal(await store.count('streamingavailability', '2026-10'), 9);
  now = Date.parse('2026-11-01T00:00:01Z');
  assert.equal(utcMonth(now), '2026-11');
  assert.equal(await g.isLow(), false);
  await g.consume();
  assert.equal(await store.count('streamingavailability', '2026-11'), 1);
  const broken = new QuotaGuard({ provider: 'p', limit: 1000, store: { count: async () => { throw new Error('db'); }, tryConsume: async () => { throw new Error('db'); } } });
  await assert.rejects(broken.consume(), QuotaStopped);
  assert.equal(await new QuotaGuard({ provider: 'p', limit: 1000, store: { count: async () => { throw new Error('db'); }, tryConsume: async () => true } }).isLow(), false); // a failing read is not "low"
  assert.equal(parseMonthlyLimit(undefined), 1000);
  assert.equal(parseMonthlyLimit('250'), 250);
  for (const bad of ['0', '-5', 'abc', '1.5', '']) assert.equal(parseMonthlyLimit(bad), 1000, bad);
});

test('per-user cooldown: 1 uncached lookup per title per hour, 30 per day, per user', () => {
  let now = Date.parse('2026-10-17T10:00:00Z');
  const g = new UserLookupGuard({ now: () => now });
  g.check('u', 'tmdb:movie:1');
  g.record('u', 'tmdb:movie:1');
  assert.throws(() => g.check('u', 'tmdb:movie:1'), LookupCooldown);
  g.check('v', 'tmdb:movie:1'); // another user is unaffected
  g.check('u', 'tmdb:movie:2'); // another title is unaffected
  now += 3600_000 + 1;
  g.check('u', 'tmdb:movie:1');
  for (let i = 0; i < 29; i++) g.record('u', `tmdb:movie:${100 + i}`);
  g.record('u', 'tmdb:movie:999');
  assert.throws(() => g.check('u', 'tmdb:movie:5000'), LookupCooldown); // 31 recorded today: daily limit
  now = Date.parse('2026-10-18T00:00:01Z');
  g.check('u', 'tmdb:movie:5000'); // next UTC day
});

// ---- service ------------------------------------------------------------------------------------------------------------

test('SA is called only from a title page opened by a signed-in user, never for lists, and answers are cached 24 h and shared', async () => {
  let now = Date.parse('2026-10-17T10:00:00Z');
  const f = stub();
  const s = mkSvc(SA_ENV, f, { now: () => now });
  assert.equal(s.availabilityEnabled, true);
  assert.equal(await s.providersFor('movie', '603', 'IN'), null); // no user: unknown, no call
  const att = await s.attachProviders([(await s.details('movie', '603', 'IN'))!], 'IN');
  assert.equal(att.verified.size, 0);
  assert.equal(f.saCalls().length, 0);
  const p1 = (await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!;
  assert.equal(p1.availabilityProvider, 'streamingavailability');
  assert.equal(p1.offers!.length, 4);
  assert.equal(f.saCalls().length, 1);
  assert.equal(f.saCalls()[0].headers!['X-API-Key'], SA_KEY);
  await s.titlePage('tmdb', 'movie', '603', 'IN', 'u2'); // another user, same title: cache
  await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1');
  assert.equal(f.saCalls().length, 1);
  assert.equal((await s.providersFor('movie', '603', 'IN')) !== null, true); // lists / rooms may reuse the cached answer
  now += 25 * 3600_000;
  await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1');
  assert.equal(f.saCalls().length, 2);
});

test('concurrent opens of the same title share ONE request', async () => {
  const f = stub();
  const s = mkSvc(SA_ENV, f);
  await Promise.all(Array.from({ length: 8 }, (_, i) => s.titlePage('tmdb', 'movie', '603', 'IN', `u${i}`)));
  assert.equal(f.saCalls().length, 1);
});

test('soft stop: after 90% the API is not called, stale answers are served, status says quotaLow, next month it resumes', async () => {
  let now = Date.parse('2026-10-20T10:00:00Z');
  const f = stub();
  const s = mkSvc({ ...SA_ENV, STREAMING_AVAILABILITY_MONTHLY_LIMIT: '20' }, f, { now: () => now }); // stopAt 18
  for (let i = 1; i <= 18; i++) await s.providersWithSource('movie', String(1000 + i), 'IN', { userId: 'u1' }).catch(() => null) ;
  // (one user would hit the per-day cooldown at 30; 18 is below it)
  assert.equal(f.saCalls().length, 18);
  await s.refreshAvailabilityFlags();
  assert.equal(s.status().availabilityDetail.quotaLow, true);
  assert.equal(s.status().availabilityDetail.provider, null); // SA stopped and no other provider
  const before = f.saCalls().length;
  const fresh = await s.providersWithSource('movie', '9999', 'IN', { userId: 'u2' });
  assert.deepEqual(fresh, { offers: null, provider: null }); // unknown, not "unavailable"
  const old = await s.providersWithSource('movie', '1001', 'IN', { userId: 'u2' }); // cached earlier: still served
  assert.equal(old.provider, 'streamingavailability');
  assert.equal(f.saCalls().length, before);
  now += 25 * 3600_000; // 24 h cache expired, quota still stopped this month: stale copy is served, no call
  const stale = await s.providersWithSource('movie', '1001', 'IN', { userId: 'u3' });
  assert.equal(stale.provider, 'streamingavailability');
  assert.equal(f.saCalls().length, before);
  now = Date.parse('2026-11-02T10:00:00Z'); // new UTC month: counter starts at zero
  await s.refreshAvailabilityFlags();
  assert.equal(s.status().availabilityDetail.quotaLow, false);
  const again = await s.providersWithSource('movie', '1001', 'IN', { userId: 'u3' });
  assert.equal(again.provider, 'streamingavailability');
  assert.equal(f.saCalls().length, before + 1);
});

test('per-user cooldown through the service: same title again (other region) within an hour is not called, other users are', async () => {
  const f = stub();
  const s = mkSvc(SA_ENV, f);
  await s.providersWithSource('movie', '603', 'IN', { userId: 'u1' });
  const r = await s.providersWithSource('movie', '603', 'US', { userId: 'u1' });
  assert.equal(r.offers, null);
  assert.equal(f.saCalls().length, 1);
  assert.equal((await s.providersWithSource('movie', '603', 'US', { userId: 'u2' })).provider, 'streamingavailability');
  assert.equal(f.saCalls().length, 2);
  // 30 uncached lookups a day per user
  for (let i = 0; i < 40; i++) await s.providersWithSource('movie', String(2000 + i), 'IN', { userId: 'greedy' });
  assert.equal(f.saCalls().filter((c) => /movie\/20\d\d/.test(c.url)).length, 30);
});

test('stale copy up to 7 days when the API is down; after 7 days unknown', async () => {
  let now = Date.parse('2026-10-10T10:00:00Z');
  let down = false;
  const f = stub(() => (down ? { status: 500, body: {} } : { status: 200, body: saShow }));
  const s = mkSvc({ ...SA_ENV, STREAMING_AVAILABILITY_MONTHLY_LIMIT: '100000' }, f, { now: () => now });
  await s.providersWithSource('movie', '603', 'IN', { userId: 'u1' });
  down = true;
  now += 26 * 3600_000;
  const stale = await s.providersWithSource('movie', '603', 'IN', { userId: 'u2' });
  assert.equal(stale.offers!.length, 4);
  now += 6 * 24 * 3600_000; // 7 days and 2 hours since the good answer
  const gone = await s.providersWithSource('movie', '603', 'IN', { userId: 'u3' });
  assert.equal(gone.offers, null);
});

test('429: one retry only (each retry costs quota), the breaker opens, no further calls while it is open', async () => {
  let now = 1_000_000;
  const f = stub(() => ({ status: 429, body: {}, headers: { 'retry-after': '1' } }));
  const s = mkSvc({ ...SA_ENV, STREAMING_AVAILABILITY_MONTHLY_LIMIT: '100000' }, f, { now: () => now });
  assert.equal((await s.providersWithSource('movie', '1', 'IN', { userId: 'a' })).offers, null);
  assert.equal(f.saCalls().length, 2); // first try + one retry
  assert.equal((await s.providersWithSource('movie', '2', 'IN', { userId: 'a' })).offers, null);
  assert.equal(f.saCalls().length, 4);
  assert.equal(s.streamingHttp.circuitOpen, true);
  assert.equal((await s.providersWithSource('movie', '3', 'IN', { userId: 'a' })).offers, null);
  assert.equal(f.saCalls().length, 4); // breaker open: nothing sent
  now += 61_000;
  assert.equal(s.streamingHttp.circuitOpen, false);
});

test('provider order: default SA then Watchmode; fallback on API failure, stopped quota, unknown title; custom order; unknown names ignored', async () => {
  assert.deepEqual(parseProviderOrder(undefined), ['streamingavailability', 'watchmode']);
  assert.deepEqual(parseProviderOrder('watchmode,streamingavailability'), ['watchmode', 'streamingavailability']);
  assert.deepEqual(parseProviderOrder('foo, WATCHMODE ,watchmode,,'), ['watchmode']);
  assert.deepEqual(parseProviderOrder('nonsense'), ['streamingavailability', 'watchmode']);
  const both = { ...SA_ENV, WATCHMODE_API_KEY: 'wm' };

  let f = stub();
  let s = mkSvc(both, f);
  assert.equal((await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!.availabilityProvider, 'streamingavailability');
  assert.equal(f.calls.filter((c) => c.url.includes('watchmode')).length, 0);

  f = stub(() => ({ status: 500, body: {} })); // SA down
  s = mkSvc(both, f);
  const viaWm = (await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!;
  assert.equal(viaWm.availabilityProvider, 'watchmode');
  assert.ok(viaWm.offers!.some((o) => o.id === '203'));

  f = stub(() => ({ status: 404, body: {} })); // SA does not know the title
  s = mkSvc(both, f);
  assert.equal((await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!.availabilityProvider, 'watchmode');

  f = stub();
  s = mkSvc({ ...both, STREAMING_AVAILABILITY_MONTHLY_LIMIT: '10' }, f); // stopAt 9
  for (let i = 0; i < 9; i++) await s.titlePage('tmdb', 'movie', '603', 'IN', `u${i}`).catch(() => null);
  for (let i = 0; i < 9; i++) await s.providersWithSource('movie', String(700 + i), 'IN', { userId: 'x' }).catch(() => null);
  await s.refreshAvailabilityFlags();
  assert.equal(s.status().availabilityDetail.quotaLow, true);
  assert.equal(s.status().availabilityDetail.provider, 'watchmode'); // next configured provider takes over
  const n = f.saCalls().length;
  assert.equal((await s.providersWithSource('movie', '603', 'IN', { userId: 'new' })).offers !== null, true);
  assert.equal((await s.providersWithSource('movie', '12345', 'IN', { userId: 'new' })).provider, 'watchmode');
  assert.equal(f.saCalls().length, n);

  f = stub();
  s = mkSvc({ ...both, AVAILABILITY_PROVIDER_ORDER: 'watchmode,streamingavailability' }, f);
  assert.equal((await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!.availabilityProvider, 'watchmode');
  assert.equal(f.saCalls().length, 0);

  f = stub();
  s = mkSvc({ WATCHMODE_API_KEY: 'wm' }, f); // SA not configured: Watchmode as before
  assert.equal((await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!.availabilityProvider, 'watchmode');
  assert.equal(f.saCalls().length, 0);

  f = stub();
  s = mkSvc({}, f); // nothing configured: the old behaviour
  assert.equal(s.availabilityEnabled, false);
  assert.equal((await s.titlePage('tmdb', 'movie', '603', 'IN', 'u1'))!.offers, null);
});

test('TVmaze titles are looked up by their IMDb id; without one nothing is called', async () => {
  const f = stub();
  const show = tvmazeFixture('tvmaze-show-embedded');
  f.route('/shows/169?', show);
  f.route('/shows/170?', { ...show, id: 170, externals: { imdb: null } });
  const s = new CatalogService({ ...SA_ENV }, { fetchFn: f.fn, sleep: noSleep, backoffBaseMs: 1, tvmazeLimiter: { max: 1000 } });
  assert.equal(s.mode, 'tvmaze');
  const page = (await s.titlePage('tvmaze', 'tv', '169', 'IN', 'u1'))!;
  assert.equal(page.availabilityProvider, 'streamingavailability');
  assert.equal(f.saCalls()[0].url.split('?')[0], 'https://api.movieofthenight.com/v4/shows/tt0903747');
  const none = (await s.titlePage('tvmaze', 'tv', '170', 'IN', 'u1'))!;
  assert.equal(none.offers, null);
  assert.equal(f.saCalls().length, 1);
});

// ---- status / secrets ---------------------------------------------------------------------------------------------------------

test('status payload and routes: booleans and provider names only, never keys, limits or counts', async () => {
  const f = stub();
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const catalog = mkSvc({ ...SA_ENV, WATCHMODE_API_KEY: 'wm-secret-123', STREAMING_AVAILABILITY_MONTHLY_LIMIT: '777' }, f);
  await registerCatalogRoutes(app, { catalog, watchlist: new MemoryWatchlistStore() });
  const h = { authorization: `Bearer ${app.jwt.sign({ id: 'u1', displayName: 'U', isAnonymous: false })}` };
  const st = await app.inject({ url: '/api/catalog/status', headers: h });
  const text = st.body;
  const j = st.json();
  assert.equal(j.availability, true);
  assert.deepEqual(j.availabilityDetail, { provider: 'streamingavailability', quotaLow: false });
  for (const secret of [SA_KEY, 'wm-secret-123', 'tmdb-k', '777']) assert.ok(!text.includes(secret), secret);
  assert.ok(!/count|limit|quota"|used/i.test(text.replace('quotaLow', '')));
  const t = await app.inject({ url: '/api/catalog/titles/tmdb/movie/603', headers: h });
  assert.equal(t.statusCode, 200);
  assert.equal(t.json().availabilityProvider, 'streamingavailability');
  assert.equal(t.json().availabilityQuotaLow, false);
  for (const secret of [SA_KEY, 'wm-secret-123', 'tmdb-k']) assert.ok(!t.body.includes(secret), secret);
  const p = await app.inject({ url: '/api/catalog/titles/tmdb/movie/603/providers', headers: h });
  assert.equal(p.json().providers.length, 4);
  assert.equal(p.json().providers[0].capabilities.playback, 'none');
  // an upstream failure message never carries the key
  const bad = mkSvc(SA_ENV, stub(() => ({ status: 500, body: {} })));
  const app2 = fastify();
  await app2.register(fastifyJwt, { secret: 'x'.repeat(32) });
  await registerCatalogRoutes(app2, { catalog: bad, watchlist: new MemoryWatchlistStore() });
  const h2 = { authorization: `Bearer ${app2.jwt.sign({ id: 'u1', displayName: 'U', isAnonymous: false })}` };
  const r = await app2.inject({ url: '/api/catalog/titles/tmdb/movie/603', headers: h2 });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().availabilityVerified, false);
  assert.ok(!r.body.includes(SA_KEY));
  await app.close();
  await app2.close();
});
