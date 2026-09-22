export type BingoDuelPattern =
  | 'fiveLines'
  | 'firstRow'
  | 'middleRow'
  | 'lastRow'
  | 'anyRow'
  | 'anyCol'
  | 'fourCorners'
  | 'xPattern'
  | 'plusPattern'
  | 'diagonal'
  | 'fullHouse'
  | 'custom';

export type BingoDuelMode = 'quick' | 'classic' | 'bestOf3' | 'bestOf5' | 'custom';

export interface BingoDuelCompletedLine {
  id: string; // 'row-0', 'col-2', 'diag-main', 'diag-anti'
  type: 'row' | 'col' | 'diag';
  index: number;
  name: string;
  indices: [number, number][]; // 5 coordinates
}

export interface BingoDuelConfig {
  pattern: BingoDuelPattern;
  customPattern?: boolean[][]; // 5x5 grid (row, col)
  mode: BingoDuelMode;
  autoCallSpeed: number; // in milliseconds, 0 = manual, 3000, 5000, 10000, 15000, 30000
  voiceCaller: boolean;
  sound: boolean;
  falseBingoPenalty: number; // 0, 3, 5 seconds
}

export const DEFAULT_BINGO_DUEL_CONFIG: BingoDuelConfig = {
  pattern: 'fiveLines',
  mode: 'classic',
  autoCallSpeed: 5000,
  voiceCaller: true,
  sound: true,
  falseBingoPenalty: 3
};

export interface BingoDuelPatternProgress {
  current: number;
  total: number;
  isCompleted: boolean;
  completedPatternName?: string;
  matchedIndices?: [number, number][]; // [row, col] coords that satisfy the pattern
  completedLines?: BingoDuelCompletedLine[]; // specific lines completed (up to 5 for B-I-N-G-O)
  bingoLetters?: string[]; // e.g. ['B', 'I', 'N', 'G', 'O']
}

export interface BingoDuelRoundSummary {
  round: number;
  winnerUserId: string;
  winnerDisplayName: string;
  patternName: string;
  numbersCalledCount: number;
  durationSeconds: number;
}

export interface BingoDuelGameState {
  roomId: string;
  config: BingoDuelConfig;
  boards: Record<string, number[][]>; // userId -> 5x5 grid of numbers 1-25
  boardsReady?: Record<string, boolean>; // userId -> whether user locked their 5x5 board
  callQueue: number[]; // remaining numbers to call (subset of 1..25)
  calledNumbers: number[]; // numbers already announced in order
  currentNumber: number | null;
  currentNumberWord: string | null;
  lastCalledNumbers: number[]; // up to last 5 called numbers
  playerMarks: Record<string, number[]>; // userId -> numbers marked by user
  playerPicks?: Record<string, number[]>; // userId -> numbers picked/called by this user on their turn
  playerProgress: Record<string, BingoDuelPatternProgress>; // userId -> pattern progress
  currentTurnUserId?: string | null; // which player has the turn to select/call the next number
  callerUserId?: string | null; // who called the most recent number
  phase: 'SETUP' | 'CONFIGURING' | 'PLAYING' | 'ROUND_OVER' | 'FINISHED';
  currentRound: number;
  targetRounds: number; // 1 for quick/classic, 2 for bestOf3, 3 for bestOf5
  roundsWon: Record<string, number>; // userId -> count of won rounds
  roundHistory: BingoDuelRoundSummary[];
  winnerUserId: string | null;
  winnerDisplayName: string | null;
  falseBingoPenaltyUntil: Record<string, number>; // userId -> cooldown timestamp (ms)
  callingPaused: boolean;
  startedAt: number;
  statusMessage: string;
}

export interface BingoDuelCallEvent {
  number: number;
  word: string;
  calledNumbers: number[];
  remainingCount: number;
}

export interface BingoDuelClaimResultEvent {
  userId: string;
  displayName: string;
  valid: boolean;
  message: string;
  penaltySeconds?: number;
  isMatchOver?: boolean;
  isRoundOver?: boolean;
  winningIndices?: [number, number][];
}
