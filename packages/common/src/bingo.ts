export type BingoMode = '90-ball' | '75-ball';

export type BingoWinCondition =
  | 'early5'
  | 'topLine'
  | 'middleLine'
  | 'bottomLine'
  | 'fourCorners'
  | 'housefull'
  | 'xPattern'
  | 'crossPattern'
  | 'starPattern'
  | 'diamond'
  | 'fullBorder'
  | 'customPattern';

export interface BingoTicket {
  // 3 rows x 9 cols for 90-ball (Tambola, 5 numbers per row, null for blanks)
  // 5 rows x 5 cols for 75-ball (Center [2][2] is 0 or null as FREE space)
  cells: (number | null)[][];
}

export interface BingoRoomConfig {
  mode: BingoMode;
  winConditions: Record<BingoWinCondition, boolean>;
  callingSpeed: number; // in milliseconds, e.g. 1000, 2000, 3000, 5000
  autoCall: boolean;
  points: Record<BingoWinCondition, number>;
  falseClaimPenalty: number; // 0, 5, 10 seconds
  customPattern?: boolean[][]; // 5x5 grid
}

export interface BingoConditionClaim {
  condition: BingoWinCondition;
  claimedByUserId: string;
  claimedByDisplayName: string;
  claimedAt: number;
  points: number;
}

export interface BingoConditionProgress {
  current: number;
  total: number;
  isMet: boolean;
  claimed: boolean;
  claimedBy?: string;
}

export interface BingoGameState {
  mode: BingoMode;
  config: BingoRoomConfig;
  callQueue: number[];
  calledNumbers: number[];
  currentNumber: number | null;
  currentNumberWord: string | null;
  lastCalledNumbers: number[];
  tickets: Record<string, BingoTicket>; // userId -> ticket
  playerMarked: Record<string, number[]>; // userId -> numbers marked on ticket
  scores: Record<string, number>; // userId -> points
  claimedConditions: Record<string, BingoConditionClaim>; // condition -> claim details
  conditionProgress: Record<string, Record<string, BingoConditionProgress>>; // userId -> condition -> progress
  phase: 'CONFIGURING' | 'PLAYING' | 'FINISHED';
  winnerUserId: string | null;
  winnerDisplayName: string | null;
  statusMessage: string;
  callingPaused: boolean;
  penaltyUntil?: Record<string, number>; // userId -> timestamp
  gameSummary?: {
    winnerUserId: string | null;
    winnerDisplayName: string | null;
    finalScores: Record<string, number>;
    roundsWon: { condition: BingoWinCondition; winnerName: string; points: number }[];
  } | null;
}

export interface BingoNumberCallEvent {
  number: number;
  word: string;
  calledNumbers: number[];
  remainingCount: number;
}

export interface BingoClaimResultEvent {
  userId: string;
  displayName: string;
  condition: BingoWinCondition;
  valid: boolean;
  message: string;
  pointsEarned?: number;
  penaltySeconds?: number;
}

export interface BingoConditionWonEvent {
  condition: BingoWinCondition;
  userId: string;
  displayName: string;
  points: number;
  scores: Record<string, number>;
  allConditionsMet: boolean;
}
