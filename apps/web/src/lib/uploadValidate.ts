/**
 * Pure validation for the /api/upload fallback: the real content decides the type (magic bytes), never the client's file name,
 * extension or Content-Type. SVG / HTML / scripts have no entry here, so they are always refused.
 */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export interface SniffedUpload {
  ext: string;
  mime: string;
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...Array.from(b.slice(from, to)));

export function sniffUpload(b: Uint8Array): SniffedUpload | null {
  if (!b || b.length < 12) return null;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg' };
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', mime: 'image/png' };
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { ext: 'gif', mime: 'image/gif' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (ascii(b, 0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg' };
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { ext: 'webm', mime: 'video/webm' };
  if (ascii(b, 4, 8) === 'ftyp') return { ext: 'mp4', mime: 'video/mp4' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg' };
  return null;
}

export type UploadCheck = { ok: true; ext: string; mime: string } | { ok: false; status: 400 | 413 | 415; error: string };

export function checkUpload(bytes: Uint8Array): UploadCheck {
  if (!bytes || bytes.length === 0) return { ok: false, status: 400, error: 'Empty file' };
  if (bytes.length > UPLOAD_MAX_BYTES) return { ok: false, status: 413, error: 'File too large' };
  const kind = sniffUpload(bytes);
  if (!kind) return { ok: false, status: 415, error: 'Only image, audio and video files are allowed' };
  return { ok: true, ...kind };
}
