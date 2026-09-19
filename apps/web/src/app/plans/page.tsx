'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Plus,
  Sparkles,
  Menu,
  Sun,
  Moon,
  Clock,
  Filter,
  Film,
  Gamepad2,
  PartyPopper,
  Flame,
  ArrowRight
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { useTheme } from '../../context/ThemeContext';
import { getStoredSession, UserSession } from '../../lib/api';
import { Plan, PlanType } from '../../types/plans';
import { getPlans, fetchPlansFromServer } from '../../lib/plansStore';
import { PlanCard } from '../../components/plans/PlanCard';
import { CalendarView } from '../../components/plans/CalendarView';
import { CreatePlanModal } from '../../components/plans/CreatePlanModal';

export default function PlansPage() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // View tabs
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'CALENDAR' | 'PAST'>('UPCOMING');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PlanType>('ALL');

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    }
    // Load local plans immediately
    setPlans(getPlans());
    setLoading(false);

    // Sync with real backend server
    fetchPlansFromServer().then((synced) => {
      if (synced && synced.length > 0) {
        setPlans(synced);
      }
    });
  }, []);

  const refreshPlans = () => {
    fetchPlansFromServer().then((synced) => {
      setPlans(synced || getPlans());
    });
  };

  // Filtered plans
  const upcomingPlans = plans.filter((p) => !p.isPast);
  const pastPlans = plans.filter((p) => p.isPast);

  const displayUpcoming = upcomingPlans.filter((p) => {
    if (categoryFilter === 'ALL') return true;
    return p.type === categoryFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-x-hidden">
      {/* Centralized App Sidebar */}
      <AppSidebar
        activeNav="plans"
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
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white text-xs font-bold shadow-sm"
            >
              + Plan
            </button>
          </div>
        </div>

        {/* Desktop Container */}
        <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-8 md:py-10 space-y-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-[#ee1d49] text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shared Experiences</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Plans
              </h1>
              <p className="text-sm md:text-base font-semibold text-slate-500 dark:text-zinc-400">
                Things you're doing together.
              </p>
            </div>

            {/* Create Plan CTA */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#ee1d49] via-[#ff3b68] to-[#ff577d] text-white font-black text-sm shadow-lg shadow-[#ee1d49]/25 hover:shadow-xl hover:shadow-[#ee1d49]/35 hover:brightness-105 transition-all duration-200 active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Plan</span>
              </button>
            </div>
          </div>

          {/* Segmented View Switcher: Upcoming | Calendar | Past */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/70 dark:bg-white/[0.06] backdrop-blur-sm self-start">
              <button
                type="button"
                onClick={() => setActiveTab('UPCOMING')}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'UPCOMING'
                    ? 'bg-white dark:bg-[#1f1930] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Upcoming ({upcomingPlans.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CALENDAR')}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'CALENDAR'
                    ? 'bg-white dark:bg-[#1f1930] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Calendar
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PAST')}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'PAST'
                    ? 'bg-white dark:bg-[#1f1930] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Past ({pastPlans.length})
              </button>
            </div>

            {/* Sub-filters for Upcoming */}
            {activeTab === 'UPCOMING' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold text-slate-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'hover:bg-slate-200/60 dark:hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('movie')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'movie'
                      ? 'bg-rose-500 text-white'
                      : 'hover:bg-slate-200/60 dark:hover:bg-white/10'
                  }`}
                >
                  <span>🎬</span>
                  <span>Movies</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('game')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'game'
                      ? 'bg-violet-600 text-white'
                      : 'hover:bg-slate-200/60 dark:hover:bg-white/10'
                  }`}
                >
                  <span>🎮</span>
                  <span>Games</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('birthday')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'birthday'
                      ? 'bg-amber-500 text-white'
                      : 'hover:bg-slate-200/60 dark:hover:bg-white/10'
                  }`}
                >
                  <span>🎂</span>
                  <span>Birthdays</span>
                </button>
              </div>
            )}
          </div>

          {/* MAIN TAB CONTENT */}
          {activeTab === 'UPCOMING' && (
            <div className="space-y-4">
              {displayUpcoming.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#151022] border border-dashed border-slate-200 dark:border-white/10 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 flex items-center justify-center text-3xl">
                    🍿
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      No upcoming plans found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                      Plan a movie night, multiplayer gaming session, or birthday party with your friends.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#ee1d49] text-white text-xs font-bold shadow-md shadow-[#ee1d49]/30 hover:brightness-110 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Your First Plan</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayUpcoming.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CALENDAR VIEW */}
          {activeTab === 'CALENDAR' && (
            <div>
              <CalendarView plans={plans} />
            </div>
          )}

          {/* PAST PLANS */}
          {activeTab === 'PAST' && (
            <div className="space-y-4">
              {pastPlans.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#151022] border border-dashed border-slate-200 dark:border-white/10 space-y-2 text-slate-400">
                  <Clock className="w-10 h-10 mx-auto opacity-30" />
                  <p className="font-semibold text-sm">No past plans recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4 opacity-90">
                  {pastPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Plan Modal */}
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          refreshPlans();
        }}
        currentUserId={session?.user?.id || 'u1'}
        currentUserName={session?.user?.displayName || 'Mayur Bhargava'}
      />
    </div>
  );
}
