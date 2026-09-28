'use client';

import React, { useEffect, useRef } from 'react';
import { Trophy, Sparkles, RotateCcw, Calendar, Gamepad2, ArrowLeft } from 'lucide-react';
import { BingoWinCondition } from '@synccinema/common';

interface BingoVictoryProps {
  conditionWon?: {
    condition: BingoWinCondition;
    conditionName: string;
    userId: string;
    displayName: string;
    points: number;
  } | null;
  isHousefull?: boolean;
  winnerDisplayName: string;
  winnerUserId: string;
  myUserId: string;
  finalScores?: Record<string, number>;
  roundsWon?: { condition: BingoWinCondition; winnerName: string; points: number }[];
  rematchStatus?: {
    votedUserIds: string[];
    votedCount: number;
    totalNeeded: number;
    allVoted: boolean;
  } | null;
  onRematch: () => void;
  onBackToPlan?: () => void;
  onBackToLobby: () => void;
}

export const BingoVictory: React.FC<BingoVictoryProps> = ({
  conditionWon,
  isHousefull = false,
  winnerDisplayName,
  winnerUserId,
  myUserId,
  finalScores = {},
  roundsWon = [],
  rematchStatus,
  onRematch,
  onBackToPlan,
  onBackToLobby
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMe = winnerUserId === myUserId;
  const hasVoted = Boolean(rematchStatus?.votedUserIds?.includes(myUserId));
  const partnerVoted = !hasVoted && (rematchStatus?.votedCount ?? 0) > 0;

  // Subtle Confetti Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ee1d49', '#6355ff', '#ffd166', '#06d6a0', '#ffffff'];
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 2 + 1.5,
      speedX: Math.random() * 2 - 1,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 4 - 2
    }));

    let animationFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md bg-[#0e101a] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-3.5 sm:space-y-5 shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
        
        {/* Trophy Icon */}
        <div className="relative flex justify-center">
          <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-amber-500/20 via-rose-500/20 to-transparent border border-amber-500/30 flex items-center justify-center text-2xl sm:text-3xl shadow-[0_0_24px_rgba(238,29,73,0.3)] animate-pulse">
            🏆
          </div>
        </div>

        {/* Title & Banner */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-[#ee1d49] text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>{isHousefull ? 'HOUSEFULL VICTORY' : conditionWon?.conditionName || 'BINGO CLAIM'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {winnerDisplayName} Wins!
          </h2>
          <p className="text-xs text-zinc-400">
            {isMe ? 'You dominated the board with pure strategy!' : 'Great game! Good sportsmanship all round.'}
          </p>
        </div>

        {/* Final Score Board */}
        {Object.keys(finalScores).length > 0 && (
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              FINAL SCORE
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(finalScores).map(([uid, score], idx) => (
                <div
                  key={uid}
                  className={`p-2.5 rounded-xl border flex flex-col items-center ${
                    idx === 0
                      ? 'bg-rose-500/10 border-rose-500/30 text-white'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400'
                  }`}
                >
                  <span className="text-xs font-bold truncate max-w-[120px]">
                    {uid === myUserId ? 'You' : winnerDisplayName}
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono mt-0.5 text-white">
                    {score} <span className="text-[10px] text-rose-400 font-sans">pts</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Round Breakdown */}
        {roundsWon.length > 0 && (
          <div className="p-3 rounded-2xl bg-white/[0.015] border border-white/[0.05] text-left max-h-36 overflow-y-auto space-y-1.5">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
              Rounds Claimed:
            </div>
            {roundsWon.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-1 rounded-lg bg-black/40 text-xs text-zinc-300"
              >
                <span className="font-bold">{r.condition}</span>
                <span className="text-rose-400 font-mono">
                  {r.winnerName} (+{r.points})
                </span>
              </div>
            ))}
          </div>
        )}

        {partnerVoted && (
          <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-center space-y-1 animate-pulse">
            <div className="flex items-center justify-center gap-1.5 text-rose-300 font-black text-xs">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>🔥 Opponent wants to play again!</span>
            </div>
            <p className="text-[11px] text-zinc-300">
              Click Play Again to accept and return to waiting room!
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1 sm:pt-2">
          <button
            type="button"
            onClick={onRematch}
            className={`w-full py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-white font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              hasVoted
                ? 'bg-zinc-700 opacity-70 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 to-[#ee1d49] hover:brightness-110 shadow-rose-600/30 active:scale-[0.98]'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${hasVoted ? 'animate-spin' : ''}`} />
            <span>
              {hasVoted
                ? 'Returning to Waiting Room...'
                : partnerVoted
                ? 'Accept & Play Again 🔄'
                : 'Play Again'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {onBackToPlan && (
              <button
                type="button"
                onClick={onBackToPlan}
                className="py-2.5 px-2 sm:px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span>Back to Plan</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBackToLobby}
              className={`py-2.5 px-2 sm:px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer ${
                !onBackToPlan ? 'col-span-2' : ''
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Game Lobby</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
