'use client';

import React from 'react';
import { ShieldCheck, Crown, Sparkles } from 'lucide-react';
import { TIER_INFO, normalizeTier } from '@synccinema/common';

interface MembershipBadgeProps {
  tier?: unknown;
  variant?: 'compact' | 'full';
  className?: string;
}

const STYLE = {
  free: {
    chip: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/10',
    card: 'bg-slate-50 border-slate-200 dark:bg-white/[0.04] dark:border-white/10',
    icon: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-zinc-300',
    Icon: ShieldCheck
  },
  plus: {
    chip: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-300/70 dark:from-amber-500/20 dark:to-yellow-500/15 dark:text-amber-300 dark:border-amber-400/30',
    card: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 dark:from-amber-500/10 dark:to-yellow-500/5 dark:border-amber-400/25',
    icon: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white',
    Icon: Crown
  },
  creator: {
    chip: 'bg-gradient-to-r from-violet-100 to-rose-100 text-violet-800 border-violet-300/70 dark:from-violet-500/20 dark:to-rose-500/15 dark:text-violet-300 dark:border-violet-400/30',
    card: 'bg-gradient-to-br from-violet-50 to-rose-50 border-violet-200 dark:from-violet-500/10 dark:to-rose-500/5 dark:border-violet-400/25',
    icon: 'bg-gradient-to-br from-violet-500 to-rose-500 text-white',
    Icon: Sparkles
  }
} as const;

export const MembershipBadge: React.FC<MembershipBadgeProps> = ({ tier, variant = 'compact', className = '' }) => {
  const t = normalizeTier(tier);
  const info = TIER_INFO[t];
  const s = STYLE[t];
  const Icon = s.Icon;

  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-2xl border ${s.card} ${className}`} role="img" aria-label={info.badgeLabel}>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.icon}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="leading-tight text-left">
          <span className="block text-sm font-black text-slate-900 dark:text-white">{info.badgeLabel}</span>
          <span className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{info.name}</span>
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide leading-none shrink-0 ${s.chip} ${className}`}
      title={info.badgeLabel}
      aria-label={info.badgeLabel}
    >
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      <span>{info.badge}</span>
    </span>
  );
};
