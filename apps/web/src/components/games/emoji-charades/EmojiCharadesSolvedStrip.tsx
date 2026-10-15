'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { solvedStrip } from '../../../lib/emojiCharadesView';

interface EmojiCharadesSolvedStripProps {
  view: Pick<EmojiCharadesGameView, 'players' | 'solvedUserIds'>;
  myUserId: string;
}

/** Live "who solved" strip: names and solve order only, never what anybody guessed. */
export const EmojiCharadesSolvedStrip: React.FC<EmojiCharadesSolvedStripProps> = ({ view, myUserId }) => {
  const rows = solvedStrip(view);
  return (
    <div data-testid="solved-strip" className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
      <h3 className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#16132b] dark:text-white">
        <span>Who solved it</span>
        <span className="text-[11px] font-bold normal-case tracking-normal text-slate-500 dark:text-zinc-400">{view.solvedUserIds.length} of {rows.length}</span>
      </h3>
      <ul className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <li
            key={r.userId}
            data-solved={r.solved}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${r.solved ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-zinc-400'} ${!r.connected && !r.solved ? 'opacity-50' : ''}`}
          >
            {r.solved ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">{r.order}</span>
            ) : (
              <AppIcon name="clock" className="h-3.5 w-3.5" />
            )}
            <span className="truncate">{r.name}{r.userId === myUserId ? ' (you)' : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EmojiCharadesSolvedStrip;
