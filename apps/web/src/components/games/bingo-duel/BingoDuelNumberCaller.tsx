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
    <div className="w-full bg-[#1e0e1a]/90 border border-rose-500/25 rounded-3xl p-4 sm:p-5 shadow-[0_15px_35px_rgba(0,0,0,0.5)] backdrop-blur-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Left: Circular Number Called Ball matching reference image */}
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="relative shrink-0">
          {/* Subtle pulsating outer gradient halo */}
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-[#ff4d79] via-[#ff758c] to-[#ffa3b1] opacity-75 blur-md animate-pulse" />

          {/* Center Circular Ring */}
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-[#2d1121] to-[#170912] border-2 border-[#ff758c] flex flex-col items-center justify-center shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)]">
            <span className="text-[9px] uppercase tracking-widest font-extrabold text-[#ff8ca1]">
              NUMBER
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight drop-shadow-md">
              {currentNumber !== null ? (currentNumber < 10 ? `0${currentNumber}` : currentNumber) : '--'}
            </span>
            <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-semibold mt-0.5">
              CALLED
            </span>
          </div>
        </div>

        {/* Turn & Status Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-[#ff8ca1]">
              {isMyTurn ? 'Your Turn to Pick a Number!' : currentTurnDisplayName ? `${currentTurnDisplayName}'s Turn` : 'Match Active'}
            </span>
          </div>

          <div className="text-base sm:text-lg font-extrabold text-white mt-0.5 truncate">
            {currentNumber ? (
              <span>
                Called: <span className="text-[#ff758c] font-black">{currentNumber}</span> •{' '}
                <span className="text-zinc-300 font-semibold uppercase">{currentNumberWord}</span>
              </span>
            ) : (
              <span className="text-zinc-400 text-sm">Host picks the first number</span>
            )}
          </div>

          <div className="text-[11px] text-zinc-400 mt-0.5">
            Called: <strong className="text-white">{calledNumbersCount}/25</strong> • Remaining:{' '}
            <strong className="text-white">{remainingCount}</strong>
          </div>
        </div>
      </div>

      {/* Center: Last 5 Numbers Pill Row matching reference image */}
      <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-400">
          <Sparkles className="w-3 h-3 text-[#ff758c]" />
          <span>Last 5 Numbers</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {lastCalledNumbers.length > 0 ? (
            lastCalledNumbers.map((num, i) => (
              <div
                key={`${num}-${i}`}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full font-mono text-xs sm:text-sm font-black flex items-center justify-center transition-all ${
                  i === 0
                    ? 'bg-gradient-to-tr from-[#ff4d79] to-[#ff758c] text-white shadow-[0_2px_8px_rgba(255,77,121,0.5)] scale-105 ring-2 ring-[#ff758c]/40'
                    : 'bg-white/5 border border-white/10 text-zinc-300'
                }`}
              >
                {num < 10 ? `0${num}` : num}
              </div>
            ))
          ) : (
            <span className="text-xs text-zinc-500 italic px-2">No numbers yet</span>
          )}

          {/* Sound / Voice Toggle Button */}
          <button
            type="button"
            onClick={onToggleVoiceCaller}
            className={`ml-2 p-2 rounded-xl border transition ${
              voiceCallerEnabled
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title={voiceCallerEnabled ? 'Mute Voice Caller' : 'Enable Voice Caller'}
          >
            {voiceCallerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
