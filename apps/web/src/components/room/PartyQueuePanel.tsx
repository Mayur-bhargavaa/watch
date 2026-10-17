'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Search, ThumbsUp, X } from 'lucide-react';
import { tmdbImageUrl, type TitleRoomState } from '@synccinema/common';
import { externalLinkProps } from '../../lib/catalog/externalLink';
import { countdownView, formatCountdown, hasVoted, readySummary, sortedQueue, startAtIn } from '../../lib/catalog/partyQueue';
import { useNowMs } from '../../hooks/useNowMs';

const BTN = 'rounded-md px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] disabled:opacity-50';

function Thumb({ path, title }: { path: string | null; title: string }) {
  const src = tmdbImageUrl(path, 'w92');
  return src ? (
    <img src={src} alt="" loading="lazy" decoding="async" className="h-14 w-10 shrink-0 rounded object-cover" />
  ) : (
    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-[#1c1d25] text-[10px] text-zinc-500" role="img" aria-label={`No poster for ${title}`}>N/A</div>
  );
}

/**
 * Party queue: members propose and vote (max 5 titles), the host confirms one. Confirming never starts playback.
 * For services we cannot control (Netflix, Prime Video, JioHotstar ...) the room only coordinates a start time, a link
 * and manual "I'm ready" taps. All rules are enforced by the server; this panel just shows state and sends messages.
 */
export function PartyQueuePanel({ roomSlug, state, myUserId, isHost, memberCount, serverNow, send }: { roomSlug: string; state: TitleRoomState; myUserId: string; isHost: boolean; memberCount: number; serverNow: () => number; send: (type: string, payload: Record<string, unknown>) => void }) {
  const [delay, setDelay] = useState<number>(0);
  const sel = state.selected;
  useNowMs(500, Boolean(sel && sel.startAt));
  const cd = countdownView(sel, serverNow());
  const link = sel ? externalLinkProps(sel.destinationUrl, sel.provider?.name ?? 'the provider') : null;
  const queue = sortedQueue(state.queue);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto py-3 pr-1 text-xs text-zinc-200" aria-label="Party queue">
      {sel ? (
        <section aria-label="Selected title" className="rounded-lg border border-[#ee1d49]/50 bg-[#14151b] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Tonight&apos;s pick</p>
          <div className="mt-2 flex gap-3">
            <Thumb path={sel.snapshot.posterPath} title={sel.snapshot.title} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{sel.snapshot.title}</p>
              <p className="text-zinc-400">{[sel.snapshot.year, sel.snapshot.mediaType === 'tv' ? 'TV' : 'Movie', sel.provider?.name].filter(Boolean).join(' · ')}</p>
              <p className="mt-0.5 text-zinc-500">Confirmed by {sel.confirmedBy.displayName}</p>
            </div>
          </div>

          {cd.phase !== 'none' && (
            <p role="timer" aria-live="off" className="mt-3 rounded bg-[#0c0d12] px-3 py-2 text-center text-sm font-bold text-white">
              {cd.phase === 'counting' ? `Starting in ${formatCountdown(cd.secondsLeft)}` : 'Start time reached. Press play on your own device now.'}
            </p>
          )}

          {link ? (
            <div className="mt-3">
              <a href={link.href} target={link.target} rel={link.rel} className="inline-flex items-center gap-1.5 rounded-md bg-[#ee1d49] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Open on {sel.provider?.name} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <p className="mt-1 text-[11px] text-zinc-500">{link.caption}</p>
            </div>
          ) : sel.provider ? (
            <p className="mt-3 text-zinc-400">Open {sel.provider.name} yourself and search for this title. No verified link is available.</p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-zinc-300" aria-live="polite">{readySummary(sel, memberCount)}</p>
            <button type="button" onClick={() => send('room:title_ready', { titleKey: sel.titleKey, version: state.selectionVersion })} disabled={sel.ready.includes(myUserId)} className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-500`}>
              <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {sel.ready.includes(myUserId) ? 'You are ready' : "I'm ready"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            {sel.capabilities.playback === 'embedded'
              ? 'This one can play inside the room: the host loads it in the player.'
              : 'Playback on this service is not synchronised frame by frame. We coordinate the start time and who is ready; everyone presses play on their own app.'}
          </p>
          {isHost && (
            <button type="button" onClick={() => send('room:title_clear', { version: state.selectionVersion })} className={`${BTN} mt-2 border border-white/15 text-zinc-300 hover:bg-white/10`}>
              <X className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Clear selection
            </button>
          )}
        </section>
      ) : null}

      <section aria-label="Vote queue">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Vote queue ({queue.length}/5)</h3>
          <Link href={`/discover?room=${encodeURIComponent(roomSlug)}`} className="inline-flex items-center gap-1 rounded text-[11px] font-semibold text-[#ee1d49] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]">
            <Search className="h-3 w-3" aria-hidden="true" /> Find a title
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="mt-2 text-zinc-500">No titles yet. Anyone in the room can propose up to five from Discover.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {queue.map((e) => (
              <li key={e.titleKey} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-[#14151b] p-2">
                <Thumb path={e.snapshot.posterPath} title={e.snapshot.title} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[13px] font-semibold text-white">{e.snapshot.title}</p>
                  <p className="text-zinc-500">Proposed by {e.proposedBy.displayName}{e.snapshot.year ? ` · ${e.snapshot.year}` : ''}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => send('room:title_vote', { titleKey: e.titleKey })} aria-pressed={hasVoted(e, myUserId)} aria-label={`${hasVoted(e, myUserId) ? 'Remove your vote for' : 'Vote for'} ${e.snapshot.title}`} className={`${BTN} ${hasVoted(e, myUserId) ? 'bg-[#ee1d49] text-white' : 'border border-white/15 text-zinc-200 hover:bg-white/10'}`}>
                      <ThumbsUp className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> {e.votes.length}
                    </button>
                    {isHost && (
                      <button type="button" onClick={() => send('room:title_confirm', { titleKey: e.titleKey, version: state.selectionVersion, ...(e.provider ? { provider: e.provider } : {}), ...(delay > 0 ? { startAt: startAtIn(delay, serverNow()) } : {}) })} className={`${BTN} bg-white text-black hover:bg-zinc-200`}>
                        Confirm
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {isHost && queue.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="pq-delay" className="text-zinc-400">Countdown</label>
            <select id="pq-delay" value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="rounded-md border border-white/15 bg-[#0c0d12] px-2 py-1 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]">
              <option value={0}>No countdown</option>
              <option value={1}>Start in 1 min</option>
              <option value={2}>Start in 2 min</option>
              <option value={5}>Start in 5 min</option>
            </select>
          </div>
        )}
        {!isHost && queue.length > 0 && <p className="mt-2 text-zinc-500">The host confirms the winner.</p>}
      </section>
    </div>
  );
}
