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
  Smile,
  Brain
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
      className={`flex flex-col h-full w-full rounded-[24px] border shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors duration-200 ${
        isDark
          ? 'bg-[#111625]/90 border-white/10 text-white'
          : 'bg-white border-slate-200/90 text-slate-800'
      }`}
    >
      {/* Top Tabs matching Mockup: "Guesses" and "Chat" with pink underline indicator */}
      <div
        className={`px-4 pt-3 pb-0 border-b flex items-center justify-start gap-6 ${
          isDark ? 'border-white/10 bg-[#111625]' : 'border-slate-100 bg-white'
        }`}
      >
        <button
          type="button"
          onClick={() => handleTabChange('guesses')}
          className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-all relative ${
            activeTab === 'guesses'
              ? 'text-rose-500'
              : isDark
              ? 'text-zinc-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-rose-500" />
          <span>Guesses</span>
          {activeTab === 'guesses' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('chat')}
          className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-all relative ${
            activeTab === 'chat'
              ? 'text-rose-500'
              : isDark
              ? 'text-zinc-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Chat</span>
          {unreadChatCount > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          )}
          {activeTab === 'chat' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
          )}
        </button>
      </div>

      {/* GUESSES VIEW */}
      {activeTab === 'guesses' && (
        <>
          {/* Masked Word Indicator (compact) */}
          <div
            className={`px-4 py-2.5 border-b flex items-center justify-between ${
              isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {category && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-wider">
                  {category}
                </span>
              )}
              <span className="text-[11px] text-slate-400 font-medium">
                {letterCount} letters
              </span>
            </div>
            <div className="font-mono text-xs font-bold tracking-widest text-slate-600 dark:text-zinc-300">
              {maskedWord}
            </div>
          </div>

          {/* Guesses Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-2.5 min-h-[260px] max-h-[380px] flex flex-col justify-center">
            {guesses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 pointer-events-none select-none">
                {/* Brain illustration with soft sparkle dots */}
                <div className="relative mb-3 flex items-center justify-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                      isDark ? 'bg-white/5 text-sky-400' : 'bg-sky-50 text-sky-400'
                    }`}
                  >
                    <Brain className="w-8 h-8" />
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-sky-300 absolute -top-1 -right-1" />
                  <Sparkles className="w-2.5 h-2.5 text-sky-300 absolute -bottom-1 -left-1" />
                </div>
                <span
                  className={`text-sm font-bold block ${
                    isDark ? 'text-zinc-200' : 'text-slate-800'
                  }`}
                >
                  No guesses yet
                </span>
                <span
                  className={`text-xs mt-0.5 ${
                    isDark ? 'text-zinc-500' : 'text-slate-400'
                  }`}
                >
                  Be the first to guess!
                </span>
              </div>
            ) : (
              guesses.map(g => {
                const guessString = g.guess || (g as any).text || '';
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
                          {guessString}
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
                        <span className="text-xs">{guessString}</span>
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
                    <span className="text-xs font-semibold">{guessString}</span>
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
                className={`flex items-center justify-center p-2.5 rounded-2xl border text-center ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <span className="text-xs font-semibold">
                  🎨 You are Drawing! Watch {guesserDisplayName}'s guesses appear live above.
                </span>
              </div>
            ) : hasGuessedCorrectly ? (
              <div className="flex items-center justify-center p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center text-emerald-600 dark:text-emerald-400 font-bold text-xs">
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
                  placeholder="Type your guess..."
                  maxLength={40}
                  className={`flex-1 border rounded-2xl px-4 py-2.5 text-xs sm:text-sm outline-none transition-all disabled:opacity-50 ${
                    isDark
                      ? 'bg-white/5 border-white/15 focus:border-rose-500 text-white placeholder-zinc-500'
                      : 'bg-slate-50 border-slate-200 focus:border-rose-500 text-slate-900 placeholder-slate-400'
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
                  className="w-10 h-10 rounded-2xl bg-[#f43f5e] hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_14px_rgba(244,63,94,0.35)] shrink-0"
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
