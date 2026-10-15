'use client';

import { useEffect, useState } from 'react';
import type { EmojiCharadesGameView } from '@synccinema/common';
import { clockOffset, msLeft, nextHintSeconds, ringFraction } from '../../../lib/emojiCharadesView';

/**
 * Countdown of the current phase and of the next automatic hint. The server owns the deadlines (`phaseEndsAt`, `nextHintAt`);
 * the client only draws them, corrected by the clock difference measured from the `serverNow` stamp of the latest view,
 * so a wrong device clock cannot lie.
 */
export function useEmojiCharadesClock(view: Pick<EmojiCharadesGameView, 'phaseEndsAt' | 'phaseDurationMs' | 'serverNow' | 'nextHintAt'> | null | undefined) {
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
    fraction: ringFraction(view, now, offset),
    hintInSeconds: nextHintSeconds(view, now, offset)
  };
}
