'use client';

import React from 'react';
import { UserPlus, ArrowRight } from 'lucide-react';

interface InviteFriendProps {
  onInvite: () => void;
  isDark?: boolean;
}

export const InviteFriend: React.FC<InviteFriendProps> = ({ onInvite, isDark = false }) => {
  return (
    <div
      onClick={onInvite}
      className="w-full max-w-md mx-auto rounded-full p-2.5 sm:p-3 pl-4 sm:pl-5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(255,43,112,0.06)] backdrop-blur-xl flex items-center justify-between gap-3 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] select-none"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4" />
        </div>

        <div className="min-w-0 text-left">
          <h4 className="text-xs sm:text-sm font-extrabold text-[#16132b] dark:text-white leading-tight truncate">
            Invite a Friend
          </h4>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5">
            Share the room code and start doodling together!
          </p>
        </div>
      </div>

      <div className="w-8 h-8 rounded-full border border-pink-200 dark:border-pink-800/40 bg-pink-50 dark:bg-pink-950/30 text-[#ff2b70] flex items-center justify-center shrink-0 shadow-2xs">
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );
};
