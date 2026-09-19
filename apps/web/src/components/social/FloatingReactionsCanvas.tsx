'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Reaction } from '@synccinema/common';

interface FloatingParticle {
  id: string;
  emoji: string;
  leftPercent: number;
}

interface FloatingReactionsCanvasProps {
  latestReactions: Reaction[];
}

export const FloatingReactionsCanvas = React.memo(function FloatingReactionsCanvas({ latestReactions }: FloatingReactionsCanvasProps) {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const lastReactionIdRef = useRef<string | null>(latestReactions?.[0]?.id || null);
  const mountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (latestReactions.length === 0) return;
    const newest = latestReactions[0];
    if (!newest) return;

    if (newest.id === lastReactionIdRef.current) return;
    lastReactionIdRef.current = newest.id;

    // Filter out historical reactions loaded on room join
    const rxTime = newest.serverTimestamp || new Date(newest.createdAt).getTime();
    if (rxTime && (Date.now() - rxTime > 4000 || rxTime < mountTimeRef.current - 1000)) {
      return;
    }

    const particle: FloatingParticle = {
      id: `${newest.id}_${Math.random()}`,
      emoji: newest.emoji,
      leftPercent: 15 + Math.random() * 70 // spread randomly across middle 70% of video
    };

    setParticles(prev => [...prev.slice(-25), particle]);

    const timer = setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== particle.id));
    }, 2400);

    return () => clearTimeout(timer);
  }, [latestReactions]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute bottom-10 animate-float-up text-3xl sm:text-4xl drop-shadow-md select-none"
          style={{ left: `${p.leftPercent}%` }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
});
