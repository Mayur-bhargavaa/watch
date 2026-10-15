import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const PREFIX = 'scrypt$';
const KEYLEN = 64;

export function isHashed(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `${PREFIX}${salt.toString('base64')}$${key.toString('base64')}`;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verifies a password against a stored value. Legacy rows that still hold a plaintext password
 * are compared in constant time and flagged `needsRehash` so the caller can upgrade them on login.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };
  if (!isHashed(stored)) {
    const h = (s: string) => createHash('sha256').update(s).digest();
    return { ok: safeEqual(h(password), h(stored)), needsRehash: true };
  }
  const [, saltB64, keyB64] = stored.split('$');
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return { ok: safeEqual(actual, expected), needsRehash: false };
}

/** Burns comparable CPU time for unknown accounts so login timing doesn't reveal which emails exist. */
export async function dummyVerify(password: string): Promise<void> {
  await scrypt(password, Buffer.alloc(16), KEYLEN);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters long';
  if (password.length > 200) return 'Password is too long';
  return null;
}
