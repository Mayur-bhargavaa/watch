'use client';

import React from 'react';
import { Check, Trophy } from 'lucide-react';
import { BingoConditionProgress } from '@synccinema/common';

interface WinningProgressProps {
  progress: Record<string, BingoConditionProgress>;
  playerName: string;
}

const CONDITION_LABELS: Record<string, string> = {
  early5: 'Early 5',
  topLine: 'Top Line',
  middleLine: 'Middle Line',
  bottomLine: 'Bottom Line',
  fourCorners: 'Four Corners',
  housefull: 'Housefull',
  xPattern: 'X Pattern',
  crossPattern: 'Cross Pattern',
  starPattern: 'Star Pattern',
  diamond: 'Diamond',
  fullBorder: 'Full Border',
  customPattern: 'Custom'
};

export const WinningProgress: React.FC<WinningProgressProps> = ({
  progress,
  playerName
}) => {
  if (!progress || Object.keys(progress).length === 0) {
    return null;
  }

  const entries = Object.entries(progress);

  return (
    <div className="w-full rounded-2xl bg-[#0b0d17]/80 border border-white/10 p-3 shadow-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
          <Trophy className="w-3 h-3 text-rose-400" />
          <span>Winning Progress</span>
        </div>
        <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{playerName}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {entries.map(([condKey, info]) => {
          const label = CONDITION_LABELS[condKey] || condKey;
          const isCompleted = info.isMet;
          const isClaimedByAnyone = info.claimed;
          const pct = info.total > 0 ? Math.min(100, Math.round((info.current / info.total) * 100)) : 0;

          return (
            <div
              key={condKey}
              className={`p-2 rounded-xl border flex flex-col justify-between transition-all ${
                isCompleted
                  ? 'bg-rose-500/10 border-rose-500/30 text-white'
                  : 'bg-white/[0.02] border-white/[0.05] text-zinc-400'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-bold text-zinc-300 truncate">
                  {label}
                </span>
                {isCompleted ? (
                  <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded-md">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>DONE</span>
                  </span>
                ) : isClaimedByAnyone ? (
                  <span className="text-[9px] text-zinc-500 font-bold">Claimed</span>
                ) : (
                  <span className="text-[9px] font-mono text-zinc-400">
                    {info.current} / {info.total}
                  </span>
                )}
              </div>

              {/* Mini Progress Bar */}
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-[#ee1d49]' : 'bg-white/40'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
