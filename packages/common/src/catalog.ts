/**
 * Cineverse shared types and pure helpers (used by the server catalog service and the web app).
 *
 * Five concepts are kept apart on purpose (never mix them in one field):
 *  1. catalog metadata        -> CatalogTitle (TMDB)
 *  2. streaming availability  -> ProviderOffer (licensed availability source), only with `verified: true`
 *  3. provider destination URL-> ProviderOffer.destinationUrl (https only, validated)
 *  4. playback capability     -> TitleCapabilities.playback (can WE play it inside the room?)
 *  5. room sync capability    -> TitleCapabilities.roomSync (how far can the room coordinate it?)
 */

export type CatalogSource = 'tmdb';
export type CatalogMediaType = 'movie' | 'tv';
export type ProviderOfferType = 'subscription' | 'rent' | 'buy' | 'free';

export interface ProviderOffer {
  /** Id in the availability source (Watchmode source id as a string). */
  id: string;
  name: string;
  type: ProviderOfferType;
  /** Logo URL from the availability source (https only) or null. Never guessed. */
  logoUrl: string | null;
  /** Deep link to the provider's page for this title, only when the source returned a valid https URL. */
  destinationUrl: string | null;
  /** true only when the licensed availability source confirmed this offer for `region`. */
  verified: boolean;
  /** What the room can do with this provider (concepts 4 and 5). Filled by the server. */
  capabilities?: TitleCapabilities;
}

export interface Person {
  id: number;
  name: string;
  role: string | null;
  profilePath: string | null;
}

export interface CatalogTitle {
  /** `${source}:${mediaType}:${sourceId}` */
  id: string;
  source: CatalogSource;
  sourceId: string;
  mediaType: CatalogMediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  genres: Array<{ id: number; name: string }>;
  runtimeMinutes: number | null;
  rating: number | null;
  ratingSource: 'TMDB';
  voteCount: number;
  /** Only filled on detail / provider requests. Empty array means "none verified", not "unavailable". */
  providers: ProviderOffer[];
  region: string;
  externalUrl: string | null;
  /** TV only, from the details payload. */
  seasons?: number | null;
  episodes?: number | null;
  tagline?: string | null;
  cast?: Person[];
  crew?: Person[];
  /** Short YouTube trailer id when the YouTube adapter is configured. */
  trailerYoutubeId?: string | null;
  popularity?: number | null;
  genreIds?: number[];
  /** Stream URL for free movies (e.g. YouTube full movie or direct video link) */
  freeStreamUrl?: string | null;
}

/**
 * Deduplicate catalog titles so a movie can only show ONE time.
 * Deduplicates by:
 * 1. Unique source ID (`source:mediaType:sourceId`)
 * 2. Normalized title (alphanumeric lowercase)
 * 3. Title + TMDB rating combination
 */
export function deduplicateTitles(titles: CatalogTitle[]): CatalogTitle[] {
  const seenIds = new Set<string>();
  const seenNormalizedTitles = new Set<string>();
  const seenTitleRatings = new Set<string>();

  const result: CatalogTitle[] = [];

  for (const t of titles) {
    if (!t || !t.id || !t.title) continue;

    const idKey = `${t.source}:${t.mediaType}:${t.sourceId}`.toLowerCase();
    if (seenIds.has(idKey)) continue;

    const normalizedTitle = t.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedTitle && seenNormalizedTitles.has(normalizedTitle)) continue;

    const ratingKey = `${normalizedTitle}-${Math.round((t.rating ?? 0) * 10)}`;
    if (seenTitleRatings.has(ratingKey)) continue;

    seenIds.add(idKey);
    if (normalizedTitle) seenNormalizedTitles.add(normalizedTitle);
    seenTitleRatings.add(ratingKey);
    result.push(t);
  }

  return result;
}

export interface TitleCapabilities {
  /** 'embedded' = playable inside the room (YouTube / direct file via the existing player). 'none' = external service. */
  playback: 'none' | 'embedded';
  /** 'coordinated_start' = countdown + link + manual ready. Never frame-accurate sync for external services. */
  roomSync: 'coordinated_start' | 'full';
}

export const EXTERNAL_PROVIDER_CAPABILITIES: TitleCapabilities = { playback: 'none', roomSync: 'coordinated_start' };
export const EMBEDDED_PROVIDER_CAPABILITIES: TitleCapabilities = { playback: 'embedded', roomSync: 'full' };

/** YouTube is the only provider the room can play itself (existing `media:change` machinery). */
export function capabilitiesForProvider(providerName: string | null | undefined): TitleCapabilities {
  return /^youtube$/i.test((providerName || '').trim()) ? EMBEDDED_PROVIDER_CAPABILITIES : EXTERNAL_PROVIDER_CAPABILITIES;
}

export interface CatalogPage {
  results: CatalogTitle[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface CatalogGenre {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Title keys
// ---------------------------------------------------------------------------------------------------------------

export function makeTitleKey(source: CatalogSource, mediaType: CatalogMediaType, sourceId: string | number): string {
  return `${source}:${mediaType}:${sourceId}`;
}

const TITLE_KEY_RE = /^(tmdb):(movie|tv):([0-9]{1,10})$/;
export function parseTitleKey(key: unknown): { source: CatalogSource; mediaType: CatalogMediaType; sourceId: string } | null {
  if (typeof key !== 'string' || key.length > 40) return null;
  const m = TITLE_KEY_RE.exec(key);
  return m ? { source: m[1] as CatalogSource, mediaType: m[2] as CatalogMediaType, sourceId: m[3] } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Images: only ever built from a fixed base + size + a validated path
// ---------------------------------------------------------------------------------------------------------------

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const TMDB_IMAGE_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'w1280', 'original'] as const;
export type TmdbImageSize = (typeof TMDB_IMAGE_SIZES)[number];
const IMAGE_PATH_RE = /^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/;

export function isValidImagePath(path: unknown): path is string {
  return typeof path === 'string' && path.length <= 100 && IMAGE_PATH_RE.test(path);
}
export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize): string | null {
  if (!isValidImagePath(path)) return null;
  if (!(TMDB_IMAGE_SIZES as readonly string[]).includes(size)) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}
const SIZE_WIDTH: Record<string, number> = { w92: 92, w154: 154, w185: 185, w342: 342, w500: 500, w780: 780, w1280: 1280 };
export function tmdbSrcSet(path: string | null | undefined, sizes: TmdbImageSize[]): string | undefined {
  const parts: string[] = [];
  for (const s of sizes) {
    const u = tmdbImageUrl(path, s);
    if (u && SIZE_WIDTH[s]) parts.push(`${u} ${SIZE_WIDTH[s]}w`);
  }
  return parts.length ? parts.join(', ') : undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// External URL safety
// ---------------------------------------------------------------------------------------------------------------

/**
 * A provider destination link is accepted only when it is an https URL with a real DNS host (no credentials, no IP
 * literal, no localhost/internal names). Returns the normalised URL or null. Never throws.
 */
export function safeProviderUrl(value: unknown, maxLen = 2048): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) return null;
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('[') || /^[0-9.]+$/.test(host)) return null;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null; // punycode only, no odd unicode lookalikes
  return u.toString();
}

// ---------------------------------------------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------------------------------------------

export const DEFAULT_CATALOG_REGION = 'IN';
/** ISO 3166-1 alpha-2 allowlist (countries Watchmode / TMDB watch-providers cover, plus the common rest). */
export const CATALOG_REGIONS: readonly string[] = (
  'AD AE AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BM BO BR BS BY BZ CA CD CH CI CL CM CN CO CR CU CV CY CZ DE DK DO DZ EC EE EG ES FI FJ FR GB GE GH GI GR GT GY HK HN HR HU ID IE IL IN IQ IS IT JM JO JP KE KR KW KZ LB LC LI LK LT LU LV LY MA MC MD ME MK ML MT MU MX MY MZ NE NG NI NL NO NP NZ OM PA PE PF PG PH PK PL PS PT PY QA RO RS RU SA SE SG SI SK SM SN SV TH TN TR TT TW TZ UA UG US UY VA VE VN XK YE ZA ZM ZW'
).split(' ');
const REGION_SET = new Set(CATALOG_REGIONS);
export function normalizeRegion(value: unknown, fallback: string = DEFAULT_CATALOG_REGION): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim().toUpperCase();
  return REGION_SET.has(v) ? v : fallback;
}

// ---------------------------------------------------------------------------------------------------------------
// Query / filter vocabulary
// ---------------------------------------------------------------------------------------------------------------

export const CATALOG_SORTS = ['popularity', 'rating', 'release'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
export const CATALOG_TYPES = ['all', 'movie', 'tv'] as const;
export type CatalogTypeFilter = (typeof CATALOG_TYPES)[number];

/** Provider filter vocabulary. Matching is by normalised provider name against verified availability. */
export const PROVIDER_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'netflix', label: 'Netflix' },
  { id: 'prime', label: 'Prime Video' },
  { id: 'jiohotstar', label: 'JioHotstar' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'disney', label: 'Disney+' },
  { id: 'apple', label: 'Apple TV+' },
  { id: 'sonyliv', label: 'SonyLIV' },
  { id: 'zee5', label: 'ZEE5' }
];
const PROVIDER_ALIASES: Array<[string, RegExp]> = [
  ['netflix', /netflix/i],
  ['prime', /(amazon|prime)\s*video|^amazon prime|primevideo/i],
  ['jiohotstar', /jio\s*hotstar|hotstar|jiocinema/i],
  ['youtube', /youtube/i],
  ['disney', /disney/i],
  ['apple', /apple\s*tv/i],
  ['sonyliv', /sony\s*liv/i],
  ['zee5', /zee\s*5/i]
];
/** Maps a provider display name to one of PROVIDER_FILTERS ids, or a slug of the name for other providers. */
export function providerKey(name: string): string {
  for (const [id, re] of PROVIDER_ALIASES) if (re.test(name)) return id;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
}

// ---------------------------------------------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------------------------------------------

export const WATCHLIST_MAX_ITEMS = 500;
export interface TitleSnapshot {
  titleKey: string;
  title: string;
  posterPath: string | null;
  year: number | null;
  mediaType: CatalogMediaType;
}
/** A catalog title on the watchlist. Documents written before link items existed have no `kind` and mean this. */
export interface WatchlistTitleItem extends TitleSnapshot {
  kind: 'title';
  addedAt: number;
}
/** A link the person added themselves (YouTube video, streaming page, any https page). */
export interface WatchlistLinkItem {
  kind: 'link';
  /** `link:` + a stable hash of the normalised URL (see linkTitleKey) */
  titleKey: string;
  title: string;
  url: string;
  /** short display label, for example "YouTube" or "Netflix" */
  platform: string;
  thumbnail: string | null;
  category: string | null;
  tagline: string | null;
  addedAt: number;
}
/** What the unified watchlist holds: one list per account, both kinds, newest first. */
export type WatchlistItem = WatchlistTitleItem | WatchlistLinkItem;
/** The fields a client supplies for a new link item (the server derives titleKey, platform and thumbnail defaults). */
export interface LinkSnapshot {
  title: string;
  url: string;
  platform?: string | null;
  thumbnail?: string | null;
  category?: string | null;
  tagline?: string | null;
}

export const isTitleItem = (i: WatchlistItem): i is WatchlistTitleItem => i.kind !== 'link';
export const isLinkItem = (i: WatchlistItem): i is WatchlistLinkItem => i.kind === 'link';

// ---- link items ----------------------------------------------------------------------------------------------------

export const LINK_KEY_RE = /^link:[0-9a-f]{16}$/;
export const LINK_URL_MAX = 2048;
export const LINK_TITLE_MAX = 200;
export const LINK_PLATFORM_MAX = 40;
export const LINK_CATEGORY_MAX = 60;
export const LINK_TAGLINE_MAX = 140;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
export const hasControlChars = (v: string): boolean => CONTROL_CHARS_RE.test(v);

/** True for either kind of watchlist key: `source:mediaType:id` or `link:<16 hex>`. */
export function isWatchlistKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= 40 && (LINK_KEY_RE.test(key) || parseTitleKey(key) !== null);
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);
/** The 11-character YouTube video id of a YouTube URL (watch, youtu.be, embed, shorts, live, v), else null. */
export function youtubeIdFromUrl(value: string): string | null {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null;
  const id = u.hostname.toLowerCase() === 'youtu.be' ? u.pathname.split('/')[1] : u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|shorts|live|v)\/([^/]+)/.exec(u.pathname)?.[2];
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export const youtubeThumbnail = (id: string): string => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

/**
 * Normalises a user-supplied link: https only, no credentials, a real DNS host (same rules as provider links),
 * no fragment, lower-case host, default port dropped, YouTube links reduced to one canonical watch URL.
 * Returns null for anything else (javascript:, data:, http:, IP literals, control characters, over-long values).
 */
export function normalizeLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > LINK_URL_MAX || hasControlChars(raw) || /\s/.test(raw)) return null;
  const safe = safeProviderUrl(raw, LINK_URL_MAX);
  if (!safe) return null;
  const yt = youtubeIdFromUrl(safe);
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  const u = new URL(safe);
  u.hash = '';
  if (u.port === '443') u.port = '';
  if (u.pathname === '/' && !u.search) return `https://${u.hostname.toLowerCase()}/`;
  const out = u.toString();
  return out.length <= LINK_URL_MAX ? out : null;
}

/** Two independent 32-bit FNV-1a style hashes joined to 16 hex characters (no crypto dependency, works in the browser). */
function hash64(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((c * 31 + i) & 0xffff), 0x85ebca6b) >>> 0;
    b = (b ^ (b >>> 13)) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
/** Stable key of a link item: the same page always gives the same key, so a duplicate add is rejected by the unique index. */
export function linkTitleKey(url: string): string | null {
  const n = normalizeLinkUrl(url);
  return n ? `link:${hash64(n)}` : null;
}

const PLATFORM_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$|youtube-nocookie\.com$/, 'YouTube'],
  [/(^|\.)netflix\.com$/, 'Netflix'],
  [/(^|\.)(primevideo\.com|amazon\.[a-z.]+)$/, 'Prime Video'],
  [/(^|\.)(hotstar\.com|jiohotstar\.com|jiocinema\.com)$/, 'JioHotstar'],
  [/(^|\.)disneyplus\.com$/, 'Disney+'],
  [/(^|\.)tv\.apple\.com$/, 'Apple TV+'],
  [/(^|\.)(sonyliv\.com)$/, 'SonyLIV'],
  [/(^|\.)zee5\.com$/, 'ZEE5'],
  [/(^|\.)vimeo\.com$/, 'Vimeo']
];
/** Display label for a link's site: a known service name, else the host without "www.". */
export function platformFromUrl(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'Link';
  }
  for (const [re, label] of PLATFORM_HOSTS) if (re.test(host)) return label;
  return host.replace(/^www\./, '').slice(0, LINK_PLATFORM_MAX) || 'Link';
}

export function snapshotOf(t: Pick<CatalogTitle, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'mediaType'>): TitleSnapshot {
  const y = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : NaN;
  return { titleKey: t.id, title: t.title, posterPath: isValidImagePath(t.posterPath) ? t.posterPath : null, year: Number.isFinite(y) && y > 1800 ? y : null, mediaType: t.mediaType };
}

// ---------------------------------------------------------------------------------------------------------------
// Matchmaker
// ---------------------------------------------------------------------------------------------------------------

export const MATCH_MOODS = ['chill', 'thrilling', 'funny', 'romantic', 'mind-bending', 'nostalgic'] as const;
export type MatchMood = (typeof MATCH_MOODS)[number];
export const MATCH_TIMES = ['under30', 'under90', 'longer'] as const;
export type MatchTime = (typeof MATCH_TIMES)[number];
export const MATCH_MODES = ['solo', 'group'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export interface MatchmakerRequest {
  mood: MatchMood;
  time: MatchTime;
  genres: number[];
  providers: string[];
  mode: MatchMode;
  seed: string;
  region?: string;
}
export interface MatchmakerPick {
  title: CatalogTitle;
  score: number;
  /** One line built only from criteria that actually matched. */
  reason: string;
}
export interface MatchmakerResponse {
  picks: MatchmakerPick[];
  /** Deterministic choice among the top scorers for this seed (same seed => same pick). */
  pickIndex: number;
  availabilityChecked: boolean;
  method: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Watch-party title queue (room protocol)
// ---------------------------------------------------------------------------------------------------------------

export const TITLE_QUEUE_MAX = 5;
export const TITLE_COUNTDOWN_MAX_MS = 10 * 60_000;

export const TITLE_MESSAGE_TYPES = ['room:title_propose', 'room:title_vote', 'room:title_confirm', 'room:title_ready', 'room:title_clear'] as const;

export interface TitleProposePayload {
  titleKey: string;
  snapshot: TitleSnapshot;
  provider?: { id: string; name: string } | null;
}
export interface TitleVotePayload {
  titleKey: string;
}
export interface TitleConfirmPayload {
  titleKey: string;
  /** needed only when the title was never proposed (the host can confirm any title) */
  snapshot?: TitleSnapshot;
  provider?: { id: string; name: string } | null;
  /** region used by the server to re-validate the provider link (ISO alpha-2) */
  region?: string;
  /** epoch ms of the synchronized start; must be in the future and within TITLE_COUNTDOWN_MAX_MS */
  startAt?: number | null;
  /** the version of the title state the host saw (stale confirms are ignored) */
  version?: number;
}
export interface TitleReadyPayload {
  titleKey: string;
  version?: number;
}
export interface TitleClearPayload {
  version?: number;
}

export interface TitleQueueEntry {
  titleKey: string;
  snapshot: TitleSnapshot;
  proposedBy: { userId: string; displayName: string };
  provider: { id: string; name: string } | null;
  /** user ids of members who voted (the proposer's own vote is included at propose time) */
  votes: string[];
  proposedAt: number;
}
export interface SelectedTitle {
  titleKey: string;
  snapshot: TitleSnapshot;
  provider: { id: string; name: string } | null;
  /** Re-validated on the server and only present if the catalog service returned it for this provider. */
  destinationUrl: string | null;
  capabilities: TitleCapabilities;
  startAt: number | null;
  ready: string[];
  confirmedBy: { userId: string; displayName: string };
  confirmedAt: number;
}
export interface TitleRoomState {
  /** Increments on every accepted change. */
  version: number;
  /** The `version` at which `selected` last changed; confirm/ready/clear older than this are stale. */
  selectionVersion: number;
  queue: TitleQueueEntry[];
  selected: SelectedTitle | null;
}
export interface TitleStatePayload {
  state: TitleRoomState;
  serverTime: number;
}
export const EMPTY_TITLE_STATE: TitleRoomState = { version: 0, selectionVersion: 0, queue: [], selected: null };
