'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Crown, Lock } from 'lucide-react';
import { API_BASE, authHeaders } from '../../lib/api';

interface Stats {
  roomsJoined: number;
  roomsHosted: number;
  messagesSent: number;
  reactionsSent: number;
  gamesPlayed: number;
  topEmoji: string | null;
  firstActivityAt: string | null;
  busiestDay: string | null;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'None yet');

/** Personal watch stats: a Watch+ perk. Free members see a locked card that links to the pricing page. */
export const WatchStatsSection: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<'loading' | 'locked' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let off = false;
    fetch(`${API_BASE}/api/user/stats`, { headers: authHeaders(), credentials: 'include' })
      .then(async (res) => {
        if (off) return;
        if (res.status === 403) return setState('locked');
        if (!res.ok) return setState('error');
        const j = await res.json();
        setStats(j.stats);
        setState('ready');
      })
      .catch(() => !off && setState('error'));
    return () => {
      off = true;
    };
  }, []);

  if (state === 'loading' || state === 'error') return null;

  const items = stats
    ? [
        { label: 'Rooms joined', value: stats.roomsJoined },
        { label: 'Rooms hosted', value: stats.roomsHosted },
        { label: 'Messages sent', value: stats.messagesSent },
        { label: 'Reactions sent', value: stats.reactionsSent },
        { label: 'Games played', value: stats.gamesPlayed },
        { label: 'Favourite reaction', value: stats.topEmoji || 'None yet' }
      ]
    : [];

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151022] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black flex items-center gap-2 text-slate-900 dark:text-white">
          <BarChart3 className="w-4 h-4 text-[#ee1d49]" /> Your watch stats
        </h3>
        {state === 'locked' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">Watch+</span>}
      </div>
      {state === 'locked' ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> See your rooms, messages, reactions and games over time.</p>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold">
            <Crown className="w-3.5 h-3.5" /> Upgrade
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((it) => (
              <div key={it.label} className="rounded-xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2.5">
                <p className="text-lg font-black text-slate-900 dark:text-white">{it.value}</p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">{it.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Watching since {fmtDate(stats?.firstActivityAt ?? null)}
            {stats?.busiestDay ? ` · busiest day ${fmtDate(stats.busiestDay)}` : ''}
          </p>
        </>
      )}
    </div>
  );
};
