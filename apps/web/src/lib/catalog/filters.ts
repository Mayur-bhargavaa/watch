import type { CatalogSort, CatalogTypeFilter } from '@synccinema/common';

/** Pure helpers for the Discover search form. No DOM, no fetch: everything here is unit tested. */
export interface SearchFilters {
  q: string;
  type: CatalogTypeFilter;
  genre: number | null;
  /** "2015" or "2010-2020" (validated by parseYearInput) */
  year: string;
  sort: CatalogSort;
  provider: string | null;
}
export const DEFAULT_FILTERS: SearchFilters = { q: '', type: 'all', genre: null, year: '', sort: 'popularity', provider: null };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** Accepts "", "2015", "2010-2020" (also with an en dash or spaces). Returns the canonical value or an error. */
export function parseYearInput(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const text = raw.trim().replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');
  if (!text) return { ok: true, value: '' };
  const m = /^(\d{4})(?:-(\d{4}))?$/.exec(text);
  if (!m) return { ok: false, error: 'Use a year like 2015 or a range like 2010-2020' };
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a < MIN_YEAR || b > MAX_YEAR) return { ok: false, error: `Years must be between ${MIN_YEAR} and ${MAX_YEAR}` };
  if (b < a) return { ok: false, error: 'The range must start with the earlier year' };
  return { ok: true, value: m[2] ? `${a}-${b}` : String(a) };
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return f.type !== 'all' || f.genre !== null || f.year !== '' || f.provider !== null || f.sort !== 'popularity';
}

/** True when the form would show something other than an empty page (text or any filter). */
export function isBrowsing(f: SearchFilters): boolean {
  return f.q.trim().length > 0 || hasActiveFilters(f);
}

/** Query string for GET /api/catalog/search. Default values are omitted so cache keys stay short and stable. */
export function filtersToQuery(f: SearchFilters, page = 1, region?: string): URLSearchParams {
  const p = new URLSearchParams();
  const q = f.q.trim().slice(0, 100);
  if (q) p.set('q', q);
  if (f.type !== 'all') p.set('type', f.type);
  if (f.genre !== null) p.set('genre', String(f.genre));
  const y = parseYearInput(f.year);
  if (y.ok && y.value) p.set('year', y.value);
  if (f.sort !== 'popularity') p.set('sort', f.sort);
  if (f.provider) p.set('provider', f.provider);
  if (region) p.set('region', region);
  if (page > 1) p.set('page', String(page));
  return p;
}

/** Identity of a search (without the page): when it changes, accumulated results are discarded. */
export function filtersKey(f: SearchFilters): string {
  return filtersToQuery(f).toString();
}

/** Calls `fn` once after `ms` of quiet. cancel() drops a pending call; flush() runs it now. */
export function createDebouncer<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  return {
    call(...args: A) {
      pending = args;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const a = pending as A;
        pending = null;
        fn(...a);
      }, ms);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      const a = pending as A;
      pending = null;
      fn(...a);
    }
  };
}
