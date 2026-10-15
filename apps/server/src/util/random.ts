import { randomInt, randomBytes } from 'node:crypto';

/** Cryptographically secure replacement for Math.random(): float in [0, 1). */
export function secureRandom(): number {
  return randomBytes(6).readUIntBE(0, 6) / 2 ** 48;
}

/** Secure random integer in [0, max). */
export function secureInt(max: number): number {
  return randomInt(max);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

/** Secure random code of `length` chars from an unambiguous alphabet. */
export function secureCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
