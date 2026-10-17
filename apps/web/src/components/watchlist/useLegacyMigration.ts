'use client';

import { useEffect, useRef } from 'react';
import { linkTitleKey } from '@synccinema/common';
import { useWatchlist, watchlistStore } from '../../lib/catalog/watchlist';
import { LEGACY_WATCHLIST_KEY, inBatches, mapLegacyWatchlist, planAfterUpload, type UploadOutcome } from '../../lib/catalog/legacyWatchlist';

const MAX_PER_RUN = 50; // the server allows 60 writes a minute per account; the rest is picked up on the next visit
const PARALLEL = 4;

/**
 * One-time migration of the old on-device watchlist into the account's watchlist. Runs only on the first signed-in
 * load of /watchlist, never blocks the page, and removes the old key only after every upload either succeeded or can
 * never succeed (see planAfterUpload): a failed upload keeps the key, so nothing is lost.
 */
export function useLegacyWatchlistMigration(): void {
  const wl = useWatchlist();
  const started = useRef(false);
  const { signedIn, loaded } = wl;
  useEffect(() => {
    if (started.current || !signedIn || !loaded) return;
    started.current = true;
    void migrate().catch(() => undefined);
  }, [signedIn, loaded]);
}

async function migrate(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_WATCHLIST_KEY);
  } catch {
    return; // storage unavailable: nothing to migrate
  }
  if (raw === null) return;
  const clear = () => {
    try {
      localStorage.removeItem(LEGACY_WATCHLIST_KEY);
    } catch {
      /* ignore */
    }
  };
  const view = watchlistStore.getView();
  const have = new Set(view.items.map((i) => i.titleKey));
  const mapped = mapLegacyWatchlist(raw, view.max - view.items.length);
  const fresh = mapped.links.filter((l) => !have.has(linkTitleKey(l.url) ?? ''));
  const batch = fresh.slice(0, MAX_PER_RUN);
  const outcomes: UploadOutcome[] = [];
  let stopped = false;
  for (const group of inBatches(batch, PARALLEL)) {
    const results = await Promise.all(group.map((l) => watchlistStore.saveLink(l)));
    for (const r of results) {
      if (r.ok) outcomes.push(r.duplicate ? 'duplicate' : 'added');
      else if (r.reason === 'full') outcomes.push('full');
      else if (r.reason === 'invalid') outcomes.push('refused');
      else outcomes.push('retry');
    }
    if (outcomes.includes('retry') || outcomes.includes('full')) {
      stopped = true;
      break;
    }
  }
  // links beyond this run's allowance (or never attempted after a stop) must keep the key
  const unattempted = fresh.length - outcomes.length;
  if (unattempted > 0) for (let i = 0; i < unattempted; i++) outcomes.push(stopped && outcomes.includes('full') ? 'full' : 'retry');
  const plan = planAfterUpload(outcomes, mapped.overCapacity);
  if (plan.clearKey) clear();
  if (plan.added > 0) watchlistStore.notify(`Imported ${plan.added} ${plan.added === 1 ? 'link' : 'links'} saved on this device.`);
  else if (plan.clearKey && plan.notSaved > 0) watchlistStore.notify(`${plan.notSaved} older saved ${plan.notSaved === 1 ? 'link was' : 'links were'} not imported because your watchlist is full.`, 'error');
}
