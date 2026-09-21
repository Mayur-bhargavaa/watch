'use client';

import React, { useState } from 'react';
import { Sparkles, Users, KeyRound, Play, ArrowRight, ShieldCheck, Flame, Zap } from 'lucide-react';
import { UserSession } from '../../../lib/api';

interface BingoDuelLobbyProps {
  session: UserSession | null;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onSelectPartner: () => void;
  isCreating: boolean;
  isJoining: boolean;
}

export const BingoDuelLobby: React.FC<BingoDuelLobbyProps> = ({
  session,
  onCreateRoom,
  onJoinRoom,
  onSelectPartner,
  isCreating,
  isJoining
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Please enter a room code');
      return;
    }
    setErrorMsg('');
    onJoinRoom(clean);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col items-center">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4 shadow-lg backdrop-blur-md">
        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        <span>1–25 Numbers • 2-Player Tactical Duel</span>
      </div>

      {/* Main Title & Subtitle */}
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-center mb-3">
        Bingo <span className="bg-gradient-to-r from-indigo-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">Duel</span>
      </h1>
      <p className="text-slate-300 text-sm sm:text-base text-center max-w-md mb-8 leading-relaxed">
        Random 5×5 board with numbers 1 to 25. Complete your chosen pattern and shout Bingo before your rival!
      </p>

      {/* Action Cards Container */}
      <div className="w-full space-y-4">
        {/* Create Room / Play with Partner Card */}
        <div className="bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-900/80 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-xl transition hover:border-indigo-400/50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-indigo-400 fill-indigo-400" />
                Start a New Match
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Host a private 1v1 duel with custom patterns and voice calls.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Host
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCreateRoom}
              disabled={isCreating}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isCreating ? 'Creating Room...' : 'Create Duel Room'}</span>
            </button>

            <button
              type="button"
              onClick={onSelectPartner}
              className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/15 backdrop-blur-md active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 text-pink-400" />
              <span>Invite Friend</span>
            </button>
          </div>
        </div>

        {/* Join Room Card */}
        <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Join with Code
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Got an invite code like <span className="font-mono text-indigo-300">BINGO-ABCD</span>?
          </p>

          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={roomCodeInput}
              onChange={e => {
                setRoomCodeInput(e.target.value.toUpperCase());
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="e.g. BINGO-9X2Y"
              maxLength={12}
              className="flex-1 px-4 py-3 bg-black/40 border border-white/15 rounded-2xl text-white placeholder-slate-500 font-mono tracking-wider text-sm focus:outline-none focus:border-indigo-400 transition uppercase"
            />
            <button
              type="submit"
              disabled={isJoining}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isJoining ? 'Joining...' : 'Join'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          {errorMsg && <p className="text-xs text-rose-400 mt-2 font-medium">{errorMsg}</p>}
        </div>
      </div>

      {/* Feature Pills Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Anti-Cheat Validated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>11 Winning Patterns</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>Live Audio & Video PIP</span>
        </div>
      </div>
    </div>
  );
};
