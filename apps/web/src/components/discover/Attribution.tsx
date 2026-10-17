import React from 'react';
import { CREDIT_LINKS, hasAnyAttribution, type AttributionNeeds } from '../../lib/catalog/attribution';

const LINK = 'underline underline-offset-2 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded';

/**
 * Credits required by the data providers. Each line is shown only when that source's data is on the page
 * (see lib/catalog/attribution.ts for the rules):
 *  - TMDB: "uses the TMDB API but is not endorsed" notice (TMDB terms).
 *  - TVmaze: "TV data from TVmaze.com (CC BY-SA 4.0)", linked to tvmaze.com and the licence (TVmaze API terms).
 *  - Movie of the Night: their terms ask for attribution when the availability data (or images) is public.
 *  - Watchmode: the availability credit of the Watchmode free plan.
 */
export function Attribution({ needs }: { needs: AttributionNeeds }) {
  if (!hasAnyAttribution(needs)) return null;
  return (
    <footer aria-label="Data sources" className="mt-10 border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-500 dark:border-white/10 dark:text-zinc-400">
      {needs.tmdb && <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>}
      {needs.tvmaze && (
        <p>
          TV data from{' '}
          <a href={CREDIT_LINKS.tvmaze} target="_blank" rel="noopener noreferrer" className={LINK}>TVmaze.com</a>{' '}
          (<a href={CREDIT_LINKS.tvmazeLicence} target="_blank" rel="noopener noreferrer" className={LINK}>CC BY-SA 4.0</a>).
        </p>
      )}
      {needs.availability.includes('streamingavailability') && (
        <p>
          Availability from{' '}
          <a href={CREDIT_LINKS.movieOfTheNight} target="_blank" rel="noopener noreferrer" className={LINK}>Movie of the Night</a>.
        </p>
      )}
      {needs.availability.includes('watchmode') && <p>Streaming availability data provided by Watchmode.</p>}
    </footer>
  );
}
