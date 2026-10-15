import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSvg } from '@synccinema/common';
import { buildStickerSvg, sanitizeTagline, simplifyPoints, thinPoints, MAX_STICKER_SVG_CHARS, type DrawStroke } from '../drawSticker';
import { formatDrawStickerMessage, parseStickerMessage } from '../../components/chat/StickersData';

const stroke = (n: number, jitter = 0): DrawStroke => ({
  color: '#ff2d75',
  glow: '#ff2d75',
  size: 7,
  points: Array.from({ length: n }, (_, i) => ({ x: 20 + ((i * 3) % 240) + (i % 2) * jitter, y: 20 + ((i * 5) % 240) }))
});

test('a long scribble is simplified to a small svg that still passes the sanitiser', () => {
  const result = buildStickerSvg([stroke(4000, 1), stroke(4000, 2), stroke(4000)], 'float');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.ok(result.svg.length <= MAX_STICKER_SVG_CHARS, `svg is ${result.svg.length} chars`);
  assert.ok(sanitizeSvg(result.svg), 'sanitiser rejected the sticker');
  assert.ok(formatDrawStickerMessage(result.svg, 'HI').length < 60_000);
});

test('a single tap becomes a visible dot; an empty drawing is refused', () => {
  const tap: DrawStroke = { color: '#fff', glow: '#fff', size: 6, points: [{ x: 50, y: 60 }] };
  const r = buildStickerSvg([tap], 'pulse');
  assert.ok(r.ok && r.svg.includes('M 50 60 L 50 60'));
  assert.deepEqual(buildStickerSvg([], 'float'), { ok: false, reason: 'empty' });
});

test('every animation produces a sanitiser-approved svg and wiggle really wiggles', () => {
  for (const anim of ['float', 'pulse', 'spin', 'wiggle'] as const) {
    const r = buildStickerSvg([stroke(30)], anim);
    assert.ok(r.ok && sanitizeSvg(r.svg), anim);
  }
  const w = buildStickerSvg([stroke(30)], 'wiggle');
  assert.ok(w.ok && w.svg.includes('animateTransform') && !w.svg.includes('animate-bounce'));
});

test('simplify keeps the ends and the corners, thin drops near-duplicates', () => {
  const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
  assert.equal(simplifyPoints(line, 0.5).length, 2);
  const corner = [...line, ...Array.from({ length: 50 }, (_, i) => ({ x: 49, y: i + 1 }))];
  const s = simplifyPoints(corner, 0.5);
  assert.deepEqual([s[0], s[s.length - 1]], [corner[0], corner[corner.length - 1]]);
  assert.ok(s.some((p) => p.x === 49 && p.y === 0));
  assert.equal(thinPoints([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]).length, 3);
});

test('captions cannot break the [draw:svg|caption] format', () => {
  assert.equal(sanitizeTagline('A|B] <x>'), 'AB x');
  assert.equal(sanitizeTagline('   '), 'HAND-DRAWN');
  const r = buildStickerSvg([stroke(10)], 'float');
  assert.ok(r.ok);
  if (!r.ok) return;
  const parsed = parseStickerMessage(formatDrawStickerMessage(r.svg, sanitizeTagline('MISS|YOU]')));
  assert.ok(parsed && sanitizeSvg(parsed.drawingSvg) && parsed.name === 'MISSYOU');
});

test('the same drawn message always resolves to the same sticker id (stable React key)', () => {
  const r = buildStickerSvg([stroke(10)], 'float');
  assert.ok(r.ok);
  if (!r.ok) return;
  const msg = formatDrawStickerMessage(r.svg, 'HI');
  assert.equal(parseStickerMessage(msg)?.id, parseStickerMessage(msg)?.id);
});
