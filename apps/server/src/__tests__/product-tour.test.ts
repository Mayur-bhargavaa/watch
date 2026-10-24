import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_VERSION, buildTourState, parseTourBody, tourNeeded } from '../services/productTour.js';

test('only "completed" and "skipped" are accepted as the tour result', () => {
  assert.deepEqual(parseTourBody({ status: 'completed' }), { kind: 'finish', status: 'completed' });
  assert.deepEqual(parseTourBody({ status: 'skipped' }), { kind: 'finish', status: 'skipped' });
  for (const bad of [undefined, null, {}, { status: 'done' }, { status: 1 }, { status: ['completed'] }, 'completed']) {
    assert.equal(parseTourBody(bad).kind, 'invalid');
  }
});

test('the stored state carries the status, the tour version and an ISO time', () => {
  const s = buildTourState('skipped', new Date('2026-10-24T10:00:00.000Z'));
  assert.deepEqual(s, { status: 'skipped', version: TOUR_VERSION, at: '2026-10-24T10:00:00.000Z' });
});

test('the tour is needed until it has been seen, and again only for a newer tour version', () => {
  assert.equal(tourNeeded(null), true);
  assert.equal(tourNeeded(undefined), true);
  assert.equal(tourNeeded(buildTourState('completed')), false);
  assert.equal(tourNeeded(buildTourState('skipped')), false);
  assert.equal(tourNeeded({ status: 'completed', version: TOUR_VERSION - 1, at: 'x' }), true);
});
