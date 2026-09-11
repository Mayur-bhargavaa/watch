'use client';

import React from 'react';
import { CornerUpLeft, X } from 'lucide-react';
import { ChatReplyTo } from '@synccinema/common';
import { parseStickerMessage } from './StickersData';

export function formatReplySnippet(content: string): string {
  if (parseStickerMessage(content)) {
    return '🖼️ Sticker';
  }
  return content.length > 50 ? content.slice(0, 50) + '...' : content;
}

export interface ChatReplyQuoteProps {
  replyTo: ChatReplyTo;
  onJumpToMessage: (id: string) => void;
  accentColor?: 'rose' | 'amber' | 'red';
}

export function ChatReplyQuote({
  replyTo,
  onJumpToMessage,
  accentColor = 'rose'
}: ChatReplyQuoteProps) {
  const borderColor =
    accentColor === 'amber'
      ? 'border-amber-400'
      : accentColor === 'red'
      ? 'border-red-400'
      : 'border-rose-400';

  const nameColor =
    accentColor === 'amber'
      ? 'text-amber-300'
      : accentColor === 'red'
      ? 'text-red-300'
      : 'text-rose-300';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJumpToMessage(replyTo.id);
      }}
      className={`w-full text-left mb-1.5 px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 border-l-2 ${borderColor} transition-all flex items-start gap-1.5 group cursor-pointer`}
      title="Click to jump to original message"
    >
      <CornerUpLeft className="w-3 h-3 text-white/60 group-hover:text-white shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className={`block font-bold text-[10px] truncate ${nameColor}`}>
          {replyTo.userName}
        </span>
        <span className="block text-[10px] text-white/70 truncate leading-tight">
          {formatReplySnippet(replyTo.content)}
        </span>
      </div>
    </button>
  );
}

export interface ChatReplyingBannerProps {
  replyingTo: ChatReplyTo;
  onCancel: () => void;
  accentColor?: 'rose' | 'amber' | 'red';
}

export function ChatReplyingBanner({
  replyingTo,
  onCancel,
  accentColor = 'rose'
}: ChatReplyingBannerProps) {
  const containerStyle =
    accentColor === 'amber'
      ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
      : accentColor === 'red'
      ? 'bg-red-950/50 border-red-500/40 text-red-200'
      : 'bg-rose-950/50 border-rose-500/40 text-rose-200';

  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150 ${containerStyle}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <CornerUpLeft className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <div className="flex items-center gap-1.5 text-xs truncate">
          <span className="text-[11px] font-medium text-white/70">Replying to</span>
          <span className="text-[11px] font-bold text-white truncate">
            {replyingTo.userName}:
          </span>
          <span className="text-[11px] text-white/60 truncate italic max-w-[140px] sm:max-w-[200px]">
            {formatReplySnippet(replyingTo.content)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition cursor-pointer"
        title="Cancel reply (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
