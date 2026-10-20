import test from 'node:test';
import assert from 'node:assert/strict';
import { EDIT_WINDOW_MS, prepareDelete, prepareEdit, preparePin } from '../services/messageActions.js';

const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const msg = (over: Record<string, unknown> = {}) => ({ senderId: 'a', recipientId: 'b', type: 'text', content: 'hi', createdAt: new Date(NOW - 60_000).toISOString(), ...over });

test('edit: the sender changes their own text message inside the window', () => {
  const r = prepareEdit(msg(), 'a', '  hello  ', NOW);
  assert.ok(r.ok && r.value.content === 'hello' && r.value.editedAt === new Date(NOW).toISOString());
});
test('edit: refused for someone else, old messages, stickers, empty text and missing messages', () => {
  assert.equal((prepareEdit(msg(), 'b', 'x', NOW) as { status: number }).status, 403);
  assert.equal((prepareEdit(msg({ createdAt: new Date(NOW - EDIT_WINDOW_MS - 1).toISOString() }), 'a', 'x', NOW) as { status: number }).status, 400);
  assert.equal((prepareEdit(msg({ content: '[sticker:1]' }), 'a', 'x', NOW) as { status: number }).status, 400);
  assert.equal((prepareEdit(msg({ type: 'plan' }), 'a', 'x', NOW) as { status: number }).status, 400);
  assert.equal((prepareEdit(msg(), 'a', '   ', NOW) as { status: number }).status, 400);
  assert.equal((prepareEdit(null, 'a', 'x', NOW) as { status: number }).status, 404);
  assert.equal((prepareEdit(msg({ isDeleted: true }), 'a', 'x', NOW) as { status: number }).status, 404);
});
test('delete: only the sender, and it reports who to tell', () => {
  const ok = prepareDelete(msg(), 'a');
  assert.ok(ok.ok && ok.value.recipientId === 'b');
  assert.equal((prepareDelete(msg(), 'b') as { status: number }).status, 403);
  assert.equal((prepareDelete(null, 'a') as { status: number }).status, 404);
});
test('pin: both people can pin, pinning again unpins, strangers cannot', () => {
  const a = preparePin(msg(), 'a');
  assert.ok(a.ok && a.value.isPinned && a.value.otherId === 'b');
  const b = preparePin(msg({ isPinned: true }), 'b');
  assert.ok(b.ok && !b.value.isPinned && b.value.otherId === 'a');
  assert.equal((preparePin(msg(), 'c') as { status: number }).status, 403);
});
