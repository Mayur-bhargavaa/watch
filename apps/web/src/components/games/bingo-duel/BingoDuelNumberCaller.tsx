'use client';

import React from 'react';
import { Volume2, VolumeX, Pause, Play, ChevronRight, Zap } from 'lucide-react';

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
  onTogglePause: () => void;
  onCallNextManually?: () => void;
  isManualMode?: boolean;
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
  onTogglePause,
  onCallNextManually,
  isManualMode
}) => {
  return (
    <div className="w-full bg-slate-900/80 border border-indigo-500/25 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Background ambient glow behind active ball */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
        {/* Left: Prominent Live Number Ball & Announcement */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative">
            {/* Animated outer ring */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-500 via-pink-500 to-amber-400 opacity-70 blur-sm animate-pulse" />
            
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-slate-900 to-indigo-950 border-2 border-indigo-400 flex flex-col items-center justify-center shadow-inner">
              {currentNumber ? (
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                  {currentNumber}
                </span>
              ) : (
                <Zap className="w-7 h-7 text-indigo-400 animate-spin" />
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Current Call (1–25)</span>
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-white">
              {currentNumber ? (
                <span>
                  {currentNumber} • <span className="text-indigo-300 uppercase">{currentNumberWord}</span>
                </span>
              ) : (
                <span className="text-slate-400 text-sm">Waiting for first number...</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Called: <span className="text-white font-semibold">{calledNumbersCount}/25</span> • Remaining:{' '}
              <span className="text-white font-semibold">{remainingCount}</span>
            </div>
          </div>
        </div>

        {/* Center: Previous 5 Called Numbers Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 mr-1 hidden md:inline">
            History:
          </span>
          {lastCalledNumbers.map((num, i) => (
            <div
              key={`${num}-${i}`}
              className={`w-8 h-8 rounded-xl font-mono text-xs font-bold flex items-center justify-center border transition ${
                i === 0
                  ? 'bg-indigo-600/40 border-indigo-400 text-white shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              {num}
            </div>
          ))}
          {lastCalledNumbers.length === 0 && (
            <span className="text-xs text-slate-500 italic">No numbers yet</span>
          )}
        </div>

        {/* Right: Sound & Host Controls */}
        <div className="flex items-center gap-2">
          {/* Sound / Voice Toggle */}
          <button
            type="button"
            onClick={onToggleVoiceCaller}
            className={`p-2.5 rounded-xl border transition ${
              voiceCallerEnabled
                ? 'bg-indigo-600/25 border-indigo-400 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title={voiceCallerEnabled ? 'Mute Voice Caller' : 'Enable Voice Caller'}
          >
            {voiceCallerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Host Pause/Resume Button */}
          {isHost && (
            <button
              type="button"
              onClick={onTogglePause}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-600/30 border-amber-400 text-amber-300'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              )}
            </button>
          )}

          {/* Manual Next Call button if manual mode */}
          {isHost && isManualMode && onCallNextManually && (
            <button
              type="button"
              onClick={onCallNextManually}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white text-xs font-bold shadow-md hover:from-indigo-500 hover:to-pink-500 flex items-center gap-1 active:scale-95 transition"
            >
              <span>Call Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
