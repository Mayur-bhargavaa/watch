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
  Info
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
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isHost = room.hostUserId === myUserId;
  const isReadyToStart = room.players.length >= 2;

  const player1 = room.players[0];
  const player2 = room.players[1];

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="min-h-screen bg-[#080a12] text-white flex flex-col justify-between selection:bg-rose-600 selection:text-white relative overflow-hidden">
      
      {/* Top Navigation */}
      <header className="h-16 border-b border-white/[0.08] px-4 sm:px-8 flex items-center justify-between bg-black/40 backdrop-blur-md z-20">
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Leave</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base">🎱</span>
          <span className="text-sm font-black text-white tracking-wide">Bingo Duel</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-zinc-300 font-mono">
            {room.players.length} / {room.maxPlayers} Players
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
            title="Room Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Main Waiting Lobby */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-xl space-y-6">

          {/* Title Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              BINGO DUEL
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              “Classic Tambola. Modern twist.”
            </p>
          </div>

          {/* Two Player VS Card */}
          <div className="p-6 rounded-3xl bg-[#0e101a]/90 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="grid grid-cols-2 gap-4 items-center relative">
              
              {/* Player 1 (Host) */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center shadow-lg">
                    {player1?.avatarUrl ? (
                      <img src={player1.avatarUrl} alt={player1.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-black text-white">{player1?.displayName?.slice(0, 2).toUpperCase() || 'P1'}</span>
                    )}
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-amber-400 text-black shadow-md">
                    <Crown className="w-3 h-3" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-black text-white truncate max-w-[140px]">
                    {player1?.displayName || 'Host'}
                  </div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    👑 Host
                  </span>
                </div>
              </div>

              {/* VS Divider */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 border border-white/15 flex items-center justify-center text-[10px] font-black text-rose-400 shadow-md">
                VS
              </div>

              {/* Player 2 (Opponent) */}
              <div className="flex flex-col items-center text-center space-y-2">
                {player2 ? (
                  <>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-violet-500/20 border-2 border-violet-500/40 flex items-center justify-center shadow-lg">
                      {player2.avatarUrl ? (
                        <img src={player2.avatarUrl} alt={player2.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-black text-white">{player2.displayName?.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white truncate max-w-[140px]">
                        {player2.displayName}
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Online</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-zinc-500">
                      <Users className="w-6 h-6 animate-pulse" />
                    </div>
                    <span className="text-xs text-zinc-400 italic">
                      Waiting for player...
                    </span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Game Stats info */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Game Mode</span>
              <p className="text-xs font-black text-white mt-0.5 capitalize">
                {config.mode === '90-ball' ? '90 Ball Tambola' : '75 Ball Bingo'}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Players</span>
              <p className="text-xs font-black text-white mt-0.5">
                2 Players
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Estimated Time</span>
              <p className="text-xs font-black text-white mt-0.5">
                ~20 minutes
              </p>
            </div>
          </div>

          {/* Active Rules List */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                ACTIVE WINNING RULES
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition"
              >
                Customize Rules ⚙
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enabledRules.map((rule) => (
                <span
                  key={rule}
                  className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-zinc-200"
                >
                  {rule}
                </span>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {isReadyToStart ? (
              isHost ? (
                <button
                  type="button"
                  onClick={() => onStartGame(config)}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-[#ee1d49] to-pink-600 hover:brightness-110 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Game</span>
                </button>
              ) : (
                <div className="w-full py-3.5 px-6 rounded-2xl bg-white/5 border border-white/10 text-center text-xs font-bold text-zinc-400 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Waiting for host to start the game...</span>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onInviteFriend || handleCopyLink}
                  className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Invite Friend</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Invite Link Copied!' : `Copy Room Code: ${room.roomCode}`}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer Status */}
      <footer className="h-10 border-t border-white/[0.05] px-6 flex items-center justify-between text-[11px] text-zinc-500 z-10">
        <span>Room: {room.roomCode}</span>
        <span>Watch Cinema Gaming Platform</span>
      </footer>

      {/* Room Settings Modal */}
      {showSettings && (
        <BingoRoomSettings
          config={config}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={onUpdateConfig}
          isHost={isHost}
        />
      )}
    </div>
  );
};
