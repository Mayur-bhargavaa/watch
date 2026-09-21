'use client';

import React, { useState } from 'react';
import {
  Clock,
  Crown,
  Share2,
  Copy,
  Check,
  Play,
  ChevronLeft,
  ShieldCheck,
  User,
  RotateCcw,
  Zap,
  Timer,
  Swords
} from 'lucide-react';
import {
  GameRoom,
  ChessGameConfig,
  ChessTimeControlPreset,
  CHESS_TIME_PRESETS
} from '@synccinema/common';

interface ChessWaitingRoomProps {
  room: GameRoom;
  myUserId: string;
  config: ChessGameConfig;
  onStartGame: () => void;
  onUpdateConfig: (config: ChessGameConfig) => void;
  onLeave: () => void;
  onInviteFriend?: () => void;
  onRematch?: () => void;
  rematchStatus?: {
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null;
}

export const ChessWaitingRoom: React.FC<ChessWaitingRoomProps> = ({
  room,
  myUserId,
  config,
  onStartGame,
  onUpdateConfig,
  onLeave,
  onInviteFriend,
  onRematch,
  rematchStatus
}) => {
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  const isHost = room.hostUserId === myUserId;
  const isReadyToStart = room.players.length >= 2;

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

  const handlePresetSelect = (presetId: string) => {
    if (!isHost) return;
    const p = CHESS_TIME_PRESETS.find(item => item.id === presetId);
    if (!p) return;
    onUpdateConfig({
      ...config,
      presetId: p.id,
      baseTimeMs: p.baseTimeMs,
      incrementMs: p.incrementMs
    });
  };

  return (
    <div className="relative min-h-screen bg-[#07070b] text-white flex flex-col justify-between selection:bg-amber-500 selection:text-black overflow-x-hidden select-none font-sans">
      {/* Background glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[160px]" />
      </div>

      {/* Top Header Navbar */}
      <header className="relative z-20 h-16 border-b border-white/10 px-4 sm:px-8 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition border border-white/10 active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Leave Room</span>
        </button>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-zinc-400">Watch.</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">Game Lobby</span>
          <span className="text-zinc-600">/</span>
          <span className="text-amber-400 font-black flex items-center gap-1.5">
            <span>♟</span>
            <span>Chess</span>
          </span>
        </div>

        <div className="w-16" />
      </header>

      {/* Main Waiting Card Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="relative w-full max-w-xl my-auto rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 bg-[#111019]/80 border border-white/15 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_35px_rgba(245,158,11,0.12)] text-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Strict Zero-Bots Matchmaking Pill */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[11px] font-semibold tracking-wide mb-4 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Standard FIDE Rules · Zero-Bots Matchmaking</span>
          </div>

          {/* Waiting for Players Heading */}
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Chess <span className="font-medium text-white/90">Waiting</span> <span className="text-amber-400">Lobby</span>
          </h2>

          <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-6">
            Real-time 2-player chess duel. Match begins when both players are connected.
          </p>

          {/* Room Code Card */}
          <div className="w-full bg-[#161424]/90 border border-white/10 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 mb-5 shadow-inner">
            <div className="text-left min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">
                ROOM CODE
              </span>
              <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider block mt-0.5 leading-tight">
                {room.roomCode}
              </span>
              <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                Share this code with your opponent
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
                className="py-2.5 px-4 sm:px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(245,158,11,0.35)] transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{copiedRoomLink ? 'Link Copied!' : 'Share Link'}</span>
              </button>
            </div>
          </div>

          {/* Joined Players Section (White vs Black) */}
          <div className="w-full mb-5">
            <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-3 px-0.5">
              <span>Grandmaster Duel ({room.players.length}/2)</span>
              <span className="text-[11px] text-zinc-400">
                {room.players.length === 2 ? 'Ready to play!' : '1 player needed'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* White Seat (Host) */}
              {(() => {
                const whitePlayer = room.players[0];
                if (whitePlayer) {
                  return (
                    <div className="bg-[#191629]/90 border border-white/15 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 text-zinc-900 font-black text-lg flex items-center justify-center mb-2 shadow-sm border border-amber-300">
                        {(whitePlayer.displayName?.[0] || 'W').toUpperCase()}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                        {whitePlayer.displayName}
                      </span>
                      <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1 mt-0.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> White (Host)
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[120px]">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                    <span className="text-[11px] text-zinc-500 mt-0.5">White</span>
                  </div>
                );
              })()}

              {/* Black Seat (Opponent) */}
              {(() => {
                const blackPlayer = room.players[1];
                if (blackPlayer) {
                  return (
                    <div className="bg-[#191629]/90 border border-white/15 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm border border-zinc-700">
                        {(blackPlayer.displayName?.[0] || 'B').toUpperCase()}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                        {blackPlayer.displayName}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Swords className="w-3.5 h-3.5 text-zinc-400" /> Black (Challenger)
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[120px]">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                    <span className="text-[11px] text-zinc-500 mt-0.5">Black</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Time Controls Selector */}
          <div className="w-full bg-[#161424]/90 border border-white/10 rounded-2xl p-4 mb-5 text-left shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-amber-400" />
                Time Control
              </span>
              {!isHost && (
                <span className="text-[10px] text-zinc-500">Host selects time control</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'rapid-10-5', label: '10 min + 5s', desc: 'Rapid' },
                  { id: 'blitz-3-2', label: '3 min + 2s', desc: 'Blitz' },
                  { id: 'bullet-1-0', label: '1 min', desc: 'Bullet' },
                  { id: 'classical-30-0', label: '30 min', desc: 'Classical' }
                ] as const
              ).map(preset => {
                const isSelected = config.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/50'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
                    } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-xs font-bold leading-tight">{preset.label}</span>
                    <span className="text-[10px] opacity-75 uppercase tracking-wide mt-0.5">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rematch Status Banner if rematch requested */}
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
                <div className="w-full mb-4 p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-center space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-sm">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>⚔️ {requestingPlayer?.displayName || 'Opponent'} wants a rematch!</span>
                  </div>
                  <p className="text-xs text-zinc-300">
                    Your opponent is waiting to play another chess match.
                  </p>
                  {onRematch && (
                    <button
                      type="button"
                      onClick={onRematch}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Accept & Start Rematch 🔄</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="w-full mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for partner to accept rematch... (1/2)</span>
                </div>
              </div>
            );
          })()}

          {/* Action Button: Start or Waiting */}
          <div className="w-full pt-1">
            {isReadyToStart ? (
              isHost ? (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-black text-sm uppercase tracking-wider shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Start Chess Match ♟</span>
                </button>
              ) : (
                <div className="w-full py-3.5 px-6 rounded-2xl bg-[#161424]/90 border border-white/10 text-center text-xs font-bold text-zinc-300 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Waiting for host to start the match...</span>
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onInviteFriend || handleCopyRoomLink}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(245,158,11,0.35)] transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Invite Opponent</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 h-10 border-t border-white/[0.08] px-6 flex items-center justify-between text-[11px] text-zinc-400 bg-black/40 backdrop-blur-md">
        <span>Room: <strong className="text-white font-mono">{room.roomCode}</strong></span>
        <span>Watch Cinema Gaming Platform · Stitchbyte</span>
      </footer>
    </div>
  );
};
