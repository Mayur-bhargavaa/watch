'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Share2,
  Check,
  Bell,
  Plus,
  Crown,
  X,
  Download,
  ExternalLink,
  CalendarCheck,
  UserPlus,
  LogOut,
  Trash2
} from 'lucide-react';
import { formatPlanDate, formatTime12, parseTimeOfDay, REMINDER_MINUTES } from '@synccinema/common';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { getStoredSession, UserSession, getFriendsWithStreaks } from '../../../lib/api';
import { Plan, PlanPreview, RSVPStatus, PlanActivity } from '../../../types/plans';
import {
  getPlan,
  updatePlan,
  deletePlan,
  leavePlan,
  rsvpPlan,
  joinPlan,
  invitePlanFriends,
  votePlan,
  addPlanVoteOption,
  confirmPlanVote,
  sendPlanChat,
  isPreview,
  planInviteLink
} from '../../../lib/plansApi';
import { buildIcs, googleCalendarUrl } from '../../../lib/planCalendar';
import { planIconName, localStartLabel, planBadgeLabel, safeActionUrl } from '../../../lib/planUi';
import { AppIcon } from '../../../components/ui/AppIcon';
import { PersonAvatar } from '../../../components/plans/PersonAvatar';
import { MembershipBadge } from '../../../components/membership/MembershipBadge';
import { CollaborativeVoting } from '../../../components/plans/CollaborativeVoting';
import { EventChat } from '../../../components/plans/EventChat';

const POLL_MS = 15000;

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = params?.id as string;
  const inviteToken = searchParams?.get('invite') || null;

  const [session, setSession] = useState<UserSession | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<'idle' | 'ok' | 'failed'>('idle');
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [confirming, setConfirming] = useState<'delete' | 'leave' | null>(null);
  const [joining, setJoining] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepType, setNewStepType] = useState<'movie' | 'game' | 'hangout'>('game');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepTime, setNewStepTime] = useState('');

  const [activeTab, setActiveTab] = useState<'schedule' | 'people' | 'chat'>('schedule');
  const [attendeesFilter, setAttendeesFilter] = useState<'ALL' | RSVPStatus>('ALL');
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserId = session?.user?.id || '';
  const currentUserName = session?.user?.displayName || '';
  const currentUserAvatar = session?.user?.avatarUrl;

  const showError = useCallback((err: unknown) => {
    setActionError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setActionError(null), 6000);
  }, []);

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    try {
      const result = await getPlan(planId, inviteToken);
      if (isPreview(result)) {
        setPreview(result);
        setPlan(null);
      } else {
        setPlan(result);
        setPreview(null);
      }
      setNotFound(false);
      setLoadError(null);
    } catch (err) {
      if ((err as { status?: number }).status === 404) setNotFound(true);
      else setLoadError(err instanceof Error ? err.message : 'Could not load this plan');
    } finally {
      setLoading(false);
    }
  }, [planId, inviteToken]);

  useEffect(() => {
    const s = getStoredSession();
    if (!s?.user || s.user.isAnonymous) {
      const back = `/plans/${planId}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`;
      router.replace(`/login?redirect=${encodeURIComponent(back)}`);
      return;
    }
    setSession(s);
    getFriendsWithStreaks(s.token)
      .then((res) => {
        if (res?.friends && Array.isArray(res.friends)) setAvailableFriends(res.friends.map((f: any) => f.friendUser));
      })
      .catch((err) => console.warn('[plan] could not load friends:', err));
    void loadPlan();
  }, [planId, inviteToken, router, loadPlan]);

  // Live-ish updates (friends' RSVPs, chat) only while the tab is visible and the user is a member
  useEffect(() => {
    if (!plan) return;
    const tick = () => {
      if (!document.hidden) void loadPlan();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [plan?.id, loadPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs a server action, applies the returned plan, and shows the server's message when it fails. */
  const perform = async (action: () => Promise<Plan | void>) => {
    try {
      const updated = await action();
      if (updated) setPlan(updated);
    } catch (err) {
      showError(err);
      void loadPlan(); // show the truth, not what the user tried
    }
  };

  const isHost = Boolean(plan) && plan!.hostId === currentUserId;
  const myParticipant = plan?.participants.find((p) => p.userId === currentUserId);
  const myStatus: RSVPStatus | undefined = myParticipant?.status;

  const handleRSVP = (status: RSVPStatus) => {
    if (!plan || status === 'INVITED') return;
    return perform(() => rsvpPlan(plan.id, status));
  };
  const handleVote = (optionId: string) => perform(() => votePlan(plan!.id, optionId));
  const handleConfirmSelection = (optionId: string) => perform(() => confirmPlanVote(plan!.id, optionId));
  const handleAddVotingOption = (title: string) => perform(() => addPlanVoteOption(plan!.id, title));

  const handleSendMessage = async (text: string) => {
    if (!plan) return;
    try {
      const message = await sendPlanChat(plan.id, text);
      setPlan((prev) => (prev ? { ...prev, chatMessages: [...(prev.chatMessages || []), message] } : prev));
    } catch (err) {
      showError(err);
    }
  };

  const handleShare = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(planInviteLink(plan));
      setCopiedLink('ok');
    } catch {
      setCopiedLink('failed');
    }
    setTimeout(() => setCopiedLink('idle'), 2500);
  };

  const handleJoin = async () => {
    if (!preview || !inviteToken) return;
    setJoining(true);
    try {
      const joined = await joinPlan(preview.id, inviteToken);
      setPlan(joined);
      setPreview(null);
      router.replace(`/plans/${joined.id}`); // drop the token from the address bar
    } catch (err) {
      showError(err);
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteOrLeave = async () => {
    if (!plan || !confirming) return;
    try {
      if (confirming === 'delete') await deletePlan(plan.id);
      else await leavePlan(plan.id);
      router.push('/plans');
    } catch (err) {
      showError(err);
      setConfirming(null);
    }
  };

  const handleDownloadICS = () => {
    if (!plan) return;
    const ics = buildIcs(plan, `${window.location.origin}/plans/${plan.id}`);
    if (!ics) {
      showError(new Error('This plan has no valid date/time to export.'));
      return;
    }
    const url = window.URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${plan.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getGoogleCalendarUrl = () => (plan ? googleCalendarUrl(plan, `${window.location.origin}/plans/${plan.id}`) || '#' : '#');

  const handleInviteFriend = async (friend: { id: string; displayName: string }) => {
    if (!plan) return;
    try {
      const res = await invitePlanFriends(plan.id, [friend.id]);
      setPlan(res.plan);
      setInviteFeedback(`Invited ${friend.displayName}`);
    } catch (err) {
      showError(err);
    }
    setTimeout(() => setInviteFeedback(null), 2500);
  };

  const handleAddStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !newStepTitle.trim()) return;
    if (newStepTime && parseTimeOfDay(newStepTime) === null) {
      showError(new Error('Pick a valid time for this step.'));
      return;
    }
    const newActivity: PlanActivity = {
      id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: newStepType,
      time: newStepTime ? formatTime12(newStepTime) : plan.time,
      title: newStepTitle.trim(),
      actionLabel: newStepType === 'movie' ? 'Enter Cinema' : newStepType === 'game' ? 'Play Together' : 'Join Chat',
      actionUrl: newStepType === 'game' ? '/games/ludo' : '/rooms'
    };
    await perform(() => updatePlan(plan.id, { activities: [...plan.activities, newActivity] }));
    setShowAddStepModal(false);
    setNewStepTitle('');
    setNewStepTime('');
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-x-hidden">
      <AppSidebar activeNav="plans" isMobileOpen={isMobileSidebarOpen} onMobileClose={() => setIsMobileSidebarOpen(false)} />
      <main className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-center space-y-4 text-center">{children}</main>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#ee1d49] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (preview) {
    return shell(
      <div className="w-full max-w-md rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
        <div><AppIcon name={planIconName(preview)} className="w-12 h-12 text-[#ee1d49]" /></div>
        <h2 className="text-xl font-black">{preview.title}</h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {preview.hostName} invited you · {formatPlanDate(preview.date)}, {preview.time} ({preview.timezone.split(' ')[0]}) · {preview.participantCount} people
        </p>
        {actionError && <p role="alert" className="text-xs font-semibold text-rose-500">{actionError}</p>}
        {preview.isPast ? (
          <p className="text-sm font-semibold text-slate-500">This plan is already over.</p>
        ) : (
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joining || !inviteToken}
            className="w-full py-3 rounded-2xl bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-sm font-black disabled:opacity-60 cursor-pointer"
          >
            {joining ? 'Joining…' : 'Join this plan'}
          </button>
        )}
        <Link href="/plans" className="block text-xs font-bold text-slate-400 hover:text-slate-600">Not now</Link>
      </div>
    );
  }

  if (!plan) {
    return shell(
      <>
        <div><AppIcon name={loadError ? 'warning' : 'search'} className="w-10 h-10 text-slate-400" /></div>
        <h2 className="text-xl font-bold">{loadError ? 'Could not load this plan' : notFound ? 'Plan not found' : 'Plan unavailable'}</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          {loadError || 'It may have been removed, or you were not invited. Ask the host for an invite link.'}
        </p>
        <div className="flex gap-2">
          {loadError && (
            <button type="button" onClick={() => { setLoading(true); void loadPlan(); }} className="px-5 py-2.5 rounded-2xl bg-slate-200 dark:bg-white/10 text-xs font-bold cursor-pointer">
              Try again
            </button>
          )}
          <Link href="/plans" className="px-5 py-2.5 rounded-2xl bg-[#ee1d49] text-white text-xs font-bold">
            Back to Plans
          </Link>
        </div>
      </>
    );
  }

  const viewerTime = localStartLabel(plan);
  const reminderText =
    plan.reminder && plan.reminder !== 'none'
      ? `${REMINDER_MINUTES[plan.reminder] >= 1440 ? '1 day' : REMINDER_MINUTES[plan.reminder] >= 60 ? '1 hour' : '30 minutes'} before it starts`
      : null;

  const counts = {
    ALL: plan.participants.length,
    GOING: plan.participants.filter((p) => p.status === 'GOING').length,
    MAYBE: plan.participants.filter((p) => p.status === 'MAYBE').length,
    INVITED: plan.participants.filter((p) => p.status === 'INVITED').length,
    CANT_GO: plan.participants.filter((p) => p.status === 'CANT_GO').length
  };
  const statusPill = (status: RSVPStatus) =>
    status === 'GOING'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
      : status === 'MAYBE'
      ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
      : status === 'INVITED'
      ? 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-300'
      : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400';
  const statusLabel = (status: RSVPStatus) => (status === 'GOING' ? 'Going' : status === 'MAYBE' ? 'Maybe' : status === 'INVITED' ? 'No reply yet' : "Can't go");
  const hostName = plan.participants.find((p) => p.isHost)?.displayName || 'The host';
  const rsvpOptions: { status: Exclude<RSVPStatus, 'INVITED'>; label: string; on: string }[] = [
    { status: 'GOING', label: 'Going', on: 'bg-emerald-500 text-white' },
    { status: 'MAYBE', label: 'Maybe', on: 'bg-amber-500 text-white' },
    { status: 'CANT_GO', label: "Can't go", on: 'bg-rose-500 text-white' }
  ];

  return (
    <div className="h-screen bg-slate-50 dark:bg-[#0d0a14] text-slate-900 dark:text-white flex overflow-hidden">
      <AppSidebar activeNav="plans" isMobileOpen={isMobileSidebarOpen} onMobileClose={() => setIsMobileSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white/80 dark:bg-[#130e1b]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-white/5 sticky top-0 z-30 shrink-0">
          <Link href="/plans" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:text-[#ee1d49] transition">
            <ChevronLeft className="w-4 h-4" />
            <span>Plans</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold transition cursor-pointer"
            >
              {copiedLink === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink === 'ok' ? 'Link copied' : copiedLink === 'failed' ? 'Copy failed' : 'Share'}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                aria-label="More options"
                onClick={() => {
                  setShowMenu(!showMenu);
                  setConfirming(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-zinc-400 transition cursor-pointer text-xs"
              >
                •••
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-white dark:bg-[#1c162b] border border-slate-200 dark:border-white/10 shadow-xl py-1.5 z-40">
                  {confirming ? (
                    <div className="px-3.5 py-2.5 space-y-2.5">
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                        {confirming === 'delete' ? 'Delete this plan for everyone? This cannot be undone.' : 'Leave this plan?'}
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void handleDeleteOrLeave()} className="flex-1 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold cursor-pointer">
                          {confirming === 'delete' ? 'Delete' : 'Leave'}
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isHost ? (
                    <button type="button" onClick={() => setConfirming('delete')} className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" /> Delete plan
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirming('leave')} className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-2.5 cursor-pointer">
                      <LogOut className="w-3.5 h-3.5" /> Leave plan
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {actionError && (
          <div role="alert" className="w-full mt-4 px-4 sm:px-8">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-300">{actionError}</div>
          </div>
        )}

        <div className="w-full px-4 sm:px-8 py-6 space-y-6">
          {/* Title block */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ee1d49] to-[#7c2d92] flex items-center justify-center shrink-0 select-none"><AppIcon name={planIconName(plan)} className="w-7 h-7 text-white" /></div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold uppercase tracking-wider">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-zinc-300">{planBadgeLabel(plan)}</span>
                {isHost && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                    <Crown className="w-3 h-3" /> You&apos;re the host
                  </span>
                )}
                {plan.isPast && <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/15 text-slate-600 dark:text-zinc-200">Finished</span>}
                {plan.recurring && plan.recurring !== 'none' && <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-zinc-300"><AppIcon name="repeat" className="inline w-[1em] h-[1em] align-[-0.125em]" /> {plan.recurring}</span>}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">{plan.title}</h1>
              <p className="text-sm text-slate-600 dark:text-zinc-300">
                {formatPlanDate(plan.date)} · {plan.time}
                {plan.endTime ? ` – ${plan.endTime}` : ''} <span className="text-slate-400">({plan.timezone})</span>
              </p>
              {viewerTime && !plan.isPast && <p className="text-xs text-slate-400 dark:text-zinc-500">Your time: {viewerTime}</p>}
              {plan.description && <p className="text-sm text-slate-500 dark:text-zinc-400 pt-1 whitespace-pre-line">{plan.description}</p>}
            </div>
          </div>

          {/* Answer + quick actions */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 rounded-2xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08]">
            {!plan.isPast ? (
              <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-white/[0.07]">
                {rsvpOptions.map((o) => (
                  <button
                    key={o.status}
                    type="button"
                    onClick={() => void handleRSVP(o.status)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${myStatus === o.status ? o.on : 'text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-500">This plan is over.</span>
            )}
            {!plan.isPast && myStatus === 'INVITED' && <span className="text-xs text-slate-500 dark:text-zinc-400">Let {hostName} know if you&apos;re coming.</span>}

            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {isHost && !plan.isPast && (
                <button type="button" onClick={() => setShowInviteModal(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold transition cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Invite
                </button>
              )}
              <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold transition">
                <CalendarCheck className="w-3.5 h-3.5 text-[#ee1d49]" /> Google Calendar
              </a>
              <button type="button" onClick={handleDownloadICS} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold transition cursor-pointer">
                <Download className="w-3.5 h-3.5" /> .ics
              </button>
            </div>
          </div>
          {reminderText && !plan.isPast && (
            <p className="-mt-3 text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Reminder {reminderText}
            </p>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-200 dark:border-white/10">
            {(
              [
                ['schedule', 'Schedule', null],
                ['people', 'People', plan.participants.length],
                ['chat', 'Chat', plan.chatMessages?.length || null]
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
                {label} {count ? <span className="ml-1 text-xs font-semibold text-slate-400">{count}</span> : null}
              </button>
            ))}
          </div>

          {activeTab === 'schedule' && (
            <div className="space-y-5">
              {plan.activities.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                  {isHost ? 'No steps yet. Add a movie, a game or a hangout.' : 'The host has not added any steps yet.'}
                </p>
              ) : (
                <ol className="space-y-2">
                  {plan.activities.map((act, index) => (
                    <li key={act.id} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08]">
                      <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-500 dark:text-zinc-300 flex items-center justify-center shrink-0">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{act.title}</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                          {[act.time, act.subtitle || act.type].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <Link href={safeActionUrl(act.actionUrl)} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-[#ee1d49] hover:text-white text-xs font-bold transition">
                        <span>{act.actionLabel || 'Open'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {isHost && !plan.isPast && (
                <button type="button" onClick={() => setShowAddStepModal(true)} className="inline-flex items-center gap-1 text-xs font-bold text-[#ee1d49] hover:underline cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Add a step
                </button>
              )}

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
                  onConfirmSelection={isHost ? handleConfirmSelection : undefined}
                  onAddOption={handleAddVotingOption}
                />
              )}
            </div>
          )}

          {activeTab === 'people' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ['ALL', 'All'],
                    ['GOING', 'Going'],
                    ['MAYBE', 'Maybe'],
                    ['INVITED', 'No reply'],
                    ['CANT_GO', "Can't go"]
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAttendeesFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                      attendeesFilter === key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {label} <span className="opacity-60">{counts[key]}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {plan.participants
                  .filter((p) => attendeesFilter === 'ALL' || p.status === attendeesFilter)
                  .map((p) => (
                    <div key={p.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08]">
                      <PersonAvatar name={p.displayName} src={p.avatarUrl} className="w-9 h-9" />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{p.displayName}</span>
                        {(p.membershipTier === 'plus' || p.membershipTier === 'creator') && <MembershipBadge tier={p.membershipTier} />}
                        {p.isHost && <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase shrink-0">Host</span>}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${statusPill(p.status)}`}>{statusLabel(p.status)}</span>
                    </div>
                  ))}
              </div>
              {isHost && !plan.isPast && (
                <button type="button" onClick={() => setShowInviteModal(true)} className="inline-flex items-center gap-1 text-xs font-bold text-[#ee1d49] hover:underline cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5" /> Invite more friends
                </button>
              )}
              {!isHost && (
                <button type="button" onClick={() => void handleShare()} className="inline-flex items-center gap-1 text-xs font-bold text-[#ee1d49] hover:underline cursor-pointer">
                  <Share2 className="w-3.5 h-3.5" /> {copiedLink === 'ok' ? 'Link copied' : 'Copy invite link'}
                </button>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <EventChat messages={plan.chatMessages || []} currentUserId={currentUserId} currentUserName={currentUserName} currentUserAvatar={currentUserAvatar} onSendMessage={handleSendMessage} />
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
              Share the invite link, or send an in-app invite to your friends on Watch. They get a notification and answer Going / Maybe / Can't go.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-600 dark:text-zinc-300 truncate">
                {planInviteLink(plan)}
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shrink-0 cursor-pointer"
              >
                {copiedLink === 'ok' ? 'Copied!' : copiedLink === 'failed' ? 'Failed' : 'Copy'}
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
                          <PersonAvatar name={f.displayName} src={f.avatarUrl} className="w-8 h-8" />
                          <span className="text-xs font-bold truncate text-slate-900 dark:text-white">
                            {f.displayName}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyInvited}
                          onClick={() => void handleInviteFriend(f)}
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

            {inviteFeedback && <p role="status" className="text-xs font-semibold text-emerald-600">{inviteFeedback}</p>}
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white text-xs font-bold shadow-md shadow-[#ee1d49]/30 cursor-pointer"
            >
              Done
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
                    <AppIcon name="movie" className="inline w-[1em] h-[1em] align-[-0.125em]" /> Movie
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
                    <AppIcon name="game" className="inline w-[1em] h-[1em] align-[-0.125em]" /> Game
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
                    <AppIcon name="coffee" className="inline w-[1em] h-[1em] align-[-0.125em]" /> Hangout
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
                  type="time"
                  value={newStepTime}
                  onChange={(e) => setNewStepTime(e.target.value)}
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
