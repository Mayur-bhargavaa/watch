'use client';

import React, { useEffect, useRef } from 'react';

interface CandleConfig {
  id: string;
  left: string; // e.g. '97.5%'
  top: string;  // e.g. '78%'
  scale?: number;
  glowRadius?: number; // px
  intensity?: number;
}

interface FairyLightConfig {
  left: string;
  top: string;
  color?: string;
  delay?: number;
}

interface ThemeVisualConfig {
  candles: CandleConfig[];
  steamMugs?: { left: string; top: string; scale?: number }[];
  fairyLights?: FairyLightConfig[];
  ambientColor?: string; // warm amber or romantic purple
  showFloatingEmbers?: boolean;
  emberColor?: string;
}

// Coordinate mapping for each theme image
const THEME_EFFECTS: Record<string, ThemeVisualConfig> = {
  cozy: {
    ambientColor: 'rgba(251, 191, 36, 0.12)',
    candles: [
      { id: 'cozy-table-candle', left: '69.8%', top: '58.2%', scale: 0.95, glowRadius: 90, intensity: 0.95 },
      { id: 'cozy-lamp-glow', left: '41.2%', top: '21.5%', scale: 1.25, glowRadius: 125, intensity: 0.85 }
    ],
    steamMugs: [
      { left: '51.5%', top: '56.5%', scale: 0.85 }
    ],
    fairyLights: [
      { left: '38.5%', top: '15.5%', color: '#fef08a', delay: 0.4 },
      { left: '45.0%', top: '18.2%', color: '#fed7aa', delay: 1.0 },
      { left: '58.0%', top: '14.5%', color: '#fef08a', delay: 0.7 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(251, 191, 36, 0.55)'
  },
  theam1: {
    ambientColor: 'rgba(251, 191, 36, 0.12)',
    candles: [
      { id: 't1-lamp', left: '13.8%', top: '69%', scale: 1.2, glowRadius: 110, intensity: 0.9 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(251, 191, 36, 0.6)'
  },
  theam2: {
    ambientColor: 'rgba(244, 63, 94, 0.15)',
    candles: [
      // Bottom-right table candles next to mug
      { id: 't2-table-tall', left: '98.2%', top: '79.5%', scale: 1.0, glowRadius: 90, intensity: 1.0 },
      { id: 't2-table-mid', left: '96.5%', top: '85.5%', scale: 0.85, glowRadius: 75, intensity: 0.9 },
      // Candle next to photo frame on shelf
      { id: 't2-shelf-candle', left: '10.5%', top: '48.5%', scale: 0.9, glowRadius: 85, intensity: 0.95 },
      // Candle behind the "Better Together" pillow
      { id: 't2-pillow-candle', left: '26.2%', top: '66.8%', scale: 0.8, glowRadius: 70, intensity: 0.85 },
      // Window sill candle
      { id: 't2-window-candle', left: '1.2%', top: '49%', scale: 0.75, glowRadius: 65, intensity: 0.8 }
    ],
    steamMugs: [
      { left: '87.5%', top: '66%', scale: 1.1 }
    ],
    fairyLights: [
      { left: '3.5%', top: '8%', color: '#fef08a', delay: 0.2 },
      { left: '8.8%', top: '16%', color: '#fde047', delay: 0.7 },
      { left: '13.5%', top: '24%', color: '#fef08a', delay: 1.4 },
      { left: '14.8%', top: '34%', color: '#fbcfe8', delay: 0.5 },
      { left: '11.2%', top: '42%', color: '#fde047', delay: 1.1 },
      { left: '97.5%', top: '22%', color: '#fbcfe8', delay: 0.9 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(251, 113, 133, 0.6)'
  },
  theam3: {
    ambientColor: 'rgba(245, 158, 11, 0.14)',
    candles: [
      // Big jar candle "This Kind of Love" on coffee table
      { id: 't3-table-big', left: '70.8%', top: '65.2%', scale: 1.15, glowRadius: 120, intensity: 1.0 },
      // Candle next to wine glasses
      { id: 't3-table-wine', left: '48.6%', top: '66.8%', scale: 0.95, glowRadius: 85, intensity: 0.9 },
      // Tea light near strawberries
      { id: 't3-table-tea', left: '87.8%', top: '79.5%', scale: 0.7, glowRadius: 60, intensity: 0.8 },
      // Shelf candle behind couch
      { id: 't3-shelf-high', left: '4.2%', top: '31%', scale: 0.85, glowRadius: 80, intensity: 0.85 },
      { id: 't3-shelf-mid', left: '19.2%', top: '63.5%', scale: 0.8, glowRadius: 75, intensity: 0.85 },
      // Balcony candles
      { id: 't3-balcony-1', left: '65.2%', top: '40.5%', scale: 0.75, glowRadius: 65, intensity: 0.75 },
      { id: 't3-balcony-2', left: '75.5%', top: '45.2%', scale: 0.75, glowRadius: 65, intensity: 0.75 }
    ],
    fairyLights: [
      { left: '24.5%', top: '18%', color: '#fef08a', delay: 0.3 },
      { left: '25.2%', top: '27%', color: '#fed7aa', delay: 0.8 },
      { left: '24.8%', top: '36%', color: '#fef08a', delay: 1.5 },
      { left: '48.5%', top: '12%', color: '#fed7aa', delay: 0.6 },
      { left: '50.2%', top: '22%', color: '#fef08a', delay: 1.1 },
      { left: '50.8%', top: '32%', color: '#fed7aa', delay: 1.8 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(251, 191, 36, 0.6)'
  },
  theam4: {
    ambientColor: 'rgba(168, 85, 247, 0.15)',
    candles: [
      { id: 't4-table-candle', left: '97.8%', top: '76.8%', scale: 1.05, glowRadius: 95, intensity: 1.0 },
      { id: 't4-shelf-candle', left: '10.5%', top: '48.5%', scale: 0.9, glowRadius: 85, intensity: 0.95 },
      { id: 't4-pillow-candle', left: '26.2%', top: '66.8%', scale: 0.8, glowRadius: 70, intensity: 0.85 }
    ],
    steamMugs: [
      { left: '87.5%', top: '66%', scale: 1.1 }
    ],
    fairyLights: [
      { left: '3.5%', top: '8%', color: '#e9d5ff', delay: 0.2 },
      { left: '8.8%', top: '16%', color: '#f3e8ff', delay: 0.7 },
      { left: '13.5%', top: '24%', color: '#e9d5ff', delay: 1.4 },
      { left: '14.8%', top: '34%', color: '#f3e8ff', delay: 0.5 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(192, 132, 252, 0.65)'
  },
  theam5: {
    ambientColor: 'rgba(245, 158, 11, 0.15)',
    candles: [
      // Front table candles
      { id: 't5-table-heart-lantern', left: '96.8%', top: '62.8%', scale: 1.1, glowRadius: 115, intensity: 1.0 },
      { id: 't5-table-jar', left: '87.2%', top: '79.2%', scale: 1.05, glowRadius: 95, intensity: 0.95 },
      { id: 't5-table-tea', left: '82.8%', top: '73.2%', scale: 0.85, glowRadius: 75, intensity: 0.85 },
      // Balcony & background candles
      { id: 't5-balcony-1', left: '69.5%', top: '65.2%', scale: 0.75, glowRadius: 65, intensity: 0.75 },
      { id: 't5-balcony-2', left: '63.2%', top: '51.5%', scale: 0.75, glowRadius: 65, intensity: 0.75 },
      { id: 't5-floor-candle', left: '76.2%', top: '50.8%', scale: 0.75, glowRadius: 65, intensity: 0.75 }
    ],
    steamMugs: [
      { left: '57.8%', top: '74%', scale: 0.85 },
      { left: '77.5%', top: '74%', scale: 0.85 }
    ],
    fairyLights: [
      { left: '24.2%', top: '18%', color: '#fef08a', delay: 0.3 },
      { left: '25.0%', top: '28%', color: '#fed7aa', delay: 0.9 },
      { left: '49.0%', top: '15%', color: '#fef08a', delay: 0.5 },
      { left: '50.5%', top: '28%', color: '#fed7aa', delay: 1.3 },
      { left: '72.8%', top: '12%', color: '#fef08a', delay: 0.7 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(251, 191, 36, 0.65)'
  },
  theam6: {
    ambientColor: 'rgba(245, 158, 11, 0.15)',
    candles: [
      { id: 't6-table-heart-lantern', left: '96.8%', top: '62.8%', scale: 1.1, glowRadius: 115, intensity: 1.0 },
      { id: 't6-table-jar', left: '87.2%', top: '79.2%', scale: 1.05, glowRadius: 95, intensity: 0.95 },
      { id: 't6-table-tea', left: '82.8%', top: '73.2%', scale: 0.85, glowRadius: 75, intensity: 0.85 },
      { id: 't6-balcony-1', left: '69.5%', top: '65.2%', scale: 0.75, glowRadius: 65, intensity: 0.75 },
      { id: 't6-balcony-2', left: '63.2%', top: '51.5%', scale: 0.75, glowRadius: 65, intensity: 0.75 }
    ],
    steamMugs: [
      { left: '57.8%', top: '74%', scale: 0.85 },
      { left: '77.5%', top: '74%', scale: 0.85 }
    ],
    fairyLights: [
      { left: '24.2%', top: '18%', color: '#fef08a', delay: 0.3 },
      { left: '49.0%', top: '15%', color: '#fef08a', delay: 0.5 },
      { left: '72.8%', top: '12%', color: '#fef08a', delay: 0.7 }
    ],
    showFloatingEmbers: true,
    emberColor: 'rgba(251, 191, 36, 0.65)'
  }
};

interface DynamicThemeEffectsProps {
  themeId: string;
}

export function DynamicThemeEffects({ themeId }: DynamicThemeEffectsProps) {
  const config = THEME_EFFECTS[themeId];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Floating ambient embers / warm glowing dust motes canvas
  useEffect(() => {
    if (!config || !config.showFloatingEmbers) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Warm embers
    const particleCount = 28;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.8 + 0.8,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.5 - 0.15, // gently drift upward
      opacity: Math.random() * 0.55 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.03 + 0.015
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const currentOpacity = Math.max(0.05, p.opacity * (0.6 + Math.sin(p.pulse) * 0.4));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = config.emberColor
          ? config.emberColor.replace(/[\d\.]+\)$/, `${currentOpacity})`)
          : `rgba(251, 191, 36, ${currentOpacity})`;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = '#f59e0b';
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [themeId, config]);

  if (!config) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden select-none">
      {/* 1. Global Candlelight Ambient Light Breathing Layer */}
      {config.ambientColor && (
        <div
          className="absolute inset-0 transition-opacity duration-1000 animate-candle-ambient"
          style={{
            background: `radial-gradient(ellipse at 85% 75%, ${config.ambientColor} 0%, transparent 65%)`
          }}
        />
      )}

      {/* 2. Floating Warm Embers Canvas */}
      {config.showFloatingEmbers && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      )}

      {/* 3. Realistic Burning Candles with Flickering Flames & Radial Light Halos */}
      {config.candles.map((candle, idx) => {
        const scale = candle.scale || 1.0;
        const glowRadius = candle.glowRadius || 80;
        const animDelay = `${(idx * 0.47) % 2}s`;
        const animDuration = `${1.6 + ((idx * 0.23) % 0.8)}s`;

        return (
          <div
            key={candle.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: candle.left,
              top: candle.top
            }}
          >
            {/* Pulsing Warm Radial Ambient Light Cast onto Surroundings */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none animate-candle-glow"
              style={{
                width: `${glowRadius * 2 * scale}px`,
                height: `${glowRadius * 2 * scale}px`,
                left: '50%',
                top: '50%',
                animationDuration: animDuration,
                animationDelay: animDelay,
                background: `radial-gradient(circle, rgba(251, 191, 36, 0.45) 0%, rgba(245, 158, 11, 0.22) 40%, rgba(220, 38, 38, 0.08) 65%, transparent 75%)`
              }}
            />

            {/* Candle Wick & Organic Flame */}
            <div
              className="relative flex flex-col items-center justify-center animate-flame-flicker"
              style={{
                animationDuration: `${0.85 + ((idx * 0.17) % 0.4)}s`,
                animationDelay: animDelay,
                transformOrigin: '50% 90%'
              }}
            >
              {/* Outer Fiery Corona */}
              <div
                className="w-3.5 h-6 rounded-full blur-[1.5px] opacity-90 animate-flame-sway"
                style={{
                  transform: `scale(${scale})`,
                  background: 'radial-gradient(ellipse at 50% 80%, #fff7ed 0%, #fef08a 25%, #f59e0b 60%, #ea580c 85%, transparent 100%)',
                  boxShadow: '0 0 12px #f59e0b, 0 0 20px rgba(234, 88, 12, 0.7)'
                }}
              />

              {/* Inner Bright Flame Core */}
              <div
                className="absolute w-1.5 h-3.5 rounded-full bg-white blur-[0.5px] -mt-1"
                style={{
                  transform: `scale(${scale})`,
                  boxShadow: '0 0 6px #fff, 0 0 10px #fde047'
                }}
              />

              {/* Soft Blue Base of Flame (just like real candles!) */}
              <div
                className="absolute bottom-0 w-2.5 h-1.5 rounded-full bg-blue-500/50 blur-[0.8px]"
                style={{ transform: `scale(${scale})` }}
              />

              {/* Occasional Micro Spark / Heat Wisp */}
              <div
                className="absolute -top-3 w-1 h-1 rounded-full bg-amber-200 animate-ember-float"
                style={{
                  animationDuration: `${2.2 + idx * 0.3}s`,
                  animationDelay: animDelay
                }}
              />
            </div>
          </div>
        );
      })}

      {/* 4. Rising Steam for Hot Mugs */}
      {config.steamMugs?.map((mug, idx) => (
        <div
          key={`steam-${idx}`}
          className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{
            left: mug.left,
            top: mug.top,
            transform: `scale(${mug.scale || 1.0})`
          }}
        >
          <div className="relative w-8 h-14">
            <span className="steam-particle steam-1" />
            <span className="steam-particle steam-2" />
            <span className="steam-particle steam-3" />
          </div>
        </div>
      ))}

      {/* 5. Twinkling Fairy Lights */}
      {config.fairyLights?.map((light, idx) => (
        <div
          key={`light-${idx}`}
          className="absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-fairy-twinkle pointer-events-none"
          style={{
            left: light.left,
            top: light.top,
            backgroundColor: light.color || '#fef08a',
            animationDelay: `${light.delay || 0}s`,
            boxShadow: `0 0 8px ${light.color || '#fef08a'}, 0 0 14px rgba(254, 240, 138, 0.6)`
          }}
        />
      ))}

      {/* Embedded Dynamic Theme Animations */}
      <style jsx>{`
        @keyframes flameFlicker {
          0%, 100% {
            transform: scale(1) translate(0, 0) rotate(0deg);
            opacity: 0.95;
          }
          20% {
            transform: scale(0.96, 1.06) translate(0.4px, -0.6px) rotate(-1.2deg);
            opacity: 1;
          }
          45% {
            transform: scale(1.04, 0.94) translate(-0.5px, 0.4px) rotate(1.5deg);
            opacity: 0.9;
          }
          70% {
            transform: scale(0.98, 1.03) translate(0.3px, -0.4px) rotate(-0.8deg);
            opacity: 1;
          }
          85% {
            transform: scale(1.02, 0.97) translate(-0.2px, 0.2px) rotate(0.6deg);
            opacity: 0.92;
          }
        }

        @keyframes flameSway {
          0%, 100% {
            border-radius: 50% 50% 35% 35% / 60% 60% 40% 40%;
          }
          50% {
            border-radius: 45% 55% 40% 30% / 55% 65% 35% 45%;
          }
        }

        @keyframes candleGlow {
          0%, 100% {
            opacity: 0.75;
            transform: translate(-50%, -50%) scale(1);
          }
          33% {
            opacity: 0.95;
            transform: translate(-50%, -50%) scale(1.08);
          }
          66% {
            opacity: 0.68;
            transform: translate(-50%, -50%) scale(0.94);
          }
        }

        @keyframes candleAmbient {
          0%, 100% {
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes emberFloat {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.5);
          }
          20% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.6;
          }
          100% {
            opacity: 0;
            transform: translate(calc(sin(1) * 8px), -18px) scale(0.2);
          }
        }

        @keyframes fairyTwinkle {
          0%, 100% {
            opacity: 0.35;
            transform: translate(-50%, -50%) scale(0.85);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.25);
          }
        }

        @keyframes steamRise {
          0% {
            opacity: 0;
            transform: translateY(0) scaleX(0.7);
          }
          30% {
            opacity: 0.45;
          }
          70% {
            opacity: 0.25;
            transform: translateY(-16px) scaleX(1.1) translateX(3px);
          }
          100% {
            opacity: 0;
            transform: translateY(-30px) scaleX(1.4) translateX(-4px);
          }
        }

        .animate-flame-flicker {
          animation: flameFlicker infinite ease-in-out;
        }

        .animate-flame-sway {
          animation: flameSway 2.5s infinite ease-in-out;
        }

        .animate-candle-glow {
          animation: candleGlow infinite ease-in-out;
        }

        .animate-candle-ambient {
          animation: candleAmbient 4s infinite ease-in-out;
        }

        .animate-ember-float {
          animation: emberFloat infinite ease-out;
        }

        .animate-fairy-twinkle {
          animation: fairyTwinkle 2.2s infinite ease-in-out;
        }

        .steam-particle {
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 8px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 80%);
          filter: blur(2.5px);
          animation: steamRise 3s infinite ease-out;
        }

        .steam-1 {
          animation-delay: 0s;
          left: 30%;
        }
        .steam-2 {
          animation-delay: 1.1s;
          left: 50%;
        }
        .steam-3 {
          animation-delay: 2.2s;
          left: 65%;
        }
      `}</style>
    </div>
  );
}
