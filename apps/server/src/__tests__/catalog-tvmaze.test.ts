import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { isTvmazeImagePath, parseTitleKey, tmdbImageUrl, tvmazeImagePathFromUrl, tvmazeBackdropPathFromUrl, isCatalogImagePath } from '@synccinema/common';
import { CatalogService, MOVIES_NEED_TMDB } from '../services/catalog/service.js';
import { MemoryWatchlistStore } from '../services/catalog/watchlist.js';
import { registerCatalogRoutes } from '../routes/catalog.js';
import { UpstreamClient } from '../services/catalog/upstream.js';
import { TvmazeAdapter, TvmazeLimiter, buildSeasonList, htmlToText, normalizeTvmazeShow, showsFromSchedule, showsFromSearch, cleanUserAgent, DEFAULT_TVMAZE_USER_AGENT, tvmazePageUrl } from '../services/catalog/adapters/tvmaze.js';
import { fakeFetch, tmdbTvDetails } from './catalogFixtures.js';
import { tvmazeFixture } from './tvmazeFixtures.js';

const show169 = tvmazeFixture('tvmaze-show-embedded');
const episodes169 = tvmazeFixture('tvmaze-episodes');
const search = tvmazeFixture('tvmaze-search');
const schedIn = tvmazeFixture('tvmaze-schedule-in');
const webIn = tvmazeFixture('tvmaze-schedule-web-in');
const lookup = tvmazeFixture('tvmaze-lookup-imdb');
const notFound = tvmazeFixture('tvmaze-404');
const noSleep = async () => {};
const bigLimiter = { max: 10_000 };

// ---- sanitising and validation -----------------------------------------------------------------------------------

test('htmlToText: plain text only, entities decoded, markup and scripts removed', () => {
  assert.equal(htmlToText('<p><b>Hello</b> &amp; <i>welcome</i><br/>to &quot;it&quot;</p>'), 'Hello & welcome to "it"');
  assert.equal(htmlToText('<p>a</p><script>alert(1)</script><style>x{}</style><p>b</p>'), 'a b');
  assert.equal(htmlToText('&lt;script&gt;alert(1)&lt;/script&gt;'), 'script alert(1) /script'); // decoded angle brackets are dropped
  assert.ok(!/[<>]/.test(htmlToText('<img src=x onerror=alert(1)>&#60;b&#62;')));
  assert.equal(htmlToText('x&#0;y&#65;z'), 'x y Az'.replace(' A', 'A')); // NUL becomes a space, numeric entities decode
  assert.equal(htmlToText(null), '');
  assert.equal(htmlToText('<p>' + 'a'.repeat(500) + '</p>', 50).length, 50);
});

test('image URLs: only https static.tvmaze.com /uploads/images/<size>/<dir>/<id>.<ext> become tokens, the host is fixed on the way out', () => {
  const good = 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg';
  const token = tvmazeImagePathFromUrl(good)!;
  assert.match(token, /^\/tvm-p-501-1253519\.jpg$/);
  assert.equal(isTvmazeImagePath(token), true);
  assert.equal(tmdbImageUrl(token, 'w342'), 'https://static.tvmaze.com/uploads/images/medium_portrait/501/1253519.jpg');
  assert.equal(tmdbImageUrl(token, 'w1280'), good);
  assert.equal(tvmazeBackdropPathFromUrl(good), '/tvm-b-501-1253519.jpg');
  assert.equal(tmdbImageUrl('/tvm-b-501-1253519.jpg', 'w342'), good); // landscape art is only served in the original size
  for (const bad of [
    'http://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg',
    'https://evil.example/uploads/images/original_untouched/1/2.jpg',
    'https://static.tvmaze.com.evil.example/uploads/images/original_untouched/1/2.jpg',
    'https://static.tvmaze.com/uploads/images/original_untouched/../../x.jpg',
    'https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg?x=1',
    'https://user:pw@static.tvmaze.com/uploads/images/original_untouched/1/2.jpg',
    'https://static.tvmaze.com:8443/uploads/images/original_untouched/1/2.jpg',
    'https://static.tvmaze.com/uploads/images/original_untouched/1/2.svg',
    'javascript:alert(1)',
    42,
    null
  ]) assert.equal(tvmazeImagePathFromUrl(bad as any), null, String(bad));
  // a forged token never produces a URL, and a TMDB-looking path that starts with /tvm- is not an image
  assert.equal(tmdbImageUrl('/tvm-x-1-2.jpg', 'w342'), null);
  assert.equal(isCatalogImagePath('/tvm-x-1-2.jpg'), false);
  assert.equal(isCatalogImagePath('/abc123.jpg'), true);
  assert.equal(tvmazePageUrl('https://www.tvmaze.com/shows/1/x'), 'https://www.tvmaze.com/shows/1/x');
  assert.equal(tvmazePageUrl('https://evil.example/shows/1'), null);
  assert.equal(tvmazePageUrl('http://www.tvmaze.com/shows/1'), null);
});

test('title keys: tvmaze accepted for tv only, unknown sources rejected', () => {
  assert.deepEqual(parseTitleKey('tvmaze:tv:169'), { source: 'tvmaze', mediaType: 'tv', sourceId: '169' });
  assert.deepEqual(parseTitleKey('tmdb:movie:603'), { source: 'tmdb', mediaType: 'movie', sourceId: '603' });
  for (const k of ['tvmaze:movie:1', 'imdb:tv:1', 'TVMAZE:tv:1', 'tvmaze:tv:abc', 'tvmaze:tv:12345678901', 'tvmaze:tv:1 ', 'tvmaze:tv:', '', null, 5]) assert.equal(parseTitleKey(k as any), null, String(k));
});

test('user agent: descriptive default, control characters and short values rejected', () => {
  assert.equal(cleanUserAgent(undefined), DEFAULT_TVMAZE_USER_AGENT);
  assert.equal(cleanUserAgent('x'), DEFAULT_TVMAZE_USER_AGENT);
  assert.equal(cleanUserAgent('MyApp/1.0 (+https://x.example)\r\nX-Evil: 1'), 'MyApp/1.0 (+https://x.example)X-Evil: 1');
  assert.match(DEFAULT_TVMAZE_USER_AGENT, /watch\.stitchbyte\.in/);
});

// ---- normalisation from REAL fixtures -------------------------------------------------------------------------------

test('normalise a real show with embeds (Breaking Bad)', () => {
  const t = normalizeTvmazeShow(show169, 'IN')!;
  assert.equal(t.id, 'tvmaze:tv:169');
  assert.equal(t.source, 'tvmaze');
  assert.equal(t.mediaType, 'tv');
  assert.equal(t.title, 'Breaking Bad');
  assert.equal(t.ratingSource, 'TVmaze');
  assert.equal(t.rating, 9.2);
  assert.deepEqual(t.ratings, [{ source: 'TVmaze', value: 9.2 }]);
  assert.deepEqual(t.sources, ['tvmaze']);
  assert.equal(t.releaseDate, '2008-01-20');
  assert.equal(t.runtimeMinutes, 60);
  assert.equal(t.popularity, 100);
  assert.equal(t.tvStatus, 'Ended');
  assert.deepEqual(t.externalIds, { imdb: 'tt0903747', tvdb: '81189', tvmaze: '169' });
  assert.equal(t.externalUrl, 'https://www.tvmaze.com/shows/169/breaking-bad');
  assert.ok(!/[<>]/.test(t.overview) && t.overview.startsWith('Breaking Bad follows protagonist Walter White'));
  assert.equal(t.posterPath, '/tvm-p-501-1253519.jpg');
  assert.match(t.backdropPath!, /^\/tvm-b-\d+-\d+\.jpg$/);
  assert.deepEqual(t.genres.map((g) => g.name), ['Drama', 'Crime', 'Thriller']);
  assert.ok(t.genres.every((g) => Number.isInteger(g.id)) && new Set(t.genres.map((g) => g.id)).size === 3);
  assert.equal(t.cast!.length, 3);
  assert.equal(t.cast![0].name, 'Bryan Cranston');
  assert.match(t.cast![0].profilePath!, /^\/tvm-p-/);
  assert.equal(t.seasons, 2); // the embedded (trimmed) seasons
  assert.equal(t.nextEpisode, undefined); // the show ended: nothing announced
  assert.deepEqual(t.providers, []);
});

test('normalise: bad ids / names are dropped, hostile image and url fields become null, never guessed', () => {
  assert.equal(normalizeTvmazeShow({ id: 'x', name: 'A' }, 'IN'), null);
  assert.equal(normalizeTvmazeShow({ id: 5, name: '  ' }, 'IN'), null);
  assert.equal(normalizeTvmazeShow(null, 'IN'), null);
  const t = normalizeTvmazeShow({ id: 5, name: 'X', summary: '<p>ok<script>bad()</script></p>', url: 'https://evil.example/x', image: { original: 'https://evil.example/a.jpg' }, rating: { average: 99 }, premiered: 'soon', externals: { imdb: 'nope', thetvdb: -3 } }, 'IN')!;
  assert.equal(t.overview, 'ok');
  assert.equal(t.externalUrl, null);
  assert.equal(t.posterPath, null);
  assert.equal(t.rating, null);
  assert.equal(t.ratings, undefined);
  assert.equal(t.releaseDate, null);
  assert.deepEqual(t.externalIds, { imdb: null, tvdb: null, tvmaze: '5' });
});

test('real search fixture: results keep TVmaze order and carry TVmaze ratings', () => {
  const list = showsFromSearch(search, 'IN');
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'Breaking Bad');
  assert.ok(list.every((t) => t.source === 'tvmaze' && t.id.startsWith('tvmaze:tv:')));
});

test('real episodes fixture: grouped by season, specials without number dropped, summaries plain', () => {
  const seasons = buildSeasonList(episodes169, show169._embedded.seasons);
  assert.equal(seasons.length, 1);
  assert.equal(seasons[0].number, 1);
  assert.equal(seasons[0].episodeCount, 3);
  assert.equal(seasons[0].episodes[0].name, 'Pilot');
  assert.equal(seasons[0].episodes[0].runtimeMinutes, 60);
  assert.equal(seasons[0].episodes[0].airdate, '2008-01-20');
  assert.ok(seasons[0].episodes.every((e) => !/[<>]/.test(e.summary ?? '')));
  assert.equal(seasons[0].premiereDate, '2008-01-20');
});

test('real schedule fixtures: shows come from `show` (TV) and `_embedded.show` (web), de-duplicated', () => {
  const tv = showsFromSchedule(schedIn, 'IN');
  assert.equal(tv.length, 1);
  assert.equal(tv[0].title, 'Bigg Boss');
  assert.equal(tv[0].popularity, 79);
  assert.deepEqual(showsFromSchedule(webIn, 'IN'), []);
  const web = showsFromSchedule([{ _embedded: { show: schedIn[0].show } }, { _embedded: { show: schedIn[0].show } }, { nothing: true }], 'IN');
  assert.equal(web.length, 1);
});

// ---- adapter: calls, ids, 404, 429 --------------------------------------------------------------------------------------

function adapterWith(fetchFn: any, sleep: (ms: number) => Promise<void> = noSleep) {
  const http = new UpstreamClient({ name: 'tvmaze', fetchFn, sleep, backoffBaseMs: 1 });
  return { adapter: new TvmazeAdapter({ enabled: true }, http), http };
}

test('adapter sends the documented endpoints, embeds and a descriptive User-Agent', async () => {
  const seen: Array<{ url: string; ua?: string }> = [];
  const fn = async (url: string, init?: any) => {
    seen.push({ url, ua: init?.headers?.['User-Agent'] });
    const body = url.includes('/episodes') ? episodes169 : url.includes('/search/') ? search : url.includes('/lookup/') ? lookup : url.includes('/schedule') ? schedIn : show169;
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  };
  const { adapter } = adapterWith(fn);
  await adapter.show('169', 'IN');
  await adapter.seasons('169');
  await adapter.search('breaking bad & co', 'IN');
  await adapter.schedule('IN', '2026-10-17', 'IN');
  await adapter.webSchedule('IN', '2026-10-17', 'IN');
  await adapter.webSchedule(null, '2026-10-17', 'IN');
  assert.equal(await adapter.lookup({ imdb: 'tt0903747' }), '169');
  assert.equal(seen[0].url, 'https://api.tvmaze.com/shows/169?embed[]=cast&embed[]=seasons&embed[]=nextepisode&embed[]=previousepisode&embed[]=images');
  assert.equal(seen[1].url, 'https://api.tvmaze.com/shows/169/episodes');
  assert.equal(seen[2].url, 'https://api.tvmaze.com/search/shows?q=breaking%20bad%20%26%20co');
  assert.equal(seen[3].url, 'https://api.tvmaze.com/schedule?country=IN&date=2026-10-17');
  assert.equal(seen[4].url, 'https://api.tvmaze.com/schedule/web?date=2026-10-17&country=IN');
  assert.equal(seen[5].url, 'https://api.tvmaze.com/schedule/web?date=2026-10-17');
  assert.equal(seen[6].url, 'https://api.tvmaze.com/lookup/shows?imdb=tt0903747');
  assert.ok(seen.every((s) => s.ua === DEFAULT_TVMAZE_USER_AGENT));
  await assert.rejects(adapter.schedule('in', '2026-10-17', 'IN')); // country must be an upper-case ISO code
  await assert.rejects(adapter.schedule('IN', '17-10-2026', 'IN'));
});

test('lookup: imdb first, thetvdb second, malformed ids never reach the network, 404 is null', async () => {
  const urls: string[] = [];
  const fn = async (url: string) => {
    urls.push(url);
    if (url.includes('thetvdb=81189')) return { ok: true, status: 200, headers: { get: () => null }, json: async () => lookup };
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => notFound };
  };
  const { adapter } = adapterWith(fn);
  assert.equal(await adapter.lookup({ imdb: 'tt1234567', tvdb: 81189 }), '169');
  assert.deepEqual(urls.map((u) => u.split('?')[1]), ['imdb=tt1234567', 'thetvdb=81189']);
  urls.length = 0;
  assert.equal(await adapter.lookup({ imdb: 'tt1; DROP', tvdb: '12x' }), null);
  assert.equal(urls.length, 0);
  assert.equal(await adapter.show('99999999', 'IN'), null); // 404 -> null
  assert.equal(await adapter.show('../etc', 'IN'), null);
});

test('429 with Retry-After: waits at least that long, retries, then succeeds', async () => {
  const sleeps: number[] = [];
  let n = 0;
  const fn = async () => {
    n++;
    if (n === 1) return { ok: false, status: 429, headers: { get: (h: string) => (h.toLowerCase() === 'retry-after' ? '2' : null) }, json: async () => ({}) };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => show169 };
  };
  const { adapter } = adapterWith(fn, async (ms) => { sleeps.push(ms); });
  const t = await adapter.show('169', 'IN');
  assert.equal(t!.title, 'Breaking Bad');
  assert.equal(n, 2);
  assert.deepEqual(sleeps, [2000]);
});

test('persistent 429s end as an upstream error and open the circuit breaker (no hammering)', async () => {
  let n = 0;
  const fn = async () => { n++; return { ok: false, status: 429, headers: { get: () => '1' }, json: async () => ({}) }; };
  const http = new UpstreamClient({ name: 'tvmaze', fetchFn: fn as any, sleep: noSleep, breakerThreshold: 2 });
  const a = new TvmazeAdapter({ enabled: true }, http);
  await assert.rejects(a.show('1', 'IN'));
  await assert.rejects(a.show('2', 'IN'));
  const before = n;
  await assert.rejects(a.show('3', 'IN'), /circuit_open/);
  assert.equal(n, before);
});

// ---- token bucket ------------------------------------------------------------------------------------------------------

test('limiter: at most `max` calls per window, the rest wait in order (injected clock)', async () => {
  let t = 0;
  const lim = new TvmazeLimiter({ max: 3, windowMs: 10_000, now: () => t, sleep: async (ms) => { t += ms; } });
  const at: number[] = [];
  await Promise.all(Array.from({ length: 7 }, async () => { await lim.acquire(); at.push(t); }));
  assert.deepEqual(at, [0, 0, 0, 10_000, 10_000, 10_000, 20_000]);
  // never more than 3 inside any 10 s window
  for (const s of at) assert.ok(at.filter((x) => x >= s && x < s + 10_000).length <= 3);
});

test('limiter defaults are below TVmaze limit (15 per 10 s) and a full queue is refused', async () => {
  let t = 0;
  const lim = new TvmazeLimiter({ now: () => t, sleep: async (ms) => { t += ms; } });
  const stamps: number[] = [];
  await Promise.all(Array.from({ length: 31 }, async () => { await lim.acquire(); stamps.push(t); }));
  assert.equal(stamps.filter((x) => x === 0).length, 15);
  assert.equal(stamps.filter((x) => x === 10_000).length, 15);
  const small = new TvmazeLimiter({ max: 1, maxQueue: 2, now: () => t, sleep: async (ms) => { t += ms; } });
  const results = await Promise.allSettled([small.acquire(), small.acquire(), small.acquire(), small.acquire()]);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 2);
});

test('limiter: a caller that would wait too long is refused, later callers still work', async () => {
  let t = 0;
  const lim = new TvmazeLimiter({ max: 1, windowMs: 10_000, maxWaitMs: 5_000, now: () => t, sleep: async (ms) => { t += ms; } });
  await lim.acquire();
  await assert.rejects(lim.acquire());
  t += 10_000;
  await lim.acquire();
});

// ---- service: modes, caching, negative caching ----------------------------------------------------------------------------

const tvmazeRoutes = (): Array<[string, unknown, number?]> => [
  ['/lookup/shows?imdb=tt0903747', lookup],
  ['/lookup/shows?imdb=tt0000000', notFound, 404],
  ['/shows/169/episodes', episodes169],
  ['/shows/169?', show169],
  ['/shows/99999999', notFound, 404],
  ['/search/shows', search],
  ['/schedule/web', webIn],
  ['/schedule?country=IN', schedIn],
  ['/schedule?country=US', schedIn]
];
const svc = (env: Record<string, string>, f: ReturnType<typeof fakeFetch>, extra: any = {}) => new CatalogService(env, { fetchFn: f.fn, sleep: noSleep, backoffBaseMs: 1, tvmazeLimiter: bigLimiter, ...extra });

test('mode selection: TMDB key -> tmdb, none -> tvmaze, TVMAZE_ENABLED=0 and no key -> none', () => {
  const f = fakeFetch();
  assert.equal(svc({ TMDB_API_KEY: 'k' }, f).mode, 'tmdb');
  assert.equal(svc({ TMDB_READ_TOKEN: 'k' }, f).mode, 'tmdb');
  assert.equal(svc({}, f).mode, 'tvmaze');
  assert.equal(svc({ TVMAZE_ENABLED: '1' }, f).mode, 'tvmaze');
  for (const off of ['0', 'false', 'off', 'NO']) assert.equal(svc({ TVMAZE_ENABLED: off }, f).mode, 'none');
  assert.equal(svc({ TVMAZE_ENABLED: '0', TMDB_API_KEY: 'k' }, f).mode, 'tmdb');
  const s = svc({}, f).status();
  assert.equal(s.configured, true);
  assert.equal(s.mode, 'tvmaze');
  assert.equal(s.movies, false);
  assert.equal(f.calls.length, 0);
});

test('lookup mapping is cached 7 days, a 404 is negative-cached 24 h (no repeat call), both expire on schedule', async () => {
  let now = 1_000_000;
  const f = fakeFetch(tvmazeRoutes());
  const s = svc({ TMDB_API_KEY: 'k' }, f, { now: () => now });
  const base = { ...(await import('../services/catalog/adapters/tmdb.js')).normalizeTmdbTitle({ ...tmdbTvDetails, external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189 } }, 'tv', 'IN')! };
  await s.enrichWithTvmaze(base);
  await s.enrichWithTvmaze(base);
  assert.equal(f.calls.filter((u) => u.includes('/lookup/')).length, 1);
  now += 6 * 24 * 3600_000;
  await s.enrichWithTvmaze(base);
  assert.equal(f.calls.filter((u) => u.includes('/lookup/')).length, 1);
  now += 2 * 24 * 3600_000;
  await s.enrichWithTvmaze(base);
  assert.equal(f.calls.filter((u) => u.includes('/lookup/')).length, 2);
  // unknown id: one call, then remembered for 24 h
  const unknown = { ...base, externalIds: { imdb: 'tt0000000', tvdb: null } };
  const before = f.calls.length;
  assert.equal((await s.enrichWithTvmaze(unknown)).seasonList, undefined);
  await s.enrichWithTvmaze(unknown);
  assert.equal(f.calls.length - before, 1);
  now += 23 * 3600_000;
  await s.enrichWithTvmaze(unknown);
  assert.equal(f.calls.length - before, 1);
  now += 2 * 3600_000;
  await s.enrichWithTvmaze(unknown);
  assert.equal(f.calls.length - before, 2);
});

test('TTLs: show 6 h, episodes 3 h, schedule 30 min, search 5 min', async () => {
  let now = 5_000_000;
  const f = fakeFetch(tvmazeRoutes());
  const s = svc({}, f, { now: () => now });
  const count = (m: string) => f.calls.filter((u) => u.includes(m)).length;
  await s.titlePage('tvmaze', 'tv', '169', 'IN');
  await s.titlePage('tvmaze', 'tv', '169', 'IN');
  assert.equal(count('/shows/169?'), 1);
  assert.equal(count('/episodes'), 1);
  now += 3 * 3600_000 + 1000;
  await s.titlePage('tvmaze', 'tv', '169', 'IN');
  assert.equal(count('/shows/169?'), 1);
  assert.equal(count('/episodes'), 2);
  now += 3 * 3600_000;
  await s.titlePage('tvmaze', 'tv', '169', 'IN');
  assert.equal(count('/shows/169?'), 2);
  const q = { q: 'bad', type: 'all' as const, sort: 'popularity' as const, region: 'IN', page: 1 };
  await s.search(q);
  await s.search(q);
  assert.equal(count('/search/shows'), 1);
  now += 5 * 60_000 + 1000;
  await s.search(q);
  assert.equal(count('/search/shows'), 2);
  await s.collection('airing-in-india', { region: 'IN', providers: [] });
  const sched = count('/schedule');
  await s.collection('airing-in-india', { region: 'IN', providers: [] });
  assert.equal(count('/schedule'), sched);
});

test('TVmaze mode: movies need TMDB (503 error type), TV works, 404 for unknown shows, bad ids never reach the network', async () => {
  const f = fakeFetch(tvmazeRoutes());
  const s = svc({}, f);
  await assert.rejects(s.collection('trending', { region: 'IN', providers: [] }), /Movies need a TMDB key/);
  await assert.rejects(s.collection('bollywood-hits', { region: 'IN', providers: [] }), /Movies need a TMDB key/);
  await assert.rejects(s.matchmaker({ mood: 'funny', time: 'under90', genres: [], providers: [], mode: 'solo', seed: 's' }), /Movies need a TMDB key/);
  await assert.rejects(s.details('movie', '603', 'IN'), /Movies need a TMDB key/);
  assert.equal(f.calls.length, 0);
  assert.equal(await s.titlePage('tvmaze', 'tv', '99999999', 'IN'), null);
  assert.equal(await s.titlePage('tvmaze', 'movie' as any, '169', 'IN'), null);
  const page = (await s.titlePage('tvmaze', 'tv', '169', 'IN'))!;
  assert.equal(page.title.seasonList!.length, 1);
  assert.equal(page.title.episodes, 3);
  assert.equal(page.offers, null); // no availability provider configured
  const tv = await s.search({ q: 'breaking', type: 'tv', sort: 'popularity', region: 'IN', page: 1 });
  assert.equal(tv.results[0].id, 'tvmaze:tv:169');
  const mov = await s.search({ q: 'breaking', type: 'movie', sort: 'popularity', region: 'IN', page: 1 });
  assert.deepEqual(mov.results, []);
  assert.equal(MOVIES_NEED_TMDB.error, 'Movies need a TMDB key; TV works without one');
});

test('airing-in-india: today (IST) and two more days, de-duplicated, sorted by rating then weight; popular-tv by weight', async () => {
  const now = Date.parse('2026-10-17T20:00:00Z'); // 01:30 on the 18th in India
  const f = fakeFetch(tvmazeRoutes());
  const s = svc({}, f, { now: () => now });
  const r = (await s.collection('airing-in-india', { region: 'IN', providers: [] }))!;
  assert.deepEqual(f.calls.filter((u) => u.includes('country=IN')).map((u) => /date=([\d-]+)/.exec(u)![1]).sort(), ['2026-10-18', '2026-10-18', '2026-10-19', '2026-10-19', '2026-10-20', '2026-10-20']);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].title, 'Bigg Boss');
  assert.equal(r.available, true);
  const p = (await s.collection('popular-tv', { region: 'IN', providers: [] }))!;
  assert.ok(f.calls.some((u) => u.includes('schedule?country=US&date=2026-10-17')));
  assert.ok(f.calls.some((u) => /schedule\/web\?date=2026-10-17$/.test(u)));
  assert.equal(p.items[0].title, 'Bigg Boss');
  assert.match(p.howWePick, /popularity score/);
});

test('airing-in-india: a day that fails only drops that day; all days failing is an upstream error', async () => {
  const f = fakeFetch(tvmazeRoutes());
  f.set('date=2026-10-18', {}, 500);
  const s = svc({}, f, { now: () => Date.parse('2026-10-17T20:00:00Z') });
  assert.equal((await s.collection('airing-in-india', { region: 'IN', providers: [] }))!.items.length, 1);
  const f2 = fakeFetch([['/schedule', {}, 500]]);
  await assert.rejects(svc({}, f2).collection('airing-in-india', { region: 'IN', providers: [] }), /tvmaze/);
});

test('TMDB mode: TVmaze collections do not exist (no duplicate standalone TVmaze results) and search never calls TVmaze', async () => {
  const f = fakeFetch([['/search/', { page: 1, results: [], total_pages: 1, total_results: 0 }]]);
  const s = svc({ TMDB_API_KEY: 'k' }, f);
  assert.equal(await s.collection('airing-in-india', { region: 'IN', providers: [] }), null);
  assert.equal(await s.collection('popular-tv', { region: 'IN', providers: [] }), null);
  await s.search({ q: 'x', type: 'all', sort: 'popularity', region: 'IN', page: 1 });
  assert.equal(f.calls.filter((u) => u.includes('tvmaze')).length, 0);
});

// ---- enrichment of TMDB TV titles -------------------------------------------------------------------------------------------

const tmdbTvWithIds = { ...tmdbTvDetails, external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189 } };
const withNext = (() => {
  const s = JSON.parse(JSON.stringify(show169));
  s._embedded.nextepisode = { ...episodes169[1], name: 'Next One', airdate: '2026-11-01' };
  return s;
})();

test('enrichment: TMDB TV page gets seasons/episodes, next episode and a second rating; TMDB stays primary', async () => {
  const f = fakeFetch([['/tv/1396', tmdbTvWithIds], ['/lookup/shows?imdb=tt0903747', lookup], ['/shows/169/episodes', episodes169], ['/shows/169?', withNext]]);
  const s = svc({ TMDB_API_KEY: 'k' }, f);
  const page = (await s.titlePage('tmdb', 'tv', '1396', 'IN'))!;
  const t = page.title;
  assert.equal(t.id, 'tmdb:tv:1396');
  assert.equal(t.title, 'Short Series Fixture'); // TMDB title kept
  assert.equal(t.ratingSource, 'TMDB');
  assert.equal(t.rating, 8.4);
  assert.deepEqual(t.ratings, [{ source: 'TMDB', value: 8.4, votes: 900 }, { source: 'TVmaze', value: 9.2 }]);
  assert.deepEqual(t.sources, ['tmdb', 'tvmaze']);
  assert.equal(t.seasonList![0].episodes[0].name, 'Pilot');
  assert.equal(t.nextEpisode!.name, 'Next One');
  assert.equal(t.nextEpisode!.airdate, '2026-11-01');
  assert.equal(t.externalIds!.tvmaze, '169');
  assert.equal(t.posterPath, '/tvposter.jpg'); // artwork stays TMDB's
  assert.ok(f.calls.some((u) => u.includes('append_to_response=credits%2Cexternal_ids')));
});

test('enrichment: a TVmaze failure never breaks the TMDB response (5xx, 404 lookup, no external ids, disabled)', async () => {
  for (const routes of [
    [['/tv/1396', tmdbTvWithIds], ['/lookup/', {}, 500]],
    [['/tv/1396', tmdbTvWithIds], ['/lookup/', notFound, 404]],
    [['/tv/1396', tmdbTvWithIds], ['/lookup/shows?imdb=tt0903747', lookup], ['/shows/169', {}, 500]],
    [['/tv/1396', tmdbTvDetails]]
  ] as any[]) {
    const s = svc({ TMDB_API_KEY: 'k' }, fakeFetch(routes));
    const page = (await s.titlePage('tmdb', 'tv', '1396', 'IN'))!;
    assert.equal(page.title.title, 'Short Series Fixture');
    assert.equal(page.title.seasonList, undefined);
    assert.equal(page.title.ratings, undefined);
  }
  const f = fakeFetch([['/tv/1396', tmdbTvWithIds]]);
  const off = svc({ TMDB_API_KEY: 'k', TVMAZE_ENABLED: '0' }, f);
  assert.equal((await off.titlePage('tmdb', 'tv', '1396', 'IN'))!.title.seasonList, undefined);
  assert.equal(f.calls.filter((u) => u.includes('tvmaze')).length, 0);
});

test('enrichment: episodes failing keeps the rating and next episode (seasons are optional)', async () => {
  const f = fakeFetch([['/tv/1396', tmdbTvWithIds], ['/lookup/shows?imdb=tt0903747', lookup], ['/shows/169/episodes', {}, 500], ['/shows/169?', withNext]]);
  const t = (await svc({ TMDB_API_KEY: 'k' }, f).titlePage('tmdb', 'tv', '1396', 'IN'))!.title;
  assert.equal(t.seasonList, undefined);
  assert.equal(t.ratings!.length, 2);
  assert.equal(t.nextEpisode!.name, 'Next One');
});

test('enrichment does not run for movies or on list-building detail checks', async () => {
  const f = fakeFetch([['/tv/1396', tmdbTvWithIds], ['/movie/603', { id: 603, title: 'M', vote_count: 1, vote_average: 5 }]]);
  const s = svc({ TMDB_API_KEY: 'k' }, f);
  await s.titlePage('tmdb', 'movie', '603', 'IN');
  await s.details('tv', '1396', 'IN'); // list paths use details(): no TVmaze traffic
  assert.equal(f.calls.filter((u) => u.includes('tvmaze')).length, 0);
});

// ---- routes: strict sources, degraded mode, watchlist ---------------------------------------------------------------------------

async function build(env: Record<string, string>, routes = tvmazeRoutes(), extra: any = {}) {
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const f = fakeFetch(routes);
  const catalog = svc(env, f, extra);
  const watchlist = new MemoryWatchlistStore();
  await registerCatalogRoutes(app, { catalog, watchlist });
  const tok = (id: string, o: any = {}) => ({ authorization: `Bearer ${app.jwt.sign({ id, displayName: id, isAnonymous: false, ...o })}` });
  return { app, catalog, watchlist, tok, f };
}
const close = async (a: FastifyInstance) => { await a.close(); };

test('degraded mode routes: status, search, collections, title, 503 for movie-only routes, auth required', async () => {
  const { app, tok } = await build({});
  const h = tok('u1');
  const status = (await app.inject({ url: '/api/catalog/status', headers: h })).json();
  assert.equal(status.configured, true);
  assert.equal(status.mode, 'tvmaze');
  assert.equal(status.movies, false);
  assert.equal(typeof status.availability, 'boolean');
  const search = await app.inject({ url: '/api/catalog/search?q=breaking', headers: h });
  assert.equal(search.statusCode, 200);
  assert.equal(search.json().results[0].source, 'tvmaze');
  assert.equal((await app.inject({ url: '/api/catalog/search', headers: h })).statusCode, 200); // no text: popular TV
  for (const slug of ['airing-in-india', 'popular-tv']) {
    const r = await app.inject({ url: `/api/catalog/collections/${slug}`, headers: h });
    assert.equal(r.statusCode, 200, slug);
    assert.equal(r.json().items[0].source, 'tvmaze');
  }
  for (const slug of ['trending', 'trending-india', 'bollywood-hits', 'free-movies', 'south-indian-cinema', 'because-you-watched']) {
    const r = await app.inject({ url: `/api/catalog/collections/${slug}`, headers: h });
    assert.equal(r.statusCode, 503, slug);
    assert.deepEqual(r.json(), MOVIES_NEED_TMDB);
  }
  const mm = await app.inject({ method: 'POST', url: '/api/catalog/matchmaker', headers: h, payload: { mood: 'funny', time: 'under90', genres: [], providers: [], mode: 'solo', seed: 's' } });
  assert.equal(mm.statusCode, 503);
  assert.deepEqual(mm.json(), MOVIES_NEED_TMDB);
  const t = await app.inject({ url: '/api/catalog/titles/tvmaze/tv/169', headers: h });
  assert.equal(t.statusCode, 200);
  const body = t.json();
  assert.equal(body.title.id, 'tvmaze:tv:169');
  assert.equal(body.title.ratingSource, 'TVmaze');
  assert.equal(body.title.seasonList[0].episodes.length, 3);
  assert.equal(body.title.cast.length, 3);
  assert.equal(body.availabilityEnabled, false);
  assert.equal((await app.inject({ url: '/api/catalog/titles/tvmaze/tv/169/recommendations', headers: h })).json().results.length, 0);
  assert.equal((await app.inject({ url: '/api/catalog/titles/tvmaze/tv/99999999', headers: h })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/catalog/titles/tmdb/movie/603', headers: h })).statusCode, 503);
  assert.deepEqual((await app.inject({ url: '/api/catalog/genres', headers: h })).json().genres.slice(0, 1).map((g: any) => g.name), ['Action']);
  for (const url of ['/api/catalog/status', '/api/catalog/search?q=a', '/api/catalog/collections/popular-tv', '/api/catalog/titles/tvmaze/tv/169']) {
    for (const headers of [{}, { authorization: 'Bearer nope' }, tok('g', { isAnonymous: true })]) {
      assert.equal((await app.inject({ url, headers: headers as any })).statusCode, 401, url);
    }
  }
  await close(app);
});

test('TMDB mode: tvmaze collections answer 404, tvmaze title pages still work', async () => {
  const { app, tok } = await build({ TMDB_API_KEY: 'k' });
  assert.equal((await app.inject({ url: '/api/catalog/collections/airing-in-india', headers: tok('u1') })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/catalog/titles/tvmaze/tv/169', headers: tok('u1') })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/catalog/status', headers: tok('u1') })).json().mode, 'tmdb');
  await close(app);
});

test('TVMAZE_ENABLED=0 without TMDB: legacy 503 CATALOG_NOT_CONFIGURED, tvmaze titles too, status not configured', async () => {
  const { app, tok, f } = await build({ TVMAZE_ENABLED: '0' });
  for (const url of ['/api/catalog/search?q=x', '/api/catalog/titles/tvmaze/tv/169', '/api/catalog/collections/popular-tv', '/api/catalog/trending']) {
    const r = await app.inject({ url, headers: tok('u1') });
    assert.equal(r.statusCode, 503, url);
    assert.equal(r.json().code, 'CATALOG_NOT_CONFIGURED');
  }
  const st = (await app.inject({ url: '/api/catalog/status', headers: tok('u1') })).json();
  assert.equal(st.configured, false);
  assert.equal(st.mode, 'none');
  assert.equal(f.calls.length, 0);
  await close(app);
});

test('strict source validation on every title route: tvmaze and tmdb accepted, everything else 400', async () => {
  const { app, tok } = await build({ TMDB_API_KEY: 'k' });
  const h = tok('u1');
  for (const suffix of ['', '/providers', '/recommendations']) {
    for (const bad of ['imdb/tv/1', 'TMDB/tv/1', 'tvmaze/movie/1', 'tvmaze/tv/abc', 'tvmaze/tv/12345678901', 'tvmaze/tv/1e3', 'tmdb/anime/1', 'trakt/tv/1', '__proto__/tv/1', 'tvmaze%00/tv/1', 'tvmaze/tv/-1']) {
      const r = await app.inject({ url: `/api/catalog/titles/${bad}${suffix}`, headers: h });
      assert.equal(r.statusCode, 400, `${bad}${suffix}`);
    }
    assert.notEqual((await app.inject({ url: `/api/catalog/titles/tvmaze/tv/169${suffix}`, headers: h })).statusCode, 400, suffix);
  }
  assert.equal((await app.inject({ url: '/api/catalog/titles/tvmaze/tv/169?x=1', headers: h })).statusCode, 400); // unknown parameter
  await close(app);
});

test('watchlist: tvmaze keys accepted, validated, private, removable; bad sources refused', async () => {
  const { app, tok, watchlist } = await build({});
  const add = (id: string, payload: any) => app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers: tok(id), payload });
  const snap = { titleKey: 'tvmaze:tv:169', title: 'Breaking Bad', posterPath: '/tvm-p-501-1253519.jpg', year: 2008, mediaType: 'tv' };
  assert.equal((await add('a', snap)).statusCode, 201);
  assert.equal((await add('a', snap)).json().duplicate, true);
  assert.equal((await add('a', { ...snap, titleKey: 'tvmaze:movie:5', mediaType: 'movie' })).statusCode, 400);
  assert.equal((await add('a', { ...snap, titleKey: 'imdb:tv:5' })).statusCode, 400);
  assert.equal((await add('a', { ...snap, titleKey: 'tvmaze:tv:6', mediaType: 'movie' })).statusCode, 400);
  assert.equal((await add('a', { ...snap, titleKey: 'tvmaze:tv:7', posterPath: '/tvm-evil.jpg' })).statusCode, 400);
  assert.equal((await add('a', { ...snap, titleKey: 'tvmaze:tv:8', posterPath: 'https://evil.example/x.jpg' })).statusCode, 400);
  const mine = (await app.inject({ url: '/api/catalog/watchlist', headers: tok('a') })).json();
  assert.deepEqual(mine.items.map((i: any) => i.titleKey), ['tvmaze:tv:169']);
  assert.equal((await app.inject({ url: '/api/catalog/watchlist', headers: tok('b') })).json().items.length, 0);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/tvmaze:tv:169', headers: tok('b') })).json().removed, false);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/tvmaze:movie:169', headers: tok('a') })).statusCode, 400);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/tvmaze:tv:169', headers: tok('a') })).json().removed, true);
  assert.equal((await watchlist.list('a')).length, 0);
  await close(app);
});

test('a slow or unreachable TVmaze never holds up a TMDB TV title page: it answers with the TMDB data after the deadline', async () => {
  const f = fakeFetch(tvmazeRoutes());
  const s = svc({ TMDB_API_KEY: 'k' }, f, { enrichDeadlineMs: 30 }) as any;
  const base = (await import('../services/catalog/adapters/tmdb.js')).normalizeTmdbTitle({ ...tmdbTvDetails, external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189 } }, 'tv', 'IN')!;
  s.details = async () => base;
  s.providersWithSource = async () => ({ offers: null, provider: null });
  s.tvmazeLookup = () => new Promise(() => undefined); // never answers
  const t0 = Date.now();
  const page = await s.titlePage('tmdb', 'tv', '1396', 'IN');
  assert.ok(Date.now() - t0 < 1500, 'the page waited for TVmaze');
  assert.equal(page.title.id, base.id);
  assert.equal(page.title.seasonList, undefined, 'enrichment must be skipped, not half-applied');
});

test('a failing TVmaze enrichment still returns the TMDB title', async () => {
  const f = fakeFetch(tvmazeRoutes());
  const s = svc({ TMDB_API_KEY: 'k' }, f) as any;
  const base = (await import('../services/catalog/adapters/tmdb.js')).normalizeTmdbTitle({ ...tmdbTvDetails, external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189 } }, 'tv', 'IN')!;
  s.details = async () => base;
  s.providersWithSource = async () => ({ offers: null, provider: null });
  s.tvmazeLookup = async () => { throw new Error('boom'); };
  const page = await s.titlePage('tmdb', 'tv', '1396', 'IN');
  assert.equal(page.title.id, base.id);
});
