/**
 * Dependency-free, allow-list SVG sanitizer used on BOTH the server (before storing/relaying a drawn
 * sticker) and the web client (before injecting it with dangerouslySetInnerHTML).
 * It re-serialises only known-safe elements/attributes and returns null for anything else
 * (scripts, event handlers, foreignObject, external references, entities, comments, CDATA...).
 */
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs',
  'lineargradient', 'radialgradient', 'stop', 'animate', 'animatetransform'
]);

const ALLOWED_ATTRS = new Set([
  'xmlns', 'viewbox', 'width', 'height', 'preserveaspectratio', 'd', 'points', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'x1', 'y1', 'x2', 'y2', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule',
  'transform', 'class', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform',
  'attributename', 'values', 'dur', 'repeatcount', 'from', 'to', 'begin', 'keytimes', 'calcmode', 'type',
  'additive', 'style'
]);

const MAX_SVG_LENGTH = 40_000;
const SAFE_VALUE = /^[A-Za-z0-9\s.,:;#%()_\-+/]*$/; // no quotes, <, >, &, \, or backticks

// The drawing tool emits exactly this style on strokes; no other CSS is accepted.
const SAFE_STYLE = /^filter:\s*drop-shadow\(\s*[0-9.]+(px)?\s+[0-9.]+(px)?\s+[0-9.]+(px)?\s*(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,\s%]+\)|[a-zA-Z]{3,20})\s*\)\s*;?$/;
// Tailwind arbitrary-value classes use [ ] _ ; allow them for `class` only.
const SAFE_CLASS = /^[A-Za-z0-9\s_\-:/.,()#%\[\]]*$/;

function valueIsSafe(name: string, value: string): boolean {
  if (name === 'style') return SAFE_STYLE.test(value);
  if (name === 'class') return SAFE_CLASS.test(value) && !/javascript|script|url\(/i.test(value);
  if (!SAFE_VALUE.test(value)) return false;
  const lower = value.toLowerCase();
  if (lower.includes('javascript') || lower.includes('data:') || lower.includes('script')) return false;
  // url(...) is only allowed as a same-document fragment reference: url(#id)
  const urls = lower.match(/url\([^)]*\)/g) || [];
  if (urls.some((u) => !/^url\(\s*#[a-z0-9_-]+\s*\)$/.test(u))) return false;
  return !(name === 'xmlns' && value !== 'http://www.w3.org/2000/svg');
}

export function sanitizeSvg(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const src = input.trim();
  if (!src || src.length > MAX_SVG_LENGTH || !/^<svg[\s>]/i.test(src)) return null;

  const out: string[] = [];
  const stack: string[] = [];
  const tagRe = /<[^<>]*>/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(src))) {
    if (src.slice(last, m.index).trim() !== '') return null; // text nodes are not allowed
    last = m.index + m[0].length;
    const tag = m[0];

    const close = /^<\/\s*([A-Za-z][A-Za-z0-9]*)\s*>$/.exec(tag);
    if (close) {
      const name = close[1].toLowerCase();
      if (stack.pop() !== name) return null;
      out.push(`</${name}>`);
      continue;
    }

    const open = /^<([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z:-]+\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*)\s*(\/?)>$/.exec(tag);
    if (!open) return null; // comments, <!DOCTYPE>, <?xml?>, malformed markup, unquoted attrs...
    const name = open[1].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return null;

    let attrs = '';
    const attrRe = /([A-Za-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(open[2]))) {
      const attr = a[1].toLowerCase();
      const value = a[2] ?? a[3] ?? '';
      if (!ALLOWED_ATTRS.has(attr) || !valueIsSafe(attr, value)) return null; // on*, href, style, ... rejected
      attrs += ` ${a[1]}="${value}"`;
    }

    if (open[3] === '/') {
      out.push(`<${name}${attrs}/>`);
    } else {
      stack.push(name);
      out.push(`<${name}${attrs}>`);
    }
  }

  if (src.slice(last).trim() !== '' || stack.length !== 0) return null;
  return out.join('');
}

/** Only absolute http(s) URLs (or app-relative paths when allowRelative) are acceptable link targets. */
export function safeUrl(value: unknown, opts: { allowRelative?: boolean; maxLength?: number } = {}): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > (opts.maxLength ?? 2048)) return null;
  if (opts.allowRelative && /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}
