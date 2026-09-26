'use client';

import React from 'react';
import {
  ChevronLeft,
  Phone,
  Video,
  Info,
  Search,
  Users,
  Flame,
} from 'lucide-react';
import { ChatConversation, ChatUser } from '@/types/chat';

interface ConversationHeaderProps {
  conversation: ChatConversation;
  otherUser?: ChatUser;
  onBack?: () => void;
  onToggleProfile?: () => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  onOpenSearch?: () => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  otherUser,
  onBack,
  onToggleProfile,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenSearch,
}) => {
  const isGroup = conversation.type === 'group';
  const name = isGroup
    ? conversation.title || conversation.name || 'Group Chat'
    : otherUser?.displayName || otherUser?.name || conversation.title || conversation.name || 'Chat';

  const avatar = isGroup
    ? conversation.avatar || conversation.avatarUrl
    : otherUser?.avatarUrl || otherUser?.avatar || conversation.avatarUrl || conversation.avatar;

  const statusText = isGroup
    ? `${conversation.participants.length} members`
    : (otherUser?.isOnline || otherUser?.onlineStatus === 'ONLINE')
    ? 'Active now'
    : otherUser?.lastSeen
    ? `Last seen ${otherUser.lastSeen}`
    : 'Offline';

  return (
    <div className="h-16 px-3 sm:px-5 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-10 select-none">
      {/* Left: Back (mobile) + Avatar + Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Avatar & Online Dot */}
        <div
          onClick={onToggleProfile}
          className="relative cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-zinc-200 ring-2 ring-transparent group-hover:ring-[#ee1d49]/30 transition">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            ) : isGroup ? (
              <Users className="w-5 h-5 text-slate-500" />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </div>

          {!isGroup && otherUser?.isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          )}
        </div>

        {/* Title & Status */}
        <div
          onClick={onToggleProfile}
          className="min-w-0 cursor-pointer text-left"
        >
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {name}
            </h3>
            {Boolean(otherUser?.streakDays && otherUser.streakDays > 0) && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-500 px-1.5 py-0.2 rounded-full bg-amber-500/10">
                <Flame className="w-3 h-3 fill-current" />
                {otherUser?.streakDays}
              </span>
            )}
          </div>
          <p
            className={`text-xs truncate ${
              !isGroup && otherUser?.isOnline
                ? 'text-emerald-500 font-medium'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            {statusText}
          </p>
        </div>
      </div>

      {/* Right: Actions (Call, Video, Search, Profile) */}
      <div className="flex items-center gap-1 sm:gap-1.5 text-slate-600 dark:text-zinc-400">
        <button
          type="button"
          onClick={onStartVoiceCall}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          title="Voice Call"
        >
          <Phone className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onStartVideoCall}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          title="Video Call"
        >
          <Video className="w-4 h-4" />
        </button>

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleProfile}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-[#ee1d49] transition cursor-pointer"
          title="View profile & details"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
