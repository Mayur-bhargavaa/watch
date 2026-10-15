import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSpectateRequested,
  applySpectateParam,
  isSpectatorAllowedMessage,
  spectatorInfoFromSync,
  spectatorsFromEvent,
  decideEndAction
} from '../spectator';
import { decideOnClose, isTerminalErrorCode, terminalReasonForCode } from '../gameConnection';

test('spectate flag parsing', () => {
  assert.equal(isSpectateRequested('1'), true);
  assert.equal(isSpectateRequested('true'), true);
  assert.equal(isSpectateRequested('0'), false);
  assert.equal(isSpectateRequested(null), false);
});

test('socket url params', () => {
  const p = new URLSearchParams({ gameType: 'ludo', create: '1' });
  applySpectateParam(p, true);
  assert.equal(p.get('spectate'), '1');
  assert.equal(p.has('create'), false);
  const q = new URLSearchParams({ create: '1' });
  applySpectateParam(q, false);
  assert.equal(q.has('spectate'), false);
  assert.equal(q.get('create'), '1');
});

test('spectator allowed messages', () => {
  assert.equal(isSpectatorAllowedMessage('game:reaction'), true);
  assert.equal(isSpectatorAllowedMessage('game:leave'), true);
  assert.equal(isSpectatorAllowedMessage('game:roll_dice'), false);
  assert.equal(isSpectatorAllowedMessage('game:chat'), false);
  assert.equal(isSpectatorAllowedMessage(undefined), false);
});

test('role from sync', () => {
  const s = spectatorInfoFromSync({ role: 'spectator', spectatorCount: 3, spectators: ['A', 'B'], myPlayer: null });
  assert.deepEqual(s, { role: 'spectator', isSpectator: true, spectatorCount: 3, spectators: ['A', 'B'] });
  const p = spectatorInfoFromSync({ role: 'player' });
  assert.equal(p.isSpectator, false);
  assert.equal(spectatorInfoFromSync(undefined).isSpectator, false);
  assert.equal(spectatorInfoFromSync({ role: 'spectator', spectators: ['A'] }).spectatorCount, 1);
  assert.deepEqual(spectatorsFromEvent({ count: 2, names: ['x', 5, 'y'] }), { count: 2, names: ['x', 'y'] });
});

test('SPECTATOR_LIMIT is terminal', () => {
  assert.equal(isTerminalErrorCode('SPECTATOR_LIMIT'), true);
  assert.equal(terminalReasonForCode('SPECTATOR_LIMIT'), 'SPECTATOR_LIMIT');
  assert.deepEqual(decideOnClose({ code: 4403 }, 'SPECTATOR_LIMIT', 0), { action: 'stop', reason: 'SPECTATOR_LIMIT' });
  assert.equal(isTerminalErrorCode('RATE_LIMITED'), false);
});

test('end action decision', () => {
  const base = { opponentLeft: false, rematchUnavailable: false, opponentUserId: 'u2', friendIds: ['u2'] };
  assert.equal(decideEndAction(base), 'rematch');
  assert.equal(decideEndAction({ ...base, opponentLeft: true }), 'new_game');
  assert.equal(decideEndAction({ ...base, rematchUnavailable: true }), 'new_game');
  assert.equal(decideEndAction({ ...base, opponentLeft: true, friendIds: [] }), 'back');
  assert.equal(decideEndAction({ ...base, opponentLeft: true, friendIds: null }), 'back');
  assert.equal(decideEndAction({ ...base, opponentLeft: true, opponentUserId: 'bot_1', friendIds: ['bot_1'] }), 'back');
  assert.equal(decideEndAction({ ...base, isSpectator: true }), 'back');
});
