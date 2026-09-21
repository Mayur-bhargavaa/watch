export type ChessColor = 'w' | 'b';
export type ChessPieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
}

export type ChessGameStatus =
  | 'WAITING'
  | 'READY'
  | 'ACTIVE'
  | 'CHECK'
  | 'CHECKMATE'
  | 'STALEMATE'
  | 'DRAW'
  | 'RESIGNED'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'ABANDONED'
  | 'COMPLETED';

export type ChessDrawReason =
  | 'agreement'
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_moves'
  | 'fivefold_repetition'
  | 'seventy_five_moves';

export interface ChessMove {
  id: string;
  gameId: string;
  playerId: string;
  color: ChessColor;
  from: string; // e.g. 'e2'
  to: string; // e.g. 'e4'
  promotion?: 'q' | 'r' | 'b' | 'n';
  san: string; // e.g. 'e4', 'Nf3', 'O-O', 'Qh7#'
  fenAfter: string;
  timestamp: number;
  clockRemaining: {
    white: number;
    black: number;
  };
  captured?: ChessPieceType;
  isCheck?: boolean;
  isCheckmate?: boolean;
}

export interface ChessTimeControlPreset {
  id: string;
  name: string;
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical' | 'Custom';
  baseTimeMs: number;
  incrementMs: number;
  display: string;
  description: string;
}

export const CHESS_TIME_PRESETS: ChessTimeControlPreset[] = [
  {
    id: 'bullet-1-0',
    name: '1 min',
    category: 'Bullet',
    baseTimeMs: 60 * 1000,
    incrementMs: 0,
    display: '1 + 0',
    description: 'Ultra fast bullet'
  },
  {
    id: 'bullet-2-1',
    name: '2 | 1',
    category: 'Bullet',
    baseTimeMs: 120 * 1000,
    incrementMs: 1000,
    display: '2 + 1',
    description: 'Fast bullet with increment'
  },
  {
    id: 'blitz-3-0',
    name: '3 min',
    category: 'Blitz',
    baseTimeMs: 180 * 1000,
    incrementMs: 0,
    display: '3 + 0',
    description: 'Popular blitz'
  },
  {
    id: 'blitz-3-2',
    name: '3 | 2',
    category: 'Blitz',
    baseTimeMs: 180 * 1000,
    incrementMs: 2000,
    display: '3 + 2',
    description: 'Competitive blitz'
  },
  {
    id: 'blitz-5-0',
    name: '5 min',
    category: 'Blitz',
    baseTimeMs: 300 * 1000,
    incrementMs: 0,
    display: '5 + 0',
    description: 'Classic blitz'
  },
  {
    id: 'blitz-5-3',
    name: '5 | 3',
    category: 'Blitz',
    baseTimeMs: 300 * 1000,
    incrementMs: 3000,
    display: '5 + 3',
    description: 'Blitz with increment'
  },
  {
    id: 'rapid-10-0',
    name: '10 min',
    category: 'Rapid',
    baseTimeMs: 600 * 1000,
    incrementMs: 0,
    display: '10 + 0',
    description: 'Standard rapid'
  },
  {
    id: 'rapid-10-5',
    name: '10 | 5',
    category: 'Rapid',
    baseTimeMs: 600 * 1000,
    incrementMs: 5000,
    display: '10 + 5',
    description: 'Recommended rapid'
  },
  {
    id: 'rapid-15-10',
    name: '15 | 10',
    category: 'Rapid',
    baseTimeMs: 900 * 1000,
    incrementMs: 10000,
    display: '15 + 10',
    description: 'Deep rapid match'
  },
  {
    id: 'classical-30-0',
    name: '30 min',
    category: 'Classical',
    baseTimeMs: 1800 * 1000,
    incrementMs: 0,
    display: '30 + 0',
    description: 'Classical time control'
  },
  {
    id: 'classical-30-20',
    name: '30 | 20',
    category: 'Classical',
    baseTimeMs: 1800 * 1000,
    incrementMs: 20000,
    display: '30 + 20',
    description: 'Long classical chess'
  }
];

export interface ChessGameConfig {
  presetId: string;
  baseTimeMs: number;
  incrementMs: number;
  rated: boolean;
  allowTakeback: boolean;
  allowDrawOffers: boolean;
  allowSpectators: boolean;
  boardTheme?: 'wood' | 'slate' | 'charcoal' | 'emerald';
  pieceSet?: 'neo' | 'classic' | 'modern';
}

export const DEFAULT_CHESS_CONFIG: ChessGameConfig = {
  presetId: 'rapid-10-5',
  baseTimeMs: 600 * 1000,
  incrementMs: 5000,
  rated: false,
  allowTakeback: true,
  allowDrawOffers: true,
  allowSpectators: true,
  boardTheme: 'wood',
  pieceSet: 'neo'
};

export interface ChessPlayerInfo {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  color: ChessColor;
  rating?: number;
  timeRemainingMs: number;
}

export interface ChessGameState {
  gameId: string;
  roomId: string;
  status: ChessGameStatus;
  fen: string;
  turn: ChessColor;
  whitePlayer: ChessPlayerInfo;
  blackPlayer: ChessPlayerInfo;
  config: ChessGameConfig;
  moves: ChessMove[];
  historySan: string[];
  inCheck: boolean;
  checkSquare?: string; // king square under check e.g. 'e8'
  winnerUserId: string | null;
  winnerDisplayName: string | null;
  winnerColor: ChessColor | null;
  winnerReason: string | null;
  drawReason: ChessDrawReason | null;
  drawOfferFrom: string | null; // userId who offered draw
  takebackRequestFrom: string | null; // userId who requested takeback
  lastMove: {
    from: string;
    to: string;
    san?: string;
  } | null;
  capturedPieces: {
    white: ChessPieceType[]; // pieces captured by white (black pieces)
    black: ChessPieceType[]; // pieces captured by black (white pieces)
  };
  spectators: Array<{ userId: string; displayName: string }>;
  startedAt: number | null;
  lastMoveTimestamp: number | null;
  completedAt: number | null;
  statusMessage: string;
}
