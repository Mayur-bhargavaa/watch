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
}

export const DoodleChatDrawer: React.FC<DoodleChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  myUserId,
  onSendMessage
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
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-[#0b0d17]/95 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">Duel Chat</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500 text-xs">
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
                  <span className="text-[10px] font-bold text-zinc-400 mb-1 ml-1">
                    {msg.userName}
                  </span>
                )}
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs break-words ${
                    isMe
                      ? 'bg-rose-500 text-white rounded-br-sm'
                      : 'bg-white/10 text-zinc-100 rounded-bl-sm'
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
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Send a chat message..."
          className="flex-1 bg-white/5 border border-white/10 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white transition active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
