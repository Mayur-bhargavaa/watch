'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppIcon } from '../../ui/AppIcon';
import { createGameRoom, getStoredSession } from '../../../lib/api';
import { canHostEmojiCharades } from '../../../lib/emojiCharadesView';
import { useMyMembership } from '../../membership/useMyMembership';

/**
 * Entry screen (no room in the URL): a VIP / Creator pass hosts a new room; everybody, whatever their pass, can join a
 * friend's room with its code. The server enforces the pass; this screen only explains it before the request is made.
 */
export const EmojiCharadesEntry: React.FC = () => {
  const router = useRouter();
  const membership = useMyMembership();
  const canHost = canHostEmojiCharades(membership?.tier);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = async () => {
    const s = getStoredSession();
    if (!s?.token) {
      router.push(`/login?redirect=${encodeURIComponent('/games/emoji-charades')}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { room } = await createGameRoom(s.token, 'emoji-charades', 8, true);
      router.push(`/games/emoji-charades?room=${encodeURIComponent(room.roomCode)}`);
    } catch (e: any) {
      setError(e?.message || 'Could not create the room');
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
    router.push(`/games/emoji-charades?room=${encodeURIComponent(c)}`);
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-2" data-testid="emoji-charades-entry">
      <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#121629]/80 md:col-span-2">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-[#ff2b70] text-white shadow">
            <AppIcon name="popcorn" className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black text-[#16132b] dark:text-white sm:text-3xl">
              Emoji Charades
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                {!canHost && <AppIcon name="lock" className="h-3 w-3" label="Locked" />}
                VIP
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">Guess the movie or show from a string of emoji before anyone else. Hints appear as the clock runs. 2 to 8 players.</p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-[#16132b] dark:text-white">
          <AppIcon name="crown" className="h-5 w-5 text-amber-500" />
          Host a game
        </h2>
        {canHost ? (
          <>
            <p className="mb-4 text-sm text-slate-600 dark:text-zinc-300">Create a private room and share the code with your friends.</p>
            <button type="button" onClick={() => void host()} disabled={busy} className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-[#ff2b70] px-5 py-3.5 text-sm font-black text-white shadow active:scale-95 disabled:opacity-60">
              {busy ? 'Creating room...' : 'Create room'}
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600 dark:text-zinc-300">Hosting Emoji Charades is part of Watch+ (VIP Pass). You can still join a friend&apos;s game for free.</p>
            <Link href="/pricing" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-black text-white shadow hover:bg-amber-400">
              <AppIcon name="lock" className="h-4 w-4" />
              Get VIP to host
            </Link>
          </>
        )}
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#121629]/80">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-[#16132b] dark:text-white">
          <AppIcon name="key" className="h-5 w-5 text-violet-500" />
          Join with a code
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-zinc-300">Free for everyone. Ask the host for the room code.</p>
        <form onSubmit={join} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null); }}
            placeholder="EMOJI-ABCD1234"
            autoCapitalize="characters"
            autoComplete="off"
            aria-label="Room code"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm font-bold uppercase text-[#16132b] outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <button type="submit" className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white active:scale-95">Join</button>
        </form>
      </section>

      {error && <p className="text-center text-sm font-bold text-rose-600 dark:text-rose-300 md:col-span-2" role="alert">{error}</p>}
    </div>
  );
};

export default EmojiCharadesEntry;
