'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, X } from 'lucide-react';
import { formatPlanDate, getPlanWindow } from '@synccinema/common';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { AppHeader } from '../../components/layout/AppHeader';
import { getStoredSession, UserSession, getFriendsWithStreaks } from '../../lib/api';
import { Plan } from '../../types/plans';
import { listPlans, deletePlan, leavePlan, LEGACY_PLANS_KEY } from '../../lib/plansApi';
import { countPlans, matchesFilter } from '../../lib/planUi';
import { PlanCard } from '../../components/plans/PlanCard';
import { PlansCalendar } from '../../components/plans/PlansSidebarWidgets';
import { CreatePlanModal } from '../../components/plans/CreatePlanModal';
import {
  RealDataPlanningHub,
  RealMovieItem,
  RealGameItem,
  RealFriendItem
} from '../../components/plans/RealDataPlanningHub';

const startOf = (p: Plan) => getPlanWindow(p)?.startMs ?? 0;

export default function PlansPage() {
  const router = useRouter();

  const [session, setSession] = useState<UserSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [friends, setFriends] = useState<RealFriendItem[]>([]);

  // Tabs: Upcoming | Calendar | Past
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<any>(null);

  const refreshPlans = useCallback(async () => {
    try {
      setPlans(await listPlans());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_PLANS_KEY); // older versions kept a shared, unsynced copy of plans here
    } catch {}
    const s = getStoredSession();
    if (!s?.user || s.user.isAnonymous) {
      router.replace(`/login?redirect=${encodeURIComponent('/plans')}`);
      return;
    }
    setSession(s);
    setAuthChecked(true);
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
      .catch((err) => console.warn('[plans] could not load friends:', err));
    void refreshPlans();
  }, [router, refreshPlans]);

  // Pick up changes made by friends (RSVPs, invitations) when the user comes back to the tab
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void refreshPlans();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshPlans]);

  const handleDeletePlan = async (id: string) => {
    await deletePlan(id); // throws with the server's message; the card shows it
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  const handleLeavePlan = async (id: string) => {
    await leavePlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSelectMovieToPlan = (movie: RealMovieItem) => {
    setModalInitialData({
      type: 'movie',
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
          gameDetails: { gameId: game.gameId, title: game.title, icon: game.icon, players: game.players }
        }
      ]
    });
    setShowCreateModal(true);
  };

  const handleSelectFriendToPlan = (friend: RealFriendItem) => {
    setModalInitialData({
      type: 'hangout',
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

  // Upcoming: soonest first. Past: most recent first. "Past" is computed by the server from the date/time.
  const upcomingPlans = useMemo(() => plans.filter((p) => !p.isPast).sort((a, b) => startOf(a) - startOf(b)), [plans]);
  const pastPlans = useMemo(() => plans.filter((p) => p.isPast).sort((a, b) => startOf(b) - startOf(a)), [plans]);

  const applyView = (list: Plan[]) => list.filter((p) => matchesFilter(p, activeFilter) && (!selectedDate || p.date === selectedDate));
  const filteredUpcoming = applyView(upcomingPlans);
  const filteredPast = applyView(pastPlans);

  const counts = countPlans(upcomingPlans);
  const currentUserId = session?.user?.id;

  const clearFilters = () => {
    setActiveFilter('ALL');
    setSelectedDate(null);
  };

  const renderCards = (list: Plan[]) =>
    list.map((plan, index) => (
      <PlanCard
        key={plan.id}
        plan={plan}
        currentUserId={currentUserId}
        isPrimary={index === 0 && !plan.isPast}
        onDeletePlan={handleDeletePlan}
        onLeavePlan={handleLeavePlan}
      />
    ));

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#ee1d49] border-t-transparent animate-spin" />
      </div>
    );
  }

  const chips: [string, string, number][] = [
    ['ALL', 'All', counts.all],
    ['movie', 'Movies', counts.movies],
    ['game', 'Games', counts.games],
    ['birthday', 'Birthdays', counts.birthdays],
    ['other', 'Other', counts.other]
  ];
  const activeList = activeTab === 'UPCOMING' ? filteredUpcoming : filteredPast;
  const totalInTab = activeTab === 'UPCOMING' ? upcomingPlans.length : pastPlans.length;

  return (
    <div className="h-screen bg-[#fcfaf9] dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-hidden font-sans">
      <AppSidebar activeNav="plans" isMobileOpen={isMobileSidebarOpen} onMobileClose={() => setIsMobileSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-5">
        <AppHeader onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} onCreateRoom={handleOpenGeneralCreate} />

        <div className="w-full space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Plans</h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">Things you&apos;re doing together.</p>
            </div>
            <button
              type="button"
              onClick={handleOpenGeneralCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New plan</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-200 dark:border-white/10">
            {(
              [
                ['UPCOMING', 'Upcoming', upcomingPlans.length],
                ['PAST', 'Past', pastPlans.length]
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`pb-2.5 -mb-px text-sm font-bold border-b-2 transition cursor-pointer ${
                  activeTab === key ? 'border-[#ee1d49] text-slate-900 dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
              >
                {label} {count > 0 && <span className="ml-1 text-xs font-semibold text-slate-400">{count}</span>}
              </button>
            ))}
          </div>

          {loadError && (
            <div role="alert" className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs">
              <span className="font-semibold text-rose-700 dark:text-rose-300">Could not load your plans: {loadError}</span>
              <button type="button" onClick={() => void refreshPlans()} className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-300 underline cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row items-start gap-6">
            <div className="flex-1 min-w-0 w-full space-y-3">
              {/* Filter chips + active date */}
              <div className="flex items-center gap-2 flex-wrap">
                {chips.map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                      activeFilter === key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {label} <span className="opacity-60">{count}</span>
                  </button>
                ))}
                {selectedDate && (
                  <button type="button" onClick={() => setSelectedDate(null)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-[#ee1d49] cursor-pointer">
                    {formatPlanDate(selectedDate)} <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="p-12 flex justify-center">
                  <div className="w-7 h-7 rounded-full border-2 border-[#ee1d49] border-t-transparent animate-spin" />
                </div>
              ) : activeTab === 'UPCOMING' && upcomingPlans.length === 0 ? (
                <RealDataPlanningHub
                  onSelectMovie={handleSelectMovieToPlan}
                  onSelectGame={handleSelectGameToPlan}
                  onSelectFriend={handleSelectFriendToPlan}
                  onOpenGeneralCreate={handleOpenGeneralCreate}
                  friends={friends}
                  userFriendCode={session?.user?.partnerCode}
                />
              ) : activeTab === 'PAST' && pastPlans.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-sm text-slate-500">
                  Plans appear here once their date and time have passed.
                </div>
              ) : activeList.length === 0 && totalInTab > 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 space-y-2">
                  <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Nothing matches {selectedDate ? `${formatPlanDate(selectedDate)}` : 'this filter'}.</p>
                  <button type="button" onClick={clearFilters} className="text-xs font-bold text-[#ee1d49] underline cursor-pointer">
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">{renderCards(activeList)}</div>
              )}
            </div>

            <aside className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-4">
              <PlansCalendar plans={plans} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </aside>
          </div>
        </div>
      </main>

      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setModalInitialData(null);
          void refreshPlans();
        }}
        initialData={modalInitialData}
      />
    </div>
  );
}
