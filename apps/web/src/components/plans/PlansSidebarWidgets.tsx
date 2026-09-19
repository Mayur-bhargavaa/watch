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
  Heart,
  X
} from 'lucide-react';
import { Plan } from '../../types/plans';

interface PlansSidebarWidgetsProps {
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
  counts?: {
    all: number;
    movies: number;
    games: number;
    birthdays: number;
  };
  plans?: Plan[];
  selectedDate?: string | null;
  onSelectDate?: (dateStr: string | null) => void;
}

interface CalendarDayItem {
  day: number;
  isCurrentMonth: boolean;
  dateStr: string | null;
  isToday: boolean;
  hasDot: boolean;
}

export const PlansSidebarWidgets: React.FC<PlansSidebarWidgetsProps> = ({
  activeFilter = 'ALL',
  onSelectFilter,
  counts = { all: 0, movies: 0, games: 0, birthdays: 0 },
  plans = [],
  selectedDate = null,
  onSelectDate
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());

  const today = new Date();
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const monthYearDisplay = currentMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  // Weekday labels (Mon - Sun)
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Real calendar grid calculation
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday is 0, Sunday is 6
  const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

  const prevMonthDaysCount = new Date(year, month, 0).getDate();
  const calendarDays: CalendarDayItem[] = [];

  // Trailing days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthDaysCount - i,
      isCurrentMonth: false,
      dateStr: null,
      isToday: false,
      hasDot: false
    });
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
    const hasDot = plans.some((p) => p.date === dateStr);

    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      dateStr,
      isToday,
      hasDot
    });
  }

  // Leading days from next month to complete the row
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let n = 1; n <= remainingCells; n++) {
    calendarDays.push({
      day: n,
      isCurrentMonth: false,
      dateStr: null,
      isToday: false,
      hasDot: false
    });
  }

  const handleDayClick = (item: typeof calendarDays[0]) => {
    if (!item.isCurrentMonth || !item.dateStr) return;
    if (selectedDate === item.dateStr) {
      onSelectDate?.(null);
    } else {
      onSelectDate?.(item.dateStr);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. REAL CALENDAR WIDGET */}
      <div className="rounded-[28px] p-6 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              {monthYearDisplay}
            </h3>
            {selectedDate && (
              <button
                type="button"
                onClick={() => onSelectDate?.(null)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 mt-0.5"
              >
                <span>Filtered to {selectedDate}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              title="Next Month"
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
            const isSelected = Boolean(item.dateStr && selectedDate === item.dateStr);
            return (
              <button
                key={idx}
                type="button"
                disabled={!item.isCurrentMonth}
                onClick={() => handleDayClick(item)}
                className={`h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-semibold relative transition ${
                  item.isCurrentMonth ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isSelected
                    ? 'bg-[#ee1d49] text-white shadow-md shadow-[#ee1d49]/30 font-bold scale-105'
                    : item.isToday
                    ? 'ring-2 ring-[#ee1d49]/70 text-[#ee1d49] dark:text-rose-400 font-bold bg-rose-50/50 dark:bg-rose-500/10'
                    : item.isCurrentMonth
                    ? 'text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10'
                    : 'text-slate-300 dark:text-zinc-600'
                }`}
              >
                <span>{item.day}</span>
                {item.hasDot && !isSelected && (
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
