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
  Maximize2,
  Forward,
} from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { VoiceMessage } from './VoiceMessage';
import { PlanMessage } from './PlanMessage';
import { GameInviteMessage } from './GameInviteMessage';
import { MovieShareMessage } from './MovieShareMessage';
import { ReactionPicker } from './ReactionPicker';
import { parseStickerMessage } from './StickersData';
import { ModalPortal } from './ModalPortal';
import { FullScreenImageViewer } from './FullScreenImageViewer';
import { formatReplySnippet } from './ChatReplyUI';
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
  onForward?: (message: ChatMessage) => void;
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
  onForward,
  onReact,
  onDelete,
  onPin,
  onJumpToReply,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isViewOnceModalOpen, setIsViewOnceModalOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  // Swipe-to-reply & Touchpad gestures state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const lastTapTimeRef = useRef(0);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  // Robust metadata parser (handles both object and JSON string)
  const rawMeta: any = typeof message.metadata === 'string'
    ? (() => { try { return JSON.parse(message.metadata); } catch { return {}; } })()
    : (message.metadata || {});

  const isViewOnce = Boolean(
    rawMeta?.isViewOnce === true ||
    rawMeta?.viewOnce === true ||
    rawMeta?.view_once === true ||
    (message.type as string) === 'view_once'
  );
  const isViewOnceOpened = Boolean(
    rawMeta?.viewOnceOpened ||
    ChatStore.isViewOnceOpened(message.id)
  );

  const handleOpenViewOnce = () => {
    if (isViewOnceOpened) return;
    ChatStore.markViewOnceOpened(message.conversationId, message.id);
    setIsViewOnceModalOpen(true);
  };

  const handleCloseViewOnce = () => {
    setIsViewOnceModalOpen(false);
    ChatStore.markViewOnceOpened(message.conversationId, message.id);
  };

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const displayImageUrl =
    message.mediaUrl ||
    (typeof rawMeta?.mediaUrl === 'string' ? rawMeta.mediaUrl : '') ||
    (typeof rawMeta?.imageUrl === 'string' ? rawMeta.imageUrl : '');

  const sticker = parseStickerMessage(message.content, message.mediaUrl, message.metadata) ||
    (message.type === 'sticker' && message.mediaUrl ? {
      id: message.id,
      name: 'Sticker',
      category: 'bubu_dudu' as const,
      gifUrl: message.mediaUrl,
      tagline: 'STICKER',
      tags: ['sticker'],
    } : null);
  const emojiInfo = getEmojiOnlyInfo(!sticker && !displayImageUrl && message.type === 'text' ? message.content : undefined);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartXRef.current;
    const dy = touch.clientY - touchStartYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(dy) > 8) {
        isHorizontalSwipeRef.current = false;
      }
    }

    if (isHorizontalSwipeRef.current) {
      if (dx > 0) {
        setIsSwiping(true);
        const clamped = Math.min(75, dx * 0.65);
        setSwipeOffset(clamped);
      }
    }
  };

  const handleTouchEnd = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 320 && !isSwiping && swipeOffset === 0) {
      setShowActionMenu((prev) => !prev);
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }

    if (isSwiping) {
      if (swipeOffset >= 40 && onReply) {
        onReply(message);
      }
      setIsSwiping(false);
      setSwipeOffset(0);
      isHorizontalSwipeRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Touchpad two-finger horizontal swipe gesture
    if (Math.abs(e.deltaX) > 18 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (e.deltaX < -20) {
        // Swiping right on trackpad
        setSwipeOffset(55);
        if (onReply) {
          onReply(message);
        }
        setTimeout(() => setSwipeOffset(0), 250);
      }
    }
  };

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
      {/* WhatsApp-Style Swipe to Reply Indicator */}
      {swipeOffset > 0 && (
        <div
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-200/90 dark:bg-zinc-700/90 text-[#ee1d49] flex items-center justify-center shadow-md pointer-events-none transition-all duration-150 z-10"
          style={{
            opacity: Math.min(1, swipeOffset / 25),
            transform: `translate3d(${Math.min(swipeOffset * 0.45, 28)}px, -50%, 0) scale(${Math.min(1.15, 0.6 + (swipeOffset / 50) * 0.5)})`,
          }}
        >
          <Reply className="w-4 h-4" />
        </div>
      )}

      {/* Receiver Avatar */}
      {!isSender &&
        (showAvatar ? (
          <div className="w-8 h-8 rounded-full shrink-0 self-end mb-1 overflow-hidden bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center font-bold text-xs shadow-xs">
            {message.senderAvatar ? (
              <img
                src={message.senderAvatar}
                alt={message.senderName}
                className="w-full h-full object-cover"
              />
            ) : (
              (message.senderName || 'U').slice(0, 1).toUpperCase()
            )}
          </div>
        ) : (
          <div className="w-8 shrink-0" aria-hidden="true" />
        ))}

      {/* Bubble Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onDoubleClick={() => setShowActionMenu((prev) => !prev)}
        style={{
          transform: `translate3d(${swipeOffset}px, 0px, 0px)`,
          transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className={`relative max-w-[85%] sm:max-w-[70%] flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
      >
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
            className={`text-left text-xs mb-1 px-3 py-1.5 rounded-xl border-l-4 border-[#ee1d49] transition-opacity hover:opacity-95 max-w-full truncate cursor-pointer shadow-2xs ${
              isSender
                ? 'bg-rose-100/90 dark:bg-rose-950/40 text-slate-900 dark:text-zinc-100'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100'
            }`}
          >
            <div className="font-bold text-[11px] text-[#ee1d49] truncate">
              {message.replyTo.senderName}
            </div>
            <div className="text-[12px] font-semibold text-slate-900 dark:text-zinc-100 truncate">
              {formatReplySnippet(message.replyTo.content)}
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
            ) : isViewOnce ? (
              /* WhatsApp-style View Once Photo Message */
              <div className="py-0.5">
                {isViewOnceOpened ? (
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
                {displayImageUrl && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsImageViewerOpen(true);
                    }}
                    className="mb-1 rounded-xl overflow-hidden max-h-80 sm:max-h-96 cursor-zoom-in group/img relative shadow-xs"
                    title="Click to view full screen"
                  >
                    <img
                      src={displayImageUrl}
                      alt="Media"
                      className="w-full h-auto max-h-80 sm:max-h-96 object-contain sm:object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center pointer-events-none">
                      <span className="opacity-0 group-hover/img:opacity-100 transition-opacity px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold backdrop-blur-xs flex items-center gap-1 shadow-md">
                        <Maximize2 className="w-3.5 h-3.5" /> Full screen
                      </span>
                    </div>
                  </div>
                )}
                {message.content &&
                  message.content !== '📷 Photo' &&
                  message.content !== '📸 Photo' &&
                  message.content !== 'Photo' && (
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

        {/* Floating Quick Action Toolbar on Hover / Double-tap */}
        <div
          className={`absolute top-0 transition-all duration-200 flex items-center gap-0.5 p-0.5 rounded-full bg-white/95 dark:bg-zinc-800/95 shadow-md border border-slate-200/80 dark:border-zinc-700/80 z-20 ${
            showActionMenu
              ? 'opacity-100 pointer-events-auto scale-100'
              : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
          } ${
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

          {/* Forward Button */}
          {onForward && (
            <button
              type="button"
              onClick={() => onForward(message)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
              title="Forward message"
            >
              <Forward className="w-3.5 h-3.5" />
            </button>
          )}

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

      {/* Fullscreen Lightbox Modal for Regular Images */}
      {isImageViewerOpen && displayImageUrl && (
        <FullScreenImageViewer
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageUrl={displayImageUrl}
          caption={message.content}
          senderName={message.senderName}
          timestamp={formattedTime}
          isViewOnce={false}
        />
      )}

      {/* Fullscreen View Once Lightbox Modal */}
      {isViewOnceModalOpen && displayImageUrl && (
        <FullScreenImageViewer
          isOpen={isViewOnceModalOpen}
          onClose={handleCloseViewOnce}
          imageUrl={displayImageUrl}
          caption={message.content}
          senderName={message.senderName}
          timestamp={formattedTime}
          isViewOnce={true}
        />
      )}
    </div>
  );
};
