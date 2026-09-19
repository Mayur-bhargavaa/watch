'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Calendar,
  Clock,
  Globe,
  Share2,
  Check,
  Bell,
  Sparkles,
  Users,
  Menu,
  Sun,
  Moon,
  Plus,
  Play,
  Film,
  Gamepad2,
  MessageCircle,
  Crown,
  X
} from 'lucide-react';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { useTheme } from '../../../context/ThemeContext';
import { getStoredSession, UserSession, getApiPlanById } from '../../../lib/api';
import { Plan, RSVPStatus, PlanActivity } from '../../../types/plans';
import {
  getPlanById,
  updatePlan,
  updateRSVP,
  voteOption,
  addPlanChatMessage
} from '../../../lib/plansStore';
import { ActivityTimeline } from '../../../components/plans/ActivityTimeline';
import { CollaborativeVoting } from '../../../components/plans/CollaborativeVoting';
import { ParticipantList } from '../../../components/plans/ParticipantList';
import { EventChat } from '../../../components/plans/EventChat';

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params?.id as string;

  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  // Add Step modal
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepType, setNewStepType] = useState<'movie' | 'game' | 'hangout'>('game');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepTime, setNewStepTime] = useState('11:00 PM');

  const currentUserId = session?.user?.id || 'u1';
  const currentUserName = session?.user?.displayName || 'Mayur Bhargava';
  const currentUserAvatar = session?.user?.avatarUrl;

  const loadCurrentPlan = () => {
    if (!planId) return;
    const found = getPlanById(planId);
    if (found) {
      setPlan(found);
      setLoading(false);
    }
    // Also fetch from real server API
    getApiPlanById(planId)
      .then((res) => {
        if (res?.plan) {
          setPlan(res.plan);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!found) setLoading(false);
      });
  };

  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    }
    loadCurrentPlan();
  }, [planId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#ee1d49] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-x-hidden">
        <AppSidebar activeNav="plans" />
        <main className="flex-1 p-8 flex flex-col items-center justify-center space-y-4">
          <div className="text-4xl">🔍</div>
          <h2 className="text-xl font-bold">Plan Not Found</h2>
          <p className="text-xs text-slate-500">This plan may have been removed or link is invalid.</p>
          <Link
            href="/plans"
            className="px-5 py-2.5 rounded-2xl bg-[#ee1d49] text-white text-xs font-bold"
          >
            Back to Plans
          </Link>
        </main>
      </div>
    );
  }

  const isHost = plan.participants.some((p) => p.userId === currentUserId && p.isHost);
  const myParticipant = plan.participants.find((p) => p.userId === currentUserId);
  const myStatus = myParticipant?.status || 'GOING';

  const handleRSVP = (status: RSVPStatus) => {
    updateRSVP(plan.id, currentUserId, status, currentUserName, currentUserAvatar);
    loadCurrentPlan();
  };

  const handleVote = (optionId: string) => {
    voteOption(plan.id, optionId, currentUserId);
    loadCurrentPlan();
  };

  const handleConfirmSelection = (optionId: string) => {
    if (!plan.voting) return;
    const option = plan.voting.options.find((o) => o.id === optionId);
    if (!option) return;

    const updatedVoting = {
      ...plan.voting,
      isClosed: true,
      confirmedTitle: option.title
    };

    updatePlan(plan.id, { voting: updatedVoting });
    loadCurrentPlan();
  };

  const handleAddVotingOption = (title: string) => {
    if (!plan.voting) return;
    const newOpt = {
      id: `opt-${Date.now()}`,
      title,
      type: plan.voting.type,
      votes: [currentUserId]
    };
    const updatedVoting = {
      ...plan.voting,
      options: [...plan.voting.options, newOpt]
    };
    updatePlan(plan.id, { voting: updatedVoting });
    loadCurrentPlan();
  };

  const handleSendMessage = (text: string) => {
    addPlanChatMessage(plan.id, {
      userId: currentUserId,
      displayName: currentUserName,
      avatarUrl: currentUserAvatar,
      text
    });
    loadCurrentPlan();
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleAddStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim()) return;

    const newActivity: PlanActivity = {
      id: `act-${Date.now()}`,
      type: newStepType,
      time: newStepTime || '11:00 PM',
      title: newStepTitle.trim(),
      actionLabel:
        newStepType === 'movie'
          ? 'Enter Cinema'
          : newStepType === 'game'
          ? 'Play Together'
          : 'Join Chat',
      actionUrl:
        newStepType === 'movie'
          ? '/rooms'
          : newStepType === 'game'
          ? '/games/ludo'
          : '/rooms'
    };

    const updatedActivities = [...plan.activities, newActivity];
    updatePlan(plan.id, { activities: updatedActivities });
    setShowAddStepModal(false);
    setNewStepTitle('');
    loadCurrentPlan();
  };

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
            <Link href="/plans" className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300">
              <ChevronLeft className="w-4 h-4" />
              <span>Plans</span>
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
              onClick={handleShare}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-200 text-xs font-bold"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Container */}
        <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
          {/* Breadcrumb back */}
          <div>
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Plans</span>
            </Link>
          </div>

          {/* Hero Card */}
          <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-white via-white to-rose-50/30 dark:from-[#151022] dark:via-[#151022] dark:to-[#22132e] border border-slate-200/80 dark:border-white/[0.08] shadow-sm relative overflow-hidden">
            {/* Soft Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#ee1d49]/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.08] dark:to-white/[0.02] border border-slate-200 dark:border-white/10 flex items-center justify-center text-4xl shadow-inner">
                  {plan.emoji || '✨'}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#ee1d49]/10 text-[#ee1d49] border border-[#ee1d49]/20">
                      {plan.type}
                    </span>
                    {isHost && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" />
                        You are Host
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {plan.title}
                  </h1>

                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-zinc-300 flex-wrap">
                    <span className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                      <Calendar className="w-4 h-4 text-[#ee1d49]" />
                      {plan.dateFormatted}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {plan.time} {plan.endTime ? `– ${plan.endTime}` : ''} ({plan.timezone})
                    </span>
                    {plan.reminder && plan.reminder !== 'none' && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Bell className="w-3.5 h-3.5" />
                          Reminder: {plan.reminder}
                        </span>
                      </>
                    )}
                  </div>

                  {plan.description && (
                    <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 max-w-xl">
                      {plan.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons & RSVP */}
              <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-3 shrink-0">
                {/* RSVP control */}
                <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-white/[0.08] border border-slate-200/60 dark:border-white/10 gap-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => handleRSVP('GOING')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      myStatus === 'GOING'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Going
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRSVP('MAYBE')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      myStatus === 'MAYBE'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Maybe
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRSVP('CANT_GO')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      myStatus === 'CANT_GO'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Can't Go
                  </button>
                </div>

                {/* Share link & Invite buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Share Invite</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ee1d49] text-white text-xs font-bold shadow-md shadow-[#ee1d49]/20 hover:brightness-110 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Invite Friends</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layout: Left (Timeline + Voting) vs Right (Attendees + Chat) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column (2 Cols) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Activity Timeline (Visual Centerpiece) */}
              <ActivityTimeline
                activities={plan.activities}
                planTitle={plan.title}
                isHost={isHost}
                onAddActivity={() => setShowAddStepModal(true)}
              />

              {/* Collaborative Voting (if applicable) */}
              {plan.voting && (
                <CollaborativeVoting
                  question={plan.voting.question}
                  type={plan.voting.type}
                  options={plan.voting.options}
                  currentUserId={currentUserId}
                  isClosed={plan.voting.isClosed}
                  confirmedTitle={plan.voting.confirmedTitle}
                  isHost={isHost}
                  onVote={handleVote}
                  onConfirmSelection={handleConfirmSelection}
                  onAddOption={handleAddVotingOption}
                />
              )}
            </div>

            {/* Right Column (1 Col) */}
            <div className="space-y-6">
              {/* Attendees List */}
              <ParticipantList
                participants={plan.participants}
                currentUserId={currentUserId}
                onInviteClick={() => setShowInviteModal(true)}
                onUpdateRSVP={handleRSVP}
              />

              {/* Event Chat */}
              <EventChat
                messages={plan.chatMessages || []}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151022] border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Invite Friends to Plan
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Share the plan link or send an in-app invite directly to your friends on Watch.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-600 dark:text-zinc-300 truncate">
                {typeof window !== 'undefined' ? window.location.href : `/plans/${plan.id}`}
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shrink-0"
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setInviteFeedback('Invites sent to your friends on Watch!');
                setTimeout(() => {
                  setInviteFeedback(null);
                  setShowInviteModal(false);
                }, 1500);
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white text-xs font-bold shadow-md shadow-[#ee1d49]/30"
            >
              {inviteFeedback || 'Notify All Friends On Watch'}
            </button>
          </div>
        </div>
      )}

      {/* Add Step Modal (for host) */}
      {showAddStepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151022] border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Add Step to Schedule
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStepModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStepSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Step Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStepType('movie')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      newStepType === 'movie'
                        ? 'border-[#ee1d49] bg-[#ee1d49]/10 text-[#ee1d49]'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    🎬 Movie
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStepType('game')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      newStepType === 'game'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-500'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    🎮 Game
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStepType('hangout')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      newStepType === 'hangout'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    ☕ Hangout
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newStepTitle}
                  onChange={(e) => setNewStepTitle(e.target.value)}
                  placeholder="e.g. Four in a Row Quick Match"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Time
                </label>
                <input
                  type="text"
                  value={newStepTime}
                  onChange={(e) => setNewStepTime(e.target.value)}
                  placeholder="11:30 PM"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStepModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newStepTitle.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#ee1d49] text-white disabled:opacity-50"
                >
                  Add Step
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
