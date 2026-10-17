import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../services/catalog/cache.js';
import { UpstreamClient, UpstreamError } from '../services/catalog/upstream.js';
import { CatalogService, CatalogNotConfiguredError, TTL } from '../services/catalog/service.js';
import { COLLECTIONS, findCollection } from '../services/catalog/collections.js';
import { fakeFetch, page, listMovie, listTv, tmdbTvDetails, tmdbMovieDetails, wmSources, wmOffers } from './catalogFixtures.js';

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

// ---- cache ------------------------------------------------------------------------------------------------------------
test('cache: fresh hit, expiry, stale-while-revalidate, error is not cached', async () => {
  const c = clock();
  const cache = new TtlCache<number>({ maxEntries: 10, now: c.now });
  let n = 0;
  const load = async () => ++n;
  assert.equal(await cache.get('k', load, { ttlMs: 1000, staleMs: 5000 }), 1);
  assert.equal(await cache.get('k', load, { ttlMs: 1000, staleMs: 5000 }), 1);
  c.advance(1500); // stale window: old value now, refresh in background
  assert.equal(await cache.get('k', load, { ttlMs: 1000, staleMs: 5000 }), 1);
  await new Promise((r) => setImmediate(r));
  assert.equal(await cache.get('k', load, { ttlMs: 1000, staleMs: 5000 }), 2);
  c.advance(10_000); // fully expired: caller waits for a reload
  assert.equal(await cache.get('k', load, { ttlMs: 1000, staleMs: 5000 }), 3);
  await assert.rejects(cache.get('bad', async () => { throw new Error('x'); }, { ttlMs: 1000 }));
  assert.equal(cache.has('bad'), false);
});

test('cache: serves a stale copy when the reload fails', async () => {
  const c = clock();
  const cache = new TtlCache<string>({ maxEntries: 10, now: c.now });
  await cache.get('k', async () => 'v1', { ttlMs: 100 });
  c.advance(500);
  assert.equal(await cache.get('k', async () => { throw new Error('down'); }, { ttlMs: 100 }), 'v1');
});

test('cache: concurrent loads share one in-flight request', async () => {
  const cache = new TtlCache<number>({ maxEntries: 10 });
  let calls = 0;
  const load = () => new Promise<number>((r) => setTimeout(() => r(++calls), 10));
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => cache.get('k', load, { ttlMs: 1000 })));
  assert.deepEqual(all, [1, 1, 1, 1, 1]);
  assert.equal(calls, 1);
});

test('cache: LRU eviction keeps the recently used entries', async () => {
  const cache = new TtlCache<number>({ maxEntries: 3 });
  for (const k of ['a', 'b', 'c']) await cache.get(k, async () => 1, { ttlMs: 1000 });
  await cache.get('a', async () => 9, { ttlMs: 1000 }); // touch a
  await cache.get('d', async () => 1, { ttlMs: 1000 }); // evicts b (oldest)
  assert.equal(cache.size, 3);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.has('a'), true);
});

// ---- upstream: timeout, retry, breaker -------------------------------------------------------------------------------
const noSleep = async () => undefined;
const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => ({ ok: status < 400, status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, json: async () => body });

test('upstream: retries 5xx and 429 with backoff then succeeds', async () => {
  const seq = [res(503), res(429, {}, { 'retry-after': '1' }), res(200, { ok: 1 })];
  const sleeps: number[] = [];
  const u = new UpstreamClient({ name: 't', fetchFn: async () => seq.shift()!, sleep: async (ms) => void sleeps.push(ms) });
  assert.deepEqual(await u.getJson('https://x.test/?api_key=SECRET'), { ok: 1 });
  assert.equal(u.calls, 3);
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps[1] >= 1000, 'Retry-After respected');
});

test('upstream: 4xx is not retried; errors never contain the URL or key', async () => {
  const u = new UpstreamClient({ name: 't', fetchFn: async () => res(404), sleep: noSleep });
  await assert.rejects(u.getJson('https://x.test/?api_key=SECRET123'), (e: any) => e instanceof UpstreamError && e.status === 404 && !e.message.includes('SECRET123'));
  assert.equal(u.calls, 1);
});

test('upstream: retries are bounded, then the circuit opens for a cooldown and closes again', async () => {
  const c = clock();
  const u = new UpstreamClient({ name: 't', fetchFn: async () => res(500), sleep: noSleep, now: c.now, maxRetries: 1, breakerThreshold: 2, breakerCooldownMs: 30_000 });
  await assert.rejects(u.getJson('https://x.test/a'));
  assert.equal(u.calls, 2); // 1 try + 1 retry
  await assert.rejects(u.getJson('https://x.test/a'));
  assert.equal(u.circuitOpen, true);
  const before = u.calls;
  await assert.rejects(u.getJson('https://x.test/a'), (e: any) => e.kind === 'circuit_open');
  assert.equal(u.calls, before, 'no upstream call while open');
  c.advance(31_000);
  assert.equal(u.circuitOpen, false);
});

test('upstream: a hung fetch times out', async () => {
  const u = new UpstreamClient({ name: 't', fetchFn: () => new Promise(() => undefined), timeoutMs: 20, maxRetries: 0, sleep: noSleep });
  await assert.rejects(u.getJson('https://x.test/'), (e: any) => e.kind === 'timeout');
});

// ---- service ----------------------------------------------------------------------------------------------------------
const TMDB_ENV = { TMDB_API_KEY: 'test-key-not-real' };

test('not configured: every catalog call throws CatalogNotConfiguredError and nothing is fetched', async () => {
  const f = fakeFetch();
  const s = new CatalogService({ TVMAZE_ENABLED: '0' }, { fetchFn: f.fn });
  assert.equal(s.configured, false);
  await assert.rejects(s.genres(), CatalogNotConfiguredError);
  await assert.rejects(s.trending('all', 'IN'), CatalogNotConfiguredError);
  await assert.rejects(s.search({ type: 'all', sort: 'popularity', region: 'IN', page: 1 }), CatalogNotConfiguredError);
  await assert.rejects(s.details('movie', '1', 'IN'), CatalogNotConfiguredError);
  await assert.rejects(s.collection('trending', { region: 'IN', providers: [] }), CatalogNotConfiguredError);
  assert.equal(f.calls.length, 0);
});

test('without Watchmode: titles work, availability is unknown (null) and nothing is fetched from Watchmode', async () => {
  const f = fakeFetch([['/movie/603', tmdbMovieDetails]]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn });
  assert.equal(s.availabilityEnabled, false);
  assert.equal((await s.details('movie', '603', 'IN'))!.title, 'The Matrix Fixture');
  assert.equal(await s.providersFor('movie', '603', 'IN'), null);
  assert.equal(f.calls.filter((u) => u.includes('watchmode')).length, 0);
  assert.equal(await s.resolveDestinationUrl('tmdb:movie:603', '203', 'IN'), null);
});

test('TMDB auth: bearer token for v4, api_key query for v3', async () => {
  let seenHeaders: any;
  const fn = async (url: string, init: any) => { seenHeaders = { url, ...init.headers }; return { ok: true, status: 200, json: async () => page([]) }; };
  await new CatalogService({ TMDB_READ_TOKEN: 'tok' }, { fetchFn: fn as any }).trending('all', 'IN');
  assert.equal(seenHeaders.Authorization, 'Bearer tok');
  assert.ok(!seenHeaders.url.includes('api_key'));
  await new CatalogService({ TMDB_API_KEY: 'k3' }, { fetchFn: fn as any }).trending('all', 'IN');
  assert.ok(seenHeaders.url.includes('api_key=k3'));
});

test('details are cached for 6 h and shared between concurrent callers', async () => {
  const c = clock();
  const f = fakeFetch([['/movie/603', tmdbMovieDetails]]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn, now: c.now });
  await Promise.all([s.details('movie', '603', 'IN'), s.details('movie', '603', 'IN'), s.details('movie', '603', 'IN')]);
  assert.equal(f.calls.length, 1);
  c.advance(TTL.details.ttlMs - 1000);
  await s.details('movie', '603', 'IN');
  assert.equal(f.calls.length, 1);
});

const WM = { ...TMDB_ENV, WATCHMODE_API_KEY: 'wm-test' };
const wmRoutes = (): Array<[string, unknown, number?]> => [
  ['api.watchmode.com/v1/search/', { title_results: [{ id: 555 }] }],
  ['api.watchmode.com/v1/title/555/sources/', wmOffers],
  ['api.watchmode.com/v1/sources/', wmSources]
];

test('availability: region-specific, verified, link validated, cached 30 min', async () => {
  const f = fakeFetch(wmRoutes());
  const s = new CatalogService(WM, { fetchFn: f.fn });
  const inOffers = (await s.providersFor('movie', '603', 'IN'))!;
  assert.ok(inOffers.every((o) => o.verified));
  assert.equal(await s.resolveDestinationUrl('tmdb:movie:603', '203', 'IN'), 'https://www.netflix.com/title/20557937');
  assert.equal(await s.resolveDestinationUrl('tmdb:movie:603', '372', 'IN'), null, 'rejected link');
  assert.equal(await s.resolveDestinationUrl('not-a-key', '203', 'IN'), null);
  const before = f.calls.length;
  await s.providersFor('movie', '603', 'IN');
  assert.equal(f.calls.length, before, 'second call served from cache');
});

test('availability: unknown id or upstream failure is "unknown" (null), not "unavailable"', async () => {
  const s = new CatalogService(WM, { fetchFn: fakeFetch([['api.watchmode.com/v1/search/', { title_results: [] }]]).fn });
  assert.equal(await s.providersFor('movie', '1', 'IN'), null);
  const s2 = new CatalogService(WM, { fetchFn: fakeFetch([['api.watchmode.com', {}, 500]]).fn, sleep: noSleep });
  assert.equal(await s2.providersFor('movie', '1', 'IN'), null);
});

test('search: discover for filters, provider filter keeps only verified matches', async () => {
  const f = fakeFetch([
    ...wmRoutes(),
    ['/discover/movie', page([listMovie(1), listMovie(2)])],
    ['/discover/tv', page([listTv(3)])]
  ]);
  const s = new CatalogService(WM, { fetchFn: f.fn });
  const all = await s.search({ type: 'all', sort: 'rating', region: 'IN', page: 1, genre: 35, yearFrom: 2020, yearTo: 2022 });
  assert.equal(all.results.length, 3);
  assert.equal(all.results[0].mediaType, 'tv', 'sorted by rating, tv 8.1 first');
  const dq = f.calls.find((u) => u.includes('/discover/movie'))!;
  assert.ok(dq.includes('with_genres=35') && dq.includes('primary_release_date.gte=2020-01-01') && dq.includes('primary_release_date.lte=2022-12-31') && dq.includes('sort_by=vote_average.desc'));
  const filtered = await s.search({ type: 'all', sort: 'popularity', region: 'IN', page: 1, provider: 'netflix' });
  assert.equal(filtered.providerFilterApplied, true);
  assert.equal(filtered.results.length, 3); // fixture offers say Netflix for every mapped title
  const none = await s.search({ type: 'all', sort: 'popularity', region: 'US', page: 1, provider: 'netflix' });
  assert.equal(none.results.length, 0, 'no Netflix offer in US');
});

test('search with a text query uses TMDB search and applies genre/year to the page', async () => {
  const f = fakeFetch([['/search/multi', page([listMovie(1, { release_date: '2010-05-05' }), listMovie(2, { genre_ids: [18] }), { id: 9, media_type: 'person', name: 'X' }])]]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn });
  const r = await s.search({ q: 'dream', type: 'all', sort: 'popularity', region: 'IN', page: 1, genre: 35, yearFrom: 2010, yearTo: 2010 });
  assert.deepEqual(r.results.map((t) => t.sourceId), ['1']);
  assert.equal(r.providerFilterApplied, false);
  assert.equal(r.availabilityEnabled, false);
});

test('search results are cached for 60 s', async () => {
  const c = clock();
  const f = fakeFetch([['/search/multi', page([listMovie(1)])]]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn, now: c.now });
  const p = { q: 'a', type: 'all' as const, sort: 'popularity' as const, region: 'IN', page: 1 };
  await s.search(p);
  await s.search(p);
  assert.equal(f.calls.length, 1);
  c.advance(TTL.search.ttlMs + TTL.search.staleMs + 1);
  await s.search(p);
  assert.equal(f.calls.length, 2);
});

// ---- collections ------------------------------------------------------------------------------------------------------
test('collection definitions: unique slugs, a documented one-line selection rule each', () => {
  const slugs = COLLECTIONS.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const expected of ['spotlight', 'trending', 'hidden-gems', 'one-night-binge', 'mind-bending', 'comfort-cinema', 'critically-loved', 'because-you-watched', 'on-your-platforms', 'trending-india', 'bollywood-hits', 'south-indian-cinema', 'indian-series']) assert.ok(slugs.includes(expected), expected);
  for (const c of COLLECTIONS) {
    assert.ok(c.howWePick.length > 20 && !c.howWePick.includes('\n'), c.slug);
    assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(c.howWePick + c.title));
  }
  assert.equal(findCollection('nope'), undefined);
  const gems = findCollection('hidden-gems')!;
  assert.equal(gems.queries![0].opts.minRating, 7.3);
  assert.equal(gems.queries![0].opts.minVotes, 300);
  assert.equal(gems.queries![0].opts.maxVotes, 3000);
  assert.equal(findCollection('critically-loved')!.queries![0].opts.minRating, 8);
});

test('hidden gems drops mainstream popularity; critically loved filters below 8', async () => {
  const f = fakeFetch([
    ['/discover/movie', page([listMovie(1, { popularity: 10, vote_average: 7.8, vote_count: 500 }), listMovie(2, { popularity: 300, vote_average: 8.5, vote_count: 2500 }), listMovie(3, { popularity: 5, vote_average: 7.0, vote_count: 400 })])],
    ['/discover/tv', page([])]
  ]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn });
  const gems = await s.collection('hidden-gems', { region: 'IN', providers: [] });
  assert.deepEqual(gems!.items.map((t) => t.sourceId), ['1']);
  const loved = await s.collection('critically-loved', { region: 'IN', providers: [] });
  assert.ok(loved!.items.every((t) => (t.rating ?? 0) >= 8));
});

test('one-night binge keeps 1-season TV with <= 8 episodes after a details check', async () => {
  const f = fakeFetch([
    ['/discover/movie', page([listMovie(1, { vote_average: 7.5 })])],
    ['/discover/tv', page([listTv(1396), listTv(2000)])],
    ['/tv/1396?', tmdbTvDetails],
    ['/tv/2000?', { ...tmdbTvDetails, id: 2000, number_of_seasons: 4, number_of_episodes: 40 }]
  ]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn });
  const r = (await s.collection('one-night-binge', { region: 'IN', providers: [] }))!;
  const keys = r.items.map((t) => t.id);
  assert.ok(keys.includes('tmdb:movie:1'));
  assert.ok(keys.includes('tmdb:tv:1396'));
  assert.ok(!keys.includes('tmdb:tv:2000'));
});

test('because-you-watched: hidden without watchlist data, seeded from saved titles otherwise, excludes saved', async () => {
  const f = fakeFetch([['/movie/10/recommendations', page([listMovie(11), listMovie(12)])], ['/movie/20/recommendations', page([listMovie(12), listMovie(21)])]]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn });
  const none = await s.collection('because-you-watched', { region: 'IN', providers: [] });
  assert.equal(none!.available, false);
  assert.equal(none!.items.length, 0);
  assert.equal(f.calls.length, 0, 'nothing fetched, nothing faked');
  const r = await s.collection('because-you-watched', { region: 'IN', providers: [], userSeeds: [{ mediaType: 'movie', id: '10' }, { mediaType: 'movie', id: '20' }], excludeKeys: new Set(['tmdb:movie:11']) });
  assert.deepEqual(r!.items.map((t) => t.sourceId), ['12', '21']);
});

test('on-your-platforms: needs Watchmode and chosen platforms; filters to verified', async () => {
  const s0 = new CatalogService(TMDB_ENV, { fetchFn: fakeFetch().fn });
  const off = await s0.collection('on-your-platforms', { region: 'IN', providers: ['netflix'] });
  assert.equal(off!.available, false);
  assert.equal(off!.note, 'Availability data is not enabled');
  const f = fakeFetch([...wmRoutes(), ['/trending/all', page([listMovie(1)])], ['/discover/movie', page([listMovie(2)])], ['/discover/tv', page([listTv(3)])]]);
  const s = new CatalogService(WM, { fetchFn: f.fn });
  const none = await s.collection('on-your-platforms', { region: 'IN', providers: [] });
  assert.equal(none!.available, false);
  const r = await s.collection('on-your-platforms', { region: 'IN', providers: ['netflix'] });
  assert.ok(r!.items.length > 0 && r!.items.every((t) => t.providers.some((o) => o.name === 'Netflix' && o.verified)));
  const us = await s.collection('on-your-platforms', { region: 'US', providers: ['netflix'] });
  assert.equal(us!.items.length, 0);
});

test('spotlight is stable within a day and has a backdrop', async () => {
  const c = clock(Date.parse('2026-10-17T10:00:00Z'));
  const trending = page(Array.from({ length: 10 }, (_, i) => listMovie(i + 1)));
  const f = fakeFetch([['/trending/all', trending], ['/movie/', tmdbMovieDetails]]);
  const s = new CatalogService(TMDB_ENV, { fetchFn: f.fn, now: c.now });
  const a = await s.collection('spotlight', { region: 'IN', providers: [] });
  c.advance(3 * 3600_000);
  const b = await s.collection('spotlight', { region: 'IN', providers: [] });
  assert.equal(a!.items.length, 1);
  assert.deepEqual(a!.items[0].id, b!.items[0].id);
  assert.ok(a!.items[0].backdropPath);
});
