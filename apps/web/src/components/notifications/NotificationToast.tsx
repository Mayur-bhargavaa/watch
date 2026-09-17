'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X, ExternalLink } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export const NotificationToast: React.FC = () => {
  const router = useRouter();
  const { activeToast, dismissToast, markAsRead } = useNotifications();

  if (!activeToast) return null;

  const handleAction = () => {
    markAsRead(activeToast.id);
    dismissToast();
    if (activeToast.link) {
      router.push(activeToast.link);
    }
  };

  return (
    <div className="fixed top-5 right-5 z-[9990] max-w-sm w-full animate-slideInRight select-none">
      <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#181324]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 p-4 shadow-2xl shadow-black/30">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ee1d49] via-purple-500 to-[#ff3b68]" />

        <div className="flex items-start space-x-3">
          {/* Emoji / Icon */}
          <div className="w-10 h-10 rounded-xl bg-[#ee1d49]/10 text-[#ee1d49] flex items-center justify-center text-xl shrink-0">
            {activeToast.emoji || '🔔'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                {activeToast.title}
              </h4>
              <button
                type="button"
                onClick={dismissToast}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 line-clamp-2 leading-relaxed font-medium">
              {activeToast.body}
            </p>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                Just now
              </span>

              {activeToast.link && (
                <button
                  type="button"
                  onClick={handleAction}
                  className="px-3 py-1.5 rounded-lg bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-[11px] font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>Open Now</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
