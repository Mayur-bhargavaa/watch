'use client';

import React from 'react';
import { Check, Star, Crown } from 'lucide-react';
import { BingoTicket as BingoTicketType, BingoMode } from '@synccinema/common';

interface BingoTicketProps {
  ticket: BingoTicketType;
  mode: BingoMode;
  playerName: string;
  avatarUrl?: string | null;
  score?: number;
  isHost?: boolean;
  isMe?: boolean;
  calledNumbers: number[];
  markedNumbers: number[];
  onToggleMark?: (num: number) => void;
  accentColor?: 'rose' | 'violet';
}

const BINGO_HEADERS = ['B', 'I', 'N', 'G', 'O'];

export const BingoTicket: React.FC<BingoTicketProps> = ({
  ticket,
  mode,
  playerName,
  avatarUrl,
  score = 0,
  isHost = false,
  isMe = false,
  calledNumbers,
  markedNumbers,
  onToggleMark,
  accentColor = 'rose'
}) => {
  const calledSet = new Set(calledNumbers);
  const markedSet = new Set(markedNumbers);

  const is75 = mode === '75-ball' || ticket.cells.length === 5;

  return (
    <div className="w-full flex flex-col rounded-3xl bg-[#0e101a]/90 border border-white/10 shadow-2xl overflow-hidden p-3.5 sm:p-5 transition-all">
      {/* Ticket Header: Player details & Score */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center text-sm font-black text-white">
              {avatarUrl ? (
                <img src={avatarUrl} alt={playerName} className="w-full h-full object-cover" />
              ) : (
                playerName.slice(0, 2).toUpperCase()
              )}
            </div>
            {isHost && (
              <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-500 text-black shadow-sm">
                <Crown className="w-2.5 h-2.5" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white truncate max-w-[140px] sm:max-w-[180px]">
                {playerName}
              </span>
              {isMe && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-[#ee1d49] text-[9px] font-black uppercase tracking-wider">
                  YOU
                </span>
              )}
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              {is75 ? '75-Ball 5×5 Card' : '90-Ball Tambola Ticket'}
            </span>
          </div>
        </div>

        {/* Score Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Score</span>
          <span className="text-base sm:text-lg font-black text-white font-mono">
            {score} <span className="text-xs text-rose-400 font-sans">pts</span>
          </span>
        </div>
      </div>

      {/* 75-Ball B-I-N-G-O Headers */}
      {is75 && (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-2">
          {BINGO_HEADERS.map((letter, idx) => (
            <div
              key={letter}
              className={`py-1.5 rounded-xl font-black text-xs sm:text-sm text-center tracking-widest ${
                idx === 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : idx === 1
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : idx === 2
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : idx === 3
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
              }`}
            >
              {letter}
            </div>
          ))}
        </div>
      )}

      {/* Ticket Grid */}
      <div className="flex-1 flex flex-col justify-center">
        {is75 ? (
          /* 5x5 Grid for 75-Ball */
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {ticket.cells.map((row, rIdx) =>
              row.map((num, cIdx) => {
                const isCenter = rIdx === 2 && cIdx === 2;
                if (isCenter) {
                  return (
                    <div
                      key={`center-${rIdx}-${cIdx}`}
                      className="aspect-square rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-400/30 flex flex-col items-center justify-center text-amber-300 p-1"
                    >
                      <Star className="w-4 h-4 fill-amber-300" />
                      <span className="text-[8px] sm:text-[9px] font-black tracking-widest mt-0.5">FREE</span>
                    </div>
                  );
                }

                const isCalled = num !== null && calledSet.has(num);
                const isMarked = num !== null && (markedSet.has(num) || (isCalled && isMe));

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    type="button"
                    disabled={!isMe || num === null}
                    onClick={() => num !== null && onToggleMark?.(num)}
                    className={`aspect-square rounded-2xl border flex items-center justify-center font-mono text-xs sm:text-base font-black transition-all duration-150 relative select-none cursor-pointer ${
                      isMarked
                        ? accentColor === 'rose'
                          ? 'bg-[#ee1d49] border-[#ee1d49] text-white shadow-[0_0_15px_rgba(238,29,73,0.5)] scale-95'
                          : 'bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)] scale-95'
                        : isCalled
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 animate-pulse'
                        : 'bg-white/[0.03] border-white/[0.08] text-zinc-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    {num}
                    {isMarked && (
                      <div className="absolute top-1 right-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* 3x9 Grid for 90-Ball Tambola */
          <div className="space-y-1.5 sm:space-y-2">
            {ticket.cells.map((row, rIdx) => (
              <div key={`row-${rIdx}`} className="grid grid-cols-9 gap-1 sm:gap-1.5">
                {row.map((num, cIdx) => {
                  if (num === null) {
                    return (
                      <div
                        key={`blank-${rIdx}-${cIdx}`}
                        className="aspect-square rounded-xl bg-white/[0.015] border border-white/[0.03] flex items-center justify-center opacity-40"
                      >
                        <span className="text-[9px] text-zinc-700">·</span>
                      </div>
                    );
                  }

                  const isCalled = calledSet.has(num);
                  const isMarked = markedSet.has(num) || (isCalled && isMe);

                  return (
                    <button
                      key={`cell-${rIdx}-${cIdx}`}
                      type="button"
                      disabled={!isMe}
                      onClick={() => onToggleMark?.(num)}
                      className={`aspect-square rounded-xl sm:rounded-2xl border flex items-center justify-center font-mono text-[11px] sm:text-sm md:text-base font-black transition-all duration-150 relative select-none cursor-pointer ${
                        isMarked
                          ? accentColor === 'rose'
                            ? 'bg-[#ee1d49] border-[#ee1d49] text-white shadow-[0_0_12px_rgba(238,29,73,0.5)] scale-95'
                            : 'bg-violet-600 border-violet-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)] scale-95'
                          : isCalled
                          ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 animate-pulse'
                          : 'bg-white/[0.04] border-white/[0.08] text-zinc-100 hover:bg-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      {num}
                      {isMarked && (
                        <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1">
                          <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Footer Legend */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.06] text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ee1d49]" />
          <span>Marked ({ticket.cells.flat().filter(n => n !== null && (markedSet.has(n) || (calledSet.has(n) && isMe))).length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500/50 animate-pulse" />
          <span>Called ({ticket.cells.flat().filter(n => n !== null && calledSet.has(n)).length})</span>
        </div>
      </div>
    </div>
  );
};
