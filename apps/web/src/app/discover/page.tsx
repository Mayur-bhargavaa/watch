'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Info } from 'lucide-react';
import { catalogApi, SETUP_MESSAGE, type CatalogStatus } from '../../lib/catalog/api';
import { DiscoverShell, cleanRoomParam } from '../../components/discover/Shell';
import { useSignedInSession } from '../../components/discover/useCineverse';
import { HeroSpotlight } from '../../components/discover/Hero';
import { SearchPanel } from '../../components/discover/SearchPanel';
import { CollectionRow } from '../../components/discover/Row';
import { Attribution } from '../../components/discover/Attribution';
import { attributionForDiscover } from '../../lib/catalog/attribution';
import { TVMAZE_MODE_NOTE, discoverRows, modeOf } from '../../lib/catalog/mode';
import { CARD, ErrorState } from '../../components/discover/ui';

function DiscoverInner() {
  const params = useSearchParams();
  const roomSlug = cleanRoomParam(params.get('room'));
  const { session, ready } = useSignedInSession();
  const [browsing, setBrowsing] = useState(false);
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [statusError, setStatusError] = useState<unknown>(null);
  const onBrowsing = useCallback((b: boolean) => setBrowsing(b), []);
  const mode = modeOf(status);

  useEffect(() => {
    if (!ready || !session) return;
    const ctrl = new AbortController();
    catalogApi
      .status(ctrl.signal)
      .then(setStatus)
      .catch((e) => e?.name !== 'AbortError' && setStatusError(e));
    return () => ctrl.abort();
  }, [ready, session]);

  return (
    <>
      <h1 className="sr-only">Discover</h1>
      <div className="space-y-6 sm:space-y-8 animate-fadeIn">
        {roomSlug && <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">Picking for your room. Titles you propose go to its party queue. <Link href={`/room/${roomSlug}`} className="font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 underline">Back to the room</Link></p>}

      {ready && !session ? (
        <div className={`${CARD} p-4 sm:p-6`}>
          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Sign in to explore Cineverse</p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">Discovery, your private watchlist and party voting are part of your account.</p>
          <Link href={`/login?redirect=${encodeURIComponent('/discover')}`} className="mt-3 inline-block px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs motion-safe:transition">Sign in</Link>
        </div>
      ) : statusError ? (
        <ErrorState error={statusError} onRetry={() => window.location.reload()} />
      ) : status && !status.configured ? (
        <div role="status" className={`${CARD} p-4 sm:p-5`}>
          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Catalog is not configured</p>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 dark:text-zinc-300">{SETUP_MESSAGE}</p>
        </div>
      ) : (
        <>
          <SearchPanel onBrowsingChange={onBrowsing} />
          {!browsing && status && (
            <>
              {mode === 'tvmaze' && (
                <p role="status" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] sm:text-xs text-slate-600 dark:border-white/[0.06] dark:bg-[#171821] dark:text-zinc-300">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                  {TVMAZE_MODE_NOTE}
                </p>
              )}
              <HeroSpotlight roomSlug={roomSlug} mode={mode} />
              {discoverRows(mode).map((r) => <CollectionRow key={r.slug} slug={r.slug} hideWhenEmpty={r.hideWhenEmpty} />)}
            </>
          )}
        </>
      )}
        <Attribution needs={attributionForDiscover(status)} />
      </div>
    </>
  );
}

export default function DiscoverPage() {
  return (
    <DiscoverShell>
      <Suspense fallback={null}>
        <DiscoverInner />
      </Suspense>
    </DiscoverShell>
  );
}
