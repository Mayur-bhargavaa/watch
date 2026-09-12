'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, ArrowLeft, Sparkles, Film, Heart, Users, Tv } from 'lucide-react';
import { getStoredSession, createPartyRoom, UserSession } from '../../lib/api';
import { GameLounge } from '../../components/games/GameLounge';

export default function GamesPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const current = getStoredSession();
    if (current && !current.user.isAnonymous) {
      setSession(current);
    }
  }, []);

  const handleLaunchParty = async () => {
    if (!session || !session.token) {
      router.push('/dashboard');
      return;
    }
    try {
      const { room } = await createPartyRoom({
        title: 'Game Night Watch Party',
        sourceUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
        token: session.token
      });
      router.push(`/room/${room.slug}`);
    } catch {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#111217] text-slate-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      {/* Top Bar */}
      <header className="h-16 px-6 border-b border-white/[0.08] bg-[#14151b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div
            onClick={() => router.push('/dashboard')}
            className="flex items-center space-x-2 cursor-pointer select-none"
          >
            <div className="p-1.5 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-600/30">
              <Film className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight text-white">Watch<span className="text-rose-600 text-xl leading-none">.</span></span>
              <span className="text-[9px] font-semibold text-zinc-500 tracking-widest uppercase mt-0.5">Powered by StitchByte</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLaunchParty}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Party with Game</span>
          </button>
        </div>
      </header>

      {/* Main Body (100% Full Width) */}
      <main className="flex-1 p-4 sm:p-6 w-full">
        <div className="w-full pb-10">
          <GameLounge
            onLaunchParty={handleLaunchParty}
            myUserName={session?.user.displayName || 'Cinema Fan'}
            isCompact={false}
            hideHeader={true}
          />
        </div>
      </main>
    </div>
  );
}
