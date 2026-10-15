'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon } from '../../ui/AppIcon';

/** The few room fields the banner reads. A match room created by a Tournament Arena carries `tournamentId` / `tournamentCode`. */
export interface TournamentLinkedRoom {
  tournamentId?: string | null;
  tournamentCode?: string | null;
  status?: string;
  /** set by the hook when the tournament closed this room from outside the game (no-show, a leaver, the organiser) */
  tournamentNotice?: string | null;
}

/** Where "Back to tournament" goes. */
export function tournamentBackPath(room: TournamentLinkedRoom | null | undefined): string | null {
  return room?.tournamentId && room.tournamentCode ? `/games/tournament?room=${encodeURIComponent(room.tournamentCode)}` : null;
}

/**
 * A small bar on the existing game pages, shown ONLY when the room is a tournament match: "Tournament match" and a "Back to tournament"
 * button. A normal room renders nothing. While the match is running the button opens the tournament in a new tab, so this page keeps its
 * connection (leaving it would forfeit the match).
 */
export const TournamentMatchBanner: React.FC<{ room: TournamentLinkedRoom | null | undefined; className?: string }> = ({ room, className = '' }) => {
  const router = useRouter();
  const path = tournamentBackPath(room);
  if (!path) return null;
  const live = room?.status === 'PLAYING';
  const finished = room?.status === 'FINISHED' || room?.status === 'CANCELLED';
  const text = room?.tournamentNotice
    ? room.tournamentNotice
    : live
      ? 'The result is decided by this game. There is no rematch.'
      : finished
        ? 'This match is over. The bracket moves on by itself.'
        : 'Waiting for your opponent. Open this room in time or you forfeit.';
  return (
    <div
      role="status"
      data-testid="tournament-match-banner"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#14151b] px-3 py-1.5 text-white ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AppIcon name="trophy" className="h-4 w-4 shrink-0 text-[#ee1d49]" />
        <span className="shrink-0 text-xs font-bold">Tournament match</span>
        <span className="truncate text-[11px] text-zinc-300">{text}</span>
      </div>
      <button
        type="button"
        onClick={() => { if (live && typeof window !== 'undefined') window.open(path, '_blank', 'noopener'); else router.push(path); }}
        title={live ? 'Opens the tournament in a new tab so this match keeps running' : undefined}
        className="h-7 shrink-0 rounded-lg bg-[#ee1d49] px-2.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]"
      >
        Back to tournament
      </button>
    </div>
  );
};

export default TournamentMatchBanner;
