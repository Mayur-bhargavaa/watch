'use client';

import React, { useState } from 'react';
import { Bell, Sparkles, Flame, Gamepad2, Heart, ShieldCheck, X } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export const NotificationPermissionModal: React.FC = () => {
  const { showPermissionModal, requestPermission, dismissPermissionModal, permission } = useNotifications();
  const [loading, setLoading] = useState<boolean>(false);

  if (!showPermissionModal) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      await requestPermission();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-none animate-fadeIn">
      {/* Heavy Full-Blur Backdrop (matches user uploaded reference) */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-2xl transition-all duration-300"
        aria-hidden="true"
      />

      {/* Centered Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#15101f] rounded-3xl shadow-2xl shadow-black/50 border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 overflow-hidden transform transition-all animate-scaleUp">
        {/* Glow Accent Header */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#ee1d49]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close / Dismiss button */}
        <button
          type="button"
          onClick={dismissPermissionModal}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          title="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-3xl bg-[#ee1d49] blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#ee1d49] to-[#ff4b72] flex items-center justify-center text-white shadow-lg shadow-[#ee1d49]/30">
              <Bell className="w-8 h-8 animate-bounce" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Stay in the Loop 🔔
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Enable notifications to get witty partner roasts, game challenges, and watch invites even when this tab is closed!
            </p>
          </div>
        </div>

        {/* Perks / Highlights */}
        <div className="my-6 space-y-2.5">
          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">Zomato-Style Roasts & Nudges</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                Get hilarious ping alerts when your partner misses you.
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">Live Game & Watch Invites</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                One-tap jump straight into Ludo, Connect 4, or Cinema.
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">Streak Saver Alerts</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                Never lose your streak with timely reminders.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ee1d49] via-[#ff2b5e] to-[#ff4b72] hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-[#ee1d49]/30 transition transform active:scale-98 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Bell className="w-4 h-4" />
            <span>{loading ? 'Requesting Permission...' : 'Allow Live Notifications'}</span>
          </button>

          <button
            type="button"
            onClick={dismissPermissionModal}
            className="w-full py-2.5 px-4 rounded-2xl text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition cursor-pointer"
          >
            Maybe Later
          </button>
        </div>

        {/* Browser Permission Note */}
        {permission === 'denied' && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
              ⚠️ Notifications are blocked in your browser. Click the site settings icon in the URL bar to allow notifications.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
