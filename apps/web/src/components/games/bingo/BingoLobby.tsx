'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Trophy, Award } from 'lucide-react';
import { GameJoinLobby } from '../GameJoinLobby';
import { BingoMode, BingoRoomConfig } from '@synccinema/common';
import { createGameRoomWithPartner, getStoredSession } from '../../../lib/api';
import { useTheme } from '../../../context/ThemeContext';

export const BingoLobby: React.FC<{
  session?: any;
  onOpenFriendSelector?: () => void;
}> = () => {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const [selectedMode, setSelectedMode] = useState<BingoMode>('90-ball');
  const [autoCallSpeed, setAutoCallSpeed] = useState<number>(3000);

  const handleCreateCustomBingoRoom = async () => {
    const s = getStoredSession();
    if (!s?.token) {
      router.push('/login');
      return;
    }
    const res = await createGameRoomWithPartner('tambola');
    if (res?.room?.roomCode) {
      router.push(`/games/tambola?room=${res.room.roomCode}`);
    }
  };

  const createOptions = (
    <div className="space-y-4">
      <div>
        <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          Bingo Mode
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedMode('90-ball')}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all border ${
              selectedMode === '90-ball'
                ? 'bg-[#ed1c46] border-[#ed1c46] text-white shadow-sm'
                : isDark
                ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            90-Ball Tambola
          </button>
          <button
            type="button"
            onClick={() => setSelectedMode('75-ball')}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all border ${
              selectedMode === '75-ball'
                ? 'bg-[#ed1c46] border-[#ed1c46] text-white shadow-sm'
                : isDark
                ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            75-Ball Classic
          </button>
        </div>
      </div>

      <div>
        <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          Calling Pace
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Fast (2s)', val: 2000 },
            { label: 'Normal (3s)', val: 3000 },
            { label: 'Relaxed (5s)', val: 5000 }
          ].map(p => (
            <button
              key={p.val}
              type="button"
              onClick={() => setAutoCallSpeed(p.val)}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                autoCallSpeed === p.val
                  ? 'bg-rose-500/20 border-rose-500 text-rose-500'
                  : isDark
                  ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const rightGraphic = (
    <div className="relative w-full h-full flex items-center justify-center select-none pointer-events-none">
      {/* Outer ambient glow */}
      <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-[#ee1d49]/30 via-purple-600/20 to-transparent blur-3xl pointer-events-none" />

      {/* 3D Glass Sphere with Golden Numbers */}
      <div className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-br from-[#1f1933] via-[#120f20] to-[#07060c] border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_50px_rgba(238,29,73,0.3),inset_0_4px_18px_rgba(255,255,255,0.25)] flex flex-col items-center justify-center">
        {/* Top glossy reflection */}
        <div className="absolute top-3 w-32 h-16 rounded-full bg-gradient-to-b from-white/25 to-transparent blur-[2px]" />

        {/* Center Golden Ball 88 */}
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_30px_rgba(245,158,11,0.5),inset_0_2px_8px_rgba(255,255,255,0.4)] flex flex-col items-center justify-center text-zinc-950 font-black">
          <span className="text-3xl sm:text-5xl font-mono tracking-tighter leading-none">88</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-900/80">TAMBOLA</span>
        </div>

        {/* Orbiting Mini Ball 7 */}
        <div className="absolute -top-3 -right-2 w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white font-mono font-black text-xl flex items-center justify-center shadow-lg border border-white/30 transform rotate-12">
          7
        </div>

        {/* Orbiting Mini Ball 21 */}
        <div className="absolute -bottom-2 -left-2 w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-white font-mono font-black text-lg flex items-center justify-center shadow-lg border border-white/30 transform -rotate-12">
          21
        </div>
      </div>
    </div>
  );

  const rulesContent = (
    <div className="space-y-4 text-xs text-zinc-300">
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
        <h4 className="font-bold text-white flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Winning Conditions & Points</span>
        </h4>
        <p className="text-zinc-400 leading-relaxed">
          Mark called numbers on your ticket. Be the first to claim winning patterns:
        </p>
        <ul className="list-disc list-inside space-y-1 text-zinc-300 pl-1">
          <li><strong>Early 5:</strong> First player to mark any 5 numbers (10 pts)</li>
          <li><strong>Top Line / Middle Line / Bottom Line:</strong> Complete horizontal rows (15 pts each)</li>
          <li><strong>Four Corners:</strong> Mark the corner numbers (15 pts)</li>
          <li><strong>Housefull / Full House:</strong> Mark every single number on your ticket (50 pts)</li>
        </ul>
      </div>

      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
        <h4 className="font-bold text-rose-300 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-rose-400" />
          <span>Bogus Claim Penalty</span>
        </h4>
        <p className="text-rose-200/80 leading-relaxed">
          Claiming a condition that is incomplete results in a 10-second penalty lock where you cannot claim any conditions. Double-check before you shout Bingo!
        </p>
      </div>
    </div>
  );

  return (
    <GameJoinLobby
      gameType="tambola"
      eyebrow="CLASSIC SOCIAL HOUSIE"
      titlePrimary="Tambola"
      titleSecondary="Party"
      description="Classic 90-ball Tambola & Housie with real-time server calling, synchronized 3×9 tickets, and live reactions."
      rightGraphic={rightGraphic}
      createModalOptions={createOptions}
      onCreateCustomRoom={handleCreateCustomBingoRoom}
      rulesContent={rulesContent}
    />
  );
};
