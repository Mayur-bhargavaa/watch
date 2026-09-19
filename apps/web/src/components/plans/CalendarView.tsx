'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Plan } from '../../types/plans';

interface CalendarViewProps {
  plans: Plan[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ plans }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 8, 1)); // September 2026 as base
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-09-27'); // default selected

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Days in month
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map plans by date string YYYY-MM-DD
  const plansByDate: { [key: string]: Plan[] } = {};
  plans.forEach((p) => {
    if (!plansByDate[p.date]) plansByDate[p.date] = [];
    plansByDate[p.date].push(p);
  });

  const selectedPlans = plansByDate[selectedDateStr] || [];

  const getDotColor = (type: string) => {
    switch (type) {
      case 'movie':
        return 'bg-rose-500';
      case 'game':
        return 'bg-violet-500';
      case 'birthday':
        return 'bg-amber-500';
      case 'anniversary':
        return 'bg-pink-500';
      case 'party':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Calendar Card */}
      <div className="rounded-3xl p-6 md:p-8 bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] shadow-sm max-w-xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {monthNames[month]} {year}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Tap a date with dots to preview plans
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 dark:text-zinc-500">
          {daysOfWeek.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Leading empty days */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-12 md:h-14" />
          ))}

          {/* Actual days */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;
            const dayPlans = plansByDate[dateStr] || [];
            const isSelected = selectedDateStr === dateStr;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDateStr(dateStr)}
                className={`h-12 md:h-14 rounded-2xl flex flex-col items-center justify-center p-1 relative transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ee1d49] text-white shadow-md shadow-[#ee1d49]/30 font-black scale-105'
                    : dayPlans.length > 0
                    ? 'bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white font-bold hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                    : 'text-slate-700 dark:text-zinc-400 hover:bg-slate-100/50 dark:hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-xs md:text-sm">{dayNum}</span>

                {/* Event Dots */}
                {dayPlans.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {dayPlans.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : getDotColor(p.type)
                        }`}
                      />
                    ))}
                    {dayPlans.length > 3 && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-slate-400'
                        }`}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plans on Selected Date */}
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#ee1d49]" />
            <span>
              Plans on{' '}
              {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </h4>
          <span className="text-xs font-semibold text-slate-400">
            {selectedPlans.length} {selectedPlans.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {selectedPlans.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-50/50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-400">
            No plans scheduled for this day yet.
          </div>
        ) : (
          <div className="space-y-3">
            {selectedPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/plans/${plan.id}`}
                className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#151022] border border-slate-200/80 dark:border-white/[0.06] hover:border-[#ee1d49]/40 transition shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xl shrink-0">
                    {plan.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ee1d49] transition-colors truncate">
                      {plan.title}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        {plan.time} · {plan.activities?.length || 0} activities
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[#ee1d49] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>View</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
