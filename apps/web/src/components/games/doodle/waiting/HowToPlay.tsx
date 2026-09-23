'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';

interface HowToPlayProps {
  isDark?: boolean;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ isDark = false }) => {
  const steps = [
    'One player gets a word and draws it.',
    'The other player guesses in real-time.',
    'Then roles switch!',
    'Most correct guesses win! 🎉'
  ];

  return (
    <div className="relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl transition-all space-y-2">
      <div className="flex items-center gap-1.5 pb-0.5">
        <div className="w-5 h-5 rounded-lg bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center">
          <BookOpen className="w-3 h-3" />
        </div>
        <h3 className="text-xs sm:text-sm font-black text-[#16132b] dark:text-white tracking-tight">
          How to Play?
        </h3>
      </div>

      <div className="space-y-1.5">
        {steps.map((text, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#ff2b70] text-white font-extrabold text-[9px] flex items-center justify-center shrink-0 shadow-2xs">
              {idx + 1}
            </span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 leading-tight">
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
