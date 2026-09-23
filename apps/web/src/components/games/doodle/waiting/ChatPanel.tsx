'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Info, Send, Smile, X } from 'lucide-react';
import { GameRoom } from '@synccinema/common';
import { GameChatMessage } from '../../../../hooks/useGameRoom';

interface ChatPanelProps {
  room: GameRoom;
  chatMessages: GameChatMessage[];
  myUserId: string;
  onSendMessage: (text: string) => void;
  onSendReaction?: (emoji: string) => void;
  isDrawerMode?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  isDark?: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  room,
  chatMessages,
  myUserId,
  onSendMessage,
  onSendReaction,
  isDrawerMode = false,
  isOpen = false,
  onClose,
  isDark = false
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'info'>('chat');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
  };

  const hostPlayer = room.players.find(p => p.userId === room.hostUserId) || room.players[0];
  const settings = (room as any).doodleConfig || (room.gameState as any)?.config || {};

  const content = (
    <div className="w-full h-full flex flex-col bg-white/90 dark:bg-[#121629]/95 border border-white/70 dark:border-white/10 rounded-3xl shadow-[0_4px_24px_rgba(255,43,112,0.06)] backdrop-blur-xl overflow-hidden select-none">
      {/* Tab Header */}
      <div className="flex items-center justify-between p-3.5 px-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
        <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-white/10 p-1 rounded-2xl text-xs font-extrabold">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-[#161a2e] text-[#ff2b70] shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'bg-white dark:bg-[#161a2e] text-[#ff2b70] shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Game Info</span>
          </button>
        </div>

        {isDrawerMode && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab Body */}
      {activeTab === 'chat' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-950/30 text-[#ff2b70] flex items-center justify-center mb-2">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Lobby Chat
                </span>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Say hi to your opponent while waiting!
                </span>
              </div>
            ) : (
              chatMessages.map(msg => {
                const isMe = msg.userId === myUserId;
                const timeStr = msg.timestamp
                  ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400">
                        {isMe ? 'You' : ((msg as any).displayName || msg.userName || 'Player')}
                      </span>
                      {timeStr && (
                        <span className="text-[9px] text-slate-300 dark:text-zinc-600">
                          {timeStr}
                        </span>
                      )}
                    </div>
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${
                        isMe
                          ? 'bg-[#ff2b70] text-white rounded-tr-xs shadow-xs'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-zinc-200 rounded-tl-xs'
                      }`}
                    >
                      {msg.content || (msg as any).text || ''}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reaction Bar */}
          <div className="px-3 py-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 pl-1">
              Quick:
            </span>
            <div className="flex items-center gap-1">
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSendReaction?.(emoji)}
                  className="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-sm transition active:scale-95 cursor-pointer"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#ff2b70] transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-8 h-8 rounded-xl bg-[#ff2b70] hover:bg-[#e0205f] active:scale-95 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Game Info Tab */
        <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[260px]">
          <div className="p-3 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-800/30">
            <h4 className="text-xs font-black text-[#ff2b70] uppercase tracking-wider mb-0.5">
              Doodle Duel
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400">
              Draw it. Guess it. Switch every round!
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Players</span>
              <span className="font-extrabold text-[#16132b] dark:text-white">
                {room.players.length} / 2
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Rounds</span>
              <span className="font-extrabold text-[#16132b] dark:text-white">
                {settings.rounds || settings.totalRounds || 6}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Drawing Time</span>
              <span className="font-extrabold text-[#16132b] dark:text-white">
                {settings.drawTime || settings.drawTimeSeconds || 60}s
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Difficulty</span>
              <span className="font-extrabold text-[#16132b] dark:text-white capitalize">
                {settings.difficulty || 'Mixed'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Human Only</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                Yes (Zero-Bots)
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Host</span>
              <span className="font-extrabold text-[#16132b] dark:text-white truncate max-w-[130px]">
                {hostPlayer?.displayName || 'Host'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-400 font-medium">Room Code</span>
              <span className="font-mono font-extrabold text-[#ff2b70]">
                {room.roomCode}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Status</span>
              <span className="font-extrabold text-amber-500 uppercase tracking-wide">
                {room.players.length === 2 ? 'Ready' : 'Waiting'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isDrawerMode) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-sm h-full p-3 sm:p-4 animate-in slide-in-from-right duration-200">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
