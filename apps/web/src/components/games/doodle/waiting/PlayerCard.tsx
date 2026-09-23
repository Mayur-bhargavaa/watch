'use client';

import React from 'react';
import { User, Crown, Check, Sparkles } from 'lucide-react';
import { GameRoomPlayer } from '@synccinema/common';

interface PlayerCardProps {
  isCurrentUser: boolean;
  player?: any;
  isHost: boolean;
  isReady?: boolean;
  canToggleReady?: boolean;
  onToggleReady?: () => void;
  statusText?: string;
  isDark?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  isCurrentUser,
  player,
  isHost,
  isReady = false,
  canToggleReady = false,
  onToggleReady,
  statusText,
  isDark = false
}) => {
  // Empty Opponent Card State
  if (!player) {
    return (
      <div className="relative flex-1 w-full min-h-[175px] sm:min-h-[195px] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border-2 border-dashed border-slate-300 dark:border-white/15 bg-white/40 dark:bg-white/5 backdrop-blur-xl flex flex-col items-center justify-center text-center shadow-2xs select-none transition-all">
        {/* Neutral silhouette avatar */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-200/70 dark:bg-white/10 flex items-center justify-center mb-2.5 text-slate-400 dark:text-zinc-500 shadow-inner">
          <User className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>

        <h3 className="text-sm sm:text-base font-black text-[#16132b] dark:text-white tracking-tight">
          Looking for a player...
        </h3>

        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
          A friend will join soon!
        </p>

        {/* Animated 3 dots */}
        <div className="flex items-center gap-1 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 animate-bounce" />
        </div>
      </div>
    );
  }

  const avatarUrl =
    player.avatarUrl ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.displayName || player.userId)}`;

  return (
    <div
      className={`relative flex-1 w-full min-h-[175px] sm:min-h-[195px] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border backdrop-blur-2xl flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(255,43,112,0.06)] select-none transition-all ${
        isCurrentUser
          ? 'bg-gradient-to-b from-white/95 to-rose-50/50 dark:from-[#15192e]/95 dark:to-[#1a1c35]/90 border-pink-300/90 dark:border-pink-500/40 ring-1 ring-pink-300/40 dark:ring-pink-500/20'
          : 'bg-white/90 dark:bg-[#15192e]/90 border-white/70 dark:border-white/10'
      }`}
    >
      {/* Top Badge: "You" or "Opponent" */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3">
        {isCurrentUser ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] text-white text-[10px] font-black uppercase tracking-wider shadow-2xs">
            <Crown className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
            <span>You</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 text-[9px] font-black uppercase tracking-wider">
            <span>Opponent</span>
          </span>
        )}
      </div>

      {/* Avatar Container with glowing ring */}
      <div className="relative mb-2 mt-1">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-[#ff2b70] to-amber-400 shadow-sm flex items-center justify-center">
          <img
            src={avatarUrl}
            alt={player.displayName}
            className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-800"
            onError={e => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Ready checkmark overlay */}
        {isReady && (
          <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
            <Check className="w-3 h-3 stroke-[3]" />
          </span>
        )}
      </div>

      {/* Player Display Name */}
      <h3 className="text-sm sm:text-base font-black text-[#16132b] dark:text-white tracking-tight truncate max-w-[170px]">
        {player.displayName || 'Duelist'}
      </h3>

      {/* Role Badge */}
      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
        {isHost ? (
          <span className="flex items-center gap-1 text-amber-500 font-extrabold">
            <Crown className="w-3 h-3 fill-amber-500 text-amber-500" /> Host
          </span>
        ) : (
          <span>Player</span>
        )}
      </div>

      {/* Live Status or Ready Toggle */}
      <div className="mt-1.5">
        {canToggleReady ? (
          <button
            type="button"
            onClick={onToggleReady}
            className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-2xs cursor-pointer ${
              isReady
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] hover:brightness-110 text-white'
            }`}
          >
            {isReady ? '✓ Ready' : 'Ready Up!'}
          </button>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              {statusText || (isReady ? 'Ready to play' : 'Waiting for opponent...')}
            </span>
            {!isReady && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1 h-1 rounded-full bg-[#ff2b70] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-[#ff2b70] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-[#ff2b70] animate-bounce" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
