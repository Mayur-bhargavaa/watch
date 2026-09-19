'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  Smile,
  Sparkles
} from 'lucide-react';
import { PlanChatMessage } from '../../types/plans';

function getBitmojiAvatar(url?: string | null, fallbackSeed?: string): string {
  if (url && url.trim() !== '') {
    if (url.startsWith('/avatars/')) return url;
    return url
      .replace(/[?&]radius=[^&]+/g, '')
      .replace(/[?&]backgroundColor=[^&]+/g, '');
  }
  const seed = encodeURIComponent(fallbackSeed || 'player');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&skinColor=edb98a&top=shortCurly&hairColor=4a312c&accessoriesProbability=0&clothing=blazerAndShirt&clothesColor=25557c&eyes=wink&mouth=smile`;
}

interface EventChatProps {
  messages: PlanChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  onSendMessage: (text: string) => void;
}

export const EventChat: React.FC<EventChatProps> = ({
  messages,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onSendMessage
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const quickReactions = ['🍿', '🔥', '🙌', '🚀', '🎬', '❤️'];

  const handleQuickReaction = (emoji: string) => {
    onSendMessage(emoji);
  };

  return (
    <div className="rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
        <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
          Event Chat
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <MessageCircle className="w-8 h-8 opacity-30 mb-2" />
            <p className="font-semibold text-xs text-slate-500 dark:text-zinc-400">No messages yet</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">Be the first to say hi to the crew!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const timeStr = '2m ago';
            return (
              <div key={msg.id} className="flex items-start gap-3">
                <img
                  src={getBitmojiAvatar(msg.avatarUrl, msg.displayName)}
                  alt={msg.displayName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-white/10 bg-slate-200 dark:bg-zinc-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {msg.displayName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                      {timeStr}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mt-0.5 leading-snug">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-2 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden focus:border-[#ff2a5f] transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-2xl bg-[#ff2a5f] hover:bg-[#ee1d49] text-white flex items-center justify-center disabled:opacity-40 transition shadow-md shadow-[#ff2a5f]/25 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
        </button>
      </form>
    </div>
  );
};
