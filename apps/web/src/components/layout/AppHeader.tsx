'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react';
import { useMyMembership } from '../membership/useMyMembership';
import { NotificationBell } from '../notifications/NotificationBell';
import { WatchlistNotice } from '../watchlist/WatchlistNotice';
import { HeaderSearch } from './HeaderSearch';
import { getStoredSession, createPartyRoom } from '../../lib/api';

export interface AppHeaderProps {
  onOpenMobileSidebar?: () => void;
  searchPlaceholder?: string;
  backHref?: string;
  /**
   * Replaces the default "create an instant room" flow of the + button and of a pasted YouTube link (a page can show
   * its own create-room dialog). It receives the video when one was pasted.
   */
  onCreateRoom?: (opts?: { title?: string; sourceUrl?: string }) => void;
  rightContent?: React.ReactNode;
}

/**
 * The one header of the app. It owns THE search box (HeaderSearch): a pasted YouTube link starts a party, a room code
 * opens the room, anything else gives live suggestions (movies and shows, games) and Enter opens /discover?q=.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMobileSidebar,
  searchPlaceholder = 'Search or paste a YouTube link / room code',
  backHref,
  onCreateRoom,
  rightContent
}) => {
  const router = useRouter();
  const myMembership = useMyMembership();

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escape closes the mobile search sheet
  useEffect(() => {
    if (!isMobileSearchOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileSearchOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileSearchOpen]);

  const handleDefaultCreateRoom = async (ytId?: string) => {
    if (onCreateRoom) {
      onCreateRoom(ytId ? { title: `YouTube Party (${ytId})`, sourceUrl: `https://www.youtube.com/watch?v=${ytId}` } : undefined);
      return;
    }

    const session = getStoredSession();
    if (!session?.token) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    setIsSubmitting(true);
    try {
      const title = ytId ? `YouTube Party (${ytId})` : 'Instant Watch Party';
      const sourceUrl = ytId
        ? `https://www.youtube.com/watch?v=${ytId}`
        : 'https://www.youtube.com/watch?v=zSWdZVtXT7E';

      const data = await createPartyRoom({
        title,
        sourceUrl,
        mediaTitle: title,
        activityMode: 'CINEMA',
        token: session.token
      });

      router.push(`/room/${data.room.slug}`);
    } catch {
      router.push('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  const navBtn = 'flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-300 dark:hover:bg-[#1c1d25] cursor-pointer';

  return (
    <>
      {/* Top Header Bar */}
      <div className="relative flex w-full items-center justify-center gap-2 sm:gap-3">
        {/* Mobile Menu & Back & Forward Controls */}
        <div className="flex shrink-0 items-center space-x-1.5 sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2 sm:space-x-2">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="cursor-pointer rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:text-zinc-300 dark:hover:bg-white/10 lg:hidden"
              title="Open Menu"
              aria-label="Open Menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={handleBack} className={`${navBtn} h-8 w-8 sm:h-9 sm:w-9`} title="Back" aria-label="Go back">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => router.forward()} className={`${navBtn} hidden h-9 w-9 sm:flex`} title="Forward" aria-label="Go forward">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Desktop/Tablet: the single search box */}
        <HeaderSearch variant="bar" placeholder={searchPlaceholder} busy={isSubmitting} onLaunchVideo={(id) => void handleDefaultCreateRoom(id)} />

        {/* Actions placed directly NEXT TO SEARCH on desktop (leaving the right side empty) */}
        <div className="hidden shrink-0 items-center space-x-2 sm:flex">
          {/* Live Room Limit Indicator */}
          <div className="flex items-center space-x-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 dark:border-white/10 dark:bg-[#14151b] dark:text-zinc-300">
            <Users className="h-3.5 w-3.5 text-[#ee1d49]" aria-hidden="true" />
            <span>Up to {myMembership?.limits.roomCapacity ?? 6} per room</span>
          </div>

          {/* Notification Bell */}
          <NotificationBell />

          {rightContent}
        </div>

        {/* Mobile-Only Action Cluster (sm:hidden) */}
        <div className="ml-auto flex shrink-0 items-center space-x-2 sm:hidden">
          <button type="button" onClick={() => setIsMobileSearchOpen(true)} className={`${navBtn} p-2`} title="Search" aria-label="Search">
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          <NotificationBell />
          {rightContent}
        </div>
      </div>

      {/* Mobile Search Sheet */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-[250] flex flex-col justify-start sm:hidden" role="dialog" aria-modal="true" aria-label="Search">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsMobileSearchOpen(false)} />

          <div className="relative z-10 w-full rounded-b-2xl border-b border-slate-200 bg-white px-4 pb-4 pt-4 dark:border-white/10 dark:bg-[#14151b]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Search</span>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="cursor-pointer rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/10"
                title="Close search"
                aria-label="Close search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <HeaderSearch variant="sheet" autoFocus placeholder={searchPlaceholder} busy={isSubmitting} onLaunchVideo={(id) => void handleDefaultCreateRoom(id)} onDone={() => setIsMobileSearchOpen(false)} />
          </div>
        </div>
      )}

      <WatchlistNotice />
    </>
  );
};
