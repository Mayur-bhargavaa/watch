'use client';

import React from 'react';
import Link from 'next/link';
import { Film, Play, Star, Clock } from 'lucide-react';
import { ChatMoviePayload } from '@/types/chat';

interface MovieShareMessageProps {
  movie: ChatMoviePayload;
  isSender: boolean;
}

export const MovieShareMessage: React.FC<MovieShareMessageProps> = ({ movie, isSender }) => {
  const watchUrl = movie.streamUrl
    ? `/room/create?videoUrl=${encodeURIComponent(movie.streamUrl)}&title=${encodeURIComponent(movie.title)}`
    : `/browse?search=${encodeURIComponent(movie.title)}`;

  return (
    <div
      className={`rounded-2xl overflow-hidden border transition-all duration-200 shadow-xs max-w-sm w-full ${
        isSender
          ? 'bg-rose-950/20 dark:bg-rose-950/30 border-rose-300/40 dark:border-rose-800/40 text-slate-900 dark:text-zinc-100'
          : 'bg-white dark:bg-zinc-900/90 border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-zinc-100'
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Poster */}
        <div className="w-20 h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-zinc-800 relative group">
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600">
              <Film className="w-6 h-6 mb-1" />
              <span className="text-[9px] uppercase font-bold tracking-wider">Movie</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-[#ee1d49] uppercase tracking-wider">
              <Film className="w-3 h-3" />
              <span>Cinema</span>
              {movie.rating && (
                <div className="flex items-center gap-0.5 text-amber-500 font-semibold ml-auto">
                  <Star className="w-3 h-3 fill-current" />
                  <span>{movie.rating}</span>
                </div>
              )}
            </div>

            <h4 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white line-clamp-1">
              {movie.title}
            </h4>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              {movie.year && <span>{movie.year}</span>}
              {movie.duration && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {movie.duration}
                </span>
              )}
            </div>

            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {movie.genres.slice(0, 2).map((g, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action */}
          <Link
            href={watchUrl}
            className="mt-2.5 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Watch Together</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
