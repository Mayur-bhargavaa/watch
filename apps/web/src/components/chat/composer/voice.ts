/** Pure helpers for voice notes (kept out of the hook so they can be unit-tested). */

export const VOICE_BARS = 22;
/** Voice notes travel as data URLs inside one message; the server caps media URLs at ~900 KB of base64. */
export const MAX_VOICE_BYTES = 600_000;
export const MAX_VOICE_SECONDS = 120;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** First recording format the browser supports ('' lets the browser choose). */
export function pickAudioMimeType(isSupported: (mime: string) => boolean): string {
  return MIME_CANDIDATES.find((m) => isSupported(m)) ?? '';
}

/** Downsamples raw level samples to a fixed number of waveform bars (with a neutral fallback for very short clips). */
export function downsampleWaveform(samples: number[], bars = VOICE_BARS): number[] {
  if (samples.length <= 5) {
    return [30, 45, 75, 90, 60, 40, 80, 100, 70, 50, 65, 85, 45, 95, 60, 40, 70, 85, 60, 35, 50, 40].slice(0, bars);
  }
  const step = samples.length / bars;
  return Array.from({ length: bars }, (_, i) => samples[Math.floor(i * step)] || 30);
}

/** Maps microphone permission/hardware errors to a message a person can act on. */
export function describeMicError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
    return 'Microphone access was denied. Allow it in your browser address bar to send voice notes.';
  }
  if (e?.name === 'NotFoundError') return 'No microphone was found. Connect one and try again.';
  return `Could not access the microphone${e?.message ? `: ${e.message}` : '.'}`;
}
