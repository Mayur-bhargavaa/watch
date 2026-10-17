'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Info, Star } from 'lucide-react';
import { tmdbImageUrl, type CatalogTitle } from '@synccinema/common';
import { catalogApi, type CollectionResponse } from '../../lib/catalog/api';
import { heroChips } from '../../lib/catalog/providers';
import { buildHeroSlides, clampIndex, heroTag, interleaveTitles, keyDelta, stepIndex, swipeDelta } from '../../lib/catalog/heroSlides';
import { bitmojiForSession } from '../../lib/bitmoji';
import { Backdrop, BTN_HERO, ErrorState, HERO_CARD, Skeleton, yearOf } from './ui';
import { PartyButton, WatchlistButton } from './Actions';
import { titleHref } from './Row';
import { useSignedInSession } from './useCineverse';

/** Same box as Home's hero (and as the skeleton, so nothing jumps while the slides load). */
const HERO_SIZE = 'min-h-[320px] sm:min-h-[380px] md:h-[400px]';
const GLOBAL_SLOTS = ['trending'] as const;
const INDIAN_SLOTS = ['trending-india', 'bollywood-hits', 'south-indian-cinema'] as const;
const HOW_WE_PICK = "the top of this week's trending list plus the leading titles of the Indian rows below (only titles with artwork).";
/** Home's solid-dark-pill controls (no blur, no glow). */
const PILL = 'bg-[#171821] border border-white/10';
const NAV_BTN = 'rounded-full text-white/80 hover:text-white hover:bg-white/10 motion-safe:transition cursor-pointer motion-safe:active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500';

/**
 * Discover's hero: a carousel of several banners built from real catalog data (3 from this week's trending list and
 * 3 from the Indian rows, de-duplicated, order fixed for the session). Same controls as Home: arrows, dots on mobile,
 * thumbnails on desktop, swipe. Home does not auto-advance, so neither does this.
 */
export function HeroSpotlight({ roomSlug, headingLevel = 2 }: { roomSlug: string | null; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const { session } = useSignedInSession();
  const avatar = useMemo(() => bitmojiForSession(session), [session]);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [slides, setSlides] = useState<CatalogTitle[] | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setError(null);
    setSlides(undefined);
    setIndex(0);
    const slugs = [...GLOBAL_SLOTS, ...INDIAN_SLOTS];
    void Promise.allSettled(slugs.map((slug) => catalogApi.collection(slug, {}, ctrl.signal))).then((settled) => {
      if (cancelled) return;
      const bySlug = new Map<string, CollectionResponse>();
      settled.forEach((r, i) => r.status === 'fulfilled' && bySlug.set(slugs[i], r.value));
      if (bySlug.size === 0) {
        const first = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        setError(first?.reason ?? new Error('Could not load the spotlight.'));
        return;
      }
      const items = (slug: string) => bySlug.get(slug)?.items ?? [];
      setSlides(buildHeroSlides([
        { titles: items('trending'), take: 3 },
        { titles: interleaveTitles(INDIAN_SLOTS.map(items)), take: 3 }
      ]));
    });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const count = slides?.length ?? 0;
  const go = useCallback((delta: number) => setIndex((i) => stepIndex(i, delta, count)), [count]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = keyDelta(e.key);
    if (d) {
      e.preventDefault();
      go(d);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const d = swipeDelta(touchStartX.current, e.changedTouches[0].clientX);
    touchStartX.current = null;
    if (d) go(d);
  };

  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (slides === null || (slides && slides.length === 0)) return null;

  // The Bitmoji overhangs the card on top (same offsets as Home), so the frame reserves that room and never overlaps the header.
  const showAvatar = Boolean(avatar) && !avatarBroken;
  const frame = (inner: React.ReactNode) => (
    <div className={showAvatar ? 'pt-6 sm:pt-10' : undefined}>
      <div className="relative">
        {showAvatar && (
          <div className="absolute -top-14 xs:-top-18 sm:-top-28 right-3 sm:right-8 z-0 pointer-events-auto select-none group">
            <Link href="/profile" className="block motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-2 motion-safe:active:scale-95" title={`${session?.user.displayName || 'Your'} Bitmoji • Click to customize in Profile`}>
              <img
                src={avatar!}
                alt={session?.user.displayName || 'Selected Bitmoji'}
                onError={() => setAvatarBroken(true)}
                className="h-20 xs:h-24 sm:h-36 w-auto object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.95)] filter motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
              />
            </Link>
          </div>
        )}
        {inner}
      </div>
    </div>
  );

  if (slides === undefined) return frame(<Skeleton className={`w-full !rounded-2xl sm:!rounded-3xl ${HERO_SIZE}`} />);

  const i = clampIndex(index, slides.length);
  const title = slides[i];
  // Availability chips appear only when the availability source verified them for this region.
  const chips = heroChips(title.providers);
  const multiple = slides.length > 1;
  return frame(
    <section
      aria-roledescription="carousel"
      aria-label="Featured titles"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={onTouchEnd}
      className={`${HERO_CARD} flex flex-col justify-end p-4 sm:p-8 md:p-10 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${HERO_SIZE}`}
    >
      <Backdrop key={title.id} path={title.backdropPath} priority className="absolute inset-0 h-full w-full opacity-60" />
      {/* scrims (same as Home): darken the bottom and the left of the artwork so the text stays legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#111217] via-[#111217]/60 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#111217] via-[#111217]/70 to-transparent" aria-hidden="true" />
      <p className="sr-only" aria-live="polite">{`Slide ${i + 1} of ${slides.length}: ${title.title}`}</p>
      <div role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${title.title}`} className={`relative z-10 max-w-xl space-y-2 sm:space-y-3 ${multiple ? 'pb-9 md:pb-0' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap">{heroTag(title)}</span>
          {title.rating !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-amber-400 shrink-0">
              <Star className="h-3 w-3 fill-current" aria-hidden="true" /> {title.ratingSource} {title.rating.toFixed(1)}
            </span>
          )}
          {yearOf(title) && <span className="text-[11px] sm:text-xs text-zinc-300 font-medium whitespace-nowrap">{yearOf(title)}</span>}
        </div>
        <Heading className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-snug sm:leading-tight">{title.title}</Heading>
        <p className="text-[11px] sm:text-xs md:text-sm text-zinc-300 line-clamp-2 leading-relaxed max-w-lg">{title.overview}</p>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Verified availability in your region">
            {chips.map((c) => (
              <li key={c.id} className="rounded-full bg-[#171821] border border-white/10 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white">{c.name}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 sm:pt-2">
          <Link href={titleHref(title)} className={BTN_HERO}>
            <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" /> <span>Explore Title</span>
          </Link>
          <PartyButton title={title} preferredRoom={roomSlug} variant="dark" />
          <WatchlistButton title={title} variant="hero" iconOnly />
        </div>
        <p className="text-[10.5px] sm:text-[11px] text-zinc-400">How we pick these: {HOW_WE_PICK}</p>
      </div>

      {multiple && (
        <>
          {/* mobile: previous, dots, next */}
          <div className={`absolute bottom-3 right-3 sm:bottom-6 sm:right-6 flex md:hidden items-center gap-1.5 z-20 ${PILL} px-2.5 py-1.5 rounded-full`}>
            <button type="button" onClick={() => go(-1)} className={`p-1 ${NAV_BTN}`} title="Previous title" aria-label="Previous title">
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-1 px-1">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}: ${s.title}`}
                  aria-current={idx === i}
                  className={`h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${idx === i ? 'w-4 bg-rose-500' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
            <button type="button" onClick={() => go(1)} className={`p-1 ${NAV_BTN}`} title="Next title" aria-label="Next title">
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* desktop: thumbnail switcher */}
          <div className={`absolute bottom-6 right-6 hidden md:flex items-center space-x-2 z-10 ${PILL} p-1.5 rounded-2xl`}>
            <button type="button" onClick={() => go(-1)} className={`p-1.5 ${NAV_BTN}`} title="Previous title" aria-label="Previous title">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {slides.map((s, idx) => {
              const thumb = tmdbImageUrl(s.backdropPath, 'w780');
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(idx)}
                  title={s.title}
                  aria-label={`Show ${s.title}`}
                  aria-current={idx === i}
                  className={`w-14 h-9 rounded-lg overflow-hidden border-2 bg-[#1f2029] motion-safe:transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${idx === i ? 'border-rose-500 motion-safe:scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </button>
              );
            })}
            <button type="button" onClick={() => go(1)} className={`p-1.5 ${NAV_BTN}`} title="Next title" aria-label="Next title">
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
