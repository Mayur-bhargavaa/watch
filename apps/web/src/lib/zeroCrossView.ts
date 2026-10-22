/**
 * Pure helpers for the Zero Cross screens (no React, so they are unit tested). The server owns the rules and the clock;
 * these only turn what it sends into what to draw.
 */
import type { ZeroCrossGameState } from '@synccinema/common';

export type ZeroMark = 'X' | 'O';

/**
 * True only for a state in the Zero Cross format. A room created before Zero Cross had its own rules holds a plain 3x3 state
 * (no pieces to place, no clock), and the screens must say so instead of crashing on it.
 */
export function isZeroCrossState(s: unknown): s is ZeroCrossGameState {
  const v = s as Partial<ZeroCrossGameState> | null | undefined;
  return !!v && Array.isArray(v.board) && v.board.length === 9
    && !!v.remainingPlacements && typeof v.remainingPlacements.X === 'number' && typeof v.remainingPlacements.O === 'number'
    && typeof v.phase === 'string' && typeof v.status === 'string' && typeof v.version === 'number';
}

/** how far this device's clock is from the server's (server minus device, in ms), from the `serverTime` that comes with a state */
export function clockOffset(serverTimeIso: string | undefined | null, deviceNowMs: number): number {
  const t = serverTimeIso ? Date.parse(serverTimeIso) : NaN;
  return Number.isFinite(t) ? t - deviceNowMs : 0;
}

/** whole seconds left on the match clock, counted from the server's deadline; null when the match has no timer */
export function secondsLeft(state: Pick<ZeroCrossGameState, 'deadlineAt'> | null | undefined, deviceNowMs: number, offsetMs: number): number | null {
  if (!state?.deadlineAt) return null;
  const left = Date.parse(state.deadlineAt) - (deviceNowMs + offsetMs);
  return Math.max(0, Math.ceil(left / 1000));
}

export function formatClock(seconds: number | null): string {
  if (seconds === null) return 'No timer';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const DURATION_CHOICES: { seconds: number | null; label: string; hint: string }[] = [
  { seconds: 180, label: '3 min', hint: 'Quick Match' },
  { seconds: 300, label: '5 min', hint: 'Standard Match' },
  { seconds: 600, label: '10 min', hint: 'Strategic Match' },
  { seconds: null, label: 'Unlimited', hint: 'No timer' }
];

export const isLive = (s: ZeroCrossGameState | null | undefined): boolean => !!s && s.status === 'active' && s.phase !== 'finished';

export function markOfSeat(seat: number | null | undefined): ZeroMark | null {
  return seat === 0 ? 'X' : seat === 1 ? 'O' : null;
}

/** cells the player could touch right now: empty cells to place on, or (when a piece is picked up) every empty cell to move it to */
export function targetCells(state: ZeroCrossGameState, mark: ZeroMark, selected: number | null): number[] {
  if (!isLive(state) || state.currentTurnMark !== mark) return [];
  if (state.phase === 'placement') return state.board.flatMap((c, i) => (c === null ? [i] : []));
  if (selected === null || state.board[selected] !== mark) return [];
  return state.board.flatMap((c, i) => (c === null ? [i] : []));
}

/** the pieces that may be picked up this turn (movement phase only) */
export function movablePieces(state: ZeroCrossGameState, mark: ZeroMark): number[] {
  if (!isLive(state) || state.phase !== 'movement' || state.currentTurnMark !== mark) return [];
  return state.board.flatMap((c, i) => (c === mark ? [i] : []));
}

/** what a tap on `cell` should do, or null when it does nothing (the server still checks everything) */
export function actionForTap(state: ZeroCrossGameState, mark: ZeroMark, selected: number | null, cell: number):
  | { type: 'select'; cell: number }
  | { type: 'deselect' }
  | { type: 'send'; action: { kind: 'place'; to: number } | { kind: 'move'; from: number; to: number } }
  | null {
  if (!isLive(state) || state.currentTurnMark !== mark) return null;
  const here = state.board[cell];
  if (state.phase === 'placement') return here === null ? { type: 'send', action: { kind: 'place', to: cell } } : null;
  if (here === mark) return selected === cell ? { type: 'deselect' } : { type: 'select', cell };
  if (here === null && selected !== null && state.board[selected] === mark) return { type: 'send', action: { kind: 'move', from: selected, to: cell } };
  return null;
}

export function newMoveId(rand: () => number = Math.random, now: () => number = Date.now): string {
  return `${now().toString(36)}-${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

export const ROW_COL = (cell: number): string => `row ${Math.floor(cell / 3) + 1}, column ${(cell % 3) + 1}`;

/** the one-line result for the end-of-match card */
export function resultText(state: ZeroCrossGameState, myMark: ZeroMark | null, names: { X: string; O: string }): { title: string; detail: string } {
  const iWon = myMark !== null && state.winner === myMark;
  const spectator = myMark === null;
  switch (state.status) {
    case 'won':
      return { title: spectator ? `${names[state.winner as ZeroMark]} WON!` : iWon ? 'VICTORY!' : 'OPPONENT WON!', detail: 'Three in a line.' };
    case 'surrendered':
      return { title: spectator ? `${names[state.winner as ZeroMark]} WON!` : iWon ? 'THEY SURRENDERED!' : 'YOU SURRENDERED', detail: iWon ? 'Your opponent gave up. You win!' : spectator ? 'A player surrendered.' : 'Surrendering counts as a loss.' };
    case 'forfeit':
      return { title: spectator ? `${names[state.winner as ZeroMark]} WON!` : iWon ? 'YOU WIN!' : 'MATCH FORFEITED', detail: iWon ? 'Your opponent left the match.' : spectator ? 'A player left the match.' : 'You left the match.' };
    case 'timeout':
    case 'draw':
      return { title: 'DRAW!', detail: "Time's up with no line of three." };
    case 'cancelled':
      return { title: 'MATCH CANCELLED', detail: 'The host cancelled the match.' };
    default:
      return { title: '', detail: '' };
  }
}
