'use client';

import React from 'react';
import type { TournamentGameView } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { ordinal, playerName, podium } from '../../../lib/tournamentView';
import { BingoPartyPoppers } from '../bingo-duel/BingoPartyPoppers';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';

interface TournamentFinalScreenProps {
  view: TournamentGameView;
  myUserId: string;
  isSpectator: boolean;
  onLeave: () => void;
}

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';
const PODIUM_HEIGHT: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };
const PODIUM_FILL: Record<number, string> = { 1: 'bg-[#ee1d49]', 2: 'bg-zinc-600', 3: 'bg-zinc-500' };

/** The end of the tournament: the champion, the podium (champion, runner-up, third place), everybody's result. Or why it ended early. */
export const TournamentFinalScreen: React.FC<TournamentFinalScreenProps> = ({ view, myUserId, isSpectator, onLeave }) => {
  const aborted = view.phase === 'ABORTED';
  const st = view.standings;
  const championName = st?.championUserId ? playerName(view, st.championUserId) : '';
  const top = podium(st);
  const mine = st?.rows.find((r) => r.userId === myUserId);
  const iWon = Boolean(st?.championUserId && st.championUserId === myUserId);

  return (
    <div data-testid="final-screen" className="space-y-2.5 motion-safe:animate-imposter-in">
      {!aborted && championName && <BingoPartyPoppers durationMs={6000} isSoundMuted />}
      <div className={`${CARD} text-center`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <AppIcon name={aborted ? 'warning' : 'trophy'} className="h-5 w-5" />
        </div>
        {aborted ? (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Tournament ended</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.statusMessage || 'The tournament was stopped.'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Champion</p>
            <h2 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl" data-testid="winner-headline">{championName ? `${championName} wins!` : 'The tournament is over'}</h2>
            {!isSpectator && mine && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{iWon ? 'You won the tournament!' : `You finished ${ordinal(mine.rank)}: ${mine.label}.`}</p>}
          </>
        )}
      </div>

      {!aborted && top.length > 0 && (
        <div className={CARD} data-testid="podium" aria-label="Podium">
          <div className="flex items-end justify-center gap-2">
            {top.map((r) => (
              <div key={r.userId} className="flex w-24 flex-col items-center sm:w-28" data-testid={`podium-${r.rank}`}>
                <ImposterPlayerChip name={r.displayName} avatarUrl={r.avatarUrl} left={r.left} isMe={r.userId === myUserId} />
                <p className="mt-1 w-full truncate text-center text-xs font-bold text-zinc-900 dark:text-white">{r.displayName}</p>
                <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{r.rank === 1 ? 'Champion' : r.rank === 2 ? 'Runner-up' : 'Third place'}</p>
                <div className={`mt-1 flex w-full items-center justify-center rounded-t-lg text-lg font-extrabold text-white ${PODIUM_HEIGHT[r.rank] ?? 'h-10'} ${PODIUM_FILL[r.rank] ?? 'bg-zinc-500'}`}>{r.rank}</div>
              </div>
            ))}
          </div>
          {st && !st.thirdPlaceUserId && <p className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">There was no third place match: both losing semi-finalists share third.</p>}
        </div>
      )}

      {st && (
        <div className={CARD} data-testid="standings">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Final standings</h3>
          <ol className="space-y-0.5">
            {st.rows.map((r) => (
              <li key={r.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${r.userId === myUserId ? 'bg-zinc-100 ring-1 ring-[#ee1d49] dark:bg-[#1b1c24]' : ''} ${r.left ? 'opacity-60' : ''}`}>
                <span className="w-7 shrink-0 text-center text-xs font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{r.rank}</span>
                <ImposterPlayerChip name={r.displayName} avatarUrl={r.avatarUrl} left={r.left} isMe={r.userId === myUserId} size="sm" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-900 dark:text-white">{r.displayName}{r.userId === myUserId ? ' (You)' : ''}</span>
                <span className="shrink-0 text-[11px] text-zinc-600 dark:text-zinc-300">{r.label}</span>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{r.matchWins}-{r.matchLosses}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <button type="button" onClick={onLeave} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
        Back to games
      </button>
    </div>
  );
};

export default TournamentFinalScreen;
