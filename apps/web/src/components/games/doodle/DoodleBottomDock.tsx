'use client';

import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MessageCircle, Smile, Settings, LogOut } from 'lucide-react';

interface DoodleBottomDockProps {
  isMuted: boolean;
  isCameraOn: boolean;
  unreadChatCount?: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleChat: () => void;
  onSendReaction: (emoji: string) => void;
  onOpenSettings: () => void;
  onLeave?: () => void;
  isDark?: boolean;
}

const REACTION_EMOJIS = ['🎨', '🧠', '🔥', '😂', '👏', '🤯', '❤️'];

export const DoodleBottomDock: React.FC<DoodleBottomDockProps> = ({
  isMuted,
  isCameraOn,
  unreadChatCount = 0,
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  onSendReaction,
  onOpenSettings,
  onLeave,
  isDark = true
}) => {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Floating Reaction Bar Popup */}
      {showReactions && (
        <div
          className={`absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-2xl z-30 animate-in slide-in-from-bottom-2 duration-150 backdrop-blur-md ${
            isDark
              ? 'bg-[#0e101a]/95 border-white/15 text-white'
              : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
          }`}
        >
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSendReaction(emoji);
                setShowReactions(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 cursor-pointer ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Dock Bar */}
      <div
        className={`flex items-center gap-2 backdrop-blur-lg px-4 py-2 rounded-full border shadow-2xl transition-colors ${
          isDark
            ? 'bg-[#0e101a]/90 border-white/10 text-zinc-300'
            : 'bg-white/95 border-slate-200 text-slate-700 shadow-xl'
        }`}
      >
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-2.5 rounded-full transition active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 ring-1 ring-rose-500/40'
              : isDark
              ? 'bg-white/10 text-emerald-400 hover:bg-white/15'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`p-2.5 rounded-full transition active:scale-95 ${
            !isCameraOn
              ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 ring-1 ring-rose-500/40'
              : isDark
              ? 'bg-white/10 text-emerald-400 hover:bg-white/15'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
          }`}
          title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        <div className={`w-[1px] h-5 mx-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Chat Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative p-2.5 rounded-full transition active:scale-95 ${
            isDark
              ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
          }`}
          title="Open Chat"
        >
          <MessageCircle className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Reactions Picker Toggle */}
        <button
          type="button"
          onClick={() => setShowReactions(!showReactions)}
          className={`p-2.5 rounded-full transition active:scale-95 ${
            showReactions
              ? 'bg-rose-500/20 text-rose-500'
              : isDark
              ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
          }`}
          title="Send Reaction"
        >
          <Smile className="w-4 h-4" />
        </button>

        <div className={`w-[1px] h-5 mx-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Room Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`p-2.5 rounded-full transition active:scale-95 ${
            isDark
              ? 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
          }`}
          title="Room Settings & Themes"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Leave */}
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="p-2.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition active:scale-95"
            title="Leave Game"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
