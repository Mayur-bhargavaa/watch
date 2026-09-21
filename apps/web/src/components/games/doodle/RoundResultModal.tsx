'use client';

import React from 'react';
import { Trophy, Clock, Repeat, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { DoodleRoundSummary } from '@synccinema/common';
import { useTheme } from '../../../context/ThemeContext';

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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const p1Score = scores[player1.userId] || 0;
  const p2Score = scores[player2.userId] || 0;

  // Defensively support both canonical and aliased field names
  const isGuessed = Boolean(
    summary.guessedCorrectly ??
    summary.guessed ??
    ((summary.pointsEarned ?? 0) > 0 || (summary.guesserPoints ?? 0) > 0)
  );
  const secretWord = summary.secretWord || summary.word || '';
  const roundNumber = summary.roundNumber ?? summary.round ?? 1;
  const timeTaken = summary.timeTakenSeconds ?? summary.timeTaken ?? 0;
  const drawerName = summary.drawerDisplayName || summary.drawerName || 'Drawer';
  const guesserName = summary.guesserDisplayName || summary.guesserName || 'Guesser';
  const drawerPts = summary.drawerPoints ?? 0;
  const guesserPts = summary.guesserPoints ?? summary.pointsEarned ?? 0;

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / 5) * 100));

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md select-none animate-in fade-in duration-200 ${
        isDark ? 'bg-black/85' : 'bg-slate-900/50'
      }`}
    >
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#0f1424] border-white/15 text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Ambient glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

        {/* Top Progress bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Round Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold mb-3 ${
            isDark
              ? 'bg-white/5 border-white/10 text-zinc-300'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Round {roundNumber} Ended</span>
        </div>

        {/* Status Icon & Title */}
        {isGuessed ? (
          <div className="flex flex-col items-center mb-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-2 shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-2xl font-black text-emerald-500">Guessed Correctly!</h3>
            <span className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Solved in {timeTaken}s
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center mb-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-2 shadow-lg shadow-amber-500/10">
              <XCircle className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-2xl font-black text-amber-500">Time's Up!</h3>
            <span className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Nobody guessed the word
            </span>
          </div>
        )}

        {/* Secret Word Revealed */}
        <div
          className={`w-full p-4 rounded-2xl border flex flex-col items-center gap-1 mb-5 ${
            isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}
          >
            The Secret Word Was
          </span>
          <span className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-pink-500 to-violet-500">
            {secretWord}
          </span>
        </div>

        {/* Points Awarded This Round */}
        <div className="w-full grid grid-cols-2 gap-3 mb-5">
          <div
            className={`p-3 rounded-xl border flex flex-col items-center ${
              isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold truncate max-w-[120px] ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}
            >
              Drawer ({drawerName})
            </span>
            <span className="text-lg font-black text-rose-500 mt-1">
              +{drawerPts} pts
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border flex flex-col items-center ${
              isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold truncate max-w-[120px] ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}
            >
              Guesser ({guesserName})
            </span>
            <span className="text-lg font-black text-violet-500 mt-1">
              +{guesserPts} pts
            </span>
          </div>
        </div>

        {/* Current Match Leaderboard */}
        <div
          className={`w-full p-3.5 rounded-2xl border flex items-center justify-between px-6 mb-5 ${
            isDark ? 'bg-black/40 border-white/10' : 'bg-slate-100/70 border-slate-200'
          }`}
        >
          <div className="flex flex-col items-start">
            <span
              className={`text-xs font-bold truncate max-w-[120px] ${
                isDark ? 'text-zinc-300' : 'text-slate-700'
              }`}
            >
              {player1.displayName}
            </span>
            <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {p1Score} pts
            </span>
          </div>

          <div className="flex items-center gap-1 text-rose-500 font-black text-sm">VS</div>

          <div className="flex flex-col items-end">
            <span
              className={`text-xs font-bold truncate max-w-[120px] ${
                isDark ? 'text-zinc-300' : 'text-slate-700'
              }`}
            >
              {player2.displayName}
            </span>
            <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {p2Score} pts
            </span>
          </div>
        </div>

        {/* Role Switch Banner */}
        <div
          className={`w-full p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold ${
            isDark
              ? 'bg-gradient-to-r from-rose-500/10 via-violet-500/10 to-rose-500/10 border-white/10 text-zinc-200'
              : 'bg-rose-50 border-rose-200 text-slate-800'
          }`}
        >
          <Repeat className="w-4 h-4 text-rose-500 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Roles will now automatically switch! Next round starting in {timeLeft}s...</span>
        </div>
      </div>
    </div>
  );
};
