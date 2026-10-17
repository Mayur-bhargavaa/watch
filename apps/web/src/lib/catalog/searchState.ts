import type { CatalogPage, CatalogTitle } from '@synccinema/common';

/**
 * State machine for the Discover results list. Every request gets an id; a response is applied only if it belongs
 * to the latest request (late answers of cancelled / obsolete requests are ignored), and "Load more" appends with
 * de-duplication so keys stay stable.
 */
export type SearchStatus = 'idle' | 'loading' | 'loadingMore' | 'ready' | 'error';
export interface SearchState {
  status: SearchStatus;
  items: CatalogTitle[];
  page: number;
  totalPages: number;
  requestId: number;
  error: { message: string; code: string | null } | null;
  /** from the server: false means the provider filter was ignored because availability data is off */
  providerFilterApplied: boolean;
}
export const INITIAL_SEARCH_STATE: SearchState = { status: 'idle', items: [], page: 0, totalPages: 0, requestId: 0, error: null, providerFilterApplied: false };

export type SearchAction =
  | { type: 'reset'; requestId?: number }
  | { type: 'start'; append: boolean; requestId?: number }
  | { type: 'success'; requestId: number; page: CatalogPage & { providerFilterApplied?: boolean }; append: boolean }
  | { type: 'failure'; requestId: number; message: string; code: string | null };

export function mergeResults(prev: CatalogTitle[], next: CatalogTitle[]): CatalogTitle[] {
  const seen = new Set(prev.map((t) => t.id));
  const out = [...prev];
  for (const t of next) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_SEARCH_STATE, requestId: action.requestId ?? state.requestId + 1 };
    case 'start':
      return { ...state, status: action.append ? 'loadingMore' : 'loading', requestId: action.requestId ?? state.requestId + 1, error: null, items: action.append ? state.items : [], page: action.append ? state.page : 0, totalPages: action.append ? state.totalPages : 0 };
    case 'success':
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        status: 'ready',
        items: action.append ? mergeResults(state.items, action.page.results) : mergeResults([], action.page.results),
        page: action.page.page,
        totalPages: action.page.totalPages,
        error: null,
        providerFilterApplied: action.page.providerFilterApplied ?? false
      };
    case 'failure':
      if (action.requestId !== state.requestId) return state;
      return { ...state, status: 'error', error: { message: action.message, code: action.code } };
  }
}

export const canLoadMore = (s: SearchState): boolean => s.status === 'ready' && s.page < s.totalPages;
export const isEmptyResult = (s: SearchState): boolean => s.status === 'ready' && s.items.length === 0;
export function statusMessage(s: SearchState): string {
  if (s.status === 'loading') return 'Searching';
  if (s.status === 'loadingMore') return 'Loading more titles';
  if (s.status === 'error') return 'Search failed';
  if (s.status === 'ready') return s.items.length === 0 ? 'No titles found' : `${s.items.length} titles shown`;
  return '';
}
