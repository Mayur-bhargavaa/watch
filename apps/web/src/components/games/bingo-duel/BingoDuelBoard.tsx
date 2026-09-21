'use client';

import React from 'react';
import { Sparkles, Check } from 'lucide-react';

interface BingoDuelBoardProps {
  board: number[][]; // 5x5 array containing numbers 1..25
  playerMarks: number[];
  calledNumbers: number[];
  winningIndices?: [number, number][]; // cells that formed the win
  onCellClick: (num: number) => void;
  disabled?: boolean;
}

export const BingoDuelBoard: React.FC<BingoDuelBoardProps> = ({
  board,
  playerMarks,
  calledNumbers,
  winningIndices,
  onCellClick,
  disabled
}) => {
  const calledSet = new Set(calledNumbers);
  const markSet = new Set(playerMarks);

  // Set of winning coordinates stringified: 'r,c'
  const winningSet = new Set(
    winningIndices ? winningIndices.map(([r, c]) => `${r},${c}`) : []
  );

  return (
    <div className="w-full max-w-md mx-auto aspect-square p-2.5 sm:p-4 rounded-3xl bg-slate-900/90 border border-indigo-500/30 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
      {/* 5x5 Grid */}
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full h-full">
        {board.map((row, r) =>
          row.map((cellNum, c) => {
            const isCalled = calledSet.has(cellNum);
            const isMarked = markSet.has(cellNum);
            const isWinningCell = winningSet.has(`${r},${c}`);

            // Cell background & style calculation
            let cellClass = 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10';

            if (isWinningCell) {
              cellClass =
                'bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-500 border-amber-300 text-white shadow-lg shadow-pink-500/40 animate-pulse scale-[1.03] z-10';
            } else if (isMarked) {
              cellClass =
                'bg-gradient-to-br from-indigo-600 to-purple-700 border-indigo-400 text-white shadow-md shadow-indigo-600/30';
            } else if (isCalled) {
              // Called but player hasn't marked yet - pulsing glow inviting tap
              cellClass =
                'bg-indigo-950/80 border-indigo-400/80 text-amber-300 ring-2 ring-indigo-400/40 animate-pulse hover:bg-indigo-900';
            }

            return (
              <button
                key={`${r}-${c}-${cellNum}`}
                type="button"
                disabled={disabled}
                onClick={() => onCellClick(cellNum)}
                className={`relative rounded-2xl border-2 font-mono font-black text-base sm:text-2xl transition-all duration-200 flex flex-col items-center justify-center select-none active:scale-95 ${cellClass} ${
                  disabled ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {/* Cell Number */}
                <span>{cellNum < 10 ? `0${cellNum}` : cellNum}</span>

                {/* Marked Check Indicator */}
                {isMarked && !isWinningCell && (
                  <span className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}

                {/* Winning star sparkle indicator */}
                {isWinningCell && (
                  <span className="absolute top-1 right-1 text-amber-200">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
