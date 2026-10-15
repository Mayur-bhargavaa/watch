import test from 'node:test';
import assert from 'node:assert/strict';
import { claimablePrizes, prizeProgress, recentCalls, scoreboard, seatColor, SEAT_COLORS } from '../tambolaLogic';

const cells = [
  [18, null, 35, null, 46, null, 61, 85, null],
  [null, 23, 36, null, 48, null, 76, 88, null],
  [9, null, 39, null, 57, 67, 78, null, null]
];
const enabled = { early5: true, topLine: true, middleLine: true, bottomLine: true, fourCorners: true, housefull: true };

test('claimable skips already claimed prizes (TA-3)', () => {
  const called = new Set([18, 35, 46, 61, 85, 23, 36, 48, 76, 88]);
  assert.deepEqual(claimablePrizes(cells, called, { topLine: {} }, enabled), ['middleLine', 'early5']);
});
test('nothing claimable when nothing complete', () => {
  assert.deepEqual(claimablePrizes(cells, new Set([18]), {}, enabled), []);
});
test('four corners and disabled prizes', () => {
  const called = new Set([18, 85, 9, 78]);
  assert.deepEqual(claimablePrizes(cells, called, {}, enabled), ['fourCorners']);
  assert.deepEqual(claimablePrizes(cells, called, {}, { ...enabled, fourCorners: false }), []);
});
test('progress caps early5 at 5', () => {
  const p = prizeProgress(cells, 'early5', new Set([18, 35, 46, 61, 85, 23, 36]));
  assert.equal(p.current, 5); assert.ok(p.met);
});
test('recentCalls returns last five newest first (TA-11)', () => {
  assert.deepEqual(recentCalls([1, 2, 3, 4, 5, 6, 7]), [7, 6, 5, 4, 3]);
  assert.deepEqual(recentCalls(undefined), []);
});
test('scoreboard sorted with names (TA-15)', () => {
  const rows = scoreboard({ a: 10, b: 30 }, { a: 'Ann', b: 'Bob' });
  assert.deepEqual(rows.map(r => r.name), ['Bob', 'Ann']);
});
test('seat colours distinct for 20 seats', () => {
  assert.equal(new Set(SEAT_COLORS).size, 20);
  assert.equal(seatColor(20), seatColor(0));
});
