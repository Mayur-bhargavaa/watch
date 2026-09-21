'use client';

import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Palette,
  Brain,
  Repeat,
  HelpCircle,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';

export interface BoardTheme {
  id: string;
  name: string;
  bgUrl: string;
}

export const DOODLE_THEMES: BoardTheme[] = [
  {
    id: 'romantic',
    name: 'Romantic Candlelight (Default)',
    bgUrl: '/images/romantic_room_ambient_bg.jpg'
  },
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    bgUrl: '/images/cozy_ludo_bg.jpg'
  },
  {
    id: 'theam1',
    name: 'Theme 1 • Candlelit Café',
    bgUrl: '/theams/theam1.jpeg'
  },
  {
    id: 'theam2',
    name: 'Theme 2 • Neon Romance',
    bgUrl: '/theams/theam2.jpeg'
  },
  {
    id: 'theam3',
    name: 'Theme 3 • Better Together',
    bgUrl: '/theams/theam3.jpeg'
  },
  {
    id: 'theam4',
    name: 'Theme 4 • Watch Together',
    bgUrl: '/theams/theam4.jpeg'
  },
  {
    id: 'theam5',
    name: 'Theme 5 • Snuggle Cinema',
    bgUrl: '/theams/theam5.jpeg'
  },
  {
    id: 'theam6',
    name: 'Theme 6 • Velvet Night',
    bgUrl: '/theams/theam6.jpeg'
  }
];

interface DoodleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onLeaveRoom: () => void;
  selectedTheme?: string;
  onSelectTheme?: (themeId: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const DoodleSettingsModal: React.FC<DoodleSettingsModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  soundEnabled,
  onToggleSound,
  onLeaveRoom,
  selectedTheme = 'romantic',
  onSelectTheme,
  isDark = true,
  onToggleTheme
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
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl p-6 overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#0f1322] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-4 border-b mb-4 ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-rose-500" />
            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Doodle Duel Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition ${
              isDark
                ? 'hover:bg-white/10 text-zinc-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Room Code */}
          <div
            className={`flex items-center justify-between p-3.5 rounded-2xl border ${
              isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider block ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                Room Code
              </span>
              <span className={`text-base font-mono font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {roomCode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share Link'}</span>
            </button>
          </div>

          {/* Light / Dark Mode Switch */}
          {onToggleTheme && (
            <div
              className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isDark ? (
                  <Moon className="w-4 h-4 text-purple-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                <div>
                  <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Appearance
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    {isDark ? 'Dark Mode (Midnight)' : 'Light Mode (Clean White)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  isDark
                    ? 'bg-white/10 text-white hover:bg-white/15'
                    : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                }`}
              >
                {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
              </button>
            </div>
          )}

          {/* Board Themes Grid (Ludo Standard) */}
          <div
            className={`p-3.5 rounded-2xl border space-y-2.5 ${
              isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-rose-500" />
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Atmospheric Board Theme
                </span>
              </div>
              <span className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                Syncs for all players
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
              {DOODLE_THEMES.map(theme => {
                const isSelected = selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onSelectTheme?.(theme.id)}
                    className={`group relative rounded-xl overflow-hidden border transition-all flex flex-col items-center text-left ${
                      isSelected
                        ? 'border-rose-500 ring-2 ring-rose-500/40 scale-[1.02]'
                        : isDark
                        ? 'border-white/10 hover:border-white/30'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="w-full h-14 relative overflow-hidden bg-black/40">
                      <img
                        src={theme.bgUrl}
                        alt={theme.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`w-full py-1 px-1.5 text-[9px] font-bold text-center truncate ${
                        isDark
                          ? 'bg-[#14151b] text-white'
                          : 'bg-white text-slate-900 border-t border-slate-200'
                      }`}
                    >
                      {theme.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound FX */}
          <div
            className={`flex items-center justify-between p-3.5 rounded-2xl border ${
              isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-rose-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              )}
              <div>
                <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Game Sound Effects
                </span>
                <span className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  Audio chimes for guesses & time
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                soundEnabled
                  ? 'bg-rose-500 text-white'
                  : isDark
                  ? 'bg-white/10 text-zinc-400'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* How to Play Rules */}
          <div
            className={`p-4 rounded-2xl border space-y-2.5 ${
              isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-rose-500" /> How to Play
            </span>
            <ul className={`text-xs space-y-2 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              <li className="flex items-start gap-2">
                <Palette className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Draw:</strong> Choose 1 secret word and sketch on the canvas in real time.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Guess:</strong> Guess the word as strokes appear. Faster guesses earn higher points!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Repeat className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Alternate:</strong> Roles swap automatically every round for fair competition!
                </span>
              </li>
            </ul>
          </div>

          {/* Leave Game */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="w-full py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Game Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
