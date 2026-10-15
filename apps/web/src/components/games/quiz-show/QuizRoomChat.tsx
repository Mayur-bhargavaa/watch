'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import { ReactionGlyph } from '../../ui/ReactionGlyph';
import type { QuizGameView } from '@synccinema/common';
import type { GameChatMessage } from '../../../hooks/useGameRoom';
import { IMPOSTER_REACTIONS } from '../../../lib/reactionEmojis';
import { chatLockedReason } from '../../../lib/quizShowView';

interface QuizRoomChatProps {
  view: Pick<QuizGameView, 'phase' | 'me'>;
  messages: GameChatMessage[];
  myUserId: string;
  isSpectator: boolean;
  onSend: (content: string) => void;
  onReact: (emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
  typingNames: string[];
  className?: string;
  onClose?: () => void;
}

const QUICK_PHRASES = ['Good luck!', 'Nice one!', 'Too easy', 'Tricky...', 'GG!'];

/** The in-room chat of Quiz Show Studio: one public channel for everybody. Locked for a player while their own buzzer answer window is open (the server enforces it). */
export const QuizRoomChat: React.FC<QuizRoomChatProps> = ({ view, messages, myUserId, isSpectator, onSend, onReact, onTyping, typingNames, className = '', onClose }) => {
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = chatLockedReason(view, isSpectator);
  const writable = locked === '';
  const list = messages.slice(-80);

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [list.length]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setText(v);
    if (v.trim() && writable) {
      onTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => onTyping(false), 2500);
    } else onTyping(false);
  }, [writable, onTyping]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !writable) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(false);
    onSend(text.trim());
    setText('');
  };

  return (
    <div data-testid="quiz-chat" className={`flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-2.5 text-zinc-900 dark:border-white/10 dark:bg-[#14151b] dark:text-white ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-white/10">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Room chat</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:text-zinc-400 dark:hover:bg-[#22232c] dark:hover:text-white" aria-label="Close chat" title="Close chat">
            <AppIcon name="close" className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={scroller} className="min-h-[6rem] flex-1 space-y-1.5 overflow-y-auto px-1 py-2 text-xs scrollbar-none">
        {list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-5 text-center text-zinc-500 dark:text-zinc-400">
            <AppIcon name="message" className="mb-2 h-6 w-6 text-zinc-400" />
            <p className="text-xs font-medium">No messages yet</p>
          </div>
        ) : (
          list.map((m) => {
            const mine = m.userId === myUserId;
            return (
              <div key={m.id} className="flex items-start gap-2 p-1">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-white">{(m.userName?.[0] || '?').toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="truncate text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{mine ? `${m.userName} (You)` : m.userName}</span>
                    <span className="ml-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`break-words rounded-xl border px-2.5 py-1.5 text-xs ${mine ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/10 dark:bg-[#22232c] dark:text-zinc-100'}`}>{m.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {writable && (
        <div className="space-y-1.5 border-t border-zinc-100 pt-2 dark:border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" aria-label="Quick reactions">
            {IMPOSTER_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => onReact(emoji)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-base transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#1b1c24] dark:hover:bg-[#22232c]" title={`React with ${emoji}`}>
                <ReactionGlyph value={emoji} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PHRASES.map((phrase) => (
              <button key={phrase} type="button" onClick={() => onSend(phrase)} className="shrink-0 whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-200 dark:hover:bg-[#22232c]">
                {phrase}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-1">
        {typingNames.length > 0 && writable && (
          <div className="mb-1.5 flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 motion-safe:animate-pulse" />
            <span>{typingNames.join(', ')} is typing...</span>
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            maxLength={300}
            disabled={!writable}
            onChange={onChange}
            onBlur={() => onTyping(false)}
            aria-label="Message"
            placeholder={writable ? 'Type a message...' : locked}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 placeholder-zinc-500 focus:border-[#ee1d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white dark:placeholder-zinc-400 dark:disabled:bg-[#1b1c24]"
          />
          <button type="submit" disabled={!writable} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]" aria-label="Send message">
            <AppIcon name="rocket" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default QuizRoomChat;
