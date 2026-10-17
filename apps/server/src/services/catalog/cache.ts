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
  /** a `null` result (a cached "not found") lives this long instead of ttlMs (negative caching) */
  nullTtlMs?: number;
  /** when a reload fails, a copy younger than this is still served (default 24 h) */
  maxServeStaleMs?: number;
}
interface Entry<V> {
  value: V;
  at: number;
  /** lifetime chosen when the value was stored (differs from the policy for cached nulls) */
  ttlMs?: number;
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
      const ttl = hit.ttlMs ?? policy.ttlMs;
      if (age < ttl) {
        this.touch(key, hit);
        return hit.value;
      }
      if (age < ttl + staleMs) {
        this.touch(key, hit);
        this.load(key, loader, policy).catch(() => undefined); // background refresh, failure keeps the stale copy
        return hit.value;
      }
    }
    try {
      return await this.load(key, loader, policy);
    } catch (err) {
      // serve a stale copy rather than an error when the upstream is down (bounded, default 24 h)
      if (hit && this.now() - hit.at < (policy.maxServeStaleMs ?? 24 * 3600_000)) return hit.value;
      throw err;
    }
  }

  /** The stored value for a key if it is younger than `maxAgeMs`, without loading anything (used for "serve what we have"). */
  peek(key: string, maxAgeMs: number): V | undefined {
    const hit = this.entries.get(key);
    return hit && this.now() - hit.at < maxAgeMs ? hit.value : undefined;
  }

  private load(key: string, loader: () => Promise<V>, policy: CachePolicy): Promise<V> {
    const running = this.inflight.get(key);
    if (running) return running;
    const p = (async () => {
      try {
        const value = await loader();
        this.set(key, value, value === null && policy.nullTtlMs !== undefined ? policy.nullTtlMs : undefined);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  private set(key: string, value: V, ttlMs?: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, at: this.now(), ttlMs });
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
