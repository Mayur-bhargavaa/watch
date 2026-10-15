import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDuelOutcome, isOpponentForfeit, turnSecondsLeft, bingoErrorText } from '../bingoDuelView';

test('round over uses lastRoundWinnerUserId after refresh', () => {
  const o = resolveDuelOutcome({
    phase: 'ROUND_OVER', winnerUserId: null, lastRoundWinnerUserId: 'b',
    roundHistory: [{ winnerUserId: 'b', winnerDisplayName: 'Bob' }]
  });
  assert.deepEqual(o, { winnerUserId: 'b', winnerDisplayName: 'Bob' });
});

test('finished draw has no winner', () => {
  assert.equal(resolveDuelOutcome({ phase: 'FINISHED', winnerUserId: null }).winnerUserId, null);
});

test('forfeit only when not already finished', () => {
  assert.equal(isOpponentForfeit('PLAYING', { winnerUserId: 'me' }, 'me'), true);
  assert.equal(isOpponentForfeit('FINISHED', { winnerUserId: 'me' }, 'me'), false);
  assert.equal(isOpponentForfeit('PLAYING', { winnerUserId: 'x' }, 'me'), false);
  assert.equal(isOpponentForfeit('PLAYING', null, 'me'), false);
});

test('turn countdown', () => {
  const s = { phase: 'PLAYING', turnStartedAt: 1000, turnTimeoutMs: 45000 };
  assert.equal(turnSecondsLeft(s, 1000), 45);
  assert.equal(turnSecondsLeft(s, 1000 + 44500), 1);
  assert.equal(turnSecondsLeft(s, 99999999), 0);
  assert.equal(turnSecondsLeft({ phase: 'ROUND_OVER', turnStartedAt: 1 }, 5), null);
});

test('error text', () => {
  assert.equal(bingoErrorText('ALREADY_STARTED'), '');
  assert.match(bingoErrorText('TURN_BASED'), /turn based/);
  assert.equal(bingoErrorText(undefined, 'boom'), 'boom');
});
