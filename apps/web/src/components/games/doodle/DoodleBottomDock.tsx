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

      {/* Dock Bar matching Mockup: Rounded-full pill dock with vertical layout: icon + text label */}
      <div
        className={`flex items-center gap-0.5 xs:gap-1 sm:gap-2 backdrop-blur-xl px-2.5 xs:px-3.5 sm:px-5 py-1 sm:py-2 rounded-full border shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-colors max-w-[calc(100vw-16px)] overflow-x-auto scrollbar-none ${
          isDark
            ? 'bg-[#111625]/90 border-white/10 text-zinc-300'
            : 'bg-white/95 border-slate-200/90 text-slate-700 shadow-slate-100'
        }`}
      >
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className="flex flex-col items-center justify-center px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-95 group shrink-0"
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center transition ${
              isMuted
                ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/20'
                : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-200'
            }`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </div>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            Mic
          </span>
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className="flex flex-col items-center justify-center px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-95 group shrink-0"
          title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center transition ${
              !isCameraOn
                ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/20'
                : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-200'
            }`}
          >
            {isCameraOn ? <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </div>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            Camera
          </span>
        </button>

        {/* Chat Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleChat}
          className="relative flex flex-col items-center justify-center px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-95 group shrink-0"
          title="Open Chat"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-200 transition">
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            Chat
          </span>
          {unreadChatCount > 0 && (
            <span className="absolute top-0.5 right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Reactions Picker Toggle */}
        <button
          type="button"
          onClick={() => setShowReactions(!showReactions)}
          className="flex flex-col items-center justify-center px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-95 group shrink-0"
          title="Send Reaction"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-200 transition">
            <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            Reactions
          </span>
        </button>

        {/* More / Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-95 group shrink-0"
          title="Room Settings & Themes"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-200 transition">
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            More
          </span>
        </button>
      </div>
    </div>
  );
};
