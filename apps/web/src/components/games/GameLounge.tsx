'use client';

import { NotifyMeButton, useGameInterest } from './NotifyMeButton';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon, isIconName } from '../ui/AppIcon';
import { Gamepad2, Sparkles, Clock, X, Lock } from 'lucide-react';
import { UPCOMING_GAMES, TIER_INFO, tierAtLeast } from '@synccinema/common';
import { useMyMembership } from '../membership/useMyMembership';

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
  /** pass needed to unlock a coming-soon game, or to HOST a live VIP game (anyone can join) */
  tier?: 'plus' | 'creator';
}

export const GAMES_CATALOG: GameItem[] = [
  {
    id: 'ludo',
    title: 'LUDO PARTY',
    subtext: 'Classic 4-Player Board',
    badge: 'Live Multiplayer',
    badgeColor: 'bg-rose-600 text-white shadow-rose-600/30',
    category: 'Board Game',
    players: '2-4 Players',
    icon: 'dice',
    artwork: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600&h=400&fit=crop&q=80',
    description: 'Roll the dice, race your 4 tokens across the board, land on safe stars, and send opponent tokens back to base.'
  },
  {
    id: 'connect4',
    title: 'FOUR IN A ROW',
    subtext: 'Vertical Disc Duel',
    badge: 'Live 2-Player',
    badgeColor: 'bg-[#6355ff] text-white shadow-indigo-600/30',
    category: 'Strategy Arcade',
    players: '2 Players',
    icon: 'dot',
    artwork: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=400&fit=crop&q=80',
    description: 'Drop red and yellow discs into the 7x6 arcade grid. Connect 4 horizontally, vertically, or diagonally before your rival.'
  },
  {
    id: 'tic-tac-toe',
    title: 'TIC TAC TOE',
    subtext: 'Neon 3-in-a-Row Duel',
    badge: 'Live 2-Player',
    badgeColor: 'bg-rose-600 text-white shadow-rose-600/30',
    category: 'Strategy Arcade',
    players: '2 Players',
    icon: 'close',
    artwork: 'https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?w=600&h=400&fit=crop&q=80',
    description: 'Fast-paced 3x3 tactical duel. Place Xs and Os, block opponent lines, and claim victory with live audio/video reactions.'
  },
  {
    id: 'bingo',
    title: 'BINGO DUEL',
    subtext: '1–25 Rapid Number Duel',
    badge: 'Live 2-Player',
    badgeColor: 'bg-indigo-600 text-white shadow-indigo-600/30',
    category: 'Pattern Duel',
    players: '2 Players',
    icon: 'target',
    artwork: '/images/card-bingo-duel.png',
    description: 'Fast-paced 5x5 board using numbers 1 to 25. Complete your chosen pattern and shout Bingo before your opponent!'
  },
  {
    id: 'tambola',
    title: 'TAMBOLA',
    subtext: 'Classic 90-Ball Housie',
    badge: 'Live Party',
    badgeColor: 'bg-cyan-600 text-white shadow-cyan-600/30',
    category: 'Social Party',
    players: '2–20 Players',
    icon: 'ticket',
    artwork: '/images/card-bingo-duel.png',
    description: 'Traditional 90-ball Housie with real-time automatic calling, synchronized 3x9 tickets, and multi-condition claims.'
  },
  {
    id: 'doodle-duel',
    title: 'DOODLE DUEL',
    subtext: 'Draw it. Guess it. Switch.',
    badge: 'Live 2-Player',
    badgeColor: 'bg-[#8755f8] text-white shadow-violet-600/30',
    category: 'Live Sketch',
    players: '2 Players',
    icon: 'palette',
    artwork: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&h=400&fit=crop&q=80',
    description: 'One player sketches a secret word while the other guesses in real time, then you switch sides.'
  },
  {
    id: 'chess',
    title: 'CHESS CINEMA',
    subtext: 'Grandmaster Board',
    badge: 'Live 2-Player',
    badgeColor: 'bg-amber-700 text-white shadow-amber-700/30',
    category: 'Classic Strategy',
    players: '2 Players',
    icon: 'crown',
    artwork: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600&h=400&fit=crop&q=80',
    description: 'Classic chess with live move highlighting, turn clocks, checkmate validation, and party spectating.'
  },
  {
    id: 'imposter',
    title: 'IMPOSTER',
    subtext: 'Clue, bluff and vote',
    badge: 'Live Party',
    badgeColor: 'bg-violet-600 text-white shadow-violet-600/30',
    category: 'Social Deduction',
    players: '4-8 Players',
    icon: 'ghost',
    artwork: '/images/card-cinema-trivia.png',
    description: 'Everyone gets the secret word except one player. Give one-word clues, discuss and vote out the imposter. VIP hosts the room; anyone can join.',
    tier: 'plus'
  },
  {
    id: 'emoji-charades',
    title: 'EMOJI CHARADES',
    subtext: 'Guess the movie from emoji',
    badge: 'Live Party',
    badgeColor: 'bg-violet-600 text-white shadow-violet-600/30',
    category: 'Movie Puzzle',
    players: '2-8 Players',
    icon: 'popcorn',
    artwork: '/images/card-cinema-trivia.png',
    description: 'Race your friends to guess a movie or show from a string of emoji. Hints appear as the clock runs. VIP hosts the room; anyone can join.',
    tier: 'plus'
  },
  {
    id: 'mafia',
    title: 'MAFIA NIGHT',
    subtext: 'Secret roles, night and day',
    badge: 'Live Party',
    badgeColor: 'bg-violet-600 text-white shadow-violet-600/30',
    category: 'Social Deduction',
    players: '5-10 Players',
    icon: 'skull',
    artwork: '/images/card-chess-arena.png',
    description: 'Mafia, Doctor, Detective and Villagers. The mafia strike at night, the town votes by day. VIP hosts the room; anyone can join.',
    tier: 'plus'
  },
  {
    id: 'quiz-show',
    title: 'QUIZ SHOW STUDIO',
    subtext: 'Host a live quiz for your community',
    badge: 'Live Party',
    badgeColor: 'bg-violet-600 text-white shadow-violet-600/30',
    category: 'Live Quiz',
    players: 'Up to 30 Players',
    icon: 'trophy',
    artwork: '/images/card-cinema-trivia.png',
    description: 'Write your own questions, run them live with buzzers and a leaderboard. The Creator Pass hosts the quiz; anyone can join.',
    tier: 'creator'
  },
  {
    id: 'murder-mystery',
    title: 'MURDER MYSTERY NIGHT',
    subtext: 'A whodunit for the whole group',
    badge: 'Live Party',
    badgeColor: 'bg-violet-600 text-white shadow-violet-600/30',
    category: 'Mystery Party',
    players: '6-12 Players',
    icon: 'search',
    artwork: '/images/card-chess-arena.png',
    description: 'Everyone is a suspect. Trade clues, whisper and bluff, then accuse the murderer. The Creator Pass hosts the room; anyone can join.',
    tier: 'creator'
  },
  {
    id: 'tournament',
    title: 'TOURNAMENT ARENA',
    subtext: 'Knockout brackets for your community',
    badge: 'Live Party',
    badgeColor: 'bg-violet-600 text-white shadow-violet-600/30',
    category: 'Community Event',
    players: '4-32 Players',
    icon: 'trophy',
    artwork: '/images/card-chess-arena.png',
    description: 'Run a bracket of 1v1 matches with seeding, byes and a champion screen. The Creator Pass organises the tournament; anyone can join and play.',
    tier: 'creator'
  }
];

const UPCOMING_ART = ['/images/card-cinema-trivia.png', '/images/card-doodle-duel.png', '/images/card-tictactoe.png', '/images/card-bingo-duel.png', '/images/card-chess-arena.png', '/images/card-four-in-row.png'];
const UPCOMING_CATALOG: GameItem[] = UPCOMING_GAMES.map((g, i) => ({
  id: g.id,
  title: g.title.toUpperCase(),
  subtext: g.category,
  badge: 'Coming Soon',
  badgeColor: 'bg-white/10 text-zinc-300 border border-white/15',
  category: g.category,
  players: g.players,
  icon: g.icon,
  artwork: UPCOMING_ART[i % UPCOMING_ART.length],
  description: g.blurb,
  tier: g.tier
}));
GAMES_CATALOG.push(...UPCOMING_CATALOG);

export interface GameLoungeProps {
  roomId?: string;
  myUserId?: string;
  myUserName?: string;
  members?: any[];
  sendGameAction?: (payload: any) => void;
  registerGameListener?: (listener: (senderId: string, payload: any) => void) => () => void;
  onBackToCinema?: () => void;
  onLaunchParty?: () => void;
  onSelectInRoomGame?: (gameId: 'tictactoe' | 'connect4') => void;
  isCompact?: boolean;
  hideHeader?: boolean;
}

export const GameLounge: React.FC<GameLoungeProps> = ({
  onBackToCinema,
  onLaunchParty,
  onSelectInRoomGame,
  isCompact = false,
  hideHeader = true
}) => {
  const router = useRouter();
  const interest = useGameInterest();
  const myTier = useMyMembership()?.tier ?? 'free';
  const [toast, setToast] = useState<{ game: GameItem; id: number } | null>(null);
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleGameCardClick = (game: GameItem) => {
    if (onSelectInRoomGame && (game.id === 'tic-tac-toe' || game.id === 'tictactoe')) {
      onSelectInRoomGame('tictactoe');
      return;
    }
    if (onSelectInRoomGame && (game.id === 'connect4' || game.id === 'four-in-a-row')) {
      onSelectInRoomGame('connect4');
      return;
    }

    if (game.id === 'ludo') {
      router.push('/games/ludo');
      return;
    }
    if (game.id === 'connect4' || game.id === 'four-in-a-row') {
      router.push('/games/four-in-a-row');
      return;
    }
    if (game.id === 'tic-tac-toe' || game.id === 'tictactoe') {
      router.push('/games/tic-tac-toe');
      return;
    }
    if (game.id === 'bingo') {
      router.push('/games/bingo');
      return;
    }
    if (game.id === 'tambola') {
      router.push('/games/tambola');
      return;
    }
    if (game.id === 'chess') {
      router.push('/games/chess');
      return;
    }
    if (game.id === 'doodle-duel') {
      router.push('/games/doodle-duel');
      return;
    }
    if (game.id === 'imposter') {
      router.push('/games/imposter');
      return;
    }
    if (game.id === 'emoji-charades') {
      router.push('/games/emoji-charades');
      return;
    }
    if (game.id === 'mafia') {
      router.push('/games/mafia');
      return;
    }
    if (game.id === 'quiz-show') {
      router.push('/games/quiz-show');
      return;
    }
    if (game.id === 'murder-mystery') {
      router.push('/games/murder-mystery');
      return;
    }
    if (game.id === 'tournament') {
      router.push('/games/tournament');
      return;
    }

    // Trigger Coming Soon Toast
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ game, id: Date.now() });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

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
              onClick={() => handleGameCardClick(game)}
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

              {/* Top Left Badge matching status */}
              <div className="relative z-10">
                {game.badge && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide shadow-md ${
                      game.badgeColor || 'bg-[#6355ff] text-white shadow-indigo-600/30'
                    }`}
                  >
                    {game.id !== 'ludo' && game.id !== 'connect4' && (
                      <Clock className="w-3 h-3 text-amber-300" />
                    )}
                    <span>{game.badge}</span>
                  </span>
                )}
                {game.tier && (
                  <span
                    className={`ml-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                      game.tier === 'creator' ? 'bg-violet-500/20 text-violet-200 border-violet-400/30' : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                    }`}
                    title={tierAtLeast(myTier, game.tier) ? 'Included in your pass' : game.badge === 'Coming Soon' ? `Unlocks with ${TIER_INFO[game.tier].badgeLabel}` : `${TIER_INFO[game.tier].badgeLabel} to host. You can still join a friend's game.`}
                  >
                    {!tierAtLeast(myTier, game.tier) && <Lock className="w-3 h-3" aria-label="Locked" />}
                    {game.tier === 'creator' ? 'Creator' : 'VIP'}
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
                {game.badge === 'Coming Soon' && <NotifyMeButton gameId={game.id} state={interest} className="pt-1.5" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMING SOON FLOATING TOAST NOTIFICATION                                   */}
      {/* ========================================================================= */}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] p-4 rounded-2xl bg-[#141524]/95 border border-white/20 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_25px_rgba(99,85,255,0.25)] text-white animate-in slide-in-from-bottom-5 fade-in duration-200"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600/30 to-indigo-600/30 border border-violet-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
              <AppIcon name={isIconName(toast.game.icon) ? toast.game.icon : 'game'} className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" />
                  Coming Soon
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {toast.game.category}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-white truncate">
                {toast.game.title}
              </h4>
              <p className="text-xs text-zinc-300/90 mt-0.5 leading-relaxed">
                {toast.game.tier
                  ? `This game is in development and will unlock with ${TIER_INFO[toast.game.tier].badgeLabel}. Tap Notify me to hear when it launches.`
                  : 'This game is currently under development. Stay tuned for the upcoming release!'}
              </p>
            </div>

            <button
              onClick={() => setToast(null)}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shrinking progress bar */}
          <div className="mt-3 w-full bg-white/10 h-1 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-amber-500 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
};
