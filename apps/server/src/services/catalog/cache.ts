/**
 * Small in-memory cache for upstream catalog calls.
 *  - fresh entries (age < ttl) are returned as is
 *  - stale entries (ttl <= age < ttl + staleMs) are returned immediately and refreshed in the background
 *  - expired entries are reloaded (callers wait); if the reload fails and a stale copy exists it is served instead
 *  - concurrent loads of one key share ONE in-flight promise (de-duplication)
 *  - least-recently-used entries are evicted beyond maxEntries
 * Errors are never cached.
 */
export interface CacheOptions {
  maxEntries: number;
  now?: () => number;
}
export interface CachePolicy {
  ttlMs: number;
  /** extra time during which a stale value may be served while a refresh runs (stale-while-revalidate) */
  staleMs?: number;
}
interface Entry<V> {
  value: V;
  at: number;
}

export class TtlCache<V> {
  private entries = new Map<string, Entry<V>>();
  private inflight = new Map<string, Promise<V>>();
  private now: () => number;
  private max: number;
  constructor(opts: CacheOptions) {
    this.max = Math.max(1, Math.floor(opts.maxEntries));
    this.now = opts.now ?? Date.now;
  }
  get size(): number {
    return this.entries.size;
  }
  has(key: string): boolean {
    return this.entries.has(key);
  }
  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  async get(key: string, loader: () => Promise<V>, policy: CachePolicy): Promise<V> {
    const hit = this.entries.get(key);
    const staleMs = policy.staleMs ?? 0;
    if (hit) {
      const age = this.now() - hit.at;
      if (age < policy.ttlMs) {
        this.touch(key, hit);
        return hit.value;
      }
      if (age < policy.ttlMs + staleMs) {
        this.touch(key, hit);
        this.load(key, loader).catch(() => undefined); // background refresh, failure keeps the stale copy
        return hit.value;
      }
    }
    try {
      return await this.load(key, loader);
    } catch (err) {
      // serve a stale copy rather than an error when the upstream is down (bounded to 24 h)
      if (hit && this.now() - hit.at < 24 * 3600_000) return hit.value;
      throw err;
    }
  }

  private load(key: string, loader: () => Promise<V>): Promise<V> {
    const running = this.inflight.get(key);
    if (running) return running;
    const p = (async () => {
      try {
        const value = await loader();
        this.set(key, value);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  private set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, at: this.now() });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
  private touch(key: string, e: Entry<V>): void {
    this.entries.delete(key);
    this.entries.set(key, e);
  }
}
