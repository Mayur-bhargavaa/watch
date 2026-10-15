'use client';

import React, { useEffect, useState } from 'react';
import { Eye, Play } from 'lucide-react';
import type { TournamentGameView } from '@synccinema/common';
import { getGameRoom } from '../../../lib/api';
import { isMyMatch, liveMatches, playerName, gameName } from '../../../lib/tournamentView';

interface TournamentLiveMatchesProps {
  view: TournamentGameView;
  myUserId: string;
  isSpectator: boolean;
  onPlay: (roomCode: string) => void;
  onWatch: (roomCode: string) => void;
}

/**
 * Matches that are being played (or waiting for their players). The Watch button is shown only where the existing spectator rule allows it
 * (you are a friend of a player of that match: the server answers `spectatable`).
 */
export const TournamentLiveMatches: React.FC<TournamentLiveMatchesProps> = ({ view, myUserId, isSpectator, onPlay, onWatch }) => {
  const matches = liveMatches(view);
  const [spectatable, setSpectatable] = useState<Record<string, boolean>>({});
  const codes = matches.filter((m) => m.status === 'LIVE' && !isMyMatch(m, myUserId) && m.roomCode).map((m) => m.roomCode as string);
  const key = codes.join(',');

  useEffect(() => {
    let cancelled = false;
    for (const code of codes) {
      if (code in spectatable) continue;
      getGameRoom(code)
        .then((res) => { if (!cancelled) setSpectatable((prev) => ({ ...prev, [code]: Boolean(res.spectatable) })); })
        .catch(() => { if (!cancelled) setSpectatable((prev) => ({ ...prev, [code]: false })); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (view.phase !== 'RUNNING') return null;
  return (
    <section aria-label="Live matches" data-testid="live-matches" className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
      <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-white">Live matches ({matches.length})</h2>
      {matches.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No match is being played right now.</p>
      ) : (
        <ul className="space-y-1.5">
          {matches.map((m) => {
            const mine = isMyMatch(m, myUserId);
            const canWatch = !mine && m.status === 'LIVE' && spectatable[m.roomCode as string] === true;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#1b1c24]" data-testid={`live-${m.id}`}>
                <span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold ${m.status === 'LIVE' ? 'bg-[#ee1d49] text-white' : 'bg-zinc-200 text-zinc-700 dark:bg-[#2a2b35] dark:text-zinc-200'}`}>{m.status === 'LIVE' ? 'Live' : 'Waiting'}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900 dark:text-white">
                  {playerName(view, m.a)} vs {playerName(view, m.b)}
                  <span className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400">{m.roundName}, {gameName(view.config.game)}{m.gameNo > 1 ? `, game ${m.gameNo}` : ''}</span>
                </span>
                {mine && !isSpectator && (
                  <button type="button" onClick={() => onPlay(m.roomCode as string)} className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#ee1d49] px-2.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]">
                    <Play className="h-3 w-3 fill-current" />
                    Play
                  </button>
                )}
                {canWatch && (
                  <button type="button" onClick={() => onWatch(m.roomCode as string)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
                    <Eye className="h-3 w-3" />
                    Watch
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default TournamentLiveMatches;
