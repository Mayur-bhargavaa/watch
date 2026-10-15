'use client';

import React from 'react';
import { Calendar, Film, Gamepad2, Image as ImageIcon, Plus } from 'lucide-react';

export type AttachAction = 'plan' | 'game' | 'movie' | 'draw' | 'image';

const ITEMS: { action: AttachAction; label: string; icon: React.ReactNode }[] = [
  { action: 'plan', label: 'Create Watch Plan', icon: <Calendar className="w-4 h-4 text-[#ee1d49]" /> },
  { action: 'game', label: 'Invite to Game', icon: <Gamepad2 className="w-4 h-4 text-amber-500" /> },
  { action: 'movie', label: 'Share Movie', icon: <Film className="w-4 h-4 text-indigo-500" /> },
  { action: 'draw', label: 'Draw Sticker', icon: <span className="text-sm">🎨</span> },
  { action: 'image', label: 'Attach Image', icon: <ImageIcon className="w-4 h-4 text-emerald-500" /> }
];

interface Props {
  open: boolean;
  onToggle: (e?: React.MouseEvent) => void;
  onClose: () => void;
  onSelect: (action: AttachAction) => void;
  containerRef: React.Ref<HTMLDivElement>;
}

/** The [+] button and its popup list. */
export const AttachMenu: React.FC<Props> = ({ open, onToggle, onClose, onSelect, containerRef }) => (
  <div className="relative shrink-0" ref={containerRef}>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="menu"
      className={`p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0 ${
        open ? 'rotate-45 bg-slate-100 dark:bg-zinc-800' : ''
      }`}
      title="Add plan, game, movie or image"
    >
      <Plus className="w-5 h-5" />
    </button>

    {open && (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-12 left-0 w-52 p-1.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200/80 dark:border-zinc-800 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95"
        >
          {ITEMS.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              onClick={() => onSelect(item.action)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </>
    )}
  </div>
);
