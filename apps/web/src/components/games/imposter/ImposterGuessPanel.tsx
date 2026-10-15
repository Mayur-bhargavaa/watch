'use client';

import React, { useState } from 'react';
import { AppIcon } from '../../ui/AppIcon';
import type { ImposterGameView } from '@synccinema/common';
import { playerName } from '../../../lib/imposterView';

interface ImposterGuessPanelProps {
  view: ImposterGameView;
  myUserId: string;
  isSpectator: boolean;
  onGuess: (guess: string) => void;
}

/** The accused player was the imposter: one last 20 s guess at the secret word decides the round. */
export const ImposterGuessPanel: React.FC<ImposterGuessPanelProps> = ({ view, myUserId, isSpectator, onGuess }) => {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState(false);
  const iAmCaught = !isSpectator && view.me?.role === 'imposter' && view.accusedUserId === myUserId;
  const accused = playerName(view.players, view.accusedUserId);

  if (iAmCaught) {
    return (
      <form
        data-testid="guess-panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || sent) return;
          onGuess(draft.trim());
          setSent(true);
        }}
        className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40 sm:p-4"
      >
        <div className="mb-2 flex items-center gap-2 text-red-800 dark:text-red-200">
          <AppIcon name="ghost" className="h-[18px] w-[18px]" />
          <h3 className="text-base font-bold">You were caught!</h3>
        </div>
        <p className="mb-2.5 text-sm text-zinc-700 dark:text-zinc-300">Guess the secret word in the category <span className="font-semibold">{view.category}</span> and you still win the round.</p>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={40}
            disabled={sent}
            autoFocus
            autoComplete="off"
            placeholder="Your guess"
            className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-900 outline-none focus:border-[#ee1d49] focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 disabled:opacity-60 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white"
          />
          <button type="submit" disabled={sent || !draft.trim()} className="h-10 rounded-xl bg-[#ee1d49] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-60">
            {sent ? 'Sent' : 'Guess'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div data-testid="guess-wait" className="rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-white/10 dark:bg-[#14151b]">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
        <AppIcon name="search" className="h-5 w-5" />
      </div>
      <h3 className="text-base font-bold text-zinc-900 dark:text-white">{accused} got the most votes</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">The imposter gets one last chance to guess the secret word. Hold your breath.</p>
    </div>
  );
};

export default ImposterGuessPanel;
