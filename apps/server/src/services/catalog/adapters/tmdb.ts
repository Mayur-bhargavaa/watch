import { isValidImagePath, makeTitleKey, type CatalogGenre, type CatalogMediaType, type CatalogPage, type CatalogTitle, type Person } from '@synccinema/common';
import { UpstreamClient } from '../upstream.js';

/** TMDB adapter: catalog METADATA only (titles, artwork, genres, recommendations, trending, discover). No availability here. */

export interface TmdbConfig {
  readToken?: string;
  apiKey?: string;
}

/** TMDB genre ids are stable; used to name `genre_ids` on list results without an extra call. */
export const TMDB_GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

export interface DiscoverOpts {
  page?: number;
  /** all of these genres (AND) */
  genres?: number[];
  /** any of these genres (OR) */
  anyGenres?: number[];
  withoutGenres?: number[];
  yearFrom?: number | null;
  yearTo?: number | null;
  sort?: 'popularity' | 'rating' | 'release';
  minVotes?: number;
  maxVotes?: number;
  minRating?: number;
  maxRuntime?: number;
  minRuntime?: number;
  keywords?: number[];
  /** ISO 639-1 original language (TMDB `with_original_language` takes exactly ONE code). Allow-listed: see ORIGINAL_LANGUAGES. */
  language?: string;
  /** ISO 3166-1 origin country (`with_origin_country`). Allow-listed: see ORIGIN_COUNTRIES. */
  originCountry?: string;
  /** first / primary release date window, YYYY-MM-DD (movies: primary_release_date.*, TV: first_air_date.*). Overrides yearFrom / yearTo. */
  releaseFrom?: string;
  releaseTo?: string;
  /** movie-only `region` filter for release dates (ISO 3166-1, allow-listed: see RELEASE_REGIONS) */
  releaseRegion?: string;
}

/** Strict allow-lists for the Indian collections: anything else is refused before a request is built. */
export const ORIGINAL_LANGUAGES: readonly string[] = ['hi', 'ta', 'te', 'ml', 'kn'];
export const ORIGIN_COUNTRIES: readonly string[] = ['IN'];
export const RELEASE_REGIONS: readonly string[] = ['IN'];

const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function person(raw: any, role: string | null): Person | null {
  if (!raw || typeof raw.id !== 'number' || typeof raw.name !== 'string') return null;
  return { id: raw.id, name: raw.name.slice(0, 120), role: role ? role.slice(0, 120) : null, profilePath: isValidImagePath(raw.profile_path) ? raw.profile_path : null };
}

/**
 * Normalise a TMDB list item or details payload into CatalogTitle. Missing / malformed fields become null or
 * empty values (never guessed). Returns null when the payload is not a movie/tv with a usable id and title.
 */
export function normalizeTmdbTitle(raw: any, mediaTypeHint: CatalogMediaType | null, region: string): CatalogTitle | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'number' || !Number.isInteger(raw.id) || raw.id <= 0) return null;
  const mt = raw.media_type === 'movie' || raw.media_type === 'tv' ? raw.media_type : mediaTypeHint;
  if (mt !== 'movie' && mt !== 'tv') return null;
  const title = str(mt === 'movie' ? raw.title ?? raw.name : raw.name ?? raw.title, 300).trim();
  if (!title) return null;
  const date = str(mt === 'movie' ? raw.release_date : raw.first_air_date, 10);
  const genres: Array<{ id: number; name: string }> = Array.isArray(raw.genres)
    ? raw.genres.filter((g: any) => g && typeof g.id === 'number' && typeof g.name === 'string').map((g: any) => ({ id: g.id, name: g.name }))
    : Array.isArray(raw.genre_ids)
      ? raw.genre_ids.filter((id: unknown) => typeof id === 'number' && TMDB_GENRE_NAMES[id as number]).map((id: number) => ({ id, name: TMDB_GENRE_NAMES[id] }))
      : [];
  const voteCount = typeof raw.vote_count === 'number' && raw.vote_count >= 0 ? Math.floor(raw.vote_count) : 0;
  const avg = num(raw.vote_average);
  let runtime: number | null = null;
  if (mt === 'movie') runtime = num(raw.runtime) && raw.runtime > 0 ? Math.round(raw.runtime) : null;
  else {
    const ert = Array.isArray(raw.episode_run_time) ? raw.episode_run_time.find((x: unknown) => typeof x === 'number' && x > 0) : null;
    const last = num(raw.last_episode_to_air?.runtime);
    runtime = ert ? Math.round(ert) : last && last > 0 ? Math.round(last) : null;
  }
  const out: CatalogTitle = {
    id: makeTitleKey('tmdb', mt, raw.id),
    source: 'tmdb',
    sourceId: String(raw.id),
    mediaType: mt,
    title,
    overview: str(raw.overview, 2000),
    posterPath: isValidImagePath(raw.poster_path) ? raw.poster_path : null,
    backdropPath: isValidImagePath(raw.backdrop_path) ? raw.backdrop_path : null,
    releaseDate: DATE_RE.test(date) ? date : null,
    genres,
    genreIds: genres.map((g) => g.id),
    runtimeMinutes: runtime,
    rating: avg !== null && voteCount > 0 ? Math.round(avg * 10) / 10 : null,
    ratingSource: 'TMDB',
    voteCount,
    popularity: num(raw.popularity),
    providers: [],
    region,
    externalUrl: `https://www.themoviedb.org/${mt}/${raw.id}`
  };
  if (mt === 'tv') {
    out.seasons = num(raw.number_of_seasons);
    out.episodes = num(raw.number_of_episodes);
  }
  if (typeof raw.tagline === 'string' && raw.tagline) out.tagline = raw.tagline.slice(0, 300);
  if (raw.credits && typeof raw.credits === 'object') {
    const cast = Array.isArray(raw.credits.cast) ? raw.credits.cast : [];
    out.cast = cast.slice(0, 8).map((c: any) => person(c, str(c?.character, 120) || null)).filter(Boolean) as Person[];
    const crew = Array.isArray(raw.credits.crew) ? raw.credits.crew : [];
    const directors = crew.filter((c: any) => c?.job === 'Director').map((c: any) => person(c, 'Director'));
    const creators = Array.isArray(raw.created_by) ? raw.created_by.map((c: any) => person(c, 'Creator')) : [];
    out.crew = [...directors, ...creators].filter(Boolean).slice(0, 4) as Person[];
  }
  return out;
}

export function normalizeTmdbPage(raw: any, hint: CatalogMediaType | null, region: string): CatalogPage {
  const results = Array.isArray(raw?.results) ? (raw.results.map((r: any) => normalizeTmdbTitle(r, hint, region)).filter(Boolean) as CatalogTitle[]) : [];
  const page = Number.isInteger(raw?.page) && raw.page > 0 ? raw.page : 1;
  const totalPages = Math.min(Number.isInteger(raw?.total_pages) && raw.total_pages > 0 ? raw.total_pages : 1, 500);
  return { results, page, totalPages, totalResults: Number.isInteger(raw?.total_results) ? raw.total_results : results.length };
}

export class TmdbAdapter {
  constructor(private cfg: TmdbConfig, private http: UpstreamClient) {}
  get configured(): boolean {
    return Boolean(this.cfg.readToken || this.cfg.apiKey);
  }

  private async call<T = any>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
    q.set('language', 'en-US');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.cfg.readToken) headers.Authorization = `Bearer ${this.cfg.readToken}`;
    else if (this.cfg.apiKey) q.set('api_key', this.cfg.apiKey);
    return this.http.getJson<T>(`https://api.themoviedb.org/3${path}?${q.toString()}`, headers);
  }

  async search(query: string, type: 'all' | CatalogMediaType, page: number, year: number | null, region: string): Promise<CatalogPage> {
    if (type === 'all') return normalizeTmdbPage(await this.call('/search/multi', { query, page, include_adult: 'false' }), null, region);
    const yearParam = year ? (type === 'movie' ? { year } : { first_air_date_year: year }) : {};
    return normalizeTmdbPage(await this.call(`/search/${type}`, { query, page, include_adult: 'false', ...yearParam }), type, region);
  }

  async trending(type: 'all' | CatalogMediaType, region: string, page = 1): Promise<CatalogPage> {
    return normalizeTmdbPage(await this.call(`/trending/${type}/week`, { page }), type === 'all' ? null : type, region);
  }

  async discover(mediaType: CatalogMediaType, o: DiscoverOpts, region: string): Promise<CatalogPage> {
    const sortBase = o.sort === 'rating' ? 'vote_average' : o.sort === 'release' ? (mediaType === 'movie' ? 'primary_release_date' : 'first_air_date') : 'popularity';
    const dateKey = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
    if (o.language !== undefined && !ORIGINAL_LANGUAGES.includes(o.language)) throw new Error('Unsupported discover language');
    if (o.originCountry !== undefined && !ORIGIN_COUNTRIES.includes(o.originCountry)) throw new Error('Unsupported discover origin country');
    if (o.releaseRegion !== undefined && !RELEASE_REGIONS.includes(o.releaseRegion)) throw new Error('Unsupported discover region');
    for (const d of [o.releaseFrom, o.releaseTo]) if (d !== undefined && !DATE_RE.test(d)) throw new Error('Unsupported discover date');
    const params: Record<string, string | number | undefined> = {
      page: o.page ?? 1,
      include_adult: 'false',
      sort_by: `${sortBase}.desc`,
      with_genres: o.anyGenres?.length ? o.anyGenres.join('|') : o.genres?.length ? o.genres.join(',') : undefined,
      without_genres: o.withoutGenres?.length ? o.withoutGenres.join(',') : undefined,
      with_keywords: o.keywords?.length ? o.keywords.join('|') : undefined,
      [`${dateKey}.gte`]: o.releaseFrom ?? (o.yearFrom ? `${o.yearFrom}-01-01` : undefined),
      [`${dateKey}.lte`]: o.releaseTo ?? (o.yearTo ? `${o.yearTo}-12-31` : undefined),
      'vote_count.gte': o.minVotes,
      'vote_count.lte': o.maxVotes,
      'vote_average.gte': o.minRating,
      'with_runtime.lte': mediaType === 'movie' ? o.maxRuntime : undefined,
      'with_runtime.gte': mediaType === 'movie' ? o.minRuntime : undefined,
      with_original_language: o.language,
      with_origin_country: o.originCountry,
      region: mediaType === 'movie' ? o.releaseRegion : undefined
    };
    // rating sorts are meaningless on 3-vote titles
    if (o.sort === 'rating' && params['vote_count.gte'] === undefined) params['vote_count.gte'] = 200;
    return normalizeTmdbPage(await this.call(`/discover/${mediaType}`, params), mediaType, region);
  }

  async details(mediaType: CatalogMediaType, id: string, region: string): Promise<CatalogTitle | null> {
    const raw = await this.call(`/${mediaType}/${encodeURIComponent(id)}`, { append_to_response: 'credits' }).catch((e) => {
      if ((e as any)?.status === 404) return null;
      throw e;
    });
    return raw ? normalizeTmdbTitle(raw, mediaType, region) : null;
  }

  async recommendations(mediaType: CatalogMediaType, id: string, region: string, page = 1): Promise<CatalogPage> {
    const raw = await this.call(`/${mediaType}/${encodeURIComponent(id)}/recommendations`, { page }).catch((e) => {
      if ((e as any)?.status === 404) return null;
      throw e;
    });
    return normalizeTmdbPage(raw, mediaType, region);
  }

  async genres(): Promise<CatalogGenre[]> {
    const [m, t] = await Promise.all([this.call('/genre/movie/list'), this.call('/genre/tv/list')]);
    const seen = new Map<number, string>();
    for (const g of [...(m?.genres ?? []), ...(t?.genres ?? [])]) if (g && typeof g.id === 'number' && typeof g.name === 'string') seen.set(g.id, g.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** TMDB external ids (used to double-check the Watchmode id mapping). */
  async imdbId(mediaType: CatalogMediaType, id: string): Promise<string | null> {
    const raw = await this.call(`/${mediaType}/${encodeURIComponent(id)}/external_ids`).catch(() => null);
    return typeof raw?.imdb_id === 'string' && /^tt\d{5,10}$/.test(raw.imdb_id) ? raw.imdb_id : null;
  }
}
