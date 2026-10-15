/** Whole seconds left until a server turn deadline (epoch ms); never negative. */
export function turnSecondsLeft(deadlineAt: number, now: number): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

/** The captured tokens of a token_moved payload: capturedTokens wins, capturedToken is the single-token fallback. */
export function capturedList<T>(move: { capturedTokens?: T[]; capturedToken?: T } | null | undefined): T[] {
  if (!move) return [];
  if (move.capturedTokens && move.capturedTokens.length > 0) return move.capturedTokens;
  return move.capturedToken ? [move.capturedToken] : [];
}
