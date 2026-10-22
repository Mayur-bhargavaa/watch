import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RpsBoard } from '../RpsBoard';
import type { RpsGameState } from '@synccinema/common';

const state = (over: Partial<RpsGameState> = {}): RpsGameState => ({
  matchId: 'm', roundId: 'm:2', format: 'best-of-3', winsNeeded: 2, status: 'choosing', round: 2, scores: [1, 0], locked: [false, false], reveal: null,
  deadlineAt: new Date(Date.now() + 8000).toISOString(), countdownSeconds: 3, chooseSeconds: 10, winner: null, winnerUserId: null, isDraw: false,
  finishReason: null, startingSeat: 0, currentTurnSeat: 0, version: 3, statusMessage: '', ...over
});
const names: [string, string] = ['Asha', 'Ben'];
const html = (s: unknown, mySeat: number | null, myPick: { roundId: string; choice: string | null; locked: boolean } | null = null, online = true) =>
  renderToStaticMarkup(React.createElement(RpsBoard, { state: s as RpsGameState | null, mySeat, online, clockOffsetMs: 0, myPick, onChoose: () => {}, onLock: () => {}, names }));
const reveal = (winnerSeat: number | null) => ({ round: 2, choices: ['rock', 'scissors'] as [any, any], winnerSeat, reason: (winnerSeat === null ? 'draw' : 'beats') as any, timedOut: [] as number[] });

test('three named, keyboard-reachable choice buttons: rock, paper, scissors', () => {
  const out = html(state(), 0);
  assert.equal((out.match(/role="radio"/g) ?? []).length, 3);
  for (const label of ['Rock', 'Paper', 'Scissors']) assert.ok(out.includes(`aria-label="${label}"`), label);
  assert.equal((out.match(/<button type="button"/g) ?? []).length, 4); // three choices and Lock
  assert.ok(out.includes('role="radiogroup"'));
});

test('before picking: the choices are enabled, Lock is disabled, and the other player shows as choosing', () => {
  const out = html(state(), 0);
  assert.ok(!/role="radio"[^>]*disabled/.test(out));
  assert.ok(out.includes('Pick one first'));
  assert.ok(out.includes('Opponent is choosing...'));
  assert.ok(out.includes('Choose now'));
});

test('a picked choice is highlighted and can be locked', () => {
  const out = html(state(), 0, { roundId: 'm:2', choice: 'paper', locked: false });
  assert.ok(out.includes('aria-checked="true"'));
  assert.ok(out.includes('Lock Choice'));
});

test('after locking: the choices and the button are disabled and it says so', () => {
  const out = html(state({ locked: [true, false] }), 0, { roundId: 'm:2', choice: 'paper', locked: true });
  assert.ok(out.includes('Locked in'));
  assert.ok(out.includes('LOCKED'));
  assert.equal((out.match(/disabled=""/g) ?? []).length, 4);
});

test('a pick from an earlier round never carries into this round', () => {
  const out = html(state(), 0, { roundId: 'm:1', choice: 'rock', locked: true });
  assert.ok(out.includes('Pick one first'));
  assert.ok(!out.includes('Locked in'));
});

test('the other player locking shows only that they locked, never what they chose', () => {
  const out = html(state({ locked: [false, true] }), 0);
  assert.ok(out.includes('Opponent has locked their choice'));
  assert.ok(!out.includes('aria-checked="true"'));
});

test('a spectator can watch but not choose or lock', () => {
  const out = html(state(), null);
  assert.ok(out.includes('Players are choosing'));
  assert.ok(!out.includes('Lock Choice') && !out.includes('Pick one first'));
  assert.equal((out.match(/disabled=""/g) ?? []).length, 3);
});

test('offline players cannot choose', () => {
  assert.equal((html(state(), 0, null, false).match(/disabled=""/g) ?? []).length, 4);
});

test('countdown shows the round, the number and a timer role', () => {
  const out = html(state({ status: 'countdown', round: 1, deadlineAt: new Date(Date.now() + 2500).toISOString() }), 0);
  assert.ok(out.includes('Round 1'));
  assert.ok(out.includes('role="timer"'));
  assert.ok(/>(3|2|1|GO!)</.test(out));
  assert.equal((out.match(/role="radio"/g) ?? []).length, 0);
});

test('the reveal shows both choices at once; the result says Win, Lose or Draw from my side', () => {
  const rv = state({ status: 'round-result', reveal: reveal(0), deadlineAt: new Date(Date.now() + 2500).toISOString() });
  const mine = html(rv, 0);
  assert.ok(mine.includes('You Win!'));
  assert.ok(mine.includes('Asha (You)') && mine.includes('Ben'));
  assert.ok(mine.includes('rock') && mine.includes('scissors'));
  assert.ok(html(rv, 1).includes('You Lose'));
  assert.ok(html({ ...rv, reveal: reveal(null) }, 0).includes('Draw'));
  assert.ok(html(rv, null).includes('Asha wins the round'));
});

test('the score is shown and announced', () => {
  const out = html(state({ scores: [1, 2] }), 0);
  assert.ok(out.includes('aria-label="Score 1 to 2"'));
  assert.ok(out.includes('Best of 3'));
});

test('a timed-out round says why', () => {
  const rv = state({ status: 'round-result', reveal: { round: 2, choices: ['rock', null], winnerSeat: 0, reason: 'timeout-award', timedOut: [1] }, deadlineAt: new Date(Date.now() + 2000).toISOString() });
  const out = html(rv, 0);
  assert.ok(out.includes('The other player ran out of time.'));
  assert.ok(out.includes('no choice'));
});

test('animations are opt-in for people who allow motion', () => {
  const out = html(state({ status: 'revealing', reveal: reveal(0), deadlineAt: new Date(Date.now() + 1000).toISOString() }), 0);
  const classes = (out.match(/class="[^"]*"/g) ?? []).join(' ').split(/\s+/).map((c) => c.replace(/^class="/, ''));
  assert.ok(classes.every((c) => !/^(animate-|zoom-|slide-in)/.test(c)), 'no bare animation classes');
  assert.ok(classes.some((c) => c.startsWith('motion-safe:')));
});

test('a state from another game is not drawn and nothing is drawn before the first state', () => {
  assert.ok(html({ board: [] }, 0).includes('not a Rock Paper Scissors match'));
  assert.equal(html(null, 0), '');
});
