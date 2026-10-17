import type { TitleSnapshot, WatchlistItem, WatchlistLinkItem } from '@synccinema/common';

/** What the UI hands the store to save: a catalog title snapshot, or a link item (it has a url and kind 'link'). */
export type WatchlistSnapshot = TitleSnapshot | Omit<WatchlistLinkItem, 'addedAt'>;
export const toItem = (s: WatchlistSnapshot, addedAt: number): WatchlistItem => ('url' in s ? { ...s, kind: 'link', addedAt } : { ...s, kind: 'title', addedAt });

/**
 * Optimistic watchlist model (ONE list holding titles and links). The UI flips immediately; the pending change is remembered so it can be rolled back if
 * the server refuses (network error, cap reached, signed out).
 */
export interface WatchlistModel {
  items: WatchlistItem[];
  /** titleKey -> what we optimistically did and need to undo on failure */
  pending: Record<string, { op: 'add' | 'remove'; previous: WatchlistItem | null }>;
  loaded: boolean;
}
export const EMPTY_WATCHLIST: WatchlistModel = { items: [], pending: {}, loaded: false };

export type WatchlistAction =
  | { type: 'loaded'; items: WatchlistItem[] }
  | { type: 'optimistic-add'; snapshot: WatchlistSnapshot; now: number }
  | { type: 'optimistic-remove'; titleKey: string }
  | { type: 'confirm'; titleKey: string }
  | { type: 'rollback'; titleKey: string };

export function watchlistReducer(state: WatchlistModel, action: WatchlistAction): WatchlistModel {
  switch (action.type) {
    case 'loaded': {
      // keep anything still in flight so a slow load does not flicker an optimistic change away
      let items = action.items;
      for (const [key, p] of Object.entries(state.pending)) {
        if (p.op === 'add' && !items.some((i) => i.titleKey === key)) {
          const local = state.items.find((i) => i.titleKey === key);
          if (local) items = [local, ...items];
        }
        if (p.op === 'remove') items = items.filter((i) => i.titleKey !== key);
      }
      return { ...state, items, loaded: true };
    }
    case 'optimistic-add': {
      if (state.items.some((i) => i.titleKey === action.snapshot.titleKey)) return state; // duplicate prevention
      const item = toItem(action.snapshot, action.now);
      return { ...state, items: [item, ...state.items], pending: { ...state.pending, [item.titleKey]: { op: 'add', previous: null } } };
    }
    case 'optimistic-remove': {
      const previous = state.items.find((i) => i.titleKey === action.titleKey) ?? null;
      if (!previous) return state;
      return { ...state, items: state.items.filter((i) => i.titleKey !== action.titleKey), pending: { ...state.pending, [action.titleKey]: { op: 'remove', previous } } };
    }
    case 'confirm': {
      const { [action.titleKey]: _done, ...rest } = state.pending;
      return { ...state, pending: rest };
    }
    case 'rollback': {
      const p = state.pending[action.titleKey];
      if (!p) return state;
      const { [action.titleKey]: _undone, ...rest } = state.pending;
      const items = p.op === 'add' ? state.items.filter((i) => i.titleKey !== action.titleKey) : p.previous ? [p.previous, ...state.items.filter((i) => i.titleKey !== action.titleKey)].sort((a, b) => b.addedAt - a.addedAt) : state.items;
      return { ...state, items, pending: rest };
    }
  }
}
export const isSaved = (m: WatchlistModel, titleKey: string): boolean => m.items.some((i) => i.titleKey === titleKey);
