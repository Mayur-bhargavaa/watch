/** Loads the REAL TVmaze responses captured on 2026-10-17 (see the `_source` field inside each JSON file). Tests only. */
import { readFileSync } from 'node:fs';

export function tvmazeFixture(name: string): any {
  const raw = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
  return raw.data;
}
