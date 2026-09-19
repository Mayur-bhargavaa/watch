'use client';

import React from 'react';
import {
  Film,
  Gamepad2,
  Users,
  Play,
  Sparkles,
  Flame,
  Plus,
  Clock,
  ArrowRight
} from 'lucide-react';

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
    icon: '🎲',
    players: '2-4 Players',
    tag: 'Board Game',
    description: 'Roll dice, knock out opponent tokens, and race all four pieces safely home.',
    url: '/games/ludo'
  },
  {
    gameId: 'four-in-a-row',
    title: 'Four in a Row',
    icon: '🔴',
    players: '2 Players',
    tag: 'Tactical Duel',
    description: 'Drop tokens into the vertical grid and connect four before your rival.',
    url: '/games/four-in-a-row'
  },
  {
    gameId: 'tic-tac-toe',
    title: 'Tic-Tac-Toe Quickfire',
    icon: '❌',
    players: '2 Players',
    tag: 'Fast-Paced',
    description: 'Quickfire 3x3 rounds with instant tie-breakers and live score tracking.',
    url: '/games/tic-tac-toe'
  }
];

export const RealDataPlanningHub: React.FC<RealDataPlanningHubProps> = ({
  onSelectMovie,
  onSelectGame,
  onSelectFriend,
  onOpenGeneralCreate,
  friends,
  userFriendCode
}) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Real Data Banner Header */}
      <div className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-purple-500/10 border border-rose-200/60 dark:border-white/10 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Entertainment Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              No Plans Scheduled Yet
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-300 leading-relaxed">
              Pick a real 4K movie, a multiplayer game, or invite a friend below to launch your next shared event in one click.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenGeneralCreate}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#ff3b68] hover:bg-[#ee1d49] text-white text-xs font-black shadow-lg shadow-[#ff3b68]/25 hover:shadow-xl hover:shadow-[#ee1d49]/35 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Custom Plan</span>
          </button>
        </div>
      </div>

      {/* Section 1: Real 4K Cinema & Streams */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Curated 4K Cinema Streams
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
              {REAL_MOVIES.length} Available
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">1-Click Schedule</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REAL_MOVIES.map((movie) => (
            <div
              key={movie.id}
              className="group rounded-[24px] p-4 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] hover:border-rose-200 dark:hover:border-rose-500/30 shadow-xs hover:shadow-md transition-all flex gap-4 items-center"
            >
              {/* Poster Thumbnail */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-slate-900">
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                <div className="absolute bottom-1.5 right-1.5 p-1 rounded-full bg-black/60 backdrop-blur-xs text-white">
                  <Play className="w-3 h-3 fill-white" />
                </div>
              </div>

              {/* Info & CTA */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400">
                  {movie.tag}
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {movie.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-tight">
                  {movie.description}
                </p>

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {movie.duration}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectMovie(movie)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 hover:bg-[#ff3b68] text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                  >
                    <span>+ Plan Watch Party</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Real Multiplayer Games */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-500">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Multiplayer Games Engine
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
              Real-Time Play
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">No installs required</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {REAL_GAMES.map((game) => (
            <div
              key={game.gameId}
              className="group rounded-[24px] p-5 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] hover:border-purple-200 dark:hover:border-purple-500/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-2xl p-2 rounded-2xl bg-purple-50 dark:bg-purple-500/10">
                    {game.icon}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
                    {game.players}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {game.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-normal">
                    {game.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 dark:border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => onSelectGame(game)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <span>+ Plan Game Night</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Real Friends & Squad */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Your Squad
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
              {friends.length > 0 ? `${friends.length} Connected` : 'Connect Friends'}
            </span>
          </div>
          {userFriendCode && (
            <span className="text-xs font-mono font-bold text-slate-500">
              Code: <span className="text-rose-500">{userFriendCode}</span>
            </span>
          )}
        </div>

        {friends.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {friends.map((friend) => (
              <div
                key={friend.userId}
                className="p-3.5 rounded-[20px] bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] hover:border-emerald-200 dark:hover:border-emerald-500/30 flex items-center justify-between gap-3 shadow-xs transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={
                        friend.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friend.displayName)}`
                      }
                      alt={friend.displayName}
                      className="w-10 h-10 rounded-full object-cover bg-slate-100 dark:bg-white/10"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#151022] ${
                        friend.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {friend.displayName}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                      <Flame className="w-3 h-3 fill-amber-500" />
                      <span>{friend.streakCount ? `${friend.streakCount} Streak` : 'Streak Active'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectFriend(friend)}
                  className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-300 hover:text-white text-[11px] font-bold transition shrink-0 cursor-pointer"
                >
                  + Plan
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                Connect with Friends using your Partner Code
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Share your partner code so your friends can instantly RSVP and vote on plans.
              </p>
            </div>
            {userFriendCode && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                  {userFriendCode}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard?.writeText(userFriendCode);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
