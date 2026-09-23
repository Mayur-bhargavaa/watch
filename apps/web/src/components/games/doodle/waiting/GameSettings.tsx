'use client';

import React from 'react';
import { Settings2, ShieldCheck, Lock } from 'lucide-react';
import { DoodleConfig } from '@synccinema/common';

interface GameSettingsProps {
  config: Partial<DoodleConfig>;
  isHost: boolean;
  onUpdateConfig?: (partial: Partial<DoodleConfig>) => void;
  isDark?: boolean;
}

export const GameSettings: React.FC<GameSettingsProps> = ({
  config,
  isHost,
  onUpdateConfig,
  isDark = false
}) => {
  const currentRounds = config?.rounds || config?.totalRounds || 6;
  const currentDrawTime = config?.drawTime || config?.drawTimeSeconds || 60;
  const currentDifficulty = (config as any)?.difficulty || 'mixed';
  const humanOnly = (config as any)?.humanOnly !== false;

  return (
    <div className="relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 bg-white/80 dark:bg-[#121629]/80 border border-white/70 dark:border-white/10 shadow-[0_4px_20px_rgba(255,43,112,0.05)] backdrop-blur-xl transition-all space-y-2.5">
      {/* Title */}
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-lg bg-pink-100 dark:bg-pink-950/40 text-[#ff2b70] flex items-center justify-center">
            <Settings2 className="w-3 h-3" />
          </div>
          <h3 className="text-xs sm:text-sm font-black text-[#16132b] dark:text-white tracking-tight">
            Game Settings
          </h3>
        </div>

        {!isHost && (
          <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
            <Lock className="w-2.5 h-2.5" /> Host only
          </span>
        )}
      </div>

      {/* Setting 1: Total Rounds */}
      <div>
        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
          Total Rounds
        </span>
        <div className="grid grid-cols-4 gap-1">
          {[4, 6, 8, 10].map(r => {
            const active = currentRounds === r;
            return (
              <button
                key={r}
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateConfig?.({ rounds: r, totalRounds: r } as any)}
                className={`py-1 rounded-lg text-[11px] font-extrabold transition-all border ${
                  active
                    ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-2xs'
                    : 'bg-slate-50/80 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10'
                } ${!isHost ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Setting 2: Drawing Time */}
      <div>
        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
          Drawing Time
        </span>
        <div className="grid grid-cols-3 gap-1">
          {[60, 90, 120].map(sec => {
            const active = currentDrawTime === sec;
            return (
              <button
                key={sec}
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateConfig?.({ drawTime: sec, drawTimeSeconds: sec } as any)}
                className={`py-1 rounded-lg text-[11px] font-extrabold transition-all border ${
                  active
                    ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-2xs'
                    : 'bg-slate-50/80 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10'
                } ${!isHost ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
              >
                {sec}s
              </button>
            );
          })}
        </div>
      </div>

      {/* Setting 3: Word Difficulty */}
      <div>
        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
          Word Difficulty
        </span>
        <div className="grid grid-cols-3 gap-1">
          {['easy', 'mixed', 'hard'].map(diff => {
            const active = currentDifficulty === diff;
            const label = diff.charAt(0).toUpperCase() + diff.slice(1);
            return (
              <button
                key={diff}
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateConfig?.({ difficulty: diff } as any)}
                className={`py-1 rounded-lg text-[11px] font-extrabold transition-all border ${
                  active
                    ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-2xs'
                    : 'bg-slate-50/80 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10'
                } ${!isHost ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Setting 4: Strict Anti-Bot Matchmaking Toggle */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-extrabold text-[#16132b] dark:text-white block leading-tight">
              Strict Anti-Bot Matchmaking
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
              Only real people, no bots.
            </span>
          </div>
        </div>

        {/* Pink Switch */}
        <button
          type="button"
          disabled={!isHost}
          onClick={() => onUpdateConfig?.({ humanOnly: !humanOnly } as any)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
            humanOnly ? 'bg-[#ff2b70]' : 'bg-slate-200 dark:bg-zinc-700'
          } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              humanOnly ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {!isHost && (
        <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500 italic pt-1">
          Only the host can change game settings.
        </p>
      )}
    </div>
  );
};
