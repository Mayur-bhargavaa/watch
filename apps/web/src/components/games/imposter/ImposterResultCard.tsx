'use client';

import React, { useEffect, useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { myPoints, playerName, resultHeadline } from '../../../lib/imposterView';
import { PartyPoppers } from '../common/PartyPoppers';
import { ImposterPlayerChip } from './ImposterPlayerChip';

interface ImposterResultCardProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
}

/**
 * Round result: a short staged reveal (who was accused, then the imposter, then the word) and the votes.
 * Confetti only for the winning side. This is the first time the server sends the secrets, so everything shown here
 * comes from `view.result`.
 */
export const ImposterResultCard: React.FC<ImposterResultCardProps> = ({ view, myUserId, isSpectator }) => {
  const r = view.result;
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [r?.round]);

  if (!r) return null;
  const iAmImposter = r.imposterId === myUserId;
  const iWon = !isSpectator && !r.voided && ((r.winner === 'imposter' && iAmImposter) || (r.winner === 'crew' && !iAmImposter && view.players.some((p) => p.userId === myUserId && !p.left)));
  const pts = myPoints(view, myUserId);
  const accusedName = r.accusedUserId ? playerName(view.players, r.accusedUserId) : null;
  const imposter = view.players.find((p) => p.userId === r.imposterId);

  return (
    <div data-testid="result-card" className="space-y-3">
      {iWon && step >= 1 && <PartyPoppers durationMs={4500} isSoundMuted />}
      <div className={`overflow-hidden rounded-2xl border p-4 text-center text-white sm:p-5 ${r.voided ? 'border-zinc-700 bg-zinc-600 dark:bg-zinc-800' : r.winner === 'crew' ? 'border-emerald-800 bg-emerald-700 dark:border-emerald-900 dark:bg-emerald-950' : 'border-red-800 bg-red-700 dark:border-red-900 dark:bg-red-950'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">Round {r.round} of {view.totalRounds}</p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{resultHeadline(view, myUserId, isSpectator)}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-white/90">{r.reason}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className={`rounded-xl border border-white/25 p-2.5 transition-all duration-200 ${step >= 0 ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Accused</p>
            <p className="mt-0.5 truncate text-base font-bold">{r.tie ? 'Tie vote' : accusedName ?? 'Nobody'}</p>
          </div>
          <div className={`rounded-xl border border-white/25 p-2.5 transition-all duration-200 ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">The imposter</p>
            <div className="mt-0.5 flex items-center justify-center gap-2">
              {imposter && <ImposterPlayerChip name={imposter.displayName} avatarUrl={imposter.avatarUrl} size="sm" connected={imposter.connected} left={imposter.left} />}
              <p className="truncate text-base font-bold">{imposter?.displayName ?? 'Unknown'}</p>
            </div>
          </div>
          <div className={`rounded-xl border border-white/25 p-2.5 transition-all duration-200 ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Secret word ({r.category})</p>
            <p className="mt-0.5 truncate text-base font-bold">{r.word}</p>
          </div>
        </div>

        {r.guess !== null && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold">
            <AppIcon name={r.guessCorrect ? 'check' : 'close'} className="h-4 w-4" />
            Last guess: {r.guess}
          </p>
        )}
        {!isSpectator && pts > 0 && <p className="mt-2 text-base font-bold">You earned +{pts}</p>}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">How everyone voted</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {view.players.filter((p) => !p.left || r.votes[p.userId]).map((p) => {
            const target = r.votes[p.userId];
            return (
              <li key={p.userId} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-sm dark:bg-[#1b1c24]">
                <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{p.displayName}</span>
                <span className={`truncate text-xs font-medium ${target === r.imposterId ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {target ? `voted ${playerName(view.players, target)}` : 'did not vote'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default ImposterResultCard;
