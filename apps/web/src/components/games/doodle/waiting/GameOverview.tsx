'use client';

import React from 'react';
import { Palette, Users, Clock, Sparkles } from 'lucide-react';

interface GameOverviewProps {
  isDark?: boolean;
}

export const GameOverview: React.FC<GameOverviewProps> = ({ isDark = false }) => {
  return (
    <div className="relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl overflow-hidden transition-all">
      {/* Hand-drawn annotation doodle in top right */}
      <div className="absolute top-2.5 right-3.5 pointer-events-none select-none text-right hidden sm:block">
        <span className="font-serif italic text-[11px] font-bold text-[#ec4899] dark:text-[#f472b6] leading-tight block -rotate-3">
          Good Drawings<br />Better Friends. ♡
        </span>
        <span className="text-[9px] text-[#ff2b70] block">👑</span>
      </div>

      <div className="flex items-center gap-3 mb-2.5">
        {/* Colorful app icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff2b70] via-[#f43f5e] to-amber-400 p-0.5 shadow-xs shrink-0 flex items-center justify-center">
          <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#121629] flex items-center justify-center">
            <Palette className="w-5 h-5 text-[#ff2b70]" />
          </div>
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-black text-[#16132b] dark:text-white tracking-tight leading-tight">
            Doodle Duel
          </h2>
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
            Draw it. Guess it. Switch.
          </p>
        </div>
      </div>

      {/* Feature chips */}
      <div className="grid grid-cols-3 gap-1 pt-0.5">
        <div className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
          <Users className="w-2.5 h-2.5 text-[#ff2b70]" />
          <span>2 Players</span>
        </div>
        <div className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
          <Clock className="w-2.5 h-2.5 text-sky-500" />
          <span>Real-time</span>
        </div>
        <div className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
          <span>Creative</span>
        </div>
      </div>
    </div>
  );
};
