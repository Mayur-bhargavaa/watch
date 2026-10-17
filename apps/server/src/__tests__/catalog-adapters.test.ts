import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidImagePath, tmdbImageUrl, tmdbSrcSet, safeProviderUrl, normalizeRegion, parseTitleKey, makeTitleKey, providerKey, capabilitiesForProvider, snapshotOf } from '@synccinema/common';
import { normalizeTmdbTitle, normalizeTmdbPage } from '../services/catalog/adapters/tmdb.js';
import { normalizeOffers, normalizeSources } from '../services/catalog/adapters/watchmode.js';
import { normalizeTrailerId } from '../services/catalog/adapters/youtube.js';
import { tmdbMovieDetails, tmdbTvDetails, tmdbSparse, wmSources, wmOffers, page, listMovie } from './catalogFixtures.js';

test('TMDB movie details normalise: id, rating, cast limit, director', () => {
  const t = normalizeTmdbTitle(tmdbMovieDetails, 'movie', 'IN')!;
  assert.equal(t.id, 'tmdb:movie:603');
  assert.equal(t.source, 'tmdb');
  assert.equal(t.sourceId, '603');
  assert.equal(t.rating, 8.2);
  assert.equal(t.ratingSource, 'TMDB');
  assert.equal(t.runtimeMinutes, 136);
  assert.equal(t.cast!.length, 8);
  assert.equal(t.crew![0].name, 'Lana Director');
  assert.equal(t.externalUrl, 'https://www.themoviedb.org/movie/603');
  assert.equal(t.region, 'IN');
  assert.deepEqual(t.providers, []);
});

test('TMDB tv details: seasons, episodes, creators, episode runtime, null backdrop', () => {
  const t = normalizeTmdbTitle(tmdbTvDetails, 'tv', 'US')!;
  assert.equal(t.mediaType, 'tv');
  assert.equal(t.title, 'Short Series Fixture');
  assert.equal(t.seasons, 1);
  assert.equal(t.episodes, 6);
  assert.equal(t.runtimeMinutes, 48);
  assert.equal(t.backdropPath, null);
  assert.equal(t.releaseDate, '2019-05-01');
});

test('missing fields, null runtime and invalid image paths become null, never guessed', () => {
  const t = normalizeTmdbTitle(tmdbSparse, 'movie', 'IN')!;
  assert.equal(t.posterPath, null);
  assert.equal(t.backdropPath, null);
  assert.equal(t.releaseDate, null);
  assert.equal(t.runtimeMinutes, null);
  assert.equal(t.rating, null);
  assert.deepEqual(t.genres, [{ id: 35, name: 'Comedy' }]);
  assert.equal(t.overview, '');
});

test('unusable payloads are dropped', () => {
  assert.equal(normalizeTmdbTitle(null, 'movie', 'IN'), null);
  assert.equal(normalizeTmdbTitle({ id: 1, media_type: 'person', name: 'X' }, null, 'IN'), null);
  assert.equal(normalizeTmdbTitle({ id: -4, title: 'x' }, 'movie', 'IN'), null);
  assert.equal(normalizeTmdbTitle({ id: 4, title: '   ' }, 'movie', 'IN'), null);
  const p = normalizeTmdbPage(page([listMovie(1), { id: 2, media_type: 'person', name: 'P' }, 'junk']), null, 'IN');
  assert.equal(p.results.length, 1);
  assert.equal(normalizeTmdbPage({}, null, 'IN').results.length, 0);
});

test('image helpers only build URLs from the fixed base and a validated path', () => {
  assert.ok(isValidImagePath('/abc.jpg'));
  for (const bad of ['abc.jpg', '/a/b.jpg', 'https://x/y.jpg', '/a.gif', '/../a.jpg', '/a b.jpg', null, 5]) assert.equal(isValidImagePath(bad as any), false);
  assert.equal(tmdbImageUrl('/abc.jpg', 'w500'), 'https://image.tmdb.org/t/p/w500/abc.jpg');
  assert.equal(tmdbImageUrl('/x.gif', 'w500'), null);
  assert.equal(tmdbImageUrl('/abc.jpg', 'w999' as any), null);
  assert.match(tmdbSrcSet('/abc.jpg', ['w185', 'w342'])!, /w185\/abc.jpg 185w, .*w342\/abc.jpg 342w/);
  assert.equal(tmdbSrcSet(null, ['w185']), undefined);
});

test('safeProviderUrl accepts only https with a real host', () => {
  assert.equal(safeProviderUrl('https://www.netflix.com/title/1'), 'https://www.netflix.com/title/1');
  for (const bad of ['http://a.com/x', 'javascript:alert(1)', 'data:text/html,x', 'https://user:pw@a.com/', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://intranet/x', 'https://a.local/x', '', 'not a url', 'https://' + 'a'.repeat(3000) + '.com'])
    assert.equal(safeProviderUrl(bad), null, bad);
  assert.equal(safeProviderUrl(42), null);
});

test('title keys and regions', () => {
  assert.equal(makeTitleKey('tmdb', 'tv', 5), 'tmdb:tv:5');
  assert.deepEqual(parseTitleKey('tmdb:movie:603'), { source: 'tmdb', mediaType: 'movie', sourceId: '603' });
  for (const bad of ['tmdb:movie:', 'imdb:movie:1', 'tmdb:book:1', 'tmdb:movie:1;drop', 'x'.repeat(60), 7]) assert.equal(parseTitleKey(bad as any), null);
  assert.equal(normalizeRegion('in'), 'IN');
  assert.equal(normalizeRegion('ZZ'), 'IN');
  assert.equal(normalizeRegion('  us '), 'US');
  assert.equal(normalizeRegion(undefined, 'GB'), 'GB');
});

test('Watchmode offers: region specific, https links only, duplicates collapse, unknown types dropped', () => {
  const sources = normalizeSources(wmSources);
  assert.equal(sources.get(140)!.logoUrl, null); // javascript: logo rejected
  assert.equal(sources.get(203)!.logoUrl, 'https://cdn.watchmode.com/provider_logos/netflix_100px.png');
  const inOffers = normalizeOffers(wmOffers, 'IN', sources);
  assert.deepEqual(inOffers.map((o) => `${o.name}:${o.type}`), ['Disney+ Hotstar:subscription', 'Netflix:subscription', 'YouTube:rent']);
  const netflix = inOffers.find((o) => o.name === 'Netflix')!;
  assert.equal(netflix.destinationUrl, 'https://www.netflix.com/title/20557937');
  assert.equal(netflix.verified, true);
  assert.equal(inOffers.find((o) => o.name === 'Disney+ Hotstar')!.destinationUrl, null); // javascript: link rejected
  assert.equal(inOffers.find((o) => o.name === 'YouTube')!.destinationUrl, null); // http link rejected
  const us = normalizeOffers(wmOffers, 'US', sources);
  assert.deepEqual(us.map((o) => o.name), ['Prime Video']);
  assert.deepEqual(normalizeOffers(null, 'IN', sources), []);
  assert.deepEqual(normalizeOffers([{ source_id: 'x' }, null], 'IN', sources), []);
});

test('provider keys and capabilities: external services are never playable in the room', () => {
  assert.equal(providerKey('Netflix'), 'netflix');
  assert.equal(providerKey('Amazon Prime Video'), 'prime');
  assert.equal(providerKey('Disney+ Hotstar'), 'jiohotstar');
  assert.equal(providerKey('JioHotstar'), 'jiohotstar');
  assert.deepEqual(capabilitiesForProvider('Netflix'), { playback: 'none', roomSync: 'coordinated_start' });
  assert.deepEqual(capabilitiesForProvider('JioHotstar'), { playback: 'none', roomSync: 'coordinated_start' });
  assert.deepEqual(capabilitiesForProvider('YouTube'), { playback: 'embedded', roomSync: 'full' });
});

test('YouTube trailer id extraction rejects odd ids; snapshotOf', () => {
  assert.equal(normalizeTrailerId({ items: [{ id: { videoId: 'dQw4w9WgXcQ' } }] }), 'dQw4w9WgXcQ');
  assert.equal(normalizeTrailerId({ items: [{ id: { videoId: '<script>' } }] }), null);
  assert.equal(normalizeTrailerId({}), null);
  const t = normalizeTmdbTitle(tmdbMovieDetails, 'movie', 'IN')!;
  assert.deepEqual(snapshotOf(t), { titleKey: 'tmdb:movie:603', title: 'The Matrix Fixture', posterPath: '/abc123.jpg', year: 1999, mediaType: 'movie' });
});
