import { RoomPlaybackState } from './types.js';

export interface ClockSyncSample {
  clientSentTime: number; // T1
  serverTime: number;     // Tserver
  clientReceivedTime: number; // T2
}

export interface ClockSyncResult {
  offset: number; // Add to Date.now() to get authoritative server time
  roundTripTime: number;
}

export type DriftCorrectionAction =
  | { type: 'NONE'; reason: 'IN_SYNC'; driftMs: number }
  | { type: 'RATE_ADJUST'; targetRate: number; driftMs: number; reason: 'AHEAD_SOFT_SLOW' | 'BEHIND_SOFT_ACCEL' }
  | { type: 'HARD_SEEK'; targetPositionSeconds: number; driftMs: number; reason: 'DRIFT_EXCEEDED_THRESHOLD' };

export const SYNC_THRESHOLDS = {
  IN_SYNC_DEADBAND_MS: 250,       // Under 250ms drift is ignored / considered in sync
  SOFT_ADJUST_THRESHOLD_MS: 1000, // Between 250ms and 1000ms: gradual rate adjustment
  SOFT_RESTORE_DEADBAND_MS: 100,  // Once drift drops below 100ms, restore rate to 1.0
  RATE_SLOWDOWN: 0.95,            // Nudge down when client is ahead
  RATE_SPEEDUP: 1.05,             // Nudge up when client is behind
  HARD_SEEK_COOLDOWN_MS: 1500     // Debounce hard seeks to prevent seek oscillation
} as const;

/**
 * Calculates clock offset from a single ping/pong exchange using Cristian's algorithm.
 * offset = serverTime - (T1 + RTT/2)
 */
export function calculateClockOffset(sample: ClockSyncSample): ClockSyncResult {
  const rtt = Math.max(0, sample.clientReceivedTime - sample.clientSentTime);
  const estimatedServerTimeAtReceive = sample.serverTime + (rtt / 2);
  const offset = estimatedServerTimeAtReceive - sample.clientReceivedTime;
  return {
    offset,
    roundTripTime: rtt
  };
}

/**
 * Filters a window of clock samples, preferring samples with the lowest RTT
 * to eliminate queueing delay noise.
 */
export function aggregateClockOffset(samples: ClockSyncSample[]): ClockSyncResult {
  if (samples.length === 0) {
    return { offset: 0, roundTripTime: 0 };
  }

  // Sort by RTT ascending
  const sorted = [...samples].sort((a, b) => {
    const rttA = a.clientReceivedTime - a.clientSentTime;
    const rttB = b.clientReceivedTime - b.clientSentTime;
    return rttA - rttB;
  });

  // Take the best 50% lowest RTT samples (minimum 1)
  const bestCount = Math.max(1, Math.ceil(sorted.length / 2));
  const bestSamples = sorted.slice(0, bestCount);

  let totalOffset = 0;
  let totalRtt = 0;

  for (const sample of bestSamples) {
    const res = calculateClockOffset(sample);
    totalOffset += res.offset;
    totalRtt += res.roundTripTime;
  }

  return {
    offset: Math.round(totalOffset / bestCount),
    roundTripTime: Math.round(totalRtt / bestCount)
  };
}

/**
 * Calculates current authoritative playback position based on server time.
 * If PLAYING: currentPosition = savedPosition + (elapsedTime * playbackRate)
 * If PAUSED or BUFFERING: currentPosition = savedPosition
 */
export function calculateAuthoritativePosition(
  state: RoomPlaybackState,
  currentServerTime: number
): number {
  if (state.state === 'PAUSED' || state.state === 'BUFFERING') {
    return Math.max(0, state.position);
  }

  const elapsedSeconds = Math.max(0, (currentServerTime - state.serverTimestamp) / 1000);
  return Math.max(0, state.position + (elapsedSeconds * state.playbackRate));
}

/**
 * Multi-tier perceptual drift correction engine.
 * Decides whether to do nothing, gently adjust playback rate, or perform hard seek.
 */
export function evaluateDriftCorrection(
  localCurrentPositionSeconds: number,
  authoritativePositionSeconds: number,
  currentRate: number,
  lastHardSeekTime: number,
  now: number
): DriftCorrectionAction {
  // drift = local - authoritative (positive = client is ahead; negative = client is behind)
  const driftSeconds = localCurrentPositionSeconds - authoritativePositionSeconds;
  const driftMs = Math.round(driftSeconds * 1000);
  const absDriftMs = Math.abs(driftMs);

  // If recently hard-seeked, do not seek again immediately to let player buffer/settle
  const isCooldown = (now - lastHardSeekTime) < SYNC_THRESHOLDS.HARD_SEEK_COOLDOWN_MS;

  // Zone 1: In-Sync
  if (absDriftMs <= SYNC_THRESHOLDS.IN_SYNC_DEADBAND_MS) {
    // If rate was temporarily adjusted, restore to 1.0 once we are tightly in sync
    if (absDriftMs <= SYNC_THRESHOLDS.SOFT_RESTORE_DEADBAND_MS && currentRate !== 1.0) {
      return {
        type: 'RATE_ADJUST',
        targetRate: 1.0,
        driftMs,
        reason: 'AHEAD_SOFT_SLOW'
      };
    }
    return {
      type: 'NONE',
      reason: 'IN_SYNC',
      driftMs
    };
  }

  // Zone 2: Soft Rate Adjustment (between 150ms and 1200ms)
  if (absDriftMs <= SYNC_THRESHOLDS.SOFT_ADJUST_THRESHOLD_MS) {
    if (driftMs > 0) {
      // Client is ahead: slow down slightly so server/peers catch up
      return {
        type: 'RATE_ADJUST',
        targetRate: SYNC_THRESHOLDS.RATE_SLOWDOWN,
        driftMs,
        reason: 'AHEAD_SOFT_SLOW'
      };
    } else {
      // Client is behind: speed up slightly to catch up
      return {
        type: 'RATE_ADJUST',
        targetRate: SYNC_THRESHOLDS.RATE_SPEEDUP,
        driftMs,
        reason: 'BEHIND_SOFT_ACCEL'
      };
    }
  }

  // Zone 3: Hard Seek (exceeds 1200ms)
  if (!isCooldown) {
    return {
      type: 'HARD_SEEK',
      targetPositionSeconds: authoritativePositionSeconds,
      driftMs,
      reason: 'DRIFT_EXCEEDED_THRESHOLD'
    };
  }

  return {
    type: 'NONE',
    reason: 'IN_SYNC',
    driftMs
  };
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
export function formatSecondsToTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
