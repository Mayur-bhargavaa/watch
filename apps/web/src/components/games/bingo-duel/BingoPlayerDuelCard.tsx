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
      className={`rounded-2xl p-2.5 sm:p-3 border transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
        isTurn
          ? 'bg-gradient-to-br from-[#2a1320] via-[#200f1a] to-[#160b13] border-[#ff6b8b] shadow-[0_8px_20px_rgba(255,107,139,0.25)] ring-2 ring-[#ff6b8b]/60 scale-[1.01]'
          : isMe
          ? 'bg-gradient-to-br from-[#22101b]/90 to-[#140a12]/90 border-rose-500/25 shadow-md'
          : 'bg-[#180c15]/80 border-white/10 shadow-sm'
      }`}
    >
      {/* Top row: Avatar + Player info + Turn Pill */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar with soft ring */}
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 p-0.5 overflow-hidden shrink-0 transition-transform ${
              isTurn
                ? 'border-[#ff6b8b] ring-2 ring-[#ff6b8b]/30 scale-105'
                : isMe
                ? 'border-rose-400/80'
                : 'border-pink-400/50'
            }`}
          >
            {avatarUrl && !avatarUrl.includes('dicebear') && !avatarUrl.includes('bottts') ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover rounded-lg bg-slate-950"
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-extrabold text-xs">
                {(displayName?.[0] || 'P').toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[100px] sm:max-w-[130px]">
                {displayName}
              </span>
              {isMe && (
                <span className="px-1 py-0.2 rounded text-[8px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  YOU
                </span>
              )}
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
              <span>Marked:</span>
              <span className="font-bold text-white">{marksCount}/25</span>
            </div>
          </div>
        </div>

        {/* Right indicator: Turn Badge or Series Score */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {isTurn && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-gradient-to-r from-[#ff4d79] to-[#ff758c] text-white shadow-[0_2px_8px_rgba(255,77,121,0.5)] animate-pulse flex items-center gap-1">
              <Sparkles className="w-2 h-2" />
              <span>Turn</span>
            </span>
          )}

          {targetRounds > 1 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: targetRounds }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < roundsWon
                      ? 'bg-amber-400 shadow-xs shadow-amber-400/50 scale-110'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Pattern Status */}
      <div className="space-y-0.5 pt-1 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span className="text-zinc-400 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-[#ff758c]" />
            <span>5 Lines</span>
          </span>
          <span className={isTurn ? 'text-[#ff8ca1] font-bold' : isMe ? 'text-rose-300' : 'text-zinc-300'}>
            {currentProgress}/5 ({percent}%)
          </span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/10">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#ff4d79] via-[#ff758c] to-[#ffa3b1]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
