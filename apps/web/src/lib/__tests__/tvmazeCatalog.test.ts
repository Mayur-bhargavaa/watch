import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTitleRef, parseTitleKey, snapshotOf, tmdbImageUrl, type CatalogTitle, type SeasonInfo } from '@synccinema/common';
import { defaultSeason, episodeCode, formatAirdate, nextEpisodeLabel, nextTabIndex, ratingChips, runtimeLabel, seasonTabs, totalEpisodes } from '../catalog/tv';
import { attributionForDiscover, attributionForTitle, hasAnyAttribution, CREDIT_LINKS } from '../catalog/attribution';
import { TVMAZE_MODE_NOTE, discoverRows, heroSlugs, modeOf } from '../catalog/mode';
import { heroArt, isHeroUsable } from '../catalog/heroSlides';
import { titleDetailHref } from '../catalog/watchlistView';
import { groupOffers } from '../catalog/providers';

const ep = (season: number, number: number, airdate: string | null, name = `E${number}`) => ({ season, number, name, airdate, runtimeMinutes: 45, summary: null });
const seasons: SeasonInfo[] = [
  { number: 1, name: null, episodeCount: 2, premiereDate: '2020-01-01', endDate: '2020-01-08', episodes: [ep(1, 1, '2020-01-01'), ep(1, 2, '2020-01-08')] },
  { number: 2, name: 'Second', episodeCount: 2, premiereDate: '2021-01-01', endDate: '2021-01-08', episodes: [ep(2, 1, '2021-01-01'), ep(2, 2, '2021-01-08')] },
  { number: 3, name: null, episodeCount: 2, premiereDate: '2030-01-01', endDate: null, episodes: [ep(3, 1, '2030-01-01'), ep(3, 2, null)] },
  { number: 4, name: null, episodeCount: 0, premiereDate: null, endDate: null, episodes: [] }
];

test('formatAirdate: fixed English format, invalid dates give null', () => {
  assert.equal(formatAirdate('2026-11-01'), '1 Nov 2026');
  assert.equal(formatAirdate('2026-12-25'), '25 Dec 2026');
  for (const bad of [null, undefined, '', '2026-13-01', '2026-00-10', '2026-11-32', '1 Nov 2026', '2026-1-1', '<b>2026-11-01</b>']) assert.equal(formatAirdate(bad as any), null, String(bad));
});

test('episode code, runtime and the next-episode label (unknown parts are left out)', () => {
  assert.equal(episodeCode({ season: 2, number: 5 }), 'S2 E5');
  assert.equal(episodeCode({ season: 2, number: 0 }), 'S2');
  assert.equal(runtimeLabel(45), '45 min');
  assert.equal(runtimeLabel(null), null);
  assert.equal(runtimeLabel(0), null);
  assert.equal(nextEpisodeLabel(ep(2, 5, '2026-11-01', 'The Return')), 'Next episode: S2 E5 The Return, 1 Nov 2026');
  assert.equal(nextEpisodeLabel(ep(2, 5, null, 'The Return')), 'Next episode: S2 E5 The Return');
  assert.equal(nextEpisodeLabel(null), null);
  assert.equal(nextEpisodeLabel(undefined), null);
});

test('season tabs: only seasons with episodes, labelled and counted', () => {
  assert.deepEqual(seasonTabs(seasons).map((t) => [t.number, t.label, t.count]), [[1, 'Season 1', 2], [2, 'Season 2', 2], [3, 'Season 3', 2]]);
  assert.deepEqual(seasonTabs(undefined), []);
  assert.equal(totalEpisodes(seasons), 6);
});

test('default season: the next episode season, else the latest aired, else the last', () => {
  assert.equal(defaultSeason(seasons, ep(3, 1, '2030-01-01'), '2026-10-17'), 3);
  assert.equal(defaultSeason(seasons, null, '2026-10-17'), 2);
  assert.equal(defaultSeason(seasons, null, '2019-01-01'), 3); // nothing aired yet: last season
  assert.equal(defaultSeason(seasons, ep(9, 1, '2030-01-01'), '2026-10-17'), 2); // next episode of an unlisted season is ignored
  assert.equal(defaultSeason([], null, '2026-10-17'), null);
  assert.equal(defaultSeason(undefined, null, '2026-10-17'), null);
});

test('tab keyboard: arrows wrap, Home and End jump, other keys do nothing', () => {
  assert.equal(nextTabIndex(0, 'ArrowRight', 3), 1);
  assert.equal(nextTabIndex(2, 'ArrowRight', 3), 0);
  assert.equal(nextTabIndex(0, 'ArrowLeft', 3), 2);
  assert.equal(nextTabIndex(1, 'Home', 3), 0);
  assert.equal(nextTabIndex(0, 'End', 3), 2);
  assert.equal(nextTabIndex(0, 'Enter', 3), null);
  assert.equal(nextTabIndex(0, 'ArrowRight', 0), null);
});

test('rating chips: one per source, TMDB and TVmaze side by side, old payloads fall back to the primary rating', () => {
  assert.deepEqual(ratingChips({ rating: 8.4, ratingSource: 'TMDB', ratings: [{ source: 'TMDB', value: 8.4, votes: 9 }, { source: 'TVmaze', value: 9.2 }] }).map((c) => c.label), ['TMDB 8.4', 'TVmaze 9.2']);
  assert.deepEqual(ratingChips({ rating: 7, ratingSource: 'TMDB' }).map((c) => c.label), ['TMDB 7.0']);
  assert.deepEqual(ratingChips({ rating: null, ratingSource: 'TVmaze' }), []);
  assert.deepEqual(ratingChips({ rating: 8, ratingSource: 'TMDB', ratings: [{ source: 'TMDB', value: 8 }, { source: 'TMDB', value: 8 }, { source: 'TVmaze', value: Number.NaN }] }).map((c) => c.label), ['TMDB 8.0']);
});

test('source-aware title keys and routes: tmdb and tvmaze accepted, everything else rejected', () => {
  assert.equal(isValidTitleRef('tmdb', 'movie', '603'), true);
  assert.equal(isValidTitleRef('tmdb', 'tv', '1396'), true);
  assert.equal(isValidTitleRef('tvmaze', 'tv', '169'), true);
  for (const [s, m, i] of [['tvmaze', 'movie', '1'], ['imdb', 'tv', '1'], ['tvmaze', 'tv', 'x'], ['TVMAZE', 'tv', '1'], ['tvmaze', 'tv', '12345678901'], ['tmdb', 'anime', '1'], [undefined, 'tv', '1'], ['tvmaze', 'tv', undefined]]) {
    assert.equal(isValidTitleRef(s, m, i), false, `${s}/${m}/${i}`);
  }
  assert.deepEqual(parseTitleKey('tvmaze:tv:169'), { source: 'tvmaze', mediaType: 'tv', sourceId: '169' });
  assert.equal(parseTitleKey('tvmaze:movie:169'), null);
  assert.equal(titleDetailHref('tvmaze:tv:169'), '/discover/title/tvmaze/tv/169');
  assert.equal(titleDetailHref('tmdb:movie:603'), '/discover/title/tmdb/movie/603');
  assert.equal(titleDetailHref('tvmaze:movie:1'), null);
  assert.equal(titleDetailHref('link:0123456789abcdef'), null);
});

test('TVmaze image tokens: built only on the fixed TVmaze host, forged tokens give nothing', () => {
  assert.equal(tmdbImageUrl('/tvm-p-501-1253519.jpg', 'w342'), 'https://static.tvmaze.com/uploads/images/medium_portrait/501/1253519.jpg');
  assert.equal(tmdbImageUrl('/tvm-p-501-1253519.jpg', 'w780'), 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg');
  assert.equal(tmdbImageUrl('/tvm-q-501-1253519.jpg', 'w342'), null);
  assert.equal(tmdbImageUrl('/tvm-p-501-1253519.php', 'w342'), null);
  assert.equal(tmdbImageUrl('/abc.jpg', 'w342'), 'https://image.tmdb.org/t/p/w342/abc.jpg');
  const snap = snapshotOf({ id: 'tvmaze:tv:169', title: 'Breaking Bad', posterPath: '/tvm-p-501-1253519.jpg', releaseDate: '2008-01-20', mediaType: 'tv' });
  assert.equal(snap.posterPath, '/tvm-p-501-1253519.jpg');
  assert.equal(snapshotOf({ id: 'tvmaze:tv:1', title: 'x', posterPath: '/tvm-evil.jpg', releaseDate: null, mediaType: 'tv' }).posterPath, null);
});

const status = (o: any) => ({ configured: true, availability: false, ...o });
test('attribution on Discover: only the sources whose data is in use', () => {
  const none = attributionForDiscover(null);
  assert.equal(hasAnyAttribution(none), false);
  assert.equal(hasAnyAttribution(attributionForDiscover(status({ configured: false, mode: 'none' }))), false);
  assert.deepEqual(attributionForDiscover(status({ mode: 'tmdb' })), { tmdb: true, tvmaze: false, availability: [] });
  assert.deepEqual(attributionForDiscover(status({ mode: 'tvmaze' })), { tmdb: false, tvmaze: true, availability: [] });
  assert.deepEqual(attributionForDiscover(status({ mode: 'tmdb', availabilityProviders: ['streamingavailability', 'watchmode', 'bogus'] })).availability, ['streamingavailability', 'watchmode']);
  // older server: no mode, no provider list: TMDB catalog, Watchmode only when availability is on
  assert.deepEqual(attributionForDiscover({ configured: true, availability: true }), { tmdb: true, tvmaze: false, availability: ['watchmode'] });
  assert.deepEqual(attributionForDiscover({ configured: true, availability: false }), { tmdb: true, tvmaze: false, availability: [] });
});

test('attribution on a title page: its own sources and the provider that answered', () => {
  assert.deepEqual(attributionForTitle({ source: 'tmdb' }, null), { tmdb: true, tvmaze: false, availability: [] });
  assert.deepEqual(attributionForTitle({ source: 'tmdb', sources: ['tmdb', 'tvmaze'] }, 'watchmode'), { tmdb: true, tvmaze: true, availability: ['watchmode'] });
  assert.deepEqual(attributionForTitle({ source: 'tvmaze', sources: ['tvmaze'] }, 'streamingavailability'), { tmdb: false, tvmaze: true, availability: ['streamingavailability'] });
  assert.deepEqual(attributionForTitle({ source: 'tvmaze' }, 'evil'), { tmdb: false, tvmaze: true, availability: [] });
  assert.equal(hasAnyAttribution(attributionForTitle(null, 'watchmode')), false);
  assert.equal(CREDIT_LINKS.tvmaze, 'https://www.tvmaze.com');
  assert.equal(CREDIT_LINKS.tvmazeLicence, 'https://creativecommons.org/licenses/by-sa/4.0/');
});

test('mode helpers: rows, hero slots, the owner note', () => {
  assert.equal(modeOf(null), 'none');
  assert.equal(modeOf({ configured: false }), 'none');
  assert.equal(modeOf({ configured: true }), 'tmdb');
  assert.equal(modeOf({ configured: true, mode: 'tvmaze' }), 'tvmaze');
  assert.deepEqual(discoverRows('tvmaze').map((r) => r.slug), ['airing-in-india', 'popular-tv']);
  assert.equal(discoverRows('tmdb').length, 12);
  assert.ok(discoverRows('tmdb').some((r) => r.slug === 'because-you-watched' && r.hideWhenEmpty));
  assert.ok(!discoverRows('tmdb').some((r) => r.slug === 'popular-tv'));
  assert.deepEqual(discoverRows('none'), []);
  assert.deepEqual(heroSlugs('tvmaze'), { global: ['popular-tv'], regional: ['airing-in-india'] });
  assert.equal(heroSlugs('tmdb').global[0], 'trending');
  assert.equal(TVMAZE_MODE_NOTE, 'Movies need a TMDB API key. TV shows are powered by TVmaze.');
});

const base: CatalogTitle = { id: 'tvmaze:tv:1', source: 'tvmaze', sourceId: '1', mediaType: 'tv', title: 'S', overview: '', posterPath: '/tvm-p-1-2.jpg', backdropPath: null, releaseDate: null, genres: [], runtimeMinutes: null, rating: null, ratingSource: 'TVmaze', voteCount: 0, providers: [], region: 'IN', externalUrl: null };
test('hero works from TV rows: TVmaze shows use their poster as artwork, TMDB titles still need a backdrop', () => {
  assert.equal(heroArt(base), '/tvm-p-1-2.jpg');
  assert.equal(isHeroUsable(base), true);
  assert.equal(isHeroUsable({ ...base, posterPath: null }), false);
  assert.equal(isHeroUsable({ ...base, source: 'tmdb', id: 'tmdb:tv:1' }), false);
  assert.equal(heroArt({ ...base, backdropPath: '/tvm-b-1-2.jpg' }), '/tvm-b-1-2.jpg');
});

test('offers: add-on channels get their own group after free and before rent', () => {
  const o = (type: any, id: string) => ({ id, name: id, type, logoUrl: null, destinationUrl: null, verified: true });
  assert.deepEqual(groupOffers([o('buy', 'a'), o('addon', 'b'), o('subscription', 'c'), o('rent', 'd'), o('free', 'e')]).map((g) => g.type), ['subscription', 'free', 'addon', 'rent', 'buy']);
});
