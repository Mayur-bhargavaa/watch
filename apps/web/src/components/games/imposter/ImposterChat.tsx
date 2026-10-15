'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { GameChatMessage } from '../../../hooks/useGameRoom';

interface ImposterChatProps {
  messages: GameChatMessage[];
  myUserId: string;
  onSend: (content: string) => void;
  /** spectators can read but not write */
  readOnly?: boolean;
  /** when true the panel fills its parent (discussion layout); otherwise it is a compact box */
  className?: string;
}

/** The room chat (the same chat every game room has), styled for the Imposter screens. Emoji only appear inside messages. */
export const ImposterChat: React.FC<ImposterChatProps> = ({ messages, myUserId, onSend, readOnly = false, className = '' }) => {
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.length]);

  return (
    <div data-testid="imposter-chat" className={`flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#14151b] ${className}`}>
      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-white/10">
        <AppIcon name="message" className="h-4 w-4 text-zinc-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Room chat</h3>
      </div>
      <div ref={scroller} className="min-h-[8rem] flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No messages yet. Say something!</p>
        ) : (
          messages.slice(-60).map((m) => {
            const mine = m.userId === myUserId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-sm ${mine ? 'bg-[#ee1d49] text-white' : 'bg-zinc-100 text-zinc-800 dark:bg-[#22232c] dark:text-zinc-100'}`}>
                  {!mine && <p className="text-[10px] font-semibold opacity-80">{m.userName}</p>}
                  <p className="break-words">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {!readOnly && (
        <form
          className="flex gap-2 border-t border-zinc-100 p-2.5 dark:border-white/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onSend(text.trim());
            setText('');
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Type a message"
            className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#ee1d49] focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white"
          />
          <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ee1d49] text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b]" aria-label="Send message">
            <AppIcon name="rocket" className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
};

export default ImposterChat;
