'use client';

import React, { useEffect } from 'react';
import { Trophy, Award, RotateCcw, ArrowLeft, Sparkles, Check, Flame } from 'lucide-react';
import Link from 'next/link';
import { DoodleGameState, DoodleRoundSummary } from '@synccinema/common';

interface DoodleVictoryProps {
  gameState: DoodleGameState;
  myUserId: string;
  onRematch: () => void;
  rematchStatus?: {
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null;
  player1: { userId: string; displayName: string; avatarUrl?: string | null };
  player2: { userId: string; displayName: string; avatarUrl?: string | null };
}

export const DoodleVictory: React.FC<DoodleVictoryProps> = ({
  gameState,
  myUserId,
  onRematch,
  rematchStatus,
  player1,
  player2
}) => {
  const p1Score = gameState.scores[player1.userId] || 0;
  const p2Score = gameState.scores[player2.userId] || 0;

  const isTie = p1Score === p2Score;
  const winnerUserId = isTie ? null : p1Score > p2Score ? player1.userId : player2.userId;
  const winner = isTie ? null : winnerUserId === player1.userId ? player1 : player2;
  const isMeWinner = winnerUserId === myUserId;

  const hasVotedRematch = Boolean(rematchStatus?.votedUserIds.includes(myUserId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl overflow-y-auto select-none animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#0e1222] border border-white/15 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center my-auto">
        {/* Ambient Winner Auras */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-b from-rose-500/20 via-pink-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Trophy / Result Icon */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center justify-center text-white">
            <Trophy className="w-10 h-10" />
          </div>
        </div>

        {/* Victory Headline */}
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">
          {isTie ? "It's a Draw!" : isMeWinner ? 'Victory! 🏆' : `${winner?.displayName} Wins!`}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {isTie
            ? 'Incredible duel! Both players finished with equal points.'
            : isMeWinner
            ? 'Outstanding doodling and guessing skills!'
            : 'Well played! Rematch to reclaim the title.'}
        </p>

        {/* Final Scoreboard Duel Cards */}
        <div className="w-full grid grid-cols-2 gap-4 mb-6">
          {/* Player 1 Card */}
          <div
            className={`p-4 rounded-2xl border flex flex-col items-center transition-all ${
              winnerUserId === player1.userId
                ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <span className="text-xs font-bold text-zinc-400 truncate max-w-[130px]">
              {player1.displayName}
            </span>
            {winnerUserId === player1.userId && (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 mt-0.5">
                Winner 👑
              </span>
            )}
            <span className="text-3xl font-black text-white mt-2">{p1Score}</span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Points</span>
          </div>

          {/* Player 2 Card */}
          <div
            className={`p-4 rounded-2xl border flex flex-col items-center transition-all ${
              winnerUserId === player2.userId
                ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <span className="text-xs font-bold text-zinc-400 truncate max-w-[130px]">
              {player2.displayName}
            </span>
            {winnerUserId === player2.userId && (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 mt-0.5">
                Winner 👑
              </span>
            )}
            <span className="text-3xl font-black text-white mt-2">{p2Score}</span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Points</span>
          </div>
        </div>

        {/* Round History Accordion / List */}
        {gameState.roundHistory && gameState.roundHistory.length > 0 && (
          <div className="w-full mb-6">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2.5 text-left">
              Round Recap
            </h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {gameState.roundHistory.map(r => (
                <div
                  key={r.roundNumber}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-500">R{r.roundNumber}</span>
                    <span className="font-bold text-white uppercase">{r.secretWord}</span>
                    <span className="text-[10px] text-zinc-400">({r.drawerDisplayName})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.guessed ? (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {r.timeTakenSeconds ?? r.timeTaken}s
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500">Missed</span>
                    )}
                    <span className="font-mono font-bold text-zinc-300">
                      +{((r.guesserPoints ?? r.pointsEarned ?? 0) + (r.drawerPoints ?? 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rematch & Navigation Actions */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onRematch}
            disabled={hasVotedRematch}
            className={`flex-1 w-full py-3.5 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              hasVotedRematch
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-default'
                : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-[0_0_25px_rgba(244,63,94,0.4)] active:scale-[0.98]'
            }`}
          >
            <RotateCcw className={`w-4 h-4 ${hasVotedRematch ? 'animate-spin' : ''}`} />
            <span>{hasVotedRematch ? 'Waiting for opponent...' : 'Vote Rematch 🔄'}</span>
          </button>

          <Link
            href="/games"
            className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Games Lobby</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
