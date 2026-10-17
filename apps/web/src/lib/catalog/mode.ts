/** Discover page layout per catalog mode (see CINEVERSE.md: modes). Pure, unit tested. */
export type CatalogModeName = 'tmdb' | 'tvmaze' | 'none';

export const TVMAZE_MODE_NOTE = 'Movies need a TMDB API key. TV shows are powered by TVmaze.';

/** Collections the hero reads (a "global" group and a regional group, 3 slides each). */
export function heroSlugs(mode: CatalogModeName): { global: string[]; regional: string[] } {
  return mode === 'tvmaze' ? { global: ['popular-tv'], regional: ['airing-in-india'] } : { global: ['trending'], regional: ['trending-india', 'bollywood-hits', 'south-indian-cinema'] };
}

/** Rows below the hero, in order. `hideWhenEmpty` rows vanish when empty. */
export function discoverRows(mode: CatalogModeName): Array<{ slug: string; hideWhenEmpty?: boolean }> {
  if (mode === 'tvmaze') return [{ slug: 'airing-in-india' }, { slug: 'popular-tv' }];
  if (mode === 'tmdb') {
    return [
      { slug: 'free-movies' }, { slug: 'trending' }, { slug: 'trending-india' }, { slug: 'bollywood-hits' }, { slug: 'because-you-watched', hideWhenEmpty: true },
      { slug: 'south-indian-cinema' }, { slug: 'indian-series' }, { slug: 'hidden-gems' }, { slug: 'one-night-binge' }, { slug: 'mind-bending' }, { slug: 'comfort-cinema' }, { slug: 'critically-loved' }
    ];
  }
  return [];
}

/** A TMDB-less status from an older server has no `mode`: it means the TMDB catalog when configured. */
export function modeOf(status: { configured: boolean; mode?: string } | null | undefined): CatalogModeName {
  if (!status || !status.configured) return 'none';
  return status.mode === 'tvmaze' ? 'tvmaze' : 'tmdb';
}
