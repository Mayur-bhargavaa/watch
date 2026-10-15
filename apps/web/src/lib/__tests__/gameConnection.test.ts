import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconnectDelayMs,
  decideOnClose,
  mapGameError,
  isValidReactionEmoji,
  sanitizeReactionEmoji,
  forfeitWinForMe,
  isTerminalErrorCode,
  RECONNECT_MAX_MS,
  RECONNECT_MAX_ATTEMPTS
} from '../gameConnection';

test('backoff grows and is capped', () => {
  assert.equal(reconnectDelayMs(0, () => 0), 1000);
  assert.equal(reconnectDelayMs(1, () => 0), 2000);
  assert.equal(reconnectDelayMs(3, () => 0), 8000);
  assert.equal(reconnectDelayMs(10, () => 1), RECONNECT_MAX_MS);
  assert.ok(reconnectDelayMs(2, () => 1) <= 5000);
});

test('close decisions', () => {
  assert.deepEqual(decideOnClose({ code: 1006 }, null, 0), { action: 'reconnect' });
  assert.deepEqual(decideOnClose({ code: 4403 }, null, 0), { action: 'stop', reason: 'NOT_A_PLAYER' });
  assert.deepEqual(decideOnClose({ code: 4001 }, null, 0), { action: 'stop', reason: 'AUTH_REQUIRED' });
  assert.deepEqual(decideOnClose({ code: 1000 }, 'NOT_A_PLAYER', 0), { action: 'stop', reason: 'NOT_A_PLAYER' });
  assert.deepEqual(decideOnClose({ code: 1000, reason: 'replaced' }, null, 0), { action: 'stop', reason: 'KICKED' });
  assert.deepEqual(decideOnClose({ code: 1006 }, 'RATE_LIMITED', 0), { action: 'reconnect' });
  assert.deepEqual(decideOnClose({ code: 1006 }, null, RECONNECT_MAX_ATTEMPTS), { action: 'stop', reason: 'GAVE_UP' });
  assert.equal(isTerminalErrorCode('RATE_LIMITED'), false);
  assert.equal(isTerminalErrorCode('GAME_ROOM_NOT_FOUND'), true);
});

test('error mapping', () => {
  assert.deepEqual(mapGameError({ code: 'NOT_YOUR_TURN', message: 'Not your turn', action: 'x' }), {
    code: 'NOT_YOUR_TURN', message: 'Not your turn', action: 'x'
  });
  assert.equal(mapGameError({}).code, 'ACTION_FAILED');
  assert.equal(mapGameError({ code: 'HOST_ONLY' }).message, 'Only the host can do that.');
  assert.equal(mapGameError(null).message.length > 0, true);
});

test('reaction validation', () => {
  assert.equal(isValidReactionEmoji('❤️'), true);
  assert.equal(isValidReactionEmoji('🎉'), true);
  assert.equal(isValidReactionEmoji('hello'), false);
  assert.equal(isValidReactionEmoji({}), false);
  assert.equal(isValidReactionEmoji('🎉'.repeat(5)), false);
  assert.equal(sanitizeReactionEmoji({ a: 1 }), null);
  assert.equal(sanitizeReactionEmoji('🔥'), '🔥');
});

test('forfeit win only for me when server says so', () => {
  assert.equal(forfeitWinForMe({ isWinner: true, winnerUserId: 'me', userId: 'o' }, 'me'), true);
  assert.equal(forfeitWinForMe({ isWinner: false, winnerUserId: 'me', userId: 'o' }, 'me'), false);
  assert.equal(forfeitWinForMe({ isWinner: true, winnerUserId: 'o2', userId: 'o' }, 'me'), false);
});
