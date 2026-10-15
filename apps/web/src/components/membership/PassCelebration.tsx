'use client';

import React from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { TIER_INFO, normalizeTier } from '@synccinema/common';
import { BingoPartyPoppers } from '../games/bingo-duel/BingoPartyPoppers';

const THEME = {
  plus: { ring: 'from-amber-300 via-yellow-400 to-orange-500', glow: 'rgba(251,191,36,0.55)', text: 'from-amber-500 via-yellow-400 to-orange-500', Icon: Crown },
  creator: { ring: 'from-violet-400 via-fuchsia-500 to-rose-500', glow: 'rgba(168,85,247,0.55)', text: 'from-violet-500 via-fuchsia-500 to-rose-500', Icon: Sparkles },
  free: { ring: 'from-slate-300 to-slate-400', glow: 'rgba(148,163,184,0.4)', text: 'from-slate-500 to-slate-700', Icon: Crown }
} as const;

/** Party poppers plus an animated pass reveal, shown when a payment (or a test activation) has gone through. */
export const PassCelebration: React.FC<{ tier?: unknown; label?: string }> = ({ tier, label }) => {
  const t = normalizeTier(tier);
  const th = THEME[t];
  const Icon = th.Icon;
  const name = label || TIER_INFO[t].badgeLabel;
  return (
    <div className="relative flex flex-col items-center" aria-live="polite">
      <style>{`
        @keyframes pass-pop { 0% { transform: scale(.2) rotate(-18deg); opacity: 0 } 60% { transform: scale(1.12) rotate(4deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes pass-glow { 0%,100% { box-shadow: 0 0 24px 4px var(--g) } 50% { box-shadow: 0 0 56px 14px var(--g) } }
        @keyframes pass-shine { 0% { transform: translateX(-130%) skewX(-20deg) } 100% { transform: translateX(230%) skewX(-20deg) } }
        @keyframes pass-letter { 0% { transform: translateY(14px) scale(.6); opacity: 0 } 100% { transform: translateY(0) scale(1); opacity: 1 } }
        @keyframes pass-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes pass-spark { 0%,100% { opacity: 0; transform: scale(.3) } 50% { opacity: 1; transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) { .pass-anim, .pass-anim * { animation-duration: .01s !important; animation-iteration-count: 1 !important } }
      `}</style>
      <BingoPartyPoppers durationMs={6500} />
      <div className="pass-anim relative" style={{ ['--g' as string]: th.glow }}>
        <div className="relative w-28 h-28 rounded-[2rem] p-[3px] bg-gradient-to-br" style={{ animation: 'pass-pop .9s cubic-bezier(.2,1.3,.4,1) both, pass-glow 2.4s ease-in-out .9s infinite, pass-float 3s ease-in-out 1s infinite' }}>
          <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${th.ring}`} />
          <div className="relative w-full h-full rounded-[1.8rem] bg-white dark:bg-[#151022] flex items-center justify-center overflow-hidden">
            <Icon className="w-12 h-12 text-amber-500" />
            <span className="absolute inset-y-0 w-1/3 bg-white/50" style={{ animation: 'pass-shine 2.2s ease-in-out 1.1s infinite' }} />
          </div>
        </div>
        {[['-top-2 -left-3', '0s'], ['top-1 -right-4', '.5s'], ['-bottom-2 left-2', '1s'], ['bottom-3 -right-3', '1.5s']].map(([pos, delay]) => (
          <Sparkles key={pos} className={`absolute ${pos} w-4 h-4 text-amber-400`} style={{ animation: `pass-spark 2s ease-in-out ${delay} infinite` }} />
        ))}
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-zinc-500" style={{ animation: 'pass-letter .6s ease .5s both' }}>Welcome to your</p>
      <h2 className={`mt-1 text-3xl font-black tracking-tight bg-gradient-to-r ${th.text} bg-clip-text text-transparent flex`} aria-label={name}>
        {name.split('').map((ch, i) => (
          <span key={i} aria-hidden="true" className="inline-block" style={{ animation: `pass-letter .5s cubic-bezier(.2,1.4,.4,1) ${0.7 + i * 0.06}s both` }}>
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </h2>
    </div>
  );
};
