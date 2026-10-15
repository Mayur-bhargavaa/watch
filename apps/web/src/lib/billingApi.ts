/**
 * Billing API client (contract: GET /api/billing/catalog, /me, POST checkout|cancel|resume|portal|waitlist).
 * The server is the only authority on tier and entitlements; this file only reads and asks. Amounts are minor units.
 */
import type { MembershipTier, BillingCurrency, BillingInterval } from '@synccinema/common';
import { API_BASE, authHeaders } from './api';

export type { MembershipTier, BillingCurrency, BillingInterval };

export interface CatalogFeature {
  text: string;
  status: 'available' | 'soon';
}
export interface CatalogPlan {
  tier: MembershipTier;
  name: string;
  badge: string;
  badgeLabel: string;
  purchasable: boolean;
  waitlist: boolean;
  price: { monthly: number; yearly: number };
  features: CatalogFeature[];
  limits: { hostedPlans: number; recurringPlans: boolean; roomCapacity: number; premiumThemes: boolean; premiumAvatars: boolean; reactionPacks: boolean; advancedRecaps: boolean; personalStats: boolean };
}
export interface BillingCatalog {
  region: 'IN' | 'INTL';
  currency: BillingCurrency;
  currencies: BillingCurrency[];
  checkoutAvailable: boolean;
  provider: 'razorpay' | 'stripe' | 'mock' | null;
  plans: CatalogPlan[];
  notes: { tax: string; cancel: string };
}
export interface BillingMe {
  tier: MembershipTier;
  badge: string;
  badgeLabel: string;
  status: 'none' | 'active' | 'past_due' | 'canceled';
  interval: BillingInterval | null;
  currency: string | null;
  provider: string | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  limits: { hostedPlans: number; recurringPlans: boolean; roomCapacity: number; premiumThemes: boolean; premiumAvatars: boolean; reactionPacks: boolean; advancedRecaps: boolean; personalStats: boolean };
  waitlist: string[];
  /** true only for owner test accounts (BILLING_TEST_USERS, never production): payment can be skipped */
  testMode?: boolean;
  /** false while BILLING_ALLOWLIST (pilot) is set and this person is not on it */
  canPurchase?: boolean;
}
export interface BillingPayment {
  id: string;
  paidAt: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
}

export type BillingError = Error & { status?: number; code?: string; requiredTier?: string };

async function billingRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/billing${path}`, {
      method: init.method || 'GET',
      headers: { ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined
    });
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { status: 0 }) as BillingError;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as BillingError;
    err.status = res.status;
    if (data?.code) err.code = data.code;
    if (data?.requiredTier) err.requiredTier = data.requiredTier;
    throw err;
  }
  return data as T;
}

export const getCatalog = (opts: { country?: string; currency?: string } = {}) => {
  const q = new URLSearchParams();
  if (opts.country) q.set('country', opts.country);
  if (opts.currency) q.set('currency', opts.currency);
  const qs = q.toString();
  return billingRequest<BillingCatalog>(`/catalog${qs ? `?${qs}` : ''}`);
};
export const getBillingMe = () => billingRequest<BillingMe>('/me');
export const startCheckout = (tier: 'plus' | 'creator', interval: BillingInterval, currency?: string) =>
  billingRequest<{ provider: string; url: string }>('/checkout', { method: 'POST', body: { tier, interval, ...(currency ? { currency } : {}) } });
export const testActivate = (tier: 'plus' | 'creator', interval: BillingInterval) =>
  billingRequest<{ success: boolean }>('/test/activate', { method: 'POST', body: { tier, interval } });
export const testReset = () => billingRequest<{ success: boolean }>('/test/reset', { method: 'POST' });
export const cancelSubscription = () => billingRequest<{ success: boolean; cancelAtPeriodEnd: boolean; renewsAt: number | null }>('/cancel', { method: 'POST' });
export const resumeSubscription = () => billingRequest<{ success: boolean }>('/resume', { method: 'POST' });
export const getBillingHistory = () => billingRequest<{ payments: BillingPayment[]; invoicesNote: string }>('/history');
export const openBillingPortal = () => billingRequest<{ url: string }>('/portal', { method: 'POST' });
export const joinWaitlist = (tier: 'creator') => billingRequest<{ success: boolean }>('/waitlist', { method: 'POST', body: { tier } });

/** 399 USD cents -> "$3.99"; 19900 INR paise -> "Rs 199" style via Intl ("₹199"), no decimals when whole for INR. */
export function formatMoney(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  const whole = Number.isInteger(major);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'INR' && whole ? 0 : 2,
      maximumFractionDigits: 2
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

/** Yearly saving versus twelve monthly payments, as a whole percent (0 when yearly is not cheaper). */
export function yearlySavingPercent(price: { monthly: number; yearly: number }): number {
  const full = price.monthly * 12;
  if (full <= 0 || price.yearly >= full) return 0;
  return Math.round(((full - price.yearly) / full) * 100);
}

const INDIA_TIMEZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

/**
 * Best guess of the visitor's country (ISO 2 letters) for the catalog request: India from the timezone,
 * otherwise the region part of the browser language ("en-GB" -> "GB"). Returns undefined when unknown;
 * the server also checks CDN headers and answers with the final region and currency.
 */
export function guessCountry(input?: { timeZone?: string; language?: string }): string | undefined {
  let tz = input?.timeZone;
  let lang = input?.language;
  if (input === undefined) {
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* unavailable */ }
    try { lang = typeof navigator !== 'undefined' ? navigator.language : undefined; } catch { /* unavailable */ }
  }
  if (tz && INDIA_TIMEZONES.has(tz)) return 'IN';
  const region = lang?.split(/[-_]/)[1];
  if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  return undefined;
}

export function formatBillingDate(ms: number | null | undefined): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/** Tiny module-level cache so the sidebar and pages do not each refetch /me. */
let meCache: { value: BillingMe | null; at: number; inflight: Promise<BillingMe | null> | null } = { value: null, at: 0, inflight: null };
const listeners = new Set<() => void>();
export function peekBillingMe(): BillingMe | null { return meCache.value; }
export function subscribeBillingMe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function invalidateBillingMe(): void {
  meCache = { value: null, at: 0, inflight: null };
  listeners.forEach((l) => l());
}
export function loadBillingMe(force = false): Promise<BillingMe | null> {
  if (!force && meCache.value && Date.now() - meCache.at < 60_000) return Promise.resolve(meCache.value);
  if (!force && meCache.inflight) return meCache.inflight;
  const p = getBillingMe()
    .then((v) => { meCache = { value: v, at: Date.now(), inflight: null }; listeners.forEach((l) => l()); return v; })
    .catch(() => { meCache.inflight = null; return null; });
  meCache.inflight = p;
  return p;
}
