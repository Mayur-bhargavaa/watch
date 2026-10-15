/**
 * Imposter: a 4-8 player social deduction party game (VIP game: only a Watch+ / Creator host can create a room).
 * Everyone except one random player sees the secret word; players give one-word clues, discuss, vote, and the
 * imposter gets one last guess if they are caught.
 *
 * The server keeps the full state (`ImposterServerState`, secret word + imposter inside `secret`) and sends every
 * recipient a redacted `ImposterGameView`. A client never receives `ImposterServerState`.
 */

export const IMPOSTER_MIN_PLAYERS = 4;
export const IMPOSTER_MAX_PLAYERS = 8;
/** Games a host may choose (number of rounds). */
export const IMPOSTER_ROUND_OPTIONS: readonly number[] = [3, 5];
/** Every player gives this many clues per round. */
export const IMPOSTER_CLUE_ROUNDS = 2;
export const IMPOSTER_CLUE_MAX_LENGTH = 24;
export const IMPOSTER_GUESS_MAX_LENGTH = 40;

export type ImposterPhase =
  | 'REVEAL'
  | 'CLUES'
  | 'DISCUSS'
  | 'VOTE'
  | 'GUESS'
  | 'RESULT'
  | 'FINISHED'
  | 'ABORTED';

export type ImposterRole = 'crew' | 'imposter';
export type ImposterWinner = 'crew' | 'imposter' | 'none';

export interface ImposterPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  /** currently has a live socket (a disconnected player keeps the seat for the grace period) */
  connected: boolean;
  /** left for good (explicit leave or the reconnect window ran out) */
  left: boolean;
}

export interface ImposterClue {
  round: number;
  userId: string;
  /** the clue word; null when the turn was skipped (timeout / disconnect) */
  word: string | null;
}

/** Public record of a finished round. Only created once the round is over, so it may contain the secrets. */
export interface ImposterRoundResult {
  round: number;
  category: string;
  word: string;
  imposterId: string;
  /** most voted player, null on a tie / no votes */
  accusedUserId: string | null;
  tie: boolean;
  /** voter -> target */
  votes: Record<string, string>;
  /** target -> number of votes */
  tally: Record<string, number>;
  guess: string | null;
  guessCorrect: boolean | null;
  winner: ImposterWinner;
  /** points earned this round, userId -> points */
  points: Record<string, number>;
  /** the round ended without a normal result (the imposter left) */
  voided?: boolean;
  reason: string;
}

/** What a recipient is allowed to know about themselves. Never sent for a spectator. */
export interface ImposterMe {
  role: ImposterRole | null;
  /** the secret word: crew only (null for the imposter) */
  word: string | null;
}

export interface ImposterGameView {
  game: 'imposter';
  phase: ImposterPhase;
  round: number;
  totalRounds: number;
  clueRounds: number;
  players: ImposterPlayer[];
  scores: Record<string, number>;
  /** epoch ms at which the current phase / turn ends; null when nothing is timed */
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** server clock when this view was built (lets the client correct its own clock) */
  serverNow: number;
  /** the category is public from REVEAL on */
  category: string | null;
  me: ImposterMe | null;
  clueRound: number;
  currentTurnUserId: string | null;
  clues: ImposterClue[];
  readyToVote: string[];
  /** who has voted (not for whom) */
  votedUserIds: string[];
  /** the recipient's own vote */
  myVote: string | null;
  /** from GUESS on: the most voted player (the imposter being caught is implied by the phase itself) */
  accusedUserId: string | null;
  /** only in RESULT: the full round record (word, imposter, votes) */
  result: ImposterRoundResult | null;
  history: ImposterRoundResult[];
  /** FINISHED: highest score(s) */
  winnerUserIds: string[];
  statusMessage: string;
}

/** Server-only state: includes the secrets. Never serialise this to a client. */
export interface ImposterServerState extends Omit<ImposterGameView, 'me' | 'myVote' | 'serverNow' | 'result' | 'votedUserIds' | 'category'> {
  secret: { category: string; word: string; imposterId: string; usedWords: string[] };
  /** user ids in clue order for the current clue round, and the position of the current turn in it */
  turnQueue: string[];
  turnIndex: number;
  /** voter -> target; hidden until the round result */
  votes: Record<string, string>;
  guess: string | null;
  lastResult: ImposterRoundResult | null;
}
