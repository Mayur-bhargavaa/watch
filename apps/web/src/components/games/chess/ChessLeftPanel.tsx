'use client';

import React from 'react';
import {
  Users,
  Clock,
  Zap,
  RotateCcw,
  Flag,
  Handshake,
  Gamepad2
} from 'lucide-react';

interface ChessLeftPanelProps {
  onOfferDraw: () => void;
  onRequestTakeback: () => void;
  onResign: () => void;
  isDrawDisabled?: boolean;
  isTakebackDisabled?: boolean;
  isResignDisabled?: boolean;
}

export const ChessLeftPanel: React.FC<ChessLeftPanelProps> = ({
  onOfferDraw,
  onRequestTakeback,
  onResign,
  isDrawDisabled = false,
  isTakebackDisabled = false,
  isResignDisabled = false
}) => {
  return (
    <aside className="w-full min-w-0 flex flex-col gap-3 select-none">
      {/* 1. Chess Branding Card */}
      <div className="rounded-[22px] bg-white dark:bg-[#1e1a2e] border border-slate-200/60 dark:border-white/10 shadow-sm backdrop-blur-xl p-4 relative overflow-hidden min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0 shrink">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-rose-400 p-0.5 shadow-md shadow-amber-500/20 flex items-center justify-center shrink-0">
              <span className="text-2xl drop-shadow">👑</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-[#16132b] dark:text-white">Chess</h2>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 leading-snug">
                Classic Strategy. Timeless Fun.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#ff2b70] italic tracking-tight font-serif shrink-0 text-right">
            Good Moves<br />Better Friends ♡
          </span>
        </div>

        {/* Feature Tags */}
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-zinc-400 text-[10px] font-bold border border-slate-200/60 dark:border-white/10 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            2 Players
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-zinc-400 text-[10px] font-bold border border-slate-200/60 dark:border-white/10 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            Real-time
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-zinc-400 text-[10px] font-bold border border-slate-200/60 dark:border-white/10 flex items-center gap-1">
            <Zap className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            Skill for All
          </span>
        </div>
      </div>

      {/* 2. Game Actions Card */}
      <div className="rounded-[22px] bg-white dark:bg-[#1e1a2e] border border-slate-200/60 dark:border-white/10 shadow-sm backdrop-blur-xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          <Gamepad2 className="w-3.5 h-3.5 text-[#ff2b70]" />
          <span>Game Actions</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Offer Draw */}
          <button
            type="button"
            onClick={onOfferDraw}
            disabled={isDrawDisabled}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 text-[#16132b] dark:text-zinc-200 text-xs font-bold border border-slate-200/80 dark:border-white/10 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Handshake className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>Offer Draw</span>
          </button>

          {/* Takeback */}
          <button
            type="button"
            onClick={onRequestTakeback}
            disabled={isTakebackDisabled}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 text-[#16132b] dark:text-zinc-200 text-xs font-bold border border-slate-200/80 dark:border-white/10 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span>Takeback</span>
          </button>
        </div>

        {/* Resign */}
        <button
          type="button"
          onClick={onResign}
          disabled={isResignDisabled}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/80 dark:hover:bg-rose-950/40 active:scale-95 text-[#ff2b70] text-xs font-black border border-rose-200/60 dark:border-rose-500/20 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Resign Game</span>
        </button>
      </div>
    </aside>
  );
};
