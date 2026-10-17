'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getStoredSession } from '../api';
import { catalogApi } from './api';
import { SERVER_VIEW, createWatchlistStore, type WatchlistStore, type WatchlistView } from './watchlistStore';

/**
 * The one watchlist of the app (server-saved, private per account). Every save / remove button, the Watchlist page,
 * the dashboard rows and Discover read and change it through this module, so a change made anywhere shows up
 * everywhere at once. Other tabs are told through the `storage` event.
 */
const REV_KEY = 'stitchbyte_watchlist_rev';

export const watchlistStore: WatchlistStore = createWatchlistStore({
  getUser: () => {
    const s = getStoredSession();
    return s && s.token && s.user && !s.user.isAnonymous ? { id: s.user.id } : null;
  },
  list: () => catalogApi.watchlist(),
  addTitle: (snap) => catalogApi.watchlistAdd(snap),
  addLink: (link) => catalogApi.watchlistAddLink(link),
  remove: (key) => catalogApi.watchlistRemove(key),
  now: () => Date.now(),
  announce: () => {
    try {
      localStorage.setItem(REV_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: other tabs simply refresh on their next load */
    }
  }
});

let listening = false;
function listenAcrossTabs() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('storage', (e) => {
    if (e.key === REV_KEY) void watchlistStore.reload();
    if (e.key === 'synccinema_session') void watchlistStore.start(); // signed in / out in another tab
  });
  window.addEventListener('synccinema:session-updated', () => void watchlistStore.start());
}

export interface WatchlistApi extends WatchlistView {
  isSaved: (titleKey: string) => boolean;
  save: WatchlistStore['save'];
  saveLink: WatchlistStore['saveLink'];
  remove: WatchlistStore['remove'];
  toggle: WatchlistStore['toggle'];
  reload: () => Promise<void>;
  dismissNotice: () => void;
}

const actions = {
  save: (s: Parameters<WatchlistStore['save']>[0]) => watchlistStore.save(s),
  saveLink: (l: Parameters<WatchlistStore['saveLink']>[0]) => watchlistStore.saveLink(l),
  remove: (k: string) => watchlistStore.remove(k),
  toggle: (s: Parameters<WatchlistStore['toggle']>[0]) => watchlistStore.toggle(s),
  reload: () => watchlistStore.reload(),
  dismissNotice: () => watchlistStore.dismissNotice(),
  isSaved: (k: string) => watchlistStore.isSaved(k)
};

let cached: { view: WatchlistView; api: WatchlistApi } | null = null;
function apiFor(view: WatchlistView): WatchlistApi {
  if (!cached || cached.view !== view) cached = { view, api: { ...view, ...actions } };
  return cached.api;
}

/** Subscribes the component to the shared list and makes sure it has been loaded (one request however many buttons mount). */
export function useWatchlist(): WatchlistApi {
  const view = useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getView, () => SERVER_VIEW);
  useEffect(() => {
    listenAcrossTabs();
    void watchlistStore.start();
  }, []);
  return apiFor(view);
}
