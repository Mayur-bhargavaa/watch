import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogTitle, LinkSnapshot, TitleSnapshot, WatchlistItem } from '@synccinema/common';
import { linkTitleKey } from '@synccinema/common';
import { announceSuggestions, buildSuggestions, classifySearchInput, enterDestination, extractYouTubeId, flattenOptions, legacySearchRedirect, matchGames, shouldSearchCatalog } from '../headerSearch';
import { liveGames } from '../gamesHub';
import { DEFAULT_FILTERS } from '../catalog/filters';
import { discoverQueryString, discoverSearchHref, filtersFromParams, resultsChipLabel, withoutQuery } from '../catalog/urlState';
import { LEGACY_SAMPLE_URLS, LEGACY_WATCHLIST_KEY, inBatches, isLegacySampleUrl, mapLegacyWatchlist, planAfterUpload } from '../catalog/legacyWatchlist';
import { createWatchlistStore, type StoreDeps } from '../catalog/watchlistStore';
import { WATCHLIST_TABS, defaultLinkTitle, filterWatchlist, linkThumbnail, parseTab, safeOpenUrl, tabCounts, titleDetailHref } from '../catalog/watchlistView';
import { resolveActiveNav, sidebarItemForPath } from '../sidebarNav';

const title = (n: number, extra: Partial<CatalogTitle> = {}): CatalogTitle => ({ id: `tmdb:movie:${n}`, source: 'tmdb', sourceId: String(n), mediaType: 'movie', title: `Movie ${n}`, overview: '', posterPath: '/p.jpg', backdropPath: null, releaseDate: '2020-05-01', genres: [], runtimeMinutes: null, rating: null, ratingSource: 'TMDB', voteCount: 0, providers: [], region: 'IN', externalUrl: null, ...extra });

// ---- input classification --------------------------------------------------------------------------------------

test('classify: YouTube links and ids behave exactly as before', () => {
  assert.deepEqual(classifySearchInput('https://www.youtube.com/watch?v=zSWdZVtXT7E'), { kind: 'youtube', id: 'zSWdZVtXT7E' });
  assert.deepEqual(classifySearchInput('https://youtu.be/zSWdZVtXT7E?t=4'), { kind: 'youtube', id: 'zSWdZVtXT7E' });
  assert.deepEqual(classifySearchInput('youtube.com/shorts/zSWdZVtXT7E'), { kind: 'youtube', id: 'zSWdZVtXT7E' });
  assert.deepEqual(classifySearchInput('  zSWdZVtXT7E  '), { kind: 'youtube', id: 'zSWdZVtXT7E' });
  assert.equal(extractYouTubeId(''), null);
  assert.equal(extractYouTubeId('not a video'), null);
});

test('classify: an 11-letter title is a search, not a YouTube video id', () => {
  for (const word of ['oppenheimer', 'Oppenheimer', 'OPPENHEIMER', 'ratatouille', 'Ratatouille']) {
    assert.equal(extractYouTubeId(word), null, word);
    assert.equal(classifySearchInput(word).kind, 'text', word);
  }
  assert.deepEqual(classifySearchInput('dQw4w9WgXcQ'), { kind: 'youtube', id: 'dQw4w9WgXcQ' });
  assert.deepEqual(classifySearchInput('aBcDeFgHiJk'), { kind: 'youtube', id: 'aBcDeFgHiJk' });
});

test('classify: room links and generated-looking room codes go to the room', () => {
  assert.deepEqual(classifySearchInput('https://watch.example.com/room/abc123xy'), { kind: 'room', code: 'abc123xy' });
  assert.deepEqual(classifySearchInput('/room/my-room'), { kind: 'room', code: 'my-room' });
  assert.deepEqual(classifySearchInput('k3j9x2_a'), { kind: 'room', code: 'k3j9x2_a' });
  assert.deepEqual(classifySearchInput('ab12cd34'), { kind: 'room', code: 'ab12cd34' });
});

test('classify: titles and words are free text, with a join-room option only for code-shaped text', () => {
  assert.deepEqual(classifySearchInput('avengers'), { kind: 'text', text: 'avengers', codeLike: 'avengers' }, 'a bare 8-letter word is a title, not a forced room');
  assert.deepEqual(classifySearchInput('the dark knight'), { kind: 'text', text: 'the dark knight', codeLike: null });
  assert.deepEqual(classifySearchInput('  spaced   out  '), { kind: 'text', text: 'spaced out', codeLike: null });
  assert.deepEqual(classifySearchInput('ab'), { kind: 'text', text: 'ab', codeLike: null });
  assert.equal(classifySearchInput('   ').kind, 'empty');
  assert.equal(classifySearchInput('x'.repeat(300)).kind, 'text');
  const long = classifySearchInput('y y '.repeat(100));
  assert.equal(long.kind === 'text' && long.text.length <= 100, true);
});

test('classify: only text of 2+ characters is sent to the catalog', () => {
  assert.equal(shouldSearchCatalog(classifySearchInput('a')), false);
  assert.equal(shouldSearchCatalog(classifySearchInput('ab')), true);
  assert.equal(shouldSearchCatalog(classifySearchInput('https://youtu.be/zSWdZVtXT7E')), false);
  assert.equal(shouldSearchCatalog(classifySearchInput('k3j9x2_a')), false);
});

test('Enter destinations: YouTube launches, room opens, text goes to /discover?q=', () => {
  assert.deepEqual(enterDestination(classifySearchInput('zSWdZVtXT7E')), { type: 'youtube', id: 'zSWdZVtXT7E' });
  assert.deepEqual(enterDestination(classifySearchInput('/room/abc-123')), { type: 'push', href: '/room/abc-123' });
  assert.deepEqual(enterDestination(classifySearchInput('dune part two')), { type: 'push', href: '/discover?q=dune+part+two' });
  assert.equal(enterDestination(classifySearchInput('')), null);
  assert.equal(discoverSearchHref('  '), '/discover');
  assert.equal(discoverSearchHref('a&b=c'), '/discover?q=a%26b%3Dc', 'text is encoded, never injected into the query');
});

test('legacy /dashboard?search= redirects to /discover?q=', () => {
  assert.equal(legacySearchRedirect('inception'), '/discover?q=inception');
  assert.equal(legacySearchRedirect(' the matrix '), '/discover?q=the+matrix');
  assert.equal(legacySearchRedirect(''), null);
  assert.equal(legacySearchRedirect(null), null);
});

// ---- suggestions --------------------------------------------------------------------------------------------------

test('games: only live games match, by name or blurb, linking to the game route', () => {
  const live = liveGames();
  assert.ok(live.length >= 13, 'the hub has 13 live games');
  assert.ok(live.every((g) => g.route && !g.isComingSoon));
  const chess = matchGames('chess');
  assert.equal(chess[0].route, '/games/chess');
  assert.deepEqual(matchGames('zzzz'), []);
  assert.deepEqual(matchGames(''), []);
  const fake = [{ ...live[0], id: 'soon', title: 'Soonland', isComingSoon: true, route: undefined }, live[0]];
  assert.deepEqual(matchGames('soonland', fake as any), [], 'coming-soon games are never offered');
  assert.ok(matchGames('quiz').some((g) => g.id === 'quiz-show'));
  assert.ok(matchGames('l', live, 2).length <= 2);
});

test('suggestions: Movies & shows (top 5), Games, Join room, See all', () => {
  const catalog = Array.from({ length: 8 }, (_, i) => title(i + 1, { mediaType: i % 2 ? 'tv' : 'movie' }));
  const groups = buildSuggestions({ intent: classifySearchInput('chess'), catalog, catalogState: 'ok' });
  assert.deepEqual(groups.map((g) => g.id), ['titles', 'games', 'room', 'all']);
  assert.equal(groups[0].options.length, 5);
  assert.equal(groups[0].options[0].href, '/discover/title/tmdb/movie/1');
  assert.equal(groups[0].options[0].detail, '2020 · Movie');
  assert.equal(groups[0].options[1].detail, '2020 · TV');
  assert.equal(groups[1].options[0].href, '/games/chess');
  assert.equal(groups[2].options[0].href, '/room/chess');
  assert.equal(groups[3].options[0].href, '/discover?q=chess');
  const flat = flattenOptions(groups);
  assert.equal(new Set(flat.map((o) => o.id)).size, flat.length, 'option ids are unique (aria-activedescendant)');
});

test('suggestions: guests and an unconfigured catalog get no Movies & shows group, nothing breaks', () => {
  for (const state of ['guest', 'not_configured'] as const) {
    const groups = buildSuggestions({ intent: classifySearchInput('mafia'), catalog: [], catalogState: state });
    assert.deepEqual(groups.map((g) => g.id), ['games', 'room']);
    assert.equal(groups.find((g) => g.id === 'status'), undefined, 'no error row for these states');
  }
  const none = buildSuggestions({ intent: classifySearchInput('qqqq zzzz'), catalog: [], catalogState: 'not_configured' });
  assert.deepEqual(none, []);
});

test('suggestions: an upstream error shows a quiet "Search unavailable" row that cannot be selected', () => {
  const groups = buildSuggestions({ intent: classifySearchInput('inception'), catalog: [], catalogState: 'unavailable' });
  const status = groups.find((g) => g.id === 'status');
  assert.equal(status?.options[0].label, 'Search unavailable');
  assert.equal(status?.options[0].disabled, true);
  assert.equal(flattenOptions(groups).some((o) => o.kind === 'status'), false);
  assert.match(announceSuggestions(groups, 'unavailable', classifySearchInput('inception')), /Search unavailable/);
});

test('suggestions: YouTube and room intents show a single row; empty shows nothing', () => {
  const yt = buildSuggestions({ intent: classifySearchInput('zSWdZVtXT7E'), catalog: [], catalogState: 'idle' });
  assert.equal(yt[0].options[0].youtubeId, 'zSWdZVtXT7E');
  const room = buildSuggestions({ intent: classifySearchInput('/room/abc-123'), catalog: [title(1)], catalogState: 'ok' });
  assert.deepEqual(room.map((g) => g.id), ['room']);
  assert.deepEqual(buildSuggestions({ intent: classifySearchInput(''), catalog: [], catalogState: 'idle' }), []);
});

test('suggestions: the live-region message counts selectable results', () => {
  const intent = classifySearchInput('chess');
  const groups = buildSuggestions({ intent, catalog: [title(1)], catalogState: 'ok' });
  assert.match(announceSuggestions(groups, 'ok', intent), /^\d+ suggestions available$/);
  assert.equal(announceSuggestions([], 'ok', classifySearchInput('qqqq')), 'No suggestions. Press Enter to search all results');
  assert.equal(announceSuggestions([], 'loading', classifySearchInput('qqqq')), 'Searching');
  assert.equal(announceSuggestions([], 'idle', classifySearchInput('')), '');
  const one = buildSuggestions({ intent: classifySearchInput('zSWdZVtXT7E'), catalog: [], catalogState: 'idle' });
  assert.equal(announceSuggestions(one, 'idle', classifySearchInput('zSWdZVtXT7E')), '1 suggestion available');
});

// ---- Discover URL state -----------------------------------------------------------------------------------------

test('filters round-trip through the URL; invalid values fall back to defaults', () => {
  const p = new URLSearchParams('q=dune&type=tv&genre=35&year=2010-2020&sort=rating&provider=netflix&room=abc-123');
  const f = filtersFromParams(p);
  assert.deepEqual(f, { q: 'dune', type: 'tv', genre: 35, year: '2010-2020', sort: 'rating', provider: 'netflix' });
  const qs = discoverQueryString(f, p);
  const back = filtersFromParams(new URLSearchParams(qs.slice(1)));
  assert.deepEqual(back, f);
  assert.match(qs, /room=abc-123/, 'the room parameter survives filter changes');
  assert.equal(discoverQueryString(DEFAULT_FILTERS), '');
  const bad = filtersFromParams(new URLSearchParams('type=evil&genre=-1&year=abc&sort=x&provider=%3Cscript%3E&q=%00hi%07'));
  assert.deepEqual(bad, { ...DEFAULT_FILTERS, q: 'hi' });
  assert.equal(filtersFromParams(new URLSearchParams('q=' + 'x'.repeat(500))).q.length, 100);
});

test('clearing the "Results for" chip removes only q', () => {
  const f = filtersFromParams(new URLSearchParams('q=dune&type=movie&sort=rating'));
  const cleared = withoutQuery(f);
  assert.equal(cleared.q, '');
  assert.equal(discoverQueryString(cleared), '?type=movie&sort=rating');
  assert.equal(resultsChipLabel('short'), 'short');
  assert.ok(resultsChipLabel('x'.repeat(80)).length <= 40);
});

// ---- legacy watchlist migration ----------------------------------------------------------------------------------

const legacy = (over: Record<string, unknown>) => ({ id: 'x', title: 'Saved', url: 'https://example.com/a', platform: 'EXAMPLE', platformBadge: 'bg-red-600', thumbnail: 'https://images.example.com/t.jpg', category: 'Drama', tagline: 'Nice', ...over });

test('legacy ignore list: the four hard-coded sample URLs are recognised in any spelling', () => {
  assert.equal(LEGACY_SAMPLE_URLS.length, 4);
  for (const u of ['https://www.youtube.com/watch?v=zSWdZVtXT7E', 'https://youtu.be/zSWdZVtXT7E', 'https://www.netflix.com/title/80057281', 'https://www.primevideo.com', 'https://www.primevideo.com/', 'https://www.youtube.com/watch?v=qIcTM8WXFjk&t=9']) {
    assert.equal(isLegacySampleUrl(u), true, u);
  }
  assert.equal(isLegacySampleUrl('https://www.netflix.com/title/81231974'), false);
  assert.equal(isLegacySampleUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk'), false);
  assert.equal(isLegacySampleUrl(undefined), false);
  assert.equal(LEGACY_WATCHLIST_KEY, 'stitchbyte_watchlist');
});

test('legacy mapping: samples are skipped, user items become link items, bad data is counted', () => {
  const raw = JSON.stringify([
    legacy({ id: 'interstellar', title: 'Interstellar', url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E' }),
    legacy({ id: 'netflix-stranger-things', url: 'https://www.netflix.com/title/80057281' }),
    legacy({ id: 'prime-the-boys', url: 'https://www.primevideo.com' }),
    legacy({ id: 'cyberpunk', url: 'https://www.youtube.com/watch?v=qIcTM8WXFjk' }),
    legacy({ id: 'mine', title: '  My <b>pick</b>  ', url: 'https://www.disneyplus.com/series/loki' }),
    legacy({ id: 'lofi', title: 'Lofi', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', thumbnail: 'javascript:alert(1)' }),
    legacy({ id: 'dup', title: 'Dup', url: 'https://youtu.be/jfKfPfyJRdk' }),
    legacy({ id: 'http', url: 'http://example.com/plain' }),
    legacy({ id: 'js', url: 'javascript:alert(1)' }),
    legacy({ id: 'notitle', title: '', url: 'https://www.example.org/watch' }),
    'garbage',
    null
  ]);
  const m = mapLegacyWatchlist(raw, 100);
  assert.equal(m.skippedSamples, 4);
  assert.equal(m.invalid, 4, 'http, javascript, and two non-objects');
  assert.deepEqual(m.links.map((l) => l.url), ['https://www.disneyplus.com/series/loki', 'https://www.youtube.com/watch?v=jfKfPfyJRdk', 'https://www.example.org/watch']);
  assert.equal(m.links[0].title, 'My bpick/b', 'angle brackets are stripped');
  assert.equal(m.links[0].thumbnail, 'https://images.example.com/t.jpg');
  assert.equal(m.links[0].category, 'Drama');
  assert.equal(m.links[1].thumbnail, undefined, 'an unsafe thumbnail is dropped, not uploaded');
  assert.equal(m.links[2].title, 'example.org', 'a missing title falls back to the site name');
  assert.equal(m.overCapacity, 0);
});

test('legacy mapping: respects the room left in the watchlist and never throws', () => {
  const raw = JSON.stringify(Array.from({ length: 5 }, (_, i) => legacy({ url: `https://example.com/${i}`, title: `T${i}` })));
  const m = mapLegacyWatchlist(raw, 3);
  assert.equal(m.links.length, 3);
  assert.equal(m.overCapacity, 2);
  assert.equal(mapLegacyWatchlist(raw, 0).links.length, 0);
  for (const junk of ['', 'not json', '{"a":1}', '42', 'null', undefined, 5, {}]) {
    assert.deepEqual(mapLegacyWatchlist(junk as any, 10), { links: [], skippedSamples: 0, invalid: 0, overCapacity: 0 });
  }
});

test('legacy migration: the old key is removed only when nothing is left to retry', () => {
  assert.deepEqual(planAfterUpload(['added', 'duplicate', 'refused']), { clearKey: true, added: 1, duplicates: 1, refused: 1, notSaved: 0 });
  assert.equal(planAfterUpload(['added', 'retry']).clearKey, false, 'a network or server failure keeps the key: no data is lost');
  assert.equal(planAfterUpload([]).clearKey, true, 'only samples or unusable entries: the key can go');
  const full = planAfterUpload(['added', 'full', 'full'], 2);
  assert.equal(full.clearKey, true, 'a full list can never succeed later');
  assert.equal(full.notSaved, 4);
  assert.deepEqual(inBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(inBatches([], 4), []);
});

// ---- the single watchlist store --------------------------------------------------------------------------------

function fakeDeps(over: Partial<StoreDeps> = {}) {
  const calls = { list: 0, addTitle: [] as TitleSnapshot[], addLink: [] as LinkSnapshot[], remove: [] as string[], announce: 0 };
  let server: WatchlistItem[] = [];
  const deps: StoreDeps = {
    getUser: () => ({ id: 'u1' }),
    list: async () => (calls.list++, { items: [...server], max: 500 }),
    addTitle: async (s) => (calls.addTitle.push(s), server.unshift({ ...s, kind: 'title', addedAt: 1 }), { duplicate: false }),
    addLink: async (l) => {
      calls.addLink.push(l);
      const titleKey = linkTitleKey(l.url)!;
      server.unshift({ kind: 'link', titleKey, title: l.title, url: l.url, platform: l.platform ?? '', thumbnail: null, category: null, tagline: null, addedAt: 1 });
      return { duplicate: false, titleKey };
    },
    remove: async (k) => (calls.remove.push(k), (server = server.filter((i) => i.titleKey !== k))),
    now: () => 1000,
    announce: () => void calls.announce++,
    ...over
  };
  return { deps, calls, setServer: (s: WatchlistItem[]) => (server = s) };
}
const tsnap = (n: number): TitleSnapshot => ({ titleKey: `tmdb:movie:${n}`, title: `T${n}`, posterPath: null, year: 2020, mediaType: 'movie' });

test('store: one load however many components ask, then every subscriber sees the same list', async () => {
  const { deps, calls } = fakeDeps();
  const store = createWatchlistStore(deps);
  let notified = 0;
  store.subscribe(() => notified++);
  await Promise.all([store.start(), store.start(), store.start()]);
  assert.equal(calls.list, 1, 'requests are de-duplicated');
  assert.equal(store.getView().loaded, true);
  assert.equal(store.getView().signedIn, true);
  await store.start();
  assert.equal(calls.list, 1, 'a loaded list is not fetched again');
  assert.ok(notified > 0);
});

test('store: saving a title or a link in one place is visible to every reader at once, optimistically', async () => {
  const { deps, calls } = fakeDeps();
  const store = createWatchlistStore(deps);
  await store.start();
  const p = store.save(tsnap(1));
  assert.equal(store.isSaved('tmdb:movie:1'), true, 'flipped before the server answered');
  assert.equal(store.getView().items[0].kind, 'title');
  assert.equal((await p).ok, true);
  const l = await store.saveLink({ title: 'Video', url: 'https://youtu.be/zSWdZVtXT7E' });
  assert.equal(l.ok && l.titleKey.startsWith('link:'), true);
  assert.equal(store.getView().items.length, 2);
  assert.deepEqual(calls.addLink.map((x) => x.url), ['https://youtu.be/zSWdZVtXT7E']);
  assert.equal(calls.announce, 2, 'other tabs are told');
  assert.equal(store.getView().items.some((i) => i.kind === 'link' && i.title === 'Video'), true);
});

test('store: double clicks send one request; toggle saves then removes', async () => {
  const { deps, calls } = fakeDeps();
  const store = createWatchlistStore(deps);
  await store.start();
  const [a, b] = await Promise.all([store.toggle(tsnap(2)), store.toggle(tsnap(2))]);
  assert.equal(a.ok && b.ok, true);
  assert.equal(calls.addTitle.length, 1, 'the second click joined the first request');
  assert.equal(store.isSaved('tmdb:movie:2'), true);
  await store.toggle(tsnap(2));
  assert.equal(store.isSaved('tmdb:movie:2'), false);
  assert.deepEqual(calls.remove, ['tmdb:movie:2']);
});

test('store: a refused add rolls back and says why; a failed remove puts the item back', async () => {
  const full = Object.assign(new Error('full'), { code: 'WATCHLIST_FULL', status: 409 });
  const { deps, setServer } = fakeDeps({ addTitle: async () => { throw full; }, remove: async () => { throw new Error('network'); } });
  const store = createWatchlistStore(deps);
  await store.start();
  const r = await store.save(tsnap(3));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, 'full');
  assert.equal(store.isSaved('tmdb:movie:3'), false, 'rolled back');
  assert.match(store.getView().notice?.text ?? '', /full/);
  setServer([{ ...tsnap(4), kind: 'title', addedAt: 5 }]);
  await store.reload();
  const rm = await store.remove('tmdb:movie:4');
  assert.equal(rm.ok, false);
  assert.equal(store.isSaved('tmdb:movie:4'), true, 'restored after the failed remove');
  store.dismissNotice();
  assert.equal(store.getView().notice, null);
});

test('store: guests get a sign-in prompt and no network call', async () => {
  const { deps, calls } = fakeDeps({ getUser: () => null });
  const store = createWatchlistStore(deps);
  await store.start();
  assert.equal(calls.list, 0);
  assert.equal(store.getView().signedIn, false);
  assert.equal(store.getView().ready, true);
  for (const r of [await store.save(tsnap(1)), await store.toggle(tsnap(1)), await store.saveLink({ title: 'x', url: 'https://example.com/a' }), await store.remove('tmdb:movie:1')]) {
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, 'signin');
  }
  assert.equal(store.getView().notice?.signIn, true);
  assert.equal(calls.addTitle.length + calls.addLink.length + calls.remove.length, 0);
});

test('store: an invalid link is refused locally and a different account never sees the previous list', async () => {
  let user: { id: string } | null = { id: 'u1' };
  const { deps, calls, setServer } = fakeDeps({ getUser: () => user });
  const store = createWatchlistStore(deps);
  setServer([{ ...tsnap(9), kind: 'title', addedAt: 2 }]);
  await store.start();
  assert.equal(store.getView().items.length, 1);
  const bad = await store.saveLink({ title: 'x', url: 'javascript:alert(1)' });
  assert.equal(!bad.ok && bad.reason, 'invalid');
  assert.equal(calls.addLink.length, 0);
  user = { id: 'u2' };
  setServer([]);
  await store.start();
  assert.equal(store.getView().items.length, 0, 'the previous account list was dropped');
  assert.equal(calls.list, 2);
  user = null;
  await store.start();
  assert.equal(store.getView().signedIn, false);
  assert.equal(store.getView().items.length, 0);
});

test('store: a failed first load can be retried', async () => {
  let fail = true;
  const { deps } = fakeDeps({ list: async () => { if (fail) throw new Error('down'); return { items: [], max: 500 }; } });
  const store = createWatchlistStore(deps);
  await store.start();
  assert.equal(store.getView().loadFailed, true);
  assert.equal(store.getView().loaded, false);
  fail = false;
  await store.reload();
  assert.equal(store.getView().loaded, true);
  assert.equal(store.getView().loadFailed, false);
});

// ---- watchlist page helpers -------------------------------------------------------------------------------------

const t = (n: number, mediaType: 'movie' | 'tv'): WatchlistItem => ({ kind: 'title', titleKey: `tmdb:${mediaType}:${n}`, title: `T${n}`, posterPath: null, year: 2020, mediaType, addedAt: n });
const lk = (n: number, over: Partial<Extract<WatchlistItem, { kind: 'link' }>> = {}): WatchlistItem => ({ kind: 'link', titleKey: `link:${String(n).padStart(16, '0')}`, title: `L${n}`, url: 'https://example.com/a', platform: 'example.com', thumbnail: null, category: null, tagline: null, addedAt: n, ...over });

test('watchlist tabs: All, Movies, TV, Links filter one list; counts add up', () => {
  const items = [t(1, 'movie'), t(2, 'tv'), lk(3), t(4, 'movie'), lk(5)];
  assert.deepEqual(WATCHLIST_TABS.map((x) => x.id), ['all', 'movie', 'tv', 'link']);
  assert.equal(filterWatchlist(items, 'all').length, 5);
  assert.deepEqual(filterWatchlist(items, 'movie').map((i) => i.titleKey), ['tmdb:movie:1', 'tmdb:movie:4']);
  assert.deepEqual(filterWatchlist(items, 'tv').map((i) => i.titleKey), ['tmdb:tv:2']);
  assert.equal(filterWatchlist(items, 'link').length, 2);
  assert.deepEqual(tabCounts(items), { all: 5, movie: 2, tv: 1, link: 2 });
  assert.equal(parseTab('tv'), 'tv');
  assert.equal(parseTab('nope'), 'all');
  assert.equal(parseTab(null), 'all');
});

test('link cards: YouTube thumbnail, safe open URL, default title, title page href', () => {
  assert.equal(linkThumbnail({ url: 'https://youtu.be/zSWdZVtXT7E', thumbnail: null }), 'https://img.youtube.com/vi/zSWdZVtXT7E/hqdefault.jpg');
  assert.equal(linkThumbnail({ url: 'https://example.com/a', thumbnail: null }), null);
  assert.equal(linkThumbnail({ url: 'https://example.com/a', thumbnail: 'https://cdn.example.com/t.jpg' }), 'https://cdn.example.com/t.jpg');
  assert.equal(safeOpenUrl({ url: 'https://example.com/a' }), 'https://example.com/a');
  assert.equal(safeOpenUrl({ url: 'javascript:alert(1)' }), null);
  assert.equal(safeOpenUrl({ url: 'http://example.com/a' }), null);
  assert.equal(defaultLinkTitle('https://www.youtube.com/watch?v=zSWdZVtXT7E'), 'YouTube video');
  assert.equal(defaultLinkTitle('https://www.example.com/x'), 'example.com');
  assert.equal(defaultLinkTitle('nope'), '');
  assert.equal(titleDetailHref('tmdb:tv:42'), '/discover/title/tmdb/tv/42');
  assert.equal(titleDetailHref('link:0000000000000001'), null);
});

// ---- sidebar ---------------------------------------------------------------------------------------------------

test('sidebar: every route that renders it highlights the right item', () => {
  const cases: Array<[string, string]> = [
    ['/dashboard', 'home'], ['/', 'home'], ['/discover', 'home'], ['/discover/title/tmdb/movie/603', 'home'], ['/watchlist', 'watchlist'],
    ['/rooms', 'rooms'], ['/friends', 'friends'], ['/plans', 'plans'], ['/plans/abc', 'plans'], ['/games', 'games'], ['/games/ludo', 'games'], ['/games/mafia', 'games'],
    ['/games/quiz-show', 'games'], ['/games/murder-mystery', 'games'], ['/games/tournament', 'games'], ['/games/imposter', 'games'], ['/games/emoji-charades', 'games'],
    ['/chat', 'chat'], ['/profile', 'profile'], ['/pricing', 'pricing'], ['/dashboard/', 'home'], ['/watchlist?tab=link', 'watchlist']
  ];
  for (const [path, item] of cases) assert.equal(sidebarItemForPath(path), item, path);
  assert.equal(sidebarItemForPath('/discoverable'), 'home', 'a similar prefix does not match');
});

test('sidebar: an explicit activeNav wins and the legacy "dashboard" name means Home', () => {
  assert.equal(resolveActiveNav('dashboard', '/dashboard'), 'home');
  assert.equal(resolveActiveNav('discover', '/discover'), 'home');
  assert.equal(resolveActiveNav('watchlist', '/anything'), 'watchlist');
  assert.equal(resolveActiveNav(undefined, '/games/chess'), 'games');
});
