/**
 * Pure helpers for the "draw your own sticker" tool: turning strokes into a SMALL, SAFE svg and a safe caption.
 * The result must pass `sanitizeSvg` (max 40 KB) and fit the chat message limits, so long scribbles are simplified.
 */
export interface DrawPoint {
  x: number;
  y: number;
}
export interface DrawStroke {
  points: DrawPoint[];
  color: string;
  size: number;
  glow: string;
}
export type StickerAnimation = 'float' | 'pulse' | 'spin' | 'wiggle';

/** Keep the whole svg well below the sanitizer limit (40,000) and the 60,000 media-message limit. */
export const MAX_STICKER_SVG_CHARS = 24_000;
const MIN_POINT_DISTANCE = 2;

/** Drops points that are closer than `minDistance` to the previous kept point (mouse/touch events are very dense). */
export function thinPoints(points: DrawPoint[], minDistance = MIN_POINT_DISTANCE): DrawPoint[] {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minDistance) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

function perpendicularDistance(p: DrawPoint, a: DrawPoint, b: DrawPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/** Ramer-Douglas-Peucker: the same shape with far fewer points. Iterative, so a 10,000 point stroke cannot overflow the stack. */
export function simplifyPoints(points: DrawPoint[], epsilon: number): DrawPoint[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Caption goes into `[draw:<svg>|<caption>]`: "|", "[", "]" and markup would break parsing, so they are removed. */
export function sanitizeTagline(text: string, fallback = 'HAND-DRAWN'): string {
  const clean = text.replace(/[|\[\]<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 26);
  return clean || fallback;
}

const round = (n: number) => Math.round(n);

function strokeToPath(stroke: DrawStroke, points: DrawPoint[]): string {
  const first = points[0];
  // A single tap is a dot: "M x y L x y" with round caps draws a circle, a lone "M" draws nothing
  const d =
    points.length === 1
      ? `M ${round(first.x)} ${round(first.y)} L ${round(first.x)} ${round(first.y)}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.size}" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 ${stroke.size}px ${stroke.glow})"/>`;
}

function wrapAnimation(paths: string, animation: StickerAnimation): { inner: string; cls: string } {
  if (animation === 'wiggle') {
    // CSS classes cannot rotate around the svg centre safely, so use the SVG animation the sanitizer allows
    const inner = `<g><animateTransform attributeName="transform" type="rotate" values="-7 140 140;7 140 140;-7 140 140" dur="0.7s" repeatCount="indefinite"/>${paths}</g>`;
    return { inner, cls: '' };
  }
  const cls = animation === 'spin' ? 'animate-spin' : animation === 'pulse' ? 'animate-pulse' : 'animate-bounce';
  return { inner: paths, cls };
}

export type BuildResult = { ok: true; svg: string } | { ok: false; reason: 'empty' | 'too-complex' };

/** Builds the sticker svg; simplifies progressively until it fits MAX_STICKER_SVG_CHARS. */
export function buildStickerSvg(strokes: DrawStroke[], animation: StickerAnimation): BuildResult {
  const drawn = strokes.filter((s) => s.points.length > 0);
  if (drawn.length === 0) return { ok: false, reason: 'empty' };
  for (const epsilon of [0.8, 1.5, 2.5, 4, 6]) {
    const paths = drawn.map((s) => strokeToPath(s, simplifyPoints(thinPoints(s.points), epsilon))).join('');
    const { inner, cls } = wrapAnimation(paths, animation);
    const svg = `<svg viewBox="0 0 280 280" class="w-full h-full ${cls} drop-shadow-[0_4px_12px_rgba(255,45,117,0.6)]">${inner}</svg>`.replace('h-full  drop', 'h-full drop');
    if (svg.length <= MAX_STICKER_SVG_CHARS) return { ok: true, svg };
  }
  return { ok: false, reason: 'too-complex' };
}
