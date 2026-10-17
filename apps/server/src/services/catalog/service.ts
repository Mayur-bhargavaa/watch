import {
  providerKey,
  parseTitleKey,
  makeTitleKey,
  normalizeRegion,
  DEFAULT_CATALOG_REGION,
  type CatalogGenre,
  type CatalogMediaType,
  type CatalogPage,
  type CatalogSort,
  type CatalogTitle,
  type CatalogTypeFilter,
  type AvailabilityProviderName,
  type CatalogMode,
  type CatalogSource,
  type MatchmakerRequest,
  type MatchmakerResponse,
  type ProviderOffer,
  EMBEDDED_PROVIDER_CAPABILITIES
} from '@synccinema/common';
import { TtlCache } from './cache.js';
import { UpstreamClient, type FetchLike } from './upstream.js';
import { TmdbAdapter, TMDB_GENRE_NAMES, type DiscoverOpts } from './adapters/tmdb.js';
import { WatchmodeAdapter, type SourceInfo } from './adapters/watchmode.js';
import { YoutubeAdapter } from './adapters/youtube.js';
import {
  TvmazeAdapter,
  TvmazeLimiter,
  limitedFetch,
  sortByRatingThenWeight,
  sortByWeight,
  tvmazeGenreList,
  type TvmazeLimiterOptions
} from './adapters/tvmaze.js';
import { StreamingAvailabilityAdapter, type AvailabilityRef } from './adapters/streamingAvailability.js';
import { MemoryQuotaStore, QuotaGuard, UserLookupGuard, parseMonthlyLimit, type QuotaStore } from './availabilityGuard.js';
import { COLLECTIONS, addDaysUtc, findCollection, type CollectionDef } from './collections.js';
import { moodSeedGenres, rankCandidates, timeLimitMinutes } from './matchmaker.js';
import { getFreeMovies } from './freeMovies.js';
import freeMoviesData from './freeMoviesData.json' with { type: 'json' };

export const CATALOG_NOT_CONFIGURED = { error: 'Catalog is not configured', code: 'CATALOG_NOT_CONFIGURED' } as const;

export class CatalogNotConfiguredError extends Error {
  constructor() {
    super('Catalog is not configured');
    this.name = 'CatalogNotConfiguredError';
  }
}
/** TVmaze mode (no TMDB key): everything that needs movie data answers this. */
export const MOVIES_NEED_TMDB = { error: 'Movies need a TMDB key; TV works without one', code: 'CATALOG_MOVIES_NEED_TMDB' } as const;
export class MoviesNeedTmdbError extends Error {
  constructor() {
    super(MOVIES_NEED_TMDB.error);
    this.name = 'MoviesNeedTmdbError';
  }
}

export interface CatalogEnv {
  TMDB_READ_TOKEN?: string;
  TMDB_API_KEY?: string;
  WATCHMODE_API_KEY?: string;
  YOUTUBE_API_KEY?: string;
  CATALOG_DEFAULT_REGION?: string;
  CATALOG_CACHE_MAX_ENTRIES?: string;
  STREAMING_AVAILABILITY_API_KEY?: string;
  STREAMING_AVAILABILITY_MONTHLY_LIMIT?: string;
  /** comma list, default `streamingavailability,watchmode` */
  AVAILABILITY_PROVIDER_ORDER?: string;
  /** `0` / `false` / `off` disables TVmaze (default on) */
  TVMAZE_ENABLED?: string;
  TVMAZE_USER_AGENT?: string;
}
export interface CatalogDeps {
  fetchFn?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  backoffBaseMs?: number;
  /** persistent monthly counter for the Streaming Availability quota guard (default: in memory) */
  quotaStore?: QuotaStore;
  tvmazeLimiter?: TvmazeLimiterOptions;
  /** how long a TMDB TV title page waits for the TVmaze enrichment before answering without it (default 2500 ms) */
  enrichDeadlineMs?: number;
}

/** Cache lifetimes (ms). search 60 s, trending 15 min, details 6 h, providers 30 min, genres 24 h. */
export const TTL = {
  search: { ttlMs: 60_000, staleMs: 120_000 },
  trending: { ttlMs: 15 * 60_000, staleMs: 30 * 60_000 },
  details: { ttlMs: 6 * 3600_000, staleMs: 6 * 3600_000 },
  providers: { ttlMs: 30 * 60_000, staleMs: 30 * 60_000 },
  genres: { ttlMs: 24 * 3600_000, staleMs: 24 * 3600_000 },
  mapping: { ttlMs: 7 * 24 * 3600_000, staleMs: 0 },
  collection: { ttlMs: 10 * 60_000, staleMs: 20 * 60_000 },
  // TVmaze (CC BY-SA, no quota, but polite): show 6 h, episodes 3 h, schedule 30 min, search 5 min, id lookup 7 days
  // and a 404 is remembered for 24 h so unknown ids are not asked again
  tvShow: { ttlMs: 6 * 3600_000, staleMs: 0, nullTtlMs: 24 * 3600_000 },
  tvEpisodes: { ttlMs: 3 * 3600_000, staleMs: 0, nullTtlMs: 24 * 3600_000 },
  tvSchedule: { ttlMs: 30 * 60_000, staleMs: 30 * 60_000 },
  tvSearch: { ttlMs: 5 * 60_000, staleMs: 0 },
  tvLookup: { ttlMs: 7 * 24 * 3600_000, staleMs: 0, nullTtlMs: 24 * 3600_000 },
  // Streaming Availability (1,000 requests a month): fresh 24 h, served stale up to 7 days when the API is down or the
  // quota is stopped, never refreshed in the background
  saAvailability: { ttlMs: 24 * 3600_000, staleMs: 0, maxServeStaleMs: 7 * 24 * 3600_000 }
} as const;
const SA_STALE_MS = 7 * 24 * 3600_000;

export interface SearchParams {
  q?: string;
  type: CatalogTypeFilter;
  genre?: number;
  yearFrom?: number | null;
  yearTo?: number | null;
  sort: CatalogSort;
  provider?: string;
  region: string;
  page: number;
}
export interface SearchResult extends CatalogPage {
  availabilityEnabled: boolean;
  providerFilterApplied: boolean;
}
export interface CollectionResult {
  slug: string;
  title: string;
  eyebrow: string;
  howWePick: string;
  items: CatalogTitle[];
  available: boolean;
  note?: string;
  availabilityEnabled: boolean;
}

function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)).then(() => out);
}

const dateNum = (t: CatalogTitle) => (t.releaseDate ? Date.parse(t.releaseDate) || 0 : 0);
function sortTitles(list: CatalogTitle[], sort: CatalogSort): CatalogTitle[] {
  if (sort === 'rating') return [...list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if (sort === 'release') return [...list].sort((a, b) => dateNum(b) - dateNum(a));
  return [...list].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}
function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const KNOWN_AVAILABILITY: readonly AvailabilityProviderName[] = ['streamingavailability', 'watchmode'];
/** AVAILABILITY_PROVIDER_ORDER: unknown names are ignored, duplicates dropped, empty means the default. */
export function parseProviderOrder(v: unknown): AvailabilityProviderName[] {
  const out: AvailabilityProviderName[] = [];
  if (typeof v === 'string') {
    for (const part of v.split(',')) {
      const n = part.trim().toLowerCase() as AvailabilityProviderName;
      if (KNOWN_AVAILABILITY.includes(n) && !out.includes(n)) out.push(n);
    }
  }
  return out.length ? out : [...KNOWN_AVAILABILITY];
}
const flagOff = (v: unknown) => typeof v === 'string' && /^(0|false|off|no)$/i.test(v.trim());
/** The 24 h TVmaze/IST day used by the India schedule: "today" in Asia/Kolkata (UTC+5:30). */
const istDay = (now: number): string => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

type AvRef = { kind: 'tmdb'; mediaType: CatalogMediaType; id: string } | { kind: 'imdb'; id: string };
const avKey = (r: AvRef) => (r.kind === 'tmdb' ? `tmdb:${r.mediaType}:${r.id}` : `imdb:${r.id}`);
export interface ProvidersResult {
  offers: ProviderOffer[] | null;
  /** which availability provider the offers came from (null: none / only the built-in free offer) */
  provider: AvailabilityProviderName | null;
}
export interface TitlePage {
  title: CatalogTitle;
  offers: ProviderOffer[] | null;
  availabilityProvider: AvailabilityProviderName | null;
}

/**
 * Modes (decided from configuration, see CINEVERSE.md):
 *  - 'tmdb'   TMDB key present: the full catalog. TVmaze (if enabled) only ENRICHES TMDB TV titles (episodes, next
 *             episode, a second rating); it never adds standalone results to search or collections.
 *  - 'tvmaze' no TMDB key but TVMAZE_ENABLED: TV only. Search, "airing in India", "popular TV" and title pages work;
 *             movie features answer MOVIES_NEED_TMDB.
 *  - 'none'   neither: every data route answers CATALOG_NOT_CONFIGURED (the legacy behaviour).
 */
/** Adds TVmaze fields to a TMDB TV title. TMDB keeps title, overview, artwork, genres and the primary rating. */
export function mergeTvmaze(base: CatalogTitle, show: CatalogTitle, seasons: CatalogTitle['seasonList'] | null): CatalogTitle {
  const ratings: NonNullable<CatalogTitle['ratings']> = [];
  if (base.rating !== null) ratings.push({ source: 'TMDB', value: base.rating, votes: base.voteCount });
  if (show.rating !== null) ratings.push({ source: 'TVmaze', value: show.rating });
  return {
    ...base,
    ratings,
    sources: ['tmdb', 'tvmaze'],
    seasonList: seasons ?? undefined,
    nextEpisode: show.nextEpisode ?? null,
    tvStatus: show.tvStatus ?? null,
    externalIds: { ...base.externalIds, imdb: base.externalIds?.imdb ?? show.externalIds?.imdb ?? null, tvdb: base.externalIds?.tvdb ?? show.externalIds?.tvdb ?? null, tvmaze: show.sourceId }
  };
}

export class CatalogService {
  readonly tmdb: TmdbAdapter;
  readonly watchmode: WatchmodeAdapter;
  readonly youtube: YoutubeAdapter;
  readonly tvmaze: TvmazeAdapter;
  readonly streaming: StreamingAvailabilityAdapter;
  readonly tmdbHttp: UpstreamClient;
  readonly watchmodeHttp: UpstreamClient;
  readonly tvmazeHttp: UpstreamClient;
  private readonly enrichDeadlineMs: number;
  readonly streamingHttp: UpstreamClient;
  readonly quota: QuotaGuard;
  readonly userLookups: UserLookupGuard;
  readonly availabilityOrder: AvailabilityProviderName[];
  readonly defaultRegion: string;
  private cache: TtlCache<unknown>;
  private now: () => number;
  private saLow = false;

  constructor(env: CatalogEnv, deps: CatalogDeps = {}) {
    this.now = deps.now ?? Date.now;
    const mk = (name: string, extra: Partial<ConstructorParameters<typeof UpstreamClient>[0]> = {}) =>
      new UpstreamClient({ name, fetchFn: deps.fetchFn, now: this.now, sleep: deps.sleep, timeoutMs: deps.timeoutMs, backoffBaseMs: deps.backoffBaseMs, ...extra });
    this.tmdbHttp = mk('tmdb');
    this.watchmodeHttp = mk('watchmode');
    const ytHttp = mk('youtube');
    // TVmaze: every call (retries included) waits for the token bucket (<= 15 per 10 s, the API allows 20)
    this.enrichDeadlineMs = deps.enrichDeadlineMs ?? 2500;
    const limiter = new TvmazeLimiter({ now: this.now, sleep: deps.sleep, ...deps.tvmazeLimiter });
    const baseFetch: FetchLike = deps.fetchFn ?? ((url, init) => fetch(url, init as any) as any);
    this.tvmazeHttp = mk('tvmaze', { fetchFn: limitedFetch(baseFetch, limiter) });
    // Streaming Availability: every retry would cost quota, so one retry only; two failures open the breaker for a minute
    this.streamingHttp = mk('streamingavailability', { maxRetries: 1, breakerThreshold: 2, breakerCooldownMs: 60_000 });
    this.tmdb = new TmdbAdapter({ readToken: env.TMDB_READ_TOKEN?.trim() || undefined, apiKey: env.TMDB_API_KEY?.trim() || undefined }, this.tmdbHttp);
    this.watchmode = new WatchmodeAdapter({ apiKey: env.WATCHMODE_API_KEY?.trim() || undefined }, this.watchmodeHttp);
    this.youtube = new YoutubeAdapter({ apiKey: env.YOUTUBE_API_KEY?.trim() || undefined }, ytHttp);
    this.tvmaze = new TvmazeAdapter({ enabled: !flagOff(env.TVMAZE_ENABLED), userAgent: env.TVMAZE_USER_AGENT }, this.tvmazeHttp);
    this.streaming = new StreamingAvailabilityAdapter({ apiKey: env.STREAMING_AVAILABILITY_API_KEY?.trim() || undefined }, this.streamingHttp);
    this.quota = new QuotaGuard({ provider: 'streamingavailability', store: deps.quotaStore ?? new MemoryQuotaStore(), limit: parseMonthlyLimit(env.STREAMING_AVAILABILITY_MONTHLY_LIMIT), now: this.now });
    this.userLookups = new UserLookupGuard({ now: this.now });
    this.availabilityOrder = parseProviderOrder(env.AVAILABILITY_PROVIDER_ORDER);
    this.defaultRegion = normalizeRegion(env.CATALOG_DEFAULT_REGION, DEFAULT_CATALOG_REGION);
    const max = Number(env.CATALOG_CACHE_MAX_ENTRIES);
    this.cache = new TtlCache({ maxEntries: Number.isFinite(max) && max >= 50 ? Math.min(max, 20000) : 1000, now: this.now });
  }

  get mode(): CatalogMode {
    return this.tmdb.configured ? 'tmdb' : this.tvmaze.enabled ? 'tvmaze' : 'none';
  }
  get configured(): boolean {
    return this.mode !== 'none';
  }
  get availabilityEnabled(): boolean {
    return this.watchmode.configured || this.streaming.configured;
  }
  /** Re-reads the monthly counter (cached 30 s) so status() can report "quota low". Never throws. */
  async refreshAvailabilityFlags(): Promise<void> {
    this.saLow = this.streaming.configured ? await this.quota.isLow() : false;
  }
  /** First configured provider whose quota is not stopped (null when none is usable right now). */
  get activeAvailabilityProvider(): AvailabilityProviderName | null {
    for (const n of this.availabilityOrder) {
      if (n === 'streamingavailability' && this.streaming.configured && !this.saLow) return n;
      if (n === 'watchmode' && this.watchmode.configured) return n;
    }
    return null;
  }
  /** Only booleans and names: never keys, counts or limits. `availability` stays a boolean (backward compatible). */
  status() {
    return {
      configured: this.configured,
      mode: this.mode,
      movies: this.mode === 'tmdb',
      tv: this.configured,
      availability: this.availabilityEnabled,
      availabilityDetail: { provider: this.activeAvailabilityProvider, quotaLow: this.streaming.configured && this.saLow },
      /** configured availability providers in preference order (names only; used for the credit lines) */
      availabilityProviders: this.availabilityOrder.filter((n) => (n === 'watchmode' ? this.watchmode.configured : this.streaming.configured)),
      trailers: this.youtube.configured,
      defaultRegion: this.defaultRegion
    };
  }
  /** Any mode but 'none'. */
  private need(): void {
    if (!this.configured) throw new CatalogNotConfiguredError();
  }
  /** TMDB features: 503 CATALOG_NOT_CONFIGURED with nothing configured, the "movies need TMDB" 503 in TVmaze mode. */
  private needTmdb(): void {
    if (this.mode === 'none') throw new CatalogNotConfiguredError();
    if (this.mode === 'tvmaze') throw new MoviesNeedTmdbError();
  }
  private needTvmaze(): void {
    if (!this.tvmaze.enabled) throw new CatalogNotConfiguredError();
  }
  private cached<T>(key: string, policy: { ttlMs: number; staleMs?: number; nullTtlMs?: number; maxServeStaleMs?: number }, loader: () => Promise<T>): Promise<T> {
    return this.cache.get(key, loader as () => Promise<unknown>, policy) as Promise<T>;
  }

  // ---- metadata -----------------------------------------------------------------------------------------------
  async genres(): Promise<CatalogGenre[]> {
    this.need();
    if (this.mode === 'tvmaze') return tvmazeGenreList();
    return this.cached('genres', TTL.genres, async () => {
      try {
        return await this.tmdb.genres();
      } catch {
        return Object.entries(TMDB_GENRE_NAMES).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.name.localeCompare(b.name));
      }
    });
  }

  async trending(type: CatalogTypeFilter, region: string, page = 1): Promise<CatalogPage> {
    this.need();
    if (this.mode === 'tvmaze') {
      // TV only: the "popular TV" list; movies are not available without TMDB
      if (type === 'movie' || page > 1) return { results: [], page, totalPages: 1, totalResults: 0 };
      const items = await this.tvPopular(region);
      return { results: items, page: 1, totalPages: 1, totalResults: items.length };
    }
    return this.cached(`trend:${type}:${region}:${page}`, TTL.trending, () => this.tmdb.trending(type, region, page));
  }

  async details(mediaType: CatalogMediaType, id: string, region: string): Promise<CatalogTitle | null> {
    this.needTmdb();
    const base = await this.cached(`det:${mediaType}:${id}`, TTL.details, () => this.tmdb.details(mediaType, id, region));
    if (!base) return null;
    const out: CatalogTitle = { ...base, region };
    const freeMovie = mediaType === 'movie' ? (freeMoviesData as any[]).find((f: any) => String(f.tmdbId) === id) : null;
    if (freeMovie) {
      out.freeStreamUrl = freeMovie.streamUrl || freeMovie.youtubeUrl;
    }
    if (this.youtube.configured) {
      const year = out.releaseDate ? Number(out.releaseDate.slice(0, 4)) : null;
      out.trailerYoutubeId = await this.cached(`yt:${out.id}`, TTL.details, () => this.youtube.trailerId(out.title, year)).catch(() => null);
    }
    return out;
  }

  async recommendations(mediaType: CatalogMediaType, id: string, region: string, page = 1): Promise<CatalogPage> {
    this.needTmdb();
    return this.cached(`rec:${mediaType}:${id}:${page}`, TTL.details, () => this.tmdb.recommendations(mediaType, id, region, page));
  }

  // ---- availability ---------------------------------------------------------------------------------------------
  private sourceList(region: string): Promise<Map<number, SourceInfo>> {
    return this.cached(`src:${region}`, TTL.genres, () => this.watchmode.sourceList(region));
  }

  /** The built-in free offer of the curated free-movie list (TMDB movies only). */
  private freeOfferFor(mediaType: CatalogMediaType, id: string): ProviderOffer | null {
    const freeMovie = mediaType === 'movie' ? (freeMoviesData as any[]).find((f: any) => String(f.tmdbId) === id) : null;
    if (!freeMovie) return null;
    const url = freeMovie.streamUrl || freeMovie.youtubeUrl || '';
    const isYoutube = url.includes('youtu');
    return {
      id: isYoutube ? 'free_youtube' : 'free_stream',
      name: isYoutube ? 'YouTube (Free)' : 'Internet Archive (Free Cinema)',
      type: 'free',
      logoUrl: isYoutube ? 'https://www.youtube.com/s/desktop/f17255be/img/favicon_144x144.png' : 'https://archive.org/images/glogo.png',
      destinationUrl: url,
      verified: true,
      capabilities: EMBEDDED_PROVIDER_CAPABILITIES
    };
  }

  /**
   * Availability through the configured providers in AVAILABILITY_PROVIDER_ORDER. The first provider that is configured
   * and whose quota is not stopped answers; a failure, an unknown title or a stopped quota falls through to the next.
   *
   * Streaming Availability (1,000 requests a month) is guarded hard:
   *  - only used when `userId` is given (a signed-in person opened a title page), never for lists or collections;
   *  - fresh answers are cached 24 h per title and country; stale ones (up to 7 days) are served when the API fails,
   *    the quota is stopped or the user is over their cooldown; concurrent lookups share one request (cache in-flight);
   *  - a real request first passes the per-user cooldown (1 uncached lookup per title per hour, 30 per day), then
   *    reserves one unit of the monthly counter (atomic, soft stop at 90%).
   * null means "unknown", never "not available".
   */
  private async availabilityFor(ref: AvRef, region: string, userId?: string): Promise<ProvidersResult> {
    const base = avKey(ref);
    for (const name of this.availabilityOrder) {
      if (name === 'watchmode') {
        if (!this.watchmode.configured) continue;
        try {
          const offers = await this.cached(`prov:wm:${base}:${region}`, TTL.providers, async () => {
            const wmId = await this.cached(`wm:${base}`, TTL.mapping, () => (ref.kind === 'tmdb' ? this.watchmode.mapTmdbId(ref.mediaType, ref.id) : this.watchmode.mapImdbId(ref.id)));
            if (wmId === null) return null as ProviderOffer[] | null;
            return this.watchmode.offers(wmId, region, await this.sourceList(region));
          });
          if (offers) return { offers, provider: 'watchmode' };
        } catch {
          /* fall through to the next provider */
        }
        continue;
      }
      if (!this.streaming.configured) continue;
      const key = `prov:sa:${base}:${region}`;
      const have = this.cache.peek(key, SA_STALE_MS) as ProviderOffer[] | null | undefined;
      if (!userId || (await this.quota.isLow())) {
        // no signed-in opener, or the quota is stopped: serve what we already hold (fresh or stale), never call
        if (have) return { offers: have, provider: 'streamingavailability' };
        continue;
      }
      try {
        const offers = await this.cached(key, TTL.saAvailability, async () => {
          this.userLookups.check(userId, base); // LookupCooldown: over the per-user limits
          await this.quota.consume(); // QuotaStopped: soft stop reached, the API is NOT called
          this.userLookups.record(userId, base);
          const sa: AvailabilityRef = ref.kind === 'tmdb' ? { kind: 'tmdb', mediaType: ref.mediaType, id: ref.id } : { kind: 'imdb', id: ref.id };
          return this.streaming.offers(sa, region);
        });
        if (offers) return { offers, provider: 'streamingavailability' };
      } catch {
        /* cooldown, quota stop or API error without a stale copy: next provider, or unknown */
      }
    }
    return { offers: null, provider: null };
  }

  /**
   * Verified offers for a title in a region, or null when availability cannot be verified (not configured, id not
   * known to the providers, upstream error). null is "unknown", never "not available". Pass `userId` only from a title
   * page opened by a signed-in user (it is what allows the quota-limited provider to be called).
   */
  async providersFor(mediaType: CatalogMediaType, id: string, region: string, opts: { userId?: string } = {}): Promise<ProviderOffer[] | null> {
    return (await this.providersWithSource(mediaType, id, region, opts)).offers;
  }
  async providersWithSource(mediaType: CatalogMediaType, id: string, region: string, opts: { userId?: string } = {}): Promise<ProvidersResult> {
    this.needTmdb();
    const freeOffer = this.freeOfferFor(mediaType, id);
    if (!this.availabilityEnabled) return { offers: freeOffer ? [freeOffer] : null, provider: null };
    const r = await this.availabilityFor({ kind: 'tmdb', mediaType, id }, region, opts.userId);
    if (!freeOffer) return r;
    return { offers: [freeOffer, ...(r.offers ?? [])], provider: r.provider };
  }

  /** Availability of a TVmaze title: looked up by its IMDb id (TVmaze externals). null when it has none. */
  async providersForTvmaze(id: string, region: string, opts: { userId?: string } = {}): Promise<ProvidersResult> {
    this.needTvmaze();
    if (!this.availabilityEnabled) return { offers: null, provider: null };
    const show = await this.tvmazeShow(id);
    const imdb = show?.externalIds?.imdb;
    if (!imdb) return { offers: null, provider: null };
    return this.availabilityFor({ kind: 'imdb', id: imdb }, region, opts.userId);
  }

  /** Verified destination URL for one provider of a title (used by the room to re-validate server side). */
  async resolveDestinationUrl(titleKey: string, providerId: string, region: string): Promise<string | null> {
    const k = parseTitleKey(titleKey);
    if (!k || !this.configured) return null;
    try {
      const offers = k.source === 'tvmaze' ? (await this.providersForTvmaze(k.sourceId, region)).offers : await this.providersFor(k.mediaType, k.sourceId, region);
      const hit = offers?.find((o) => o.id === providerId && o.verified && o.destinationUrl);
      return hit?.destinationUrl ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Attaches verified providers (best effort, bounded concurrency) for LISTS. Only Watchmode is called here (the quota
   * limited provider is never used for list pages); cached Streaming Availability answers are still reused.
   */
  async attachProviders(titles: CatalogTitle[], region: string, max = 20): Promise<{ titles: CatalogTitle[]; verified: Set<string> }> {
    const verified = new Set<string>();
    if (!this.watchmode.configured || this.mode !== 'tmdb') return { titles, verified };
    const head = titles.slice(0, max);
    const done = await mapLimit(head, 4, async (t) => {
      const offers = await this.providersFor(t.mediaType, t.sourceId, region);
      if (offers) verified.add(t.id);
      return offers ? { ...t, providers: offers, region } : t;
    });
    return { titles: [...done, ...titles.slice(max)], verified };
  }

  // ---- TVmaze ---------------------------------------------------------------------------------------------------
  /** Show with embedded cast / seasons / next episode / images. Cached 6 h, a 404 is remembered 24 h. */
  private tvmazeShow(id: string): Promise<CatalogTitle | null> {
    return this.cached(`tvm:show:${id}`, TTL.tvShow, () => this.tvmaze.show(id, this.defaultRegion));
  }
  private tvmazeSeasons(id: string) {
    return this.cached(`tvm:eps:${id}`, TTL.tvEpisodes, () => this.tvmaze.seasons(id));
  }
  private tvmazeLookup(ids: { imdb?: string | null; tvdb?: string | null }): Promise<string | null> {
    return this.cached(`tvm:lookup:${ids.imdb ?? ''}:${ids.tvdb ?? ''}`, TTL.tvLookup, () => this.tvmaze.lookup(ids));
  }

  /**
   * Mode (a): adds TVmaze data to a TMDB TV title: season / episode list, the next episode and TVmaze's rating as a
   * SECOND rating (TMDB stays the primary). The title is mapped through the TMDB external ids (IMDb first, then TheTVDB).
   * Any TVmaze failure leaves the TMDB title exactly as it was.
   */
  async enrichWithTvmaze(base: CatalogTitle): Promise<CatalogTitle> {
    if (!this.tvmaze.enabled || base.source !== 'tmdb' || base.mediaType !== 'tv') return base;
    const ids = base.externalIds;
    if (!ids?.imdb && !ids?.tvdb) return base;
    try {
      const tvId = await this.tvmazeLookup({ imdb: ids.imdb, tvdb: ids.tvdb });
      if (!tvId) return base;
      const [show, seasons] = await Promise.all([this.tvmazeShow(tvId), this.tvmazeSeasons(tvId).catch(() => null)]);
      if (!show) return base;
      return mergeTvmaze(base, show, seasons);
    } catch {
      return base;
    }
  }

  /** Resolves with `fallback` when `work` has not finished after `ms` (the work itself is not cancelled). */
  private withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise<T>((resolve) => {
      const timer = setTimeout(() => resolve(fallback), ms);
      timer.unref?.();
      work.then(
        (v) => { clearTimeout(timer); resolve(v); },
        () => { clearTimeout(timer); resolve(fallback); }
      );
    });
  }

  /** Details of a TVmaze show for its own title page (TVmaze mode, or an old watchlist entry). */
  private async tvmazeDetails(id: string, region: string): Promise<CatalogTitle | null> {
    this.needTvmaze();
    const show = await this.tvmazeShow(id);
    if (!show) return null;
    const seasons = await this.tvmazeSeasons(id).catch(() => null);
    return { ...show, region, seasonList: seasons ?? undefined, episodes: seasons ? seasons.reduce((n, s) => n + s.episodeCount, 0) || null : null };
  }

  /** Everything a title page needs, for either source. null when the source does not know the title. */
  async titlePage(source: CatalogSource, mediaType: CatalogMediaType, id: string, region: string, userId?: string): Promise<TitlePage | null> {
    if (source === 'tvmaze') {
      if (mediaType !== 'tv') return null;
      const title = await this.tvmazeDetails(id, region);
      if (!title) return null;
      const r = await this.providersForTvmaze(id, region, { userId }).catch(() => ({ offers: null, provider: null }) as ProvidersResult);
      return { title, offers: r.offers, availabilityProvider: r.provider };
    }
    const base = await this.details(mediaType, id, region);
    if (!base) return null;
    // TVmaze is a free extra: the page must never wait long for it. The enrichment runs next to the availability lookup and
    // is given a short deadline; when TVmaze is slow or unreachable the page answers with the TMDB data, while the enrichment
    // keeps running in the background and fills the cache, so the next visit already has the episodes.
    const [title, r] = await Promise.all([
      this.withDeadline(this.enrichWithTvmaze(base), this.enrichDeadlineMs, base),
      this.providersWithSource(mediaType, id, region, { userId })
    ]);
    return { title, offers: r.offers, availabilityProvider: r.provider };
  }

  /** Providers only (the /providers route). */
  async providersOnly(source: CatalogSource, mediaType: CatalogMediaType, id: string, region: string, userId?: string): Promise<ProvidersResult> {
    if (source === 'tvmaze') return mediaType === 'tv' ? this.providersForTvmaze(id, region, { userId }) : { offers: null, provider: null };
    return this.providersWithSource(mediaType, id, region, { userId });
  }

  /** TVmaze shows have no recommendations: an empty page, never invented titles. */
  async recommendationsFor(source: CatalogSource, mediaType: CatalogMediaType, id: string, region: string, page = 1): Promise<CatalogPage> {
    if (source === 'tvmaze') {
      this.needTvmaze();
      return { results: [], page, totalPages: 1, totalResults: 0 };
    }
    return this.recommendations(mediaType, id, region, page);
  }

  private async tvmazeDays(days: string[], fetchDay: (day: string) => Array<Promise<CatalogTitle[]>>): Promise<CatalogTitle[]> {
    const settled = await Promise.allSettled(days.flatMap(fetchDay));
    const ok = settled.filter((r): r is PromiseFulfilledResult<CatalogTitle[]> => r.status === 'fulfilled');
    if (!ok.length) throw (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
    const seen = new Set<string>();
    const out: CatalogTitle[] = [];
    for (const r of ok) for (const t of r.value) if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
    return out;
  }
  /** "Airing in India": the Indian TV schedule and web-channel schedule of today (IST) and the next two days. */
  private tvAiringIndia(region: string): Promise<CatalogTitle[]> {
    const today = istDay(this.now());
    const days = [today, addDaysUtc(today, 1), addDaysUtc(today, 2)];
    return this.cached(`tvm:airing-in:${today}`, TTL.tvSchedule, async () => {
      const shows = await this.tvmazeDays(days, (d) => [
        this.cached(`tvm:sched:IN:${d}`, TTL.tvSchedule, () => this.tvmaze.schedule('IN', d, region)),
        this.cached(`tvm:web:IN:${d}`, TTL.tvSchedule, () => this.tvmaze.webSchedule('IN', d, region))
      ]);
      return sortByRatingThenWeight(shows);
    });
  }
  /**
   * "Popular TV". TVmaze's `/shows?page=` lists shows by id, not by popularity, and has no popularity endpoint. So we
   * take what is airing today on US TV (/schedule?country=US) and on global web channels (/schedule/web), de-duplicate
   * the shows and order them by TVmaze's own `weight` (a 0 to 100 popularity score), then rating.
   */
  private tvPopular(region: string): Promise<CatalogTitle[]> {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    return this.cached(`tvm:popular:${today}`, TTL.tvSchedule, async () => {
      const shows = await this.tvmazeDays([today], (d) => [
        this.cached(`tvm:sched:US:${d}`, TTL.tvSchedule, () => this.tvmaze.schedule('US', d, region)),
        this.cached(`tvm:web:ALL:${d}`, TTL.tvSchedule, () => this.tvmaze.webSchedule(null, d, region))
      ]);
      return sortByWeight(shows);
    });
  }

  private async detailsMany(titles: CatalogTitle[], region: string, max: number): Promise<CatalogTitle[]> {
    const head = titles.slice(0, max);
    const out = await mapLimit(head, 4, (t) => this.details(t.mediaType, t.sourceId, region).catch(() => null));
    return out.filter(Boolean) as CatalogTitle[];
  }

  // ---- search -----------------------------------------------------------------------------------------------------
  async search(p: SearchParams): Promise<SearchResult> {
    this.need();
    if (this.mode === 'tvmaze') return this.tvSearch(p);
    const key = `search:${JSON.stringify([p.q ?? '', p.type, p.genre ?? 0, p.yearFrom ?? 0, p.yearTo ?? 0, p.sort, p.provider ?? '', p.region, p.page])}`;
    return this.cached(key, TTL.search, async () => {
      let page = await this.searchBase(p);
      let results = page.results;
      if (p.q) {
        // text search cannot take genre / range filters upstream; they are applied to the returned page
        if (p.genre) results = results.filter((t) => (t.genreIds ?? []).includes(p.genre!));
        if (p.yearFrom || p.yearTo) {
          results = results.filter((t) => {
            const y = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : NaN;
            return Number.isFinite(y) && (!p.yearFrom || y >= p.yearFrom) && (!p.yearTo || y <= p.yearTo);
          });
        }
        if (p.sort !== 'popularity') results = sortTitles(results, p.sort); // 'popularity' keeps TMDB's relevance order for text search
      }
      let providerFilterApplied = false;
      if (p.provider && this.watchmode.configured) {
        const wanted = providerKey(p.provider);
        const attached = await this.attachProviders(results, p.region, 20);
        results = attached.titles
          .filter((t) => attached.verified.has(t.id) && t.providers.some((o) => o.verified && providerKey(o.name) === wanted))
          .map((t) => t);
        providerFilterApplied = true;
      }
      page = { ...page, results };
      return { ...page, availabilityEnabled: this.availabilityEnabled, providerFilterApplied };
    });
  }

  /** TVmaze mode: TV shows only. Text search is TVmaze's fuzzy search; without text it is the "popular TV" list. */
  private async tvSearch(p: SearchParams): Promise<SearchResult> {
    const empty: SearchResult = { results: [], page: p.page, totalPages: 1, totalResults: 0, availabilityEnabled: this.availabilityEnabled, providerFilterApplied: false };
    if (p.type === 'movie' || p.page > 1) return empty; // TVmaze has no movies and no paging on search
    const key = `tvm:search:${JSON.stringify([p.q ?? '', p.genre ?? 0, p.yearFrom ?? 0, p.yearTo ?? 0, p.sort])}`;
    return this.cached(key, TTL.tvSearch, async () => {
      let results = p.q ? await this.cached(`tvm:q:${p.q.toLowerCase()}`, TTL.tvSearch, () => this.tvmaze.search(p.q!, p.region)) : await this.tvPopular(p.region);
      if (p.genre) results = results.filter((t) => (t.genreIds ?? []).includes(p.genre!));
      if (p.yearFrom || p.yearTo) {
        results = results.filter((t) => {
          const y = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : NaN;
          return Number.isFinite(y) && (!p.yearFrom || y >= p.yearFrom) && (!p.yearTo || y <= p.yearTo);
        });
      }
      if (p.sort !== 'popularity' || !p.q) results = sortTitles(results, p.sort);
      return { results, page: 1, totalPages: 1, totalResults: results.length, availabilityEnabled: this.availabilityEnabled, providerFilterApplied: false };
    });
  }

  private async searchBase(p: SearchParams): Promise<CatalogPage> {
    const single = p.yearFrom && p.yearFrom === p.yearTo ? p.yearFrom : null;
    if (p.q) return this.tmdb.search(p.q, p.type, p.page, single, p.region);
    const opts: DiscoverOpts = { page: p.page, sort: p.sort, genres: p.genre ? [p.genre] : undefined, yearFrom: p.yearFrom, yearTo: p.yearTo };
    if (p.type !== 'all') return this.tmdb.discover(p.type, opts, p.region);
    const [m, t] = await Promise.all([this.tmdb.discover('movie', opts, p.region), this.tmdb.discover('tv', opts, p.region)]);
    return {
      results: sortTitles([...m.results, ...t.results], p.sort),
      page: p.page,
      totalPages: Math.max(m.totalPages, t.totalPages),
      totalResults: m.totalResults + t.totalResults
    };
  }

  // ---- collections ------------------------------------------------------------------------------------------------
  async collection(slug: string, ctx: { region: string; providers: string[]; userSeeds?: Array<{ mediaType: CatalogMediaType; id: string }>; excludeKeys?: Set<string> }): Promise<CollectionResult | null> {
    const def = findCollection(slug);
    if (!def) return null;
    this.need();
    if (def.kind === 'tv-airing-india' || def.kind === 'tv-popular') {
      // TVmaze collections exist only in TVmaze mode: with a TMDB key TVmaze just enriches TMDB titles (no duplicates)
      if (this.mode !== 'tvmaze') return null;
      const tvBase = { slug: def.slug, title: def.title, eyebrow: def.eyebrow, howWePick: def.howWePick, availabilityEnabled: this.availabilityEnabled };
      const list = def.kind === 'tv-airing-india' ? await this.tvAiringIndia(ctx.region) : await this.tvPopular(ctx.region);
      const items = list.slice(0, def.limit);
      return { ...tvBase, items, available: items.length > 0, note: items.length ? undefined : 'TVmaze lists nothing for this right now.' };
    }
    this.needTmdb();
    const base = { slug: def.slug, title: def.title, eyebrow: def.eyebrow, howWePick: def.howWePick, availabilityEnabled: this.availabilityEnabled };

    if (def.kind === 'personal') {
      const seeds = (ctx.userSeeds ?? []).slice(0, 3);
      if (!seeds.length) return { ...base, items: [], available: false, note: 'Save a few titles to your watchlist to get recommendations.' };
      const lists = await Promise.all(seeds.map((s) => this.recommendations(s.mediaType, s.id, ctx.region).catch(() => null)));
      const seen = new Set<string>(ctx.excludeKeys ?? []);
      const items: CatalogTitle[] = [];
      for (let i = 0; items.length < def.limit; i++) {
        let any = false;
        for (const l of lists) {
          const t = l?.results[i];
          if (!t) continue;
          any = true;
          if (!seen.has(t.id)) {
            seen.add(t.id);
            items.push(t);
          }
        }
        if (!any) break;
      }
      return { ...base, items: items.slice(0, def.limit), available: items.length > 0 };
    }

    if (def.kind === 'platforms') {
      if (!this.availabilityEnabled) return { ...base, items: [], available: false, note: 'Availability data is not enabled' };
      if (!ctx.providers.length) return { ...base, items: [], available: false, note: 'Choose your platforms to see what is available.' };
      const wanted = new Set(ctx.providers.map(providerKey));
      const items = await this.cached(`coll:platforms:${ctx.region}:${[...wanted].sort().join(',')}`, TTL.collection, async () => {
        const [a, b] = await Promise.all([this.trending('all', ctx.region, 1), this.discoverCollection({ ...COLLECTIONS[0], kind: 'discover', queries: [{ mediaType: 'movie', opts: { sort: 'popularity', minVotes: 500 } }, { mediaType: 'tv', opts: { sort: 'popularity', minVotes: 500 } }] } as CollectionDef, ctx.region)]);
        const pool = [...a.results, ...b].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i).slice(0, 36);
        const att = await this.attachProviders(pool, ctx.region, 36);
        return att.titles.filter((t) => t.providers.some((o) => o.verified && wanted.has(providerKey(o.name)))).slice(0, def.limit);
      });
      return { ...base, items, available: items.length > 0, note: items.length ? undefined : 'Nothing verified on those platforms right now.' };
    }

    if (def.kind === 'spotlight') {
      const items = await this.cached(`coll:spotlight:${ctx.region}:${dayKey(this.now())}`, TTL.collection, async () => {
        const pool = (await this.trending('all', ctx.region)).results.filter((t) => t.backdropPath && t.overview).slice(0, 10);
        if (!pool.length) return [] as CatalogTitle[];
        const pick = pool[hash32(`${dayKey(this.now())}|${ctx.region}`) % pool.length];
        const full = (await this.details(pick.mediaType, pick.sourceId, ctx.region).catch(() => null)) ?? pick;
        const prov = await this.providersFor(full.mediaType, full.sourceId, ctx.region);
        return [prov ? { ...full, providers: prov } : full];
      });
      return { ...base, items, available: items.length > 0 };
    }

    if (def.kind === 'free') {
      const items = await this.cached(`coll:free:${ctx.region}`, TTL.collection, async () => {
        return getFreeMovies(this.tmdb, ctx.region);
      });
      return { ...base, items: items.slice(0, def.limit), available: items.length > 0 };
    }

    if (def.kind === 'trending') {
      const page = await this.trending('all', ctx.region);
      return { ...base, items: page.results.slice(0, def.limit), available: page.results.length > 0 };
    }

    const items = await this.cached(`coll:${def.slug}:${ctx.region}`, TTL.collection, () => this.discoverCollection(def, ctx.region));
    return { ...base, items, available: items.length > 0 };
  }

  /** Runs the declarative queries of a discover collection, applies filters and the optional details check. */
  private async discoverCollection(def: CollectionDef, region: string): Promise<CatalogTitle[]> {
    const today = dayKey(this.now());
    const queries = def.buildQueries ? def.buildQueries(today) : def.queries ?? [];
    // one failing query (for example one language) never takes the others down: it just contributes nothing
    const lists = await Promise.all(queries.map((q) => this.tmdb.discover(q.mediaType, q.opts, region).catch(() => null)));
    let pool: CatalogTitle[] = [];
    if (def.merge === 'popularity') {
      pool = lists.flatMap((l) => l?.results ?? []).map((t, i) => ({ t, i })).sort((a, b) => (b.t.popularity ?? 0) - (a.t.popularity ?? 0) || a.i - b.i).map((x) => x.t);
    } else {
      const longest = Math.max(0, ...lists.map((l) => l?.results.length ?? 0));
      for (let i = 0; i < longest; i++) for (const l of lists) if (l?.results[i]) pool.push(l.results[i]); // interleave movie / tv
    }
    if (def.filter) pool = pool.filter((t) => def.filter!(t, { today }));
    if (def.detailFilter) {
      const needs = def.detailMediaTypes ?? [];
      const keep = pool.filter((t) => !needs.includes(t.mediaType));
      const check = pool.filter((t) => needs.includes(t.mediaType)).slice(0, 14);
      const detailed = await this.detailsMany(check, region, 14);
      const passed = new Set(detailed.filter(def.detailFilter).map((t) => t.id));
      const detailById = new Map(detailed.map((t) => [t.id, t]));
      pool = pool.filter((t) => keep.includes(t) || passed.has(t.id)).map((t) => detailById.get(t.id) ?? t);
    }
    return pool.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i).slice(0, def.limit);
  }

  // ---- matchmaker -------------------------------------------------------------------------------------------------
  async matchmaker(req: MatchmakerRequest): Promise<MatchmakerResponse> {
    this.needTmdb();
    const region = normalizeRegion(req.region, this.defaultRegion);
    const limit = timeLimitMinutes(req.time);
    const genres = [...new Set([...moodSeedGenres(req.mood), ...req.genres])];
    const key = `mm:${req.mood}:${req.time}:${genres.join(',')}:${region}`;
    const candidates = await this.cached(key, TTL.collection, async () => {
      const base: DiscoverOpts = { sort: 'popularity', anyGenres: genres, minVotes: 300, minRating: 6.3 };
      const [m, t, m2] = await Promise.all([
        this.tmdb.discover('movie', { ...base, maxRuntime: limit ?? undefined }, region).catch(() => null),
        this.tmdb.discover('tv', base, region).catch(() => null),
        this.tmdb.discover('movie', { ...base, maxRuntime: limit ?? undefined, page: 2 }, region).catch(() => null)
      ]);
      const pool = [...(m?.results ?? []), ...(t?.results ?? []), ...(m2?.results ?? [])];
      // runtime is not in list payloads: fetch details (cached 6 h) for the strongest 24 so the time limit is real
      const pre = rankCandidates(pool, { req: { ...req, time: 'longer' } }, 24).picks.map((p) => p.title);
      const det = await this.detailsMany(pre, region, 24);
      return det;
    });
    let availability: Map<string, ProviderOffer[]> | undefined;
    let checked = false;
    let pool = candidates;
    if (req.providers.length && this.watchmode.configured) {
      const att = await this.attachProviders(candidates, region, 24);
      availability = new Map(att.titles.map((t) => [t.id, t.providers]));
      pool = att.titles;
      checked = att.verified.size > 0;
    }
    const ranked = rankCandidates(pool, { req, availability: checked ? availability : undefined });
    return {
      picks: ranked.picks,
      pickIndex: ranked.pickIndex,
      availabilityChecked: checked,
      method: 'Rule-based scoring: mood genre weights, genre preferences, time limit, rating and verified providers. Deterministic for a given seed. No AI.'
    };
  }
}

export function titleKeyOf(mediaType: CatalogMediaType, id: string | number): string {
  return makeTitleKey('tmdb', mediaType, id);
}
