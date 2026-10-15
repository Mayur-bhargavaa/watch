'use client';

import React from 'react';
import { secondsLabel } from '../../../lib/imposterView';

interface ImposterTimerRingProps {
  /** 0..1 share of the phase that is left */
  fraction: number;
  msLeft: number;
  size?: number;
  label?: string;
}

/** Circular countdown. Single solid accent stroke; the number turns red in the last 5 seconds. */
export const ImposterTimerRing: React.FC<ImposterTimerRingProps> = ({ fraction, msLeft, size = 56, label }) => {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = msLeft > 0 && msLeft <= 5000;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={label ? `${label}: ${secondsLabel(msLeft)} seconds left` : `${secondsLabel(msLeft)} seconds left`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-200 dark:stroke-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, fraction)))}
          className={`transition-[stroke-dashoffset] duration-200 ease-linear stroke-[#ee1d49]`}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums ${urgent ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
        {secondsLabel(msLeft)}
      </div>
    </div>
  );
};

export default ImposterTimerRing;
