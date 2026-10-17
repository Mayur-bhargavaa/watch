import type { CatalogTitle, EpisodeInfo, SeasonInfo } from '@synccinema/common';

/** Pure helpers for the TV title page (seasons and episodes, next episode, rating chips). No DOM, unit tested. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-01" -> "1 Nov 2026". Anything that is not a real YYYY-MM-DD date gives null (never a guessed date). */
export function formatAirdate(date: string | null | undefined): string | null {
  const m = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} ${MONTHS[month - 1]} ${m[1]}`;
}

/** "S2 E5" (a next-episode entry without a number is just "S2"). */
export function episodeCode(e: Pick<EpisodeInfo, 'season' | 'number'>): string {
  return e.number > 0 ? `S${e.season} E${e.number}` : `S${e.season}`;
}

/** The badge text: "Next episode: S2 E5, Name, 1 Nov 2026" (parts that are unknown are left out). */
export function nextEpisodeLabel(e: EpisodeInfo | null | undefined): string | null {
  if (!e) return null;
  const parts = [[episodeCode(e), e.name].filter(Boolean).join(' '), formatAirdate(e.airdate)].filter(Boolean);
  return `Next episode: ${parts.join(', ')}`;
}

export const runtimeLabel = (min: number | null | undefined): string | null => (typeof min === 'number' && min > 0 ? `${min} min` : null);

export interface SeasonTab {
  number: number;
  label: string;
  count: number;
}
export function seasonTabs(seasons: SeasonInfo[] | undefined): SeasonTab[] {
  return (seasons ?? []).filter((s) => s.episodes.length > 0).map((s) => ({ number: s.number, label: `Season ${s.number}`, count: s.episodes.length }));
}

/** Season shown first: the season of the next episode, else the latest one that has aired, else the last season. */
export function defaultSeason(seasons: SeasonInfo[] | undefined, nextEpisode: EpisodeInfo | null | undefined, today: string): number | null {
  const list = (seasons ?? []).filter((s) => s.episodes.length > 0);
  if (!list.length) return null;
  if (nextEpisode && list.some((s) => s.number === nextEpisode.season)) return nextEpisode.season;
  const aired = list.filter((s) => s.episodes.some((e) => e.airdate && e.airdate <= today));
  return (aired.length ? aired : list)[(aired.length ? aired : list).length - 1].number;
}

/** Moves the selected tab with the arrow keys / Home / End (wraps), as the tabs pattern requires. */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export interface RatingChip {
  source: string;
  value: number;
  label: string;
}
/** One chip per source: "TMDB 8.4", "TVmaze 9.2". Falls back to the single primary rating of older payloads. */
export function ratingChips(t: Pick<CatalogTitle, 'rating' | 'ratingSource' | 'ratings'>): RatingChip[] {
  const list = t.ratings && t.ratings.length ? t.ratings : t.rating !== null ? [{ source: t.ratingSource, value: t.rating }] : [];
  const seen = new Set<string>();
  const out: RatingChip[] = [];
  for (const r of list) {
    if (typeof r.value !== 'number' || !Number.isFinite(r.value) || seen.has(r.source)) continue;
    seen.add(r.source);
    out.push({ source: r.source, value: r.value, label: `${r.source} ${r.value.toFixed(1)}` });
  }
  return out;
}

export const totalEpisodes = (seasons: SeasonInfo[] | undefined): number => (seasons ?? []).reduce((n, s) => n + s.episodes.length, 0);
