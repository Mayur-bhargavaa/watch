import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { DRAFT_NOTICE, isPlaceholder } from '../../lib/legal';

/** Renders a legal value; unfilled placeholders are highlighted so they are impossible to miss in review. */
export const LegalValue: React.FC<{ value: string }> = ({ value }) =>
  isPlaceholder(value) ? <mark className="px-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200">{value}</mark> : <>{value}</>;

export const LegalLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white font-sans">
    <header className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-slate-200/80 dark:border-white/[0.06]">
      <Link href="/" className="text-lg font-black tracking-tight">Watch<span className="text-[#ee1d49]">.</span></Link>
      <nav aria-label="Legal" className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-zinc-400">
        <Link href="/terms" className="hover:text-[#ee1d49]">Terms</Link>
        <Link href="/privacy" className="hover:text-[#ee1d49]">Privacy</Link>
        <Link href="/refunds" className="hover:text-[#ee1d49]">Refunds</Link>
      </nav>
    </header>
    <main className="px-4 sm:px-8 py-8">
      <article className="w-full max-w-3xl mx-auto space-y-5 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
        <div role="note" className="flex items-start gap-2 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs font-bold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
          <span>{DRAFT_NOTICE}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {children}
      </article>
    </main>
  </div>
);

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
    {children}
  </section>
);

export const List: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1">
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </ul>
);
