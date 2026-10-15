import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeIcsText, foldIcsLine, googleCalendarUrl } from '../planCalendar';
import { countPlans, planBadgeLabel, guessTimezoneLabel, initialsOf, planCategory, planIconName, inferStepKind } from '../planUi';

const plan = { id: 'plan-1', title: 'Movie, night; fun', description: 'Line1\nBEGIN:VALARM', date: '2026-12-01', time: '9:00 PM', endTime: '11:30 PM', timezone: 'IST (UTC+5:30)' };

test('ics uses the plan date/time (not a fixed 27 Sep) and cannot be injected into', () => {
  const ics = buildIcs(plan, 'https://x.test/plans/1', Date.parse('2026-10-14T00:00:00Z'))!;
  assert.match(ics, /DTSTART:20261201T153000Z/);
  assert.match(ics, /DTEND:20261201T180000Z/);
  assert.match(ics, /DTSTAMP:20261014T000000Z/);
  assert.match(ics, /SUMMARY:Movie\\, night\; fun/);
  assert.equal(ics.split('\r\n').filter((l) => l.startsWith('BEGIN:VALARM')).length, 0);
  assert.equal(buildIcs({ ...plan, date: '' }, 'u'), null);
});

test('escaping and folding', () => {
  assert.equal(escapeIcsText('a\r\nb;c,d\\'), 'a\\nb\;c\\,d\\\\');
  const folded = foldIcsLine('X:' + 'é'.repeat(100));
  assert.ok(folded.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 76));
});

test('google calendar link carries the real times', () => {
  const url = googleCalendarUrl(plan, 'https://x.test/p')!;
  assert.match(decodeURIComponent(url), /dates=20261201T153000Z\/20261201T180000Z/);
});

test('counts and labels come from real data', () => {
  const base: any = { participants: [], activities: [] };
  const counts = countPlans([{ ...base, type: 'movie' }, { ...base, type: 'game' }, { ...base, type: 'party' }, { ...base, type: 'movie' }]);
  assert.deepEqual(counts, { all: 4, movies: 2, games: 1, birthdays: 0, other: 1 });
  assert.equal(planBadgeLabel({ ...base, type: 'movie', activities: [{ type: 'movie' }] } as any), 'Movie night');
  assert.equal(planBadgeLabel({ ...base, type: 'custom', activities: [{ type: 'movie' }, { type: 'game' }] } as any), 'Movie + Game');
  assert.equal(initialsOf('Mayur Bhargava'), 'MB');
  assert.match(guessTimezoneLabel(new Date('2026-10-14T00:00:00Z')), /UTC/);
});

test('a plan made only of games is not labelled a movie, whatever occasion was picked first', () => {
  const gamePlan: any = { type: 'movie', emoji: '🍿', participants: [], activities: [{ type: 'game' }] };
  assert.equal(planBadgeLabel(gamePlan), 'Game night');
  assert.equal(planCategory(gamePlan), 'game');
  assert.equal(planIconName(gamePlan), 'game');
  assert.equal(inferStepKind(gamePlan.activities), 'game');
  const mixed: any = { type: 'movie', emoji: '🍿', participants: [], activities: [{ type: 'movie' }, { type: 'game' }] };
  assert.equal(planBadgeLabel(mixed), 'Movie + Game');
  assert.equal(planIconName({ type: 'birthday', activities: [] } as any), 'cake');
  assert.equal(planIconName(mixed), 'sparkles');
});
