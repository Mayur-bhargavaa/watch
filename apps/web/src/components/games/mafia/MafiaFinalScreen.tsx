'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { MafiaGameView } from '@synccinema/common';
import { iWon, roleBadgeClass, roleLabel, timelineByRound, winnerHeadline } from '../../../lib/mafiaView';
import { PartyPoppers } from '../common/PartyPoppers';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';

interface RematchState { votedUserIds?: string[]; votedCount?: number; totalNeeded?: number }

interface MafiaFinalScreenProps {
  view: MafiaGameView;
  isSpectator: boolean;
  rematchStatus: RematchState | null;
  rematchUnavailable: boolean;
  myUserId: string;
  onRematch: () => void;
  onLeave: () => void;
}

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';

/** Final screen: the winning team, every role, the timeline of the game and the rematch button. */
export const MafiaFinalScreen: React.FC<MafiaFinalScreenProps> = ({ view, isSpectator, rematchStatus, rematchUnavailable, myUserId, onRematch, onLeave }) => {
  const aborted = view.phase === 'ABORTED';
  const iVoted = Boolean(rematchStatus?.votedUserIds?.includes(myUserId));
  const rounds = timelineByRound(view.log);
  return (
    <div data-testid="final-screen" className="mx-auto w-full max-w-xl space-y-2.5 motion-safe:animate-imposter-in">
      {!aborted && !isSpectator && iWon(view) && <PartyPoppers durationMs={6000} isSoundMuted />}
      <div className={`${CARD} text-center`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <AppIcon name={aborted ? 'warning' : 'trophy'} className="h-5 w-5" />
        </div>
        {aborted ? (
          <>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Game ended</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.statusMessage || 'Not enough players were left to continue.'}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Game over</p>
            <h2 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">{winnerHeadline(view, isSpectator)}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{view.statusMessage}</p>
          </>
        )}
      </div>

      {!aborted && (
        <div className={CARD} data-testid="role-recap">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Everyone&apos;s role</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {view.players.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 dark:bg-[#1b1c24]">
                <span className="flex min-w-0 items-center gap-2">
                  <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} connected={p.connected} left={p.left || !p.alive} size="sm" />
                  <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{p.displayName}</span>
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${roleBadgeClass(p.role)}`}>{roleLabel(p.role)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rounds.length > 0 && (
        <div className={CARD} data-testid="timeline">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Timeline</h3>
          <ol className="space-y-2">
            {rounds.map((g) => (
              <li key={g.round}>
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Night {g.round}</p>
                <ul className="mt-1 space-y-1">
                  {g.entries.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800 dark:bg-[#1b1c24] dark:text-zinc-100">
                      <AppIcon name={e.kind === 'night_death' ? 'moon' : e.kind === 'elimination' ? 'flag' : e.kind === 'left' ? 'close' : 'sun'} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                      <span>{e.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {!isSpectator && !rematchUnavailable && (
          <button type="button" onClick={onRematch} disabled={iVoted} className="h-10 flex-1 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-70 dark:focus-visible:ring-offset-[#0c0d12]">
            {iVoted ? `Waiting for others (${rematchStatus?.votedCount ?? 1}/${rematchStatus?.totalNeeded ?? view.players.length})` : 'Play again'}
          </button>
        )}
        <button type="button" onClick={onLeave} className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:border-white/10 dark:bg-[#14151b] dark:text-white dark:hover:bg-[#1b1c24]">
          Back to games
        </button>
      </div>
      {!isSpectator && rematchUnavailable && <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">A rematch needs at least 5 players still in the room.</p>}
    </div>
  );
};

export default MafiaFinalScreen;
