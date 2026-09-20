'use client';

import React from 'react';
import { Play, Volume2, Sparkles } from 'lucide-react';

interface BingoCallerProps {
  currentNumber: number | null;
  currentNumberWord: string | null;
  lastCalledNumbers: number[];
  remainingCount: number;
  totalNumbers?: number;
  isAutoCall?: boolean;
  callingSpeed?: number;
  isHost?: boolean;
  onCallNext?: () => void;
  isPaused?: boolean;
}

export const BingoCaller: React.FC<BingoCallerProps> = ({
  currentNumber,
  currentNumberWord,
  lastCalledNumbers,
  remainingCount,
  totalNumbers = 90,
  isAutoCall = true,
  callingSpeed = 3000,
  isHost = false,
  onCallNext,
  isPaused = false
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-3 sm:p-5 relative select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 via-violet-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Main Circular Glowing Ball */}
      <div className="relative my-2 sm:my-4 flex items-center justify-center">
        {/* Outer pulsating aura */}
        <div className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-rose-600/30 to-violet-600/30 blur-xl animate-pulse pointer-events-none" />

        {/* 3D Glossy Sphere */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-[#1c182d] via-[#100e1c] to-[#08070e] border-2 border-white/20 shadow-[0_0_35px_rgba(238,29,73,0.35),inset_0_4px_12px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center transition-transform transform active:scale-95 duration-200">
          
          {/* Subtle Top Specular Reflection */}
          <div className="absolute top-2 w-16 h-8 rounded-full bg-gradient-to-b from-white/20 to-transparent blur-[1px] pointer-events-none" />

          {currentNumber !== null ? (
            <div className="flex flex-col items-center text-center animate-in zoom-in-75 duration-200">
              <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]">
                {currentNumber}
              </span>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-rose-400 mt-0.5 px-2 py-0.5 rounded-full bg-rose-500/10">
                {currentNumberWord || 'CALLED'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center px-2">
              <Sparkles className="w-5 h-5 text-rose-400 animate-pulse mb-1" />
              <span className="text-[11px] font-bold text-zinc-400">
                {isAutoCall ? 'First Ball Calling...' : 'Ready to Call'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Host Manual Call Button */}
      {!isAutoCall && isHost && (
        <button
          type="button"
          onClick={onCallNext}
          className="my-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-[#ee1d49] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-600/30 active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Call Next Number</span>
        </button>
      )}

      {/* Last Called Numbers Strip */}
      <div className="w-full max-w-xs sm:max-w-sm mt-2 flex flex-col items-center space-y-1.5">
        <div className="flex items-center justify-between w-full px-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
          <span>Last Numbers</span>
          <span className="text-zinc-500">{remainingCount} left</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full p-2 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-inner">
          {lastCalledNumbers.length > 0 ? (
            lastCalledNumbers.slice(0, 5).map((num, idx) => (
              <div
                key={`${num}-${idx}`}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center font-mono text-xs sm:text-sm font-black transition-all ${
                  idx === 0
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(238,29,73,0.3)]'
                    : 'bg-black/40 border-white/10 text-zinc-300'
                }`}
              >
                {num}
              </div>
            ))
          ) : (
            <span className="text-[11px] text-zinc-500 italic py-1">No prior numbers called</span>
          )}
        </div>
      </div>
    </div>
  );
};
