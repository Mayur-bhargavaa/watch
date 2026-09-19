'use client';

import React from 'react';
import Link from 'next/link';
import {
  Film,
  Gamepad2,
  MessageCircle,
  Play,
  ArrowRight,
  Clock,
  Sparkles,
  ExternalLink,
  Plus
} from 'lucide-react';
import { PlanActivity } from '../../types/plans';

interface ActivityTimelineProps {
  activities: PlanActivity[];
  planTitle: string;
  isHost?: boolean;
  onAddActivity?: () => void;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  planTitle,
  isHost = false,
  onAddActivity
}) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return <Film className="w-5 h-5 text-[#ee1d49]" />;
      case 'game':
        return <Gamepad2 className="w-5 h-5 text-violet-400" />;
      case 'hangout':
      case 'chat':
      default:
        return <MessageCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getActivityGradient = (type: string) => {
    switch (type) {
      case 'movie':
        return 'from-[#ee1d49]/10 via-[#ee1d49]/5 to-transparent border-[#ee1d49]/20 hover:border-[#ee1d49]/50';
      case 'game':
        return 'from-violet-500/10 via-violet-500/5 to-transparent border-violet-500/20 hover:border-violet-500/50';
      case 'hangout':
      case 'chat':
      default:
        return 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 hover:border-emerald-500/50';
    }
  };

  const getActionBadgeColor = (type: string) => {
    switch (type) {
      case 'movie':
        return 'bg-gradient-to-r from-[#ee1d49] to-[#ff3b68] text-white shadow-lg shadow-[#ee1d49]/25 hover:brightness-110';
      case 'game':
        return 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:brightness-110';
      case 'hangout':
      case 'chat':
      default:
        return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Activity Schedule
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Follow the flow from watching to playing seamlessly together.
          </p>
        </div>

        {isHost && onAddActivity && (
          <button
            type="button"
            onClick={onAddActivity}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-white/5 border border-rose-100 dark:border-white/10 text-xs font-black text-[#ff2a5f] hover:bg-[#ff2a5f] hover:text-white transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Step</span>
          </button>
        )}
      </div>

      {/* Connected Timeline */}
      <div className="relative pl-24 md:pl-28 space-y-5 before:absolute before:left-14 md:before:left-16 before:top-6 before:bottom-6 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10">
        {activities.map((act, index) => (
          <div key={act.id} className="relative group">
            {/* Timestamp on left */}
            <div className="absolute -left-24 md:-left-28 top-7 w-12 text-right text-xs font-black text-slate-800 dark:text-zinc-200">
              {act.time}
            </div>

            {/* Timeline Ring Dot */}
            <div className="absolute -left-12 md:-left-14 top-6 w-6 h-6 rounded-full bg-white dark:bg-[#130e1b] border-2 border-slate-200 dark:border-white/20 flex items-center justify-center z-10">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  act.type === 'movie'
                    ? 'bg-[#ff2a5f]'
                    : act.type === 'game'
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>

            {/* Card Content */}
            <div className="rounded-3xl p-4 md:p-5 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs hover:border-slate-300 dark:hover:border-white/20 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Icon / Poster */}
                  {act.movieDetails?.posterUrl ? (
                    <img
                      src={act.movieDetails.posterUrl}
                      alt={act.title}
                      className="w-20 h-16 rounded-2xl object-cover shadow-sm shrink-0 border border-slate-100 dark:border-white/10"
                    />
                  ) : act.type === 'game' ? (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm text-2xl">
                      🎲
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-300 text-2xl">
                      💬
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-[#ff2a5f] dark:bg-[#ff2a5f]/15 border border-rose-100 dark:border-[#ff2a5f]/20">
                      Part {index + 1} · {act.type.toUpperCase()}
                    </span>

                    <h4 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {act.title}
                    </h4>

                    {act.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {act.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Big Action Button matching screenshot */}
                <div className="flex items-center justify-end">
                  <Link
                    href={act.actionUrl || '/rooms'}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer shadow-xs ${
                      act.type === 'movie'
                        ? 'bg-[#ff2a5f] hover:bg-[#ee1d49] text-white shadow-md shadow-[#ff2a5f]/25'
                        : act.type === 'game'
                        ? 'bg-rose-50 dark:bg-white/5 border border-rose-100 dark:border-white/10 text-[#ff2a5f] hover:bg-[#ff2a5f] hover:text-white'
                        : 'bg-rose-50 dark:bg-white/5 border border-rose-100 dark:border-white/10 text-[#ff2a5f] hover:bg-[#ff2a5f] hover:text-white'
                    }`}
                  >
                    {act.type === 'movie' && <Play className="w-3.5 h-3.5 fill-white" />}
                    {act.type === 'game' && <Gamepad2 className="w-3.5 h-3.5" />}
                    {act.type === 'hangout' && <MessageCircle className="w-3.5 h-3.5" />}
                    <span>{act.actionLabel}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
