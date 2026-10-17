import test from 'node:test';
import assert from 'node:assert/strict';
import {
nextReconnectDelay,
createDeduper,
summariseChats,
createChatBatcher,
shouldShowOsBanner,
safeInternalLink,
notificationStorageKey
} from '../notifyHelpers';

test('backs off exponentially, with jitter, capped at 30s', () => {
  assert.equal(nextReconnectDelay(0, () => 1), 1000);
  assert.equal(nextReconnectDelay(3, () => 1), 8000);
  assert.equal(nextReconnectDelay(3, () => 0), 4000);
  assert.equal(nextReconnectDelay(20, () => 1), 30000);
});

test('dedupes by id but never swallows id-less events', () => {
  const d = createDeduper(2);
  assert.equal(d.first('a'), true);
  assert.equal(d.first('a'), false);
  assert.equal(d.first(undefined), true);
  d.first('b');
  d.first('c'); // evicts a
  assert.equal(d.first('a'), true);
});

test('summarises a burst into one notification', () => {
  assert.equal(summariseChats([]), null);
  assert.partialDeepStrictEqual(summariseChats([{ conversationId: 'c1', senderName: 'Aarav', preview: 'hi' }]), { title: 'Aarav', body: 'hi', count: 1 });
  const s = summariseChats([
    { conversationId: 'c1', senderName: 'Aarav', preview: 'one' },
    { conversationId: 'c1', senderName: 'Aarav', preview: 'two' }
  ])!;
  assert.partialDeepStrictEqual(s, { title: '2 new messages', conversationId: 'c1', count: 2 });
  assert.equal(s.body, 'Aarav: two');
  const multi = summariseChats([
    { conversationId: 'c1', senderName: 'A', preview: 'x' },
    { conversationId: 'c2', senderName: 'B', preview: 'y' }
  ])!;
  assert.equal(multi.conversationId, null);
  assert.equal(multi.body, 'From A, B');
});

test('batcher flushes once per window', () => {
const out: number[] = [];
let pending: (() => void) | null = null;
const timers = {
set: ((fn: () => void) => { pending = fn; return 1 as any; }) as any,
clear: (() => { pending = null; }) as any
};
const b = createChatBatcher((items) => out.push(items.length), 700, timers);
for (let i = 0; i < 5; i++) b.add({ conversationId: 'c', senderName: 'A', preview: String(i) });
assert.deepEqual(out, []);
pending!();
assert.deepEqual(out, [5]);
b.add({ conversationId: 'c', senderName: 'A', preview: 'later' });
b.cancel();
assert.equal(pending, null);
assert.deepEqual(out, [5]);
});

test('skips the OS banner only while the user is looking at the app', () => {
  assert.equal(shouldShowOsBanner({ focused: true, hidden: false }), false);
  assert.equal(shouldShowOsBanner({ focused: false, hidden: false }), true);
  assert.equal(shouldShowOsBanner({ focused: true, hidden: true }), true);
  assert.equal(shouldShowOsBanner({ focused: true, hidden: false, forced: true }), true);
});

test('only allows in-app links and scopes storage per user', () => {
  assert.equal(safeInternalLink('/chat?userId=1'), '/chat?userId=1');
  assert.equal(safeInternalLink('https://evil.example'), '/dashboard');
  assert.equal(safeInternalLink('//evil.example'), '/dashboard');
  assert.equal(notificationStorageKey(null), null);
  assert.notEqual(notificationStorageKey('u1'), notificationStorageKey('u2'));
});

test('safeInternalLink rejects backslash and control-character open-redirect tricks', () => {
  assert.equal(safeInternalLink('/\\evil.example', '/discover'), '/discover');
  assert.equal(safeInternalLink('/\t/evil.example', '/discover'), '/discover');
  assert.equal(safeInternalLink('javascript:alert(1)', '/discover'), '/discover');
  assert.equal(safeInternalLink('/room/abc?x=1', '/discover'), '/room/abc?x=1');
});
