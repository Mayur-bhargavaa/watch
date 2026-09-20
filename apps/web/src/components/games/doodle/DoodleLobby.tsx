'use client';

import React, { useState } from 'react';
import { Palette, Brain, Play, Copy, Check, Users, Shield, Sparkles, Settings2 } from 'lucide-react';
import { GameRoom, DoodleConfig, DoodleGameState } from '@synccinema/common';

interface DoodleLobbyProps {
  room: GameRoom;
  gameState: DoodleGameState;
  myUserId: string;
  isHost: boolean;
  onSelectRole: (drawerUserId: string) => void;
  onStartGame: (config?: Partial<DoodleConfig>) => void;
  onUpdateConfig?: (config: Partial<DoodleConfig>) => void;
}

export const DoodleLobby: React.FC<DoodleLobbyProps> = ({
  room,
  gameState,
  myUserId,
  isHost,
  onSelectRole,
  onStartGame,
  onUpdateConfig
}) => {
  const [copied, setCopied] = useState(false);
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

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center select-none animate-in fade-in duration-300">
      {/* Title & Brand Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-widest mb-3 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
          <Palette className="w-3.5 h-3.5" />
          <span>DOODLE DUEL • 2 PLAYERS</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Who Draws First?
        </h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-md">
          Pick who starts sketching. Roles will automatically alternate each round!
        </p>
      </div>

      {/* 2-Player Role Cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Player 1 Card */}
        <div
          onClick={() => p1 && onSelectRole(p1.userId)}
          className={`relative p-5 rounded-3xl border transition-all cursor-pointer ${
            selectedDrawerId === p1?.userId
              ? 'bg-rose-500/15 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500'
              : 'bg-[#111625]/80 hover:bg-[#151c2f] border-white/10'
          }`}
        >
          {selectedDrawerId === p1?.userId && (
            <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              Draws 1st 🎨
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center font-black text-lg text-white shadow-md">
              {p1?.displayName?.charAt(0).toUpperCase() || 'P1'}
            </div>
            <div>
              <span className="text-sm font-black text-white block">
                {p1?.displayName || 'Host Player'}
              </span>
              <span className="text-[11px] font-bold text-zinc-400">
                {p1?.userId === myUserId ? 'You (Host)' : 'Host'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-xs font-semibold">
            {selectedDrawerId === p1?.userId ? (
              <span className="text-rose-400 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" /> Starts as Drawer
              </span>
            ) : (
              <span className="text-violet-400 flex items-center gap-1">
                <Brain className="w-3.5 h-3.5" /> Starts as Guesser
              </span>
            )}
          </div>
        </div>

        {/* Player 2 Card */}
        <div
          onClick={() => p2 && onSelectRole(p2.userId)}
          className={`relative p-5 rounded-3xl border transition-all ${
            p2 ? 'cursor-pointer' : 'cursor-default opacity-80'
          } ${
            p2 && selectedDrawerId === p2.userId
              ? 'bg-rose-500/15 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500'
              : 'bg-[#111625]/80 hover:bg-[#151c2f] border-white/10'
          }`}
        >
          {p2 && selectedDrawerId === p2.userId && (
            <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              Draws 1st 🎨
            </div>
          )}

          {p2 ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-blue-500 flex items-center justify-center font-black text-lg text-white shadow-md">
                  {p2.displayName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-black text-white block">
                    {p2.displayName}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-400">
                    {p2.userId === myUserId ? 'You (Opponent)' : 'Opponent'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-xs font-semibold">
                {selectedDrawerId === p2.userId ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Starts as Drawer
                  </span>
                ) : (
                  <span className="text-violet-400 flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5" /> Starts as Guesser
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-4 text-center">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 mb-2">
                <Users className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-zinc-300">Waiting for friend to join...</span>
              <span className="text-[11px] text-zinc-500 mt-0.5">Share the room code or invite link</span>
            </div>
          )}
        </div>
      </div>

      {/* Match Options Card */}
      <div className="w-full p-5 rounded-3xl bg-[#111625]/90 border border-white/10 shadow-2xl mb-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Duel Match Settings
            </span>
          </div>
          <span className="text-[10px] font-semibold text-zinc-400">
            {isHost ? 'Configurable by Host' : 'Host configured'}
          </span>
        </div>

        {/* Total Rounds */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-zinc-200 block">Total Rounds</span>
            <span className="text-[10px] text-zinc-400">Equal turns for both players</span>
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
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                } ${!isHost ? 'cursor-default' : ''}`}
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
            <span className="text-[10px] text-zinc-400">Time per round for guessing</span>
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
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                } ${!isHost ? 'cursor-default' : ''}`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Share / Invite Banner if waiting for player 2 */}
      {!p2 && (
        <div className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-300">
              Code: <span className="text-rose-400 font-black">{room.roomCode}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>
        </div>
      )}

      {/* Start Button */}
      {isHost ? (
        <button
          type="button"
          onClick={() => onStartGame(config)}
          disabled={!p2}
          className={`w-full py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
            p2
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-[0_0_30px_rgba(244,63,94,0.4)] active:scale-[0.98]'
              : 'bg-white/10 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{p2 ? 'Start Doodle Duel 🚀' : 'Waiting for Player 2 to Join...'}</span>
        </button>
      ) : (
        <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
          <span className="text-xs font-semibold text-zinc-300">
            Waiting for Host to start the duel...
          </span>
        </div>
      )}
    </div>
  );
};
