import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { catalogApi, CatalogApiError } from '../../lib/catalog/api';
import { DEFAULT_FILTERS, filtersKey, filtersToQuery, isBrowsing, type SearchFilters } from '../../lib/catalog/filters';
import { discoverQueryString, filtersFromParams, resultsChipLabel } from '../../lib/catalog/urlState';
import { INITIAL_SEARCH_STATE, canLoadMore, isEmptyResult, searchReducer, statusMessage } from '../../lib/catalog/searchState';
import { BTN_SECONDARY, EmptyState, ErrorState, FOCUS, Skeleton } from './ui';
import { PosterCard } from './Row';

/**
 * Discover's search results. There is no search box and there are no filters here: the header search is the only one
 * and sends people to /discover?q=. Only the text is read from the URL; any other (stale) parameter in an old link,
 * such as genre, year, sort or provider, is ignored. Obsolete requests are aborted, late answers are ignored.
 */
export function SearchPanel({ onBrowsingChange }: { onBrowsingChange: (browsing: boolean) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const q = filtersFromParams(params).q;
  const filters = useMemo<SearchFilters>(() => ({ ...DEFAULT_FILTERS, q }), [q]);
  const key = filtersKey(filters);
  const [state, dispatch] = useReducer(searchReducer, INITIAL_SEARCH_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);

  const run = useCallback((f: SearchFilters, page: number, append: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const id = ++seq.current; // only the latest request may update the list
    dispatch({ type: 'start', append, requestId: id });
    catalogApi
      .search(filtersToQuery(f, page), ctrl.signal)
      .then((r) => dispatch({ type: 'success', requestId: id, page: r, append }))
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        dispatch({ type: 'failure', requestId: id, message: e instanceof CatalogApiError ? e.message : 'Search failed.', code: e instanceof CatalogApiError ? e.code : null });
      });
  }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  // the URL text is the source of truth: every change of it runs a fresh search
  useEffect(() => {
    const browsing = isBrowsing(filters);
    onBrowsingChange(browsing);
    if (!browsing) {
      abortRef.current?.abort();
      dispatch({ type: 'reset', requestId: ++seq.current });
      return;
    }
    run(filters, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onBrowsingChange, run]);

  // clearing the text also drops any stale filter parameters, and keeps ?room=
  const clearQuery = () => router.replace(`/discover${discoverQueryString(DEFAULT_FILTERS, params)}`, { scroll: false });
  const browsing = isBrowsing(filters);
  const applied = filters;

  if (!browsing && !filters.q) return null;

  return (
    <section aria-label="Search results" className="space-y-4">
      {filters.q && (
        <div className="flex items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-[11px] sm:text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#171821] dark:text-slate-100">
            <span className="truncate">Results for &ldquo;{resultsChipLabel(filters.q)}&rdquo;</span>
            <button type="button" onClick={clearQuery} aria-label="Clear search text" className={`rounded-full p-1 text-slate-500 hover:text-rose-500 ${FOCUS}`}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">{statusMessage(state)}</p>

      {browsing && (
        <div>
          {state.status === 'loading' || (state.status === 'idle' && browsing) ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => <div key={i}><Skeleton className="aspect-[2/3] w-full" /><Skeleton className="mt-2 h-4 w-3/4" /></div>)}
            </div>
          ) : state.status === 'error' && state.items.length === 0 ? (
            <ErrorState error={state.error?.code ? new CatalogApiError(state.error.message, 0, state.error.code) : new Error(state.error?.message)} onRetry={() => run(applied, 1, false)} />
          ) : isEmptyResult(state) ? (
            <EmptyState title="No titles match" hint="Try a different spelling or a shorter search." />
          ) : (
            <>
              <ul role="list" aria-label="Search results" className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {state.items.map((t) => (
                  <li key={t.id}><PosterCard title={t} width="w-full" /></li>
                ))}
              </ul>
              {state.status === 'error' && <div className="mt-4"><ErrorState error={new Error(state.error?.message)} compact onRetry={() => run(applied, state.page + 1, true)} /></div>}
              <div className="mt-6 flex justify-center">
                {state.status === 'loadingMore' ? (
                  <span className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Loading more</span>
                ) : canLoadMore(state) ? (
                  <button type="button" onClick={() => run(applied, state.page + 1, true)} className={BTN_SECONDARY}>Load more</button>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
