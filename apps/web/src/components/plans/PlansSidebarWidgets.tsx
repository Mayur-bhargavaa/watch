'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Plan } from '../../types/plans';

interface PlansCalendarProps {
  plans: Plan[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Small month calendar: a dot marks days with plans, tapping a day filters the list. */
export const PlansCalendar: React.FC<PlansCalendarProps> = ({ plans, selectedDate, onSelectDate }) => {
  const [month, setMonth] = useState(() => new Date());
  const year = month.getFullYear();
  const m = month.getMonth();
  const today = new Date();

  const leading = new Date(year, m, 1).getDay(); // Sunday first, same as the streak calendar
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const planDates = new Set(plans.map((p) => p.date));

  const cells: (null | { day: number; dateStr: string; isToday: boolean; hasPlan: boolean })[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isToday: d === today.getDate() && m === today.getMonth() && year === today.getFullYear(), hasPlan: planDates.has(dateStr) });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#151022] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <div className="flex items-center gap-0.5 text-slate-500 dark:text-zinc-400">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, m - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, m + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((c, i) =>
          c ? (
            <button
              key={c.dateStr}
              type="button"
              onClick={() => onSelectDate(selectedDate === c.dateStr ? null : c.dateStr)}
              className={`relative h-8 w-8 mx-auto rounded-full text-xs font-semibold transition cursor-pointer ${
                selectedDate === c.dateStr
                  ? 'bg-[#ee1d49] text-white'
                  : c.isToday
                  ? 'ring-1 ring-[#ee1d49] text-[#ee1d49] font-bold'
                  : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {c.day}
              {c.hasPlan && selectedDate !== c.dateStr && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ee1d49]" />}
            </button>
          ) : (
            <span key={`e${i}`} />
          )
        )}
      </div>
    </div>
  );
};
