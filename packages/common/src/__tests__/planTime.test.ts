import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimezoneOffsetMinutes,
  parseTimeOfDay,
  formatTime12,
  getPlanWindow,
  isPlanPast,
  formatPlanDate,
  nextOccurrenceDate,
  isValidPlanDate,
  toTimeInputValue
} from '../planTime.js';

test('timezone labels', () => {
  assert.equal(parseTimezoneOffsetMinutes('IST (UTC+5:30)'), 330);
  assert.equal(parseTimezoneOffsetMinutes('EST (UTC-5)'), -300);
  assert.equal(parseTimezoneOffsetMinutes('IST'), 330);
  assert.equal(parseTimezoneOffsetMinutes('PST'), -480);
  assert.equal(parseTimezoneOffsetMinutes(''), 0);
});

test('times of day', () => {
  assert.equal(parseTimeOfDay('9:00 PM'), 21 * 60);
  assert.equal(parseTimeOfDay('12:30 AM'), 30);
  assert.equal(parseTimeOfDay('12 PM'), 720);
  assert.equal(parseTimeOfDay('21:15'), 21 * 60 + 15);
  assert.equal(parseTimeOfDay('25:00'), null);
  assert.equal(parseTimeOfDay('soon'), null);
  assert.equal(formatTime12('21:00'), '9:00 PM');
  assert.equal(formatTime12('00:05'), '12:05 AM');
  assert.equal(toTimeInputValue('9:00 PM'), '21:00');
});

test('plan window uses the plan timezone (not a fixed date)', () => {
  const w = getPlanWindow({ date: '2026-12-01', time: '9:00 PM', endTime: '12:30 AM', timezone: 'IST (UTC+5:30)' })!;
  assert.equal(new Date(w.startMs).toISOString(), '2026-12-01T15:30:00.000Z');
  assert.equal(new Date(w.endMs).toISOString(), '2026-12-01T19:00:00.000Z'.replace('19:00', '19:00')); // 12:30 AM next day IST = 19:00Z
  assert.equal(getPlanWindow({ date: 'nope', time: '9 PM' }), null);
  assert.equal(getPlanWindow({ date: '2026-12-01', time: 'whenever' }), null);
});

test('past is computed from the date, not stored', () => {
  const plan = { date: '2026-09-27', time: '9:00 PM', endTime: '12:30 AM', timezone: 'IST' };
  assert.equal(isPlanPast(plan, Date.parse('2026-10-14T12:00:00Z')), true);
  assert.equal(isPlanPast(plan, Date.parse('2026-09-27T16:00:00Z')), false);
  assert.equal(isPlanPast({ date: '2026-12-01', time: '9 PM', timezone: 'UTC' }, Date.parse('2026-10-14T12:00:00Z')), false);
});

test('dates', () => {
  assert.equal(formatPlanDate('2026-09-27'), 'Sunday, September 27');
  assert.equal(formatPlanDate(''), 'Date not set');
  assert.equal(isValidPlanDate('2026-02-30'), false);
  assert.equal(nextOccurrenceDate('2026-10-14', 'weekly'), '2026-10-21');
  assert.equal(nextOccurrenceDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextOccurrenceDate('2026-10-14', 'none'), null);
});
