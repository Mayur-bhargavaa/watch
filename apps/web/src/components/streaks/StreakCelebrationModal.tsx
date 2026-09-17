'use client';

import React, { useEffect } from 'react';
import { Flame, Sparkles, X, Trophy, PartyPopper } from 'lucide-react';

interface StreakCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  friendName: string;
  streakCount: number;
  isExtended?: boolean;
}

export const StreakCelebrationModal: React.FC<StreakCelebrationModalProps> = ({
  isOpen,
  onClose,
  friendName,
  streakCount,
  isExtended = true
}) => {
  useEffect(() => {
    if (!isOpen) return;
    // Auto-dismiss after 6 seconds if not closed manually
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-center">
        {/* Glow effect */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Animated Fire Badge */}
        <div className="relative my-4 flex justify-center">
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-xl shadow-rose-600/40 animate-bounce duration-1000">
            <Flame className="w-14 h-14 fill-amber-300 text-amber-200 animate-pulse" />
            <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-amber-300 animate-spin" />
          </div>
        </div>

        {/* Title & Streak Number */}
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
          <PartyPopper className="w-3.5 h-3.5" />
          {isExtended ? 'STREAK EXTENDED!' : 'STREAK STARTED!'}
        </span>

        <h2 className="text-3xl font-black text-white tracking-tight">
          🔥 {streakCount} {streakCount === 1 ? 'DAY' : 'DAYS'}
        </h2>

        <p className="text-sm font-semibold text-rose-400 mt-1">
          with {friendName}
        </p>

        <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
          {isExtended
            ? `You kept the flame alive! Come back tomorrow to reach Day ${streakCount + 1}.`
            : `You started a new daily streak! Watch or play again tomorrow to keep the flame burning.`}
        </p>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-col gap-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition"
          >
            Keep Watching! 🔥
          </button>
        </div>
      </div>
    </div>
  );
};
