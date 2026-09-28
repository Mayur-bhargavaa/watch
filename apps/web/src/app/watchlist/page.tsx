'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart,
  Play,
  Trash2,
  Plus,
  Film,
  Menu,
  Sun,
  Moon,
  Copy,
  Check,
  X,
  Search,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { AppHeader } from '../../components/layout/AppHeader';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  createPartyRoom,
  UserSession
} from '../../lib/api';

export interface WatchlistItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  platformBadge: string;
  thumbnail: string;
  category?: string;
  tagline?: string;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  {
    id: 'interstellar',
    title: 'Interstellar: 4K IMAX Experience',
    url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    platform: 'YOUTUBE 4K',
    platformBadge: 'bg-rose-600 text-white',
    thumbnail: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
    category: 'Sci-Fi IMAX',
    tagline: 'Christopher Nolan Masterpiece'
  },
  {
    id: 'netflix-stranger-things',
    title: 'Stranger Things 4',
    url: 'https://www.netflix.com/title/80057281',
    platform: 'NETFLIX',
    platformBadge: 'bg-red-600 text-white',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop&q=80',
    category: 'Sci-Fi Drama',
    tagline: 'Netflix Original • 4 Seasons'
  },
  {
    id: 'prime-the-boys',
    title: 'The Boys Season 4',
    url: 'https://www.primevideo.com',
    platform: 'PRIME VIDEO',
    platformBadge: 'bg-blue-600 text-white',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&h=400&fit=crop&q=80',
    category: 'Action Satire',
    tagline: 'Prime Video Exclusive'
  },
  {
    id: 'cyberpunk',
    title: 'Cyberpunk 2077: Phantom Liberty',
    url: 'https://www.youtube.com/watch?v=qIcTM8WXFjk',
    platform: 'YOUTUBE 4K',
    platformBadge: 'bg-rose-600 text-white',
    thumbnail: 'https://img.youtube.com/vi/qIcTM8WXFjk/maxresdefault.jpg',
    category: 'Cinematic Thriller',
    tagline: 'Dogtown Night City'
  }
];

export default function WatchlistPage() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Room Creation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdRoomInfo, setCreatedRoomInfo] = useState<{
    slug: string;
    inviteUrl: string;
    title: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    } else {
      router.push('/login?redirect=/watchlist');
      return;
    }

    // Load persisted watchlist
    try {
      const stored = localStorage.getItem('stitchbyte_watchlist');
      if (stored) {
        setWatchlist(JSON.parse(stored));
      } else {
        setWatchlist(DEFAULT_WATCHLIST);
        localStorage.setItem('stitchbyte_watchlist', JSON.stringify(DEFAULT_WATCHLIST));
      }
    } catch {
      setWatchlist(DEFAULT_WATCHLIST);
    }
  }, [router]);

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = watchlist.filter((item) => item.id !== id);
    setWatchlist(updated);
    try {
      localStorage.setItem('stitchbyte_watchlist', JSON.stringify(updated));
    } catch {}
  };

  const handleDirectCreateRoom = async (title: string, videoUrl?: string) => {
    if (!session?.token) {
      router.push('/login?redirect=/watchlist');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createPartyRoom({
        title: title || 'Watch Party Room',
        sourceUrl: videoUrl || '',
        mediaTitle: title || 'Watch Party Room',
        activityMode: 'CINEMA',
        token: session.token
      });

      const hostOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://watch.stitchbyte.in';
      const invite = data.inviteUrl || `${hostOrigin}/room/${data.room.slug}`;

      setCreatedRoomInfo({
        slug: data.room.slug,
        inviteUrl: invite,
        title: data.room.title || title
      });

      // Quick auto-redirect
      setTimeout(() => {
        router.push(`/room/${data.room.slug}`);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create room:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = watchlist.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-x-hidden">
      {/* Centralized App Sidebar */}
      <AppSidebar
        activeNav="watchlist"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <AppHeader
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Page Body */}
        <div className="max-w-7xl mx-auto w-full space-y-5 sm:space-y-8 animate-fadeIn pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 pb-4 sm:pb-5 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center space-x-3 sm:space-x-3.5 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-[#ee1d49] shrink-0">
                <Heart className="w-5 h-5 sm:w-7 sm:h-7 fill-rose-500/20" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  My Watchlist
                </h1>
                <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                  Saved movies and shows ready to stream synchronously with friends.
                </p>
              </div>
            </div>

            {/* Responsive Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0">
              <span className="flex-1 sm:flex-initial min-w-0 flex items-center justify-center text-center text-[11px] sm:text-xs font-bold px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
                <span className="truncate">
                  {watchlist.length} {watchlist.length === 1 ? 'title' : 'titles'} saved
                </span>
              </span>
              <Link
                href="/dashboard"
                className="flex-1 sm:flex-initial min-w-0 flex items-center justify-center text-center px-2.5 sm:px-4 py-2 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-md shadow-[#ee1d49]/25 transition active:scale-95 gap-1 sm:gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Browse Cinema</span>
              </Link>
            </div>
          </div>

          {/* Search Filter if list has items */}
          {watchlist.length > 0 && (
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved titles..."
                className="w-full pl-10 pr-9 py-2 sm:py-2.5 rounded-2xl bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/10 text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ee1d49] transition shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Watchlist Grid */}
          {watchlist.length === 0 ? (
            <div className="p-6 sm:p-12 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/[0.06] text-center space-y-3.5 sm:space-y-4 max-w-md mx-auto mt-6 sm:mt-12 shadow-sm">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[#ee1d49] mx-auto">
                <Heart className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div className="space-y-1 sm:space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Your Watchlist is Empty</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Browse movies, anime, and YouTube experiences from Cinema and tap the heart icon to save them for watch parties!
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#ee1d49]/30 transition active:scale-95"
              >
                <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Explore Cinema Now</span>
              </Link>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-8 sm:p-10 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/[0.06] text-center text-slate-400 text-xs sm:text-sm">
              No saved titles match &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  className="group p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-[#161020] transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3.5 shadow-xs hover:shadow-md hover:scale-[1.01]"
                >
                  <div className="relative aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-black/60">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className={`absolute top-2 left-2 sm:top-2.5 sm:left-2.5 px-2 sm:px-2.5 py-0.5 rounded-md text-[8.5px] sm:text-[9px] font-black shadow tracking-wider ${item.platformBadge || 'bg-rose-600 text-white'}`}>
                      {item.platform || 'CINEMA'}
                    </span>

                    {/* Remove from Watchlist */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveItem(item.id, e)}
                      className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 p-1.5 rounded-full bg-black/70 hover:bg-[#ee1d49] text-zinc-300 hover:text-white transition z-10 cursor-pointer shadow-md active:scale-90"
                      title="Remove from Watchlist"
                    >
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-[#ee1d49] transition truncate">
                      {item.title}
                    </h3>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                      {item.tagline || item.category || 'Saved to Watchlist'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDirectCreateRoom(item.title, item.url)}
                      className="flex-1 py-2 sm:py-2.5 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-md shadow-[#ee1d49]/25 transition flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
                      <span className="truncate">{isSubmitting ? 'Launching...' : 'Start Watch Party'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Created Room Modal */}
      {createdRoomInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Room Ready!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedRoomInfo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Your synchronized room for <span className="font-bold text-slate-900 dark:text-white">&quot;{createdRoomInfo.title}&quot;</span> has been created. Redirecting you now...
            </p>

            <div className="flex items-center space-x-2 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-[11px] sm:text-xs min-w-0">
              <span className="truncate flex-1 text-slate-600 dark:text-zinc-300">
                {createdRoomInfo.inviteUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdRoomInfo.inviteUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="p-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-700 dark:text-zinc-200 hover:text-slate-900 shrink-0 cursor-pointer"
                title="Copy link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/room/${createdRoomInfo.slug}`)}
              className="w-full py-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Enter Room Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
