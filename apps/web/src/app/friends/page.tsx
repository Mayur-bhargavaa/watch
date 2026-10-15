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
  Trash2,
  Menu,
  MessageSquare,
  TriangleAlert,
  Bike,
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
  getPartnerRequests,
  acceptPartnerRequest,
  declinePartnerRequest,
  cancelPartnerRequest,
  PartnerRequestRow,
  sendPartnerNudge,
  FriendWithStreak,
  FriendRequestsData,
  DiscoverableUserItem,
  UserSession
} from '../../lib/api';
import { getRandomRoast } from '../../lib/roastMessages';
import { StreakDetailsDrawer } from '../../components/streaks/StreakDetailsDrawer';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { AppHeader } from '../../components/layout/AppHeader';
import { MembershipBadge } from '../../components/membership/MembershipBadge';

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

function dedupeFriends(list: FriendWithStreak[]): FriendWithStreak[] {
  const seen = new Set<string>();
  return list.filter((f) => {
    const id = f.friendUser?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// ---------------------------------------------------------------------------------------------
// Instagram x Facebook visual kit
// ---------------------------------------------------------------------------------------------
const IG_GRADIENT = 'linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)';
const CARD = 'rounded-2xl bg-white dark:bg-[#242526] shadow-[0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.04] dark:ring-white/10';
const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 font-semibold transition active:scale-[0.98] disabled:opacity-50 cursor-pointer whitespace-nowrap';
const BTN_BLUE = `${BTN_BASE} px-4 py-2.5 rounded-lg bg-[#ee1d49] hover:bg-[#d6143c] text-white text-[14px]`;
const BTN_BLUE_SM = `${BTN_BASE} px-3 py-2 rounded-lg bg-[#ee1d49] hover:bg-[#d6143c] text-white text-[13px]`;
const BTN_GREY = `${BTN_BASE} px-4 py-2.5 rounded-lg bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] text-[14px]`;
const BTN_GREY_SM = `${BTN_BASE} px-3 py-2 rounded-lg bg-[#e4e6eb] hover:bg-[#d8dadf] dark:bg-[#3a3b3c] dark:hover:bg-[#4e4f50] text-[#050505] dark:text-[#e4e6eb] text-[13px]`;
// One colour for every action button in every row (friends, requests, find people)
const ROW_BTN = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-[#ffe9ee] hover:bg-[#ffd6df] dark:bg-[#ee1d4933] dark:hover:bg-[#ee1d494d] text-[#ee1d49] text-[13px] font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap';
const ACTION = `${ROW_BTN} flex-col h-auto py-1.5 gap-0.5 text-[11px]`;
const ACTION_PRIMARY = ACTION;

/** Avatar with an Instagram "story" gradient ring (or a quiet grey ring) and an optional online dot. */
function RingAvatar({
  src,
  alt,
  size = 56,
  ring = 'none',
  online,
  className = ''
}: {
  src: string;
  alt: string;
  size?: number;
  ring?: 'story' | 'none';
  online?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className={`absolute inset-0 rounded-full p-[2.5px] ${ring === 'none' ? 'bg-[#dadde1] dark:bg-white/15' : ''}`}
        style={ring === 'story' ? { background: IG_GRADIENT } : undefined}
      >
        <div className="w-full h-full rounded-full bg-white dark:bg-[#242526] p-[2.5px]">
          <img src={src} alt={alt} className="w-full h-full rounded-full object-cover bg-[#f0f2f5]" />
        </div>
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-[26%] h-[26%] min-w-[10px] min-h-[10px] rounded-full bg-[#31a24c] ring-2 ring-white dark:ring-[#242526]" />
      )}
    </div>
  );
}

function Loader({ text }: { text: string }) {
  return (
    <div className={`${CARD} py-16 flex flex-col items-center justify-center text-center`}>
      <div className="w-9 h-9 border-[3px] border-[#ee1d49] border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-[13px] text-[#65676b] dark:text-[#b0b3b8] font-medium">{text}</p>
    </div>
  );
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className={`${CARD} py-14 px-6 text-center`}>
      <div className="w-16 h-16 rounded-full bg-[#f0f2f5] dark:bg-[#3a3b3c] text-[#65676b] dark:text-[#b0b3b8] flex items-center justify-center mx-auto mb-3">{icon}</div>
      <h3 className="text-[17px] font-bold text-[#050505] dark:text-[#e4e6eb] mb-1">{title}</h3>
      <p className="text-[14px] text-[#65676b] dark:text-[#b0b3b8] max-w-sm mx-auto mb-4">{text}</p>
      {action}
    </div>
  );
}

function FriendsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFriendCode = searchParams.get('code') || searchParams.get('partnerCode');
  // Opening an invite link (?code=...) lands on "Find people"; otherwise start on your friends list
  const initialTab = (searchParams.get('tab') as 'discover' | 'requests' | 'friends') || (urlFriendCode ? 'discover' : 'friends');

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
  const [selectedStreakFriend, setSelectedStreakFriend] = useState<FriendWithStreak | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showSentModal, setShowSentModal] = useState(false);
  const [partnerReqs, setPartnerReqs] = useState<{ incoming: PartnerRequestRow[]; outgoing: PartnerRequestRow[] }>({ incoming: [], outgoing: [] });
  const [partnerReqBusy, setPartnerReqBusy] = useState<string | null>(null);

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
      const [friendsRes, requestsRes, partnerRes] = await Promise.all([
        getFriendsWithStreaks(session.token).catch(() => ({ friends: [], myFriendCode: '' })),
        getFriendRequests(session.token).catch(() => ({ incoming: [], outgoing: [] })),
        getPartnerRequests(session.token).catch(() => ({ incoming: [], outgoing: [] }))
      ]);
      setPartnerReqs(partnerRes);
      setFriends(dedupeFriends(friendsRes.friends || []));
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
      void loadAllFriendsData();
      void loadDiscoverDirectory();
    }
  }, [session]);

  // A live partner request / acceptance arrived (NotificationContext) -> refresh the block
  useEffect(() => {
    if (!session?.token) return;
    const refresh = () => void getPartnerRequests(session.token).then(setPartnerReqs).catch(() => {});
    window.addEventListener('partner-requests-changed', refresh);
    return () => window.removeEventListener('partner-requests-changed', refresh);
  }, [session]);

  const handlePartnerRequest = async (kind: 'accept' | 'decline' | 'cancel', otherId: string, name: string) => {
    if (!session?.token || partnerReqBusy) return;
    setPartnerReqBusy(otherId);
    try {
      if (kind === 'accept') await acceptPartnerRequest(session.token, otherId);
      else if (kind === 'decline') await declinePartnerRequest(session.token, otherId);
      else await cancelPartnerRequest(session.token, otherId);
      setFeedback({ type: 'success', message: kind === 'accept' ? `You and ${name} are now partners.` : kind === 'decline' ? 'Request declined.' : 'Request cancelled.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Could not update the request.' });
    } finally {
      setPartnerReqBusy(null);
      setPartnerReqs(await getPartnerRequests(session.token).catch(() => partnerReqs));
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Debounce discover search
  useEffect(() => {
    if (!session?.token) return;
    const timer = setTimeout(() => {
      void loadDiscoverDirectory(discoverSearch);
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
          text: `Add me as a friend on SyncCinema using my code ${myFriendCode} to watch movies and play games together!`,
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
            message: `You and ${res.friend.friendUser.displayName} are now friends! Streak started`
          });
          setFriends((prev) => dedupeFriends([res.friend!, ...prev]));
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
            message: `You and ${user.displayName} are now friends!`
          });
          setFriends((prev) => dedupeFriends([res.friend!, ...prev]));
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
          message: `You and ${displayName} are now friends! Daily streak unlocked`
        });
        setFriends((prev) => dedupeFriends([res.friend!, ...prev]));
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

  // Nudge friend with funny Zomato roast
  const handleNudgeFriend = async (friend: FriendWithStreak) => {
    if (!session?.token) return;
    const roast = getRandomRoast('nudge');
    setActionLoadingId(friend.friendUser.id);
    try {
      await sendPartnerNudge(session.token, {
        targetPartnerCode: friend.friendUser.partnerCode,
        message: roast.body,
        category: 'nudge',
        link: '/friends'
      });
      setFeedback({
        type: 'success',
        message: `Sent roast to ${friend.friendUser.displayName}: "${roast.body}"`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send nudge.'
      });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Start watch party with a friend
  const handleWatchPartyWithFriend = async (friend: FriendWithStreak) => {
    if (!session?.token) return;
    setLaunchingActionId(friend.friendUser.id);
    try {
      // Connect partner in background so they are the connected partner
      await connectUserPartner(session.token, friend.friendUser.partnerCode, friend.friendUser.id).catch(() => {});
      const res = await createPartyRoom({
        token: session.token,
        title: `Cinema with ${friend.friendUser.displayName}`,
        sourceUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
        mediaTitle: `Cinema with ${friend.friendUser.displayName}`,
        activityMode: 'CINEMA'
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
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#18191a] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#ee1d49] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-[#18191a] text-[#e4e6eb]' : 'bg-[#f0f2f5] text-[#050505]'}`}>
      
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR NAVIGATION (Matching SyncCinema Design System)             */}
      {/* ========================================================================= */}
      {/* Centralized Reusable AppSidebar */}
      <AppSidebar
        activeNav="friends"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        incomingRequestsCount={requests.incoming.length + partnerReqs.incoming.length}
      />

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT STAGE                                                     */}
      {/* ========================================================================= */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <AppHeader
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Inner Container: Instagram × Facebook look (soft grey canvas, white rounded cards, gradient story rings, blue actions) */}
        <div className="max-w-5xl mx-auto w-full space-y-4 animate-fadeIn">

          {/* Snackbar feedback (Facebook style dark pill) */}
          {feedback && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-[min(92vw,28rem)] animate-fadeIn">
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-[13px] font-medium text-white ${
                  feedback.type === 'success' ? 'bg-[#242526]' : 'bg-[#c0392b]'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#31a24c] shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-white shrink-0" />
                )}
                <span className="flex-1 leading-snug">{feedback.message}</span>
                <button type="button" onClick={() => setFeedback(null)} className="p-1 rounded-full hover:bg-white/10 cursor-pointer" aria-label="Dismiss">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TABS: Instagram-style icon tabs with a Facebook-blue indicator         */}
          {/* ===================================================================== */}
          <nav className={`${CARD} flex items-stretch`}>
            {([
              { id: 'friends', label: 'Friends', icon: Users, count: friends.length, alert: false },
              { id: 'requests', label: 'Requests', icon: Inbox, count: requests.incoming.length + partnerReqs.incoming.length, alert: requests.incoming.length + partnerReqs.incoming.length > 0 },
              { id: 'discover', label: 'Find people', icon: Search, count: 0, alert: false }
            ] as const).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`relative flex-1 py-3.5 flex items-center justify-center gap-2 text-[13px] sm:text-sm font-semibold transition cursor-pointer ${
                    active ? 'text-[#ee1d49]' : 'text-[#65676b] dark:text-[#b0b3b8] hover:bg-black/[0.04] dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden xs:inline sm:inline">{t.label}</span>
                  {t.count > 0 && (
                    <span className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none text-center ${
                      t.alert ? 'bg-[#f02849] text-white' : 'bg-[#e4e6eb] dark:bg-white/10 text-[#050505] dark:text-[#e4e6eb]'
                    }`}>
                      {t.count}
                    </span>
                  )}
                  {active && <span className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t-full bg-[#ee1d49]" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                void loadAllFriendsData();
                void loadDiscoverDirectory(discoverSearch);
              }}
              title="Refresh"
              className="px-3.5 text-[#65676b] dark:text-[#b0b3b8] hover:bg-black/[0.04] dark:hover:bg-white/5 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDiscover || loadingFriends || loadingRequests ? 'animate-spin text-[#ee1d49]' : ''}`} />
            </button>
          </nav>

          {/* ===================================================================== */}
          {/* FRIENDS                                                                */}
          {/* ===================================================================== */}
          {activeTab === 'friends' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-bold text-[#050505] dark:text-[#e4e6eb]">
                  All friends <span className="text-[#65676b] dark:text-[#b0b3b8] font-semibold text-base">· {friends.length}</span>
                </h2>
                <button type="button" onClick={() => setActiveTab('discover')} className={BTN_BLUE_SM}>
                  <UserPlus className="w-4 h-4" />
                  <span>Find friends</span>
                </button>
              </div>

              {loadingFriends && friends.length === 0 ? (
                <Loader text="Loading your friends…" />
              ) : friends.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-8 h-8" />}
                  title="No friends yet"
                  text="Find people you know, or share your friend code to connect and start your first streak."
                  action={<button type="button" onClick={() => setActiveTab('discover')} className={BTN_BLUE}>Find people</button>}
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {friends.map((friend) => {
                    const isLaunching = launchingActionId === friend.friendUser.id;
                    const isMenuOpen = activeFriendMenuId === friend.friendUser.id;
                    const streak = friend.streak?.currentStreak ?? 0;

                    return (
                      <article key={friend.friendshipId || friend.friendUser.id} className={`${CARD} relative p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4`}>
                        {/* Left: avatar + who */}
                        <div className="flex items-center gap-3.5 min-w-0 lg:flex-1">
                          <RingAvatar
                            src={getBitmojiAvatarUrl(friend.friendUser.avatarUrl, friend.friendUser.displayName)}
                            alt={friend.friendUser.displayName}
                            size={52}
                            ring={friend.friendUser.isOnline || streak > 0 ? 'story' : 'none'}
                            online={friend.friendUser.isOnline}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h3 className="text-[15px] font-bold text-[#050505] dark:text-[#e4e6eb] truncate">{friend.friendUser.displayName}</h3>
                              {(friend.friendUser.membershipTier === 'plus' || friend.friendUser.membershipTier === 'creator') && (
                                <MembershipBadge tier={friend.friendUser.membershipTier} />
                              )}
                            </div>
                            <p className="text-[13px] text-[#65676b] dark:text-[#b0b3b8] truncate">
                              {friend.friendUser.isOnline ? <span className="text-[#31a24c] font-semibold">Active now</span> : 'Offline'}
                              <span className="mx-1.5">·</span>
                              <span className="font-mono">#{friend.friendUser.partnerCode}</span>
                            </p>
                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedStreakFriend(friend)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fff1e6] dark:bg-[#f0284926] text-[#f02849] text-[12px] font-bold hover:opacity-80 transition cursor-pointer"
                                title="View streak calendar and details"
                              >
                                <Flame className="w-3.5 h-3.5 fill-current" />
                                <span>{streak}-day streak</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                              {friend.streak?.atRisk && <span className="text-[11px] font-bold text-[#f02849] whitespace-nowrap"><TriangleAlert className="inline w-3 h-3 align-[-0.125em]" /> At risk today</span>}
                            </div>
                          </div>

                          {/* 3-dots menu (stays next to the name on small screens, moves to the far right on wide ones) */}
                          <div className="relative shrink-0 self-start lg:hidden">
                            <button
                              type="button"
                              onClick={() => setActiveFriendMenuId(isMenuOpen ? null : friend.friendUser.id)}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] hover:bg-[#e4e6eb] dark:hover:bg-white/10 transition cursor-pointer"
                              aria-label="More"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Right: actions in one line */}
                        <div className="grid grid-cols-5 lg:flex lg:items-center gap-1.5 lg:gap-2 lg:shrink-0">
                          <button type="button" onClick={() => router.push(`/chat?userId=${friend.friendUser.id}`)} className={`${ACTION_PRIMARY} lg:w-[84px]`} title="Message">
                            <MessageSquare className="w-[18px] h-[18px]" />
                            <span>Message</span>
                          </button>
                          <button type="button" disabled={isLaunching} onClick={() => handleWatchPartyWithFriend(friend)} className={`${ACTION} lg:w-[84px]`} title="Watch together">
                            <Video className="w-[18px] h-[18px]" />
                            <span>{isLaunching ? 'Starting…' : 'Watch'}</span>
                          </button>
                          <button type="button" onClick={() => handlePlayGame(friend, 'ludo')} className={`${ACTION} lg:w-[84px]`} title="Play Ludo">
                            <Gamepad2 className="w-[18px] h-[18px]" />
                            <span>Ludo</span>
                          </button>
                          <button type="button" onClick={() => handlePlayGame(friend, 'four-in-a-row')} className={`${ACTION} lg:w-[84px]`} title="Play Four in a Row">
                            <Gamepad2 className="w-[18px] h-[18px]" />
                            <span>4-in-row</span>
                          </button>
                          <button type="button" disabled={actionLoadingId === friend.friendUser.id} onClick={() => handleNudgeFriend(friend)} className={`${ACTION} lg:w-[84px]`} title="Send a playful nudge">
                            <Bike className="w-[18px] h-[18px]" />
                            <span>Nudge</span>
                          </button>

                          <div className="relative hidden lg:block shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveFriendMenuId(isMenuOpen ? null : friend.friendUser.id)}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] hover:bg-[#e4e6eb] dark:hover:bg-white/10 transition cursor-pointer"
                              aria-label="More"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {isMenuOpen && (
                          <div className="absolute right-3 top-14 w-52 rounded-xl bg-white dark:bg-[#3a3b3c] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 p-1.5 z-30 animate-fadeIn">
                            <button
                              type="button"
                              onClick={() => handleRemoveFriend(friend.friendUser.id, friend.friendUser.displayName)}
                              className="w-full px-3 py-2 rounded-lg text-left text-[13px] font-semibold text-[#050505] dark:text-[#e4e6eb] hover:bg-[#f0f2f5] dark:hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Unfriend {friend.friendUser.displayName.split(' ')[0]}</span>
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ===================================================================== */}
          {/* REQUESTS                                                               */}
          {/* ===================================================================== */}
          {activeTab === 'requests' && (
            <section className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 px-1">
                  <h2 className="text-lg font-bold text-[#050505] dark:text-[#e4e6eb]">
                    Friend requests <span className="text-[#f02849] font-bold text-base">{requests.incoming.length > 0 ? requests.incoming.length : ''}</span>
                  </h2>
                  <button type="button" onClick={() => setShowSentModal(true)} className={ROW_BTN}>
                    <Clock className="w-4 h-4" />
                    <span>Sent requests{requests.outgoing.length > 0 ? ` · ${requests.outgoing.length}` : ''}</span>
                  </button>
                </div>
                {requests.incoming.length === 0 ? (
                  <EmptyState
                    icon={<Inbox className="w-8 h-8" />}
                    title="No new requests"
                    text="When someone sends you a friend request it will show up here."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {requests.incoming.map((req) => {
                      const busy = actionLoadingId === req.user.id;
                      return (
                        <article key={req.requestId} className={`${CARD} p-2.5 sm:p-3 flex items-center gap-3`}>
                          <RingAvatar src={getBitmojiAvatarUrl(req.user.avatarUrl, req.user.displayName)} alt={req.user.displayName} size={44} ring="none" />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[14px] font-bold text-[#050505] dark:text-[#e4e6eb] truncate">{req.user.displayName}</h3>
                            <p className="text-[12px] text-[#65676b] dark:text-[#b0b3b8] truncate">
                              <span className="font-mono">#{req.user.partnerCode}</span>
                              <span className="mx-1.5">·</span>
                              {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" disabled={busy} onClick={() => handleAccept(req.user.id, req.user.displayName)} className={ROW_BTN}>
                              <Check className="w-4 h-4" />
                              <span>{busy ? 'Confirming…' : 'Confirm'}</span>
                            </button>
                            <button type="button" disabled={busy} onClick={() => handleDecline(req.user.id)} className={ROW_BTN}>
                              <X className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {(partnerReqs.incoming.length > 0 || partnerReqs.outgoing.length > 0) && (
                <div className="space-y-2">
                  <h2 className="px-1 text-lg font-bold text-[#050505] dark:text-[#e4e6eb]">Partner requests</h2>
                  {[
                    ...partnerReqs.incoming.map((r) => ({ ...r, incoming: true })),
                    ...partnerReqs.outgoing.map((r) => ({ ...r, incoming: false }))
                  ].map((r) => {
                    const busy = partnerReqBusy === r.userId;
                    return (
                      <article key={`${r.incoming ? 'in' : 'out'}:${r.userId}`} className={`${CARD} p-2.5 sm:p-3 flex items-center gap-3`}>
                        <RingAvatar src={getBitmojiAvatarUrl(r.avatarUrl, r.displayName)} alt={r.displayName} size={44} ring="none" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-bold text-[#050505] dark:text-[#e4e6eb] truncate">{r.displayName}</h3>
                          <p className="text-[12px] text-[#65676b] dark:text-[#b0b3b8] truncate">
                            {r.incoming ? 'Wants to be your partner' : 'Waiting for them to accept'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.incoming ? (
                            <>
                              <button type="button" disabled={busy} onClick={() => handlePartnerRequest('accept', r.userId, r.displayName)} className={ROW_BTN}>
                                <Check className="w-4 h-4" />
                                <span>Accept</span>
                              </button>
                              <button type="button" disabled={busy} onClick={() => handlePartnerRequest('decline', r.userId, r.displayName)} className={ROW_BTN}>
                                <X className="w-4 h-4" />
                                <span className="hidden sm:inline">Decline</span>
                              </button>
                            </>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => handlePartnerRequest('cancel', r.userId, r.displayName)} className={ROW_BTN}>
                              <X className="w-4 h-4" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ===================================================================== */}
          {/* FIND PEOPLE: add by code + "People you may know" grid                  */}
          {/* ===================================================================== */}
          {activeTab === 'discover' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-bold text-[#050505] dark:text-[#e4e6eb]">
                  People <span className="text-[#65676b] dark:text-[#b0b3b8] font-semibold text-base">· {filteredDiscoverUsers.length}</span>
                </h2>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65676b]" />
                  <input
                    type="text"
                    value={discoverSearch}
                    onChange={(e) => setDiscoverSearch(e.target.value)}
                    placeholder="Search name or code"
                    className="w-full pl-10 pr-9 py-2.5 rounded-full bg-white dark:bg-[#3a3b3c] ring-1 ring-black/5 dark:ring-white/10 text-[14px] text-[#050505] dark:text-[#e4e6eb] placeholder-[#65676b] focus:outline-none focus:ring-2 focus:ring-[#ee1d49]/40 transition"
                  />
                  {discoverSearch && (
                    <button type="button" onClick={() => setDiscoverSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#65676b] hover:bg-[#e4e6eb] dark:hover:bg-white/10 cursor-pointer" aria-label="Clear search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {loadingDiscover && discoverUsers.length === 0 ? (
                <Loader text="Finding people…" />
              ) : filteredDiscoverUsers.length === 0 ? (
                <EmptyState
                  icon={<Search className="w-8 h-8" />}
                  title={discoverSearch ? 'No results' : 'No suggestions right now'}
                  text={discoverSearch ? 'Try a different name, or enter an exact friend code above.' : 'Share your friend code so people can find you.'}
                  action={<button type="button" onClick={handleCopyInviteLink} className={BTN_BLUE}>Share your code</button>}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredDiscoverUsers.map((user) => {
                    const isSending = sendingUserId === user.id;
                    return (
                      <article key={user.id} className={`${CARD} p-2.5 sm:p-3 flex items-center gap-3`}>
                        <RingAvatar src={getBitmojiAvatarUrl(user.avatarUrl, user.displayName)} alt={user.displayName} size={44} ring="none" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-bold text-[#050505] dark:text-[#e4e6eb] truncate">{user.displayName}</h3>
                          <p className="text-[12px] text-[#65676b] dark:text-[#b0b3b8] font-mono truncate">#{user.partnerCode}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {user.requestStatus === 'SENT' ? (
                            <button type="button" onClick={() => handleCancelOutgoing(user.id)} className={ROW_BTN}>
                              <Clock className="w-4 h-4" />
                              <span>Cancel request</span>
                            </button>
                          ) : user.requestStatus === 'RECEIVED' ? (
                            <>
                              <button type="button" onClick={() => handleAccept(user.id, user.displayName)} className={ROW_BTN}>
                                <Check className="w-4 h-4" />
                                <span>Confirm</span>
                              </button>
                              <button type="button" onClick={() => handleDecline(user.id)} className={ROW_BTN}>
                                <X className="w-4 h-4" />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </>
                          ) : (
                            <button type="button" disabled={isSending} onClick={() => handleAddFromDirectory(user)} className={ROW_BTN}>
                              <UserPlus className="w-4 h-4" />
                              <span>{isSending ? 'Sending…' : 'Add friend'}</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

        </div>
      </main>

      {/* Sent requests modal */}
      {showSentModal && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex justify-end animate-fadeIn"
          onClick={() => setShowSentModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sent requests"
            className="h-full w-full max-w-sm sm:max-w-md flex flex-col bg-white dark:bg-[#242526] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e4e6eb] dark:border-white/10">
              <h3 className="text-[17px] font-bold text-[#050505] dark:text-[#e4e6eb]">
                Sent requests <span className="text-[#65676b] dark:text-[#b0b3b8] font-semibold text-[15px]">· {requests.outgoing.length}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSentModal(false)}
                className="w-8 h-8 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] hover:opacity-80 flex items-center justify-center text-[#050505] dark:text-[#e4e6eb] cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-2">
              {requests.outgoing.length === 0 ? (
                <p className="py-10 text-center text-[14px] text-[#65676b] dark:text-[#b0b3b8]">You have no pending sent requests.</p>
              ) : (
                requests.outgoing.map((req) => {
                  const busy = actionLoadingId === req.user.id;
                  return (
                    <div key={req.requestId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-white/5">
                      <RingAvatar src={getBitmojiAvatarUrl(req.user.avatarUrl, req.user.displayName)} alt={req.user.displayName} size={44} ring="none" />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[14px] font-bold text-[#050505] dark:text-[#e4e6eb] truncate">{req.user.displayName}</h4>
                        <p className="text-[12px] text-[#65676b] dark:text-[#b0b3b8] font-mono truncate">#{req.user.partnerCode}</p>
                      </div>
                      <button type="button" disabled={busy} onClick={() => handleCancelOutgoing(req.user.id)} className={`${ROW_BTN} shrink-0`}>
                        <X className="w-4 h-4" />
                        <span>{busy ? 'Cancelling…' : 'Cancel'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Streak Calendar & Activity Drawer */}
      <StreakDetailsDrawer
        isOpen={Boolean(selectedStreakFriend)}
        onClose={() => setSelectedStreakFriend(null)}
        friend={selectedStreakFriend}
        onWatchTogether={(f) => handleWatchPartyWithFriend(f)}
        onPlayGame={(f, game) => handlePlayGame(f, game)}
      />

    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#18191a] flex items-center justify-center">
          <div className="w-10 h-10 border-[3px] border-[#ee1d49] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <FriendsPageContent />
    </Suspense>
  );
}
