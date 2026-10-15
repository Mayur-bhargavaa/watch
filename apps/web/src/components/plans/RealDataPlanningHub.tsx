'use client';

import { PersonAvatar } from './PersonAvatar';
import { AppIcon, isIconName } from '../ui/AppIcon';
import React from 'react';
import { Flame } from 'lucide-react';

export interface RealMovieItem {
  id: string;
  title: string;
  duration: string;
  tag: string;
  poster: string;
  url: string;
  description: string;
}

export interface RealGameItem {
  gameId: string;
  title: string;
  icon: string;
  players: string;
  tag: string;
  description: string;
  url: string;
}

export interface RealFriendItem {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  partnerCode: string;
  streakCount?: number;
  isOnline?: boolean;
}

interface RealDataPlanningHubProps {
  onSelectMovie: (movie: RealMovieItem) => void;
  onSelectGame: (game: RealGameItem) => void;
  onSelectFriend: (friend: RealFriendItem) => void;
  onOpenGeneralCreate: () => void;
  friends: RealFriendItem[];
  userFriendCode?: string;
}

export const REAL_MOVIES: RealMovieItem[] = [
  {
    id: 'movie-interstellar',
    title: 'Interstellar: 4K IMAX Experience',
    duration: '2h 49m',
    tag: 'Sci-Fi • 4K HDR',
    poster: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    description: 'Christopher Nolan’s cosmic masterpiece ready for high-fidelity synchronized playback.'
  },
  {
    id: 'movie-tears-of-steel',
    title: 'Tears of Steel: 4K Cyberpunk',
    duration: '12m',
    tag: 'Action • Sci-Fi • 4K',
    poster: 'https://img.youtube.com/vi/R6MlUcmOul8/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=R6MlUcmOul8',
    description: 'Cyberpunk dystopian short film set in Amsterdam with synchronized surround sound.'
  },
  {
    id: 'movie-cyberpunk',
    title: 'Cyberpunk 2077: Phantom Liberty',
    duration: '1h 15m',
    tag: 'Gaming Cinema • 4K 60fps',
    poster: 'https://img.youtube.com/vi/qIcTM8WXFjk/maxresdefault.jpg',
    url: 'https://www.youtube.com/watch?v=qIcTM8WXFjk',
    description: 'High octane Night City cinematic story stream with full atmospheric lighting.'
  },
  {
    id: 'movie-lofigirl',
    title: 'Lofi Girl: Chill Lounge Beats',
    duration: '24/7 Live',
    tag: 'Ambient • Study & Chill',
    poster: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    description: 'Cozy lo-fi audio session perfect for late night study, chat, and relaxing together.'
  }
];

export const REAL_GAMES: RealGameItem[] = [
  {
    gameId: 'ludo',
    title: 'Ludo Party',
    icon: 'dice',
    players: '2-4 Players',
    tag: 'Board Game',
    description: 'Roll dice, knock out opponent tokens, and race all four pieces safely home.',
    url: '/games/ludo'
  },
  {
    gameId: 'four-in-a-row',
    title: 'Four in a Row',
    icon: 'dot',
    players: '2 Players',
    tag: 'Tactical Duel',
    description: 'Drop tokens into the vertical grid and connect four before your rival.',
    url: '/games/four-in-a-row'
  },
  {
    gameId: 'tic-tac-toe',
    title: 'Tic-Tac-Toe Quickfire',
    icon: 'close',
    players: '2 Players',
    tag: 'Fast-Paced',
    description: 'Quickfire 3x3 rounds with instant tie-breakers and live score tracking.',
    url: '/games/tic-tac-toe'
  }
];

const SECTION = 'text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500';
const ROW = 'flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151022] hover:border-slate-300 dark:hover:border-white/20 transition';
const PLAN_BTN = 'px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-[#ee1d49] text-slate-700 dark:text-zinc-200 hover:text-white text-xs font-bold transition shrink-0 cursor-pointer';

/** Shown on the Upcoming tab when there are no plans yet: quick starting points, one compact row each. */
export const RealDataPlanningHub: React.FC<RealDataPlanningHubProps> = ({ onSelectMovie, onSelectGame, onSelectFriend, onOpenGeneralCreate, friends, userFriendCode }) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">No upcoming plans</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Start from a movie, a game or a friend below, or build one from scratch.</p>
        </div>
        <button type="button" onClick={onOpenGeneralCreate} className="px-4 py-2 rounded-full bg-[#ee1d49] hover:bg-[#ff2b5e] text-white text-xs font-bold transition cursor-pointer shrink-0">
          Create a plan
        </button>
      </div>

      <section className="space-y-2">
        <h3 className={SECTION}>Movies</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {REAL_MOVIES.map((movie) => (
            <div key={movie.id} className={ROW}>
              <img src={movie.poster} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover bg-slate-200 dark:bg-zinc-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{movie.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {movie.duration} · {movie.tag}
                </div>
              </div>
              <button type="button" onClick={() => onSelectMovie(movie)} className={PLAN_BTN}>
                Plan
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={SECTION}>Games</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {REAL_GAMES.map((game) => (
            <div key={game.gameId} className={ROW}>
              <span className="w-12 h-12 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0"><AppIcon name={isIconName(game.icon) ? game.icon : 'game'} className="w-6 h-6 text-violet-500" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{game.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {game.players} · {game.tag}
                </div>
              </div>
              <button type="button" onClick={() => onSelectGame(game)} className={PLAN_BTN}>
                Plan
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={SECTION}>Friends</h3>
          {userFriendCode && (
            <span className="text-[11px] font-mono text-slate-400">
              Your code: <span className="font-bold text-slate-600 dark:text-zinc-300">{userFriendCode}</span>
            </span>
          )}
        </div>
        {friends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {friends.map((friend) => (
              <div key={friend.userId} className={ROW}>
                <div className="relative shrink-0">
                  <PersonAvatar name={friend.displayName} src={friend.avatarUrl} className="w-10 h-10" />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#151022] ${friend.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{friend.displayName}</div>
                  {friend.streakCount ? (
                    <div className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold">
                      <Flame className="w-3 h-3" /> {friend.streakCount} day streak
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={() => onSelectFriend(friend)} className={PLAN_BTN}>
                  Plan
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${ROW} justify-between`}>
            <p className="text-xs text-slate-500 dark:text-zinc-400 px-1">Add friends with your code to invite them to plans.</p>
            {userFriendCode && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(userFriendCode).catch((err) => console.warn('[plans] copy failed:', err));
                }}
                className={PLAN_BTN}
              >
                Copy code
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
