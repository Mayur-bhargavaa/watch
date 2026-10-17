import type { DiscoverOpts } from './adapters/tmdb.js';
import type { CatalogMediaType, CatalogTitle } from '@synccinema/common';

/**
 * Curated collections. Each one is defined HERE (and only here); the one-line `howWePick` is shown to users as the
 * "How we pick these" caption, so it must stay an honest description of the selection logic below it.
 * Genre ids: 35 Comedy, 16 Animation, 10751 Family, 53 Thriller, 9648 Mystery, 878 Science Fiction, 10765 TV Sci-Fi & Fantasy.
 */
export type CollectionKind = 'spotlight' | 'trending' | 'discover' | 'personal' | 'platforms' | 'free' | 'tv-airing-india' | 'tv-popular';

export interface CollectionQuery {
  mediaType: CatalogMediaType;
  opts: DiscoverOpts;
}
export interface CollectionDef {
  slug: string;
  title: string;
  eyebrow: string;
  howWePick: string;
  kind: CollectionKind;
  limit: number;
  queries?: CollectionQuery[];
  /** queries that depend on today's date (UTC, YYYY-MM-DD): release windows. Used instead of `queries` when present. */
  buildQueries?: (today: string) => CollectionQuery[];
  /** how the result lists are combined: round-robin (default) or one list ordered by TMDB popularity (stable, ties keep query order) */
  merge?: 'interleave' | 'popularity';
  /** post filter on list items (list payloads carry rating, votes, popularity, genres); `ctx.today` is the UTC date */
  filter?: (t: CatalogTitle, ctx: { today: string }) => boolean;
  /** TV items need their details (seasons / episodes) before they can pass `detailFilter` */
  detailFilter?: (t: CatalogTitle) => boolean;
  detailMediaTypes?: CatalogMediaType[];
}

/** TMDB "popularity" above this is considered mainstream and is dropped from Hidden Gems. */
export const HIDDEN_GEMS_MAX_POPULARITY = 60;

/** Indian collections (TMDB original language / origin country, popularity ranked). */
export const INDIAN_MIN_VOTES = { bollywood: 150, south: 100, series: 50, recent: 5 } as const;
/** "Trending in India" looks at titles released in roughly the last 120 days. */
export const TRENDING_INDIA_WINDOW_DAYS = 120;
/** South Indian languages, one TMDB discover call each (with_original_language accepts one code). */
export const SOUTH_INDIAN_LANGUAGES = ['ta', 'te', 'ml', 'kn'] as const;

export function addDaysUtc(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const releasedBy = (t: CatalogTitle, today: string) => !t.releaseDate || t.releaseDate <= today;

export const COLLECTIONS: CollectionDef[] = [
  {
    slug: 'free-movies',
    title: 'Watch Free Movies',
    eyebrow: 'Free Cinema',
    howWePick: 'Full-length movies available to stream completely free in synchronized cinema rooms with friends, paired with TMDB ratings and deduplicated.',
    kind: 'free',
    limit: 20
  },
  {
    slug: 'spotlight',
    title: "Tonight's Spotlight",
    eyebrow: 'Featured',
    howWePick: 'One title from this week\'s TMDB trending list with a backdrop, chosen by the date so it stays the same all day.',
    kind: 'spotlight',
    limit: 1
  },
  {
    slug: 'trending',
    title: 'Trending Across the Universe',
    eyebrow: 'This week',
    howWePick: 'TMDB\'s weekly trending list for movies and TV, in TMDB order.',
    kind: 'trending',
    limit: 20
  },
  {
    slug: 'trending-india',
    title: 'Trending in India',
    eyebrow: 'Recent releases',
    howWePick: 'Popular recently in India: movies and TV made in India (TMDB origin country IN) released in the last 120 days, most popular first. Not live trending data.',
    kind: 'discover',
    limit: 20,
    merge: 'popularity',
    buildQueries: (today) => {
      const window = { sort: 'popularity' as const, originCountry: 'IN', minVotes: INDIAN_MIN_VOTES.recent, releaseFrom: addDaysUtc(today, -TRENDING_INDIA_WINDOW_DAYS), releaseTo: today };
      return [{ mediaType: 'movie', opts: window }, { mediaType: 'tv', opts: window }];
    },
    filter: (t, { today }) => t.voteCount >= INDIAN_MIN_VOTES.recent && !!t.releaseDate && t.releaseDate >= addDaysUtc(today, -TRENDING_INDIA_WINDOW_DAYS) && t.releaseDate <= today
  },
  {
    slug: 'bollywood-hits',
    title: 'Bollywood Hits',
    eyebrow: 'Hindi cinema',
    howWePick: 'Hindi-language movies (TMDB original language hi, released in India) with at least 150 votes, most popular first, nothing unreleased.',
    kind: 'discover',
    limit: 20,
    buildQueries: (today) => [{ mediaType: 'movie', opts: { sort: 'popularity', language: 'hi', releaseRegion: 'IN', minVotes: INDIAN_MIN_VOTES.bollywood, releaseTo: today } }],
    filter: (t, { today }) => t.voteCount >= INDIAN_MIN_VOTES.bollywood && releasedBy(t, today)
  },
  {
    slug: 'south-indian-cinema',
    title: 'South Indian Blockbusters',
    eyebrow: 'Tamil, Telugu, Malayalam, Kannada',
    howWePick: 'Tamil, Telugu, Malayalam and Kannada movies with at least 100 votes, one TMDB query per language merged and ranked by popularity, nothing unreleased.',
    kind: 'discover',
    limit: 20,
    merge: 'popularity',
    buildQueries: (today) => SOUTH_INDIAN_LANGUAGES.map((language) => ({ mediaType: 'movie' as const, opts: { sort: 'popularity' as const, language, minVotes: INDIAN_MIN_VOTES.south, releaseTo: today } })),
    filter: (t, { today }) => t.voteCount >= INDIAN_MIN_VOTES.south && releasedBy(t, today)
  },
  {
    slug: 'indian-series',
    title: 'Indian Series',
    eyebrow: 'Made in India',
    howWePick: 'TV series made in India (TMDB origin country IN) with at least 50 votes, most popular first, nothing unreleased.',
    kind: 'discover',
    limit: 20,
    buildQueries: (today) => [{ mediaType: 'tv', opts: { sort: 'popularity', originCountry: 'IN', minVotes: INDIAN_MIN_VOTES.series, releaseTo: today } }],
    filter: (t, { today }) => t.voteCount >= INDIAN_MIN_VOTES.series && releasedBy(t, today)
  },
  {
    slug: 'hidden-gems',
    title: 'Hidden Gems',
    eyebrow: 'Under the radar',
    howWePick: 'TMDB rating 7.3 or higher with 300 to 3,000 votes, best rated first, dropping anything in the mainstream popularity range.',
    kind: 'discover',
    limit: 20,
    queries: [
      { mediaType: 'movie', opts: { sort: 'rating', minRating: 7.3, minVotes: 300, maxVotes: 3000 } },
      { mediaType: 'tv', opts: { sort: 'rating', minRating: 7.3, minVotes: 300, maxVotes: 3000 } }
    ],
    filter: (t) => (t.popularity ?? 0) < HIDDEN_GEMS_MAX_POPULARITY && (t.rating ?? 0) >= 7.3 && t.voteCount >= 300 && t.voteCount <= 3000
  },
  {
    slug: 'one-night-binge',
    title: 'One-Night Binge',
    eyebrow: 'Tonight only',
    howWePick: 'Movies of 100 minutes or less rated 6.8+, plus TV with a single season of 8 episodes or fewer (checked against each show\'s details).',
    kind: 'discover',
    limit: 20,
    queries: [
      { mediaType: 'movie', opts: { sort: 'popularity', maxRuntime: 100, minRating: 6.8, minVotes: 500 } },
      { mediaType: 'tv', opts: { sort: 'popularity', minRating: 7, minVotes: 300 } }
    ],
    detailMediaTypes: ['tv'],
    detailFilter: (t) => t.mediaType === 'movie' || (t.seasons === 1 && t.episodes !== null && t.episodes !== undefined && t.episodes <= 8),
    filter: (t) => t.mediaType === 'tv' || (t.runtimeMinutes === null || t.runtimeMinutes <= 100)
  },
  {
    slug: 'mind-bending',
    title: 'Mind-Bending Stories',
    eyebrow: 'Think twice',
    howWePick: 'Science Fiction, Mystery or Thriller titles rated 7.0+ with at least 1,000 votes, most popular first.',
    kind: 'discover',
    limit: 20,
    queries: [
      { mediaType: 'movie', opts: { sort: 'popularity', anyGenres: [878, 9648, 53], minRating: 7, minVotes: 1000 } },
      { mediaType: 'tv', opts: { sort: 'popularity', anyGenres: [9648, 10765], minRating: 7, minVotes: 1000 } }
    ]
  },
  {
    slug: 'comfort-cinema',
    title: 'Comfort Cinema',
    eyebrow: 'Easy watching',
    howWePick: 'Comedy, Animation or Family titles rated 7.0+ with at least 1,000 votes, most popular first.',
    kind: 'discover',
    limit: 20,
    queries: [
      { mediaType: 'movie', opts: { sort: 'popularity', anyGenres: [35, 16, 10751], minRating: 7, minVotes: 1000 } },
      { mediaType: 'tv', opts: { sort: 'popularity', anyGenres: [35, 16, 10751], minRating: 7, minVotes: 1000 } }
    ]
  },
  {
    slug: 'critically-loved',
    title: 'Critically Loved',
    eyebrow: 'Top rated',
    howWePick: 'TMDB rating 8.0 or higher with at least 1,500 votes (500 for TV), best rated first. Ratings are TMDB user scores.',
    kind: 'discover',
    limit: 20,
    queries: [
      { mediaType: 'movie', opts: { sort: 'rating', minRating: 8, minVotes: 1500 } },
      { mediaType: 'tv', opts: { sort: 'rating', minRating: 8, minVotes: 500 } }
    ],
    filter: (t) => (t.rating ?? 0) >= 8
  },
  {
    slug: 'because-you-watched',
    title: 'Because You Saved',
    eyebrow: 'For you',
    howWePick: 'TMDB recommendations seeded from the last three titles you saved to your Cineverse watchlist. Hidden until you have saved something.',
    kind: 'personal',
    limit: 20
  },
  {
    slug: 'on-your-platforms',
    title: 'Available on Your Platforms',
    eyebrow: 'Your services',
    howWePick: 'Popular titles whose availability in your region is verified on the platforms you selected.',
    kind: 'platforms',
    limit: 20
  },
  // ---- TVmaze mode only (no TMDB key). With a TMDB key these two answer 404: TVmaze only enriches TMDB titles. ----
  {
    slug: 'airing-in-india',
    title: 'Airing in India',
    eyebrow: 'TV schedule',
    howWePick: "Shows on Indian TV and web channels in TVmaze's schedule for today and the next two days (IST), best rated first, then by TVmaze popularity.",
    kind: 'tv-airing-india',
    limit: 20
  },
  {
    slug: 'popular-tv',
    title: 'Popular TV',
    eyebrow: 'On air today',
    howWePick: "Shows airing today on US TV and on global web channels, ordered by TVmaze's own popularity score (TVmaze has no popularity list, so this uses today's schedule).",
    kind: 'tv-popular',
    limit: 20
  }
];

export function findCollection(slug: string): CollectionDef | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}
export const COLLECTION_SLUGS = COLLECTIONS.map((c) => c.slug);
