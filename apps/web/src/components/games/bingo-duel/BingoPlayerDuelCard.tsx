'use client';

import React from 'react';
import { Trophy, Flame, UserCheck, Zap, Sparkles } from 'lucide-react';
import { BingoDuelPatternProgress } from '@synccinema/common';

interface BingoPlayerDuelCardProps {
  displayName: string;
  avatarUrl?: string | null;
  userId: string;
  isMe: boolean;
  isTurn?: boolean;
  marksCount: number; // e.g. 12/25
  progress?: BingoDuelPatternProgress;
  roundsWon: number;
  targetRounds: number;
  isHost?: boolean;
}

export const BingoPlayerDuelCard: React.FC<BingoPlayerDuelCardProps> = ({
  displayName,
  avatarUrl,
  userId,
  isMe,
  isTurn = false,
  marksCount,
  progress,
  roundsWon,
  targetRounds,
  isHost
}) => {
  const currentProgress = progress?.current || 0;
  const totalProgress = progress?.total || 5;
  const percent = Math.min(100, Math.round((currentProgress / totalProgress) * 100));

  return (
    <div
      className={`rounded-3xl p-3.5 sm:p-4 border transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
        isTurn
          ? 'bg-gradient-to-br from-[#2a1320] via-[#200f1a] to-[#160b13] border-[#ff6b8b] shadow-[0_10px_30px_rgba(255,107,139,0.25)] ring-2 ring-[#ff6b8b]/60 scale-[1.02]'
          : isMe
          ? 'bg-gradient-to-br from-[#22101b]/90 to-[#140a12]/90 border-rose-500/25 shadow-lg'
          : 'bg-[#180c15]/80 border-white/10 shadow-md'
      }`}
    >
      {/* Top row: Avatar + Player info + Turn Pill */}
      <div className="flex items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with soft ring */}
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 p-0.5 overflow-hidden shrink-0 transition-transform ${
              isTurn
                ? 'border-[#ff6b8b] ring-4 ring-[#ff6b8b]/30 scale-105'
                : isMe
                ? 'border-rose-400/80'
                : 'border-pink-400/50'
            }`}
          >
            <img
              src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}
              alt={displayName}
              className="w-full h-full object-cover rounded-xl bg-slate-950"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[110px] sm:max-w-[140px]">
                {displayName}
              </span>
              {isMe && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  YOU
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
              <span>Marked:</span>
              <span className="font-bold text-white">{marksCount}/25</span>
            </div>
          </div>
        </div>

        {/* Right indicator: Turn Badge or Series Score */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isTurn && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-[#ff4d79] to-[#ff758c] text-white shadow-[0_4px_12px_rgba(255,77,121,0.5)] animate-pulse flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Turn</span>
            </span>
          )}

          {targetRounds > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: targetRounds }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < roundsWon
                      ? 'bg-amber-400 shadow-sm shadow-amber-400/50 scale-110'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Pattern Status */}
      <div className="space-y-1 pt-1 border-t border-white/5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-zinc-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#ff758c]" />
            <span>5 Lines Progress</span>
          </span>
          <span className={isTurn ? 'text-[#ff8ca1] font-bold' : isMe ? 'text-rose-300' : 'text-zinc-300'}>
            {currentProgress}/5 Lines ({percent}%)
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/10">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#ff4d79] via-[#ff758c] to-[#ffa3b1]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
