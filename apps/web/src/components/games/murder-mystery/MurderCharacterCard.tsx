'use client';

import React, { useEffect } from 'react';
import type { MurderCard } from '@synccinema/common';
import { AppIcon } from '../../ui/AppIcon';

const ROW = 'rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-white/10 dark:bg-[#1b1c24]';
const LABEL = 'mb-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const BODY = 'text-xs leading-relaxed text-zinc-800 dark:text-zinc-100';

/** The private card of the player's own character. Only ever rendered for the recipient's own `me.card`. */
export const MurderCharacterCard: React.FC<{ card: MurderCard; compact?: boolean }> = ({ card, compact = false }) => (
  <div data-testid="murder-card" className="space-y-2">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white">
        <AppIcon name="glasses" className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">You are</p>
        <h3 className="truncate text-lg font-bold text-zinc-900 dark:text-white">{card.name}</h3>
      </div>
    </div>
    {card.isMurderer && (
      <div className="rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs leading-relaxed text-red-900 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-100" data-testid="murderer-note">
        <p className="mb-0.5 flex items-center gap-1.5 font-bold"><AppIcon name="skull" className="h-3.5 w-3.5" />You are the murderer</p>
        {card.method && <p><strong>How you did it:</strong> {card.method}</p>}
        <p className="mt-0.5">{card.bluffNote || 'Bluff. Do not let anyone find out.'}</p>
      </div>
    )}
    <div className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
      <div className={ROW}><p className={LABEL}>Who you are</p><p className={BODY}>{card.bio}</p></div>
      <div className={ROW}><p className={LABEL}>The victim and you</p><p className={BODY}>{card.relationship}</p></div>
      <div className={ROW}><p className={LABEL}>Your secret motive</p><p className={BODY}>{card.secretMotive}</p></div>
      <div className={ROW}><p className={LABEL}>Your alibi{card.isMurderer ? ' (partly false)' : ''}</p><p className={BODY}>{card.alibi}</p></div>
    </div>
    <div className={ROW}><p className={LABEL}>Your personal secret</p><p className={BODY}>{card.secret}</p></div>
    <p className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><AppIcon name="lock" className="h-3 w-3" />Only you can see this card.</p>
  </div>
);

/** Slide-in drawer with the card, re-openable at any time during the game. */
export const MurderCardDrawer: React.FC<{ open: boolean; card: MurderCard | null; onClose: () => void }> = ({ open, card, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || !card) return null;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Your character card" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#14151b] motion-safe:animate-fadeIn">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Your character card</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] dark:hover:bg-[#22232c] dark:hover:text-white" aria-label="Close card">
            <AppIcon name="close" className="h-4 w-4" />
          </button>
        </div>
        <MurderCharacterCard card={card} compact />
      </div>
    </div>
  );
};

export default MurderCharacterCard;
