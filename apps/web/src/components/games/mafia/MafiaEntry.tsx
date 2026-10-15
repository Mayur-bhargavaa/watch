'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Crown, Moon, Lock, Link2, Plus, ArrowRight, Users } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { createGameRoom, getStoredSession } from '../../../lib/api';
import { canHostMafia } from '../../../lib/mafiaView';
import { useMyMembership } from '../../membership/useMyMembership';
import { MafiaArt } from './MafiaArt';

/**
 * Entry screen (no room in the URL), laid out like the Ludo lobby: a VIP / Creator pass hosts a new room; everybody,
 * whatever their pass, can join a friend's room with its code. The server enforces the pass; this screen only
 * explains it before the request is made.
 */
export const MafiaEntry: React.FC = () => {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const membership = useMyMembership();
  const canHost = canHostMafia(membership?.tier);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = async () => {
    const s = getStoredSession();
    if (!s?.token) {
      router.push(`/login?redirect=${encodeURIComponent('/games/mafia')}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { room } = await createGameRoom(s.token, 'mafia-night', 10, true);
      router.push(`/games/mafia?room=${encodeURIComponent(room.roomCode)}`);
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
    router.push(`/games/mafia?room=${encodeURIComponent(c)}`);
  };

  const muted = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const strong = isDark ? 'text-white' : 'text-zinc-900';

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col justify-between" data-testid="mafia-entry">
      <div className="mx-auto grid w-full flex-1 grid-cols-1 items-center gap-6 py-2 lg:grid-cols-12 lg:gap-10">
        {/* Left column */}
        <div className="flex flex-col justify-center lg:col-span-7">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-[#ee1d49] sm:mb-3 sm:text-xs">Bluff · Accuse · Survive</div>
          <h1 className="mb-3 text-3xl font-extrabold leading-tight tracking-tight sm:mb-4 sm:text-4xl lg:text-5xl">
            <span className="text-[#ee1d49]">Mafia</span> <span className={isDark ? 'text-white' : 'text-zinc-900'}>Night</span>
          </h1>
          <p className={`mb-4 max-w-lg text-xs font-medium leading-relaxed sm:mb-5 sm:text-sm lg:text-base ${muted}`}>
            Night falls and the mafia strike. By day the town hunts them down with a vote.
            <br className="hidden sm:inline" />
            5 to 10 real players, no bots.
          </p>

          {error && (
            <div role="alert" className={`mb-4 max-w-xl rounded-xl p-3 text-xs font-semibold ${isDark ? 'border border-red-500/30 bg-red-950/40 text-red-300' : 'border border-red-200 bg-red-50 text-red-700'}`}>
              {error}
            </div>
          )}

          {/* VIP info strip (replaces the partner card, Mafia Night is invite-by-code) */}
          <div className={`mb-4 max-w-xl rounded-2xl p-3 sm:mb-5 sm:p-3.5 ${isDark ? 'border border-white/10 bg-[#18121f]' : 'border border-zinc-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isDark ? 'bg-amber-950/60 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                  <Crown className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-[#ee1d49]">VIP game</span>
                  <h4 className={`truncate text-xs font-bold sm:text-sm ${strong}`}>{canHost ? 'Your VIP pass lets you host' : 'Hosting needs Watch+ (VIP Pass)'}</h4>
                  <p className={`truncate text-[11px] ${muted}`}>Joining a friend&apos;s game is always free</p>
                </div>
              </div>
              {!canHost && (
                <Link href="/pricing" className="inline-flex shrink-0 items-center gap-1.5 h-9 rounded-xl bg-[#ee1d49] px-3 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#18121f]">
                  <Lock className="h-3.5 w-3.5" />
                  Get VIP
                </Link>
              )}
            </div>
          </div>

          {/* Two pastel cards */}
          <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className={`flex flex-col justify-between rounded-2xl p-4 transition-colors duration-150 ${isDark ? 'border border-white/10 bg-[#18121f] hover:border-white/20' : 'border border-[#fde4eb] bg-[#fff5f7] hover:border-[#f9c6d3]'}`}>
              <div>
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${isDark ? 'border border-[#ee1d49]/30 bg-[#ee1d49]/10 text-[#ff6b87]' : 'bg-[#fee1e7] text-[#ee1d49]'}`}>
                  <Users className="h-[18px] w-[18px]" />
                </div>
                <h3 className={`mb-1 text-base font-bold tracking-tight sm:text-lg ${strong}`}>Create a Room</h3>
                <p className={`mb-4 text-xs font-normal leading-relaxed ${muted}`}>Start a new game and invite your friends.</p>
              </div>
              {canHost ? (
                <button type="button" onClick={() => void host()} disabled={busy} className="flex w-full cursor-pointer items-center justify-center gap-1.5 h-10 rounded-xl bg-[#ee1d49] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d6143c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee1d49] focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-[#18121f]">
                  <Plus className="h-4 w-4" />
                  <span>{busy ? 'Creating...' : 'Create Room'}</span>
                </button>
              ) : (
                <Link href="/pricing" className="flex w-full items-center justify-center gap-1.5 h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-black transition-colors duration-150 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#18121f]">
                  <Lock className="h-4 w-4" />
                  <span>Get VIP to host</span>
                </Link>
              )}
            </div>

            <form onSubmit={join} className={`flex flex-col justify-between rounded-2xl p-4 transition-colors duration-150 ${isDark ? 'border border-white/10 bg-[#121626] hover:border-white/20' : 'border border-[#e3eeff] bg-[#f5f9ff] hover:border-[#c9dcfb]'}`}>
              <div>
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${isDark ? 'border border-blue-500/30 bg-blue-950/50 text-blue-400' : 'bg-[#dce8fe] text-[#185df2]'}`}>
                  <Link2 className="h-[18px] w-[18px]" />
                </div>
                <h3 className={`mb-1 text-base font-bold tracking-tight sm:text-lg ${strong}`}>Join a Room</h3>
                <p className={`mb-3 text-xs font-normal leading-relaxed ${muted}`}>Enter the room code from your friend.</p>
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(null); }}
                  placeholder="MAFIA-ABCD"
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label="Room code"
                  className={`mb-3 h-9 w-full rounded-xl px-3 font-mono text-xs font-semibold uppercase outline-none focus:border-[#185df2] focus-visible:ring-2 focus-visible:ring-[#185df2]/40 ${isDark ? 'border border-white/10 bg-[#0c0d12] text-white placeholder-zinc-500' : 'border border-[#cfe0fc] bg-white text-zinc-900 placeholder-zinc-400'}`}
                />
              </div>
              <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-1.5 h-10 rounded-xl bg-[#185df2] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#144ecc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#185df2] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121626]">
                <ArrowRight className="h-4 w-4" />
                <span>Join Room</span>
              </button>
            </form>
          </div>

          <p className={`mt-4 flex max-w-xl items-center gap-1.5 text-[11px] ${muted}`}>
            <Moon className="h-3.5 w-3.5 shrink-0" />
            Secret roles: Mafia, Doctor, Detective and Villagers. Night actions are private.
          </p>
        </div>

        {/* Right column: illustration */}
        <div className="relative flex items-center justify-center lg:col-span-5">
          <div className="relative flex aspect-square max-h-[50vh] w-full max-w-[340px] items-center justify-center sm:max-w-[400px] lg:max-w-[460px]">
            <MafiaArt className="h-full w-full" />
          </div>
        </div>
      </div>

      {/* Footer decoration, same as the Ludo lobby */}
      <div className={`mx-auto flex w-full shrink-0 flex-col items-center justify-between gap-4 border-t pb-1 pt-2 sm:flex-row ${isDark ? 'border-white/[0.05]' : 'border-zinc-200'}`}>
        <img src={isDark ? '/images/ludo-flourish-dark.png' : '/images/ludo-flourish.png'} alt="Good Games, Brighter Friendships" className="pointer-events-none h-14 w-auto select-none object-contain sm:h-16" />
        <div className={`text-[10px] font-bold uppercase tracking-[0.3em] sm:text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>PLAY · CONNECT · REPEAT</div>
      </div>
    </div>
  );
};

export default MafiaEntry;
