'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Flame,
  Calendar as CalendarIcon,
  Clock,
  Trophy,
  Check,
  AlertTriangle,
  Video,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { FriendWithStreak } from '../../lib/api';

// Bitmoji avatar helper
function getBitmojiAvatarUrl(url?: string | null, fallbackSeed?: string): string {
  if (url && url.trim() !== '') {
    if (url.startsWith('/avatars/')) return url;
    return url
      .replace(/[?&]radius=[^&]+/g, '')
      .replace(/[?&]backgroundColor=[^&]+/g, '');
  }
  const seed = encodeURIComponent(fallbackSeed || 'player');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&skinColor=edb98a&top=shortCurly&hairColor=4a312c&accessoriesProbability=0&clothing=blazerAndShirt&clothesColor=25557c&eyes=wink&mouth=smile`;
}

export interface StreakDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  friend: FriendWithStreak | null;
  onWatchTogether?: (friend: FriendWithStreak) => void;
  onPlayGame?: (friend: FriendWithStreak, game: 'ludo' | 'four-in-a-row') => void;
}

export const StreakDetailsDrawer: React.FC<StreakDetailsDrawerProps> = ({
  isOpen,
  onClose,
  friend,
  onWatchTogether,
  onPlayGame
}) => {
  // Calendar month state (defaults to current month)
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Escape key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset calendar month when drawer opens
  useEffect(() => {
    if (isOpen) {
      setCurrentDate(new Date());
    }
  }, [isOpen]);

  // Safe data extraction (defined before hooks, safe with null/undefined)
  const currentStreak = friend?.streak?.currentStreak ?? 0;
  const longestStreak = friend?.streak?.longestStreak ?? 0;
  const lastDate = friend?.streak?.lastWatchedDate ?? null;
  const completedToday = Boolean(friend?.streak?.completedToday);
  const atRisk = Boolean(friend?.streak?.atRisk);
  const totalMinutes = friend?.streak?.totalMinutesWatched ?? 0;

  // Compute Active Streak Dates Set (Hook called unconditionally at top level!)
  const activeStreakDates = useMemo(() => {
    const dates = new Set<string>();
    if (currentStreak > 0 && lastDate) {
      try {
        const cleanDate = lastDate.includes('T') ? lastDate.split('T')[0] : lastDate;
        const parts = cleanDate.split('-').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          const [y, m, d] = parts;
          for (let i = 0; i < currentStreak; i++) {
            const dt = new Date(y, m - 1, d - i);
            if (!isNaN(dt.getTime())) {
              const yStr = dt.getFullYear();
              const mStr = String(dt.getMonth() + 1).padStart(2, '0');
              const dStr = String(dt.getDate()).padStart(2, '0');
              dates.add(`${yStr}-${mStr}-${dStr}`);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse active streak dates:', e);
      }
    }
    return dates;
  }, [currentStreak, lastDate]);

  // Calendar calculations (Safe with invalid dates)
  const safeDate = useMemo(() => {
    return currentDate instanceof Date && !isNaN(currentDate.getTime())
      ? currentDate
      : new Date();
  }, [currentDate]);

  const year = safeDate.getFullYear();
  const month = safeDate.getMonth();

  const monthName = useMemo(() => {
    try {
      return safeDate.toLocaleString('default', { month: 'long' });
    } catch {
      return 'Month';
    }
  }, [safeDate]);

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayStr = useMemo(() => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, []);

  // Format Total Watch Time
  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Format Last Watched Date
  const formatLastDate = (dateStr: string | null) => {
    if (!dateStr) return 'No activity yet';
    try {
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const today = new Date().toISOString().split('T')[0];
      const yd = new Date();
      yd.setDate(yd.getDate() - 1);
      const yesterday = yd.toISOString().split('T')[0];

      if (clean === today) return 'Today 🔥';
      if (clean === yesterday) return 'Yesterday';

      const parts = clean.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
      return clean;
    } catch {
      return 'Recently';
    }
  };

  // Format Friendship Start Date safely
  const formatFriendshipDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Recently';
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return 'Recently';
      return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  // Guard clause placed AFTER all hooks have run!
  if (!isOpen || !friend) {
    return null;
  }

  const friendUser = friend.friendUser || {
    id: '',
    displayName: 'Friend',
    avatarUrl: null,
    partnerCode: 'USER',
    isOnline: false
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-pointer"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div className="w-screen max-w-md pointer-events-auto bg-white dark:bg-[#130d19] border-l border-zinc-200 dark:border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
          
          {/* Header */}
          <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={getBitmojiAvatarUrl(friendUser.avatarUrl, friendUser.displayName)}
                  alt={friendUser.displayName || 'Friend'}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-white/10 shadow-xs"
                />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 ring-1 ring-white/50">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      friendUser.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                    }`}
                  />
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                    {friendUser.displayName || 'Friend'}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                    🔥 Streak
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                  #{friendUser.partnerCode || 'USER'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Close drawer"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* 1. HERO STREAK STATUS CARD */}
            <div className={`p-5 rounded-3xl border transition-all text-center relative overflow-hidden ${
              completedToday
                ? 'bg-gradient-to-b from-rose-50 to-white dark:from-rose-950/20 dark:to-[#160f1f] border-rose-200 dark:border-rose-900/30'
                : atRisk
                ? 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[#160f1f] border-amber-300 dark:border-amber-800/40 shadow-sm shadow-amber-500/10'
                : 'bg-zinc-50/80 dark:bg-white/5 border-zinc-200 dark:border-white/10'
            }`}>
              
              {/* Flame Icon with Pulsing Halo */}
              <div className="relative inline-flex items-center justify-center mb-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  currentStreak > 0
                    ? 'bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-zinc-200 dark:bg-white/10 text-zinc-400'
                }`}>
                  <span className="text-3xl filter drop-shadow-sm">🔥</span>
                </div>
                {atRisk && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] text-white font-black items-center justify-center">!</span>
                  </span>
                )}
              </div>

              {/* Days Count */}
              <div className="font-black text-4xl sm:text-5xl tracking-tight text-zinc-900 dark:text-white leading-none">
                {currentStreak} <span className="text-xl sm:text-2xl font-bold text-zinc-500 dark:text-zinc-400">days</span>
              </div>

              {/* Status Pill */}
              <div className="mt-3">
                {completedToday ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Active today! Streak safe</span>
                  </div>
                ) : atRisk ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Streak expires today! Watch or play now</span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Watch movies or play games together daily to increase your streak!
                  </p>
                )}
              </div>

              {/* Secondary Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-200/80 dark:border-white/10">
                <div className="p-2.5 rounded-2xl bg-white dark:bg-black/30 border border-zinc-100 dark:border-white/5">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Best Record</span>
                  </div>
                  <div className="text-sm font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-white dark:bg-black/30 border border-zinc-100 dark:border-white/5">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Total Watched</span>
                  </div>
                  <div className="text-sm font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {formatMinutes(totalMinutes)}
                  </div>
                </div>
              </div>

            </div>

            {/* 2. STREAK CALENDAR */}
            <div className="p-5 rounded-3xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200 dark:border-white/10 space-y-4">
              
              {/* Calendar Header: Month + Nav */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[#ee1d49]" />
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">
                    {monthName} {year}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    title="Previous month"
                    className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    title="Next month"
                    className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day-of-week Headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {/* Blank days before the 1st */}
                {Array.from({ length: Math.max(0, firstDayIndex || 0) }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-8 w-8" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: Math.max(0, daysInMonth || 0) }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = dateString === todayStr;
                  const isActiveStreakDay = activeStreakDates.has(dateString);
                  let isFuture = false;
                  try {
                    isFuture = new Date(year, month, dayNum, 23, 59, 59) > new Date();
                  } catch {}

                  let dayStyle = 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-white/10';
                  if (isActiveStreakDay) {
                    dayStyle = 'bg-gradient-to-br from-amber-500 to-rose-500 text-white font-bold shadow-xs';
                  } else if (isToday) {
                    dayStyle = 'border-2 border-[#ee1d49] text-[#ee1d49] font-bold';
                  } else if (isFuture) {
                    dayStyle = 'text-zinc-300 dark:text-zinc-600 cursor-default';
                  }

                  return (
                    <div
                      key={dateString}
                      className={`h-8 w-8 mx-auto rounded-xl flex items-center justify-center text-xs relative transition-all ${dayStyle}`}
                      title={
                        isActiveStreakDay
                          ? `${dateString}: Streak Active 🔥`
                          : isToday
                          ? `${dateString}: Today`
                          : dateString
                      }
                    >
                      <span>{dayNum}</span>
                      {isActiveStreakDay && (
                        <span className="absolute -top-1 -right-1 text-[8px] leading-none">🔥</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-200/60 dark:border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-400 to-rose-500" />
                  <span>Streak Day</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-[#ee1d49]" />
                  <span>Today</span>
                </div>
              </div>

            </div>

            {/* 3. ACTIVITY DETAILS & RULES */}
            <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#ee1d49]" />
                  <span>Last Streak Activity</span>
                </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {formatLastDate(lastDate)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Friendship Started</span>
                </span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 text-xs">
                  {formatFriendshipDate(friend.createdAt)}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 text-[11px] text-zinc-400 leading-relaxed">
                💡 <span className="font-semibold text-zinc-600 dark:text-zinc-300">How streaks work:</span> Watch a movie or play Ludo / 4-in-a-Row together once every 24 hours to keep the flame alive!
              </div>
            </div>

          </div>

          {/* Drawer Footer: Actions */}
          <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5 space-y-2 shrink-0">
            {onWatchTogether && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onWatchTogether(friend);
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#ee1d49]/25 transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Watch Movie Together Now</span>
              </button>
            )}

            {onPlayGame && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPlayGame(friend, 'ludo');
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-[#ee1d49] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Play Ludo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPlayGame(friend, 'four-in-a-row');
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Play 4-in-Row</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
