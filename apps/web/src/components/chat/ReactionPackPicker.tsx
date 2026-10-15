'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { REACTION_PACKS } from '@synccinema/common';

interface ReactionPackPickerProps {
  /** Watch+ members can send the premium packs */
  canUsePremium: boolean;
  /** the free Classic row (icon buttons) is rendered by the room page */
  classicRow: React.ReactNode;
  onReact: (code: string, emoji: string) => void;
}

/** Reaction pack tabs for the room: Classic is free, the other packs are a Watch+ perk (the server enforces it too). */
export const ReactionPackPicker: React.FC<ReactionPackPickerProps> = ({ canUsePremium, classicRow, onReact }) => {
  const [packId, setPackId] = useState('classic');
  const pack = REACTION_PACKS.find((p) => p.id === packId) ?? REACTION_PACKS[0];
  const locked = pack.premium && !canUsePremium;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="Reaction packs">
        {REACTION_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === packId}
            onClick={() => setPackId(p.id)}
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
              p.id === packId ? 'bg-rose-500/20 border-rose-400/50 text-rose-100' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {p.premium && !canUsePremium && <Lock className="w-2.5 h-2.5" aria-label="Watch+ only" />}
            {p.name}
          </button>
        ))}
      </div>

      {pack.id === 'classic' ? (
        classicRow
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {pack.emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={locked}
              onClick={() => onReact('emoji', emoji)}
              className={`w-8 h-8 rounded-xl text-base shrink-0 border flex items-center justify-center transition-all ${
                locked ? 'bg-white/[0.03] border-white/5 opacity-40 cursor-not-allowed' : 'bg-white/5 hover:bg-rose-500/20 active:scale-95 border-white/10 hover:border-rose-400/40 shadow-sm'
              }`}
              title={locked ? 'Watch+ only' : `React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {locked && (
            <Link href="/pricing" className="shrink-0 ml-1 px-2.5 py-1 rounded-full bg-amber-500 text-black text-[10px] font-bold">
              Unlock with Watch+
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
