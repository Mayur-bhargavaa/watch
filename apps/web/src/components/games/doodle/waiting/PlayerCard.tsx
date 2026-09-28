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
      <div className="relative flex-1 min-w-0 w-full min-h-[145px] sm:min-h-[195px] rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 border-2 border-dashed border-slate-300 dark:border-white/15 bg-white/40 dark:bg-white/5 backdrop-blur-xl flex flex-col items-center justify-center text-center shadow-2xs select-none transition-all">
        {/* Neutral silhouette avatar */}
        <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-16 sm:h-16 rounded-full bg-slate-200/70 dark:bg-white/10 flex items-center justify-center mb-1.5 sm:mb-2.5 text-slate-400 dark:text-zinc-500 shadow-inner">
          <User className="w-5 h-5 sm:w-8 sm:h-8" />
        </div>

        <h3 className="text-xs xs:text-sm sm:text-base font-black text-[#16132b] dark:text-white tracking-tight truncate max-w-full px-1">
          Looking for a player...
        </h3>

        <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5 truncate max-w-full px-1">
          A friend will join soon!
        </p>

        {/* Animated 3 dots */}
        <div className="flex items-center gap-1 mt-1.5 sm:mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 animate-bounce" />
        </div>
      </div>
    );
  }

  // Resolve user profile picture (filtering out generic robots)
  let rawAvatar = player.avatarUrl;
  if (!rawAvatar && isCurrentUser && typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem('synccinema_session') || '{}');
      rawAvatar = stored?.user?.avatarUrl;
    } catch {}
  }

  const hasGenericRobot = typeof rawAvatar === 'string' && rawAvatar.includes('/bottts/');
  const effectiveAvatar = hasGenericRobot ? null : rawAvatar;
  const initial = (player.displayName?.[0] || 'P').toUpperCase();

  return (
    <div
      className={`relative flex-1 min-w-0 w-full min-h-[145px] sm:min-h-[195px] rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 border backdrop-blur-2xl flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(255,43,112,0.06)] select-none transition-all ${
        isCurrentUser
          ? 'bg-gradient-to-b from-white/95 to-rose-50/50 dark:from-[#15192e]/95 dark:to-[#1a1c35]/90 border-pink-300/90 dark:border-pink-500/40 ring-1 ring-pink-300/40 dark:ring-pink-500/20'
          : 'bg-white/90 dark:bg-[#15192e]/90 border-white/70 dark:border-white/10'
      }`}
    >
      {/* Top Badge: "You" or "Opponent" */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
        {isCurrentUser ? (
          <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] text-white text-[8px] xs:text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-2xs">
            <Crown className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-300 fill-amber-300" />
            <span>You</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 text-[8px] xs:text-[9px] font-black uppercase tracking-wider">
            <span>Opponent</span>
          </span>
        )}
      </div>

      {/* Avatar Container with glowing ring */}
      <div className="relative mb-1.5 sm:mb-2 mt-1">
        <div className="w-11 h-11 xs:w-13 xs:h-13 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-[#ff2b70] to-amber-400 shadow-sm flex items-center justify-center overflow-hidden">
          {effectiveAvatar ? (
            <img
              src={effectiveAvatar}
              alt={player.displayName}
              className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-800"
              onError={e => {
                const parent = (e.currentTarget as HTMLElement).parentElement;
                if (parent) {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = parent.querySelector('.avatar-initial-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className="avatar-initial-fallback w-full h-full rounded-full bg-gradient-to-br from-[#ff2b70] via-[#f43f5e] to-amber-400 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-inner select-none"
            style={{ display: effectiveAvatar ? 'none' : 'flex' }}
          >
            {initial}
          </div>
        </div>

        {/* Ready checkmark overlay */}
        {isReady && (
          <span className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
          </span>
        )}
      </div>

      {/* Player Display Name */}
      <h3 className="text-xs xs:text-sm sm:text-base font-black text-[#16132b] dark:text-white tracking-tight truncate max-w-full px-1">
        {player.displayName || 'Duelist'}
      </h3>

      {/* Role Badge */}
      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-zinc-400">
        {isHost ? (
          <span className="flex items-center gap-1 text-amber-500 font-extrabold">
            <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-500 text-amber-500" /> Host
          </span>
        ) : (
          <span>Player</span>
        )}
      </div>

      {/* Live Status or Ready Toggle */}
      <div className="mt-1 sm:mt-1.5 w-full">
        {canToggleReady ? (
          <button
            type="button"
            onClick={onToggleReady}
            className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-2xs cursor-pointer ${
              isReady
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] hover:brightness-110 text-white'
            }`}
          >
            {isReady ? '✓ Ready' : 'Ready Up!'}
          </button>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate max-w-full px-1">
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
