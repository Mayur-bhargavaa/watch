'use client';

import React, { useState } from 'react';
import { Palette, Brain, Play, Copy, Check, Users, ShieldCheck, Crown, User, Settings2, Share2, Sparkles, RotateCcw } from 'lucide-react';
import { GameRoom, DoodleConfig, DoodleGameState } from '@synccinema/common';

interface DoodleLobbyProps {
  room: GameRoom;
  gameState: DoodleGameState;
  myUserId: string;
  isHost: boolean;
  rematchStatus?: {
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null;
  onRematch?: () => void;
  onSelectRole: (drawerUserId: string) => void;
  onStartGame: (config?: Partial<DoodleConfig>) => void;
  onUpdateConfig?: (config: Partial<DoodleConfig>) => void;
}

export const DoodleLobby: React.FC<DoodleLobbyProps> = ({
  room,
  gameState,
  myUserId,
  isHost,
  rematchStatus,
  onRematch,
  onSelectRole,
  onStartGame,
  onUpdateConfig
}) => {
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);
  const players = room.players || [];
  const p1 = players[0];
  const p2 = players[1];

  const config = gameState?.config || {
    totalRounds: 6,
    drawTimeSeconds: 60,
    wordSelectionTimeSeconds: 15,
    difficulty: 'mixed',
    hintsEnabled: true
  };

  const selectedDrawerId = gameState?.drawerUserId || (players.length > 0 ? players[0].userId : '');

  const handleCopyRoomCode = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(room.roomCode);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleCopyRoomLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedRoomLink(true);
    setTimeout(() => setCopiedRoomLink(false), 2000);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto my-auto rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 bg-[#0e0c18]/70 border border-white/20 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_35px_rgba(255,43,94,0.12)] text-center overflow-hidden select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Strict Zero-Bots Matchmaking Pill (Ludo standard) */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[11px] font-semibold tracking-wide mb-4 shadow-sm">
        <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
        <span>Strict Zero-Bots Matchmaking</span>
      </div>

      {/* Waiting for Players Heading */}
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
        Waiting <span className="font-medium text-white/90">for</span> <span className="text-[#ff2b5e]">Duelist</span>
      </h2>

      {/* Match Subtitle */}
      <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-6">
        Match will begin when <span className="text-[#ff2b5e] font-semibold">2 human players</span> join the room.
        <br />
        No bots will ever be injected.
      </p>

      {/* Room Code Card (Ludo theme) */}
      <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 mb-5 shadow-inner">
        <div className="text-left min-w-0">
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">
            ROOM CODE
          </span>
          <span className="text-2xl sm:text-3xl font-mono font-black text-[#ff2b5e] tracking-wider block mt-0.5 leading-tight">
            {room.roomCode}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
            Share this code with your friend
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyRoomCode}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95"
            title="Copy Code"
          >
            {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleCopyRoomLink}
            className="py-2.5 px-4 sm:px-5 bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(255,43,94,0.4)] transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{copiedRoomLink ? 'Link Copied!' : 'Share Link'}</span>
          </button>
        </div>
      </div>

      {/* Joined Seats Section (Exact Ludo theme) */}
      <div className="w-full mb-5">
        <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-3 px-0.5">
          <span>Joined Seats ({room.players.length}/{room.maxPlayers})</span>
          <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-normal">
            <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80 inline-block shrink-0" />
            <span>{Math.max(0, room.maxPlayers - room.players.length)} seat remaining</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Seat 1: Host / Player 1 */}
          {p1 ? (
            <div
              onClick={() => onSelectRole(p1.userId)}
              className={`rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[130px] border transition-all cursor-pointer relative ${
                selectedDrawerId === p1.userId
                  ? 'bg-[#1e1428]/95 border-[#ff2b5e] shadow-[0_0_20px_rgba(255,43,94,0.3)] ring-1 ring-[#ff2b5e]'
                  : 'bg-[#181322]/90 border-white/10 hover:border-white/20'
              }`}
            >
              {selectedDrawerId === p1.userId && (
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#ff2b5e] text-[9px] font-black uppercase tracking-wider text-white shadow-xs">
                  Draws 1st 🎨
                </span>
              )}

              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                {(p1.displayName?.[0] || 'P').toUpperCase()}
              </div>
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                {p1.displayName}
              </span>
              <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Host
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold mt-1">
                {selectedDrawerId === p1.userId ? 'Starts as Drawer 🎨' : 'Starts as Guesser 🧠'}
              </span>
            </div>
          ) : (
            <div className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[130px]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                <User className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
              <span className="text-[11px] text-zinc-500 mt-0.5">Player 1</span>
            </div>
          )}

          {/* Seat 2: Opponent / Player 2 */}
          {p2 ? (
            <div
              onClick={() => onSelectRole(p2.userId)}
              className={`rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[130px] border transition-all cursor-pointer relative ${
                selectedDrawerId === p2.userId
                  ? 'bg-[#1e1428]/95 border-[#ff2b5e] shadow-[0_0_20px_rgba(255,43,94,0.3)] ring-1 ring-[#ff2b5e]'
                  : 'bg-[#181322]/90 border-white/10 hover:border-white/20'
              }`}
            >
              {selectedDrawerId === p2.userId && (
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#ff2b5e] text-[9px] font-black uppercase tracking-wider text-white shadow-xs">
                  Draws 1st 🎨
                </span>
              )}

              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                {(p2.displayName?.[0] || 'P').toUpperCase()}
              </div>
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                {p2.displayName}
              </span>
              <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-zinc-400" /> Player
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold mt-1">
                {selectedDrawerId === p2.userId ? 'Starts as Drawer 🎨' : 'Starts as Guesser 🧠'}
              </span>
            </div>
          ) : (
            <div className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[130px]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                <User className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting for friend...</span>
              <span className="text-[11px] text-zinc-500 mt-0.5">Player 2</span>
            </div>
          )}
        </div>
      </div>

      {/* Duel Settings Card (Ludo styling) */}
      <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-4 mb-5 space-y-3.5 text-left shadow-inner">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[#ff2b5e]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Duel Match Settings
            </span>
          </div>
          <span className="text-[10px] text-zinc-400">
            {isHost ? 'Configurable by Host' : 'Host configured'}
          </span>
        </div>

        {/* Total Rounds */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-200 block">Total Rounds</span>
            <span className="text-[10px] text-zinc-400">Roles switch every round</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[4, 6, 8, 10].map(r => (
              <button
                key={r}
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateConfig?.({ totalRounds: r })}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  config.totalRounds === r
                    ? 'bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] text-white shadow-xs'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Draw Timer */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-200 block">Drawing Time</span>
            <span className="text-[10px] text-zinc-400">Seconds per round</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[45, 60, 90].map(sec => (
              <button
                key={sec}
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateConfig?.({ drawTimeSeconds: sec })}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  config.drawTimeSeconds === sec
                    ? 'bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] text-white shadow-xs'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rematch Status Banner if play again was pressed */}
      {(() => {
        const hasVotedRematch = Boolean(rematchStatus?.votedUserIds?.includes(myUserId));
        const rematchVotedCount = rematchStatus?.votedCount ?? 0;
        const partnerRequestedRematch = !hasVotedRematch && rematchVotedCount > 0;
        const requestingPlayer = room.players.find(p => rematchStatus?.votedUserIds?.includes(p.userId));

        if (rematchVotedCount === 0) return null;

        if (rematchStatus?.allVoted) {
          return (
            <div className="w-full mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-1 animate-fadeIn">
              <div className="flex items-center justify-center space-x-2 text-emerald-400 text-xs font-black">
                <Check className="w-4 h-4" />
                <span>Both players agreed! Starting rematch...</span>
              </div>
            </div>
          );
        }

        if (partnerRequestedRematch) {
          return (
            <div className="w-full mb-4 p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-center space-y-2.5 animate-pulse">
              <div className="flex items-center justify-center gap-2 text-rose-300 font-black text-sm">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span>🔥 {requestingPlayer?.displayName || 'Opponent'} wants to play again!</span>
              </div>
              <p className="text-xs text-zinc-300">
                Your opponent is in the waiting room ready for a rematch.
              </p>
              {onRematch && (
                <button
                  type="button"
                  onClick={onRematch}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-[#ee1d49] hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Accept & Play Again 🔄</span>
                </button>
              )}
            </div>
          );
        }

        return (
          <div className="w-full mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>Waiting for partner to accept Play Again... (1/2)</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Match will automatically start as soon as your partner accepts!
            </p>
          </div>
        );
      })()}

      {/* Start Button or Waiting Indicator (Exact Ludo Red Gradient) */}
      <div className="w-full pt-1">
        {isHost ? (
          <button
            type="button"
            onClick={() => onStartGame(config)}
            disabled={!p2}
            className={`w-full py-3.5 sm:py-4 px-6 rounded-2xl font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              p2
                ? 'bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white shadow-[0_4px_20px_rgba(255,43,94,0.4)] active:scale-[0.98]'
                : 'bg-white/10 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{p2 ? 'Start Doodle Duel 🚀' : 'Waiting for Player 2 to Join...'}</span>
          </button>
        ) : (
          <div className="w-full py-3.5 px-6 rounded-2xl bg-[#161220]/90 border border-white/10 text-center">
            <span className="text-xs font-bold text-zinc-300">
              Waiting for Host to start the duel...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
