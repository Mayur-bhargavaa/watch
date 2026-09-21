'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Check, Shuffle, RotateCcw, Lock, Unlock, AlertCircle, Award } from 'lucide-react';
import { BingoDuelCompletedLine } from '@synccinema/common';

interface BingoDuelBoardProps {
  board: number[][]; // 5x5 array containing numbers 1..25
  playerMarks: number[];
  calledNumbers: number[];
  completedLines?: BingoDuelCompletedLine[];
  bingoLetters?: string[]; // e.g. ['B', 'I', 'N', 'G', 'O']
  winningIndices?: [number, number][]; // cells that formed the win
  onCellClick: (num: number) => void;
  disabled?: boolean;
  
  // Interactive Custom Board Setup (1-25)
  isSetupMode?: boolean;
  onSaveBoard?: (board: number[][]) => void;
  onCancelSetup?: () => void;
  onValidationToast?: (message: string) => void;
}

export const BingoDuelBoard: React.FC<BingoDuelBoardProps> = ({
  board,
  playerMarks,
  calledNumbers,
  completedLines = [],
  bingoLetters = [],
  winningIndices,
  onCellClick,
  disabled,
  isSetupMode = false,
  onSaveBoard,
  onCancelSetup,
  onValidationToast
}) => {
  // State for setup mode: a local 5x5 draft grid (0 means unplaced)
  const [setupGrid, setSetupGrid] = useState<number[][]>(() => {
    if (board && board.length === 5 && board[0]?.length === 5) {
      return board.map(row => [...row]);
    }
    return Array(5).fill(null).map(() => Array(5).fill(0));
  });

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [setupLocked, setSetupLocked] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Sync board prop when entering setup or board updates
  useEffect(() => {
    if (board && board.length === 5 && board[0]?.length === 5) {
      setSetupGrid(board.map(row => [...row]));
    }
  }, [board]);

  // Set of numbers currently placed on setup board
  const placedNumbers = useMemo(() => {
    const s = new Set<number>();
    for (const row of setupGrid) {
      for (const val of row) {
        if (val >= 1 && val <= 25) {
          s.add(val);
        }
      }
    }
    return s;
  }, [setupGrid]);

  const isSetupGridFull = placedNumbers.size === 25;

  // Automatically lock matrix when all 25 numbers are filled
  useEffect(() => {
    if (isSetupMode && isSetupGridFull) {
      setSetupLocked(true);
    }
  }, [isSetupMode, isSetupGridFull]);

  // Validation toast helper
  const triggerError = (msg: string) => {
    setSetupError(msg);
    if (onValidationToast) onValidationToast(msg);
    setTimeout(() => {
      setSetupError(curr => (curr === msg ? null : curr));
    }, 3200);
  };

  // Handle cell number change in setup mode
  const handleAssignNumber = (num: number, targetCoord?: { r: number; c: number }) => {
    if (setupLocked) return;

    // Validate range 1..25
    if (num < 1 || num > 25) {
      triggerError('⚠️ Numbers must be strictly between 1 and 25!');
      return;
    }

    const target = targetCoord || selectedCell || { r: 0, c: 0 };
    const currentVal = setupGrid[target.r][target.c];

    // If attempting to place a duplicate number already somewhere else on the board
    if (placedNumbers.has(num) && currentVal !== num) {
      triggerError(`⚠️ Number ${num} is already placed! Duplicates are not allowed.`);
      return;
    }

    const next = setupGrid.map((row, r) =>
      row.map((val, c) => (r === target.r && c === target.c ? num : val))
    );
    setSetupGrid(next);
    setSetupError(null);

    // Auto-advance selection to next empty cell
    let nextEmpty: { r: number; c: number } | null = null;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === target.r && c === target.c) continue;
        if (next[r][c] === 0) {
          // If we haven't found one after target yet, keep checking
          if (!nextEmpty) nextEmpty = { r, c };
        }
      }
    }
    if (nextEmpty) {
      setSelectedCell(nextEmpty);
    }
  };

  // Quick Randomize / Shuffle Board (1..25 unique)
  const handleShuffleBoard = () => {
    const nums = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    const newGrid: number[][] = [];
    for (let r = 0; r < 5; r++) {
      newGrid.push(nums.slice(r * 5, (r + 1) * 5));
    }

    setSetupGrid(newGrid);
    setSetupLocked(true);
    setSetupError(null);
  };

  // Clear Board in Setup
  const handleClearBoard = () => {
    setSetupGrid(Array(5).fill(null).map(() => Array(5).fill(0)));
    setSetupLocked(false);
    setSelectedCell({ r: 0, c: 0 });
    setSetupError(null);
  };

  // Save Custom Board
  const handleSaveBoard = () => {
    if (!isSetupGridFull) {
      triggerError('⚠️ Please fill all 25 numbers before saving your board!');
      return;
    }
    if (onSaveBoard) {
      onSaveBoard(setupGrid);
    }
  };

  // Gameplay Mode Sets
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const markSet = useMemo(() => new Set(playerMarks), [playerMarks]);
  const winningSet = useMemo(
    () => new Set(winningIndices ? winningIndices.map(([r, c]) => `${r},${c}`) : []),
    [winningIndices]
  );

  const activeLettersCount = bingoLetters.length;

  // -----------------------------------------------------------------------------------
  // RENDER: SETUP MODE
  // -----------------------------------------------------------------------------------
  if (isSetupMode) {
    return (
      <div className="w-full max-w-md mx-auto p-4 sm:p-5 rounded-3xl bg-slate-900/95 border border-indigo-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col gap-4 text-white animate-in fade-in zoom-in-95 duration-300">
        {/* Setup Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="font-black text-lg sm:text-xl text-white tracking-wide flex items-center gap-2">
              <span>🎯 Custom 5×5 Matrix</span>
              {setupLocked && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fill numbers <strong className="text-indigo-300">1 to 25</strong> without duplicates.
            </p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
              isSetupGridFull
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}>
              {placedNumbers.size} / 25
            </span>
          </div>
        </div>

        {/* Error / Alert banner */}
        {setupError && (
          <div className="px-3.5 py-2 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-1 duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{setupError}</span>
          </div>
        )}

        {/* 5x5 Setup Grid */}
        <div className="relative aspect-square w-full rounded-2xl bg-black/40 border border-white/10 p-2 sm:p-2.5">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full h-full">
            {setupGrid.map((row, r) =>
              row.map((cellNum, c) => {
                const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                const isFilled = cellNum > 0;

                return (
                  <button
                    key={`setup-${r}-${c}`}
                    type="button"
                    disabled={setupLocked}
                    onClick={() => {
                      if (!setupLocked) {
                        setSelectedCell({ r, c });
                      }
                    }}
                    className={`relative rounded-xl border-2 font-mono font-black text-base sm:text-xl transition-all duration-150 flex items-center justify-center select-none ${
                      isSelected && !setupLocked
                        ? 'bg-indigo-600 border-indigo-400 text-white ring-4 ring-indigo-500/40 scale-105 z-10 shadow-lg'
                        : isFilled
                        ? 'bg-indigo-950/70 border-indigo-500/40 text-indigo-100 hover:border-indigo-400'
                        : 'bg-white/5 border-dashed border-white/20 text-slate-500 hover:bg-white/10'
                    } ${setupLocked ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-95'}`}
                  >
                    {isFilled ? (
                      <span>{cellNum < 10 ? `0${cellNum}` : cellNum}</span>
                    ) : (
                      <span className="text-xs text-white/30">•</span>
                    )}

                    {isFilled && !setupLocked && isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-500 text-[10px] flex items-center justify-center font-sans shadow">
                        ✎
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Numeric Palette Tray (Chips 1..25) */}
        {!setupLocked ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>Select number to place in cell:</span>
              <span className="text-slate-500">
                Cell [{selectedCell ? `${selectedCell.r + 1},${selectedCell.c + 1}` : 'None'}]
              </span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5 max-h-36 overflow-y-auto p-1 bg-black/25 rounded-xl border border-white/5">
              {Array.from({ length: 25 }, (_, i) => i + 1).map(num => {
                const isPlaced = placedNumbers.has(num);
                return (
                  <button
                    key={`palette-${num}`}
                    type="button"
                    disabled={isPlaced}
                    onClick={() => handleAssignNumber(num)}
                    className={`py-1.5 sm:py-2 rounded-lg font-mono font-bold text-xs sm:text-sm border transition-all ${
                      isPlaced
                        ? 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed opacity-50 line-through'
                        : 'bg-gradient-to-b from-indigo-900/60 to-purple-900/60 border-indigo-500/40 text-indigo-200 hover:border-indigo-400 hover:scale-105 active:scale-95'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Full 5×5 matrix complete! Ready to lock and play.</span>
            </div>
            <button
              type="button"
              onClick={() => setSetupLocked(false)}
              className="text-[11px] font-bold underline hover:text-emerald-200 flex items-center gap-1"
            >
              <Unlock className="w-3 h-3" /> Edit
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-1">
          {!setupLocked ? (
            <>
              <button
                type="button"
                onClick={handleShuffleBoard}
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 font-bold text-xs sm:text-sm text-indigo-200 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Shuffle className="w-3.5 h-3.5" /> Auto Fill 1–25
              </button>
              <button
                type="button"
                onClick={handleClearBoard}
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSaveBoard}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 font-extrabold text-sm text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Check className="w-4 h-4" /> Save & Lock Board
            </button>
          )}

          {onCancelSetup && (
            <button
              type="button"
              onClick={onCancelSetup}
              className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-400"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------------------
  // RENDER: GAMEPLAY MODE
  // -----------------------------------------------------------------------------------
  const letters = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-2.5 sm:gap-3">
      {/* 1. B - I - N - G - O Header Badges with Smooth Lighting */}
      <div className="w-full p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border border-white/10 shadow-xl backdrop-blur-xl flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300/80 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            Target: 5 Lines to Win
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-400">
            {completedLines.length} / 5 Lines Done
          </span>
        </div>

        {/* 5 Letters Row */}
        <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
          {letters.map((letter, idx) => {
            const isUnlocked = idx < activeLettersCount;
            return (
              <div
                key={`bingo-badge-${letter}`}
                className={`relative py-2 rounded-xl text-center font-black font-mono text-lg sm:text-2xl transition-all duration-300 border-2 select-none overflow-hidden ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 border-amber-300 text-white shadow-lg shadow-pink-500/40 scale-105 animate-pulse'
                    : 'bg-white/5 border-white/10 text-slate-600'
                }`}
              >
                <span>{letter}</span>

                {/* Strikethrough line across unlocked letters */}
                {isUnlocked && (
                  <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 sm:h-1 bg-white/90 shadow-[0_0_8px_white]" />
                )}

                {/* Star on letter completion */}
                {isUnlocked && (
                  <span className="absolute top-0.5 right-0.5 text-amber-200">
                    <Sparkles className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 5x5 Main Board with Animated SVG Line Strike-Through Overlay */}
      <div className="relative w-full aspect-square p-2.5 sm:p-4 rounded-3xl bg-slate-900/95 border-2 border-indigo-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden flex flex-col justify-between">
        
        {/* Animated 5x5 Grid */}
        <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full h-full relative z-10">
          {board.map((row, r) =>
            row.map((cellNum, c) => {
              const isCalled = calledSet.has(cellNum);
              const isMarked = markSet.has(cellNum);
              const isWinningCell = winningSet.has(`${r},${c}`);

              // Style calculation
              let cellClass = 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10';

              if (isWinningCell) {
                cellClass =
                  'bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-500 border-amber-300 text-white shadow-lg shadow-pink-500/40 scale-[1.03] z-10';
              } else if (isMarked) {
                cellClass =
                  'bg-gradient-to-br from-indigo-600 to-purple-700 border-indigo-400 text-white shadow-md shadow-indigo-600/30';
              } else if (isCalled) {
                // Called by server but player hasn't marked yet - pulsing glow
                cellClass =
                  'bg-indigo-950/90 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 animate-pulse hover:bg-indigo-900';
              }

              return (
                <button
                  key={`cell-${r}-${c}-${cellNum}`}
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

                  {/* Winning sparkle indicator */}
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

        {/* 3. SVG Strike-Through Animated Overlay for Completed Lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="strikeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {completedLines.map(line => {
            if (line.type === 'row') {
              // Row: horizontal line centered at row index
              const y = (line.index + 0.5) * 20;
              return (
                <line
                  key={line.id}
                  x1="3"
                  y1={y}
                  x2="97"
                  y2={y}
                  stroke="url(#strikeGrad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  className="animate-pulse"
                />
              );
            }

            if (line.type === 'col') {
              // Column: vertical line centered at col index
              const x = (line.index + 0.5) * 20;
              return (
                <line
                  key={line.id}
                  x1={x}
                  y1="3"
                  x2={x}
                  y2="97"
                  stroke="url(#strikeGrad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  className="animate-pulse"
                />
              );
            }

            if (line.id === 'diag-main') {
              // Main diagonal: top-left to bottom-right
              return (
                <line
                  key={line.id}
                  x1="4"
                  y1="4"
                  x2="96"
                  y2="96"
                  stroke="url(#strikeGrad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  className="animate-pulse"
                />
              );
            }

            if (line.id === 'diag-anti') {
              // Anti diagonal: top-right to bottom-left
              return (
                <line
                  key={line.id}
                  x1="96"
                  y1="4"
                  x2="4"
                  y2="96"
                  stroke="url(#strikeGrad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  className="animate-pulse"
                />
              );
            }

            return null;
          })}
        </svg>
      </div>
    </div>
  );
};
