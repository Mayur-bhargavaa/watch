'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Play, User, Loader2, Clapperboard } from 'lucide-react';
import { tmdbImageUrl, type CatalogPage, type CatalogSource, type CatalogTitle } from '@synccinema/common';
import { catalogApi, AVAILABILITY_OFF_MESSAGE, AVAILABILITY_PAUSED_MESSAGE, type TitleResponse } from '../../lib/catalog/api';
import { attributionForTitle } from '../../lib/catalog/attribution';
import { ratingChips } from '../../lib/catalog/tv';
import { groupOffers } from '../../lib/catalog/providers';
import { externalLinkProps } from '../../lib/catalog/externalLink';
import { createPartyRoom, getStoredSession } from '../../lib/api';
import { Backdrop, BTN_DARK, ErrorState, EYEBROW, FOCUS, HERO_CARD, Poster, ROW_TITLE, Skeleton, SURFACE, yearOf } from './ui';
import { NextEpisodeBadge, SeasonsSection } from './Seasons';
import { PartyButton, WatchlistButton } from './Actions';
import { PosterRow, SectionHeader } from './Row';
import { Attribution } from './Attribution';

const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : null);

function ProviderLogo({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#1f2029] dark:text-zinc-300" aria-hidden="true">{name.slice(0, 1)}</span>;
  // logo URL comes from the availability source and was validated (https) on the server
  return <img src={url} alt="" width={32} height={32} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-8 w-8 rounded bg-white object-contain p-0.5" />;
}

function Availability({ data, onStartCinema }: { data: TitleResponse; onStartCinema?: (streamUrl: string) => void }) {
  const { title } = data;
  if (!data.availabilityEnabled) return <p className="text-sm text-slate-500 dark:text-slate-400">{AVAILABILITY_OFF_MESSAGE}.</p>;
  if (!data.availabilityVerified) {
    // the monthly quota of the limited provider is nearly used up: say so instead of implying "not available"
    if (data.availabilityQuotaLow) return <p className="text-sm text-slate-500 dark:text-slate-400">{AVAILABILITY_PAUSED_MESSAGE}.</p>;
    return <p className="text-sm text-slate-500 dark:text-slate-400">We could not verify where to watch this in your region.</p>;
  }
  const groups = groupOffers(title.providers);
  if (!groups.length) return <p className="text-sm text-slate-500 dark:text-slate-400">Not found on any service in {title.region}.</p>;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.type}>
          <h3 className={EYEBROW}>{g.label}</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {g.offers.map((o) => {
              const link = externalLinkProps(o.destinationUrl, o.name);
              const isEmbedded = o.capabilities?.playback === 'embedded' && o.destinationUrl;
              return (
                <li key={`${o.id}:${o.type}`} className={`${SURFACE} flex items-center gap-3 rounded-xl p-2.5`}>
                  <ProviderLogo url={o.logoUrl} name={o.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{o.name}</p>
                    {isEmbedded ? (
                      <button
                        type="button"
                        onClick={() => onStartCinema?.(o.destinationUrl!)}
                        className={`inline-flex items-center gap-1.5 rounded text-xs font-bold text-emerald-500 hover:text-emerald-400 hover:underline cursor-pointer transition ${FOCUS}`}
                      >
                        <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Watch in Cinema Room</span>
                      </button>
                    ) : link ? (
                      <>
                        <a href={link.href} target={link.target} rel={link.rel} className={`inline-flex items-center gap-1 rounded text-xs font-semibold text-rose-500 hover:underline ${FOCUS}`}>
                          Open on {o.name} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{link.caption}</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">No link provided</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-slate-500 dark:text-slate-400">Playback on streaming services happens on their own apps. In a watch party we coordinate a start time and a countdown; we cannot keep their players in frame-accurate sync.</p>
    </div>
  );
}

function Person({ name, role, path }: { name: string; role: string | null; path: string | null }) {
  const src = tmdbImageUrl(path, 'w185');
  return (
    <li className="flex w-24 shrink-0 flex-col items-center text-center">
      <div className="h-20 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-[#1f2029]">
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400" aria-hidden="true"><User className="h-7 w-7" /></div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-900 dark:text-white">{name}</p>
      {role && <p className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">{role}</p>}
    </li>
  );
}

export function TitleDetail({ source, mediaType, id, roomSlug }: { source: CatalogSource; mediaType: string; id: string; roomSlug: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<TitleResponse | null>(null);
  const [recs, setRecs] = useState<CatalogPage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [startingFree, setStartingFree] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    setData(null);
    setRecs(null);
    catalogApi.title(source, mediaType, id, ctrl.signal).then(setData).catch((e) => e?.name !== 'AbortError' && setError(e));
    catalogApi.recommendations(source, mediaType, id, ctrl.signal).then(setRecs).catch(() => undefined);
    return () => ctrl.abort();
  }, [source, mediaType, id, attempt]);

  const handleWatchFree = async (url: string) => {
    const s = getStoredSession();
    if (!s?.token) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setStartingFree(true);
    try {
      const res = await createPartyRoom({
        title: `Watching ${data?.title.title || 'Movie'}`.slice(0, 60),
        mediaTitle: data?.title.title || 'Movie',
        sourceUrl: url,
        activityMode: 'CINEMA',
        token: s.token
      });
      router.push(`/room/${res.room.slug}`);
    } catch (e: any) {
      console.error('Failed to create cinema room:', e);
      setStartingFree(false);
    }
  };

  const back = (
    <Link href="/discover" className={`inline-flex items-center gap-1.5 rounded text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white ${FOCUS}`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Discover
    </Link>
  );
  if (error) {
    return <div className="space-y-4">{back}<ErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} /></div>;
  }
  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        {back}
        <Skeleton className="h-64 w-full sm:h-80 !rounded-2xl sm:!rounded-3xl" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  const t: CatalogTitle = data.title;
  const meta = [yearOf(t), t.mediaType === 'tv' ? 'TV series' : 'Movie', t.runtimeMinutes ? `${t.runtimeMinutes} min${t.mediaType === 'tv' ? ' per episode' : ''}` : null, t.mediaType === 'tv' && t.seasons ? `${t.seasons} season${t.seasons > 1 ? 's' : ''}` : null].filter(Boolean);
  const trailer = t.trailerYoutubeId && /^[A-Za-z0-9_-]{11}$/.test(t.trailerYoutubeId) ? `https://www.youtube.com/watch?v=${t.trailerYoutubeId}` : null;
  const freeStream = t.freeStreamUrl || t.providers?.find((p) => p.type === 'free' && p.destinationUrl)?.destinationUrl;

  return (
    <article className="space-y-5 sm:space-y-6">
      {back}
      <header className={`${HERO_CARD} md:min-h-[400px] flex flex-col justify-end`}>
        <Backdrop path={t.backdropPath} priority className="absolute inset-0 h-full w-full opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111217] via-[#111217]/60 to-transparent" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111217] via-[#111217]/70 to-transparent" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-4 sm:gap-5 p-4 sm:p-8 md:p-10 sm:flex-row">
          <div className="w-32 shrink-0 sm:w-44"><Poster path={t.posterPath} title={t.title} sizes="192px" priority /></div>
          <div className="min-w-0 max-w-xl space-y-2 sm:space-y-3 self-end">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap">{t.mediaType === 'tv' ? 'TV series' : 'Movie'}</span>
              {ratingChips(t).map((r) => <span key={r.source} className="inline-flex items-center rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[11px] font-bold">{r.label}</span>)}
              {t.voteCount > 0 && t.source === 'tmdb' && <span className="text-[11px] sm:text-xs text-zinc-300">{t.voteCount.toLocaleString()} votes</span>}
              {freeStream && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap shadow-xs">
                  Free to Stream
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-snug sm:leading-tight">{t.title}</h1>
            {t.mediaType === 'tv' && t.nextEpisode && <div><NextEpisodeBadge episode={t.nextEpisode} /></div>}
            {t.tagline && <p className="text-[11px] sm:text-xs md:text-sm italic text-zinc-300">{t.tagline}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-zinc-300 font-medium">
              {meta.map((m) => <span key={String(m)}>{m}</span>)}
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Genres">
              {t.genres.map((g) => <li key={g.id} className="rounded-full bg-[#171821] border border-white/10 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-zinc-200">{g.name}</li>)}
            </ul>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 sm:pt-2">
              {freeStream && (
                <button
                  type="button"
                  disabled={startingFree}
                  onClick={() => void handleWatchFree(freeStream)}
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-60 cursor-pointer"
                >
                  {startingFree ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  <span>Watch Free Now</span>
                </button>
              )}
              <PartyButton title={t} preferredRoom={roomSlug} variant={freeStream ? 'secondary' : 'primary'} />
              <WatchlistButton title={t} variant="hero" />
              {trailer && (
                <a href={trailer} target="_blank" rel="noopener noreferrer" className={BTN_DARK}>
                  <Play className="h-4 w-4" aria-hidden="true" /> Trailer
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="ov">
        <h2 id="ov" className={ROW_TITLE}>Overview</h2>
        <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-zinc-200">{t.overview || 'No overview is available for this title.'}</p>
        <dl className="mt-3 grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {fmtDate(t.releaseDate) && (<><dt className="text-slate-500 dark:text-slate-400">{t.mediaType === 'tv' ? 'First aired' : 'Release date'}</dt><dd className="text-slate-900 dark:text-white">{fmtDate(t.releaseDate)}</dd></>)}
          {t.crew && t.crew.length > 0 && (<><dt className="text-slate-500 dark:text-slate-400">{t.crew[0].role === 'Creator' ? 'Created by' : 'Directed by'}</dt><dd className="text-slate-900 dark:text-white">{t.crew.map((c) => c.name).join(', ')}</dd></>)}
          {ratingChips(t).map((r) => (<React.Fragment key={r.source}><dt className="text-slate-500 dark:text-slate-400">{r.source} rating</dt><dd className="text-slate-900 dark:text-white">{r.value.toFixed(1)} / 10</dd></React.Fragment>))}
          {t.mediaType === 'tv' && t.tvStatus && (<><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className="text-slate-900 dark:text-white">{t.tvStatus}</dd></>)}
        </dl>
      </section>

      <section aria-labelledby="where">
        <h2 id="where" className={ROW_TITLE}>Where to watch <span className="font-normal text-slate-500 dark:text-slate-400">in {t.region}</span></h2>
        <div className="mt-3"><Availability data={data} onStartCinema={handleWatchFree} /></div>
      </section>

      {t.mediaType === 'tv' && (t.seasonList !== undefined || t.source === 'tvmaze') && (
        <SeasonsSection seasons={t.seasonList} nextEpisode={t.nextEpisode} today={new Date().toISOString().slice(0, 10)} />
      )}

      {t.cast && t.cast.length > 0 && (
        <section aria-labelledby="cast">
          <h2 id="cast" className={ROW_TITLE}>Cast</h2>
          <ul role="list" className="mt-2.5 sm:mt-3 flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
            {t.cast.map((p) => <Person key={p.id} name={p.name} role={p.role} path={p.profilePath} />)}
          </ul>
        </section>
      )}

      {recs && recs.results.length > 0 && (
        <section aria-label="More like this" className="space-y-2.5 sm:space-y-3">
          <SectionHeader title="More like this" />
          <PosterRow label="More like this" items={recs.results.slice(0, 20)} />
        </section>
      )}
      <Attribution needs={attributionForTitle(t, data.availabilityProvider)} />
    </article>
  );
}
