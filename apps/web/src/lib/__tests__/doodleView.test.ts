import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLobbyDrawer, roleSelectionPayload, phaseTotalSeconds, resolveFinalWinner, maskedLetterCount, chunkPoints, clamp01
} from '../doodleView';

const P = [{ userId: 'a' }, { userId: 'b' }];

test('lobby drawer: conflict is settled by host', () => {
  assert.equal(resolveLobbyDrawer(P, 'b', 'a', { a: 'drawer', b: 'drawer' }), 'b');
  assert.equal(resolveLobbyDrawer(P, 'a', 'a', { a: 'guesser', b: 'guesser' }), 'b');
});
test('lobby drawer: explicit single choice and default', () => {
  assert.equal(resolveLobbyDrawer(P, 'a', 'a', { b: 'drawer' }), 'b');
  assert.equal(resolveLobbyDrawer(P, 'a', undefined, {}), 'a');
  assert.equal(resolveLobbyDrawer([], 'a', undefined, {}), '');
});
test('role payload', () => {
  assert.equal(roleSelectionPayload(true, 'a', 'b'), 'b');
  assert.equal(roleSelectionPayload(false, 'b', 'b'), 'drawer');
  assert.equal(roleSelectionPayload(false, 'b', 'a'), 'guesser');
});
test('phase totals', () => {
  const cfg = { drawTime: 45, guessTime: 30 };
  assert.equal(phaseTotalSeconds('DRAWING', cfg), 45);
  assert.equal(phaseTotalSeconds('GUESSING', cfg), 30);
  assert.equal(phaseTotalSeconds('ROUND_INTRO', cfg), 3);
  assert.equal(phaseTotalSeconds('WORD_CHOICE', cfg), 30);
  assert.equal(phaseTotalSeconds('ROUND_RESULT', cfg), 5);
});
test('final winner', () => {
  assert.equal(resolveFinalWinner({ finalWinnerUserId: 'b', scores: { a: 100, b: 0 } }, ['a', 'b']), 'b');
  assert.equal(resolveFinalWinner({ finalWinnerUserId: null, scores: { a: 100, b: 0 } }, ['a', 'b']), null);
  assert.equal(resolveFinalWinner({ scores: { a: 1, b: 5 } }, ['a', 'b']), 'b');
});
test('masked letter count handles non-latin', () => {
  assert.equal(maskedLetterCount('_ _ _'), 3);
  assert.equal(maskedLetterCount('日 _'), 2);
  assert.equal(maskedLetterCount(null), 0);
});
test('chunkPoints and clamp', () => {
  assert.deepEqual(chunkPoints([1, 2, 3], 5), [[1, 2, 3]]);
  const pts = Array.from({ length: 1300 }, (_, i) => i);
  const c = chunkPoints(pts, 600);
  assert.ok(c.every(x => x.length <= 600));
  assert.equal(c[0][599], c[1][0]);
  assert.equal(c[c.length - 1][c[c.length - 1].length - 1], 1299);
  assert.equal(clamp01(NaN), 0);
  assert.equal(clamp01(2), 1);
});
