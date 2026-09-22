'use client';

import React from 'react';
import { Trophy, RotateCcw, Home, Sparkles, Heart, ArrowRight } from 'lucide-react';
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
  onStartNewMatch?: () => void;
  onLeave: () => void;
  isOpponentLeft?: boolean;
  opponentDisplayName?: string;
  rematchStatus?: {
    requesterId?: string;
    requesterName?: string;
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null;
  effectiveUserId?: string;
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
  onStartNewMatch,
  onLeave,
  isOpponentLeft,
  opponentDisplayName,
  rematchStatus,
  effectiveUserId
}) => {
  const hasVoted = Boolean(
    effectiveUserId && rematchStatus?.votedUserIds?.includes(effectiveUserId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-white/95 border border-purple-200/90 rounded-[28px] sm:rounded-3xl p-6 sm:p-8 text-center shadow-[0_20px_60px_rgba(124,58,237,0.22)] relative overflow-hidden backdrop-blur-2xl animate-in zoom-in-95 duration-300">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Center Icon: Trophy if Winner, Heart/Sparkles if Defeat */}
        <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-4 flex items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full blur-xl opacity-60 animate-pulse ${
              isOpponentLeft || isWinnerMe
                ? 'bg-gradient-to-tr from-amber-400 to-pink-500'
                : 'bg-gradient-to-tr from-purple-400 to-rose-400'
            }`}
          />
          <div
            className={`relative w-full h-full rounded-full border-2 flex items-center justify-center shadow-inner ${
              isOpponentLeft || isWinnerMe
                ? 'bg-amber-50/80 border-amber-300 shadow-amber-200/50'
                : 'bg-purple-50/80 border-purple-200 shadow-purple-200/50'
            }`}
          >
            {isOpponentLeft || isWinnerMe ? (
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 fill-amber-400 drop-shadow-md" />
            ) : (
              <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-rose-500 fill-rose-400 drop-shadow-md" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">
          {isOpponentLeft ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500">
              🚪 OPPONENT LEFT
            </span>
          ) : isWinnerMe ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500">
              🎉 VICTORY!
            </span>
          ) : (
            <span className="text-slate-800">
              WELL PLAYED!
            </span>
          )}
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-slate-600 mb-5">
          {isOpponentLeft ? (
            <>
              <span className="font-bold text-purple-700">{opponentDisplayName || 'Opponent'}</span> left the match. You won by default!
            </>
          ) : (
            <>
              <span className="font-bold text-purple-700">{winnerDisplayName}</span>{' '}
              {isMatchOver ? 'won the Bingo Duel match!' : `won Round ${currentRound}!`}
            </>
          )}
        </p>

        {/* Opponent Left Banner Card */}
        {isOpponentLeft && (
          <div className="bg-purple-50/90 border border-purple-200/90 rounded-2xl p-4 mb-5 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-lg text-purple-700 shrink-0 font-bold shadow-xs">
              🚪
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">
                Opponent left the room
              </div>
              <div className="text-xs text-purple-700 font-medium">
                Start a new match to continue playing with another opponent!
              </div>
            </div>
          </div>
        )}

        {/* Series Scoreboard (if best of 3 or 5 and not opponent left) */}
        {!isOpponentLeft && targetRounds > 1 && (
          <div className="bg-purple-50/70 border border-purple-100/90 rounded-2xl p-3 mb-5 flex items-center justify-around shadow-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-purple-700">You</div>
              <div className="text-2xl font-black text-slate-900">{myWins}</div>
            </div>
            <div className="text-xs font-mono font-bold text-purple-400 uppercase">Series Score</div>
            <div>
              <div className="text-[10px] uppercase font-bold text-rose-600">Opponent</div>
              <div className="text-2xl font-black text-slate-900">{opponentWins}</div>
            </div>
          </div>
        )}

        {/* Round History Preview */}
        {!isOpponentLeft && roundHistory && roundHistory.length > 0 && (
          <div className="bg-slate-50/80 border border-purple-100 rounded-2xl p-3 mb-6 text-left max-h-32 overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Round Summary</div>
            <div className="space-y-1.5 text-xs">
              {roundHistory.map((rh, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-700">
                  <span>
                    R{rh.round}: <span className="font-bold text-purple-950">{rh.winnerDisplayName}</span> ({rh.patternName})
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">{rh.numbersCalledCount} balls</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions with Royal Purple Buttons */}
        <div className="space-y-2.5">
          {isOpponentLeft ? (
            <>
              {/* Primary Start New Match CTA */}
              <button
                type="button"
                onClick={onStartNewMatch || onLeave}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start New Match</span>
              </button>

              {/* Back to Lobby */}
              <button
                type="button"
                onClick={onLeave}
                className="w-full py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
              >
                <Home className="w-4 h-4 text-purple-600" />
                <span>Back to Lobby</span>
              </button>
            </>
          ) : (
            <>
              {/* Next Round Button if series is ongoing */}
              {isRoundOver && !isMatchOver && isHost && onNextRound && (
                <button
                  type="button"
                  onClick={onNextRound}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                >
                  <span>START ROUND {currentRound + 1}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {isRoundOver && !isMatchOver && !isHost && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-700 font-medium">
                  Waiting for host to launch next round...
                </div>
              )}

              {/* Rematch CTA if match is finished */}
              {isMatchOver && onRematch && (
                <button
                  type="button"
                  onClick={onRematch}
                  disabled={hasVoted}
                  className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-98 transition ${
                    hasVoted
                      ? 'bg-purple-100 border border-purple-200 text-purple-600 cursor-not-allowed opacity-85'
                      : rematchStatus
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30 animate-pulse cursor-pointer'
                        : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/25 cursor-pointer'
                  }`}
                >
                  <RotateCcw className={`w-4 h-4 ${hasVoted ? 'animate-spin' : ''}`} />
                  <span>
                    {hasVoted
                      ? 'Rematch Requested — Waiting for Opponent (1/2)...'
                      : rematchStatus
                        ? '⚡ Accept Rematch Request (1/2)!'
                        : 'Request Rematch'}
                  </span>
                </button>
              )}

              {/* Leave Duel Room */}
              <button
                type="button"
                onClick={onLeave}
                className="w-full py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
              >
                <Home className="w-4 h-4 text-purple-600" />
                <span>Leave Duel Room</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
