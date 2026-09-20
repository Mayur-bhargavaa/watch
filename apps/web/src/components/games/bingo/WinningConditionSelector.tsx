'use client';

import React, { useState } from 'react';
import { Info, Check } from 'lucide-react';
import { BingoWinCondition, BingoMode } from '@synccinema/common';

interface WinningConditionSelectorProps {
  mode: BingoMode;
  winConditions: Record<BingoWinCondition, boolean>;
  points: Record<BingoWinCondition, number>;
  pointsEnabled: boolean;
  onToggleCondition: (condition: BingoWinCondition) => void;
  onUpdatePoints: (condition: BingoWinCondition, points: number) => void;
  onOpenCustomPattern?: () => void;
  readOnly?: boolean;
}

interface ConditionMeta {
  id: BingoWinCondition;
  title: string;
  description: string;
  isPattern?: boolean;
  modes: BingoMode[];
}

export const CONDITIONS_META: ConditionMeta[] = [
  {
    id: 'early5',
    title: 'Early 5',
    description: 'First player to mark any 5 numbers anywhere on their ticket.',
    modes: ['90-ball', '75-ball']
  },
  {
    id: 'topLine',
    title: 'Top Line',
    description: 'Mark all 5 numbers in the top row of your ticket.',
    modes: ['90-ball', '75-ball']
  },
  {
    id: 'middleLine',
    title: 'Middle Line',
    description: 'Mark all 5 numbers in the middle horizontal line.',
    modes: ['90-ball', '75-ball']
  },
  {
    id: 'bottomLine',
    title: 'Bottom Line',
    description: 'Mark all 5 numbers in the bottom horizontal line.',
    modes: ['90-ball', '75-ball']
  },
  {
    id: 'fourCorners',
    title: 'Four Corners',
    description: 'Mark the four outer corner numbers on your ticket.',
    modes: ['90-ball', '75-ball']
  },
  {
    id: 'housefull',
    title: 'Housefull',
    description: 'Mark every single number on your ticket for total victory!',
    modes: ['90-ball', '75-ball']
  },
  // 75-Ball Special Patterns
  {
    id: 'xPattern',
    title: 'X Pattern',
    description: 'Mark both crossing diagonal lines forming an X shape.',
    isPattern: true,
    modes: ['75-ball']
  },
  {
    id: 'crossPattern',
    title: 'Cross Pattern',
    description: 'Mark the vertical and horizontal center lines forming a + cross.',
    isPattern: true,
    modes: ['75-ball']
  },
  {
    id: 'starPattern',
    title: 'Star Pattern',
    description: 'Mark the 4 corners, center, and diagonal points.',
    isPattern: true,
    modes: ['75-ball']
  },
  {
    id: 'diamond',
    title: 'Diamond',
    description: 'Mark the diamond perimeter ring on the 5x5 grid.',
    isPattern: true,
    modes: ['75-ball']
  },
  {
    id: 'fullBorder',
    title: 'Full Border',
    description: 'Mark all 16 outer boundary cells around the ticket edge.',
    isPattern: true,
    modes: ['75-ball']
  },
  {
    id: 'customPattern',
    title: 'Custom Pattern',
    description: 'Your own custom designed grid pattern created in the pattern builder.',
    isPattern: true,
    modes: ['75-ball']
  }
];

export const WinningConditionSelector: React.FC<WinningConditionSelectorProps> = ({
  mode,
  winConditions,
  points,
  pointsEnabled,
  onToggleCondition,
  onUpdatePoints,
  onOpenCustomPattern,
  readOnly = false
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const availableConditions = CONDITIONS_META.filter(c => c.modes.includes(mode));
  const standardConditions = availableConditions.filter(c => !c.isPattern);
  const patternConditions = availableConditions.filter(c => c.isPattern);

  return (
    <div className="space-y-4">
      {/* Standard Rules */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Standard Winning Conditions
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {standardConditions.map((cond) => {
            const isChecked = Boolean(winConditions[cond.id]);
            return (
              <div
                key={cond.id}
                className={`relative p-3 rounded-2xl border transition-all ${
                  isChecked
                    ? 'bg-[#ee1d49]/10 border-[#ee1d49]/40 text-white'
                    : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onToggleCondition(cond.id)}
                    className="flex items-center gap-2.5 flex-1 text-left select-none cursor-pointer"
                  >
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                        isChecked
                          ? 'bg-[#ee1d49] border-[#ee1d49] text-white'
                          : 'border-zinc-500 bg-transparent'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold text-zinc-200">{cond.title}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {pointsEnabled && isChecked && !readOnly && (
                      <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                        <span className="text-[10px] text-zinc-400">+</span>
                        <input
                          type="number"
                          min={5}
                          max={500}
                          step={5}
                          value={points[cond.id] || 10}
                          onChange={(e) => onUpdatePoints(cond.id, Number(e.target.value))}
                          className="w-10 bg-transparent text-right text-xs font-bold text-rose-400 focus:outline-none"
                        />
                        <span className="text-[10px] text-zinc-500">pts</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveTooltip(activeTooltip === cond.id ? null : cond.id)}
                      className="text-zinc-500 hover:text-zinc-300 transition p-1"
                      title={cond.description}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tooltip Description */}
                {activeTooltip === cond.id && (
                  <div className="mt-2 text-[10px] text-zinc-300 bg-black/70 p-2 rounded-xl border border-white/10 animate-in fade-in duration-150">
                    {cond.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pattern Rules (for 75-Ball) */}
      {patternConditions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Pattern Combinations (75-Ball)
            </span>
            {onOpenCustomPattern && (
              <button
                type="button"
                onClick={onOpenCustomPattern}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition"
              >
                + Design Custom Pattern
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {patternConditions.map((cond) => {
              const isChecked = Boolean(winConditions[cond.id]);
              return (
                <div
                  key={cond.id}
                  className={`relative p-3 rounded-2xl border transition-all ${
                    isChecked
                      ? 'bg-violet-600/10 border-violet-500/40 text-white'
                      : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onToggleCondition(cond.id)}
                      className="flex items-center gap-2.5 flex-1 text-left select-none cursor-pointer"
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                          isChecked
                            ? 'bg-violet-600 border-violet-600 text-white'
                            : 'border-zinc-500 bg-transparent'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold text-zinc-200">{cond.title}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {pointsEnabled && isChecked && !readOnly && (
                        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                          <span className="text-[10px] text-zinc-400">+</span>
                          <input
                            type="number"
                            min={5}
                            max={500}
                            step={5}
                            value={points[cond.id] || 25}
                            onChange={(e) => onUpdatePoints(cond.id, Number(e.target.value))}
                            className="w-10 bg-transparent text-right text-xs font-bold text-violet-400 focus:outline-none"
                          />
                          <span className="text-[10px] text-zinc-500">pts</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === cond.id ? null : cond.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition p-1"
                        title={cond.description}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tooltip Description */}
                  {activeTooltip === cond.id && (
                    <div className="mt-2 text-[10px] text-zinc-300 bg-black/70 p-2 rounded-xl border border-white/10 animate-in fade-in duration-150">
                      {cond.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
