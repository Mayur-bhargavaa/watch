import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { CatalogService } from '../services/catalog/service.js';
import { MemoryWatchlistStore } from '../services/catalog/watchlist.js';
import { registerCatalogRoutes, regionFor, type RoomTitleApi } from '../routes/catalog.js';
import { fakeFetch, page, listMovie, tmdbMovieDetails, wmOffers, wmSources } from './catalogFixtures.js';
import { EMPTY_TITLE_STATE } from '@synccinema/common';

const SECRET_KEY = 'tmdb-key-must-never-leak-123';
const WM_KEY = 'watchmode-key-must-never-leak-456';

async function build(opts: { catalog?: CatalogService; limits?: any; rooms?: RoomTitleApi; watchlist?: MemoryWatchlistStore } = {}) {
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const fetchStub = fakeFetch([
    ['api.watchmode.com/v1/search/', { title_results: [{ id: 9 }] }],
    ['api.watchmode.com/v1/title/9/sources/', wmOffers],
    ['api.watchmode.com/v1/sources/', wmSources],
    ['/search/', page([listMovie(1), listMovie(2)])],
    ['/discover/', page([listMovie(3)])],
    ['/trending/', page([listMovie(4)])],
    ['/genre/', { genres: [{ id: 35, name: 'Comedy' }] }],
    ['/movie/603/recommendations', page([listMovie(5)])],
    ['/movie/603', tmdbMovieDetails]
  ]);
  const catalog = opts.catalog ?? new CatalogService({ TMDB_API_KEY: SECRET_KEY, WATCHMODE_API_KEY: WM_KEY }, { fetchFn: fetchStub.fn });
  const watchlist = opts.watchlist ?? new MemoryWatchlistStore();
  await registerCatalogRoutes(app, { catalog, watchlist, rooms: opts.rooms, limits: opts.limits });
  const tok = (id: string, extra: any = {}) => ({ authorization: `Bearer ${app.jwt.sign({ id, displayName: id.toUpperCase(), isAnonymous: false, ...extra })}` });
  return { app, catalog, watchlist, tok, fetchStub };
}
const close = async (a: FastifyInstance) => { await a.close(); };

test('auth: every catalog route rejects missing, bad and anonymous tokens', async () => {
  const { app, tok } = await build();
  const paths: Array<[string, string]> = [['GET', '/api/catalog/search'], ['GET', '/api/catalog/trending'], ['GET', '/api/catalog/genres'], ['GET', '/api/catalog/titles/tmdb/movie/603'], ['GET', '/api/catalog/titles/tmdb/movie/603/providers'], ['GET', '/api/catalog/titles/tmdb/movie/603/recommendations'], ['GET', '/api/catalog/collections/trending'], ['GET', '/api/catalog/collections/trending-india'], ['GET', '/api/catalog/collections/bollywood-hits'], ['GET', '/api/catalog/collections/south-indian-cinema'], ['GET', '/api/catalog/collections/indian-series'], ['GET', '/api/catalog/collections/free-movies'], ['POST', '/api/catalog/matchmaker'], ['GET', '/api/catalog/watchlist'], ['POST', '/api/catalog/watchlist'], ['DELETE', '/api/catalog/watchlist/tmdb:movie:1'], ['GET', '/api/catalog/status']];
  for (const [method, url] of paths) {
    for (const headers of [{}, { authorization: 'Bearer nope' }, tok('g1', { isAnonymous: true })]) {
      const r = await app.inject({ method: method as any, url, headers: headers as any, payload: method === 'POST' ? {} : undefined });
      assert.equal(r.statusCode, 401, `${method} ${url}`);
    }
  }
  await close(app);
});

test('503 CATALOG_NOT_CONFIGURED on every data route when TMDB is not configured, no upstream call', async () => {
  const f = fakeFetch();
  const { app, tok } = await build({ catalog: new CatalogService({ TVMAZE_ENABLED: '0' }, { fetchFn: f.fn }) });
  const body = { mood: 'funny', time: 'under90', genres: [], providers: [], mode: 'solo', seed: 's' };
  for (const [method, url, payload] of [['GET', '/api/catalog/search?q=x'], ['GET', '/api/catalog/trending'], ['GET', '/api/catalog/genres'], ['GET', '/api/catalog/titles/tmdb/movie/1'], ['GET', '/api/catalog/titles/tmdb/tv/1/providers'], ['GET', '/api/catalog/titles/tmdb/tv/1/recommendations'], ['GET', '/api/catalog/collections/trending'], ['POST', '/api/catalog/matchmaker', body]] as any[]) {
    const r = await app.inject({ method, url, headers: tok('u1'), payload });
    assert.equal(r.statusCode, 503, url);
    assert.deepEqual(r.json(), { error: 'Catalog is not configured', code: 'CATALOG_NOT_CONFIGURED' });
  }
  const status = await app.inject({ url: '/api/catalog/status', headers: tok('u1') });
  assert.equal(status.json().configured, false);
  assert.equal(f.calls.length, 0);
  // the watchlist is a plain database feature and keeps working
  assert.equal((await app.inject({ url: '/api/catalog/watchlist', headers: tok('u1') })).statusCode, 200);
  await close(app);
});

test('validation: bad types, huge values, unknown enums and unknown params are 400', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  const bad = [
    '/api/catalog/search?type=book', '/api/catalog/search?sort=random', '/api/catalog/search?page=0', '/api/catalog/search?page=99999', '/api/catalog/search?page=abc',
    '/api/catalog/search?genre=-1', '/api/catalog/search?genre=99999999999', '/api/catalog/search?year=1800', '/api/catalog/search?year=2020-2010', '/api/catalog/search?year=20x0',
    `/api/catalog/search?q=${'a'.repeat(101)}`, '/api/catalog/search?provider=NET%20FLIX', '/api/catalog/search?provider=' + 'a'.repeat(60), '/api/catalog/search?region=USA', '/api/catalog/search?debug=1',
    '/api/catalog/search?q=a&q=b', '/api/catalog/trending?type=all&x=1', '/api/catalog/trending?type=audio', '/api/catalog/titles/tmdb/movie/603?foo=1',
    '/api/catalog/titles/imdb/movie/603', '/api/catalog/titles/tmdb/book/603', '/api/catalog/titles/tmdb/movie/abc', '/api/catalog/titles/tmdb/movie/' + '9'.repeat(30),
    '/api/catalog/titles/tmdb/movie/603/recommendations?page=11', '/api/catalog/collections/trending?providers=NET', '/api/catalog/collections/trending?x=1'
  ];
  for (const url of bad) assert.equal((await app.inject({ url, headers: h })).statusCode, 400, url);
  assert.equal((await app.inject({ url: '/api/catalog/collections/nope', headers: h })).statusCode, 404);
  const okUrls = ['/api/catalog/search', '/api/catalog/search?q=dream&type=movie&genre=35&year=2010-2020&sort=rating&region=us&page=2', '/api/catalog/trending?type=tv'];
  for (const url of okUrls) assert.equal((await app.inject({ url, headers: h })).statusCode, 200, url);
  await close(app);
});

test('matchmaker body validation', async () => {
  const { app, tok } = await build();
  const good = { mood: 'funny', time: 'under90', genres: [35], providers: ['netflix'], mode: 'group', seed: 'abc' };
  const post = (payload: any) => app.inject({ method: 'POST', url: '/api/catalog/matchmaker', headers: tok('u1'), payload });
  for (const bad of [{ ...good, mood: 'angry' }, { ...good, time: 'forever' }, { ...good, mode: 'crowd' }, { ...good, genres: Array(7).fill(1) }, { ...good, genres: ['x'] }, { ...good, providers: Array(9).fill('a') }, { ...good, providers: ['Net Flix'] }, { ...good, seed: '' }, { ...good, seed: 'x'.repeat(65) }, { ...good, extra: 1 }, {}]) {
    assert.equal((await post(bad)).statusCode, 400, JSON.stringify(bad).slice(0, 80));
  }
  const ok = await post(good);
  assert.equal(ok.statusCode, 200);
  assert.ok(Array.isArray(ok.json().picks));
  await close(app);
});

test('responses never contain provider secrets; error bodies are generic', async () => {
  const { app, tok } = await build();
  const urls = ['/api/catalog/search?q=x', '/api/catalog/trending', '/api/catalog/genres', '/api/catalog/titles/tmdb/movie/603', '/api/catalog/titles/tmdb/movie/603/providers', '/api/catalog/collections/trending', '/api/catalog/collections/trending-india', '/api/catalog/collections/bollywood-hits', '/api/catalog/collections/south-indian-cinema', '/api/catalog/collections/indian-series', '/api/catalog/collections/free-movies', '/api/catalog/status'];
  for (const url of urls) {
    const r = await app.inject({ url, headers: tok('u1') });
    assert.ok(!r.body.includes(SECRET_KEY) && !r.body.includes(WM_KEY), url);
    assert.ok(!JSON.stringify(r.headers).includes(SECRET_KEY));
  }
  const down = fakeFetch([['', {}, 500]]);
  const b2 = await build({ catalog: new CatalogService({ TMDB_API_KEY: SECRET_KEY }, { fetchFn: down.fn, sleep: async () => undefined }) });
  const r = await b2.app.inject({ url: '/api/catalog/trending', headers: b2.tok('u1') });
  assert.equal(r.statusCode, 502);
  assert.equal(r.json().code, 'CATALOG_UPSTREAM');
  assert.ok(!r.body.includes(SECRET_KEY));
  await close(app); await close(b2.app);
});

test('title details include verified, region-specific providers with capabilities', async () => {
  const { app, tok } = await build();
  const r = await app.inject({ url: '/api/catalog/titles/tmdb/movie/603?region=IN', headers: tok('u1') });
  const j = r.json();
  assert.equal(j.availabilityVerified, true);
  const netflix = j.title.providers.find((p: any) => p.name === 'Netflix');
  assert.equal(netflix.destinationUrl, 'https://www.netflix.com/title/20557937');
  assert.deepEqual(netflix.capabilities, { playback: 'none', roomSync: 'coordinated_start' });
  assert.ok(j.title.providers.every((p: any) => p.destinationUrl === null || p.destinationUrl.startsWith('https://')));
  const us = await app.inject({ url: '/api/catalog/titles/tmdb/movie/603/providers?region=US', headers: tok('u1') });
  assert.deepEqual(us.json().providers.map((p: any) => p.name), ['Prime Video']);
  const missing = await app.inject({ url: '/api/catalog/titles/tmdb/movie/999999', headers: tok('u1') });
  assert.equal(missing.statusCode, 404);
  await close(app);
});

test('without Watchmode: titles are served and availability is reported as not enabled', async () => {
  const f = fakeFetch([['/movie/603', tmdbMovieDetails]]);
  const { app, tok } = await build({ catalog: new CatalogService({ TMDB_API_KEY: 'k' }, { fetchFn: f.fn }) });
  const j = (await app.inject({ url: '/api/catalog/titles/tmdb/movie/603', headers: tok('u1') })).json();
  assert.equal(j.availabilityEnabled, false);
  assert.equal(j.availabilityVerified, false);
  assert.deepEqual(j.title.providers, []);
  await close(app);
});

test('region: explicit ?region wins, then CDN header, then default; invalid values fall back', () => {
  assert.equal(regionFor({ headers: {}, query: { region: 'gb' } }, 'IN'), 'GB');
  assert.equal(regionFor({ headers: { 'cf-ipcountry': 'US' }, query: {} }, 'IN'), 'US');
  assert.equal(regionFor({ headers: {}, query: {} }, 'IN'), 'IN');
  assert.equal(regionFor({ headers: { 'cf-ipcountry': 'ZZ' }, query: { region: 'QQ' } }, 'IN'), 'IN');
});

const body = (n: number) => ({ titleKey: `tmdb:movie:${n}`, title: `Movie ${n}`, posterPath: '/p.jpg', year: 2020, mediaType: 'movie' });

test('watchlist: add, duplicate prevention, list, remove, unknown removal', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  const add = (n: number) => app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: h, payload: body(n) });
  assert.equal((await add(1)).statusCode, 201);
  const dup = await add(1);
  assert.equal(dup.statusCode, 200);
  assert.equal(dup.json().duplicate, true);
  await add(2);
  const list = (await app.inject({ url: '/api/catalog/watchlist', headers: h })).json();
  assert.deepEqual(list.items.map((i: any) => i.titleKey).sort(), ['tmdb:movie:1', 'tmdb:movie:2']);
  assert.equal(list.items[0].title.startsWith('Movie'), true);
  const del = await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/tmdb:movie:1', headers: h });
  assert.equal(del.json().removed, true);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist?titleKey=tmdb:movie:1', headers: h })).json().removed, false);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/garbage', headers: h })).statusCode, 400);
  await close(app);
});

test('watchlist: private between users, removal cannot touch another user, bodies are validated', async () => {
  const { app, tok } = await build();
  const a = tok('alice'), b = tok('bob');
  await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: a, payload: body(1) });
  assert.deepEqual((await app.inject({ url: '/api/catalog/watchlist', headers: b })).json().items, []);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/tmdb:movie:1', headers: b })).json().removed, false);
  assert.equal((await app.inject({ url: '/api/catalog/watchlist', headers: a })).json().items.length, 1);
  // a user id in the query or body can never select another user's list
  assert.deepEqual((await app.inject({ url: '/api/catalog/watchlist?userId=alice', headers: b })).json().items ?? 'x', []);
  for (const bad of [{ ...body(1), titleKey: 'tmdb:movie:x' }, { ...body(1), mediaType: 'tv' }, { ...body(1), title: '' }, { ...body(1), title: 'x'.repeat(301) }, { ...body(1), posterPath: 'http://evil/x.jpg' }, { ...body(1), year: 99999 }, { ...body(1), userId: 'bob' }, {}]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: b, payload: bad })).statusCode, 400, JSON.stringify(bad).slice(0, 70));
  }
  await close(app);
});

test('watchlist: capped', async () => {
  const { app, tok } = await build({ watchlist: new MemoryWatchlistStore(3) });
  const h = tok('u1');
  for (let i = 1; i <= 3; i++) assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: h, payload: body(i) })).statusCode, 201);
  const full = await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: h, payload: body(4) });
  assert.equal(full.statusCode, 409);
  assert.equal(full.json().code, 'WATCHLIST_FULL');
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: h, payload: body(1) })).statusCode, 200, 'existing title is a duplicate, not "full"');
  await close(app);
});

test('because-you-watched uses only the caller\'s own watchlist', async () => {
  const { app, tok, fetchStub } = await build();
  const empty = (await app.inject({ url: '/api/catalog/collections/because-you-watched', headers: tok('bob') })).json();
  assert.equal(empty.available, false);
  await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: tok('alice'), payload: body(603) });
  const bobStill = (await app.inject({ url: '/api/catalog/collections/because-you-watched', headers: tok('bob') })).json();
  assert.equal(bobStill.available, false, "alice's list never seeds bob");
  const alice = (await app.inject({ url: '/api/catalog/collections/because-you-watched', headers: tok('alice') })).json();
  assert.equal(alice.available, true);
  assert.ok(fetchStub.calls.some((u) => u.includes('/movie/603/recommendations')));
  await close(app);
});

test('rate limits: catalog reads, matchmaker and watchlist writes', async () => {
  const { app, tok } = await build({ limits: { catalogPerMin: 3, matchmakerPerMin: 2, watchlistWritesPerMin: 2 } });
  const h = tok('u1');
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) codes.push((await app.inject({ url: '/api/catalog/trending', headers: h })).statusCode);
  assert.deepEqual(codes.slice(0, 1), [200]);
  assert.ok(codes.includes(429));
  const m = { mood: 'funny', time: 'longer', genres: [], providers: [], mode: 'solo', seed: 's' };
  const mc: number[] = [];
  for (let i = 0; i < 4; i++) mc.push((await app.inject({ method: 'POST', url: '/api/catalog/matchmaker', headers: tok('u2'), payload: m })).statusCode);
  assert.ok(mc.includes(429));
  const wc: number[] = [];
  for (let i = 1; i <= 4; i++) wc.push((await app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: tok('u3'), payload: body(i) })).statusCode);
  assert.deepEqual(wc.slice(0, 2), [201, 201]);
  assert.equal(wc[3], 429);
  await close(app);
});

test('room REST twin validates input and maps results to status codes', async () => {
  const calls: any[] = [];
  const rooms: RoomTitleApi = {
    apply: async (slug, user, action) => { calls.push({ slug, user: user.id, type: action.type }); return slug === 'gone' ? { roomFound: false, ok: false, state: EMPTY_TITLE_STATE } : user.id === 'guest' ? { roomFound: true, ok: false, code: 'FORBIDDEN', message: 'Only the host can confirm a title', state: EMPTY_TITLE_STATE } : { roomFound: true, ok: true, state: EMPTY_TITLE_STATE }; },
    state: (_s, uid) => (uid === 'member' ? EMPTY_TITLE_STATE : null)
  };
  const { app, tok } = await build({ rooms });
  const snap = { titleKey: 'tmdb:movie:1', title: 'M', posterPath: null, year: 2020, mediaType: 'movie' };
  assert.equal((await app.inject({ url: '/api/catalog/rooms/abc/titles', headers: tok('member') })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/catalog/rooms/abc/titles', headers: tok('outsider') })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/abc/titles/propose', headers: tok('member'), payload: { titleKey: 'tmdb:movie:1', snapshot: snap } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/abc/titles/confirm', headers: tok('guest'), payload: { titleKey: 'tmdb:movie:1' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/gone/titles/vote', headers: tok('member'), payload: { titleKey: 'tmdb:movie:1' } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/abc/titles/vote', headers: tok('member'), payload: { titleKey: 'tmdb:movie:1', x: 1 } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/abc/titles/explode', headers: tok('member'), payload: {} })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/a%20b/titles/vote', headers: tok('member'), payload: { titleKey: 'tmdb:movie:1' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/catalog/rooms/abc/titles/propose', headers: {}, payload: {} })).statusCode, 401);
  assert.equal(calls.length, 3, 'invalid requests never reach the room');
  await close(app);
});
