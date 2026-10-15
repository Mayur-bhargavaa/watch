'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { myPoints, playerName } from '../../../lib/emojiCharadesView';

interface EmojiCharadesRevealCardProps {
  view: EmojiCharadesGameView;
  myUserId: string;
  isSpectator: boolean;
  msLeft: number;
}

const ORDINAL = ['', '1st', '2nd', '3rd'];

/** Round reveal: the answer (the first time the server sends it to everybody), who solved it in which order, and the points. */
export const EmojiCharadesRevealCard: React.FC<EmojiCharadesRevealCardProps> = ({ view, myUserId, isSpectator, msLeft }) => {
  const r = view.result;
  if (!r) return null;
  const mine = myPoints(view, myUserId);
  const solved = r.solves.length > 0;
  const lastRound = view.round >= view.totalRounds;

  return (
    <div data-testid="reveal-card" className="space-y-4">
      <div className={`overflow-hidden rounded-[2rem] p-6 text-center text-white shadow-xl sm:p-8 ${solved ? 'bg-gradient-to-br from-emerald-500 to-sky-600' : 'bg-gradient-to-br from-slate-500 to-slate-700'}`}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Round {r.round} of {view.totalRounds}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-4xl leading-none sm:text-5xl" aria-hidden="true">
          {r.emoji.map((e, i) => <span key={`${i}-${e}`}>{e}</span>)}
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/70">The answer</p>
        <h2 className="mt-1 break-words text-3xl font-black sm:text-4xl" data-testid="reveal-answer">{r.answer}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/90">{r.reason}</p>
        {!isSpectator && mine > 0 && <p className="mt-3 text-lg font-black">You earned +{mine}</p>}
        {!isSpectator && mine === 0 && view.me && !view.me.solved && <p className="mt-3 text-sm font-bold text-white/90">You did not get this one</p>}
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold" role="status">
          <AppIcon name="clock" className="h-3.5 w-3.5" />
          {lastRound ? 'Final scores in' : 'Next round in'} {Math.max(0, Math.ceil(msLeft / 1000))}s
        </p>
      </div>

      <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 sm:p-5">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[#16132b] dark:text-white">Who got it</h3>
        {r.solves.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400">Nobody solved this one.</p>
        ) : (
          <ul className="space-y-1.5">
            {r.solves.map((s) => (
              <li key={s.userId} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="flex min-w-0 items-center gap-2 font-bold text-slate-700 dark:text-zinc-200">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{ORDINAL[s.order] ?? `${s.order}th`}</span>
                  <span className="truncate">{playerName(view.players, s.userId)}{s.userId === myUserId ? ' (you)' : ''}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                  {(s.atMs / 1000).toFixed(1)}s
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">+{s.points}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {r.unsolvedUserIds.length > 0 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">Did not solve it: {r.unsolvedUserIds.map((id) => playerName(view.players, id)).join(', ')}</p>
        )}
      </div>
    </div>
  );
};

export default EmojiCharadesRevealCard;
