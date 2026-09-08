'use client';

import { useState, useEffect } from 'react';
import { Reaction } from '@synccinema/common';

interface FloatingParticle {
  id: string;
  emoji: string;
  leftPercent: number;
}

interface FloatingReactionsCanvasProps {
  latestReactions: Reaction[];
}

export function FloatingReactionsCanvas({ latestReactions }: FloatingReactionsCanvasProps) {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);

  useEffect(() => {
    if (latestReactions.length === 0) return;
    const newest = latestReactions[0];
    if (!newest) return;

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
}
