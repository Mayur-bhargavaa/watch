'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, ChevronRight, Users, Film } from 'lucide-react';
import { ChatPlanPayload } from '@/types/chat';

interface PlanMessageProps {
  plan: ChatPlanPayload;
  isSender: boolean;
}

export const PlanMessage: React.FC<PlanMessageProps> = ({ plan, isSender }) => {
  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all duration-200 shadow-xs max-w-sm w-full ${
        isSender
          ? 'bg-rose-950/20 dark:bg-rose-950/30 border-rose-300/40 dark:border-rose-800/40 text-slate-900 dark:text-zinc-100'
          : 'bg-white dark:bg-zinc-900/90 border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-zinc-100'
      }`}
    >
      {/* Header Tag */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-[#ee1d49] text-[11px] font-bold uppercase tracking-wider">
          <Film className="w-3 h-3" />
          <span>Watch Plan</span>
        </div>
        <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 capitalize px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800">
          {plan.status || 'Upcoming'}
        </span>
      </div>

      {/* Plan Title */}
      <h4 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white mb-1.5 line-clamp-1">
        {plan.title}
      </h4>

      {/* Date & Time */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-300 mb-3">
        {plan.scheduledAt && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#ee1d49]" />
            <span>{plan.scheduledAt}</span>
          </div>
        )}
        {plan.time && (
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#ee1d49]" />
            <span>{plan.time}</span>
          </div>
        )}
      </div>

      {/* Movie / Details if present */}
      {plan.movieTitle && (
        <div className="text-xs text-slate-500 dark:text-zinc-400 mb-3 bg-slate-100/70 dark:bg-zinc-800/60 p-2 rounded-xl flex items-center justify-between">
          <span className="truncate font-medium">{plan.movieTitle}</span>
          {plan.duration && <span className="shrink-0 text-[11px] opacity-80">{plan.duration}</span>}
        </div>
      )}

      {/* Action Button */}
      <Link
        href={plan.planId ? `/plans?planId=${plan.planId}` : '/plans'}
        className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer"
      >
        <span>View Plan</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
