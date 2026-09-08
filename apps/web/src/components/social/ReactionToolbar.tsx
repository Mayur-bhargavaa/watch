'use client';

import { useEffect } from 'react';

const EMOJI_OPTIONS = [
  { code: 'heart', emoji: '❤️', label: 'Love', key: '1' },
  { code: 'melted', emoji: '🥰', label: 'Adore', key: '2' },
  { code: 'popcorn', emoji: '🍿', label: 'Popcorn', key: '3' },
  { code: 'sparkles', emoji: '✨', label: 'Magic', key: '4' },
  { code: 'fire', emoji: '🔥', label: 'Fire', key: '5' },
  { code: 'aww', emoji: '🥺', label: 'Aww', key: '6' },
  { code: 'cheers', emoji: '🥂', label: 'Cheers', key: '7' }
];

interface ReactionToolbarProps {
  onReact: (code: string, emoji: string) => void;
}

export function ReactionToolbar({ onReact }: ReactionToolbarProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const match = EMOJI_OPTIONS.find(opt => opt.key === e.key);
      if (match) {
        onReact(match.code, match.emoji);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReact]);

  return (
    <div className="flex items-center justify-center space-x-1.5 sm:space-x-3 bg-gradient-to-r from-cinema-card/80 via-cinema-base/90 to-cinema-card/80 backdrop-blur-2xl px-4 py-2 rounded-2xl border border-white/10 shadow-glass-card">
      <span className="text-[11px] font-semibold text-rose-300/80 mr-1 hidden sm:inline select-none">
        Express:
      </span>
      {EMOJI_OPTIONS.map(item => (
        <button
          key={item.code}
          onClick={() => onReact(item.code, item.emoji)}
          className="relative group p-2 hover:bg-white/10 rounded-xl transition-all duration-200 transform active:scale-90 hover:scale-125 hover:shadow-ambient-rose"
          title={`${item.label} (Press ${item.key})`}
        >
          <span className="text-2xl select-none filter drop-shadow-md">{item.emoji}</span>
          <span className="absolute -top-1 -right-1 text-[9px] font-bold text-rose-200 bg-rose-900/80 border border-rose-500/40 rounded-full px-1 opacity-0 group-hover:opacity-100 transition shadow-sm">
            {item.key}
          </span>
        </button>
      ))}
    </div>
  );
}
