import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCanonicalConvId,
  extractParticipantIds,
  directPeerId,
  conversationAliases,
  normalizeConversationId,
  isSameConversation
} from '../chatIds';

const ME = 'usr_uszT_FJyFm'; // real ids contain underscores (nanoid alphabet)
const BOB = 'usr_Bob12345_x';
const AL = 'usr_Al';
const ALAN = 'usr_Alan';

test('toCanonicalConvId is order independent', () => {
  assert.equal(toCanonicalConvId(ME, BOB), toCanonicalConvId(BOB, ME));
  assert.match(toCanonicalConvId(ME, BOB), /^conv_/);
});

test('directPeerId resolves the other user from a canonical id, in either direction', () => {
  assert.equal(directPeerId(toCanonicalConvId(ME, BOB), ME), BOB);
  assert.equal(directPeerId(toCanonicalConvId(ME, BOB), BOB), ME);
  assert.equal(directPeerId('conv_group_123', ME), undefined, 'groups have no single peer');
});

test('legacy conv_<friendId> ids resolve to the friend', () => {
  assert.equal(directPeerId(`conv_${BOB}`, ME), BOB);
  assert.equal(extractParticipantIds('', ME).userIds.length, 0);
});

test('aliases never include conv_<myId> (it would merge every chat of the user)', () => {
  const aliases = conversationAliases(toCanonicalConvId(ME, BOB), ME);
  assert.ok(aliases.includes(toCanonicalConvId(ME, BOB)));
  assert.ok(aliases.includes(`conv_${BOB}`));
  assert.ok(!aliases.includes(`conv_${ME}`));
});

test('normalizeConversationId returns the canonical id for legacy ids', () => {
  assert.equal(normalizeConversationId(`conv_${BOB}`, ME), toCanonicalConvId(ME, BOB));
  assert.equal(normalizeConversationId('conv_group_9', ME), 'conv_group_9');
});

test('isSameConversation: same peer yes, different peer no, and NEVER by substring', () => {
  assert.ok(isSameConversation(`conv_${BOB}`, toCanonicalConvId(BOB, ME), ME));
  assert.ok(!isSameConversation(toCanonicalConvId(ME, AL), toCanonicalConvId(ME, ALAN), ME), 'usr_Al vs usr_Alan must differ');
  assert.ok(!isSameConversation(`conv_${AL}`, `conv_${ALAN}`, ME));
  assert.ok(!isSameConversation('conv_group_1', 'conv_group_12', ME));
  assert.ok(!isSameConversation(undefined, 'conv_x', ME));
});
