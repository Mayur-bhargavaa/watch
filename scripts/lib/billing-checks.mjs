/** Pure go-live checks for scripts/billing-check.mjs. Takes an env object and the text of legal.ts; never returns secrets. */
const RZP = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_PLAN_PLUS_MONTHLY', 'RAZORPAY_PLAN_PLUS_YEARLY'];
const STRIPE_PRICES = ['MONTHLY', 'YEARLY'].flatMap((i) => ['USD', 'EUR', 'GBP'].map((c) => `STRIPE_PRICE_PLUS_${i}_${c}`));
const STRIPE = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', ...STRIPE_PRICES];

const has = (env, k) => typeof env[k] === 'string' && env[k].trim() !== '';
const missing = (env, keys) => keys.filter((k) => !has(env, k));
const isHttps = (v) => /^https:\/\/[^\s,]+$/i.test(v.trim());

export const legalPlaceholders = (legalText) => [...String(legalText).matchAll(/^\s*(\w+):\s*'(TODO[^']*)'/gm)].map((m) => m[1]);

/** returns [{ status: 'PASS'|'FAIL'|'WARN', item, detail }] */
export function evaluate(env, legalText = '') {
  const out = [];
  const add = (status, item, detail = '') => out.push({ status, item, detail });
  const mode = (env.BILLING_MODE || 'off').toLowerCase();

  if (mode === 'live') add('PASS', 'BILLING_MODE is live');
  else add('FAIL', 'BILLING_MODE is live', `it is "${['off', 'mock'].includes(mode) ? mode : 'invalid'}"`);

  add(mode === 'mock' ? 'FAIL' : 'PASS', 'Mock billing disabled', mode === 'mock' ? 'BILLING_MODE=mock hands out paid tiers for free' : '');
  add(env.NODE_ENV === 'production' ? 'PASS' : 'FAIL', 'NODE_ENV=production', env.NODE_ENV === 'production' ? '' : `it is "${env.NODE_ENV || 'unset'}"`);

  const mR = missing(env, RZP), mS = missing(env, STRIPE);
  const rOk = mR.length === 0, sOk = mS.length === 0;
  const provider = (name, miss, all, ok, otherOk) => {
    if (ok) add('PASS', `${name} variables complete`);
    else if (miss.length < all.length) add('FAIL', `${name} variables complete`, `partly configured, missing: ${miss.join(', ')}`);
    else if (otherOk) add('WARN', `${name} variables complete`, `not configured (the other provider is; ${name === 'Razorpay' ? 'India' : 'international'} buyers cannot pay)`);
    else add('FAIL', `${name} variables complete`, `missing: ${miss.join(', ')}`);
  };
  provider('Razorpay', mR, RZP, rOk, sOk);
  provider('Stripe (all six price ids)', mS, STRIPE, sOk, rOk);

  const whR = has(env, 'RAZORPAY_WEBHOOK_SECRET'), whS = has(env, 'STRIPE_WEBHOOK_SECRET');
  const rUsed = mR.length < RZP.length, sUsed = mS.length < STRIPE.length;
  if ((!rUsed || whR) && (!sUsed || whS) && (whR || whS)) add('PASS', 'Webhook secrets set');
  else add('FAIL', 'Webhook secrets set', 'RAZORPAY_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET missing for a provider you use');

  if (has(env, 'RAZORPAY_KEY_ID')) add(/^rzp_live_/.test(env.RAZORPAY_KEY_ID.trim()) ? 'PASS' : 'WARN', 'Razorpay key is a live key', /^rzp_live_/.test(env.RAZORPAY_KEY_ID.trim()) ? '' : 'looks like a test key');
  if (has(env, 'STRIPE_SECRET_KEY')) add(/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY.trim()) ? 'PASS' : 'WARN', 'Stripe key is a live key', /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY.trim()) ? '' : 'looks like a test key');

  add(has(env, 'WEB_BASE_URL') && isHttps(env.WEB_BASE_URL) ? 'PASS' : 'FAIL', 'WEB_BASE_URL is https', has(env, 'WEB_BASE_URL') ? (isHttps(env.WEB_BASE_URL) ? '' : 'not https') : 'unset');
  const cors = (env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!cors.length) add('FAIL', 'CORS_ORIGINS is https', 'unset');
  else add(cors.every(isHttps) ? 'PASS' : 'FAIL', 'CORS_ORIGINS is https', cors.every(isHttps) ? '' : 'contains a non-https origin');
  add(has(env, 'TRUST_PROXY') ? 'PASS' : 'FAIL', 'TRUST_PROXY set', has(env, 'TRUST_PROXY') ? '' : 'client IPs and rate limits are wrong behind a proxy without it');

  const todo = legalPlaceholders(legalText);
  if (!legalText) add('WARN', 'Legal details filled in (apps/web/src/lib/legal.ts)', 'file not found');
  else add(todo.length ? 'FAIL' : 'PASS', 'Legal details filled in (apps/web/src/lib/legal.ts)', todo.length ? `still TODO: ${todo.join(', ')}` : '');

  const allow = (env.BILLING_ALLOWLIST || '').split(',').filter((x) => x.trim()).length;
  add(allow ? 'WARN' : 'PASS', 'Pilot allow-list (BILLING_ALLOWLIST)', allow ? `ON for ${allow} people: unset it to open payments to everyone` : 'not set: payments are open to everyone');
  return out;
}

export const failCount = (results) => results.filter((r) => r.status === 'FAIL').length;
