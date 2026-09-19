'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trophy, Sparkles, Flame } from 'lucide-react';
import { TicTacToeGameState, TicTacToeMark } from '@synccinema/common';

export interface TicTacToeGameProps {
  gameState?: TicTacToeGameState | null;
  mySeat?: number | null;
  isMyTurn?: boolean;
  onMakeMove?: (cellIndex: number) => void;
  onRematch?: () => void;
  isCompact?: boolean;
  player1Name?: string;
  player2Name?: string;
}

export const TicTacToeGame: React.FC<TicTacToeGameProps> = ({
  gameState,
  mySeat = 0,
  isMyTurn = false,
  onMakeMove,
  onRematch,
  isCompact = false,
  player1Name = 'Player 1',
  player2Name = 'Player 2'
}) => {
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  const board: TicTacToeMark[] = gameState?.board || Array(9).fill(null);
  const myMark: 'X' | 'O' = mySeat === 0 ? 'X' : 'O';

  // SVG Winning Line Calculation
  const winningLineCoords = React.useMemo(() => {
    if (!gameState?.winningLine) return null;
    const [a, , c] = gameState.winningLine;

    const getPos = (idx: number) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      return {
        x: col === 0 ? 16.66 : col === 1 ? 50 : 83.33,
        y: row === 0 ? 16.66 : row === 1 ? 50 : 83.33
      };
    };

    const p1 = getPos(a);
    const p3 = getPos(c);
    return { x1: `${p1.x}%`, y1: `${p1.y}%`, x2: `${p3.x}%`, y2: `${p3.y}%` };
  }, [gameState?.winningLine]);

  return (
    <div className={`w-full flex flex-col items-center select-none ${isCompact ? 'p-2' : 'p-4'}`}>
      {/* Header Turn Banner */}
      <div className="mb-3 text-center">
        {gameState?.winner ? (
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs animate-bounce">
            <Trophy className="w-3.5 h-3.5" />
            <span>Winner: {gameState.winner === 'X' ? player1Name : player2Name} ({gameState.winner})!</span>
          </div>
        ) : gameState?.isDraw ? (
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-zinc-300 font-bold text-xs">
            <span>🤝 Game Draw!</span>
          </div>
        ) : isMyTurn ? (
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Your Turn ({myMark})</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs">
            <span>Opponent's Turn ({gameState?.currentTurnMark || 'X'})...</span>
          </div>
        )}
      </div>

      {/* 3x3 Grid */}
      <div
        className={`relative aspect-square w-full ${
          isCompact ? 'max-w-[280px]' : 'max-w-[340px]'
        } rounded-3xl p-4 bg-[#121420]/90 border border-white/15 shadow-2xl backdrop-blur-xl flex items-center justify-center`}
      >
        <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-2.5 relative">
          {board.map((cell, idx) => {
            const isWinning = gameState?.winningLine?.includes(idx);
            const isHovered = hoveredCell === idx && !cell && isMyTurn && !gameState?.winner && !gameState?.isDraw;

            return (
              <button
                key={idx}
                onClick={() => {
                  if (!cell && isMyTurn && !gameState?.winner && !gameState?.isDraw) {
                    onMakeMove?.(idx);
                  }
                }}
                onMouseEnter={() => setHoveredCell(idx)}
                onMouseLeave={() => setHoveredCell(null)}
                disabled={Boolean(cell) || !isMyTurn || Boolean(gameState?.winner) || Boolean(gameState?.isDraw)}
                className={`relative rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  isWinning
                    ? 'bg-amber-500/25 border-2 border-amber-400 shadow-xl shadow-amber-500/30 scale-102'
                    : cell
                    ? 'bg-white/[0.04] border border-white/10 cursor-default'
                    : isMyTurn
                    ? 'bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/20 cursor-pointer active:scale-95'
                    : 'bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-70'
                }`}
              >
                {cell === 'X' ? (
                  <span className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-rose-500 to-pink-400 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                    ✕
                  </span>
                ) : cell === 'O' ? (
                  <span className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 to-blue-400 filter drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
                    ◯
                  </span>
                ) : isHovered ? (
                  <span className="text-3xl sm:text-5xl font-black opacity-30 text-white">
                    {myMark === 'O' ? '◯' : '✕'}
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* Winning Line Overlay */}
          {winningLineCoords && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
              <line
                x1={winningLineCoords.x1}
                y1={winningLineCoords.y1}
                x2={winningLineCoords.x2}
                y2={winningLineCoords.y2}
                stroke="#f59e0b"
                strokeWidth="6"
                strokeLinecap="round"
                className="animate-pulse filter drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Rematch Button */}
      {(gameState?.winner || gameState?.isDraw) && onRematch && (
        <button
          onClick={onRematch}
          className="mt-4 py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 flex items-center gap-2 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Play Rematch</span>
        </button>
      )}
    </div>
  );
};
