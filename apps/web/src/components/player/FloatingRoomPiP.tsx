'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useWatchParty } from '../../context/WatchPartyContext';
import { Maximize2, X, Users, Film, Radio } from 'lucide-react';

export const FloatingRoomPiP: React.FC = () => {
  const pathname = usePathname();
  const { activeParty, isPiPEnabled, returnToRoom, leaveParty } = useWatchParty();

  // If no active room, PiP disabled, or user is already inside a watch room, do not display
  if (!activeParty || !isPiPEnabled || pathname?.startsWith('/room/')) {
    return null;
  }

  // Extract YouTube ID if applicable
  const getYouTubeThumbnail = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  const ytThumbnail = getYouTubeThumbnail(activeParty.mediaUrl);

  return (
    <aside
      aria-label="Active Watch Party Preview"
      className="fixed bottom-4 right-4 z-[200] w-[280px] sm:w-[320px] bg-[#12131e]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 group"
    >
      {/* Top Media Preview Container */}
      <div className="relative aspect-video w-full bg-black/80 overflow-hidden flex items-center justify-center">
        {ytThumbnail ? (
          <img
            src={ytThumbnail}
            alt={activeParty.mediaTitle || 'Playing media'}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 gap-1.5 p-4 text-center">
            <Film className="w-8 h-8 text-rose-500/70 animate-pulse" />
            <span className="text-[11px] text-zinc-300 font-medium">Watch Party in Progress</span>
          </div>
        )}

        {/* Live Status Pill */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-rose-500/40 text-rose-300 text-[10px] font-bold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <Radio className="w-3 h-3 text-rose-400" />
          <span>LIVE</span>
        </div>

        {/* Participant Count */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white text-[10px] font-medium">
          <Users className="w-3 h-3 text-zinc-400" />
          <span>{activeParty.participantCount || 1}</span>
        </div>

        {/* Hover Expand Overlay */}
        <button
          onClick={returnToRoom}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white gap-2 font-semibold text-xs backdrop-blur-xs"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Return to Cinema</span>
        </button>
      </div>

      {/* Info & Action Bar */}
      <div className="p-3 flex items-center justify-between gap-3 bg-[#161726]/90 border-t border-white/5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate tracking-wide">
            {activeParty.title || 'Watch Party'}
          </p>
          <p className="text-[10px] text-zinc-400 truncate">
            {activeParty.mediaTitle || 'Synchronized stream active'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={returnToRoom}
            className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition shadow-xs"
            title="Maximize Watch Party"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={leaveParty}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition"
            title="Close Preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
