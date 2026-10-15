'use client';

import React from 'react';
import type { QuizLeaderboardRow } from '@synccinema/common';
import { QUIZ_LEADERBOARD_TOP } from '@synccinema/common';
import { leaderboardWindow, ordinal } from '../../../lib/quizShowView';
import { ImposterPlayerChip } from '../imposter/ImposterPlayerChip';

interface QuizLeaderboardProps {
  rows: QuizLeaderboardRow[];
  myUserId?: string | null;
  /** how many rows to show before "and N more" (default 10); `null` shows everybody (final screen) */
  limit?: number | null;
  /** reveal: points gained on the question that just ended, per user */
  deltas?: Record<string, number>;
  title?: string;
}

function Row({ r, mine, delta }: { r: QuizLeaderboardRow; mine: boolean; delta?: number }) {
  return (
    <li className={`flex items-center gap-2 rounded-lg px-2 py-1 ${mine ? 'bg-zinc-100 ring-1 ring-[#ee1d49] dark:bg-[#1b1c24]' : ''} ${r.left ? 'opacity-60' : ''}`} data-testid={`lb-row-${r.userId}`}>
      <span className="w-7 shrink-0 text-center text-xs font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{r.rank}</span>
      <ImposterPlayerChip name={r.displayName} avatarUrl={r.avatarUrl} connected={r.connected} left={r.left} isMe={mine} size="sm" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-900 dark:text-white">
        {r.displayName}{mine ? ' (You)' : ''}
        {r.left && <span className="ml-1.5 rounded bg-zinc-200 px-1 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-[#22232c] dark:text-zinc-300">left</span>}
      </span>
      {delta !== undefined && delta !== 0 && (
        <span className={`text-[11px] font-bold tabular-nums ${delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{delta > 0 ? `+${delta}` : delta}</span>
      )}
      <span className="w-14 shrink-0 text-right text-sm font-extrabold tabular-nums text-zinc-900 dark:text-white">{r.score}</span>
    </li>
  );
}

/** Live leaderboard: the top rows (10 by default) plus the viewer's own rank when they are further down. */
export const QuizLeaderboard: React.FC<QuizLeaderboardProps> = ({ rows, myUserId, limit = QUIZ_LEADERBOARD_TOP, deltas, title = 'Leaderboard' }) => {
  const win = leaderboardWindow(rows, myUserId, limit === null ? rows.length : limit);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b]" data-testid="leaderboard">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">No players yet</p>
      ) : (
        <ol className="space-y-0.5">
          {win.top.map((r) => <Row key={r.userId} r={r} mine={r.userId === myUserId} delta={deltas?.[r.userId]} />)}
          {win.hidden > 0 && <li className="px-2 py-0.5 text-center text-[11px] text-zinc-500 dark:text-zinc-400">and {win.hidden} more</li>}
          {win.mine && (
            <>
              <li className="px-2 text-center text-[11px] text-zinc-400" aria-hidden="true">...</li>
              <Row r={win.mine} mine delta={deltas?.[win.mine.userId]} />
            </>
          )}
        </ol>
      )}
      {myUserId && rows.some((r) => r.userId === myUserId) && (
        <p className="mt-1.5 text-center text-[11px] font-medium text-zinc-600 dark:text-zinc-300">You are {ordinal(rows.find((r) => r.userId === myUserId)!.rank)} of {rows.length}</p>
      )}
    </div>
  );
};

export default QuizLeaderboard;
