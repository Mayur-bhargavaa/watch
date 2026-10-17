import { isLinkItem, isTitleItem, normalizeLinkUrl, parseTitleKey, youtubeIdFromUrl, youtubeThumbnail, type WatchlistItem, type WatchlistLinkItem } from '@synccinema/common';

/** Pure view helpers of the Watchlist page: tabs, counts, thumbnails, links. */
export type WatchlistTab = 'all' | 'movie' | 'tv' | 'link';
export const WATCHLIST_TABS: Array<{ id: WatchlistTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
  { id: 'link', label: 'Links' }
];

export function filterWatchlist(items: readonly WatchlistItem[], tab: WatchlistTab): WatchlistItem[] {
  switch (tab) {
    case 'all':
      return [...items];
    case 'link':
      return items.filter(isLinkItem);
    case 'movie':
      return items.filter((i) => isTitleItem(i) && i.mediaType === 'movie');
    case 'tv':
      return items.filter((i) => isTitleItem(i) && i.mediaType === 'tv');
  }
}

export function tabCounts(items: readonly WatchlistItem[]): Record<WatchlistTab, number> {
  return {
    all: items.length,
    movie: filterWatchlist(items, 'movie').length,
    tv: filterWatchlist(items, 'tv').length,
    link: filterWatchlist(items, 'link').length
  };
}

/** Parses `?tab=` (anything unknown means "all"). */
export function parseTab(value: string | null | undefined): WatchlistTab {
  return WATCHLIST_TABS.some((t) => t.id === value) ? (value as WatchlistTab) : 'all';
}

/** Thumbnail of a link: the stored one, else the YouTube still derived from the URL, else null (the card shows an icon). */
export function linkThumbnail(item: Pick<WatchlistLinkItem, 'url' | 'thumbnail'>): string | null {
  if (item.thumbnail) return item.thumbnail;
  const id = youtubeIdFromUrl(item.url);
  return id ? youtubeThumbnail(id) : null;
}

/** The https URL to open for a link item, or null when it is not a safe https link (the card then shows no Open button). */
export const safeOpenUrl = (item: Pick<WatchlistLinkItem, 'url'>): string | null => normalizeLinkUrl(item.url);

export const titleDetailHref = (titleKey: string): string | null => {
  const k = parseTitleKey(titleKey); // strict allow-list: tmdb (movie|tv) and tvmaze (tv)
  return k ? `/discover/title/${k.source}/${k.mediaType}/${k.sourceId}` : null;
};

/** Default title for a link added without one: "YouTube video" for YouTube links, otherwise the site name. */
export function defaultLinkTitle(url: string): string {
  const n = normalizeLinkUrl(url);
  if (!n) return '';
  if (youtubeIdFromUrl(n)) return 'YouTube video';
  try {
    return new URL(n).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
