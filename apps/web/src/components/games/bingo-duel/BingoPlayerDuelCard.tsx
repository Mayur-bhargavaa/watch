'use client';

import React from 'react';
import { Trophy, Flame, UserCheck, Zap } from 'lucide-react';
import { BingoDuelPatternProgress } from '@synccinema/common';

interface BingoPlayerDuelCardProps {
  displayName: string;
  avatarUrl?: string | null;
  userId: string;
  isMe: boolean;
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
      className={`rounded-3xl p-3 sm:p-4 border transition-all ${
        isMe
          ? 'bg-gradient-to-br from-indigo-950/70 via-slate-900/80 to-purple-950/70 border-indigo-500/40 shadow-xl'
          : 'bg-slate-900/60 border-white/10 shadow-lg'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border-2 p-0.5 overflow-hidden flex-shrink-0 ${
              isMe ? 'border-indigo-400' : 'border-pink-400'
            }`}
          >
            <img
              src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}
              alt={displayName}
              className="w-full h-full object-cover rounded-xl bg-slate-950"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[100px] sm:max-w-[130px]">
                {displayName}
              </span>
              {isMe && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-500/30">
                  YOU
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Marked:</span>
              <span className="font-semibold text-white">{marksCount}/25</span>
            </div>
          </div>
        </div>

        {/* Series Score (Best of 3 / 5) */}
        {targetRounds > 1 && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400">Wins</span>
            <div className="flex items-center gap-1 mt-0.5">
              {Array.from({ length: targetRounds }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < roundsWon ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pattern Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Pattern Progress</span>
          </span>
          <span className={isMe ? 'text-indigo-300' : 'text-pink-300'}>
            {currentProgress}/{totalProgress} ({percent}%)
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isMe
                ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                : 'bg-gradient-to-r from-pink-500 to-rose-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
