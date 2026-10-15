/**
 * Plan date/time helpers shared by the server (reminders, "past" state) and the web app (calendar export, display).
 * A plan stores a calendar date (YYYY-MM-DD), a free-form start/end time ("9:00 PM", "21:00") and a timezone label
 * ("IST (UTC+5:30)", "UTC", "EST"). Everything below turns that into real instants so nothing needs a stored `isPast`.
 */

const TZ_ABBREVIATIONS: Record<string, number> = {
  UTC: 0, GMT: 0, IST: 330, PKT: 300, BST: 60, CET: 60, CEST: 120, EET: 120, MSK: 180, GST: 240, SGT: 480, HKT: 480,
  JST: 540, KST: 540, AEST: 600, AEDT: 660, NZST: 720, EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360,
  PST: -480, PDT: -420
};

export const PLAN_TIMEZONES: { label: string; value: string }[] = [
  { label: 'India (IST, UTC+5:30)', value: 'IST (UTC+5:30)' },
  { label: 'UTC', value: 'UTC (UTC+0)' },
  { label: 'UK (GMT/BST)', value: 'GMT (UTC+0)' },
  { label: 'Central Europe (CET, UTC+1)', value: 'CET (UTC+1)' },
  { label: 'Gulf (GST, UTC+4)', value: 'GST (UTC+4)' },
  { label: 'Singapore (SGT, UTC+8)', value: 'SGT (UTC+8)' },
  { label: 'Japan (JST, UTC+9)', value: 'JST (UTC+9)' },
  { label: 'Sydney (AEST, UTC+10)', value: 'AEST (UTC+10)' },
  { label: 'US Eastern (EST, UTC-5)', value: 'EST (UTC-5)' },
  { label: 'US Central (CST, UTC-6)', value: 'CST (UTC-6)' },
  { label: 'US Pacific (PST, UTC-8)', value: 'PST (UTC-8)' }
];

/** Offset from UTC in minutes for a timezone label; unknown labels count as UTC. */
export function parseTimezoneOffsetMinutes(label: string | undefined | null): number {
  const text = (label || '').trim();
  const m = /UTC\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i.exec(text);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
  }
  const abbr = /^[A-Za-z]{2,5}/.exec(text)?.[0]?.toUpperCase();
  if (abbr && abbr in TZ_ABBREVIATIONS) return TZ_ABBREVIATIONS[abbr];
  return 0;
}

/** "9:00 PM", "9 pm", "21:00", "9:30PM" → minutes after midnight, or null when it is not a time. */
export function parseTimeOfDay(text: string | undefined | null): number | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp])?\.?[Mm]?\.?\s*$/.exec(text || '');
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] || 0);
  const meridiem = m[3]?.toLowerCase();
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'p' && hours !== 12) hours += 12;
    if (meridiem === 'a' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** "21:00" (from <input type="time">) → "9:00 PM". Returns the input unchanged when it is already not HH:MM. */
export function formatTime12(value: string): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) return value;
  const h24 = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, '0');
  return `${h24 % 12 === 0 ? 12 : h24 % 12}:${mm} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

/** "9:00 PM" → "21:00" for <input type="time"> (empty when unparseable). */
export function toTimeInputValue(text: string | undefined | null): string {
  const minutes = parseTimeOfDay(text);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export const PLAN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPlanDate(date: string | undefined | null): date is string {
  if (typeof date !== 'string' || !PLAN_DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export interface PlanWindow {
  startMs: number;
  endMs: number;
}

export interface PlanTimeFields {
  date: string;
  time: string;
  endTime?: string | null;
  timezone?: string | null;
}

/** Real start/end instants (ms since epoch) of a plan; null when the date or start time is invalid. */
export function getPlanWindow(plan: PlanTimeFields): PlanWindow | null {
  if (!isValidPlanDate(plan.date)) return null;
  const start = parseTimeOfDay(plan.time);
  if (start === null) return null;
  const [y, m, d] = plan.date.split('-').map(Number);
  const offset = parseTimeZoneSafe(plan.timezone);
  const startMs = Date.UTC(y, m - 1, d, 0, start) - offset * 60_000;
  const end = parseTimeOfDay(plan.endTime);
  // No end time: assume 3 hours. An end before the start means it finishes after midnight.
  const endMinutes = end === null ? start + 180 : end <= start ? end + 24 * 60 : end;
  return { startMs, endMs: Date.UTC(y, m - 1, d, 0, endMinutes) - offset * 60_000 };
}

function parseTimeZoneSafe(label: string | undefined | null): number {
  return parseTimezoneOffsetMinutes(label);
}

/** A plan is past once its end has gone by. Plans with an unreadable time are judged by the end of their date. */
export function isPlanPast(plan: PlanTimeFields, now: number = Date.now()): boolean {
  const w = getPlanWindow(plan);
  if (w) return w.endMs < now;
  if (!isValidPlanDate(plan.date)) return false;
  const [y, m, d] = plan.date.split('-').map(Number);
  return Date.UTC(y, m - 1, d + 1) < now;
}

/** "Sunday, September 27" computed from the date itself (no timezone drift, no stored text to go out of sync). */
export function formatPlanDate(date: string | undefined | null, locale = 'en-US'): string {
  if (!isValidPlanDate(date)) return 'Date not set';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Local calendar date (YYYY-MM-DD) of `now` in the viewer's timezone. */
export function todayDateString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type PlanRecurrence = 'weekly' | 'monthly' | 'none' | undefined | null;

/** The date of the next occurrence of a recurring plan (null for non-recurring or invalid). */
export function nextOccurrenceDate(date: string, recurring: PlanRecurrence): string | null {
  if (!isValidPlanDate(date) || (recurring !== 'weekly' && recurring !== 'monthly')) return null;
  const [y, m, d] = date.split('-').map(Number);
  let next: Date;
  if (recurring === 'weekly') {
    next = new Date(Date.UTC(y, m - 1, d + 7));
  } else {
    next = new Date(Date.UTC(y, m, 1));
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(d, lastDay)); // 31 Jan → 28/29 Feb
  }
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

export const REMINDER_MINUTES: Record<string, number> = { '30m': 30, '1h': 60, '1d': 24 * 60 };
