'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  MoreVertical,
  Trash2,
  Copy,
  Check,
  LogOut
} from 'lucide-react';
import { formatPlanDate } from '@synccinema/common';
import { Plan } from '../../types/plans';
import { planInviteLink } from '../../lib/plansApi';
import { planIconName, participantCounts, planBadgeLabel } from '../../lib/planUi';
import { AppIcon } from '../ui/AppIcon';
import { PersonAvatar } from './PersonAvatar';

interface PlanCardProps {
  plan: Plan;
  currentUserId?: string;
  isPrimary?: boolean;
  /** host only: resolves when the server has deleted the plan */
  onDeletePlan?: (id: string) => Promise<void> | void;
  /** members who are not the host */
  onLeavePlan?: (id: string) => Promise<void> | void;
}


export const PlanCard: React.FC<PlanCardProps> = ({ plan, currentUserId, isPrimary = false, onDeletePlan, onLeavePlan }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const [confirming, setConfirming] = useState<'delete' | 'leave' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = Boolean(currentUserId) && plan.hostId === currentUserId;
  const counts = participantCounts(plan);
  const badge = planBadgeLabel(plan);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(planInviteLink(plan));
      setCopied('ok');
    } catch {
      setCopied('failed'); // clipboard blocked (needs HTTPS / permission): do not pretend it worked
    }
    setTimeout(() => {
      setCopied('idle');
      setShowMenu(false);
    }, 1800);
  };

  const runConfirmed = async () => {
    const action = confirming === 'delete' ? onDeletePlan : onLeavePlan;
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      await action(plan.id);
      setConfirming(null);
      setShowMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const badgeClass = badge.toLowerCase().includes('movie')
    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300'
    : badge.toLowerCase().includes('birthday')
    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300'
    : 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300';

  const shownParticipants = (plan.participants || []).filter((p) => p.status !== 'CANT_GO');
  const visible = shownParticipants.slice(0, 3);
  const hidden = shownParticipants.length - visible.length;
  const activityNames = (plan.activities || []).map((a) => a.title).filter(Boolean);

  return (
    <div className={`rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151022] hover:border-slate-300 dark:hover:border-white/20 transition ${plan.isPast ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3 p-3 sm:p-3.5">
        {/* Icon tile (or the plan's own poster) */}
        <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[#ee1d49] to-[#7c2d92] flex items-center justify-center select-none">
          {plan.posterUrl ? <img src={plan.posterUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : <AppIcon name={planIconName(plan)} className="w-6 h-6 text-white" />}
        </div>

        {/* Title + when */}
        <Link href={`/plans/${plan.id}`} className="flex-1 min-w-0 group">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white truncate group-hover:text-[#ee1d49] transition">{plan.title}</h3>
            <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>{badge}</span>
            {plan.recurring && plan.recurring !== 'none' && <span className="text-[10px] text-slate-400 shrink-0" title={`Repeats ${plan.recurring}`}><AppIcon name="repeat" className="inline w-[1em] h-[1em] align-[-0.125em]" label={`Repeats ${plan.recurring}`} /></span>}
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
            {formatPlanDate(plan.date)} · {plan.time}
            {plan.endTime ? ` – ${plan.endTime}` : ''}
            {plan.timezone ? ` ${plan.timezone.split(' ')[0]}` : ''}
          </p>
          {activityNames.length > 0 && <p className="hidden sm:block text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">{activityNames.join(' → ')}</p>}
        </Link>

        {/* People */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="flex -space-x-1.5">
            {visible.map((p) => (
              <PersonAvatar key={p.userId} name={p.displayName} src={p.avatarUrl} className="w-6 h-6 ring-2 ring-white dark:ring-[#151022]" />
            ))}
            {hidden > 0 && (
              <span className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-[#151022] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold">+{hidden}</span>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
            {counts.going} going{counts.invited > 0 ? ` · ${counts.invited} no reply` : ''}
          </span>
        </div>

        <Link
          href={`/plans/${plan.id}`}
          aria-label={`Open ${plan.title}`}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition ${
            isPrimary ? 'bg-[#ee1d49] hover:bg-[#ff2b5e] text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-200 hover:bg-[#ee1d49] hover:text-white'
          }`}
        >
          <span className="hidden sm:inline">Open</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Plan options"
            onClick={() => {
              setShowMenu(!showMenu);
              setConfirming(null);
              setError(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-2xl bg-white dark:bg-[#1c162b] border border-slate-200 dark:border-white/10 shadow-xl shadow-black/10 py-1.5 z-30">
              {confirming ? (
                <div className="px-3.5 py-2.5 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    {confirming === 'delete' ? 'Delete this plan for everyone? This cannot be undone.' : 'Leave this plan?'}
                  </p>
                  {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={runConfirmed} className="flex-1 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-60 cursor-pointer">
                      {busy ? 'Please wait…' : confirming === 'delete' ? 'Delete' : 'Leave'}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-600 dark:text-zinc-200 cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" onClick={handleCopyLink} className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-2.5 transition cursor-pointer">
                    {copied === 'ok' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 font-bold">Link Copied!</span>
                      </>
                    ) : copied === 'failed' ? (
                      <span className="text-rose-500 font-bold">Could not copy. Copy it from the plan page.</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Invite Link</span>
                      </>
                    )}
                  </button>
                  {isHost && onDeletePlan && (
                    <button type="button" onClick={() => setConfirming('delete')} className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5 transition border-t border-slate-100 dark:border-white/5 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Plan</span>
                    </button>
                  )}
                  {!isHost && onLeavePlan && (
                    <button type="button" onClick={() => setConfirming('leave')} className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-2.5 transition border-t border-slate-100 dark:border-white/5 cursor-pointer">
                      <LogOut className="w-3.5 h-3.5 text-slate-400" />
                      <span>Leave Plan</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
