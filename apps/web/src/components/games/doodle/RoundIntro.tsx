'use client';

import React from 'react';
import { Palette, Brain, Zap } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

interface RoundIntroProps {
  currentRound: number;
  totalRounds: number;
  drawerDisplayName: string;
  guesserDisplayName: string;
  isDrawer: boolean;
  countdown: number;
}

export const RoundIntro: React.FC<RoundIntroProps> = ({
  currentRound,
  totalRounds,
  drawerDisplayName,
  guesserDisplayName,
  isDrawer,
  countdown
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl select-none animate-in fade-in duration-200 ${
      isDark ? 'bg-black/80' : 'bg-slate-900/40'
    }`}>
      <div className={`relative w-full max-w-md rounded-3xl border p-8 flex flex-col items-center text-center overflow-hidden transition-all duration-300 ${
        isDark
          ? 'bg-[#0f1424]/95 border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(255,43,94,0.12)] text-white'
          : 'bg-white/95 border-slate-200 shadow-[0_25px_70px_rgba(0,0,0,0.15),0_0_30px_rgba(244,63,94,0.08)] text-slate-900'
      }`}>
        {/* Glow ambient effects */}
        <div className={`absolute -top-20 -left-20 w-52 h-52 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-rose-500/20' : 'bg-rose-400/15'
        }`} />
        <div className={`absolute -bottom-20 -right-20 w-52 h-52 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-violet-500/20' : 'bg-violet-400/15'
        }`} />

        {/* Round Badge */}
        <div className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-widest mb-4 ${
          isDark
            ? 'bg-white/10 border-white/10 text-zinc-300'
            : 'bg-slate-100 border-slate-200 text-slate-700'
        }`}>
          Round {currentRound} of {totalRounds}
        </div>

        {/* Roles announcement */}
        <div className="w-full grid grid-cols-2 gap-3 mb-6">
          {/* Drawer Card */}
          <div
            className={`flex flex-col items-center p-3.5 rounded-2xl border transition-all ${
              isDrawer
                ? 'bg-rose-500/15 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 mb-2">
              <Palette className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
              Drawer
            </span>
            <span className={`text-sm font-black truncate max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {drawerDisplayName}
            </span>
            {isDrawer && (
              <span className="text-[9px] font-bold text-rose-400 mt-1 bg-rose-500/20 px-1.5 py-0.5 rounded-full">
                YOU
              </span>
            )}
          </div>

          {/* Guesser Card */}
          <div
            className={`flex flex-col items-center p-3.5 rounded-2xl border transition-all ${
              !isDrawer
                ? 'bg-violet-500/15 border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                : isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 mb-2">
              <Brain className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">
              Guesser
            </span>
            <span className={`text-sm font-black truncate max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {guesserDisplayName}
            </span>
            {!isDrawer && (
              <span className="text-[9px] font-bold text-violet-400 mt-1 bg-violet-500/20 px-1.5 py-0.5 rounded-full">
                YOU
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Countdown Number */}
        <div className="flex flex-col items-center justify-center my-2">
          <span className={`text-7xl font-black font-mono text-transparent bg-clip-text animate-in zoom-in-50 duration-200 ${
            isDark
              ? 'bg-gradient-to-b from-white via-white to-zinc-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]'
              : 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-600 drop-shadow-[0_4px_15px_rgba(0,0,0,0.15)]'
          }`}>
            {countdown > 0 ? countdown : 'DRAW!'}
          </span>
          <span className={`text-xs font-semibold mt-2 flex items-center gap-1.5 ${
            isDark ? 'text-zinc-400' : 'text-slate-500'
          }`}>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            {isDrawer ? 'Get ready to sketch your word!' : 'Keep your eyes on the canvas!'}
          </span>
        </div>
      </div>
    </div>
  );
};
