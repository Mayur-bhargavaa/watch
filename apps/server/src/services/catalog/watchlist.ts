import {
  LINK_CATEGORY_MAX,
  LINK_PLATFORM_MAX,
  LINK_TAGLINE_MAX,
  LINK_TITLE_MAX,
  WATCHLIST_MAX_ITEMS,
  hasControlChars,
  isValidImagePath,
  linkTitleKey,
  normalizeLinkUrl,
  parseTitleKey,
  platformFromUrl,
  safeProviderUrl,
  youtubeIdFromUrl,
  youtubeThumbnail,
  type TitleSnapshot,
  type WatchlistItem,
  type WatchlistLinkItem,
  type WatchlistTitleItem
} from '@synccinema/common';

/**
 * Personal, server-persisted watchlist: ONE list per account holding catalog titles (kind 'title') and links the
 * person added (kind 'link'). Always scoped by userId (never readable by anyone else), unique on (userId, titleKey),
 * capped at WATCHLIST_MAX_ITEMS in total, stores a small snapshot so the list renders without refetching.
 * Documents written before link items existed have no `kind` and are read as titles.
 */
export type AddResult = 'added' | 'duplicate' | 'cap';
/** What a store accepts: a cleaned title snapshot (kind optional) or a cleaned link (kind 'link'). */
export type NewTitleEntry = TitleSnapshot & { kind?: 'title' };
export type NewLinkEntry = Omit<WatchlistLinkItem, 'addedAt'>;
export type NewWatchlistEntry = NewTitleEntry | NewLinkEntry;
export interface WatchlistStore {
  list(userId: string): Promise<WatchlistItem[]>;
  add(userId: string, entry: NewWatchlistEntry): Promise<AddResult>;
  remove(userId: string, titleKey: string): Promise<boolean>;
}

/** Clamps a client snapshot to what we store. Returns null if the title key is not a valid Cineverse key. */
export function cleanSnapshot(input: any): TitleSnapshot | null {
  const key = parseTitleKey(input?.titleKey);
  if (!key) return null;
  const title = typeof input.title === 'string' ? input.title.replace(/[<>]/g, '').trim().slice(0, 300) : '';
  if (!title) return null;
  const year = Number.isInteger(input.year) && input.year >= 1800 && input.year <= 2200 ? input.year : null;
  return { titleKey: input.titleKey, title, posterPath: isValidImagePath(input.posterPath) ? input.posterPath : null, year, mediaType: key.mediaType };
}

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  if (hasControlChars(v)) return null;
  const t = v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * Clamps a client link to what we store, or returns null when it must be refused: https only, a real DNS host, no
 * control characters anywhere, a non-empty title. The key is derived here from the normalised URL, never trusted
 * from the client, so the same page cannot be saved twice. Nothing is fetched from the URL.
 */
export function cleanLink(input: any): NewLinkEntry | null {
  const url = normalizeLinkUrl(input?.url);
  if (!url) return null;
  const titleKey = linkTitleKey(url);
  if (!titleKey) return null;
  for (const f of ['title', 'platform', 'category', 'tagline', 'thumbnail']) {
    if (typeof input?.[f] === 'string' && hasControlChars(input[f])) return null;
  }
  const title = cleanText(input?.title, LINK_TITLE_MAX);
  if (!title) return null;
  const yt = youtubeIdFromUrl(url);
  let thumbnail: string | null = null;
  if (yt) thumbnail = youtubeThumbnail(yt);
  else if (typeof input?.thumbnail === 'string' && input.thumbnail) {
    thumbnail = safeProviderUrl(input.thumbnail, 500);
    if (!thumbnail) return null; // an explicit thumbnail that is not a safe https URL is refused, not silently dropped
  }
  return {
    kind: 'link',
    titleKey,
    title,
    url,
    platform: cleanText(input?.platform, LINK_PLATFORM_MAX) ?? platformFromUrl(url),
    thumbnail,
    category: cleanText(input?.category, LINK_CATEGORY_MAX),
    tagline: cleanText(input?.tagline, LINK_TAGLINE_MAX)
  };
}

const asTitle = (r: any): WatchlistTitleItem => ({ kind: 'title', titleKey: r.titleKey, title: r.title, posterPath: r.posterPath ?? null, year: r.year ?? null, mediaType: r.mediaType, addedAt: r.addedAt });
const asLink = (r: any): WatchlistLinkItem => ({ kind: 'link', titleKey: r.titleKey, title: r.title, url: r.url, platform: r.platform ?? '', thumbnail: r.thumbnail ?? null, category: r.category ?? null, tagline: r.tagline ?? null, addedAt: r.addedAt });
/** Reads a stored row of either kind (a row with no `kind` is an old title row). Rows that cannot be rendered are dropped. */
export function rowToItem(r: any): WatchlistItem | null {
  if (!r || typeof r.titleKey !== 'string') return null;
  if (r.kind === 'link') return typeof r.url === 'string' ? asLink(r) : null;
  return asTitle(r);
}
const stored = (entry: NewWatchlistEntry, addedAt: number): any => ({ ...entry, kind: (entry as any).kind === 'link' ? 'link' : 'title', addedAt });

export class MemoryWatchlistStore implements WatchlistStore {
  private rows = new Map<string, any[]>();
  constructor(private max = WATCHLIST_MAX_ITEMS, private now: () => number = Date.now) {}
  async list(userId: string) {
    return (this.rows.get(userId) ?? []).map(rowToItem).filter((i): i is WatchlistItem => i !== null).sort((a, b) => b.addedAt - a.addedAt);
  }
  async add(userId: string, entry: NewWatchlistEntry): Promise<AddResult> {
    const list = this.rows.get(userId) ?? [];
    if (list.some((i) => i.titleKey === entry.titleKey)) return 'duplicate';
    if (list.length >= this.max) return 'cap';
    list.push(stored(entry, this.now()));
    this.rows.set(userId, list);
    return 'added';
  }
  async remove(userId: string, titleKey: string) {
    const list = this.rows.get(userId) ?? [];
    const next = list.filter((i) => i.titleKey !== titleKey);
    this.rows.set(userId, next);
    return next.length !== list.length;
  }
  deleteUser(userId: string) {
    this.rows.delete(userId);
  }
}

/** Minimal collection surface (the MongoDB driver's Collection satisfies it). */
interface ColLike {
  find(q: any): { sort(s: any): { limit(n: number): { toArray(): Promise<any[]> } } };
  countDocuments(q: any): Promise<number>;
  insertOne(doc: any): Promise<unknown>;
  deleteOne(q: any): Promise<{ deletedCount?: number }>;
}
export class MongoWatchlistStore implements WatchlistStore {
  constructor(private col: () => ColLike, private max = WATCHLIST_MAX_ITEMS) {}
  async list(userId: string) {
    const rows = await this.col().find({ userId }).sort({ addedAt: -1 }).limit(this.max).toArray();
    return rows.map(rowToItem).filter((i): i is WatchlistItem => i !== null);
  }
  async add(userId: string, entry: NewWatchlistEntry): Promise<AddResult> {
    const col = this.col();
    if ((await col.countDocuments({ userId })) >= this.max) {
      // an existing entry is still reported as a duplicate rather than "full"
      if (await col.countDocuments({ userId, titleKey: entry.titleKey })) return 'duplicate';
      return 'cap';
    }
    try {
      await col.insertOne({ userId, ...stored(entry, Date.now()) });
    } catch (err: any) {
      if (err?.code === 11000) return 'duplicate'; // unique index (userId, titleKey)
      throw err;
    }
    // The count above and the insert are not one atomic step, so two simultaneous adds at the limit could both pass
    // it. Re-count after inserting: if the list now exceeds the cap, take our own row back out. Concurrent adders can
    // then both be refused (never both kept), so the cap can never persist above WATCHLIST_MAX_ITEMS.
    if ((await col.countDocuments({ userId })) > this.max) {
      await col.deleteOne({ userId, titleKey: entry.titleKey });
      return 'cap';
    }
    return 'added';
  }
  async remove(userId: string, titleKey: string) {
    const r = await this.col().deleteOne({ userId, titleKey });
    return (r.deletedCount ?? 0) > 0;
  }
}
