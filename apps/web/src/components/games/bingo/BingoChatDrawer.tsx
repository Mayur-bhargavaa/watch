'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { GameChatMessage } from '../../../hooks/useGameRoom';

interface BingoChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: GameChatMessage[];
  myUserId: string;
  onSendMessage: (content: string) => void;
}

export const BingoChatDrawer: React.FC<BingoChatDrawerProps> = ({
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
          <h3 className="text-xs font-black uppercase tracking-wider text-white">Match Chat</h3>
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
            <MessageCircle className="w-8 h-8 opacity-30 mb-2" />
            <p>No chat messages yet.</p>
            <p className="text-[10px] mt-0.5">Send a quick roast or reaction!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.userId === myUserId;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-[10px] text-zinc-400 font-bold mb-0.5 px-1">
                    {m.userName}
                  </span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-tr-xs shadow-md shadow-rose-600/20'
                      : 'bg-white/10 text-zinc-200 rounded-tl-xs'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-black/20 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition flex items-center justify-center shadow-md shadow-rose-600/20"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
