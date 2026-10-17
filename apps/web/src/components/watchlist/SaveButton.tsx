'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { snapshotOf, linkTitleKey, type CatalogTitle, type LinkSnapshot } from '@synccinema/common';
import { useWatchlist } from '../../lib/catalog/watchlist';
import type { WatchlistSnapshot } from '../../lib/catalog/watchlistState';
import { BTN_DARK, BTN_DARK_ICON, BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '../discover/ui';

type TitleLike = Pick<CatalogTitle, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'mediaType'>;
export type SaveVariant = 'primary' | 'secondary' | 'overlay' | 'hero';

const OVERLAY = `inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/70 text-white hover:bg-rose-600 motion-safe:transition-colors ${FOCUS}`;

/**
 * The one save / remove button of the app. It reads and changes the single shared watchlist, so every instance on a
 * page (hero, rows, results, title page, dashboard cards) flips together. Guests get a sign-in link.
 */
function SaveToggle({ snapshot, variant, compact, iconOnly, name }: { snapshot: WatchlistSnapshot; variant: SaveVariant; compact: boolean; iconOnly: boolean; name: string }) {
  const wl = useWatchlist();
  const pathname = usePathname();
  const saved = wl.items.some((i) => i.titleKey === snapshot.titleKey);
  const base = variant === 'primary' ? BTN_PRIMARY : variant === 'overlay' ? OVERLAY : variant === 'hero' ? (iconOnly ? BTN_DARK_ICON : BTN_DARK) : BTN_SECONDARY;
  const size = variant !== 'overlay' && variant !== 'hero' && compact ? '!px-3 !py-1.5' : '';
  const needsSignIn = wl.ready && !wl.signedIn;
  const Icon = saved ? BookmarkCheck : Bookmark;
  const label = needsSignIn ? 'Sign in to save' : saved ? 'Saved' : 'Save to Watchlist';
  const aria = needsSignIn ? `Sign in to save ${name}` : saved ? `Remove ${name} from watchlist` : `Save ${name} to watchlist`;

  if (needsSignIn) {
    return (
      <Link href={`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`} aria-label={aria} title={label} className={`${base} ${size}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {!iconOnly && label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={iconOnly ? aria : undefined}
      title={iconOnly ? (saved ? 'Remove from Watchlist' : 'Save to Watchlist') : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void wl.toggle(snapshot);
      }}
      className={`${base} ${size}`}
    >
      <Icon className={`h-4 w-4 ${saved && (variant === 'overlay' || variant === 'hero') ? 'text-rose-500' : ''}`} aria-hidden="true" />
      {!iconOnly && label}
    </button>
  );
}

/** Save / remove a catalog title (Discover, title page, dashboard rows). */
export function SaveTitleButton({ title, variant = 'secondary', compact = false, iconOnly = false }: { title: TitleLike; variant?: SaveVariant; compact?: boolean; iconOnly?: boolean }) {
  return <SaveToggle snapshot={snapshotOf(title)} variant={variant} compact={compact} iconOnly={iconOnly} name={title.title} />;
}

/** Save / remove a link (a YouTube video or any https page). The key comes from the normalised URL, like the server's. */
export function SaveLinkButton({ link, variant = 'secondary', compact = false, iconOnly = false }: { link: LinkSnapshot; variant?: SaveVariant; compact?: boolean; iconOnly?: boolean }) {
  const titleKey = linkTitleKey(link.url);
  if (!titleKey) return null; // a link the server would refuse is never offered
  return (
    <SaveToggle
      snapshot={{ kind: 'link', titleKey, title: link.title, url: link.url, platform: link.platform ?? '', thumbnail: link.thumbnail ?? null, category: link.category ?? null, tagline: link.tagline ?? null }}
      variant={variant}
      compact={compact}
      iconOnly={iconOnly}
      name={link.title}
    />
  );
}
