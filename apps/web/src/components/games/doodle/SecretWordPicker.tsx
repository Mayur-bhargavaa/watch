'use client';

import React from 'react';
import { Sparkles, Brain, Clock, Palette, Lightbulb } from 'lucide-react';
import { DoodleWordChoice } from '@synccinema/common';
import { useTheme } from '../../../context/ThemeContext';

interface SecretWordPickerProps {
  isDrawer: boolean;
  wordChoices?: DoodleWordChoice[];
  drawerDisplayName: string;
  guesserDisplayName: string;
  timeLeft: number;
  totalTime?: number;
  onChooseWord: (word: string) => void;
}

export const SecretWordPicker: React.FC<SecretWordPickerProps> = ({
  isDrawer,
  wordChoices = [],
  drawerDisplayName,
  guesserDisplayName,
  timeLeft,
  totalTime = 15,
  onChooseWord
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const [customWord, setCustomWord] = React.useState('');

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));

  const normalizedChoices = (wordChoices || []).map((choice: any) => {
    if (typeof choice === 'string') {
      const raw = choice.replace(/^[^\w\s]+\s*/, '').trim();
      return {
        word: choice,
        rawWord: raw || choice,
        category: 'General',
        difficulty: 'easy' as const
      };
    }
    return {
      word: choice.word || '',
      rawWord: (choice.word || '').replace(/^[^\w\s]+\s*/, '').trim(),
      category: choice.category || 'General',
      difficulty: choice.difficulty || 'easy'
    };
  });

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-200 select-none ${
      isDark ? 'bg-black/75' : 'bg-slate-900/35'
    }`}>
      <div className={`relative w-full max-w-lg rounded-3xl border p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden transition-all duration-300 ${
        isDark
          ? 'bg-[#0f1424]/95 border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(255,43,94,0.12)] text-white'
          : 'bg-white/95 border-slate-200/90 shadow-[0_25px_70px_rgba(0,0,0,0.12),0_0_30px_rgba(244,63,94,0.08)] text-slate-900'
      }`}>
        {/* Glow ambient background circles */}
        <div className={`absolute -top-24 -left-24 w-60 h-60 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-rose-500/15' : 'bg-rose-400/15'
        }`} />
        <div className={`absolute -bottom-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-violet-500/15' : 'bg-violet-400/15'
        }`} />

        {/* Top Animated Progress Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
          isDark ? 'bg-white/5' : 'bg-slate-100'
        }`}>
          <div
            className="h-full bg-gradient-to-r from-[#ff2b5e] to-violet-500 transition-all duration-300 rounded-r-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Dynamic Timer Badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold mb-4 shadow-sm ${
          isDark
            ? 'bg-white/5 border-white/10 text-zinc-300'
            : 'bg-slate-100 border-slate-200 text-slate-700'
        }`}>
          <Clock className="w-3.5 h-3.5 text-[#ff2b5e]" />
          <span>{timeLeft}s to choose</span>
        </div>

        {isDrawer ? (
          <>
            {/* Drawer Active Icon & Header */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff2b5e]/20 to-pink-500/20 border border-[#ff2b5e]/30 flex items-center justify-center mb-3 shadow-inner">
              <Palette className="w-7 h-7 text-[#ff2b5e]" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-[#ff2b5e] mb-1">
              Your Turn to Draw 🎨
            </span>

            <h2 className={`text-2xl font-black tracking-tight mb-1.5 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Choose What to Draw
            </h2>
            <p className={`text-xs max-w-sm mb-6 ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              Pick a secret word. <span className="font-bold text-[#ff2b5e]">{guesserDisplayName}</span> will have 60 seconds to guess your sketch!
            </p>

            {/* Word Choices Grid */}
            <div className="w-full flex flex-col gap-3">
              {normalizedChoices.map((choice, idx) => {
                const difficultyColors: Record<string, string> = {
                  easy: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  medium: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
                  hard: isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200',
                  mixed: isDark ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' : 'bg-violet-50 text-violet-700 border-violet-200'
                };

                return (
                  <button
                    key={`${choice.word}_${idx}`}
                    type="button"
                    onClick={() => onChooseWord(choice.rawWord || choice.word)}
                    className={`group relative w-full flex items-center justify-between p-4 rounded-2xl border transition-all transform hover:-translate-y-0.5 active:scale-[0.98] text-left shadow-sm cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 hover:border-[#ff2b5e]/50'
                        : 'bg-slate-50/80 hover:bg-rose-50/40 border-slate-200 hover:border-[#ff2b5e]/40'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-lg font-black transition-colors ${
                        isDark ? 'text-white group-hover:text-[#ff2b5e]' : 'text-slate-900 group-hover:text-[#ff2b5e]'
                      }`}>
                        {choice.word}
                      </span>
                      <span className={`text-[11px] font-semibold ${
                        isDark ? 'text-zinc-400' : 'text-slate-500'
                      }`}>
                        {choice.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          difficultyColors[choice.difficulty] || difficultyColors.easy
                        }`}
                      >
                        {choice.difficulty}
                      </span>
                      <span className={`text-xs font-mono font-bold transition-colors ${
                        isDark ? 'text-zinc-500 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-800'
                      }`}>
                        Choice {idx + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Divider or custom input */}
            <div className="w-full flex items-center gap-3 my-3">
              <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                Or draw anything you want
              </span>
              <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>

            {/* Custom word/phrase input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customWord.trim()) {
                  onChooseWord(customWord.trim());
                }
              }}
              className="w-full flex items-center gap-2"
            >
              <input
                type="text"
                value={customWord}
                onChange={(e) => setCustomWord(e.target.value)}
                placeholder="Enter any drawing idea (e.g. Castle, Coffee cup...)"
                maxLength={40}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-[#ff3864]'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#ff3864]'
                }`}
              />
              <button
                type="submit"
                disabled={!customWord.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff3864] to-[#f43f5e] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Draw This 🎨
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Guesser Waiting State */}
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center shadow-inner">
                <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-violet-500 border-2 border-white dark:border-[#0f1424]" />
              </span>
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 mb-1">
              Guesser Waiting Room 🧠
            </span>

            <h2 className={`text-2xl font-black tracking-tight mb-1.5 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {drawerDisplayName} is Choosing
            </h2>
            <p className={`text-xs max-w-sm mb-5 leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              They are selecting a secret word right now. Put on your guessing glasses and get ready!
            </p>

            {/* Clean Status Pill with Real-time Count */}
            <div className={`w-full p-5 rounded-2xl border flex flex-col items-center gap-3 shadow-inner ${
              isDark
                ? 'bg-white/[0.02] border-white/10'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff2b5e] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black tracking-wide ${
                  isDark ? 'text-zinc-200' : 'text-slate-700'
                }`}>
                  Round starting in <span className="text-[#ff2b5e] font-mono text-sm">{timeLeft}s</span>...
                </span>
              </div>
            </div>

            {/* Quick Scoring Tip */}
            <div className={`mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Faster correct guesses earn up to 100 points!</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
