#!/usr/bin/env node
/**
 * Go-live checklist for Watch+ billing (see BILLING.md). Reads the same environment as the server (and
 * apps/server/.env when present, without printing any value). Exit code = number of FAIL items. Never prints secrets.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, failCount } from './lib/billing-checks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
const envFile = join(ROOT, 'apps/server/.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#') || env[m[1]] !== undefined) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const legalPath = join(ROOT, 'apps/web/src/lib/legal.ts');
const results = evaluate(env, existsSync(legalPath) ? readFileSync(legalPath, 'utf8') : '');

const c = process.stdout.isTTY ? { PASS: '\x1b[32m', FAIL: '\x1b[31m', WARN: '\x1b[33m', off: '\x1b[0m' } : { PASS: '', FAIL: '', WARN: '', off: '' };
console.log('Watch+ billing go-live checklist (values are never printed)\n');
for (const r of results) console.log(`${c[r.status]}${r.status}${c.off}  ${r.item}${r.detail ? `  -  ${r.detail}` : ''}`);
const n = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${n('PASS')} passed, ${n('WARN')} warnings, ${n('FAIL')} failed`);
console.log('Owner-only items this script cannot check: provider KYC, GSTIN/accountant, lawyer review of the legal pages, a full test-mode run-through.');
process.exit(Math.min(failCount(results), 255));
