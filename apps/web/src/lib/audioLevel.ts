// Pure helpers for the "who is speaking" ring on the video tiles (no browser APIs, unit tested).

/** Average frequency-bin level (0..255) above which somebody counts as speaking. */
export const SPEAKING_THRESHOLD = 22;

/** Mean of the analyser's byte frequency data (0 for an empty buffer). */
export function averageLevel(data: ArrayLike<number>): number {
  const n = data.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += data[i] || 0;
  return sum / n;
}

export function isSpeakingLevel(data: ArrayLike<number>, threshold: number = SPEAKING_THRESHOLD): boolean {
  return averageLevel(data) >= threshold;
}
