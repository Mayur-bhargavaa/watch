'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Bell,
  ChevronDown,
  Menu,
  Sun,
  Moon
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { useTheme } from '../../context/ThemeContext';
import { getStoredSession, UserSession, getFriendsWithStreaks } from '../../lib/api';
import { Plan, PlanType } from '../../types/plans';
import { getPlans, fetchPlansFromServer, deletePlan } from '../../lib/plansStore';
import { PlanCard } from '../../components/plans/PlanCard';
import { PlansSidebarWidgets } from '../../components/plans/PlansSidebarWidgets';
import { CreatePlanModal } from '../../components/plans/CreatePlanModal';
import {
  RealDataPlanningHub,
  RealMovieItem,
  RealGameItem,
  RealFriendItem
} from '../../components/plans/RealDataPlanningHub';

export default function PlansPage() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<RealFriendItem[]>([]);

  // Tabs: Upcoming | Calendar | Past
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'CALENDAR' | 'PAST'>('UPCOMING');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<any>(null);

  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      getFriendsWithStreaks(s.token)
        .then((res) => {
          if (res?.friends && Array.isArray(res.friends)) {
            setFriends(
              res.friends.map((f: any) => ({
                userId: f.friendUser.id,
                displayName: f.friendUser.displayName,
                avatarUrl: f.friendUser.avatarUrl,
                partnerCode: f.friendUser.partnerCode,
                streakCount: f.streak?.currentStreak || 0,
                isOnline: f.friendUser.isOnline
              }))
            );
          }
        })
        .catch(() => {});
    }
    // Load local seed / cached plans immediately
    setPlans(getPlans());
    setLoading(false);

    // Sync real plans from server API
    fetchPlansFromServer().then((synced) => {
      setPlans(synced || []);
    });
  }, []);

  const refreshPlans = () => {
    fetchPlansFromServer().then((synced) => {
      setPlans(synced || getPlans());
    });
  };

  const handleDeletePlan = (id: string) => {
    deletePlan(id);
    refreshPlans();
  };

  const handleSelectMovieToPlan = (movie: RealMovieItem) => {
    setModalInitialData({
      type: 'movie',
      emoji: '🍿',
      title: `${movie.title.split(':')[0]} Watch Party`,
      description: `Synchronized watch party for ${movie.title} with friends.`,
      activities: [
        {
          id: `act-${Date.now()}`,
          type: 'movie',
          time: '9:00 PM',
          title: movie.title,
          subtitle: `Duration: ${movie.duration}`,
          actionLabel: 'Enter Cinema',
          actionUrl: `/rooms?watch=${encodeURIComponent(movie.url)}`,
          movieDetails: {
            title: movie.title,
            duration: movie.duration,
            provider: 'youtube',
            posterUrl: movie.poster,
            sourceUrl: movie.url
          }
        }
      ]
    });
    setShowCreateModal(true);
  };

  const handleSelectGameToPlan = (game: RealGameItem) => {
    setModalInitialData({
      type: 'game',
      emoji: game.icon,
      title: `${game.title} Night`,
      description: `Multiplayer showdown playing ${game.title}!`,
      activities: [
        {
          id: `act-${Date.now()}`,
          type: 'game',
          time: '9:00 PM',
          title: game.title,
          subtitle: `${game.players} · Real-time Match`,
          actionLabel: 'Play Together',
          actionUrl: game.url,
          gameDetails: {
            gameId: game.gameId,
            title: game.title,
            icon: game.icon,
            players: game.players
          }
        }
      ]
    });
    setShowCreateModal(true);
  };

  const handleSelectFriendToPlan = (friend: RealFriendItem) => {
    setModalInitialData({
      type: 'hangout',
      emoji: '✨',
      title: `Hangout with ${friend.displayName}`,
      description: `Watch movies or play games together!`,
      invitedFriends: [friend.userId]
    });
    setShowCreateModal(true);
  };

  const handleOpenGeneralCreate = () => {
    setModalInitialData(null);
    setShowCreateModal(true);
  };

  // Filter calculations
  const upcomingPlans = plans.filter((p) => !p.isPast);
  const pastPlans = plans.filter((p) => p.isPast);

  const filteredPlans = upcomingPlans.filter((p) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'movie') return p.type === 'movie' || p.tagLabel?.toLowerCase().includes('movie');
    if (activeFilter === 'game') return p.type === 'game' || p.tagLabel?.toLowerCase().includes('game');
    if (activeFilter === 'birthday') return p.type === 'birthday' || p.tagLabel?.toLowerCase().includes('birthday');
    return true;
  });

  const counts = {
    all: upcomingPlans.length,
    movies: upcomingPlans.filter((p) => p.type === 'movie' || p.tagLabel?.toLowerCase().includes('movie')).length,
    games: upcomingPlans.filter((p) => p.type === 'game' || p.tagLabel?.toLowerCase().includes('game')).length,
    birthdays: upcomingPlans.filter((p) => p.type === 'birthday' || p.tagLabel?.toLowerCase().includes('birthday')).length
  };

  const currentUserName = session?.user?.displayName || 'Mayur';
  const currentUserAvatar =
    session?.user?.avatarUrl ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

  return (
    <div className="min-h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-x-hidden font-sans">
      {/* Centralized App Sidebar */}
      <AppSidebar
        activeNav="plans"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area - 100% Full Width */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto relative">
        {/* Subtle Sunset Hill Art Background (Top Right) matching screenshot */}
        <div className="absolute top-0 right-0 w-[550px] h-[340px] pointer-events-none opacity-40 dark:opacity-20 overflow-hidden z-0 select-none">
          <svg
            viewBox="0 0 600 350"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-cover object-right-top"
          >
            <circle cx="480" cy="120" r="60" fill="#fed7aa" opacity="0.6" />
            <path
              d="M200 350C280 260 380 220 600 240V350H200Z"
              fill="url(#hillGrad1)"
            />
            <path
              d="M340 350C420 200 500 180 600 190V350H340Z"
              fill="url(#hillGrad2)"
            />
            <defs>
              <linearGradient id="hillGrad1" x1="400" y1="220" x2="400" y2="350" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f472b6" stopOpacity="0.35" />
                <stop offset="1" stopColor="#fed7aa" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="hillGrad2" x1="480" y1="180" x2="480" y2="350" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fb7185" stopOpacity="0.25" />
                <stop offset="1" stopColor="#e2e8f0" stopOpacity="0.0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Mobile Top Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white/90 dark:bg-[#130e1b] backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              Plans
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-full bg-[#ff3b68] text-white text-xs font-bold shadow-md shadow-[#ff3b68]/30"
            >
              + Create Plan
            </button>
          </div>
        </div>

        {/* 100% Full Width Container */}
        <div className="w-full px-6 sm:px-10 lg:px-12 py-8 space-y-8 relative z-10">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative">
            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Plans
              </h1>
              <p className="text-sm md:text-base font-medium text-slate-500 dark:text-zinc-400">
                Things you're doing together.
              </p>
            </div>

            {/* Center Ambient Script: "Plan. Watch. Play. Together. ♡" */}
            <div className="hidden xl:block absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none select-none text-rose-400/80 dark:text-rose-400/60 font-serif italic text-base leading-snug">
              <div className="transform -rotate-6 space-y-0.5 text-center">
                <div className="text-sm tracking-wide">Plan.</div>
                <div className="text-base font-semibold tracking-wider">Watch.</div>
                <div className="text-lg font-bold">Play.</div>
                <div className="text-xl font-bold flex items-center justify-center gap-1">
                  <span>Together.</span>
                  <span className="text-sm">♡</span>
                </div>
              </div>
            </div>

            {/* Right Header: Notification Bell, Profile, + Create Plan */}
            <div className="flex items-center gap-4 self-end lg:self-auto">
              {/* Notification Bell */}
              <button
                type="button"
                className="relative p-2.5 rounded-full bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-300 shadow-xs hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#151022]" />
              </button>

              {/* Profile Pill */}
              <div className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/10 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10 transition">
                <img
                  src={currentUserAvatar}
                  alt={currentUserName}
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  {currentUserName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* + Create Plan Button */}
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ff3b68] to-[#ff577d] text-white text-xs font-black shadow-lg shadow-[#ff3b68]/30 hover:shadow-xl hover:shadow-[#ff3b68]/40 hover:brightness-105 active:scale-98 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Plan</span>
              </button>
            </div>
          </div>

          {/* Segmented Tabs: Upcoming (3) | Calendar | Past (1) */}
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-slate-200/60 dark:bg-white/[0.06] backdrop-blur-xs w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('UPCOMING')}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'UPCOMING'
                  ? 'bg-white dark:bg-[#1f1930] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span>Upcoming</span>
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none">
                {upcomingPlans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CALENDAR')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'CALENDAR'
                  ? 'bg-white dark:bg-[#1f1930] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Calendar
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PAST')}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'PAST'
                  ? 'bg-white dark:bg-[#1f1930] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <span>Past</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-300 dark:bg-white/20 text-slate-700 dark:text-zinc-200 text-[10px] font-bold leading-none">
                {pastPlans.length || 1}
              </span>
            </button>
          </div>

          {/* Main 2-Column Section (100% Full Width) */}
          <div className="flex flex-col lg:flex-row items-start gap-8 w-full">
            {/* Left Column: Stack of Plan Cards */}
            <div className="flex-1 min-w-0 w-full space-y-6">
              {activeTab === 'UPCOMING' && (
                <>
                  {upcomingPlans.length === 0 ? (
                    <RealDataPlanningHub
                      onSelectMovie={handleSelectMovieToPlan}
                      onSelectGame={handleSelectGameToPlan}
                      onSelectFriend={handleSelectFriendToPlan}
                      onOpenGeneralCreate={handleOpenGeneralCreate}
                      friends={friends}
                      userFriendCode={session?.user?.partnerCode}
                    />
                  ) : filteredPlans.length === 0 ? (
                    <div className="p-12 text-center rounded-[28px] bg-white dark:bg-[#151022] border border-dashed border-slate-200 dark:border-white/10 space-y-3">
                      <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                        No {activeFilter !== 'ALL' ? activeFilter.toLowerCase() : ''} plans found matching this filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveFilter('ALL')}
                        className="text-xs font-bold text-[#ff3b68] underline cursor-pointer"
                      >
                        Show All {upcomingPlans.length} Plans
                      </button>
                    </div>
                  ) : (
                    filteredPlans.map((plan, index) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        isPrimary={index === 0}
                        onDeletePlan={handleDeletePlan}
                      />
                    ))
                  )}
                </>
              )}

              {activeTab === 'CALENDAR' && (
                <div className="p-8 rounded-[28px] bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
                    Full Monthly Calendar
                  </h3>
                  <p className="text-xs text-slate-500 mb-6">
                    See upcoming movie streams, game tournaments, and birthdays across the month.
                  </p>
                  <PlansSidebarWidgets
                    activeFilter={activeFilter}
                    onSelectFilter={setActiveFilter}
                    counts={counts}
                  />
                </div>
              )}

              {activeTab === 'PAST' && (
                <div className="space-y-6">
                  {pastPlans.length === 0 ? (
                    <div className="p-12 text-center rounded-[28px] bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm space-y-2">
                      <div className="text-2xl">⏳</div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-white">
                        Past Plans Recorded
                      </h4>
                      <p className="text-xs text-slate-500">
                        Memories and session highlights from previous watch parties appear here.
                      </p>
                    </div>
                  ) : (
                    pastPlans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        onDeletePlan={handleDeletePlan}
                      />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Right Column: 3 Widgets (Calendar + Quick Filters + Cinema Card) */}
            <div className="w-full lg:w-[320px] xl:w-[350px] shrink-0">
              <PlansSidebarWidgets
                activeFilter={activeFilter}
                onSelectFilter={setActiveFilter}
                counts={counts}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Create Plan Modal */}
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setModalInitialData(null);
          refreshPlans();
        }}
        currentUserId={session?.user?.id || 'u1'}
        currentUserName={currentUserName}
        initialData={modalInitialData}
      />
    </div>
  );
}
