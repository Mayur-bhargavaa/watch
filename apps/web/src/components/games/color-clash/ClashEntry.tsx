'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Link2, Plus, Users } from 'lucide-react';
import { createGameRoom, getStoredSession } from '../../../lib/api';
import { ClashCardBack, ClashCardFace } from './ClashCard';

/** Entry (no room in the URL): host a new table for 2, 3 or 4 players, or join a friend's with its code. */
export const ClashEntry: React.FC = () => {
  const router = useRouter();
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = async () => {
    const s = getStoredSession();
    if (!s?.token) {
      router.push(`/login?redirect=${encodeURIComponent('/games/color-clash')}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { room } = await createGameRoom(s.token, 'color-clash', players, true);
      router.push(`/games/color-clash?room=${encodeURIComponent(room.roomCode)}`);
    } catch (e: any) {
      setError(e?.message || 'Could not create the table');
      setBusy(false);
    }
  };
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(c)) {
      setError('Enter the room code your friend shared');
      return;
    }
    router.push(`/games/color-clash?room=${encodeURIComponent(c)}`);
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col justify-center" data-testid="clash-entry">
      <div className="mx-auto grid w-full grid-cols-1 items-center gap-6 py-2 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col justify-center lg:col-span-7">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-[#ee1d49] sm:text-xs">Match · Play · Last Card</div>
          <h1 className="mb-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            <span className="text-[#ee1d49]">Color</span> <span className="text-zinc-900 dark:text-white">Clash</span>
          </h1>
          <p className="mb-4 max-w-lg text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm lg:text-base">
            Match the colour or the number, play Skip, Reverse, Draw Two and Wild cards, and be the first to empty your hand.
            <br className="hidden sm:inline" />
            2 to 4 real players. Everyone&apos;s cards stay private.
          </p>
          {error && <div role="alert" className="mb-4 max-w-xl rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-semibold text-red-300">{error}</div>}

          <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18121f]">
              <div>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#ee1d49]/30 bg-[#ee1d49]/10 text-[#ff6b87]"><Users className="h-[18px] w-[18px]" /></div>
                <h3 className="mb-1 text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">Create a Table</h3>
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">Pick how many can play, then invite friends.</p>
                <div className="mb-4 inline-flex rounded-xl bg-zinc-100 p-0.5 dark:bg-[#22232c]" role="radiogroup" aria-label="Number of players">
                  {([2, 3, 4] as const).map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={players === n} onClick={() => setPlayers(n)} className={`h-8 rounded-lg px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] cursor-pointer ${players === n ? 'bg-[#ee1d49] text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                      {n} players
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => void host()} disabled={busy} className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition hover:bg-[#d4183f] disabled:opacity-60">
                <Plus className="h-4 w-4" />
                <span>{busy ? 'Creating...' : 'Create Table'}</span>
              </button>
            </div>

            <form onSubmit={join} className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18121f]">
              <div>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-blue-500/30 bg-blue-950/50 text-blue-400"><Link2 className="h-[18px] w-[18px]" /></div>
                <h3 className="mb-1 text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">Join a Table</h3>
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">Enter the room code from your friend.</p>
                <input value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} placeholder="CLASH-ABCD1234" autoCapitalize="characters" autoComplete="off" aria-label="Room code" className="mb-3 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-xs font-semibold uppercase text-zinc-900 outline-none focus:border-[#185df2] focus-visible:ring-2 focus-visible:ring-[#185df2]/40 dark:border-white/10 dark:bg-[#0c0d12] dark:text-white" />
              </div>
              <button type="submit" className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#185df2] px-4 text-sm font-semibold text-white transition hover:bg-[#1450cc]">
                <ArrowRight className="h-4 w-4" />
                <span>Join Table</span>
              </button>
            </form>
          </div>
        </div>
        <div className="relative flex items-center justify-center lg:col-span-5" aria-hidden>
          <div className="relative flex h-56 w-full max-w-[360px] items-center justify-center sm:h-72">
            <div className="absolute -rotate-12 -translate-x-16"><ClashCardFace card={{ id: 'a', color: 'red', kind: 'number', value: 7 }} size="pile" /></div>
            <div className="absolute rotate-2 translate-x-1"><ClashCardFace card={{ id: 'b', color: 'blue', kind: 'skip', value: null }} size="pile" /></div>
            <div className="absolute rotate-12 translate-x-16"><ClashCardFace card={{ id: 'c', color: null, kind: 'wild', value: null }} size="pile" /></div>
            <div className="absolute translate-y-24 sm:translate-y-32"><ClashCardBack size="mini" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ClashEntry;
