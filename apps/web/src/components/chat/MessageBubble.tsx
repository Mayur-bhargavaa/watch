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
  X,
  Eye,
} from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { VoiceMessage } from './VoiceMessage';
import { PlanMessage } from './PlanMessage';
import { GameInviteMessage } from './GameInviteMessage';
import { MovieShareMessage } from './MovieShareMessage';
import { ReactionPicker } from './ReactionPicker';
import { parseStickerMessage } from './StickersData';
import { ModalPortal } from './ModalPortal';
import { ChatStore } from '@/lib/chatStore';

/**
 * WhatsApp-style Emoji Count detector:
 * 1 emoji  -> 52px (very big)
 * 2 emojis -> 40px (medium-large)
 * 3 emojis -> 32px (medium)
 * 4+ or mixed with text -> normal text size (14px)
 */
function getEmojiOnlyInfo(content?: string): { isOnlyEmoji: boolean; count: number } {
  if (!content) return { isOnlyEmoji: false, count: 0 };
  const trimmed = content.trim();
  if (!trimmed) return { isOnlyEmoji: false, count: 0 };

  // Regex matching unicode emoji sequences, skin tones, ZWJ, flags
  const emojiRegex = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}{2}|\uFE0F|\u200D)+$/u;
  if (!emojiRegex.test(trimmed.replace(/\s+/g, ''))) {
    return { isOnlyEmoji: false, count: 0 };
  }

  // Count grapheme clusters
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = [...segmenter.segment(trimmed)].map((s) => s.segment.trim()).filter(Boolean);
    const isOnlyEmoji = segments.length > 0 && segments.every((s) => emojiRegex.test(s));
    return { isOnlyEmoji, count: isOnlyEmoji ? segments.length : 0 };
  } catch {
    // Fallback if Intl.Segmenter is not supported
    const chars = [...trimmed].filter((c) => c.trim().length > 0);
    return { isOnlyEmoji: true, count: chars.length };
  }
}

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
  const [isViewOnceModalOpen, setIsViewOnceModalOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const handleOpenViewOnce = () => {
    if (message.metadata?.viewOnceOpened) return;
    setIsViewOnceModalOpen(true);
  };

  const handleCloseViewOnce = () => {
    setIsViewOnceModalOpen(false);
    if (!message.metadata?.viewOnceOpened) {
      ChatStore.markViewOnceOpened(message.conversationId, message.id);
    }
  };

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sticker = parseStickerMessage(message.content, message.mediaUrl, message.metadata) ||
    (message.type === 'sticker' && message.mediaUrl ? {
      id: message.id,
      name: 'Sticker',
      category: 'bubu_dudu' as const,
      gifUrl: message.mediaUrl,
      tagline: 'STICKER',
      tags: ['sticker'],
    } : null);
  const emojiInfo = getEmojiOnlyInfo(!sticker && !message.mediaUrl && message.type === 'text' ? message.content : undefined);

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
        {sticker ? (
          /* WhatsApp-Style Borderless Free-Floating Sticker */
          <div className="relative select-none group/sticker py-0.5">
            <div className="flex items-center justify-center">
              {sticker.gifUrl || sticker.webpUrl ? (
                <img
                  src={sticker.gifUrl || sticker.webpUrl}
                  alt={sticker.name || 'Sticker'}
                  className="w-36 h-36 sm:w-44 sm:h-44 object-contain filter drop-shadow-md hover:scale-105 transition-transform duration-200 select-none"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : sticker.drawingSvg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: sticker.drawingSvg }}
                  className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center drop-shadow-md"
                />
              ) : (
                <span className="text-7xl drop-shadow-sm select-none">{sticker.emoji || '✨'}</span>
              )}
            </div>

            {/* Subtle floating timestamp and ticks */}
            <div className="flex items-center justify-end gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-xs text-[10px] font-semibold text-white/90 w-fit ml-auto shadow-xs">
              <span>{formattedTime}</span>
              {isSender && (
                <span className="inline-flex">
                  {message.status === 'sending' ? (
                    <Clock className="w-3 h-3 text-white/60 animate-pulse" />
                  ) : message.status === 'sent' ? (
                    <Check className="w-3 h-3 text-white/80" />
                  ) : (
                    <CheckCheck
                      className={`w-3.5 h-3.5 ${
                        message.status === 'read' ? 'text-[#53bdeb]' : 'text-white/80'
                      }`}
                    />
                  )}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Standard Card Bubble for Text / Voice / Plans / Games / Movies / Emojis */
          <div
            className={`relative transition-all ${
              emojiInfo.isOnlyEmoji
                ? 'px-3 py-1.5 rounded-3xl shadow-xs'
                : 'px-4 py-2.5 rounded-2xl shadow-2xs'
            } ${
              isSender
                ? 'bg-[#ee1d49] text-white rounded-br-xs'
                : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-100 dark:border-zinc-700/60 rounded-bl-xs'
            }`}
          >
            {message.type === 'voice' && message.metadata?.voice ? (
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
            ) : message.metadata?.isViewOnce ? (
              /* WhatsApp-style View Once Photo Message */
              <div className="py-0.5">
                {message.metadata?.viewOnceOpened ? (
                  /* Opened State - Cannot be opened again */
                  <div className="flex items-center gap-2.5 py-1 px-1 select-none opacity-85">
                    <div
                      className={`w-7 h-7 rounded-full border border-dashed flex items-center justify-center text-xs font-bold ${
                        isSender
                          ? 'border-white/70 text-white/80'
                          : 'border-slate-400 dark:border-zinc-500 text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      1
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`font-semibold text-xs ${
                          isSender ? 'text-white/90' : 'text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        Opened
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Unopened State - Click to view */
                  <button
                    type="button"
                    onClick={handleOpenViewOnce}
                    className="flex items-center gap-2.5 py-1 px-1 text-left cursor-pointer group/viewonce select-none"
                  >
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black transition-transform group-hover/viewonce:scale-110 shadow-xs ${
                        isSender
                          ? 'border-white bg-white/20 text-white'
                          : 'border-[#ee1d49] bg-rose-500/15 text-[#ee1d49]'
                      }`}
                    >
                      1
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`font-bold text-xs leading-tight ${
                          isSender ? 'text-white' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        Photo
                      </span>
                      <span
                        className={`text-[10px] ${
                          isSender ? 'text-white/75' : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        View once • Tap to open
                      </span>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              /* Standard Text / Image / Big Emojis */
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
                  <p
                    className={`leading-tight whitespace-pre-wrap wrap-break-word ${
                      emojiInfo.isOnlyEmoji
                        ? emojiInfo.count === 1
                          ? 'text-5xl sm:text-6xl py-1 select-none tracking-normal'
                          : emojiInfo.count === 2
                          ? 'text-3xl sm:text-4xl py-0.5 select-none tracking-wide'
                          : emojiInfo.count === 3
                          ? 'text-2xl sm:text-3xl py-0.5 select-none tracking-normal'
                          : 'text-[15px] leading-relaxed'
                        : 'text-[14px] leading-relaxed'
                    }`}
                  >
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
                        message.status === 'read' ? 'text-[#53bdeb]' : 'text-white/70'
                      }`}
                    />
                  )}
                </span>
              )}
            </div>
          </div>
        )}

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

      {/* Fullscreen View Once Lightbox Modal */}
      {isViewOnceModalOpen && message.mediaUrl && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200"
            onClick={handleCloseViewOnce}
          >
            {/* Top Header */}
            <div
              className="w-full max-w-3xl mx-auto flex items-center justify-between py-2 text-white border-b border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full border-2 border-[#ee1d49] bg-[#ee1d49] text-white flex items-center justify-center text-xs font-black">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">View Once Photo</h4>
                  <p className="text-[10px] text-zinc-400">
                    Will be marked as Opened once closed
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseViewOnce}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Close and mark opened"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image */}
            <div
              className="flex-1 flex items-center justify-center py-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={message.mediaUrl}
                alt="View once photo"
                className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl select-none"
              />
            </div>

            {/* Bottom Caption / Close Button */}
            <div
              className="w-full max-w-3xl mx-auto flex flex-col items-center gap-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {message.content && (
                <p className="text-sm text-white/90 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md max-w-lg">
                  {message.content}
                </p>
              )}
              <button
                type="button"
                onClick={handleCloseViewOnce}
                className="px-6 py-2 rounded-full bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-bold shadow-lg shadow-rose-500/20 transition cursor-pointer"
              >
                Close photo
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
