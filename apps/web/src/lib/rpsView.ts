/**
 * Pure helpers for the Rock Paper Scissors screens. The server owns every rule, phase and deadline; these only turn what it sends
 * into what to draw. (No React, so they are unit tested.)
 */
import type { RpsChoice, RpsFormat, RpsGameState, RpsRoundReveal } from '@synccinema/common';

export const CHOICE_LIST: { id: RpsChoice; label: string }[] = [
  { id: 'rock', label: 'Rock' },
  { id: 'paper', label: 'Paper' },
  { id: 'scissors', label: 'Scissors' }
];

export const FORMAT_CHOICES: { id: RpsFormat; label: string; hint: string }[] = [
  { id: 'single', label: 'Single round', hint: 'Quick Match' },
  { id: 'best-of-3', label: 'Best of 3', hint: 'First to 2 wins' },
  { id: 'best-of-5', label: 'Best of 5', hint: 'First to 3 wins' }
];

/** true only for a state in the Rock Paper Scissors format (anything else, such as a room from another game, is not drawn) */
export function isRpsState(s: unknown): s is RpsGameState {
  const v = s as Partial<RpsGameState> | null | undefined;
  return !!v && typeof v.matchId === 'string' && typeof v.roundId === 'string' && typeof v.status === 'string' && Array.isArray(v.scores) && Array.isArray(v.locked);
}

export const isRpsLive = (s: RpsGameState | null | undefined): boolean => !!s && !['match-result', 'cancelled', 'forfeit', 'waiting'].includes(s.status);

/** whole seconds until the phase ends, from the server deadline and this device's offset from the server clock */
export function phaseSeconds(state: Pick<RpsGameState, 'deadlineAt'> | null | undefined, deviceNowMs: number, offsetMs: number): number | null {
  if (!state?.deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(state.deadlineAt) - (deviceNowMs + offsetMs)) / 1000));
}

/** the big countdown word: 3, 2, 1, then GO! */
export function countdownWord(secondsLeft: number | null): string {
  if (secondsLeft === null) return '';
  return secondsLeft <= 0 ? 'GO!' : String(secondsLeft);
}

export type Outcome = 'win' | 'lose' | 'draw';
/** how the revealed round went for `mySeat` (null for a spectator) */
export function outcomeFor(reveal: RpsRoundReveal | null | undefined, mySeat: number | null): Outcome | null {
  if (!reveal || mySeat === null) return null;
  if (reveal.winnerSeat === null) return 'draw';
  return reveal.winnerSeat === mySeat ? 'win' : 'lose';
}

export function outcomeText(o: Outcome | null): string {
  return o === 'win' ? 'You Win!' : o === 'lose' ? 'You Lose' : o === 'draw' ? 'Draw' : '';
}

/** what the screen can say about the other player's choice (it is never known before the reveal) */
export function opponentStatus(state: RpsGameState, mySeat: number | null): 'choosing' | 'locked' | null {
  if (mySeat === null || state.status !== 'choosing') return null;
  return state.locked[mySeat === 0 ? 1 : 0] ? 'locked' : 'choosing';
}

export const formatLabel = (f: RpsFormat): string => FORMAT_CHOICES.find((x) => x.id === f)?.label ?? 'Best of 3';

/** the phase as a short label for the banner */
export function phaseLabel(s: RpsGameState): string {
  switch (s.status) {
    case 'countdown': return 'GET READY';
    case 'choosing': return 'CHOOSE NOW';
    case 'revealing': return 'REVEAL';
    case 'round-result': return 'ROUND RESULT';
    case 'match-result': return 'MATCH OVER';
    case 'cancelled': return 'CANCELLED';
    case 'forfeit': return 'FORFEIT';
    default: return 'WAITING';
  }
}
