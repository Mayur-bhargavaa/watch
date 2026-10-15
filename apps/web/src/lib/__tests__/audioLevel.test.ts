import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageLevel, isSpeakingLevel, SPEAKING_THRESHOLD } from '../audioLevel';

test('averageLevel is the mean of the bins and 0 when empty', () => {
  assert.equal(averageLevel([]), 0);
  assert.equal(averageLevel([10, 20, 30]), 20);
  assert.equal(averageLevel(new Uint8Array([0, 0, 255, 255])), 127.5);
});

test('isSpeakingLevel needs the average to reach the threshold', () => {
  assert.equal(isSpeakingLevel(new Uint8Array(32)), false);
  assert.equal(isSpeakingLevel(new Uint8Array(32).fill(SPEAKING_THRESHOLD)), true);
  assert.equal(isSpeakingLevel([5, 5, 5], 6), false);
  assert.equal(isSpeakingLevel([5, 5, 5], 5), true);
});
