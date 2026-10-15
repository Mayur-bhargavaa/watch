import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolateChessClocks, isChessClockRunning, formatChessClockMs } from '../chessClock';

test('white clock does not run before first move', () => {
  assert.equal(isChessClockRunning('ACTIVE', 'w', 0), false);
  assert.equal(isChessClockRunning('ACTIVE', 'b', 1), true);
  assert.equal(isChessClockRunning('CHECKMATE', 'b', 5), false);
});

test('interpolates only side to move, clamps', () => {
  const base = { whiteMs: 1000, blackMs: 5000, turn: 'w' as const };
  assert.deepEqual(interpolateChessClocks(base, 400, true), { whiteMs: 600, blackMs: 5000 });
  assert.deepEqual(interpolateChessClocks(base, 9000, true), { whiteMs: 0, blackMs: 5000 });
  assert.deepEqual(interpolateChessClocks(base, 400, false), { whiteMs: 1000, blackMs: 5000 });
});

test('format shows 0:00 for zero', () => {
  assert.equal(formatChessClockMs(0), '0:00');
  assert.equal(formatChessClockMs(undefined), '0:00');
  assert.equal(formatChessClockMs(61000), '1:01');
});
