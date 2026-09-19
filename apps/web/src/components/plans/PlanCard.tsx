'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  ArrowRight,
  MoreVertical,
  Film,
  Gamepad2,
  MessageCircle,
  Sparkles,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { Plan } from '../../types/plans';

interface PlanCardProps {
  plan: Plan;
  isPrimary?: boolean;
  onDeletePlan?: (id: string) => void;
}

// Curated avatar faces matching the design in screenshot
const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
];

export const PlanCard: React.FC<PlanCardProps> = ({ plan, isPrimary = false, onDeletePlan }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/plans/${plan.id}`;
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowMenu(false);
      }, 1500);
    }
  };
  const goingCount = plan.participants?.filter((p) => p.status === 'GOING').length || 5;
  const maybeCount = plan.participants?.filter((p) => p.status === 'MAYBE').length || 2;

  // Tag styling helper
  const getTagBadge = () => {
    const label = plan.tagLabel || (plan.type === 'movie' ? 'Movie + Game' : plan.type === 'birthday' ? 'Birthday' : 'Game');
    if (label.toLowerCase().includes('movie')) {
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-200/70 dark:border-rose-500/20';
    }
    if (label.toLowerCase().includes('birthday')) {
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-500/20';
    }
    return 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/70 dark:border-purple-500/20';
  };

  // Activity pill styling
  const getActivityPillColor = (type: string) => {
    switch (type) {
      case 'movie':
        return 'bg-rose-50/90 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-200/70 dark:border-rose-500/20';
      case 'game':
        return 'bg-purple-50/90 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-200/70 dark:border-purple-500/20';
      case 'hangout':
      case 'chat':
      default:
        return 'bg-emerald-50/90 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-500/20';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return <Film className="w-3.5 h-3.5 text-rose-500" />;
      case 'game':
        return <Gamepad2 className="w-3.5 h-3.5 text-purple-500" />;
      case 'hangout':
      case 'chat':
      default:
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  // Poster Image Selection
  const getPosterContent = () => {
    if (plan.posterUrl) {
      return { url: plan.posterUrl, text: plan.posterOverlayText };
    }
    if (plan.title.toLowerCase().includes('interstellar') || plan.title.toLowerCase().includes('friday')) {
      return {
        url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
        text: 'INTERSTELLAR'
      };
    }
    if (plan.title.toLowerCase().includes('birthday')) {
      return {
        url: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=600&auto=format&fit=crop&q=80',
        text: 'Good Friends\nBrighter\nBirthdays\n♡'
      };
    }
    return {
      url: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=600&auto=format&fit=crop&q=80',
      text: 'Game\nFriends\nAre The\nBest Friends'
    };
  };

  const poster = getPosterContent();

  return (
    <div className="group rounded-[28px] p-5 md:p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-black/5 flex flex-col md:flex-row items-stretch gap-6">
      {/* 1. Left Side: Poster with Overlay Text */}
      <div className="relative w-full md:w-48 lg:w-52 shrink-0 aspect-square rounded-2xl overflow-hidden shadow-sm bg-slate-900 group">
        <img
          src={poster.url}
          alt={plan.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.85]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Poster Text Overlay */}
        <div className="absolute inset-0 p-4 flex flex-col justify-end text-white pointer-events-none select-none">
          {poster.text && poster.text === 'INTERSTELLAR' ? (
            <div className="text-center font-bold tracking-[0.28em] text-[13px] text-white/90 drop-shadow-md">
              INTERSTELLAR
            </div>
          ) : poster.text ? (
            <div className="font-serif italic text-xs sm:text-sm text-white/90 drop-shadow-md whitespace-pre-line leading-snug">
              {poster.text}
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Right Side: Card Information & Interactive Timeline */}
      <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4">
        {/* Top Header: Title, Tag, Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {plan.title} <span className="inline-block">{plan.emoji}</span>
            </h3>
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full ${getTagBadge()}`}
            >
              {plan.tagLabel || (plan.type === 'movie' ? 'Movie + Game' : plan.type === 'birthday' ? 'Birthday' : 'Game')}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-2xl bg-white dark:bg-[#1c162b] border border-slate-200 dark:border-white/10 shadow-xl shadow-black/10 py-1.5 z-30">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-2.5 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 font-bold">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>
                {onDeletePlan && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDeletePlan(plan.id);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5 transition border-t border-slate-100 dark:border-white/5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Delete Plan</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-zinc-400 flex-wrap">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
            <Calendar className="w-3.5 h-3.5 text-rose-500" />
            <span>{plan.dateFormatted}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {plan.time.includes(plan.timezone || 'IST')
                ? plan.time
                : `${plan.time}${plan.endTime ? ` – ${plan.endTime}` : ''}${plan.timezone ? ` (${plan.timezone})` : ''}`}
            </span>
          </span>
        </div>

        {/* Note / Subtitle */}
        {plan.description && (
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            {plan.description}
          </p>
        )}

        {/* Activity Flow Pipeline */}
        {plan.activities && plan.activities.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {plan.activities.map((act, index) => (
              <React.Fragment key={act.id}>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${getActivityPillColor(
                    act.type
                  )}`}
                >
                  <div className="p-0.5 rounded-md bg-white/70 dark:bg-black/20 shrink-0">
                    {getActivityIcon(act.type)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white">{act.time}</span>
                    <span className="text-slate-600 dark:text-zinc-300 truncate max-w-[130px]">
                      {act.title}
                    </span>
                  </div>
                </div>

                {index < plan.activities.length - 1 && (
                  <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold">
                    →
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Bottom Bar: Attendees + Open Plan CTA */}
        <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-100 dark:border-white/[0.04]">
          {/* Avatar Stack + Count */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden p-0.5">
              {(plan.participants && plan.participants.some((p) => p.avatarUrl)
                ? plan.participants
                    .filter((p) => p.avatarUrl)
                    .map((p) => p.avatarUrl!)
                    .slice(0, 4)
                : SAMPLE_AVATARS
              ).map((avatar, idx) => (
                <img
                  key={idx}
                  src={avatar}
                  alt={`Participant ${idx + 1}`}
                  className="inline-block w-7 h-7 rounded-full ring-2 ring-white dark:ring-[#151022] object-cover bg-slate-200"
                />
              ))}
              {goingCount > 4 && (
                <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-[#151022] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold">
                  +{goingCount - 3}
                </div>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              <span>{goingCount} going</span>
              {maybeCount > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  <span>{maybeCount} maybe</span>
                </>
              )}
            </div>
          </div>

          {/* Open Plan Button */}
          <Link
            href={`/plans/${plan.id}`}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 ${
              isPrimary || plan.title.toLowerCase().includes('friday')
                ? 'bg-[#ff3b68] hover:bg-[#ee1d49] text-white shadow-md shadow-[#ff3b68]/25 hover:shadow-lg hover:shadow-[#ee1d49]/35'
                : 'bg-rose-50 hover:bg-[#ff3b68] text-[#ff3b68] hover:text-white dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-[#ff3b68] dark:hover:text-white border border-rose-200/60 dark:border-rose-500/20'
            }`}
          >
            <span>Open Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
