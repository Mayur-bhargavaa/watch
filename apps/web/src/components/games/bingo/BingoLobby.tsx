'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gamepad2,
  Users,
  Sparkles,
  Play,
  Share2,
  ChevronRight,
  Trophy,
  Flame,
  ArrowRight,
  Info
} from 'lucide-react';
import { createGameRoomWithPartner, joinGameRoomByCode, UserSession } from '../../../lib/api';

interface BingoLobbyProps {
  session: UserSession | null;
  onOpenFriendSelector: () => void;
}

export const BingoLobby: React.FC<BingoLobbyProps> = ({
  session,
  onOpenFriendSelector
}) => {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!session) {
      router.push('/login');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await createGameRoomWithPartner('bingo');
      if (res?.room?.roomCode) {
        router.push(`/games/bingo?room=${res.room.roomCode}`);
      } else {
        throw new Error('Failed to generate Bingo room code');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create room. Please try again.');
      setCreating(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const code = roomCodeInput.trim().toUpperCase();
      const res = await joinGameRoomByCode(code);
      if (res?.room?.roomCode) {
        router.push(`/games/bingo?room=${res.room.roomCode}`);
      } else {
        throw new Error('Room not found or expired');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not join room. Check the code and try again.');
      setJoining(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-6 px-4">
      {/* Hero Header */}
      <div className="text-center space-y-3 relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[#ee1d49] text-xs font-black uppercase tracking-wider shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-time 2-Player Duel</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
          BINGO DUEL
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto">
          Classic 90-ball Tambola & 75-ball Bingo with real-time server validation, unique tickets, and live reactions.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-center font-bold">
          {error}
        </div>
      )}

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Create Room Card */}
        <div className="p-6 rounded-3xl bg-[#0e101a] border border-white/10 shadow-2xl flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-[#ee1d49] flex items-center justify-center text-2xl shadow-lg shadow-rose-600/30">
              🎱
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Create Bingo Room</h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Host a private duel. Pick 90-ball Tambola or 75-ball Bingo, custom winning conditions, and calling pace.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={creating}
            onClick={handleCreateRoom}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-[#ee1d49] to-pink-600 hover:brightness-110 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            {creating ? (
              <span>Creating Room...</span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Create Bingo Room</span>
              </>
            )}
          </button>
        </div>

        {/* Join With Code Card */}
        <div className="p-6 rounded-3xl bg-[#0e101a] border border-white/10 shadow-2xl flex flex-col justify-between space-y-6 hover:border-white/20 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
              🎟️
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Join with Room Code</h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Have an invite from a friend? Enter the temporary room code to jump straight into the lobby.
              </p>
            </div>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-2.5">
            <input
              type="text"
              placeholder="e.g. BINGO-7F2A"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 transition"
            />
            <button
              type="submit"
              disabled={joining || !roomCodeInput.trim()}
              className="w-full py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{joining ? 'Connecting...' : 'Join Match'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Challenge a Friend Button */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-violet-950/40 via-purple-950/20 to-black/40 border border-violet-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Play with Watch Friends</h3>
            <p className="text-xs text-zinc-400">Invite your watch party partner directly with one tap</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenFriendSelector}
          className="py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-violet-600/30 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <span>Choose Friend</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Rules Overview Accordion */}
      <div className="p-6 rounded-3xl bg-[#0e101a]/70 border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">Winning Rules Overview</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-300">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <span className="font-bold text-white block mb-0.5">Early 5</span>
            <p className="text-[11px] text-zinc-400">First player to mark any 5 called numbers across their entire ticket.</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <span className="font-bold text-white block mb-0.5">Top / Middle / Bottom Lines</span>
            <p className="text-[11px] text-zinc-400">Complete all 5 numbers in any individual row horizontally.</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <span className="font-bold text-white block mb-0.5">Four Corners & Housefull</span>
            <p className="text-[11px] text-zinc-400">Four outer corners or complete every number on the ticket for major victory.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
