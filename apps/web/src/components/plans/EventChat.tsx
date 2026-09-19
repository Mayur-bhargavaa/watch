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
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Event Chat
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Talk with everyone attending
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          Live
        </span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <MessageCircle className="w-8 h-8 opacity-30 mb-2" />
            <p className="font-semibold text-xs text-slate-500 dark:text-zinc-400">No messages yet</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">Be the first to say hi to the crew!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUserId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <img
                    src={getBitmojiAvatar(msg.avatarUrl, msg.displayName)}
                    alt={msg.displayName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-white/10"
                  />
                )}

                <div
                  className={`max-w-[75%] rounded-2xl p-3 shadow-xs ${
                    isMe
                      ? 'bg-gradient-to-tr from-[#ee1d49] to-[#ff3b68] text-white rounded-br-xs'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-zinc-200 rounded-bl-xs'
                  }`}
                >
                  {!isMe && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
                      {msg.displayName}
                    </div>
                  )}
                  <p className="leading-relaxed font-medium break-words">{msg.text}</p>
                  <div
                    className={`text-[9px] mt-1 text-right font-medium ${
                      isMe ? 'text-white/70' : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  >
                    {timeStr}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Bar */}
      <div className="flex items-center gap-1.5 py-2 border-t border-slate-100 dark:border-white/[0.04] overflow-x-auto">
        {quickReactions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleQuickReaction(emoji)}
            className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/10 text-xs transition cursor-pointer shrink-0"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-2 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden focus:border-[#ee1d49] transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-2xl bg-[#ee1d49] text-white hover:brightness-110 disabled:opacity-40 transition shadow-sm cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
