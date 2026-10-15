'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { leaderboard, playerName } from '../../../lib/imposterView';
import { PartyPoppers } from '../common/PartyPoppers';
import { ImposterScoreboard } from './ImposterScoreboard';

interface RematchState {
  votedUserIds?: string[];
  votedCount?: number;
  totalNeeded?: number;
}

interface ImposterFinalScreenProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  rematchStatus: RematchState | null;
  rematchUnavailable: boolean;
  onRematch: () => void;
  onLeave: () => void;
}

/** Winner screen after the last round (or after the game was ended early), with rematch. */
export const ImposterFinalScreen: React.FC<ImposterFinalScreenProps> = ({ view, myUserId, isSpectator, rematchStatus, rematchUnavailable, onRematch, onLeave }) => {
  const aborted = view.phase === 'ABORTED';
  const winners = view.winnerUserIds.map((id) => playerName(view.players, id));
  const iWon = view.winnerUserIds.includes(myUserId);
  const iVoted = Boolean(rematchStatus?.votedUserIds?.includes(myUserId));
  const rows = leaderboard(view);
  const top = rows.filter((r) => !r.left).slice(0, 3);
  // podium order: 2nd, 1st, 3rd
  const podium = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;

  return (
    <div data-testid="final-screen" className="mx-auto w-full max-w-xl space-y-3 motion-safe:animate-imposter-in">
      {iWon && !aborted && !isSpectator && <PartyPoppers durationMs={6000} isSoundMuted />}
      <div className={`rounded-2xl border p-4 text-center sm:p-5 ${aborted ? 'border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-[#14151b] dark:text-white' : 'border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-[#18121f] dark:text-white'}`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
          <AppIcon name={aborted ? 'warning' : 'trophy'} className="h-5 w-5" />
        </div>
        {aborted ? (
          <>
            <h2 className="text-2xl font-bold">Game ended</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.statusMessage || 'Not enough players were left to continue.'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Game over</p>
            <h2 className="mt-0.5 text-2xl font-bold sm:text-3xl">{winners.length === 1 ? `${winners[0]} wins!` : `${winners.join(' and ')} win!`}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{rows[0] ? `${rows[0].score} points after ${view.totalRounds} rounds` : ''}</p>
          </>
        )}
        {!aborted && podium.length > 0 && (
          <ol className="mx-auto mt-4 flex max-w-sm items-end justify-center gap-2" data-testid="podium" aria-label="Podium">
            {podium.map((p) => (
              <li key={p.userId} className="flex min-w-0 flex-1 flex-col items-center">
                <span className="w-full truncate text-xs font-semibold text-zinc-900 dark:text-white">{p.name}</span>
                <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{p.score} pts</span>
                <span className={`mt-1 flex w-full items-start justify-center rounded-t-lg pt-1 text-sm font-bold ${p.rank === 1 ? 'h-16 bg-amber-500 text-white' : p.rank === 2 ? 'h-12 bg-zinc-400 text-white dark:bg-zinc-600' : 'h-9 bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100'}`}>{p.rank}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ImposterScoreboard view={view} myUserId={myUserId} title="Final scores" />

      {view.history.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Rounds</h3>
          <ul className="space-y-1">
            {view.history.map((h) => (
              <li key={h.round} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-sm dark:bg-[#1b1c24]">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Round {h.round}: {h.word}</span>
                <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {h.voided ? 'cancelled' : h.winner === 'crew' ? 'crew won' : `${playerName(view.players, h.imposterId)} fooled them`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {!isSpectator && !rematchUnavailable && (
          <button
            type="button"
            onClick={onRematch}
            disabled={iVoted}
            className="h-10 flex-1 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-70 dark:focus-visible:ring-offset-[#0c0d12]"
          >
            {iVoted ? `Waiting for others (${rematchStatus?.votedCount ?? 1}/${rematchStatus?.totalNeeded ?? view.players.length})` : 'Play again'}
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]"
        >
          Back to games
        </button>
      </div>
      {!isSpectator && rematchUnavailable && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">A rematch needs at least 4 players still in the room.</p>}
    </div>
  );
};

export default ImposterFinalScreen;
