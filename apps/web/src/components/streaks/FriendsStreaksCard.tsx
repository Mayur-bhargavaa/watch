'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  UserPlus,
  Tv,
  Gamepad2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Users,
  AlertCircle,
  MoreVertical,
  Search,
  Clock,
  Trophy,
  ShieldAlert,
  Film
} from 'lucide-react';
import {
  getFriendsWithStreaks,
  removeFriend,
  addFriendByCode,
  FriendWithStreak
} from '../../lib/api';
import { AddFriendModal } from './AddFriendModal';

interface FriendsStreaksCardProps {
  token: string;
  fullPage?: boolean;
  onStartWatchPartyWithFriend?: (friend: FriendWithStreak) => void;
  onPlayGameWithFriend?: (friend: FriendWithStreak) => void;
}

export const FriendsStreaksCard: React.FC<FriendsStreaksCardProps> = ({
  token,
  fullPage = false,
  onStartWatchPartyWithFriend,
  onPlayGameWithFriend
}) => {
  const [friends, setFriends] = useState<FriendWithStreak[]>([]);
  const [myFriendCode, setMyFriendCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeMenuFriendId, setActiveMenuFriendId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'atRisk'>('all');

  // Inline Quick Add Friend form state (for fullPage mode)
  const [inlineCode, setInlineCode] = useState('');
  const [inlineAdding, setInlineAdding] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);

  const fetchFriends = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await getFriendsWithStreaks(token);
      setFriends(res.friends || []);
      setMyFriendCode(res.myFriendCode || '');
      setError(null);
    } catch (err: any) {
      console.error('Failed to load friends:', err);
      setError(err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
    const interval = setInterval(fetchFriends, 25000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCopyCode = async () => {
    if (!myFriendCode) return;
    try {
      await navigator.clipboard.writeText(myFriendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRemove = async (friend: FriendWithStreak) => {
    if (!confirm(`Are you sure you want to remove ${friend.friendUser.displayName}? This will also delete your shared streak history.`)) {
      return;
    }
    setRemovingId(friend.friendUser.id);
    try {
      await removeFriend(token, friend.friendUser.id);
      setFriends((prev) => prev.filter((f) => f.friendUser.id !== friend.friendUser.id));
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend');
    } finally {
      setRemovingId(null);
      setActiveMenuFriendId(null);
    }
  };

  const handleInlineAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inlineCode.trim().toUpperCase();
    if (!code) return;

    if (code === myFriendCode?.toUpperCase()) {
      setInlineError("You cannot add yourself as a friend!");
      return;
    }

    setInlineAdding(true);
    setInlineError(null);
    setInlineSuccess(null);

    try {
      const res = await addFriendByCode(token, code);
      if (res.success && res.friend) {
        setInlineSuccess(`Added ${res.friend.friendUser.displayName}! 🔥`);
        setInlineCode('');
        setFriends((prev) => {
          if (prev.some((f) => f.friendUser.id === res.friend.friendUser.id)) return prev;
          return [res.friend, ...prev];
        });
        setTimeout(() => setInlineSuccess(null), 3000);
      }
    } catch (err: any) {
      setInlineError(err.message || 'Failed to add friend');
    } finally {
      setInlineAdding(false);
    }
  };

  // Filtered friends list
  const filteredFriends = useMemo(() => {
    return friends.filter((f) => {
      const matchesSearch =
        f.friendUser.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.friendUser.partnerCode.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterType === 'completed') return f.streak.completedToday;
      if (filterType === 'atRisk') return f.streak.atRisk;
      return true;
    });
  }, [friends, searchQuery, filterType]);

  // Streak Stats
  const totalCompletedToday = useMemo(() => friends.filter((f) => f.streak.completedToday).length, [friends]);
  const totalAtRisk = useMemo(() => friends.filter((f) => f.streak.atRisk).length, [friends]);
  const maxStreak = useMemo(() => {
    if (friends.length === 0) return 0;
    return Math.max(...friends.map((f) => Math.max(f.streak.currentStreak, f.streak.longestStreak || 0)));
  }, [friends]);

  return (
    <div className="w-full space-y-6">
      {/* FULL PAGE HERO HEADER (Only shown in fullPage mode) */}
      {fullPage && (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#171821] via-[#1a1c26] to-[#121319] border border-slate-200 dark:border-white/[0.08] p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-black uppercase tracking-wider">
                <Flame className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span>Snapchat-Style Daily Streaks</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Friends & Streaks 🔥
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                Connect with your friends, stream synchronized cinema, and battle in games daily to keep your flames burning!
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 self-stretch md:self-auto shrink-0">
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#111217]/80 border border-slate-200 dark:border-white/[0.08] text-center shadow-sm">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{friends.length}</div>
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 mt-0.5">Friends</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#111217]/80 border border-slate-200 dark:border-white/[0.08] text-center shadow-sm">
                <div className="text-xl sm:text-2xl font-black text-emerald-500">{totalCompletedToday}</div>
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 mt-0.5">Today 🔥</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#111217]/80 border border-slate-200 dark:border-white/[0.08] text-center shadow-sm">
                <div className="text-xl sm:text-2xl font-black text-amber-500">{maxStreak}d</div>
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 mt-0.5">Record 🏆</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden transition-all">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 shrink-0">
              <Flame className="w-6 h-6 fill-amber-300 text-amber-100 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {fullPage ? 'All Friends & Flame Streaks' : 'Friends & Daily Streaks'}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  🔥 {friends.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Every friend tracks independent daily streaks when watching or playing together.
              </p>
            </div>
          </div>

          {/* Controls: My Code & Add Friend Button */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            {myFriendCode && (
              <button
                onClick={handleCopyCode}
                title="Click to copy your Friend Code"
                className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-100 dark:bg-[#101115] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-zinc-200 transition border border-slate-200 dark:border-white/10 shadow-sm active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                    <span>My Code: <span className="text-rose-600 dark:text-rose-400">{myFriendCode}</span></span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-600/25 transition active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Friend</span>
            </button>
          </div>
        </div>

        {/* INLINE ADD FRIEND CARD (Convenient direct input on page) */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-[#101115] border border-slate-200 dark:border-white/[0.08]">
          <form onSubmit={handleInlineAddFriend} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inlineCode}
                onChange={(e) => {
                  setInlineCode(e.target.value.toUpperCase());
                  setInlineError(null);
                }}
                placeholder="Enter Friend Code (e.g. JAYD91, RAHUL42)"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-xl font-mono text-xs uppercase tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                maxLength={16}
              />
            </div>

            <button
              type="submit"
              disabled={inlineAdding || !inlineCode.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2 shrink-0 active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{inlineAdding ? 'Connecting...' : 'Connect Friend'}</span>
            </button>
          </form>

          {inlineError && (
            <div className="mt-2 text-xs text-rose-500 font-medium">
              ⚠️ {inlineError}
            </div>
          )}

          {inlineSuccess && (
            <div className="mt-2 text-xs text-emerald-500 font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{inlineSuccess}</span>
            </div>
          )}
        </div>

        {/* Filter & Search Bar (Only shown if friends exist or in fullPage mode) */}
        {friends.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends by name or code..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#101115] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  filterType === 'all'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-[#101115] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({friends.length})
              </button>

              <button
                onClick={() => setFilterType('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                  filterType === 'completed'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-[#101115] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Completed</span>
                <span className="text-[10px] opacity-80">({totalCompletedToday})</span>
              </button>

              <button
                onClick={() => setFilterType('atRisk')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                  filterType === 'atRisk'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-[#101115] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>At Risk</span>
                <span className="text-[10px] opacity-80">({totalAtRisk})</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="mt-6">
          {loading && friends.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 text-xs">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span>Loading friend streaks...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchFriends} className="font-bold underline ml-2">
                Retry
              </button>
            </div>
          ) : friends.length === 0 ? (
            /* Empty State */
            <div className="py-12 px-6 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#101115]/50">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 text-amber-500 flex items-center justify-center mb-4 shadow-inner">
                <Flame className="w-8 h-8 fill-amber-400" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                No Friends Connected Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto mb-5 leading-relaxed">
                Add your friends (like Jay or Rahul) using their Friend Code above to track independent daily streaks whenever you watch movies or play games together!
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-600/25 transition active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Your First Friend</span>
              </button>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400">
              No friends match your search or filter.
            </div>
          ) : (
            /* Friends Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFriends.map((item) => {
                const { friendUser, streak } = item;
                const hasStreak = streak.currentStreak > 0;
                const isMenuOpen = activeMenuFriendId === friendUser.id;

                return (
                  <div
                    key={item.friendshipId}
                    className="relative group p-5 rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#101115] hover:border-slate-300 dark:hover:border-white/20 transition shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* User Info & Streak Badge Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center font-bold text-slate-700 dark:text-zinc-200 overflow-hidden shadow-inner text-base">
                              {friendUser.avatarUrl ? (
                                <img
                                  src={friendUser.avatarUrl}
                                  alt={friendUser.displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{friendUser.displayName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#101115] ${
                                friendUser.isOnline
                                  ? 'bg-emerald-500 animate-pulse'
                                  : 'bg-slate-400 dark:bg-zinc-600'
                              }`}
                              title={friendUser.isOnline ? 'Online now' : 'Offline'}
                            />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {friendUser.displayName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                                #{friendUser.partnerCode}
                              </span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  friendUser.isOnline ? 'text-emerald-500' : 'text-slate-400 dark:text-zinc-500'
                                }`}
                              >
                                {friendUser.isOnline ? '● Online' : '○ Offline'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Streak Badge */}
                        <div className="flex flex-col items-end shrink-0">
                          <div
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                              streak.completedToday
                                ? 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                                : streak.atRisk
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400'
                            }`}
                          >
                            <Flame
                              className={`w-4 h-4 ${
                                hasStreak ? 'fill-amber-400 text-amber-500' : 'text-slate-400 dark:text-zinc-500'
                              }`}
                            />
                            <span>{streak.currentStreak} {streak.currentStreak === 1 ? 'Day' : 'Days'}</span>
                          </div>

                          <span className="text-[10px] font-medium mt-1">
                            {streak.completedToday ? (
                              <span className="text-emerald-500 font-semibold">✓ Completed Today</span>
                            ) : streak.atRisk ? (
                              <span className="text-amber-500 font-semibold">⏳ Watch today!</span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-500">Start streak today</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Extra info row */}
                      {streak.totalMinutesWatched > 0 && (
                        <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-500 dark:text-zinc-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{streak.totalMinutesWatched} mins watched together</span>
                          {streak.longestStreak > 0 && (
                            <>
                              <span>•</span>
                              <span>Best: {streak.longestStreak}d record</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Row */}
                    <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onStartWatchPartyWithFriend?.(item)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 transition active:scale-95"
                        >
                          <Tv className="w-3.5 h-3.5" />
                          <span>Watch Together</span>
                        </button>

                        <button
                          onClick={() => onPlayGameWithFriend?.(item)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 transition active:scale-95"
                        >
                          <Gamepad2 className="w-3.5 h-3.5" />
                          <span>Play Game</span>
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenuFriendId(isMenuOpen ? null : friendUser.id)
                          }
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div className="absolute right-0 bottom-full mb-1.5 w-36 bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl py-1.5 z-20">
                            <button
                              disabled={removingId === friendUser.id}
                              onClick={() => handleRemove(item)}
                              className="w-full flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{removingId === friendUser.id ? 'Removing...' : 'Remove Friend'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Friend Modal */}
      <AddFriendModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        myFriendCode={myFriendCode}
        token={token}
        onFriendAdded={(newFriend) => {
          setFriends((prev) => {
            if (prev.some((f) => f.friendUser.id === newFriend.friendUser.id)) return prev;
            return [newFriend, ...prev];
          });
        }}
      />
    </div>
  );
};
