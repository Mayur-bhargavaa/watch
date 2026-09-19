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
    <div className="rounded-3xl p-5 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
          Attendees
        </h3>
        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
          {participants.length} invited
        </span>
      </div>

      {/* Stacked Circular Avatars with +2 pill and Add User icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center -space-x-2 overflow-hidden py-1">
          {participants.slice(0, 4).map((p, idx) => (
            <img
              key={p.userId || idx}
              src={getBitmojiAvatar(p.avatarUrl, p.displayName)}
              alt={p.displayName}
              className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-[#151022] object-cover bg-slate-200 dark:bg-zinc-800"
            />
          ))}
          {participants.length > 4 && (
            <div className="flex items-center justify-center h-9 w-9 rounded-full ring-2 ring-white dark:ring-[#151022] bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-200 text-xs font-black">
              +{participants.length - 4}
            </div>
          )}
        </div>

        {onInviteClick && (
          <button
            type="button"
            onClick={onInviteClick}
            className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title="Invite more friends"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status Breakdown Dots matching screenshot */}
      <div className="space-y-1.5 pt-1 text-xs font-bold text-slate-600 dark:text-zinc-300">
        <button
          type="button"
          onClick={() => setFilter(filter === 'GOING' ? 'ALL' : 'GOING')}
          className={`w-full flex items-center justify-between p-1.5 rounded-xl transition cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${
            filter === 'GOING' ? 'bg-slate-100 dark:bg-white/10' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{goingCount} going</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">
            {filter === 'GOING' ? 'Showing' : 'Filter'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter(filter === 'MAYBE' ? 'ALL' : 'MAYBE')}
          className={`w-full flex items-center justify-between p-1.5 rounded-xl transition cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${
            filter === 'MAYBE' ? 'bg-slate-100 dark:bg-white/10' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span>{maybeCount} maybe</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">
            {filter === 'MAYBE' ? 'Showing' : 'Filter'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter(filter === 'CANT_GO' ? 'ALL' : 'CANT_GO')}
          className={`w-full flex items-center justify-between p-1.5 rounded-xl transition cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${
            filter === 'CANT_GO' ? 'bg-slate-100 dark:bg-white/10' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>{cantGoCount} can't go</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">
            {filter === 'CANT_GO' ? 'Showing' : 'Filter'}
          </span>
        </button>
      </div>

      {/* Real Attendees List (Filtered / All) */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-2 max-h-48 overflow-y-auto">
        {filteredParticipants.map((p) => (
          <div
            key={p.userId}
            className="flex items-center justify-between py-1 px-1 rounded-xl text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={getBitmojiAvatar(p.avatarUrl, p.displayName)}
                alt={p.displayName}
                className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-white/10"
              />
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {p.displayName}
              </span>
              {p.isHost && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Host
                </span>
              )}
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                p.status === 'GOING'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : p.status === 'MAYBE'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
              }`}
            >
              {p.status === 'GOING' ? 'Going' : p.status === 'MAYBE' ? 'Maybe' : "Can't Go"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
