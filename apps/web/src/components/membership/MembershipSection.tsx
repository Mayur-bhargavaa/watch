'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { MembershipBadge } from './MembershipBadge';
import {
  cancelSubscription,
  resumeSubscription,
  openBillingPortal,
  formatBillingDate,
  formatMoney,
  getBillingHistory,
  loadBillingMe,
  invalidateBillingMe,
  type BillingMe,
  type BillingPayment
} from '../../lib/billingApi';

const STATUS_LABEL: Record<BillingMe['status'], string> = {
  none: 'No subscription',
  active: 'Active',
  past_due: 'Payment past due',
  canceled: 'Canceled'
};

export const MembershipSection: React.FC = () => {
  const [me, setMe] = useState<BillingMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [portalUnavailable, setPortalUnavailable] = useState(false);
  const [payments, setPayments] = useState<BillingPayment[]>([]);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    const m = await loadBillingMe(force);
    if (m) setMe(m);
    else setError('Could not load your membership.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getBillingHistory().then((h) => setPayments(h.payments)).catch(() => {});
  }, [me?.status, me?.renewsAt]);

  const run = async (name: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await fn();
      invalidateBillingMe();
      await load(true);
      setNotice(done);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy('portal');
    setError(null);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) setPortalUnavailable(true);
      else setError(err instanceof Error ? err.message : 'Could not open billing');
      setBusy(null);
    }
  };

  const isPaid = me ? me.tier !== 'free' : false;
  const subscribed = me ? isPaid && (me.status === 'active' || me.status === 'past_due') : false;
  const date = formatBillingDate(me?.renewsAt);

  return (
    <section aria-labelledby="membership-title" className="w-full text-left rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1b1c24] p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="membership-title" className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Membership</h2>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-label="Loading" />}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
          <span>{error}</span>
          {!me && (
            <button type="button" onClick={() => void load(true)} className="inline-flex items-center gap-1 font-bold text-[#ee1d49] cursor-pointer shrink-0">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      )}
      {notice && <p role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{notice}</p>}

      {me && (
        <>
          <MembershipBadge tier={me.tier} variant="full" />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-slate-400 dark:text-zinc-500">Status</dt>
            <dd className="font-bold text-slate-800 dark:text-zinc-100">{STATUS_LABEL[me.status]}{me.cancelAtPeriodEnd ? ' (ends soon)' : ''}</dd>
            {isPaid && date && (
              <>
                <dt className="text-slate-400 dark:text-zinc-500">{me.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}</dt>
                <dd className="font-bold text-slate-800 dark:text-zinc-100">{date}</dd>
              </>
            )}
            {isPaid && me.interval && (
              <>
                <dt className="text-slate-400 dark:text-zinc-500">Billing</dt>
                <dd className="font-bold text-slate-800 dark:text-zinc-100">{me.interval === 'yearly' ? 'Yearly' : 'Monthly'}{me.currency ? ` (${me.currency})` : ''}</dd>
              </>
            )}
            <dt className="text-slate-400 dark:text-zinc-500">Hosted plans</dt>
            <dd className="font-bold text-slate-800 dark:text-zinc-100">Up to {me.limits.hostedPlans}</dd>
            <dt className="text-slate-400 dark:text-zinc-500">Repeating plans</dt>
            <dd className="font-bold text-slate-800 dark:text-zinc-100">{me.limits.recurringPlans ? 'Available' : 'Watch+ only'}</dd>
          </dl>

          {me.status === 'past_due' && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Your last payment did not go through. Update your payment method to keep your pass.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {!isPaid && (
              <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold">
                <Crown className="w-3.5 h-3.5" /> Upgrade to Watch+
              </Link>
            )}
            {subscribed && !me.cancelAtPeriodEnd && !confirming && (
              <button type="button" onClick={() => setConfirming(true)} className="px-4 py-2 rounded-full border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-700 dark:text-zinc-200 cursor-pointer">
                Cancel at period end
              </button>
            )}
            {subscribed && me.cancelAtPeriodEnd && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run('resume', resumeSubscription, 'Your subscription will continue.')}
                className="px-4 py-2 rounded-full bg-[#ee1d49] text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
              >
                {busy === 'resume' ? 'Resuming...' : 'Resume subscription'}
              </button>
            )}
            {subscribed && !portalUnavailable && me.provider === 'stripe' && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void portal()}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-700 dark:text-zinc-200 disabled:opacity-60 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Manage billing
              </button>
            )}
          </div>

          {payments.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Payments</h3>
              <ul className="divide-y divide-slate-200 dark:divide-white/[0.06] text-xs">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500 dark:text-zinc-400">{formatBillingDate(p.paidAt)}</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-100">{formatMoney(p.amount, p.currency)} <span className="font-semibold text-slate-400 capitalize">{p.status}</span></span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Tax invoices are emailed by the payment provider.
                {me.provider === 'stripe' && !portalUnavailable && (
                  <> Find them in <button type="button" onClick={() => void portal()} className="underline font-semibold cursor-pointer">Manage billing</button>.</>
                )}
              </p>
            </div>
          )}

          {confirming && (
            <div role="alertdialog" aria-label="Confirm cancellation" className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                Cancel at the end of the period? You keep Watch+{date ? ` until ${date}` : ''} and are not charged again.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run('cancel', cancelSubscription, 'Cancellation scheduled. You keep access until the period ends.')}
                  className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                >
                  {busy === 'cancel' ? 'Cancelling...' : 'Yes, cancel'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer">Keep my plan</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
