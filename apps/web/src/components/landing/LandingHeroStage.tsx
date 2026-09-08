'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, Sparkles, Radio, Crown } from 'lucide-react';

interface FloatingReactionItem {
  id: string;
  emoji: string;
  left: number;
}

export function LandingHeroStage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [reactions, setReactions] = useState<FloatingReactionItem[]>([]);
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [simulatedDrift, setSimulatedDrift] = useState(3.4);

  const mockChats = [
    { user: 'Sarah', text: 'OMG that scene was breathtaking!! 🤯', time: '12:04' },
    { user: 'Mayur (Host)', text: 'The soundtrack in sync hits completely different 🎧', time: '12:05' },
    { user: 'Alex', text: 'Wait rewind 5 seconds look at the background!', time: '12:06' },
    { user: 'Elena', text: 'Sub-second sync is insane, zero delay 🔥', time: '12:07' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChatIndex((prev) => (prev + 1) % mockChats.length);
      setSimulatedDrift(Number((2.0 + Math.random() * 2.2).toFixed(1)));
    }, 3200);
    return () => clearInterval(interval);
  }, [mockChats.length]);

  const triggerReaction = (emoji: string) => {
    const newReaction: FloatingReactionItem = {
      id: Math.random().toString(),
      emoji,
      left: 15 + Math.random() * 70
    };
    setReactions((prev) => [...prev, newReaction]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2200);
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto rounded-3xl p-1.5 sm:p-2.5 bg-gradient-to-b from-white/15 via-white/5 to-transparent shadow-2xl backdrop-blur-xl border border-white/10">
      {/* Outer Glow Halo */}
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-pink-500/20 rounded-3xl blur-2xl -z-10 opacity-70 pointer-events-none" />

      {/* Main Theater Screen Container */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0a0c14] border border-[#1b2234] shadow-inner aspect-[16/10] sm:aspect-[16/9] flex flex-col justify-between">
        {/* Floating Reactions Layer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
          {reactions.map((r) => (
            <div
              key={r.id}
              style={{ left: `${r.left}%` }}
              className="absolute bottom-16 text-3xl sm:text-4xl animate-float-up drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] select-none"
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Video Canvas Simulation */}
        <div className="absolute inset-0 z-0 bg-gradient-to-tr from-[#0d111d] via-[#161c2e] to-[#0a0d18]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-85"
            poster="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80"
          >
            <source
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              type="video/mp4"
            />
          </video>
          {/* Cinematic Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c14] via-transparent to-black/60 pointer-events-none" />
        </div>

        {/* Top Theater Header Bar */}
        <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center space-x-1.5 text-[11px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE PREVIEW STAGE</span>
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-zinc-300 font-medium bg-black/40 backdrop-blur px-3 py-1 rounded-full border border-white/10">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>StitchByte Cinema Room #812</span>
            </div>
          </div>

          {/* Sync Telemetry Badge */}
          <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 shadow-sm">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <div className="text-[11px] font-mono text-zinc-300">
              Sync: <span className="text-emerald-400 font-bold">±{simulatedDrift}ms</span>
            </div>
          </div>
        </div>

        {/* Center Playback Watermark */}
        <div className="relative z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center border border-white/20 text-white shadow-xl">
            {isPlaying ? <Pause className="w-7 h-7 fill-white" /> : <Play className="w-7 h-7 fill-white ml-1" />}
          </div>
        </div>

        {/* Bottom Bar: Live Chat Ticker + Participants Strip + Reaction Emojis */}
        <div className="relative z-20 p-2 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-2.5">
          {/* Chat Ticker & Status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur px-3 py-1 rounded-full border border-white/10 max-w-sm truncate">
              <span className="font-semibold text-emerald-400 text-[11px] flex-shrink-0">
                {mockChats[activeChatIndex].user}:
              </span>
              <span className="text-zinc-200 text-[11px] truncate">
                {mockChats[activeChatIndex].text}
              </span>
            </div>

            {/* Clickable Quick Reactions */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 bg-black/60 backdrop-blur px-2 sm:px-3 py-1 rounded-full border border-white/10">
              <span className="text-[10px] text-zinc-400 hidden sm:inline mr-1 font-medium">Click to react:</span>
              {[
                { emoji: '🔥', label: 'Fire' },
                { emoji: '🍿', label: 'Popcorn' },
                { emoji: '❤️', label: 'Love' },
                { emoji: '😂', label: 'Joy' },
                { emoji: '🤯', label: 'Mind Blown' }
              ].map((item) => (
                <button
                  key={item.emoji}
                  onClick={() => triggerReaction(item.emoji)}
                  className="hover:scale-125 active:scale-95 transition text-base sm:text-lg p-0.5"
                  title={`React ${item.label}`}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Participant Webcam Row */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {/* Tile 1: Mayur (Host) */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#161d2d] border border-amber-400/50 shadow-md group">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-indigo-900 via-purple-900 to-indigo-950 text-white font-bold text-xs">
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">M</span>
              </div>
              <div className="absolute bottom-1 left-1.5 flex items-center space-x-1 text-[10px] font-semibold text-white drop-shadow">
                <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="truncate">Mayur (Host)</span>
              </div>
              <div className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Tile 2: Sarah */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#161d2d] border border-emerald-400/60 ring-1 ring-emerald-400/30 shadow-md">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-teal-900 to-emerald-950 text-white font-bold text-xs">
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">S</span>
              </div>
              <div className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white truncate drop-shadow">
                Sarah
              </div>
              <div className="absolute top-1 right-1.5 px-1 bg-emerald-500/80 text-[8px] font-bold text-white rounded">
                MIC
              </div>
            </div>

            {/* Tile 3: Alex */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#161d2d] border border-white/10 shadow-md">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-900 to-cyan-950 text-white font-bold text-xs">
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">A</span>
              </div>
              <div className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white truncate drop-shadow">
                Alex
              </div>
            </div>

            {/* Tile 4: Elena */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#161d2d] border border-white/10 shadow-md">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-rose-900 to-pink-950 text-white font-bold text-xs">
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">E</span>
              </div>
              <div className="absolute bottom-1 left-1.5 text-[10px] font-semibold text-white truncate drop-shadow">
                Elena
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
