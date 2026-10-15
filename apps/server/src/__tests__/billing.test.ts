import './_noRealDb.js';
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setBillingFetchForTests,
  razorpayCreateSubscription,
  razorpayCancel,
  stripeCreateCheckout,
  stripeSetCancelAtPeriodEnd,
  stripePortal,
  mapRazorpayEvent,
  mapStripeEvent,
  computeEntitlement,
  canPurchase,
  billingAllowlist
} from '../services/billing.js';

// ---- fake fetch ----------------------------------------------------------------------------------------------
interface Call { url: string; init: RequestInit; body: string }
let calls: Call[] = [];
let reply: { status?: number; json: unknown } = { json: {} };
const ENV_KEYS = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_PLAN_PLUS_MONTHLY', 'RAZORPAY_PLAN_PLUS_YEARLY', 'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_PLUS_MONTHLY_USD', 'STRIPE_PRICE_PLUS_YEARLY_USD', 'STRIPE_PRICE_PLUS_MONTHLY_EUR', 'STRIPE_PRICE_PLUS_YEARLY_EUR',
  'STRIPE_PRICE_PLUS_MONTHLY_GBP', 'STRIPE_PRICE_PLUS_YEARLY_GBP', 'BILLING_ALLOWLIST'
];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    RAZORPAY_KEY_ID: 'rzp_test_KEYID', RAZORPAY_KEY_SECRET: 'rzp_secret', RAZORPAY_PLAN_PLUS_MONTHLY: 'plan_M', RAZORPAY_PLAN_PLUS_YEARLY: 'plan_Y',
    STRIPE_SECRET_KEY: 'sk_test_abc',
    STRIPE_PRICE_PLUS_MONTHLY_USD: 'price_m_usd', STRIPE_PRICE_PLUS_YEARLY_USD: 'price_y_usd',
    STRIPE_PRICE_PLUS_MONTHLY_EUR: 'price_m_eur', STRIPE_PRICE_PLUS_YEARLY_EUR: 'price_y_eur',
    STRIPE_PRICE_PLUS_MONTHLY_GBP: 'price_m_gbp', STRIPE_PRICE_PLUS_YEARLY_GBP: 'price_y_gbp'
  });
  calls = [];
  reply = { json: {} };
  setBillingFetchForTests(async (url, init) => {
    calls.push({ url, init, body: String(init.body ?? '') });
    return new Response(JSON.stringify(reply.json), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  });
});
afterEach(() => {
  setBillingFetchForTests(null);
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

const hdr = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name];

// ---- Razorpay adapter --------------------------------------------------------------------------------------
test('razorpay create-subscription: URL, Basic auth, plan id, notes carry our user id', async () => {
  reply = { json: { id: 'sub_123', short_url: 'https://rzp.io/i/abc' } };
  const r = await razorpayCreateSubscription('user-42', 'yearly');
  assert.deepEqual(r, { url: 'https://rzp.io/i/abc', id: 'sub_123' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.razorpay.com/v1/subscriptions');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(hdr(calls[0], 'authorization'), 'Basic ' + Buffer.from('rzp_test_KEYID:rzp_secret').toString('base64'));
  const body = JSON.parse(calls[0].body);
  assert.equal(body.plan_id, 'plan_Y');
  assert.deepEqual(body.notes, { userId: 'user-42', tier: 'plus', interval: 'yearly' });
  assert.equal(body.customer_notify, 1);
  await razorpayCreateSubscription('user-42', 'monthly');
  assert.equal(JSON.parse(calls[1].body).plan_id, 'plan_M');
});

test('razorpay: a non-https short_url or a provider error is refused', async () => {
  reply = { json: { id: 'sub_1', short_url: 'http://evil.example/x' } };
  await assert.rejects(() => razorpayCreateSubscription('u', 'monthly'), /Unexpected provider response/);
  reply = { status: 400, json: { error: { description: 'bad' } } };
  await assert.rejects(() => razorpayCreateSubscription('u', 'monthly'), /rejected/);
});

test('razorpay cancel uses cancel_at_cycle_end=1', async () => {
  await razorpayCancel('sub_9/../x');
  assert.equal(calls[0].url, 'https://api.razorpay.com/v1/subscriptions/sub_9%2F..%2Fx/cancel');
  assert.deepEqual(JSON.parse(calls[0].body), { cancel_at_cycle_end: 1 });
});

// ---- Stripe adapter ----------------------------------------------------------------------------------------
test('stripe checkout session: form body, price for currency/interval, return urls, ids', async () => {
  reply = { json: { url: 'https://checkout.stripe.com/c/pay/cs_test_1' } };
  const r = await stripeCreateCheckout({ userId: 'user-7', interval: 'yearly', currency: 'GBP', webBase: 'https://app.example.com' });
  assert.equal(r.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(hdr(calls[0], 'authorization'), 'Bearer sk_test_abc');
  assert.equal(hdr(calls[0], 'content-type'), 'application/x-www-form-urlencoded');
  const f = new URLSearchParams(calls[0].body);
  assert.equal(f.get('mode'), 'subscription');
  assert.equal(f.get('line_items[0][price]'), 'price_y_gbp');
  assert.equal(f.get('line_items[0][quantity]'), '1');
  assert.equal(f.get('client_reference_id'), 'user-7');
  assert.equal(f.get('metadata[userId]'), 'user-7');
  assert.equal(f.get('metadata[tier]'), 'plus');
  assert.equal(f.get('metadata[interval]'), 'yearly');
  assert.equal(f.get('subscription_data[metadata][userId]'), 'user-7');
  assert.ok(f.get('success_url')!.startsWith('https://app.example.com/billing/success'));
  assert.equal(f.get('cancel_url'), 'https://app.example.com/billing/cancelled');
  assert.equal(f.get('customer'), null);
  await stripeCreateCheckout({ userId: 'u', interval: 'monthly', currency: 'USD', webBase: 'https://a.b', customerId: 'cus_1' });
  const g = new URLSearchParams(calls[1].body);
  assert.equal(g.get('line_items[0][price]'), 'price_m_usd');
  assert.equal(g.get('customer'), 'cus_1');
});

test('stripe set cancel_at_period_end and customer portal session', async () => {
  await stripeSetCancelAtPeriodEnd('sub_abc', true);
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/subscriptions/sub_abc');
  assert.equal(new URLSearchParams(calls[0].body).get('cancel_at_period_end'), 'true');
  await stripeSetCancelAtPeriodEnd('sub_abc', false);
  assert.equal(new URLSearchParams(calls[1].body).get('cancel_at_period_end'), 'false');
  reply = { json: { url: 'https://billing.stripe.com/p/session/x' } };
  const url = await stripePortal('cus_9', 'https://app.example.com');
  assert.equal(url, 'https://billing.stripe.com/p/session/x');
  assert.equal(calls[2].url, 'https://api.stripe.com/v1/billing_portal/sessions');
  const f = new URLSearchParams(calls[2].body);
  assert.equal(f.get('customer'), 'cus_9');
  assert.equal(f.get('return_url'), 'https://app.example.com/plans');
});

// ---- Razorpay webhook fixtures -----------------------------------------------------------------------------
const NOW = Date.now();
const END_S = Math.floor(NOW / 1000) + 30 * 86400;
const rzpSub = (event: string, status: string, extra: Record<string, unknown> = {}) => ({
  entity: 'event', account_id: 'acc_1', event, contains: ['subscription'],
  payload: {
    subscription: { entity: { id: 'sub_RZ1', entity: 'subscription', plan_id: 'plan_M', status, customer_id: 'cust_1', current_start: END_S - 30 * 86400, current_end: END_S, paid_count: 1, notes: { userId: 'user-1', tier: 'plus', interval: 'monthly' } } },
    ...extra
  },
  created_at: END_S - 30 * 86400
});
const rzpPayment = { payment: { entity: { id: 'pay_RZ1', entity: 'payment', amount: 19900, currency: 'INR', status: 'captured', created_at: END_S - 30 * 86400, card: { last4: '1111' } } } };

test('razorpay subscription.activated -> active, period end, user from notes', () => {
  const m = mapRazorpayEvent(rzpSub('subscription.activated', 'active'), 'evt_1')!;
  assert.equal(m.eventId, 'evt_1');
  assert.equal(m.userId, 'user-1');
  assert.equal(m.providerSubscriptionId, 'sub_RZ1');
  assert.equal(m.patch.status, 'active');
  assert.equal(m.patch.tier, 'plus');
  assert.equal(m.patch.currency, 'INR');
  assert.equal(m.patch.interval, 'monthly');
  assert.equal(m.patch.currentPeriodEnd, END_S * 1000);
  assert.equal(m.patch.cancelAtPeriodEnd, false);
  assert.equal(m.payment, undefined);
});

test('razorpay subscription.charged -> active + sanitized payment (no card data)', () => {
  const m = mapRazorpayEvent(rzpSub('subscription.charged', 'active', rzpPayment), 'evt_2')!;
  assert.equal(m.patch.status, 'active');
  assert.equal(m.patch.currentPeriodEnd, END_S * 1000);
  assert.deepEqual(m.payment, { amount: 19900, currency: 'INR', paidAt: (END_S - 30 * 86400) * 1000, refs: ['pay_RZ1'] });
  assert.ok(!JSON.stringify(m).includes('1111'));
});

test('razorpay pending/halted -> past_due; cancelled/completed -> canceled keeping the paid period', () => {
  for (const t of ['subscription.pending', 'subscription.halted']) {
    const m = mapRazorpayEvent(rzpSub(t, 'halted'), 'e')!;
    assert.equal(m.patch.status, 'past_due');
    assert.equal(m.patch.currentPeriodEnd, END_S * 1000);
    assert.equal(m.patch.tier, undefined);
  }
  for (const t of ['subscription.cancelled', 'subscription.completed']) {
    const m = mapRazorpayEvent(rzpSub(t, 'cancelled'), 'e')!;
    assert.equal(m.patch.status, 'canceled');
    assert.equal(m.patch.cancelAtPeriodEnd, true);
    assert.equal(m.patch.currentPeriodEnd, END_S * 1000);
  }
});

test('period end decides entitlement: cancelled keeps access until the end, then free', () => {
  const m = mapRazorpayEvent(rzpSub('subscription.cancelled', 'cancelled'), 'e')!;
  const sub = { tier: 'plus' as const, interval: 'monthly' as const, ...m.patch };
  assert.equal(computeEntitlement(sub, NOW).tier, 'plus');
  assert.equal(computeEntitlement(sub, END_S * 1000 + 1000).tier, 'free');
});

test('razorpay refund.processed and payment.refunded are refund records only (no access patch)', () => {
  const a = mapRazorpayEvent({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_RZ1', amount: 19900, currency: 'INR' } } } }, 'evt_r1')!;
  assert.deepEqual(a.refund, { amount: 19900, currency: 'INR', refs: ['pay_RZ1'], refundId: 'rfnd_1' });
  assert.deepEqual(a.patch, {});
  assert.equal(a.userId, null);
  const b = mapRazorpayEvent({ event: 'payment.refunded', payload: { payment: { entity: { id: 'pay_RZ1', amount: 19900, amount_refunded: 5000, currency: 'INR', refund_status: 'partial' } } } }, 'evt_r2')!;
  assert.equal(b.refund!.amount, 5000);
  assert.deepEqual(b.patch, {});
});

test('razorpay: unknown types and malformed/missing fields are ignored safely', () => {
  assert.equal(mapRazorpayEvent(rzpSub('subscription.authenticated', 'authenticated'), 'e'), null);
  assert.equal(mapRazorpayEvent({ event: 'payment.failed', payload: {} }, 'e'), null);
  for (const bad of [null, undefined, 5, 'x', [], {}, { event: 7 }, { event: 'subscription.activated' }, { event: 'subscription.activated', payload: { subscription: null } }, { event: 'refund.processed', payload: {} }, { event: 'refund.processed', payload: { refund: { entity: { payment_id: 'p', amount: -5 } } } }]) {
    assert.equal(mapRazorpayEvent(bad as any, 'e'), null);
  }
  const m = mapRazorpayEvent({ event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_x', notes: [] } } } }, 'e')!;
  assert.equal(m.userId, null); // no user id in notes: the server looks the subscription up
  assert.equal(m.patch.currentPeriodEnd, null);
});

test('razorpay without an event id header derives a stable id from the raw body', () => {
  const raw = Buffer.from(JSON.stringify(rzpSub('subscription.activated', 'active')));
  const a = mapRazorpayEvent(rzpSub('subscription.activated', 'active'), undefined, raw)!;
  const b = mapRazorpayEvent(rzpSub('subscription.activated', 'active'), undefined, raw)!;
  assert.equal(a.eventId, b.eventId);
  assert.match(a.eventId, /^rzp_[0-9a-f]{40}$/);
});

// ---- Stripe webhook fixtures -------------------------------------------------------------------------------
const stripeEvt = (type: string, object: Record<string, unknown>, id = `evt_${type}`) => ({ id, object: 'event', api_version: '2025-01-27', type, created: END_S - 100, data: { object } });
const META = { userId: 'user-2', tier: 'plus', interval: 'yearly' };

test('stripe checkout.session.completed -> active with user, customer, currency and a payment row', () => {
  const m = mapStripeEvent(stripeEvt('checkout.session.completed', {
    id: 'cs_test_1', object: 'checkout.session', mode: 'subscription', client_reference_id: 'user-2', customer: 'cus_1', subscription: 'sub_ST1',
    currency: 'eur', amount_total: 3999, payment_status: 'paid', created: END_S - 100, invoice: 'in_1', metadata: META
  }))!;
  assert.equal(m.userId, 'user-2');
  assert.equal(m.providerSubscriptionId, 'sub_ST1');
  assert.equal(m.patch.status, 'active');
  assert.equal(m.patch.currency, 'EUR');
  assert.equal(m.patch.interval, 'yearly');
  assert.equal(m.patch.providerCustomerId, 'cus_1');
  assert.ok(m.patch.currentPeriodEnd! > Date.now());
  assert.deepEqual(m.payment, { amount: 3999, currency: 'EUR', paidAt: (END_S - 100) * 1000, refs: ['in_1'] });
});

test('stripe checkout.session.completed: other modes and unpaid sessions do not grant payments', () => {
  assert.equal(mapStripeEvent(stripeEvt('checkout.session.completed', { mode: 'payment', client_reference_id: 'u' })), null);
  const m = mapStripeEvent(stripeEvt('checkout.session.completed', { mode: 'subscription', client_reference_id: 'u', subscription: 's', payment_status: 'unpaid', amount_total: 399, metadata: {} }))!;
  assert.equal(m.payment, undefined);
});

test('stripe customer.subscription.updated: statuses, exact period end, cancel_at_period_end', () => {
  const base = { id: 'sub_ST1', object: 'subscription', customer: 'cus_1', current_period_end: END_S, cancel_at_period_end: false, metadata: META };
  const a = mapStripeEvent(stripeEvt('customer.subscription.updated', { ...base, status: 'active' }))!;
  assert.equal(a.patch.status, 'active');
  assert.equal(a.patch.currentPeriodEnd, END_S * 1000);
  assert.equal(a.patch.cancelAtPeriodEnd, false);
  assert.equal(a.userId, 'user-2');
  const b = mapStripeEvent(stripeEvt('customer.subscription.updated', { ...base, status: 'active', cancel_at_period_end: true }))!;
  assert.equal(b.patch.cancelAtPeriodEnd, true);
  assert.equal(b.patch.status, 'active');
  assert.equal(mapStripeEvent(stripeEvt('customer.subscription.updated', { ...base, status: 'past_due' }))!.patch.status, 'past_due');
  assert.equal(mapStripeEvent(stripeEvt('customer.subscription.updated', { ...base, status: 'unpaid' }))!.patch.status, 'past_due');
  assert.equal(mapStripeEvent(stripeEvt('customer.subscription.updated', { ...base, status: 'trialing' }))!.patch.status, 'active');
  assert.equal(mapStripeEvent(stripeEvt('customer.subscription.updated', { ...base, status: 'incomplete' })), null);
  const items = mapStripeEvent(stripeEvt('customer.subscription.updated', { id: 's', status: 'active', current_period_end: undefined, items: { data: [{ current_period_end: END_S }] }, metadata: {} }))!;
  assert.equal(items.patch.currentPeriodEnd, END_S * 1000);
});

test('stripe customer.subscription.deleted -> canceled, access until the period end', () => {
  const m = mapStripeEvent(stripeEvt('customer.subscription.deleted', { id: 'sub_ST1', status: 'canceled', customer: 'cus_1', current_period_end: END_S, metadata: META }))!;
  assert.equal(m.patch.status, 'canceled');
  assert.equal(m.patch.cancelAtPeriodEnd, true);
  assert.equal(m.patch.currentPeriodEnd, END_S * 1000);
  assert.equal(computeEntitlement({ tier: 'plus', ...m.patch }, NOW).tier, 'plus');
  assert.equal(computeEntitlement({ tier: 'plus', ...m.patch }, END_S * 1000 + 1).tier, 'free');
});

test('stripe invoice.payment_failed -> past_due via subscription id (both payload shapes)', () => {
  const a = mapStripeEvent(stripeEvt('invoice.payment_failed', { id: 'in_2', subscription: 'sub_ST1' }))!;
  assert.equal(a.providerSubscriptionId, 'sub_ST1');
  assert.deepEqual(a.patch, { status: 'past_due' });
  const b = mapStripeEvent(stripeEvt('invoice.payment_failed', { id: 'in_3', parent: { subscription_details: { subscription: 'sub_ST2' } } }))!;
  assert.equal(b.providerSubscriptionId, 'sub_ST2');
  assert.equal(mapStripeEvent(stripeEvt('invoice.payment_failed', { id: 'in_4' })), null);
});

test('stripe invoice.paid: renewals are payments, first invoices are left to checkout.session.completed', () => {
  const renew = mapStripeEvent(stripeEvt('invoice.paid', { id: 'in_9', billing_reason: 'subscription_cycle', subscription: 'sub_ST1', amount_paid: 399, currency: 'usd', created: END_S - 50, charge: 'ch_9' }))!;
  assert.deepEqual(renew.patch, {});
  assert.equal(renew.providerSubscriptionId, 'sub_ST1');
  assert.deepEqual(renew.payment, { amount: 399, currency: 'USD', paidAt: (END_S - 50) * 1000, refs: ['in_9', 'ch_9'] });
  assert.equal(mapStripeEvent(stripeEvt('invoice.paid', { id: 'in_8', billing_reason: 'subscription_create', subscription: 's', amount_paid: 399, currency: 'usd' })), null);
});

test('stripe charge.refunded is a refund record only', () => {
  const m = mapStripeEvent(stripeEvt('charge.refunded', { id: 'ch_9', object: 'charge', amount: 399, amount_refunded: 399, currency: 'usd', customer: 'cus_1', payment_intent: 'pi_9', refunded: true }))!;
  assert.deepEqual(m.refund, { amount: 399, currency: 'USD', refs: ['ch_9', 'pi_9'], refundId: null });
  assert.deepEqual(m.patch, {});
  assert.equal(m.providerCustomerId, 'cus_1');
  assert.equal(m.userId, null);
});

test('stripe: unknown types are ignored; malformed events and missing fields are rejected safely', () => {
  assert.equal(mapStripeEvent(stripeEvt('customer.created', { id: 'cus_1' })), null);
  assert.equal(mapStripeEvent(stripeEvt('charge.succeeded', { id: 'ch_1' })), null);
  for (const bad of [null, undefined, 3, 'x', [], {}, { type: 'charge.refunded' }, { id: 'e', type: 'charge.refunded', data: {} }, { type: 'customer.subscription.updated', data: { object: { status: 'active' } } }, { id: 'e', type: 'charge.refunded', data: { object: { id: 'ch', amount_refunded: 0 } } }]) {
    assert.equal(mapStripeEvent(bad as any), null);
  }
});

test('a payload cannot choose a tier: only plus can come from a payment event', () => {
  const m = mapStripeEvent(stripeEvt('checkout.session.completed', { mode: 'subscription', client_reference_id: 'u', subscription: 's', metadata: { tier: 'creator', interval: 'monthly' } }))!;
  assert.equal(m.patch.tier, 'plus');
  const r = mapRazorpayEvent(rzpSub('subscription.activated', 'active'), 'e')!;
  assert.equal(r.patch.tier, 'plus');
});

test('razorpay: the tier comes from the PLAN id (creator plans -> creator), never from notes', () => {
  const prev = { m: process.env.RAZORPAY_PLAN_CREATOR_MONTHLY, y: process.env.RAZORPAY_PLAN_CREATOR_YEARLY };
  process.env.RAZORPAY_PLAN_CREATOR_MONTHLY = 'plan_CM';
  process.env.RAZORPAY_PLAN_CREATOR_YEARLY = 'plan_CY';
  try {
    const ev = rzpSub('subscription.activated', 'active');
    (ev.payload.subscription.entity as any).plan_id = 'plan_CM';
    assert.equal(mapRazorpayEvent(ev, 'e')!.patch.tier, 'creator');
    (ev.payload.subscription.entity as any).plan_id = 'plan_M';
    (ev.payload.subscription.entity as any).notes.tier = 'creator';
    assert.equal(mapRazorpayEvent(ev, 'e')!.patch.tier, 'plus');
  } finally {
    if (prev.m === undefined) delete process.env.RAZORPAY_PLAN_CREATOR_MONTHLY; else process.env.RAZORPAY_PLAN_CREATOR_MONTHLY = prev.m;
    if (prev.y === undefined) delete process.env.RAZORPAY_PLAN_CREATOR_YEARLY; else process.env.RAZORPAY_PLAN_CREATOR_YEARLY = prev.y;
  }
});

test('test-mode bypass: only listed users, never in production, off when unset', async () => {
  const { testBypassFor, testModeOn } = await import('../services/billing.js');
  const prev = { u: process.env.BILLING_TEST_USERS, n: process.env.NODE_ENV };
  try {
    delete process.env.BILLING_TEST_USERS;
    assert.equal(testModeOn(), false);
    assert.equal(testBypassFor({ id: 'a', email: 'me@x.com' }), false);
    process.env.BILLING_TEST_USERS = 'Me@X.com, user-7';
    assert.equal(testBypassFor({ email: 'me@x.com' }), true);
    assert.equal(testBypassFor({ id: 'USER-7' }), true);
    assert.equal(testBypassFor({ id: 'user-8', email: 'other@x.com' }), false);
    assert.equal(testBypassFor({}), false);
    process.env.NODE_ENV = 'production';
    assert.equal(testBypassFor({ email: 'me@x.com' }), false);
  } finally {
    if (prev.u === undefined) delete process.env.BILLING_TEST_USERS; else process.env.BILLING_TEST_USERS = prev.u;
    if (prev.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev.n;
  }
});

// ---- pilot allow-list --------------------------------------------------------------------------------------
test('BILLING_ALLOWLIST: unset means everyone; set matches ids and emails case-insensitively', () => {
  delete process.env.BILLING_ALLOWLIST;
  assert.equal(billingAllowlist(), null);
  assert.equal(canPurchase({ id: 'x' }), true);
  process.env.BILLING_ALLOWLIST = ' Pilot@Example.com , user-5 ,';
  assert.equal(canPurchase({ id: 'x', email: 'pilot@example.com' }), true);
  assert.equal(canPurchase({ id: 'USER-5' }), true);
  assert.equal(canPurchase({ id: 'other', email: 'other@example.com' }), false);
  assert.equal(canPurchase({}), false);
});
