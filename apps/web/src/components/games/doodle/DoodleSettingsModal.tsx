'use client';

import React, { useState } from 'react';
import { X, Volume2, VolumeX, Copy, Check, Palette, Brain, Repeat, HelpCircle, LogOut } from 'lucide-react';

interface DoodleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onLeaveRoom: () => void;
}

export const DoodleSettingsModal: React.FC<DoodleSettingsModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  soundEnabled,
  onToggleSound,
  onLeaveRoom
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-3xl bg-[#0f1322] border border-white/10 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-rose-400" />
            <h3 className="text-base font-black text-white">Doodle Duel Settings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Room Code */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Room Code
              </span>
              <span className="text-sm font-mono font-black text-white">{roomCode}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share Link'}</span>
            </button>
          </div>

          {/* Sound FX */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2.5">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-rose-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              )}
              <div>
                <span className="text-xs font-bold text-white block">Game Sound Effects</span>
                <span className="text-[10px] text-zinc-400">Audio chimes for timer & guesses</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                soundEnabled
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/10 text-zinc-400'
              }`}
            >
              {soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* How to Play Rules */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-rose-400" /> How to Play
            </span>
            <ul className="text-xs space-y-2 text-zinc-300">
              <li className="flex items-start gap-2">
                <Palette className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Draw:</strong> Choose 1 secret word out of 3 choices and sketch on canvas.</span>
              </li>
              <li className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <span><strong>Guess:</strong> Guess the word as strokes appear live. Faster guesses earn up to 100 pts!</span>
              </li>
              <li className="flex items-start gap-2">
                <Repeat className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Alternate:</strong> Roles swap automatically each round! Equal turns for both players.</span>
              </li>
            </ul>
          </div>

          {/* Leave Game */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="w-full py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Game Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
