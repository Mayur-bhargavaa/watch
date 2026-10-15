'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { PassCelebration } from '../../../components/membership/PassCelebration';
import { getBillingMe, invalidateBillingMe, type BillingMe } from '../../../lib/billingApi';

const POLL_MS = 2500;
const MAX_MS = 30_000;

function SuccessInner() {
  const params = useSearchParams();
  const mock = params.get('mock') === '1';
  const [me, setMe] = useState<BillingMe | null>(null);
  const [state, setState] = useState<'checking' | 'active' | 'pending' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    setState('checking');
    const tick = async () => {
      try {
        const m = await getBillingMe();
        if (stopped) return;
        setMe(m);
        if (m.tier !== 'free' && (m.status === 'active' || m.status === 'past_due')) {
          invalidateBillingMe();
          setState('active');
          return;
        }
        if (mock || Date.now() - started >= MAX_MS) {
          setState('pending');
          return;
        }
      } catch {
        if (stopped) return;
        if (mock || Date.now() - started >= MAX_MS) {
          setState('error');
          return;
        }
      }
      timer.current = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mock, attempt]);

  return (
    <div className="min-h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] p-6 text-center space-y-4" role="status" aria-live="polite">
        {state === 'checking' && (
          <>
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#ee1d49]" aria-hidden="true" />
            <h1 className="text-lg font-black">Confirming your payment</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">This can take a few seconds. Please keep this page open.</p>
          </>
        )}
        {state === 'active' && (
          <>
            <PassCelebration tier={me?.tier} label={me?.badgeLabel} />
            <h1 className="text-lg font-black">You are all set</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Your {me?.badgeLabel || 'VIP Pass'} is active. Thank you for supporting Watch.</p>
            <Link href="/profile" className="inline-block px-5 py-2.5 rounded-full bg-[#ee1d49] text-white text-xs font-bold">Go to profile</Link>
          </>
        )}
        {(state === 'pending' || state === 'error') && (
          <>
            <h1 className="text-lg font-black">{state === 'error' ? 'Could not check your payment' : 'Still confirming'}</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {state === 'error'
                ? 'We could not reach the server. If you completed the payment, your pass will appear shortly.'
                : 'Your payment has not been confirmed yet. If you paid, your pass appears as soon as the payment partner confirms it. You are not charged twice.'}
            </p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[#ee1d49] text-white text-xs font-bold cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Check again
              </button>
              <Link href="/profile" className="px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 text-xs font-bold">Go to profile</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
