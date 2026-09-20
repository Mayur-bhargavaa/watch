'use client';

import React from 'react';
import { Sparkles, Brain, Clock, Palette } from 'lucide-react';
import { DoodleWordChoice } from '@synccinema/common';

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
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0f1424] border border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />

        {/* Top Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Timer Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-300 mb-4">
          <Clock className="w-3.5 h-3.5 text-rose-400" />
          <span>{timeLeft}s to choose</span>
        </div>

        {isDrawer ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center mb-3">
              <Palette className="w-7 h-7 text-rose-400" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">
              Choose What to Draw
            </h2>
            <p className="text-xs text-zinc-400 mb-6 max-w-sm">
              Pick one secret word. {guesserDisplayName} will have 60s to guess it from your doodle!
            </p>

            {/* Word Choices */}
            <div className="w-full flex flex-col gap-3">
              {wordChoices.map((choice, idx) => {
                const difficultyColors: Record<string, string> = {
                  easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                  hard: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                  mixed: 'bg-violet-500/10 text-violet-400 border-violet-500/30'
                };

                return (
                  <button
                    key={choice.word}
                    type="button"
                    onClick={() => onChooseWord(choice.word)}
                    className="group relative w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-rose-500/50 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] text-left shadow-lg"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-lg font-black text-white group-hover:text-rose-400 transition-colors">
                        {choice.word}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400">
                        {choice.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          difficultyColors[choice.difficulty] || difficultyColors.easy
                        }`}
                      >
                        {choice.difficulty}
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-500 group-hover:text-white transition-colors">
                        Choice {idx + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center mb-3">
              <Brain className="w-7 h-7 text-violet-400 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">
              {drawerDisplayName} is Choosing
            </h2>
            <p className="text-xs text-zinc-400 mb-6 max-w-sm">
              They are picking a secret word right now. Put your guessing glasses on!
            </p>

            <div className="w-full p-6 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col items-center gap-3">
              <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-3 h-3 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-3 h-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-bold text-zinc-300">
                Round starting in {timeLeft} seconds...
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
