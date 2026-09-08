'use client';

import React, { useState } from 'react';
import { Gamepad2, Sparkles, Clock, X, Bell, Check, Users, ChevronRight } from 'lucide-react';

export interface GameItem {
  id: string;
  title: string;
  subtext: string;
  badge?: string;
  badgeColor?: string;
  category: string;
  players: string;
  icon: string;
  artwork: string;
  description: string;
}

export const GAMES_CATALOG: GameItem[] = [
  {
    id: 'ludo',
    title: 'LUDO PARTY',
    subtext: 'Classic 4-Player Board',
    badge: 'Most Popular',
    badgeColor: 'bg-[#6355ff]',
    category: 'Board Game',
    players: '2-4 Players',
    icon: '🎲',
    artwork: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600&h=400&fit=crop&q=80',
    description: 'Roll the dice, race your 4 tokens across the board, land on safe stars, and send opponent tokens back to base.'
  },
  {
    id: 'connect4',
    title: 'FOUR IN A ROW',
    subtext: 'Vertical Disc Duel',
    badge: 'Instant Queue',
    badgeColor: 'bg-[#6355ff]',
    category: 'Strategy Arcade',
    players: '2 Players',
    icon: '🔴',
    artwork: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=400&fit=crop&q=80',
    description: 'Drop red and yellow discs into the 7x6 arcade grid. Connect 4 horizontally, vertically, or diagonally before your rival.'
  },
  {
    id: 'moduko',
    title: 'MODUKO',
    subtext: 'Logic & Sudoku Puzzles',
    badge: 'Top Pick',
    badgeColor: 'bg-[#6355ff]',
    category: 'Logic Puzzle',
    players: 'Solo & Co-op',
    icon: '🧩',
    artwork: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=600&h=400&fit=crop&q=80',
    description: 'Number placement and block puzzle. Challenge your mind with candidate notes, mistake counters, and difficulty presets.'
  },
  {
    id: 'trivia',
    title: 'CINEMA TRIVIA',
    subtext: '15s Rapid Movie Quiz',
    badge: 'Party Favorite',
    badgeColor: 'bg-[#6355ff]',
    category: 'Movie Quiz',
    players: '2-6 Players',
    icon: '🎬',
    artwork: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=400&fit=crop&q=80',
    description: '15-second movie trivia covering Hollywood blockbusters, Marvel MCU, Oscar winners, and iconic cinema quotes.'
  },
  {
    id: 'emoji',
    title: 'EMOJI GUESS',
    subtext: 'Decipher The Film',
    badge: 'Trending',
    badgeColor: 'bg-[#6355ff]',
    category: 'Word Puzzle',
    players: '2-6 Players',
    icon: '🍿',
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop&q=80',
    description: 'Guess the movie from emoji combinations with letter hints, instant validation, and streak multipliers.'
  },
  {
    id: 'pictionary',
    title: 'CO-OP PICTIONARY',
    subtext: 'Live Sketch & Guess',
    badge: 'Multiplayer',
    badgeColor: 'bg-[#6355ff]',
    category: 'Live Sketch',
    players: '2-6 Players',
    icon: '🎨',
    artwork: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&h=400&fit=crop&q=80',
    description: 'Synchronized live drawing canvas where one player sketches secret movie words and others guess in real time.'
  },
  {
    id: 'reflex',
    title: 'REFLEX DUEL',
    subtext: 'Millisecond Reaction',
    badge: 'Fast Action',
    badgeColor: 'bg-[#6355ff]',
    category: 'Speed Duel',
    players: 'Up to 6',
    icon: '⚡',
    artwork: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=400&fit=crop&q=80',
    description: 'High-stakes reaction duel. Wait for the green flash, tap instantly, and top the fastest tappers leaderboard.'
  },
  {
    id: 'chess',
    title: 'CHESS CINEMA',
    subtext: 'Grandmaster Board',
    badge: 'Classic',
    badgeColor: 'bg-[#6355ff]',
    category: 'Classic Strategy',
    players: '2 Players',
    icon: '♟️',
    artwork: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600&h=400&fit=crop&q=80',
    description: 'Classic chess with live move highlighting, turn clocks, checkmate validation, and party spectating.'
  },
  {
    id: 'uno',
    title: 'CARD LOUNGE',
    subtext: 'Uno & Party Cards',
    badge: 'Party Mode',
    badgeColor: 'bg-[#6355ff]',
    category: 'Card Game',
    players: '2-6 Players',
    icon: '🃏',
    artwork: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&h=400&fit=crop&q=80',
    description: 'Color and number matching party game. Drop Draw Fours, Skips, and Reverses to leave your friends with zero cards.'
  },
  {
    id: 'battleship',
    title: 'BATTLESHIP',
    subtext: 'Naval Combat Fleet',
    badge: 'Strategy',
    badgeColor: 'bg-[#6355ff]',
    category: 'Naval Strategy',
    players: '2 Players',
    icon: '🚢',
    artwork: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600&h=400&fit=crop&q=80',
    description: 'Command your fleet on a hidden ocean grid. Call out target coordinates to strike and sink enemy warships.'
  },
  {
    id: 'wordguess',
    title: 'WORD GUESS',
    subtext: 'Secret Word Wordle',
    badge: 'New',
    badgeColor: 'bg-[#6355ff]',
    category: 'Word Game',
    players: 'Solo & Party',
    icon: '🔤',
    artwork: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&h=400&fit=crop&q=80',
    description: '6 tries to guess the secret 5-letter movie-themed word with green and yellow tile color hints.'
  },
  {
    id: 'popcorn',
    title: 'POPCORN FRENZY',
    subtext: 'Speed Reflex Clicker',
    badge: 'Arcade',
    badgeColor: 'bg-[#6355ff]',
    category: 'Arcade',
    players: 'Party Leaderboard',
    icon: '🍿',
    artwork: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=600&h=400&fit=crop&q=80',
    description: 'Fast-paced party reflex clicker. Catch popping corn before they burn to rack up combos and high scores.'
  }
];

export interface GameLoungeProps {
  roomId?: string;
  myUserId?: string;
  myUserName?: string;
  members?: any[];
  sendGameAction?: (payload: any) => void;
  registerGameListener?: (listener: (senderId: string, payload: any) => void) => () => void;
  onBackToCinema?: () => void;
  onLaunchParty?: () => void;
  isCompact?: boolean;
  hideHeader?: boolean;
}

export const GameLounge: React.FC<GameLoungeProps> = ({
  onBackToCinema,
  onLaunchParty,
  isCompact = false,
  hideHeader = true
}) => {
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [notifiedGameId, setNotifiedGameId] = useState<string | null>(null);

  return (
    <div className={`w-full text-white ${isCompact ? 'text-xs' : ''}`}>
      {/* Top Header Bar - only shown if hideHeader is explicitly false */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#131520] border-b border-white/[0.08] rounded-2xl mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-md shadow-violet-600/30">
              <Gamepad2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">Party Game Arcade</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#6355ff]/20 text-[#8c82ff] border border-[#6355ff]/30">
                  12 PARTY GAMES
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onLaunchParty && (
              <button
                onClick={onLaunchParty}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Launch Party</span>
              </button>
            )}

            {onBackToCinema && (
              <button
                onClick={onBackToCinema}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold transition"
              >
                Back to Cinema
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4-Column Game Cards Grid (100% Full Width) */}
      <div className="w-full">
        <div className={`grid gap-4 w-full ${isCompact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4'}`}>
          {GAMES_CATALOG.map((game) => (
            <div
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="group relative h-44 sm:h-48 rounded-2xl bg-[#141521] border border-white/[0.08] hover:border-violet-500/60 hover:shadow-xl hover:shadow-violet-600/20 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between p-4 sm:p-5 select-none w-full"
            >
              {/* Right Side Themed Artwork with Seamless Left Fade */}
              <div className="absolute right-0 top-0 bottom-0 w-[58%] pointer-events-none overflow-hidden flex items-center justify-end">
                <img
                  src={game.artwork}
                  alt={game.title}
                  className="h-full w-full object-cover object-center group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                />
                {/* Gradient blend mask from left to right */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#141521] via-[#141521]/70 to-transparent" />
              </div>

              {/* Top Left Badge matching reference pill */}
              <div className="relative z-10">
                {game.badge && (
                  <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide text-white bg-[#6355ff] shadow-md shadow-indigo-600/30">
                    {game.badge}
                  </span>
                )}
              </div>

              {/* Bottom Left Bold Logo Typography */}
              <div className="relative z-10 space-y-0.5 max-w-[65%]">
                <div className="text-base sm:text-lg md:text-xl font-black uppercase tracking-tight text-white group-hover:text-violet-300 transition-colors drop-shadow-md leading-tight">
                  {game.title}
                </div>
                <div className="text-[11px] text-zinc-400 font-medium tracking-wide truncate">
                  {game.subtext}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMING SOON MODAL (Triggered on click of any card)                        */}
      {/* ========================================================================= */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#151724] border border-white/10 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative text-center">
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedGame(null);
                setNotifiedGameId(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Glowing Game Icon & Artwork */}
            <div className="relative w-24 h-24 rounded-3xl mx-auto overflow-hidden shadow-2xl shadow-violet-600/30 border-2 border-white/20">
              <img
                src={selectedGame.artwork}
                alt={selectedGame.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-3xl">
                {selectedGame.icon}
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6355ff]/15 text-[#8c82ff] text-xs font-bold border border-[#6355ff]/30 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>COMING SOON</span>
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                {selectedGame.title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                {selectedGame.description}
              </p>
            </div>

            {/* Specs Box */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Category:</span>
                <span className="font-bold text-white">{selectedGame.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Player Capacity:</span>
                <span className="font-bold text-white">{selectedGame.players} (Max 6 / Room)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Sync Engine:</span>
                <span className="font-bold text-emerald-400">Cristian NTP Sub-15ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Status:</span>
                <span className="font-bold text-amber-400">Coming Soon to Watch Party 🚀</span>
              </div>
            </div>

            {/* Notification / Action Buttons */}
            {notifiedGameId === selectedGame.id ? (
              <div className="py-2.5 px-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
                <Check className="w-4 h-4" />
                <span>You will be notified as soon as {selectedGame.title} launches!</span>
              </div>
            ) : (
              <button
                onClick={() => setNotifiedGameId(selectedGame.id)}
                className="w-full py-3 px-4 bg-[#6355ff] hover:bg-[#5244e6] text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 active:scale-95"
              >
                <Bell className="w-4 h-4" />
                <span>Notify Me on Launch</span>
              </button>
            )}

            <button
              onClick={() => {
                setSelectedGame(null);
                setNotifiedGameId(null);
              }}
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
