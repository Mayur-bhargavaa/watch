'use client';

import React, { useState } from 'react';
import { Film, TriangleAlert, RefreshCw, SearchX, Settings } from 'lucide-react';
import { tmdbImageUrl, tmdbSrcSet, type CatalogTitle, type TmdbImageSize } from '@synccinema/common';
import { CatalogApiError, SETUP_MESSAGE } from '../../lib/catalog/api';

/** Shared look for Discover: the same tokens as Home (slate light, #111217 page, #171821 cards, rose accent). */
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#111217]';
export const SURFACE = 'bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06]';
export const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 motion-safe:transition motion-safe:active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;
export const BTN_SECONDARY = `inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1f2029] text-xs sm:text-sm font-bold px-4 py-2.5 motion-safe:transition motion-safe:active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS}`;
/** Home's hero primary action (the one place Home uses a gradient on a button). */
export const BTN_HERO = `inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs sm:text-sm font-bold px-4 sm:px-6 py-2.5 sm:py-3 motion-safe:transition motion-safe:active:scale-95 ${FOCUS}`;
/** Secondary actions that sit on a dark hero image (always dark, in both themes). */
export const BTN_DARK = `inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#171821] hover:bg-[#23242d] text-white text-xs sm:text-sm font-bold px-4 py-2.5 motion-safe:transition motion-safe:active:scale-95 ${FOCUS}`;
export const BTN_DARK_ICON = `inline-flex items-center justify-center rounded-xl border border-white/10 bg-[#171821] hover:bg-[#23242d] text-white p-2.5 sm:p-3 motion-safe:transition motion-safe:active:scale-95 ${FOCUS}`;
export const EYEBROW = 'text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400';
/** Home's page and card shapes. */
export const CARD = `${SURFACE} rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-none`;
export const HERO_CARD = 'relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#171821] border border-white/[0.08] shadow-2xl';
/** Home's row heading (small bold title) and its muted caption on the right. */
export const ROW_TITLE = 'text-xs xs:text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate';
export const ROW_CAPTION = 'text-[10.5px] sm:text-xs text-slate-500 dark:text-zinc-400';

/** Poster with a fixed aspect box (no layout shift) and a neutral film placeholder when missing or broken. */
export function Poster({ path, title, sizes = '(min-width: 1024px) 180px, 40vw', ratio = '2 / 3', className = '', priority = false }: { path: string | null | undefined; title: string; sizes?: string; ratio?: string; className?: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = tmdbImageUrl(path, 'w342');
  return (
    <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-slate-200 dark:bg-[#1f2029] ${className}`} style={{ aspectRatio: ratio }}>
      {src && !broken ? (
        <img
          src={src}
          srcSet={tmdbSrcSet(path, ['w185', 'w342', 'w500'])}
          sizes={sizes}
          alt={`Poster for ${title}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-zinc-600" role="img" aria-label={`No poster for ${title}`}>
          <Film className="h-8 w-8" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/** Wide artwork. The scrim (a gradient used only to darken the image) is added by the caller. */
export function Backdrop({ path, className = '', priority = false }: { path: string | null | undefined; className?: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  const sizes: TmdbImageSize[] = ['w780', 'w1280'];
  const src = tmdbImageUrl(path, 'w1280');
  if (!src || broken) return <div className={`bg-[#171821] ${className}`} aria-hidden="true" />;
  return (
    <img src={src} srcSet={tmdbSrcSet(path, sizes)} sizes="100vw" alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setBroken(true)} className={`object-cover ${className}`} />
  );
}

export function RatingLabel({ title }: { title: Pick<CatalogTitle, 'rating' | 'ratingSource'> }) {
  if (title.rating === null) return null;
  return <span className="inline-flex items-center rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[11px] font-bold">{title.ratingSource} {title.rating.toFixed(1)}</span>;
}

export function yearOf(t: Pick<CatalogTitle, 'releaseDate'>): string {
  return t.releaseDate ? t.releaseDate.slice(0, 4) : '';
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-xl bg-slate-200 dark:bg-[#1f2029] motion-safe:animate-pulse ${className}`} />;
}

export function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const e = error instanceof CatalogApiError ? error : null;
  const notConfigured = Boolean(e?.notConfigured);
  const message = notConfigured ? SETUP_MESSAGE : e?.message || 'Something went wrong while loading this.';
  const Icon = notConfigured ? Settings : TriangleAlert;
  return (
    <div role={notConfigured ? 'status' : 'alert'} className={`${SURFACE} rounded-2xl ${compact ? 'p-3' : 'p-4 sm:p-5'} flex items-start gap-3`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 dark:text-slate-100">{message}</p>
        {!notConfigured && onRetry && (
          <button type="button" onClick={onRetry} className={`${BTN_SECONDARY} mt-3 !py-1.5`}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={`${SURFACE} rounded-2xl sm:rounded-3xl p-8 text-center`}>
      <SearchX className="mx-auto h-7 w-7 text-zinc-400" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export function Chip({ active, onClick, children, disabled, title }: { active?: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[11px] sm:text-xs font-semibold motion-safe:transition disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS} ${
        active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-slate-50 dark:bg-[#101115] border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2029]'
      }`}
    >
      {children}
    </button>
  );
}
