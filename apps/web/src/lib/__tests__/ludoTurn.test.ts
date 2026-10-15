import test from 'node:test';
import assert from 'node:assert/strict';
import { turnSecondsLeft, capturedList } from '../ludoTurn';

test('turnSecondsLeft rounds up and clamps at 0', () => {
  assert.equal(turnSecondsLeft(10_000, 9_001), 1);
  assert.equal(turnSecondsLeft(10_000, 10_000), 0);
  assert.equal(turnSecondsLeft(10_000, 12_000), 0);
});

test('capturedList prefers capturedTokens', () => {
  assert.deepEqual(capturedList({ capturedTokens: [{ a: 1 }, { a: 2 }], capturedToken: { a: 1 } }), [{ a: 1 }, { a: 2 }]);
  assert.deepEqual(capturedList({ capturedToken: { a: 1 } }), [{ a: 1 }]);
  assert.deepEqual(capturedList(null), []);
});
