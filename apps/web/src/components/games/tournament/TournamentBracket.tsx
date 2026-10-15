'use client';

import React from 'react';
import type { TournamentGameView } from '@synccinema/common';
import { roundColumns, thirdPlaceMatch } from '../../../lib/tournamentView';
import { TournamentMatchCard } from './TournamentMatchCard';

interface TournamentBracketProps {
  view: TournamentGameView;
  myUserId: string;
  isHost: boolean;
  serverNowMs: number;
  onAdvance?: (matchId: string, userId: string) => void;
}

/** The whole bracket: one column per round (scrolls sideways on small screens), the third place match underneath. */
export const TournamentBracket: React.FC<TournamentBracketProps> = ({ view, myUserId, isHost, serverNowMs, onAdvance }) => {
  const columns = roundColumns(view);
  const third = thirdPlaceMatch(view);
  if (columns.length === 0) return null;
  return (
    <section aria-label="Bracket" data-testid="bracket" className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
      <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-white">Bracket</h2>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-3">
          {columns.map((col) => (
            <div key={col.round} className="flex w-[210px] shrink-0 flex-col" data-testid={`round-${col.round}`}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{col.name}</h3>
              <div className="flex flex-1 flex-col justify-around gap-2.5">
                {col.matches.map((m) => (
                  <TournamentMatchCard key={m.id} match={m} view={view} myUserId={myUserId} isHost={isHost} serverNowMs={serverNowMs} onAdvance={onAdvance} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {third && (
        <div className="mt-3 max-w-[210px]" data-testid="third-place">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Third place</h3>
          <TournamentMatchCard match={third} view={view} myUserId={myUserId} isHost={isHost} serverNowMs={serverNowMs} onAdvance={onAdvance} />
        </div>
      )}
    </section>
  );
};

export default TournamentBracket;
