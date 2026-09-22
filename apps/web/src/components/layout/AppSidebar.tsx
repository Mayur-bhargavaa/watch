'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Film,
  Heart,
  Flame,
  Users,
  Gamepad2,
  Calendar,
  Sun,
  Moon,
  LogOut,
  X,
  MessageCircle,
  Home,
  Bell,
  Settings as SettingsIcon
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  clearStoredSession,
  getFriendRequests,
  UserSession
} from '../../lib/api';
import { ChatStore } from '../../lib/chatStore';

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

export type SidebarNavItem =
  | 'home'
  | 'dashboard'
  | 'watchlist'
  | 'friends'
  | 'plans'
  | 'rooms'
  | 'games'
  | 'chat'
  | 'notifications'
  | 'profile'
  | 'settings';

interface AppSidebarProps {
  activeNav?: SidebarNavItem;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  incomingRequestsCount?: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeNav,
  isMobileOpen = false,
  onMobileClose,
  incomingRequestsCount
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [pendingRequests, setPendingRequests] = useState<number>(incomingRequestsCount ?? 0);

  // Load user session
  useEffect(() => {
    const loadSession = () => {
      const s = getStoredSession();
      if (s && s.token) {
        setSession(s);
        if (incomingRequestsCount === undefined) {
          getFriendRequests(s.token)
            .then((res) => {
              if (res?.incoming) {
                setPendingRequests(res.incoming.length);
              }
            })
            .catch(() => {});
        }
      }
    };

    loadSession();

    // Re-sync whenever session is updated (e.g. after saving avatar)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'synccinema_session') loadSession();
    };
    const handleCustom = () => loadSession();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('synccinema:session-updated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('synccinema:session-updated', handleCustom);
    };
  }, [incomingRequestsCount]);


  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Subscribe to ChatStore for unread messages badge and load existing friends
  useEffect(() => {
    const updateCount = () => {
      setUnreadChatCount(ChatStore.getUnreadTotalCount());
    };
    updateCount();
    ChatStore.syncWithExistingFriends();
    const unsub = ChatStore.subscribe(updateCount);
    return () => unsub();
  }, []);

  // Sync if prop updates
  useEffect(() => {
    if (incomingRequestsCount !== undefined) {
      setPendingRequests(incomingRequestsCount);
    }
  }, [incomingRequestsCount]);

  // Determine current active item
  const currentActive: SidebarNavItem =
    activeNav ||
    (pathname === '/'
      ? 'home'
      : pathname === '/dashboard'
      ? 'dashboard'
      : pathname.startsWith('/chat')
      ? 'chat'
      : pathname === '/friends'
      ? 'friends'
      : pathname.startsWith('/plans')
      ? 'plans'
      : pathname.startsWith('/games')
      ? 'games'
      : pathname === '/watchlist'
      ? 'watchlist'
      : pathname === '/rooms'
      ? 'rooms'
      : pathname === '/profile'
      ? 'profile'
      : 'dashboard');

  const handleLogout = () => {
    clearStoredSession();
    router.push('/login');
  };

  const navContent = (
    <div className="w-64 h-full flex flex-col justify-between p-5 bg-white dark:bg-[#130e1b] border-r border-slate-200/80 dark:border-white/[0.06] select-none">
      {/* Brand Header & Navigation Links */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3 group">
            {/* Custom Brand Icon: Red squircle with hollow play square */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#ee1d49] to-[#ff3b68] shadow-md shadow-[#ee1d49]/30 flex items-center justify-center text-white transition-transform group-hover:scale-105">
              <div className="w-4 h-4 rounded-md border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-xs"></div>
              </div>
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                Watch<span className="text-[#ee1d49]">.</span>
              </div>
              <div className="text-[9px] font-bold tracking-widest text-slate-400 dark:text-zinc-500 uppercase mt-0.5">
                Powered by StitchByte
              </div>
            </div>
          </Link>

          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Main Navigation (Clean WhatsApp + Snapchat style) */}
        <div className="space-y-1 pt-2">
          {/* Home */}
          <Link
            href="/"
            onClick={onMobileClose}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'home'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Home
              className={`w-4 h-4 shrink-0 ${
                currentActive === 'home'
                  ? 'text-[#ee1d49]'
                  : 'text-slate-400 dark:text-zinc-400'
              }`}
            />
            <span>Home</span>
          </Link>

          {/* Watchlist */}
          <Link
            href="/watchlist"
            onClick={onMobileClose}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'watchlist'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Heart
              className={`w-4 h-4 shrink-0 ${
                currentActive === 'watchlist'
                  ? 'text-[#ee1d49] fill-[#ee1d49]/20'
                  : 'text-slate-400 dark:text-zinc-400'
              }`}
            />
            <span>Watchlist</span>
          </Link>

          {/* My Rooms */}
          <Link
            href="/rooms"
            onClick={onMobileClose}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'rooms'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Users
              className={`w-4 h-4 shrink-0 ${
                currentActive === 'rooms'
                  ? 'text-[#ee1d49]'
                  : 'text-slate-400 dark:text-zinc-400'
              }`}
            />
            <span>My Rooms</span>
          </Link>

          {/* Friends */}
          <Link
            href="/friends"
            onClick={onMobileClose}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'friends'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <Flame
                className={`w-4 h-4 shrink-0 ${
                  currentActive === 'friends'
                    ? 'text-[#ee1d49] fill-[#ee1d49]/20'
                    : 'text-slate-400 dark:text-zinc-400'
                }`}
              />
              <span className="truncate whitespace-nowrap">Friends</span>
            </div>
            {pendingRequests > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full bg-[#ee1d49] text-white font-black text-[10px] leading-none animate-pulse">
                {pendingRequests}
              </span>
            ) : (
              <span className="text-sm shrink-0 leading-none pl-2">🔥</span>
            )}
          </Link>

          {/* Plans */}
          <Link
            href="/plans"
            onClick={onMobileClose}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'plans'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <Calendar
                className={`w-4 h-4 shrink-0 ${
                  currentActive === 'plans'
                    ? 'text-[#ee1d49]'
                    : 'text-slate-400 dark:text-zinc-400'
                }`}
              />
              <span className="truncate whitespace-nowrap">Plans</span>
            </div>
            <span className="text-[9px] bg-rose-500/10 text-[#ee1d49] font-bold px-1.5 py-0.5 rounded-md">
              NEW
            </span>
          </Link>

          {/* Games */}
          <Link
            href="/games"
            onClick={onMobileClose}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'games'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <Gamepad2
                className={`w-4 h-4 shrink-0 ${
                  currentActive === 'games'
                    ? 'text-[#ee1d49]'
                    : 'text-slate-400 dark:text-zinc-400'
                }`}
              />
              <span className="truncate whitespace-nowrap">Games</span>
            </div>
            <span className="text-[9px] bg-[#ee1d49]/10 text-[#ee1d49] font-bold px-1.5 py-0.5 rounded-md">
              PLAY
            </span>
          </Link>

          {/* Chat — FIRST-CLASS SOCIAL FEATURE */}
          <Link
            href="/chat"
            onClick={onMobileClose}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs transition cursor-pointer ${
              currentActive === 'chat'
                ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#ee1d49] before:rounded-r'
                : 'font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <MessageCircle
                className={`w-4 h-4 shrink-0 ${
                  currentActive === 'chat'
                    ? 'text-[#ee1d49] fill-[#ee1d49]/20'
                    : 'text-slate-400 dark:text-zinc-400'
                }`}
              />
              <span className="truncate whitespace-nowrap font-bold">Chat</span>
            </div>
            {unreadChatCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#ee1d49] text-white font-black text-[10px] leading-none shadow-sm shadow-[#ee1d49]/40 animate-pulse">
                {unreadChatCount}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Live chat active" />
            )}
          </Link>
        </div>
      </div>

      {/* Sidebar Footer: Profile, Settings, & User card */}
      <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-white/[0.06]">
        {/* Quick Links: Settings */}
        <div className="space-y-0.5">
          <Link
            href="/profile"
            onClick={onMobileClose}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
            <span>Settings</span>
          </Link>
        </div>

        {/* Light / Dark Mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            {isDark ? (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500 font-bold">
            Toggle
          </span>
        </button>

        {/* User Card - Links directly to /profile */}
        {session?.user && (
          <div
            className={`flex items-center justify-between p-2.5 rounded-2xl transition group ${
              currentActive === 'profile'
                ? 'bg-slate-200/90 dark:bg-white/[0.08] ring-1 ring-[#ee1d49]/30 shadow-xs'
                : 'bg-slate-100/80 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.07]'
            }`}
          >
            <Link
              href="/profile"
              onClick={onMobileClose}
              className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer"
              title="View Profile & Settings"
            >
              <img
                src={getBitmojiAvatarUrl(session.user.avatarUrl, session.user.displayName)}
                alt={session.user.displayName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-white/10 shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-200"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#ee1d49] transition-colors">
                  {session.user.displayName}
                </p>
                <p className="text-[10px] font-mono text-[#ee1d49] font-bold truncate">
                  #{session.user.partnerCode || 'USER'}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              title="Log Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex shrink-0 h-screen sticky top-0 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 animate-slideRight">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
