import type { AvailabilityProviderName, CatalogSource } from '@synccinema/common';

/**
 * Which credit lines a page must show. A credit appears only when that source's data is on the page:
 *  - Discover (lists): TMDB in TMDB mode, TVmaze in TVmaze mode, and every configured availability provider
 *    (their offers can appear on cards and the hero).
 *  - A title page: the sources that contributed fields to that title (`sources`, or its own `source`), and ONLY the
 *    availability provider that actually answered for it.
 */
export interface AttributionNeeds {
  tmdb: boolean;
  tvmaze: boolean;
  availability: AvailabilityProviderName[];
}
export const NO_ATTRIBUTION: AttributionNeeds = { tmdb: false, tvmaze: false, availability: [] };

export function attributionForDiscover(status: { configured?: boolean; mode?: string; availability?: boolean; availabilityProviders?: string[] } | null | undefined): AttributionNeeds {
  if (!status || status.configured === false) return NO_ATTRIBUTION;
  // an older server has no `mode` (TMDB catalog) and no provider list (Watchmode was the only provider)
  const mode = status.mode ?? 'tmdb';
  const providers = status.availabilityProviders ?? (status.availability ? ['watchmode'] : []);
  return { tmdb: mode === 'tmdb', tvmaze: mode === 'tvmaze', availability: knownProviders(providers) };
}

export function attributionForTitle(title: { source: CatalogSource; sources?: CatalogSource[] } | null | undefined, availabilityProvider: string | null | undefined): AttributionNeeds {
  if (!title) return NO_ATTRIBUTION;
  const used = new Set<CatalogSource>([title.source, ...(title.sources ?? [])]);
  return { tmdb: used.has('tmdb'), tvmaze: used.has('tvmaze'), availability: knownProviders(availabilityProvider ? [availabilityProvider] : []) };
}

function knownProviders(v: string[] | undefined): AvailabilityProviderName[] {
  const out: AvailabilityProviderName[] = [];
  for (const n of v ?? []) if ((n === 'watchmode' || n === 'streamingavailability') && !out.includes(n)) out.push(n);
  return out;
}

export const hasAnyAttribution = (n: AttributionNeeds): boolean => n.tmdb || n.tvmaze || n.availability.length > 0;

/** Fixed outbound links of the credit lines (never built from data). */
export const CREDIT_LINKS = {
  tvmaze: 'https://www.tvmaze.com',
  tvmazeLicence: 'https://creativecommons.org/licenses/by-sa/4.0/',
  movieOfTheNight: 'https://www.movieofthenight.com',
  tmdb: 'https://www.themoviedb.org'
} as const;
