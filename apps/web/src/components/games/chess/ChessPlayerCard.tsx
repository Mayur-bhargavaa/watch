'use client';

import React, { useMemo } from 'react';
import { ChessColor, ChessPieceType, ChessPlayerInfo } from '@synccinema/common';
import { ChessClock } from './ChessClock';
import { ChessPiece } from './ChessPiece';
import { Crown, Sparkles } from 'lucide-react';

interface ChessPlayerCardProps {
  player: ChessPlayerInfo;
  isCurrentTurn: boolean;
  isMe: boolean;
  capturedPieces: ChessPieceType[]; // pieces captured by this player
  opponentCapturedPieces: ChessPieceType[];
}

const PIECE_VALUES: Record<ChessPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export const ChessPlayerCard: React.FC<ChessPlayerCardProps> = ({
  player,
  isCurrentTurn,
  isMe,
  capturedPieces = [],
  opponentCapturedPieces = []
}) => {
  const isWhite = player.color === 'w';

  // Calculate material advantage
  const materialAdvantage = useMemo(() => {
    const myScore = capturedPieces.reduce((acc, p) => acc + (PIECE_VALUES[p] || 0), 0);
    const oppScore = opponentCapturedPieces.reduce((acc, p) => acc + (PIECE_VALUES[p] || 0), 0);
    return myScore - oppScore;
  }, [capturedPieces, opponentCapturedPieces]);

  // Sort captured pieces: q, r, b, n, p
  const sortedCaptured = useMemo(() => {
    const order: Record<ChessPieceType, number> = { q: 5, r: 4, b: 3, n: 2, p: 1, k: 0 };
    return [...capturedPieces].sort((a, b) => (order[b] || 0) - (order[a] || 0));
  }, [capturedPieces]);

  // Opponent piece color that was captured
  const capturedPieceColor: ChessColor = isWhite ? 'b' : 'w';

  return (
    <div
      className={`w-full max-w-2xl px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center justify-between gap-3 border transition-all duration-300 backdrop-blur-xl ${
        isCurrentTurn
          ? 'bg-slate-900/90 border-indigo-500/50 shadow-[0_4px_20px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/30'
          : 'bg-slate-950/60 border-white/10 shadow-md'
      }`}
    >
      {/* Left: Player Info & Captured Pieces */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Avatar with Side Pill */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-md border ${
              isWhite
                ? 'bg-gradient-to-tr from-slate-200 to-white text-slate-900 border-white/60'
                : 'bg-gradient-to-tr from-slate-900 to-slate-800 text-white border-white/20'
            }`}
          >
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt={player.displayName}
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              (player.displayName?.[0] || (isWhite ? 'W' : 'B')).toUpperCase()
            )}
          </div>

          {/* Piece Color Badge */}
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-black shadow ${
              isWhite
                ? 'bg-white text-slate-950 border-slate-400'
                : 'bg-slate-950 text-white border-white/40'
            }`}
          >
            {isWhite ? '♔' : '♚'}
          </span>
        </div>

        {/* Name, Turn & Captured Tray */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-[180px]">
              {player.displayName} {isMe && <span className="text-[10px] text-indigo-400 font-bold">(You)</span>}
            </span>

            {isCurrentTurn ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold animate-pulse">
                {isMe ? 'Your Turn' : 'Thinking...'}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-medium">Waiting</span>
            )}
          </div>

          {/* Captured Pieces Mini-Tray */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {sortedCaptured.length > 0 ? (
              <div className="flex items-center -space-x-1">
                {sortedCaptured.map((pt, idx) => (
                  <div key={`cap-${pt}-${idx}`} className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <ChessPiece type={pt} color={capturedPieceColor} />
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-600 italic">No captures yet</span>
            )}

            {materialAdvantage > 0 && (
              <span className="text-[10px] font-black text-amber-400 font-mono ml-1">
                +{materialAdvantage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Clock */}
      <div className="shrink-0">
        <ChessClock
          timeRemainingMs={player.timeRemainingMs}
          isActive={isCurrentTurn}
          isWhite={isWhite}
        />
      </div>
    </div>
  );
};
