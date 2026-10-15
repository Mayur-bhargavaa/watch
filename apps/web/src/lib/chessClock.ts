// Pure helpers for rendering server-authoritative chess clocks.
// The server owns the clocks; the client only interpolates visually between
// the once-per-second ticks, always re-basing on the latest server value.

export interface ChessClockBase {
  whiteMs: number;
  blackMs: number;
  turn: 'w' | 'b';
}

/** True while the side to move's clock is actually running on the server. */
export function isChessClockRunning(status: string | undefined, turn: 'w' | 'b', moveCount: number): boolean {
  if (status !== 'ACTIVE' && status !== 'CHECK') return false;
  // White's clock does not start until White has made the first move.
  if (turn === 'w' && moveCount === 0) return false;
  return true;
}

/** Interpolate from the last server value; never below 0 and capped at 2 s so a missed tick cannot drift. */
export function interpolateChessClocks(
  base: ChessClockBase,
  elapsedMs: number,
  running: boolean
): { whiteMs: number; blackMs: number } {
  const e = running ? Math.min(Math.max(0, elapsedMs), 2000) : 0;
  const w = Math.max(0, base.whiteMs - (base.turn === 'w' ? e : 0));
  const b = Math.max(0, base.blackMs - (base.turn === 'b' ? e : 0));
  return { whiteMs: w, blackMs: b };
}

export function formatChessClockMs(ms: number | undefined | null): string {
  const safe = Math.max(0, Number.isFinite(ms as number) ? (ms as number) : 0);
  const totalSeconds = Math.floor(safe / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
