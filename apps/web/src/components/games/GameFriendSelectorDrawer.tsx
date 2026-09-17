'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  Flame,
  Check,
  Play,
  UserPlus,
  RefreshCw,
  Gamepad2
} from 'lucide-react';
import {
  FriendWithStreak,
  getFriendsWithStreaks,
  connectUserPartner
} from '../../lib/api';

// Dicebear Bitmoji avatar helper
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

export interface GameFriendSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  currentPartnerId?: string | null;
  currentPartnerCode?: string | null;
  gameTitle: string; // e.g. "Ludo" or "Four in a Row"
  onSelectFriend: (friend: FriendWithStreak) => void;
  onPlayWithFriend?: (friend: FriendWithStreak) => void;
  onOpenAddFriend?: () => void;
}

export const GameFriendSelectorDrawer: React.FC<GameFriendSelectorDrawerProps> = ({
  isOpen,
  onClose,
  token,
  currentPartnerId,
  currentPartnerCode,
  gameTitle,
  onSelectFriend,
  onPlayWithFriend,
  onOpenAddFriend
}) => {
  const [friends, setFriends] = useState<FriendWithStreak[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectingFriendId, setSelectingFriendId] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load friends whenever drawer opens
  const fetchFriends = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFriendsWithStreaks(token);
      setFriends(data.friends || []);
    } catch (err: any) {
      console.error('Failed to load friends for game selector:', err);
      setError('Could not load your friends list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchFriends();
      setSearchQuery('');
    }
  }, [isOpen, token]);

  // Filtered friends
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase().trim();
    return friends.filter(
      (f) =>
        f.friendUser.displayName.toLowerCase().includes(query) ||
        f.friendUser.partnerCode.toLowerCase().includes(query)
    );
  }, [friends, searchQuery]);

  const handleSelect = async (friend: FriendWithStreak, playImmediately = false) => {
    setSelectingFriendId(friend.friendUser.id);
    try {
      if (token) {
        // Sync active connection in background
        await connectUserPartner(token, friend.friendUser.partnerCode, friend.friendUser.id).catch(() => {});
      }
      onSelectFriend(friend);
      if (playImmediately && onPlayWithFriend) {
        onPlayWithFriend(friend);
      }
      onClose();
    } finally {
      setSelectingFriendId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-md pointer-events-auto bg-white dark:bg-[#130d19] border-l border-zinc-200 dark:border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
          
          {/* Header */}
          <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-rose-50/50 to-transparent dark:from-rose-950/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ee1d49]/10 dark:bg-[#ee1d49]/20 text-[#ee1d49] flex items-center justify-center font-bold">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  Choose Player
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ee1d49]/10 text-[#ee1d49]">
                    {friends.length}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select who to play {gameTitle} with
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={fetchFriends}
                title="Refresh friends"
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ee1d49]' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="p-4 border-b border-zinc-100 dark:border-white/5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search friend by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-[#ee1d49]/30 focus:border-[#ee1d49] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Content / Friends List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isLoading && friends.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-9 h-9 border-3 border-[#ee1d49] border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Loading your friends...</p>
              </div>
            ) : error ? (
              <div className="py-8 text-center px-4">
                <p className="text-xs text-rose-500 font-medium mb-3">{error}</p>
                <button
                  type="button"
                  onClick={fetchFriends}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 transition"
                >
                  Try Again
                </button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  {searchQuery ? 'No friends matched your search' : 'No friends yet'}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-4">
                  {searchQuery
                    ? 'Check spelling or try searching for their partner code.'
                    : 'Add friends to play games together and build daily watch streaks! 🔥'}
                </p>
                {onOpenAddFriend && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddFriend();
                    }}
                    className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-[#ee1d49] text-white text-xs font-semibold shadow-md hover:bg-[#d6143c] transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Add Friends</span>
                  </button>
                )}
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const isCurrent =
                  friend.friendUser.id === currentPartnerId ||
                  (currentPartnerCode && friend.friendUser.partnerCode.toUpperCase() === currentPartnerCode.toUpperCase());
                const isSelecting = selectingFriendId === friend.friendUser.id;

                return (
                  <div
                    key={friend.friendshipId || friend.friendUser.id}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
                      isCurrent
                        ? 'bg-rose-50/70 dark:bg-rose-950/20 border-[#ee1d49]/30 ring-1 ring-[#ee1d49]/20'
                        : 'bg-zinc-50/70 dark:bg-white/5 border-zinc-200/70 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={getBitmojiAvatarUrl(friend.friendUser.avatarUrl, friend.friendUser.displayName)}
                            alt={friend.friendUser.displayName}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800 shadow-xs bg-zinc-100"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 ring-1 ring-white/50">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                friend.friendUser.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                              }`}
                            />
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                              {friend.friendUser.displayName}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-[#ee1d49] text-white text-[9px] font-bold tracking-wide uppercase">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                Active
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="font-mono text-zinc-600 dark:text-zinc-300 font-medium">
                              #{friend.friendUser.partnerCode}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5 font-bold text-amber-500">
                              <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>{friend.streak?.currentStreak ?? 0}d</span>
                            </span>
                          </div>

                          <p className="text-[10px] mt-0.5 text-zinc-400 dark:text-zinc-500">
                            {friend.friendUser.isOnline ? (
                              <span className="text-emerald-500 dark:text-emerald-400 font-medium">Online now</span>
                            ) : (
                              'Offline'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent ? (
                          onPlayWithFriend && (
                            <button
                              type="button"
                              disabled={isSelecting}
                              onClick={() => handleSelect(friend, true)}
                              className="py-1.5 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-semibold text-xs shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play</span>
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isSelecting}
                              onClick={() => handleSelect(friend, false)}
                              className="py-1.5 px-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              Select
                            </button>
                            {onPlayWithFriend && (
                              <button
                                type="button"
                                disabled={isSelecting}
                                onClick={() => handleSelect(friend, true)}
                                className="py-1.5 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-semibold text-xs shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Play</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5 flex items-center justify-between gap-2 shrink-0">
            {onOpenAddFriend ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddFriend();
                }}
                className="text-xs font-semibold text-[#ee1d49] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add more friends</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-400">
                Playing with friends preserves streaks! 🔥
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
            >
              Done
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
