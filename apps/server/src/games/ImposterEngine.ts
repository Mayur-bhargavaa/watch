import {
  IMPOSTER_CLUE_MAX_LENGTH,
  IMPOSTER_CLUE_ROUNDS,
  IMPOSTER_GUESS_MAX_LENGTH,
  IMPOSTER_MAX_PLAYERS,
  IMPOSTER_MIN_PLAYERS,
  IMPOSTER_ROUND_OPTIONS,
  ImposterGameView,
  ImposterPlayer,
  ImposterRoundResult,
  ImposterServerState,
  ImposterWinner
} from '@synccinema/common';
import { secureInt } from '../util/random.js';
import { GameRuleError } from './GameRuleError.js';
import { IMPOSTER_CATEGORIES } from './imposterWords.js';

/**
 * Imposter engine: pure, server-authoritative rules. No sockets, no timers, no database.
 *  - the clock is injected (`now` is epoch ms on every call) and the RNG is injectable, so tests are deterministic
 *  - the full state (`ImposterServerState`) holds the secret word and the imposter; it never leaves the server.
 *    Every recipient gets `publicStateFor(state, viewerId)`, a redacted copy (the same idea as DoodleDuelEngine.publicStateFor)
 *  - every action first settles any expired phase (`tick`), so a late message can never act on a finished phase
 */

/** Random integer in [0, maxExclusive). Defaults to crypto randomness. */
export type ImposterRng = (maxExclusive: number) => number;

const envMs = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 100 ? Math.floor(v) : fallback;
};

/** Phase lengths. Only the reveal / result length can be shortened for tests, through the environment. */
export const IMPOSTER_TIMING = {
  revealMs: envMs('IMPOSTER_REVEAL_MS', 8_000),
  clueTurnMs: 20_000,
  discussMs: 60_000,
  voteMs: 30_000,
  guessMs: 20_000,
  resultMs: envMs('IMPOSTER_RESULT_MS', 12_000)
} as const;

/**
 * When a phase expires and the tick is at most this late, the next phase starts at the old deadline (no drift between turns).
 * A longer gap (server paused / restarted) restarts the clock at `now` instead of racing through everything that was missed.
 */
const CHAIN_SLACK_MS = 2_000;

/** The game aborts when fewer than this many players (still seated) remain. */
export const IMPOSTER_MIN_ACTIVE = 3;

/**
 * TESTING ONLY: IMPOSTER_TEST_MIN_PLAYERS=2 (or 3) lets a lobby start with fewer players so one person can try the game
 * with a second browser. Ignored in production and for any other value; the default stays 4.
 */
export function imposterMinPlayers(): number {
  const n = Number(process.env.IMPOSTER_TEST_MIN_PLAYERS);
  return process.env.NODE_ENV !== 'production' && Number.isInteger(n) && n >= 2 && n < IMPOSTER_MIN_PLAYERS ? n : IMPOSTER_MIN_PLAYERS;
}
/** Seated players below which a running game aborts (never more than the lobby minimum). */
export function imposterMinActive(): number {
  return Math.min(IMPOSTER_MIN_ACTIVE, imposterMinPlayers());
}

export interface ImposterSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  connected?: boolean;
}

const ROUND_PHASES = new Set(['REVEAL', 'CLUES', 'DISCUSS', 'VOTE', 'GUESS']);

// ---------------------------------------------------------------------
// Rate limiting (clue / vote / guess / ready messages), keyed by `${roomId}:${userId}:${kind}`
// ---------------------------------------------------------------------

const rateBuckets = new Map<string, number[]>();

export function imposterRateAllowed(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearImposterRate(roomId: string): void {
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.startsWith(`${roomId}:`)) rateBuckets.delete(key);
  }
}

// ---------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------

/** Zero-width characters are dropped. Both patterns are written as escapes so no invisible character lives in the source. */
const ZERO_WIDTH_CHARS = new RegExp('[\\u200b-\\u200f\\ufeff]', 'g');
/** Control characters (newline, tab, NUL...) and line separators become spaces: "a\\nb" is two words, never one glued word. */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]', 'g');
/** One word: letters / digits first, then letters, digits, apostrophe (straight or curly) and hyphen. */
const CLUE_PATTERN = new RegExp("^[\\p{L}\\p{N}][\\p{L}\\p{N}'\\u2019-]*$", 'u');

/** Lowercase, accents and punctuation removed, so "Spider-Man" and "spiderman" compare equal. */
export function normalizeWord(input: string): string {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** A clue is ONE word (letters, digits, apostrophe, hyphen), at most 24 characters. Returns null when it is not valid. */
export function sanitizeClue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').replace(ZERO_WIDTH_CHARS, '').replace(CONTROL_CHARS, ' ').trim();
  if (!s || s.length > IMPOSTER_CLUE_MAX_LENGTH) return null;
  if (!CLUE_PATTERN.test(s)) return null;
  return s;
}

/** True when a clue gives the secret word away: the word itself, one of its main words, or the word inside the clue. */
export function clueRevealsWord(clue: string, word: string): boolean {
  const c = normalizeWord(clue);
  const w = normalizeWord(word);
  if (!c || !w) return false;
  if (c === w) return true;
  if (w.length >= 3 && c.includes(w)) return true;
  return String(word)
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeWord)
    .some((token) => token.length >= 4 && token === c);
}

/** Case-insensitive, trimmed (and punctuation / a leading "the" ignored) comparison of the imposter's last guess. */
export function guessMatches(guess: string, word: string): boolean {
  const strip = (v: string) => normalizeWord(String(v).trim().toLowerCase().replace(/^the\s+/, ''));
  const g = strip(guess);
  return g.length > 0 && g === strip(word);
}

function cleanGuess(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').replace(ZERO_WIDTH_CHARS, '').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.length > IMPOSTER_GUESS_MAX_LENGTH) return null;
  return s;
}

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

export class ImposterEngine {
  /** Players that are still in the game (not left for good), in seat order. */
  public static activePlayers(state: ImposterServerState): ImposterPlayer[] {
    return state.players.filter((p) => !p.left);
  }

  private static connectedPlayers(state: ImposterServerState): ImposterPlayer[] {
    return state.players.filter((p) => !p.left && p.connected);
  }

  private static findPlayer(state: ImposterServerState, userId: unknown): ImposterPlayer | undefined {
    return typeof userId === 'string' ? state.players.find((p) => p.userId === userId) : undefined;
  }

  private static requirePlayer(state: ImposterServerState, userId: string): ImposterPlayer {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) throw new GameRuleError('NOT_PLAYER', 'You are not a player in this game');
    return p;
  }

  private static setPhase(state: ImposterServerState, phase: ImposterServerState['phase'], now: number, durationMs: number | null): void {
    state.phase = phase;
    state.phaseEndsAt = durationMs === null ? null : now + durationMs;
    state.phaseDurationMs = durationMs ?? 0;
  }

  /**
   * New game: validates the seats and the round count, then starts round 1 (REVEAL).
   * `usedWords` lets a rematch avoid the words of the previous game.
   */
  public static createInitialState(
    seats: ImposterSeat[],
    totalRounds: number,
    now: number,
    opts: { rng?: ImposterRng; usedWords?: string[] } = {}
  ): ImposterServerState {
    if (!Array.isArray(seats) || seats.length < imposterMinPlayers() || seats.length > IMPOSTER_MAX_PLAYERS) {
      throw new GameRuleError('INVALID_INPUT', `Imposter needs ${imposterMinPlayers()} to ${IMPOSTER_MAX_PLAYERS} players`);
    }
    if (new Set(seats.map((s) => s.userId)).size !== seats.length) {
      throw new GameRuleError('INVALID_INPUT', 'Duplicate player in the game');
    }
    if (!IMPOSTER_ROUND_OPTIONS.includes(totalRounds)) {
      throw new GameRuleError('INVALID_INPUT', `Choose ${IMPOSTER_ROUND_OPTIONS.join(' or ')} rounds`);
    }
    const players: ImposterPlayer[] = [...seats]
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

    const state: ImposterServerState = {
      game: 'imposter',
      phase: 'REVEAL',
      round: 0,
      totalRounds,
      clueRounds: IMPOSTER_CLUE_ROUNDS,
      players,
      scores,
      phaseEndsAt: null,
      phaseDurationMs: 0,
      clueRound: 1,
      currentTurnUserId: null,
      clues: [],
      readyToVote: [],
      accusedUserId: null,
      history: [],
      winnerUserIds: [],
      statusMessage: '',
      secret: { category: '', word: '', imposterId: '', usedWords: [...(opts.usedWords ?? [])] },
      turnQueue: [],
      turnIndex: 0,
      votes: {},
      guess: null,
      lastResult: null
    };
    this.startRound(state, now, opts.rng);
    return state;
  }

  /** Picks the category, the secret word and the imposter for the next round and enters REVEAL. */
  public static startRound(state: ImposterServerState, now: number, rng: ImposterRng = secureInt): void {
    const active = this.activePlayers(state);
    if (active.length < imposterMinActive()) {
      this.abort(state, 'Not enough players are left to continue.');
      return;
    }
    const category = IMPOSTER_CATEGORIES[rng(IMPOSTER_CATEGORIES.length)];
    let pool = category.words.filter((w) => !state.secret.usedWords.includes(w));
    if (pool.length === 0) pool = [...category.words];
    const word = pool[rng(pool.length)];
    const imposter = active[rng(active.length)];

    state.round += 1;
    state.secret = {
      category: category.name,
      word,
      imposterId: imposter.userId,
      usedWords: [...state.secret.usedWords, word]
    };
    state.clueRound = 1;
    state.turnQueue = [];
    state.turnIndex = 0;
    state.currentTurnUserId = null;
    state.clues = [];
    state.readyToVote = [];
    state.votes = {};
    state.accusedUserId = null;
    state.guess = null;
    state.lastResult = null;
    state.statusMessage = `Round ${state.round} of ${state.totalRounds}. Check your role.`;
    this.setPhase(state, 'REVEAL', now, IMPOSTER_TIMING.revealMs);
  }

  // -------------------------------------------------------------------
  // Phase machine
  // -------------------------------------------------------------------

  private static beginClues(state: ImposterServerState, now: number): void {
    state.clueRound = 1;
    state.turnQueue = this.activePlayers(state).map((p) => p.userId);
    state.turnIndex = -1;
    state.statusMessage = 'Clue round 1: one word each.';
    this.advanceTurn(state, now);
  }

  /** Moves to the next player who can give a clue. Players who left or are disconnected are skipped (recorded as a skipped clue). */
  private static advanceTurn(state: ImposterServerState, now: number): void {
    for (let guard = 0; guard < 64; guard++) {
      state.turnIndex += 1;
      if (state.turnIndex >= state.turnQueue.length) {
        if (state.clueRound >= state.clueRounds) {
          this.beginDiscuss(state, now);
          return;
        }
        state.clueRound += 1;
        state.turnQueue = this.activePlayers(state).map((p) => p.userId);
        state.turnIndex = 0;
        state.statusMessage = `Clue round ${state.clueRound}: one more word each.`;
      }
      const uid = state.turnQueue[state.turnIndex];
      const p = this.findPlayer(state, uid);
      if (!p || p.left || !p.connected) {
        state.clues.push({ round: state.clueRound, userId: uid, word: null });
        continue;
      }
      state.currentTurnUserId = uid;
      this.setPhase(state, 'CLUES', now, IMPOSTER_TIMING.clueTurnMs);
      return;
    }
  }

  private static beginDiscuss(state: ImposterServerState, now: number): void {
    state.currentTurnUserId = null;
    state.readyToVote = [];
    state.statusMessage = 'Discuss who is bluffing, then vote.';
    this.setPhase(state, 'DISCUSS', now, IMPOSTER_TIMING.discussMs);
  }

  private static beginVote(state: ImposterServerState, now: number): void {
    state.votes = {};
    state.statusMessage = 'Vote for the player you think is the imposter.';
    this.setPhase(state, 'VOTE', now, IMPOSTER_TIMING.voteMs);
  }

  /** Counts the votes of players who are still in the game for players who are still in the game. */
  private static tally(state: ImposterServerState): { votes: Record<string, string>; tally: Record<string, number> } {
    const votes: Record<string, string> = {};
    const tally: Record<string, number> = {};
    for (const [voter, target] of Object.entries(state.votes)) {
      const v = this.findPlayer(state, voter);
      const t = this.findPlayer(state, target);
      if (!v || v.left || !t || t.left || voter === target) continue;
      votes[voter] = target;
      tally[target] = (tally[target] ?? 0) + 1;
    }
    return { votes, tally };
  }

  /** End of VOTE: most voted player is accused. A tie, or an innocent accused, is an imposter win; a caught imposter gets a last guess. */
  private static resolveVotes(state: ImposterServerState, now: number): void {
    const { tally } = this.tally(state);
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.entries(tally).filter(([, n]) => n === max && max > 0).map(([id]) => id);
    const tie = top.length !== 1;
    const accused = tie ? null : top[0];
    const accusedName = accused ? this.findPlayer(state, accused)?.displayName ?? 'Someone' : '';

    if (accused && accused === state.secret.imposterId) {
      state.accusedUserId = accused;
      state.statusMessage = `${accusedName} was accused. The imposter gets one last guess.`;
      this.setPhase(state, 'GUESS', now, IMPOSTER_TIMING.guessMs);
      return;
    }
    this.finishRound(state, now, {
      winner: 'imposter',
      accusedUserId: accused,
      tie,
      guess: null,
      guessCorrect: null,
      reason: tie ? 'The vote ended in a tie, so the imposter got away.' : `${accusedName} was accused but is not the imposter.`
    });
  }

  /** Scores the round, stores its public record and enters RESULT. */
  private static finishRound(
    state: ImposterServerState,
    now: number,
    outcome: {
      winner: ImposterWinner;
      accusedUserId: string | null;
      tie: boolean;
      guess: string | null;
      guessCorrect: boolean | null;
      reason: string;
      voided?: boolean;
    }
  ): void {
    const { votes, tally } = this.tally(state);
    const imposterId = state.secret.imposterId;
    const points: Record<string, number> = {};
    if (outcome.winner === 'crew') {
      for (const p of this.activePlayers(state)) {
        if (p.userId === imposterId) continue;
        points[p.userId] = votes[p.userId] === imposterId ? 2 : 1;
      }
    } else if (outcome.winner === 'imposter') {
      const imp = this.findPlayer(state, imposterId);
      if (imp && !imp.left) points[imposterId] = 3;
    }
    for (const [uid, pts] of Object.entries(points)) state.scores[uid] = (state.scores[uid] ?? 0) + pts;

    const result: ImposterRoundResult = {
      round: state.round,
      category: state.secret.category,
      word: state.secret.word,
      imposterId,
      accusedUserId: outcome.accusedUserId,
      tie: outcome.tie,
      votes,
      tally,
      guess: outcome.guess,
      guessCorrect: outcome.guessCorrect,
      winner: outcome.winner,
      points,
      ...(outcome.voided ? { voided: true } : {}),
      reason: outcome.reason
    };
    state.history.push(result);
    state.lastResult = result;
    state.currentTurnUserId = null;
    state.statusMessage = outcome.reason;
    this.setPhase(state, 'RESULT', now, IMPOSTER_TIMING.resultMs);
  }

  private static finishGame(state: ImposterServerState): void {
    const contenders = this.activePlayers(state);
    const best = Math.max(0, ...contenders.map((p) => state.scores[p.userId] ?? 0));
    state.winnerUserIds = contenders.filter((p) => (state.scores[p.userId] ?? 0) === best).map((p) => p.userId);
    state.currentTurnUserId = null;
    const names = state.winnerUserIds.map((id) => this.findPlayer(state, id)?.displayName ?? 'Player');
    state.statusMessage = names.length === 1 ? `${names[0]} wins the game!` : `${names.join(' and ')} share the win!`;
    this.setPhase(state, 'FINISHED', 0, null);
  }

  /** Ends the game early without a winner (not enough players left). Safe to call twice. */
  public static abort(state: ImposterServerState, message: string): void {
    if (state.phase === 'ABORTED' || state.phase === 'FINISHED') return;
    state.phase = 'ABORTED';
    state.phaseEndsAt = null;
    state.phaseDurationMs = 0;
    state.currentTurnUserId = null;
    state.statusMessage = message;
  }

  /**
   * Applies everything that is due at `now`: expired turns and phases, "everybody is ready / has voted", skipped turns of
   * players who disconnected. Returns true when the state changed. Call it from the server timer and before every action.
   * `rng` only matters when a new round starts (tests inject it).
   */
  public static tick(state: ImposterServerState, now: number, rng: ImposterRng = secureInt): boolean {
    let changed = false;
    for (let guard = 0; guard < 128; guard++) {
      if (state.phase === 'FINISHED' || state.phase === 'ABORTED') break;
      if (this.activePlayers(state).length < imposterMinActive()) {
        this.abort(state, 'Not enough players are left to continue.');
        changed = true;
        break;
      }
      const due = state.phaseEndsAt !== null && now >= state.phaseEndsAt;
      const startAt = due && now - (state.phaseEndsAt as number) <= CHAIN_SLACK_MS ? (state.phaseEndsAt as number) : now;
      let progressed = false;

      switch (state.phase) {
        case 'REVEAL':
          if (due) { this.beginClues(state, startAt); progressed = true; }
          break;
        case 'CLUES': {
          const p = this.findPlayer(state, state.currentTurnUserId);
          if (!p || p.left || !p.connected || due) {
            // timeout or disconnect: the turn is skipped, the game goes on
            state.clues.push({ round: state.clueRound, userId: state.currentTurnUserId ?? '', word: null });
            this.advanceTurn(state, due ? startAt : now);
            progressed = true;
          }
          break;
        }
        case 'DISCUSS': {
          const present = this.connectedPlayers(state);
          const everyoneReady = present.length > 0 && present.every((p) => state.readyToVote.includes(p.userId));
          if (due || everyoneReady) { this.beginVote(state, due ? startAt : now); progressed = true; }
          break;
        }
        case 'VOTE': {
          const present = this.connectedPlayers(state);
          const everyoneVoted = present.length > 0 && present.every((p) => state.votes[p.userId] !== undefined);
          if (due || everyoneVoted) { this.resolveVotes(state, due ? startAt : now); progressed = true; }
          break;
        }
        case 'GUESS': {
          const imp = this.findPlayer(state, state.secret.imposterId);
          if (due || !imp || imp.left || !imp.connected) {
            this.finishRound(state, due ? startAt : now, {
              winner: 'crew',
              accusedUserId: state.accusedUserId,
              tie: false,
              guess: null,
              guessCorrect: null,
              reason: 'The imposter was caught and did not guess the word.'
            });
            progressed = true;
          }
          break;
        }
        case 'RESULT':
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
  // Player actions (each throws GameRuleError for anything out of turn / phase / invalid)
  // -------------------------------------------------------------------

  /** One clue word on your turn. The secret word is refused as a clue for the crew (the imposter is never told, see below). */
  public static submitClue(state: ImposterServerState, userId: string, raw: unknown, now: number): void {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    if (state.phase !== 'CLUES') throw new GameRuleError('WRONG_PHASE', 'Clues are not being given right now');
    if (state.currentTurnUserId !== userId) throw new GameRuleError('NOT_YOUR_TURN', 'It is not your turn to give a clue');
    const clue = sanitizeClue(raw);
    if (!clue) throw new GameRuleError('INVALID_INPUT', `A clue is one word, up to ${IMPOSTER_CLUE_MAX_LENGTH} characters`);
    // The imposter does not know the word: refusing "the word" for them would tell them what it is, so their clue is never checked.
    if (userId !== state.secret.imposterId && clueRevealsWord(clue, state.secret.word)) {
      throw new GameRuleError('INVALID_INPUT', 'That clue gives the secret word away. Pick another word.');
    }
    state.clues.push({ round: state.clueRound, userId, word: clue });
    this.advanceTurn(state, now);
    this.tick(state, now);
  }

  /** "Ready to vote" shortcut during DISCUSS. Returns false when the player was already ready (nothing changed). */
  public static markReady(state: ImposterServerState, userId: string, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    if (state.phase !== 'DISCUSS') throw new GameRuleError('WRONG_PHASE', 'Discussion is not running right now');
    if (state.readyToVote.includes(userId)) return false;
    state.readyToVote.push(userId);
    this.tick(state, now);
    return true;
  }

  /** One vote for another player during VOTE. Repeating the same vote is a no-op (false); changing it is refused. */
  public static castVote(state: ImposterServerState, voterId: string, targetId: unknown, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, voterId);
    if (state.phase !== 'VOTE') throw new GameRuleError('WRONG_PHASE', 'Voting is not open right now');
    if (typeof targetId !== 'string') throw new GameRuleError('INVALID_INPUT', 'Pick a player to vote for');
    if (targetId === voterId) throw new GameRuleError('ILLEGAL_MOVE', 'You cannot vote for yourself');
    const target = this.findPlayer(state, targetId);
    if (!target || target.left) throw new GameRuleError('INVALID_INPUT', 'That player is not in this game');
    const existing = state.votes[voterId];
    if (existing !== undefined) {
      if (existing === targetId) return false;
      throw new GameRuleError('ALREADY_VOTED', 'Your vote is final');
    }
    state.votes[voterId] = targetId;
    this.tick(state, now);
    return true;
  }

  /** The caught imposter's one guess at the secret word. */
  public static submitGuess(state: ImposterServerState, userId: string, raw: unknown, now: number): void {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    if (state.phase !== 'GUESS') throw new GameRuleError('WRONG_PHASE', 'There is no guess to make right now');
    if (userId !== state.secret.imposterId) throw new GameRuleError('NOT_YOUR_TURN', 'Only the imposter can guess');
    const text = cleanGuess(raw);
    if (!text) throw new GameRuleError('INVALID_INPUT', `A guess is 1 to ${IMPOSTER_GUESS_MAX_LENGTH} characters`);
    const correct = guessMatches(text, state.secret.word);
    state.guess = text;
    this.finishRound(state, now, {
      winner: correct ? 'imposter' : 'crew',
      accusedUserId: state.accusedUserId,
      tie: false,
      guess: text,
      guessCorrect: correct,
      reason: correct ? 'The imposter was caught but guessed the secret word!' : 'The imposter was caught and guessed wrong.'
    });
  }

  // -------------------------------------------------------------------
  // Connection / membership
  // -------------------------------------------------------------------

  public static setConnected(state: ImposterServerState, userId: string, connected: boolean): void {
    const p = this.findPlayer(state, userId);
    if (p && !p.left) p.connected = connected;
  }

  /**
   * A player left for good (explicit leave, or the reconnect window ran out). Fewer than 3 players left aborts the game;
   * if the imposter left, the round is voided (no points); other leavers just lose their vote / turn.
   * Returns true when the game was aborted.
   */
  public static removePlayer(state: ImposterServerState, userId: string, now: number): boolean {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) return state.phase === 'ABORTED';
    p.left = true;
    p.connected = false;
    delete state.votes[userId];
    for (const [voter, target] of Object.entries(state.votes)) {
      if (target === userId) delete state.votes[voter];
    }
    state.readyToVote = state.readyToVote.filter((id) => id !== userId);

    if (this.activePlayers(state).length < imposterMinActive()) {
      this.abort(state, 'Too few players are left, so the game ended.');
      return true;
    }
    if (ROUND_PHASES.has(state.phase) && userId === state.secret.imposterId) {
      this.finishRound(state, now, {
        winner: 'none',
        accusedUserId: null,
        tie: false,
        guess: null,
        guessCorrect: null,
        reason: 'The imposter left the game, so this round does not count.',
        voided: true
      });
    }
    this.tick(state, now);
    return state.phase === 'ABORTED';
  }

  // -------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------

  /** True for the full server state (it still carries the secrets); false for a redacted view. */
  public static isServerState(state: unknown): boolean {
    return Boolean(state && typeof state === 'object' && (state as any).secret !== undefined);
  }

  /**
   * The redacted copy of the state for ONE recipient. Rules:
   *  - the secret word: crew only, from REVEAL until the round ends; never the imposter, spectators or anyone before REVEAL
   *  - the imposter id: nobody until RESULT (the imposter learns it from `me.role`). From GUESS on the accused player is public,
   *    which implies the imposter by the rules of the game (a guess phase only happens when the imposter was caught)
   *  - individual votes: nobody until RESULT (you see your own vote and who has voted, not for whom)
   */
  public static publicStateFor(state: ImposterServerState | ImposterGameView | null | undefined, viewerId: string | null | undefined, now: number = Date.now()): ImposterGameView | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as ImposterGameView; // already redacted
    const s = state as ImposterServerState;
    const viewer = typeof viewerId === 'string' ? this.findPlayer(s, viewerId) : undefined;
    const inRound = ROUND_PHASES.has(s.phase);

    let me: ImposterGameView['me'] = null;
    if (viewer && !viewer.left && inRound) {
      const isImposter = viewer.userId === s.secret.imposterId;
      me = { role: isImposter ? 'imposter' : 'crew', word: isImposter ? null : s.secret.word };
    }
    const result = s.phase === 'RESULT' ? s.lastResult : null;

    return {
      game: 'imposter',
      phase: s.phase,
      round: s.round,
      totalRounds: s.totalRounds,
      clueRounds: s.clueRounds,
      players: s.players.map((p) => ({ ...p })),
      scores: { ...s.scores },
      phaseEndsAt: s.phaseEndsAt,
      phaseDurationMs: s.phaseDurationMs,
      serverNow: now,
      category: inRound ? s.secret.category : result ? result.category : null,
      me,
      clueRound: s.clueRound,
      currentTurnUserId: s.phase === 'CLUES' ? s.currentTurnUserId : null,
      clues: s.clues.map((c) => ({ ...c })),
      readyToVote: s.phase === 'DISCUSS' ? [...s.readyToVote] : [],
      votedUserIds: s.phase === 'VOTE' ? Object.keys(s.votes) : [],
      myVote: viewer && (s.phase === 'VOTE' || s.phase === 'GUESS') ? s.votes[viewer.userId] ?? null : null,
      accusedUserId: s.phase === 'GUESS' ? s.accusedUserId : result ? result.accusedUserId : null,
      result: result ? { ...result, votes: { ...result.votes }, tally: { ...result.tally }, points: { ...result.points } } : null,
      history: s.history.map((h) => ({ ...h, votes: { ...h.votes }, tally: { ...h.tally }, points: { ...h.points } })),
      winnerUserIds: [...s.winnerUserIds],
      statusMessage: s.statusMessage
    };
  }
}
