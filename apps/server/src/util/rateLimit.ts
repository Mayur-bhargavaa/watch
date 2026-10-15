/** Tiny in-process sliding-window limiter for per-key (e.g. ip+email) throttling. */
export class KeyedLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {
    setInterval(() => this.sweep(), Math.max(windowMs, 60_000)).unref();
  }
  /** Returns true when the caller is OVER the limit (and records the attempt). */
  hit(key: string): boolean {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    arr.push(now);
    this.hits.set(key, arr);
    return arr.length > this.max;
  }
  reset(key: string): void {
    this.hits.delete(key);
  }
  private sweep(): void {
    const now = Date.now();
    for (const [k, arr] of this.hits) {
      const kept = arr.filter((t) => now - t < this.windowMs);
      if (kept.length) this.hits.set(k, kept);
      else this.hits.delete(k);
    }
  }
}
