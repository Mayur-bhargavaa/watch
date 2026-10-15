// Pure view helpers for the Bingo Duel page (per-viewer projected state).

export interface DuelViewState {
  phase?: string;
  winnerUserId?: string | null;
  winnerDisplayName?: string | null;
  lastRoundWinnerUserId?: string | null;
  roundHistory?: Array<{ winnerUserId: string; winnerDisplayName: string }>;
  turnStartedAt?: number;
  turnTimeoutMs?: number;
}

export interface DuelOutcome {
  winnerUserId: string | null;
  winnerDisplayName: string | null;
}

/** Winner of the round (ROUND_OVER) or match (FINISHED), derived from server state only (BD-10, BD-18). */
export function resolveDuelOutcome(
  state: DuelViewState | null | undefined,
  fallback?: { userId?: string; displayName?: string } | null
): DuelOutcome {
  if (!state) return { winnerUserId: fallback?.userId ?? null, winnerDisplayName: fallback?.displayName ?? null };
  const last = state.roundHistory && state.roundHistory.length > 0 ? state.roundHistory[state.roundHistory.length - 1] : null;
  if (state.phase === 'FINISHED') {
    if (state.winnerUserId) {
      return { winnerUserId: state.winnerUserId, winnerDisplayName: state.winnerDisplayName ?? null };
    }
    return { winnerUserId: null, winnerDisplayName: null }; // draw
  }
  if (state.lastRoundWinnerUserId) {
    const named = last && last.winnerUserId === state.lastRoundWinnerUserId ? last.winnerDisplayName : null;
    return { winnerUserId: state.lastRoundWinnerUserId, winnerDisplayName: named ?? fallback?.displayName ?? null };
  }
  if (last) return { winnerUserId: last.winnerUserId, winnerDisplayName: last.winnerDisplayName };
  return { winnerUserId: fallback?.userId ?? null, winnerDisplayName: fallback?.displayName ?? null };
}

/**
 * The opponent forfeited (left) only when the server told us so while the match was not already
 * decided. A normal finished match followed by the winner closing the tab is NOT a forfeit (BD-10).
 */
export function isOpponentForfeit(
  phase: string | undefined,
  leftEvent: { winnerUserId?: string } | null | undefined,
  myUserId: string
): boolean {
  if (!leftEvent || phase === 'FINISHED') return false;
  return leftEvent.winnerUserId === myUserId;
}

/** Seconds left on the current turn (server auto-picks at turnStartedAt + turnTimeoutMs). */
export function turnSecondsLeft(state: DuelViewState | null | undefined, now: number): number | null {
  if (!state || state.phase !== 'PLAYING' || !state.turnStartedAt) return null;
  const timeout = state.turnTimeoutMs && state.turnTimeoutMs > 0 ? state.turnTimeoutMs : 45000;
  return Math.max(0, Math.ceil((state.turnStartedAt + timeout - now) / 1000));
}

const ERROR_TEXT: Record<string, string> = {
  NOT_A_PLAYER: 'You are not a player in this match.',
  NOT_HOST: 'Only the host can do that.',
  ALREADY_STARTED: '',
  NOT_ENOUGH_PLAYERS: 'Two players are needed to start.',
  INVALID_CONFIG: 'Those settings are not valid.',
  WRONG_PHASE: 'That action is not available right now.',
  INVALID_PICK: 'You cannot pick that number now (not your turn or already called).',
  BOARD_REJECTED: 'That board was rejected. Boards can only be changed before the match starts.',
  INVALID_NUMBER: 'That number is not valid.',
  TURN_BASED: 'Bingo Duel is turn based: pick a number on your turn.'
};

/** User-facing text for a bingo:error. Empty string means "ignore silently". */
export function bingoErrorText(code: string | undefined, message?: string): string {
  if (code && Object.prototype.hasOwnProperty.call(ERROR_TEXT, code)) {
    const t = ERROR_TEXT[code];
    if (t === '') return '';
    return message && code === 'INVALID_CONFIG' ? message : t;
  }
  return message || 'Something went wrong.';
}
