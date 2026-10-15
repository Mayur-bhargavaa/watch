'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  X,
  Plus,
  Trash2,
  Gamepad2,
  MessageCircle,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  Bell,
  Play
} from 'lucide-react';
import { PlanType, PlanActivity } from '../../types/plans';
import { PLAN_TIMEZONES, formatTime12, toTimeInputValue, todayDateString, isPlanPast, isValidPlanDate, parseTimeOfDay } from '@synccinema/common';
import { createPlan } from '../../lib/plansApi';
import { guessTimezoneLabel, inferStepKind } from '../../lib/planUi';
import { AppIcon, IconName } from '../ui/AppIcon';
import { PersonAvatar } from './PersonAvatar';
import { getFriendsWithStreaks, getUserPartner, getStoredSession } from '../../lib/api';
import { MembershipBadge } from '../membership/MembershipBadge';
import { useMyMembership } from '../membership/useMyMembership';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    type?: PlanType;
    title?: string;
    description?: string;
    activities?: PlanActivity[];
    invitedFriends?: string[];
    date?: string;
    time?: string;
  } | null;
}

// REAL Curated YouTube & Cinema titles
const POPULAR_MOVIES = [
  {
    title: 'Interstellar: 4K IMAX',
    duration: '2h 49m',
    poster: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E'
  },
  {
    title: 'Tears of Steel: 4K Cyberpunk',
    duration: '12m',
    poster: 'https://img.youtube.com/vi/R6MlUcmOul8/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=R6MlUcmOul8'
  },
  {
    title: 'Cyberpunk 2077: Phantom Liberty',
    duration: '1h 15m',
    poster: 'https://img.youtube.com/vi/qIcTM8WXFjk/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=qIcTM8WXFjk'
  },
  {
    title: 'Lofi Girl: Chill Lounge Beats',
    duration: 'Live Stream',
    poster: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk'
  }
];

// Preset game catalog
const GAME_CATALOG = [
  {
    gameId: 'ludo',
    title: 'Ludo Party',
    icon: 'dice',
    players: '2-4 Players',
    url: '/games/ludo'
  },
  {
    gameId: 'four-in-a-row',
    title: 'Four in a Row',
    icon: 'dot',
    players: '2 Players',
    url: '/games/four-in-a-row'
  },
  {
    gameId: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    icon: 'close',
    players: '2 Players',
    url: '/games/tic-tac-toe'
  },
  {
    gameId: 'bingo',
    title: 'Bingo Duel',
    icon: 'target',
    players: '2 Players',
    url: '/games/bingo'
  },
  {
    gameId: 'tambola',
    title: 'Tambola',
    icon: 'ticket',
    players: '2-20 Players',
    url: '/games/tambola'
  },
  {
    gameId: 'doodle-duel',
    title: 'Doodle Duel',
    icon: 'palette',
    players: '2 Players',
    url: '/games/doodle-duel'
  }
];

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

const OCCASIONS: { type: PlanType; label: string; icon: IconName; title: string }[] = [
  { type: 'movie', label: 'Movie Night', icon: 'movie', title: 'Movie Night' },
  { type: 'game', label: 'Game Night', icon: 'game', title: 'Game Night' },
  { type: 'birthday', label: 'Birthday', icon: 'cake', title: 'Birthday Bash' },
  { type: 'anniversary', label: 'Anniversary', icon: 'heart', title: 'Anniversary Watch Night' },
  { type: 'party', label: 'Party', icon: 'party', title: 'Group Party' },
  { type: 'hangout', label: 'Hangout', icon: 'coffee', title: 'Hangout' },
  { type: 'custom', label: 'Custom Event', icon: 'sparkles', title: 'Special Gathering' }
];

const FIELD = 'w-full px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white';

export const CreatePlanModal: React.FC<CreatePlanModalProps> = ({ isOpen, onClose, initialData = null }) => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const myMembership = useMyMembership();

  // Form state (a fresh form every time the dialog opens: it used to keep the previous plan's values)
  const [planType, setPlanType] = useState<PlanType>('movie');
  const [title, setTitle] = useState('');
  const lastDefaultTitle = useRef('');
  const occasionPicked = useRef(false); // true once the user clicks an occasion in step 1
  const [occasion, setOccasion] = useState<PlanType | null>(null);
  const [date, setDate] = useState(todayDateString());
  const [time, setTime] = useState('20:00'); // HH:MM from <input type="time">; sent as "8:00 PM"
  const [endTime, setEndTime] = useState('');
  const [timezone, setTimezone] = useState('UTC (UTC+0)');
  const [description, setDescription] = useState('');
  const [reminder, setReminder] = useState<'30m' | '1h' | '1d' | 'none'>('30m');
  const [recurring, setRecurring] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [activities, setActivities] = useState<PlanActivity[]>([]);

  const [showCustomMovieModal, setShowCustomMovieModal] = useState(false);
  const [customMovieTitle, setCustomMovieTitle] = useState('');
  const [customMovieUrl, setCustomMovieUrl] = useState('');

  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);

  // Reset, then apply any prefill (declared before the prefill effect so it runs first)
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setFormError(null);
    setSubmitting(false);
    setPlanType('movie');
    setTitle('');
    lastDefaultTitle.current = '';
    setDate(todayDateString());
    setTime('20:00');
    setEndTime('');
    setTimezone(guessTimezoneLabel());
    setDescription('');
    setReminder('30m');
    setRecurring('none');
    setActivities([]);
    setInvitedFriends([]);
    setShowCustomMovieModal(false);
    occasionPicked.current = false;
    setOccasion(null);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.type) setPlanType(initialData.type);
      if (initialData.title) setTitle(initialData.title);
      if (initialData.description !== undefined) setDescription(initialData.description);
      if (initialData.activities && initialData.activities.length > 0) {
        setActivities(initialData.activities.map((a) => ({ ...a, id: newId('act') })));
      }
      if (initialData.date) setDate(initialData.date);
      if (initialData.time) setTime(toTimeInputValue(initialData.time) || '20:00');
    }
  }, [isOpen, initialData]);

  // Connected friends and partner from the server (only people you can actually invite)
  useEffect(() => {
    if (!isOpen) return;
    const session = getStoredSession();
    if (!session?.token) {
      setFriendsList([]);
      return;
    }
    Promise.all([
      getFriendsWithStreaks(session.token).catch(() => ({ friends: [] })),
      getUserPartner(session.token).catch(() => ({ partner: null }))
    ])
      .then(([friendsRes, partnerRes]) => {
        const connected: any[] = [];
        const seen = new Set<string>();
        if (partnerRes?.partner && partnerRes.partner.id) {
          seen.add(partnerRes.partner.id);
          connected.push({
            userId: partnerRes.partner.id,
            displayName: `${partnerRes.partner.displayName} (Partner)`,
            avatarUrl: partnerRes.partner.avatarUrl,
            partnerCode: partnerRes.partner.partnerCode,
            isOnline: partnerRes.partner.online
          });
        }
        if (friendsRes?.friends && Array.isArray(friendsRes.friends)) {
          friendsRes.friends.forEach((f: any) => {
            if (f.friendUser?.id && !seen.has(f.friendUser.id)) {
              seen.add(f.friendUser.id);
              connected.push({
                userId: f.friendUser.id,
                displayName: f.friendUser.displayName,
                avatarUrl: f.friendUser.avatarUrl,
                partnerCode: f.friendUser.partnerCode,
                isOnline: f.friendUser.isOnline
              });
            }
          });
        }
        setFriendsList(connected);
        const wanted = initialData?.invitedFriends || [];
        setInvitedFriends(wanted.filter((id) => connected.some((c) => c.userId === id)));
      })
      .catch((err) => {
        console.warn('[plans] could not load friends:', err);
        setFriendsList([]);
      });
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Type change helper
  const handleSelectType = (type: PlanType, defaultTitle: string) => {
    occasionPicked.current = true;
    setOccasion(type);
    setPlanType(type);
    // only replace the title while the user has not typed their own
    if (!title.trim() || title === lastDefaultTitle.current) {
      setTitle(defaultTitle);
      lastDefaultTitle.current = defaultTitle;
    }
  };

  const startLabel = formatTime12(time) || '8:00 PM';

  // Add activity helpers
  const handleAddMovieActivity = (movie: typeof POPULAR_MOVIES[0]) => {
    const newAct: PlanActivity = {
      id: newId('act'),
      type: 'movie',
      time: startLabel,
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
    };
    setActivities([...activities, newAct]);
  };

  const handleAddCustomMovie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMovieTitle.trim()) return;

    const url = customMovieUrl.trim();
    if (url && !/^https:\/\//i.test(url)) {
      setFormError('Video links must start with https://');
      return;
    }
    setFormError(null);
    let poster: string | undefined;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const match = url.match(/(?:youtu\.be\/|v=|\/v\/|embed\/)([\w-]{11})/);
      if (match && match[1]) {
        poster = `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
      }
    }

    const newAct: PlanActivity = {
      id: newId('act'),
      type: 'movie',
      time: startLabel,
      title: customMovieTitle.trim(),
      subtitle: url ? 'Custom Video Source' : 'Cinema Stream',
      actionLabel: 'Enter Cinema',
      actionUrl: url ? `/rooms?watch=${encodeURIComponent(url)}` : '/rooms',
      movieDetails: {
        title: customMovieTitle.trim(),
        duration: 'Custom',
        provider: url.includes('youtube') ? 'youtube' : 'direct',
        posterUrl: poster,
        sourceUrl: url || undefined
      }
    };

    setActivities([...activities, newAct]);
    setCustomMovieTitle('');
    setCustomMovieUrl('');
    setShowCustomMovieModal(false);
  };

  const handleAddGameActivity = (game: typeof GAME_CATALOG[0]) => {
    const newAct: PlanActivity = {
      id: newId('act'),
      type: 'game',
      time: startLabel,
      title: game.title,
      subtitle: `${game.players} · Match`,
      actionLabel: 'Play Together',
      actionUrl: game.url,
      gameDetails: {
        gameId: game.gameId,
        title: game.title,
        icon: game.icon,
        players: game.players
      }
    };
    setActivities([...activities, newAct]);
  };

  const handleAddHangoutActivity = () => {
    const newAct: PlanActivity = {
      id: newId('act'),
      type: 'hangout',
      time: startLabel,
      title: 'Hangout',
      subtitle: 'Voice & text hangout',
      actionLabel: 'Join Chat',
      actionUrl: '/rooms'
    };
    setActivities([...activities, newAct]);
  };

  const handleRemoveActivity = (id: string) => {
    setActivities(activities.filter((a) => a.id !== id));
  };

  const toggleInviteFriend = (userId: string) => {
    if (invitedFriends.includes(userId)) {
      setInvitedFriends(invitedFriends.filter((id) => id !== userId));
    } else {
      setInvitedFriends([...invitedFriends, userId]);
    }
  };

  /** First problem with the form, or null. Shown in the dialog instead of silently creating a bad plan. */
  const validate = (): string | null => {
    if (!title.trim()) return 'Give your plan a title.';
    if (!isValidPlanDate(date)) return 'Pick a date.';
    if (parseTimeOfDay(time) === null) return 'Pick a start time.';
    const startLabelText = formatTime12(time);
    if (endTime && parseTimeOfDay(endTime) === null) return 'The end time is not valid.';
    if (isPlanPast({ date, time: startLabelText, endTime: endTime ? formatTime12(endTime) : '', timezone })) {
      return 'That date and time has already passed. Pick one in the future.';
    }
    return null;
  };

  const goNext = () => {
    if (step === 3) {
      const problem = validate();
      if (problem) {
        setFormError(problem);
        return;
      }
    }
    setFormError(null);
    setStep((step + 1) as 1 | 2 | 3 | 4);
  };

  const handleCreateSubmit = async () => {
    const problem = validate();
    if (problem) {
      setFormError(problem);
      setStep(3);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setUpgradeNeeded(false);
    try {
      // The server builds the id, host, participants and welcome message; invited friends are notified there.
      // If no occasion was chosen, a plan made only of games (or only movies) is labelled as such
      const inferred = occasionPicked.current ? null : inferStepKind(activities);
      const finalType = inferred ?? planType;
      const plan = await createPlan({
        title: title.trim(),
        type: finalType,
        date,
        time: formatTime12(time),
        endTime: endTime ? formatTime12(endTime) : undefined,
        timezone,
        description: description.trim() || undefined,
        reminder,
        recurring,
        activities,
        invitedUserIds: invitedFriends
      });
      onClose();
      router.push(`/plans/${plan.id}`);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setUpgradeNeeded(code === 'UPGRADE_REQUIRED' || code === 'PLAN_LIMIT_REACHED');
      setFormError(err instanceof Error ? err.message : 'Could not create the plan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden my-auto sm:my-8 max-h-[92vh] flex flex-col">
        {/* Header: title, step name, thin progress bar */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">New plan</h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Step {step} of 4 · {step === 1 ? 'Occasion' : step === 2 ? 'Steps' : step === 3 ? 'Details' : 'Invite'}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-1 px-4 sm:px-5 pb-3">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-[#ee1d49]' : 'bg-slate-200 dark:bg-white/10'}`} />
            ))}
          </div>
          <div className="border-b border-slate-100 dark:border-white/[0.06]" />
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {/* STEP 1: occasion (optional) */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">What are you planning?</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Pick one, or just continue and add steps next.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OCCASIONS.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleSelectType(item.type, item.title)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border transition cursor-pointer ${
                      occasion === item.type
                        ? 'border-[#ee1d49] bg-[#ee1d49]/5 dark:bg-[#ee1d49]/10'
                        : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/[0.02]'
                    }`}
                  >
                    <AppIcon name={item.icon} className="w-5 h-5 shrink-0 text-[#ee1d49]" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Multi-Activity Sequence Builder */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Steps</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Add what you will do, in order. You can skip this and add steps later.
                </p>
              </div>

              {/* Current Activity Stack */}
              <div className="space-y-3">
                {activities.map((act, index) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center shadow-xs shrink-0">
                        <AppIcon name={act.type === 'movie' ? 'movie' : act.type === 'game' ? 'game' : 'coffee'} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {act.time} — {act.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {act.subtitle || act.actionLabel}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveActivity(act.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Popular Curated Videos */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Movies</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomMovieModal(true)}
                    className="text-[11px] text-[#ee1d49] hover:underline font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Custom URL</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_MOVIES.map((movie) => (
                    <button
                      key={movie.title}
                      type="button"
                      onClick={() => handleAddMovieActivity(movie)}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 hover:border-[#ee1d49] transition text-left flex items-center gap-2.5 group"
                    >
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-xs"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#ee1d49]">
                          {movie.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {movie.duration}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Game / Hangout row */}
              <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Games and hangouts
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddGameActivity(GAME_CATALOG[0])}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-violet-500 transition text-xs font-bold flex items-center gap-2"
                  >
                    <Gamepad2 className="w-4 h-4 text-violet-400" />
                    <span>Ludo Party</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddGameActivity(GAME_CATALOG[3])}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-rose-500 transition text-xs font-bold flex items-center gap-2"
                  >
                    <Gamepad2 className="w-4 h-4 text-rose-400" />
                    <span>Bingo Duel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddGameActivity(GAME_CATALOG[1])}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-violet-500 transition text-xs font-bold flex items-center gap-2"
                  >
                    <Gamepad2 className="w-4 h-4 text-violet-400" />
                    <span>Four in a Row</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddHangoutActivity}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-emerald-500 transition text-xs font-bold flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Late Hangout</span>
                  </button>
                </div>
              </div>

              {/* Custom Movie Modal */}
              {showCustomMovieModal && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Add Custom Video / YouTube
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomMovieModal(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customMovieTitle}
                    onChange={(e) => setCustomMovieTitle(e.target.value)}
                    placeholder="Video / Movie Title"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={customMovieUrl}
                    onChange={(e) => setCustomMovieUrl(e.target.value)}
                    placeholder="YouTube URL or MP4 URL (e.g. https://www.youtube.com/watch?v=...)"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomMovieModal(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomMovie}
                      disabled={!customMovieTitle.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#ee1d49] text-white disabled:opacity-50"
                    >
                      Add to Sequence
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Event Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Details</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  When is it, and who should know?
                </p>
              </div>

              {/* Title */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Plan Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Friday Movie Night"
                    maxLength={120}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-[#ee1d49]"
                  />
                </div>
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={todayDateString()}
                    required
                    onChange={(e) => setDate(e.target.value)}
                    className={FIELD}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Start Time
                  </label>
                  <input type="time" value={time} required onChange={(e) => setTime(e.target.value)} className={FIELD} />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    End Time <span className="normal-case font-medium">(optional)</span>
                  </label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={FIELD} />
                </div>
              </div>

              {/* Timezone & Reminder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Timezone
                  </label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={FIELD}>
                    {!PLAN_TIMEZONES.some((t) => t.value === timezone) && <option value={timezone}>{timezone} (your timezone)</option>}
                    {PLAN_TIMEZONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Reminder Notification
                  </label>
                  <select
                    value={reminder}
                    onChange={(e) => setReminder(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="30m">30 minutes before</option>
                    <option value="1h">1 hour before</option>
                    <option value="1d">1 day before</option>
                    <option value="none">No reminder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Repeat</label>
                  <select value={recurring} onChange={(e) => setRecurring(e.target.value as 'none' | 'weekly' | 'monthly')} className={FIELD}>
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Every week (VIP)</option>
                    <option value="monthly">Every month (VIP)</option>
                  </select>
                  {recurring !== 'none' && myMembership && myMembership.limits && !myMembership.limits.recurringPlans && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <MembershipBadge tier="plus" />
                      <span>Repeating plans are part of Watch+. <Link href="/pricing" className="underline">See Watch+</Link></span>
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                  Description / Note
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white"
                  placeholder="Bring your popcorn and drinks..."
                  maxLength={2000}
                />
              </div>
            </div>
          )}

          {/* STEP 4: Invite Real Friends */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Invite Friends</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300 font-bold">
                    {friendsList.length} Connected
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Select friends from your connected network to notify and invite.
                </p>
              </div>

              {/* Friends list */}
              {friendsList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      No Connected Friends Yet
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      Only friends who are connected with you on Watch will appear here. Add friends using their Partner Code on the Friends page to invite them to plans.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <Link
                      href="/friends"
                      onClick={onClose}
                      className="px-4 py-2 rounded-full bg-[#ff3b68] hover:bg-[#ee1d49] text-white text-xs font-bold shadow-md shadow-[#ff3b68]/20 transition cursor-pointer"
                    >
                      Go to Friends Page →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {friendsList.map((friend) => {
                    const isSelected = invitedFriends.includes(friend.userId);
                    return (
                      <button
                        key={friend.userId}
                        type="button"
                        onClick={() => toggleInviteFriend(friend.userId)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#ee1d49] bg-[#ee1d49]/5 dark:bg-[#ee1d49]/10'
                            : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <PersonAvatar name={friend.displayName} src={friend.avatarUrl} className="w-9 h-9" />
                            {friend.isOnline && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#151022]" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {friend.displayName}
                            </div>
                            {friend.partnerCode && (
                              <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                                #{friend.partnerCode}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs transition ${
                            isSelected
                              ? 'bg-[#ee1d49] text-white shadow-xs'
                              : 'border border-slate-300 dark:border-white/20 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Push notification banner preview */}
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 text-xs text-indigo-700 dark:text-indigo-300">
                <Bell className="w-4 h-4 shrink-0" />
                <span>
                  Invited friends get a notification (even when Watch is closed, if they allowed alerts) and answer Going / Maybe / Can't go themselves.
                </span>
              </div>
            </div>
          )}
        </div>

        {formError && (
          <div role="alert" className="px-4 sm:px-6 py-2.5 bg-rose-50 dark:bg-rose-500/10 border-t border-rose-200 dark:border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {formError}
            {upgradeNeeded && (
              <Link href="/pricing" className="ml-2 inline-flex items-center gap-1 font-black text-[#ee1d49] underline">
                See Watch+
              </Link>
            )}
          </div>
        )}

        {/* Modal Footer / Navigation */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setStep((step - 1) as 1 | 2 | 3 | 4);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold transition cursor-pointer"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCreateSubmit()}
              disabled={submitting}
              className="disabled:opacity-60 inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold transition cursor-pointer"
            >
              <span>{submitting ? 'Creating…' : 'Create plan'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
