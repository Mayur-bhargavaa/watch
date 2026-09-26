'use client';

import React from 'react';
import { Users, Clock, Crown, Sparkles, Eye, Smile } from 'lucide-react';
import { ChessPlayerInfo, ChessColor } from '@synccinema/common';

interface ChessPlayersPanelProps {
  whitePlayer: (ChessPlayerInfo & { avatarUrl?: string | null }) | null;
  blackPlayer: (ChessPlayerInfo & { avatarUrl?: string | null }) | null;
  turn: ChessColor;
  myUserId: string;
  showHints?: boolean;
  onToggleHints?: (show: boolean) => void;
  onSendReaction?: (emoji: string) => void;
  isGameOver?: boolean;
  onReview?: () => void;
}

function formatClock(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
}

export const ChessPlayersPanel: React.FC<ChessPlayersPanelProps> = ({
  whitePlayer,
  blackPlayer,
  turn,
  myUserId,
  showHints = true,
  onToggleHints,
  onSendReaction,
  isGameOver = false,
  onReview
}) => {
  const isWhiteTurn = turn === 'w';
  const isBlackTurn = turn === 'b';

  const isWhiteMe = whitePlayer?.userId === myUserId;
  const isBlackMe = blackPlayer?.userId === myUserId;

  const renderAvatar = (
    player: (ChessPlayerInfo & { avatarUrl?: string | null }) | null,
    fallbackLetter: string,
    gradient: string
  ) => {
    const rawAvatar = player?.avatarUrl;
    const avatar =
      rawAvatar && !rawAvatar.includes('bottts') && !rawAvatar.includes('dicebear')
        ? rawAvatar
        : null;

    if (avatar) {
      return (
        <img
          src={avatar}
          alt={player?.displayName || 'Player'}
          className="w-full h-full object-cover rounded-xl"
        />
      );
    }

    return (
      <div
        className={`w-full h-full rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-extrabold text-sm`}
      >
        {(player?.displayName?.[0] || fallbackLetter).toUpperCase()}
      </div>
    );
  };

  return (
    <aside className="w-full min-w-0 flex flex-col gap-3 select-none">
      {/* 1. Players Card */}
      <div className="rounded-[22px] bg-white dark:bg-[#191527] backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm p-4 flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          <Users className="w-3.5 h-3.5 text-[#ff2b70]" />
          <span>Players</span>
        </div>

        {/* White Player Row */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
            isWhiteTurn
              ? 'bg-rose-50/60 dark:bg-pink-950/30 border-[#ff2b70]/40 ring-2 ring-[#ff2b70]/15'
              : 'bg-slate-50/80 dark:bg-white/5 border-slate-200/60 dark:border-white/5'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-xs">
              {renderAvatar(whitePlayer, 'W', 'from-amber-400 to-rose-400')}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#191527]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  White {isWhiteMe ? '(You)' : ''}
                </span>
                {isWhiteMe && <Crown className="w-3 h-3 text-amber-500" />}
              </div>
              <h4 className="text-xs font-extrabold text-[#16132b] dark:text-white truncate max-w-[140px]">
                {whitePlayer?.displayName || 'Waiting...'}
              </h4>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">
                <span>♟ ELO 1200</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Online</span>
              </div>
            </div>
          </div>

          {/* White Clock */}
          <div
            className={`px-2.5 py-1.5 rounded-xl font-mono font-black text-xs flex items-center gap-1.5 border transition-all ${
              isWhiteTurn
                ? 'bg-[#16132b] dark:bg-white text-white dark:text-[#16132b] border-black dark:border-white shadow-md scale-105'
                : 'bg-white dark:bg-white/10 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-white/10'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isWhiteTurn ? 'text-[#ff2b70] animate-pulse' : 'text-slate-400 dark:text-zinc-500'}`} />
            <span>{formatClock(whitePlayer?.timeRemainingMs ?? 600000)}</span>
          </div>
        </div>

        {/* Black Player Row */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
            isBlackTurn
              ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-400/50 ring-2 ring-purple-400/20'
              : 'bg-slate-50/80 dark:bg-white/5 border-slate-200/60 dark:border-white/5'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-xs">
              {renderAvatar(blackPlayer, 'B', 'from-purple-500 to-indigo-600')}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#191527]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Black {isBlackMe ? '(You)' : ''}
                </span>
                {isBlackMe && <Crown className="w-3 h-3 text-amber-500" />}
              </div>
              <h4 className="text-xs font-extrabold text-[#16132b] dark:text-white truncate max-w-[140px]">
                {blackPlayer?.displayName || 'Waiting...'}
              </h4>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">
                <span>♚ ELO 1180</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Online</span>
              </div>
            </div>
          </div>

          {/* Black Clock */}
          <div
            className={`px-2.5 py-1.5 rounded-xl font-mono font-black text-xs flex items-center gap-1.5 border transition-all ${
              isBlackTurn
                ? 'bg-[#16132b] dark:bg-white text-white dark:text-[#16132b] border-black dark:border-white shadow-md scale-105'
                : 'bg-white dark:bg-white/10 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-white/10'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isBlackTurn ? 'text-purple-400 animate-pulse' : 'text-slate-400 dark:text-zinc-500'}`} />
            <span>{formatClock(blackPlayer?.timeRemainingMs ?? 600000)}</span>
          </div>
        </div>
      </div>

      {/* 2. Board Controls & Reactions Card */}
      <div className="rounded-[22px] bg-white dark:bg-[#191527] backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm p-4 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-[#ff2b70]" />
            <span>Board Controls</span>
          </div>

          {/* Move Hints Toggle */}
          {onToggleHints && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={showHints}
                onChange={e => onToggleHints(e.target.checked)}
                className="w-4 h-4 rounded text-[#ff2b70] focus:ring-[#ff2b70] accent-[#ff2b70] cursor-pointer"
              />
              <span>Move Hints</span>
            </label>
          )}
        </div>

        {/* Quick Cheer Emoji Strip */}
        {onSendReaction && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Smile className="w-3 h-3 text-[#ff2b70]" />
              <span>Cheer & React</span>
            </span>
            <div className="grid grid-cols-7 gap-1">
              {['❤️', '😂', '🔥', '👏', '🧠', '👑', '💀'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSendReaction(emoji)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-pink-100 dark:bg-white/5 dark:hover:bg-[#ff2b70]/30 hover:scale-110 active:scale-95 text-sm flex items-center justify-center transition cursor-pointer"
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Review Game Button */}
        {isGameOver && onReview && (
          <button
            type="button"
            onClick={onReview}
            className="w-full mt-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Eye className="w-3.5 h-3.5 text-[#ff2b70]" />
            <span>Review Completed Game</span>
          </button>
        )}
      </div>
    </aside>
  );
};
