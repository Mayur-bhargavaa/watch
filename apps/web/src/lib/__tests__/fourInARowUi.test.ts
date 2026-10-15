import test from 'node:test';
import assert from 'node:assert/strict';
import { colorForSeat, victoryCopy, rematchButtonLabel, canDropInColumn } from '../fourInARowUi';

test('colorForSeat', () => {
  assert.equal(colorForSeat(0), 'R');
  assert.equal(colorForSeat(1), 'Y');
  assert.equal(colorForSeat(undefined), null);
});

test('victoryCopy forfeit vs line vs draw', () => {
  assert.match(victoryCopy({ hasWinner: true, isDraw: false, hasWinningLine: false, winnerColor: 'red', iWon: true }).subtitle, /forfeit/);
  assert.match(victoryCopy({ hasWinner: true, isDraw: false, hasWinningLine: true, winnerColor: 'red', iWon: false }).subtitle, /4 discs/);
  assert.equal(victoryCopy({ hasWinner: false, isDraw: true, hasWinningLine: false, iWon: false }).title, 'GAME DRAW!');
});

test('rematchButtonLabel', () => {
  assert.equal(rematchButtonLabel(true, 1, 2), 'Waiting (1/2)');
  assert.equal(rematchButtonLabel(false, 0, 2), 'Play Rematch');
});

test('canDropInColumn', () => {
  const b = Array.from({ length: 6 }, () => Array(7).fill(null));
  assert.equal(canDropInColumn(b, 3), true);
  assert.equal(canDropInColumn(b, 1.5), false);
  assert.equal(canDropInColumn(b, NaN), false);
  assert.equal(canDropInColumn(b, 7), false);
  b[0][2] = 'R';
  assert.equal(canDropInColumn(b, 2), false);
});
