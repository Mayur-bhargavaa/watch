'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatReplyTo } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { ReactionGlyph } from '../../ui/ReactionGlyph';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import { ChatReplyQuote, ChatReplyingBanner } from '../../chat/ChatReplyUI';
import { StickerPicker, StickerMessageView } from '../../chat/StickerPicker';
import { DrawStickerModal } from '../../chat/DrawStickerModal';
import { parseStickerMessage, formatStickerMessage } from '../../chat/StickersData';
import { IMPOSTER_REACTIONS } from '../../../lib/reactionEmojis';

interface ImposterRoomChatProps {
  messages: GameChatMessage[];
  myUserId: string;
  onSend: (content: string, replyTo?: ChatReplyTo | null) => void;
  onReact: (emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
  /** names of the other people typing right now */
  typingNames: string[];
  /** spectators read and react but cannot write */
  readOnly?: boolean;
  className?: string;
  onClose?: () => void;
}

const QUICK_PHRASES = ['Good Luck!', 'Sus...', 'Not me!', 'Well Played!', 'Hurry Up!', 'GG!'];

/**
 * The in-room chat of the Imposter screens, with the same features as the Ludo room chat: replies, stickers, hand-drawn
 * stickers, quick reactions, quick phrases and a typing indicator. A flat, solid panel in both themes.
 */
export const ImposterRoomChat: React.FC<ImposterRoomChatProps> = ({ messages, myUserId, onSend, onReact, onTyping, typingNames, readOnly = false, className = '', onClose }) => {
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const scrolledUp = useRef(false);
  const prevCount = useRef(0);
  const lastSticker = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  useEffect(() => {
    if (messages.length > prevCount.current && !scrolledUp.current && scroller.current) {
      scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
    }
    prevCount.current = messages.length;
  }, [messages.length]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    scrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
  }, []);

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(`imposter-chat-msg-${id}`);
    if (!el) return;
    scrolledUp.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlighted(id);
    setTimeout(() => setHighlighted((p) => (p === id ? null : p)), 2000);
  }, []);

  const send = (content: string) => {
    onSend(content, replyingTo);
    setReplyingTo(null);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setText(v);
    if (v.trim()) {
      onTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => onTyping(false), 2500);
    } else {
      onTyping(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(false);
    send(text.trim());
    setText('');
    scrolledUp.current = false;
  };

  const sendSticker = (content: string) => {
    const now = Date.now();
    if (now - lastSticker.current < 500) return;
    lastSticker.current = now;
    send(content);
  };

  return (
    <div data-testid="imposter-chat" className={`flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-2.5 text-zinc-900 dark:border-white/10 dark:bg-[#14151b] dark:text-white ${className}`}>
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300">
            <AppIcon name="message" className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-none">Game Chat</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">Live table messages and stickers</p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white" aria-label="Close chat" title="Close chat">
            <AppIcon name="close" className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={scroller} onScroll={onScroll} className="min-h-[8rem] flex-1 space-y-1.5 overflow-y-auto px-1 py-2 text-xs scrollbar-none">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center text-zinc-500 dark:text-zinc-400">
            <AppIcon name="ghost" className="mb-2 h-6 w-6 text-zinc-400" />
            <p className="text-xs font-medium">Say something, or accuse someone!</p>
          </div>
        ) : (
          messages.slice(-80).map((m) => {
            const mine = m.userId === myUserId;
            const sticker = parseStickerMessage(m.content);
            return (
              <div
                key={m.id}
                id={`imposter-chat-msg-${m.id}`}
                className={`group relative flex items-start gap-2 rounded-xl p-1 transition-colors duration-200 ${highlighted === m.id ? 'bg-zinc-100 ring-2 ring-inset ring-[#ee1d49] dark:bg-[#22232c]' : ''}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-white">
                  {(m.userName?.[0] || '?').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="truncate text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{mine ? `${m.userName} (You)` : m.userName}</span>
                    <span className="ml-1 flex shrink-0 items-center gap-1.5">
                      <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo({ id: m.id, userName: m.userName, content: m.content });
                            inputRef.current?.focus({ preventScroll: true });
                          }}
                          className="rounded p-0.5 text-zinc-500 opacity-70 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] group-hover:opacity-100 dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white"
                          title="Reply to this message"
                          aria-label="Reply to this message"
                        >
                          <AppIcon name="repeat" className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </div>
                  {m.replyTo && <ChatReplyQuote replyTo={m.replyTo} onJumpToMessage={jumpTo} accentColor="rose" />}
                  {sticker ? (
                    <StickerMessageView content={m.content} />
                  ) : (
                    <div className={`break-words rounded-xl border px-2.5 py-1.5 text-xs ${mine ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/10 dark:bg-[#22232c] dark:text-zinc-100'}`}>{m.content}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-1.5 border-t border-zinc-100 pt-2 dark:border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" aria-label="Quick reactions">
          {IMPOSTER_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-base transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#1b1c24] dark:hover:bg-[#22232c]"
              title={`React with ${emoji}`}
            >
              <ReactionGlyph value={emoji} />
            </button>
          ))}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => send(phrase)}
                className="shrink-0 whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-200 dark:hover:bg-[#22232c]"
              >
                {phrase}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative pt-1">
        {typingNames.length > 0 && (
          <div className="mb-1.5 flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 motion-safe:animate-pulse" />
            <span>{typingNames.join(', ')} is typing...</span>
          </div>
        )}
        {showStickers && (
          <div className="absolute bottom-12 right-0 z-50 animate-in fade-in zoom-in-95 duration-150">
            <StickerPicker
              onSelectSticker={(idOrUrl, caption) => {
                sendSticker(formatStickerMessage(idOrUrl, caption));
                setShowStickers(false);
              }}
              onOpenDrawModal={() => {
                setShowStickers(false);
                setShowDraw(true);
              }}
              onClose={() => setShowStickers(false)}
            />
          </div>
        )}
        {replyingTo && !readOnly && <ChatReplyingBanner replyingTo={replyingTo} onCancel={() => setReplyingTo(null)} accentColor="rose" />}
        <DrawStickerModal isOpen={showDraw} onClose={() => setShowDraw(false)} onSendDrawnSticker={(formatted) => sendSticker(formatted)} />
        {!readOnly && (
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative flex flex-1 items-center">
              <input
                ref={inputRef}
                type="text"
                value={text}
                maxLength={300}
                onChange={onChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && replyingTo) setReplyingTo(null);
                }}
                onBlur={() => onTyping(false)}
                placeholder={replyingTo ? `Replying to ${replyingTo.userName}...` : 'Type a message or send stickers...'}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-3 pr-16 text-xs text-zinc-900 placeholder-zinc-400 focus:border-[#ee1d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white dark:placeholder-zinc-500"
              />
              <span className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowStickers((p) => !p)}
                  className={`rounded-lg p-1 transition-colors ${showStickers ? 'bg-zinc-200 text-zinc-900 dark:bg-[#2a2b35] dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white'}`}
                  title="Send stickers and GIFs"
                  aria-label="Send stickers and GIFs"
                >
                  <AppIcon name="sparkles" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDraw(true)}
                  className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white"
                  title="Draw animated sticker"
                  aria-label="Draw animated sticker"
                >
                  <AppIcon name="palette" className="h-4 w-4" />
                </button>
              </span>
            </div>
            <button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]" aria-label="Send message">
              <AppIcon name="rocket" className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ImposterRoomChat;
