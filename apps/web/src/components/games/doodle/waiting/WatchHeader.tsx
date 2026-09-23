'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle,
  Moon,
  Sun,
  Settings,
  LogOut
} from 'lucide-react';

interface WatchHeaderProps {
  roomCode: string;
  playerCount: number;
  maxPlayers?: number;
  isMicMuted: boolean;
  isCameraOn: boolean;
  unreadChatCount?: number;
  isDark?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleChat: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onLeaveGame: () => void;
  onBackToGames: () => void;
}

export const WatchHeader: React.FC<WatchHeaderProps> = ({
  roomCode,
  playerCount,
  maxPlayers = 2,
  isMicMuted,
  isCameraOn,
  unreadChatCount = 0,
  isDark = false,
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  onToggleTheme,
  onOpenSettings,
  onLeaveGame,
  onBackToGames
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full flex items-center justify-between gap-2 sm:gap-4 py-2 sm:py-3 px-3 sm:px-6 bg-white/70 dark:bg-[#101424]/70 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-xs transition-all">
      {/* Left: Brand logo & Back button */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center select-none cursor-pointer" onClick={onBackToGames}>
          <span className="text-xl sm:text-2xl font-black tracking-tight text-[#16132b] dark:text-white">
            watch<span className="text-[#ff2b70]">.</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onBackToGames}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-200 text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
          title="Back to Games"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back to Games</span>
        </button>
      </div>

      {/* Center: Dynamic Room Code & Player Counter Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs">
          <span className="text-slate-500 dark:text-zinc-400 font-medium hidden sm:inline">
            Room:
          </span>
          <span className="font-mono font-extrabold text-[#16132b] dark:text-white tracking-wide">
            {roomCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1 hover:text-[#ff2b70] transition text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-md cursor-pointer"
            title="Copy Room Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {playerCount}/{maxPlayers} Players
          </span>
        </div>
      </div>

      {/* Right: Audio/Video, Chat, Theme, Settings & Leave Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
            isMicMuted
              ? 'bg-rose-50 text-rose-500 border-rose-200 dark:bg-rose-500/20 dark:border-rose-500/40'
              : 'bg-white/80 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-zinc-300'
          }`}
          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
            !isCameraOn
              ? 'bg-white/80 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-zinc-300'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/40'
          }`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        {/* Chat Drawer Toggle (Pink Button matching reference) */}
        <button
          type="button"
          onClick={onToggleChat}
          className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#ff2b70] hover:bg-[#e0205f] active:scale-95 text-white flex items-center justify-center shadow-xs transition cursor-pointer"
          title="Toggle Chat"
        >
          <MessageCircle className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white text-[#ff2b70] font-black text-[9px] flex items-center justify-center shadow-xs">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition active:scale-95 cursor-pointer"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition active:scale-95 cursor-pointer"
          title="Room Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Leave Game Button (Red Pill Button) */}
        <button
          type="button"
          onClick={onLeaveGame}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white text-xs font-black uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
          title="Leave Room"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Leave Game</span>
        </button>
      </div>
    </header>
  );
};
