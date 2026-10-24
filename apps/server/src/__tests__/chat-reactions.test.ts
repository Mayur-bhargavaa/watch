import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReaction, validReactionEmoji } from '../services/messageActions.js';

const msg = (extra: object = {}) => ({ senderId: 'a', recipientId: 'b', type: 'text', content: 'hi', createdAt: '2026-10-24T10:00:00.000Z', ...extra });

test('only real emoji are accepted as a reaction', () => {
  for (const ok of ['👍', '❤️', '😂', '🙏', '🇮🇳', '👍🏽']) assert.equal(validReactionEmoji(ok), true, ok);
  for (const bad of ['', 'a', 'ok', '1', ' 👍', '👍 ', '<script>', 5, null, undefined, '👍'.repeat(10)]) assert.equal(validReactionEmoji(bad as unknown), false, String(bad));
});

test('either person in the chat can react; a stranger cannot', () => {
  assert.equal(prepareReaction(msg(), 'a', '👍').ok, true);
  assert.equal(prepareReaction(msg(), 'b', '👍').ok, true);
  const r = prepareReaction(msg(), 'c', '👍');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 403);
});

test('a missing or deleted message cannot be reacted to', () => {
  for (const m of [null, msg({ isDeleted: true })]) {
    const r = prepareReaction(m as never, 'a', '👍');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 404);
  }
});

test('a bad emoji is refused with 400', () => {
  const r = prepareReaction(msg(), 'a', 'hello');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 400);
});

test('reacting adds you, the same emoji again takes it back, and the other person is told', () => {
  const first = prepareReaction(msg(), 'b', '❤️');
  assert.ok(first.ok);
  if (!first.ok) return;
  assert.deepEqual(first.value.reactions, [{ emoji: '❤️', count: 1, userIds: ['b'] }]);
  assert.equal(first.value.added, true);
  assert.equal(first.value.otherId, 'a');
  const second = prepareReaction(msg({ reactions: first.value.reactions }), 'a', '❤️');
  assert.ok(second.ok);
  if (second.ok) assert.deepEqual(second.value.reactions, [{ emoji: '❤️', count: 2, userIds: ['b', 'a'] }]);
  const undo = prepareReaction(msg({ reactions: first.value.reactions }), 'b', '❤️');
  assert.ok(undo.ok);
  if (undo.ok) {
    assert.deepEqual(undo.value.reactions, []);
    assert.equal(undo.value.added, false);
  }
});

test('different emoji stack side by side and the input is never changed', () => {
  const stored = [{ emoji: '😂', count: 1, userIds: ['a'] }];
  const r = prepareReaction(msg({ reactions: stored }), 'b', '👍');
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.reactions.map((x) => x.emoji), ['😂', '👍']);
  assert.deepEqual(stored, [{ emoji: '😂', count: 1, userIds: ['a'] }]);
});

test('a message cannot collect more than 20 different reactions', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ emoji: String.fromCodePoint(0x1f600 + i), count: 1, userIds: ['a'] }));
  const r = prepareReaction(msg({ reactions: many }), 'b', '🙏');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 400);
  assert.equal(prepareReaction(msg({ reactions: many }), 'b', many[0].emoji).ok, true);
});
