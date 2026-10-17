import {
  tvmazeBackdropPathFromUrl,
  tvmazeImagePathFromUrl,
  makeTitleKey,
  type CatalogTitle,
  type EpisodeInfo,
  type Person,
  type SeasonInfo
} from '@synccinema/common';
import { UpstreamClient, UpstreamError, type FetchLike } from '../upstream.js';

/**
 * TVmaze adapter (https://www.tvmaze.com/api). No key. Data is CC BY-SA 4.0: credit TVmaze (the UI shows it whenever
 * TVmaze data is on the page) and keep TVmaze-derived fields tagged: every record built here has `source: 'tvmaze'`,
 * `ratingSource: 'TVmaze'` and, when merged into a TMDB title, `sources` lists both.
 *
 * Endpoints used (all GET, base https://api.tvmaze.com):
 *   /search/shows?q=                       fuzzy search, results are { score, show }
 *   /shows/:id?embed[]=cast&embed[]=seasons&embed[]=nextepisode&embed[]=previousepisode&embed[]=images
 *   /shows/:id/episodes                    regular episodes (specials excluded by default)
 *   /schedule?country=IN&date=YYYY-MM-DD   TV airings of a day; each item carries its `show`
 *   /schedule/web?country=IN&date=...      web / streaming airings; the show is in `_embedded.show`
 *   /lookup/shows?imdb=tt... | ?thetvdb=   301 to /shows/:id (the fetch follows it), 404 when unknown
 *
 * Limits: the API allows at least 20 calls per 10 s per IP. TvmazeLimiter keeps us at <= 15 per 10 s with a small
 * queue, so bursts wait instead of tripping a 429. A 429 that still happens is retried by UpstreamClient (Retry-After).
 */

export const TVMAZE_BASE = 'https://api.tvmaze.com';
export const DEFAULT_TVMAZE_USER_AGENT = 'WatchPartyCatalog/1.0 (+https://watch.stitchbyte.in)';

/** Allowed shape of a User-Agent value we send (printable ASCII, bounded). */
export function cleanUserAgent(v: unknown): string {
  if (typeof v !== 'string') return DEFAULT_TVMAZE_USER_AGENT;
  const t = v.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 200);
  return t.length >= 8 ? t : DEFAULT_TVMAZE_USER_AGENT;
}

// ---- rate limiter ------------------------------------------------------------------------------------------------

export interface TvmazeLimiterOptions {
  /** calls allowed per window (default 15, below TVmaze's documented 20 per 10 s) */
  max?: number;
  windowMs?: number;
  /** waiting callers beyond this are refused (default 200) */
  maxQueue?: number;
  /** a caller that would have to wait longer than this is refused instead (default 30 s) */
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
/** Sliding-window token bucket with a FIFO queue. Everything time related is injectable. */
export class TvmazeLimiter {
  private stamps: number[] = [];
  private tail: Promise<void> = Promise.resolve();
  private waiting = 0;
  private max: number;
  private windowMs: number;
  private maxQueue: number;
  private maxWaitMs: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  constructor(o: TvmazeLimiterOptions = {}) {
    this.max = Math.max(1, o.max ?? 15);
    this.windowMs = o.windowMs ?? 10_000;
    this.maxQueue = o.maxQueue ?? 200;
    this.maxWaitMs = o.maxWaitMs ?? 30_000;
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  get queued(): number {
    return this.waiting;
  }
  /** Resolves when a call may be made now. Calls are released in arrival order. */
  acquire(): Promise<void> {
    if (this.waiting >= this.maxQueue) return Promise.reject(new UpstreamError('network', null, 'tvmaze'));
    this.waiting++;
    const run = this.tail.then(async () => {
      try {
        const start = this.now();
        for (;;) {
          const t = this.now();
          this.stamps = this.stamps.filter((s) => t - s < this.windowMs);
          if (this.stamps.length < this.max) {
            this.stamps.push(t);
            return;
          }
          const wait = this.stamps[0] + this.windowMs - t;
          if (t - start + wait > this.maxWaitMs) throw new UpstreamError('network', null, 'tvmaze');
          await this.sleep(Math.max(1, wait));
        }
      } finally {
        this.waiting--;
      }
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
}

// ---- sanitising ---------------------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
/**
 * TVmaze summaries are HTML. This returns PLAIN TEXT: script/style blocks dropped, tags removed, entities decoded,
 * whitespace collapsed, and any leftover angle bracket removed (so nothing that looks like markup can survive).
 * The UI renders the result as a text node, never as HTML.
 */
export function htmlToText(html: unknown, max = 2000): string {
  if (typeof html !== 'string' || !html) return '';
  let t = html.slice(0, 20_000);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ');
  t = t.replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, ' ');
  t = t.replace(/<[^>]*>/g, ' ');
  t = t.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 31 && code < 0x110000 && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ' ';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  // decoded text may now contain "<" or ">": drop them, plus control characters
  // eslint-disable-next-line no-control-regex
  t = t.replace(/[<>\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 3).trimEnd()}...` : t;
}

/** An https URL on tvmaze.com (the show page we link back to). null for anything else. */
export function tvmazePageUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 300) return null;
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return host === 'www.tvmaze.com' || host === 'tvmaze.com' ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---- normalisation -----------------------------------------------------------------------------------------------

const str = (v: unknown, max = 300): string => (typeof v === 'string' ? v.slice(0, max) : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);

/** TVmaze genre names with stable numeric ids (the shared model has numeric genre ids; TMDB ids are not reused). */
export const TVMAZE_GENRES: readonly string[] = [
  'Action', 'Adventure', 'Anime', 'Children', 'Comedy', 'Crime', 'DIY', 'Drama', 'Espionage', 'Family', 'Fantasy', 'Food', 'History', 'Horror',
  'Legal', 'Medical', 'Music', 'Mystery', 'Nature', 'Romance', 'Science-Fiction', 'Sports', 'Supernatural', 'Thriller', 'Travel', 'War', 'Western'
];
export function tvmazeGenreId(name: string): number {
  const i = TVMAZE_GENRES.indexOf(name);
  if (i >= 0) return 10_001 + i;
  let h = 0x811c9dc5;
  for (let k = 0; k < name.length; k++) h = Math.imul(h ^ name.charCodeAt(k), 0x01000193) >>> 0;
  return 20_000 + (h % 10_000);
}
export const tvmazeGenreList = (): Array<{ id: number; name: string }> => TVMAZE_GENRES.map((name) => ({ id: tvmazeGenreId(name), name })).sort((a, b) => a.name.localeCompare(b.name));

function person(raw: any, role: string | null): Person | null {
  const p = raw?.person;
  if (!p || !posInt(p.id) || typeof p.name !== 'string' || !p.name.trim()) return null;
  return { id: p.id, name: p.name.trim().slice(0, 120), role: role ? role.slice(0, 120) : null, profilePath: tvmazeImagePathFromUrl(p.image?.original) };
}

/**
 * Normalise a TVmaze show (list item, search hit, schedule show or `/shows/:id` with embeds). Missing fields become
 * null / empty, never guessed. Returns null when the payload has no usable id or name.
 */
export function normalizeTvmazeShow(raw: any, region: string): CatalogTitle | null {
  const id = posInt(raw?.id);
  const name = str(raw?.name, 300).trim();
  if (!id || String(id).length > 10 || !name) return null;
  const emb = raw._embedded && typeof raw._embedded === 'object' ? raw._embedded : {};
  const genreNames: string[] = Array.isArray(raw.genres) ? raw.genres.filter((g: unknown) => typeof g === 'string' && g.trim()).map((g: string) => g.trim().slice(0, 40)) : [];
  const genres = genreNames.map((g) => ({ id: tvmazeGenreId(g), name: g }));
  const avg = numOrNull(raw.rating?.average);
  const rating = avg !== null && avg > 0 && avg <= 10 ? Math.round(avg * 10) / 10 : null;
  const runtime = posInt(raw.runtime) ?? posInt(raw.averageRuntime);
  const images: any[] = Array.isArray(emb.images) ? emb.images : [];
  const bg = images.find((i) => i?.type === 'background');
  const poster = images.find((i) => i?.type === 'poster' && i?.main) ?? null;
  const out: CatalogTitle = {
    id: makeTitleKey('tvmaze', 'tv', id),
    source: 'tvmaze',
    sourceId: String(id),
    mediaType: 'tv',
    title: name,
    overview: htmlToText(raw.summary, 2000),
    posterPath: tvmazeImagePathFromUrl(raw.image?.original) ?? tvmazeImagePathFromUrl(poster?.resolutions?.original?.url),
    backdropPath: tvmazeBackdropPathFromUrl(bg?.resolutions?.original?.url),
    releaseDate: date(raw.premiered),
    genres,
    genreIds: genres.map((g) => g.id),
    runtimeMinutes: runtime,
    rating,
    ratingSource: 'TVmaze',
    voteCount: 0, // TVmaze publishes no vote counts
    popularity: numOrNull(raw.weight),
    providers: [],
    region,
    externalUrl: tvmazePageUrl(raw.url),
    sources: ['tvmaze'],
    tvStatus: str(raw.status, 40) || null,
    externalIds: {
      imdb: typeof raw.externals?.imdb === 'string' && /^tt\d{5,10}$/.test(raw.externals.imdb) ? raw.externals.imdb : null,
      tvdb: posInt(raw.externals?.thetvdb) ? String(raw.externals.thetvdb) : null,
      tvmaze: String(id)
    }
  };
  if (rating !== null) out.ratings = [{ source: 'TVmaze', value: rating }];
  if (Array.isArray(emb.seasons)) out.seasons = emb.seasons.filter((s: any) => posInt(s?.number)).length || null;
  if (Array.isArray(emb.cast)) {
    out.cast = emb.cast.slice(0, 8).map((c: any) => person(c, str(c?.character?.name, 120) || null)).filter(Boolean) as Person[];
  }
  if (emb.nextepisode) out.nextEpisode = normalizeTvmazeEpisode(emb.nextepisode, true);
  return out;
}

/** Normalise one episode. Specials without an episode number are dropped (null) unless `allowUnnumbered`. */
export function normalizeTvmazeEpisode(raw: any, allowUnnumbered = false): EpisodeInfo | null {
  const season = typeof raw?.season === 'number' && Number.isInteger(raw.season) && raw.season >= 0 ? raw.season : null;
  const number = posInt(raw?.number);
  if (season === null || (number === null && !allowUnnumbered)) return null;
  const name = str(raw?.name, 200).trim();
  if (!name) return null;
  const summary = htmlToText(raw.summary, 300);
  return { season, number: number ?? 0, name, airdate: date(raw.airdate), runtimeMinutes: posInt(raw.runtime), summary: summary || null };
}

export const MAX_EPISODES = 800;
/** Groups a flat episode list into seasons (ascending). `seasonsRaw` (embedded seasons) adds names and dates when present. */
export function buildSeasonList(episodesRaw: unknown, seasonsRaw?: unknown): SeasonInfo[] {
  const eps = (Array.isArray(episodesRaw) ? episodesRaw : []).slice(0, MAX_EPISODES * 2).map((e) => normalizeTvmazeEpisode(e)).filter(Boolean).slice(0, MAX_EPISODES) as EpisodeInfo[];
  const meta = new Map<number, any>();
  if (Array.isArray(seasonsRaw)) for (const s of seasonsRaw) if (s && Number.isInteger(s.number)) meta.set(s.number, s);
  const by = new Map<number, EpisodeInfo[]>();
  for (const e of eps) {
    if (e.season < 1) continue; // season 0 are specials
    (by.get(e.season) ?? by.set(e.season, []).get(e.season)!).push(e);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, list]) => {
      list.sort((a, b) => a.number - b.number);
      const m = meta.get(number);
      const dates = list.map((e) => e.airdate).filter(Boolean) as string[];
      dates.sort();
      const nm = str(m?.name, 80).trim();
      return { number, name: nm || null, episodeCount: list.length, premiereDate: date(m?.premiereDate) ?? dates[0] ?? null, endDate: date(m?.endDate) ?? dates[dates.length - 1] ?? null, episodes: list };
    });
}

/** Distinct shows of a schedule payload (TV items carry `show`, web items `_embedded.show`). First occurrence wins. */
export function showsFromSchedule(raw: unknown, region: string): CatalogTitle[] {
  const seen = new Set<string>();
  const out: CatalogTitle[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const t = normalizeTvmazeShow(item?.show ?? item?._embedded?.show, region);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}
/** Search hits keep TVmaze's relevance order. */
export function showsFromSearch(raw: unknown, region: string): CatalogTitle[] {
  const out: CatalogTitle[] = [];
  for (const hit of Array.isArray(raw) ? raw : []) {
    const t = normalizeTvmazeShow(hit?.show, region);
    if (t) out.push(t);
  }
  return out;
}

/** Order by TVmaze rating, then weight (TVmaze's own popularity score, 0 to 100), then name. */
export function sortByRatingThenWeight(list: CatalogTitle[]): CatalogTitle[] {
  return [...list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.popularity ?? 0) - (a.popularity ?? 0) || a.title.localeCompare(b.title));
}
/** Order by weight (popularity), then rating. */
export function sortByWeight(list: CatalogTitle[]): CatalogTitle[] {
  return [...list].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title));
}

// ---- adapter ------------------------------------------------------------------------------------------------------

export interface TvmazeConfig {
  enabled: boolean;
  userAgent?: string;
}
export const SHOW_EMBEDS = ['cast', 'seasons', 'nextepisode', 'previousepisode', 'images'] as const;

export class TvmazeAdapter {
  readonly userAgent: string;
  constructor(private cfg: TvmazeConfig, private http: UpstreamClient) {
    this.userAgent = cleanUserAgent(cfg.userAgent);
  }
  get enabled(): boolean {
    return this.cfg.enabled;
  }
  private async get<T = any>(path: string): Promise<T | null> {
    try {
      return await this.http.getJson<T>(`${TVMAZE_BASE}${path}`, { 'User-Agent': this.userAgent, Accept: 'application/json' });
    } catch (e) {
      if (e instanceof UpstreamError && e.kind === 'http' && (e.status === 404 || e.status === 400)) return null; // unknown id / lookup miss
      throw e;
    }
  }

  async search(q: string, region: string): Promise<CatalogTitle[]> {
    return showsFromSearch(await this.get(`/search/shows?q=${encodeURIComponent(q.slice(0, 100))}`), region);
  }
  /** Full show page with cast, seasons, next/previous episode and images embedded. null when TVmaze has no such show. */
  async show(id: string, region: string): Promise<CatalogTitle | null> {
    if (!/^\d{1,10}$/.test(id)) return null;
    const embeds = SHOW_EMBEDS.map((e) => `embed[]=${e}`).join('&');
    const raw = await this.get(`/shows/${id}?${embeds}`);
    return raw ? normalizeTvmazeShow(raw, region) : null;
  }
  /** Seasons with episode lists (specials excluded) plus the embedded season names. */
  async seasons(id: string): Promise<SeasonInfo[] | null> {
    if (!/^\d{1,10}$/.test(id)) return null;
    const raw = await this.get(`/shows/${id}/episodes`);
    return raw === null ? null : buildSeasonList(raw);
  }
  async schedule(country: string, day: string, region: string): Promise<CatalogTitle[]> {
    if (!/^[A-Z]{2}$/.test(country) || !DATE_RE.test(day)) throw new Error('Bad schedule parameters');
    return showsFromSchedule(await this.get(`/schedule?country=${country}&date=${day}`), region);
  }
  async webSchedule(country: string | null, day: string, region: string): Promise<CatalogTitle[]> {
    if ((country !== null && !/^[A-Z]{2}$/.test(country)) || !DATE_RE.test(day)) throw new Error('Bad schedule parameters');
    const c = country ? `&country=${country}` : '';
    return showsFromSchedule(await this.get(`/schedule/web?date=${day}${c}`), region);
  }
  /** Maps an external id to a TVmaze show id (as a string). null when TVmaze does not know the id. */
  async lookup(ids: { imdb?: string | null; tvdb?: string | number | null }): Promise<string | null> {
    const imdb = ids.imdb && /^tt\d{5,10}$/.test(ids.imdb) ? ids.imdb : null;
    const tvdb = ids.tvdb !== null && ids.tvdb !== undefined && /^\d{1,10}$/.test(String(ids.tvdb)) ? String(ids.tvdb) : null;
    for (const q of [imdb && `imdb=${imdb}`, tvdb && `thetvdb=${tvdb}`]) {
      if (!q) continue;
      const raw: any = await this.get(`/lookup/shows?${q}`);
      const id = posInt(raw?.id);
      if (id) return String(id);
    }
    return null;
  }
}

/** Wraps a fetch so every call first waits for the limiter (so retries are limited too). */
export function limitedFetch(base: FetchLike, limiter: TvmazeLimiter): FetchLike {
  return async (url, init) => {
    await limiter.acquire();
    return base(url, init);
  };
}
