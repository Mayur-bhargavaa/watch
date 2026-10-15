'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { leaderboard } from '../../../lib/emojiCharadesView';

interface EmojiCharadesScoreboardProps {
  view: Pick<EmojiCharadesGameView, 'players' | 'scores' | 'result'>;
  myUserId: string;
  /** show "+n" points of the round that just ended */
  showRoundPoints?: boolean;
  title?: string;
}

/** Cumulative leaderboard. */
export const EmojiCharadesScoreboard: React.FC<EmojiCharadesScoreboardProps> = ({ view, myUserId, showRoundPoints = false, title = 'Scoreboard' }) => {
  const rows = leaderboard(view);
  return (
    <div data-testid="scoreboard" className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#16132b] dark:text-white">
        <AppIcon name="trophy" className="h-4 w-4 text-amber-500" />
        {title}
      </h3>
      <ol className="space-y-1.5">
        {rows.map((r) => {
          const gained = showRoundPoints ? view.result?.points?.[r.userId] ?? 0 : 0;
          return (
            <li
              key={r.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${r.userId === myUserId ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-slate-50 dark:bg-white/5'} ${r.left ? 'opacity-50' : ''}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${r.rank === 1 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-zinc-300'}`}>{r.rank}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-[#16132b] dark:text-white">
                {r.name}
                {r.userId === myUserId ? ' (you)' : ''}
              </span>
              {gained > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">+{gained}</span>}
              <span className="w-10 text-right font-black tabular-nums text-[#16132b] dark:text-white">{r.score}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default EmojiCharadesScoreboard;
