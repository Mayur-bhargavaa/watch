'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { getStoredSession, getGameInterest, setGameInterest } from '../../lib/api';

/** Games the server accepts for "notify me" use these ids (see apps/server/src/games/comingSoon.ts). */
export function useGameInterest() {
  const router = useRouter();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ gameId: string; message: string } | null>(null);

  useEffect(() => {
    const token = getStoredSession()?.token;
    if (!token) return;
    let cancelled = false;
    getGameInterest(token).then((list) => { if (!cancelled) setIds(new Set(list)); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async (gameId: string) => {
    const token = getStoredSession()?.token;
    if (!token) { router.push('/login?redirect=/games'); return; }
    if (busy) return;
    const turnOn = !ids.has(gameId);
    setBusy(gameId);
    setError(null);
    try {
      await setGameInterest(token, gameId, turnOn);
      setIds((prev) => { const next = new Set(prev); if (turnOn) next.add(gameId); else next.delete(gameId); return next; });
    } catch (err: any) {
      setError({ gameId, message: err?.message || 'Could not update. Try again.' });
    } finally {
      setBusy(null);
    }
  }, [busy, ids, router]);

  return { ids, busy, error, toggle };
}

export function NotifyMeButton({
  gameId,
  state,
  className = ''
}: {
  gameId: string;
  state: ReturnType<typeof useGameInterest>;
  className?: string;
}) {
  const on = state.ids.has(gameId);
  const loading = state.busy === gameId;
  const err = state.error?.gameId === gameId ? state.error.message : null;
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={loading}
        aria-pressed={on}
        onClick={(e) => { e.stopPropagation(); void state.toggle(gameId); }}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition cursor-pointer disabled:opacity-60 ${
          on ? 'bg-white/90 text-slate-900' : 'bg-white/20 hover:bg-white/30 text-white border border-white/25'
        }`}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : on ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
        <span>{on ? "You'll be notified" : 'Notify me'}</span>
      </button>
      {err && <span role="alert" className="text-[10px] text-rose-200">{err}</span>}
    </div>
  );
}
