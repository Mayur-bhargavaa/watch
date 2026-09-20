'use client';

import React, { useEffect, useRef } from 'react';
import { Sparkles, Trophy, X, Zap } from 'lucide-react';
import { LudoColor } from '@synccinema/common';

interface HomeCelebrationModalProps {
  color: LudoColor;
  isMe: boolean;
  playerName: string;
  finishedCount?: number;
  onClose: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'star' | 'emoji';
  emoji?: string;
  wobble: number;
  wobbleSpeed: number;
  alpha: number;
}

export const HomeCelebrationModal: React.FC<HomeCelebrationModalProps> = ({
  color,
  isMe,
  playerName,
  finishedCount = 1,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Play explosive party popper blasts + fanfare using Web Audio API
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playPopperBlast = (delayMs: number, pitchMultiplier = 1) => {
        setTimeout(() => {
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
          const now = ctx.currentTime;

          // 1. Noise blast (the "pop / crack" of compressed air)
          const bufferSize = ctx.sampleRate * 0.12;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(800 * pitchMultiplier, now);
          filter.Q.setValueAtTime(3, now);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.4, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noise.start(now);

          // 2. Punchy low-end thud (the "boom")
          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(240 * pitchMultiplier, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
          oscGain.gain.setValueAtTime(0.5, now);
          oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

          osc.connect(oscGain);
          oscGain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.18);
        }, delayMs);
      };

      if (isMe) {
        // Cannon 1 (Left)
        playPopperBlast(0, 1.1);
        // Cannon 2 (Right)
        playPopperBlast(140, 0.95);
        // Center Burst
        playPopperBlast(260, 1.25);

        // Fanfare chord sequence
        setTimeout(() => {
          const now = ctx.currentTime;
          const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = 'triangle';
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);

            noteGain.gain.setValueAtTime(0, now + idx * 0.08);
            noteGain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.7);

            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.08);
            noteOsc.stop(now + idx * 0.08 + 0.7);
          });
        }, 180);
      } else {
        // Playful dramatic alert sound for opponent
        playPopperBlast(50, 0.8);
      }
    } catch {
      // Audio not supported or blocked by policy
    }
  }, [isMe]);

  // Full Screen Confetti & Party Poppers Canvas Particle Blast
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle Palette
    const colors = [
      '#f59e0b', '#fbbf24', '#ef4444', '#f43f5e',
      '#10b981', '#06b6d4', '#8b5cf6', '#ec4899',
      '#ffffff', '#3b82f6'
    ];
    const emojis = ['🎉', '🎊', '✨', '⭐', '💫', '🚀', '💥', '🏆', '🔥'];

    const particles: Particle[] = [];
    const count = isMe ? 180 : 80;

    // Helper to spawn a particle from a specific origin
    const spawnParticle = (originX: number, originY: number, angleDegMin: number, angleDegMax: number, speedMin: number, speedMax: number) => {
      const angle = ((Math.random() * (angleDegMax - angleDegMin) + angleDegMin) * Math.PI) / 180;
      const speed = Math.random() * (speedMax - speedMin) + speedMin;
      const isEmoji = Math.random() < 0.16;
      const shapeRoll = Math.random();

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        size: isEmoji ? 22 + Math.random() * 12 : 7 + Math.random() * 9,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: isEmoji ? 'emoji' : shapeRoll < 0.65 ? 'rect' : shapeRoll < 0.85 ? 'circle' : 'star',
        emoji: isEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
        wobble: Math.random() * 10,
        wobbleSpeed: 0.08 + Math.random() * 0.08,
        alpha: 1,
      });
    };

    // Cannon 1: Bottom-Left blasting up towards top-right
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
      spawnParticle(width * 0.08, height * 0.96, -78, -35, 18, 38);
    }
    // Cannon 2: Bottom-Right blasting up towards top-left
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
      spawnParticle(width * 0.92, height * 0.96, -145, -102, 18, 38);
    }
    // Center Burst from modal position outwards
    for (let i = 0; i < Math.floor(count * 0.2); i++) {
      spawnParticle(width * 0.5, height * 0.45, -180, 180, 10, 24);
    }

    const drawStar = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, fill: string) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    const startTime = performance.now();
    const duration = 3800; // 3.8 seconds

    const render = (time: number) => {
      const elapsed = time - startTime;
      ctx.clearRect(0, 0, width, height);

      const fadeProgress = elapsed > 2400 ? (elapsed - 2400) / 1400 : 0;
      const globalAlpha = Math.max(0, 1 - fadeProgress);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.42; // Gravity
        p.rotation += p.vRot;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 1.2;

        const currentAlpha = p.alpha * globalAlpha;
        if (currentAlpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'emoji' && p.emoji) {
          ctx.font = `${p.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
        } else if (p.shape === 'rect') {
          // 3D ribbon twist effect via cos(wobble)
          const scaleX = Math.cos(p.wobble);
          ctx.scale(scaleX, 1);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.shape === 'star') {
          drawStar(0, 0, 5, p.size * 0.8, p.size * 0.35, p.color);
        }

        ctx.restore();
      }

      if (elapsed < duration) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMe]);

  const colorMeta = {
    red: { bg: 'from-rose-600 via-pink-600 to-red-600', ring: 'ring-rose-500/80', shadow: 'shadow-rose-500/50', label: 'RED' },
    green: { bg: 'from-emerald-600 via-teal-600 to-green-600', ring: 'ring-emerald-500/80', shadow: 'shadow-emerald-500/50', label: 'GREEN' },
    yellow: { bg: 'from-amber-500 via-yellow-500 to-amber-600', ring: 'ring-amber-500/80', shadow: 'shadow-amber-500/50', label: 'YELLOW' },
    blue: { bg: 'from-blue-600 via-cyan-600 to-indigo-600', ring: 'ring-blue-500/80', shadow: 'shadow-blue-500/50', label: 'BLUE' }
  }[color] || { bg: 'from-amber-500 to-yellow-600', ring: 'ring-yellow-500', shadow: 'shadow-yellow-500', label: 'PLAYER' };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 select-none cursor-pointer"
    >
      {/* Full-screen Party Poppers Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[130] w-full h-full"
      />

      {/* Floating 3D Celebration Modal Card */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative z-[140] w-full max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-8 bg-[#140a18]/95 border-2 border-amber-400/60 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_80px_rgba(245,158,11,0.45)] backdrop-blur-2xl text-center text-white overflow-hidden transform animate-in zoom-in-75 duration-300"
      >
        {/* Rotating Sunburst / Light Beams behind modal */}
        <div
          className="absolute -inset-[100%] pointer-events-none opacity-25 animate-spin"
          style={{
            animationDuration: '16s',
            background: 'conic-gradient(from 0deg at 50% 50%, rgba(245,158,11,0.8) 0deg, transparent 20deg, rgba(245,158,11,0.8) 40deg, transparent 60deg, rgba(245,158,11,0.8) 80deg, transparent 100deg, rgba(245,158,11,0.8) 120deg, transparent 140deg, rgba(245,158,11,0.8) 160deg, transparent 180deg, rgba(245,158,11,0.8) 200deg, transparent 220deg, rgba(245,158,11,0.8) 240deg, transparent 260deg, rgba(245,158,11,0.8) 280deg, transparent 300deg, rgba(245,158,11,0.8) 320deg, transparent 340deg, rgba(245,158,11,0.8) 360deg)'
          }}
        />

        {/* Shockwave expanding burst ring */}
        <div className="absolute inset-0 rounded-3xl border-4 border-amber-400/40 pointer-events-none animate-ping opacity-30" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition z-20 cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {isMe ? (
          /* ========================================================
             PLAYER WHO REACHED HOME: GRAND VICTORY CELEBRATION
             ======================================================== */
          <div className="relative z-10 flex flex-col items-center">
            {/* 3D Floating Mascot + Trophy Badge */}
            <div className="relative mb-3 flex items-center justify-center">
              {/* Outer Golden Glow */}
              <div className="absolute w-24 h-24 rounded-full bg-amber-400/30 blur-xl animate-pulse" />

              {/* Center Podium */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/50 border-2 border-yellow-200 transform animate-bounce">
                <Trophy className="w-10 h-10 text-white drop-shadow-md" />
              </div>

              {/* Bouncing Astronaut Pawn Tag */}
              <div
                className={`absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-lg bg-gradient-to-r ${colorMeta.bg} ring-2 ring-white/60`}
              >
                Goti #{finishedCount}
              </div>

              {/* Corner Poppers */}
              <span className="absolute -top-3 -left-3 text-2xl animate-spin" style={{ animationDuration: '4s' }}>✨</span>
              <span className="absolute -top-2 -right-3 text-2xl animate-bounce">🎉</span>
              <span className="absolute -bottom-1 -left-3 text-2xl animate-pulse">🚀</span>
            </div>

            {/* Glowing Big Title */}
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 drop-shadow-[0_2px_12px_rgba(245,158,11,0.8)]">
                GOTI REACHED HOME!
              </h2>
              <p className="text-xs sm:text-sm font-bold text-amber-200/90">
                Pawn safely secured in Home Sanctuary 🏠✨
              </p>
            </div>

            {/* Bonus Roll Feature Pill */}
            <div className="mt-4 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border border-amber-400/50 shadow-inner flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-300 animate-pulse fill-amber-300" />
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-wide">
                  💥 +1 BONUS ROLL AWARDED!
                </p>
                <p className="text-[10px] text-amber-200/80">
                  Take your extra turn immediately!
                </p>
              </div>
            </div>

            {/* Progress: e.g. 1/4 or 4/4 Tokens Completed */}
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <span>Home Progress:</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-amber-300 font-bold font-mono">
                {finishedCount} / 4 Tokens
              </span>
            </div>

            {/* Interactive Action Button */}
            <button
              onClick={onClose}
              type="button"
              className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Let&apos;s Roll Again! 🎲</span>
            </button>
          </div>
        ) : (
          /* ========================================================
             OPPONENT REACHED HOME: PLAYFUL COMIC ALERT
             ======================================================== */
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600 flex items-center justify-center shadow-xl shadow-rose-600/40 border-2 border-rose-300/40 animate-pulse">
                <span className="text-3xl">🥲</span>
              </div>
              <span className="absolute -top-2 -right-2 text-2xl">👀</span>
              <span className="absolute -bottom-1 -left-2 text-2xl">🚨</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-rose-300 tracking-tight">
              OUCH! {playerName.toUpperCase()} SCORED!
            </h2>
            <p className="text-xs sm:text-sm font-medium text-zinc-300 mt-1">
              Their goti made it safely home ({finishedCount}/4) and they won a bonus roll!
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-200 font-medium">
              🛡️ Stay sharp! Cut their next pawn before they reach the safe lane!
            </div>

            <button
              onClick={onClose}
              type="button"
              className="mt-5 w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition cursor-pointer"
            >
              Game On! ⚔️
            </button>
          </div>
        )}

        {/* Draining Time Indicator Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500"
            style={{
              animation: 'homeProgress 3.8s linear forwards'
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes homeProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
