'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Brain, Users, Play, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { UserSession, createGameRoomWithPartner, joinGameRoomByCode } from '../../../lib/api';

interface DoodlePreRoomLobbyProps {
  session: UserSession | null;
  onOpenFriendSelector: () => void;
}

export const DoodlePreRoomLobby: React.FC<DoodlePreRoomLobbyProps> = ({
  session,
  onOpenFriendSelector
}) => {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!session) {
      router.push('/login');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const res = await createGameRoomWithPartner('doodle-duel');
      if (res?.room?.roomCode) {
        router.push(`/games/doodle-duel?room=${res.room.roomCode}`);
      } else {
        throw new Error('Failed to create game room');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create room. Please try again.');
      setIsCreating(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    setIsJoining(true);
    setError(null);
    try {
      let code = roomCodeInput.trim().toUpperCase();
      if (!code.startsWith('DOODLE-') && !code.startsWith('ROOM-') && code.length <= 6) {
        // user typed short code or full code
      }
      const res = await joinGameRoomByCode(code);
      if (res?.room?.roomCode) {
        router.push(`/games/doodle-duel?room=${res.room.roomCode}`);
      } else {
        throw new Error('Room not found or expired');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not join room. Check code and try again.');
      setIsJoining(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-8 px-4 select-none">
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(244,63,94,0.2)]">
          <Palette className="w-3.5 h-3.5" />
          <span>DOODLE DUEL • 2 PLAYERS</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          Draw Fast. Guess Faster.
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
          Private 2-player real-time draw & guess showdown. Alternate drawing and guessing turns with live audio/video reactions!
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold text-center max-w-md mx-auto">
          {error}
        </div>
      )}

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {/* Card 1: Create Private Duel */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-[#111625]/90 border border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden">
          <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />

          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-1">Create Private Duel</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Start an instant 2-player room and invite your friend via link or partner list.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(244,63,94,0.4)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isCreating ? 'Creating Match...' : 'Create Private Room'}</span>
            </button>

            {session && (
              <button
                type="button"
                onClick={onOpenFriendSelector}
                className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Invite from Friends</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Join with Room Code */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-[#111625]/90 border border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden">
          <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-blue-500 flex items-center justify-center text-white shadow-lg mb-4">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-1">Join with Code</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Got an invite code from your partner? Enter it below to join the duel.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-2.5">
            <input
              type="text"
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. DOODLE-1234 or CODE"
              maxLength={20}
              className="w-full bg-white/5 border border-white/15 focus:border-violet-500 rounded-2xl px-4 py-3.5 text-center font-mono text-sm font-bold text-white placeholder-zinc-500 outline-none uppercase tracking-wider transition"
            />
            <button
              type="submit"
              disabled={!roomCodeInput.trim() || isJoining}
              className="w-full py-3.5 px-5 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98]"
            >
              <span>{isJoining ? 'Joining...' : 'Join Duel'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto pt-4">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 shrink-0">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Auto Role Switch</span>
            <span className="text-[10px] text-zinc-400">Roles swap automatically every round</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Speed Bonus</span>
            <span className="text-[10px] text-zinc-400">Faster guesses score up to 100 points</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Private & Human</span>
            <span className="text-[10px] text-zinc-400">Exactly 2 players, zero bots</span>
          </div>
        </div>
      </div>
    </div>
  );
};
