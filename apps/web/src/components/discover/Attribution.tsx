import React from 'react';

/** Attribution required by the data providers. */
export function Attribution({ availabilityEnabled = true }: { availabilityEnabled?: boolean }) {
  return (
    <footer className="mt-10 border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-500 dark:border-white/10 dark:text-zinc-400">
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>{availabilityEnabled ? 'Streaming availability data provided by Watchmode.' : 'Streaming availability data is provided by Watchmode when enabled.'}</p>
    </footer>
  );
}
