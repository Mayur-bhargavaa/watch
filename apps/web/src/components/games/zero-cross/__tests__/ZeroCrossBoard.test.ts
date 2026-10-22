import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZeroCrossBoard, ZeroCrossClock } from '../ZeroCrossBoard';
import type { ZeroCrossGameState } from '@synccinema/common';

const state = (over: Partial<ZeroCrossGameState> = {}): ZeroCrossGameState => ({
  gameId: 'g', board: Array(9).fill(null), currentTurnSeat: 0, currentTurnMark: 'X', phase: 'placement', status: 'active',
  remainingPlacements: { X: 3, O: 3 }, durationSeconds: null, deadlineAt: null, startedAt: new Date(0).toISOString(),
  winner: null, winnerUserId: null, winningLine: null, isDraw: false, finishReason: null, startingSeat: 0, version: 1, moveCount: 0, lastMove: null, processedMoveIds: [], statusMessage: '', ...over
});
const names = { X: 'Asha', O: 'Ben' };
const html = (s: ZeroCrossGameState | null, mySeat: number | null, online = true, rejection: { id: number; message: string } | null = null) =>
  renderToStaticMarkup(React.createElement(ZeroCrossBoard, { state: s, mySeat, online, clockOffsetMs: 0, onAct: () => {}, rejection, names }));

test('the board has nine named squares, each a real button (keyboard and touch)', () => {
  const out = html(state(), 0);
  assert.equal((out.match(/role="gridcell"/g) ?? []).length, 9);
  assert.equal((out.match(/<button type="button"/g) ?? []).length, 9);
  assert.ok(out.includes('row 1, column 1: empty'));
  assert.ok(out.includes('row 3, column 3: empty'));
});

test('turn indicator: it says what to do on your turn and who is acting otherwise', () => {
  assert.ok(html(state(), 0).includes('Place a piece (3 left)'));
  assert.ok(html(state(), 1).includes('Asha is placing a piece'));
  const moving = state({ phase: 'movement', remainingPlacements: { X: 0, O: 0 }, board: ['X', 'X', null, 'O', 'O', null, 'X', 'O', null] });
  assert.ok(html(moving, 0).includes('Pick up one of your pieces'));
  assert.ok(html(moving, 1).includes('Asha is moving a piece'));
});

test('the pieces left to place are shown for both players', () => {
  const out = html(state({ remainingPlacements: { X: 1, O: 2 } }), 0);
  assert.ok(out.includes('Asha (Cross) has 1 pieces left to place'));
  assert.ok(out.includes('Ben (Zero) has 2 pieces left to place'));
});

test('X and O differ by shape and by words, not by colour alone', () => {
  const out = html(state({ board: ['X', 'O', null, null, null, null, null, null, null] }), 0);
  assert.ok(out.includes('Cross piece'));
  assert.ok(out.includes('Zero piece'));
  assert.ok(out.includes('d="M5 5l14 14M19 5L5 19"')); // the cross is a cross
  assert.ok(out.includes('<circle cx="12" cy="12" r="6.5"')); // the zero is a ring
});

test('a spectator can look but never act: every square is disabled', () => {
  const out = html(state(), null);
  assert.equal((out.match(/aria-disabled="true"/g) ?? []).length, 9);
});

test('when it is not your turn, or you are offline, the squares are disabled', () => {
  assert.equal((html(state(), 1).match(/aria-disabled="true"/g) ?? []).length, 9);
  assert.equal((html(state(), 0, false).match(/aria-disabled="true"/g) ?? []).length, 9);
  assert.equal((html(state(), 0).match(/aria-disabled="false"/g) ?? []).length, 9);
});

test('movement: your own pieces are marked as movable', () => {
  const moving = state({ phase: 'movement', remainingPlacements: { X: 0, O: 0 }, board: ['X', 'X', null, 'O', 'O', null, 'X', 'O', null] });
  const out = html(moving, 0);
  assert.equal((out.match(/you can move it/g) ?? []).length, 3);
  assert.equal((html(moving, 1).match(/you can move it/g) ?? []).length, 0);
});

test('the winning line is highlighted and the board is read-only after the match', () => {
  const won = state({ status: 'won', phase: 'finished', winner: 'X', winningLine: [0, 1, 2], board: ['X', 'X', 'X', 'O', 'O', null, null, null, null] });
  const out = html(won, 0);
  assert.equal((out.match(/bg-amber-500\/25/g) ?? []).length, 3);
  assert.ok(out.includes('Match over'));
  assert.equal((out.match(/aria-disabled="true"/g) ?? []).length, 9);
});

test('a rejected move shows its reason in a polite live region', () => {
  const out = html(state(), 0, true, { id: 1, message: 'Time ran out before your move' });
  assert.ok(out.includes('aria-live="polite"'));
  assert.ok(out.includes('Time ran out before your move'));
});

test('animations are opt-in for people who allow motion (reduced-motion is respected)', () => {
  const out = html(state({ board: ['X', null, null, null, null, null, null, null, null], lastMove: { seat: 0, kind: 'place', from: null, to: 0, moveId: null } }), 0);
  const classes = (out.match(/class="[^"]*"/g) ?? []).join(' ').split(/\s+/);
  assert.ok(classes.every((c) => !/^(animate-|zoom-)/.test(c.replace(/^class="/, ''))), 'no bare animation classes');
  assert.ok(classes.some((c) => c.startsWith('motion-safe:')));
});

test('the clock: no timer, and a deadline that has passed shows 0:00', () => {
  const clock = (s: ZeroCrossGameState | null) => renderToStaticMarkup(React.createElement(ZeroCrossClock, { state: s, clockOffsetMs: 0 }));
  assert.ok(clock(state({ deadlineAt: null })).includes('No timer'));
  assert.ok(clock(state({ deadlineAt: new Date(Date.now() - 5000).toISOString() })).includes('0:00'));
  assert.ok(clock(state({ deadlineAt: new Date(Date.now() - 5000).toISOString() })).includes('role="timer"'));
});

test('nothing is drawn before the first state arrives', () => {
  assert.equal(html(null, 0), '');
});

test('an old-format state (a room from before Zero Cross had its own rules) shows a clear message and does not crash', () => {
  const old = { board: Array(9).fill(null), currentTurnSeat: 0, currentTurnMark: 'X', winner: null, isDraw: false, moveCount: 0 } as unknown as ZeroCrossGameState;
  const out = html(old, 0);
  assert.ok(out.includes('older version of Zero Cross'));
  assert.equal((out.match(/role="gridcell"/g) ?? []).length, 0);
  const clock = renderToStaticMarkup(React.createElement(ZeroCrossClock, { state: old, clockOffsetMs: 0 }));
  assert.ok(clock.includes('No timer'));
});

test('every piece sits in a full-size centring box, so it is centred in its square (not pushed to a corner)', () => {
  const out = html(state({ board: ['X', 'O', null, null, null, null, null, null, null], lastMove: { seat: 0, kind: 'place', from: null, to: 0, moveId: null } }), 0);
  // each square that holds a piece wraps it in a flex box that fills the square and centres its child
  assert.equal((out.match(/class="flex h-full w-full items-center justify-center/g) ?? []).length, 2);
});
