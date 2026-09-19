'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Film,
  Gamepad2,
  PartyPopper,
  Sparkles,
  Heart
} from 'lucide-react';

interface PlansSidebarWidgetsProps {
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
  counts?: {
    all: number;
    movies: number;
    games: number;
    birthdays: number;
  };
}

export const PlansSidebarWidgets: React.FC<PlansSidebarWidgetsProps> = ({
  activeFilter = 'ALL',
  onSelectFilter,
  counts = { all: 3, movies: 1, games: 1, birthdays: 1 }
}) => {
  const [selectedDay, setSelectedDay] = useState(27);

  // Month days setup for September (Mon - Sun)
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // September 2024 calendar grid matching screenshot
  // 1 is Sun (prev Aug 26-31), Mon 2 to 30
  const calendarDays = [
    { day: 26, isCurrentMonth: false },
    { day: 27, isCurrentMonth: false },
    { day: 28, isCurrentMonth: false },
    { day: 29, isCurrentMonth: false },
    { day: 30, isCurrentMonth: false },
    { day: 31, isCurrentMonth: false },
    { day: 1, isCurrentMonth: true },
    { day: 2, isCurrentMonth: true },
    { day: 3, isCurrentMonth: true },
    { day: 4, isCurrentMonth: true, hasDot: true },
    { day: 5, isCurrentMonth: true },
    { day: 6, isCurrentMonth: true, hasDot: true },
    { day: 7, isCurrentMonth: true },
    { day: 8, isCurrentMonth: true },
    { day: 9, isCurrentMonth: true, hasDot: true },
    { day: 10, isCurrentMonth: true },
    { day: 11, isCurrentMonth: true },
    { day: 12, isCurrentMonth: true },
    { day: 13, isCurrentMonth: true },
    { day: 14, isCurrentMonth: true },
    { day: 15, isCurrentMonth: true },
    { day: 16, isCurrentMonth: true },
    { day: 17, isCurrentMonth: true },
    { day: 18, isCurrentMonth: true },
    { day: 19, isCurrentMonth: true },
    { day: 20, isCurrentMonth: true },
    { day: 21, isCurrentMonth: true },
    { day: 22, isCurrentMonth: true },
    { day: 23, isCurrentMonth: true },
    { day: 24, isCurrentMonth: true },
    { day: 25, isCurrentMonth: true },
    { day: 26, isCurrentMonth: true },
    { day: 27, isCurrentMonth: true, isHighlighted: true },
    { day: 28, isCurrentMonth: true, hasDot: true },
    { day: 29, isCurrentMonth: true },
    { day: 30, isCurrentMonth: true },
    { day: 1, isCurrentMonth: false },
    { day: 2, isCurrentMonth: false },
    { day: 3, isCurrentMonth: false },
    { day: 4, isCurrentMonth: false },
    { day: 5, isCurrentMonth: false, hasDot: true },
    { day: 6, isCurrentMonth: false }
  ];

  return (
    <div className="space-y-6">
      {/* 1. CALENDAR WIDGET */}
      <div className="rounded-[28px] p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
            September 2024
          </h3>
          <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 dark:text-zinc-500 mb-2">
          {weekdays.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center">
          {calendarDays.map((item, idx) => {
            const isSelected = item.isCurrentMonth && item.day === selectedDay;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => item.isCurrentMonth && setSelectedDay(item.day)}
                className={`h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-semibold relative transition cursor-pointer ${
                  isSelected || item.isHighlighted
                    ? 'bg-[#ee1d49] text-white shadow-md shadow-[#ee1d49]/30 font-bold'
                    : item.isCurrentMonth
                    ? 'text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10'
                    : 'text-slate-300 dark:text-zinc-600'
                }`}
              >
                <span>{item.day}</span>
                {item.hasDot && !isSelected && !item.isHighlighted && (
                  <span className="w-1 h-1 rounded-full bg-[#ee1d49] absolute bottom-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. QUICK FILTERS WIDGET */}
      <div className="rounded-[28px] p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm space-y-3">
        <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight mb-3">
          Quick Filters
        </h4>

        <div className="space-y-1.5 text-xs font-bold">
          {/* All Plans */}
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter('ALL')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-rose-50 text-[#ee1d49] dark:bg-rose-500/10 dark:text-rose-400'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">📅</span>
              <span>All Plans</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
              {counts.all}
            </span>
          </button>

          {/* Movies */}
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter('movie')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition cursor-pointer ${
              activeFilter === 'movie'
                ? 'bg-rose-50 text-[#ee1d49] dark:bg-rose-500/10 dark:text-rose-400'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">🎬</span>
              <span>Movies</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
              {counts.movies}
            </span>
          </button>

          {/* Games */}
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter('game')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition cursor-pointer ${
              activeFilter === 'game'
                ? 'bg-rose-50 text-[#ee1d49] dark:bg-rose-500/10 dark:text-rose-400'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">🎮</span>
              <span>Games</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
              {counts.games}
            </span>
          </button>

          {/* Birthdays */}
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter('birthday')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition cursor-pointer ${
              activeFilter === 'birthday'
                ? 'bg-rose-50 text-[#ee1d49] dark:bg-rose-500/10 dark:text-rose-400'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">🎂</span>
              <span>Birthdays</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
              {counts.birthdays}
            </span>
          </button>
        </div>
      </div>

      {/* 3. CINEMA QUOTE CARD WIDGET */}
      <div className="relative rounded-[28px] overflow-hidden shadow-md h-52 group cursor-pointer">
        {/* Background Image: Red velvet theater seats */}
        <img
          src="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80"
          alt="Cinema Seats"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.45]"
        />

        {/* Ambient Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

        {/* Text Content Overlay */}
        <div className="relative h-full p-6 flex flex-col justify-between text-white z-10 select-none">
          <div className="space-y-1">
            <h4 className="text-base font-black tracking-tight text-white/95">
              More than movies.
            </h4>
            <p className="text-xs text-white/80 font-medium">
              A place for your people.
            </p>
          </div>

          <div className="text-rose-400 text-lg">
            ❤️
          </div>
        </div>
      </div>
    </div>
  );
};
