'use client';

import { useEffect, useState } from 'react';
import type { ImposterGameView } from '@synccinema/common';
import { clockOffset, msLeft, ringFraction } from '../../../lib/imposterView';

/**
 * Countdown of the current phase / turn. The server owns the deadline (`phaseEndsAt`); the client only draws it, corrected by
 * the clock difference measured from the `serverNow` stamp of the latest view, so a wrong device clock cannot lie.
 */
export function useImposterClock(view: Pick<ImposterGameView, 'phaseEndsAt' | 'phaseDurationMs' | 'serverNow'> | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(clockOffset(view?.serverNow, Date.now()));
  }, [view?.serverNow]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  return {
    msLeft: msLeft(view, now, offset),
    fraction: ringFraction(view, now, offset)
  };
}
