'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { canVote, voteProgress, voteTargets } from '../../../lib/imposterView';
import { ImposterPlayerChip } from './ImposterPlayerChip';

interface ImposterVotePanelProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  onVote: (targetUserId: string) => void;
}

/** Voting grid: pick one other player. Votes are final and hidden from everyone until the result. */
export const ImposterVotePanel: React.FC<ImposterVotePanelProps> = ({ view, myUserId, isSpectator, onVote }) => {
  const [pending, setPending] = useState<string | null>(null);
  const mayVote = !isSpectator && canVote(view, myUserId);
  const targets = voteTargets(view, myUserId);
  const progress = voteProgress(view);
  const chosen = view.myVote ?? pending;

  return (
    <div className="space-y-2.5" data-testid="vote-panel">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Who is the imposter?</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{progress.voted} of {progress.needed} voted</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {(isSpectator ? view.players.filter((p) => !p.left) : targets).map((p) => {
            const selected = chosen === p.userId;
            const hasVoted = view.votedUserIds.includes(p.userId);
            return (
              <button
                key={p.userId}
                type="button"
                disabled={!mayVote || Boolean(view.myVote)}
                onClick={() => { setPending(p.userId); onVote(p.userId); }}
                aria-pressed={selected}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:cursor-default ${
                  selected
                    ? 'border-[#ee1d49] bg-white ring-2 ring-[#ee1d49] dark:bg-[#18121f]'
                    : 'border-zinc-200 bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-[#1b1c24] dark:hover:border-white/30'
                }`}
              >
                <ImposterPlayerChip name={p.displayName} avatarUrl={p.avatarUrl} connected={p.connected} left={p.left} />
                <span className="max-w-full truncate text-sm font-semibold text-zinc-900 dark:text-white">{p.displayName}</span>
                {hasVoted && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" title="Has voted">
                    <AppIcon name="check" className="h-3 w-3" />
                  </span>
                )}
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ee1d49] text-white">
                    <AppIcon name="check" className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-xs text-zinc-600 dark:text-zinc-300">
        {isSpectator
          ? 'The players are voting.'
          : view.myVote
            ? 'Vote locked in. Waiting for the others.'
            : 'Tap a player to vote. You cannot vote for yourself, and votes are final.'}
      </p>
    </div>
  );
};

export default ImposterVotePanel;
