'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { deduplicateTitles, type CatalogTitle } from '@synccinema/common';
import { catalogApi, type CollectionResponse } from '../../lib/catalog/api';
import { ErrorState, FOCUS, Poster, RatingLabel, ROW_CAPTION, ROW_TITLE, Skeleton, yearOf } from './ui';
import { SaveTitleButton } from '../watchlist/SaveButton';

export const titleHref = (t: Pick<CatalogTitle, 'source' | 'mediaType' | 'sourceId'>) => `/discover/title/${t.source}/${t.mediaType}/${t.sourceId}`;

export const PosterCard = memo(function PosterCard({ title, width = 'w-[130px] xs:w-[145px] sm:w-40' }: { title: CatalogTitle; width?: string }) {
  const meta = [yearOf(title), title.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ');
  const isFree = Boolean(title.freeStreamUrl || title.providers?.some((p) => p.type === 'free'));
  return (
    <div className={`group relative ${width} shrink-0`}>
      <Link href={titleHref(title)} className={`block rounded-xl ${FOCUS}`} aria-label={`${title.title}${yearOf(title) ? `, ${yearOf(title)}` : ''}`}>
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm dark:shadow-none motion-safe:transition motion-safe:duration-200 motion-safe:group-hover:scale-[1.02] motion-safe:group-focus-within:scale-[1.02] group-hover:border-slate-300 dark:group-hover:border-white/20">
          <Poster path={title.posterPath} title={title.title} sizes="(min-width: 640px) 160px, 145px" className="!rounded-none" />
          {isFree && (
            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full bg-emerald-600/95 text-white text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider shadow-sm backdrop-blur-xs">
              FREE
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-500 motion-safe:transition">{title.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">
          <span>{meta}</span>
          <RatingLabel title={title} />
        </div>
      </Link>
      {/* the same save / remove button as everywhere else: it reads the one shared watchlist */}
      <div className="absolute right-1.5 top-1.5">
        <SaveTitleButton title={title} variant="overlay" iconOnly />
      </div>
    </div>
  );
});

/** Home's row heading: small bold title on the left, a muted caption on the right. */
export function SectionHeader({ eyebrow, title, howWePick, right }: { eyebrow?: string; title: string; howWePick?: string; right?: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className={ROW_TITLE}>{title}</h2>
        {right ?? (eyebrow ? <span className={`${ROW_CAPTION} shrink-0 whitespace-nowrap`}>{eyebrow}</span> : null)}
      </div>
      {howWePick && (
        <p className={`${ROW_CAPTION} line-clamp-2`}>
          <span className="font-semibold">How we pick these:</span> {howWePick}
        </p>
      )}
    </div>
  );
}

const ARROW = 'absolute top-[38%] -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-slate-900/85 dark:bg-black/80 hover:bg-rose-600 dark:hover:bg-rose-600 text-white shadow-lg border border-white/10 flex items-center justify-center motion-safe:transition motion-safe:active:scale-95 cursor-pointer sm:opacity-0 sm:group-hover/carousel:opacity-100 sm:focus-visible:opacity-100';

/** Horizontal, keyboard navigable poster row (arrow keys move focus, floating buttons scroll). Same carousel as Home. */
export function PosterRow({ label, items }: { label: string; items: CatalogTitle[] }) {
  const uniqueItems = useMemo(() => deduplicateTitles(items), [items]);
  const scroller = useRef<HTMLUListElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.75), behavior: reduce ? 'auto' : 'smooth' });
  };
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const next = links[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, []);
  return (
    <div className="relative group/carousel">
      <button type="button" onClick={() => scrollBy(-1)} aria-label={`Scroll ${label} left`} title="Scroll left" className={`${ARROW} left-0.5`}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => scrollBy(1)} aria-label={`Scroll ${label} right`} title="Scroll right" className={`${ARROW} right-0.5`}>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
      <ul ref={scroller} role="list" aria-label={label} onKeyDown={onKeyDown} className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 pt-1 scrollbar-none snap-x snap-mandatory">
        {uniqueItems.map((t) => (
          <li key={t.id} className="shrink-0 snap-start">
            <PosterCard title={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex gap-3 sm:gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="w-[130px] xs:w-[145px] sm:w-40 shrink-0">
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * One collection = one request, made only when the section scrolls into view (IntersectionObserver).
 * `hideWhenEmpty` removes the section completely (used for the personalised row: never faked).
 */
export function CollectionRow({ slug, providers, hideWhenEmpty = false, emptyNote, children }: { slug: string; providers?: string[]; hideWhenEmpty?: boolean; emptyNote?: string; children?: React.ReactNode }) {
  const holder = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<CollectionResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const key = (providers ?? []).join(',');

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const ctrl = new AbortController();
    setError(null);
    setData(null);
    catalogApi.collection(slug, { providers: key ? key.split(',') : undefined }, ctrl.signal).then(setData).catch((e) => e?.name !== 'AbortError' && setError(e));
    return () => ctrl.abort();
  }, [visible, slug, key, attempt]);

  if (hideWhenEmpty && data && !data.available) return null;
  return (
    <section ref={holder} aria-label={data?.title ?? slug} className="space-y-2.5 sm:space-y-3 min-h-[12rem]">
      {data ? <SectionHeader eyebrow={data.eyebrow} title={data.title} howWePick={data.howWePick} /> : <SectionHeader title={SLUG_TITLES[slug] ?? 'Loading'} />}
      {children}
      {error ? (
        <ErrorState error={error} compact onRetry={() => setAttempt((n) => n + 1)} />
      ) : !data ? (
        <RowSkeleton />
      ) : data.items.length ? (
        <PosterRow label={data.title} items={data.items} />
      ) : (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">{data.note || emptyNote || 'Nothing to show right now.'}</p>
      )}
    </section>
  );
}
const SLUG_TITLES: Record<string, string> = { 'free-movies': 'Watch Free Movies', trending: 'Trending Across the Universe', 'trending-india': 'Trending in India', 'bollywood-hits': 'Bollywood Hits', 'south-indian-cinema': 'South Indian Blockbusters', 'indian-series': 'Indian Series', 'hidden-gems': 'Hidden Gems', 'one-night-binge': 'One-Night Binge', 'mind-bending': 'Mind-Bending Stories', 'comfort-cinema': 'Comfort Cinema', 'critically-loved': 'Critically Loved', 'because-you-watched': 'Because You Saved', 'airing-in-india': 'Airing in India', 'popular-tv': 'Popular TV' };
