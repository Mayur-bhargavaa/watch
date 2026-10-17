import type { CatalogTitle } from '@synccinema/common';
import { discoverSearchHref } from './catalog/urlState';
import { liveGames, type GameCardData } from './gamesHub';

/**
 * The one search box (in the header): classification of what was typed, and the grouped suggestion list.
 * Pure: no DOM, no fetch (the component fetches and passes results in), so it is unit tested.
 */

/** YouTube link or bare 11-character id (same rule the header always used). */
export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  // A bare id must look random: an 11-letter title such as "Oppenheimer" or "Ratatouille" is a search, not a video. Real ids almost
  // always hold a digit, "-" or "_", or capitals inside the word; words that are all lower case, ALL CAPS or Capitalised do not.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) && (/[0-9_-]/.test(trimmed) || (/[A-Z]/.test(trimmed.slice(1)) && /[a-z]/.test(trimmed)))) return trimmed;
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export type SearchIntent =
  | { kind: 'empty' }
  | { kind: 'youtube'; id: string }
  /** a room link, or a code with the shape of a generated one: Enter goes straight to the room */
  | { kind: 'room'; code: string }
  /** free text for the catalog; `codeLike` is set when it could also be a custom room code (offered as a row, not forced) */
  | { kind: 'text'; text: string; codeLike: string | null };

/** Room codes are 3-40 characters of letters, digits, "-" and "_" (custom codes); generated ones are 8. */
const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/;
/**
 * A generated room code (nanoid(8), lower-cased) that contains a digit, "-" or "_". A bare 8-letter word such as
 * "avengers" is far more likely a title than a code, so it is treated as text (it still appears as a "Join room" row).
 */
const GENERATED_CODE_RE = /^(?=.*[0-9_-])[A-Za-z0-9_-]{8}$/;

/**
 * Order of checks (YouTube first, exactly as before): YouTube link / id, room link (".../room/<code>"), a generated
 * room code, otherwise free text. Single words that are not generated-looking codes now search the catalog instead
 * of opening a room; a "Join room" suggestion keeps custom codes one keystroke away.
 */
export function classifySearchInput(raw: string): SearchIntent {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { kind: 'empty' };
  const yt = extractYouTubeId(trimmed);
  if (yt) return { kind: 'youtube', id: yt };
  const link = /\/room\/([A-Za-z0-9_-]{3,64})(?:[/?#].*)?$/.exec(trimmed);
  if (link) return { kind: 'room', code: link[1] };
  if (GENERATED_CODE_RE.test(trimmed)) return { kind: 'room', code: trimmed };
  return { kind: 'text', text: trimmed.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 100), codeLike: CODE_RE.test(trimmed) ? trimmed : null };
}

/** Text worth sending to the catalog: at least 2 characters and not a link or room code. */
export const shouldSearchCatalog = (intent: SearchIntent): intent is Extract<SearchIntent, { kind: 'text' }> => intent.kind === 'text' && intent.text.length >= 2;

// ---- suggestions -----------------------------------------------------------------------------------------------

export type CatalogSuggestState = 'idle' | 'loading' | 'ok' | 'not_configured' | 'unavailable' | 'guest';

export interface SuggestionOption {
  /** stable id, also the DOM id suffix (aria-activedescendant) */
  id: string;
  kind: 'title' | 'game' | 'room' | 'youtube' | 'status' | 'all';
  label: string;
  detail?: string;
  href?: string;
  /** poster path of a catalog title, if any */
  posterPath?: string | null;
  /** present for the YouTube row: the video id the header launches a party with */
  youtubeId?: string;
  roomCode?: string;
  /** status rows are not selectable */
  disabled?: boolean;
}
export interface SuggestionGroup {
  id: 'titles' | 'games' | 'room' | 'youtube' | 'status' | 'all';
  label: string;
  options: SuggestionOption[];
}

export const MAX_TITLE_SUGGESTIONS = 5;
export const MAX_GAME_SUGGESTIONS = 4;

/** Live games whose name or blurb matches every word typed. Only live games, linking to the game's own route. */
export function matchGames(text: string, games: readonly GameCardData[] = liveGames(), max = MAX_GAME_SUGGESTIONS): GameCardData[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: Array<{ g: GameCardData; score: number }> = [];
  for (const g of games) {
    if (g.isComingSoon || !g.route) continue;
    const title = g.title.toLowerCase();
    const hay = `${title} ${g.id.replace(/-/g, ' ')} ${g.subtext.toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    // title matches rank above blurb matches; earlier match first
    const inTitle = words.every((w) => title.includes(w));
    scored.push({ g, score: (inTitle ? 0 : 100) + Math.max(0, title.indexOf(words[0])) });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, max).map((s) => s.g);
}

const titleHrefOf = (t: Pick<CatalogTitle, 'source' | 'mediaType' | 'sourceId'>) => `/discover/title/${t.source}/${t.mediaType}/${t.sourceId}`;
const yearOf = (t: Pick<CatalogTitle, 'releaseDate'>) => (t.releaseDate ? t.releaseDate.slice(0, 4) : '');

export interface BuildInput {
  intent: SearchIntent;
  catalog: readonly CatalogTitle[];
  catalogState: CatalogSuggestState;
  games?: readonly GameCardData[];
}

/** Groups for the dropdown: YouTube launch, Movies & shows, Games, Join room (and a status line when search is unavailable). */
export function buildSuggestions({ intent, catalog, catalogState, games }: BuildInput): SuggestionGroup[] {
  const groups: SuggestionGroup[] = [];
  if (intent.kind === 'empty') return groups;
  if (intent.kind === 'youtube') {
    groups.push({ id: 'youtube', label: 'Video', options: [{ id: 'opt-yt', kind: 'youtube', label: 'Start a watch party with this video', detail: intent.id, youtubeId: intent.id }] });
    return groups;
  }
  if (intent.kind === 'room') {
    groups.push({ id: 'room', label: 'Room', options: [{ id: 'opt-room', kind: 'room', label: `Join room ${intent.code}`, href: `/room/${encodeURIComponent(intent.code)}`, roomCode: intent.code }] });
    return groups;
  }
  const titles = catalog.slice(0, MAX_TITLE_SUGGESTIONS).map<SuggestionOption>((t, i) => ({
    id: `opt-title-${i}`,
    kind: 'title',
    label: t.title,
    detail: [yearOf(t), t.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · '),
    href: titleHrefOf(t),
    posterPath: t.posterPath
  }));
  if (titles.length) groups.push({ id: 'titles', label: 'Movies & shows', options: titles });
  if (catalogState === 'unavailable') groups.push({ id: 'status', label: 'Movies & shows', options: [{ id: 'opt-status', kind: 'status', label: 'Search unavailable', detail: 'Press Enter to open full results', disabled: true }] });
  const gameOptions = matchGames(intent.text, games).map<SuggestionOption>((g) => ({ id: `opt-game-${g.id}`, kind: 'game', label: g.title, detail: g.players, href: g.route }));
  if (gameOptions.length) groups.push({ id: 'games', label: 'Games', options: gameOptions });
  if (intent.codeLike) groups.push({ id: 'room', label: 'Room', options: [{ id: 'opt-room', kind: 'room', label: `Join room ${intent.codeLike}`, href: `/room/${encodeURIComponent(intent.codeLike)}`, roomCode: intent.codeLike }] });
  // "See all results" for pointer and touch users: the same place Enter goes (Discover with the Cineverse filters)
  if (titles.length) groups.push({ id: 'all', label: 'All results', options: [{ id: 'opt-all', kind: 'all', label: `See all results for \u201c${intent.text}\u201d`, href: discoverSearchHref(intent.text) }] });
  return groups;
}

/** Selectable options in on-screen order (the arrow keys walk this list). */
export const flattenOptions = (groups: readonly SuggestionGroup[]): SuggestionOption[] => groups.flatMap((g) => g.options).filter((o) => !o.disabled);

/** The line announced to screen readers when the list changes. */
export function announceSuggestions(groups: readonly SuggestionGroup[], state: CatalogSuggestState, intent: SearchIntent): string {
  if (intent.kind === 'empty') return '';
  const n = flattenOptions(groups).length;
  if (state === 'loading' && n === 0) return 'Searching';
  if (state === 'unavailable') return n ? `Search unavailable for movies and shows. ${n} other ${n === 1 ? 'suggestion' : 'suggestions'}` : 'Search unavailable. Press Enter to open full results';
  return n === 0 ? 'No suggestions. Press Enter to search all results' : `${n} ${n === 1 ? 'suggestion' : 'suggestions'} available`;
}

/** Where Enter goes when no suggestion is highlighted. Null means "launch a party / handled by the caller". */
export function enterDestination(intent: SearchIntent): { type: 'youtube'; id: string } | { type: 'push'; href: string } | null {
  switch (intent.kind) {
    case 'empty':
      return null;
    case 'youtube':
      return { type: 'youtube', id: intent.id };
    case 'room':
      return { type: 'push', href: `/room/${encodeURIComponent(intent.code)}` };
    case 'text':
      return { type: 'push', href: discoverSearchHref(intent.text) };
  }
}

/** The legacy dashboard URL `/dashboard?search=<text>` now lives at `/discover?q=<text>`. */
export function legacySearchRedirect(searchParam: string | null | undefined): string | null {
  const t = (searchParam ?? '').trim();
  return t ? discoverSearchHref(t) : null;
}
