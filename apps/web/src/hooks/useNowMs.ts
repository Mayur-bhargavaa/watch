'use client';

import { useEffect, useState } from 'react';

/** The current time in ms, refreshed every `intervalMs` (countdowns). Pass `active = false` to stop ticking. */
export function useNowMs(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
