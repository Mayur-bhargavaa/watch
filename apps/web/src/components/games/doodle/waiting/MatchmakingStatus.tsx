'use client';

import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface MatchmakingStatusProps {
  hasOpponent: boolean;
  bothReady?: boolean;
  humanOnly?: boolean;
  isDark?: boolean;
}

export const MatchmakingStatus: React.FC<MatchmakingStatusProps> = ({
  hasOpponent,
  bothReady = false,
  humanOnly = true,
  isDark = false
}) => {
  return (
    <div className="relative text-center w-full max-w-lg mx-auto select-none pt-0 pb-1">
      {/* Hand-drawn scribble top-right: Play Laugh Stay Together ♡ */}
      <div className="absolute -top-3 right-1 sm:right-4 pointer-events-none select-none text-right hidden sm:block">
        <span className="font-serif italic text-[11px] font-bold text-[#ec4899] dark:text-[#f472b6] leading-tight block -rotate-6">
          Play<br />Laugh<br />Stay Together ♡
        </span>
        <svg className="w-4 h-4 text-[#ff2b70] inline-block -rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
      </div>

      {/* Strict Matchmaking Pill */}
      {humanOnly && (
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-extrabold tracking-wide mb-1.5 shadow-2xs">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Strict Zero-Bots Matchmaking</span>
        </div>
      )}

      {/* Main Title */}
      <h1 className="text-2xl sm:text-3xl font-black text-[#16132b] dark:text-white tracking-tight leading-tight">
        {hasOpponent ? (
          bothReady ? (
            <>
              Ready to <span className="text-[#ff2b70]">Duel!</span>
            </>
          ) : (
            <>
              Opponent <span className="text-[#ff2b70]">Found</span>
            </>
          )
        ) : (
          <>
            Waiting for <span className="text-[#ff2b70]">Opponent</span>
          </>
        )}
      </h1>

      {/* Subtitle */}
      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium max-w-md mx-auto mt-0.5 leading-snug">
        {hasOpponent ? (
          bothReady ? (
            <span>Both players are locked in! Host can launch the duel anytime.</span>
          ) : (
            <span>You're ready to duel! Ready up to begin the match.</span>
          )
        ) : (
          <>
            Match will begin when 2 human players join the room.
            <br />
            No bots will ever be injected.
          </>
        )}
      </p>
    </div>
  );
};
