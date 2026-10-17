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
import { COLLECTIONS, findCollection, type CollectionDef } from './collections.js';
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

export interface CatalogEnv {
  TMDB_READ_TOKEN?: string;
  TMDB_API_KEY?: string;
  WATCHMODE_API_KEY?: string;
  YOUTUBE_API_KEY?: string;
  CATALOG_DEFAULT_REGION?: string;
  CATALOG_CACHE_MAX_ENTRIES?: string;
}
export interface CatalogDeps {
  fetchFn?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  backoffBaseMs?: number;
}

/** Cache lifetimes (ms). search 60 s, trending 15 min, details 6 h, providers 30 min, genres 24 h. */
export const TTL = {
  search: { ttlMs: 60_000, staleMs: 120_000 },
  trending: { ttlMs: 15 * 60_000, staleMs: 30 * 60_000 },
  details: { ttlMs: 6 * 3600_000, staleMs: 6 * 3600_000 },
  providers: { ttlMs: 30 * 60_000, staleMs: 30 * 60_000 },
  genres: { ttlMs: 24 * 3600_000, staleMs: 24 * 3600_000 },
  mapping: { ttlMs: 7 * 24 * 3600_000, staleMs: 0 },
  collection: { ttlMs: 10 * 60_000, staleMs: 20 * 60_000 }
} as const;

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

export class CatalogService {
  readonly tmdb: TmdbAdapter;
  readonly watchmode: WatchmodeAdapter;
  readonly youtube: YoutubeAdapter;
  readonly tmdbHttp: UpstreamClient;
  readonly watchmodeHttp: UpstreamClient;
  readonly defaultRegion: string;
  private cache: TtlCache<unknown>;
  private now: () => number;

  constructor(env: CatalogEnv, deps: CatalogDeps = {}) {
    this.now = deps.now ?? Date.now;
    const mk = (name: string) =>
      new UpstreamClient({ name, fetchFn: deps.fetchFn, now: this.now, sleep: deps.sleep, timeoutMs: deps.timeoutMs, backoffBaseMs: deps.backoffBaseMs });
    this.tmdbHttp = mk('tmdb');
    this.watchmodeHttp = mk('watchmode');
    const ytHttp = mk('youtube');
    this.tmdb = new TmdbAdapter({ readToken: env.TMDB_READ_TOKEN?.trim() || undefined, apiKey: env.TMDB_API_KEY?.trim() || undefined }, this.tmdbHttp);
    this.watchmode = new WatchmodeAdapter({ apiKey: env.WATCHMODE_API_KEY?.trim() || undefined }, this.watchmodeHttp);
    this.youtube = new YoutubeAdapter({ apiKey: env.YOUTUBE_API_KEY?.trim() || undefined }, ytHttp);
    this.defaultRegion = normalizeRegion(env.CATALOG_DEFAULT_REGION, DEFAULT_CATALOG_REGION);
    const max = Number(env.CATALOG_CACHE_MAX_ENTRIES);
    this.cache = new TtlCache({ maxEntries: Number.isFinite(max) && max >= 50 ? Math.min(max, 20000) : 1000, now: this.now });
  }

  get configured(): boolean {
    return this.tmdb.configured;
  }
  get availabilityEnabled(): boolean {
    return this.watchmode.configured;
  }
  status() {
    return { configured: this.configured, availability: this.availabilityEnabled, trailers: this.youtube.configured, defaultRegion: this.defaultRegion };
  }
  private need(): void {
    if (!this.configured) throw new CatalogNotConfiguredError();
  }
  private cached<T>(key: string, policy: { ttlMs: number; staleMs?: number }, loader: () => Promise<T>): Promise<T> {
    return this.cache.get(key, loader as () => Promise<unknown>, policy) as Promise<T>;
  }

  // ---- metadata -----------------------------------------------------------------------------------------------
  async genres(): Promise<CatalogGenre[]> {
    this.need();
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
    return this.cached(`trend:${type}:${region}:${page}`, TTL.trending, () => this.tmdb.trending(type, region, page));
  }

  async details(mediaType: CatalogMediaType, id: string, region: string): Promise<CatalogTitle | null> {
    this.need();
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
    this.need();
    return this.cached(`rec:${mediaType}:${id}:${page}`, TTL.details, () => this.tmdb.recommendations(mediaType, id, region, page));
  }

  // ---- availability ---------------------------------------------------------------------------------------------
  private sourceList(region: string): Promise<Map<number, SourceInfo>> {
    return this.cached(`src:${region}`, TTL.genres, () => this.watchmode.sourceList(region));
  }

  /**
   * Verified offers for a title in a region, or null when availability cannot be verified (not configured, id not
   * known to Watchmode, upstream error). null is "unknown", never "not available".
   */
  async providersFor(mediaType: CatalogMediaType, id: string, region: string): Promise<ProviderOffer[] | null> {
    this.need();
    const freeMovie = mediaType === 'movie' ? (freeMoviesData as any[]).find((f: any) => String(f.tmdbId) === id) : null;
    let freeOffer: ProviderOffer | null = null;
    if (freeMovie) {
      const url = freeMovie.streamUrl || freeMovie.youtubeUrl || '';
      const isYoutube = url.includes('youtu');
      freeOffer = {
        id: isYoutube ? 'free_youtube' : 'free_stream',
        name: isYoutube ? 'YouTube (Free)' : 'Internet Archive (Free Cinema)',
        type: 'free',
        logoUrl: isYoutube
          ? 'https://www.youtube.com/s/desktop/f17255be/img/favicon_144x144.png'
          : 'https://archive.org/images/glogo.png',
        destinationUrl: url,
        verified: true,
        capabilities: EMBEDDED_PROVIDER_CAPABILITIES
      };
    }

    if (!this.watchmode.configured) return freeOffer ? [freeOffer] : null;
    try {
      const wmOffers = await this.cached(`prov:${mediaType}:${id}:${region}`, TTL.providers, async () => {
        const wmId = await this.cached(`wm:${mediaType}:${id}`, TTL.mapping, () => this.watchmode.mapTmdbId(mediaType, id));
        if (wmId === null) return null as ProviderOffer[] | null;
        return this.watchmode.offers(wmId, region, await this.sourceList(region));
      });
      if (!freeOffer) return wmOffers;
      return [freeOffer, ...(wmOffers ?? [])];
    } catch {
      return freeOffer ? [freeOffer] : null;
    }
  }

  /** Verified destination URL for one provider of a title (used by the room to re-validate server side). */
  async resolveDestinationUrl(titleKey: string, providerId: string, region: string): Promise<string | null> {
    const k = parseTitleKey(titleKey);
    if (!k || !this.configured) return null;
    const offers = await this.providersFor(k.mediaType, k.sourceId, region);
    const hit = offers?.find((o) => o.id === providerId && o.verified && o.destinationUrl);
    return hit?.destinationUrl ?? null;
  }

  /** Attaches verified providers (best effort, bounded concurrency). Titles that cannot be verified keep `providers: []`. */
  async attachProviders(titles: CatalogTitle[], region: string, max = 20): Promise<{ titles: CatalogTitle[]; verified: Set<string> }> {
    const verified = new Set<string>();
    if (!this.watchmode.configured) return { titles, verified };
    const head = titles.slice(0, max);
    const done = await mapLimit(head, 4, async (t) => {
      const offers = await this.providersFor(t.mediaType, t.sourceId, region);
      if (offers) verified.add(t.id);
      return offers ? { ...t, providers: offers, region } : t;
    });
    return { titles: [...done, ...titles.slice(max)], verified };
  }

  private async detailsMany(titles: CatalogTitle[], region: string, max: number): Promise<CatalogTitle[]> {
    const head = titles.slice(0, max);
    const out = await mapLimit(head, 4, (t) => this.details(t.mediaType, t.sourceId, region).catch(() => null));
    return out.filter(Boolean) as CatalogTitle[];
  }

  // ---- search -----------------------------------------------------------------------------------------------------
  async search(p: SearchParams): Promise<SearchResult> {
    this.need();
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
    this.need();
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
