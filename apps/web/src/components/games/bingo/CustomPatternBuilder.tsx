'use client';

import React, { useState } from 'react';
import { X, Sparkles, RotateCcw, Check } from 'lucide-react';

interface CustomPatternBuilderProps {
  initialPattern?: boolean[][];
  onSave: (pattern: boolean[][]) => void;
  onClose: () => void;
}

const DEFAULT_5X5 = (): boolean[][] =>
  Array.from({ length: 5 }, () => new Array(5).fill(false));

export const CustomPatternBuilder: React.FC<CustomPatternBuilderProps> = ({
  initialPattern,
  onSave,
  onClose
}) => {
  const [grid, setGrid] = useState<boolean[][]>(() => {
    if (initialPattern && initialPattern.length === 5) {
      return initialPattern.map(row => [...row]);
    }
    const def = DEFAULT_5X5();
    // Default nice diamond pattern
    def[0][2] = true;
    def[1][1] = true;
    def[1][3] = true;
    def[2][0] = true;
    def[2][4] = true;
    def[3][1] = true;
    def[3][3] = true;
    def[4][2] = true;
    return def;
  });

  const toggleCell = (r: number, c: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = !next[r][c];
      return next;
    });
  };

  const handleClear = () => {
    setGrid(DEFAULT_5X5());
  };

  const selectedCount = grid.reduce(
    (acc, row) => acc + row.filter(Boolean).length,
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0e101a] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-base font-black text-white">Create Winning Pattern</h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Tap cells to design your own winning pattern.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5x5 Pattern Grid */}
        <div className="flex flex-col items-center">
          <div className="p-3 bg-black/40 rounded-2xl border border-white/10 shadow-inner">
            <div className="grid grid-cols-5 gap-2 w-64 h-64 sm:w-72 sm:h-72">
              {grid.map((row, r) =>
                row.map((active, c) => (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => toggleCell(r, c)}
                    className={`rounded-xl border transition-all duration-150 flex items-center justify-center cursor-pointer select-none ${
                      active
                        ? 'bg-[#ee1d49] border-[#ee1d49] shadow-[0_0_15px_rgba(238,29,73,0.5)] scale-95 text-white'
                        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 text-transparent'
                    }`}
                  >
                    {active ? (
                      <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                    ) : (
                      <span className="text-[10px] text-zinc-600">·</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center justify-between w-full mt-3 px-1 text-[11px] text-zinc-400">
            <span>Pattern Preview: {selectedCount} cells active</span>
            <span className="text-rose-400 font-bold">Watch Custom Accent</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              onSave(grid);
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-[#ee1d49] hover:brightness-110 disabled:opacity-40 text-white font-black text-xs transition shadow-lg shadow-rose-600/25 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Pattern</span>
          </button>
        </div>
      </div>
    </div>
  );
};
