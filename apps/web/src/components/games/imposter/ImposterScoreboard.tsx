'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { leaderboard } from '../../../lib/imposterView';

interface ImposterScoreboardProps {
  view: Pick<ImposterGameView, 'players' | 'scores' | 'result'>;
  myUserId: string;
  /** show "+n" points of the round that just ended */
  showRoundPoints?: boolean;
  title?: string;
}

/** Cumulative leaderboard. */
export const ImposterScoreboard: React.FC<ImposterScoreboardProps> = ({ view, myUserId, showRoundPoints = false, title = 'Scoreboard' }) => {
  const rows = leaderboard(view);
  return (
    <div data-testid="scoreboard" className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <AppIcon name="trophy" className="h-4 w-4 text-zinc-500" />
        {title}
      </h3>
      <ol className="space-y-1">
        {rows.map((r) => {
          const gained = showRoundPoints ? view.result?.points?.[r.userId] ?? 0 : 0;
          return (
            <li
              key={r.userId}
              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm ${r.userId === myUserId ? 'border-[#ee1d49] bg-white dark:bg-[#18121f]' : 'border-transparent bg-zinc-50 dark:bg-[#1b1c24]'} ${r.left ? 'opacity-50' : ''}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${r.rank === 1 ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-700 dark:bg-[#22232c] dark:text-zinc-300'}`}>{r.rank}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-900 dark:text-white">
                {r.name}
                {r.userId === myUserId ? ' (you)' : ''}
              </span>
              {gained > 0 && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">+{gained}</span>}
              <span className="w-8 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{r.score}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ImposterScoreboard;
