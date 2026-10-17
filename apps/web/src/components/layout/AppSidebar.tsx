'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Crown,
  Bookmark,
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
  Settings as SettingsIcon
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  getStoredSession,
  clearStoredSession,
  getFriendRequests,
  UserSession
} from '../../lib/api';
import { ChatStore } from '../../lib/chatStore';
import { TIER_INFO } from '@synccinema/common';
import { useMyMembership } from '../membership/useMyMembership';
import { resolveActiveNav, type SidebarNavItem } from '../../lib/sidebarNav';

export type { SidebarNavItem };

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

interface AppSidebarProps {
  activeNav?: SidebarNavItem;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  incomingRequestsCount?: number;
}

interface NavEntry {
  id: SidebarNavItem;
  href: string;
  label: string;
  Icon: LucideIcon;
}
/** One list, one order: Home (Discover), Watchlist, My Rooms, Friends, Plans, Games, Chat. */
const NAV: NavEntry[] = [
  { id: 'home', href: '/discover', label: 'Home', Icon: Home },
  { id: 'watchlist', href: '/watchlist', label: 'Watchlist', Icon: Bookmark },
  { id: 'rooms', href: '/rooms', label: 'My Rooms', Icon: Users },
  { id: 'friends', href: '/friends', label: 'Friends', Icon: Flame },
  { id: 'plans', href: '/plans', label: 'Plans', Icon: Calendar },
  { id: 'games', href: '/games', label: 'Games', Icon: Gamepad2 },
  { id: 'chat', href: '/chat', label: 'Chat', Icon: MessageCircle }
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49]';

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
  const myMembership = useMyMembership();
  const myTier = myMembership?.tier ?? session?.user.membership?.tier ?? 'free';
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
    void ChatStore.syncWithExistingFriends();
    const unsub = ChatStore.subscribe(updateCount);
    return () => unsub();
  }, []);

  // Sync if prop updates
  useEffect(() => {
    if (incomingRequestsCount !== undefined) {
      setPendingRequests(incomingRequestsCount);
    }
  }, [incomingRequestsCount]);

  const currentActive = resolveActiveNav(activeNav, pathname || '/');

  // ---- mobile drawer: close on route change, Escape, focus in / back, body scroll lock, Tab stays inside ----------
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastPath = useRef(pathname);
  // pages pass a fresh callback on every render: keep it in a ref so the drawer effects only depend on open / closed
  const closeCb = useRef(onMobileClose);
  closeCb.current = onMobileClose;
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      if (isMobileOpen) closeCb.current?.();
    }
  }, [pathname, isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCb.current?.();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [isMobileOpen]);

  const handleLogout = () => {
    clearStoredSession();
    router.push('/login');
  };

  const tierText = myTier === 'free' ? 'text-zinc-500 dark:text-zinc-400' : 'text-amber-600 dark:text-amber-400';
  const badge = (id: SidebarNavItem): number => (id === 'friends' ? pendingRequests : id === 'chat' ? unreadChatCount : 0);

  const navContent = (inDrawer: boolean) => (
    <div className={`flex h-dvh w-full flex-col overflow-hidden border-r border-zinc-200 bg-white select-none dark:border-white/10 dark:bg-[#14151b]`}>
      {/* 1. Brand header: pinned top */}
      <div className="shrink-0 border-b border-zinc-100 px-4 py-4 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <Link href="/discover" onClick={onMobileClose} className={`group flex min-w-0 items-center gap-2.5 rounded-lg ${FOCUS_RING}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ee1d49] text-white">
              <div className="flex h-4 w-4 items-center justify-center rounded-md border-2 border-white">
                <div className="h-1.5 w-1.5 rounded-xs bg-white" />
              </div>
            </div>
            <div>
              <div className="text-lg font-black leading-none tracking-tight text-zinc-900 dark:text-white">
                Watch<span className="text-[#ee1d49]">.</span>
              </div>
              <div className="mt-1 whitespace-nowrap text-[8px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                by StitchByte
              </div>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            {session?.user && !session.user.isAnonymous && myTier === 'free' && (
              <Link
                href="/pricing"
                onClick={onMobileClose}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400 ${FOCUS_RING}`}
              >
                <Crown className="h-3 w-3" aria-hidden="true" />
                <span>Upgrade</span>
              </Link>
            )}
            {inDrawer && onMobileClose && (
              <button
                ref={closeRef}
                type="button"
                onClick={onMobileClose}
                aria-label="Close menu"
                className={`cursor-pointer rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white ${FOCUS_RING}`}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Navigation: the only part that scrolls (when the window is short) */}
      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [scrollbar-width:thin]">
        <ul className="space-y-1">
          {NAV.map(({ id, href, label, Icon }) => {
            const active = currentActive === id;
            const count = badge(id);
            return (
              <li key={id}>
                <Link
                  href={href}
                  onClick={onMobileClose}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-xs transition ${FOCUS_RING} ${
                    active
                      ? 'bg-zinc-100 font-bold text-zinc-900 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r before:bg-[#ee1d49] dark:bg-white/[0.08] dark:text-white'
                      : 'font-semibold text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-white'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#ee1d49]' : 'text-zinc-400 dark:text-zinc-400'}`} aria-hidden="true" />
                    <span className="truncate whitespace-nowrap">{label}</span>
                  </span>
                  {count > 0 && (
                    <span className="ml-2 shrink-0 rounded-full bg-[#ee1d49] px-1.5 py-0.5 text-[10px] font-black leading-none text-white" aria-label={`${count} new`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 3. Footer: settings, theme, account. Pinned bottom. */}
      <div className="shrink-0 space-y-1.5 border-t border-zinc-200 bg-zinc-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-[#101117]">
        <Link
          href="/profile"
          onClick={onMobileClose}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-white ${FOCUS_RING}`}
        >
          <SettingsIcon className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
          <span>Settings</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.04] ${FOCUS_RING}`}
        >
          <span className="flex items-center gap-2">
            {isDark ? <Moon className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" /> : <Sun className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />}
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
          </span>
          <span className="font-mono text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Toggle</span>
        </button>

        {session?.user && (
          <div className={`flex items-center justify-between rounded-2xl p-2.5 pr-3 ${currentActive === 'profile' ? 'bg-zinc-200 ring-1 ring-[#ee1d49]/40 dark:bg-white/[0.08]' : 'bg-zinc-100 dark:bg-white/[0.04]'}`}>
            <Link href="/profile" onClick={onMobileClose} title="View Profile & Settings" className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg ${FOCUS_RING}`}>
              <img
                src={getBitmojiAvatarUrl(session.user.avatarUrl, session.user.displayName)}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-zinc-900 dark:text-white">{session.user.displayName}</p>
                <p className={`truncate text-[10px] font-bold ${tierText}`}>{TIER_INFO[myTier].badgeLabel}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title="Log Out"
              aria-label="Log out"
              className={`ml-1.5 shrink-0 cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-[#ee1d49]/10 hover:text-[#ee1d49] ${FOCUS_RING}`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/*
        Desktop: a fixed sidebar that never scrolls with the page. The <aside> stays in the page's flex row as a
        same-width spacer (so every page keeps its own layout), and the panel inside is position: fixed to the
        viewport, which no ancestor's overflow can break (unlike sticky).
      */}
      <aside aria-label="Sidebar" className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 z-30 w-64">{navContent(false)}</div>
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div onClick={onMobileClose} className="fixed inset-0 bg-black/60 motion-safe:animate-fadeIn" aria-hidden="true" />
          <div ref={drawerRef} className="relative z-10 h-dvh w-[82vw] max-w-[320px] motion-safe:animate-slideRight">
            {navContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
