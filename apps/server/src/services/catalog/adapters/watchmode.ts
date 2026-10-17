import { safeProviderUrl, type CatalogMediaType, type ProviderOffer, type ProviderOfferType } from '@synccinema/common';
import { UpstreamClient } from '../upstream.js';

/**
 * Watchmode adapter: streaming AVAILABILITY and provider destination URLs for a region. This is the only place
 * where `verified: true` offers are created. Playback is never implied by anything returned here.
 */
export interface WatchmodeConfig {
  apiKey?: string;
}

const TYPE_MAP: Record<string, ProviderOfferType> = { sub: 'subscription', rent: 'rent', buy: 'buy', free: 'free' };

export interface SourceInfo {
  id: number;
  name: string;
  logoUrl: string | null;
}

/** Logos come from the availability source and are used only if they are valid https URLs. */
export function normalizeSources(raw: any): Map<number, SourceInfo> {
  const out = new Map<number, SourceInfo>();
  if (!Array.isArray(raw)) return out;
  for (const s of raw) {
    if (!s || typeof s.id !== 'number' || typeof s.name !== 'string' || !s.name.trim()) continue;
    out.set(s.id, { id: s.id, name: s.name.trim().slice(0, 80), logoUrl: safeProviderUrl(s.logo_100px) });
  }
  return out;
}

/**
 * Normalise a Watchmode `/title/{id}/sources/` payload for one region. Offers from another region, unknown types
 * and offers without a name are dropped. `destinationUrl` is the web_url only when it is a valid https URL.
 * Duplicates (same source + type in several formats) collapse to one offer, preferring one with a valid link.
 */
export function normalizeOffers(raw: any, region: string, sources: Map<number, SourceInfo>): ProviderOffer[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, ProviderOffer>();
  for (const o of raw) {
    if (!o || typeof o.source_id !== 'number') continue;
    if (typeof o.region === 'string' && o.region.toUpperCase() !== region) continue;
    const type = TYPE_MAP[String(o.type)];
    if (!type) continue;
    const info = sources.get(o.source_id);
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 80) : info?.name;
    if (!name) continue;
    const offer: ProviderOffer = {
      id: String(o.source_id),
      name,
      type,
      logoUrl: info?.logoUrl ?? null,
      destinationUrl: safeProviderUrl(o.web_url),
      verified: true
    };
    const key = `${offer.id}:${offer.type}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.destinationUrl && offer.destinationUrl)) byKey.set(key, offer);
  }
  const order: Record<ProviderOfferType, number> = { subscription: 0, free: 1, addon: 2, rent: 3, buy: 4 };
  return [...byKey.values()].sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name));
}

export class WatchmodeAdapter {
  constructor(private cfg: WatchmodeConfig, private http: UpstreamClient) {}
  get configured(): boolean {
    return Boolean(this.cfg.apiKey);
  }
  private url(path: string, params: Record<string, string | number>): string {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    q.set('apiKey', this.cfg.apiKey || '');
    return `https://api.watchmode.com/v1${path}?${q.toString()}`;
  }

  async sourceList(region: string): Promise<Map<number, SourceInfo>> {
    return normalizeSources(await this.http.getJson(this.url('/sources/', { regions: region })));
  }

  /** Maps a TMDB id to a Watchmode title id through the search endpoint. null when Watchmode does not know it. */
  async mapTmdbId(mediaType: CatalogMediaType, tmdbId: string): Promise<number | null> {
    const field = mediaType === 'movie' ? 'tmdb_movie_id' : 'tmdb_tv_id';
    const raw: any = await this.http.getJson(this.url('/search/', { search_field: field, search_value: tmdbId }));
    const hit = Array.isArray(raw?.title_results) ? raw.title_results[0] : null;
    return hit && typeof hit.id === 'number' ? hit.id : null;
  }

  /** Maps an IMDb id (TVmaze titles carry one) to a Watchmode title id. */
  async mapImdbId(imdbId: string): Promise<number | null> {
    if (!/^tt\d{5,10}$/.test(imdbId)) return null;
    const raw: any = await this.http.getJson(this.url('/search/', { search_field: 'imdb_id', search_value: imdbId }));
    const hit = Array.isArray(raw?.title_results) ? raw.title_results[0] : null;
    return hit && typeof hit.id === 'number' ? hit.id : null;
  }

  async offers(watchmodeId: number, region: string, sources: Map<number, SourceInfo>): Promise<ProviderOffer[]> {
    return normalizeOffers(await this.http.getJson(this.url(`/title/${watchmodeId}/sources/`, { regions: region })), region, sources);
  }
}
