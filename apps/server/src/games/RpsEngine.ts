import { randomUUID } from 'node:crypto';
import { RPS_DEFAULT_FORMAT, RPS_FORMATS } from '@synccinema/common';
import type { RpsChoice, RpsFormat, RpsGameState, RpsRoundReveal, RpsTimeoutPolicy } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

export const CHOICES: readonly RpsChoice[] = ['rock', 'paper', 'scissors'];

/** What the server keeps to itself: never part of any state that is sent to a screen. */
export interface RpsSecret {
  roundId: string;
  /** what each seat has picked so far (changeable until locked) */
  picks: [RpsChoice | null, RpsChoice | null];
  locked: [boolean, boolean];
}

export interface RpsConfig {
  countdownMs: number;
  chooseMs: number;
  revealMs: number;
  resultMs: number;
  timeoutPolicy: RpsTimeoutPolicy;
  /** a pick may be changed until it is locked */
  allowChange: boolean;
  /** a series of draws cannot go on forever: after this many rounds the higher score wins */
  maxRounds: number;
}

export const DEFAULT_RPS_CONFIG: RpsConfig = {
  countdownMs: 3000,
  chooseMs: 10_000,
  revealMs: 1500,
  resultMs: 3000,
  timeoutPolicy: 'award-to-submitter',
  allowChange: true,
  maxRounds: 15
};

type Player = { userId: string; displayName: string; seat: number };
const WINS_NEEDED: Record<RpsFormat, number> = { single: 1, 'best-of-3': 2, 'best-of-5': 3 };

export const isChoice = (v: unknown): v is RpsChoice => typeof v === 'string' && (CHOICES as readonly string[]).includes(v);
export const sanitizeFormat = (raw: unknown): RpsFormat => (typeof raw === 'string' && (RPS_FORMATS as readonly string[]).includes(raw) ? (raw as RpsFormat) : RPS_DEFAULT_FORMAT);

/** 0 = draw, 1 = `a` wins, -1 = `b` wins */
export function beats(a: RpsChoice, b: RpsChoice): 0 | 1 | -1 {
  if (a === b) return 0;
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper') ? 1 : -1;
}

const iso = (ms: number): string => new Date(ms).toISOString();
const roundIdOf = (matchId: string, round: number): string => `${matchId}:${round}`;

export interface RpsStep {
  state: RpsGameState;
  secret: RpsSecret | null;
  /** the public state changed (send it) */
  changed: boolean;
}

/**
 * The authoritative Rock Paper Scissors rules and state machine:
 *   countdown -> choosing -> revealing -> round-result -> (countdown of the next round | match-result)
 * plus cancelled and forfeit. Pure and clock-free: callers pass `now`, so the same input always gives the same result, and every
 * phase ends at a server deadline. Unrevealed choices live ONLY in the RpsSecret and enter the public state at the reveal.
 */
export class RpsEngine {
  static createMatch(players: Player[], opts: { now: number; format?: unknown; startingSeat?: number; cfg?: Partial<RpsConfig>; matchId?: string }): { state: RpsGameState; secret: RpsSecret } {
    const cfg = { ...DEFAULT_RPS_CONFIG, ...opts.cfg };
    const format = sanitizeFormat(opts.format);
    const matchId = opts.matchId ?? randomUUID();
    const first = players.find((p) => p.seat === (opts.startingSeat ?? 0)) || players[0];
    const roundId = roundIdOf(matchId, 1);
    const state: RpsGameState = {
      matchId,
      roundId,
      format,
      winsNeeded: WINS_NEEDED[format],
      status: 'countdown',
      round: 1,
      scores: [0, 0],
      locked: [false, false],
      reveal: null,
      deadlineAt: iso(opts.now + cfg.countdownMs),
      countdownSeconds: Math.round(cfg.countdownMs / 1000),
      chooseSeconds: Math.round(cfg.chooseMs / 1000),
      winner: null,
      winnerUserId: null,
      isDraw: false,
      finishReason: null,
      startingSeat: opts.startingSeat === 1 ? 1 : 0,
      currentTurnSeat: opts.startingSeat === 1 ? 1 : 0,
      version: 1,
      statusMessage: `${first?.displayName ?? 'Player 1'} vs ${players.find((p) => p !== first)?.displayName ?? 'Player 2'}: get ready!`
    };
    return { state, secret: { roundId, picks: [null, null], locked: [false, false] } };
  }

  static isLive(state: RpsGameState): boolean {
    return state.status !== 'match-result' && state.status !== 'cancelled' && state.status !== 'forfeit' && state.status !== 'waiting';
  }

  static msLeft(state: RpsGameState, now: number): number | null {
    return state.deadlineAt ? Math.max(0, Date.parse(state.deadlineAt) - now) : null;
  }

  private static check(state: RpsGameState, secret: RpsSecret | null, seat: number, roundId: unknown): asserts secret is RpsSecret {
    if (seat !== 0 && seat !== 1) throw new GameRuleError('NOT_PLAYER', 'Only the two players can play');
    if (!this.isLive(state)) throw new GameRuleError('GAME_OVER', 'This match is over');
    if (typeof roundId !== 'string' || roundId !== state.roundId) throw new GameRuleError('STALE_ROUND', 'That was for another round');
    if (state.status !== 'choosing') throw new GameRuleError('NOT_CHOOSING', state.status === 'countdown' ? 'Wait for the countdown to finish' : 'This round is already decided');
    if (!secret || secret.roundId !== state.roundId) throw new GameRuleError('NOT_CHOOSING', 'This round is not ready for choices');
  }

  /** the player picks (or changes a pick). Nothing public changes. */
  static select(state: RpsGameState, secret: RpsSecret | null, seat: number, roundId: unknown, choice: unknown, now: number, cfg: RpsConfig = DEFAULT_RPS_CONFIG): RpsSecret {
    this.check(state, secret, seat, roundId);
    if (!isChoice(choice)) throw new GameRuleError('INVALID_INPUT', 'Choose rock, paper or scissors');
    if (state.deadlineAt && now >= Date.parse(state.deadlineAt)) throw new GameRuleError('TOO_LATE', 'Time is up for this round');
    if (secret.locked[seat]) throw new GameRuleError('ALREADY_LOCKED', 'Your choice is already locked');
    if (!cfg.allowChange && secret.picks[seat] !== null && secret.picks[seat] !== choice) throw new GameRuleError('ALREADY_LOCKED', 'You cannot change your pick');
    const picks: [RpsChoice | null, RpsChoice | null] = [secret.picks[0], secret.picks[1]];
    picks[seat] = choice;
    return { ...secret, picks };
  }

  /** the player locks their pick (a `choice` may be sent with it: pick and lock in one step). Both locked => the round is revealed. */
  static lock(state: RpsGameState, secret: RpsSecret | null, seat: number, roundId: unknown, choice: unknown, now: number, cfg: RpsConfig = DEFAULT_RPS_CONFIG): RpsStep {
    this.check(state, secret, seat, roundId);
    if (state.deadlineAt && now >= Date.parse(state.deadlineAt)) throw new GameRuleError('TOO_LATE', 'Time is up for this round');
    if (secret.locked[seat]) throw new GameRuleError('ALREADY_LOCKED', 'Your choice is already locked');
    let sec = secret;
    if (choice !== undefined && choice !== null) sec = this.select(state, sec, seat, roundId, choice, now, cfg);
    if (sec.picks[seat] === null) throw new GameRuleError('INVALID_INPUT', 'Pick rock, paper or scissors before locking');
    const locked: [boolean, boolean] = [sec.locked[0], sec.locked[1]];
    locked[seat] = true;
    sec = { ...sec, locked };
    const publicLocked: [boolean, boolean] = [locked[0], locked[1]];
    let next: RpsGameState = { ...state, locked: publicLocked, version: state.version + 1, statusMessage: 'Waiting for the other player...' };
    if (locked[0] && locked[1]) return { ...this.reveal(next, sec, now, cfg, []), changed: true };
    return { state: next, secret: sec, changed: true };
  }

  /** both choices are final (or time ran out): decide the round and reveal it */
  private static reveal(state: RpsGameState, secret: RpsSecret, now: number, cfg: RpsConfig, timedOut: number[]): { state: RpsGameState; secret: RpsSecret | null } {
    const [a, b] = secret.picks;
    let winnerSeat: number | null = null;
    let reason: RpsRoundReveal['reason'] = 'draw';
    if (a && b) {
      const r = beats(a, b);
      winnerSeat = r === 1 ? 0 : r === -1 ? 1 : null;
      reason = r === 0 ? 'draw' : 'beats';
    } else if (!a && !b) {
      reason = 'timeout-draw';
    } else if (cfg.timeoutPolicy === 'award-to-submitter') {
      winnerSeat = a ? 0 : 1;
      reason = 'timeout-award';
    } else {
      reason = 'timeout-draw';
    }
    const reveal: RpsRoundReveal = { round: state.round, choices: [a, b], winnerSeat, reason, timedOut };
    const text = reason === 'timeout-award'
      ? 'A player ran out of time.'
      : reason === 'timeout-draw'
        ? 'Nobody locked a choice in time.'
        : a && b ? `${a} vs ${b}` : '';
    return {
      state: { ...state, status: 'revealing', reveal, locked: [true, true], deadlineAt: iso(now + cfg.revealMs), version: state.version + 1, statusMessage: text },
      secret: null // the choices are public now; nothing is left to protect
    };
  }

  /** apply the score of a revealed round, then either end the match or schedule the next round */
  private static settle(state: RpsGameState, players: Player[], now: number, cfg: RpsConfig): RpsGameState {
    const reveal = state.reveal as RpsRoundReveal;
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    if (reveal.winnerSeat !== null) scores[reveal.winnerSeat] += 1;
    const name = (s: number): string => players.find((p) => p.seat === s)?.displayName || `Player ${s + 1}`;
    const roundText = reveal.winnerSeat === null ? 'Draw!' : `${name(reveal.winnerSeat)} wins the round!`;
    const reached = scores[0] >= state.winsNeeded ? 0 : scores[1] >= state.winsNeeded ? 1 : null;
    const single = state.format === 'single';
    const capped = state.round >= cfg.maxRounds;
    if (reached !== null || single || capped) {
      const seat = reached !== null ? reached : scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
      const champion = seat === null ? undefined : players.find((p) => p.seat === seat);
      return {
        ...state,
        status: 'match-result',
        scores,
        deadlineAt: null,
        winner: seat === null ? null : seat === 0 ? 'X' : 'O',
        winnerUserId: champion?.userId ?? null,
        isDraw: seat === null,
        finishReason: reached !== null ? 'score' : single ? 'single' : 'round-limit',
        version: state.version + 1,
        statusMessage: seat === null ? `Draw ${scores[0]}-${scores[1]}!` : `${name(seat)} wins the match ${Math.max(scores[0], scores[1])}-${Math.min(scores[0], scores[1])}!`
      };
    }
    return { ...state, status: 'round-result', scores, deadlineAt: iso(now + cfg.resultMs), version: state.version + 1, statusMessage: roundText };
  }

  /**
   * Moves the match forward when a phase's deadline has passed (several phases at once if the server was late). Call it before
   * handling any action, from the timer, and when a player returns. Returns the new state, the secret of the new round (if any).
   */
  static advance(state: RpsGameState, secret: RpsSecret | null, players: Player[], now: number, cfg: RpsConfig = DEFAULT_RPS_CONFIG): RpsStep {
    let s = state;
    let sec = secret;
    let changed = false;
    for (let guard = 0; guard < 10; guard++) {
      if (!this.isLive(s) || !s.deadlineAt) break;
      const due = Date.parse(s.deadlineAt);
      if (now < due) break;
      // a phase that is far overdue (the server was down) starts from now, not from its old deadline
      const base = Math.max(due, now - 250);
      if (s.status === 'countdown') {
        s = { ...s, status: 'choosing', deadlineAt: iso(base + cfg.chooseMs), version: s.version + 1, statusMessage: 'Choose now!' };
        sec = { roundId: s.roundId, picks: [null, null], locked: [false, false] };
      } else if (s.status === 'choosing') {
        const open = sec && sec.roundId === s.roundId ? sec : { roundId: s.roundId, picks: [null, null] as [RpsChoice | null, RpsChoice | null], locked: [false, false] as [boolean, boolean] };
        // a pick that was made but not locked counts: the player did choose
        const timedOut = [0, 1].filter((seat) => open.picks[seat] === null);
        const r = this.reveal(s, open, base, cfg, timedOut);
        s = r.state;
        sec = r.secret;
      } else if (s.status === 'revealing') {
        s = this.settle(s, players, base, cfg);
      } else if (s.status === 'round-result') {
        const round = s.round + 1;
        s = {
          ...s,
          status: 'countdown',
          round,
          roundId: roundIdOf(s.matchId, round),
          locked: [false, false],
          reveal: null,
          deadlineAt: iso(base + cfg.countdownMs),
          version: s.version + 1,
          statusMessage: `Round ${round}: get ready!`
        };
        sec = { roundId: s.roundId, picks: [null, null], locked: [false, false] };
      } else break;
      changed = true;
    }
    return { state: s, secret: sec, changed };
  }

  /** a player left or stayed away past the grace period: the other player wins the match */
  static forfeit(state: RpsGameState, winnerSeat: number, leaverName: string, players: Player[]): RpsGameState {
    if (!this.isLive(state)) return state;
    const winner = players.find((p) => p.seat === winnerSeat);
    return { ...state, status: 'forfeit', deadlineAt: null, winner: winnerSeat === 0 ? 'X' : 'O', winnerUserId: winner?.userId ?? null, isDraw: false, finishReason: 'forfeit', version: state.version + 1, statusMessage: `${leaverName} left the match. ${winner?.displayName ?? 'Opponent'} wins!` };
  }

  static cancel(state: RpsGameState): RpsGameState {
    if (!this.isLive(state)) return state;
    return { ...state, status: 'cancelled', deadlineAt: null, isDraw: true, finishReason: 'cancelled', version: state.version + 1, statusMessage: 'The match was cancelled.' };
  }
}
