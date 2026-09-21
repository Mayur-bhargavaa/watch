'use client';

import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  Share2,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  Mic,
  Clock,
  ShieldAlert,
  Flame,
  Grid
} from 'lucide-react';
import { BingoDuelConfig, BingoDuelPattern, BingoDuelMode } from '@synccinema/common';
import { GameRoom, GameRoomPlayer } from '@synccinema/common';

interface BingoDuelWaitingRoomProps {
  room: GameRoom;
  players: GameRoomPlayer[];
  myUserId: string;
  isHost: boolean;
  config: BingoDuelConfig;
  onUpdateConfig: (partial: Partial<BingoDuelConfig>) => void;
  onStartGame: () => void;
  onSelectPartner?: () => void;
}

const PATTERNS: { id: BingoDuelPattern; label: string; desc: string; iconText: string }[] = [
  { id: 'firstRow', label: 'First Row', desc: 'Top horizontal row', iconText: '━' },
  { id: 'middleRow', label: 'Middle Row', desc: 'Center horizontal row', iconText: '━' },
  { id: 'lastRow', label: 'Last Row', desc: 'Bottom horizontal row', iconText: '━' },
  { id: 'anyRow', label: 'Any Row', desc: 'Any complete horizontal line', iconText: '☰' },
  { id: 'anyCol', label: 'Any Column', desc: 'Any complete vertical line', iconText: '|||' },
  { id: 'fourCorners', label: '4 Corners', desc: 'The four corner cells', iconText: '⛶' },
  { id: 'xPattern', label: 'X Pattern', desc: 'Both main diagonals', iconText: '✕' },
  { id: 'plusPattern', label: 'Plus (+)', desc: 'Middle row and column', iconText: '✚' },
  { id: 'diagonal', label: 'Diagonal', desc: 'Either diagonal line', iconText: '╱' },
  { id: 'fullHouse', label: 'Full House', desc: 'All 25 board cells', iconText: '█' },
  { id: 'custom', label: 'Custom Grid', desc: 'Host designed 5×5 pattern', iconText: '⊞' }
];

const MODES: { id: BingoDuelMode; label: string; desc: string }[] = [
  { id: 'quick', label: 'Quick Match', desc: 'Fast single game' },
  { id: 'classic', label: 'Classic', desc: 'Standard duel' },
  { id: 'bestOf3', label: 'Best of 3', desc: 'First to 2 wins' },
  { id: 'bestOf5', label: 'Best of 5', desc: 'First to 3 wins' }
];

const SPEEDS: { value: number; label: string }[] = [
  { value: 3000, label: 'Fast (3s)' },
  { value: 5000, label: 'Normal (5s)' },
  { value: 10000, label: 'Chill (10s)' },
  { value: 15000, label: 'Slow (15s)' },
  { value: 0, label: 'Manual' }
];

const PENALTIES: { value: number; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 3, label: '3 Seconds' },
  { value: 5, label: '5 Seconds' }
];

export const BingoDuelWaitingRoom: React.FC<BingoDuelWaitingRoomProps> = ({
  room,
  players,
  myUserId,
  isHost,
  config,
  onUpdateConfig,
  onStartGame,
  onSelectPartner
}) => {
  const [copied, setCopied] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/games/bingo?room=${encodeURIComponent(room.roomCode)}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my Bingo Duel on watch.',
        text: `Play Bingo Duel 1–25 with me! Room Code: ${room.roomCode}`,
        url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Toggle cell in custom 5x5 pattern editor
  const handleToggleCustomCell = (r: number, c: number) => {
    if (!isHost) return;
    const current = config.customPattern || Array(5).fill(null).map(() => Array(5).fill(false));
    const next = current.map((row, ri) =>
      row.map((val, ci) => (ri === r && ci === c ? !val : val))
    );
    onUpdateConfig({ customPattern: next, pattern: 'custom' });
  };

  const hostPlayer = players.find(p => p.userId === room.hostUserId);
  const opponentPlayer = players.find(p => p.userId !== room.hostUserId);
  const isFull = players.length >= 2;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner: Room Code & Quick Share */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-900/80 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-indigo-300 font-semibold mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Duel Room Ready</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl sm:text-3xl font-mono font-black text-white tracking-widest">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/10 flex items-center justify-center gap-2 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Link</span>
          </button>
          {onSelectPartner && !isFull && (
            <button
              type="button"
              onClick={onSelectPartner}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Invite Friend</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Player Duel Slots */}
      <div className="grid grid-cols-2 gap-4">
        {/* Host Slot */}
        <div className="bg-slate-900/60 border border-indigo-500/30 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            HOST
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-indigo-400 p-0.5 mb-2 relative">
            <img
              src={hostPlayer?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${hostPlayer?.userId || 'host'}`}
              alt={hostPlayer?.displayName || 'Host'}
              className="w-full h-full rounded-full object-cover bg-indigo-950"
            />
          </div>
          <span className="text-sm font-bold text-white truncate max-w-[120px]">
            {hostPlayer?.displayName || 'Host'}
          </span>
          <span className="text-[11px] text-emerald-400 font-medium mt-0.5">Ready to Duel</span>
        </div>

        {/* Opponent Slot */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
            OPPONENT
          </div>
          {opponentPlayer ? (
            <>
              <div className="w-14 h-14 rounded-full border-2 border-pink-400 p-0.5 mb-2 relative">
                <img
                  src={opponentPlayer.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${opponentPlayer.userId}`}
                  alt={opponentPlayer.displayName}
                  className="w-full h-full rounded-full object-cover bg-pink-950"
                />
              </div>
              <span className="text-sm font-bold text-white truncate max-w-[120px]">
                {opponentPlayer.displayName}
              </span>
              <span className="text-[11px] text-emerald-400 font-medium mt-0.5">Connected</span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-2 animate-pulse">
                <Users className="w-6 h-6 text-slate-500" />
              </div>
              <span className="text-sm font-semibold text-slate-400">Waiting...</span>
              <span className="text-[11px] text-slate-500 mt-0.5">Share code to invite</span>
            </>
          )}
        </div>
      </div>

      {/* Match Configuration Settings (Host Can Edit, Opponent Views Live) */}
      <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Duel Rules & Pattern</h3>
          </div>
          {!isHost && (
            <span className="text-[11px] text-slate-400 font-medium">Host is configuring</span>
          )}
        </div>

        {/* 1. Winning Pattern Selection */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              Target Winning Pattern
            </label>
            <span className="text-xs text-indigo-400 font-medium">
              Selected: {PATTERNS.find(p => p.id === config.pattern)?.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PATTERNS.map(pat => {
              const active = config.pattern === pat.id;
              return (
                <button
                  key={pat.id}
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    onUpdateConfig({ pattern: pat.id });
                    if (pat.id === 'custom') setShowCustomEditor(true);
                  }}
                  className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                    active
                      ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div>
                    <div className="text-xs font-bold">{pat.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{pat.desc}</div>
                  </div>
                  <span className="font-mono text-base text-indigo-300 ml-2">{pat.iconText}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Pattern Visual 5x5 Grid Editor if custom pattern selected */}
          {config.pattern === 'custom' && (
            <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-indigo-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-indigo-400" />
                  Custom 5×5 Pattern Editor {isHost ? '(Click cells to toggle)' : '(Host Pattern)'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 w-44 mx-auto">
                {Array.from({ length: 5 }).map((_, r) =>
                  Array.from({ length: 5 }).map((_, c) => {
                    const active = Boolean(config.customPattern?.[r]?.[c]);
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        disabled={!isHost}
                        onClick={() => handleToggleCustomCell(r, c)}
                        className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center ${
                          active
                            ? 'bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-md'
                            : 'bg-white/10 text-slate-500 hover:bg-white/15'
                        }`}
                      >
                        {active ? '✓' : ''}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Mode Selector & Auto-Call Speed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Game Mode */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
              Match Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map(m => {
                const active = config.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onUpdateConfig({ mode: m.id })}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      active
                        ? 'bg-purple-600/30 border-purple-400 text-white'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.label}</div>
                    <div className="text-[10px] text-slate-400">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto Call Speed */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Calling Speed
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {SPEEDS.map(s => {
                const active = config.autoCallSpeed === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onUpdateConfig({ autoCallSpeed: s.value })}
                    className={`p-2 rounded-xl border text-center text-xs font-semibold transition ${
                      active
                        ? 'bg-pink-600/30 border-pink-400 text-white'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Toggles: Voice Caller & False Bingo Penalty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
          {/* False Bingo Penalty */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              False Bingo Penalty
            </label>
            <div className="flex gap-2">
              {PENALTIES.map(p => {
                const active = config.falseBingoPenalty === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onUpdateConfig({ falseBingoPenalty: p.value })}
                    className={`flex-1 py-1.5 px-2 rounded-xl border text-center text-xs font-semibold transition ${
                      active
                        ? 'bg-amber-600/30 border-amber-400 text-white'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice & Sound Caller */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-pink-400" />
                Voice & Audio Caller
              </div>
              <div className="text-[10px] text-slate-400">Speaks out called numbers</div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateConfig({ voiceCaller: !config.voiceCaller, sound: !config.sound })}
              className={`p-2 rounded-xl border transition ${
                config.voiceCaller
                  ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                  : 'bg-white/10 border-white/10 text-slate-400'
              }`}
            >
              {config.voiceCaller ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Start Match CTA for Host */}
      <div className="pt-2">
        {isHost ? (
          <button
            type="button"
            onClick={onStartGame}
            disabled={!isFull}
            className={`w-full py-4 px-6 rounded-2xl font-black text-base shadow-2xl transition flex items-center justify-center gap-2 ${
              isFull
                ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-indigo-600/40 active:scale-[0.99] cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{isFull ? 'START BINGO DUEL NOW' : 'WAITING FOR OPPONENT TO JOIN...'}</span>
          </button>
        ) : (
          <div className="w-full py-4 px-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-center">
            <span className="text-sm font-semibold text-indigo-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Waiting for host to start the duel...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
