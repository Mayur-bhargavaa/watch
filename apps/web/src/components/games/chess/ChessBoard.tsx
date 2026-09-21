'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import { ChessColor, ChessPieceType } from '@synccinema/common';
import { ChessPiece } from './ChessPiece';
import { ChessPromotionModal } from './ChessPromotionModal';
import { RotateCcw, AlertCircle, Sparkles } from 'lucide-react';

interface ChessBoardProps {
  fen: string;
  turn: ChessColor;
  playerColor?: ChessColor; // 'w' | 'b', determines default orientation
  inCheck?: boolean;
  checkSquare?: string;
  lastMove?: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  disabled?: boolean;
  isCheckmate?: boolean;
  theme?: 'wood' | 'slate' | 'charcoal';
  isPracticeMode?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  turn,
  playerColor = 'w',
  inCheck = false,
  checkSquare,
  lastMove,
  onMove,
  disabled = false,
  isCheckmate = false,
  theme = 'wood',
  isPracticeMode = false
}) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(playerColor === 'b');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);

  // Sync flip orientation when player color changes
  React.useEffect(() => {
    if (!isPracticeMode) {
      setIsFlipped(playerColor === 'b');
    }
  }, [playerColor, isPracticeMode]);

  // Notice auto-dismiss timer
  const triggerNotice = useCallback((msg: string) => {
    setBoardNotice(msg);
    const t = setTimeout(() => setBoardNotice(null), 2800);
    return () => clearTimeout(t);
  }, []);

  // Instantiated chess instance for clientside legal moves preview
  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  // Extract board matrix from chess instance
  const boardMatrix = useMemo(() => {
    return chess.board();
  }, [chess]);

  // Can interact if not disabled or in practice mode
  const canInteract = !disabled || isPracticeMode;

  // Calculate all legal moves for currently selected square
  const legalMovesForSelected = useMemo(() => {
    if (!selectedSquare || !canInteract) return [];
    try {
      return chess.moves({ square: selectedSquare as Square, verbose: true });
    } catch {
      return [];
    }
  }, [chess, selectedSquare, canInteract]);

  // Set of target squares that can be moved to from selected piece
  const legalTargetSquares = useMemo(() => {
    const s = new Set<string>();
    for (const m of legalMovesForSelected) {
      s.add(m.to);
    }
    return s;
  }, [legalMovesForSelected]);

  // Handle Square Click
  const handleSquareClick = useCallback((square: string) => {
    if (isCheckmate) {
      triggerNotice('Checkmate! The game is over.');
      return;
    }

    if (disabled && !isPracticeMode) {
      if (turn !== playerColor) {
        triggerNotice(`Waiting for Opponent (${turn === 'w' ? 'White' : 'Black'}) to move...`);
      } else {
        triggerNotice('Game is paused or waiting.');
      }
      return;
    }

    const piece = chess.get(square as Square);

    // If a piece was already selected and user clicks a legal target square
    if (selectedSquare && legalTargetSquares.has(square)) {
      const selectedPiece = chess.get(selectedSquare as Square);

      // Check for pawn promotion (pawn moving to 8th rank for White, 1st rank for Black)
      const isPawn = selectedPiece?.type === 'p';
      const isPromoRank = (selectedPiece?.color === 'w' && square.endsWith('8')) ||
                          (selectedPiece?.color === 'b' && square.endsWith('1'));

      if (isPawn && isPromoRank) {
        setPendingPromotion({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        return;
      }

      // Standard move
      onMove(selectedSquare, square);
      setSelectedSquare(null);
      return;
    }

    // Otherwise, click selects/deselects piece
    if (piece) {
      const isTurnColor = piece.color === turn;
      const isMyPiece = isPracticeMode || piece.color === playerColor;

      if (!isPracticeMode && !isMyPiece) {
        triggerNotice(`You play as ${playerColor === 'w' ? 'White' : 'Black'}. Click your own pieces.`);
        setSelectedSquare(null);
        return;
      }

      if (!isTurnColor) {
        triggerNotice(`It is ${turn === 'w' ? 'White' : 'Black'}'s turn to move.`);
        setSelectedSquare(null);
        return;
      }

      // Check if this piece has legal moves
      try {
        const moves = chess.moves({ square: square as Square, verbose: true });
        if (moves.length === 0) {
          triggerNotice('This piece has no legal moves.');
        }
      } catch {}

      if (selectedSquare === square) {
        setSelectedSquare(null); // toggle off
      } else {
        setSelectedSquare(square);
      }
    } else {
      setSelectedSquare(null);
    }
  }, [chess, selectedSquare, legalTargetSquares, disabled, isPracticeMode, isCheckmate, turn, playerColor, onMove, triggerNotice]);

  // Promotion modal confirmation
  const handleConfirmPromotion = (promotion: 'q' | 'r' | 'b' | 'n') => {
    if (pendingPromotion) {
      onMove(pendingPromotion.from, pendingPromotion.to, promotion);
      setPendingPromotion(null);
    }
  };

  // Orientation arrays
  const displayFiles = isFlipped ? [...FILES].reverse() : FILES;
  const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;

  // Board themes
  const squareColors = useMemo(() => {
    if (theme === 'slate') {
      return {
        light: 'bg-[#cbd5e1] text-[#475569]',
        dark: 'bg-[#475569] text-[#cbd5e1]'
      };
    }
    if (theme === 'charcoal') {
      return {
        light: 'bg-[#334155] text-[#94a3b8]',
        dark: 'bg-[#0f172a] text-[#64748b]'
      };
    }
    // Classic Warm Wood (Default)
    return {
      light: 'bg-[#f0d9b5] text-[#b58863]',
      dark: 'bg-[#b58863] text-[#f0d9b5]'
    };
  }, [theme]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-2 select-none">
      {/* 8x8 Board Container */}
      <div className="relative w-full aspect-square p-2 sm:p-3 rounded-2xl sm:rounded-3xl bg-[#14121d] border-2 border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col justify-between">
        
        {/* Floating Notice / Error Banner */}
        {boardNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-[90%] px-3.5 py-1.5 rounded-full bg-black/90 border border-amber-500/60 text-amber-300 text-[11px] sm:text-xs font-black shadow-2xl flex items-center gap-1.5 backdrop-blur-md animate-fadeIn pointer-events-none">
            <span className="text-amber-400 text-sm">♟</span>
            <span>{boardNotice}</span>
          </div>
        )}

        {/* 8x8 Grid */}
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-xl sm:rounded-2xl overflow-hidden border border-black/30 shadow-inner">
          {displayRanks.map((rank, rIdx) =>
            displayFiles.map((file, fIdx) => {
              const square = `${file}${rank}`;
              const fileIdx = FILES.indexOf(file);
              const rankIdx = 8 - parseInt(rank, 10);
              const piece = boardMatrix[rankIdx]?.[fileIdx];

              // International standard: bottom right (h1) is light square
              const isLightSquare = (fileIdx + parseInt(rank, 10)) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegalTarget = legalTargetSquares.has(square);
              const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
              const isCheckKingSquare = (inCheck || isCheckmate) && checkSquare === square;

              // Base square styling
              let squareBg = isLightSquare ? squareColors.light : squareColors.dark;

              if (isCheckKingSquare) {
                squareBg = 'bg-rose-600 animate-pulse';
              } else if (isSelected) {
                squareBg = isLightSquare ? 'bg-[#f6f669]' : 'bg-[#baca2b]';
              } else if (isLastMoveSquare) {
                squareBg = isLightSquare ? 'bg-[#f7ec7d]/90' : 'bg-[#ced45b]/90';
              }

              return (
                <button
                  key={`sq-${square}`}
                  type="button"
                  onClick={() => handleSquareClick(square)}
                  className={`relative w-full h-full flex items-center justify-center transition-colors duration-100 cursor-pointer ${squareBg}`}
                  aria-label={`${square} ${piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : 'empty'}`}
                >
                  {/* Rank notation label on leftmost column */}
                  {fIdx === 0 && (
                    <span className="absolute top-0.5 left-1 text-[9px] sm:text-[11px] font-black font-mono leading-none opacity-60 pointer-events-none">
                      {rank}
                    </span>
                  )}

                  {/* File notation label on bottom row */}
                  {rIdx === 7 && (
                    <span className="absolute bottom-0.5 right-1 text-[9px] sm:text-[11px] font-black font-mono leading-none opacity-60 pointer-events-none">
                      {file}
                    </span>
                  )}

                  {/* Piece */}
                  {piece && (
                    <div className="w-[82%] h-[82%] flex items-center justify-center z-10 transition-transform active:scale-95">
                      <ChessPiece type={piece.type} color={piece.color} />
                    </div>
                  )}

                  {/* Legal Move Dot (Empty Square) */}
                  {isLegalTarget && !piece && (
                    <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-slate-900/35 ring-2 ring-white/40 shadow-sm pointer-events-none z-20" />
                  )}

                  {/* Legal Capture Ring (Enemy Piece) */}
                  {isLegalTarget && piece && (
                    <span className="absolute inset-0.5 sm:inset-1 rounded-full border-2 sm:border-4 border-rose-500/70 pointer-events-none z-20 animate-pulse" />
                  )}

                  {/* King In Check Indicator */}
                  {isCheckKingSquare && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-rose-600 border border-rose-400 text-white font-black text-[9px] uppercase tracking-wider shadow-lg z-30 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>{isCheckmate ? 'MATED' : 'CHECK'}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Board Controls (Flip Board) */}
      <div className="flex items-center justify-between w-full px-1">
        <button
          type="button"
          onClick={() => setIsFlipped(prev => !prev)}
          className="py-1 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          title="Flip Board Perspective"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Flip Board ({isFlipped ? 'Black' : 'White'})</span>
        </button>

        {inCheck && !isCheckmate && (
          <span className="text-xs font-black text-rose-400 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            King is under check!
          </span>
        )}
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <ChessPromotionModal
          color={turn}
          onSelect={handleConfirmPromotion}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  );
};
