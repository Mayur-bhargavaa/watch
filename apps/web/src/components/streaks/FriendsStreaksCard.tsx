'use client';

import React, { useState, useEffect } from 'react';
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
  MoreVertical
} from 'lucide-react';
import {
  getFriendsWithStreaks,
  removeFriend,
  FriendWithStreak
} from '../../lib/api';
import { AddFriendModal } from './AddFriendModal';

interface FriendsStreaksCardProps {
  token: string;
  onStartWatchPartyWithFriend?: (friend: FriendWithStreak) => void;
  onPlayGameWithFriend?: (friend: FriendWithStreak) => void;
}

export const FriendsStreaksCard: React.FC<FriendsStreaksCardProps> = ({
  token,
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
    // Poll every 25 seconds for online presence and streaks update
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

  return (
    <div className="bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden transition-all">
      {/* Background ambient glow */}
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-gradient-to-br from-rose-500/10 to-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-zinc-800/70">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <Flame className="w-6 h-6 fill-amber-300 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Friends & Daily Streaks
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                🔥 {friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Watch videos or play games together daily to keep your flames burning!
            </p>
          </div>
        </div>

        {/* Action Controls: My Code & Add Friend */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {myFriendCode && (
            <button
              onClick={handleCopyCode}
              title="Click to copy your Friend Code"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/80 text-slate-800 dark:text-zinc-200 transition border border-slate-200 dark:border-zinc-700/60"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                  <span className="text-rose-600 dark:text-rose-400">{myFriendCode}</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-md shadow-rose-600/20 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Friend</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-5">
        {loading && friends.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 text-xs">
            <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span>Loading friend streaks...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchFriends}
              className="font-bold underline ml-2"
            >
              Retry
            </button>
          </div>
        ) : friends.length === 0 ? (
          /* Empty State */
          <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
              <Users className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">
              No Friends Added Yet
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
              Add your friends (like Jay or Rahul) using their Friend Code to track independent daily streaks whenever you watch or play together!
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Your First Friend</span>
            </button>
          </div>
        ) : (
          /* Friends List */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {friends.map((item) => {
              const { friendUser, streak } = item;
              const hasStreak = streak.currentStreak > 0;
              const isMenuOpen = activeMenuFriendId === friendUser.id;

              return (
                <div
                  key={item.friendshipId}
                  className="relative group p-4 rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-950/60 hover:border-slate-300 dark:hover:border-zinc-700/80 transition shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* User info */}
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center font-bold text-slate-700 dark:text-zinc-200 overflow-hidden shadow-inner">
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
                        {/* Live presence indicator */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-950 ${
                            friendUser.isOnline
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-slate-400 dark:bg-zinc-600'
                          }`}
                          title={friendUser.isOnline ? 'Online now' : 'Offline'}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {friendUser.displayName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono font-semibold text-slate-400 dark:text-zinc-500">
                            #{friendUser.partnerCode}
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${
                              friendUser.isOnline
                                ? 'text-emerald-500'
                                : 'text-slate-400 dark:text-zinc-500'
                            }`}
                          >
                            {friendUser.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Streak Badge */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-black border transition ${
                          streak.completedToday
                            ? 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400'
                            : streak.atRisk
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                            : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        <Flame
                          className={`w-3.5 h-3.5 ${
                            hasStreak ? 'fill-amber-400 text-amber-500' : 'text-slate-400 dark:text-zinc-500'
                          }`}
                        />
                        <span>{streak.currentStreak} Days</span>
                      </div>

                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium mt-1">
                        {streak.completedToday ? (
                          <span className="text-emerald-500 font-semibold">✓ Completed Today</span>
                        ) : streak.atRisk ? (
                          <span className="text-amber-500 font-semibold">⏳ Watch today!</span>
                        ) : (
                          'Start today'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Row */}
                  <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-zinc-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onStartWatchPartyWithFriend?.(item)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 transition"
                      >
                        <Tv className="w-3 h-3" />
                        <span>Watch</span>
                      </button>

                      <button
                        onClick={() => onPlayGameWithFriend?.(item)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 transition"
                      >
                        <Gamepad2 className="w-3 h-3" />
                        <span>Game</span>
                      </button>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuFriendId(isMenuOpen ? null : friendUser.id)
                        }
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800 transition"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-1 w-36 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-20">
                          <button
                            disabled={removingId === friendUser.id}
                            onClick={() => handleRemove(item)}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
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
