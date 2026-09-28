'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Search,
  Play,
  Plus,
  Users,
  Sun,
  Moon,
  X
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { getStoredSession, createPartyRoom } from '../../lib/api';

function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export interface AppHeaderProps {
  onOpenMobileSidebar?: () => void;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
  backHref?: string;
  onCreateRoom?: () => void;
  rightContent?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMobileSidebar,
  searchPlaceholder = 'Paste YouTube link / ID or room code...',
  searchQuery: externalQuery,
  onSearchChange: externalOnChange,
  onSearchSubmit: externalOnSubmit,
  backHref,
  onCreateRoom,
  rightContent
}) => {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [localQuery, setLocalQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const query = externalQuery !== undefined ? externalQuery : localQuery;
  const handleQueryChange = (val: string) => {
    if (externalOnChange) {
      externalOnChange(val);
    } else {
      setLocalQuery(val);
    }
  };

  const detectedYtId = useMemo(() => extractYouTubeId(query), [query]);

  const handleDefaultCreateRoom = async (ytId?: string) => {
    if (onCreateRoom) {
      onCreateRoom();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (externalOnSubmit) {
      externalOnSubmit(e);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) return;

    if (detectedYtId) {
      handleDefaultCreateRoom(detectedYtId);
      return;
    }

    // Check if it's a room link or code
    const clean = trimmed.replace(/^.*\/room\//, '').trim();
    if (clean.length > 2 && !clean.includes(' ')) {
      router.push(`/room/${clean}`);
      return;
    }

    // Default search fallback
    router.push(`/dashboard?search=${encodeURIComponent(trimmed)}`);
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

  return (
    <>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
        {/* Mobile Menu & Back & Forward Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer active:scale-95 transition"
              title="Open Menu"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center text-slate-600 dark:text-zinc-300 transition shadow-sm dark:shadow-none cursor-pointer active:scale-95"
            title="Back"
            aria-label="Go back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.forward()}
            className="hidden sm:flex w-9 h-9 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/[0.06] items-center justify-center text-slate-600 dark:text-zinc-300 transition shadow-sm dark:shadow-none cursor-pointer active:scale-95"
            title="Forward"
            aria-label="Go forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Search Trigger Button (sm:hidden) */}
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen(true)}
          className="sm:hidden p-2 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300 transition shadow-sm active:scale-95 cursor-pointer ml-auto"
          title="Search or Import Video"
          aria-label="Search"
        >
          <Search className="w-4 h-4 text-slate-500 dark:text-zinc-300" />
        </button>

        {/* Desktop/Tablet Real YouTube URL Importer & Room Search Bar */}
        <form
          onSubmit={handleSubmit}
          className="hidden sm:flex flex-1 max-w-xl items-center bg-white dark:bg-[#1b1c24] border border-slate-200 dark:border-white/[0.08] px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs text-slate-900 dark:text-white focus-within:border-rose-500/80 transition shadow-sm dark:shadow-inner relative min-w-0"
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 dark:text-zinc-400 shrink-0 mr-2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-[11px] sm:text-xs placeholder-slate-400 dark:placeholder-zinc-500 text-slate-900 dark:text-white font-mono truncate"
          />

          {detectedYtId ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="ml-2 px-2.5 sm:px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shrink-0 transition flex items-center space-x-1 shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span className="hidden xs:inline">Launch</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleDefaultCreateRoom()}
              title="Create Instant Watch Party"
              className="text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white p-1 ml-1 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Notification Bell directly next to Search Bar */}
        <div className="shrink-0">
          <NotificationBell />
        </div>

        {/* Top Right Header with Max 6 Indicator & Theme Toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Live Room Limit Indicator */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-zinc-300 shadow-sm dark:shadow-none">
            <Users className="w-3.5 h-3.5 text-rose-500" />
            <span>Max 6 per room</span>
          </div>

          {rightContent}

          {/* 1-Click Theme Switcher (Sun / Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-[#1b1c24] hover:bg-slate-100 dark:hover:bg-[#242531] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-zinc-200 transition shadow-sm dark:shadow-none active:scale-95 cursor-pointer"
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme mode"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform duration-300" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Search Modal Overlay */}
      {isMobileSearchOpen && (
        <div className="sm:hidden fixed inset-0 z-[250] flex flex-col justify-start">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsMobileSearchOpen(false)}
          />

          <div className="relative z-10 w-full bg-white dark:bg-[#161722] border-b border-slate-200 dark:border-white/10 px-4 pt-4 pb-5 shadow-2xl animate-in slide-in-from-top-4 duration-200 rounded-b-3xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Search or Import
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-zinc-400 cursor-pointer transition"
                title="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                handleSubmit(e);
                setIsMobileSearchOpen(false);
              }}
              className="space-y-3"
            >
              <div className="flex items-center bg-slate-100 dark:bg-[#1e1f2c] border border-slate-300 dark:border-white/15 px-3 py-2.5 rounded-2xl text-xs text-slate-900 dark:text-white focus-within:border-rose-500 transition shadow-inner">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 shrink-0 mr-2" />
                <input
                  type="text"
                  autoFocus
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-xs placeholder-slate-400 dark:placeholder-zinc-500 text-slate-900 dark:text-white font-mono"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => handleQueryChange('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate">
                  {detectedYtId ? (
                    <span className="text-emerald-500 font-medium">✓ Valid YouTube Video found</span>
                  ) : (
                    <span>Paste any video link or type a room code</span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileSearchOpen(false);
                      handleDefaultCreateRoom();
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition"
                  >
                    New Room
                  </button>
                  <button
                    type="submit"
                    disabled={!query.trim() || isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
                  >
                    {detectedYtId && <Play className="w-3 h-3 fill-current" />}
                    <span>{detectedYtId ? 'Launch' : 'Go'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
