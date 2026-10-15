'use client';

import React, { useState } from 'react';
import type { MurderGameView } from '@synccinema/common';
import { MURDER_MAX_SHARES } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';
import { canShareClue, characterName, cluesByRound, evidenceByRound } from '../../../lib/murderMysteryView';

type Tab = 'public' | 'evidence' | 'mine';

interface MurderClueBoardProps {
  view: MurderGameView;
  onShareClue: (clueId: string) => void;
  className?: string;
}

const ITEM = 'rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs leading-relaxed text-zinc-800 dark:border-white/10 dark:bg-[#1b1c24] dark:text-zinc-100';
const HEAD = 'mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

/** The clue board: public clues by round, the evidence other players chose to share, and the player's own private clues. */
export const MurderClueBoard: React.FC<MurderClueBoardProps> = ({ view, onShareClue, className = '' }) => {
  const mine = view.me?.privateClues ?? [];
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'public', label: 'Public clues', count: view.clues.reduce((n, r) => n + r.clues.length, 0) },
    { id: 'evidence', label: 'Evidence', count: view.evidence.length },
    ...(view.me ? [{ id: 'mine' as Tab, label: 'My clues', count: mine.length }] : [])
  ];
  const [tab, setTab] = useState<Tab>('public');
  const active = tabs.some((t) => t.id === tab) ? tab : 'public';
  const evidence = evidenceByRound(view.evidence);

  return (
    <section data-testid="murder-clue-board" className={`flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#14151b] ${className}`}>
      <div role="tablist" aria-label="Clue board" className="mb-2 inline-flex w-full rounded-xl bg-zinc-100 p-0.5 dark:bg-[#22232c]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={`h-7 flex-1 rounded-lg px-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] ${active === t.id ? 'bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-[#ee1d49] dark:text-white dark:ring-0' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {active === 'public' && (
          <>
            {view.case && (
              <div className={ITEM} data-testid="murder-case-info">
                <p className={HEAD}>The case: {view.case.title}</p>
                <p><strong>{view.case.victim.name}</strong>. {view.case.victim.bio}</p>
                <p className="text-zinc-600 dark:text-zinc-300">{view.case.victim.causeOfDeath}</p>
              </div>
            )}
            {view.clues.length === 0 && <p className="py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">The first clues arrive with round 1.</p>}
            {view.clues.map((r) => (
              <div key={r.round}>
                <p className={HEAD}>Round {r.round}{r.title ? `: ${r.title}` : ''}</p>
                <ul className="space-y-1">
                  {r.clues.map((c) => (
                    <li key={c.id} className={`${ITEM} flex items-start gap-2`}>
                      <AppIcon name="search" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ee1d49]" />
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        {active === 'evidence' && (
          <>
            {evidence.length === 0 && <p className="py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">Nobody has shared a private clue yet.</p>}
            {evidence.map((g) => (
              <div key={g.round}>
                <p className={HEAD}>Shared in round {g.round}</p>
                <ul className="space-y-1">
                  {g.items.map((e) => (
                    <li key={e.clueId} className={ITEM}>
                      <p>{e.text}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Shared by {characterName(view, e.characterId)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        {active === 'mine' && view.me && (
          <>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400" data-testid="shares-left">
              Reveal a clue to everyone to add it to the evidence and earn points. Shares left: {view.me.sharesLeft} of {MURDER_MAX_SHARES}.
            </p>
            {mine.length === 0 && <p className="py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">You have no private clues yet. They arrive with the rounds.</p>}
            {cluesByRound(mine).map((g) => (
              <div key={g.round}>
                <p className={HEAD}>Round {g.round}</p>
                <ul className="space-y-1">
                  {g.clues.map((c) => (
                    <li key={c.id} className={ITEM}>
                      <p className="flex items-start gap-2"><AppIcon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" /><span>{c.text}</span></p>
                      <div className="mt-1.5 flex justify-end">
                        {c.shared ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><AppIcon name="check" className="h-3 w-3" />Shared with everyone</span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canShareClue(view, c)}
                            onClick={() => onShareClue(c.id)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#ee1d49] px-2.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[#14151b]"
                          >
                            <AppIcon name="share" className="h-3 w-3" />
                            Reveal my clue to everyone
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
};

export default MurderClueBoard;
