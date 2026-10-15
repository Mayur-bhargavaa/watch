'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import { MAFIA_SKIP_VOTE } from '@synccinema/common';
import type { MafiaGameView } from '@synccinema/common';
import { canVote, livingPlayers, playerName, roleBadgeClass, roleLabel, voteProgress, voteTargets, votesNeeded } from '../../../lib/mafiaView';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';

const CARD = 'rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4';

/** DAWN: who died (or that nobody did), with the role revealed, and the detective's private answer. */
export const MafiaDawnCard: React.FC<{ view: MafiaGameView }> = ({ view }) => {
  const dead = view.dawnDeathUserId ? view.players.find((p) => p.userId === view.dawnDeathUserId) : null;
  const finding = view.me?.role === 'detective' ? view.me.investigations.find((i) => i.round === view.round) : null;
  return (
    <div className="space-y-2.5" data-testid="dawn-card">
      <div className={`${CARD} text-center`}>
        <AppIcon name={dead ? 'skull' : 'sun'} className="mx-auto mb-2 h-6 w-6 text-zinc-600 dark:text-zinc-300" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Night {view.round} is over</p>
        {dead ? (
          <>
            <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{dead.displayName} was killed</h2>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              They were
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${roleBadgeClass(dead.role)}`}>{roleLabel(dead.role)}</span>
            </p>
          </>
        ) : (
          <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">Nobody died</h2>
        )}
      </div>
      {finding && (
        <div className={`${CARD} flex items-center justify-between gap-2`} data-testid="dawn-finding">
          <span className="text-sm text-zinc-800 dark:text-zinc-100">Your investigation: <span className="font-semibold">{playerName(view.players, finding.targetUserId)}</span></span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${finding.isMafia ? 'bg-red-700' : 'bg-emerald-700'}`}>{finding.isMafia ? 'Mafia' : 'Not mafia'}</span>
        </div>
      )}
    </div>
  );
};

/** DAY: the roster and the "ready to vote" shortcut. */
export const MafiaDayPanel: React.FC<{ view: MafiaGameView; myUserId: string; isSpectator: boolean; onReady: () => void }> = ({ view, myUserId, isSpectator, onReady }) => {
  const living = livingPlayers(view);
  const present = living.filter((p) => p.connected);
  return (
    <div className="space-y-2.5" data-testid="day-panel">
      <div className={CARD}>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Who is still in the game ({living.length})</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {living.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 dark:border-white/10 dark:bg-[#1b1c24]">
              <span className="flex min-w-0 items-center gap-2">
                <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} connected={p.connected} size="sm" />
                <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{p.displayName}</span>
              </span>
              {view.readyToVote.includes(p.userId) && <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">ready</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${CARD} flex flex-col items-center gap-2.5 text-center`}>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Talk it out in the Town chat or on a call. Who is acting strangely?</p>
        {!isSpectator && view.me?.alive && <ReadyButton ready={view.readyToVote.includes(myUserId)} count={view.readyToVote.length} onReady={onReady} />}
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{view.readyToVote.length} of {present.length} ready</p>
      </div>
    </div>
  );
};

const ReadyButton: React.FC<{ ready: boolean; count: number; onReady: () => void }> = ({ ready, count, onReady }) => (
  <button
    type="button"
    onClick={onReady}
    disabled={ready}
    className={`inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b] ${ready ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-[#ee1d49] text-white hover:bg-[#d6143c]'}`}
  >
    <AppIcon name={ready ? 'check' : 'flag'} className="h-4 w-4" />
    {ready ? 'Waiting for the others' : 'Ready to vote'}
    <span className="sr-only">{count} ready</span>
  </button>
);

/** VOTE: pick a living player or skip. Votes are final and hidden until the result. */
export const MafiaVotePanel: React.FC<{ view: MafiaGameView; myUserId: string; isSpectator: boolean; onVote: (target: string) => void }> = ({ view, myUserId, isSpectator, onVote }) => {
  const [pending, setPending] = useState<string | null>(null);
  const may = !isSpectator && canVote(view);
  const targets = isSpectator || !view.me ? livingPlayers(view) : voteTargets(view, myUserId);
  const progress = voteProgress(view);
  const chosen = view.myVote ?? pending;
  const needed = votesNeeded(livingPlayers(view).length);
  const pick = (id: string) => { setPending(id); onVote(id); };
  return (
    <div className="space-y-2.5" data-testid="vote-panel">
      <div className={CARD}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Who should be eliminated? ({needed} votes needed)</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{progress.voted} of {progress.needed} voted</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {targets.map((p) => {
            const selected = chosen === p.userId;
            return (
              <button
                key={p.userId}
                type="button"
                disabled={!may || Boolean(view.myVote)}
                onClick={() => pick(p.userId)}
                aria-pressed={selected}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:cursor-default ${selected ? 'border-[#ee1d49] bg-white ring-2 ring-[#ee1d49] dark:bg-[#1b1c24]' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-[#1b1c24] dark:hover:border-white/30'}`}
              >
                <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} connected={p.connected} />
                <span className="max-w-full truncate text-sm font-semibold text-zinc-900 dark:text-white">{p.displayName}</span>
                {view.votedUserIds.includes(p.userId) && (
                  <span className="absolute left-1.5 top-1.5 inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" title="Has voted"><AppIcon name="check" className="h-3 w-3" /></span>
                )}
                {selected && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ee1d49] text-white"><AppIcon name="check" className="h-3 w-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
          {!isSpectator && view.me?.alive && (
            <button
              type="button"
              disabled={!may || Boolean(view.myVote)}
              onClick={() => pick(MAFIA_SKIP_VOTE)}
              aria-pressed={chosen === MAFIA_SKIP_VOTE}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-2 py-3 text-center text-sm font-semibold text-zinc-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:cursor-default dark:text-zinc-100 ${chosen === MAFIA_SKIP_VOTE ? 'border-[#ee1d49] ring-2 ring-[#ee1d49]' : 'border-zinc-300 hover:border-zinc-500 dark:border-white/20'}`}
            >
              <AppIcon name="flag" className="h-5 w-5" />
              Skip
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-zinc-600 dark:text-zinc-300">
        {isSpectator ? 'The players are voting.' : !view.me?.alive ? 'Dead players cannot vote.' : view.myVote ? 'Vote locked in. Waiting for the others.' : 'Tap a player or skip. Votes are final and hidden until everyone has voted.'}
      </p>
    </div>
  );
};

/** VOTE_RESULT: the elimination reveal with everyone's (now public) votes. */
export const MafiaVoteResultCard: React.FC<{ view: MafiaGameView }> = ({ view }) => {
  const r = view.voteResult;
  if (!r) return null;
  const out = r.eliminatedUserId ? view.players.find((p) => p.userId === r.eliminatedUserId) : null;
  return (
    <div className="space-y-2.5" data-testid="vote-result">
      <div className={`${CARD} text-center`}>
        <AppIcon name={out ? 'skull' : 'flag'} className="mx-auto mb-2 h-6 w-6 text-zinc-600 dark:text-zinc-300" />
        {out ? (
          <>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{out.displayName} was voted out</h2>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">They were <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${roleBadgeClass(r.eliminatedRole)}`}>{roleLabel(r.eliminatedRole)}</span></p>
          </>
        ) : (
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Nobody was eliminated</h2>
        )}
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{r.text}</p>
      </div>
      <div className={CARD}>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Who voted for whom</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {Object.entries(r.votes).map(([voter, target]) => (
            <li key={voter} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs dark:bg-[#1b1c24]">
              <span className="truncate font-semibold text-zinc-800 dark:text-zinc-100">{playerName(view.players, voter)}</span>
              <span className="truncate text-zinc-600 dark:text-zinc-300">{playerName(view.players, target)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
