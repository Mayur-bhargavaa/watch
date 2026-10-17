/**
 * Quota guard for the Streaming Availability API (free plan: 1,000 requests a month, hard cap, no overage).
 *
 *  - ONE counter document per provider per UTC month (collection `catalog_quota`, _id `<provider>:<YYYY-MM>`), bumped
 *    with an atomic conditional `$inc`: the increment only happens while count < stopAt, so concurrent lookups can never
 *    push the counter past the soft stop.
 *  - Soft stop at 90% of STREAMING_AVAILABILITY_MONTHLY_LIMIT (default 1000, so 900 calls): after that the adapter is not
 *    called any more ("quota low"); callers get stale data or "unknown". The remaining 10% is a safety margin for retries.
 *  - UserLookupGuard: per-user cooldown so one person cannot burn the quota by refreshing.
 * Everything time related is injectable; tests use MemoryQuotaStore.
 */

export interface QuotaStore {
  count(provider: string, month: string): Promise<number>;
  /** Atomically adds 1 only while the count is below `stopAt`. Returns false (and changes nothing) when it is not. */
  tryConsume(provider: string, month: string, stopAt: number): Promise<boolean>;
}

export const utcMonth = (ms: number): string => new Date(ms).toISOString().slice(0, 7);

export class MemoryQuotaStore implements QuotaStore {
  private counts = new Map<string, number>();
  async count(provider: string, month: string) {
    return this.counts.get(`${provider}:${month}`) ?? 0;
  }
  async tryConsume(provider: string, month: string, stopAt: number) {
    const k = `${provider}:${month}`;
    const c = this.counts.get(k) ?? 0;
    if (c >= stopAt) return false;
    this.counts.set(k, c + 1);
    return true;
  }
}

/** Minimal Mongo collection surface (the driver's Collection satisfies it). */
interface QuotaCol {
  findOne(q: any): Promise<any>;
  updateOne(q: any, u: any, o?: any): Promise<unknown>;
  findOneAndUpdate(q: any, u: any, o?: any): Promise<any>;
}
export class MongoQuotaStore implements QuotaStore {
  constructor(private col: () => QuotaCol) {}
  async count(provider: string, month: string) {
    const d = await this.col().findOne({ _id: `${provider}:${month}` });
    return typeof d?.count === 'number' ? d.count : 0;
  }
  async tryConsume(provider: string, month: string, stopAt: number) {
    const col = this.col();
    const _id = `${provider}:${month}`;
    try {
      await col.updateOne({ _id }, { $setOnInsert: { provider, month, count: 0 } }, { upsert: true });
    } catch (e: any) {
      if (e?.code !== 11000) throw e; // a concurrent creator won the race: the document exists, carry on
    }
    const res = await col.findOneAndUpdate({ _id, count: { $lt: stopAt } }, { $inc: { count: 1 } }, { returnDocument: 'after' });
    const doc = res && typeof res === 'object' && 'value' in res ? res.value : res; // driver 5 returns the doc, older ones { value }
    return Boolean(doc);
  }
}

export class QuotaStopped extends Error {
  constructor() {
    super('Availability quota stopped');
    this.name = 'QuotaStopped';
  }
}
export class LookupCooldown extends Error {
  constructor() {
    super('Availability lookup cooldown');
    this.name = 'LookupCooldown';
  }
}

export interface QuotaGuardOptions {
  provider: string;
  store: QuotaStore;
  /** monthly request limit of the plan */
  limit: number;
  now?: () => number;
  /** fraction of the limit at which calls stop (default 0.9) */
  softStopRatio?: number;
  /** how long a read count is trusted for the status payload (default 30 s) */
  readCacheMs?: number;
}
export class QuotaGuard {
  readonly stopAt: number;
  private now: () => number;
  private readCache: { month: string; low: boolean; at: number } | null = null;
  constructor(private o: QuotaGuardOptions) {
    this.now = o.now ?? Date.now;
    this.stopAt = Math.max(1, Math.floor(o.limit * (o.softStopRatio ?? 0.9)));
  }
  /** true once this month's counter reached the soft stop. Cached briefly; a failing store counts as "not low". */
  async isLow(): Promise<boolean> {
    const t = this.now();
    const month = utcMonth(t);
    const c = this.readCache;
    if (c && c.month === month && t - c.at < (this.o.readCacheMs ?? 30_000)) return c.low;
    let low = false;
    try {
      low = (await this.o.store.count(this.o.provider, month)) >= this.stopAt;
    } catch {
      low = false;
    }
    this.readCache = { month, low, at: t };
    return low;
  }
  /** Reserves one request. Throws QuotaStopped when the soft stop is reached (the API must then NOT be called). */
  async consume(): Promise<void> {
    const month = utcMonth(this.now());
    let ok = false;
    try {
      ok = await this.o.store.tryConsume(this.o.provider, month, this.stopAt);
    } catch {
      ok = false; // cannot prove there is quota left: do not call
    }
    if (!ok) {
      this.readCache = { month, low: true, at: this.now() };
      throw new QuotaStopped();
    }
    this.readCache = null; // the count changed: the next isLow() re-reads it (real calls are rare, so this is cheap)
  }
}

export interface UserGuardOptions {
  now?: () => number;
  /** uncached lookups one user may trigger for the same title per hour (default 1) */
  perTitlePerHour?: number;
  /** uncached lookups one user may trigger per UTC day (default 30) */
  perDay?: number;
  /** users remembered at most (default 5000; the oldest are dropped) */
  maxUsers?: number;
}
export class UserLookupGuard {
  private users = new Map<string, { day: string; count: number; titles: Map<string, number[]> }>();
  private now: () => number;
  private perTitle: number;
  private perDay: number;
  private maxUsers: number;
  constructor(o: UserGuardOptions = {}) {
    this.now = o.now ?? Date.now;
    this.perTitle = o.perTitlePerHour ?? 1;
    this.perDay = o.perDay ?? 30;
    this.maxUsers = o.maxUsers ?? 5000;
  }
  private entry(userId: string) {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    let e = this.users.get(userId);
    if (!e || e.day !== day) e = { day, count: 0, titles: e?.titles ?? new Map() };
    this.users.delete(userId);
    this.users.set(userId, e);
    while (this.users.size > this.maxUsers) this.users.delete(this.users.keys().next().value as string);
    return e;
  }
  /** Throws LookupCooldown when this user is over a limit. Does not record anything. */
  check(userId: string, titleKey: string): void {
    const e = this.entry(userId);
    const t = this.now();
    const recent = (e.titles.get(titleKey) ?? []).filter((s) => t - s < 3600_000);
    if (e.count >= this.perDay || recent.length >= this.perTitle) throw new LookupCooldown();
  }
  /** Records one uncached lookup (call after the quota was reserved). */
  record(userId: string, titleKey: string): void {
    const e = this.entry(userId);
    const t = this.now();
    e.count++;
    const recent = (e.titles.get(titleKey) ?? []).filter((s) => t - s < 3600_000);
    recent.push(t);
    e.titles.set(titleKey, recent);
    if (e.titles.size > 200) e.titles.delete(e.titles.keys().next().value as string);
  }
}

/** STREAMING_AVAILABILITY_MONTHLY_LIMIT: a positive integer, default 1000 (the free plan). */
export function parseMonthlyLimit(v: unknown): number {
  const n = Number(typeof v === 'string' ? v.trim() : v);
  return Number.isInteger(n) && n >= 10 && n <= 10_000_000 ? n : 1000;
}
