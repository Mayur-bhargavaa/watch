'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useWatchParty } from '../../context/WatchPartyContext';
import { Maximize2, X, Users, Film, Radio } from 'lucide-react';

export const FloatingRoomPiP: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const pathname = usePathname();
  const { activeParty, isPiPEnabled, returnToRoom, leaveParty } = useWatchParty();

  // If not mounted yet (SSR), no active room, PiP disabled, or user is already inside a watch room, do not display
  if (!mounted || !activeParty || !isPiPEnabled || pathname?.startsWith('/room/')) {
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
      className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-[200] w-[220px] xs:w-[260px] sm:w-[320px] max-w-[calc(100vw-24px)] bg-[#12131e]/95 backdrop-blur-2xl border border-white/15 rounded-xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 group"
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
          <div className="flex flex-col items-center justify-center text-zinc-500 gap-1 p-2 sm:p-4 text-center">
            <Film className="w-5 h-5 sm:w-8 sm:h-8 text-rose-500/70 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] text-zinc-300 font-medium">Watch Party Active</span>
          </div>
        )}

        {/* Live Status Pill */}
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-rose-500/40 text-rose-300 text-[9px] sm:text-[10px] font-bold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <Radio className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-400" />
          <span>LIVE</span>
        </div>

        {/* Participant Count */}
        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white text-[9px] sm:text-[10px] font-medium">
          <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-400" />
          <span>{activeParty.participantCount || 1}</span>
        </div>

        {/* Hover Expand Overlay */}
        <button
          onClick={returnToRoom}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white gap-1.5 sm:gap-2 font-semibold text-[11px] sm:text-xs backdrop-blur-xs cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Return to Cinema</span>
        </button>
      </div>

      {/* Info & Action Bar */}
      <div className="p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3 bg-[#161726]/90 border-t border-white/5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-white truncate tracking-wide">
            {activeParty.title || 'Watch Party'}
          </p>
          <p className="text-[9px] sm:text-[10px] text-zinc-400 truncate">
            {activeParty.mediaTitle || 'Synchronized stream active'}
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={returnToRoom}
            className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition shadow-xs cursor-pointer"
            title="Maximize Watch Party"
          >
            <Maximize2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          </button>
          <button
            onClick={leaveParty}
            className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Close Preview"
          >
            <X className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
