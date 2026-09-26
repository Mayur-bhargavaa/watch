'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X as CloseIcon,
  Send,
  MessageSquare,
  Sparkles
} from 'lucide-react';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  timestamp?: string | number;
}

interface ChessChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  myUserId: string;
  onSendMessage: (content: string) => void;
  onSendReaction: (emoji: string) => void;
}

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '👑'];

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl && !avatarUrl.includes('api.dicebear.com/7.x/bottts')) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-pink-200/50"
      />
    );
  }

  const initial = (name || 'G')[0].toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-[#ff2b70] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs ring-1 ring-white/50">
      {initial}
    </div>
  );
}

export const ChessChatDrawer: React.FC<ChessChatDrawerProps> = ({
  isOpen,
  onClose,
  messages = [],
  myUserId,
  onSendMessage,
  onSendReaction
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
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
    <div className="fixed inset-0 z-50 overflow-hidden select-none pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-white/95 dark:bg-[#191527]/95 backdrop-blur-2xl border-l border-pink-100 dark:border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.06] dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#16132b] dark:text-white">
                Match Chat
              </h3>
              {messages.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-pink-100 dark:bg-pink-950/60 text-[#ff2b70] font-black">
                  {messages.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-[#16132b] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              title="Close Chat"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Stream */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 select-text">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-zinc-500">
                <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-950/30 text-[#ff2b70] flex items-center justify-center mb-2 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="font-bold text-xs text-slate-700 dark:text-zinc-300">
                  Friendly duel chat
                </p>
                <p className="text-[11px] mt-0.5">
                  Say hi or cheer your opponent with quick reactions!
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.userId === myUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 max-w-[90%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    <UserAvatar name={msg.userName} avatarUrl={msg.avatarUrl} />
                    <div className="flex flex-col">
                      <span
                        className={`text-[10px] font-bold mb-0.5 text-slate-400 dark:text-zinc-500 ${
                          isMe ? 'text-right' : 'text-left'
                        }`}
                      >
                        {isMe ? 'You' : msg.userName}
                      </span>
                      <div
                        className={`p-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-[#ff2b70]/10 text-[#16132b] dark:text-pink-100 border border-[#ff2b70]/25 rounded-tr-xs'
                            : 'bg-slate-100/90 dark:bg-white/10 text-slate-800 dark:text-zinc-100 border border-slate-200/60 dark:border-white/10 rounded-tl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Reaction Bar */}
          <div className="px-4 py-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-1">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
              React:
            </span>
            <div className="flex items-center gap-1.5">
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSendReaction(emoji)}
                  className="w-7 h-7 rounded-xl bg-slate-100/80 hover:bg-pink-50 hover:scale-115 active:scale-95 text-sm flex items-center justify-center transition cursor-pointer dark:bg-white/5 dark:hover:bg-pink-950/40"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-black/[0.06] dark:border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Send message to room..."
              className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-[#16132b] dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#ff2b70] focus:border-[#ff2b70]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-[#ff2b70] hover:bg-[#e11d48] disabled:opacity-40 disabled:hover:bg-[#ff2b70] text-white shadow-sm transition cursor-pointer"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
