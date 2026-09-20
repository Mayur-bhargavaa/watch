'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Brain, Trophy, Sparkles } from 'lucide-react';
import { GameJoinLobby } from '../GameJoinLobby';
import { createGameRoomWithPartner, getStoredSession } from '../../../lib/api';

export const DoodlePreRoomLobby: React.FC<{
  session?: any;
  onOpenFriendSelector?: () => void;
}> = () => {
  const router = useRouter();
  const [rounds, setRounds] = useState<number>(6);
  const [drawTime, setDrawTime] = useState<number>(60);

  const handleCreateCustomDoodleRoom = async () => {
    const s = getStoredSession();
    if (!s?.token) {
      router.push('/login');
      return;
    }
    const res = await createGameRoomWithPartner('doodle-duel');
    if (res?.room?.roomCode) {
      router.push(`/games/doodle-duel?room=${res.room.roomCode}`);
    }
  };

  const createOptions = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold block mb-2 text-zinc-300">
          Total Rounds
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[4, 6, 8, 10].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRounds(r)}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                rounds === r
                  ? 'bg-[#ed1c46] border-[#ed1c46] text-white shadow-sm'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {r} Rounds
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold block mb-2 text-zinc-300">
          Draw Time per Round
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Fast (45s)', val: 45 },
            { label: 'Classic (60s)', val: 60 },
            { label: 'Relaxed (90s)', val: 90 }
          ].map(p => (
            <button
              key={p.val}
              type="button"
              onClick={() => setDrawTime(p.val)}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                drawTime === p.val
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
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
      <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-[#ee1d49]/30 via-pink-600/20 to-transparent blur-3xl pointer-events-none" />

      {/* 3D Isometric Art Canvas Card */}
      <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-[32px] bg-gradient-to-br from-[#1a1426] via-[#100d1c] to-[#08060e] border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_50px_rgba(238,29,73,0.3),inset_0_4px_18px_rgba(255,255,255,0.2)] p-5 flex flex-col justify-between transform hover:rotate-1 transition-transform">
        {/* Canvas Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-mono">
            ROUND 1 • DRAW
          </span>
        </div>

        {/* Center Drawing Preview Graphic */}
        <div className="flex-1 my-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
          <Palette className="w-12 h-12 sm:w-16 sm:h-16 text-[#ee1d49] animate-bounce mb-1" />
          <span className="text-xs font-mono font-bold text-zinc-300">"ROCKET"</span>
          <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-zinc-500">
            <span>_ _ _ _ _ _</span>
          </div>
        </div>

        {/* Bottom Tools Row */}
        <div className="flex items-center justify-between px-2 pt-1 border-t border-white/10 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[#ee1d49] ring-2 ring-white/40" />
            <span className="w-4 h-4 rounded-full bg-[#185df2]" />
            <span className="w-4 h-4 rounded-full bg-[#10b981]" />
            <span className="w-4 h-4 rounded-full bg-[#f59e0b]" />
          </div>
          <span className="text-[10px] font-bold text-rose-400">60s LEFT</span>
        </div>
      </div>
    </div>
  );

  const rulesContent = (
    <div className="space-y-4 text-xs text-zinc-300">
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
        <h4 className="font-bold text-white flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-rose-400" />
          <span>How It Works</span>
        </h4>
        <ul className="list-disc list-inside space-y-1 text-zinc-300 pl-1">
          <li><strong>Role Switching:</strong> One player draws while the other guesses. Roles switch every round.</li>
          <li><strong>Drawing Phase:</strong> Drawer picks 1 of 3 secret words and draws it on the shared canvas.</li>
          <li><strong>Guessing Phase:</strong> Guesser types guesses. Exact matches award maximum speed points!</li>
          <li><strong>Hints:</strong> When time is running low, the guesser can request letter hints.</li>
        </ul>
      </div>

      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
        <h4 className="font-bold text-rose-300 flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Scoring</span>
        </h4>
        <p className="text-rose-200/80 leading-relaxed">
          Points are awarded based on how fast the word was correctly guessed. Both drawer and guesser score points for successful rounds!
        </p>
      </div>
    </div>
  );

  return (
    <GameJoinLobby
      gameType="doodle-duel"
      eyebrow="DRAW • GUESS • HAVE FUN"
      titlePrimary="Doodle"
      titleSecondary="Duel"
      description="Private 2-player real-time draw & guess showdown. Alternate roles every round with instant canvas syncing."
      rightGraphic={rightGraphic}
      createModalOptions={createOptions}
      onCreateCustomRoom={handleCreateCustomDoodleRoom}
      rulesContent={rulesContent}
    />
  );
};
