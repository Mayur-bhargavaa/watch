import { randomUUID } from 'node:crypto';
import { ZERO_CROSS_DEFAULT_DURATION, ZERO_CROSS_DURATIONS } from '@synccinema/common';
import type { ZeroCrossGameState, ZeroCrossMark, ZeroCrossMove, ZeroCrossStatus } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

export const WINNING_LINES: readonly [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6] // diagonals
];

export const PIECES_PER_PLAYER = 3;
/** how many recent move ids are remembered to recognise a resent move */
const KEEP_MOVE_IDS = 24;
const MAX_MOVE_ID = 64;

type Player = { userId: string; displayName: string; seat: number };
const markOf = (seat: number): ZeroCrossMark => (seat === 0 ? 'X' : 'O');

/** `null` or one of the offered lengths; anything else (a tampered value) falls back to the default */
export function sanitizeDuration(raw: unknown): number | null {
  if (raw === null) return null;
  if (typeof raw === 'number' && ZERO_CROSS_DURATIONS.includes(raw)) return raw;
  return ZERO_CROSS_DEFAULT_DURATION;
}

export interface ZeroCrossAction {
  kind: 'place' | 'move';
  from?: number;
  to: number;
  moveId?: string | null;
  /** the state version the player was looking at when they acted (optional) */
  baseVersion?: number;
}

export interface ZeroCrossResult {
  state: ZeroCrossGameState;
  /** the same move id was already applied: nothing changed, answer with the current state */
  duplicate: boolean;
  /** the clock had already run out when the action arrived: the match ended in a draw and the action was NOT applied */
  timedOut: boolean;
  finished: boolean;
}

/**
 * Authoritative Zero Cross rules. Pure and clock-free: callers pass `now` (milliseconds), so the same input always gives the
 * same result and the match clock is the server's, never a screen's.
 */
export class ZeroCrossEngine {
  static winningLine(board: readonly (ZeroCrossMark | null)[]): { mark: ZeroCrossMark; line: [number, number, number] } | null {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a] as ZeroCrossMark, line: [a, b, c] };
    }
    return null;
  }

  static createInitialState(players: Player[], opts: { startingSeat?: number; durationSeconds?: number | null; now: number; gameId?: string }): ZeroCrossGameState {
    const startingSeat = opts.startingSeat === 1 ? 1 : 0;
    const duration = opts.durationSeconds === undefined ? ZERO_CROSS_DEFAULT_DURATION : sanitizeDuration(opts.durationSeconds);
    const first = players.find((p) => p.seat === startingSeat) || players[0];
    return {
      gameId: opts.gameId ?? randomUUID(),
      board: Array(9).fill(null),
      currentTurnSeat: startingSeat,
      currentTurnMark: markOf(startingSeat),
      phase: 'placement',
      status: 'active',
      remainingPlacements: { X: PIECES_PER_PLAYER, O: PIECES_PER_PLAYER },
      durationSeconds: duration,
      deadlineAt: duration === null ? null : new Date(opts.now + duration * 1000).toISOString(),
      startedAt: new Date(opts.now).toISOString(),
      winner: null,
      winnerUserId: null,
      winningLine: null,
      isDraw: false,
      finishReason: null,
      startingSeat,
      version: 1,
      moveCount: 0,
      lastMove: null,
      processedMoveIds: [],
      statusMessage: `${first?.displayName || 'Player 1'} places first (${markOf(startingSeat)}). Place your 3 pieces!`
    };
  }

  /** true for a state in the current format (a room saved by an older version holds a plain 3x3 board without pieces or a clock) */
  static isValidState(state: unknown): state is ZeroCrossGameState {
    const s = state as Partial<ZeroCrossGameState> | null | undefined;
    return !!s && Array.isArray(s.board) && s.board.length === 9 && !!s.remainingPlacements
      && typeof s.remainingPlacements.X === 'number' && typeof s.remainingPlacements.O === 'number'
      && typeof s.phase === 'string' && typeof s.status === 'string' && typeof s.version === 'number';
  }

  static isLive(state: ZeroCrossGameState): boolean {
    return state.status === 'active' && state.phase !== 'finished';
  }

  /** milliseconds until the match clock runs out (null = no clock); never below 0 */
  static remainingMs(state: ZeroCrossGameState, now: number): number | null {
    if (!state.deadlineAt) return null;
    return Math.max(0, Date.parse(state.deadlineAt) - now);
  }

  static isExpired(state: ZeroCrossGameState, now: number): boolean {
    return this.isLive(state) && !!state.deadlineAt && now >= Date.parse(state.deadlineAt);
  }

  private static finish(state: ZeroCrossGameState, status: ZeroCrossStatus, reason: string, message: string, winner?: { mark: ZeroCrossMark; userId: string | null; line?: [number, number, number] | null }): ZeroCrossGameState {
    return {
      ...state,
      phase: 'finished',
      status,
      winner: winner?.mark ?? null,
      winnerUserId: winner?.userId ?? null,
      winningLine: winner?.line ?? null,
      // "no winner, match over": the screens share one finished marker (winner or isDraw) with the other board games
      isDraw: status === 'draw' || status === 'timeout' || status === 'cancelled',
      finishReason: reason,
      statusMessage: message,
      version: state.version + 1
    };
  }

  /** The clock ran out: a draw (a winning move the server already accepted was applied before, and stays). */
  static timeout(state: ZeroCrossGameState): ZeroCrossGameState {
    if (!this.isLive(state)) return state;
    return this.finish(state, 'timeout', 'timeout', "Time's up! The match is a draw.");
  }

  /** `seat` gives up: the other player wins */
  static surrender(state: ZeroCrossGameState, seat: number, players: Player[]): ZeroCrossGameState {
    if (!this.isLive(state)) throw new GameRuleError('GAME_OVER', 'Game is already finished');
    if (seat !== 0 && seat !== 1) throw new GameRuleError('NOT_PLAYER', 'Only the two players can surrender');
    const winnerSeat = seat === 0 ? 1 : 0;
    const winner = players.find((p) => p.seat === winnerSeat);
    const loser = players.find((p) => p.seat === seat);
    return this.finish(state, 'surrendered', 'surrendered', `${loser?.displayName || 'A player'} surrendered. ${winner?.displayName || 'Opponent'} wins!`, { mark: markOf(winnerSeat), userId: winner?.userId ?? null });
  }

  /** a player left or stayed disconnected past the grace period: the one who stayed wins */
  static forfeit(state: ZeroCrossGameState, winnerSeat: number, leaverName: string, players: Player[]): ZeroCrossGameState {
    if (!this.isLive(state)) return state;
    const winner = players.find((p) => p.seat === winnerSeat);
    return this.finish(state, 'forfeit', 'forfeit', `${leaverName} left the match. ${winner?.displayName || 'Opponent'} wins!`, { mark: markOf(winnerSeat), userId: winner?.userId ?? null });
  }

  /** the room's host ended the match */
  static cancel(state: ZeroCrossGameState): ZeroCrossGameState {
    if (!this.isLive(state)) return state;
    return this.finish(state, 'cancelled', 'cancelled', 'The match was cancelled.');
  }

  /** cells a piece of `mark` could move to (any empty cell) */
  static emptyCells(state: ZeroCrossGameState): number[] {
    return state.board.flatMap((c, i) => (c === null ? [i] : []));
  }

  /** Validates `action` by `seat` and applies it. Throws GameRuleError for an illegal move; returns the new state otherwise. */
  static apply(state: ZeroCrossGameState, seat: number, action: ZeroCrossAction, players: Player[], now: number): ZeroCrossResult {
    const noop = (extra: Partial<ZeroCrossResult> = {}): ZeroCrossResult => ({ state, duplicate: false, timedOut: false, finished: !this.isLive(state), ...extra });

    // 1. a resent move (same id) changes nothing, even if the game has moved on or finished since
    const moveId = typeof action.moveId === 'string' && action.moveId.length > 0 && action.moveId.length <= MAX_MOVE_ID ? action.moveId : null;
    if (action.moveId !== undefined && action.moveId !== null && moveId === null) throw new GameRuleError('INVALID_INPUT', 'Invalid move id');
    if (moveId && state.processedMoveIds.includes(moveId)) return noop({ duplicate: true });

    if (!this.isLive(state)) throw new GameRuleError('GAME_OVER', 'Game is already finished');
    if (seat !== 0 && seat !== 1) throw new GameRuleError('NOT_PLAYER', 'Only the two players can move');

    // 2. the deadline is exclusive and decided before anything else: a move that arrives at or after it is not applied
    if (this.isExpired(state, now)) return noop({ state: this.timeout(state), timedOut: true, finished: true });

    // 3. an action based on an older state than the server holds
    if (action.baseVersion !== undefined && (!Number.isInteger(action.baseVersion) || action.baseVersion < state.version)) {
      throw new GameRuleError('STALE_STATE', 'Your screen is out of date. The latest board was sent.');
    }

    if (seat !== state.currentTurnSeat) throw new GameRuleError('NOT_YOUR_TURN', `It is not your turn (Current seat: ${state.currentTurnSeat})`);

    const mark = markOf(seat);
    const kind = action.kind;
    if (kind !== 'place' && kind !== 'move') throw new GameRuleError('INVALID_INPUT', 'Unknown action');
    const cellOk = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 9;
    if (!cellOk(action.to)) throw new GameRuleError('INVALID_INPUT', `Invalid destination: ${String(action.to)}`);

    const board = [...state.board];
    let from: number | null = null;

    if (kind === 'place') {
      if (state.phase !== 'placement') throw new GameRuleError('WRONG_PHASE', 'All pieces are placed: move one of them instead');
      if (state.remainingPlacements[mark] <= 0) throw new GameRuleError('NO_PIECES_LEFT', 'You have already placed all 3 of your pieces');
      if (board[action.to] !== null) throw new GameRuleError('CELL_OCCUPIED', `Square ${action.to} is already occupied!`);
      board[action.to] = mark;
    } else {
      if (state.phase !== 'movement') throw new GameRuleError('WRONG_PHASE', 'Place all your pieces before moving them');
      if (!cellOk(action.from)) throw new GameRuleError('INVALID_INPUT', `Invalid source: ${String(action.from)}`);
      if (board[action.from] === null) throw new GameRuleError('NO_PIECE', 'There is no piece on that square');
      if (board[action.from] !== mark) throw new GameRuleError('NOT_YOUR_PIECE', 'That piece belongs to your opponent');
      if (action.from === action.to) throw new GameRuleError('INVALID_INPUT', 'Move the piece to a different square');
      if (board[action.to] !== null) throw new GameRuleError('CELL_OCCUPIED', `Square ${action.to} is already occupied!`);
      from = action.from;
      board[action.from] = null;
      board[action.to] = mark;
    }

    const remainingPlacements = kind === 'place' ? { ...state.remainingPlacements, [mark]: state.remainingPlacements[mark] - 1 } : state.remainingPlacements;
    const lastMove: ZeroCrossMove = { seat, kind, from, to: action.to, moveId };
    const base: ZeroCrossGameState = {
      ...state,
      board,
      remainingPlacements,
      lastMove,
      moveCount: state.moveCount + 1,
      version: state.version + 1,
      processedMoveIds: moveId ? [...state.processedMoveIds, moveId].slice(-KEEP_MOVE_IDS) : state.processedMoveIds
    };
    const name = (s: number): string => players.find((p) => p.seat === s)?.displayName || `Player ${s + 1}`;

    // 4. three in a line wins at once, in either phase
    const win = this.winningLine(board);
    if (win) {
      const winner = players.find((p) => p.seat === (win.mark === 'X' ? 0 : 1));
      const done = { ...this.finish(base, 'won', 'line', `${name(win.mark === 'X' ? 0 : 1)} wins with 3 in a line!`, { mark: win.mark, userId: winner?.userId ?? null, line: win.line }), version: base.version };
      return { state: done, duplicate: false, timedOut: false, finished: true };
    }

    // 5. next turn; after the sixth piece is down the pieces start moving
    const nextSeat = seat === 0 ? 1 : 0;
    const placedAll = remainingPlacements.X === 0 && remainingPlacements.O === 0;
    const phase = placedAll ? 'movement' : 'placement';
    const next: ZeroCrossGameState = {
      ...base,
      phase,
      currentTurnSeat: nextSeat,
      currentTurnMark: markOf(nextSeat),
      statusMessage: phase === 'movement'
        ? `${name(nextSeat)}'s turn (${markOf(nextSeat)}): move one of your pieces to any empty square.`
        : `${name(nextSeat)}'s turn (${markOf(nextSeat)}): place a piece (${remainingPlacements[markOf(nextSeat)]} left).`
    };
    if (placedAll && state.phase === 'placement') next.statusMessage = `All pieces are placed! ${next.statusMessage}`;
    return { state: next, duplicate: false, timedOut: false, finished: false };
  }
}
