'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Globe,
  Film,
  Gamepad2,
  MessageCircle,
  Sparkles,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  Bell
} from 'lucide-react';
import { PlanType, ActivityType, PlanActivity, Plan } from '../../types/plans';
import { addPlan } from '../../lib/plansStore';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

// Preset popular titles for cinema
const POPULAR_MOVIES = [
  {
    title: 'Interstellar',
    duration: '2h 49m',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  {
    title: 'Tears of Steel (Sci-Fi 4K)',
    duration: '12m',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
  },
  {
    title: 'Big Buck Bunny (Animation)',
    duration: '9m',
    poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  }
];

// Preset game catalog
const GAME_CATALOG = [
  {
    gameId: 'ludo',
    title: 'Ludo Party',
    icon: '🎲',
    players: '2-4 Players',
    url: '/games/ludo'
  },
  {
    gameId: 'four-in-a-row',
    title: 'Four in a Row',
    icon: '🔴',
    players: '2 Players',
    url: '/games/four-in-a-row'
  },
  {
    gameId: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    icon: '❌',
    players: '2 Players',
    url: '/games/tic-tac-toe'
  }
];

// Friend mock presets for instant invites
const SAMPLE_FRIENDS = [
  {
    userId: 'u2',
    displayName: 'Priya Sharma',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya&skinColor=edb98a&top=longStraight'
  },
  {
    userId: 'u3',
    displayName: 'Arjun Verma',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun&skinColor=edb98a&top=shortFlat'
  },
  {
    userId: 'u4',
    displayName: 'Neha Patel',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neha&skinColor=edb98a&top=bob'
  },
  {
    userId: 'u5',
    displayName: 'Aman Khan',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aman&skinColor=edb98a&top=shortCurly'
  }
];

export const CreatePlanModal: React.FC<CreatePlanModalProps> = ({
  isOpen,
  onClose,
  currentUserId = 'u1',
  currentUserName = 'Mayur Bhargava'
}) => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [planType, setPlanType] = useState<PlanType>('movie');
  const [emoji, setEmoji] = useState('🍿');
  const [title, setTitle] = useState('Friday Movie & Game Night');
  const [date, setDate] = useState('2026-09-27');
  const [time, setTime] = useState('9:00 PM');
  const [endTime, setEndTime] = useState('12:30 AM');
  const [timezone, setTimezone] = useState('IST (UTC+5:30)');
  const [description, setDescription] = useState('Watching a movie and then jumping straight into a Ludo showdown!');
  const [reminder, setReminder] = useState<'30m' | '1h' | '1d' | 'none'>('30m');

  // Multi-Activity Sequence
  const [activities, setActivities] = useState<PlanActivity[]>([
    {
      id: 'act-1',
      type: 'movie',
      time: '9:00 PM',
      title: 'Interstellar',
      subtitle: 'Duration: 2h 49m · Cinema Stream',
      actionLabel: 'Enter Cinema',
      actionUrl: '/rooms',
      movieDetails: {
        title: 'Interstellar',
        duration: '2h 49m',
        provider: 'catalog',
        posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80'
      }
    },
    {
      id: 'act-2',
      type: 'game',
      time: '11:50 PM',
      title: 'Ludo Party',
      subtitle: '2-4 Players · Friendly Tournament',
      actionLabel: 'Play Together',
      actionUrl: '/games/ludo',
      gameDetails: {
        gameId: 'ludo',
        title: 'Ludo Party',
        icon: '🎲',
        players: '2-4'
      }
    }
  ]);

  // Invites State
  const [invitedFriends, setInvitedFriends] = useState<string[]>(['u2', 'u3']);

  if (!isOpen) return null;

  // Type change helper
  const handleSelectType = (type: PlanType, defaultEmoji: string, defaultTitle: string) => {
    setPlanType(type);
    setEmoji(defaultEmoji);
    setTitle(defaultTitle);
  };

  // Add activity helpers
  const handleAddMovieActivity = (movie: typeof POPULAR_MOVIES[0]) => {
    const newAct: PlanActivity = {
      id: `act-${Date.now()}`,
      type: 'movie',
      time: time || '9:00 PM',
      title: movie.title,
      subtitle: `Duration: ${movie.duration}`,
      actionLabel: 'Enter Cinema',
      actionUrl: '/rooms',
      movieDetails: {
        title: movie.title,
        duration: movie.duration,
        provider: 'catalog',
        posterUrl: movie.poster,
        sourceUrl: movie.url
      }
    };
    setActivities([...activities, newAct]);
  };

  const handleAddGameActivity = (game: typeof GAME_CATALOG[0]) => {
    const newAct: PlanActivity = {
      id: `act-${Date.now()}`,
      type: 'game',
      time: '11:00 PM',
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
      id: `act-${Date.now()}`,
      type: 'hangout',
      time: '12:00 AM',
      title: 'Late Night Chat & Hangout',
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

  const handleCreateSubmit = () => {
    // Format date string
    const d = new Date(date + 'T00:00:00');
    const dateFormatted = d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const participants = [
      {
        userId: currentUserId,
        displayName: currentUserName,
        status: 'GOING' as const,
        isHost: true
      },
      ...invitedFriends.map((fId) => {
        const friend = SAMPLE_FRIENDS.find((f) => f.userId === fId);
        return {
          userId: fId,
          displayName: friend?.displayName || 'Friend',
          avatarUrl: friend?.avatarUrl,
          status: 'GOING' as const
        };
      })
    ];

    const newPlan: Plan = {
      id: `plan-${Date.now()}`,
      title: title.trim() || 'Exciting Watch Plan',
      emoji: emoji || '🍿',
      type: planType,
      date,
      dateFormatted,
      time,
      endTime,
      timezone,
      description,
      activities,
      participants,
      reminder,
      chatMessages: [
        {
          id: `msg-${Date.now()}`,
          userId: currentUserId,
          displayName: currentUserName,
          text: `Hey everyone! Created this plan for ${title}. Can't wait! 🎉`,
          createdAt: Date.now()
        }
      ],
      createdAt: Date.now()
    };

    addPlan(newPlan);
    onClose();
    router.push(`/plans/${newPlan.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden my-8">
        {/* Top Bar / Steps Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#ee1d49] to-[#ff3b68] flex items-center justify-center text-white shadow-md shadow-[#ee1d49]/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Create a Plan
              </h2>
              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Step {step} of 4: {step === 1 ? 'Occasion' : step === 2 ? 'Activities' : step === 3 ? 'Details' : 'Invites'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {/* STEP 1: What are you planning? */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  What are you planning?
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Pick a vibe or custom occasion to jumpstart your plan.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { type: 'movie' as PlanType, label: 'Movie Night', emoji: '🎬', title: 'Friday Movie Night' },
                  { type: 'game' as PlanType, label: 'Game Night', emoji: '🎮', title: 'Ludo & Board Game Night' },
                  { type: 'birthday' as PlanType, label: 'Birthday', emoji: '🎂', title: 'Birthday Bash & Stream' },
                  { type: 'anniversary' as PlanType, label: 'Anniversary', emoji: '❤️', title: 'Romantic Watch Night' },
                  { type: 'party' as PlanType, label: 'Party', emoji: '🥳', title: 'Weekend Group Party' },
                  { type: 'hangout' as PlanType, label: 'Hangout', emoji: '☕', title: 'Casual Late Hangout' },
                  { type: 'custom' as PlanType, label: 'Custom Event', emoji: '✨', title: 'Special Gathering' }
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleSelectType(item.type, item.emoji, item.title)}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      planType === item.type
                        ? 'border-[#ee1d49] bg-[#ee1d49]/5 dark:bg-[#ee1d49]/10 shadow-sm scale-102'
                        : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="text-2xl mb-2">{item.emoji}</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Multi-Activity Sequence Builder */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Multi-Activity Timeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Chain together movies, games, and hangouts so everyone knows what’s next!
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
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center text-sm shadow-xs shrink-0">
                        {act.type === 'movie' ? '🎬' : act.type === 'game' ? '🎮' : '☕'}
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

              {/* Add Activities Picker */}
              <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  + Add Next Activity:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddMovieActivity(POPULAR_MOVIES[0])}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-[#ee1d49] transition text-xs font-bold flex items-center gap-2"
                  >
                    <Film className="w-4 h-4 text-[#ee1d49]" />
                    <span>+ Cinema / Movie</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddGameActivity(GAME_CATALOG[0])}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-violet-500 transition text-xs font-bold flex items-center gap-2"
                  >
                    <Gamepad2 className="w-4 h-4 text-violet-400" />
                    <span>+ Ludo / Game</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddHangoutActivity}
                    className="p-3 rounded-xl bg-white dark:bg-white/10 text-left border border-slate-200 dark:border-white/10 hover:border-emerald-500 transition text-xs font-bold flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>+ Late Hangout</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Event Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Event Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Set the schedule and let everyone know the details.
                </p>
              </div>

              {/* Title & Emoji */}
              <div className="flex gap-3">
                <div className="w-14">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-full text-center py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-lg"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Plan Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Friday Movie Night"
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
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="9:00 PM"
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="12:30 AM"
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Timezone & Reminder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  />
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
                />
              </div>
            </div>
          )}

          {/* STEP 4: Invite Friends */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Invite Friends
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Select friends to notify and invite to your plan.
                </p>
              </div>

              {/* Friends list */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {SAMPLE_FRIENDS.map((friend) => {
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
                        <img
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="w-9 h-9 rounded-full object-cover bg-slate-200 dark:bg-zinc-800"
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {friend.displayName}
                        </span>
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

              {/* Push notification banner preview */}
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 text-xs text-indigo-700 dark:text-indigo-300">
                <Bell className="w-4 h-4 shrink-0" />
                <span>
                  Invited friends will instantly receive a Watch notification with direct RSVP buttons.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation */}
        <div className="p-6 bg-slate-50 dark:bg-[#130e1b] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
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
              onClick={() => setStep((step + 1) as any)}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-[#ee1d49] dark:hover:bg-[#ee1d49] dark:hover:text-white transition cursor-pointer shadow-sm"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateSubmit}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white text-xs font-bold hover:brightness-110 transition cursor-pointer shadow-md shadow-[#ee1d49]/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create & Launch Plan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
