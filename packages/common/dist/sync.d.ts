import { RoomPlaybackState } from './types.js';
export interface ClockSyncSample {
    clientSentTime: number;
    serverTime: number;
    clientReceivedTime: number;
}
export interface ClockSyncResult {
    offset: number;
    roundTripTime: number;
}
export type DriftCorrectionAction = {
    type: 'NONE';
    reason: 'IN_SYNC';
    driftMs: number;
} | {
    type: 'RATE_ADJUST';
    targetRate: number;
    driftMs: number;
    reason: 'AHEAD_SOFT_SLOW' | 'BEHIND_SOFT_ACCEL';
} | {
    type: 'HARD_SEEK';
    targetPositionSeconds: number;
    driftMs: number;
    reason: 'DRIFT_EXCEEDED_THRESHOLD';
};
export declare const SYNC_THRESHOLDS: {
    readonly IN_SYNC_DEADBAND_MS: 250;
    readonly SOFT_ADJUST_THRESHOLD_MS: 1000;
    readonly SOFT_RESTORE_DEADBAND_MS: 100;
    readonly RATE_SLOWDOWN: 0.95;
    readonly RATE_SPEEDUP: 1.05;
    readonly HARD_SEEK_COOLDOWN_MS: 1500;
};
/**
 * Calculates clock offset from a single ping/pong exchange using Cristian's algorithm.
 * offset = serverTime - (T1 + RTT/2)
 */
export declare function calculateClockOffset(sample: ClockSyncSample): ClockSyncResult;
/**
 * Filters a window of clock samples, preferring samples with the lowest RTT
 * to eliminate queueing delay noise.
 */
export declare function aggregateClockOffset(samples: ClockSyncSample[]): ClockSyncResult;
/**
 * Calculates current authoritative playback position based on server time.
 * If PLAYING: currentPosition = savedPosition + (elapsedTime * playbackRate)
 * If PAUSED or BUFFERING: currentPosition = savedPosition
 */
export declare function calculateAuthoritativePosition(state: RoomPlaybackState, currentServerTime: number): number;
/**
 * Multi-tier perceptual drift correction engine.
 * Decides whether to do nothing, gently adjust playback rate, or perform hard seek.
 */
export declare function evaluateDriftCorrection(localCurrentPositionSeconds: number, authoritativePositionSeconds: number, currentRate: number, lastHardSeekTime: number, now: number): DriftCorrectionAction;
/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
export declare function formatSecondsToTimestamp(seconds: number): string;
//# sourceMappingURL=sync.d.ts.map