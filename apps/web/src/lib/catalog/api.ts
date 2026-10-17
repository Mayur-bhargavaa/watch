import type { CatalogPage, CatalogGenre, CatalogTitle, TitleRoomState, TitleSnapshot, WatchlistItem, LinkSnapshot } from '@synccinema/common';
import { API_BASE, authHeaders } from '../api';

/** Client for /api/catalog/*. Secrets never live here: the server holds the provider keys. */
export class CatalogApiError extends Error {
  constructor(message: string, public status: number, public code: string | null) {
    super(message);
    this.name = 'CatalogApiError';
  }
  get notConfigured(): boolean {
    return this.code === 'CATALOG_NOT_CONFIGURED';
  }
}
export const SETUP_MESSAGE = 'Cineverse needs a TMDB key. Add TMDB_API_KEY (or TMDB_READ_TOKEN) to apps/server/.env and restart the server. See CINEVERSE.md.';
export const AVAILABILITY_OFF_MESSAGE = 'Availability data is not enabled';

async function call<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...authHeaders(), ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal
    });
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err;
    throw new CatalogApiError('Could not reach the server. Check your connection and retry.', 0, 'NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CatalogApiError(typeof data?.error === 'string' ? data.error : 'Request failed', res.status, typeof data?.code === 'string' ? data.code : null);
  return data as T;
}
const q = (params: URLSearchParams | Record<string, string | undefined>) => {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface CollectionResponse {
  slug: string;
  title: string;
  eyebrow: string;
  howWePick: string;
  items: CatalogTitle[];
  available: boolean;
  note?: string;
  availabilityEnabled: boolean;
}
export interface TitleResponse {
  title: CatalogTitle;
  availabilityEnabled: boolean;
  availabilityVerified: boolean;
}
export interface CatalogStatus {
  configured: boolean;
  availability: boolean;
  trailers: boolean;
  defaultRegion: string;
  region: string;
}

export const catalogApi = {
  status: (signal?: AbortSignal) => call<CatalogStatus>('/api/catalog/status', { signal }),
  genres: (signal?: AbortSignal) => call<{ genres: CatalogGenre[] }>('/api/catalog/genres', { signal }),
  search: (params: URLSearchParams, signal?: AbortSignal) => call<CatalogPage & { availabilityEnabled: boolean; providerFilterApplied: boolean }>(`/api/catalog/search${q(params)}`, { signal }),
  collection: (slug: string, opts: { providers?: string[]; region?: string } = {}, signal?: AbortSignal) =>
    call<CollectionResponse>(`/api/catalog/collections/${encodeURIComponent(slug)}${q({ providers: opts.providers?.join(','), region: opts.region })}`, { signal }),
  title: (mediaType: string, id: string, signal?: AbortSignal) => call<TitleResponse>(`/api/catalog/titles/tmdb/${mediaType}/${id}`, { signal }),
  recommendations: (mediaType: string, id: string, signal?: AbortSignal) => call<CatalogPage>(`/api/catalog/titles/tmdb/${mediaType}/${id}/recommendations`, { signal }),
  watchlist: (signal?: AbortSignal) => call<{ items: WatchlistItem[]; max: number }>('/api/catalog/watchlist', { signal }),
  watchlistAdd: (snap: TitleSnapshot) => call<{ ok: boolean; duplicate: boolean; titleKey?: string }>('/api/catalog/watchlist', { method: 'POST', body: snap }),
  watchlistAddLink: (link: LinkSnapshot) => call<{ ok: boolean; duplicate: boolean; titleKey: string }>('/api/catalog/watchlist', { method: 'POST', body: { kind: 'link', ...link } }),
  watchlistRemove: (titleKey: string) => call<{ ok: boolean; removed: boolean }>(`/api/catalog/watchlist/${encodeURIComponent(titleKey)}`, { method: 'DELETE' }),
  roomTitles: (slug: string) => call<{ state: TitleRoomState; serverTime: number }>(`/api/catalog/rooms/${encodeURIComponent(slug)}/titles`),
  roomAction: (slug: string, action: 'propose' | 'vote' | 'confirm' | 'ready' | 'clear', body: Record<string, unknown>) =>
    call<{ ok: boolean; state: TitleRoomState }>(`/api/catalog/rooms/${encodeURIComponent(slug)}/titles/${action}`, { method: 'POST', body })
};
