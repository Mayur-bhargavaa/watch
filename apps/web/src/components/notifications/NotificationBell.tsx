'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Sparkles,
  Flame,
  Gamepad2,
  Film,
  MessageSquare
} from 'lucide-react';
import { useNotifications, AppNotification } from '../../context/NotificationContext';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'game':
      return <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />;
    case 'watch':
      return <Film className="w-3.5 h-3.5 text-blue-400" />;
    case 'streak':
      return <Flame className="w-3.5 h-3.5 text-amber-500" />;
    case 'nudge':
    default:
      return <MessageSquare className="w-3.5 h-3.5 text-rose-500" />;
  }
}

export const NotificationBell: React.FC<{ className?: string }> = ({ className = '' }) => {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    markAsRead,
    markAllAsRead,
    clearAll,
    triggerLocalNotification
  } = useNotifications();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleTestRoast = () => {
    triggerLocalNotification({
      title: 'Zomato Roast 🛵💨',
      body: 'Khana thanda ho jayega par aapka reply nahi aayega... Jaldi aao!',
      category: 'nudge',
      link: '/games'
    });
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5 transition-transform active:scale-90" />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white font-black text-[10px] flex items-center justify-center shadow-md shadow-[#ee1d49]/40 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-[#15101f]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#ee1d49]/10 text-[#ee1d49] text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-slate-500 hover:text-[#ee1d49] dark:text-zinc-400 dark:hover:text-white transition flex items-center space-x-1 cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04] scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#ee1d49]/10 text-[#ee1d49] mx-auto flex items-center justify-center text-2xl">
                  🍿
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    No notifications yet!
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs mx-auto">
                    When your partner pings you, sends a roast, or invites you to a game, it will appear here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestRoast}
                  className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-[#ee1d49]/10 text-slate-600 dark:text-zinc-300 hover:text-[#ee1d49] text-[11px] font-semibold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#ee1d49]" />
                  <span>Send Test Roast 🛵</span>
                </button>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 flex items-start space-x-3 transition cursor-pointer group ${
                    !n.read
                      ? 'bg-slate-50/80 dark:bg-white/[0.03] hover:bg-slate-100/80 dark:hover:bg-white/[0.06]'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Category icon / avatar */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center text-lg shadow-2xs">
                      {n.emoji || getCategoryIcon(n.category)}
                    </div>
                    {!n.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#ee1d49] ring-2 ring-white dark:ring-[#15101f]" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {n.title}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0 ml-2">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>

                    {n.link && (
                      <div className="mt-2 flex items-center space-x-1 text-[10px] font-bold text-[#ee1d49] group-hover:translate-x-0.5 transition-transform">
                        <span>Click to open</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Quick Action */}
          <div className="p-3 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTestRoast}
              className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 hover:text-[#ee1d49] transition flex items-center space-x-1 cursor-pointer"
              title="Test roast notification & Chrome desktop popup"
            >
              <Sparkles className="w-3 h-3 text-[#ee1d49]" />
              <span>Test Chrome Popup 🚀</span>
            </button>

            {permission !== 'granted' ? (
              <button
                type="button"
                onClick={() => requestPermission()}
                className="px-2 py-1 rounded-lg bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
              >
                <Bell className="w-3 h-3" />
                <span>Enable Alerts</span>
              </button>
            ) : (
              <span className="text-[9px] font-mono text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chrome Alerts ON</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
