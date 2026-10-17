'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bookmark, Link2 } from 'lucide-react';
import { isLinkItem, type WatchlistItem } from '@synccinema/common';
import { useWatchlist } from '../../lib/catalog/watchlist';
import { linkThumbnail, titleDetailHref } from '../../lib/catalog/watchlistView';
import { FOCUS, Poster, SURFACE } from '../discover/ui';

function Tile({ item }: { item: WatchlistItem }) {
  const wl = useWatchlist();
  const [broken, setBroken] = useState(false);
  if (isLinkItem(item)) {
    const thumb = linkThumbnail(item);
    return (
      <div className="group relative w-32 shrink-0 sm:w-36">
        <Link href="/watchlist?tab=link" className={`block rounded-md ${FOCUS}`} aria-label={`${item.title}, saved link`}>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-zinc-200 dark:bg-[#1c1d25]">
            {thumb && !broken ? (
              <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-600"><Link2 className="h-7 w-7" aria-hidden="true" /></div>
            )}
            <span className="absolute bottom-1.5 left-1.5 rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{item.platform || 'Link'}</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-zinc-900 dark:text-white">{item.title}</p>
        </Link>
      </div>
    );
  }
  const href = titleDetailHref(item.titleKey);
  const inner = (
    <>
      <Poster path={item.posterPath} title={item.title} sizes="144px" />
      <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-zinc-900 dark:text-white">{item.title}</p>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ')}</p>
    </>
  );
  return (
    <div className="group relative w-32 shrink-0 sm:w-36">
      {href ? <Link href={href} className={`block rounded-md ${FOCUS}`} aria-label={`${item.title}, details`}>{inner}</Link> : <div>{inner}</div>}
      <button type="button" onClick={() => void wl.remove(item.titleKey)} aria-label={`Remove ${item.title} from watchlist`} title="Remove from Watchlist" className={`absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-white hover:bg-[#ee1d49] ${FOCUS}`}>
        <Bookmark className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
      </button>
    </div>
  );
}

/** "Your watchlist" row for the home page: the same single list as /watchlist. Empty state points to Discover. */
export function WatchlistStrip({ limit = 12 }: { limit?: number }) {
  const wl = useWatchlist();
  return (
    <section aria-label="Your watchlist">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">Your watchlist</h2>
        {wl.signedIn && wl.items.length > 0 && <Link href="/watchlist" className={`rounded text-xs font-semibold text-[#ee1d49] hover:underline ${FOCUS}`}>See all {wl.items.length}</Link>}
      </div>
      {!wl.loaded ? (
        <div className="h-24 animate-none rounded-2xl bg-zinc-200 dark:bg-[#1c1d25] motion-safe:animate-pulse" aria-hidden="true" />
      ) : wl.items.length === 0 ? (
        <div className={`${SURFACE} flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 sm:p-4`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing saved yet. Save titles from Discover and they show up here.</p>
          <Link href="/discover" className={`rounded-md bg-[#ee1d49] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d6143c] ${FOCUS}`}>Browse Discover</Link>
        </div>
      ) : (
        <ul role="list" className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {wl.items.slice(0, limit).map((i) => (
            <li key={i.titleKey} className="shrink-0"><Tile item={i} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}
