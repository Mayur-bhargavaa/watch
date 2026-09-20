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
  X,
  Download,
  ExternalLink,
  CalendarCheck,
  UserPlus,
  Send,
  MessageSquare
} from 'lucide-react';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { useTheme } from '../../../context/ThemeContext';
import {
  getStoredSession,
  UserSession,
  getApiPlanById,
  getFriendsWithStreaks
} from '../../../lib/api';
import { Plan, RSVPStatus, PlanActivity } from '../../../types/plans';
import {
  getPlanById,
  updatePlan,
  updateRSVP,
  voteOption,
  addPlanChatMessage,
  inviteParticipant
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
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  // Add Step modal
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepType, setNewStepType] = useState<'movie' | 'game' | 'hangout'>('game');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepTime, setNewStepTime] = useState('11:00 PM');

  const [activeTab, setActiveTab] = useState<'schedule' | 'about' | 'attendees' | 'chat'>('schedule');
  const [attendeesFilter, setAttendeesFilter] = useState<'ALL' | RSVPStatus>('ALL');

  const currentUserId = session?.user?.id || 'usr_hN35KGS9RX';
  const currentUserName = session?.user?.displayName || 'Mayur Bhargava';
  const currentUserAvatar = session?.user?.avatarUrl;

  const loadCurrentPlan = async () => {
    if (!planId) return;
    const found = getPlanById(planId);
    if (found) {
      setPlan(found);
      setLoading(false);
    }
    try {
      const res = await getApiPlanById(planId);
      if (res?.plan) {
        setPlan(res.plan);
        setLoading(false);
      }
    } catch {
      if (!found) setLoading(false);
    }
  };

  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      getFriendsWithStreaks(s.token)
        .then((res) => {
          if (res?.friends && Array.isArray(res.friends)) {
            setAvailableFriends(res.friends.map((f: any) => f.friendUser));
          }
        })
        .catch(() => {});
    }
    loadCurrentPlan();

    // Auto poll real event data every 5s so friends' live RSVPs and chat messages appear in real-time
    const interval = setInterval(() => {
      if (planId) {
        getApiPlanById(planId)
          .then((res) => {
            if (res?.plan) {
              setPlan(res.plan);
            }
          })
          .catch(() => {});
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [planId]);

  const handleDownloadICS = () => {
    if (!plan) return;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StitchByte//Watch Plans//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:plan-${plan.id}@stitchbyte.in`,
      'DTSTAMP:20260920T120000Z',
      'DTSTART:20260927T153000Z',
      'DTEND:20260927T190000Z',
      `SUMMARY:${plan.title}`,
      `DESCRIPTION:${plan.description || ''} - Join: ${typeof window !== 'undefined' ? window.location.href : ''}`,
      'LOCATION:Online Watch Party',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${plan.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getGoogleCalendarUrl = () => {
    const startStr = '20260927T153000Z';
    const endStr = '20260927T190000Z';
    const title = encodeURIComponent(plan?.title || 'Watch Party');
    const details = encodeURIComponent(
      `${plan?.description || ''}\n\nJoin live: ${typeof window !== 'undefined' ? window.location.href : ''}`
    );
    const location = encodeURIComponent('Watch App · StitchByte (Online)');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
  };

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

  const handleRSVP = async (status: RSVPStatus) => {
    updateRSVP(plan.id, currentUserId, status, currentUserName, currentUserAvatar);
    loadCurrentPlan();
  };

  const handleVote = async (optionId: string) => {
    voteOption(plan.id, optionId, currentUserId);
    loadCurrentPlan();
  };

  const handleConfirmSelection = async (optionId: string) => {
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

  const handleAddVotingOption = async (title: string) => {
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

  const handleSendMessage = async (text: string) => {
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
    <div className="h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-hidden">
      {/* Centralized App Sidebar - Fixed in place */}
      <AppSidebar
        activeNav="plans"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Top Header Bar matching screenshot */}
        <header className="flex items-center justify-between px-6 md:px-10 py-4 bg-white/80 dark:bg-[#130e1b]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-white/5 sticky top-0 z-30 shrink-0">
          <div className="flex items-center space-x-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-200 hover:text-rose-500 dark:hover:text-rose-400 transition group"
            >
              <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Plans</span>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            {/* Notification Bell with red dot */}
            <div className="relative">
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute 1 top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#ee1d49] ring-2 ring-white dark:ring-[#130e1b]" />
              </button>
            </div>

            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer shadow-xs"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>

            {/* More options button */}
            <button
              type="button"
              className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer text-xs"
            >
              •••
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* Hero Card */}
          <div className="rounded-3xl p-6 md:p-8 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-3xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-4xl shadow-inner">
                  {plan.emoji || '🍿'}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-rose-50 text-[#ff2a5f] dark:bg-[#ff2a5f]/15 border border-rose-200/60 dark:border-[#ff2a5f]/30">
                      {plan.type}
                    </span>
                    {isHost && (
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30 flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        YOU ARE HOST
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

              {/* Action Buttons & RSVP matching screenshot */}
              <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
                {/* RSVP control */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRSVP('GOING')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      myStatus === 'GOING'
                        ? 'bg-[#ff2a5f]/10 border-[#ff2a5f]/30 text-[#ff2a5f] shadow-xs'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-[#ff2a5f]" />
                    <span>Going</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRSVP('MAYBE')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      myStatus === 'MAYBE'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Maybe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRSVP('CANT_GO')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      myStatus === 'CANT_GO'
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span>Can't Go</span>
                  </button>
                </div>

                {/* Share link & Big Pink Invite Friends button */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{copiedLink ? 'Copied Link!' : 'Share Invite'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#ff2a5f] hover:bg-[#ee1d49] text-white text-xs font-black shadow-md shadow-[#ff2a5f]/25 hover:brightness-105 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Invite Friends</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs matching screenshot media_1789897511705.png */}
          <div className="flex items-center gap-8 border-b border-slate-200/80 dark:border-white/10 px-2">
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`pb-3 text-sm transition cursor-pointer border-b-2 font-bold ${
                activeTab === 'schedule'
                  ? 'border-[#ff2a5f] text-[#ff2a5f] font-black'
                  : 'border-transparent text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`pb-3 text-sm transition cursor-pointer border-b-2 font-bold ${
                activeTab === 'about'
                  ? 'border-[#ff2a5f] text-[#ff2a5f] font-black'
                  : 'border-transparent text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendees')}
              className={`pb-3 text-sm transition cursor-pointer border-b-2 font-bold ${
                activeTab === 'attendees'
                  ? 'border-[#ff2a5f] text-[#ff2a5f] font-black'
                  : 'border-transparent text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Attendees
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`pb-3 text-sm transition cursor-pointer border-b-2 font-bold ${
                activeTab === 'chat'
                  ? 'border-[#ff2a5f] text-[#ff2a5f] font-black'
                  : 'border-transparent text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Chat
            </button>
          </div>

          {/* TAB 1: SCHEDULE VIEW (matches default 2-column layout) */}
          {activeTab === 'schedule' && (
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
          )}

          {/* TAB 2: ABOUT VIEW */}
          {activeTab === 'about' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Details (2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Description & Overview */}
                <div className="rounded-3xl p-6 md:p-8 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    About This Plan
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                    {plan.description ||
                      'Join our synchronized watch session and competitive game night with live banter, voice chat, and synchronized playback!'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Date & Time
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {plan.dateFormatted} · {plan.time} {plan.endTime ? `– ${plan.endTime}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Timezone: {plan.timezone} (Indian Standard Time)
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Reminder Status
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Bell className="w-4 h-4 text-[#ff2a5f]" />
                        {plan.reminder && plan.reminder !== 'none'
                          ? `Alert set for ${plan.reminder} prior`
                          : 'No reminder set'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Syncs with mobile push & browser notifications
                      </p>
                    </div>
                  </div>
                </div>

                {/* Activities Breakdown */}
                <div className="rounded-3xl p-6 md:p-8 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Program Schedule
                  </h3>
                  <div className="space-y-3">
                    {plan.activities.map((act, index) => (
                      <div
                        key={act.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-[#ff2a5f]/10 text-[#ff2a5f] font-black text-xs flex items-center justify-center">
                            #{index + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {act.title}
                            </h4>
                            <p className="text-xs text-slate-400">
                              {act.time} · {act.subtitle || act.type}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={act.actionUrl || '/rooms'}
                          className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-white/10 hover:border-[#ff2a5f] hover:text-[#ff2a5f] transition inline-flex items-center gap-1.5"
                        >
                          <span>{act.actionLabel || 'Enter'}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Details (1 Col) */}
              <div className="space-y-6">
                {/* Host Card */}
                <div className="rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">
                    Host & Organizer
                  </h4>
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        plan.participants.find((p) => p.isHost)?.avatarUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                      }
                      alt="Host"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-[#ff2a5f]/30"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {plan.participants.find((p) => p.isHost)?.displayName || 'Mayur Bhargava'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#fff8ee] dark:bg-amber-500/10 text-[#f59e0b] dark:text-amber-400 border border-[#fed7aa] dark:border-amber-500/30 text-[10px] font-black uppercase">
                          HOST
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Event Creator & Stream Director</p>
                    </div>
                  </div>
                </div>

                {/* Calendar Sync */}
                <div className="rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">
                    Add to Calendar
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Export event to your personal calendar to never miss when the party starts.
                  </p>

                  <div className="space-y-2 pt-1">
                    <a
                      href={getGoogleCalendarUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition"
                    >
                      <CalendarCheck className="w-4 h-4 text-[#ff2a5f]" />
                      <span>Add to Google Calendar</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleDownloadICS}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-500" />
                      <span>Download .ICS File</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ATTENDEES VIEW */}
          {activeTab === 'attendees' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Attendees Card (2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-3xl p-6 md:p-8 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        Guest Roster & RSVPs
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {plan.participants.length} friends invited to this watch session
                      </p>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/5">
                      {(['ALL', 'GOING', 'MAYBE', 'CANT_GO'] as const).map((status) => {
                        const count =
                          status === 'ALL'
                            ? plan.participants.length
                            : plan.participants.filter((p) => p.status === status).length;
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setAttendeesFilter(status)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              attendeesFilter === status
                                ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                            }`}
                          >
                            {status === 'ALL'
                              ? `All (${count})`
                              : status === 'GOING'
                              ? `Going (${count})`
                              : status === 'MAYBE'
                              ? `Maybe (${count})`
                              : `Can't Go (${count})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attendees List matching media_1789897511706.png */}
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {plan.participants
                      .filter((p) => (attendeesFilter === 'ALL' ? true : p.status === attendeesFilter))
                      .map((p) => (
                        <div
                          key={p.userId}
                          className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={
                                p.avatarUrl ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                              }
                              alt={p.displayName}
                              className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-slate-200/80 dark:ring-white/10 shadow-xs"
                            />
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                {p.displayName}
                              </span>
                              {p.isHost && (
                                <span className="px-2.5 py-0.5 rounded-full bg-[#fff8ee] dark:bg-amber-500/10 text-[#f59e0b] dark:text-amber-400 border border-[#fed7aa] dark:border-amber-500/30 text-[11px] font-black tracking-wider uppercase inline-flex items-center shrink-0">
                                  HOST
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-4 py-1.5 rounded-full font-bold text-xs shrink-0 ${
                              p.status === 'GOING'
                                ? 'bg-[#eafaf1] text-[#10b981] dark:bg-emerald-500/15 dark:text-emerald-400'
                                : p.status === 'MAYBE'
                                ? 'bg-[#fef9c3] text-[#ca8a04] dark:bg-amber-500/15 dark:text-amber-400'
                                : 'bg-[#fee2e2] text-[#ef4444] dark:bg-rose-500/15 dark:text-rose-400'
                            }`}
                          >
                            {p.status === 'GOING' ? 'Going' : p.status === 'MAYBE' ? 'Maybe' : "Can't Go"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Sidebar Action: Invite & Your Status (1 Col) */}
              <div className="space-y-6">
                <div className="rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">
                    Your Response
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRSVP('GOING')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        myStatus === 'GOING'
                          ? 'bg-[#10b981]/15 border-[#10b981]/30 text-[#10b981]'
                          : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Going
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRSVP('MAYBE')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        myStatus === 'MAYBE'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                          : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Maybe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRSVP('CANT_GO')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        myStatus === 'CANT_GO'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                          : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Can't Go
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">
                    Invite More Friends
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Have friends who want to watch Interstellar or play Ludo? Send them an invite link.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="w-full py-3 rounded-2xl bg-[#ff2a5f] hover:bg-[#ee1d49] text-white text-xs font-black shadow-md shadow-[#ff2a5f]/25 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Invite Friends</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHAT VIEW */}
          {activeTab === 'chat' && (
            <div className="rounded-3xl p-6 md:p-8 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
              <EventChat
                messages={plan.chatMessages || []}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
                onSendMessage={handleSendMessage}
              />
            </div>
          )}
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
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shrink-0 cursor-pointer"
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Direct Friend Invite List */}
            {availableFriends.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Invite Friends
                </span>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {availableFriends.map((f) => {
                    const alreadyInvited = plan.participants.some((p) => p.userId === f.id);
                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={
                              f.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                            }
                            alt={f.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold truncate text-slate-900 dark:text-white">
                            {f.displayName}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyInvited}
                          onClick={() => {
                            inviteParticipant(plan.id, {
                              userId: f.id,
                              displayName: f.displayName,
                              avatarUrl: f.avatarUrl,
                              status: 'GOING'
                            });
                            loadCurrentPlan();
                            setInviteFeedback(`Invited ${f.displayName}!`);
                            setTimeout(() => setInviteFeedback(null), 2000);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            alreadyInvited
                              ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-default'
                              : 'bg-[#ff2a5f] hover:bg-[#ee1d49] text-white cursor-pointer'
                          }`}
                        >
                          {alreadyInvited ? 'Invited' : 'Invite'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setInviteFeedback('Invites sent to your friends on Watch!');
                setTimeout(() => {
                  setInviteFeedback(null);
                  setShowInviteModal(false);
                }, 1500);
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white text-xs font-bold shadow-md shadow-[#ee1d49]/30 cursor-pointer"
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
