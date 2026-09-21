'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { GameChatMessage } from '../../../hooks/useGameRoom';

interface DoodleChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: GameChatMessage[];
  myUserId: string;
  onSendMessage: (content: string) => void;
  isDark?: boolean;
}

const QUICK_PILLS = ['Good job! 👏', 'Haha nice! 😂', 'Hurry up! ⏳', 'Close one! 🔥', 'What is that?! 🤯'];

export const DoodleChatDrawer: React.FC<DoodleChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  myUserId,
  onSendMessage,
  isDark = true
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full sm:w-80 backdrop-blur-xl border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 transition-colors ${
        isDark
          ? 'bg-[#0b0d17]/95 border-white/10 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3.5 border-b ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-rose-500" />
          <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Duel Chat
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-full transition ${
            isDark
              ? 'text-zinc-400 hover:text-white hover:bg-white/10'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Pills */}
      <div
        className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none ${
          isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {QUICK_PILLS.map((pill, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSendMessage(pill)}
            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border transition active:scale-95 ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div
            className={`h-full flex flex-col items-center justify-center text-center p-4 text-xs ${
              isDark ? 'text-zinc-500' : 'text-slate-400'
            }`}
          >
            <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
            <span>No messages yet</span>
            <span className="text-[10px] opacity-70">Send a quick cheer or reaction!</span>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.userId === myUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span
                    className={`text-[10px] font-bold mb-1 ml-1 ${
                      isDark ? 'text-zinc-400' : 'text-slate-500'
                    }`}
                  >
                    {msg.userName}
                  </span>
                )}
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs break-words shadow-xs ${
                    isMe
                      ? 'bg-rose-500 text-white rounded-br-sm'
                      : isDark
                      ? 'bg-white/10 text-zinc-100 rounded-bl-sm border border-white/5'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className={`p-3 border-t flex items-center gap-2 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
      >
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Send a chat message..."
          className={`flex-1 border rounded-xl px-3 py-2 text-xs outline-none transition ${
            isDark
              ? 'bg-white/5 border-white/10 focus:border-rose-500 text-white placeholder-zinc-500'
              : 'bg-white border-slate-300 focus:border-rose-500 text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white transition active:scale-95 shadow"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
