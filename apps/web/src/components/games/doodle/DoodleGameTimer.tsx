'use client';

import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface DoodleGameTimerProps {
  timeLeft: number;
  totalTime?: number;
  currentRound: number;
  totalRounds: number;
  phase?: string;
}

export const DoodleGameTimer: React.FC<DoodleGameTimerProps> = ({
  timeLeft,
  totalTime = 60,
  currentRound,
  totalRounds,
  phase
}) => {
  const percentage = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 select-none">
      {/* Phase Badge if active */}
      {phase === 'DRAWING' && (
        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[#ff3864] text-[10px] font-black tracking-wide uppercase hidden sm:inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff3864] animate-ping" />
          Drawing
        </span>
      )}
      {phase === 'GUESSING' && (
        <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-500 text-[10px] font-black tracking-wide uppercase hidden sm:inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
          Guessing
        </span>
      )}

      {/* Round Pill: "Round 1 / 6" */}
      <div className="px-3.5 sm:px-4 py-2 rounded-full bg-slate-100/90 dark:bg-white/10 flex items-center gap-1.5 shadow-xs">
        <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
          Round {currentRound}
        </span>
        <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold">
          / {totalRounds}
        </span>
      </div>

      {/* Circular Timer Ring matching Mockup with Pink Ring & Black Number */}
      <div className="relative flex items-center justify-center w-11 h-11">
        <svg className="w-11 h-11 -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-slate-100 dark:text-white/10 fill-none"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="#f43f5e"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="fill-none transition-all duration-300"
          />
        </svg>

        <span className="absolute font-bold text-xs text-slate-800 dark:text-white">
          {timeLeft}
        </span>
      </div>
    </div>
  );
};
