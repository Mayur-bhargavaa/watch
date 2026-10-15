'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';
import { formatReplySnippet } from '../ChatReplyUI';

export const ReplyBanner: React.FC<{ message: ChatMessage; onCancel: () => void }> = ({ message, onCancel }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs border-l-3 border-[#ee1d49] animate-in fade-in slide-in-from-bottom-1 w-full max-w-full min-w-0">
    <div className="truncate min-w-0">
      <span className="font-bold text-[#ee1d49] mr-1.5 shrink-0">Replying to {message.senderName}:</span>
      <span className="text-slate-600 dark:text-zinc-300 truncate">{formatReplySnippet(message.content)}</span>
    </div>
    <button type="button" onClick={onCancel} aria-label="Cancel reply" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer shrink-0">
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);
