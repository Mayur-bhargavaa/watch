import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogTitle, ProviderOffer, SelectedTitle, TitleSnapshot } from '@synccinema/common';
import { tmdbImageUrl, tmdbSrcSet } from '@synccinema/common';
import { DEFAULT_FILTERS, parseYearInput, filtersToQuery, filtersKey, hasActiveFilters, isBrowsing, createDebouncer } from '../catalog/filters';
import { searchReducer, INITIAL_SEARCH_STATE, mergeResults, canLoadMore, isEmptyResult, statusMessage } from '../catalog/searchState';
import { groupOffers, heroChips } from '../catalog/providers';
import { externalLinkProps } from '../catalog/externalLink';
import { watchlistReducer, EMPTY_WATCHLIST, isSaved } from '../catalog/watchlistState';
import { countdownView, formatCountdown, sortedQueue, startAtIn, readySummary } from '../catalog/partyQueue';

const title = (id: number): CatalogTitle => ({ id: `tmdb:movie:${id}`, source: 'tmdb', sourceId: String(id), mediaType: 'movie', title: `T${id}`, overview: '', posterPath: null, backdropPath: null, releaseDate: null, genres: [], runtimeMinutes: null, rating: null, ratingSource: 'TMDB', voteCount: 0, providers: [], region: 'IN', externalUrl: null });
const offer = (o: Partial<ProviderOffer>): ProviderOffer => ({ id: '1', name: 'Netflix', type: 'subscription', logoUrl: null, destinationUrl: null, verified: true, ...o });

test('year input: single year, range, dashes, invalid', () => {
  assert.deepEqual(parseYearInput(''), { ok: true, value: '' });
  assert.deepEqual(parseYearInput(' 2015 '), { ok: true, value: '2015' });
  assert.deepEqual(parseYearInput('2010-2020'), { ok: true, value: '2010-2020' });
  assert.deepEqual(parseYearInput('2010 – 2020'), { ok: true, value: '2010-2020' });
  assert.deepEqual(parseYearInput('2010 2020'), { ok: true, value: '2010-2020' });
  for (const bad of ['20', 'abcd', '2020-2010', '1800', '2200', '2010-', '2010-2020-2030']) assert.equal(parseYearInput(bad).ok, false, bad);
});

test('filters map to a minimal, stable query string', () => {
  assert.equal(filtersToQuery(DEFAULT_FILTERS).toString(), '');
  const f = { ...DEFAULT_FILTERS, q: '  dune ', type: 'movie' as const, genre: 878, year: '2010-2020', sort: 'rating' as const, provider: 'netflix' };
  assert.equal(filtersToQuery(f, 3, 'in').toString(), 'q=dune&type=movie&genre=878&year=2010-2020&sort=rating&provider=netflix&region=IN'.replace('region=IN', 'region=in') + '&page=3');
  assert.equal(filtersToQuery({ ...DEFAULT_FILTERS, year: 'bogus' }).has('year'), false);
  assert.equal(filtersKey(f), filtersKey({ ...f }));
  assert.equal(filtersToQuery({ ...DEFAULT_FILTERS, q: 'x'.repeat(500) }).get('q')!.length, 100);
  assert.equal(hasActiveFilters(DEFAULT_FILTERS), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, genre: 1 }), true);
  assert.equal(isBrowsing({ ...DEFAULT_FILTERS, q: ' ' }), false);
  assert.equal(isBrowsing({ ...DEFAULT_FILTERS, q: 'a' }), true);
});

test('debouncer waits for quiet, collapses bursts, cancels and flushes', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const calls: string[] = [];
    const d = createDebouncer((v: string) => calls.push(v), 300);
    d.call('d'); d.call('du'); d.call('dun');
    mock.timers.tick(299);
    assert.deepEqual(calls, []);
    mock.timers.tick(1);
    assert.deepEqual(calls, ['dun']);
    d.call('x'); d.cancel(); mock.timers.tick(1000);
    assert.deepEqual(calls, ['dun']);
    d.call('y'); d.flush();
    assert.deepEqual(calls, ['dun', 'y']);
  } finally {
    mock.timers.reset();
  }
});

test('search state: late responses of obsolete requests are ignored', () => {
  let s = searchReducer(INITIAL_SEARCH_STATE, { type: 'start', append: false });
  const first = s.requestId;
  s = searchReducer(s, { type: 'start', append: false });
  const second = s.requestId;
  const stale = searchReducer(s, { type: 'success', requestId: first, page: { results: [title(1)], page: 1, totalPages: 1, totalResults: 1 }, append: false });
  assert.equal(stale, s, 'stale success ignored');
  assert.equal(searchReducer(s, { type: 'failure', requestId: first, message: 'x', code: null }), s);
  s = searchReducer(s, { type: 'success', requestId: second, page: { results: [title(2)], page: 1, totalPages: 2, totalResults: 40 }, append: false });
  assert.equal(s.status, 'ready');
  assert.deepEqual(s.items.map((t) => t.id), ['tmdb:movie:2']);
  assert.equal(canLoadMore(s), true);
});

test('search state: load more appends without duplicates; errors, empty, reset', () => {
  let s = searchReducer(INITIAL_SEARCH_STATE, { type: 'start', append: false });
  s = searchReducer(s, { type: 'success', requestId: s.requestId, page: { results: [title(1), title(2)], page: 1, totalPages: 2, totalResults: 4 }, append: false });
  s = searchReducer(s, { type: 'start', append: true });
  assert.equal(s.status, 'loadingMore');
  assert.equal(s.items.length, 2, 'items stay while loading more');
  s = searchReducer(s, { type: 'success', requestId: s.requestId, page: { results: [title(2), title(3)], page: 2, totalPages: 2, totalResults: 4 }, append: true });
  assert.deepEqual(s.items.map((t) => t.id), ['tmdb:movie:1', 'tmdb:movie:2', 'tmdb:movie:3']);
  assert.equal(canLoadMore(s), false);
  s = searchReducer(s, { type: 'start', append: true });
  s = searchReducer(s, { type: 'failure', requestId: s.requestId, message: 'boom', code: 'CATALOG_UPSTREAM' });
  assert.equal(s.status, 'error');
  assert.equal(s.items.length, 3, 'a failed load-more keeps what is shown');
  assert.equal(statusMessage(s), 'Search failed');
  let e = searchReducer(INITIAL_SEARCH_STATE, { type: 'start', append: false });
  e = searchReducer(e, { type: 'success', requestId: e.requestId, page: { results: [], page: 1, totalPages: 1, totalResults: 0 }, append: false });
  assert.equal(isEmptyResult(e), true);
  assert.equal(statusMessage(e), 'No titles found');
  assert.equal(searchReducer(e, { type: 'reset' }).status, 'idle');
  assert.equal(mergeResults([title(1)], [title(1)]).length, 1);
});

test('provider grouping: order, verified only; hero chips only verified streaming', () => {
  const offers = [offer({ id: '3', name: 'Store', type: 'buy' }), offer({ id: '1' }), offer({ id: '2', name: 'Prime Video', type: 'rent' }), offer({ id: '9', name: 'Fake', verified: false }), offer({ id: '4', name: 'Tubi', type: 'free' })];
  assert.deepEqual(groupOffers(offers).map((g) => g.type), ['subscription', 'free', 'rent', 'buy']);
  assert.equal(groupOffers(offers).flatMap((g) => g.offers).some((o) => o.id === '9'), false);
  assert.deepEqual(heroChips(offers).map((o) => o.id), ['1', '4']);
  assert.deepEqual(heroChips([]), []);
  assert.deepEqual(groupOffers([]), []);
});

test('external link props: https only, noopener noreferrer, caption names the provider', () => {
  const p = externalLinkProps('https://www.netflix.com/title/1', 'Netflix')!;
  assert.deepEqual({ target: p.target, rel: p.rel }, { target: '_blank', rel: 'noopener noreferrer' });
  assert.equal(p.caption, 'Opens Netflix. You may need to sign in there.');
  for (const bad of ['javascript:alert(1)', 'http://netflix.com/x', 'data:text/html,x', '', null, undefined, '//evil.com', 'https://localhost/x']) assert.equal(externalLinkProps(bad as any, 'X'), null, String(bad));
});

test('image URL builder', () => {
  assert.equal(tmdbImageUrl('/a.jpg', 'w342'), 'https://image.tmdb.org/t/p/w342/a.jpg');
  assert.equal(tmdbImageUrl('/a.svg', 'w342'), null);
  assert.equal(tmdbImageUrl('javascript:1', 'w342'), null);
  assert.ok(tmdbSrcSet('/a.jpg', ['w185', 'w342', 'w500'])!.includes('w500/a.jpg 500w'));
});

const snap = (n: number): TitleSnapshot => ({ titleKey: `tmdb:movie:${n}`, title: `T${n}`, posterPath: null, year: 2020, mediaType: 'movie' });
test('watchlist optimistic reducer: add, duplicate, rollback of add and remove, confirm', () => {
  let m = watchlistReducer(EMPTY_WATCHLIST, { type: 'loaded', items: [{ ...snap(1), kind: 'title' as const, addedAt: 10 }] });
  m = watchlistReducer(m, { type: 'optimistic-add', snapshot: snap(2), now: 20 });
  assert.deepEqual(m.items.map((i) => i.titleKey), ['tmdb:movie:2', 'tmdb:movie:1']);
  assert.equal(watchlistReducer(m, { type: 'optimistic-add', snapshot: snap(2), now: 30 }), m, 'duplicate ignored');
  const rolled = watchlistReducer(m, { type: 'rollback', titleKey: 'tmdb:movie:2' });
  assert.equal(isSaved(rolled, 'tmdb:movie:2'), false);
  assert.deepEqual(rolled.pending, {});
  m = watchlistReducer(m, { type: 'confirm', titleKey: 'tmdb:movie:2' });
  assert.deepEqual(m.pending, {});
  m = watchlistReducer(m, { type: 'optimistic-remove', titleKey: 'tmdb:movie:1' });
  assert.equal(isSaved(m, 'tmdb:movie:1'), false);
  m = watchlistReducer(m, { type: 'rollback', titleKey: 'tmdb:movie:1' });
  assert.equal(isSaved(m, 'tmdb:movie:1'), true);
  assert.equal(watchlistReducer(m, { type: 'optimistic-remove', titleKey: 'tmdb:movie:99' }), m);
});

test('watchlist: a slow load does not erase an in-flight optimistic add', () => {
  let m = watchlistReducer(EMPTY_WATCHLIST, { type: 'optimistic-add', snapshot: snap(5), now: 1 });
  m = watchlistReducer(m, { type: 'loaded', items: [{ ...snap(1), kind: 'title' as const, addedAt: 0 }] });
  assert.deepEqual(m.items.map((i) => i.titleKey).sort(), ['tmdb:movie:1', 'tmdb:movie:5']);
});

test('party queue view helpers', () => {
  const sel = { startAt: 100_000, ready: ['a'] } as unknown as SelectedTitle;
  assert.deepEqual(countdownView(null, 0), { phase: 'none', secondsLeft: 0 });
  assert.deepEqual(countdownView({ ...sel, startAt: null } as SelectedTitle, 5), { phase: 'none', secondsLeft: 0 });
  assert.deepEqual(countdownView(sel, 90_001), { phase: 'counting', secondsLeft: 10 });
  assert.deepEqual(countdownView(sel, 100_000), { phase: 'started', secondsLeft: 0 });
  assert.equal(formatCountdown(65), '1:05');
  const q = [{ titleKey: 'a', votes: ['x'], proposedAt: 2 }, { titleKey: 'b', votes: ['x', 'y'], proposedAt: 3 }, { titleKey: 'c', votes: ['x'], proposedAt: 1 }] as any;
  assert.deepEqual(sortedQueue(q).map((e) => e.titleKey), ['b', 'c', 'a']);
  assert.equal(startAtIn(2, 1000), 121_000);
  assert.equal(startAtIn(99, 0), 600_000);
  assert.equal(readySummary(sel, 4), '1 of 4 ready');
});
