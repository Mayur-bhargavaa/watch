'use client';

import React from 'react';
import { Trophy, RotateCcw, Home, Sparkles, Flame, CheckCircle, ArrowRight } from 'lucide-react';
import { BingoDuelRoundSummary } from '@synccinema/common';

interface BingoDuelWinModalProps {
  isMatchOver: boolean;
  isRoundOver: boolean;
  winnerDisplayName: string;
  isWinnerMe: boolean;
  currentRound: number;
  targetRounds: number;
  myWins: number;
  opponentWins: number;
  roundHistory: BingoDuelRoundSummary[];
  isHost: boolean;
  onNextRound?: () => void;
  onRematch?: () => void;
  onLeave: () => void;
  rematchStatus?: {
    requesterId?: string;
    requesterName?: string;
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null;
}

export const BingoDuelWinModal: React.FC<BingoDuelWinModalProps> = ({
  isMatchOver,
  isRoundOver,
  winnerDisplayName,
  isWinnerMe,
  currentRound,
  targetRounds,
  myWins,
  opponentWins,
  roundHistory,
  isHost,
  onNextRound,
  onRematch,
  onLeave,
  rematchStatus
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Trophy Icon with animated burst */}
        <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 to-pink-500 blur-xl opacity-60 animate-pulse" />
          <div className="relative w-full h-full rounded-full bg-slate-900 border-2 border-amber-400/80 flex items-center justify-center shadow-inner">
            <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 fill-amber-400 drop-shadow-md" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
          {isWinnerMe ? '🎉 VICTORY!' : 'DEFEAT'}
        </h2>
        <p className="text-sm text-slate-300 mb-5">
          <span className="font-bold text-amber-300">{winnerDisplayName}</span>{' '}
          {isMatchOver ? 'won the Bingo Duel match!' : `won Round ${currentRound}!`}
        </p>

        {/* Series Scoreboard (if best of 3 or 5) */}
        {targetRounds > 1 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-5 flex items-center justify-around">
            <div>
              <div className="text-[10px] uppercase font-bold text-indigo-300">You</div>
              <div className="text-2xl font-black text-white">{myWins}</div>
            </div>
            <div className="text-xs font-mono font-bold text-slate-500 uppercase">Series Score</div>
            <div>
              <div className="text-[10px] uppercase font-bold text-pink-300">Opponent</div>
              <div className="text-2xl font-black text-white">{opponentWins}</div>
            </div>
          </div>
        )}

        {/* Round History Preview */}
        {roundHistory && roundHistory.length > 0 && (
          <div className="bg-black/30 border border-white/5 rounded-2xl p-3 mb-6 text-left max-h-32 overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Round Summary</div>
            <div className="space-y-1.5 text-xs">
              {roundHistory.map((rh, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-300">
                  <span>
                    R{rh.round}: <span className="text-white font-semibold">{rh.winnerDisplayName}</span> ({rh.patternName})
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">{rh.numbersCalledCount} balls</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {/* Next Round Button if series is ongoing */}
          {isRoundOver && !isMatchOver && isHost && onNextRound && (
            <button
              type="button"
              onClick={onNextRound}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <span>START ROUND {currentRound + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {isRoundOver && !isMatchOver && !isHost && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 font-medium">
              Waiting for host to launch next round...
            </div>
          )}

          {/* Rematch CTA if match is finished */}
          {isMatchOver && onRematch && (
            <button
              type="button"
              onClick={onRematch}
              disabled={Boolean(rematchStatus && !rematchStatus.allVoted)}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{rematchStatus ? 'Rematch Requested (1/2)...' : 'Request Rematch'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="w-full py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-semibold text-xs border border-white/10 flex items-center justify-center gap-2 transition"
          >
            <Home className="w-4 h-4" />
            <span>Leave Duel Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
