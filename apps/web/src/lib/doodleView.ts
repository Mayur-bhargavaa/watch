// Pure helpers for the Doodle Duel UI (kept free of React so they can be unit tested).

export interface DoodleLobbyPlayer {
  userId: string;
}

/** Mirrors the server's lobby role resolution: explicit choices win, conflicts are settled by the host. */
export function resolveLobbyDrawer(
  players: DoodleLobbyPlayer[],
  hostUserId: string,
  drawerUserId: string | undefined,
  roleSelections: Record<string, string | null> | undefined
): string {
  if (players.length === 0) return '';
  const p1 = players[0].userId;
  if (players.length < 2) return p1;
  const p2 = players[1].userId;
  const roles = roleSelections || {};
  const r1 = roles[p1] || null;
  const r2 = roles[p2] || null;
  const pref = drawerUserId && players.some(p => p.userId === drawerUserId) ? drawerUserId : p1;
  if (r1 && r1 === r2) {
    const hostRole = roles[hostUserId];
    if (hostRole === 'drawer') return hostUserId;
    if (hostRole === 'guesser') return hostUserId === p1 ? p2 : p1;
    return p1;
  }
  if (r1 === 'drawer' || r2 === 'guesser') return p1;
  if (r2 === 'drawer' || r1 === 'guesser') return p2;
  return pref;
}

/** What to send in `doodle:select_role` when `me` clicks the seat of `clickedUserId`. */
export function roleSelectionPayload(isHost: boolean, myUserId: string, clickedUserId: string): string {
  if (isHost) return clickedUserId; // host may assign the drawer directly
  return clickedUserId === myUserId ? 'drawer' : 'guesser';
}

export type DoodlePhaseName =
  | 'LOBBY' | 'ROLE_SELECTION' | 'ROUND_INTRO' | 'WORD_CHOICE' | 'CHOOSING_WORD'
  | 'DRAWING' | 'GUESSING' | 'ROUND_RESULT' | 'FINISHED' | string;

/** Total seconds of the current phase, used for the timer ring (DD-24). */
export function phaseTotalSeconds(
  phase: DoodlePhaseName | undefined,
  config: { drawTime?: number; drawTimeSeconds?: number; guessTime?: number; wordSelectionTimeSeconds?: number } | undefined
): number {
  const draw = Number(config?.drawTime ?? config?.drawTimeSeconds) || 60;
  const guess = Number(config?.guessTime) || 60;
  switch (phase) {
    case 'GUESSING': return guess;
    case 'DRAWING': return draw;
    case 'ROUND_INTRO': return 3;
    case 'WORD_CHOICE':
    case 'CHOOSING_WORD': return Number(config?.wordSelectionTimeSeconds) || 30;
    case 'ROUND_RESULT': return 5;
    default: return draw;
  }
}

/** Final winner honouring forfeit/tie bookkeeping from the server (DD-13). null => draw. */
export function resolveFinalWinner(
  state: { finalWinnerUserId?: string | null; scores?: Record<string, number> } | null | undefined,
  playerIds: string[]
): string | null {
  if (!state) return null;
  if (state.finalWinnerUserId) return state.finalWinnerUserId;
  if (state.finalWinnerUserId === undefined && playerIds.length >= 2) {
    const a = state.scores?.[playerIds[0]] || 0;
    const b = state.scores?.[playerIds[1]] || 0;
    if (a === b) return null;
    return a > b ? playerIds[0] : playerIds[1];
  }
  return null;
}

/** Number of guessable letters/characters in a masked word like "_ _ a _". */
export function maskedLetterCount(masked: string | undefined | null): number {
  return ((masked || '').match(/[_\p{L}\p{N}]/gu) || []).length;
}

const MAX_STROKE_POINTS = 580;

/** Clamp a normalised coordinate to 0..1 (server clamps the same way). */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Split a long freehand point list into chunks the server accepts (<= 600 points), overlapping by one point. */
export function chunkPoints<T>(points: T[], max: number = MAX_STROKE_POINTS): T[][] {
  if (points.length <= max) return points.length ? [points] : [];
  const out: T[][] = [];
  let i = 0;
  while (i < points.length) {
    const end = Math.min(points.length, i + max);
    out.push(points.slice(i, end));
    if (end >= points.length) break;
    i = end - 1;
  }
  return out;
}
