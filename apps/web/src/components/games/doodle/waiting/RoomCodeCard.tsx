'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface RoomCodeCardProps {
  roomCode: string;
  isDark?: boolean;
}

export const RoomCodeCard: React.FC<RoomCodeCardProps> = ({ roomCode, isDark = false }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCopyCode = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    showToast('Room code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareLink = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/games/doodle-duel?room=${encodeURIComponent(roomCode)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Doodle Duel Room!',
          text: `Join my Doodle Duel room: ${roomCode}`,
          url
        });
        showToast('Invite link shared!');
        return;
      } catch (err) {
        // Fallback to clipboard if share canceled or rejected
      }
    }

    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Room link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="relative w-full rounded-3xl p-4 sm:p-5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_24px_rgba(255,43,112,0.06)] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#16132b] text-white text-xs font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150 z-30 flex items-center gap-1.5 whitespace-nowrap">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left: Room Code */}
      <div className="text-center sm:text-left flex-1 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block">
          Room Code
        </span>
        <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
          <span className="text-2xl sm:text-3xl font-mono font-black text-[#ff2b70] tracking-wider leading-tight">
            {roomCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-[#ff2b70] transition active:scale-95 cursor-pointer"
            title="Copy Code"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Right: Share with your friend */}
      <div className="flex flex-col sm:items-end items-center gap-1.5 w-full sm:w-auto">
        <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-400 block">
          Share with your friend
        </span>

        <button
          type="button"
          onClick={handleShareLink}
          className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-6 rounded-2xl bg-gradient-to-r from-[#ff2b70] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_16px_rgba(255,43,112,0.35)] transition active:scale-95 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
        </button>
      </div>
    </div>
  );
};
