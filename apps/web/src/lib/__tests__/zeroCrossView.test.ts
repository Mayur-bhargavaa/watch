import test from 'node:test';
import assert from 'node:assert/strict';
import { actionForTap, clockOffset, isZeroCrossState, formatClock, markOfSeat, movablePieces, newMoveId, resultText, secondsLeft, targetCells } from '../zeroCrossView';
import type { ZeroCrossGameState } from '@synccinema/common';

const base = (over: Partial<ZeroCrossGameState> = {}): ZeroCrossGameState => ({
  gameId: 'g', board: Array(9).fill(null), currentTurnSeat: 0, currentTurnMark: 'X', phase: 'placement', status: 'active',
  remainingPlacements: { X: 3, O: 3 }, durationSeconds: 300, deadlineAt: new Date(1_000_000 + 300_000).toISOString(), startedAt: new Date(1_000_000).toISOString(),
  winner: null, winnerUserId: null, winningLine: null, isDraw: false, finishReason: null, startingSeat: 0, version: 1, moveCount: 0, lastMove: null, processedMoveIds: [], statusMessage: '', ...over
});

test('the countdown comes from the server deadline and the clock offset, not from when the screen opened', () => {
  const s = base();
  assert.equal(secondsLeft(s, 1_000_000, 0), 300);
  assert.equal(secondsLeft(s, 1_100_000, 0), 200);
  // a device clock 60 s fast is corrected by the offset the server time gave
  const offset = clockOffset(new Date(1_000_000).toISOString(), 1_060_000);
  assert.equal(offset, -60_000);
  assert.equal(secondsLeft(s, 1_060_000, offset), 300);
  // a screen that was asleep for ten minutes shows the real time left: none
  assert.equal(secondsLeft(s, 1_000_000 + 600_000, 0), 0);
  assert.equal(secondsLeft(base({ deadlineAt: null }), 5, 0), null);
});

test('clock text', () => {
  assert.equal(formatClock(300), '5:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(null), 'No timer');
  assert.equal(clockOffset(undefined, 5), 0);
  assert.equal(clockOffset('nonsense', 5), 0);
});

test('during placement every empty cell is a target, and a tap places', () => {
  const s = base({ board: ['X', null, null, 'O', null, null, null, null, null] });
  assert.deepEqual(targetCells(s, 'X', null), [1, 2, 4, 5, 6, 7, 8]);
  assert.deepEqual(actionForTap(s, 'X', null, 4), { type: 'send', action: { kind: 'place', to: 4 } });
  assert.equal(actionForTap(s, 'X', null, 3), null); // occupied
  assert.deepEqual(targetCells(s, 'O', null), [], 'not O\'s turn');
  assert.equal(actionForTap(s, 'O', null, 4), null);
});

test('during movement you pick up one of your pieces and then tap any empty cell', () => {
  const s = base({ phase: 'movement', remainingPlacements: { X: 0, O: 0 }, board: ['X', 'X', null, 'O', 'O', null, 'X', 'O', null] });
  assert.deepEqual(movablePieces(s, 'X'), [0, 1, 6]);
  assert.deepEqual(movablePieces(s, 'O'), []);
  assert.deepEqual(targetCells(s, 'X', null), []);
  assert.deepEqual(actionForTap(s, 'X', null, 0), { type: 'select', cell: 0 });
  assert.deepEqual(actionForTap(s, 'X', 0, 0), { type: 'deselect' });
  assert.deepEqual(actionForTap(s, 'X', 0, 1), { type: 'select', cell: 1 }); // switch piece
  assert.deepEqual(targetCells(s, 'X', 0), [2, 5, 8]);
  assert.deepEqual(actionForTap(s, 'X', 0, 8), { type: 'send', action: { kind: 'move', from: 0, to: 8 } });
  assert.equal(actionForTap(s, 'X', null, 8), null); // nothing picked up
  assert.equal(actionForTap(s, 'X', 0, 3), null); // the opponent's piece
});

test('nothing is interactive once the match is over', () => {
  const s = base({ status: 'won', phase: 'finished' });
  assert.deepEqual(targetCells(s, 'X', null), []);
  assert.equal(actionForTap(s, 'X', null, 4), null);
});

test('seats map to marks and move ids look unique', () => {
  assert.equal(markOfSeat(0), 'X');
  assert.equal(markOfSeat(1), 'O');
  assert.equal(markOfSeat(null), null);
  const ids = new Set(Array.from({ length: 200 }, () => newMoveId()));
  assert.equal(ids.size, 200);
  assert.ok([...ids].every((i) => i.length <= 64));
});

test('the result card says the right thing for every way a match can end', () => {
  const names = { X: 'Asha', O: 'Ben' };
  assert.equal(resultText(base({ status: 'won', winner: 'X' }), 'X', names).title, 'VICTORY!');
  assert.equal(resultText(base({ status: 'won', winner: 'X' }), 'O', names).title, 'OPPONENT WON!');
  assert.equal(resultText(base({ status: 'won', winner: 'X' }), null, names).title, 'Asha WON!');
  assert.equal(resultText(base({ status: 'surrendered', winner: 'O' }), 'X', names).title, 'YOU SURRENDERED');
  assert.equal(resultText(base({ status: 'surrendered', winner: 'O' }), 'O', names).title, 'THEY SURRENDERED!');
  assert.equal(resultText(base({ status: 'timeout', isDraw: true }), 'X', names).title, 'DRAW!');
  assert.equal(resultText(base({ status: 'forfeit', winner: 'X' }), 'X', names).detail, 'Your opponent left the match.');
  assert.equal(resultText(base({ status: 'cancelled' }), 'X', names).title, 'MATCH CANCELLED');
});

test('only a state in the current format is accepted by the screens', () => {
  assert.equal(isZeroCrossState(base()), true);
  assert.equal(isZeroCrossState(null), false);
  assert.equal(isZeroCrossState({ board: Array(9).fill(null), currentTurnSeat: 0 }), false); // an old plain 3x3 state
  assert.equal(isZeroCrossState({ ...base(), remainingPlacements: undefined }), false);
  assert.equal(isZeroCrossState({ ...base(), board: [] }), false);
});
