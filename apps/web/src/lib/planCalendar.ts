import { getPlanWindow, type PlanTimeFields } from '@synccinema/common';

const pad = (n: number) => String(n).padStart(2, '0');

/** 20261201T153000Z */
export function toCalendarUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** RFC 5545 text escaping: a title or description can never add lines/fields to the file. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line at 75 octets (continuation lines start with one space). */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (bytes + len > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out.join('\r\n ');
}

interface CalendarPlan extends PlanTimeFields {
  id: string;
  title: string;
  description?: string | null;
}

export function buildIcs(plan: CalendarPlan, joinUrl: string, now: number = Date.now()): string | null {
  const w = getPlanWindow(plan);
  if (!w) return null;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StitchByte//Watch Plans//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${plan.id.replace(/[^A-Za-z0-9_-]/g, '')}@stitchbyte.in`,
    `DTSTAMP:${toCalendarUtc(now)}`,
    `DTSTART:${toCalendarUtc(w.startMs)}`,
    `DTEND:${toCalendarUtc(w.endMs)}`,
    `SUMMARY:${escapeIcsText(plan.title)}`,
    `DESCRIPTION:${escapeIcsText(`${plan.description || ''}\n\nJoin: ${joinUrl}`.trim())}`,
    'LOCATION:Online Watch Party',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(plan: CalendarPlan, joinUrl: string): string | null {
  const w = getPlanWindow(plan);
  if (!w) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: plan.title,
    dates: `${toCalendarUtc(w.startMs)}/${toCalendarUtc(w.endMs)}`,
    details: `${plan.description || ''}\n\nJoin: ${joinUrl}`.trim(),
    location: 'Watch App (Online)'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
