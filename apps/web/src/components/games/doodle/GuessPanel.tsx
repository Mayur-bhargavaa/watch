'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Flame, CheckCircle2, HelpCircle } from 'lucide-react';
import { DoodleGuess } from '@synccinema/common';

interface GuessPanelProps {
  isDrawer: boolean;
  maskedWord: string;
  category?: string;
  guesses: DoodleGuess[];
  onSendGuess: (guess: string) => void;
  onRequestHint?: () => void;
  canRequestHint?: boolean;
  drawerDisplayName: string;
  guesserDisplayName: string;
  hasGuessedCorrectly?: boolean;
  disabled?: boolean;
}

export const GuessPanel: React.FC<GuessPanelProps> = ({
  isDrawer,
  maskedWord,
  category,
  guesses,
  onSendGuess,
  onRequestHint,
  canRequestHint = false,
  drawerDisplayName,
  guesserDisplayName,
  hasGuessedCorrectly = false,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll guesses to bottom
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  // Focus input for guesser
  useEffect(() => {
    if (!isDrawer && !hasGuessedCorrectly && !disabled) {
      inputRef.current?.focus();
    }
  }, [isDrawer, hasGuessedCorrectly, disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isDrawer || hasGuessedCorrectly || disabled) return;
    onSendGuess(trimmed);
    setInputValue('');
  };

  // Compute letter count from masked word
  const letterCount = maskedWord.replace(/[^A-Za-z_]/g, '').length;

  return (
    <div className="flex flex-col h-full w-full rounded-2xl bg-[#111625]/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Header: Masked Word & Category */}
      <div className="p-4 border-b border-white/10 flex flex-col items-center justify-center text-center bg-white/[0.02]">
        <div className="flex items-center gap-2 mb-2">
          {category && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-wider text-rose-400">
              {category}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400">
            {letterCount} letters
          </span>
        </div>

        {/* Masked Letter Slots */}
        <div className="flex flex-wrap items-center justify-center gap-2 my-1 select-none">
          {maskedWord.split('').map((char, index) => {
            if (char === ' ') {
              return <div key={index} className="w-3" />;
            }
            const isRevealed = char !== '_';
            return (
              <div
                key={index}
                className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg flex items-center justify-center text-lg sm:text-xl font-black transition-all ${
                  isRevealed
                    ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-in zoom-in-50'
                    : 'bg-white/5 border border-white/15 text-transparent border-b-4 border-b-white/40'
                }`}
              >
                {isRevealed ? char : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Guesses Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-[140px] max-h-[300px]">
        {guesses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6 text-zinc-500 text-xs">
            <Sparkles className="w-5 h-5 mb-1 opacity-40" />
            <span>No guesses yet</span>
            <span className="text-[10px] opacity-70">
              {isDrawer
                ? `Waiting for ${guesserDisplayName} to guess...`
                : 'Type your guess below!'}
            </span>
          </div>
        ) : (
          guesses.map(g => {
            if (g.isCorrect) {
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 animate-in zoom-in-95"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold">{g.displayName}:</span>
                    <span className="text-xs font-black uppercase tracking-wider">
                      {g.guess}
                    </span>
                  </div>
                  {g.pointsAwarded !== undefined && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      +{g.pointsAwarded} pts!
                    </span>
                  )}
                </div>
              );
            }

            if (g.isClose) {
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300"
                >
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold">{g.displayName}:</span>
                    <span className="text-xs font-medium">{g.guess}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    Close!
                  </span>
                </div>
              );
            }

            return (
              <div
                key={g.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5 text-zinc-300"
              >
                <span className="text-xs font-medium text-zinc-400">{g.displayName}:</span>
                <span className="text-xs font-semibold">{g.guess}</span>
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Input or Drawer Notice */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02]">
        {isDrawer ? (
          <div className="flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-xs font-semibold text-zinc-400">
              🎨 You are Drawing! Watch {guesserDisplayName}'s guesses appear live above.
            </span>
          </div>
        ) : hasGuessedCorrectly ? (
          <div className="flex items-center justify-center p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center text-emerald-300 font-bold text-xs">
            🎉 You guessed correctly! Waiting for round to finish...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              disabled={disabled}
              placeholder="Type your guess here..."
              maxLength={40}
              className="flex-1 bg-white/5 border border-white/15 focus:border-rose-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-all disabled:opacity-50"
            />

            {onRequestHint && canRequestHint && (
              <button
                type="button"
                onClick={onRequestHint}
                title="Ask for a letter hint"
                className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 active:scale-95 transition-all"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!inputValue.trim() || disabled}
              className="p-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
