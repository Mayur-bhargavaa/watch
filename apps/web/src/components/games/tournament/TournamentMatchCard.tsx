'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { TournamentGameView, TournamentMatch } from '@synccinema/common';
import { advanceState, isMyMatch, matchChip, matchScore, reasonText, seedOf, slotLabel, type MatchTone } from '../../../lib/tournamentView';

const CHIP: Record<MatchTone, string> = {
  idle: 'bg-zinc-100 text-zinc-600 dark:bg-[#22232c] dark:text-zinc-300',
  ready: 'bg-zinc-200 text-zinc-800 dark:bg-[#2a2b35] dark:text-zinc-100',
  live: 'bg-[#ee1d49] text-white',
  done: 'bg-zinc-100 text-zinc-700 dark:bg-[#22232c] dark:text-zinc-200',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
};

interface TournamentMatchCardProps {
  match: TournamentMatch;
  view: TournamentGameView;
  myUserId: string;
  /** the organiser sees the advance buttons when the server allows them */
  isHost: boolean;
  /** server clock now (epoch ms) */
  serverNowMs: number;
  onAdvance?: (matchId: string, userId: string) => void;
}

/** One match of the bracket: the two players (or where they come from), the score, a status chip, the organiser's advance buttons. */
export const TournamentMatchCard: React.FC<TournamentMatchCardProps> = ({ match, view, myUserId, isHost, serverNowMs, onAdvance }) => {
  const mine = isMyMatch(match, myUserId);
  const chip = matchChip(match);
  const score = matchScore(match);
  const advance = isHost && onAdvance ? advanceState(match, serverNowMs) : null;
  const rows: Array<{ slot: 'a' | 'b'; id: string | null; wins: number | null }> = [
    { slot: 'a', id: match.a, wins: score ? score.a : null },
    { slot: 'b', id: match.b, wins: score ? score.b : null }
  ];
  const note = match.status === 'DONE' ? reasonText(match.reason) : match.bestOf > 1 ? `Best of ${match.bestOf}` : '';
  return (
    <div
      data-testid={`match-${match.id}`}
      data-status={match.status}
      className={`rounded-xl border bg-white p-2 text-xs dark:bg-[#14151b] ${mine ? 'border-[#ee1d49] ring-1 ring-[#ee1d49]' : 'border-zinc-200 dark:border-white/10'}`}
    >
      <div className="space-y-1">
        {rows.map((r) => {
          const label = slotLabel(view, match, r.slot);
          const won = match.status === 'DONE' && r.id !== null && match.winnerUserId === r.id;
          const lost = match.status === 'DONE' && r.id !== null && match.winnerUserId !== r.id;
          const seed = seedOf(view, r.id);
          return (
            <div
              key={r.slot}
              className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 ${won ? 'bg-zinc-100 dark:bg-[#22232c]' : ''} ${r.id === myUserId ? 'ring-1 ring-inset ring-[#ee1d49]/60' : ''}`}
            >
              <span className="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{seed ?? ''}</span>
              <span className={`min-w-0 flex-1 truncate ${label.known ? (won ? 'font-bold text-zinc-900 dark:text-white' : lost ? 'font-medium text-zinc-500 dark:text-zinc-500' : 'font-semibold text-zinc-900 dark:text-white') : 'italic text-zinc-500 dark:text-zinc-400'}`}>
                {label.text}
              </span>
              {won && <Check className="h-3.5 w-3.5 shrink-0 text-[#ee1d49]" aria-label="Winner" />}
              {r.wins !== null && <span className="w-4 shrink-0 text-right font-bold tabular-nums text-zinc-700 dark:text-zinc-200">{r.wins}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${CHIP[chip.tone]}`}>
          {chip.tone === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />}
          {chip.label}
        </span>
        {note && <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">{note}</span>}
      </div>
      {advance?.allowed && match.a && match.b && (
        <div className="mt-1.5 space-y-1 border-t border-zinc-100 pt-1.5 dark:border-white/10" data-testid={`advance-${match.id}`}>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-300">{advance.reason}</p>
          <div className="flex gap-1">
            {[match.a, match.b].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onAdvance?.(match.id, id)}
                className="h-7 min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-800 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]"
              >
                Advance {slotLabel(view, match, id === match.a ? 'a' : 'b').text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentMatchCard;
