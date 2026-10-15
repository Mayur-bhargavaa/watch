import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveStreak } from '../util/streak.js';

const TODAY = '2026-10-14';
const YESTERDAY = '2026-10-13';

test('a streak last continued on 30 Sep is dead on 14 Oct (was shown as "1 day, expires today")', () => {
  assert.deepEqual(effectiveStreak({ currentStreak: 1, lastWatchedDate: '2026-09-30' }, TODAY, YESTERDAY), {
    currentStreak: 0,
    completedToday: false,
    atRisk: false
  });
});

test('active yesterday: alive and at risk until today is done', () => {
  assert.deepEqual(effectiveStreak({ currentStreak: 3, lastWatchedDate: YESTERDAY }, TODAY, YESTERDAY), {
    currentStreak: 3,
    completedToday: false,
    atRisk: true
  });
});

test('done today: alive, not at risk; no record: zero', () => {
  assert.deepEqual(effectiveStreak({ currentStreak: 3, lastWatchedDate: TODAY }, TODAY, YESTERDAY), { currentStreak: 3, completedToday: true, atRisk: false });
  assert.deepEqual(effectiveStreak(null, TODAY, YESTERDAY), { currentStreak: 0, completedToday: false, atRisk: false });
});
