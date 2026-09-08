import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateClockOffset,
  aggregateClockOffset,
  calculateAuthoritativePosition,
  evaluateDriftCorrection,
  formatSecondsToTimestamp,
  SYNC_THRESHOLDS
} from '../sync.js';
import { detectProviderFromUrl } from '../ott.js';

test('Clock Synchronization - Cristian Algorithm', () => {
  // Client sends at T1=1000, Server receives & replies at Tserver=1050, Client receives at T2=1100
  // RTT = 100ms. One-way latency = 50ms. Estimated server time at T2 = 1050 + 50 = 1100.
  // Offset = 1100 - 1100 = 0.
  const sample1 = {
    clientSentTime: 1000,
    serverTime: 1050,
    clientReceivedTime: 1100
  };
  const res1 = calculateClockOffset(sample1);
  assert.equal(res1.roundTripTime, 100);
  assert.equal(res1.offset, 0);

  // Client clock is 500ms behind server
  // T1=1000 (client), Tserver=1550 (server), T2=1100 (client)
  const sampleBehind = {
    clientSentTime: 1000,
    serverTime: 1550,
    clientReceivedTime: 1100
  };
  const resBehind = calculateClockOffset(sampleBehind);
  assert.equal(resBehind.roundTripTime, 100);
  assert.equal(resBehind.offset, 500); // add 500ms to client clock
});

test('Clock Synchronization - Aggregation with Outlier Filtering', () => {
  const samples = [
    { clientSentTime: 1000, serverTime: 1050, clientReceivedTime: 1100 }, // RTT = 100
    { clientSentTime: 2000, serverTime: 2060, clientReceivedTime: 2120 }, // RTT = 120
    { clientSentTime: 3000, serverTime: 3300, clientReceivedTime: 3600 }  // RTT = 600 (outlier lag spike)
  ];
  const agg = aggregateClockOffset(samples);
  assert.ok(agg.roundTripTime < 150, 'High RTT outlier should be filtered out');
});

test('Authoritative Position Calculation', () => {
  const baseState = {
    roomId: 'room-1',
    state: 'PLAYING' as const,
    position: 100.0,
    serverTimestamp: 10_000,
    playbackRate: 1.0,
    version: 1,
    updatedBy: 'user-1'
  };

  // 5 seconds elapsed on server
  const posAt15s = calculateAuthoritativePosition(baseState, 15_000);
  assert.equal(posAt15s, 105.0);

  // When paused, position does not advance
  const pausedState = { ...baseState, state: 'PAUSED' as const };
  const posPaused = calculateAuthoritativePosition(pausedState, 20_000);
  assert.equal(posPaused, 100.0);

  // When playbackRate is 1.5
  const fastState = { ...baseState, playbackRate: 1.5 };
  const posFast = calculateAuthoritativePosition(fastState, 14_000); // 4s elapsed * 1.5 = 6s
  assert.equal(posFast, 106.0);
});

test('Drift Correction Decision Engine', () => {
  const now = 50_000;
  const lastHardSeekTime = 0;

  // Case 1: In-Sync Zone (< 250ms drift)
  const driftSmall = evaluateDriftCorrection(100.2, 100.0, 1.0, lastHardSeekTime, now);
  assert.equal(driftSmall.type, 'NONE');
  assert.equal(driftSmall.reason, 'IN_SYNC');

  // Case 2: Soft Rate Nudge - Client Ahead by 500ms (within 250ms - 1000ms)
  const driftAhead = evaluateDriftCorrection(100.5, 100.0, 1.0, lastHardSeekTime, now);
  assert.equal(driftAhead.type, 'RATE_ADJUST');
  if (driftAhead.type === 'RATE_ADJUST') {
    assert.equal(driftAhead.targetRate, SYNC_THRESHOLDS.RATE_SLOWDOWN);
    assert.equal(driftAhead.reason, 'AHEAD_SOFT_SLOW');
  }

  // Case 3: Soft Rate Nudge - Client Behind by 400ms
  const driftBehind = evaluateDriftCorrection(99.6, 100.0, 1.0, lastHardSeekTime, now);
  assert.equal(driftBehind.type, 'RATE_ADJUST');
  if (driftBehind.type === 'RATE_ADJUST') {
    assert.equal(driftBehind.targetRate, SYNC_THRESHOLDS.RATE_SPEEDUP);
    assert.equal(driftBehind.reason, 'BEHIND_SOFT_ACCEL');
  }

  // Case 4: Hard Seek (> 1200ms drift)
  const driftHuge = evaluateDriftCorrection(105.0, 100.0, 1.0, lastHardSeekTime, now);
  assert.equal(driftHuge.type, 'HARD_SEEK');
  if (driftHuge.type === 'HARD_SEEK') {
    assert.equal(driftHuge.targetPositionSeconds, 100.0);
  }

  // Case 5: Hard Seek Cooldown suppression
  const driftDuringCooldown = evaluateDriftCorrection(105.0, 100.0, 1.0, now - 500, now);
  assert.equal(driftDuringCooldown.type, 'NONE', 'Should not seek during cooldown debounce');
});

test('Provider Detection', () => {
  const yt = detectProviderFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.provider, 'youtube');
  assert.equal(yt.providerMediaId, 'dQw4w9WgXcQ');

  const mp4 = detectProviderFromUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  assert.equal(mp4.provider, 'direct_html5');

  const netflix = detectProviderFromUrl('https://www.netflix.com/watch/81234567');
  assert.equal(netflix.provider, 'netflix');
});

test('Timestamp Formatting', () => {
  assert.equal(formatSecondsToTimestamp(0), '00:00');
  assert.equal(formatSecondsToTimestamp(65), '01:05');
  assert.equal(formatSecondsToTimestamp(3665), '01:01:05');
});
