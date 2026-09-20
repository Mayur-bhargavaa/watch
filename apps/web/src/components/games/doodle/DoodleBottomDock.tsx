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
  onLeave
}) => {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Floating Reaction Bar Popup */}
      {showReactions && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#0e101a]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 shadow-2xl z-30 animate-in slide-in-from-bottom-2 duration-150">
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSendReaction(emoji);
                setShowReactions(false);
              }}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Dock Bar */}
      <div className="flex items-center gap-2 bg-[#0e101a]/90 backdrop-blur-lg px-4 py-2 rounded-full border border-white/10 shadow-2xl">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-2.5 rounded-full transition ${
            isMuted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`p-2.5 rounded-full transition ${
            !isCameraOn
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
          title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        <div className="w-[1px] h-5 bg-white/10 mx-1" />

        {/* Chat Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleChat}
          className="relative p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
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
          className={`p-2.5 rounded-full transition ${
            showReactions
              ? 'bg-rose-500/20 text-rose-400'
              : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
          title="Send Reaction"
        >
          <Smile className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-white/10 mx-1" />

        {/* Room Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
          title="Room Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Leave */}
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="p-2.5 rounded-full bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition"
            title="Leave Game"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
