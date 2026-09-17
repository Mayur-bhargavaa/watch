'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Plus,
  Copy,
  Check,
  Film,
  Menu,
  Sun,
  Moon,
  X,
  Play,
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  getUserRooms,
  createPartyRoom,
  UserSession
} from '../../lib/api';

export default function RoomsPage() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Room Creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomUrl, setNewRoomUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadRooms = async (token: string) => {
    try {
      setLoading(true);
      const userRooms = await getUserRooms(token);
      setRooms(userRooms || []);
    } catch (err) {
      console.error('Failed to load user rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      loadRooms(s.token);
    } else {
      router.push('/login?redirect=/rooms');
    }
  }, [router]);

  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session?.token) return;

    setIsSubmitting(true);
    try {
      const room = await createPartyRoom(session.token, {
        title: newRoomTitle.trim() || 'Watch Party Room',
        currentVideoUrl: newRoomUrl.trim() || ''
      });

      setShowCreateModal(false);
      setNewRoomTitle('');
      setNewRoomUrl('');
      router.push(`/room/${room.slug}`);
    } catch (err: any) {
      console.error('Failed to create room:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-x-hidden">
      {/* Centralized App Sidebar */}
      <AppSidebar
        activeNav="rooms"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile Header */}
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
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-xl bg-[#ee1d49] text-white text-xs font-bold shadow-sm"
            >
              + Room
            </button>
          </div>
        </div>

        {/* Page Body */}
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-fadeIn">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-[#ee1d49]">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  My Watch Rooms
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  Manage and re-enter your active and hosted watch party rooms.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
                {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} hosted
              </span>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-md shadow-[#ee1d49]/25 transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Room</span>
              </button>
            </div>
          </div>

          {/* Rooms Grid */}
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-[#ee1d49] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/[0.06] text-center space-y-4 max-w-md mx-auto mt-12 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[#ee1d49] mx-auto">
                <Film className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Rooms Created Yet</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Start a watch party room to stream YouTube, Netflix, or screen share in real-time with up to 6 friends.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#ee1d49]/30 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create My First Room</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="p-5 rounded-3xl bg-white dark:bg-[#161020] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 mb-2.5">
                      <span className="font-bold px-2.5 py-0.5 rounded-full bg-rose-600/15 text-[#ee1d49] border border-rose-600/30">
                        LIVE ROOM (MAX 6)
                      </span>
                      <span className="text-[11px]">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                      {r.title}
                    </h3>

                    <div className="flex items-center space-x-2 mt-2 text-xs text-slate-500 dark:text-zinc-400 font-mono">
                      <span>Code: {r.slug}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(r.slug)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-white transition cursor-pointer"
                        title="Copy share link"
                      >
                        {copiedSlug === r.slug ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => router.push(`/room/${r.slug}`)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold transition text-center shadow-md shadow-[#ee1d49]/25 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Enter Room</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/room/${r.slug}/recap`)}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Recap
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#161020] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-[#ee1d49]">
                  <Film className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Create Watch Room
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Room Title
                </label>
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="e.g. Cyberpunk Movie Night"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ee1d49]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Initial Video URL (Optional)
                </label>
                <input
                  type="text"
                  value={newRoomUrl}
                  onChange={(e) => setNewRoomUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ee1d49]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold shadow-md shadow-[#ee1d49]/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>{isSubmitting ? 'Creating...' : 'Create & Enter'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
