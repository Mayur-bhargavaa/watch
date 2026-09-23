'use client';

import React from 'react';

interface VersusIndicatorProps {
  isDark?: boolean;
}

export const VersusIndicator: React.FC<VersusIndicatorProps> = ({ isDark = false }) => {
  return (
    <div className="flex items-center justify-center shrink-0 my-auto z-10">
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-[#121629] border border-slate-200/80 dark:border-white/15 shadow-[0_4px_16px_rgba(255,43,112,0.12)] flex items-center justify-center select-none">
        <span className="text-xs sm:text-sm font-black text-[#ff2b70] tracking-wider">
          VS
        </span>
      </div>
    </div>
  );
};
