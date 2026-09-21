'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  Phone,
  Video,
  Film,
  Gamepad2,
  Calendar,
  Flame,
  User,
  ShieldAlert,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ChatUser, ChatConversation } from '@/types/chat';

interface FriendProfileSheetProps {
  conversation: ChatConversation;
  user?: ChatUser;
  onClose: () => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  onOpenCreatePlan?: () => void;
  onOpenInviteGame?: () => void;
}

export const FriendProfileSheet: React.FC<FriendProfileSheetProps> = ({
  conversation,
  user,
  onClose,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenCreatePlan,
  onOpenInviteGame,
}) => {
  const isGroup = conversation.type === 'group';
  const name = isGroup ? conversation.title || 'Group' : user?.name || 'Friend';
  const avatar = isGroup ? conversation.avatar : user?.avatar;
  const username = user?.username ? `@${user.username}` : undefined;

  return (
    <div className="w-80 h-full border-l border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-right-2 duration-200 z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          {isGroup ? 'Group Info' : 'Contact Details'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hero Avatar & Name */}
      <div className="p-6 flex flex-col items-center text-center border-b border-slate-200/60 dark:border-zinc-800/60">
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-2xl text-slate-700 dark:text-zinc-200 ring-4 ring-[#ee1d49]/10">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </div>
          {!isGroup && user?.isOnline && (
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          )}
        </div>

        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">
          {name}
        </h2>
        {username && (
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-2">{username}</p>
        )}

        <div className="flex items-center gap-1.5 text-xs">
          {user?.isOnline ? (
            <span className="text-emerald-500 font-semibold">Active now</span>
          ) : (
            <span className="text-slate-400 dark:text-zinc-500">
              {user?.lastSeen ? `Last seen ${user.lastSeen}` : 'Offline'}
            </span>
          )}
        </div>

        {/* Streak Pill */}
        {user?.streakDays && user.streakDays > 0 ? (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-linear-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold shadow-2xs">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{user.streakDays} Day Streak! 🔥</span>
          </div>
        ) : null}

        {/* Quick Call Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={onStartVoiceCall}
            className="flex flex-col items-center gap-1 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-zinc-300 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-800 dark:text-white">
              <Phone className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold">Audio</span>
          </button>

          <button
            type="button"
            onClick={onStartVideoCall}
            className="flex flex-col items-center gap-1 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-zinc-300 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#ee1d49]/10 text-[#ee1d49] flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold">Video</span>
          </button>
        </div>
      </div>

      {/* Shared Stats */}
      <div className="p-4 border-b border-slate-200/60 dark:border-zinc-800/60">
        <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
          Shared Together
        </h4>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
            <Film className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
            <div className="text-base font-bold text-slate-800 dark:text-zinc-100">
              {user?.sharedStats?.moviesWatched ?? 12}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              Movies
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
            <Gamepad2 className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <div className="text-base font-bold text-slate-800 dark:text-zinc-100">
              {user?.sharedStats?.gamesPlayed ?? 8}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              Games
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
            <Calendar className="w-4 h-4 text-[#ee1d49] mx-auto mb-1" />
            <div className="text-base font-bold text-slate-800 dark:text-zinc-100">
              {user?.sharedStats?.plansCompleted ?? 5}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              Plans
            </div>
          </div>
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div className="p-4 space-y-1.5">
        <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
          Actions
        </h4>

        {onOpenCreatePlan && (
          <button
            type="button"
            onClick={onOpenCreatePlan}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
              <Calendar className="w-4 h-4 text-[#ee1d49]" />
              <span>Plan Next Watch Night</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {onOpenInviteGame && (
          <button
            type="button"
            onClick={onOpenInviteGame}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
              <Gamepad2 className="w-4 h-4 text-amber-500" />
              <span>Play Ludo or Chess</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <Link
          href="/friends"
          className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
            <User className="w-4 h-4 text-slate-500" />
            <span>View Friends Page</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>
      </div>
    </div>
  );
};
