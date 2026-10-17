import type { CatalogTitle } from '@synccinema/common';

/** Most slides the Discover hero carousel shows (Home shows a similar handful). */
export const HERO_MAX_SLIDES = 6;
/** A horizontal swipe has to move at least this many pixels (same threshold as Home). */
export const SWIPE_THRESHOLD_PX = 45;

/** A title can headline the hero only with a backdrop image and a name. */
export const isHeroUsable = (t: CatalogTitle): boolean => Boolean(t.backdropPath && t.title);

/** Round-robin merge of several lists (first of each, then second of each, ...). Used to mix the Indian rows. */
export function interleaveTitles(lists: CatalogTitle[][]): CatalogTitle[] {
  const out: CatalogTitle[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/**
 * Builds the slide list client-side from real collection data. Each group contributes its first `take` usable titles
 * in order (de-duplicated by title key across groups); if that leaves fewer than `max` slides, the remaining usable
 * titles are appended in the same group order. The result is stable for the same input.
 */
export function buildHeroSlides(groups: Array<{ titles: CatalogTitle[]; take: number }>, max = HERO_MAX_SLIDES): CatalogTitle[] {
  const seen = new Set<string>();
  const out: CatalogTitle[] = [];
  const leftovers: CatalogTitle[] = [];
  for (const g of groups) {
    let taken = 0;
    for (const t of g.titles) {
      if (!isHeroUsable(t) || seen.has(t.id)) continue;
      if (taken < g.take && out.length < max) {
        seen.add(t.id);
        out.push(t);
        taken++;
      } else {
        leftovers.push(t);
      }
    }
  }
  for (const t of leftovers) {
    if (out.length >= max) break;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/** Eyebrow pill text: the kind of title plus its first genre when known, e.g. "Movie · Drama". */
export function heroTag(t: Pick<CatalogTitle, 'mediaType' | 'genres'>): string {
  const kind = t.mediaType === 'tv' ? 'TV Series' : 'Movie';
  const genre = t.genres[0]?.name;
  return genre ? `${kind} · ${genre}` : kind;
}

/** Next / previous slide with wrap-around. */
export function stepIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}
/** Keeps an index valid after the list length changed. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(index) || 0), length - 1);
}
/** Swipe to a slide step: finger moved left by more than the threshold = next (+1), right = previous (-1), else 0. */
export function swipeDelta(startX: number | null, endX: number, threshold = SWIPE_THRESHOLD_PX): -1 | 0 | 1 {
  if (startX === null) return 0;
  const diff = startX - endX;
  if (diff > threshold) return 1;
  if (diff < -threshold) return -1;
  return 0;
}
/** Arrow keys on the focused carousel: right = next, left = previous. */
export function keyDelta(key: string): -1 | 0 | 1 {
  return key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
}
