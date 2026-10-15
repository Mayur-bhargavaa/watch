import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRetention, verdict, toMs } from '../lib/retention.mjs';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 15, 12);
const dayStr = (offset) => new Date(NOW + offset * DAY).toISOString().slice(0, 10);

test('toMs accepts ms, ISO strings, dates and day strings; rejects junk', () => {
  assert.equal(toMs(5000), 5000);
  assert.equal(toMs('2026-10-15'), Date.UTC(2026, 9, 15));
  assert.equal(toMs(new Date(1000)), 1000);
  for (const bad of [null, undefined, 'x', NaN, -1, {}]) assert.equal(toMs(bad), null);
});

test('D1/D7/D30 use exact day offsets and only count users whose day N is over', () => {
  const users = [
    { id: 'a', createdAt: NOW - 40 * DAY },
    { id: 'b', createdAt: NOW - 40 * DAY },
    { id: 'c', createdAt: NOW - 3 * DAY }
  ];
  const events = [
    { userId: 'a', at: NOW - 39 * DAY }, // a: D1
    { userId: 'a', at: NOW - 33 * DAY }, // a: D7
    { userId: 'b', at: NOW - 40 * DAY + 1000 }, // b: same day only
    { userId: 'c', at: NOW - 2 * DAY }, // c: D1
    { userId: 'ghost', at: NOW - 1 * DAY } // unknown user ignored
  ];
  const r = computeRetention({ users, events, now: NOW });
  assert.deepEqual(r.returnRate.d1, { eligible: 3, returned: 2, rate: 2 / 3 });
  assert.deepEqual(r.returnRate.d7, { eligible: 2, returned: 1, rate: 0.5 });
  assert.deepEqual(r.returnRate.d30, { eligible: 2, returned: 0, rate: 0 });
  assert.equal(r.users, 3);
});

test('weekly/monthly active, plans per active user, streak and friend shares', () => {
  const users = ['a', 'b', 'c', 'd'].map((id) => ({ id, createdAt: NOW - 60 * DAY }));
  const events = [
    { userId: 'a', at: NOW - 1 * DAY }, { userId: 'b', at: NOW - 6 * DAY }, { userId: 'c', at: NOW - 20 * DAY }, { userId: 'd', at: NOW + DAY }
  ];
  const plans = [{ hostId: 'a' }, { hostId: 'a' }, { hostId: 'c' }, { hostId: 'zzz' }];
  const streaks = [
    { userIds: ['a', 'x'], currentStreak: 4, lastWatchedDate: dayStr(-1) },
    { userIds: ['b', 'x'], currentStreak: 9, lastWatchedDate: dayStr(-5) }, // dead
    { userIds: ['c', 'x'], currentStreak: 0, lastWatchedDate: dayStr(0) } // zero
  ];
  const friendships = [{ userIds: ['a', 'x'], status: 'ACCEPTED' }, { userIds: ['b', 'y'], status: 'PENDING' }];
  const r = computeRetention({ users, events, plans, streaks, friendships, now: NOW });
  assert.equal(r.weeklyActiveUsers, 2);
  assert.equal(r.monthlyActiveUsers, 3);
  assert.equal(r.plansPerActiveUser, 1); // a has 2 plans, b 0 -> 2/2
  assert.equal(r.activeWithStreakShare, 0.5);
  assert.equal(r.activeWithFriendsShare, 0.5);
  assert.equal(r.plansCreated, 4);
});

test('empty input does not divide by zero', () => {
  const r = computeRetention({ now: NOW });
  assert.equal(r.users, 0);
  assert.equal(r.returnRate.d7.rate, null);
  assert.equal(r.plansPerActiveUser, null);
  assert.equal(r.verdict.label, 'not enough data');
});

const base = { users: 200, weeklyActiveUsers: 80, returnRate: { d7: { rate: 0.3 } }, activeWithStreakShare: 0.4, plansPerActiveUser: 1.5, activeWithFriendsShare: 0.8, hostsNearFreeCap: 5 };

test('verdict: strong signals => monetisable; weak => free tier probably enough; small => not enough data', () => {
  assert.equal(verdict(base).label, 'monetisable signals');
  assert.equal(verdict({ ...base, returnRate: { d7: { rate: 0.05 } }, activeWithStreakShare: 0.05, plansPerActiveUser: 0.2, hostsNearFreeCap: 0 }).label, 'free tier probably enough');
  assert.equal(verdict({ ...base, users: 10 }).label, 'not enough data');
  assert.match(verdict(base).caveat, /Rough guide/);
});
