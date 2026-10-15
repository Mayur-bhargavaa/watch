'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Clock, Crown, Lock, RefreshCw, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { TIER_INFO } from '@synccinema/common';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { AppHeader } from '../../components/layout/AppHeader';
import { MembershipBadge } from '../../components/membership/MembershipBadge';
import { getStoredSession, type UserSession } from '../../lib/api';
import {
  getCatalog,
  getBillingMe,
  startCheckout,
  joinWaitlist,
  formatMoney,
  guessCountry,
  yearlySavingPercent,
  invalidateBillingMe,
  testActivate,
  testReset,
  type BillingCatalog,
  type BillingMe,
  type BillingError,
  type BillingInterval,
  type CatalogPlan
} from '../../lib/billingApi';

const FAQ: [string, string][] = [
  ['Can I cancel anytime?', 'Yes. Cancel from your profile in one click. You keep Watch+ until the end of the period you already paid for, and nothing is charged after that.'],
  ['When am I charged?', 'You are charged when you subscribe and then once per period (month or year) on the same date, until you cancel.'],
  ['What happens to my plans if I cancel?', 'Your existing plans stay. After the period ends you return to Watch Free: repeating plans stop being available for new plans, and you can host up to the free limit at a time.'],
  ['Is GST or tax included?', 'Prices for customers in India include GST. Elsewhere, local taxes may be added at checkout.']
];

export default function PricingPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [me, setMe] = useState<BillingMe | null>(null);
  const [busy, setBusy] = useState<'checkout' | 'waitlist' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);

  const signedIn = Boolean(session?.user && !session.user.isAnonymous);

  useEffect(() => {
    const s = getStoredSession();
    if (s?.user && !s.user.isAnonymous) setSession(s);
  }, []);

  const loadCatalog = useCallback(async (cur?: string) => {
    setLoading(true);
    setCatalogError(null);
    try {
      const c = await getCatalog({ country: guessCountry(), currency: cur });
      setCatalog(c);
      setCurrency(c.currency);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Could not load pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!signedIn) return;
    getBillingMe()
      .then((m) => {
        setMe(m);
        if (m.waitlist?.includes('creator')) setWaitlisted(true);
      })
      .catch(() => {});
  }, [signedIn]);

  const onCurrency = (c: string) => {
    setCurrency(c);
    void loadCatalog(c);
  };

  const buy = async (tier: 'plus' | 'creator' = 'plus') => {
    if (!signedIn) {
      router.push(`/login?redirect=${encodeURIComponent('/pricing')}`);
      return;
    }
    setBusy('checkout');
    setActionError(null);
    try {
      const { url } = await startCheckout(tier, interval, currency);
      window.location.href = url;
    } catch (err) {
      const e = err as BillingError;
      setActionError(e.status === 503 ? 'Payments open soon. Nothing was charged.' : e.message);
      if (e.code === 'NOT_IN_PILOT') setMe((prev) => (prev ? { ...prev, canPurchase: false } : prev));
      setBusy(null);
    }
  };

  // Owner test accounts only (the server hides this for everyone else): switch a pass on/off with no payment.
  const testBuy = async (tier: 'plus' | 'creator') => {
    setBusy('checkout');
    setActionError(null);
    try {
      await testActivate(tier, interval);
      invalidateBillingMe();
      router.push('/billing/success?mock=1');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Test activation failed');
      setBusy(null);
    }
  };
  const testBackToFree = async () => {
    setBusy('checkout');
    setActionError(null);
    try {
      await testReset();
      invalidateBillingMe();
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reset failed');
      setBusy(null);
    }
  };

  const joinCreator = async () => {
    if (!signedIn) {
      router.push(`/login?redirect=${encodeURIComponent('/pricing')}`);
      return;
    }
    setBusy('waitlist');
    setActionError(null);
    try {
      await joinWaitlist('creator');
      setWaitlisted(true);
      invalidateBillingMe();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not join the waitlist');
    } finally {
      setBusy(null);
    }
  };

  const myTier = me?.tier ?? 'free';
  const cur = catalog?.currency ?? currency ?? 'USD';
  const indian = cur === 'INR';
  const saving = (() => {
    const plus = catalog?.plans.find((p) => p.tier === 'plus');
    return plus ? yearlySavingPercent(plus.price) : 0;
  })();

  const renderCard = (plan: CatalogPlan) => {
    const isPlus = plan.tier === 'plus';
    const isFree = plan.tier === 'free';
    const isCreator = plan.tier === 'creator';
    const amount = interval === 'yearly' ? plan.price.yearly : plan.price.monthly;
    const info = TIER_INFO[plan.tier];
    const owned = isPlus ? myTier === 'plus' || myTier === 'creator' : isCreator && myTier === 'creator';
    const sellable = (isPlus || isCreator) && plan.purchasable;
    return (
      <div
        key={plan.tier}
        className={`relative flex flex-col rounded-2xl p-5 border bg-white dark:bg-[#151022] ${
          isPlus ? 'border-[#ee1d49] ring-1 ring-[#ee1d49]/30 shadow-lg shadow-[#ee1d49]/10' : 'border-slate-200/80 dark:border-white/[0.08]'
        }`}
      >
        {isPlus && (
          <span className="absolute -top-2.5 left-5 px-2.5 py-0.5 rounded-full bg-[#ee1d49] text-white text-[10px] font-black uppercase tracking-wide">Most popular</span>
        )}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-black">{plan.name || info.name}</h2>
          <MembershipBadge tier={plan.tier} />
        </div>

        <div className="mt-3 min-h-[3.25rem]">
          {isFree ? (
            <p className="text-3xl font-black">{formatMoney(0, cur)}</p>
          ) : isCreator && !plan.purchasable ? (
            <p className="text-lg font-black text-slate-700 dark:text-zinc-200">Coming soon</p>
          ) : (
            <>
              <p className="text-3xl font-black">
                {formatMoney(amount, cur)}
                <span className="text-sm font-semibold text-slate-400"> / {interval === 'yearly' ? 'year' : 'month'}</span>
              </p>
              {interval === 'yearly' && saving > 0 && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Save {saving}% vs paying monthly</p>
              )}
            </>
          )}
        </div>

        <ul className="mt-4 space-y-2 flex-1">
          {plan.features.map((f) => (
            <li key={f.text} className="flex items-start gap-2 text-xs sm:text-[13px]">
              {f.status === 'available' ? (
                <Check className="w-4 h-4 mt-px text-emerald-500 shrink-0" aria-label="Included" />
              ) : (
                <Clock className="w-4 h-4 mt-px text-slate-300 dark:text-zinc-600 shrink-0" aria-hidden="true" />
              )}
              <span className={f.status === 'available' ? 'text-slate-700 dark:text-zinc-200' : 'text-slate-400 dark:text-zinc-500'}>
                {f.text}
                {f.status === 'soon' && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-[10px] font-bold text-slate-400 dark:text-zinc-500 align-middle">Soon</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          {isFree && (
            <div className="w-full text-center px-4 py-2.5 rounded-full border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-zinc-400">
              {signedIn && myTier === 'free' ? 'Current plan' : 'Free forever'}
            </div>
          )}
          {sellable &&
            (owned ? (
              <div className="w-full text-center px-4 py-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">Current plan</div>
            ) : (catalog && !catalog.checkoutAvailable) || (signedIn && me && me.canPurchase === false) ? (
              <div className="w-full text-center px-4 py-2.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-xs font-bold text-slate-500 dark:text-zinc-400">Payments open soon</div>
            ) : (
              <button
                type="button"
                onClick={() => void buy(plan.tier as 'plus' | 'creator')}
                disabled={busy !== null || !plan.purchasable}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer"
              >
                {busy === 'checkout' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                {signedIn ? `Get ${isCreator ? 'Creator Pass' : 'Watch+'} ${interval === 'yearly' ? 'yearly' : 'monthly'}` : `Sign in to get ${isCreator ? 'Creator Pass' : 'Watch+'}`}
              </button>
            ))}
          {me?.testMode && (isPlus || isCreator) && (
            <button
              type="button"
              onClick={() => void (owned ? testBackToFree() : testBuy(plan.tier as 'plus' | 'creator'))}
              disabled={busy !== null}
              className="mt-2 w-full px-4 py-2 rounded-full border border-dashed border-sky-400/60 text-sky-600 dark:text-sky-300 text-[11px] font-bold hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-60 cursor-pointer"
            >
              {owned ? 'Test mode: back to free' : 'Test mode: skip payment'}
            </button>
          )}
          {isCreator && !plan.purchasable &&
            (waitlisted ? (
              <div role="status" className="w-full text-center px-4 py-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                You are on the waitlist. We will let you know.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void joinCreator()}
                disabled={busy !== null}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-violet-300 dark:border-violet-400/40 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-60 text-xs font-bold transition cursor-pointer"
              >
                {busy === 'waitlist' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Join the waitlist
              </button>
            ))}
        </div>
      </div>
    );
  };

  const content = (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Pick your pass</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Start free. Upgrade to Watch+ when you want more. Cancel anytime.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div role="group" aria-label="Billing period" className="inline-flex p-1 rounded-full bg-slate-100 dark:bg-white/[0.06]">
          {(['monthly', 'yearly'] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => setInterval(i)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                interval === i ? 'bg-white dark:bg-[#151022] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {i === 'monthly' ? 'Monthly' : 'Yearly'}
              {i === 'yearly' && saving > 0 && <span className="ml-1 text-emerald-600 dark:text-emerald-400">-{saving}%</span>}
            </button>
          ))}
        </div>
        {catalog && catalog.currencies.length > 1 && (
          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400">
            <span>Currency</span>
            <select
              value={cur}
              onChange={(e) => onCurrency(e.target.value)}
              className="px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-xs font-bold text-slate-900 dark:text-white border border-transparent"
            >
              {catalog.currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {catalogError && (
        <div role="alert" className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs">
          <span className="font-semibold text-rose-700 dark:text-rose-300">Could not load pricing: {catalogError}</span>
          <button type="button" onClick={() => void loadCatalog(currency)} className="inline-flex items-center gap-1 font-bold text-[#ee1d49] cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {loading && !catalog && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[#ee1d49] border-t-transparent animate-spin" aria-label="Loading pricing" />
        </div>
      )}

      {catalog && (
        <>
          {!catalog.checkoutAvailable && (
            <div role="status" className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs font-semibold text-amber-800 dark:text-amber-300">
              Payments open soon. You can look around now; nothing can be charged yet.
            </div>
          )}
          {signedIn && me && me.canPurchase === false && catalog.checkoutAvailable && (
            <div role="status" className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs font-semibold text-amber-800 dark:text-amber-300">
              Payments are open to a small group first. Join the waitlist below and we will let you know.
            </div>
          )}
          {actionError && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {actionError}
            </div>
          )}
          <div className={`grid gap-4 md:grid-cols-3 pt-2 ${loading ? 'opacity-60' : ''}`}>{catalog.plans.map(renderCard)}</div>

          <div className="text-center space-y-1 text-xs text-slate-500 dark:text-zinc-400">
            <p className="font-semibold">
              {indian ? 'Pay with UPI, cards or netbanking.' : 'Pay with cards, Apple Pay or Google Pay.'} {catalog.notes?.cancel || 'Cancel anytime.'}
            </p>
            {catalog.notes?.tax && <p>{catalog.notes.tax}</p>}
            <p className="inline-flex items-center gap-1 text-slate-400 dark:text-zinc-500">
              <Lock className="w-3 h-3" /> Payments are handled by our payment partner. This app never sees or stores your card details.
            </p>
          </div>
        </>
      )}

      <p className="text-center text-xs text-slate-400 dark:text-zinc-500">
        <Link href="/terms" className="hover:text-[#ee1d49]">Terms</Link> · <Link href="/privacy" className="hover:text-[#ee1d49]">Privacy</Link> · <Link href="/refunds" className="hover:text-[#ee1d49]">Refunds</Link>
      </p>

      <section aria-labelledby="faq-title" className="space-y-2 pt-2">
        <h2 id="faq-title" className="text-sm font-black flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#ee1d49]" /> Questions</h2>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] px-4 py-3">
              <summary className="text-sm font-bold cursor-pointer list-none flex items-center justify-between">
                {q}
                <span className="text-slate-400 group-open:rotate-45 transition text-lg leading-none">+</span>
              </summary>
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );

  if (signedIn) {
    return (
      <div className="h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-hidden font-sans">
        <AppSidebar isMobileOpen={mobileSidebar} onMobileClose={() => setMobileSidebar(false)} />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-5">
          <AppHeader onOpenMobileSidebar={() => setMobileSidebar(true)} />
          {content}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white font-sans">
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-slate-200/80 dark:border-white/[0.06]">
        <Link href="/" className="text-lg font-black tracking-tight">Watch<span className="text-[#ee1d49]">.</span></Link>
        <Link href="/login?redirect=%2Fpricing" className="px-4 py-2 rounded-full bg-[#ee1d49] text-white text-xs font-bold">Sign in</Link>
      </header>
      <main className="px-4 sm:px-8 py-8">{content}</main>
    </div>
  );
}
