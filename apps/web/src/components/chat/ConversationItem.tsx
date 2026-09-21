'use client';

import React from 'react';
import { Users, Flame, Mic, Film, Gamepad2, Image as ImageIcon } from 'lucide-react';
import { ChatConversation, ChatUser } from '@/types/chat';

interface ConversationItemProps {
  conversation: ChatConversation;
  isSelected: boolean;
  onSelect: (conv: ChatConversation) => void;
  otherUser?: ChatUser;
}

function formatConversationTime(timestamp: number | string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
  otherUser,
}) => {
  const isGroup = conversation.type === 'group';
  const name = isGroup
    ? conversation.title || 'Group Chat'
    : otherUser?.name || conversation.title || 'Chat';

  const avatar = isGroup
    ? conversation.avatar
    : otherUser?.avatar || conversation.avatar;

  const isOnline = !isGroup && otherUser?.isOnline;
  const streak = !isGroup ? otherUser?.streakDays : undefined;

  const lastMsg = conversation.lastMessage;

  // Render rich preview snippet
  const renderPreview = () => {
    if (!lastMsg) return <span className="italic">No messages yet</span>;

    if (lastMsg.type === 'voice') {
      return (
        <span className="flex items-center gap-1">
          <Mic className="w-3.5 h-3.5 text-[#ee1d49]" />
          <span>Voice message</span>
        </span>
      );
    }
    if (lastMsg.type === 'plan') {
      return (
        <span className="flex items-center gap-1 text-[#ee1d49] font-medium">
          <Film className="w-3.5 h-3.5" />
          <span>{lastMsg.metadata?.plan?.title || 'Watch Plan'}</span>
        </span>
      );
    }
    if (lastMsg.type === 'game_invite') {
      return (
        <span className="flex items-center gap-1 text-amber-500 font-medium">
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>Game Invitation</span>
        </span>
      );
    }
    if (lastMsg.type === 'movie_share') {
      return (
        <span className="flex items-center gap-1 text-indigo-500 font-medium">
          <Film className="w-3.5 h-3.5" />
          <span>{lastMsg.metadata?.movie?.title || 'Shared movie'}</span>
        </span>
      );
    }
    if (lastMsg.mediaUrl) {
      return (
        <span className="flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Photo</span>
        </span>
      );
    }
    return lastMsg.content;
  };

  return (
    <div
      onClick={() => onSelect(conversation)}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition duration-150 cursor-pointer text-left select-none relative group ${
        isSelected
          ? 'bg-slate-100 dark:bg-zinc-800/90 shadow-2xs'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
      }`}
    >
      {/* Avatar Container with Online Indicator */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-zinc-200">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : isGroup ? (
            <Users className="w-5 h-5 text-slate-500" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </div>

        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4
              className={`text-sm font-semibold truncate ${
                isSelected
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-800 dark:text-zinc-200'
              }`}
            >
              {name}
            </h4>
            {streak && streak > 0 ? (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 shrink-0">
                <Flame className="w-3 h-3 fill-current" />
                {streak}
              </span>
            ) : null}
          </div>

          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 shrink-0">
            {formatConversationTime(conversation.updatedAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <p className="truncate text-slate-500 dark:text-zinc-400 leading-snug">
            {renderPreview()}
          </p>

          {conversation.unreadCount > 0 && (
            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#ee1d49] text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
