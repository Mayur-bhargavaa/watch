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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Activity Schedule</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300 font-bold">
              {activities.length} {activities.length === 1 ? 'part' : 'parts'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Follow the flow from watching to playing seamlessly together.
          </p>
        </div>

        {isHost && onAddActivity && (
          <button
            type="button"
            onClick={onAddActivity}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-800 dark:text-white hover:bg-[#ee1d49] hover:text-white dark:hover:bg-[#ee1d49] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Step</span>
          </button>
        )}
      </div>

      {/* Connected Timeline */}
      <div className="relative pl-6 md:pl-8 space-y-6 before:absolute before:left-3 md:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#ee1d49] before:via-violet-500 before:to-emerald-500 before:opacity-30 dark:before:opacity-40">
        {activities.map((act, index) => (
          <div key={act.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-6 md:-left-8 top-5 w-6 h-6 rounded-full bg-white dark:bg-[#130e1b] border-2 border-slate-300 dark:border-white/20 flex items-center justify-center shadow-md group-hover:border-[#ee1d49] group-hover:scale-110 transition-all duration-200 z-10">
              <div
                className={`w-2 h-2 rounded-full ${
                  act.type === 'movie'
                    ? 'bg-[#ee1d49]'
                    : act.type === 'game'
                    ? 'bg-violet-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>

            {/* Card Content */}
            <div
              className={`rounded-3xl p-5 md:p-6 bg-gradient-to-br ${getActivityGradient(
                act.type
              )} bg-white/80 dark:bg-[#151022]/80 backdrop-blur-md border transition-all duration-300 shadow-sm hover:shadow-xl`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Icon / Poster */}
                  {act.movieDetails?.posterUrl ? (
                    <img
                      src={act.movieDetails.posterUrl}
                      alt={act.title}
                      className="w-16 h-20 rounded-2xl object-cover shadow-md shrink-0 border border-white/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/[0.08] shadow-sm flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/10">
                      {getActivityIcon(act.type)}
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-[#ee1d49] px-2 py-0.5 rounded-lg bg-[#ee1d49]/10">
                        {act.time}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                        Part {index + 1} · {act.type.toUpperCase()}
                      </span>
                    </div>

                    <h4 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {act.title}
                    </h4>

                    {act.subtitle && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        {act.subtitle}
                      </p>
                    )}

                    {act.gameDetails && (
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-zinc-300">
                        <span>{act.gameDetails.icon}</span>
                        <span className="font-semibold">Lobby Ready: {act.gameDetails.players}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Big Glowing Action Button */}
                <div className="flex items-center justify-end">
                  {act.actionUrl ? (
                    <Link
                      href={act.actionUrl}
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs md:text-sm font-black transition-transform active:scale-95 ${getActionBadgeColor(
                        act.type
                      )}`}
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{act.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alert(`Starting ${act.title}...`)}
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs md:text-sm font-black transition-transform active:scale-95 ${getActionBadgeColor(
                        act.type
                      )}`}
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{act.actionLabel}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
