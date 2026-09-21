'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Flame,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Palette,
  Smile
} from 'lucide-react';
import { DoodleGuess } from '@synccinema/common';
import { GameChatMessage } from '../../../hooks/useGameRoom';

interface GuessPanelProps {
  isDrawer: boolean;
  maskedWord: string;
  category?: string;
  guesses: DoodleGuess[];
  onSendGuess: (guess: string) => void;
  onRequestHint?: () => void;
  canRequestHint?: boolean;
  drawerDisplayName: string;
  guesserDisplayName: string;
  hasGuessedCorrectly?: boolean;
  disabled?: boolean;
  isDark?: boolean;
  // Live Chat Integration
  chatMessages?: GameChatMessage[];
  myUserId?: string;
  onSendMessage?: (content: string) => void;
  onSendReaction?: (emoji: string) => void;
}

const QUICK_CHAT_PILLS = [
  'Nice drawing! 🎨',
  'So close!! 🔥',
  'Haha that looks like a cat 😂',
  'Good guess! 👏',
  'Hurry, timer running out! ⏳',
  'What is that?! 🤯'
];

export const GuessPanel: React.FC<GuessPanelProps> = ({
  isDrawer,
  maskedWord,
  category,
  guesses,
  onSendGuess,
  onRequestHint,
  canRequestHint = false,
  drawerDisplayName,
  guesserDisplayName,
  hasGuessedCorrectly = false,
  disabled = false,
  isDark = true,
  chatMessages = [],
  myUserId = '',
  onSendMessage,
  onSendReaction
}) => {
  const [activeTab, setActiveTab] = useState<'guesses' | 'chat'>('guesses');
  const [inputValue, setInputValue] = useState('');
  const [chatInputValue, setChatInputValue] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevChatLengthRef = useRef(chatMessages.length);

  // Auto-scroll guesses to bottom
  useEffect(() => {
    if (activeTab === 'guesses') {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [guesses, activeTab]);

  // Track unread chat messages when on guesses tab
  useEffect(() => {
    if (chatMessages.length > prevChatLengthRef.current) {
      if (activeTab === 'guesses') {
        setUnreadChatCount(prev => prev + (chatMessages.length - prevChatLengthRef.current));
      } else {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevChatLengthRef.current = chatMessages.length;
  }, [chatMessages.length, activeTab]);

  const handleTabChange = (tab: 'guesses' | 'chat') => {
    setActiveTab(tab);
    if (tab === 'chat') {
      setUnreadChatCount(0);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  // Focus input for guesser on guesses tab
  useEffect(() => {
    if (activeTab === 'guesses' && !isDrawer && !hasGuessedCorrectly && !disabled) {
      inputRef.current?.focus();
    }
  }, [isDrawer, hasGuessedCorrectly, disabled, activeTab]);

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isDrawer || hasGuessedCorrectly || disabled) return;
    onSendGuess(trimmed);
    setInputValue('');
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInputValue.trim();
    if (!trimmed || !onSendMessage) return;
    onSendMessage(trimmed);
    setChatInputValue('');
  };

  // Compute letter count from masked word
  const letterCount = maskedWord.replace(/[^A-Za-z_]/g, '').length;

  return (
    <div
      className={`flex flex-col h-full w-full rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl transition-colors duration-200 ${
        isDark
          ? 'bg-[#111625]/90 border-white/10 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-md'
      }`}
    >
      {/* Top Segmented Tab Switcher */}
      <div
        className={`p-1.5 border-b flex items-center gap-1 ${
          isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <button
          type="button"
          onClick={() => handleTabChange('guesses')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'guesses'
              ? 'bg-rose-500 text-white shadow-md'
              : isDark
              ? 'text-zinc-400 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Guesses</span>
          {guesses.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'guesses'
                  ? 'bg-black/20 text-white'
                  : isDark
                  ? 'bg-white/10 text-zinc-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {guesses.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('chat')}
          className={`relative flex-1 py-1.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'chat'
              ? 'bg-rose-500 text-white shadow-md'
              : isDark
              ? 'text-zinc-400 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Table Chat</span>
          {unreadChatCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
          {chatMessages.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'chat'
                  ? 'bg-black/20 text-white'
                  : isDark
                  ? 'bg-white/10 text-zinc-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {chatMessages.length}
            </span>
          )}
        </button>
      </div>

      {/* GUESSES VIEW */}
      {activeTab === 'guesses' && (
        <>
          {/* Header: Masked Word & Category */}
          <div
            className={`p-3.5 border-b flex flex-col items-center justify-center text-center ${
              isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {category && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-wider text-rose-500">
                  {category}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-400'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {letterCount} letters
              </span>
            </div>

            {/* Masked Letter Slots */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 my-1 select-none">
              {maskedWord.split('').map((char, index) => {
                if (char === ' ') {
                  return <div key={index} className="w-2.5" />;
                }
                const isRevealed = char !== '_';
                return (
                  <div
                    key={index}
                    className={`w-7 h-9 sm:w-8 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg font-black transition-all ${
                      isRevealed
                        ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-in zoom-in-50'
                        : isDark
                        ? 'bg-white/5 border border-white/15 text-transparent border-b-4 border-b-white/40'
                        : 'bg-slate-100 border border-slate-300 text-transparent border-b-4 border-b-slate-400'
                    }`}
                  >
                    {isRevealed ? char : ''}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guesses Feed */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-[160px] max-h-[300px]">
            {guesses.length === 0 ? (
              <div
                className={`h-full flex flex-col items-center justify-center text-center py-6 text-xs ${
                  isDark ? 'text-zinc-500' : 'text-slate-400'
                }`}
              >
                <Sparkles className="w-5 h-5 mb-1 opacity-40" />
                <span>No guesses yet</span>
                <span className="text-[10px] opacity-70">
                  {isDrawer
                    ? `Waiting for ${guesserDisplayName} to guess...`
                    : 'Type your guess below!'}
                </span>
              </div>
            ) : (
              guesses.map(g => {
                if (g.isCorrect) {
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 font-bold animate-in zoom-in-95"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-xs">{g.displayName}:</span>
                        <span className="text-xs uppercase tracking-wider font-black">
                          {g.guess}
                        </span>
                      </div>
                      {g.pointsAwarded !== undefined && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                          +{g.pointsAwarded} pts!
                        </span>
                      )}
                    </div>
                  );
                }

                if (g.isClose) {
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-500 font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs">{g.displayName}:</span>
                        <span className="text-xs">{g.guess}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                        Close!
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-2 p-2 rounded-xl border ${
                      isDark
                        ? 'bg-white/[0.03] border-white/5 text-zinc-300'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isDark ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      {g.displayName}:
                    </span>
                    <span className="text-xs font-semibold">{g.guess}</span>
                  </div>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Guesses Input or Drawer Notice */}
          <div
            className={`p-3 border-t ${
              isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            {isDrawer ? (
              <div
                className={`flex items-center justify-center p-2 rounded-xl border text-center ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-400'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <span className="text-xs font-semibold">
                  🎨 You are Drawing! Watch {guesserDisplayName}'s guesses appear live above.
                </span>
              </div>
            ) : hasGuessedCorrectly ? (
              <div className="flex items-center justify-center p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center text-emerald-500 font-bold text-xs">
                🎉 You guessed correctly! Waiting for round to finish...
              </div>
            ) : (
              <form onSubmit={handleGuessSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={disabled}
                  placeholder="Type your guess here..."
                  maxLength={40}
                  className={`flex-1 border rounded-xl px-3.5 py-2 text-sm outline-none transition-all disabled:opacity-50 ${
                    isDark
                      ? 'bg-white/5 border-white/15 focus:border-rose-500 text-white placeholder-zinc-500'
                      : 'bg-white border-slate-300 focus:border-rose-500 text-slate-900 placeholder-slate-400'
                  }`}
                />

                {onRequestHint && canRequestHint && (
                  <button
                    type="button"
                    onClick={onRequestHint}
                    title="Ask for a letter hint"
                    className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30 active:scale-95 transition-all"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!inputValue.trim() || disabled}
                  className="p-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {/* PARTY CHAT VIEW */}
      {activeTab === 'chat' && (
        <>
          {/* Quick Chat Phrases Bar */}
          <div
            className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none ${
              isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
            }`}
          >
            {QUICK_CHAT_PILLS.map((pill, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage?.(pill)}
                className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border transition active:scale-95 ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 min-h-[160px] max-h-[300px]">
            {chatMessages.length === 0 ? (
              <div
                className={`h-full flex flex-col items-center justify-center text-center py-6 text-xs ${
                  isDark ? 'text-zinc-500' : 'text-slate-400'
                }`}
              >
                <MessageCircle className="w-5 h-5 mb-1 opacity-40" />
                <span>No messages yet</span>
                <span className="text-[10px] opacity-70">Say hi or cheer your opponent!</span>
              </div>
            ) : (
              chatMessages.map(msg => {
                const isMe = msg.userId === myUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!isMe && (
                      <span
                        className={`text-[9px] font-bold mb-0.5 ml-1 ${
                          isDark ? 'text-zinc-400' : 'text-slate-500'
                        }`}
                      >
                        {msg.userName}
                      </span>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs break-words shadow-xs ${
                        isMe
                          ? 'bg-rose-500 text-white rounded-br-sm'
                          : isDark
                          ? 'bg-white/10 text-white rounded-bl-sm border border-white/5'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleChatSubmit}
            className={`p-3 border-t flex items-center gap-2 ${
              isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <input
              type="text"
              value={chatInputValue}
              onChange={e => setChatInputValue(e.target.value)}
              placeholder="Type message to table..."
              maxLength={120}
              className={`flex-1 border rounded-xl px-3.5 py-2 text-sm outline-none transition-all ${
                isDark
                  ? 'bg-white/5 border-white/15 focus:border-rose-500 text-white placeholder-zinc-500'
                  : 'bg-white border-slate-300 focus:border-rose-500 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button
              type="submit"
              disabled={!chatInputValue.trim()}
              className="p-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
