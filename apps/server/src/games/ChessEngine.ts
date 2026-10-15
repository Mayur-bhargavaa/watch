import { Chess, Square } from 'chess.js';
import {
  ChessColor,
  ChessGameConfig,
  ChessGameState,
  ChessMove,
  ChessPieceType,
  DEFAULT_CHESS_CONFIG,
  CHESS_TIME_PRESETS
} from '@synccinema/common';

const SQUARE_RE = /^[a-h][1-8]$/i;
const START_FEN_KEY = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
const MIN_BASE_MS = 10 * 1000;
const MAX_BASE_MS = 3 * 60 * 60 * 1000;
const MAX_INCREMENT_MS = 3 * 60 * 1000;
const BOARD_THEMES = ['wood', 'slate', 'charcoal', 'emerald'];
const PIECE_SETS = ['neo', 'classic', 'modern'];

/**
 * Whitelists and clamps a client supplied chess config (CH-9).
 * A known presetId supplies the clock unless explicit valid numbers are given.
 */
export function sanitizeChessConfig(input: any, base: ChessGameConfig = DEFAULT_CHESS_CONFIG): ChessGameConfig {
  const out: ChessGameConfig = { ...DEFAULT_CHESS_CONFIG, ...(base || {}) };
  if (!input || typeof input !== 'object') return out;
  const num = (v: any, min: number, max: number): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

  if (typeof input.presetId === 'string') {
    const preset = CHESS_TIME_PRESETS.find(p => p.id === input.presetId);
    if (preset) {
      out.presetId = preset.id;
      out.baseTimeMs = preset.baseTimeMs;
      out.incrementMs = preset.incrementMs;
    }
  }
  const b = num(input.baseTimeMs, MIN_BASE_MS, MAX_BASE_MS);
  if (b !== null) out.baseTimeMs = b;
  const inc = num(input.incrementMs, 0, MAX_INCREMENT_MS);
  if (inc !== null) out.incrementMs = inc;
  for (const k of ['rated', 'allowTakeback', 'allowDrawOffers', 'allowSpectators'] as const) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  if (BOARD_THEMES.includes(input.boardTheme)) out.boardTheme = input.boardTheme;
  if (PIECE_SETS.includes(input.pieceSet)) out.pieceSet = input.pieceSet;
  return out;
}

export class ChessEngine {
  /**
   * Initializes a brand-new Chess game with standard rules and positions.
   */
  public static initGameState(
    roomId: string,
    whiteUser: { id: string; displayName: string; avatarUrl?: string | null },
    blackUser: { id: string; displayName: string; avatarUrl?: string | null },
    config?: Partial<ChessGameConfig>
  ): ChessGameState {
    const fullConfig: ChessGameConfig = sanitizeChessConfig(config);

    const chess = new Chess();
    const now = Date.now();

    return {
      gameId: `chess_${roomId}_${now}`,
      roomId,
      status: 'ACTIVE',
      fen: chess.fen(),
      turn: 'w',
      whitePlayer: {
        userId: whiteUser.id,
        displayName: whiteUser.displayName,
        avatarUrl: whiteUser.avatarUrl,
        color: 'w',
        timeRemainingMs: fullConfig.baseTimeMs
      },
      blackPlayer: {
        userId: blackUser.id,
        displayName: blackUser.displayName,
        avatarUrl: blackUser.avatarUrl,
        color: 'b',
        timeRemainingMs: fullConfig.baseTimeMs
      },
      config: fullConfig,
      moves: [],
      historySan: [],
      inCheck: false,
      winnerUserId: null,
      winnerDisplayName: null,
      winnerColor: null,
      winnerReason: null,
      drawReason: null,
      drawOfferFrom: null,
      takebackRequestFrom: null,
      lastMove: null,
      capturedPieces: {
        white: [],
        black: []
      },
      spectators: [],
      startedAt: now,
      lastMoveTimestamp: now,
      completedAt: null,
      statusMessage: 'Game started! White to move.'
    };
  }

  /**
   * Authoritatively executes a player's move using chess.js
   */
  public static makeMove(
    state: ChessGameState,
    userId: string,
    from: string,
    to: string,
    promotion?: 'q' | 'r' | 'b' | 'n'
  ): { state: ChessGameState; success: boolean; message: string; move?: ChessMove } {
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') {
      return { state, success: false, message: 'Game is not currently active.' };
    }

    const activeColor = state.turn;
    const activePlayer = activeColor === 'w' ? state.whitePlayer : state.blackPlayer;
    const opponentPlayer = activeColor === 'w' ? state.blackPlayer : state.whitePlayer;

    if (activePlayer.userId !== userId) {
      return { state, success: false, message: 'It is not your turn to move.' };
    }

    if (typeof from !== 'string' || typeof to !== 'string' || !SQUARE_RE.test(from) || !SQUARE_RE.test(to)) {
      return { state, success: false, message: 'Invalid square.' };
    }
    if (promotion !== undefined && promotion !== null && !['q', 'r', 'b', 'n'].includes(promotion as string)) {
      return { state, success: false, message: 'Invalid promotion piece.' };
    }

    const now = Date.now();
    // Clock is only charged once the game is under way (CH-22): White's clock
    // starts when the first move is requested, not at game creation.
    const elapsedMs = state.moves.length === 0
      ? 0
      : Math.max(0, now - (state.lastMoveTimestamp || state.startedAt || now));
    const remainingAfter = activePlayer.timeRemainingMs - elapsedMs;

    // Check timeout (commit only on flag, CH-7)
    if (remainingAfter <= 0) {
      activePlayer.timeRemainingMs = 0;
      return this.handleTimeout(state, activeColor);
    }

    // Attempt move via chess.js
    const chess = new Chess(state.fen);
    let moveResult: any;

    try {
      moveResult = chess.move({
        from: from.toLowerCase() as Square,
        to: to.toLowerCase() as Square,
        promotion: (promotion as string) || 'q'
      });
    } catch {
      return { state, success: false, message: 'Illegal chess move.' };
    }

    if (!moveResult) {
      return { state, success: false, message: 'Illegal move according to international chess rules.' };
    }

    // Commit clock: deduct elapsed once, add increment
    activePlayer.timeRemainingMs = remainingAfter + state.config.incrementMs;
    state.drawOfferFrom = null;
    state.takebackRequestFrom = null;

    // Track captured pieces
    if (moveResult.captured) {
      const piece = moveResult.captured.toLowerCase() as ChessPieceType;
      if (activeColor === 'w') {
        state.capturedPieces.white.push(piece);
      } else {
        state.capturedPieces.black.push(piece);
      }
    }

    const fenAfter = chess.fen();
    const isCheck = chess.inCheck();
    const isCheckmate = chess.isCheckmate();

    const recordedMove: ChessMove = {
      id: `m_${state.moves.length + 1}_${Date.now()}`,
      gameId: state.gameId,
      playerId: userId,
      color: activeColor,
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      promotion: moveResult.promotion as any,
      san: moveResult.san,
      fenAfter,
      timestamp: now,
      clockRemaining: {
        white: state.whitePlayer.timeRemainingMs,
        black: state.blackPlayer.timeRemainingMs
      },
      captured: moveResult.captured as any,
      isCheck,
      isCheckmate
    };

    state.moves.push(recordedMove);
    state.historySan.push(moveResult.san);
    state.fen = fenAfter;
    state.turn = chess.turn();
    state.lastMove = { from: recordedMove.from, to: recordedMove.to, san: recordedMove.san };
    state.lastMoveTimestamp = now;
    state.inCheck = isCheck;

    // Find attacked King square if in check
    if (isCheck) {
      state.checkSquare = this.findKingSquare(chess, chess.turn());
    } else {
      state.checkSquare = undefined;
    }

    // Check game termination conditions
    if (isCheckmate) {
      state.status = 'CHECKMATE';
      state.winnerUserId = userId;
      state.winnerDisplayName = activePlayer.displayName;
      state.winnerColor = activeColor;
      state.winnerReason = 'Checkmate';
      state.completedAt = now;
      state.statusMessage = `Checkmate! ${activePlayer.displayName} wins!`;
    } else if (chess.isStalemate()) {
      state.status = 'STALEMATE';
      state.drawReason = 'stalemate';
      state.winnerReason = 'Stalemate';
      state.completedAt = now;
      state.statusMessage = 'Draw by Stalemate.';
    } else if (this.isThreefold(state)) {
      state.status = 'DRAW';
      state.drawReason = 'threefold_repetition';
      state.winnerReason = 'Threefold Repetition';
      state.completedAt = now;
      state.statusMessage = 'Draw by Threefold Repetition.';
    } else if (chess.isInsufficientMaterial()) {
      state.status = 'DRAW';
      state.drawReason = 'insufficient_material';
      state.winnerReason = 'Insufficient Material';
      state.completedAt = now;
      state.statusMessage = 'Draw by Insufficient Material.';
    } else if (this.isFiftyMoveDraw(chess)) {
      state.status = 'DRAW';
      state.drawReason = 'fifty_moves';
      state.winnerReason = '50-Move Rule';
      state.completedAt = now;
      state.statusMessage = 'Draw by 50-Move Rule.';
    } else if (isCheck) {
      state.status = 'CHECK';
      state.statusMessage = `Check! ${opponentPlayer.displayName}'s King is attacked.`;
    } else {
      state.status = 'ACTIVE';
      state.statusMessage = `${opponentPlayer.displayName}'s turn (${state.turn === 'w' ? 'White' : 'Black'})`;
    }

    return {
      state,
      success: true,
      message: `${moveResult.san} played.`,
      move: recordedMove
    };
  }

  /** Counts repetitions of the current position over the whole move list (CH-6). */
  private static isThreefold(state: ChessGameState): boolean {
    const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
    const current = key(state.fen);
    let count = START_FEN_KEY === current ? 1 : 0;
    for (const m of state.moves) {
      if (key(m.fenAfter) === current) count++;
    }
    return count >= 3;
  }

  private static isPlayer(state: ChessGameState, userId: string): boolean {
    return userId === state.whitePlayer.userId || userId === state.blackPlayer.userId;
  }

  /**
   * Resign a match
   */
  public static resign(state: ChessGameState, userId: string): ChessGameState {
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return state;
    if (!this.isPlayer(state, userId)) return state;

    const isWhite = state.whitePlayer.userId === userId;
    const winner = isWhite ? state.blackPlayer : state.whitePlayer;
    const resigned = isWhite ? state.whitePlayer : state.blackPlayer;

    state.status = 'RESIGNED';
    state.winnerUserId = winner.userId;
    state.winnerDisplayName = winner.displayName;
    state.winnerColor = winner.color;
    state.winnerReason = 'Resignation';
    state.drawOfferFrom = null;
    state.takebackRequestFrom = null;
    state.completedAt = Date.now();
    state.statusMessage = `${resigned.displayName} resigned. ${winner.displayName} wins!`;

    return state;
  }

  /**
   * Offer a draw
   */
  public static offerDraw(state: ChessGameState, userId: string): { state: ChessGameState; success: boolean } {
    if (!state.config.allowDrawOffers) return { state, success: false };
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return { state, success: false };
    if (!this.isPlayer(state, userId)) return { state, success: false };
    if (state.drawOfferFrom) return { state, success: false }; // one offer at a time

    state.drawOfferFrom = userId;
    return { state, success: true };
  }

  /**
   * Respond to a draw offer
   */
  public static respondDraw(
    state: ChessGameState,
    userId: string,
    accept: boolean
  ): { state: ChessGameState; success: boolean; accepted: boolean } {
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return { state, success: false, accepted: false };
    if (!this.isPlayer(state, userId)) return { state, success: false, accepted: false };
    if (!state.drawOfferFrom || state.drawOfferFrom === userId) {
      return { state, success: false, accepted: false };
    }

    if (accept) {
      state.status = 'DRAW';
      state.drawReason = 'agreement';
      state.winnerReason = 'Mutual Agreement';
      state.completedAt = Date.now();
      state.statusMessage = 'Game drawn by mutual agreement.';
      state.takebackRequestFrom = null;
    }

    state.drawOfferFrom = null;
    return { state, success: true, accepted: Boolean(accept) };
  }

  /**
   * Request a takeback
   */
  public static requestTakeback(state: ChessGameState, userId: string): { state: ChessGameState; success: boolean } {
    if (!state.config.allowTakeback) return { state, success: false };
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return { state, success: false };
    if (state.moves.length === 0) return { state, success: false };
    if (!this.isPlayer(state, userId)) return { state, success: false };
    if (state.takebackRequestFrom) return { state, success: false };

    state.takebackRequestFrom = userId;
    return { state, success: true };
  }

  /**
   * Respond to a takeback request
   */
  public static respondTakeback(
    state: ChessGameState,
    userId: string,
    accept: boolean
  ): { state: ChessGameState; success: boolean; accepted: boolean } {
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return { state, success: false, accepted: false };
    if (!this.isPlayer(state, userId)) return { state, success: false, accepted: false };
    if (!state.takebackRequestFrom || state.takebackRequestFrom === userId) {
      return { state, success: false, accepted: false };
    }

    let accepted = false;
    if (accept && state.moves.length > 0) {
      const requesterId = state.takebackRequestFrom;

      // If requester was the last person who moved, undo 1 move.
      // Otherwise undo 2 moves (opponent's move and requester's prior move).
      const lastMove = state.moves[state.moves.length - 1];
      const movesToUndo = lastMove.playerId === requesterId ? 1 : Math.min(2, state.moves.length);

      for (let i = 0; i < movesToUndo; i++) {
        const removed = state.moves.pop();
        state.historySan.pop();

        // Restore captured piece if any
        if (removed?.captured) {
          const list = removed.color === 'w' ? state.capturedPieces.white : state.capturedPieces.black;
          const idx = list.lastIndexOf(removed.captured);
          if (idx !== -1) list.splice(idx, 1);
        }
      }

      // Rebuild position from the stored FEN of the new last move (CH-4)
      const prev = state.moves[state.moves.length - 1];
      const chess = prev ? new Chess(prev.fenAfter) : new Chess();
      state.fen = chess.fen();
      state.turn = chess.turn();
      state.inCheck = chess.inCheck();
      state.checkSquare = state.inCheck ? this.findKingSquare(chess, chess.turn()) : undefined;
      state.status = state.inCheck ? 'CHECK' : 'ACTIVE';
      state.lastMove = prev ? { from: prev.from, to: prev.to, san: prev.san } : null;

      // Restore clocks to what they were after that move; the pause is not charged
      if (prev) {
        state.whitePlayer.timeRemainingMs = prev.clockRemaining.white;
        state.blackPlayer.timeRemainingMs = prev.clockRemaining.black;
      } else {
        state.whitePlayer.timeRemainingMs = state.config.baseTimeMs;
        state.blackPlayer.timeRemainingMs = state.config.baseTimeMs;
      }
      state.lastMoveTimestamp = Date.now();
      state.drawOfferFrom = null;
      state.statusMessage = 'Takeback accepted. Move reverted.';
      accepted = true;
    }

    state.takebackRequestFrom = null;
    return { state, success: true, accepted };
  }

  /**
   * Handle timeout according to FIDE rules:
   * If opponent has insufficient mating material, the result is DRAW.
   * Otherwise the opponent wins on time.
   */
  public static handleTimeout(
    state: ChessGameState,
    flaggedColor: ChessColor
  ): { state: ChessGameState; success: boolean; message: string } {
    const winnerColor: ChessColor = flaggedColor === 'w' ? 'b' : 'w';
    const winner = winnerColor === 'w' ? state.whitePlayer : state.blackPlayer;
    const flagged = flaggedColor === 'w' ? state.whitePlayer : state.blackPlayer;

    flagged.timeRemainingMs = 0;
    state.drawOfferFrom = null;
    state.takebackRequestFrom = null;
    const chess = new Chess(state.fen);
    const opponentHasInsufficientMaterial =
      chess.isInsufficientMaterial() || this.hasInsufficientMaterialForMate(chess, winnerColor);

    if (opponentHasInsufficientMaterial) {
      state.status = 'DRAW';
      state.drawReason = 'insufficient_material';
      state.winnerReason = 'Timeout vs Insufficient Material';
      state.completedAt = Date.now();
      state.statusMessage = `Time out! Draw: ${winner.displayName} has insufficient material to checkmate.`;
    } else {
      state.status = 'TIMEOUT';
      state.winnerUserId = winner.userId;
      state.winnerDisplayName = winner.displayName;
      state.winnerColor = winnerColor;
      state.winnerReason = 'Time Out';
      state.completedAt = Date.now();
      state.statusMessage = `Time out! ${winner.displayName} wins on time!`;
    }

    return {
      state,
      success: true,
      message: state.statusMessage
    };
  }

  /**
   * Helper: check 50-move rule from FEN halfmove clock
   */
  private static isFiftyMoveDraw(chess: Chess): boolean {
    const tokens = chess.fen().split(' ');
    const halfMoves = parseInt(tokens[4], 10);
    return !isNaN(halfMoves) && halfMoves >= 100;
  }

  /**
   * Helper: find King square for a given color
   */
  public static findKingSquare(chess: Chess, color: ChessColor): string | undefined {
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const rank = 8 - r;
          return `${files[c]}${rank}`;
        }
      }
    }
    return undefined;
  }

  /**
   * Evaluates if a player has insufficient material to force a checkmate
   */
  public static hasInsufficientMaterialForMate(chess: Chess, color: ChessColor): boolean {
    // `color` is the player who would win on time. Per FIDE 6.9 the game is
    // drawn only if no legal sequence could let them mate (CH-15): they have a
    // bare king, or a single minor piece and the flagger has only a bare king.
    const board = chess.board().flat();
    const mine = board.filter((p: any) => p && p.color === color);
    const theirs = board.filter((p: any) => p && p.color !== color);

    if (mine.length <= 1) return true; // bare king

    if (mine.length === 2 && theirs.length <= 1) {
      const minor = mine.find((p: any) => p && p.type !== 'k');
      if (minor && (minor.type === 'b' || minor.type === 'n')) return true;
    }
    return false;
  }
}
