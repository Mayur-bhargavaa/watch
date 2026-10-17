import { CATALOG_SORTS, CATALOG_TYPES, PROVIDER_FILTERS, type CatalogSort, type CatalogTypeFilter } from '@synccinema/common';
import { DEFAULT_FILTERS, filtersToQuery, parseYearInput, type SearchFilters } from './filters';

/**
 * Discover keeps its search text and filters in the URL (`?q=&type=&genre=&year=&sort=&provider=`) so results are
 * shareable and the one header search box can send people there. Pure helpers, no DOM.
 */
type ParamsLike = { get(name: string): string | null };

/** Reads the filters from a query string. Unknown or invalid values fall back to the defaults. */
export function filtersFromParams(params: ParamsLike): SearchFilters {
  const q = (params.get('q') ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);
  const typeRaw = params.get('type');
  const type: CatalogTypeFilter = (CATALOG_TYPES as readonly string[]).includes(typeRaw ?? '') ? (typeRaw as CatalogTypeFilter) : DEFAULT_FILTERS.type;
  const genreRaw = params.get('genre');
  const genre = genreRaw && /^\d{1,6}$/.test(genreRaw) ? Number(genreRaw) : null;
  const yearParsed = parseYearInput(params.get('year') ?? '');
  const sortRaw = params.get('sort');
  const sort: CatalogSort = (CATALOG_SORTS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as CatalogSort) : DEFAULT_FILTERS.sort;
  const providerRaw = params.get('provider');
  const provider = providerRaw && PROVIDER_FILTERS.some((p) => p.id === providerRaw) ? providerRaw : null;
  return { q, type, genre: genre && genre > 0 ? genre : null, year: yearParsed.ok ? yearParsed.value : '', sort, provider };
}

/** The query string for /discover for these filters, keeping other parameters (such as `room`) from `current`. */
export function discoverQueryString(filters: SearchFilters, current?: ParamsLike): string {
  const next = filtersToQuery(filters);
  const room = current?.get('room');
  if (room) next.set('room', room);
  const s = next.toString();
  return s ? `?${s}` : '';
}

/** `/discover?q=<text>` for the header search ("see all results"). Empty text gives plain /discover. */
export function discoverSearchHref(text: string): string {
  const q = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);
  return q ? `/discover?${new URLSearchParams({ q }).toString()}` : '/discover';
}

/** The same filters with the search text removed (the "Results for" chip's clear button). */
export const withoutQuery = (f: SearchFilters): SearchFilters => ({ ...f, q: '' });

/** Compact label for the "Results for" chip. */
export function resultsChipLabel(q: string): string {
  const t = q.trim();
  return t.length > 40 ? `${t.slice(0, 37)}...` : t;
}
