import { LINK_CATEGORY_MAX, LINK_TAGLINE_MAX, LINK_TITLE_MAX, hasControlChars, linkTitleKey, normalizeLinkUrl, safeProviderUrl, type LinkSnapshot } from '@synccinema/common';

/**
 * One-time migration of the old on-device watchlist (localStorage `stitchbyte_watchlist`, items were custom links
 * plus a few hard-coded sample entries) into the account's server-saved watchlist as 'link' items.
 * Everything here is pure; the page does the reading, uploading and key removal.
 */
export const LEGACY_WATCHLIST_KEY = 'stitchbyte_watchlist';

/**
 * The URLs of the sample items the old page seeded into every browser (DEFAULT_WATCHLIST: Interstellar, Stranger
 * Things 4, The Boys Season 4, Cyberpunk 2077: Phantom Liberty). They were never user choices and are not migrated.
 */
export const LEGACY_SAMPLE_URLS: readonly string[] = [
  'https://www.youtube.com/watch?v=zSWdZVtXT7E',
  'https://www.netflix.com/title/80057281',
  'https://www.primevideo.com',
  'https://www.youtube.com/watch?v=qIcTM8WXFjk'
];
const SAMPLE_KEYS = new Set(LEGACY_SAMPLE_URLS.map((u) => linkTitleKey(u)).filter((k): k is string => k !== null));

/** True when the URL is one of the old hard-coded samples (compared after normalisation, so any spelling matches). */
export function isLegacySampleUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const key = linkTitleKey(url);
  return key !== null && SAMPLE_KEYS.has(key);
}

export interface LegacyMapping {
  /** user-created items ready to upload (valid, https, de-duplicated, titled) */
  links: LinkSnapshot[];
  /** sample items that were left out on purpose */
  skippedSamples: number;
  /** entries that could not be used (not an object, no valid https URL, ...) */
  invalid: number;
  /** valid items beyond the room left in the watchlist (not uploaded) */
  overCapacity: number;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' || hasControlChars(v)) return null;
  const t = v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * Turns the raw stored JSON into upload-ready link items. Never throws: unreadable input gives an empty mapping.
 * `room` is how many items still fit in the account's watchlist.
 */
export function mapLegacyWatchlist(raw: unknown, room: number): LegacyMapping {
  const out: LegacyMapping = { links: [], skippedSamples: 0, invalid: 0, overCapacity: 0 };
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (!Array.isArray(data)) return out;
  const seen = new Set<string>();
  for (const entry of data.slice(0, 1000)) {
    if (!entry || typeof entry !== 'object') {
      out.invalid++;
      continue;
    }
    const e = entry as Record<string, unknown>;
    const url = normalizeLinkUrl(e.url);
    if (!url) {
      out.invalid++;
      continue;
    }
    if (isLegacySampleUrl(url)) {
      out.skippedSamples++;
      continue;
    }
    const key = linkTitleKey(url);
    if (!key || seen.has(key)) continue; // the same page twice is one item
    seen.add(key);
    let host = '';
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* normalizeLinkUrl already proved it parses */
    }
    const thumbnail = typeof e.thumbnail === 'string' ? safeProviderUrl(e.thumbnail, 500) : null;
    const link: LinkSnapshot = { title: text(e.title, LINK_TITLE_MAX) || host || 'Saved link', url };
    if (thumbnail) link.thumbnail = thumbnail;
    const category = text(e.category, LINK_CATEGORY_MAX);
    const tagline = text(e.tagline, LINK_TAGLINE_MAX);
    if (category) link.category = category;
    if (tagline) link.tagline = tagline;
    if (out.links.length >= Math.max(0, room)) {
      out.overCapacity++;
      continue;
    }
    out.links.push(link);
  }
  return out;
}

/** Splits `items` into batches of at most `size` (the uploads run batch by batch, a few at a time). */
export function inBatches<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export type UploadOutcome = 'added' | 'duplicate' | 'refused' | 'full' | 'retry';
export interface MigrationPlan {
  /** remove the old key now: everything was either saved, already there, or can never be saved */
  clearKey: boolean;
  added: number;
  duplicates: number;
  refused: number;
  notSaved: number;
}
/**
 * Decides whether the old key may be removed. It is kept when any upload hit a transient failure ('retry': network,
 * server error, rate limit), so no data is ever lost; duplicates found on the next run are harmless. A full list or
 * a validation refusal can never succeed later, so those do not hold the key back.
 */
export function planAfterUpload(outcomes: readonly UploadOutcome[], overCapacity = 0): MigrationPlan {
  const count = (o: UploadOutcome) => outcomes.filter((x) => x === o).length;
  const retry = count('retry');
  return { clearKey: retry === 0, added: count('added'), duplicates: count('duplicate'), refused: count('refused'), notSaved: count('full') + overCapacity + retry };
}
