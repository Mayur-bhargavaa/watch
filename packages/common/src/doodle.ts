export type DoodleRole = 'drawer' | 'guesser';

export type DoodleDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export type DoodleScoringMode = 'time_based' | 'fixed';

export type DoodlePhase =
  | 'LOBBY'
  | 'ROLE_SELECTION'
  | 'ROUND_INTRO'
  | 'WORD_CHOICE'
  | 'CHOOSING_WORD'
  | 'DRAWING'
  | 'ROUND_RESULT'
  | 'FINISHED';

export interface DoodlePoint {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
}

export interface DoodleStroke {
  id: string;
  points: DoodlePoint[];
  color: string;
  size: number;
  isEraser?: boolean;
  timestamp?: number;
}

export interface DoodleWordChoice {
  word: string;
  category: string;
  difficulty: DoodleDifficulty;
}

export interface DoodleConfig {
  drawTime: number; // in seconds: 30, 45, 60, 90 (default 60)
  drawTimeSeconds?: number; // alias
  guessTime: number; // in seconds: 30, 45, 60, 90 (default 60)
  rounds: number; // 2, 4, 6, 8, 10 (default 6)
  totalRounds?: number; // alias
  difficulty: DoodleDifficulty; // 'easy' | 'medium' | 'hard' | 'mixed'
  scoringMode: DoodleScoringMode; // 'time_based' | 'fixed'
  drawingAssistance: boolean; // OFF / ON
  customWords: string[];
  useCustomWords: boolean;
  wordSelectionTimeSeconds?: number;
  hintsEnabled?: boolean;
}

export interface DoodleGuess {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  guess?: string; // alias for text
  isCorrect: boolean;
  isClose?: boolean;
  pointsAwarded?: number;
  timestamp: number;
}

export interface DoodleRoundSummary {
  round: number;
  roundNumber?: number; // alias
  word: string;
  secretWord?: string; // alias
  category: string;
  drawerUserId: string;
  drawerName: string;
  drawerDisplayName?: string; // alias
  drawerPoints?: number;
  guesserUserId: string;
  guesserName: string;
  guesserDisplayName?: string; // alias
  guesserPoints?: number;
  guessedCorrectly: boolean;
  guessed?: boolean; // alias
  timeTaken: number;
  timeTakenSeconds?: number; // alias
  pointsEarned: number;
}

export interface DoodleGameState {
  phase: DoodlePhase;
  config: DoodleConfig;
  round: number;
  currentRound?: number; // alias
  totalRounds: number;
  drawerUserId: string;
  drawerDisplayName?: string;
  guesserUserId: string;
  guesserDisplayName?: string;
  roleSelections: Record<string, DoodleRole | null>; // userId -> chosen role in lobby
  wordChoices?: any[]; // string[] or DoodleWordChoice[]
  secretWord?: string; // ONLY populated on drawer client, masked on guesser!
  maskedWord: string; // e.g. "_ _ _ _ _ _" for guesser
  secretWordCategory: string; // e.g. "Animals", "Movies", "Food"
  category?: string; // alias
  hint?: string | null;
  hintAvailable: boolean;
  hintUsed: boolean;
  scores: Record<string, number>; // userId -> score
  timeRemaining: number;
  timeLeftSeconds?: number; // alias
  strokes: DoodleStroke[];
  guesses: DoodleGuess[];
  currentGuesses?: DoodleGuess[]; // alias
  roundWinnerUserId: string | null;
  roundWinnerDisplayName: string | null;
  roundPointsEarned: number;
  roundHistory: DoodleRoundSummary[];
  lastRoundSummary?: DoodleRoundSummary | null;
  finalWinnerUserId: string | null;
  finalWinnerDisplayName: string | null;
  statusMessage: string;
}

export interface DoodleStrokeEvent {
  stroke: DoodleStroke;
}

export interface DoodleGuessEvent {
  guess: DoodleGuess;
  roundCompleted?: boolean;
}
