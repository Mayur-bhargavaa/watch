'use client';

import React, { useEffect, useRef } from 'react';

interface BingoPartyPoppersProps {
  durationMs?: number;
  isSoundMuted?: boolean;
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
  shape: 'rect' | 'circle' | 'star' | 'heart';
  wobble: number;
  wobbleSpeed: number;
  alpha: number;
}

const COLORS = [
  '#9333ea', // Royal Purple
  '#a855f7', // Purple
  '#ec4899', // Hot Pink
  '#f43f5e', // Coral Rose
  '#fbbf24', // Amber Gold
  '#38bdf8', // Sky Blue
  '#34d399', // Emerald
  '#ffffff', // Sparkle White
];

export const BingoPartyPoppers: React.FC<BingoPartyPoppersProps> = ({
  durationMs = 7000,
  isSoundMuted = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Popper Blasts
  useEffect(() => {
    if (isSoundMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playPop = (delayMs: number, pitch = 1) => {
        setTimeout(() => {
          if (ctx.state === 'suspended') ctx.resume();
          const now = ctx.currentTime;

          // Noise crack
          const bufferSize = ctx.sampleRate * 0.1;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(900 * pitch, now);
          filter.Q.setValueAtTime(3, now);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          noise.start(now);

          // Punchy thud
          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260 * pitch, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.14);
          oscGain.gain.setValueAtTime(0.4, now);
          oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

          osc.connect(oscGain);
          oscGain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.14);
        }, delayMs);
      };

      playPop(0, 1.1);
      playPop(180, 0.95);
      playPop(350, 1.25);
    } catch {
      // Audio autoplay restrictions ignored
    }
  }, [isSoundMuted]);

  // Canvas Confetti Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];

    // Spawns a cannon burst
    const burst = (originX: number, originY: number, angleDeg: number, count: number, spreadDeg = 55) => {
      for (let i = 0; i < count; i++) {
        const rad = ((angleDeg + (Math.random() - 0.5) * spreadDeg) * Math.PI) / 180;
        const speed = Math.random() * 22 + 14;
        const shapes: Particle['shape'][] = ['rect', 'circle', 'star', 'heart'];
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(rad) * speed,
          vy: Math.sin(rad) * speed,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          size: Math.random() * 10 + 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.15 + 0.05,
          alpha: 1
        });
      }
    };

    // Cannon 1: Left bottom angled up-right
    burst(width * 0.1, height * 0.9, -60, 80);
    // Cannon 2: Right bottom angled up-left
    burst(width * 0.9, height * 0.9, -120, 80);
    // Cannon 3: Mid-air top center fireworks burst
    setTimeout(() => {
      burst(width * 0.5, height * 0.35, -90, 90, 180);
    }, 250);
    // Cannon 4: Second wave
    setTimeout(() => {
      burst(width * 0.25, height * 0.8, -55, 60);
      burst(width * 0.75, height * 0.8, -125, 60);
    }, 600);

    let animId: number;
    const startTime = Date.now();

    const drawParticle = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(Math.cos(p.wobble), 1);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const r1 = p.size;
          const r2 = p.size * 0.45;
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          const a2 = a + Math.PI / 5;
          ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'heart') {
        const s = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.2, s * 0.5, 0, s * 1.3);
        ctx.bezierCurveTo(s * 1.2, s * 0.5, s, -s * 0.5, 0, s * 0.3);
        ctx.fill();
      }

      ctx.restore();
    };

    const render = () => {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.42; // Gravity
        p.vx *= 0.985; // Air drag
        p.vy *= 0.985;
        p.rotation += p.vRot;
        p.wobble += p.wobbleSpeed;

        // Fade out near end of lifespan
        if (elapsed > durationMs - 1500) {
          p.alpha -= 0.02;
        }

        if (p.alpha > 0 && p.y < height + 40) {
          drawParticle(p);
        } else {
          particles.splice(i, 1);
        }
      }

      if (particles.length > 0 && elapsed < durationMs) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
};
