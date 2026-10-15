'use client';

import React from 'react';
import { secondsLabel } from '../../../lib/emojiCharadesView';

interface EmojiCharadesTimerRingProps {
  /** 0..1 share of the phase that is left */
  fraction: number;
  msLeft: number;
  size?: number;
  label?: string;
}

/** Circular countdown. Turns rose in the last 10 seconds. */
export const EmojiCharadesTimerRing: React.FC<EmojiCharadesTimerRingProps> = ({ fraction, msLeft, size = 72, label }) => {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = msLeft > 0 && msLeft <= 10_000;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={label ? `${label}: ${secondsLabel(msLeft)} seconds left` : `${secondsLabel(msLeft)} seconds left`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, fraction)))}
          className={`transition-[stroke-dashoffset] duration-200 ease-linear ${urgent ? 'stroke-rose-500' : 'stroke-violet-500'}`}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-lg font-black tabular-nums ${urgent ? 'animate-pulse text-rose-500' : 'text-[#16132b] dark:text-white'}`}>
        {secondsLabel(msLeft)}
      </div>
    </div>
  );
};

export default EmojiCharadesTimerRing;
