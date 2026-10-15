'use client';

import React from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { activePlayers, clueRows } from '../../../lib/imposterView';

interface ImposterDiscussPanelProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  onReady: () => void;
}

/** Discussion: the clue board stays visible, chat is open, and "ready to vote" can end the timer early. */
export const ImposterDiscussPanel: React.FC<ImposterDiscussPanelProps> = ({ view, myUserId, isSpectator, onReady }) => {
  const rows = clueRows(view);
  const present = activePlayers(view).filter((p) => p.connected);
  const iAmReady = view.readyToVote.includes(myUserId);
  return (
    <div className="space-y-3" data-testid="discuss-panel">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Everyone&apos;s clues</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.userId} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-white/10 dark:bg-[#1b1c24]">
              <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{row.name}</span>
              <span className="flex flex-wrap justify-end gap-1">
                {row.words.map((w, i) => (
                  <span key={i} className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${w ? 'bg-zinc-200 text-zinc-900 dark:bg-[#2a2b35] dark:text-white' : 'bg-zinc-100 text-zinc-500 line-through dark:bg-[#1b1c24] dark:text-zinc-400'}`}>
                    {w ?? 'skipped'}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 text-center dark:border-white/10 dark:bg-[#14151b] sm:p-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Talk it out in the chat or on a call. Who knows too little about the word?</p>
        {!isSpectator && (
          <button
            type="button"
            onClick={onReady}
            disabled={iAmReady}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#14151b] ${
              iAmReady ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-[#ee1d49] text-white hover:bg-[#d6143c]'
            }`}
          >
            <AppIcon name={iAmReady ? 'check' : 'flag'} className="h-4 w-4" />
            {iAmReady ? 'Waiting for the others' : 'Ready to vote'}
          </button>
        )}
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {view.readyToVote.length} of {present.length} ready
        </p>
      </div>
    </div>
  );
};

export default ImposterDiscussPanel;
