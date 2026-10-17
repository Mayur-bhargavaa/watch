/** Recorded-shape fixtures for the TMDB / Watchmode payloads. Tests only: production code never imports this. */
import type { FetchLike } from '../services/catalog/upstream.js';

export const tmdbMovieDetails = {
  id: 603,
  title: 'The Matrix Fixture',
  overview: 'A hacker learns the truth about his reality.',
  poster_path: '/abc123.jpg',
  backdrop_path: '/back456.jpg',
  release_date: '1999-03-30',
  runtime: 136,
  vote_average: 8.2349,
  vote_count: 25000,
  popularity: 92.5,
  tagline: 'Welcome to the real world.',
  genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
  credits: {
    cast: Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Actor ${i}`, character: `Role ${i}`, profile_path: i === 0 ? '/face.jpg' : null })),
    crew: [{ id: 7, name: 'Lana Director', job: 'Director', profile_path: null }, { id: 8, name: 'Someone', job: 'Editor' }]
  }
};
export const tmdbTvDetails = {
  id: 1396,
  name: 'Short Series Fixture',
  overview: 'Six episodes.',
  poster_path: '/tvposter.jpg',
  backdrop_path: null,
  first_air_date: '2019-05-01',
  episode_run_time: [48],
  number_of_seasons: 1,
  number_of_episodes: 6,
  vote_average: 8.4,
  vote_count: 900,
  popularity: 30,
  genres: [{ id: 18, name: 'Drama' }],
  created_by: [{ id: 55, name: 'Creator One', profile_path: '/cr.png' }]
};
export const tmdbSparse = {
  id: 77,
  title: 'Sparse Title',
  poster_path: 'https://evil.example/x.jpg', // invalid image path
  backdrop_path: '/../etc/passwd',
  release_date: 'soon',
  runtime: null,
  vote_average: 0,
  vote_count: 0,
  genre_ids: [35, 99999]
};

export const wmSources = [
  { id: 203, name: 'Netflix', type: 'sub', logo_100px: 'https://cdn.watchmode.com/provider_logos/netflix_100px.png' },
  { id: 372, name: 'Disney+ Hotstar', type: 'sub', logo_100px: 'https://cdn.watchmode.com/provider_logos/hotstar_100px.png' },
  { id: 140, name: 'YouTube', type: 'free', logo_100px: 'javascript:alert(1)' }
];
export const wmOffers = [
  { source_id: 203, name: 'Netflix', type: 'sub', region: 'IN', web_url: 'https://www.netflix.com/title/20557937', format: 'HD' },
  { source_id: 203, name: 'Netflix', type: 'sub', region: 'IN', web_url: 'https://www.netflix.com/title/20557937', format: '4K' },
  { source_id: 372, name: 'Disney+ Hotstar', type: 'sub', region: 'IN', web_url: 'javascript:alert(1)' },
  { source_id: 140, name: 'YouTube', type: 'rent', region: 'IN', web_url: 'http://insecure.example.com/x', price: 3.5 },
  { source_id: 24, name: 'Prime Video', type: 'sub', region: 'US', web_url: 'https://www.primevideo.com/detail/x' },
  { source_id: 7, name: 'Mystery', type: 'weird', region: 'IN', web_url: 'https://example.com/x' }
];

export interface FakeFetch {
  fn: FetchLike;
  calls: string[];
  /** change what a route answers */
  set(match: string, body: unknown, status?: number): void;
}
/** A fake fetch: the first route whose substring matches the URL answers. Never touches the network. */
export function fakeFetch(routes: Array<[string, unknown, number?]> = []): FakeFetch {
  const table = [...routes];
  const calls: string[] = [];
  const fn: FetchLike = async (url) => {
    calls.push(url);
    const hit = table.find(([m]) => url.includes(m));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    const status = hit[2] ?? 200;
    return { ok: status < 400, status, headers: { get: () => null }, json: async () => hit[1] };
  };
  return { fn, calls, set: (match, body, status) => { table.unshift([match, body, status]); } };
}

export const page = (results: any[], extra: Record<string, unknown> = {}) => ({ page: 1, results, total_pages: 3, total_results: results.length * 3, ...extra });
export const listMovie = (id: number, o: Record<string, unknown> = {}) => ({ id, title: `Movie ${id}`, overview: 'o', poster_path: `/p${id}.jpg`, backdrop_path: `/b${id}.jpg`, release_date: '2020-01-01', vote_average: 7.5, vote_count: 1200, popularity: 40, genre_ids: [35], media_type: 'movie', ...o });
export const listTv = (id: number, o: Record<string, unknown> = {}) => ({ id, name: `Show ${id}`, overview: 'o', poster_path: `/t${id}.jpg`, backdrop_path: `/tb${id}.jpg`, first_air_date: '2021-02-02', vote_average: 8.1, vote_count: 800, popularity: 20, genre_ids: [18], media_type: 'tv', ...o });
