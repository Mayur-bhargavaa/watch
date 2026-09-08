"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const sync_js_1 = require("../sync.js");
const ott_js_1 = require("../ott.js");
(0, node_test_1.default)('Clock Synchronization - Cristian Algorithm', () => {
    // Client sends at T1=1000, Server receives & replies at Tserver=1050, Client receives at T2=1100
    // RTT = 100ms. One-way latency = 50ms. Estimated server time at T2 = 1050 + 50 = 1100.
    // Offset = 1100 - 1100 = 0.
    const sample1 = {
        clientSentTime: 1000,
        serverTime: 1050,
        clientReceivedTime: 1100
    };
    const res1 = (0, sync_js_1.calculateClockOffset)(sample1);
    strict_1.default.equal(res1.roundTripTime, 100);
    strict_1.default.equal(res1.offset, 0);
    // Client clock is 500ms behind server
    // T1=1000 (client), Tserver=1550 (server), T2=1100 (client)
    const sampleBehind = {
        clientSentTime: 1000,
        serverTime: 1550,
        clientReceivedTime: 1100
    };
    const resBehind = (0, sync_js_1.calculateClockOffset)(sampleBehind);
    strict_1.default.equal(resBehind.roundTripTime, 100);
    strict_1.default.equal(resBehind.offset, 500); // add 500ms to client clock
});
(0, node_test_1.default)('Clock Synchronization - Aggregation with Outlier Filtering', () => {
    const samples = [
        { clientSentTime: 1000, serverTime: 1050, clientReceivedTime: 1100 }, // RTT = 100
        { clientSentTime: 2000, serverTime: 2060, clientReceivedTime: 2120 }, // RTT = 120
        { clientSentTime: 3000, serverTime: 3300, clientReceivedTime: 3600 } // RTT = 600 (outlier lag spike)
    ];
    const agg = (0, sync_js_1.aggregateClockOffset)(samples);
    strict_1.default.ok(agg.roundTripTime < 150, 'High RTT outlier should be filtered out');
});
(0, node_test_1.default)('Authoritative Position Calculation', () => {
    const baseState = {
        roomId: 'room-1',
        state: 'PLAYING',
        position: 100.0,
        serverTimestamp: 10_000,
        playbackRate: 1.0,
        version: 1,
        updatedBy: 'user-1'
    };
    // 5 seconds elapsed on server
    const posAt15s = (0, sync_js_1.calculateAuthoritativePosition)(baseState, 15_000);
    strict_1.default.equal(posAt15s, 105.0);
    // When paused, position does not advance
    const pausedState = { ...baseState, state: 'PAUSED' };
    const posPaused = (0, sync_js_1.calculateAuthoritativePosition)(pausedState, 20_000);
    strict_1.default.equal(posPaused, 100.0);
    // When playbackRate is 1.5
    const fastState = { ...baseState, playbackRate: 1.5 };
    const posFast = (0, sync_js_1.calculateAuthoritativePosition)(fastState, 14_000); // 4s elapsed * 1.5 = 6s
    strict_1.default.equal(posFast, 106.0);
});
(0, node_test_1.default)('Drift Correction Decision Engine', () => {
    const now = 50_000;
    const lastHardSeekTime = 0;
    // Case 1: In-Sync Zone (< 250ms drift)
    const driftSmall = (0, sync_js_1.evaluateDriftCorrection)(100.2, 100.0, 1.0, lastHardSeekTime, now);
    strict_1.default.equal(driftSmall.type, 'NONE');
    strict_1.default.equal(driftSmall.reason, 'IN_SYNC');
    // Case 2: Soft Rate Nudge - Client Ahead by 500ms (within 250ms - 1000ms)
    const driftAhead = (0, sync_js_1.evaluateDriftCorrection)(100.5, 100.0, 1.0, lastHardSeekTime, now);
    strict_1.default.equal(driftAhead.type, 'RATE_ADJUST');
    if (driftAhead.type === 'RATE_ADJUST') {
        strict_1.default.equal(driftAhead.targetRate, sync_js_1.SYNC_THRESHOLDS.RATE_SLOWDOWN);
        strict_1.default.equal(driftAhead.reason, 'AHEAD_SOFT_SLOW');
    }
    // Case 3: Soft Rate Nudge - Client Behind by 400ms
    const driftBehind = (0, sync_js_1.evaluateDriftCorrection)(99.6, 100.0, 1.0, lastHardSeekTime, now);
    strict_1.default.equal(driftBehind.type, 'RATE_ADJUST');
    if (driftBehind.type === 'RATE_ADJUST') {
        strict_1.default.equal(driftBehind.targetRate, sync_js_1.SYNC_THRESHOLDS.RATE_SPEEDUP);
        strict_1.default.equal(driftBehind.reason, 'BEHIND_SOFT_ACCEL');
    }
    // Case 4: Hard Seek (> 1200ms drift)
    const driftHuge = (0, sync_js_1.evaluateDriftCorrection)(105.0, 100.0, 1.0, lastHardSeekTime, now);
    strict_1.default.equal(driftHuge.type, 'HARD_SEEK');
    if (driftHuge.type === 'HARD_SEEK') {
        strict_1.default.equal(driftHuge.targetPositionSeconds, 100.0);
    }
    // Case 5: Hard Seek Cooldown suppression
    const driftDuringCooldown = (0, sync_js_1.evaluateDriftCorrection)(105.0, 100.0, 1.0, now - 500, now);
    strict_1.default.equal(driftDuringCooldown.type, 'NONE', 'Should not seek during cooldown debounce');
});
(0, node_test_1.default)('Provider Detection', () => {
    const yt = (0, ott_js_1.detectProviderFromUrl)('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    strict_1.default.equal(yt.provider, 'youtube');
    strict_1.default.equal(yt.providerMediaId, 'dQw4w9WgXcQ');
    const mp4 = (0, ott_js_1.detectProviderFromUrl)('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    strict_1.default.equal(mp4.provider, 'direct_html5');
    const netflix = (0, ott_js_1.detectProviderFromUrl)('https://www.netflix.com/watch/81234567');
    strict_1.default.equal(netflix.provider, 'netflix');
});
(0, node_test_1.default)('Timestamp Formatting', () => {
    strict_1.default.equal((0, sync_js_1.formatSecondsToTimestamp)(0), '00:00');
    strict_1.default.equal((0, sync_js_1.formatSecondsToTimestamp)(65), '01:05');
    strict_1.default.equal((0, sync_js_1.formatSecondsToTimestamp)(3665), '01:01:05');
});
//# sourceMappingURL=sync.test.js.map