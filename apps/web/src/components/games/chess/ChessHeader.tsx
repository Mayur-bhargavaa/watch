'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Check,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  Moon,
  Sun,
  Settings,
  LogOut,
  Users,
  Info
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

interface ChessHeaderProps {
  roomCode: string;
  playerCount?: number;
  isMicMuted: boolean;
  isCameraOn: boolean;
  isChatOpen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleChat: () => void;
  onOpenInfo: () => void;
  isInfoOpen: boolean;
  onOpenSettings: () => void;
  onLeave: () => void;
  isCallClosed?: boolean;
  onOpenCall?: () => void;
  chatCount?: number;
}

export const ChessHeader: React.FC<ChessHeaderProps> = ({
  roomCode,
  playerCount = 2,
  isMicMuted,
  isCameraOn,
  isChatOpen,
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  onOpenInfo,
  isInfoOpen,
  onOpenSettings,
  onLeave,
  isCallClosed = false,
  onOpenCall,
  chatCount = 0
}) => {
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="relative z-30 h-16 px-4 sm:px-6 w-full flex items-center justify-between shrink-0 border-b border-white/10 bg-[#16132b]/50 backdrop-blur-xl transition-all select-none">
      {/* Left: Brand + Back Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/" className="flex items-center group">
          <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
            watch<span className="text-[#ff2b70]">.</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Games</span>
        </button>
      </div>

      {/* Center: Room Code Pill + Players Count */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 shadow-xs">
        <span className="text-xs font-bold text-white/50">Room:</span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-1 font-mono text-xs font-black text-white hover:text-[#ff2b70] transition cursor-pointer"
          title="Click to copy room code"
        >
          <span>{roomCode || 'CHESS-ROOM'}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-white/40" />
          )}
        </button>
        <span className="w-1 h-3 bg-white/20 rounded-full mx-0.5" />
        <div className="flex items-center gap-1 text-[11px] font-bold text-white/70">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{playerCount} Players</span>
        </div>
      </div>

      {/* Right: Media toggles, Chat, Theme, Settings & Leave */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            isMicMuted
              ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 shadow-xs'
          }`}
          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            !isCameraOn
              ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 shadow-xs'
          }`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        {/* Reopen Floating Call Button if closed */}
        {isCallClosed && onOpenCall && (
          <button
            type="button"
            onClick={onOpenCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff2b70]/20 hover:bg-[#ff2b70]/30 text-[#ff2b70] border border-[#ff2b70]/30 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Open Floating Call Window"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Call</span>
          </button>
        )}

        {/* Info Toggle */}
        <button
          type="button"
          onClick={onOpenInfo}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            isInfoOpen
              ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-md shadow-pink-500/20'
              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 shadow-xs'
          }`}
          title="Game Info & Moves"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* Chat Toggle with Badge */}
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative p-2 rounded-xl border transition cursor-pointer ${
            isChatOpen
              ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-md shadow-pink-500/20'
              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 shadow-xs'
          }`}
          title={isChatOpen ? 'Hide Chat' : 'Open Match Chat'}
        >
          <MessageSquare className="w-4 h-4" />
          {chatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff2b70] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
              {chatCount > 9 ? '9+' : chatCount}
            </span>
          )}
        </button>


        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 shadow-xs transition cursor-pointer"
          title="Toggle Dark / Light Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-white/60" />}
        </button>

        {/* Settings Gear */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 shadow-xs transition cursor-pointer"
          title="Game Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Leave Game Button */}
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff2b70] hover:bg-[#e11d48] active:scale-95 text-white font-extrabold text-xs shadow-md shadow-rose-500/25 transition cursor-pointer ml-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave Game</span>
        </button>
      </div>
    </header>
  );
};
