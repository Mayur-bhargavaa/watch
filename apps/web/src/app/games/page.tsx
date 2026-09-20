'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gamepad2,
  Sparkles,
  Users,
  Play,
  Heart,
  Bell,
  Sun,
  Moon,
  Menu,
  ChevronRight,
  Flame,
  ShieldCheck,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  getUserPartner,
  pingPartner,
  UserSession,
  FriendWithStreak,
  getFriendsWithStreaks
} from '../../lib/api';
import { GameFriendSelectorDrawer } from '../../components/games/GameFriendSelectorDrawer';
import { AddFriendModal } from '../../components/streaks/AddFriendModal';
import { getRandomRoast } from '../../lib/roastMessages';

export interface GameItem {
  id: string;
  title: string;
  subtext: string;
  badge?: string;
  badgeColor?: string;
  category: string;
  players: string;
  icon: string;
  route?: string;
  artwork: string;
  description: string;
  featured?: boolean;
}

const GAMES_CATALOG: GameItem[] = [
  {
    id: 'ludo',
    title: 'LUDO PARTY',
    subtext: 'Classic 4-Player Board & Video Chat',
    badge: '🔥 Live Multiplayer',
    badgeColor: 'bg-[#ee1d49] text-white shadow-lg shadow-[#ee1d49]/30',
    category: 'Board Game',
    players: '2-4 Players',
    icon: '🎲',
    route: '/games/ludo',
    featured: true,
    artwork: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600&h=400&fit=crop&q=80',
    description: 'Roll dice, capture opponent tokens, and race home with friends in real-time with zero bots and live floating video call.'
  },
  {
    id: 'bingo',
    title: 'BINGO DUEL',
    subtext: 'Classic Tambola & 75-Ball Duel',
    badge: '🔥 Live 2-Player',
    badgeColor: 'bg-gradient-to-r from-rose-600 via-[#ee1d49] to-pink-600 text-white shadow-lg shadow-rose-600/30',
    category: 'Tambola / Housie',
    players: '2 Players',
    icon: '🎱',
    route: '/games/bingo',
    featured: true,
    artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&h=400&fit=crop&q=80',
    description: 'Private 2-player real-time Tambola & 75-ball Bingo. Unique tickets, auto/manual calling, custom patterns, and instant win validation.'
  },
  {
    id: 'four-in-a-row',
    title: 'FOUR IN A ROW',
    subtext: 'Vertical Disc Duel & Live Reactions',
    badge: '🔥 Live 2-Player',
    badgeColor: 'bg-[#6355ff] text-white shadow-lg shadow-indigo-600/30',
    category: 'Strategy Duel',
    players: '2 Players',
    icon: '🔴',
    route: '/games/four-in-a-row',
    featured: true,
    artwork: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=400&fit=crop&q=80',
    description: 'Connect 4 discs horizontally, vertically, or diagonally. Fast-paced mind duel with turn timers and custom chips.'
  },
  {
    id: 'tic-tac-toe',
    title: 'TIC TAC TOE',
    subtext: 'Neon 3-in-a-Row Quick Duel',
    badge: '🔥 Live 2-Player',
    badgeColor: 'bg-rose-600 text-white shadow-lg shadow-rose-600/30',
    category: 'Strategy Duel',
    players: '2 Players',
    icon: '❌',
    route: '/games/tic-tac-toe',
    featured: true,
    artwork: 'https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?w=600&h=400&fit=crop&q=80',
    description: 'Fast-paced 3x3 tactical duel. Place Xs and Os, block opponent lines, and claim victory with live audio/video reactions.'
  },
  {
    id: 'trivia',
    title: 'CINEMA TRIVIA',
    subtext: '15s Rapid Movie & Pop Quiz',
    badge: 'Coming Soon',
    badgeColor: 'bg-zinc-800/80 text-zinc-300 border border-white/10',
    category: 'Movie Quiz',
    players: '2-6 Players',
    icon: '🎬',
    artwork: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=400&fit=crop&q=80',
    description: 'Rapid-fire movie trivia covering Hollywood blockbusters, MCU, Oscar winners, and iconic film dialogue.'
  },
  {
    id: 'pictionary',
    title: 'CO-OP SKETCH',
    subtext: 'Live Draw & Guess Together',
    badge: 'Coming Soon',
    badgeColor: 'bg-zinc-800/80 text-zinc-300 border border-white/10',
    category: 'Live Sketch',
    players: '2-6 Players',
    icon: '🎨',
    artwork: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&h=400&fit=crop&q=80',
    description: 'Synchronized live sketch canvas where one player draws movie scenes while friends guess in real-time.'
  },
  {
    id: 'chess',
    title: 'CHESS CINEMA',
    subtext: 'Grandmaster Tactics & Clocks',
    badge: 'Coming Soon',
    badgeColor: 'bg-zinc-800/80 text-zinc-300 border border-white/10',
    category: 'Classic Strategy',
    players: '2 Players',
    icon: '♟️',
    artwork: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600&h=400&fit=crop&q=80',
    description: 'Classic chess with live move highlighting, turn clocks, checkmate validation, and spectator commentary.'
  },
  {
    id: 'reflex',
    title: 'REFLEX DUEL',
    subtext: 'Millisecond Reaction Party',
    badge: 'Coming Soon',
    badgeColor: 'bg-zinc-800/80 text-zinc-300 border border-white/10',
    category: 'Speed Duel',
    players: 'Up to 6',
    icon: '⚡',
    artwork: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=400&fit=crop&q=80',
    description: 'High-stakes party reaction game. Tap on green flashes to top the lobby reflex leaderboard.'
  }
];

export default function GameLobbyPage() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [partner, setPartner] = useState<{
    id: string;
    displayName: string;
    partnerCode: string;
    avatarUrl?: string | null;
    online: boolean;
  } | null>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  // Friend selector drawers
  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [selectedGameForPartner, setSelectedGameForPartner] = useState<string>('/games/ludo');

  // Load session & partner
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      getUserPartner(s.token)
        .then((res) => {
          if (res?.partner) {
            setPartner(res.partner);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handlePingPartner = async () => {
    if (!session?.token || !partner) return;
    setIsPinging(true);
    const roast = getRandomRoast('game');
    try {
      await pingPartner({
        targetCode: partner.partnerCode,
        fromCode: session.user.partnerCode,
        fromName: session.user.displayName,
        gameType: 'games',
        customMessage: roast.body
      });
      setPingStatus(`Sent roast to ${partner.displayName}! 🎲 "${roast.body}"`);
      setTimeout(() => setPingStatus(null), 5000);
    } catch {
      setPingStatus('Failed to send ping');
      setTimeout(() => setPingStatus(null), 3000);
    } finally {
      setIsPinging(false);
    }
  };

  const handleSelectFriend = (friend: FriendWithStreak) => {
    if (friend.friendUser) {
      setPartner({
        id: friend.friendUser.id,
        displayName: friend.friendUser.displayName,
        partnerCode: friend.friendUser.partnerCode,
        avatarUrl: friend.friendUser.avatarUrl,
        online: friend.friendUser.isOnline ?? false
      });
    }
    setIsFriendDrawerOpen(false);
  };

  const handlePlayWithFriend = (friend: FriendWithStreak) => {
    handleSelectFriend(friend);
    router.push(selectedGameForPartner);
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-150 ${
      isDark ? 'bg-[#0d0e15] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Centralized AppSidebar */}
      <AppSidebar
        activeNav="games"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#130e1b]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ee1d49] to-[#ff3b68] flex items-center justify-center text-white font-black text-sm shadow-sm">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Game Lobby<span className="text-[#ee1d49]">.</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          >
            {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>
        </div>

        {/* Page Container */}
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 animate-fadeIn">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-[#ee1d49]/10 border border-[#ee1d49]/20 text-[#ee1d49]">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Party Game Lobby
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ee1d49]/10 text-[#ee1d49] border border-[#ee1d49]/20">
                    ZERO BOTS
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  Play synchronized multiplayer party games with friends while on video call.
                </p>
              </div>
            </div>

            {/* Quick Friend Selector Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedGameForPartner('/games/ludo');
                  setIsFriendDrawerOpen(true);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#ee1d49]" />
                <span>Select Opponent</span>
              </button>
            </div>
          </div>

          {/* Quick Partner Duel Highlight Banner */}
          {partner && (
            <div className={`p-4 sm:p-5 rounded-3xl border transition shadow-sm ${
              isDark
                ? 'bg-gradient-to-r from-[#18121f] via-[#151122] to-[#120d18] border-white/10'
                : 'bg-gradient-to-r from-[#fff5f7] via-[#fdf7f9] to-[#fff] border-[#fde4eb]'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ee1d49] to-[#f43f5e] text-white flex items-center justify-center font-black text-base shadow-sm ring-2 ring-white dark:ring-white/10 overflow-hidden">
                      {partner.avatarUrl ? (
                        <img src={partner.avatarUrl} alt={partner.displayName} className="w-full h-full object-cover" />
                      ) : (
                        (partner.displayName || 'P').charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 ring-1 ring-white/50">
                      <span className={`h-2.5 w-2.5 rounded-full ${partner.online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase">
                        Current Partner
                      </span>
                      <Heart className="w-3 h-3 text-[#ee1d49] fill-[#ee1d49]" />
                      <span className="text-[10px] font-mono text-zinc-400">
                        #{partner.partnerCode}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {partner.displayName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {partner.online ? '🟢 Online • Ready for instant matches' : '⚪ Offline • Ping them to come online'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handlePingPartner}
                    disabled={isPinging}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 ${
                      isDark
                        ? 'border-white/10 bg-white/5 hover:bg-white/10 text-rose-300'
                        : 'border-rose-200 bg-white hover:bg-rose-50 text-rose-600'
                    }`}
                  >
                    <Bell className={`w-3.5 h-3.5 ${isPinging ? 'animate-bounce' : ''}`} />
                    <span>{isPinging ? 'Pinging...' : 'Ping'}</span>
                  </button>

                  <Link
                    href="/games/ludo"
                    className="px-4 py-2 bg-[#ee1d49] hover:bg-[#d6143c] text-white text-xs font-bold rounded-xl shadow-md shadow-[#ee1d49]/25 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Play Ludo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/games/four-in-a-row"
                    className="px-4 py-2 bg-[#6355ff] hover:bg-[#5244e8] text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/25 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Play Four in a Row</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {pingStatus && (
                <div className="mt-3 pt-2.5 border-t border-rose-200/60 dark:border-white/10 text-xs font-semibold text-rose-500">
                  {pingStatus}
                </div>
              )}
            </div>
          )}

          {/* Featured Live Multiplayer Games Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#ee1d49]" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Live Multiplayer Arena
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                100% Real Players • No Bots
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {GAMES_CATALOG.filter((g) => g.featured).map((game) => (
                <div
                  key={game.id}
                  onClick={() => game.route && router.push(game.route)}
                  className={`group relative rounded-3xl border overflow-hidden p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl select-none ${
                    isDark
                      ? 'bg-[#141521] border-white/10 hover:border-[#ee1d49]/60 hover:shadow-[#ee1d49]/10'
                      : 'bg-white border-slate-200/90 hover:border-[#ee1d49]/60 hover:shadow-[#ee1d49]/15'
                  }`}
                >
                  {/* Right side artwork blend */}
                  <div className="absolute right-0 top-0 bottom-0 w-[55%] pointer-events-none overflow-hidden flex items-center justify-end">
                    <img
                      src={game.artwork}
                      alt={game.title}
                      className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-60 dark:opacity-40 group-hover:opacity-80"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-r ${
                      isDark
                        ? 'from-[#141521] via-[#141521]/80 to-transparent'
                        : 'from-white via-white/80 to-transparent'
                    }`} />
                  </div>

                  {/* Top Row: Badge & Category */}
                  <div className="relative z-10 flex items-center justify-between mb-6">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold tracking-wide shadow-xs ${game.badgeColor}`}>
                      {game.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
                      {game.players}
                    </span>
                  </div>

                  {/* Bottom Area: Info & Action */}
                  <div className="relative z-10 space-y-2 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{game.icon}</span>
                      <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-[#ee1d49] transition-colors">
                        {game.title}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                      {game.description}
                    </p>

                    <div className="pt-3 flex items-center gap-2 text-[#ee1d49] font-bold text-xs group-hover:translate-x-1 transition-transform">
                      <span>Enter Arena</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Soon Party Arcade Grid */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Upcoming Party Arcade
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                In Development
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {GAMES_CATALOG.filter((g) => !g.featured).map((game) => (
                <div
                  key={game.id}
                  className={`group relative rounded-2xl border overflow-hidden p-5 flex flex-col justify-between transition-all select-none opacity-80 hover:opacity-100 ${
                    isDark
                      ? 'bg-[#12131b] border-white/5'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl">{game.icon}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Coming Soon
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {game.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {game.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Game Friend / Opponent Selector Drawer */}
      <GameFriendSelectorDrawer
        isOpen={isFriendDrawerOpen}
        onClose={() => setIsFriendDrawerOpen(false)}
        token={session?.token}
        currentPartnerId={partner?.id}
        currentPartnerCode={partner?.partnerCode}
        gameTitle="Party Games"
        onSelectFriend={handleSelectFriend}
        onPlayWithFriend={handlePlayWithFriend}
        onOpenAddFriend={() => setIsAddFriendModalOpen(true)}
      />

      {/* Add Friend Modal */}
      {session?.token && isAddFriendModalOpen && (
        <AddFriendModal
          isOpen={isAddFriendModalOpen}
          onClose={() => setIsAddFriendModalOpen(false)}
          myFriendCode={session?.user?.partnerCode || ''}
          token={session.token}
          onFriendAdded={(newFriend) => {
            handleSelectFriend(newFriend);
          }}
        />
      )}
    </div>
  );
}
