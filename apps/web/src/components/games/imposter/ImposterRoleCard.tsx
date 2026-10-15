'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';

interface ImposterRoleCardProps {
  view: Pick<ImposterGameView, 'me' | 'category' | 'round' | 'totalRounds'>;
  /** compact strip shown during the later phases instead of the big reveal card */
  compact?: boolean;
}

/**
 * The private role card. The role and the secret word come from `view.me`, which the server only fills for the
 * recipient themselves: crew get the word, the imposter never does.
 */
export const ImposterRoleCard: React.FC<ImposterRoleCardProps> = ({ view, compact = false }) => {
  const [hidden, setHidden] = useState(false);
  const me = view.me;
  if (!me?.role) return null;
  const imposter = me.role === 'imposter';

  if (compact) {
    return (
      <div
        data-testid="role-strip"
        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
          imposter
            ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
        }`}
      >
        <AppIcon name={imposter ? 'ghost' : 'film'} className="h-[18px] w-[18px] shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          {hidden ? (
            <span className="font-semibold">Role hidden</span>
          ) : imposter ? (
            <span>
              <span className="font-bold">You are the imposter.</span> Category: <span className="font-semibold">{view.category}</span>. Blend in.
            </span>
          ) : (
            <span>
              Secret word: <span className="font-bold">{me.word}</span>
              <span className="opacity-70"> ({view.category})</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-[#22232c]"
          aria-label={hidden ? 'Show my role' : 'Hide my role'}
          title={hidden ? 'Show my role' : 'Hide my role'}
        >
          <AppIcon name="eye" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="role-card"
      className={`rounded-2xl border p-4 text-center text-white sm:p-5 ${
        imposter ? 'border-red-800 bg-red-700 dark:border-red-900 dark:bg-red-950' : 'border-emerald-800 bg-emerald-700 dark:border-emerald-900 dark:bg-emerald-950'
      }`}
    >
      <div>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-white/25">
          <AppIcon name={imposter ? 'ghost' : 'film'} className="h-5 w-5" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
          Round {view.round} of {view.totalRounds}
        </p>
        {hidden ? (
          <>
            <h2 className="mt-1 text-2xl font-bold">Role hidden</h2>
            <p className="mt-1 text-sm text-white/85">Tap the eye to show it again.</p>
          </>
        ) : imposter ? (
          <>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">You are the imposter</h2>
            <p className="mt-2 text-sm text-white/85">The category is</p>
            <p className="mt-0.5 text-2xl font-extrabold">{view.category}</p>
            <p className="mx-auto mt-3 max-w-xs text-sm text-white/85">You do not know the secret word. Listen to the clues and bluff your way through.</p>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">You are on the crew</h2>
            <p className="mt-2 text-sm text-white/85">
              The category is <span className="font-semibold">{view.category}</span>
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/80">Secret word</p>
            <p className="mt-0.5 break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{me.word}</p>
            <p className="mx-auto mt-3 max-w-xs text-sm text-white/85">Give clues that show you know the word, without making it too easy for the imposter.</p>
          </>
        )}
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/30 px-3 text-xs font-semibold transition-colors duration-150 hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <AppIcon name="eye" className="h-4 w-4" />
          {hidden ? 'Show' : 'Hide'}
        </button>
      </div>
    </div>
  );
};

export default ImposterRoleCard;
