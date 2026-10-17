'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import type { EpisodeInfo, SeasonInfo } from '@synccinema/common';
import { defaultSeason, episodeCode, formatAirdate, nextEpisodeLabel, nextTabIndex, runtimeLabel, seasonTabs, totalEpisodes } from '../../lib/catalog/tv';
import { FOCUS, ROW_TITLE, SURFACE } from './ui';

/** The "Next episode" badge (date from TVmaze). Renders nothing when no episode is announced. */
export function NextEpisodeBadge({ episode, className = '' }: { episode: EpisodeInfo | null | undefined; className?: string }) {
  const label = nextEpisodeLabel(episode);
  if (!label) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded bg-emerald-600/90 px-2 py-0.5 text-[11px] font-bold text-white ${className}`}>
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function EpisodeRow({ e, today }: { e: EpisodeInfo; today: string }) {
  const date = formatAirdate(e.airdate);
  const upcoming = Boolean(e.airdate && e.airdate > today);
  const run = runtimeLabel(e.runtimeMinutes);
  return (
    <li className="flex gap-3 py-2.5">
      <span className="w-8 shrink-0 pt-0.5 text-right text-xs font-bold tabular-nums text-slate-500 dark:text-zinc-400" aria-label={`Episode ${e.number}`}>{e.number}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.name}</p>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
          {[date ? (upcoming ? `Airs ${date}` : date) : 'Air date not announced', run].filter(Boolean).join(' · ')}
        </p>
        {e.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-zinc-300">{e.summary}</p>}
      </div>
    </li>
  );
}

/**
 * Collapsible "Seasons & episodes" (a disclosure button with aria-expanded) with one tab per season (WAI-ARIA tabs:
 * arrow keys, Home, End, roving tabindex). Only the selected season is rendered. Summaries are plain text.
 * `seasons === undefined` means the episode list could not be loaded.
 */
export function SeasonsSection({ seasons, nextEpisode, today }: { seasons: SeasonInfo[] | undefined; nextEpisode: EpisodeInfo | null | undefined; today: string }) {
  const uid = useId();
  const tabs = useMemo(() => seasonTabs(seasons), [seasons]);
  const initial = useMemo(() => defaultSeason(seasons, nextEpisode, today), [seasons, nextEpisode, today]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = picked !== null && tabs.some((t) => t.number === picked) ? picked : initial;
  const season = seasons?.find((s) => s.number === selected) ?? null;
  const total = totalEpisodes(seasons);
  const panelId = `${uid}-panel`;

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const next = nextTabIndex(index, e.key, tabs.length);
    if (next === null) return;
    e.preventDefault();
    setPicked(tabs[next].number);
    tabRefs.current[next]?.focus();
  };

  return (
    <section aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between gap-2 rounded text-left cursor-pointer ${FOCUS}`}
        >
          <span className={ROW_TITLE}>
            Seasons &amp; episodes
            {tabs.length > 0 && <span className="ml-2 font-normal text-slate-500 dark:text-zinc-400">{tabs.length} {tabs.length === 1 ? 'season' : 'seasons'}, {total} episodes</span>}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className={`${SURFACE} mt-2 rounded-xl p-3 sm:p-4`}>
        {!seasons ? (
          <p role="status" className="text-sm text-slate-500 dark:text-zinc-400">The episode list is not available right now. Please try again later.</p>
        ) : tabs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400">No episodes are listed for this show yet.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Seasons" className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {tabs.map((t, i) => {
                const active = t.number === selected;
                return (
                  <button
                    key={t.number}
                    ref={(el) => { tabRefs.current[i] = el; }}
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${t.number}`}
                    aria-selected={active}
                    aria-controls={`${uid}-tp-${t.number}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setPicked(t.number)}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold motion-safe:transition ${FOCUS} ${active ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-[#101115] dark:text-zinc-400 dark:hover:bg-[#1f2029]'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {season && (
              <div role="tabpanel" id={`${uid}-tp-${season.number}`} aria-labelledby={`${uid}-tab-${season.number}`} tabIndex={0} className={`rounded ${FOCUS}`}>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {[season.name, `${season.episodeCount} ${season.episodeCount === 1 ? 'episode' : 'episodes'}`, season.premiereDate ? `from ${formatAirdate(season.premiereDate)}` : null].filter(Boolean).join(' · ')}
                </p>
                <ol aria-label={`${episodeCode({ season: season.number, number: 0 })} episodes`} className="mt-1 divide-y divide-slate-200 dark:divide-white/[0.06]">
                  {season.episodes.map((e) => <EpisodeRow key={`${e.season}-${e.number}`} e={e} today={today} />)}
                </ol>
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">Episode data from TVmaze.</p>
      </div>
    </section>
  );
}
