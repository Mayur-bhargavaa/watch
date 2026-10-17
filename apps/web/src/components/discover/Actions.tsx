'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clapperboard, Loader2, Plus, X, Check, Calendar, Clock, Users, Mail, Sparkles } from 'lucide-react';
import { snapshotOf, type CatalogTitle, type TitleSnapshot, formatTime12, todayDateString, PLAN_TIMEZONES } from '@synccinema/common';
import { createPartyRoom, getUserRooms, getFriendsWithStreaks, getUserPartner } from '../../lib/api';
import { createPlan } from '../../lib/plansApi';
import { catalogApi, CatalogApiError } from '../../lib/catalog/api';
import { BTN_DARK, BTN_PRIMARY, BTN_SECONDARY, FOCUS, SURFACE } from './ui';
import { useSignedInSession } from './useCineverse';
import { SaveTitleButton } from '../watchlist/SaveButton';
import { ModalPortal } from '../chat/ModalPortal';

type TitleLike = Pick<CatalogTitle, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'mediaType'> & {
  freeStreamUrl?: string | null;
  providers?: CatalogTitle['providers'];
};

/** Save / remove a catalog title: the shared button of the one watchlist (kept under this name for the Discover components). */
export function WatchlistButton({ title, variant = 'secondary', compact = false, iconOnly = false }: { title: TitleLike; variant?: 'primary' | 'secondary' | 'overlay' | 'hero'; compact?: boolean; iconOnly?: boolean }) {
  return <SaveTitleButton title={title} variant={variant} compact={compact} iconOnly={iconOnly} />;
}

interface RoomRow {
  slug: string;
  title: string;
  endedAt?: string | null;
}

interface FriendOption {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

/**
 * "Start a Watch Party" / "Propose to <room>". Provides both:
 *  1. "Schedule as Plan" (date, time, friend picker, email invitations & 4h/30m reminder scheduler)
 *  2. "Watch Now" (instant cinema room creation / queue proposal to active room)
 */
export function PartyButton({ title, provider = null, preferredRoom = null, label = 'Start a Watch Party', variant = 'secondary', compact = false }: { title: TitleLike; provider?: { id: string; name: string } | null; preferredRoom?: string | null; label?: string; variant?: 'primary' | 'secondary' | 'dark'; compact?: boolean }) {
  const router = useRouter();
  const { session } = useSignedInSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'schedule' | 'now'>('schedule');
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; slug?: string; planId?: string; error?: boolean } | null>(null);

  // Scheduling state
  const [scheduleDate, setScheduleDate] = useState<string>(() => todayDateString());
  const [scheduleTime, setScheduleTime] = useState<string>('20:00');
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(() => PLAN_TIMEZONES[0]?.value || 'IST (UTC+5:30)');
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);

  const base = variant === 'primary' ? BTN_PRIMARY : variant === 'dark' ? BTN_DARK : BTN_SECONDARY;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openMenu = useCallback(async () => {
    setOpen(true);
    setMessage(null);
    setCreatedPlanId(null);
    if (!session) return;

    // Load active rooms for Watch Now
    getUserRooms(session.token)
      .then((list) => {
        const live = (list as RoomRow[]).filter((r) => r && typeof r.slug === 'string' && !r.endedAt);
        if (preferredRoom && !live.some((r) => r.slug === preferredRoom)) live.unshift({ slug: preferredRoom, title: 'This room' });
        setRooms(live.slice(0, 8));
      })
      .catch(() => setRooms([]));

    // Load friends for Plan scheduling
    setLoadingFriends(true);
    Promise.all([
      getFriendsWithStreaks(session.token).catch(() => ({ friends: [] })),
      getUserPartner(session.token).catch(() => ({ partner: null }))
    ])
      .then(([friendsRes, partnerRes]) => {
        const connected: FriendOption[] = [];
        const seen = new Set<string>();
        if (partnerRes?.partner?.id) {
          seen.add(partnerRes.partner.id);
          connected.push({
            userId: partnerRes.partner.id,
            displayName: `${partnerRes.partner.displayName} (Partner)`,
            avatarUrl: partnerRes.partner.avatarUrl,
            isOnline: partnerRes.partner.online
          });
        }
        if (Array.isArray(friendsRes?.friends)) {
          for (const f of friendsRes.friends) {
            if (f.friendUser?.id && !seen.has(f.friendUser.id)) {
              seen.add(f.friendUser.id);
              connected.push({
                userId: f.friendUser.id,
                displayName: f.friendUser.displayName,
                avatarUrl: f.friendUser.avatarUrl,
                isOnline: f.friendUser.isOnline
              });
            }
          }
        }
        setFriends(connected);
      })
      .catch(() => setFriends([]))
      .finally(() => setLoadingFriends(false));
  }, [session, preferredRoom]);

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllFriends = () => {
    if (selectedFriends.length === friends.length) {
      setSelectedFriends([]);
    } else {
      setSelectedFriends(friends.map((f) => f.userId));
    }
  };

  const handleSchedulePlan = async () => {
    if (!session) return;
    setBusy('schedule');
    setMessage(null);
    try {
      const formattedTime = formatTime12(scheduleTime) || scheduleTime;
      // 1. Create a cinema party room for this watch party
      const streamUrl = title.freeStreamUrl || (title.providers?.find((p) => p.type === 'free' && p.destinationUrl)?.destinationUrl) || undefined;
      const { room } = await createPartyRoom({
        title: `Watching ${title.title}`.slice(0, 60),
        mediaTitle: title.title,
        sourceUrl: streamUrl,
        activityMode: 'CINEMA',
        token: session.token
      });
      // Propose title into the room queue
      await propose(room.slug).catch(() => {});

      // 2. Create the plan with the direct room URL
      const plan = await createPlan({
        title: `Watch Party: ${title.title}`.slice(0, 100),
        type: 'movie',
        date: scheduleDate,
        time: formattedTime,
        timezone: scheduleTimezone,
        description: `Watch party for "${title.title}". Grab your popcorn and enjoy together!`,
        reminder: '30m',
        recurring: 'none',
        activities: [
          {
            id: 'act-1',
            type: 'movie',
            time: formattedTime,
            title: title.title,
            subtitle: title.releaseDate ? `Released ${title.releaseDate.slice(0, 4)}` : 'Watch party title',
            actionLabel: 'Enter Cinema',
            actionUrl: `/room/${room.slug}`,
            movieDetails: {
              title: title.title,
              duration: '',
              provider: streamUrl ? 'youtube' : 'catalog',
              posterUrl: title.posterPath ? `https://image.tmdb.org/t/p/w500${title.posterPath}` : undefined,
              sourceUrl: streamUrl
            }
          }
        ],
        invitedUserIds: selectedFriends
      });

      setCreatedPlanId(plan.id);
      setMessage({
        text: `Watch party scheduled! We sent a confirmation email to you and invitation emails to ${selectedFriends.length} friend(s).`,
        planId: plan.id,
        slug: room.slug
      });
    } catch (e: any) {
      setMessage({ text: e?.message || 'Could not schedule the watch party plan. Please check the date & time.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const snap: TitleSnapshot = snapshotOf(title);
  const propose = async (slug: string) => {
    setBusy(slug);
    try {
      await catalogApi.roomAction(slug, 'propose', { titleKey: snap.titleKey, snapshot: snap, ...(provider ? { provider } : {}) });
      setMessage({ text: 'Added to the party queue.', slug });
    } catch (e) {
      setMessage({ text: e instanceof CatalogApiError ? e.message : 'Could not add it to the queue.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const createAndPropose = async () => {
    if (!session) return;
    setBusy('new');
    try {
      const streamUrl = title.freeStreamUrl || (title.providers?.find((p) => p.type === 'free' && p.destinationUrl)?.destinationUrl) || undefined;
      const { room } = await createPartyRoom({
        title: `Watching ${title.title}`.slice(0, 60),
        mediaTitle: title.title,
        sourceUrl: streamUrl,
        activityMode: 'CINEMA',
        token: session.token
      });
      await propose(room.slug);
      router.push(`/room/${room.slug}`);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not create the room.', error: true });
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <Link href={`/login?redirect=${encodeURIComponent('/discover')}`} className={`${base} ${compact ? '!px-3 !py-1.5' : ''}`}>
        <Clapperboard className="h-4 w-4" aria-hidden="true" /> {label}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => (open ? setOpen(false) : void openMenu())} aria-haspopup="dialog" aria-expanded={open} className={`${base} ${compact ? '!px-3 !py-1.5' : ''}`}>
        <Clapperboard className="h-4 w-4" aria-hidden="true" /> {label}
      </button>
      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Watch party options">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in" onClick={() => setOpen(false)} />
            <div className={`${SURFACE} relative z-10 w-full max-w-md rounded-3xl p-5 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]`}>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10 shrink-0">
                <div className="min-w-0 pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Watch Party</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{title.title}</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className={`rounded-full p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition ${FOCUS}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200/80 dark:border-white/10 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setTab('schedule'); setMessage(null); }}
                  className={`flex-1 pb-2.5 text-xs font-bold transition border-b-2 flex items-center justify-center gap-1.5 ${
                    tab === 'schedule'
                      ? 'border-rose-500 text-rose-500'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" /> Schedule as Plan
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('now'); setMessage(null); }}
                  className={`flex-1 pb-2.5 text-xs font-bold transition border-b-2 flex items-center justify-center gap-1.5 ${
                    tab === 'now'
                      ? 'border-rose-500 text-rose-500'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Clapperboard className="h-3.5 w-3.5" /> Watch Now
                </button>
              </div>

              {/* Body */}
              <div className="mt-3 overflow-y-auto flex-1 pr-1 space-y-3">
                {tab === 'schedule' ? (
                  createdPlanId ? (
                    <div className="py-4 text-center space-y-3 animate-in fade-in">
                      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Check className="h-6 w-6 stroke-[3]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Watch Party Scheduled!</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                          {scheduleDate} at {formatTime12(scheduleTime)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] text-slate-600 dark:text-zinc-300 text-left space-y-1">
                        <p className="flex items-center gap-1.5 font-semibold text-rose-500">
                          <Mail className="h-3.5 w-3.5" /> Emails Dispatched
                        </p>
                        <p>• Confirmation email sent to your address.</p>
                        <p>• Invitations sent to {selectedFriends.length} invited friend(s).</p>
                        <p>• Automated reminders will arrive 4 hours and 30 minutes before showtime.</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Link
                          href={`/plans/${createdPlanId}`}
                          className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-3 text-xs text-center transition shadow-sm"
                        >
                          Open Watch Party Plan
                        </Link>
                        <button
                          type="button"
                          onClick={() => { setCreatedPlanId(null); setMessage(null); }}
                          className="rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 font-semibold py-2 px-3 text-xs hover:bg-slate-100 dark:hover:bg-white/5 transition"
                        >
                          Plan Another
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Date and Time Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-rose-500" /> Date
                          </label>
                          <input
                            type="date"
                            value={scheduleDate}
                            min={todayDateString()}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-rose-500" /> Time
                          </label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                          />
                        </div>
                      </div>

                      {/* Timezone */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                          Timezone
                        </label>
                        <select
                          value={scheduleTimezone}
                          onChange={(e) => setScheduleTimezone(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                        >
                          {PLAN_TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Invite Friends */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                            <Users className="h-3 w-3 text-rose-500" /> Invite Friends ({selectedFriends.length})
                          </label>
                          {friends.length > 0 && (
                            <button
                              type="button"
                              onClick={toggleAllFriends}
                              className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400"
                            >
                              {selectedFriends.length === friends.length ? 'Deselect all' : 'Select all'}
                            </button>
                          )}
                        </div>

                        {loadingFriends ? (
                          <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                            <span>Loading friends...</span>
                          </div>
                        ) : friends.length === 0 ? (
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 p-2.5 rounded-xl bg-slate-100 dark:bg-white/5">
                            No friends connected yet. You can still schedule and share the invite link!
                          </p>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-200/80 dark:border-white/10 p-1.5 bg-slate-50/50 dark:bg-white/[0.02]">
                            {friends.map((f) => {
                              const isSelected = selectedFriends.includes(f.userId);
                              return (
                                <button
                                  key={f.userId}
                                  type="button"
                                  onClick={() => toggleFriend(f.userId)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition ${
                                    isSelected
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 font-semibold'
                                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                                      {f.avatarUrl ? (
                                        <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" />
                                      ) : (
                                        f.displayName.slice(0, 1).toUpperCase()
                                      )}
                                      {f.isOnline && (
                                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                                      )}
                                    </div>
                                    <span className="truncate">{f.displayName}</span>
                                  </div>
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                                      isSelected ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300 dark:border-white/20'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Automated Notification Note */}
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-[10px] text-slate-500 dark:text-zinc-400 space-y-0.5">
                        <p className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-rose-500" /> Automated Emails & Reminders
                        </p>
                        <p>• Host confirmation & friend invitations sent upon creation.</p>
                        <p>• Automatic reminder emails & alerts at <strong>4 hours</strong> and <strong>30 minutes</strong> left.</p>
                      </div>

                      {/* Schedule Button */}
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void handleSchedulePlan()}
                        className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-bold py-2.5 px-3 text-xs flex items-center justify-center gap-2 transition shadow-md shadow-rose-500/20"
                      >
                        {busy === 'schedule' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Scheduling & Dispatching Emails...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            <span>Schedule Watch Party</span>
                          </>
                        )}
                      </button>
                    </div>
                  )
                ) : (
                  /* Watch Now tab */
                  <div className="space-y-1.5">
                    {rooms === null ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                        <Loader2 className="h-5 w-5 motion-safe:animate-spin text-rose-500" aria-hidden="true" />
                        <span>Finding your active rooms...</span>
                      </div>
                    ) : (
                      <>
                        {rooms.length > 0 && (
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 px-1 mb-1">
                            Choose an active room:
                          </p>
                        )}
                        {rooms.map((r) => (
                          <button
                            key={r.slug}
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void propose(r.slug)}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs sm:text-sm text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-[#1f2029] disabled:opacity-60 transition ${FOCUS}`}
                          >
                            <span className="truncate">
                              Propose to <strong className="font-semibold">{r.title}</strong>
                            </span>
                            {busy === r.slug ? (
                              <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin text-rose-500" aria-hidden="true" />
                            ) : (
                              <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void createAndPropose()}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 disabled:opacity-60 transition border border-rose-500/20 mt-2 ${FOCUS}`}
                        >
                          <span className="truncate">Create an instant room with this title</span>
                          {busy === 'new' ? (
                            <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin text-rose-500" aria-hidden="true" />
                          ) : (
                            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Feedback Message */}
              <div aria-live="polite" className="shrink-0">
                {message && !createdPlanId && (
                  <div
                    className={`mt-3 flex items-center gap-2 rounded-xl p-2.5 text-xs ${
                      message.error
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {!message.error && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <span className="flex-1">{message.text}</span>
                    {message.slug && (
                      <Link href={`/room/${message.slug}`} className="font-bold underline ml-1">
                        Open room
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
