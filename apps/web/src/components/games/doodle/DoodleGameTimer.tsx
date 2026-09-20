'use client';

import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface DoodleGameTimerProps {
  timeLeft: number;
  totalTime?: number;
  currentRound: number;
  totalRounds: number;
}

export const DoodleGameTimer: React.FC<DoodleGameTimerProps> = ({
  timeLeft,
  totalTime = 60,
  currentRound,
  totalRounds
}) => {
  const isUrgent = timeLeft <= 10;
  const isCritical = timeLeft <= 5;
  const percentage = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));

  // Color selection
  let strokeColor = '#10B981'; // emerald
  let textColor = 'text-emerald-400';
  let bgColor = 'bg-emerald-500/10 border-emerald-500/20';

  if (timeLeft <= 15 && timeLeft > 5) {
    strokeColor = '#F59E0B'; // amber
    textColor = 'text-amber-400';
    bgColor = 'bg-amber-500/10 border-amber-500/20';
  } else if (timeLeft <= 5) {
    strokeColor = '#F43F5E'; // rose
    textColor = 'text-rose-400';
    bgColor = 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]';
  }

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Round Pill */}
      <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 shadow-sm">
        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Round</span>
        <span className="text-sm font-black text-white">
          {currentRound}
          <span className="text-xs text-zinc-500 font-semibold">/{totalRounds}</span>
        </span>
      </div>

      {/* Circular Timer Ring */}
      <div
        className={`relative flex items-center justify-center w-12 h-12 rounded-full border transition-all ${bgColor} ${
          isCritical ? 'animate-bounce' : isUrgent ? 'animate-pulse' : ''
        }`}
      >
        <svg className="w-12 h-12 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-white/10 fill-none"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="fill-none transition-all duration-300"
          />
        </svg>

        <span className={`absolute font-mono text-sm font-black ${textColor}`}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
};
