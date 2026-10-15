'use client';

import React from 'react';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function BillingCancelledPage() {
  return (
    <div className="min-h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] p-6 text-center space-y-4">
        <XCircle className="w-10 h-10 mx-auto text-slate-400" aria-hidden="true" />
        <div className="space-y-1">
          <h1 className="text-lg font-black">Checkout cancelled</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">You were not charged and your plan has not changed. You can try again whenever you like.</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Link href="/pricing" className="px-4 py-2 rounded-full bg-[#ee1d49] text-white text-xs font-bold">Back to pricing</Link>
          <Link href="/dashboard" className="px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 text-xs font-bold">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
