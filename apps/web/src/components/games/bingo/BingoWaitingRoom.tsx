'use client';

import React, { useState } from 'react';
import {
  Users,
  Clock,
  Settings,
  Crown,
  Share2,
  Copy,
  Check,
  Play,
  Sparkles,
  ChevronLeft,
  ShieldCheck,
  User
} from 'lucide-react';
import { GameRoom, BingoRoomConfig } from '@synccinema/common';
import { BingoRoomSettings } from './BingoRoomSettings';

interface BingoWaitingRoomProps {
  room: GameRoom;
  myUserId: string;
  config: BingoRoomConfig;
  onStartGame: (config: BingoRoomConfig) => void;
  onUpdateConfig: (config: BingoRoomConfig) => void;
  onLeave: () => void;
  onInviteFriend?: () => void;
}

export const BingoWaitingRoom: React.FC<BingoWaitingRoomProps> = ({
  room,
  myUserId,
  config,
  onStartGame,
  onUpdateConfig,
  onLeave,
  onInviteFriend
}) => {
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const enabledRules = Object.entries(config.winConditions)
    .filter(([_, active]) => active)
    .map(([rule]) => {
      const names: Record<string, string> = {
        early5: 'Early 5',
        topLine: 'Top Line',
        middleLine: 'Middle Line',
        bottomLine: 'Bottom Line',
        fourCorners: 'Four Corners',
        housefull: 'Housefull',
        xPattern: 'X Pattern',
        crossPattern: 'Cross Pattern',
        starPattern: 'Star Pattern',
        diamond: 'Diamond',
        fullBorder: 'Full Border',
        customPattern: 'Custom Pattern'
      };
      return names[rule] || rule;
    });

  return (
    <div className="relative min-h-screen bg-[#080a12] text-white flex flex-col justify-between selection:bg-[#ff2b5e] selection:text-white overflow-x-hidden select-none font-sans">
      
      {/* Cozy cinematic waiting room background (Exact Ludo theme) */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat select-none pointer-events-none"
        style={{ backgroundImage: `url('/images/ludo-waiting-bg.jpg')` }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]" />
      </div>

      {/* Top Header Navbar */}
      <header className="relative z-20 h-16 border-b border-white/10 px-4 sm:px-8 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition border border-white/10 active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Leave Room</span>
        </button>

        {/* Breadcrumbs matching Ludo theme */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-zinc-400">Watch.</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">Game Lobby</span>
          <span className="text-zinc-600">/</span>
          <span className="text-[#ff2b5e] font-black flex items-center gap-1.5">
            <span>🎱</span>
            <span>Bingo Duel</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isHost && (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Room Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Rules & Settings</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Waiting Card Area (Exact Ludo Match) */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="relative w-full max-w-xl my-auto rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 bg-[#0e0c18]/70 border border-white/20 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_35px_rgba(255,43,94,0.12)] text-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Strict Zero-Bots Matchmaking Pill */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[11px] font-semibold tracking-wide mb-4 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Strict Zero-Bots Matchmaking</span>
          </div>

          {/* Waiting for Players Heading */}
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Waiting <span className="font-medium text-white/90">for</span> <span className="text-[#ff2b5e]">Players</span>
          </h2>

          {/* Match Subtitle */}
          <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-6">
            Match will begin when <span className="text-[#ff2b5e] font-semibold">2 human players</span> join the room.
            <br />
            No bots will ever be injected.
          </p>

          {/* Room Code Card */}
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

          {/* Joined Seats Section */}
          <div className="w-full mb-5">
            <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-3 px-0.5">
              <span>Joined Seats ({room.players.length}/{room.maxPlayers})</span>
              <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-normal">
                <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80 inline-block shrink-0" />
                <span>{Math.max(0, room.maxPlayers - room.players.length)} seat remaining</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {Array.from({ length: room.maxPlayers }).map((_, seatIdx) => {
                const player = room.players.find(p => p.seat === seatIdx) || room.players[seatIdx];
                if (player) {
                  return (
                    <div
                      key={seatIdx}
                      className="bg-[#181322]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                        {(player.displayName?.[0] || 'P').toUpperCase()}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                        {player.displayName}
                      </span>
                      <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                        {seatIdx === 0 ? (
                          <>
                            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Host
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-zinc-400" /> Player
                          </>
                        )}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={seatIdx}
                    className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[120px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                    <span className="text-[11px] text-zinc-500 mt-0.5">Player {seatIdx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rules / Config Bar */}
          <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-3.5 mb-5 text-left shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                ACTIVE MODE: {config.mode === '90-ball' ? '90-Ball Tambola' : '75-Ball Bingo'}
              </span>
              {isHost && (
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[10px] font-bold text-[#ff2b5e] hover:underline cursor-pointer"
                >
                  Configure Rules
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enabledRules.map(rule => (
                <span
                  key={rule}
                  className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-zinc-300"
                >
                  {rule}
                </span>
              ))}
            </div>
          </div>

          {/* Action Button: Start or Waiting */}
          <div className="w-full pt-1">
            {isReadyToStart ? (
              isHost ? (
                <button
                  type="button"
                  onClick={() => onStartGame(config)}
                  className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-extrabold text-sm uppercase tracking-wider shadow-[0_4px_20px_rgba(255,43,94,0.4)] transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Bingo Duel 🚀</span>
                </button>
              ) : (
                <div className="w-full py-3.5 px-6 rounded-2xl bg-[#161220]/90 border border-white/10 text-center text-xs font-bold text-zinc-300 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Waiting for host to start the duel...</span>
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onInviteFriend || handleCopyRoomLink}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-extrabold text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(255,43,94,0.35)] transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
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

      {/* Settings Modal */}
      {showSettings && (
        <BingoRoomSettings
          config={config}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => {
            onUpdateConfig(updated);
            setShowSettings(false);
          }}
          isHost={isHost}
        />
      )}
    </div>
  );
};
