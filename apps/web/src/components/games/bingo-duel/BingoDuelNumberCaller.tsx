'use client';

import React from 'react';
import { Volume2, VolumeX, Pause, Play, Sparkles } from 'lucide-react';

interface BingoDuelNumberCallerProps {
  currentNumber: number | null;
  currentNumberWord: string | null;
  lastCalledNumbers: number[];
  calledNumbersCount: number;
  remainingCount: number;
  isPaused: boolean;
  isHost: boolean;
  voiceCallerEnabled: boolean;
  onToggleVoiceCaller: () => void;
  onTogglePause?: () => void;
  onCallNextManually?: () => void;
  isManualMode?: boolean;
  currentTurnDisplayName?: string;
  isMyTurn?: boolean;
}

export const BingoDuelNumberCaller: React.FC<BingoDuelNumberCallerProps> = ({
  currentNumber,
  currentNumberWord,
  lastCalledNumbers,
  calledNumbersCount,
  remainingCount,
  isPaused,
  isHost,
  voiceCallerEnabled,
  onToggleVoiceCaller,
  currentTurnDisplayName,
  isMyTurn
}) => {
  return (
    <div className="w-full bg-[#1e0e1a]/90 border border-rose-500/25 rounded-2xl py-2 px-3 sm:px-4 shadow-md backdrop-blur-xl relative overflow-hidden flex flex-row items-center justify-between gap-3">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-36 h-36 bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Left: Circular Number Called Ball matching reference image */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {/* Subtle pulsating outer gradient halo */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#ff4d79] via-[#ff758c] to-[#ffa3b1] opacity-75 blur-sm animate-pulse" />

          {/* Center Circular Ring */}
          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-[#2d1121] to-[#170912] border-2 border-[#ff758c] flex flex-col items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
            <span className="text-[7px] uppercase tracking-widest font-extrabold text-[#ff8ca1]">
              NUM
            </span>
            <span className="text-base sm:text-lg font-black text-white leading-none tracking-tight drop-shadow-md">
              {currentNumber !== null ? (currentNumber < 10 ? `0${currentNumber}` : currentNumber) : '--'}
            </span>
          </div>
        </div>

        {/* Turn & Status Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#ff8ca1] truncate">
              {isMyTurn ? 'Your Turn to Pick!' : currentTurnDisplayName ? `${currentTurnDisplayName}'s Turn` : 'Match Active'}
            </span>
          </div>

          <div className="text-xs sm:text-sm font-extrabold text-white truncate">
            {currentNumber ? (
              <span>
                Called: <span className="text-[#ff758c] font-black">{currentNumber}</span> •{' '}
                <span className="text-zinc-300 font-semibold uppercase">{currentNumberWord}</span>
              </span>
            ) : (
              <span className="text-zinc-400 text-xs">Host picks the first number</span>
            )}
          </div>

          <div className="text-[10px] text-zinc-400">
            Called: <strong className="text-white">{calledNumbersCount}/25</strong> • Remaining:{' '}
            <strong className="text-white">{remainingCount}</strong>
          </div>
        </div>
      </div>

      {/* Center: Last 5 Numbers Pill Row */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[9px] uppercase font-bold text-zinc-400">Last 5</span>
        </div>

        <div className="flex items-center gap-1">
          {lastCalledNumbers.length > 0 ? (
            lastCalledNumbers.slice(0, 4).map((num, i) => (
              <div
                key={`${num}-${i}`}
                className={`w-7 h-7 rounded-full font-mono text-xs font-black flex items-center justify-center transition-all ${
                  i === 0
                    ? 'bg-gradient-to-tr from-[#ff4d79] to-[#ff758c] text-white shadow-[0_2px_6px_rgba(255,77,121,0.5)] scale-105 ring-1 ring-[#ff758c]/40'
                    : 'bg-white/5 border border-white/10 text-zinc-300'
                }`}
              >
                {num < 10 ? `0${num}` : num}
              </div>
            ))
          ) : (
            <span className="text-[10px] text-zinc-500 italic px-1">None yet</span>
          )}

          {/* Sound / Voice Toggle Button */}
          <button
            type="button"
            onClick={onToggleVoiceCaller}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              voiceCallerEnabled
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title={voiceCallerEnabled ? 'Mute Voice Caller' : 'Enable Voice Caller'}
          >
            {voiceCallerEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
