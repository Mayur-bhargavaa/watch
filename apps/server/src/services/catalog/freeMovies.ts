import {
  makeTitleKey,
  type CatalogTitle,
  type ProviderOffer,
  EMBEDDED_PROVIDER_CAPABILITIES,
  deduplicateTitles
} from '@synccinema/common';
import type { TmdbAdapter } from './adapters/tmdb.js';
import freeMoviesData from './freeMoviesData.json' with { type: 'json' };

export interface FreeMovieEntry {
  tmdbId: number;
  streamUrl: string;
  youtubeUrl?: string;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  rating: number | null;
  voteCount: number;
  genres: Array<{ id: number; name: string }>;
}

export function buildFreeMovieTitle(entry: FreeMovieEntry, region = 'US'): CatalogTitle {
  const url = entry.streamUrl || entry.youtubeUrl || '';
  const isYoutube = url.includes('youtu');
  const offer: ProviderOffer = {
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

  return {
    id: makeTitleKey('tmdb', 'movie', entry.tmdbId),
    source: 'tmdb',
    sourceId: String(entry.tmdbId),
    mediaType: 'movie',
    title: entry.title,
    overview: entry.overview,
    posterPath: entry.posterPath,
    backdropPath: entry.backdropPath,
    releaseDate: entry.releaseDate,
    genres: entry.genres,
    genreIds: entry.genres.map((g) => g.id),
    runtimeMinutes: entry.runtimeMinutes,
    rating: entry.rating,
    ratingSource: 'TMDB',
    voteCount: entry.voteCount,
    providers: [offer],
    region,
    externalUrl: `https://www.themoviedb.org/movie/${entry.tmdbId}`,
    freeStreamUrl: url
  };
}

/**
 * Returns the curated free-to-watch movies list with verified streaming sources and TMDB metadata.
 * Always passes through `deduplicateTitles` to guarantee that each movie only appears ONCE.
 */
export async function getFreeMovies(tmdb?: TmdbAdapter, region = 'US'): Promise<CatalogTitle[]> {
  const entries: FreeMovieEntry[] = freeMoviesData as FreeMovieEntry[];

  const titles: CatalogTitle[] = await Promise.all(
    entries.map(async (entry) => {
      const fallback = buildFreeMovieTitle(entry, region);
      const url = entry.streamUrl || entry.youtubeUrl || '';
      if (!tmdb || !tmdb.configured) return fallback;

      try {
        const live = await tmdb.details('movie', String(entry.tmdbId), region);
        if (!live) return fallback;

        return {
          ...live,
          freeStreamUrl: url,
          providers: [
            ...(live.providers || []).filter((p) => p.name !== 'YouTube (Free)' && p.name !== 'Internet Archive (Free Cinema)'),
            fallback.providers[0]
          ]
        };
      } catch {
        return fallback;
      }
    })
  );

  // Deduplicate strictly by TMDB ID, normalized title, and rating
  return deduplicateTitles(titles);
}
