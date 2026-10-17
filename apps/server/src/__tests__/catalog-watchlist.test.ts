import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { isLinkItem, isTitleItem, linkTitleKey, normalizeLinkUrl, WATCHLIST_MAX_ITEMS } from '@synccinema/common';
import { CatalogService } from '../services/catalog/service.js';
import { MemoryWatchlistStore, MongoWatchlistStore, cleanLink, rowToItem } from '../services/catalog/watchlist.js';
import { registerCatalogRoutes } from '../routes/catalog.js';
import { fakeFetch } from './catalogFixtures.js';

/** The unified watchlist: catalog titles and user links in ONE list per account. */

async function build(opts: { max?: number; limits?: any } = {}) {
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const catalog = new CatalogService({ TMDB_API_KEY: 'k'.repeat(12) }, { fetchFn: fakeFetch([]).fn });
  const watchlist = new MemoryWatchlistStore(opts.max ?? WATCHLIST_MAX_ITEMS);
  await registerCatalogRoutes(app, { catalog, watchlist, limits: opts.limits ?? { watchlistWritesPerMin: 1000 } });
  const tok = (id: string, extra: any = {}) => ({ authorization: `Bearer ${app.jwt.sign({ id, displayName: id, isAnonymous: false, ...extra })}` });
  return { app, watchlist, tok };
}
const close = async (a: FastifyInstance) => { await a.close(); };
const post = (app: FastifyInstance, headers: any, payload: any) => app.inject({ method: 'POST', url: '/api/catalog/watchlist', headers, payload });
const link = (url: string, extra: any = {}) => ({ kind: 'link', title: 'A video', url, ...extra });
const titleBody = (n: number) => ({ titleKey: `tmdb:movie:${n}`, title: `Movie ${n}`, posterPath: '/p.jpg', year: 2020, mediaType: 'movie' });

test('link item: added, listed with the title items in one list, newest first', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  assert.equal((await post(app, h, titleBody(1))).statusCode, 201);
  const r = await post(app, h, link('https://www.youtube.com/watch?v=zSWdZVtXT7E', { title: 'Interstellar' }));
  assert.equal(r.statusCode, 201);
  assert.match(r.json().titleKey, /^link:[0-9a-f]{16}$/);
  const items = (await app.inject({ url: '/api/catalog/watchlist', headers: h })).json().items;
  assert.equal(items.length, 2);
  const l = items.find((i: any) => i.kind === 'link');
  assert.equal(l.title, 'Interstellar');
  assert.equal(l.platform, 'YouTube');
  assert.equal(l.thumbnail, 'https://img.youtube.com/vi/zSWdZVtXT7E/hqdefault.jpg', 'YouTube thumbnail is derived by the server, nothing is fetched');
  assert.equal(items.find((i: any) => i.kind === 'title').titleKey, 'tmdb:movie:1');
  await close(app);
});

test('link item: validation refuses javascript:, data:, http:, huge values, control characters, credentials, IP hosts', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  const bad: any[] = [
    link('javascript:alert(1)'),
    link('JaVaScRiPt:alert(1)'),
    link('data:text/html,<script>alert(1)</script>'),
    link('http://example.com/a'),
    link('ftp://example.com/a'),
    link('https://user:pw@example.com/'),
    link('https://127.0.0.1/'),
    link('https://localhost/x'),
    link('https://intranet/x'),
    link('https://example.com/' + 'a'.repeat(3000)),
    link('https://example.com/\u0000x'),
    link('https://example.com/a b'),
    link('https://example.com/x', { title: 'line\nbreak' }),
    link('https://example.com/x', { title: 'x'.repeat(201) }),
    link('https://example.com/x', { title: '' }),
    link('https://example.com/x', { platform: 'p'.repeat(41) }),
    link('https://example.com/x', { thumbnail: 'javascript:alert(1)' }),
    link('https://example.com/x', { tagline: 'bell\u0007' }),
    link('https://example.com/x', { userId: 'bob' }),
    link('https://example.com/x', { titleKey: 'link:0000000000000000' }),
    { kind: 'link', title: 'no url' },
    { kind: 'link', url: 'https://example.com/x' }
  ];
  for (const payload of bad) {
    const r = await post(app, h, payload);
    assert.equal(r.statusCode, 400, JSON.stringify(payload).slice(0, 80));
  }
  // a thumbnail that is not an https URL is refused, not silently stored
  assert.equal((await post(app, h, link('https://example.com/ok', { thumbnail: 'https://example.com/t.jpg' }))).statusCode, 201);
  assert.deepEqual((await app.inject({ url: '/api/catalog/watchlist', headers: h })).json().items.map((i: any) => i.thumbnail), ['https://example.com/t.jpg']);
  await close(app);
});

test('link item: the same page cannot be saved twice (URL hash), whatever the spelling', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  assert.equal((await post(app, h, link('https://youtu.be/zSWdZVtXT7E'))).statusCode, 201);
  for (const same of ['https://www.youtube.com/watch?v=zSWdZVtXT7E', 'https://youtube.com/watch?v=zSWdZVtXT7E&t=42', 'https://m.youtube.com/watch?v=zSWdZVtXT7E#x', 'https://www.youtube.com/embed/zSWdZVtXT7E']) {
    const r = await post(app, h, link(same, { title: 'again' }));
    assert.equal(r.statusCode, 200, same);
    assert.equal(r.json().duplicate, true);
  }
  assert.equal((await post(app, h, link('https://Example.com:443/a#frag'))).statusCode, 201);
  assert.equal((await post(app, h, link('https://example.com/a'))).json().duplicate, true);
  assert.equal((await post(app, h, link('https://example.com/b'))).statusCode, 201, 'a different path is a different link');
  assert.equal((await app.inject({ url: '/api/catalog/watchlist', headers: h })).json().items.length, 3);
  await close(app);
});

test('link item: the key is derived from the URL, stable, and shared by the helper', () => {
  assert.equal(linkTitleKey('https://youtu.be/zSWdZVtXT7E'), linkTitleKey('https://www.youtube.com/watch?v=zSWdZVtXT7E'));
  assert.notEqual(linkTitleKey('https://example.com/a'), linkTitleKey('https://example.com/b'));
  assert.equal(linkTitleKey('http://example.com/a'), null);
  assert.equal(normalizeLinkUrl('  https://Example.com:443/a#x  '), 'https://example.com/a');
  assert.equal(cleanLink({ url: 'https://example.com/a', title: '<b>Hi</b>   there' })?.title, 'bHi/b there');
});

test('cap counts both kinds together', async () => {
  const { app, tok } = await build({ max: 3 });
  const h = tok('u1');
  assert.equal((await post(app, h, titleBody(1))).statusCode, 201);
  assert.equal((await post(app, h, link('https://example.com/1'))).statusCode, 201);
  assert.equal((await post(app, h, link('https://example.com/2'))).statusCode, 201);
  const full1 = await post(app, h, link('https://example.com/3'));
  assert.equal(full1.statusCode, 409);
  assert.equal(full1.json().code, 'WATCHLIST_FULL');
  assert.equal((await post(app, h, titleBody(9))).statusCode, 409, 'titles are refused too once links filled the list');
  assert.equal((await post(app, h, link('https://example.com/1'))).statusCode, 200, 'an existing link is a duplicate, not full');
  await close(app);
});

test('delete by titleKey works for links and titles; malformed keys are refused', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  const key = (await post(app, h, link('https://example.com/a'))).json().titleKey as string;
  await post(app, h, titleBody(5));
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/catalog/watchlist/${encodeURIComponent(key)}`, headers: h })).json().removed, true);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/catalog/watchlist?titleKey=${encodeURIComponent(key)}`, headers: h })).json().removed, false);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/tmdb:movie:5', headers: h })).json().removed, true);
  for (const bad of ['link:xyz', 'link:0123456789ABCDEF', 'link:0123456789abcdef0', 'x:y:z', 'garbage']) {
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/catalog/watchlist/${encodeURIComponent(bad)}`, headers: h })).statusCode, 400, bad);
  }
  await close(app);
});

test('privacy and ownership: another account never sees or removes my links', async () => {
  const { app, tok } = await build();
  const a = tok('alice'), b = tok('bob');
  const key = (await post(app, a, link('https://example.com/secret', { title: 'secret' }))).json().titleKey as string;
  assert.deepEqual((await app.inject({ url: '/api/catalog/watchlist', headers: b })).json().items, []);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/catalog/watchlist/${encodeURIComponent(key)}`, headers: b })).json().removed, false);
  assert.equal((await app.inject({ url: '/api/catalog/watchlist', headers: a })).json().items.length, 1);
  // bob can save the same page independently; it is a separate row
  assert.equal((await post(app, b, link('https://example.com/secret'))).statusCode, 201);
  await close(app);
});

test('guests and bad tokens cannot use link items', async () => {
  const { app, tok } = await build();
  for (const headers of [{}, { authorization: 'Bearer nope' }, tok('g1', { isAnonymous: true })]) {
    assert.equal((await post(app, headers as any, link('https://example.com/a'))).statusCode, 401);
    assert.equal((await app.inject({ method: 'DELETE', url: '/api/catalog/watchlist/link:0123456789abcdef', headers: headers as any })).statusCode, 401);
  }
  await close(app);
});

test('because-you-watched ignores link items (they have no catalog id)', async () => {
  const { app, tok } = await build();
  const h = tok('u1');
  await post(app, h, link('https://example.com/a'));
  const r = (await app.inject({ url: '/api/catalog/collections/because-you-watched', headers: h })).json();
  assert.equal(r.available, false);
  await close(app);
});

// ---- the MongoDB store against a fake collection (no database is contacted) --------------------------------------

function fakeCol(initial: any[] = [], opts: { racing?: number } = {}) {
  const rows = [...initial];
  let counts = 0;
  const col: any = {
    rows,
    find: (q: any) => ({ sort: (_s: any) => ({ limit: (n: number) => ({ toArray: async () => rows.filter((r) => r.userId === q.userId).sort((a, b) => b.addedAt - a.addedAt).slice(0, n) }) }) }),
    countDocuments: async (q: any) => {
      counts++;
      const n = rows.filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).length;
      // simulate other writers that slip rows in between our count and our re-count
      return counts === 2 && opts.racing ? n + opts.racing : n;
    },
    insertOne: async (doc: any) => {
      if (rows.some((r) => r.userId === doc.userId && r.titleKey === doc.titleKey)) throw Object.assign(new Error('dup'), { code: 11000 });
      rows.push(doc);
    },
    deleteOne: async (q: any) => {
      const i = rows.findIndex((r) => Object.entries(q).every(([k, v]) => r[k] === v));
      if (i >= 0) rows.splice(i, 1);
      return { deletedCount: i >= 0 ? 1 : 0 };
    }
  };
  return col;
}

test('mongo store: documents written before link items existed (no kind) still read as titles', async () => {
  const col = fakeCol([
    { userId: 'u1', titleKey: 'tmdb:movie:603', title: 'The Matrix', posterPath: '/m.jpg', year: 1999, mediaType: 'movie', addedAt: 100 },
    { userId: 'u1', kind: 'link', titleKey: 'link:0123456789abcdef', title: 'Vid', url: 'https://example.com/v', platform: 'example.com', addedAt: 200 },
    { userId: 'u1', kind: 'link', titleKey: 'link:ffffffffffffffff', title: 'broken row without a url', addedAt: 300 },
    { userId: 'u2', titleKey: 'tmdb:movie:1', title: 'Other', mediaType: 'movie', addedAt: 50 }
  ]);
  const store = new MongoWatchlistStore(() => col, 500);
  const items = await store.list('u1');
  assert.deepEqual(items.map((i) => i.titleKey), ['link:0123456789abcdef', 'tmdb:movie:603'], 'newest first, unreadable row dropped, other user excluded');
  assert.equal(isTitleItem(items[1]) && items[1].kind, 'title');
  assert.equal(isLinkItem(items[0]) && items[0].thumbnail, null);
  assert.equal(rowToItem({ titleKey: 'tmdb:tv:1', title: 'x', mediaType: 'tv', addedAt: 1 })?.kind, 'title');
});

test('mongo store: add stores kind, duplicates are rejected by the unique key, remove is scoped to the owner', async () => {
  const col = fakeCol();
  const store = new MongoWatchlistStore(() => col, 500);
  const l = cleanLink({ url: 'https://example.com/a', title: 'A' })!;
  assert.equal(await store.add('u1', l), 'added');
  assert.equal(await store.add('u1', l), 'duplicate');
  assert.equal(await store.add('u1', { titleKey: 'tmdb:movie:1', title: 'T', posterPath: null, year: null, mediaType: 'movie' }), 'added');
  assert.deepEqual(col.rows.map((r: any) => r.kind), ['link', 'title']);
  assert.equal(await store.remove('u2', l.titleKey), false);
  assert.equal(await store.remove('u1', l.titleKey), true);
});

test('mongo store: cap is strict even when another writer slips in between the count and the insert', async () => {
  const col = fakeCol([{ userId: 'u1', titleKey: 'tmdb:movie:1', title: 'T', mediaType: 'movie', addedAt: 1 }, { userId: 'u1', titleKey: 'tmdb:movie:2', title: 'T', mediaType: 'movie', addedAt: 2 }], { racing: 1 });
  const store = new MongoWatchlistStore(() => col, 3);
  const l = cleanLink({ url: 'https://example.com/a', title: 'A' })!;
  // first count: 2 (< 3) so the insert is attempted; re-count sees 4 > 3 so our row is taken back out
  assert.equal(await store.add('u1', l), 'cap');
  assert.equal(col.rows.length, 2, 'the over-cap row did not persist');
});
