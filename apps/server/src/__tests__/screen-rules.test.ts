import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCheckin, mayStartScreenShare } from '../sync/screenRules.js';

test('only the host may start sharing a screen', () => {
  assert.equal(mayStartScreenShare('HOST'), true);
  assert.equal(mayStartScreenShare('PARTICIPANT'), false);
  assert.equal(mayStartScreenShare(undefined), false);
});

test('a check-in is a position in seconds with an optional clean title', () => {
  assert.deepEqual(cleanCheckin({ positionSeconds: 754.9, title: ' Episode <1> ' }), { positionSeconds: 754, title: 'Episode 1' });
  assert.deepEqual(cleanCheckin({ positionSeconds: 0 }), { positionSeconds: 0 });
});

test('bad check-ins are refused', () => {
  for (const bad of [null, 'x', {}, { positionSeconds: -1 }, { positionSeconds: 90_000 }, { positionSeconds: 'abc' }, { positionSeconds: NaN }]) assert.equal(cleanCheckin(bad), null);
});
