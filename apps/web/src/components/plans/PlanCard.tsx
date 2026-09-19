'use client';

import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Users,
  ArrowRight,
  Sparkles,
  Film,
  Gamepad2,
  MessageCircle,
  Share2,
  Check
} from 'lucide-react';
import { Plan } from '../../types/plans';

// Helper for bitmoji / avatar
function getBitmojiAvatar(url?: string | null, fallbackSeed?: string): string {
  if (url && url.trim() !== '') {
    if (url.startsWith('/avatars/')) return url;
    return url
      .replace(/[?&]radius=[^&]+/g, '')
      .replace(/[?&]backgroundColor=[^&]+/g, '');
  }
  const seed = encodeURIComponent(fallbackSeed || 'player');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&skinColor=edb98a&top=shortCurly&hairColor=4a312c&accessoriesProbability=0&clothing=blazerAndShirt&clothesColor=25557c&eyes=wink&mouth=smile`;
}

interface PlanCardProps {
  plan: Plan;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan }) => {
  const [copied, setCopied] = React.useState(false);

  const goingParticipants = plan.participants.filter((p) => p.status === 'GOING');
  const maybeParticipants = plan.participants.filter((p) => p.status === 'MAYBE');

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/plans/${plan.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie':
        return 'from-rose-500/10 to-amber-500/10 text-rose-500 border-rose-500/20';
      case 'game':
        return 'from-violet-500/10 to-indigo-500/10 text-violet-500 border-violet-500/20';
      case 'birthday':
        return 'from-amber-500/10 to-orange-500/10 text-amber-500 border-amber-500/20';
      case 'anniversary':
        return 'from-pink-500/10 to-rose-500/10 text-pink-500 border-pink-500/20';
      case 'party':
        return 'from-emerald-500/10 to-teal-500/10 text-emerald-500 border-emerald-500/20';
      default:
        return 'from-slate-500/10 to-zinc-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="group relative block rounded-3xl p-5 md:p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-[#ee1d49]/5 dark:hover:shadow-[#ee1d49]/10"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Emoji + Info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.08] dark:to-white/[0.02] border border-slate-200 dark:border-white/10 flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform duration-300">
            {plan.emoji || '✨'}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-[#ee1d49] transition-colors truncate">
                {plan.title}
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-gradient-to-r ${getTypeColor(
                  plan.type
                )}`}
              >
                {plan.type}
              </span>
              {plan.voting && !plan.voting.isClosed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Voting Open
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
              <span className="flex items-center gap-1 text-slate-700 dark:text-zinc-200">
                <Calendar className="w-3.5 h-3.5 text-[#ee1d49]" />
                {plan.dateFormatted}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {plan.time} {plan.endTime ? `– ${plan.endTime}` : ''} ({plan.timezone})
              </span>
            </div>

            {/* Activities Sequence Pill Stack */}
            {plan.activities && plan.activities.length > 0 && (
              <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                {plan.activities.map((act, idx) => (
                  <React.Fragment key={act.id}>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.06] text-xs font-medium text-slate-700 dark:text-zinc-300">
                      {act.type === 'movie' ? (
                        <Film className="w-3 h-3 text-[#ee1d49]" />
                      ) : act.type === 'game' ? (
                        <Gamepad2 className="w-3 h-3 text-violet-400" />
                      ) : (
                        <MessageCircle className="w-3 h-3 text-emerald-400" />
                      )}
                      <span className="font-bold text-slate-900 dark:text-white">{act.time}</span>
                      <span className="text-slate-400 dark:text-zinc-500">·</span>
                      <span className="truncate max-w-[130px]">{act.title}</span>
                    </div>
                    {idx < plan.activities.length - 1 && (
                      <span className="text-slate-400 dark:text-zinc-600 text-xs font-bold">
                        →
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Attendees Avatars & Open Plan CTA */}
        <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/[0.04]">
          {/* Avatar stack */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2.5 overflow-hidden p-0.5">
              {goingParticipants.slice(0, 4).map((p) => (
                <img
                  key={p.userId}
                  src={getBitmojiAvatar(p.avatarUrl, p.displayName)}
                  alt={p.displayName}
                  className="inline-block w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#151022] object-cover bg-slate-200 dark:bg-zinc-800"
                  title={p.displayName}
                />
              ))}
              {goingParticipants.length > 4 && (
                <div className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#151022] bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-white">
                  +{goingParticipants.length - 4}
                </div>
              )}
            </div>

            <div className="text-left">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {goingParticipants.length} going
              </div>
              {maybeParticipants.length > 0 && (
                <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                  {maybeParticipants.length} maybe
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              title="Copy share link"
              className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold group-hover:bg-[#ee1d49] group-hover:text-white dark:group-hover:bg-[#ee1d49] dark:group-hover:text-white transition-colors duration-200 shadow-sm">
              <span>Open Plan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
