import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownWord, isRpsLive, isRpsState, opponentStatus, outcomeFor, outcomeText, phaseLabel, phaseSeconds } from '../rpsView';
import type { RpsGameState } from '@synccinema/common';

const state = (over: Partial<RpsGameState> = {}): RpsGameState => ({
  matchId: 'm', roundId: 'm:1', format: 'best-of-3', winsNeeded: 2, status: 'choosing', round: 1, scores: [0, 0], locked: [false, false], reveal: null,
  deadlineAt: new Date(1_000_000 + 10_000).toISOString(), countdownSeconds: 3, chooseSeconds: 10, winner: null, winnerUserId: null, isDraw: false,
  finishReason: null, startingSeat: 0, currentTurnSeat: 0, version: 1, statusMessage: '', ...over
});

test('the countdown comes from the server deadline and the clock offset', () => {
  const s = state();
  assert.equal(phaseSeconds(s, 1_000_000, 0), 10);
  assert.equal(phaseSeconds(s, 1_004_500, 0), 6);
  assert.equal(phaseSeconds(s, 1_060_000, -60_000), 10); // a device clock one minute fast is corrected
  assert.equal(phaseSeconds(s, 2_000_000, 0), 0);
  assert.equal(phaseSeconds(state({ deadlineAt: null }), 1, 0), null);
});

test('3, 2, 1, GO!', () => {
  assert.equal(countdownWord(3), '3');
  assert.equal(countdownWord(1), '1');
  assert.equal(countdownWord(0), 'GO!');
  assert.equal(countdownWord(null), '');
});

test('the outcome is from my side, and a spectator has none', () => {
  const win0 = { round: 1, choices: ['rock', 'scissors'] as [any, any], winnerSeat: 0, reason: 'beats' as const, timedOut: [] };
  assert.equal(outcomeFor(win0, 0), 'win');
  assert.equal(outcomeFor(win0, 1), 'lose');
  assert.equal(outcomeFor(win0, null), null);
  assert.equal(outcomeFor({ ...win0, winnerSeat: null, reason: 'draw' }, 1), 'draw');
  assert.equal(outcomeFor(null, 0), null);
  assert.equal(outcomeText('win'), 'You Win!');
  assert.equal(outcomeText('lose'), 'You Lose');
  assert.equal(outcomeText('draw'), 'Draw');
});

test('the opponent is only ever "choosing" or "locked": their choice is never known', () => {
  assert.equal(opponentStatus(state(), 0), 'choosing');
  assert.equal(opponentStatus(state({ locked: [false, true] }), 0), 'locked');
  assert.equal(opponentStatus(state({ locked: [true, false] }), 0), 'choosing');
  assert.equal(opponentStatus(state({ locked: [true, false] }), 1), 'locked');
  assert.equal(opponentStatus(state({ status: 'revealing' }), 0), null);
  assert.equal(opponentStatus(state(), null), null);
});

test('only a state in the right format is drawn; phases have labels', () => {
  assert.equal(isRpsState(state()), true);
  assert.equal(isRpsState({ board: [] }), false);
  assert.equal(isRpsState(null), false);
  assert.equal(isRpsLive(state()), true);
  assert.equal(isRpsLive(state({ status: 'match-result' })), false);
  assert.equal(phaseLabel(state({ status: 'countdown' })), 'GET READY');
  assert.equal(phaseLabel(state({ status: 'forfeit' })), 'FORFEIT');
});
