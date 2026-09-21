'use client';

import React from 'react';
import { Sparkles, AlertCircle, Trophy, Flame } from 'lucide-react';

interface BingoDuelClaimButtonProps {
  onClaim: () => void;
  isCompleted: boolean;
  penaltySeconds?: number;
  patternName: string;
  disabled?: boolean;
}

export const BingoDuelClaimButton: React.FC<BingoDuelClaimButtonProps> = ({
  onClaim,
  isCompleted,
  penaltySeconds = 0,
  patternName,
  disabled
}) => {
  const isPenaltyActive = penaltySeconds > 0;

  return (
    <div className="w-full max-w-[340px] mx-auto">
      {isPenaltyActive ? (
        <div className="w-full py-2.5 px-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex items-center justify-center gap-2 shadow-lg backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-rose-400 animate-bounce" />
          <span className="font-bold text-xs">
            False Bingo! Cooldown active ({penaltySeconds}s)
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onClaim}
          disabled={disabled}
          className={`w-full py-2.5 px-4 rounded-xl font-black text-sm tracking-wider uppercase transition-all duration-300 shadow-xl flex items-center justify-center gap-2 relative overflow-hidden group select-none active:scale-[0.98] ${
            isCompleted
              ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-600 text-white shadow-pink-500/40 hover:shadow-pink-500/60 ring-2 ring-amber-400/40 animate-pulse cursor-pointer'
              : 'bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 text-white/90 hover:text-white shadow-indigo-600/30 cursor-pointer'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {/* Shimmer light effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition duration-1000 transform pointer-events-none" />

          <Trophy className="w-4 h-4 text-amber-300 fill-amber-300 animate-bounce" />
          <span>SHOUT BINGO!</span>
          <Sparkles className="w-4 h-4 text-amber-200" />
        </button>
      )}

      <div className="text-center mt-1">
        <span className="text-[10px] text-slate-400">
          Target Pattern: <span className="text-indigo-300 font-semibold">{patternName}</span>
        </span>
      </div>
    </div>
  );
};
