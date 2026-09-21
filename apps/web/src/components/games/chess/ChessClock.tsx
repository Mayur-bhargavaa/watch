'use client';

import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';

interface ChessClockProps {
  timeRemainingMs: number;
  isActive: boolean;
  isWhite?: boolean;
}

export const ChessClock: React.FC<ChessClockProps> = ({
  timeRemainingMs,
  isActive,
  isWhite
}) => {
  const isLowTime = timeRemainingMs < 30000; // < 30s
  const isCritical = timeRemainingMs < 10000; // < 10s

  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
    }

    // Under 1 minute
    if (isCritical) {
      const tenths = Math.floor((timeRemainingMs % 1000) / 100);
      return `${seconds}.${tenths}`;
    }

    return `${seconds < 10 ? `0${seconds}` : seconds}s`;
  }, [timeRemainingMs, isCritical]);

  return (
    <div
      className={`relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono font-black text-sm sm:text-lg flex items-center gap-2 border transition-all duration-200 select-none ${
        isActive
          ? isCritical
            ? 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse scale-105'
            : isLowTime
            ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
            : 'bg-slate-900 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] ring-2 ring-indigo-500/40'
          : 'bg-black/40 border-white/10 text-slate-400 opacity-80'
      }`}
    >
      <Clock
        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
          isActive ? (isCritical ? 'text-rose-400 animate-spin' : 'text-indigo-400') : 'text-slate-500'
        }`}
      />
      <span className="tracking-wider">{formattedTime}</span>

      {isActive && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-ping" />
      )}
    </div>
  );
};
