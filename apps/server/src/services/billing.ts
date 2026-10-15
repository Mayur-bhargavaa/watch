/**
 * Subscriptions: catalog, region/currency, entitlements, provider adapters (plain fetch, no SDKs) and webhook
 * verification. No card data ever reaches this server: checkout happens on Razorpay / Stripe hosted pages.
 * Secrets come from the environment only and are never logged.
 */
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import {
  TIER_INFO,
  TIER_PRICES,
  BILLING_CURRENCIES,
  normalizeTier,
  type MembershipTier,
  type BillingCurrency,
  type BillingInterval
} from '@synccinema/common';

export type BillingMode = 'off' | 'mock' | 'live';
export type BillingProvider = 'razorpay' | 'stripe' | 'mock';
export type SubStatus = 'active' | 'past_due' | 'canceled';

export interface SubscriptionDoc {
  _id: string; // userId
  tier: MembershipTier;
  interval: BillingInterval;
  currency: string;
  provider: BillingProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  status: SubStatus;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  createdAt: number;
  updatedAt: number;
}

const DAY = 24 * 60 * 60_000;
export const PAST_DUE_GRACE_MS = 7 * DAY;
/** An "active" subscription whose period end passed is trusted this long for a late renewal webhook. */
export const ACTIVE_SLACK_MS = 3 * DAY;
export const STRIPE_TOLERANCE_MS = 5 * 60_000;

export const billingMode = (): BillingMode => {
  const m = (process.env.BILLING_MODE || 'off').toLowerCase();
  return m === 'live' || m === 'mock' ? m : 'off';
};
/** Mock endpoints exist only outside production, and only when BILLING_MODE=mock. */
export const mockEnabled = (): boolean => billingMode() === 'mock' && process.env.NODE_ENV !== 'production';

/**
 * Owner testing without Razorpay/Stripe: only people listed in BILLING_TEST_USERS (emails or user ids), only outside production,
 * can switch a pass on or off for themselves, even while BILLING_MODE=live. Nobody else, and never in production.
 */
export const testModeOn = (): boolean => process.env.NODE_ENV !== 'production' && !!(process.env.BILLING_TEST_USERS || '').trim();
export function testBypassFor(user: { id?: string | null; email?: string | null }): boolean {
  if (!testModeOn()) return false;
  const allow = new Set((process.env.BILLING_TEST_USERS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
  return (!!user.id && allow.has(String(user.id).toLowerCase())) || (!!user.email && allow.has(String(user.email).trim().toLowerCase()));
}

const env = (k: string) => (process.env[k] || '').trim();

/** Pilot allow-list: BILLING_ALLOWLIST="a@b.com,userId2". Unset or empty means everybody may purchase. */
export function billingAllowlist(): Set<string> | null {
  const list = env('BILLING_ALLOWLIST').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return list.length ? new Set(list) : null;
}
export function canPurchase(user: { id?: string | null; email?: string | null }): boolean {
  const allow = billingAllowlist();
  if (!allow) return true;
  return (!!user.id && allow.has(String(user.id).toLowerCase())) || (!!user.email && allow.has(String(user.email).trim().toLowerCase()));
}
export const NOT_IN_PILOT_MESSAGE = 'Payments are open to a small group first. Join the waitlist on this page and we will let you know.';

// ------------------------------------------------------------------ region / currency
const COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'];
const EUR_COUNTRIES = new Set('AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' '));

const cleanCountry = (v: unknown): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string' || !/^[A-Za-z]{2}$/.test(s.trim())) return null;
  const c = s.trim().toUpperCase();
  return c === 'XX' || c === 'T1' ? null : c;
};

export function detectCountry(headers: Record<string, any>, query: Record<string, any> = {}): string | null {
  for (const h of COUNTRY_HEADERS) {
    const c = cleanCountry(headers[h]);
    if (c) return c;
  }
  const q = cleanCountry(query.country);
  if (q) return q;
  const al = typeof headers['accept-language'] === 'string' ? headers['accept-language'] : '';
  for (const part of al.split(',')) {
    const m = /^[a-z]{2,3}-([A-Za-z]{2})\b/i.exec(part.trim());
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function resolveRegion(headers: Record<string, any>, query: Record<string, any> = {}, requestedCurrency?: unknown) {
  const country = detectCountry(headers, query);
  // Only Razorpay is set up (no Stripe yet): everyone pays through it, in INR, instead of seeing "payments soon".
  const razorpayOnly = billingMode() === 'live' && razorpayConfigured() && !stripeConfigured();
  const region: 'IN' | 'INTL' = country === 'IN' || razorpayOnly ? 'IN' : 'INTL';
  const currencies: BillingCurrency[] = region === 'IN' ? ['INR'] : ['USD', 'EUR', 'GBP'];
  const asked = typeof requestedCurrency === 'string' ? requestedCurrency.toUpperCase() : '';
  const fallback: BillingCurrency = country === 'GB' ? 'GBP' : country && EUR_COUNTRIES.has(country) ? 'EUR' : 'USD';
  const currency: BillingCurrency = (currencies as string[]).includes(asked) ? (asked as BillingCurrency) : region === 'IN' ? 'INR' : fallback;
  const provider: BillingProvider = billingMode() === 'mock' && mockEnabled() ? 'mock' : region === 'IN' ? 'razorpay' : 'stripe';
  return { country, region, currency, currencies, provider };
}

// ------------------------------------------------------------------ configuration
type PaidTier = 'plus' | 'creator';
const razorpayPlanId = (i: BillingInterval, tier: PaidTier = 'plus') => env(`RAZORPAY_PLAN_${tier.toUpperCase()}_${i.toUpperCase()}`);
/** The tier a Razorpay plan id belongs to (the webhook trusts the plan, never client-supplied notes). */
export function tierOfRazorpayPlan(planId: unknown): PaidTier {
  const id = typeof planId === 'string' ? planId : '';
  return id && (id === razorpayPlanId('monthly', 'creator') || id === razorpayPlanId('yearly', 'creator')) ? 'creator' : 'plus';
}
/** Creator Pass can be bought once its own Razorpay plans exist (India / Razorpay only for now). */
export const creatorPurchasable = () => !!(razorpayPlanId('monthly', 'creator') && razorpayPlanId('yearly', 'creator'));
const stripePriceId = (i: BillingInterval, c: string) => env(`STRIPE_PRICE_PLUS_${i.toUpperCase()}_${c}`);

export const razorpayConfigured = () =>
  !!(env('RAZORPAY_KEY_ID') && env('RAZORPAY_KEY_SECRET') && razorpayPlanId('monthly') && razorpayPlanId('yearly'));
export const stripeConfigured = () => !!env('STRIPE_SECRET_KEY');

export function providerReady(provider: BillingProvider, currency?: string): boolean {
  if (provider === 'mock') return mockEnabled();
  if (billingMode() !== 'live') return false;
  if (provider === 'razorpay') return razorpayConfigured();
  return stripeConfigured() && (!currency || (!!stripePriceId('monthly', currency) && !!stripePriceId('yearly', currency)));
}

const RAZORPAY_VARS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_PLAN_PLUS_MONTHLY', 'RAZORPAY_PLAN_PLUS_YEARLY'];
const STRIPE_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  ...['MONTHLY', 'YEARLY'].flatMap((i) => ['USD', 'EUR', 'GBP'].map((c) => `STRIPE_PRICE_PLUS_${i}_${c}`))
];

/** Called at boot: fail fast with a clear message instead of failing at the first customer's checkout. */
export function assertBillingConfig(): void {
  const mode = (process.env.BILLING_MODE || 'off').toLowerCase();
  if (!['off', 'mock', 'live'].includes(mode)) throw new Error(`BILLING_MODE must be off, mock or live (got "${mode}").`);
  if (mode === 'mock' && process.env.NODE_ENV === 'production') {
    throw new Error('BILLING_MODE=mock is refused in production: it would hand out paid tiers for free. Use BILLING_MODE=live.');
  }
  if (mode !== 'live') return;
  const missingR = RAZORPAY_VARS.filter((k) => !env(k));
  const missingS = STRIPE_VARS.filter((k) => !env(k));
  const rOk = missingR.length === 0, sOk = missingS.length === 0;
  // A half-configured provider is almost certainly a typo: refuse rather than silently disabling it.
  if (!rOk && missingR.length < RAZORPAY_VARS.length) throw new Error(`Razorpay is partly configured; missing: ${missingR.join(', ')}.`);
  if (!sOk && missingS.length < STRIPE_VARS.length) throw new Error(`Stripe is partly configured; missing: ${missingS.join(', ')}.`);
  if (!rOk && !sOk) {
    throw new Error(
      `BILLING_MODE=live needs the secrets of at least one provider. Razorpay (India) is missing: ${missingR.join(', ')}. Stripe (international) is missing: ${missingS.join(', ')}.`
    );
  }
  if (!env('WEB_BASE_URL')) throw new Error('BILLING_MODE=live needs WEB_BASE_URL (checkout return links).');
}

// ------------------------------------------------------------------ catalog
export interface Feature { text: string; status: 'available' | 'soon' }

const FEATURES: Record<MembershipTier, Feature[]> = {
  free: [
    { text: 'Watch together in synced rooms, chat and play games', status: 'available' },
    { text: 'Up to 10 hosted plans at a time', status: 'available' },
    { text: 'Standard Pass badge', status: 'available' }
  ],
  plus: [
    { text: 'VIP Pass badge next to your name', status: 'available' },
    { text: 'Host up to 50 plans at a time', status: 'available' },
    { text: 'Recurring weekly and monthly plans', status: 'available' },
    { text: 'Premium theater themes', status: 'available' },
    { text: 'Rooms of up to 10 people (free: 6)', status: 'available' },
    { text: 'Premium avatar styles', status: 'available' },
    { text: 'Full recaps and your personal watch stats', status: 'available' },
    { text: 'Premium reaction packs', status: 'available' },
    { text: 'Host Imposter (4-8 player social game)', status: 'available' },
    { text: 'Host Emoji Charades (2-8 player movie puzzle)', status: 'available' },
    { text: 'Host Mafia Night (5-10 player social game)', status: 'available' }
  ],
  creator: [
    { text: 'Branded community spaces', status: 'soon' },
    { text: 'Moderation tools', status: 'soon' },
    { text: 'Audience analytics', status: 'soon' },
    { text: 'Everything in Watch+', status: 'available' },
    { text: 'Rooms of up to 12 people and up to 200 hosted plans', status: 'available' },
    { text: 'Host Quiz Show Studio (live quizzes with your own questions, up to 30 players)', status: 'available' },
    { text: 'Host Murder Mystery Night (6-12 player whodunit)', status: 'available' },
    { text: 'Host Tournament Arena (brackets for 4-32 players)', status: 'available' }
  ]
};

export function buildCatalog(headers: Record<string, any>, query: Record<string, any> = {}) {
  const r = resolveRegion(headers, query, query.currency);
  const plans = (['free', 'plus', 'creator'] as MembershipTier[]).map((tier) => {
    const info = TIER_INFO[tier];
    const price = tier === 'free' ? { monthly: 0, yearly: 0 } : TIER_PRICES[tier][r.currency];
    return {
      tier,
      name: info.name,
      badge: info.badge,
      badgeLabel: info.badgeLabel,
      purchasable: tier === 'plus' || (tier === 'creator' && creatorPurchasable() && r.provider === 'razorpay'),
      waitlist: tier === 'creator' && !(creatorPurchasable() && r.provider === 'razorpay'),
      price: { monthly: price.monthly, yearly: price.yearly },
      features: FEATURES[tier],
      limits: { hostedPlans: info.limits.hostedPlans, recurringPlans: info.limits.recurringPlans }
    };
  });
  const mode = billingMode();
  return {
    region: r.region,
    currency: r.currency,
    currencies: r.currencies,
    checkoutAvailable: mode !== 'off' && providerReady(r.provider, r.currency),
    provider: mode === 'off' ? null : r.provider,
    plans,
    notes: {
      tax: r.region === 'IN' ? 'Prices include GST.' : 'Prices exclude any local taxes, which may be added at checkout.',
      cancel: 'Cancel any time. You keep access until the end of the period you already paid for.'
    }
  };
}

// ------------------------------------------------------------------ entitlements
export interface Entitlement {
  tier: MembershipTier;
  status: 'none' | 'active' | 'past_due' | 'canceled';
  interval: BillingInterval | null;
  currency: string | null;
  provider: string | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
}

export const FREE_ENTITLEMENT: Entitlement = { tier: 'free', status: 'none', interval: null, currency: null, provider: null, renewsAt: null, cancelAtPeriodEnd: false };

/** The ONLY place a tier is decided: from the stored subscription and the clock, never from client input. */
export function computeEntitlement(sub: Partial<SubscriptionDoc> | null | undefined, now = Date.now()): Entitlement {
  if (!sub) return FREE_ENTITLEMENT;
  const tier = normalizeTier(sub.tier);
  if (tier === 'free') return FREE_ENTITLEMENT;
  const end = typeof sub.currentPeriodEnd === 'number' ? sub.currentPeriodEnd : null;
  let entitled = false;
  if (sub.status === 'active') entitled = end === null || now < end + ACTIVE_SLACK_MS;
  else if (sub.status === 'canceled') entitled = end !== null && now < end;
  else if (sub.status === 'past_due') entitled = end !== null && now < end + PAST_DUE_GRACE_MS;
  if (!entitled) return FREE_ENTITLEMENT;
  return {
    tier,
    status: sub.status as 'active' | 'past_due' | 'canceled',
    interval: sub.interval === 'yearly' ? 'yearly' : 'monthly',
    currency: sub.currency || null,
    provider: sub.provider || null,
    renewsAt: end,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd || sub.status === 'canceled'
  };
}

// ------------------------------------------------------------------ provider adapters
const trim = (s: unknown, n = 200) => String(s ?? '').slice(0, n);

/** Tests inject a fake fetch so no real provider is ever contacted. Production never calls this. */
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike | null = null;
export function setBillingFetchForTests(fn: FetchLike | null): void {
  fetchImpl = fn;
}

async function providerFetch(url: string, init: RequestInit, label: string): Promise<any> {
  let res: Response;
  try {
    res = await (fetchImpl || fetch)(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw Object.assign(new Error('The payment provider is unreachable. Please try again.'), { statusCode: 502 });
  }
  let json: any = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    // Log only the provider's short error text, never the request (it carries credentials) or full payload
    console.warn(`[billing] ${label} failed: HTTP ${res.status} ${trim(json?.error?.description || json?.error?.message || '')}`);
    throw Object.assign(new Error('The payment provider rejected the request.'), { statusCode: 502 });
  }
  return json;
}

const razorpayAuth = () => 'Basic ' + Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64');

export async function razorpayCreateSubscription(userId: string, interval: BillingInterval, tier: PaidTier = 'plus'): Promise<{ url: string; id: string }> {
  const j = await providerFetch(
    'https://api.razorpay.com/v1/subscriptions',
    {
      method: 'POST',
      headers: { authorization: razorpayAuth(), 'content-type': 'application/json' },
      body: JSON.stringify({
        plan_id: razorpayPlanId(interval, tier),
        total_count: interval === 'monthly' ? 120 : 10,
        customer_notify: 1,
        notes: { userId, tier, interval }
      })
    },
    'razorpay create subscription'
  );
  if (typeof j?.short_url !== 'string' || !j.short_url.startsWith('https://')) throw Object.assign(new Error('Unexpected provider response'), { statusCode: 502 });
  return { url: j.short_url, id: String(j.id) };
}

export async function razorpayCancel(subscriptionId: string): Promise<void> {
  await providerFetch(
    `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: 'POST', headers: { authorization: razorpayAuth(), 'content-type': 'application/json' }, body: JSON.stringify({ cancel_at_cycle_end: 1 }) },
    'razorpay cancel'
  );
}

const stripeHeaders = () => ({ authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'content-type': 'application/x-www-form-urlencoded' });
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

export async function stripeCreateCheckout(opts: { userId: string; interval: BillingInterval; currency: string; webBase: string; customerId?: string | null }): Promise<{ url: string }> {
  const price = stripePriceId(opts.interval, opts.currency);
  const meta = { userId: opts.userId, tier: 'plus', interval: opts.interval };
  const body: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${opts.webBase}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.webBase}/billing/cancelled`,
    client_reference_id: opts.userId,
    'metadata[userId]': meta.userId, 'metadata[tier]': meta.tier, 'metadata[interval]': meta.interval,
    'subscription_data[metadata][userId]': meta.userId, 'subscription_data[metadata][tier]': meta.tier, 'subscription_data[metadata][interval]': meta.interval
  };
  if (opts.customerId) body.customer = opts.customerId;
  const j = await providerFetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: stripeHeaders(), body: form(body) }, 'stripe checkout');
  if (typeof j?.url !== 'string' || !j.url.startsWith('https://')) throw Object.assign(new Error('Unexpected provider response'), { statusCode: 502 });
  return { url: j.url };
}

export async function stripeSetCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<void> {
  await providerFetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: 'POST', headers: stripeHeaders(), body: form({ cancel_at_period_end: cancel ? 'true' : 'false' }) },
    'stripe subscription update'
  );
}

export async function stripePortal(customerId: string, webBase: string): Promise<string> {
  const j = await providerFetch(
    'https://api.stripe.com/v1/billing_portal/sessions',
    { method: 'POST', headers: stripeHeaders(), body: form({ customer: customerId, return_url: `${webBase}/plans` }) },
    'stripe portal'
  );
  if (typeof j?.url !== 'string' || !j.url.startsWith('https://')) throw Object.assign(new Error('Unexpected provider response'), { statusCode: 502 });
  return j.url;
}

// ------------------------------------------------------------------ webhook signatures
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

export function verifyRazorpaySignature(rawBody: Buffer, signature: unknown, secret = env('RAZORPAY_WEBHOOK_SECRET')): boolean {
  if (!secret || typeof signature !== 'string') return false;
  return safeEqual(createHmac('sha256', secret).update(rawBody).digest('hex'), signature.trim());
}

export function verifyStripeSignature(rawBody: Buffer, header: unknown, now = Date.now(), secret = env('STRIPE_WEBHOOK_SECRET')): boolean {
  if (!secret || typeof header !== 'string') return false;
  let t = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = v; else if (k === 'v1') v1.push(v);
  }
  if (!/^\d{1,12}$/.test(t) || !v1.length) return false;
  if (Math.abs(now - Number(t) * 1000) > STRIPE_TOLERANCE_MS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
  return v1.some((s) => safeEqual(expected, s));
}

// ------------------------------------------------------------------ webhook event -> subscription state
export interface MappedEvent {
  eventId: string;
  /** user the event is about when the payload carries it (else looked up by providerSubscriptionId) */
  userId: string | null;
  providerSubscriptionId: string | null;
  patch: Partial<Omit<SubscriptionDoc, '_id' | 'createdAt' | 'updatedAt'>>;
  /** a successful charge (minor units); stored sanitized in billing_payments */
  payment?: { amount: number; currency: string; paidAt: number; refs: string[] };
  /** a refund: recorded in the audit log only, access is never revoked automatically */
  refund?: { amount: number; currency: string; refs: string[]; refundId: string | null };
  /** provider customer id, used to find the user of an event that carries no user id */
  providerCustomerId?: string | null;
}

const amountOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e10 ? Math.round(v) : null);
const curOf = (v: unknown, fallback = ''): string => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : fallback);
const refsOf = (...v: unknown[]): string[] => v.filter((x): x is string => typeof x === 'string' && !!x && x.length < 200);

const sec = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v * 1000 : null);
const intervalOf = (v: unknown): BillingInterval | undefined => (v === 'monthly' || v === 'yearly' ? v : undefined);
const idStr = (v: unknown): string | null => (typeof v === 'string' && v && v.length < 200 ? v : null);

export function mapRazorpayEvent(event: any, headerEventId?: unknown, rawBody?: Buffer): MappedEvent | null {
  const type = event?.event;
  if (typeof type !== 'string') return null;
  const eventId = idStr(headerEventId) || `rzp_${createHash('sha256').update(rawBody || JSON.stringify(event)).digest('hex').slice(0, 40)}`;
  if (type === 'refund.processed' || type === 'payment.refunded') {
    const refund = event?.payload?.refund?.entity;
    const payment = event?.payload?.payment?.entity;
    const amount = amountOf(refund?.amount) ?? amountOf(payment?.amount_refunded);
    const refs = refsOf(refund?.payment_id, payment?.id);
    if (!amount || !refs.length) return null;
    return { eventId, userId: null, providerSubscriptionId: null, patch: {}, refund: { amount, currency: curOf(refund?.currency || payment?.currency, 'INR'), refs, refundId: idStr(refund?.id) } };
  }
  const sub = event?.payload?.subscription?.entity;
  if (!sub) return null;
  const notes = sub.notes && typeof sub.notes === 'object' ? sub.notes : {};
  const base = {
    eventId,
    userId: idStr(notes.userId),
    providerSubscriptionId: idStr(sub.id),
    // Only a paid tier can come from a payment event, decided by the plan id
    patch: { provider: 'razorpay' as const, currency: 'INR', tier: tierOfRazorpayPlan(sub.plan_id) as MembershipTier, ...(intervalOf(notes.interval) ? { interval: intervalOf(notes.interval) } : {}), providerCustomerId: idStr(sub.customer_id) }
  };
  const end = sec(sub.current_end);
  switch (type) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const pay = event?.payload?.payment?.entity;
      const amount = amountOf(pay?.amount);
      const payment = type === 'subscription.charged' && amount && idStr(pay?.id)
        ? { amount, currency: curOf(pay.currency, 'INR'), paidAt: sec(pay.created_at) || Date.now(), refs: refsOf(pay.id) }
        : undefined;
      return { ...base, ...(payment ? { payment } : {}), patch: { ...base.patch, status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: end, providerSubscriptionId: base.providerSubscriptionId } };
    }
    case 'subscription.halted':
    case 'subscription.pending':
      return { ...base, patch: { status: 'past_due', ...(end ? { currentPeriodEnd: end } : {}) } };
    case 'subscription.cancelled':
    case 'subscription.completed':
      return { ...base, patch: { status: 'canceled', cancelAtPeriodEnd: true, ...(end ? { currentPeriodEnd: end } : {}) } };
    default:
      return null;
  }
}

const stripeStatus = (s: unknown): SubStatus | null =>
  s === 'active' || s === 'trialing' ? 'active' : s === 'past_due' || s === 'unpaid' ? 'past_due' : s === 'canceled' || s === 'incomplete_expired' ? 'canceled' : null;

export function mapStripeEvent(event: any): MappedEvent | null {
  const type = event?.type;
  const obj = event?.data?.object;
  const eventId = idStr(event?.id);
  if (typeof type !== 'string' || !obj || !eventId) return null;
  const meta = obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {};
  switch (type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription') return null;
      const interval = intervalOf(meta.interval) || 'monthly';
      const cur = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : undefined;
      return {
        eventId,
        userId: idStr(obj.client_reference_id) || idStr(meta.userId),
        providerSubscriptionId: idStr(obj.subscription),
        ...(obj.payment_status === 'paid' && amountOf(obj.amount_total)
          ? { payment: { amount: amountOf(obj.amount_total)!, currency: curOf(obj.currency, 'USD'), paidAt: sec(obj.created) || Date.now(), refs: refsOf(obj.invoice, obj.payment_intent) } }
          : {}),
        patch: {
          provider: 'stripe', tier: 'plus', interval, ...(cur ? { currency: cur } : {}),
          providerCustomerId: idStr(obj.customer), status: 'active', cancelAtPeriodEnd: false,
          // provisional; customer.subscription.updated carries the exact period end
          currentPeriodEnd: Date.now() + (interval === 'yearly' ? 366 : 32) * DAY
        }
      };
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const deleted = type.endsWith('deleted');
      const status = deleted ? 'canceled' : stripeStatus(obj.status);
      if (!status) return null;
      const end = sec(obj.current_period_end) || sec(obj.items?.data?.[0]?.current_period_end);
      const interval = intervalOf(meta.interval);
      return {
        eventId,
        userId: idStr(meta.userId),
        providerSubscriptionId: idStr(obj.id),
        patch: {
          provider: 'stripe', status, cancelAtPeriodEnd: deleted ? true : !!obj.cancel_at_period_end,
          ...(end ? { currentPeriodEnd: end } : deleted ? { currentPeriodEnd: sec(obj.ended_at) || Date.now() } : {}),
          ...(interval ? { interval } : {}), ...(idStr(obj.customer) ? { providerCustomerId: idStr(obj.customer) } : {})
        }
      };
    }
    case 'invoice.payment_failed': {
      const subId = idStr(obj.subscription) || idStr(obj.parent?.subscription_details?.subscription);
      if (!subId) return null;
      return { eventId, userId: null, providerSubscriptionId: subId, patch: { status: 'past_due' } };
    }
    case 'invoice.paid': {
      // First payments come with checkout.session.completed; renewals arrive here only.
      if (obj.billing_reason !== 'subscription_cycle') return null;
      const subId = idStr(obj.subscription) || idStr(obj.parent?.subscription_details?.subscription);
      const amount = amountOf(obj.amount_paid);
      if (!subId || !amount) return null;
      return {
        eventId, userId: null, providerSubscriptionId: subId, patch: {},
        payment: { amount, currency: curOf(obj.currency, 'USD'), paidAt: sec(obj.status_transitions?.paid_at) || sec(obj.created) || Date.now(), refs: refsOf(obj.id, obj.charge, obj.payment_intent) }
      };
    }
    case 'charge.refunded': {
      const amount = amountOf(obj.amount_refunded);
      const refs = refsOf(obj.id, obj.payment_intent, obj.invoice);
      if (!amount || !refs.length) return null;
      return { eventId, userId: null, providerSubscriptionId: null, providerCustomerId: idStr(obj.customer), patch: {}, refund: { amount, currency: curOf(obj.currency, 'USD'), refs, refundId: null } };
    }
    default:
      return null;
  }
}
