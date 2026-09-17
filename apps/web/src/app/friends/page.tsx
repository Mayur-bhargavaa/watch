'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Flame,
  Search,
  Copy,
  Check,
  X,
  Sparkles,
  Clock,
  Inbox,
  UserCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  Share2,
  Film,
  Gamepad2,
  Tv,
  Heart,
  MoreVertical,
  Play,
  Video,
  ArrowRight,
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  Settings,
  Shield,
  ExternalLink,
  ChevronRight,
  Send,
  Trash2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  clearStoredSession,
  getDiscoverableUsers,
  getFriendRequests,
  getFriendsWithStreaks,
  addFriendByCode,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  createPartyRoom,
  connectUserPartner,
  FriendWithStreak,
  FriendRequestsData,
  DiscoverableUserItem,
  UserSession
} from '../../lib/api';

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

function FriendsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'discover' | 'requests' | 'friends') || 'discover';
  const urlFriendCode = searchParams.get('code') || searchParams.get('partnerCode');

  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Session state
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Active Tab: 'discover' | 'requests' | 'friends'
  const [activeTab, setActiveTab] = useState<'discover' | 'requests' | 'friends'>(initialTab);

  // Code input
  const [friendCodeInput, setFriendCodeInput] = useState(urlFriendCode ? urlFriendCode.toUpperCase() : '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data states
  const [friends, setFriends] = useState<FriendWithStreak[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [myFriendCode, setMyFriendCode] = useState('');

  const [discoverUsers, setDiscoverUsers] = useState<DiscoverableUserItem[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverFilter, setDiscoverFilter] = useState<'all' | 'online'>('all');

  const [requests, setRequests] = useState<FriendRequestsData>({ incoming: [], outgoing: [] });
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  // Game/Room launch loading
  const [launchingActionId, setLaunchingActionId] = useState<string | null>(null);
  const [activeFriendMenuId, setActiveFriendMenuId] = useState<string | null>(null);

  // Load Session
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      if (s.user?.partnerCode) {
        setMyFriendCode(s.user.partnerCode);
      }
    } else {
      router.push('/login?redirect=/friends');
    }
    setSessionLoaded(true);
  }, [router]);

  // Load all data
  const loadAllFriendsData = async () => {
    if (!session?.token) return;
    setLoadingFriends(true);
    setLoadingRequests(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        getFriendsWithStreaks(session.token).catch(() => ({ friends: [], myFriendCode: '' })),
        getFriendRequests(session.token).catch(() => ({ incoming: [], outgoing: [] }))
      ]);
      setFriends(friendsRes.friends || []);
      if (friendsRes.myFriendCode) {
        setMyFriendCode(friendsRes.myFriendCode);
      }
      setRequests(requestsRes);
    } catch (err) {
      console.error('Error fetching friends data:', err);
    } finally {
      setLoadingFriends(false);
      setLoadingRequests(false);
    }
  };

  const loadDiscoverDirectory = async (search?: string) => {
    if (!session?.token) return;
    setLoadingDiscover(true);
    try {
      const res = await getDiscoverableUsers(session.token, search);
      setDiscoverUsers(res.users || []);
    } catch (err) {
      console.error('Error fetching discoverable users:', err);
    } finally {
      setLoadingDiscover(false);
    }
  };

  useEffect(() => {
    if (session?.token) {
      loadAllFriendsData();
      loadDiscoverDirectory();
    }
  }, [session]);

  // Debounce discover search
  useEffect(() => {
    if (!session?.token) return;
    const timer = setTimeout(() => {
      loadDiscoverDirectory(discoverSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [discoverSearch, session]);

  // Copy Friend Code
  const handleCopyCode = async () => {
    if (!myFriendCode) return;
    try {
      await navigator.clipboard.writeText(myFriendCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  // Copy or Share Invite Link
  const handleCopyInviteLink = async () => {
    if (!myFriendCode) return;
    const inviteUrl = `${window.location.origin}/friends?code=${myFriendCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join me on SyncCinema!',
          text: `Add me as a friend on SyncCinema using my code ${myFriendCode} to watch movies and play games together! 🔥`,
          url: inviteUrl
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedInviteLink(true);
        setTimeout(() => setCopiedInviteLink(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteLink(true);
      setTimeout(() => setCopiedInviteLink(false), 2000);
    }
  };

  // Add friend by code input
  const handleAddByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = friendCodeInput.trim().toUpperCase();
    if (!code || !session?.token) return;

    if (code === myFriendCode?.toUpperCase()) {
      setFeedback({ type: 'error', message: 'You cannot add yourself as a friend!' });
      return;
    }

    setSubmittingCode(true);
    setFeedback(null);
    try {
      const res = await addFriendByCode(session.token, code);
      if (res.success) {
        if (res.status === 'ACCEPTED' && res.friend) {
          setFeedback({
            type: 'success',
            message: `🎉 You and ${res.friend.friendUser.displayName} are now friends! Streak started 🔥`
          });
          setFriends((prev) => [res.friend!, ...prev]);
        } else {
          setFeedback({
            type: 'success',
            message: res.message || `Friend request sent to #${code}!`
          });
        }
        setFriendCodeInput('');
        await loadAllFriendsData();
        await loadDiscoverDirectory(discoverSearch);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send friend request. Please check the code.'
      });
    } finally {
      setSubmittingCode(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Add friend directly from discover directory card
  const handleAddFromDirectory = async (user: DiscoverableUserItem) => {
    if (!session?.token) return;
    setSendingUserId(user.id);
    try {
      const res = await addFriendByCode(session.token, user.partnerCode);
      if (res.success) {
        if (res.status === 'ACCEPTED' && res.friend) {
          setFeedback({
            type: 'success',
            message: `🎉 You and ${user.displayName} are now friends!`
          });
          setFriends((prev) => [res.friend!, ...prev]);
        } else {
          setFeedback({
            type: 'success',
            message: `Friend request sent to ${user.displayName}!`
          });
        }
        await loadAllFriendsData();
        await loadDiscoverDirectory(discoverSearch);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send request.' });
    } finally {
      setSendingUserId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Accept incoming request
  const handleAccept = async (senderUserId: string, displayName: string) => {
    if (!session?.token) return;
    setActionLoadingId(senderUserId);
    try {
      const res = await acceptFriendRequest(session.token, senderUserId);
      if (res.success && res.friend) {
        setFeedback({
          type: 'success',
          message: `🎉 You and ${displayName} are now friends! Daily streak unlocked 🔥`
        });
        setFriends((prev) => [res.friend!, ...prev]);
        await loadAllFriendsData();
        await loadDiscoverDirectory(discoverSearch);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept request.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Decline incoming request
  const handleDecline = async (senderUserId: string) => {
    if (!session?.token) return;
    setActionLoadingId(senderUserId);
    try {
      await declineFriendRequest(session.token, senderUserId);
      await loadAllFriendsData();
      await loadDiscoverDirectory(discoverSearch);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to decline request.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Cancel outgoing sent request
  const handleCancelOutgoing = async (targetUserId: string) => {
    if (!session?.token) return;
    setActionLoadingId(targetUserId);
    try {
      await cancelFriendRequest(session.token, targetUserId);
      await loadAllFriendsData();
      await loadDiscoverDirectory(discoverSearch);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to cancel request.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Remove a friend
  const handleRemoveFriend = async (friendUserId: string, name: string) => {
    if (!session?.token) return;
    if (!confirm(`Are you sure you want to remove ${name} from your friends?`)) return;
    try {
      await removeFriend(session.token, friendUserId);
      setFriends((prev) => prev.filter((f) => f.friendUser.id !== friendUserId));
      setActiveFriendMenuId(null);
      setFeedback({ type: 'success', message: `${name} has been removed from your friends.` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove friend.' });
    }
  };

  // Start watch party with a friend
  const handleWatchPartyWithFriend = async (friend: FriendWithStreak) => {
    if (!session?.token) return;
    setLaunchingActionId(friend.friendUser.id);
    try {
      // Connect partner in background so they are the connected partner
      await connectUserPartner(session.token, friend.friendUser.partnerCode, friend.friendUser.id).catch(() => {});
      const res = await createPartyRoom(session.token, {
        title: `Cinema with ${friend.friendUser.displayName}`,
        videoUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
        type: 'youtube',
        maxCapacity: 6,
        playbackMode: 'together',
        privacy: 'public'
      });
      router.push(`/room/${res.room.slug}`);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create watch party.' });
      setLaunchingActionId(null);
    }
  };

  // Launch Ludo or Four-in-a-Row with friend
  const handlePlayGame = (friend: FriendWithStreak, game: 'ludo' | 'four-in-a-row') => {
    router.push(`/games/${game}?partnerCode=${friend.friendUser.partnerCode}`);
  };

  // Filtered discover users
  const filteredDiscoverUsers = useMemo(() => {
    return discoverUsers;
  }, [discoverUsers]);

  // Overall Streaks count
  const totalStreaksCount = useMemo(() => {
    return friends.filter((f) => f.streak && f.streak.currentStreak > 0).length;
  }, [friends]);

  if (!sessionLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#ee1d49] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-[#0f0b17] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR NAVIGATION (Matching SyncCinema Design System)             */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-white dark:bg-[#130e1b] border-r border-slate-200/80 dark:border-white/[0.06] p-6 flex flex-col justify-between shrink-0 hidden lg:flex select-none transition-colors sticky top-0 h-screen z-30">
        <div className="space-y-8">
          {/* Logo: Watch. with Bold Red Dot */}
          <Link href="/dashboard" className="flex items-center space-x-3 cursor-pointer group">
            <div className="p-1.5 bg-[#ee1d49] rounded-xl text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Watch<span className="text-[#ee1d49] text-2xl leading-none">.</span>
              </span>
              <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500 tracking-widest uppercase mt-0.5">
                Powered by StitchByte
              </span>
            </div>
          </Link>

          {/* Navigation Groups */}
          <div className="space-y-6">
            {/* Nav Group 1: Menu */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 mb-2">
                Menu
              </div>
              <Link
                href="/dashboard"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Film className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Browse Cinema</span>
              </Link>

              <Link
                href="/dashboard?tab=watchlist"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Heart className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Watchlist</span>
              </Link>
            </div>

            {/* Nav Group 2: Social */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 mb-2">
                Social
              </div>

              {/* Active: Friends & Streaks */}
              <Link
                href="/friends"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-[#ee1d49] before:rounded-r transition"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Flame className="w-4 h-4 text-[#ee1d49] fill-[#ee1d49]/20 shrink-0" />
                  <span className="truncate whitespace-nowrap">Friends & Streaks</span>
                </div>
                {requests.incoming.length > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#ee1d49] text-white font-black text-[10px] leading-none animate-pulse">
                    {requests.incoming.length}
                  </span>
                ) : (
                  <span className="text-sm shrink-0 leading-none pl-2">🔥</span>
                )}
              </Link>

              <Link
                href="/dashboard?tab=myrooms"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Users className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>My Rooms</span>
              </Link>

              <Link
                href="/games/ludo"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Gamepad2 className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Ludo Arena</span>
                <span className="ml-auto text-[9px] bg-[#ee1d49]/10 text-[#ee1d49] font-bold px-1.5 py-0.5 rounded-md">
                  HOT
                </span>
              </Link>

              <Link
                href="/games/four-in-a-row"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition"
              >
                <Gamepad2 className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
                <span>Four in a Row</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Theme toggle & User card */}
        <div className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition"
          >
            <div className="flex items-center space-x-2">
              {isDark ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">Toggle</span>
          </button>

          {session?.user && (
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100/80 dark:bg-white/[0.04]">
              <div className="flex items-center space-x-2.5 min-w-0">
                <img
                  src={getBitmojiAvatarUrl(session.user.avatarUrl, session.user.displayName)}
                  alt={session.user.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {session.user.displayName}
                  </p>
                  <p className="text-[10px] font-mono text-[#ee1d49] truncate">
                    #{myFriendCode || session.user.partnerCode || 'USER'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearStoredSession();
                  router.push('/login');
                }}
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT STAGE                                                     */}
      {/* ========================================================================= */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-[#130e1b] border-b border-slate-200 dark:border-white/10 sticky top-0 z-40">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="p-1.5 bg-[#ee1d49] rounded-xl text-white">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-lg font-black tracking-tight">
              Watch<span className="text-[#ee1d49]">.</span>
            </span>
          </Link>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold"
            >
              Back to Cinema
            </Link>
          </div>
        </div>

        {/* Inner Container */}
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-fadeIn">
          
          {/* Top Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold transition-all animate-fadeIn ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HERO SECTION & QUICK SHARE CARD                                           */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Hero Left: Heading & Intro */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ee1d49]/10 text-[#ee1d49] text-xs font-bold tracking-wide uppercase w-fit">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>SyncCinema Social Hub</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
                Friends & <span className="text-[#ee1d49]">Requests</span>
              </h1>

              <p className="text-xs sm:text-sm lg:text-base text-slate-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                Connect with your movie companions, challenge players to games, manage invitations, and keep your daily watch streaks alive! 🔥
              </p>

              {/* Quick Stat Chips */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#161020] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{friends.length}</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 ml-1.5 font-medium">Friends</span>
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#161020] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                    <Flame className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{totalStreaksCount}</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 ml-1.5 font-medium">Active Streaks</span>
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#161020] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#ee1d49]/10 text-[#ee1d49] flex items-center justify-center font-bold text-xs">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{requests.incoming.length}</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 ml-1.5 font-medium">Pending</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Right: Your Friend Code & Quick Share Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#fff5f7] to-white dark:from-[#1b1224] dark:to-[#130e1b] border border-[#fde4eb] dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#ee1d49] text-white flex items-center justify-center shadow-xs">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Your Friend Code
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Share with friends to connect</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Active
                </span>
              </div>

              {/* Code Display Box */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-black/40 border border-rose-100 dark:border-white/5 flex items-center justify-between gap-3">
                <div className="font-mono text-xl sm:text-2xl font-black tracking-widest text-[#ee1d49]">
                  {myFriendCode || 'LOADING...'}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              {/* Quick Share Link Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#ee1d49]" />
                  <span>{copiedInviteLink ? 'Link Copied!' : 'Share Direct Invite Link'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* TAB NAVIGATION BAR                                                        */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 gap-3 overflow-x-auto pb-1">
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              
              {/* Tab 1: Discover & Add */}
              <button
                type="button"
                onClick={() => setActiveTab('discover')}
                className={`pb-3.5 px-2 text-xs sm:text-sm font-bold flex items-center gap-2 transition relative cursor-pointer ${
                  activeTab === 'discover'
                    ? 'text-[#ee1d49]'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Discover & Add</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
                  {discoverUsers.length}
                </span>
                {activeTab === 'discover' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ee1d49] rounded-full" />
                )}
              </button>

              {/* Tab 2: Requests Inbox */}
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`pb-3.5 px-2 text-xs sm:text-sm font-bold flex items-center gap-2 transition relative cursor-pointer ${
                  activeTab === 'requests'
                    ? 'text-[#ee1d49]'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>Requests</span>
                {requests.incoming.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#ee1d49] text-white animate-pulse">
                    {requests.incoming.length}
                  </span>
                )}
                {activeTab === 'requests' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ee1d49] rounded-full" />
                )}
              </button>

              {/* Tab 3: My Friends & Streaks */}
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`pb-3.5 px-2 text-xs sm:text-sm font-bold flex items-center gap-2 transition relative cursor-pointer ${
                  activeTab === 'friends'
                    ? 'text-[#ee1d49]'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>My Friends</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
                  {friends.length}
                </span>
                {activeTab === 'friends' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ee1d49] rounded-full" />
                )}
              </button>

            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                loadAllFriendsData();
                loadDiscoverDirectory(discoverSearch);
              }}
              title="Refresh Data"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDiscover || loadingFriends || loadingRequests ? 'animate-spin text-[#ee1d49]' : ''}`} />
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1 CONTENT: DISCOVER & ADD PEOPLE                                      */}
          {/* ========================================================================= */}
          {activeTab === 'discover' && (
            <div className="space-y-6">
              
              {/* Card A: Add Friend by Code Input */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#ee1d49]" />
                      <span>Have a Friend&apos;s Code?</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Enter any user&apos;s Partner Code directly to send an instant friend request.
                    </p>
                  </div>

                  <form onSubmit={handleAddByCode} className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={friendCodeInput}
                      onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                      placeholder="E.G. JAYD91, RAHUL42"
                      className="w-full sm:w-64 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ee1d49]/30 focus:border-[#ee1d49] transition"
                    />
                    <button
                      type="submit"
                      disabled={submittingCode || !friendCodeInput.trim()}
                      className="py-2.5 px-5 rounded-2xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#ee1d49]/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingCode ? 'Sending...' : 'Send'}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Directory Search & Filter Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>People on SyncCinema</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ee1d49]/10 text-[#ee1d49]">
                      {filteredDiscoverUsers.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Find active users, send friend requests, and start playing games together.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={discoverSearch}
                    onChange={(e) => setDiscoverSearch(e.target.value)}
                    placeholder="Search by name or code..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ee1d49]/30 transition"
                  />
                  {discoverSearch && (
                    <button
                      type="button"
                      onClick={() => setDiscoverSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* User Directory Grid */}
              {loadingDiscover && discoverUsers.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 border-3 border-[#ee1d49] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Discovering SyncCinema users...</p>
                </div>
              ) : filteredDiscoverUsers.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 rounded-3xl p-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">
                    {discoverSearch ? 'No users found matching your search' : 'No users found'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                    {discoverSearch
                      ? 'Try searching by a different name or exact partner code.'
                      : 'Share your friend code to invite companions to SyncCinema!'}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="py-2 px-4 rounded-xl bg-[#ee1d49] text-white text-xs font-bold shadow-xs hover:bg-[#d6143c] transition"
                  >
                    Share Your Code
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDiscoverUsers.map((user) => {
                    const isSending = sendingUserId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="p-4 rounded-3xl bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        {/* Top: Avatar & Info */}
                        <div className="flex items-center gap-3.5">
                          <div className="relative shrink-0">
                            <img
                              src={getBitmojiAvatarUrl(user.avatarUrl, user.displayName)}
                              alt={user.displayName}
                              className="w-13 h-13 rounded-full object-cover ring-2 ring-white dark:ring-white/10 shadow-xs bg-slate-100"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {user.displayName}
                            </h4>
                            <p className="text-xs font-mono text-[#ee1d49] font-semibold truncate">
                              #{user.partnerCode}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1">
                              <span>SyncCinema Explorer</span>
                            </p>
                          </div>
                        </div>

                        {/* Bottom Action Button */}
                        <div>
                          {user.requestStatus === 'SENT' ? (
                            <button
                              type="button"
                              onClick={() => handleCancelOutgoing(user.id)}
                              className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-zinc-300 hover:text-rose-600 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Request Sent • Cancel</span>
                            </button>
                          ) : user.requestStatus === 'RECEIVED' ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAccept(user.id, user.displayName)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDecline(user.id)}
                                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 text-xs font-semibold transition cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => handleAddFromDirectory(user)}
                              className="w-full py-2 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold shadow-sm shadow-[#ee1d49]/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>{isSending ? 'Sending...' : '+ Add Friend'}</span>
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2 CONTENT: REQUESTS INBOX & SENT                                      */}
          {/* ========================================================================= */}
          {activeTab === 'requests' && (
            <div className="space-y-8">
              
              {/* Section A: Incoming Requests */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Inbox className="w-4 h-4 text-[#ee1d49]" />
                      <span>Incoming Requests</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ee1d49]/10 text-[#ee1d49]">
                        {requests.incoming.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      People who want to become friends with you on SyncCinema.
                    </p>
                  </div>
                </div>

                {requests.incoming.length === 0 ? (
                  <div className="py-12 text-center bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">
                      No incoming requests
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                      You&apos;re all caught up! Share your friend code with friends to connect.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {requests.incoming.map((req) => {
                      const isLoadingThis = actionLoadingId === req.user.id;

                      return (
                        <div
                          key={req.requestId}
                          className="p-4.5 rounded-3xl bg-white dark:bg-[#150f1d] border border-[#ee1d49]/20 ring-1 ring-[#ee1d49]/10 shadow-xs flex flex-col justify-between space-y-4"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={getBitmojiAvatarUrl(req.user.avatarUrl, req.user.displayName)}
                              alt={req.user.displayName}
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-white/10 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {req.user.displayName}
                              </h4>
                              <p className="text-xs font-mono text-[#ee1d49] font-bold truncate">
                                #{req.user.partnerCode}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                Sent {new Date(req.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleAccept(req.user.id, req.user.displayName)}
                              className="flex-1 py-2 px-3.5 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isLoadingThis ? 'Accepting...' : 'Accept'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleDecline(req.user.id)}
                              className="py-2 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-zinc-300 text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section B: Sent Requests (Outgoing) */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Sent Requests (Pending)</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
                        {requests.outgoing.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Requests you sent that haven&apos;t been accepted yet.
                    </p>
                  </div>
                </div>

                {requests.outgoing.length === 0 ? (
                  <div className="py-8 text-center bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 text-xs text-slate-400 dark:text-zinc-500">
                    No pending sent requests.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {requests.outgoing.map((req) => {
                      const isLoadingThis = actionLoadingId === req.user.id;

                      return (
                        <div
                          key={req.requestId}
                          className="p-4 rounded-3xl bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={getBitmojiAvatarUrl(req.user.avatarUrl, req.user.displayName)}
                              alt={req.user.displayName}
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                {req.user.displayName}
                              </h4>
                              <p className="text-[11px] font-mono text-[#ee1d49]">
                                #{req.user.partnerCode}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleCancelOutgoing(req.user.id)}
                            className="py-1.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3 CONTENT: MY FRIENDS & STREAKS                                       */}
          {/* ========================================================================= */}
          {activeTab === 'friends' && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span>Your Connected Friends</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ee1d49]/10 text-[#ee1d49]">
                      {friends.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Watch movies or play arena games together to increase your daily streak count!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('discover')}
                  className="py-2 px-4 rounded-2xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 w-fit cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Find More Friends</span>
                </button>
              </div>

              {loadingFriends && friends.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 border-3 border-[#ee1d49] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading your friends list...</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 rounded-3xl p-8">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <Flame className="w-6 h-6 fill-current" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">
                    No friends connected yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                    Head over to the &quot;Discover &amp; Add&quot; tab to search active players or invite your loved ones!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('discover')}
                    className="py-2 px-4 rounded-xl bg-[#ee1d49] text-white text-xs font-bold shadow-xs hover:bg-[#d6143c] transition"
                  >
                    Discover People
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friends.map((friend) => {
                    const isLaunching = launchingActionId === friend.friendUser.id;
                    const isMenuOpen = activeFriendMenuId === friend.friendUser.id;

                    return (
                      <div
                        key={friend.friendshipId || friend.friendUser.id}
                        className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#150f1d] border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left: Avatar & Details */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={getBitmojiAvatarUrl(friend.friendUser.avatarUrl, friend.friendUser.displayName)}
                                alt={friend.friendUser.displayName}
                                className="w-13 h-13 rounded-full object-cover ring-2 ring-white dark:ring-white/10 shadow-xs"
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
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                {friend.friendUser.displayName}
                              </h4>
                              <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-semibold truncate">
                                #{friend.friendUser.partnerCode}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                {friend.friendUser.isOnline ? (
                                  <span className="text-emerald-500 font-medium">Online now</span>
                                ) : (
                                  'Offline'
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Streak Badge */}
                          <div className="flex flex-col items-end shrink-0">
                            <div className="px-3 py-1 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 shadow-2xs">
                              <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                              <span className="font-black text-xs sm:text-sm">
                                {friend.streak?.currentStreak ?? 0}d
                              </span>
                            </div>
                            {friend.streak?.atRisk && (
                              <span className="text-[10px] text-rose-500 font-bold mt-1 animate-pulse">
                                At risk today! 🔥
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Toolbar */}
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            {/* Watch Together */}
                            <button
                              type="button"
                              disabled={isLaunching}
                              onClick={() => handleWatchPartyWithFriend(friend)}
                              className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              <Video className="w-3.5 h-3.5 text-[#ee1d49]" />
                              <span>{isLaunching ? 'Starting...' : 'Watch'}</span>
                            </button>

                            {/* Play Ludo */}
                            <button
                              type="button"
                              onClick={() => handlePlayGame(friend, 'ludo')}
                              className="py-2 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d6143c] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                              title="Play Ludo Arena"
                            >
                              <Gamepad2 className="w-3.5 h-3.5" />
                              <span>Ludo</span>
                            </button>

                            {/* Play Four in a Row */}
                            <button
                              type="button"
                              onClick={() => handlePlayGame(friend, 'four-in-a-row')}
                              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                              title="Play Four in a Row"
                            >
                              <Gamepad2 className="w-3.5 h-3.5" />
                              <span>4-in-Row</span>
                            </button>
                          </div>

                          {/* 3-Dots Menu */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveFriendMenuId(isMenuOpen ? null : friend.friendUser.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 bottom-full mb-2 w-44 rounded-2xl bg-white dark:bg-[#1b1224] border border-slate-200 dark:border-white/10 shadow-xl py-1 z-30 animate-fadeIn">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFriend(friend.friendUser.id, friend.friendUser.displayName)}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove Friend</span>
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
          )}

        </div>
      </main>

    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#0d0a14] flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-[#ee1d49] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <FriendsPageContent />
    </Suspense>
  );
}
