'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
  Search,
  Trophy,
  ChevronRight,
  Link2,
  Video,
  MoreVertical
} from 'lucide-react';
import {
  getFriendsWithStreaks,
  removeFriend,
  getStoredSession,
  FriendWithStreak
} from '../../lib/api';
import { AddFriendModal } from './AddFriendModal';

// Helper to ensure every user & friend has a proper Bitmoji avatar matching the saved section
function getBitmojiAvatarUrl(url?: string, fallbackSeed?: string): string {
  if (url && url.trim() !== '') {
    if (url.startsWith('/avatars/')) return url;
    return url
      .replace(/[?&]radius=[^&]+/g, '')
      .replace(/[?&]backgroundColor=[^&]+/g, '');
  }
  const seed = encodeURIComponent(fallbackSeed || 'watch_avatar');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&skinColor=edb98a&top=shortCurly&hairColor=4a312c&accessoriesProbability=0&clothing=blazerAndShirt&clothesColor=25557c&eyes=wink&mouth=smile`;
}

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
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeMenuFriendId, setActiveMenuFriendId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Search & Filter state (All, Active, Streaks)
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'streaks'>('all');

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
    const session = getStoredSession();
    if (session?.user?.avatarUrl) {
      setMyAvatarUrl(session.user.avatarUrl);
    }
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

  // Stats calculation
  const totalCompletedToday = useMemo(() => friends.filter((f) => f.streak.completedToday).length, [friends]);
  const activeCount = useMemo(() => friends.filter((f) => f.friendUser.isOnline).length, [friends]);
  const streaksCount = useMemo(() => friends.filter((f) => f.streak.currentStreak > 0).length, [friends]);
  const maxStreak = useMemo(() => {
    if (friends.length === 0) return 0;
    return Math.max(...friends.map((f) => Math.max(f.streak.currentStreak, f.streak.longestStreak || 0)));
  }, [friends]);

  // Filtered friends list
  const filteredFriends = useMemo(() => {
    return friends.filter((f) => {
      const matchesSearch =
        f.friendUser.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.friendUser.partnerCode.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeTab === 'active') return f.friendUser.isOnline;
      if (activeTab === 'streaks') return f.streak.currentStreak > 0;
      return true;
    });
  }, [friends, searchQuery, activeTab]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP HEADER ROW (Matching Reference Layout with Theme Colors & Standing Bitmoji) */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Friends & Streaks <span className="text-3xl leading-none">🔥</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Play, watch, and keep your streaks alive with friends.
          </p>
        </div>

        {/* Top Right: 3 Stat Cards + User's Standing Bitmoji (Same as Saved Section) */}
        <div className="flex items-center gap-3 sm:gap-4 self-start md:self-auto">
          {/* Card 1: Friends */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white dark:bg-[#171821] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center justify-center p-3 text-center transition hover:shadow-md">
            <Users className="w-5 h-5 text-slate-400 dark:text-zinc-500 mb-1" />
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {friends.length}
            </div>
            <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              Friends
            </div>
          </div>

          {/* Card 2: Today */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white dark:bg-[#171821] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center justify-center p-3 text-center transition hover:shadow-md">
            <span className="text-lg leading-none mb-1">🔥</span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 leading-tight">
              {totalCompletedToday}
            </div>
            <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              Today
            </div>
          </div>

          {/* Card 3: Record */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white dark:bg-[#171821] border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center justify-center p-3 text-center transition hover:shadow-md">
            <Trophy className="w-5 h-5 text-amber-500 mb-1" />
            <div className="text-xl sm:text-2xl font-black text-amber-500 leading-tight">
              {maxStreak}d
            </div>
            <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              Record
            </div>
          </div>

          {/* User's Saved Bitmoji (Same as Saved Section) */}
          <Link
            href="/profile"
            className="hidden lg:block shrink-0 pl-1 transition-transform duration-300 hover:scale-105 active:scale-95 group"
            title="Your Saved Bitmoji • Click to customize in Profile"
          >
            <div className="w-20 h-24 relative flex items-end justify-center">
              <img
                src={getBitmojiAvatarUrl(myAvatarUrl)}
                alt="Your Saved Bitmoji"
                className="h-24 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)] filter"
              />
            </div>
          </Link>
        </div>
      </div>

      {/* 2. ADD FRIEND ROW (Theme Colors: Rose Gradient Button, Opens Modal) */}
      <div className="rounded-3xl bg-slate-50/90 dark:bg-[#171821] border border-slate-200/80 dark:border-white/10 p-3 sm:p-4 flex items-center justify-between gap-4 shadow-sm">
        <div
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-3.5 pl-2 cursor-pointer select-none group min-w-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
              Add a friend by code
            </div>
            <div className="text-xs text-slate-400 dark:text-zinc-500 truncate">
              E.g. JAYD91, RAHUL42 • Tap to enter friend code
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 sm:px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-rose-600/20 transition shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Friend</span>
        </button>
      </div>

      {/* 3. TABS & SEARCH ROW (Active Tab: Rose Underline, Search Pill) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        {/* Left Side: Tabs */}
        <div className="flex items-center space-x-6 border-b border-slate-200/60 dark:border-white/5 sm:border-none pb-2 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`relative pb-2 text-sm font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>All ({friends.length})</span>
            {activeTab === 'all' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`relative pb-2 text-sm font-bold transition flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Active ({activeCount})</span>
            {activeTab === 'active' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('streaks')}
            className={`relative pb-2 text-sm font-bold transition flex items-center gap-1.5 ${
              activeTab === 'streaks'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Streaks ({streaksCount})</span>
            {activeTab === 'streaks' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Right Side: Pill Search Input */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50/90 dark:bg-[#171821] border border-slate-200/80 dark:border-white/10 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
        </div>
      </div>

      {/* 4. FRIEND CARDS LIST (Bitmoji Avatar & Theme Colored Play/Watch Buttons) */}
      <div className="space-y-3 pt-2">
        {loading && friends.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 text-xs">
            <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span>Loading friends...</span>
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
          <div className="py-16 px-6 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#171821]/40">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
              <Users className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
              No Friends Added Yet
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
              Add your friends using their Friend Code to start building your daily streaks together!
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Your First Friend</span>
            </button>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400">
            No friends match your search.
          </div>
        ) : (
          filteredFriends.map((item) => {
            const { friendUser, streak } = item;
            const isMenuOpen = activeMenuFriendId === friendUser.id;
            const bitmojiUrl = getBitmojiAvatarUrl(friendUser.avatarUrl, friendUser.displayName);

            return (
              <div
                key={item.friendshipId}
                className="relative group p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#171821] hover:border-slate-300 dark:hover:border-white/20 transition shadow-sm hover:shadow-md flex items-center justify-between gap-4"
              >
                {/* Left Side: Bitmoji Avatar & Friend Info */}
                <div className="flex items-center space-x-3.5 min-w-0">
                  {/* Bitmoji Circular Container (Theme Styling) */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-inner p-0.5">
                      <img
                        src={bitmojiUrl}
                        alt={friendUser.displayName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {/* Status Dot: Green if Online, Grey if Offline */}
                    <span
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#171821] ${
                        friendUser.isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-zinc-500'
                      }`}
                      title={friendUser.isOnline ? 'Online now' : 'Offline'}
                    />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {friendUser.displayName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                        #{friendUser.partnerCode}
                      </span>
                      {/* Status Pill Badge */}
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 font-medium">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            friendUser.isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-zinc-500'
                          }`}
                        />
                        <span>{friendUser.isOnline ? 'Online' : 'Offline'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Streak Pill + Action Buttons */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                  {/* Streak Pill */}
                  <div
                    className={`hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                      streak.completedToday
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm'
                        : streak.atRisk
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <span>🔥</span>
                    <span>{streak.currentStreak} days</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                  </div>

                  {/* Watch Button (Square with Camera icon & "Watch" label) */}
                  <button
                    onClick={() => onStartWatchPartyWithFriend?.(item)}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white dark:bg-[#101115] hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center text-slate-700 dark:text-zinc-200 transition shadow-sm active:scale-95"
                    title="Watch Together"
                  >
                    <Video className="w-5 h-5 text-slate-800 dark:text-white" />
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-1">
                      Watch
                    </span>
                  </button>

                  {/* Play Button (Theme Colored Rose/Amber with Gamepad icon & "Play" label) */}
                  <button
                    onClick={() => onPlayGameWithFriend?.(item)}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white flex flex-col items-center justify-center transition shadow-md shadow-rose-600/20 active:scale-95"
                    title="Play Game"
                  >
                    <Gamepad2 className="w-5 h-5 text-white" />
                    <span className="text-[11px] font-bold text-white mt-1">
                      Play
                    </span>
                  </button>

                  {/* Dropdown Menu (3 dots) */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenuFriendId(isMenuOpen ? null : friendUser.id)
                      }
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-2 w-36 bg-white dark:bg-[#171821] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl py-1.5 z-20">
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
          })
        )}
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
