'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Users,
  Bell,
  ChevronDown,
  ArrowRight,
  Menu,
  Sun,
  Moon,
  Sparkles,
  Gamepad2,
  Check,
  Clock
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  getUserPartner,
  UserSession,
  FriendWithStreak
} from '../../lib/api';
import { GameFriendSelectorDrawer } from '../../components/games/GameFriendSelectorDrawer';
import { AddFriendModal } from '../../components/streaks/AddFriendModal';

interface GameCardData {
  id: string;
  title: string;
  subtext: string;
  players: string;
  gradient: string;
  image: string;
  route?: string;
  watermark: 'crown' | 'sparkle';
  category: 'party' | 'duel';
  isComingSoon?: boolean;
}

const GAMES_DATA: GameCardData[] = [
  {
    id: 'ludo',
    title: 'Ludo Party',
    subtext: 'Roll. Move. Capture. Win W/together.',
    players: '2-4 Players',
    gradient: 'from-[#ff456e] via-[#dc1947] to-[#7f0b27]',
    image: '/images/card-ludo-dice.png',
    route: '/games/ludo',
    watermark: 'crown',
    category: 'party'
  },
  {
    id: 'bingo',
    title: 'Bingo Duel',
    subtext: 'Fast 1–25 5×5 duel. Complete the pattern first!',
    players: '2 Players',
    gradient: 'from-[#6366f1] via-[#4f46e5] to-[#1e1b4b]',
    image: '/images/card-bingo-duel.png',
    route: '/games/bingo',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'tambola',
    title: 'Tambola',
    subtext: 'Classic 90-Ball Housie. Modern twist.',
    players: '2–20 Players',
    gradient: 'from-[#06b6d4] via-[#0284c7] to-[#082f49]',
    image: '/images/card-bingo-duel.png',
    route: '/games/tambola',
    watermark: 'crown',
    category: 'party'
  },
  {
    id: 'doodle-duel',
    title: 'Doodle Duel',
    subtext: 'Draw it. Guess it. Switch.',
    players: '2 Players',
    gradient: 'from-[#8755f8] via-[#6523c9] to-[#360966]',
    image: '/images/card-doodle-duel.png',
    route: '/games/doodle-duel',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    subtext: 'Quick games. Big fun.',
    players: '2 Players',
    gradient: 'from-[#e5a463] via-[#bc7533] to-[#6b3a16]',
    image: '/images/card-tictactoe.png',
    route: '/games/tic-tac-toe',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'four-in-a-row',
    title: 'Four in a Row',
    subtext: 'Vertical disc duel. 4 in a line.',
    players: '2 Players',
    gradient: 'from-[#3b82f6] via-[#1d4ed8] to-[#0f172a]',
    image: '/images/card-four-in-row.png',
    route: '/games/four-in-a-row',
    watermark: 'sparkle',
    category: 'duel'
  },
  {
    id: 'cinema-trivia',
    title: 'Cinema Trivia',
    subtext: '15s Rapid Movie & Pop Quiz.',
    players: '2-6 Players',
    gradient: 'from-[#f59e0b] via-[#d97706] to-[#78350f]',
    image: '/images/card-cinema-trivia.png',
    watermark: 'sparkle',
    category: 'party',
    isComingSoon: true
  },
  {
    id: 'chess-arena',
    title: 'Chess Arena',
    subtext: 'Tactical Mind Duel & Fast Clocks.',
    players: '2 Players',
    gradient: 'from-[#475569] via-[#334155] to-[#0f172a]',
    image: '/images/card-chess-arena.png',
    watermark: 'crown',
    category: 'duel',
    isComingSoon: true
  },
  {
    id: 'co-op-sketch',
    title: 'Co-Op Sketch',
    subtext: 'Multiplayer Live Sketch & Guess.',
    players: '2-6 Players',
    gradient: 'from-[#ec4899] via-[#be185d] to-[#700738]',
    image: '/images/card-doodle-duel.png',
    watermark: 'sparkle',
    category: 'party',
    isComingSoon: true
  }
];

const SOCIAL_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face'
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | '2-players' | 'party'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Friend / Room Modals
  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [selectedGameForPartner, setSelectedGameForPartner] = useState<string>('/games/ludo');
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

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

  const handleStayUpdated = (gameTitle?: string) => {
    setNotificationToast(
      gameTitle
        ? `🔔 Subscribed to updates for ${gameTitle}!`
        : '🔔 Subscribed! You will be notified when new party games drop.'
    );
    setTimeout(() => setNotificationToast(null), 4000);
  };

  const filteredGames = GAMES_DATA.filter((game) => {
    const matchesSearch =
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.subtext.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterCategory === '2-players') return game.players.includes('2 Players');
    if (filterCategory === 'party') return game.players.includes('2-4') || game.players.includes('2-6');
    return true;
  });

  return (
    <div
      className={`min-h-screen flex transition-colors duration-150 font-sans ${
        isDark ? 'bg-[#090a10] text-white' : 'bg-[#f7f8fa] text-slate-900'
      }`}
    >
      {/* Platform Sidebar */}
      <AppSidebar
        activeNav="games"
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0c0d14]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              Games<span className="text-[#ff3864]">.</span>
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          >
            {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>
        </div>

        {/* Page Inner Container */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6 animate-fadeIn">
          {/* Notification Toast */}
          {notificationToast && (
            <div className="fixed top-5 right-5 z-50 bg-[#ff3864] text-white px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
              <span>{notificationToast}</span>
            </div>
          )}

          {/* 1. TOP HERO CARD (Compact, clean, no create room / profile icons) */}
          <div className="relative rounded-[28px] sm:rounded-[32px] overflow-hidden bg-[#0c0d14] border border-white/10 text-white min-h-[210px] sm:min-h-[240px] flex flex-col justify-between p-5 sm:p-7 lg:p-8 shadow-xl">
            {/* Background Image: Gaming controller on couch with popcorn */}
            <div className="absolute inset-0 pointer-events-none z-0">
              <img
                src="/images/games-hero-banner.jpg"
                alt="Games hit different together"
                className="w-full h-full object-cover object-right sm:object-center opacity-70"
              />
              {/* Dark gradient overlay for text readability on left */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#090a10] via-[#090a10]/85 sm:via-[#090a10]/65 to-transparent" />
              {/* Bottom subtle vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090a10]/80 via-transparent to-transparent" />
            </div>

            {/* Top Row: PLAY TOGETHER category & Search */}
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-zinc-400 uppercase select-none">
                PLAY TOGETHER
              </div>

              {/* Clean search bar / icon */}
              <div>
                {searchOpen ? (
                  <div className="flex items-center bg-black/60 border border-white/20 rounded-full px-3 py-1 backdrop-blur-md">
                    <Search className="w-3.5 h-3.5 text-zinc-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search games..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-32 sm:w-44"
                      autoFocus
                      onBlur={() => !searchQuery && setSearchOpen(false)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="w-9 h-9 rounded-full bg-black/40 hover:bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center text-white cursor-pointer transition active:scale-95"
                    title="Search games"
                  >
                    <Search className="w-3.5 h-3.5 text-zinc-200" />
                  </button>
                )}
              </div>
            </div>

            {/* Middle Row: Headline & Subtitle */}
            <div className="relative z-10 my-auto py-2 sm:py-3 max-w-xl">
              <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black text-white tracking-tight leading-[1.1]">
                Games hit different{' '}
                <span className="text-[#ff3864] drop-shadow-[0_2px_12px_rgba(255,56,100,0.5)]">
                  together.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 font-normal mt-1.5 tracking-normal">
                Real games. Real people. No bots, ever.
              </p>
            </div>

            {/* Bottom Row: 12K+ friends & Cursive Script Watermark */}
            <div className="relative z-10 flex items-end justify-between">
              {/* Stacked Social Avatars */}
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2 overflow-hidden py-0.5">
                  {SOCIAL_AVATARS.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt="Player"
                      className="inline-block h-7 w-7 sm:h-8 sm:w-8 rounded-full ring-2 ring-[#0c0d14] object-cover"
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-zinc-200">
                  12K+ friends are playing
                </span>
              </div>

              {/* Artistic Cursive Handwriting Watermark */}
              <div className="hidden sm:block select-none pointer-events-none text-right">
                <p
                  className="italic text-xl sm:text-2xl text-white/50 leading-tight transform rotate-[-5deg]"
                  style={{ fontFamily: "'Caveat', cursive, 'Brush Script MT', sans-serif" }}
                >
                  Play<br />
                  Laugh<br />
                  Repeat <span className="text-[#ff3864]">♡</span>
                </p>
              </div>
            </div>
          </div>

          {/* 2. SECTION HEADER: "Our Games" & "All Games ⌵" Dropdown */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Our Games
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 font-normal">
                Simple games. Stronger connections.
              </p>
            </div>

            {/* Filter Dropdown Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-sm text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <span>
                  {filterCategory === 'all'
                    ? 'All Games'
                    : filterCategory === '2-players'
                    ? '2 Players'
                    : 'Party (2-4+)'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-[#141522] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl py-1.5 z-30 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory('all');
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 ${
                      filterCategory === 'all' ? 'text-[#ff3864]' : 'text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>All Games</span>
                    {filterCategory === 'all' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory('2-players');
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 ${
                      filterCategory === '2-players' ? 'text-[#ff3864]' : 'text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>2 Players</span>
                    {filterCategory === '2-players' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory('party');
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 ${
                      filterCategory === 'party' ? 'text-[#ff3864]' : 'text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>Party (2-4+)</span>
                    {filterCategory === 'party' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3. GAME CARDS GRID (Includes Four in a Row & Coming Soon games) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                onClick={() => {
                  if (game.isComingSoon) {
                    handleStayUpdated(game.title);
                  } else if (game.route) {
                    router.push(game.route);
                  }
                }}
                className={`group relative rounded-[28px] sm:rounded-[32px] bg-gradient-to-b ${game.gradient} p-6 sm:p-7 text-white flex flex-col justify-between min-h-[460px] sm:min-h-[480px] shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer select-none overflow-hidden`}
              >
                {/* Top Row: Player count pill & Watermark icon */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="bg-black/25 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-white/95 shadow-sm">
                    <Users className="w-3 h-3 text-white/80" />
                    <span>{game.players}</span>
                  </div>

                  {/* Watermark icon on top-right */}
                  <div className="opacity-30 group-hover:opacity-50 transition-opacity">
                    {game.watermark === 'crown' ? (
                      /* Crown line-art */
                      <svg
                        className="w-8 h-8 text-white stroke-current fill-none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 18h18M4 18l2-10 5 5 5-5 2 10H4z" />
                        <circle cx="6" cy="7" r="1" />
                        <circle cx="11" cy="12" r="1" />
                        <circle cx="16" cy="7" r="1" />
                      </svg>
                    ) : (
                      /* Starburst / sparkle rays */
                      <svg
                        className="w-8 h-8 text-white stroke-current fill-none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="2" x2="12" y2="7" />
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="7" y2="12" />
                        <line x1="17" y1="12" x2="22" y2="12" />
                        <line x1="4.93" y1="4.93" x2="8.46" y2="8.46" />
                        <line x1="15.54" y1="15.54" x2="19.07" y2="19.07" />
                        <line x1="4.93" y1="19.07" x2="8.46" y2="15.54" />
                        <line x1="15.54" y1="8.46" x2="19.07" y2="4.93" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Center 3D Artwork */}
                <div className="relative z-10 my-auto flex items-center justify-center py-4">
                  <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                    <img
                      src={game.image}
                      alt={game.title}
                      className="max-h-full max-w-full object-contain drop-shadow-[0_20px_25px_rgba(0,0,0,0.45)]"
                    />
                  </div>
                </div>

                {/* Bottom Row: Game Title, Subtext & Action */}
                <div className="relative z-10 space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-2xl font-bold tracking-tight text-white">
                        {game.title}
                      </h3>
                      {game.isComingSoon && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30">
                          SOON
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/80 font-normal mt-1 leading-relaxed">
                      {game.subtext}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:underline underline-offset-4 tracking-wide">
                      {game.isComingSoon ? 'Notify Me' : 'Play Now'}
                    </span>

                    <div className="w-10 h-10 rounded-full bg-white/20 group-hover:bg-white/35 backdrop-blur-md border border-white/25 flex items-center justify-center text-white transition-all transform group-hover:translate-x-1 shadow-sm">
                      {game.isComingSoon ? (
                        <Bell className="w-4 h-4 text-amber-300" />
                      ) : (
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 4. BOTTOM BANNER: "More games coming soon..." */}
          <div className="rounded-[24px] sm:rounded-[28px] bg-[#fff0f4] dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden shadow-sm">
            {/* Left: Icon and Text */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#ff3864]/10 text-[#ff3864] flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  More games coming soon...
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  New ways to play, connect and create memories together.
                </p>
              </div>
            </div>

            {/* Center: Handwriting Cursive Watermark */}
            <div className="hidden lg:block select-none pointer-events-none text-center">
              <p
                className="italic text-lg text-rose-400/90 dark:text-rose-300/80 leading-tight transform rotate-[-4deg]"
                style={{ fontFamily: "'Caveat', cursive, 'Brush Script MT', sans-serif" }}
              >
                Same People<br />
                New Games <span className="text-[#ff3864]">♡</span>
              </p>
            </div>

            {/* Right: Stay Updated Button */}
            <button
              type="button"
              onClick={() => handleStayUpdated()}
              className="px-5 py-2.5 rounded-full bg-white dark:bg-white/10 hover:bg-rose-50 dark:hover:bg-white/15 border border-rose-200 dark:border-white/10 text-slate-800 dark:text-white text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer self-start md:self-auto"
            >
              <Bell className="w-4 h-4 text-[#ff3864]" />
              <span>Stay Updated</span>
            </button>
          </div>
        </div>
      </main>

      {/* Opponent Selector Drawer */}
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
