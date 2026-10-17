'use client';

import React, { Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Clapperboard, Plus } from 'lucide-react';
import { isLinkItem, isTitleItem } from '@synccinema/common';
import { DiscoverShell, cleanRoomParam } from '../../components/discover/Shell';
import { BTN_PRIMARY, BTN_SECONDARY, Chip, EYEBROW, FOCUS, SURFACE, Skeleton } from '../../components/discover/ui';
import { AddLinkDialog } from '../../components/watchlist/AddLinkDialog';
import { LinkCard, TitleCard } from '../../components/watchlist/WatchlistCards';
import { useLegacyWatchlistMigration } from '../../components/watchlist/useLegacyMigration';
import { useWatchlist } from '../../lib/catalog/watchlist';
import { WATCHLIST_TABS, filterWatchlist, parseTab, tabCounts, type WatchlistTab } from '../../lib/catalog/watchlistView';

/**
 * THE watchlist: one private list per account, server-saved, shared with every save button in the app. Catalog titles
 * (from Discover) and links you add yourself live together; the tabs only filter the view.
 */
function WatchlistInner() {
  const router = useRouter();
  const params = useSearchParams();
  const roomSlug = cleanRoomParam(params.get('room'));
  const tab = parseTab(params.get('tab'));
  const wl = useWatchlist();
  const [adding, setAdding] = useState(false);
  const closeAdd = useCallback(() => setAdding(false), []);
  useLegacyWatchlistMigration();

  const counts = useMemo(() => tabCounts(wl.items), [wl.items]);
  const shown = useMemo(() => filterWatchlist(wl.items, tab), [wl.items, tab]);

  const setTab = (next: WatchlistTab) => {
    const p = new URLSearchParams();
    if (next !== 'all') p.set('tab', next);
    if (roomSlug) p.set('room', roomSlug);
    const s = p.toString();
    router.replace(`/watchlist${s ? `?${s}` : ''}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={EYEBROW}>My list</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Watchlist</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {wl.signedIn && wl.loaded ? `${wl.items.length} of ${wl.max} saved. Only you can see this list.` : 'Movies, shows and links you want to watch together.'}
          </p>
        </div>
        {wl.signedIn && (
          <div className="flex items-center gap-2">
            <Link href="/discover" className={BTN_SECONDARY}>
              <Clapperboard className="h-4 w-4" aria-hidden="true" /> Discover
            </Link>
            <button type="button" onClick={() => setAdding(true)} className={BTN_PRIMARY}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a link
            </button>
          </div>
        )}
      </header>

      {wl.ready && !wl.signedIn ? (
        <div className={`${SURFACE} rounded-2xl p-6`}>
          <p className="text-sm font-semibold">Sign in to keep a watchlist</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Your list is private and saved to your account, so it follows you across devices.</p>
          <Link href={`/login?redirect=${encodeURIComponent('/watchlist')}`} className={`${BTN_PRIMARY} mt-3`}>Sign in</Link>
        </div>
      ) : !wl.ready || (!wl.loaded && !wl.loadFailed) ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72 w-full rounded-2xl" />)}
        </div>
      ) : wl.loadFailed && !wl.loaded ? (
        <div role="alert" className={`${SURFACE} rounded-2xl p-5`}>
          <p className="text-sm text-zinc-800 dark:text-zinc-100">Could not load your watchlist.</p>
          <button type="button" onClick={() => void wl.reload()} className={`${BTN_SECONDARY} mt-3 !py-1.5`}>Retry</button>
        </div>
      ) : wl.items.length === 0 ? (
        <div className={`${SURFACE} mx-auto max-w-md rounded-2xl p-6 text-center sm:p-8`}>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-[#ee1d49] dark:bg-[#1c1d25]">
            <Bookmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-base font-bold text-zinc-900 dark:text-white">Your watchlist is empty</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">Save movies and shows from Discover, or add a link of your own. Everything you save appears here and across the app.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link href="/discover" className={BTN_PRIMARY}>
              <Clapperboard className="h-4 w-4" aria-hidden="true" /> Browse Discover
            </Link>
            <button type="button" onClick={() => setAdding(true)} className={BTN_SECONDARY}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a link
            </button>
          </div>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filter the watchlist" className="flex flex-wrap gap-1.5">
            {WATCHLIST_TABS.map((t) => (
              <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label} <span className="opacity-70">{counts[t.id]}</span>
              </Chip>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className={`${SURFACE} rounded-2xl p-6 text-center text-sm text-zinc-500 dark:text-zinc-400`}>
              Nothing here yet.{' '}
              <button type="button" onClick={() => setTab('all')} className={`font-semibold text-[#ee1d49] underline ${FOCUS}`}>Show everything</button>
            </div>
          ) : (
            <ul role="list" aria-label="My watchlist" className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 xl:grid-cols-4">
              {shown.map((i) => (isLinkItem(i) ? <LinkCard key={i.titleKey} item={i} /> : isTitleItem(i) ? <TitleCard key={i.titleKey} item={i} roomSlug={roomSlug} /> : null))}
            </ul>
          )}
        </>
      )}
      {adding && <AddLinkDialog onClose={closeAdd} />}
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <DiscoverShell activeNav="watchlist">
      <Suspense fallback={null}>
        <WatchlistInner />
      </Suspense>
    </DiscoverShell>
  );
}
