import { createHash } from 'node:crypto';

/**
 * Crash and error reports from the mobile app (`POST /api/client-errors`). Reports are cleaned (no tokens, emails or
 * long text), grouped by a fingerprint so one bug that hits many phones is ONE row with a counter, and kept 30 days.
 */
export const REPORT_FIELD_MAX = { message: 500, stack: 4000, where: 120, short: 40 } as const;

export interface ClientErrorReport {
  message: string;
  stack: string;
  /** the screen or part of the app (route name, "boundary", "global") */
  where: string;
  fatal: boolean;
  appVersion: string;
  platform: string;
  osVersion: string;
}

/** Removes what must never be stored: bearer tokens / JWTs, email addresses, long hex or base64 secrets. */
export function scrub(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [removed]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[token removed]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}/g, '[secret removed]');
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? scrub(v.slice(0, max * 2)) // cut first: cleaning a huge string must stay cheap
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '');

/** Cleans an untrusted body; null when there is nothing worth keeping (no message). */
export function cleanReport(body: unknown): ClientErrorReport | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const message = text(b.message, REPORT_FIELD_MAX.message).trim();
  if (!message) return null;
  return {
    message,
    stack: text(b.stack, REPORT_FIELD_MAX.stack),
    where: text(b.where, REPORT_FIELD_MAX.where) || 'unknown',
    fatal: b.fatal === true,
    appVersion: text(b.appVersion, REPORT_FIELD_MAX.short) || 'unknown',
    platform: text(b.platform, REPORT_FIELD_MAX.short) || 'unknown',
    osVersion: text(b.osVersion, REPORT_FIELD_MAX.short) || 'unknown',
  };
}

/** Same bug => same id: the message plus the first stack lines with line/column numbers and urls removed, and the app version. */
export function fingerprint(r: ClientErrorReport): string {
  const frames = r.stack.split('\n').slice(0, 4).map((l) => l.replace(/https?:\/\/\S+|\(.*?\)|:\d+(:\d+)?/g, '').trim()).join('|');
  return createHash('sha256').update(`${r.message.replace(/\d+/g, '#')}|${frames}|${r.appVersion}`).digest('hex').slice(0, 24);
}

export interface ClientErrorSink {
  /** stores / counts one report; resolves true when this fingerprint had not been seen before */
  record(id: string, report: ClientErrorReport, now: number): Promise<boolean>;
}

export class MemoryClientErrorSink implements ClientErrorSink {
  rows = new Map<string, { report: ClientErrorReport; count: number; first: number; last: number }>();
  async record(id: string, report: ClientErrorReport, now: number) {
    const cur = this.rows.get(id);
    if (cur) { cur.count++; cur.last = now; return false; }
    this.rows.set(id, { report, count: 1, first: now, last: now });
    return true;
  }
}

interface ColLike { updateOne(q: any, u: any, o: any): Promise<{ upsertedCount?: number }> }
export class MongoClientErrorSink implements ClientErrorSink {
  constructor(private col: () => ColLike) {}
  async record(id: string, report: ClientErrorReport, now: number) {
    const at = new Date(now);
    const res = await this.col().updateOne(
      { _id: id },
      { $inc: { count: 1 }, $set: { lastAt: at, expireAt: new Date(now + 30 * 86_400_000) }, $setOnInsert: { ...report, firstAt: at } },
      { upsert: true }
    );
    return (res.upsertedCount ?? 0) > 0;
  }
}
