import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, failCount, legalPlaceholders } from '../lib/billing-checks.mjs';

const RZP = { RAZORPAY_KEY_ID: 'rzp_live_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w', RAZORPAY_PLAN_PLUS_MONTHLY: 'p1', RAZORPAY_PLAN_PLUS_YEARLY: 'p2' };
const STRIPE = { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'w', ...Object.fromEntries(['MONTHLY', 'YEARLY'].flatMap((i) => ['USD', 'EUR', 'GBP'].map((c) => [`STRIPE_PRICE_PLUS_${i}_${c}`, 'price_1']))) };
const GOOD = { BILLING_MODE: 'live', NODE_ENV: 'production', WEB_BASE_URL: 'https://app.example.com', CORS_ORIGINS: 'https://app.example.com', TRUST_PROXY: '1', ...RZP, ...STRIPE };
const status = (r, part) => r.find((x) => x.item.includes(part))?.status;

test('a fully configured environment has no FAIL', () => {
  assert.equal(failCount(evaluate(GOOD, "x: 'ok'")), 0);
});

test('an empty environment fails the key items and never echoes values', () => {
  const r = evaluate({ BILLING_MODE: 'mock', RAZORPAY_KEY_SECRET: 'super-secret-value' }, "companyName: 'TODO: name'");
  assert.ok(failCount(r) >= 6);
  assert.equal(status(r, 'Mock billing'), 'FAIL');
  assert.equal(status(r, 'NODE_ENV'), 'FAIL');
  assert.ok(!JSON.stringify(r).includes('super-secret-value'));
  assert.equal(status(r, 'Legal'), 'FAIL');
});

test('half a provider fails, one whole provider is enough with a warning for the other', () => {
  const half = evaluate({ ...GOOD, ...Object.fromEntries(Object.keys(STRIPE).slice(0, 3).map((k) => [k, ''])) });
  assert.equal(status(half, 'Stripe'), 'FAIL');
  const onlyRzp = evaluate({ ...GOOD, ...Object.fromEntries(Object.keys(STRIPE).map((k) => [k, ''])) });
  assert.equal(status(onlyRzp, 'Stripe'), 'WARN');
  assert.equal(failCount(onlyRzp), 0);
});

test('https checks, test keys and allow-list warnings', () => {
  const r = evaluate({ ...GOOD, WEB_BASE_URL: 'http://x.test', CORS_ORIGINS: 'https://a.test,http://b.test', RAZORPAY_KEY_ID: 'rzp_test_1', BILLING_ALLOWLIST: 'a@b.c,d' });
  assert.equal(status(r, 'WEB_BASE_URL'), 'FAIL');
  assert.equal(status(r, 'CORS_ORIGINS'), 'FAIL');
  assert.equal(status(r, 'Razorpay key'), 'WARN');
  assert.equal(status(r, 'Pilot'), 'WARN');
});

test('legalPlaceholders lists only TODO values', () => {
  assert.deepEqual(legalPlaceholders("a: 'TODO: x',\n  b: 'Real',\n  c: 'TODO: y'"), ['a', 'c']);
});
