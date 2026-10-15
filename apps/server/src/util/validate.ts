import { safeUrl } from '@synccinema/common';

/** Trimmed string of at most `max` chars, or undefined when the value is not a string. */
export function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.trim().slice(0, max) : undefined;
}

/** Strips angle brackets so a name/title can never carry markup even if a client forgets to escape. */
export function plainText(v: unknown, max: number): string | undefined {
  const s = str(v, max);
  return s === undefined ? undefined : s.replace(/[<>]/g, '');
}

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,}$/;
export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

const DATA_IMG_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
/** Avatar must be http(s), an app-relative path, or a small base64 raster image. Never javascript:/svg. */
export function safeAvatar(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (v.length <= 400_000 && DATA_IMG_RE.test(v)) return v;
  return safeUrl(v, { allowRelative: true, maxLength: 1000 }) ?? undefined;
}

export const ROOM_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,23}$/;

export { safeUrl };
