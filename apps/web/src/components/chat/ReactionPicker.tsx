'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface ReactionPickerProps {
  onSelectReaction: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

const COMMON_REACTIONS = ['❤️', '😂', '🔥', '😮', '👏', '😭', '👍'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelectReaction,
  onClose,
  position = 'top',
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-40 flex items-center gap-1 p-1 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl border border-slate-200/80 dark:border-zinc-800/80 animate-in fade-in zoom-in-95 duration-150 ${
        position === 'top' ? '-top-11' : '-bottom-11'
      } left-0`}
    >
      {COMMON_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelectReaction(emoji);
            onClose();
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg hover:scale-125 active:scale-95 transition-transform duration-150 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {emoji}
        </button>
      ))}

      <button
        type="button"
        onClick={() => {
          // Custom reaction or additional options
          const custom = prompt('Enter an emoji:');
          if (custom) {
            onSelectReaction(custom.trim().slice(0, 4));
          }
          onClose();
        }}
        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer ml-0.5"
        title="More emojis"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
