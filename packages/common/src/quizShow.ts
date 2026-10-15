/**
 * Quiz Show Studio: a host-run live quiz for a community (CREATOR game: only a Creator Pass host can create a room).
 * The HOST is the quiz master: builds the quiz in the lobby (their own questions) and runs it. 1 to 30 PLAYERS compete on a live
 * leaderboard. Question types: MULTIPLE_CHOICE (pick an option within the time limit) and BUZZER (host-judged).
 *
 * The server keeps the full state (`QuizServerState`, with every correct answer inside `quiz`) and sends every recipient a
 * redacted `QuizGameView`. A client never receives `QuizServerState`.
 */

export const QUIZ_MIN_PLAYERS = 1;
export const QUIZ_MAX_PLAYERS = 30;
/** Room size: the host plus the players. */
export const QUIZ_MAX_ROOM = QUIZ_MAX_PLAYERS + 1;
export const QUIZ_MIN_QUESTIONS = 1;
export const QUIZ_MAX_QUESTIONS = 40;
export const QUIZ_TEXT_MAX = 200;
export const QUIZ_OPTION_MAX = 80;
export const QUIZ_ANSWER_MAX = 80;
export const QUIZ_NOTE_MAX = 120;
export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 4;
export const QUIZ_TIME_LIMITS = [10, 20, 30] as const;
export const QUIZ_POINT_VALUES = [100, 200, 300] as const;
export const QUIZ_DEFAULT_TIME_LIMIT = 20;
export const QUIZ_DEFAULT_POINTS = 100;
/** Buzzer questions run on a fixed clock. */
export const QUIZ_BUZZER_QUESTION_SEC = 45;
export const QUIZ_BUZZER_ANSWER_SEC = 15;
/** +10 per consecutive correct answer beyond the first, at most +50. */
export const QUIZ_STREAK_BONUS = 10;
export const QUIZ_STREAK_BONUS_MAX = 50;
/** A wrong buzzer answer costs this share of the question points (the total never drops below 0). */
export const QUIZ_BUZZ_PENALTY = 0.5;
/** Rows of the live leaderboard shown during the reveal (plus the viewer's own rank). */
export const QUIZ_LEADERBOARD_TOP = 10;

export type QuizPhase = 'LOBBY' | 'INTRO' | 'QUESTION' | 'REVEAL' | 'FINAL' | 'ABORTED';
export type QuizQuestionType = 'MULTIPLE_CHOICE' | 'BUZZER';
export type QuizTimeLimit = (typeof QUIZ_TIME_LIMITS)[number];
export type QuizPointValue = (typeof QUIZ_POINT_VALUES)[number];
export type QuizControlAction = 'skip' | 'reveal' | 'next' | 'end';

/** A question as the host writes it (what the editor sends). */
export interface QuizQuestionInput {
  type: QuizQuestionType;
  text: string;
  /** MULTIPLE_CHOICE: 2 to 4 options; BUZZER: empty */
  options: string[];
  /** MULTIPLE_CHOICE: index of the one correct option; BUZZER: -1 */
  correctIndex: number;
  /** seconds (MULTIPLE_CHOICE: 10/20/30; BUZZER: always 45) */
  timeLimitSec: number;
  points: QuizPointValue;
  /** optional host note / accepted answer (shown to the host only until the reveal) */
  note: string;
}

export interface QuizQuestion extends QuizQuestionInput {
  id: string;
}

export interface QuizHost {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  connected: boolean;
  left: boolean;
}

export interface QuizPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  /** join order */
  seat: number;
  connected: boolean;
  /** left for good: keeps the score on the final leaderboard, marked "left" */
  left: boolean;
  score: number;
  /** consecutive correct answers */
  streak: number;
  correctCount: number;
  /** tie-break: total milliseconds taken by the correct answers (fewer is better) */
  totalAnswerMs: number;
}

export interface QuizLeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  score: number;
  streak: number;
  correctCount: number;
  left: boolean;
  connected: boolean;
}

/** The question as players and spectators see it: never the correct option or the note. */
export interface QuizViewQuestion {
  id: string;
  /** 0-based position in the quiz */
  index: number;
  total: number;
  type: QuizQuestionType;
  text: string;
  options: string[];
  timeLimitSec: number;
  points: number;
}

/** What only the host sees about the current question. */
export interface QuizHostQuestion {
  correctIndex: number;
  note: string;
}

export interface QuizResultRow {
  userId: string;
  /** MULTIPLE_CHOICE: the chosen option (null = no answer) */
  optionIndex: number | null;
  correct: boolean;
  /** points gained (+) or lost (-, buzzer penalty) on this question */
  points: number;
  /** BUZZER: this player's last typed answer, if any */
  answerText: string;
}

/** Public once the question is revealed. */
export interface QuizReveal {
  questionId: string;
  type: QuizQuestionType;
  /** MULTIPLE_CHOICE: the correct option (-1 for BUZZER) */
  correctIndex: number;
  /** the correct option text (MULTIPLE_CHOICE) or the host's note (BUZZER) */
  answerText: string;
  /** the host note, if any */
  note: string;
  /** MULTIPLE_CHOICE: how many players picked each option */
  optionCounts: number[];
  results: QuizResultRow[];
  /** nobody got it (everybody was locked out, or time ran out) */
  noWinner: boolean;
  skipped: boolean;
}

export interface QuizBuzzView {
  /** everybody who buzzed (and is not locked out), in server arrival order */
  queue: string[];
  lockedOut: string[];
  /** the player whose answer window is open */
  activeUserId: string | null;
  answerEndsAt: number | null;
  /** the answer the active player typed (host and that player only) */
  activeText: string | null;
}

export interface QuizMe {
  role: 'host' | 'player';
  /** MULTIPLE_CHOICE: my own chosen option (null before I answered) */
  myOption: number | null;
  answered: boolean;
  /** BUZZER */
  buzzed: boolean;
  lockedOut: boolean;
  isActiveAnswerer: boolean;
  /** my place in the buzz queue (1 = first), null when not queued */
  queuePosition: number | null;
  rank: number | null;
  score: number;
}

export interface QuizGameView {
  game: 'quiz-show';
  phase: QuizPhase;
  host: QuizHost;
  players: QuizPlayer[];
  /** number of questions in the quiz */
  questionCount: number;
  /** 0-based index of the current question; -1 in the lobby */
  questionIndex: number;
  question: QuizViewQuestion | null;
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** server clock when this view was built (lets the client correct its own clock) */
  serverNow: number;
  me: QuizMe | null;
  /** how many players answered the current MULTIPLE_CHOICE question (never who chose what) */
  answeredCount: number;
  /** host only, while the question is open: live count per option */
  answerCounts: number[] | null;
  /** host only: the correct option and the note of the current question */
  hostQuestion: QuizHostQuestion | null;
  /** host only, in the lobby: the whole draft quiz including the correct answers */
  draft: QuizQuestion[] | null;
  buzz: QuizBuzzView | null;
  reveal: QuizReveal | null;
  /** every player ranked (the client shows the top 10 + its own row during the quiz) */
  leaderboard: QuizLeaderboardRow[];
  winnerUserId: string | null;
  statusMessage: string;
}

/** Server-only state: includes the correct answers. Never serialise this to a client. */
export interface QuizServerState {
  game: 'quiz-show';
  phase: QuizPhase;
  host: QuizHost;
  players: QuizPlayer[];
  /** the whole quiz with the correct answers */
  quiz: QuizQuestion[];
  /** counter used to give the questions stable ids */
  idSeq: number;
  questionIndex: number;
  phaseEndsAt: number | null;
  phaseDurationMs: number;
  /** epoch ms at which the current question opened */
  questionStartedAt: number;
  /** current MULTIPLE_CHOICE answers: user id -> option and when it arrived */
  answers: Record<string, { optionIndex: number; at: number }>;
  buzz: {
    /** arrival order of everyone who buzzed and is not locked out */
    queue: string[];
    lockedOut: string[];
    activeUserId: string | null;
    answerEndsAt: number | null;
    /** user id -> last typed answer (current question) */
    texts: Record<string, string>;
    /** user id -> ms from the question start to the buzz */
    buzzAt: Record<string, number>;
  };
  /** points gained / lost on the current question: user id -> delta */
  deltas: Record<string, number>;
  reveal: QuizReveal | null;
  winnerUserId: string | null;
  statusMessage: string;
}
