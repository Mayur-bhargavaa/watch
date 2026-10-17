import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { CatalogService } from '../services/catalog/service.js';
import { MemoryWatchlistStore } from '../services/catalog/watchlist.js';
import { registerCatalogRoutes } from '../routes/catalog.js';
import { UpstreamClient } from '../services/catalog/upstream.js';
import { TmdbAdapter } from '../services/catalog/adapters/tmdb.js';
import { COLLECTIONS, COLLECTION_SLUGS, addDaysUtc, findCollection } from '../services/catalog/collections.js';
import { fakeFetch, page, listMovie, listTv } from './catalogFixtures.js';

const TMDB_ENV = { TMDB_API_KEY: 'test-key-not-real' };
const NOW = Date.parse('2026-10-17T10:00:00Z');
const TODAY = '2026-10-17';
const noSleep = async () => undefined;
const make = (f: ReturnType<typeof fakeFetch>, now: () => number = () => NOW) => new CatalogService(TMDB_ENV, { fetchFn: f.fn, now, sleep: noSleep });
const discoverCalls = (f: ReturnType<typeof fakeFetch>) => f.calls.filter((u) => u.includes('/discover/')).map((u) => new URL(u));
const ALLOWED_KEYS = new Set(['page', 'include_adult', 'sort_by', 'with_original_language', 'with_origin_country', 'region', 'vote_count.gte', 'primary_release_date.gte', 'primary_release_date.lte', 'first_air_date.gte', 'first_air_date.lte', 'language', 'api_key']);
const ctx = { region: 'IN', providers: [] as string[] };

test('india: the four slugs are registered with a one-line, honest caption', () => {
  for (const slug of ['trending-india', 'bollywood-hits', 'south-indian-cinema', 'indian-series']) {
    const c = findCollection(slug)!;
    assert.ok(c, slug);
    assert.ok(COLLECTION_SLUGS.includes(slug));
    assert.ok(c.howWePick.length > 20 && !c.howWePick.includes('\n'), slug);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(c.title + c.howWePick + c.eyebrow));
    assert.equal(c.limit, 20);
  }
  assert.match(findCollection('trending-india')!.howWePick, /not live trending/i);
  assert.equal(new Set(COLLECTIONS.map((c) => c.slug)).size, COLLECTIONS.length);
  assert.equal(addDaysUtc('2026-10-17', -120), '2026-06-19');
});

test('bollywood-hits: Hindi movies, vote floor, region IN, released by today; future and low-vote titles are dropped', async () => {
  const f = fakeFetch([['/discover/movie', page([
    listMovie(1, { popularity: 90, vote_count: 900, release_date: '2024-05-01' }),
    listMovie(2, { popularity: 80, vote_count: 149, release_date: '2023-05-01' }),
    listMovie(3, { popularity: 70, vote_count: 5000, release_date: '2026-12-25' }),
    listMovie(4, { popularity: 60, vote_count: 150, release_date: '2022-01-01' })
  ])]]);
  const r = (await make(f).collection('bollywood-hits', ctx))!;
  assert.deepEqual(r.items.map((t) => t.sourceId), ['1', '4']);
  assert.ok(r.items.every((t) => t.ratingSource === 'TMDB' && t.source === 'tmdb' && t.region === 'IN' && t.providers.length === 0));
  const calls = discoverCalls(f);
  assert.equal(calls.length, 1);
  const q = calls[0].searchParams;
  assert.equal(calls[0].pathname, '/3/discover/movie');
  assert.equal(q.get('with_original_language'), 'hi');
  assert.equal(q.get('region'), 'IN');
  assert.equal(q.get('vote_count.gte'), '150');
  assert.equal(q.get('primary_release_date.lte'), TODAY);
  assert.equal(q.get('sort_by'), 'popularity.desc');
  assert.equal(q.get('include_adult'), 'false');
  for (const k of q.keys()) assert.ok(ALLOWED_KEYS.has(k), k);
});

test('south-indian-cinema: one call per language, merged, de-duplicated, popularity ordered and capped', async () => {
  const mk = (base: number, pops: number[]) => page(pops.map((p, i) => listMovie(base + i, { popularity: p, vote_count: 500 })));
  const f = fakeFetch([
    ['with_original_language=ta', mk(100, Array.from({ length: 12 }, (_, i) => 200 - i * 10))],
    ['with_original_language=te', page([listMovie(100, { popularity: 999, vote_count: 500 }), ...mk(200, Array.from({ length: 12 }, (_, i) => 195 - i * 10)).results])],
    ['with_original_language=ml', mk(300, [150, 40])],
    ['with_original_language=kn', mk(400, [180, 20])]
  ]);
  const r = (await make(f).collection('south-indian-cinema', ctx))!;
  const langs = discoverCalls(f).map((u) => u.searchParams.get('with_original_language')).sort();
  assert.deepEqual(langs, ['kn', 'ml', 'ta', 'te']);
  for (const u of discoverCalls(f)) {
    assert.equal(u.pathname, '/3/discover/movie');
    assert.equal(u.searchParams.get('vote_count.gte'), '100');
    assert.equal(u.searchParams.get('primary_release_date.lte'), TODAY);
    for (const k of u.searchParams.keys()) assert.ok(ALLOWED_KEYS.has(k), k);
  }
  assert.equal(r.items.length, 20);
  const ids = r.items.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  const pops = r.items.map((t) => t.popularity ?? 0);
  assert.deepEqual(pops, [...pops].sort((a, b) => b - a));
  assert.equal(r.items[0].sourceId, '100'); // the duplicate keeps its first-seen copy; ordering is by popularity
});

test('south-indian-cinema: a failing language degrades gracefully, the others still show', async () => {
  const f = fakeFetch([
    ['with_original_language=te', {}, 500],
    ['with_original_language=ta', page([listMovie(1, { popularity: 50, vote_count: 300 })])],
    ['with_original_language=ml', page([listMovie(2, { popularity: 60, vote_count: 300 })])],
    ['with_original_language=kn', page([])]
  ]);
  const r = (await make(f).collection('south-indian-cinema', ctx))!;
  assert.deepEqual(r.items.map((t) => t.sourceId), ['2', '1']);
  assert.equal(r.available, true);
  const allFail = fakeFetch([['/discover/', {}, 404]]);
  const none = (await make(allFail).collection('south-indian-cinema', ctx))!;
  assert.equal(none.available, false);
  assert.deepEqual(none.items, []);
});

test('indian-series: TV only, origin country IN, vote floor, nothing unreleased', async () => {
  const f = fakeFetch([['/discover/tv', page([
    listTv(1, { popularity: 50, vote_count: 400, first_air_date: '2023-01-01' }),
    listTv(2, { popularity: 40, vote_count: 49, first_air_date: '2022-01-01' }),
    listTv(3, { popularity: 30, vote_count: 900, first_air_date: '2027-01-01' })
  ])]]);
  const r = (await make(f).collection('indian-series', ctx))!;
  assert.deepEqual(r.items.map((t) => t.id), ['tmdb:tv:1']);
  const calls = discoverCalls(f);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/3/discover/tv');
  const q = calls[0].searchParams;
  assert.equal(q.get('with_origin_country'), 'IN');
  assert.equal(q.get('vote_count.gte'), '50');
  assert.equal(q.get('first_air_date.lte'), TODAY);
  assert.equal(q.get('with_original_language'), null);
  assert.equal(q.get('region'), null);
  for (const k of q.keys()) assert.ok(ALLOWED_KEYS.has(k), k);
});

test('trending-india: movies and TV from India in the last 120 days, merged by popularity, window enforced', async () => {
  const f = fakeFetch([
    ['/discover/movie', page([listMovie(1, { popularity: 70, vote_count: 80, release_date: '2026-09-01' }), listMovie(2, { popularity: 99, vote_count: 80, release_date: '2026-01-01' })])],
    ['/discover/tv', page([listTv(5, { popularity: 85, vote_count: 20, first_air_date: '2026-08-01' }), listTv(6, { popularity: 95, vote_count: 20, first_air_date: '2026-11-30' })])]
  ]);
  const r = (await make(f).collection('trending-india', ctx))!;
  assert.deepEqual(r.items.map((t) => t.id), ['tmdb:tv:5', 'tmdb:movie:1']);
  const calls = discoverCalls(f);
  assert.deepEqual(calls.map((u) => u.pathname).sort(), ['/3/discover/movie', '/3/discover/tv']);
  for (const u of calls) {
    const q = u.searchParams;
    assert.equal(q.get('with_origin_country'), 'IN');
    const key = u.pathname.endsWith('movie') ? 'primary_release_date' : 'first_air_date';
    assert.equal(q.get(`${key}.gte`), '2026-06-19');
    assert.equal(q.get(`${key}.lte`), TODAY);
    assert.equal(q.get('sort_by'), 'popularity.desc');
    for (const k of q.keys()) assert.ok(ALLOWED_KEYS.has(k), k);
  }
});

test('adapter: discover refuses language, country, region and date values outside the allow-lists', async () => {
  const f = fakeFetch([['/discover/', page([])]]);
  const a = new TmdbAdapter({ apiKey: 'test-key-not-real' }, new UpstreamClient({ name: 't', fetchFn: f.fn, sleep: noSleep }));
  await assert.rejects(a.discover('movie', { language: 'en|fr' }, 'IN'), /language/);
  await assert.rejects(a.discover('movie', { language: 'xx' }, 'IN'), /language/);
  await assert.rejects(a.discover('tv', { originCountry: 'US' }, 'IN'), /origin/);
  await assert.rejects(a.discover('movie', { releaseRegion: 'US' }, 'IN'), /region/);
  await assert.rejects(a.discover('movie', { releaseTo: '2026-10-17&api_key=x' }, 'IN'), /date/);
  await assert.rejects(a.discover('movie', { releaseFrom: 'yesterday' }, 'IN'), /date/);
  assert.equal(f.calls.length, 0);
  await a.discover('movie', { language: 'hi', releaseRegion: 'IN', releaseFrom: '2026-01-01', releaseTo: TODAY }, 'IN');
  await a.discover('tv', { originCountry: 'IN', releaseRegion: 'IN' }, 'IN');
  assert.equal(new URL(f.calls[0]).searchParams.get('primary_release_date.gte'), '2026-01-01');
  assert.equal(new URL(f.calls[1]).searchParams.get('region'), null, 'region is movie-only');
});

test('india collections are cached for 10 minutes per region and not shared across regions', async () => {
  let t = NOW;
  const f = fakeFetch([['/discover/', page([listMovie(1, { vote_count: 500 })])]]);
  const s = make(f, () => t);
  await s.collection('bollywood-hits', ctx);
  await s.collection('bollywood-hits', ctx);
  assert.equal(discoverCalls(f).length, 1);
  t += 5 * 60_000;
  await s.collection('bollywood-hits', ctx);
  assert.equal(discoverCalls(f).length, 1);
  await s.collection('bollywood-hits', { ...ctx, region: 'US' });
  assert.equal(discoverCalls(f).length, 2);
  await s.collection('south-indian-cinema', ctx);
  assert.equal(discoverCalls(f).length, 6);
  await s.collection('south-indian-cinema', ctx);
  assert.equal(discoverCalls(f).length, 6);
  assert.equal(await s.collection('not-a-slug', ctx), null);
});

test('india routes: allowed for a signed-in account, unknown slug still 404, bad region / extra params 400', async () => {
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const f = fakeFetch([['/discover/', page([listMovie(3, { vote_count: 900 })])]]);
  await registerCatalogRoutes(app, { catalog: make(f), watchlist: new MemoryWatchlistStore() });
  const h = { authorization: `Bearer ${app.jwt.sign({ id: 'u1', displayName: 'U1', isAnonymous: false })}` };
  for (const slug of ['trending-india', 'bollywood-hits', 'south-indian-cinema', 'indian-series']) {
    const r = await app.inject({ url: `/api/catalog/collections/${slug}`, headers: h });
    assert.equal(r.statusCode, 200, slug);
    assert.equal(r.json().slug, slug);
    assert.ok(Array.isArray(r.json().items));
    assert.equal((await app.inject({ url: `/api/catalog/collections/${slug}?region=us`, headers: h })).statusCode, 200);
    assert.equal((await app.inject({ url: `/api/catalog/collections/${slug}?region=USA`, headers: h })).statusCode, 400);
    assert.equal((await app.inject({ url: `/api/catalog/collections/${slug}?language=hi`, headers: h })).statusCode, 400);
    assert.equal((await app.inject({ url: `/api/catalog/collections/${slug}` })).statusCode, 401);
  }
  assert.equal((await app.inject({ url: '/api/catalog/collections/bollywood-hits-2', headers: h })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/catalog/collections/..%2Fstatus', headers: h })).statusCode, 404);
  await app.close();
});
