import test from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_PACK } from '../../components/chat/StickersData';

test('sticker ids are unique (they are used as React keys)', () => {
  const ids = STICKER_PACK.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(STICKER_PACK.find((s) => s.id === 'bubu_dance'));
});
