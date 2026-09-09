'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@synccinema/common';
import {
  Send,
  Smile,
  Users,
  Copy,
  Check,
  MessageSquare,
  Trash2,
  Clock,
  X,
  Sparkles
} from 'lucide-react';
import { PARTICIPANT_PALETTE, SmileyFace } from '../voice/VideoGrid';
import { StickerPicker, StickerMessageView } from './StickerPicker';
import { parseStickerMessage, formatStickerMessage } from './StickersData';

export interface ContextualChatProps {
  messages: ChatMessage[];
  currentPlaybackPosition: number;
  myUserId?: string;
  isHost?: boolean;
  roomTitle?: string;
  memberCount?: number;
  members?: any[];
  onSendMessage: (content: string, mediaTimestamp?: number | null) => void;
  onDeleteMessage?: (messageId: string) => void;
  onSeekToTimestamp?: (seconds: number) => void;
  onCopyInvite?: () => void;
  copiedInvite?: boolean;
  onSendReaction?: (code: string, emoji: string) => void;
  onPassHost?: (userId: string) => void;
  typingUsers?: string[];
  onSendTyping?: (isTyping: boolean) => void;
  onClose?: () => void;
}

const QUICK_EMOJIS = ['😂', '❤️', '🔥', '🍿', '😮', '👏', '🎉', '💀'];
const POPULAR_EMOJIS = [
  '😂', '❤️', '🔥', '🍿', '😮', '👏', '🎉', '💀',
  '🥳', '👍', '🚀', '💯', '😍', '😭', '😱', '👀',
  '🙌', '🤩', '😎', '✨'
];

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ContextualChat({
  messages,
  currentPlaybackPosition,
  myUserId,
  isHost = false,
  roomTitle = 'Watch Party',
  memberCount = 1,
  onSendMessage,
  onDeleteMessage,
  onSeekToTimestamp,
  onCopyInvite,
  copiedInvite = false,
  onSendReaction,
  typingUsers = [],
  onSendTyping,
  onClose
}: ContextualChatProps) {
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const typingTimerRef = useRef<any>(null);
  const isTypingActiveRef = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close emoji picker when clicking outside or pressing Escape
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showEmojiPicker]);

  // Handle typing state broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    if (onSendTyping) {
      if (val.trim() && !isTypingActiveRef.current) {
        isTypingActiveRef.current = true;
        onSendTyping(true);
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        if (isTypingActiveRef.current) {
          isTypingActiveRef.current = false;
          onSendTyping(false);
        }
      }, 2500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (onSendTyping && isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      onSendTyping(false);
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    onSendMessage(input.trim(), Math.floor(currentPlaybackPosition));
    setInput('');
    setShowEmojiPicker(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const handleQuickReaction = (emoji: string) => {
    if (onSendReaction) {
      const code =
        emoji === '😂' ? 'joy' :
        emoji === '❤️' ? 'heart' :
        emoji === '🔥' ? 'fire' :
        emoji === '👏' ? 'clap' : 'joy';
      onSendReaction(code, emoji);
    } else {
      onSendMessage(emoji, Math.floor(currentPlaybackPosition));
    }
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 1500);
    }
  };

  return (
    <div className="flex flex-col bg-[#0F1117] rounded-xl border border-white/10 overflow-hidden shadow-2xl h-full min-h-0 select-none">
      {/* 1. Header: Branding, Room Title, Member Count Pill, & Invite Button */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#131722] flex flex-col gap-1.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Brand Wordmark & Watermark */}
          <div className="flex flex-col leading-none">
            <span className="text-[#E50914] font-black tracking-tight text-xl sm:text-2xl font-sans lowercase drop-shadow-sm leading-none select-none">
              watch.
            </span>
            <span className="text-[7.5px] font-semibold tracking-wider text-zinc-400/80 uppercase select-none mt-0.5">
              stitchbyte watchparty
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onCopyInvite && (
              <button
                onClick={onCopyInvite}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-zinc-300 hover:text-white transition"
                title="Copy Room Link"
              >
                {copiedInvite ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Invite</span>
                  </>
                )}
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition"
                title="Minimize Chat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subheader: Room Title + Live Member Count Pill */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
            {roomTitle || 'Watch Party'}
          </span>

          <div className="flex items-center gap-1 bg-[#E50914] text-white px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm">
            <Users className="w-3 h-3" />
            <span>{memberCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Messages List (100% Real messages from socket) */}
      <div
        ref={scrollRef}
        className="flex-1 p-3.5 space-y-3 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin scrollbar-thumb-white/10"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
              <MessageSquare className="w-5 h-5 text-[#E50914]" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">No messages yet</p>
            <p className="text-[11px] text-zinc-500 max-w-[200px]">
              Chat in real-time with everyone in this watch party!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isSelf = msg.userId === myUserId || msg.userName === 'You';
            const avatarColor = PARTICIPANT_PALETTE[idx % PARTICIPANT_PALETTE.length];
            const canDelete = isSelf || isHost;

            return (
              <div
                key={msg.id}
                className={`group relative flex items-start space-x-2 max-w-full ${
                  isSelf ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Round Avatar with Smiley */}
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: avatarColor }}
                >
                  <SmileyFace className="w-4 h-4 text-white/95" />
                </div>

                {/* Message Bubble & Meta */}
                <div
                  className={`flex flex-col space-y-0.5 min-w-0 max-w-[80%] ${
                    isSelf ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-[11px] font-medium text-zinc-400">
                    <span className="truncate max-w-[120px]">{msg.userName}</span>
                    <span className="text-[9px] text-zinc-500">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {parseStickerMessage(msg.content) ? (
                    <StickerMessageView content={msg.content} />
                  ) : (
                    <div
                      className={`text-xs px-3 py-2 rounded-2xl border leading-relaxed break-words shadow-sm relative group/bubble ${
                        isSelf
                          ? 'bg-[#E50914] text-white rounded-tr-sm border-[#E50914]'
                          : 'bg-black/40 backdrop-blur-sm text-white rounded-tl-sm border-white/10'
                      }`}
                    >
                      <span>{msg.content}</span>

                      {/* Video Timestamp Reference Chip */}
                      {msg.mediaTimestamp != null && msg.mediaTimestamp > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onSeekToTimestamp?.(msg.mediaTimestamp!)}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 text-amber-300 transition font-mono border border-amber-300/20"
                            title="Jump movie to this timestamp"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatTimestamp(msg.mediaTimestamp)}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick hover actions: Copy & Delete */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-0.5 ${
                      isSelf ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] transition"
                      title="Copy text"
                    >
                      {copiedMsgId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {canDelete && onDeleteMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-[10px] transition"
                        title="Delete message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Footer: Quick Reactions, Popover, Typing Indicator & Input Form */}
      <div className="p-3 border-t border-white/10 bg-[#131722]/60 backdrop-blur-md flex flex-col gap-2 flex-shrink-0 relative">
        {/* Quick Reaction Bar */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickReaction(emoji)}
                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] hover:scale-115 active:scale-95 transition text-sm flex items-center justify-center select-none"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs transition ${
              showEmojiPicker
                ? 'bg-[#E50914] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title="Emoji Palette"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>

        {/* Emoji Popover Grid with Click-Outside Ref */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-20 right-3 z-30 p-2.5 bg-[#171b26] border border-white/15 rounded-xl shadow-2xl grid grid-cols-5 gap-1.5 animate-in fade-in zoom-in-95 select-none"
          >
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleInsertEmoji(emoji)}
                className="w-8 h-8 rounded-lg hover:bg-white/15 transition text-base flex items-center justify-center active:scale-95 select-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Real Typing Indicator (Only when someone is actively typing) */}
        {typingUsers.length > 0 ? (
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-400 italic animate-pulse">
            <span className="flex gap-0.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce [animation-delay:300ms]" />
            </span>
            <span>
              {typingUsers.slice(0, 2).join(', ')}
              {typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : ''}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        ) : (
          <div className="h-2" />
        )}

        {/* Floating Sticker Picker Tray */}
        {showStickerPicker && (
          <div className="absolute bottom-16 right-3 z-50 animate-in fade-in zoom-in-95 duration-150">
            <StickerPicker
              onSelectSticker={(stickerId) => {
                onSendMessage(formatStickerMessage(stickerId), currentPlaybackPosition);
                setShowStickerPicker(false);
              }}
              onClose={() => setShowStickerPicker(false)}
            />
          </div>
        )}

        {/* Message Input Form */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message or send stickers..."
            maxLength={1000}
            className="w-full bg-[#1C202B] text-xs text-white placeholder-zinc-400 rounded-xl px-3.5 py-2.5 pr-20 border border-white/10 focus:outline-none focus:border-rose-500 transition shadow-inner"
          />

          <div className="absolute right-1.5 flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setShowStickerPicker((prev) => !prev)}
              className={`p-1.5 rounded-lg text-xs transition ${
                showStickerPicker
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-zinc-400 hover:text-amber-400 hover:bg-white/5'
              }`}
              title="Send Stickers"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>

            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 bg-[#E50914] hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-[#E50914] text-white rounded-lg transition shadow flex items-center justify-center active:scale-95"
              title="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Bottom subtle watermark */}
        <div className="text-center pt-0.5">
          <span className="text-[7.5px] font-semibold tracking-widest text-zinc-500/70 uppercase select-none">
            stitchbyte watchparty
          </span>
        </div>
      </div>
    </div>
  );
}
