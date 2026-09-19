'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface TheaterOverlayProps {
  avatarUrl: string;
  userName: string;
  onClose: () => void;
  children: React.ReactNode; // actual video/screen content
}

type Phase = 'dark' | 'reveal' | 'walking' | 'sitting' | 'enjoying';

// Seat layout: each row: count of seats, y%, size scale, color
const ROWS = [
  { count: 18, y: 2,  size: 18, color: '#1e0600', headColor: '#180400' },
  { count: 16, y: 18, size: 22, color: '#280800', headColor: '#200600' },
  { count: 14, y: 34, size: 26, color: '#300a00', headColor: '#280700' },
  { count: 12, y: 50, size: 30, color: '#3a0c00', headColor: '#300900' },
];
// User sits in front row (y=50), center-ish (position 5 from left)
const USER_SEAT = { row: 3, col: 6, yPercent: 50 };

export function TheaterOverlay({ avatarUrl, userName, onClose, children }: TheaterOverlayProps) {
  const [phase, setPhase] = useState<Phase>('dark');
  const [charY, setCharY] = useState(105); // % from top (starts off-screen bottom)
  const [charX, setCharX] = useState(50);  // % from left

  useEffect(() => {
    // Phase timeline
    const t1 = setTimeout(() => setPhase('reveal'), 300);
    const t2 = setTimeout(() => {
      setPhase('walking');
      setCharY(80); // enter from gate at bottom
    }, 1200);
    const t3 = setTimeout(() => {
      // Walk to seat
      setCharY(53);
      setCharX(38);
    }, 2000);
    const t4 = setTimeout(() => setPhase('sitting'), 3400);
    const t5 = setTimeout(() => setPhase('enjoying'), 4200);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  const isVisible = phase !== 'dark';

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden select-none"
      style={{ fontFamily: 'inherit' }}
    >
      {/* ── CSS Keyframe Animations ── */}
      <style>{`
        @keyframes theaterFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bobWalk {
          0%, 100% { transform: translateY(0px) scaleX(1); }
          25%       { transform: translateY(-5px) scaleX(0.97); }
          75%       { transform: translateY(-3px) scaleX(1.02); }
        }
        @keyframes sittle {
          0%   { transform: translateY(0px) scale(1); }
          40%  { transform: translateY(6px) scale(0.93); }
          70%  { transform: translateY(3px) scale(0.96); }
          100% { transform: translateY(4px) scale(0.95); }
        }
        @keyframes popcornAppear {
          0%   { opacity: 0; transform: scale(0) rotate(-30deg) translateY(6px); }
          60%  { transform: scale(1.3) rotate(8deg) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) rotate(0deg) translateY(0px); }
        }
        @keyframes screenPulse {
          0%, 100% { box-shadow: 0 0 50px 12px rgba(229,9,20,0.35), 0 0 100px 30px rgba(229,9,20,0.12); }
          50%       { box-shadow: 0 0 70px 20px rgba(229,9,20,0.50), 0 0 130px 45px rgba(229,9,20,0.18); }
        }
        @keyframes curtainLeft {
          from { transform: translateX(-20px); opacity: 0; }
          to   { transform: translateX(0px);  opacity: 1; }
        }
        @keyframes curtainRight {
          from { transform: translateX(20px);  opacity: 0; }
          to   { transform: translateX(0px);   opacity: 1; }
        }
        @keyframes ceilLightFlicker {
          0%, 100% { opacity: 0.55; }
          45%       { opacity: 0.70; }
          55%       { opacity: 0.40; }
        }
        @keyframes gateGlow {
          0%, 100% { box-shadow: 0 0 18px 4px rgba(180,100,0,0.4); }
          50%       { box-shadow: 0 0 30px 8px rgba(210,120,0,0.55); }
        }
        @keyframes headBob {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
      `}</style>

      {/* ── Dark curtain on load ── */}
      <div
        className="absolute inset-0 bg-black z-50 pointer-events-none transition-opacity duration-700"
        style={{ opacity: isVisible ? 0 : 1 }}
      />

      {/* ── FULL THEATER SCENE ── */}
      <div
        className="relative w-full h-full flex flex-col"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #1a0500 0%, #0a0200 50%, #000 100%)',
          opacity: isVisible ? 1 : 0,
          animation: isVisible ? 'theaterFadeIn 0.8s ease forwards' : 'none',
        }}
      >

        {/* ══ EXIT BUTTON ══ */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-[100] flex items-center gap-1.5 bg-black/70 hover:bg-red-900/80 border border-white/10 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm transition-all"
        >
          <X className="w-3 h-3" />
          Exit Theater
        </button>

        {/* ══ CEILING WITH LIGHTS ══ */}
        <div
          className="shrink-0 relative overflow-hidden"
          style={{
            height: 36,
            background: 'linear-gradient(to bottom, #1c0600 0%, #0e0300 80%, transparent 100%)',
          }}
        >
          {/* Ceiling chandelier dots */}
          <div className="absolute inset-x-0 top-2 flex justify-around px-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-0.5"
                style={{ animation: `ceilLightFlicker ${1.5 + (i % 3) * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.12}s` }}
              >
                <div className="w-px h-2 bg-amber-700/60" />
                <div className="w-2 h-2 rounded-full bg-amber-200/70" style={{ boxShadow: '0 0 6px 2px rgba(251,191,36,0.5)' }} />
              </div>
            ))}
          </div>
          {/* Crown moulding */}
          <div className="absolute bottom-0 inset-x-0 h-1" style={{ background: 'linear-gradient(to right, #5c2000, #8b3a00, #5c2000)' }} />
        </div>

        {/* ══ SCREEN + CURTAINS SECTION ══ */}
        <div className="shrink-0 relative flex items-stretch px-4 pt-2 pb-0">
          {/* Left Curtain */}
          <div
            className="shrink-0 w-10 rounded-tl-lg rounded-bl-sm"
            style={{
              background: 'linear-gradient(to right, #7a0a00 0%, #5c0600 40%, #3a0300 100%)',
              boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.5)',
              animation: isVisible ? 'curtainLeft 0.6s ease 0.4s both' : 'none',
              minHeight: 160,
            }}
          >
            {/* Curtain folds */}
            {[20, 40, 60, 80].map(pct => (
              <div key={pct} className="absolute top-0 bottom-0 w-px opacity-30"
                style={{ left: `${pct}%`, background: 'rgba(0,0,0,0.6)' }} />
            ))}
          </div>

          {/* THE SCREEN */}
          <div className="flex-1 flex flex-col">
            {/* Screen arch/valance */}
            <div
              className="h-3 mx-1"
              style={{ background: 'linear-gradient(to bottom, #8B6914, #5c4000)', borderRadius: '4px 4px 0 0' }}
            />
            {/* Screen frame + video */}
            <div
              className="relative flex-1 overflow-hidden"
              style={{
                border: '5px solid #8B6914',
                borderRadius: '0 0 4px 4px',
                animation: 'screenPulse 4s ease-in-out infinite',
                minHeight: 160,
                maxHeight: '38vh',
                background: '#000',
              }}
            >
              {children}
              {/* Lens flare overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)',
                }}
              />
            </div>
            {/* Screen bottom stage ledge */}
            <div
              className="h-3 mx-1"
              style={{ background: 'linear-gradient(to bottom, #5c4000, #2a1c00)', boxShadow: '0 4px 16px rgba(0,0,0,0.9)' }}
            />
          </div>

          {/* Right Curtain */}
          <div
            className="shrink-0 w-10 rounded-tr-lg rounded-br-sm"
            style={{
              background: 'linear-gradient(to left, #7a0a00 0%, #5c0600 40%, #3a0300 100%)',
              boxShadow: 'inset 4px 0 12px rgba(0,0,0,0.5)',
              animation: isVisible ? 'curtainRight 0.6s ease 0.4s both' : 'none',
              minHeight: 160,
            }}
          />
        </div>

        {/* ══ AUDIENCE AREA with 3D perspective ══ */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{
            perspective: '600px',
            perspectiveOrigin: '50% 0%',
          }}
        >
          {/* Tilted floor plane */}
          <div
            className="absolute inset-0"
            style={{
              transform: 'rotateX(28deg)',
              transformOrigin: 'top center',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Floor gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, #120400 0%, #0a0200 60%, #060100 100%)',
              }}
            />

            {/* Center aisle */}
            <div
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
              style={{
                width: 32,
                background: 'linear-gradient(to bottom, #1e0800 0%, #120400 100%)',
              }}
            />

            {/* Aisle step lines */}
            {[15, 30, 45, 60, 75].map(y => (
              <div
                key={y}
                className="absolute left-0 right-0 h-px opacity-20"
                style={{ top: `${y}%`, background: 'linear-gradient(to right, transparent, #8B6914, transparent)' }}
              />
            ))}

            {/* SEAT ROWS */}
            {ROWS.map((row, ri) => {
              const halfCount = Math.floor(row.count / 2);
              const isUserRow = ri === USER_SEAT.row;
              return (
                <div
                  key={ri}
                  className="absolute left-0 right-0 flex justify-center items-center gap-1"
                  style={{ top: `${row.y}%` }}
                >
                  {/* Left block */}
                  <div className="flex gap-0.5 items-end">
                    {Array.from({ length: halfCount }).map((_, ci) => {
                      const isUserSeat = isUserRow && ci === USER_SEAT.col - 1;
                      return (
                        <div key={ci} className="flex flex-col items-center gap-0">
                          {/* Seat head silhouette — only show for non-user seats once user is sitting */}
                          {!isUserSeat && (
                            <div
                              className="rounded-full"
                              style={{
                                width: row.size * 0.55,
                                height: row.size * 0.55,
                                background: row.headColor,
                                opacity: 0.7 + Math.random() * 0.2,
                                animation: `headBob ${2 + ci * 0.3}s ease-in-out infinite`,
                                animationDelay: `${ci * 0.15}s`,
                              }}
                            />
                          )}
                          {/* Seat body */}
                          <div
                            className="rounded-t-sm"
                            style={{
                              width: row.size,
                              height: row.size * 0.7,
                              background: isUserSeat ? '#5c0a00' : row.color,
                              boxShadow: isUserSeat
                                ? '0 0 8px rgba(229,9,20,0.6)'
                                : 'inset 0 -2px 4px rgba(0,0,0,0.4)',
                              border: isUserSeat ? '1px solid #E50914' : 'none',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Aisle gap */}
                  <div style={{ width: 32 }} />

                  {/* Right block */}
                  <div className="flex gap-0.5 items-end">
                    {Array.from({ length: halfCount }).map((_, ci) => (
                      <div key={ci} className="flex flex-col items-center gap-0">
                        <div
                          className="rounded-full"
                          style={{
                            width: row.size * 0.55,
                            height: row.size * 0.55,
                            background: row.headColor,
                            opacity: 0.6 + Math.random() * 0.3,
                            animation: `headBob ${2.2 + ci * 0.25}s ease-in-out infinite`,
                            animationDelay: `${ci * 0.2}s`,
                          }}
                        />
                        <div
                          className="rounded-t-sm"
                          style={{
                            width: row.size,
                            height: row.size * 0.7,
                            background: row.color,
                            boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.4)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ── ENTRANCE GATE at the bottom ── */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ width: 48 }}
            >
              {/* Gate arch */}
              <div
                className="w-full rounded-t-full border-t-2 border-x-2 border-amber-700/60 flex items-center justify-center"
                style={{
                  height: 28,
                  background: 'linear-gradient(to bottom, #2a1500, #1a0a00)',
                  animation: 'gateGlow 2s ease-in-out infinite',
                }}
              >
                <span className="text-[8px] text-amber-500/70 font-bold tracking-widest">IN</span>
              </div>
              {/* Gate pillars */}
              <div className="w-full flex justify-between">
                <div className="w-2 h-5" style={{ background: '#4a2800' }} />
                <div className="w-2 h-5" style={{ background: '#4a2800' }} />
              </div>
            </div>

            {/* ── BITMOJI CHARACTER ── */}
            {phase !== 'dark' && phase !== 'reveal' && (
              <div
                className="absolute z-30"
                style={{
                  left: `${charX}%`,
                  top: `${charY}%`,
                  transform: 'translateX(-50%)',
                  transition: phase === 'walking'
                    ? 'top 1.4s cubic-bezier(0.22,1,0.36,1), left 1.2s cubic-bezier(0.22,1,0.36,1)'
                    : 'none',
                }}
              >
                <div
                  className="flex flex-col items-center"
                  style={{
                    animation: phase === 'walking'
                      ? 'bobWalk 0.35s ease-in-out infinite'
                      : phase === 'sitting'
                      ? 'sittle 0.5s ease forwards'
                      : 'none',
                  }}
                >
                  {/* Avatar circle */}
                  <div
                    className="relative rounded-2xl overflow-hidden border-2 shadow-xl"
                    style={{
                      width: 44,
                      height: 44,
                      borderColor: '#E50914',
                      boxShadow: '0 0 16px rgba(229,9,20,0.5)',
                    }}
                  >
                    <img
                      src={avatarUrl}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name tag */}
                  <div
                    className="mt-0.5 px-1.5 py-px rounded-full text-white font-bold whitespace-nowrap"
                    style={{ fontSize: 8, background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(229,9,20,0.4)' }}
                  >
                    {userName}
                  </div>

                  {/* Popcorn — only when enjoying */}
                  {phase === 'enjoying' && (
                    <div
                      className="absolute -top-5 -right-4"
                      style={{ fontSize: 20, animation: 'popcornAppear 0.4s ease 0.1s both' }}
                    >
                      🍿
                    </div>
                  )}

                  {/* Happy emoji when enjoying */}
                  {phase === 'enjoying' && (
                    <div
                      className="absolute -top-5 -left-4"
                      style={{ fontSize: 14, animation: 'popcornAppear 0.4s ease 0.3s both' }}
                    >
                      😍
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Side wall ambient lights */}
            <div
              className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none"
              style={{ background: 'linear-gradient(to right, rgba(100,20,0,0.5), transparent)' }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none"
              style={{ background: 'linear-gradient(to left, rgba(100,20,0,0.5), transparent)' }}
            />
          </div>

          {/* Ambient light from screen spilling onto audience */}
          <div
            className="absolute top-0 inset-x-0 h-1/3 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(229,9,20,0.08) 0%, transparent 100%)',
            }}
          />
        </div>

        {/* ══ THEATER MODE BADGE ══ */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border backdrop-blur-sm"
          style={{
            background: 'rgba(0,0,0,0.65)',
            borderColor: 'rgba(229,9,20,0.4)',
            color: '#E50914',
          }}
        >
          🎬 3D Theater Experience
        </div>
      </div>
    </div>
  );
}
