'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, TriangleAlert, X } from 'lucide-react';
import { watchlistStore } from '../../lib/catalog/watchlist';
import { SERVER_VIEW } from '../../lib/catalog/watchlistStore';

/**
 * One small notice for the whole app (mounted once, in the header): why a save did not happen (signed out, list full,
 * network) or a short confirmation. It only listens; it never loads the list by itself.
 */
export function WatchlistNotice() {
  const view = useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getView, () => SERVER_VIEW);
  const pathname = usePathname();
  const notice = view.notice;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => watchlistStore.dismissNotice(), notice.signIn ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  const Icon = notice.tone === 'error' ? TriangleAlert : Check;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4" role="status" aria-live="polite">
      <div className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-800 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-100">
        <Icon className={`h-4 w-4 shrink-0 ${notice.tone === 'error' ? 'text-amber-500' : 'text-emerald-500'}`} aria-hidden="true" />
        <span className="min-w-0">{notice.text}</span>
        {notice.signIn && (
          <Link href={`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`} className="shrink-0 font-semibold text-[#ee1d49] underline">
            Sign in
          </Link>
        )}
        <button type="button" onClick={() => watchlistStore.dismissNotice()} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
