/**
 * Emoji Charades: a 2-8 player movie / show puzzle party game (VIP game: only a Watch+ / Creator host can create a room).
 * Every round the server shows a string of emoji that hints at a movie or a show; everybody guesses at the same time
 * ("Race" mode). Letter-count and first-letter hints appear automatically while the clock runs.
 *
 * The server keeps the full state (`EmojiCharadesServerState`, the answer and its alternates inside `secret`) and sends
 * every recipient a redacted `EmojiCharadesGameView`. A client never receives `EmojiCharadesServerState`.
 */

export const EMOJI_CHARADES_MIN_PLAYERS = 2;
export const EMOJI_CHARADES_MAX_PLAYERS = 8;
/** Games a host may choose (number of rounds). */
export const EMOJI_CHARADES_ROUND_OPTIONS: readonly number[] = [3, 5];
/** Game modes. Only "race" (everybody guesses at the same time) exists in v1. */
export const EMOJI_CHARADES_MODES = ['race'] as const;
export type EmojiCharadesMode = (typeof EMOJI_CHARADES_MODES)[number];
export const EMOJI_CHARADES_GUESS_MAX_LENGTH = 60;
/** A player may make at most this many wrong guesses per round. */
export const EMOJI_CHARADES_MAX_WRONG_GUESSES = 12;

export type EmojiCharadesPhase = 'COUNTDOWN' | 'PLAY' | 'REVEAL' | 'FINAL' | 'ABORTED';

/** 0 = no hint yet, 1 = number of letters / words (blanks), 2 = blanks plus the first letter of each word. */
export type EmojiCharadesHintTier = 0 | 1 | 2;
export type EmojiCharadesGuessKind = 'wrong' | 'close';

export interface EmojiCharadesPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  /** currently has a live socket (a disconnected player keeps the seat for the grace period) */
  connected: boolean;
  /** left for good (explicit leave or the reconnect window ran out) */
  left: boolean;
}

/** One player's own guess and what the server said about it. Only ever sent to that player. */
export interface EmojiCharadesOwnGuess {
  text: string;
  kind: EmojiCharadesGuessKind;
}

export interface EmojiCharadesSolve {
  userId: string;
  /** 1 = first to solve */
  order: number;
  points: number;
  /** hint tier that was visible when the player solved */
  hintTier: EmojiCharadesHintTier;
  /** milliseconds after the start of PLAY */
  atMs: number;
}

/** Public record of a finished round. Only created once the round is over, so it contains the answer. */
export interface EmojiCharadesRoundResult {
  round: number;
  answer: string;
  emoji: string[];
  genre: string;
  difficulty: number;
  solves: EmojiCharadesSolve[];
  /** players who were in the round and did not solve it */
  unsolvedUserIds: string[];
  /** points earned this round, userId -> points */
  points: Record<string, number>;
  reason: string;
}

/** What a recipient is allowed to know about themselves. Never sent for a spectator. */
export interface EmojiCharadesMe {
  solved: boolean;
  /** the answer: only once THIS player solved the puzzle (or in the result) */
  answer: string | null;
  /** the recipient's own guesses this round (never anybody else's) */
  guesses: EmojiCharadesOwnGuess[];
  wrongGuesses: number;
  guessesLeft: number;
  /** points earned for solving this round (0 until solved) */
  points: number;
}

export interface EmojiCharadesGameView {
  game: 'emoji-charades';
  phase: EmojiCharadesPhase;
  mode: EmojiCharadesMode;
  round: number;
  totalRounds: number;
  players: EmojiCharadesPlayer[];
  scores: Record<string, number>;
  /** epoch ms at which the current phase ends; null when nothing is timed */
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** server clock when this view was built (lets the client correct its own clock) */
  serverNow: number;
  /** the puzzle: emoji sequence, genre and difficulty are public from PLAY on (null in the countdown) */
  emoji: string[] | null;
  genre: string | null;
  difficulty: number | null;
  hintTier: EmojiCharadesHintTier;
  /** masked answer: "_ _ _   _ _ _ _" from tier 1, "T _ _   D _ _ _" from tier 2; null before the first hint */
  hint: string | null;
  /** epoch ms of the next automatic hint; null when there is none to come */
  nextHintAt: number | null;
  /** who solved this round so far, in solve order (names / order only, never answers) */
  solvedUserIds: string[];
  me: EmojiCharadesMe | null;
  /** only in REVEAL: the full round record (answer, solvers, points) */
  result: EmojiCharadesRoundResult | null;
  history: EmojiCharadesRoundResult[];
  /** FINAL: highest score(s) */
  winnerUserIds: string[];
  statusMessage: string;
}

/** Server-only state: includes the secrets. Never serialise this to a client. */
export interface EmojiCharadesServerState
  extends Omit<EmojiCharadesGameView, 'me' | 'serverNow' | 'emoji' | 'genre' | 'difficulty' | 'result' | 'solvedUserIds'> {
  secret: {
    puzzleId: string;
    answer: string;
    alternates: string[];
    emoji: string[];
    genre: string;
    difficulty: number;
    usedPuzzleIds: string[];
  };
  /** epoch ms when PLAY started and when each hint tier appears */
  playStartedAt: number;
  hintAt: [number, number];
  /** solves of the current round, in order */
  solves: EmojiCharadesSolve[];
  /** every player's own guesses of the current round (private) */
  guesses: Record<string, EmojiCharadesOwnGuess[]>;
  lastResult: EmojiCharadesRoundResult | null;
}
