'use client';

import React, { useState, useRef } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Smile,
  Reply,
  Copy,
  Share2,
  Trash2,
  Pin,
  MoreHorizontal,
} from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { VoiceMessage } from './VoiceMessage';
import { PlanMessage } from './PlanMessage';
import { GameInviteMessage } from './GameInviteMessage';
import { MovieShareMessage } from './MovieShareMessage';
import { ReactionPicker } from './ReactionPicker';
import { parseStickerMessage } from './StickersData';

interface MessageBubbleProps {
  message: ChatMessage;
  isSender: boolean;
  showAvatar?: boolean;
  currentUserId: string;
  onReply?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onJumpToReply?: (replyId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSender,
  showAvatar = true,
  currentUserId,
  onReply,
  onReact,
  onDelete,
  onPin,
  onJumpToReply,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sticker = parseStickerMessage(message.content);

  // Group reactions
  const reactionGroups: { emoji: string; count: number; userIds: string[] }[] = [];
  (message.reactions || []).forEach((r) => {
    const existing = reactionGroups.find((g) => g.emoji === r.emoji);
    if (existing) {
      existing.count += (r.count || r.userIds?.length || 1);
      if (r.userIds) {
        r.userIds.forEach(uid => {
          if (!existing.userIds.includes(uid)) existing.userIds.push(uid);
        });
      }
    } else {
      reactionGroups.push({
        emoji: r.emoji,
        count: r.count || r.userIds?.length || 1,
        userIds: [...(r.userIds || [])],
      });
    }
  });

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setShowActionMenu(false);
  };

  return (
    <div
      ref={bubbleRef}
      id={`msg-${message.id}`}
      className={`group relative flex gap-2.5 my-1.5 px-3 sm:px-4 ${
        isSender ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Receiver Avatar */}
      {!isSender && (
        <div className="w-8 h-8 rounded-full shrink-0 self-end mb-1 overflow-hidden bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center font-bold text-xs">
          {showAvatar ? (
            message.senderAvatar ? (
              <img
                src={message.senderAvatar}
                alt={message.senderName}
                className="w-full h-full object-cover"
              />
            ) : (
              message.senderName.slice(0, 1).toUpperCase()
            )
          ) : (
            <span className="w-8" />
          )}
        </div>
      )}

      {/* Bubble Container */}
      <div className={`relative max-w-[85%] sm:max-w-[70%] flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
        {/* Pinned indicator */}
        {message.isPinned && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 mb-1 px-1">
            <Pin className="w-3 h-3 fill-current" />
            <span>Pinned</span>
          </div>
        )}

        {/* Sender Name in group / unread contexts */}
        {!isSender && showAvatar && (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5 px-1">
            {message.senderName}
          </span>
        )}

        {/* Reply Quote Bubble */}
        {message.replyTo && (
          <button
            type="button"
            onClick={() => onJumpToReply && onJumpToReply(message.replyTo!.id)}
            className={`text-left text-xs mb-1 px-3 py-1.5 rounded-xl border-l-3 transition-opacity hover:opacity-90 max-w-full truncate cursor-pointer ${
              isSender
                ? 'bg-rose-950/20 border-[#ee1d49] text-rose-200'
                : 'bg-slate-100 dark:bg-zinc-800 border-slate-400 dark:border-zinc-500 text-slate-700 dark:text-zinc-300'
            }`}
          >
            <div className="font-bold text-[10px] text-[#ee1d49] truncate">
              {message.replyTo.senderName}
            </div>
            <div className="text-[11px] truncate opacity-90">
              {message.replyTo.content}
            </div>
          </button>
        )}

        {/* Main Content Bubble */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl shadow-2xs transition-all ${
            isSender
              ? 'bg-[#ee1d49] text-white rounded-br-xs'
              : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-100 dark:border-zinc-700/60 rounded-bl-xs'
          }`}
        >
          {/* Sticker display */}
          {sticker ? (
            <div className="py-1">
              <span className="text-5xl">{sticker.emoji}</span>
            </div>
          ) : message.type === 'voice' && message.metadata?.voice ? (
            /* Voice Note */
            <VoiceMessage voice={message.metadata.voice} isSender={isSender} />
          ) : message.type === 'plan' && message.metadata?.plan ? (
            /* Plan Card */
            <PlanMessage plan={message.metadata.plan} isSender={isSender} />
          ) : (message.type === 'game_invite' || message.type === 'game') && message.metadata?.game ? (
            /* Game Invite Card */
            <GameInviteMessage game={message.metadata.game} isSender={isSender} />
          ) : (message.type === 'movie_share' || message.type === 'movie') && message.metadata?.movie ? (
            /* Movie Share Card */
            <MovieShareMessage movie={message.metadata.movie} isSender={isSender} />
          ) : (
            /* Standard Text / Image */
            <div>
              {message.mediaUrl && (
                <div className="mb-2 rounded-xl overflow-hidden max-h-72">
                  <img
                    src={message.mediaUrl}
                    alt="Media"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {message.content && (
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {message.content}
                </p>
              )}
            </div>
          )}

          {/* Timestamp & Status Checkmarks */}
          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-medium select-none ${
              isSender ? 'text-white/70' : 'text-slate-400 dark:text-zinc-500'
            }`}
          >
            <span>{formattedTime}</span>
            {isSender && (
              <span className="inline-flex">
                {message.status === 'sending' ? (
                  <Clock className="w-3 h-3 text-white/50 animate-pulse" />
                ) : message.status === 'sent' ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <CheckCheck
                    className={`w-3.5 h-3.5 ${
                      message.status === 'read' ? 'text-cyan-200' : 'text-white/70'
                    }`}
                  />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction Badges Container */}
        {reactionGroups.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 -mb-1 px-1 z-10">
            {reactionGroups.map((group) => {
              const userReacted = group.userIds.includes(currentUserId);
              return (
                <button
                  key={group.emoji}
                  type="button"
                  onClick={() => onReact && onReact(message.id, group.emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition border cursor-pointer ${
                    userReacted
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-[#ee1d49]'
                      : 'bg-white dark:bg-zinc-800 border-slate-200/80 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <span>{group.emoji}</span>
                  <span className="text-[11px] font-bold">{group.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Floating Quick Action Toolbar on Hover */}
        <div
          className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 p-0.5 rounded-full bg-white/95 dark:bg-zinc-800/95 shadow-md border border-slate-200/80 dark:border-zinc-700/80 z-20 ${
            isSender ? 'right-full mr-2 -translate-y-2' : 'left-full ml-2 -translate-y-2'
          }`}
        >
          {/* React Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionPicker((prev) => !prev)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
              title="Add reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showReactionPicker && (
              <ReactionPicker
                position="top"
                onClose={() => setShowReactionPicker(false)}
                onSelectReaction={(emoji) => {
                  if (onReact) onReact(message.id, emoji);
                }}
              />
            )}
          </div>

          {/* Reply Button */}
          <button
            type="button"
            onClick={() => onReply && onReply(message)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          {message.content && (
            <button
              type="button"
              onClick={handleCopy}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
              title="Copy text"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Pin Button */}
          {onPin && (
            <button
              type="button"
              onClick={() => onPin(message.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer ${
                message.isPinned ? 'text-amber-500' : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
              title={message.isPinned ? 'Unpin message' : 'Pin message'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Button */}
          {onDelete && isSender && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
