import {
  EMOJI_CHARADES_GUESS_MAX_LENGTH,
  EMOJI_CHARADES_MAX_PLAYERS,
  EMOJI_CHARADES_MAX_WRONG_GUESSES,
  EMOJI_CHARADES_MIN_PLAYERS,
  EMOJI_CHARADES_MODES,
  EMOJI_CHARADES_ROUND_OPTIONS,
  EmojiCharadesGameView,
  EmojiCharadesGuessKind,
  EmojiCharadesHintTier,
  EmojiCharadesMode,
  EmojiCharadesPlayer,
  EmojiCharadesRoundResult,
  EmojiCharadesServerState
} from '@synccinema/common';
import { secureInt } from '../util/random.js';
import { GameRuleError } from './GameRuleError.js';
import { EMOJI_CHARADES_PUZZLES, splitEmoji } from './emojiCharadesPuzzles.js';

/**
 * Emoji Charades engine: pure, server-authoritative rules. No sockets, no timers, no database.
 *  - the clock is injected (`now` is epoch ms on every call) and the RNG is injectable, so tests are deterministic
 *  - the full state (`EmojiCharadesServerState`) holds the answer and its alternates; it never leaves the server.
 *    Every recipient gets `publicStateFor(state, viewerId)`, a redacted copy (the same idea as ImposterEngine.publicStateFor)
 *  - every action first settles any expired phase (`tick`), so a late message can never act on a finished phase
 */

/** Random integer in [0, maxExclusive). Defaults to crypto randomness. */
export type EmojiCharadesRng = (maxExclusive: number) => number;

const envMs = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 100 ? Math.floor(v) : fallback;
};

/** Phase lengths. Hints appear after one third and two thirds of PLAY (20 s and 40 s of 60 s). Tests may shorten the phases through the environment. */
export const EMOJI_CHARADES_TIMING = {
  countdownMs: envMs('EMOJI_CHARADES_COUNTDOWN_MS', 3_000),
  playMs: envMs('EMOJI_CHARADES_PLAY_MS', 60_000),
  revealMs: envMs('EMOJI_CHARADES_REVEAL_MS', 6_000)
} as const;

/** Points: base (reduced per visible hint tier) + speed bonus (scaled by the time left) + a bonus for the first solver. */
export const EMOJI_CHARADES_SCORING = {
  base: 100,
  speedMax: 100,
  firstSolverBonus: 30,
  hintPenalty: 20
} as const;

/**
 * When a phase expires and the tick is at most this late, the next phase starts at the old deadline (no drift between phases).
 * A longer gap (server paused / restarted) restarts the clock at `now` instead of racing through everything that was missed.
 */
const CHAIN_SLACK_MS = 2_000;

/** The game aborts when fewer than this many players (still seated) remain. */
export const EMOJI_CHARADES_MIN_ACTIVE = 2;

export interface EmojiCharadesSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  connected?: boolean;
}

// ---------------------------------------------------------------------
// Rate limiting (guess / start messages), keyed by `${roomId}:${userId}:${kind}`
// ---------------------------------------------------------------------

const rateBuckets = new Map<string, number[]>();

export function emojiCharadesRateAllowed(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearEmojiCharadesRate(roomId: string): void {
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.startsWith(`${roomId}:`)) rateBuckets.delete(key);
  }
}

// ---------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------

/** Zero-width characters are dropped. Written as escapes so no invisible character lives in the source. */
const ZERO_WIDTH_CHARS = new RegExp('[\\u200b-\\u200f\\ufeff]', 'g');
/** Control characters (newline, tab, NUL...) and line separators become spaces. */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]', 'g');
/** Combining accents left over after NFKD. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
const ALNUM = /[\p{L}\p{N}]/u;

/**
 * Comparison key of a title or a guess: case, accents, punctuation, spacing and a leading "the" / "a" / "an" are ignored,
 * so "The Dark Knight", "dark knight" and "DarkKnight!" all give "darkknight", and "Spider-Man" equals "spiderman".
 */
export function normalizeGuess(input: string): string {
  let s = String(input ?? '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const withoutArticle = s.replace(/^(the|a|an)\s+/, '');
  if (withoutArticle) s = withoutArticle;
  return s.replace(/\s+/g, '');
}

/** The accepted answers (the title and its alternates) as comparison keys. */
export function acceptedKeys(answer: string, alternates: readonly string[] = []): string[] {
  return Array.from(new Set([answer, ...alternates].map(normalizeGuess).filter((k) => k.length > 0)));
}

/** True when the guess is the answer or one of its alternates (see `normalizeGuess`). */
export function guessMatches(guess: string, answer: string, alternates: readonly string[] = []): boolean {
  const key = normalizeGuess(guess);
  return key.length > 0 && acceptedKeys(answer, alternates).includes(key);
}

/** Levenshtein distance (insert / delete / replace). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * "So close": a wrong guess within edit distance 1 of an accepted answer, or 2 for long titles (9+ letters). Very short titles
 * (under 4 letters) never get a close hint, because nearly anything is one edit away from them.
 */
export function isCloseGuess(guess: string, answer: string, alternates: readonly string[] = []): boolean {
  const key = normalizeGuess(guess);
  if (!key) return false;
  for (const target of acceptedKeys(answer, alternates)) {
    const maxDistance = target.length >= 9 ? 2 : target.length >= 4 ? 1 : 0;
    const d = editDistance(key, target);
    if (d > 0 && d <= maxDistance) return true;
  }
  return false;
}

/**
 * Masked answer for a hint tier. Tier 1: every letter / digit is a blank, letters of a word separated by one space and
 * words by three ("_ _ _   _ _ _ _"). Tier 2 also shows the first letter of each word. Other characters (":", "-", ".") are kept.
 */
export function buildHint(answer: string, tier: 1 | 2): string {
  return String(answer)
    .trim()
    .split(/\s+/)
    .map((word) => {
      const chars = Array.from(word);
      const first = chars.findIndex((c) => ALNUM.test(c));
      return chars.map((c, i) => (!ALNUM.test(c) ? c : tier === 2 && i === first ? c.toUpperCase() : '_')).join(' ');
    })
    .join('   ');
}

/** Points for one solve: (100 - 20 per visible hint tier) + up to 100 for the time left + 30 for the first solver. */
export function scoreSolve(hintTier: number, remainingMs: number, playMs: number, first: boolean): number {
  const base = Math.max(0, EMOJI_CHARADES_SCORING.base - EMOJI_CHARADES_SCORING.hintPenalty * hintTier);
  const fraction = playMs > 0 ? Math.min(1, Math.max(0, remainingMs / playMs)) : 0;
  const speed = Math.round(EMOJI_CHARADES_SCORING.speedMax * fraction);
  return base + speed + (first ? EMOJI_CHARADES_SCORING.firstSolverBonus : 0);
}

function cleanGuess(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').replace(ZERO_WIDTH_CHARS, '').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.length > EMOJI_CHARADES_GUESS_MAX_LENGTH) return null;
  return s;
}

const ROUND_PHASES = new Set(['COUNTDOWN', 'PLAY', 'REVEAL']);

export interface EmojiCharadesGuessOutcome {
  kind: EmojiCharadesGuessKind | 'correct';
  /** points earned (only for a correct guess) */
  points: number;
}

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

export class EmojiCharadesEngine {
  /** Players that are still in the game (not left for good), in seat order. */
  public static activePlayers(state: EmojiCharadesServerState): EmojiCharadesPlayer[] {
    return state.players.filter((p) => !p.left);
  }

  private static connectedPlayers(state: EmojiCharadesServerState): EmojiCharadesPlayer[] {
    return state.players.filter((p) => !p.left && p.connected);
  }

  private static findPlayer(state: EmojiCharadesServerState, userId: unknown): EmojiCharadesPlayer | undefined {
    return typeof userId === 'string' ? state.players.find((p) => p.userId === userId) : undefined;
  }

  private static requirePlayer(state: EmojiCharadesServerState, userId: string): EmojiCharadesPlayer {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) throw new GameRuleError('NOT_PLAYER', 'You are not a player in this game');
    return p;
  }

  private static hasSolved(state: EmojiCharadesServerState, userId: string): boolean {
    return state.solves.some((s) => s.userId === userId);
  }

  private static setPhase(state: EmojiCharadesServerState, phase: EmojiCharadesServerState['phase'], now: number, durationMs: number | null): void {
    state.phase = phase;
    state.phaseEndsAt = durationMs === null ? null : now + durationMs;
    state.phaseDurationMs = durationMs ?? 0;
  }

  /**
   * New game: validates the seats, the round count and the mode, then starts round 1 (COUNTDOWN).
   * `usedPuzzleIds` lets a rematch avoid the puzzles of the previous game.
   */
  public static createInitialState(
    seats: EmojiCharadesSeat[],
    totalRounds: number,
    now: number,
    opts: { rng?: EmojiCharadesRng; usedPuzzleIds?: string[]; mode?: EmojiCharadesMode } = {}
  ): EmojiCharadesServerState {
    if (!Array.isArray(seats) || seats.length < EMOJI_CHARADES_MIN_PLAYERS || seats.length > EMOJI_CHARADES_MAX_PLAYERS) {
      throw new GameRuleError('INVALID_INPUT', `Emoji Charades needs ${EMOJI_CHARADES_MIN_PLAYERS} to ${EMOJI_CHARADES_MAX_PLAYERS} players`);
    }
    if (new Set(seats.map((s) => s.userId)).size !== seats.length) {
      throw new GameRuleError('INVALID_INPUT', 'Duplicate player in the game');
    }
    if (!EMOJI_CHARADES_ROUND_OPTIONS.includes(totalRounds)) {
      throw new GameRuleError('INVALID_INPUT', `Choose ${EMOJI_CHARADES_ROUND_OPTIONS.join(' or ')} rounds`);
    }
    const mode = opts.mode ?? EMOJI_CHARADES_MODES[0];
    if (!(EMOJI_CHARADES_MODES as readonly string[]).includes(mode)) {
      throw new GameRuleError('INVALID_INPUT', 'That game mode is not available');
    }
    const players: EmojiCharadesPlayer[] = [...seats]
      .sort((a, b) => a.seat - b.seat)
      .map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl ?? null,
        seat: s.seat,
        connected: s.connected !== false,
        left: false
      }));
    const scores: Record<string, number> = {};
    for (const p of players) scores[p.userId] = 0;

    const state: EmojiCharadesServerState = {
      game: 'emoji-charades',
      phase: 'COUNTDOWN',
      mode,
      round: 0,
      totalRounds,
      players,
      scores,
      phaseEndsAt: null,
      phaseDurationMs: 0,
      hintTier: 0,
      hint: null,
      nextHintAt: null,
      history: [],
      winnerUserIds: [],
      statusMessage: '',
      secret: { puzzleId: '', answer: '', alternates: [], emoji: [], genre: '', difficulty: 1, usedPuzzleIds: [...(opts.usedPuzzleIds ?? [])] },
      playStartedAt: 0,
      hintAt: [0, 0],
      solves: [],
      guesses: {},
      lastResult: null
    };
    this.startRound(state, now, opts.rng);
    return state;
  }

  /** Picks the next puzzle (never one already used in this game while unused ones remain) and enters the COUNTDOWN. */
  public static startRound(state: EmojiCharadesServerState, now: number, rng: EmojiCharadesRng = secureInt): void {
    if (this.activePlayers(state).length < EMOJI_CHARADES_MIN_ACTIVE) {
      this.abort(state, 'Not enough players are left to continue.');
      return;
    }
    let used = state.secret.usedPuzzleIds;
    let pool = EMOJI_CHARADES_PUZZLES.filter((p) => !used.includes(p.id));
    if (pool.length === 0) { pool = [...EMOJI_CHARADES_PUZZLES]; used = []; } // every puzzle was played: start over
    const puzzle = pool[rng(pool.length)];

    state.round += 1;
    state.secret = {
      puzzleId: puzzle.id,
      answer: puzzle.answer,
      alternates: [...puzzle.alternates],
      emoji: splitEmoji(puzzle.emoji),
      genre: puzzle.genre,
      difficulty: puzzle.difficulty,
      usedPuzzleIds: [...used, puzzle.id]
    };
    state.solves = [];
    state.guesses = {};
    state.hintTier = 0;
    state.hint = null;
    state.nextHintAt = null;
    state.playStartedAt = 0;
    state.hintAt = [0, 0];
    state.lastResult = null;
    state.statusMessage = `Round ${state.round} of ${state.totalRounds}. Get ready!`;
    this.setPhase(state, 'COUNTDOWN', now, EMOJI_CHARADES_TIMING.countdownMs);
  }

  // -------------------------------------------------------------------
  // Phase machine
  // -------------------------------------------------------------------

  private static beginPlay(state: EmojiCharadesServerState, now: number): void {
    const playMs = EMOJI_CHARADES_TIMING.playMs;
    state.playStartedAt = now;
    state.hintAt = [now + Math.floor(playMs / 3), now + Math.floor((2 * playMs) / 3)];
    state.hintTier = 0;
    state.hint = null;
    state.nextHintAt = state.hintAt[0];
    state.statusMessage = 'Guess the movie or show!';
    this.setPhase(state, 'PLAY', now, playMs);
  }

  /** Reveals the hints that are due at `now`. Returns true when the visible hint changed. */
  private static applyHints(state: EmojiCharadesServerState, now: number): boolean {
    const tier: EmojiCharadesHintTier = now >= state.hintAt[1] ? 2 : now >= state.hintAt[0] ? 1 : 0;
    const nextHintAt: number | null = tier >= 2 ? null : state.hintAt[tier as 0 | 1];
    let changed = false;
    if (tier > state.hintTier) {
      state.hintTier = tier;
      state.hint = buildHint(state.secret.answer, tier as 1 | 2);
      changed = true;
    }
    if (state.nextHintAt !== nextHintAt) {
      state.nextHintAt = nextHintAt;
      changed = true;
    }
    return changed;
  }

  /** Scores nothing new (points were given at each solve); stores the public record of the round and enters REVEAL. */
  private static finishRound(state: EmojiCharadesServerState, now: number, reason: string): void {
    const solvedIds = new Set(state.solves.map((s) => s.userId));
    const points: Record<string, number> = {};
    for (const s of state.solves) points[s.userId] = s.points;
    const result: EmojiCharadesRoundResult = {
      round: state.round,
      answer: state.secret.answer,
      emoji: [...state.secret.emoji],
      genre: state.secret.genre,
      difficulty: state.secret.difficulty,
      solves: state.solves.map((s) => ({ ...s })),
      unsolvedUserIds: this.activePlayers(state).filter((p) => !solvedIds.has(p.userId)).map((p) => p.userId),
      points,
      reason
    };
    state.history.push(result);
    state.lastResult = result;
    state.nextHintAt = null;
    state.statusMessage = reason;
    this.setPhase(state, 'REVEAL', now, EMOJI_CHARADES_TIMING.revealMs);
  }

  private static finishGame(state: EmojiCharadesServerState): void {
    const contenders = this.activePlayers(state);
    const best = Math.max(0, ...contenders.map((p) => state.scores[p.userId] ?? 0));
    state.winnerUserIds = best > 0 ? contenders.filter((p) => (state.scores[p.userId] ?? 0) === best).map((p) => p.userId) : [];
    state.nextHintAt = null;
    const names = state.winnerUserIds.map((id) => this.findPlayer(state, id)?.displayName ?? 'Player');
    state.statusMessage = names.length === 0 ? 'Nobody scored this time.' : names.length === 1 ? `${names[0]} wins the game!` : `${names.join(' and ')} share the win!`;
    this.setPhase(state, 'FINAL', 0, null);
  }

  /** Ends the game early without a winner (not enough players left). Safe to call twice. */
  public static abort(state: EmojiCharadesServerState, message: string): void {
    if (state.phase === 'ABORTED' || state.phase === 'FINAL') return;
    state.phase = 'ABORTED';
    state.phaseEndsAt = null;
    state.phaseDurationMs = 0;
    state.nextHintAt = null;
    state.statusMessage = message;
  }

  /**
   * Applies everything that is due at `now`: the countdown, the hints, the end of the round (timeout, or everybody who is
   * connected has solved it), the reveal and the next round. Returns true when the state changed. Call it from the server
   * timer and before every action. `rng` only matters when a new round starts (tests inject it).
   */
  public static tick(state: EmojiCharadesServerState, now: number, rng: EmojiCharadesRng = secureInt): boolean {
    let changed = false;
    for (let guard = 0; guard < 64; guard++) {
      if (state.phase === 'FINAL' || state.phase === 'ABORTED') break;
      if (this.activePlayers(state).length < EMOJI_CHARADES_MIN_ACTIVE) {
        this.abort(state, 'Not enough players are left to continue.');
        changed = true;
        break;
      }
      const due = state.phaseEndsAt !== null && now >= state.phaseEndsAt;
      const startAt = due && now - (state.phaseEndsAt as number) <= CHAIN_SLACK_MS ? (state.phaseEndsAt as number) : now;
      let progressed = false;

      switch (state.phase) {
        case 'COUNTDOWN':
          if (due) { this.beginPlay(state, startAt); progressed = true; }
          break;
        case 'PLAY': {
          const present = this.connectedPlayers(state);
          const everyoneSolved = present.length > 0 && present.every((p) => this.hasSolved(state, p.userId));
          if (due) {
            this.finishRound(state, startAt, state.solves.length > 0 ? 'Time is up.' : 'Time is up and nobody solved it.');
            progressed = true;
          } else if (everyoneSolved) {
            this.finishRound(state, now, 'Everybody solved it!');
            progressed = true;
          } else if (this.applyHints(state, now)) {
            changed = true;
          }
          break;
        }
        case 'REVEAL':
          if (due) {
            if (state.round >= state.totalRounds) this.finishGame(state);
            else this.startRound(state, startAt, rng);
            progressed = true;
          }
          break;
      }
      if (!progressed) break;
      changed = true;
    }
    return changed;
  }

  // -------------------------------------------------------------------
  // Player actions (each throws GameRuleError for anything out of phase / invalid)
  // -------------------------------------------------------------------

  /**
   * One guess during PLAY. Correct: the player is locked in with points. Wrong: only the guesser is told (and whether it was
   * "so close"). Refused without any change: out of phase, already solved, bad text, a repeat of an earlier guess, no guesses left.
   */
  public static submitGuess(state: EmojiCharadesServerState, userId: string, raw: unknown, now: number): EmojiCharadesGuessOutcome {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    if (state.phase !== 'PLAY') throw new GameRuleError('WRONG_PHASE', 'Guessing is not open right now');
    if (this.hasSolved(state, userId)) throw new GameRuleError('ALREADY_SOLVED', 'You already solved this one');
    const text = cleanGuess(raw);
    if (!text) throw new GameRuleError('INVALID_INPUT', `A guess is 1 to ${EMOJI_CHARADES_GUESS_MAX_LENGTH} characters`);
    const key = normalizeGuess(text);
    if (!key) throw new GameRuleError('INVALID_INPUT', 'Type the name of a movie or show');
    const own = state.guesses[userId] ?? [];
    if (own.length >= EMOJI_CHARADES_MAX_WRONG_GUESSES) throw new GameRuleError('TOO_MANY_GUESSES', 'No guesses left in this round');
    if (own.some((g) => normalizeGuess(g.text) === key)) throw new GameRuleError('DUPLICATE_GUESS', 'You already tried that');

    if (guessMatches(text, state.secret.answer, state.secret.alternates)) {
      const first = state.solves.length === 0;
      const remaining = Math.max(0, (state.phaseEndsAt ?? now) - now);
      const points = scoreSolve(state.hintTier, remaining, EMOJI_CHARADES_TIMING.playMs, first);
      state.solves.push({ userId, order: state.solves.length + 1, points, hintTier: state.hintTier, atMs: Math.max(0, now - state.playStartedAt) });
      state.scores[userId] = (state.scores[userId] ?? 0) + points;
      this.tick(state, now); // the last connected player solving ends the round at once
      return { kind: 'correct', points };
    }
    const kind: EmojiCharadesGuessKind = isCloseGuess(text, state.secret.answer, state.secret.alternates) ? 'close' : 'wrong';
    state.guesses[userId] = [...own, { text, kind }];
    return { kind, points: 0 };
  }

  // -------------------------------------------------------------------
  // Connection / membership
  // -------------------------------------------------------------------

  public static setConnected(state: EmojiCharadesServerState, userId: string, connected: boolean): void {
    const p = this.findPlayer(state, userId);
    if (p && !p.left) p.connected = connected;
  }

  /**
   * A player left for good (explicit leave, or the reconnect window ran out). Fewer than 2 players left aborts the game;
   * otherwise the game goes on (the leaver keeps the points already earned but no longer counts for the end of a round).
   * Returns true when the game was aborted.
   */
  public static removePlayer(state: EmojiCharadesServerState, userId: string, now: number): boolean {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) return state.phase === 'ABORTED';
    p.left = true;
    p.connected = false;
    if (this.activePlayers(state).length < EMOJI_CHARADES_MIN_ACTIVE) {
      this.abort(state, 'Too few players are left, so the game ended.');
      return true;
    }
    this.tick(state, now);
    return state.phase === 'ABORTED';
  }

  // -------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------

  /** True for the full server state (it still carries the answer); false for a redacted view. */
  public static isServerState(state: unknown): boolean {
    return Boolean(state && typeof state === 'object' && (state as any).secret !== undefined);
  }

  /**
   * The redacted copy of the state for ONE recipient. Rules:
   *  - the answer and its alternates: nobody before REVEAL, except the player who solved the round (only to that player);
   *    spectators and unsolved players never get it. In REVEAL the result carries it for everybody
   *  - the emoji, genre and difficulty are public from PLAY on (that is the puzzle); nothing about the next puzzle in COUNTDOWN
   *  - wrong guesses (and "so close") are private: you only see your own
   */
  public static publicStateFor(state: EmojiCharadesServerState | EmojiCharadesGameView | null | undefined, viewerId: string | null | undefined, now: number = Date.now()): EmojiCharadesGameView | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as EmojiCharadesGameView; // already redacted
    const s = state as EmojiCharadesServerState;
    const viewer = typeof viewerId === 'string' ? this.findPlayer(s, viewerId) : undefined;
    const playing = s.phase === 'PLAY';
    const revealing = s.phase === 'REVEAL';
    const puzzleVisible = playing || revealing;

    let me: EmojiCharadesGameView['me'] = null;
    if (viewer && !viewer.left && ROUND_PHASES.has(s.phase)) {
      const solve = s.solves.find((x) => x.userId === viewer.userId);
      const own = (s.guesses[viewer.userId] ?? []).map((g) => ({ ...g }));
      me = {
        solved: Boolean(solve),
        answer: (solve && playing) || revealing ? s.secret.answer : null,
        guesses: own,
        wrongGuesses: own.length,
        guessesLeft: Math.max(0, EMOJI_CHARADES_MAX_WRONG_GUESSES - own.length),
        points: solve ? solve.points : 0
      };
    }
    const result = revealing ? s.lastResult : null;

    return {
      game: 'emoji-charades',
      phase: s.phase,
      mode: s.mode,
      round: s.round,
      totalRounds: s.totalRounds,
      players: s.players.map((p) => ({ ...p })),
      scores: { ...s.scores },
      phaseEndsAt: s.phaseEndsAt,
      phaseDurationMs: s.phaseDurationMs,
      serverNow: now,
      emoji: puzzleVisible ? [...s.secret.emoji] : null,
      genre: puzzleVisible ? s.secret.genre : null,
      difficulty: puzzleVisible ? s.secret.difficulty : null,
      hintTier: playing ? s.hintTier : 0,
      hint: playing ? s.hint : null,
      nextHintAt: playing ? s.nextHintAt : null,
      solvedUserIds: puzzleVisible ? s.solves.map((x) => x.userId) : [],
      me,
      result: result ? { ...result, emoji: [...result.emoji], solves: result.solves.map((x) => ({ ...x })), unsolvedUserIds: [...result.unsolvedUserIds], points: { ...result.points } } : null,
      history: s.history.map((h) => ({ ...h, emoji: [...h.emoji], solves: h.solves.map((x) => ({ ...x })), unsolvedUserIds: [...h.unsolvedUserIds], points: { ...h.points } })),
      winnerUserIds: [...s.winnerUserIds],
      statusMessage: s.statusMessage
    };
  }
}
