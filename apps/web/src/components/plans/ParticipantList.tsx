'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Crown,
  Check,
  HelpCircle,
  XCircle,
  Share2
} from 'lucide-react';
import { PlanParticipant, RSVPStatus } from '../../types/plans';

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

interface ParticipantListProps {
  participants: PlanParticipant[];
  currentUserId?: string;
  onInviteClick?: () => void;
  onUpdateRSVP?: (status: RSVPStatus) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  onInviteClick,
  onUpdateRSVP
}) => {
  const [filter, setFilter] = useState<'ALL' | RSVPStatus>('ALL');

  const goingCount = participants.filter((p) => p.status === 'GOING').length;
  const maybeCount = participants.filter((p) => p.status === 'MAYBE').length;
  const cantGoCount = participants.filter((p) => p.status === 'CANT_GO').length;

  const currentParticipant = participants.find((p) => p.userId === currentUserId);
  const currentRSVP = currentParticipant?.status || 'GOING';

  const filteredParticipants = participants.filter((p) => {
    if (filter === 'ALL') return true;
    return p.status === filter;
  });

  return (
    <div className="rounded-3xl p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-200">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Attendees
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {goingCount} Going · {maybeCount} Maybe · {cantGoCount} Can't
            </p>
          </div>
        </div>

        {onInviteClick && (
          <button
            type="button"
            onClick={onInviteClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ee1d49]/10 text-[#ee1d49] hover:bg-[#ee1d49] hover:text-white text-xs font-bold transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Invite</span>
          </button>
        )}
      </div>

      {/* Quick RSVP Switcher for Current User */}
      {onUpdateRSVP && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
            Your RSVP:
          </span>
          <div className="inline-flex rounded-xl p-1 bg-slate-200/80 dark:bg-white/10 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => onUpdateRSVP('GOING')}
              className={`px-3 py-1 rounded-lg transition ${
                currentRSVP === 'GOING'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Going
            </button>
            <button
              type="button"
              onClick={() => onUpdateRSVP('MAYBE')}
              className={`px-3 py-1 rounded-lg transition ${
                currentRSVP === 'MAYBE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Maybe
            </button>
            <button
              type="button"
              onClick={() => onUpdateRSVP('CANT_GO')}
              className={`px-3 py-1 rounded-lg transition ${
                currentRSVP === 'CANT_GO'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Can't Go
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.06] pb-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg transition ${
            filter === 'ALL'
              ? 'text-[#ee1d49] bg-[#ee1d49]/10'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All ({participants.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('GOING')}
          className={`px-2.5 py-1 rounded-lg transition ${
            filter === 'GOING'
              ? 'text-emerald-500 bg-emerald-500/10'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Going ({goingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('MAYBE')}
          className={`px-2.5 py-1 rounded-lg transition ${
            filter === 'MAYBE'
              ? 'text-amber-500 bg-amber-500/10'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Maybe ({maybeCount})
        </button>
      </div>

      {/* Participant Chips List */}
      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {filteredParticipants.map((p) => (
          <div
            key={p.userId}
            className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition border border-transparent hover:border-slate-200/50 dark:hover:border-white/5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <img
                  src={getBitmojiAvatar(p.avatarUrl, p.displayName)}
                  alt={p.displayName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-white/10 bg-slate-200 dark:bg-zinc-800"
                />
                {p.isHost && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Crown className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                  <span>{p.displayName}</span>
                  {p.isHost && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.2 rounded-md">
                      Host
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                  {p.status === 'GOING'
                    ? 'Attending'
                    : p.status === 'MAYBE'
                    ? 'Might join'
                    : 'Not attending'}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              {p.status === 'GOING' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" />
                  Going
                </span>
              ) : p.status === 'MAYBE' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <HelpCircle className="w-2.5 h-2.5" />
                  Maybe
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <XCircle className="w-2.5 h-2.5" />
                  Can't Go
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
