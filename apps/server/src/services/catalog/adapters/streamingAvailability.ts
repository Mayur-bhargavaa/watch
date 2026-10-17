import { safeProviderUrl, type CatalogMediaType, type ProviderOffer, type ProviderOfferType } from '@synccinema/common';
import { UpstreamClient } from '../upstream.js';

/**
 * Streaming Availability API by Movie of the Night (https://docs.movieofthenight.com), v4, written from the official
 * documentation only (no key was available while building it; the owner must verify it once a key exists).
 *
 *   GET https://api.movieofthenight.com/v4/shows/{id}?country={cc}&series_granularity=show&output_language=en
 *   header  X-API-Key: <key>            (Developers Platform key; RapidAPI keys use another host/header and are NOT supported)
 *   {id}    per the docs (Shows resource): `movie/<n>` for a TMDB movie and `tv/<n>` for a TMDB series (their examples:
 *           movie/597, tv/1396), an IMDb id such as tt0068646, or their own id. We use `movie/<n>`, `tv/<n>` and `tt...`,
 *           so no id-mapping request is ever needed. The docs do not say whether the slash must be encoded; we send it raw.
 *   Response: Show { ..., streamingOptions: { <country>: StreamingOption[] } }
 *   StreamingOption { service { id, name, homePage, themeColorCode, imageSet { lightThemeImage, darkThemeImage, whiteImage } },
 *                     type: free | subscription | buy | rent | addon, addon?, link, videoLink?, quality?, audios, subtitles,
 *                     price? { amount, currency, formatted }, expiresSoon, expiresOn?, availableSince }
 *
 * Free plan: 1,000 requests a month (hard cap, no overage), commercial use allowed, attribution required when the data
 * (including images) is made public. The monthly quota guard lives in availabilityGuard.ts; this file only maps data.
 */

export const SA_BASE = 'https://api.movieofthenight.com/v4';
/** Logos are served from this host only (docs: media.movieofthenight.com/services/<service>/logo-*.svg). */
export const SA_LOGO_HOSTS: readonly string[] = ['media.movieofthenight.com'];

export interface StreamingAvailabilityConfig {
  apiKey?: string;
}

const TYPE_MAP: Record<string, ProviderOfferType> = { subscription: 'subscription', free: 'free', rent: 'rent', buy: 'buy', addon: 'addon' };
const TYPE_ORDER: Record<ProviderOfferType, number> = { subscription: 0, free: 1, addon: 2, rent: 3, buy: 4 };

/** A logo URL is kept only when it is https and on the provider's own CDN host. */
export function safeLogoUrl(v: unknown): string | null {
  const u = safeProviderUrl(v, 500);
  if (!u) return null;
  return SA_LOGO_HOSTS.includes(new URL(u).hostname.toLowerCase()) ? u : null;
}

/**
 * Maps a documented Show payload to verified offers for ONE country. `verified` is true only because the API returned
 * the offer under that country's key. Unknown types, nameless services and other countries are dropped. The deep link
 * is kept only when it is https with a real host. Duplicates (same service and type, several qualities) collapse to
 * one offer, preferring the one that has a valid link.
 */
export function normalizeStreamingOffers(raw: any, region: string): ProviderOffer[] {
  const so = raw?.streamingOptions;
  if (!so || typeof so !== 'object') return [];
  const wanted = region.toLowerCase();
  const key = Object.keys(so).find((k) => k.toLowerCase() === wanted);
  const list = key ? so[key] : null;
  if (!Array.isArray(list)) return [];
  const byKey = new Map<string, ProviderOffer>();
  for (const o of list) {
    const type = TYPE_MAP[String(o?.type)];
    const sid = typeof o?.service?.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(o.service.id) ? o.service.id : null;
    if (!type || !sid) continue;
    const serviceName = typeof o.service.name === 'string' ? o.service.name.trim() : '';
    const addonName = type === 'addon' && typeof o.addon?.name === 'string' ? o.addon.name.trim() : '';
    const name = (addonName || serviceName).slice(0, 80);
    if (!name) continue;
    const offer: ProviderOffer = {
      id: type === 'addon' && typeof o.addon?.id === 'string' ? `${sid}:${String(o.addon.id).slice(0, 40)}` : sid,
      name,
      type,
      logoUrl: safeLogoUrl(o.service.imageSet?.lightThemeImage),
      destinationUrl: safeProviderUrl(o.link),
      verified: true
    };
    const k = `${offer.id}:${offer.type}`;
    const prev = byKey.get(k);
    if (!prev || (!prev.destinationUrl && offer.destinationUrl)) byKey.set(k, offer);
  }
  return [...byKey.values()].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name));
}

/** What to look up: a TMDB title or an IMDb id (TVmaze titles carry an IMDb id). */
export type AvailabilityRef = { kind: 'tmdb'; mediaType: CatalogMediaType; id: string } | { kind: 'imdb'; id: string };
export function refPath(ref: AvailabilityRef): string | null {
  if (ref.kind === 'imdb') return /^tt\d{5,10}$/.test(ref.id) ? ref.id : null;
  return /^\d{1,10}$/.test(ref.id) ? `${ref.mediaType}/${ref.id}` : null;
}

export class StreamingAvailabilityAdapter {
  constructor(private cfg: StreamingAvailabilityConfig, private http: UpstreamClient) {}
  get configured(): boolean {
    return Boolean(this.cfg.apiKey);
  }
  /**
   * ONE request (costs one unit of the monthly quota). Returns verified offers for the country, [] when the API knows the
   * title but lists no service there, and null when the API does not know the title (404). Throws UpstreamError otherwise.
   * Callers must go through the quota guard first.
   */
  async offers(ref: AvailabilityRef, region: string): Promise<ProviderOffer[] | null> {
    const path = refPath(ref);
    if (!path || !/^[A-Z]{2}$/.test(region)) return null;
    const q = new URLSearchParams({ country: region.toLowerCase(), series_granularity: 'show', output_language: 'en' });
    try {
      const raw = await this.http.getJson(`${SA_BASE}/shows/${path}?${q.toString()}`, { 'X-API-Key': this.cfg.apiKey || '', Accept: 'application/json' });
      return normalizeStreamingOffers(raw, region);
    } catch (e: any) {
      if (e?.kind === 'http' && e?.status === 404) return null;
      throw e;
    }
  }
}
