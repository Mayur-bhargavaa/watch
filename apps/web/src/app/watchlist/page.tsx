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
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
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
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile Top Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-[#130e1b] border-b border-slate-200 dark:border-white/10 sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ee1d49] to-[#ff3b68] flex items-center justify-center text-white font-black text-sm shadow-sm">
                W
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Watch<span className="text-[#ee1d49]">.</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold"
            >
              Browse
            </Link>
          </div>
        </div>

        {/* Page Body */}
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-fadeIn">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-[#ee1d49]">
                <Heart className="w-7 h-7 fill-rose-500/20" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  My Watchlist
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  Saved movies and shows ready to stream synchronously with friends.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
                {watchlist.length} {watchlist.length === 1 ? 'title' : 'titles'} saved
              </span>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-md shadow-[#ee1d49]/25 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Browse Cinema</span>
              </Link>
            </div>
          </div>

          {/* Search Filter if list has items */}
          {watchlist.length > 0 && (
            <div className="max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved titles..."
                className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/10 text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#ee1d49]"
              />
            </div>
          )}

          {/* Watchlist Grid */}
          {watchlist.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/[0.06] text-center space-y-4 max-w-md mx-auto mt-12 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[#ee1d49] mx-auto">
                <Heart className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your Watchlist is Empty</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Browse movies, anime, and YouTube experiences from Cinema and tap the heart icon to save them for watch parties!
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#ee1d49]/30 transition active:scale-95"
              >
                <Film className="w-4 h-4" />
                <span>Explore Cinema Now</span>
              </Link>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-[#161020] text-center text-slate-400 text-sm">
              No saved titles match &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  className="group p-4 rounded-3xl border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-[#161020] transition-all flex flex-col justify-between space-y-3.5 shadow-xs hover:shadow-md hover:scale-[1.01]"
                >
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/60">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[9px] font-black shadow tracking-wider ${item.platformBadge || 'bg-rose-600 text-white'}`}>
                      {item.platform || 'CINEMA'}
                    </span>

                    {/* Remove from Watchlist */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveItem(item.id, e)}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/70 hover:bg-[#ee1d49] text-zinc-300 hover:text-white transition z-10 cursor-pointer shadow-md"
                      title="Remove from Watchlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#ee1d49] transition truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                      {item.tagline || item.category || 'Saved to Watchlist'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDirectCreateRoom(item.title, item.url)}
                      className="flex-1 py-2.5 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-md shadow-[#ee1d49]/25 transition flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isSubmitting ? 'Launching...' : 'Start Watch Party'}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Room Ready!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedRoomInfo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Your synchronized room for <span className="font-bold text-slate-900 dark:text-white">&quot;{createdRoomInfo.title}&quot;</span> has been created. Redirecting you now...
            </p>

            <div className="flex items-center space-x-2 p-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs">
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
                className="p-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-700 dark:text-zinc-200 hover:text-slate-900"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/room/${createdRoomInfo.slug}`)}
              className="w-full py-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
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
