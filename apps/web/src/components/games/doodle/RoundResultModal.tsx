'use client';

import React from 'react';
import { Trophy, Clock, Repeat, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { DoodleRoundSummary } from '@synccinema/common';

interface RoundResultModalProps {
  summary: DoodleRoundSummary;
  scores: Record<string, number>;
  player1: { userId: string; displayName: string };
  player2: { userId: string; displayName: string };
  isNextRoundLast?: boolean;
  timeLeft: number;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  summary,
  scores,
  player1,
  player2,
  isNextRoundLast = false,
  timeLeft
}) => {
  const p1Score = scores[player1.userId] || 0;
  const p2Score = scores[player2.userId] || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0f1424] border border-white/15 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

        {/* Top Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all duration-300"
            style={{ width: `${(timeLeft / 5) * 100}%` }}
          />
        </div>

        {/* Round Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 mb-3">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Round {summary.roundNumber} Ended</span>
        </div>

        {/* Status Icon & Title */}
        {summary.guessed ? (
          <div className="flex flex-col items-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-emerald-400">Guessed Correctly!</h3>
            <span className="text-xs text-zinc-400 mt-0.5">
              Solved in {summary.timeTakenSeconds}s
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
              <XCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-amber-400">Time's Up!</h3>
            <span className="text-xs text-zinc-400 mt-0.5">Nobody guessed the word</span>
          </div>
        )}

        {/* Secret Word Revealed */}
        <div className="w-full p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-1 mb-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            The Secret Word Was
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-violet-400">
            {summary.secretWord}
          </span>
        </div>

        {/* Points Awarded This Round */}
        <div className="w-full grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-zinc-400">
              Drawer ({summary.drawerDisplayName || summary.drawerName})
            </span>
            <span className="text-lg font-black text-rose-400 mt-1">
              +{summary.drawerPoints ?? 0} pts
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-zinc-400">
              Guesser ({summary.guesserDisplayName || summary.guesserName})
            </span>
            <span className="text-lg font-black text-violet-400 mt-1">
              +{summary.guesserPoints ?? summary.pointsEarned ?? 0} pts
            </span>
          </div>
        </div>

        {/* Current Match Leaderboard */}
        <div className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between px-6 mb-5">
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-zinc-300 truncate max-w-[120px]">
              {player1.displayName}
            </span>
            <span className="text-lg font-black text-white">{p1Score} pts</span>
          </div>

          <div className="flex items-center gap-1 text-zinc-500 font-black text-sm">
            VS
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-zinc-300 truncate max-w-[120px]">
              {player2.displayName}
            </span>
            <span className="text-lg font-black text-white">{p2Score} pts</span>
          </div>
        </div>

        {/* Role Switch Banner */}
        <div className="w-full p-3 rounded-xl bg-gradient-to-r from-rose-500/10 via-violet-500/10 to-rose-500/10 border border-white/10 flex items-center justify-center gap-2 text-xs font-bold text-zinc-200">
          <Repeat className="w-4 h-4 text-rose-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Roles will now automatically switch! Next round starting in {timeLeft}s...</span>
        </div>
      </div>
    </div>
  );
};
