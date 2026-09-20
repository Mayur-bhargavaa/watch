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
  onRematch,
  onBackToPlan,
  onBackToLobby
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMe = winnerUserId === myUserId;

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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="w-full max-w-md bg-[#0e101a] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
        
        {/* Trophy Icon */}
        <div className="relative flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-rose-500/20 to-transparent border border-amber-500/30 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(238,29,73,0.3)] animate-bounce">
            🏆
          </div>
        </div>

        {/* Title & Banner */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-[#ee1d49] text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isHousefull ? 'HOUSEFULL VICTORY' : conditionWon?.conditionName || 'BINGO CLAIM'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {winnerDisplayName} Wins!
          </h2>
          <p className="text-xs text-zinc-400">
            {isMe ? 'You dominated the board with pure strategy!' : 'Great game! Good sportsmanship all round.'}
          </p>
        </div>

        {/* Final Score Board */}
        {Object.keys(finalScores).length > 0 && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
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
                  <span className="text-xl font-black font-mono mt-0.5 text-white">
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

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onRematch}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-[#ee1d49] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {onBackToPlan && (
              <button
                type="button"
                onClick={onBackToPlan}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                <span>Back to Plan</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBackToLobby}
              className={`py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                !onBackToPlan ? 'col-span-2' : ''
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Game Lobby</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
