'use client';

import React from 'react';
import { Play, Sparkles, Clock, Check } from 'lucide-react';

interface ReadyStateProps {
  hasOpponent: boolean;
  isHost: boolean;
  isStarting: boolean;
  onStartGame: () => void;
  isDark?: boolean;
}

export const ReadyState: React.FC<ReadyStateProps> = ({
  hasOpponent,
  isHost,
  isStarting,
  onStartGame,
  isDark = false
}) => {
  if (!hasOpponent) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-2 text-center select-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      {isHost ? (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/40 text-[#ff2b70] text-xs font-black tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>2 Players Connected! You can start the duel.</span>
          </div>

          <button
            type="button"
            disabled={isStarting}
            onClick={onStartGame}
            className={`w-full py-3.5 sm:py-4 px-8 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-white bg-gradient-to-r from-[#ff2b70] via-[#f43f5e] to-[#e11d48] hover:brightness-110 shadow-[0_6px_25px_rgba(255,43,112,0.4)] transition-all active:scale-[0.98] cursor-pointer ${
              isStarting ? 'opacity-80 animate-pulse' : ''
            }`}
          >
            <Play className={`w-4 h-4 fill-current ${isStarting ? 'animate-spin' : ''}`} />
            <span>{isStarting ? 'Starting Duel... 🚀' : 'Start Doodle Duel 🚀'}</span>
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-xs flex items-center justify-center gap-2 text-slate-600 dark:text-zinc-300 text-xs font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff2b70] animate-ping" />
          <span>Waiting for Host to start the duel...</span>
        </div>
      )}
    </div>
  );
};
