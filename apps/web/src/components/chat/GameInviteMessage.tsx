'use client';

import React from 'react';
import Link from 'next/link';
import { Gamepad2, Users, Play, Crown } from 'lucide-react';
import { ChatGamePayload } from '@/types/chat';

interface GameInviteMessageProps {
  game: ChatGamePayload;
  isSender: boolean;
}

const GAME_INFO: Record<string, { label: string; iconEmoji: string; gradient: string }> = {
  ludo: { label: 'Ludo Match', iconEmoji: '🎲', gradient: 'from-amber-500/15 to-orange-500/15 text-amber-500' },
  chess: { label: 'Chess Duel', iconEmoji: '♟️', gradient: 'from-indigo-500/15 to-purple-500/15 text-indigo-500' },
  bingo: { label: 'Bingo Party', iconEmoji: '🔢', gradient: 'from-emerald-500/15 to-teal-500/15 text-emerald-500' },
  trivia: { label: 'Trivia Quiz', iconEmoji: '💡', gradient: 'from-blue-500/15 to-cyan-500/15 text-blue-500' },
  doodle: { label: 'Doodle Duel', iconEmoji: '🎨', gradient: 'from-pink-500/15 to-rose-500/15 text-pink-500' },
  tictactoe: { label: 'Tic-Tac-Toe', iconEmoji: '⭕', gradient: 'from-violet-500/15 to-fuchsia-500/15 text-violet-500' },
};

export const GameInviteMessage: React.FC<GameInviteMessageProps> = ({ game, isSender }) => {
  const meta = GAME_INFO[game.gameType.toLowerCase()] || {
    label: `${game.gameType} Game`,
    iconEmoji: '🎮',
    gradient: 'from-rose-500/15 to-pink-500/15 text-[#ee1d49]',
  };

  const targetUrl = game.roomId
    ? `/games/${game.gameType.toLowerCase()}?room=${encodeURIComponent(game.roomId)}`
    : `/games/${game.gameType.toLowerCase()}`;

  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all duration-200 shadow-xs max-w-sm w-full ${
        isSender
          ? 'bg-amber-950/20 dark:bg-amber-950/30 border-amber-300/40 dark:border-amber-800/40 text-slate-900 dark:text-zinc-100'
          : 'bg-white dark:bg-zinc-900/90 border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-zinc-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-linear-to-r ${meta.gradient} text-[11px] font-bold uppercase tracking-wider`}>
          <span className="text-xs">{meta.iconEmoji}</span>
          <span>{meta.label}</span>
        </div>
        <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 capitalize px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800">
          {game.status || 'Waiting'}
        </span>
      </div>

      {/* Game Title */}
      <h4 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white mb-1.5 line-clamp-1">
        {game.title || `${meta.label} with Friends`}
      </h4>

      {/* Metadata Info */}
      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400 mb-3">
        {game.hostName && (
          <div className="flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span className="truncate">Host: {game.hostName}</span>
          </div>
        )}
        {game.playersCount !== undefined && (
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {game.playersCount}
              {game.maxPlayers ? `/${game.maxPlayers}` : ''} players
            </span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <Link
        href={targetUrl}
        className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Join Game</span>
      </Link>
    </div>
  );
};
