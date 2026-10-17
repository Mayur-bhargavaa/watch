import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateTitles, type CatalogTitle } from '@synccinema/common';
import { getFreeMovies } from '../services/catalog/freeMovies.js';

test('deduplicateTitles: filters out duplicate movies by id, normalized title, and title + rating', () => {
  const dummy: CatalogTitle[] = [
    {
      id: 'tmdb:movie:4808',
      source: 'tmdb',
      sourceId: '4808',
      mediaType: 'movie',
      title: 'Charade',
      overview: 'Classic film.',
      posterPath: '/charade.jpg',
      backdropPath: null,
      releaseDate: '1963-12-01',
      genres: [],
      runtimeMinutes: 113,
      rating: 7.7,
      ratingSource: 'TMDB',
      voteCount: 1600,
      providers: [],
      region: 'US',
      externalUrl: null,
      freeStreamUrl: 'https://www.youtube.com/watch?v=tyd3bTeq_y0'
    },
    // Duplicate by ID
    {
      id: 'tmdb:movie:4808',
      source: 'tmdb',
      sourceId: '4808',
      mediaType: 'movie',
      title: 'Charade (Remastered)',
      overview: 'Another copy.',
      posterPath: '/charade2.jpg',
      backdropPath: null,
      releaseDate: '1963-12-01',
      genres: [],
      runtimeMinutes: 113,
      rating: 7.7,
      ratingSource: 'TMDB',
      voteCount: 1600,
      providers: [],
      region: 'US',
      externalUrl: null
    },
    // Duplicate by title (different casing / punctuation)
    {
      id: 'tmdb:movie:999999',
      source: 'tmdb',
      sourceId: '999999',
      mediaType: 'movie',
      title: 'charade!',
      overview: 'Duplicate name.',
      posterPath: '/charade3.jpg',
      backdropPath: null,
      releaseDate: '1963-12-01',
      genres: [],
      runtimeMinutes: 113,
      rating: 7.7,
      ratingSource: 'TMDB',
      voteCount: 1600,
      providers: [],
      region: 'US',
      externalUrl: null
    },
    // Distinct movie
    {
      id: 'tmdb:movie:10331',
      source: 'tmdb',
      sourceId: '10331',
      mediaType: 'movie',
      title: 'Night of the Living Dead',
      overview: 'Zombies in farmhouse.',
      posterPath: '/notld.jpg',
      backdropPath: null,
      releaseDate: '1968-10-04',
      genres: [],
      runtimeMinutes: 96,
      rating: 7.6,
      ratingSource: 'TMDB',
      voteCount: 2800,
      providers: [],
      region: 'US',
      externalUrl: null,
      freeStreamUrl: 'https://www.youtube.com/watch?v=6mowU_m5p2M'
    }
  ];

  const deduped = deduplicateTitles(dummy);
  assert.equal(deduped.length, 2, 'Only 2 unique movies should remain');
  assert.equal(deduped[0].title, 'Charade');
  assert.equal(deduped[1].title, 'Night of the Living Dead');
});

test('getFreeMovies: returns verified free movies with TMDB metadata and freeStreamUrl', async () => {
  const list = await getFreeMovies();
  assert.ok(list.length >= 15, `Expected at least 15 free movies, got ${list.length}`);

  for (const movie of list) {
    assert.ok(movie.id.startsWith('tmdb:movie:'), `Invalid movie id: ${movie.id}`);
    assert.ok(movie.title.length > 0, 'Movie title is empty');
    assert.ok(typeof movie.rating === 'number' && movie.rating > 0, `Movie rating missing: ${movie.title}`);
    assert.ok(movie.freeStreamUrl && (movie.freeStreamUrl.startsWith('https://') || movie.freeStreamUrl.startsWith('http://')), `Missing stream URL: ${movie.title}`);
    assert.ok(movie.providers.some((p) => p.type === 'free' && p.destinationUrl === movie.freeStreamUrl), `Missing verified free provider offer: ${movie.title}`);
  }

  // Verify deduplication: no two movies have the same title or ID
  const ids = new Set(list.map((m) => m.id));
  const titles = new Set(list.map((m) => m.title.toLowerCase().replace(/[^a-z0-9]/g, '')));
  assert.equal(ids.size, list.length, 'Duplicate IDs detected in free movies list');
  assert.equal(titles.size, list.length, 'Duplicate movie titles detected in free movies list');
});
