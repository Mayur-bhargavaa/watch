'use client';

import React, { useState } from 'react';
import type { MurderGameView } from '@synccinema/common';
import { MURDER_MOTIVE_MAX } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { accusableCharacters, accuseCheck, accusationProgress, characterName, playerName } from '../../../lib/murderMysteryView';

interface MurderAccusationProps {
  view: MurderGameView;
  onAccuse: (characterId: string, motive: string) => void;
  className?: string;
}

/** The secret accusation: a compact grid of the other characters (name and role-play bio) and a short motive guess. Final once sent. */
export const MurderAccusation: React.FC<MurderAccusationProps> = ({ view, onAccuse, className = '' }) => {
  const me = view.me;
  const [pick, setPick] = useState<string | null>(null);
  const [motive, setMotive] = useState('');
  const progress = accusationProgress(view);
  const mine = me?.myAccusation ?? null;
  const check = accuseCheck(pick, motive, me?.characterId ?? null);

  if (!me) {
    return (
      <section data-testid="murder-accusation" className={`rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-white/10 dark:bg-[#14151b] ${className}`}>
        <AppIcon name="eye" className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">The suspects are making their accusations</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{progress.submitted} of {progress.needed} have decided. Nobody sees who they accused until the truth comes out.</p>
      </section>
    );
  }

  if (mine) {
    return (
      <section data-testid="murder-accusation" className={`rounded-2xl border border-zinc-200 bg-white p-4 text-center dark:border-white/10 dark:bg-[#14151b] ${className}`}>
        <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><AppIcon name="check" className="h-5 w-5" /></span>
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Accusation sent</h2>
        <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">You accused <strong>{characterName(view, mine.characterId)}</strong>{mine.motive ? `: "${mine.motive}"` : ''}.</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Waiting for the others ({progress.submitted} of {progress.needed}). It is final.</p>
      </section>
    );
  }

  const options = accusableCharacters(view, me.characterId);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.ok || !pick) return;
    onAccuse(pick, motive.trim());
  };

  return (
    <form onSubmit={submit} data-testid="murder-accusation" className={`flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white"><AppIcon name="search" className="h-4 w-4 text-[#ee1d49]" />Who did it?</h2>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{progress.submitted} of {progress.needed} have accused</span>
      </div>
      <div role="radiogroup" aria-label="Accuse a character" className="grid max-h-[40vh] min-h-0 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((c) => {
          const on = pick === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPick(c.id)}
              className={`rounded-xl border p-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${on ? 'border-[#ee1d49] bg-[#ee1d49] text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-100 dark:hover:bg-[#22232c]'} ${c.withdrawn ? 'opacity-70' : ''}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-bold">{c.name}</span>
                {on && <AppIcon name="check" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
              </span>
              <span className={`mt-0.5 line-clamp-2 block text-[11px] leading-snug ${on ? 'text-white/90' : 'text-zinc-600 dark:text-zinc-300'}`}>{c.bio}</span>
              <span className={`mt-0.5 block truncate text-[10px] font-semibold ${on ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {c.withdrawn ? 'Left the party' : `Played by ${playerName(view.players, c.userId)}`}
              </span>
            </button>
          );
        })}
      </div>
      <label className="mt-2 block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300" htmlFor="murder-motive">Why did they do it? (a short guess)</label>
      <input
        id="murder-motive"
        type="text"
        value={motive}
        maxLength={MURDER_MOTIVE_MAX}
        onChange={(e) => setMotive(e.target.value)}
        placeholder="Their motive..."
        className="mt-1 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 placeholder-zinc-500 focus:border-[#ee1d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]/30 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white dark:placeholder-zinc-400"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{check.ok ? 'Your accusation is final once sent.' : check.reason}</p>
        <button type="submit" disabled={!check.ok} className="h-9 shrink-0 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]">
          Accuse
        </button>
      </div>
    </form>
  );
};

export default MurderAccusation;
