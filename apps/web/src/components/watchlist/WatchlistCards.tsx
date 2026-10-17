'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Info, Link2, Loader2, Play, Trash2 } from 'lucide-react';
import type { WatchlistLinkItem, WatchlistTitleItem } from '@synccinema/common';
import { createPartyRoom, getStoredSession } from '../../lib/api';
import { linkThumbnail, safeOpenUrl, titleDetailHref } from '../../lib/catalog/watchlistView';
import { useWatchlist } from '../../lib/catalog/watchlist';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS, Poster, SURFACE } from '../discover/ui';
import { PartyButton } from '../discover/Actions';

const ICON_BTN = `inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-[#ee1d49] dark:text-zinc-400 dark:hover:bg-[#1c1d25] ${FOCUS}`;

function RemoveButton({ titleKey, name }: { titleKey: string; name: string }) {
  const wl = useWatchlist();
  return (
    <button type="button" onClick={() => void wl.remove(titleKey)} aria-label={`Remove ${name} from watchlist`} title="Remove" className={ICON_BTN}>
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** A saved catalog title: poster, title, year and type; details, watch party / propose to a room, remove. */
export function TitleCard({ item, roomSlug }: { item: WatchlistTitleItem; roomSlug: string | null }) {
  const href = titleDetailHref(item.titleKey);
  const meta = [item.year, item.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ');
  return (
    <li className={`${SURFACE} flex flex-col gap-2.5 rounded-2xl p-3`}>
      {href ? (
        <Link href={href} className={`block rounded-md ${FOCUS}`} aria-label={`${item.title}, details`}>
          <Poster path={item.posterPath} title={item.title} sizes="(min-width: 1280px) 220px, 45vw" />
        </Link>
      ) : (
        <Poster path={item.posterPath} title={item.title} />
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{meta}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {href && (
          <Link href={href} className={`${BTN_SECONDARY} !px-3 !py-1.5`}>
            <Info className="h-4 w-4" aria-hidden="true" /> Details
          </Link>
        )}
        <PartyButton
          title={{ id: item.titleKey, title: item.title, posterPath: item.posterPath, releaseDate: item.year ? `${item.year}-01-01` : null, mediaType: item.mediaType }}
          preferredRoom={roomSlug}
          label={roomSlug ? 'Propose' : 'Watch Party'}
          compact
        />
        <span className="ml-auto"><RemoveButton titleKey={item.titleKey} name={item.title} /></span>
      </div>
    </li>
  );
}

/** A saved link: thumbnail, site, title; start a party with that URL (the existing create-room flow), open it safely, remove. */
export function LinkCard({ item }: { item: WatchlistLinkItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const thumb = linkThumbnail(item);
  const open = safeOpenUrl(item);

  const startParty = async () => {
    const session = getStoredSession();
    if (!session?.token) {
      router.push('/login?redirect=/watchlist');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await createPartyRoom({ title: item.title.slice(0, 60) || 'Watch Party Room', sourceUrl: item.url, mediaTitle: item.title, activityMode: 'CINEMA', token: session.token });
      router.push(`/room/${data.room.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the party.');
      setBusy(false);
    }
  };

  return (
    <li className={`${SURFACE} flex flex-col gap-2.5 rounded-2xl p-3`}>
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-200 dark:bg-[#1c1d25]">
        {thumb && !broken ? (
          <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-600" role="img" aria-label={`No thumbnail for ${item.title}`}>
            <Link2 className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{item.platform || 'Link'}</span>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
        {(item.tagline || item.category) && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{item.tagline || item.category}</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => void startParty()} disabled={busy} className={`${BTN_PRIMARY} !px-3 !py-1.5`}>
          {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
          {busy ? 'Starting' : 'Watch Party'}
        </button>
        {open && (
          <a href={open} target="_blank" rel="noopener noreferrer" className={`${BTN_SECONDARY} !px-3 !py-1.5`}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open
          </a>
        )}
        <span className="ml-auto"><RemoveButton titleKey={item.titleKey} name={item.title} /></span>
      </div>
      {error && <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">{error}</p>}
    </li>
  );
}
