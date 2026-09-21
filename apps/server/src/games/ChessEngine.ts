import { Chess, Square } from 'chess.js';
import {
  ChessColor,
  ChessGameConfig,
  ChessGameState,
  ChessMove,
  ChessPieceType,
  DEFAULT_CHESS_CONFIG
} from '@synccinema/common';

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
    const fullConfig: ChessGameConfig = {
      ...DEFAULT_CHESS_CONFIG,
      ...config
    };

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

    const now = Date.now();
    const lastTimestamp = state.lastMoveTimestamp || state.startedAt || now;
    const elapsedMs = Math.max(0, now - lastTimestamp);

    // Deduct elapsed time
    activePlayer.timeRemainingMs = Math.max(0, activePlayer.timeRemainingMs - elapsedMs);

    // Check timeout
    if (activePlayer.timeRemainingMs <= 0) {
      return this.handleTimeout(state, activeColor);
    }

    // Attempt move via chess.js
    const chess = new Chess(state.fen);
    let moveResult: any;

    try {
      moveResult = chess.move({
        from: from.toLowerCase() as Square,
        to: to.toLowerCase() as Square,
        promotion: promotion || 'q'
      });
    } catch {
      return { state, success: false, message: 'Illegal chess move.' };
    }

    if (!moveResult) {
      return { state, success: false, message: 'Illegal move according to international chess rules.' };
    }

    // Add increment after successful move
    activePlayer.timeRemainingMs += state.config.incrementMs;

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
    } else if (chess.isThreefoldRepetition()) {
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

  /**
   * Resign a match
   */
  public static resign(state: ChessGameState, userId: string): ChessGameState {
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return state;

    const isWhite = state.whitePlayer.userId === userId;
    const winner = isWhite ? state.blackPlayer : state.whitePlayer;
    const resigned = isWhite ? state.whitePlayer : state.blackPlayer;

    state.status = 'RESIGNED';
    state.winnerUserId = winner.userId;
    state.winnerDisplayName = winner.displayName;
    state.winnerColor = winner.color;
    state.winnerReason = 'Resignation';
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

    state.drawOfferFrom = userId;
    return { state, success: true };
  }

  /**
   * Respond to a draw offer
   */
  public static respondDraw(state: ChessGameState, userId: string, accept: boolean): ChessGameState {
    if (!state.drawOfferFrom || state.drawOfferFrom === userId) {
      return state;
    }

    if (accept) {
      state.status = 'DRAW';
      state.drawReason = 'agreement';
      state.winnerReason = 'Mutual Agreement';
      state.completedAt = Date.now();
      state.statusMessage = 'Game drawn by mutual agreement.';
    }

    state.drawOfferFrom = null;
    return state;
  }

  /**
   * Request a takeback
   */
  public static requestTakeback(state: ChessGameState, userId: string): { state: ChessGameState; success: boolean } {
    if (!state.config.allowTakeback) return { state, success: false };
    if (state.status !== 'ACTIVE' && state.status !== 'CHECK') return { state, success: false };
    if (state.moves.length === 0) return { state, success: false };

    state.takebackRequestFrom = userId;
    return { state, success: true };
  }

  /**
   * Respond to a takeback request
   */
  public static respondTakeback(state: ChessGameState, userId: string, accept: boolean): ChessGameState {
    if (!state.takebackRequestFrom || state.takebackRequestFrom === userId) {
      return state;
    }

    if (accept && state.moves.length > 0) {
      const chess = new Chess(state.fen);
      const requesterId = state.takebackRequestFrom;

      // If requester was the last person who moved, undo 1 move.
      // If it's requester's turn, undo 2 moves (their opponent's move and their own prior move).
      const lastMove = state.moves[state.moves.length - 1];
      const movesToUndo = lastMove.playerId === requesterId ? 1 : Math.min(2, state.moves.length);

      for (let i = 0; i < movesToUndo; i++) {
        chess.undo();
        const removed = state.moves.pop();
        state.historySan.pop();

        // Restore captured piece if any
        if (removed?.captured) {
          const list = removed.color === 'w' ? state.capturedPieces.white : state.capturedPieces.black;
          const idx = list.lastIndexOf(removed.captured);
          if (idx !== -1) list.splice(idx, 1);
        }
      }

      state.fen = chess.fen();
      state.turn = chess.turn();
      state.inCheck = chess.inCheck();
      state.checkSquare = state.inCheck ? this.findKingSquare(chess, chess.turn()) : undefined;
      state.status = state.inCheck ? 'CHECK' : 'ACTIVE';

      const prev = state.moves[state.moves.length - 1];
      state.lastMove = prev ? { from: prev.from, to: prev.to, san: prev.san } : null;
      state.statusMessage = 'Takeback accepted. Move reverted.';
    }

    state.takebackRequestFrom = null;
    return state;
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

    const chess = new Chess(state.fen);
    const opponentHasInsufficientMaterial = this.hasInsufficientMaterialForMate(chess, winnerColor);

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
    const board = chess.board().flat();
    const pieces = board.filter((p: any) => p && p.color === color);

    // Bare king
    if (pieces.length <= 1) return true;

    // King + 1 minor piece (Knight or Bishop)
    if (pieces.length === 2) {
      const minor = pieces.find((p: any) => p && p.type !== 'k');
      if (minor && (minor.type === 'b' || minor.type === 'n')) {
        return true;
      }
    }

    // King + 2 Knights (cannot force mate against lone king)
    if (pieces.length === 3) {
      const knights = pieces.filter((p: any) => p && p.type === 'n');
      if (knights.length === 2) return true;
    }

    return false;
  }
}
