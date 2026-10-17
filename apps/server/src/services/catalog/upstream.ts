/**
 * Upstream HTTP client for the catalog adapters: timeouts, bounded retries with backoff on 429/5xx, and a small
 * circuit breaker so a dead provider is not hammered (and the owner's quota is not burned on retries).
 * Everything time/network related is injectable, so tests never touch the network.
 * Error messages never contain the request URL (it may carry an API key).
 */
export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; headers?: { get(name: string): string | null }; json(): Promise<unknown> }>;

export class UpstreamError extends Error {
  constructor(public kind: 'timeout' | 'http' | 'network' | 'circuit_open' | 'parse', public status: number | null, public upstream: string) {
    super(`${upstream} request failed (${kind}${status ? ` ${status}` : ''})`);
    this.name = 'UpstreamError';
  }
}

export interface UpstreamOptions {
  name: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  /** consecutive failures that open the breaker */
  breakerThreshold?: number;
  breakerCooldownMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class UpstreamClient {
  readonly name: string;
  private fetchFn: FetchLike;
  private timeoutMs: number;
  private maxRetries: number;
  private backoffBaseMs: number;
  private threshold: number;
  private cooldownMs: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private failures = 0;
  private openUntil = 0;
  /** number of real upstream calls made (for tests / quota awareness) */
  calls = 0;

  constructor(o: UpstreamOptions) {
    this.name = o.name;
    this.fetchFn = o.fetchFn ?? ((url, init) => fetch(url, init as any) as any);
    this.timeoutMs = o.timeoutMs ?? 8000;
    this.maxRetries = o.maxRetries ?? 2;
    this.backoffBaseMs = o.backoffBaseMs ?? 300;
    this.threshold = o.breakerThreshold ?? 5;
    this.cooldownMs = o.breakerCooldownMs ?? 30_000;
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get circuitOpen(): boolean {
    return this.now() < this.openUntil;
  }

  async getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
    if (this.circuitOpen) throw new UpstreamError('circuit_open', null, this.name);
    let lastErr: UpstreamError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const retryAfter = lastErr?.status === 429 ? this.lastRetryAfterMs : 0;
        await this.sleep(Math.min(2000, Math.max(retryAfter, this.backoffBaseMs * 2 ** (attempt - 1))));
      }
      try {
        const res = await this.once(url, headers);
        if (res.ok) {
          let body: T;
          try {
            body = (await res.json()) as T;
          } catch {
            throw new UpstreamError('parse', res.status, this.name);
          }
          this.failures = 0;
          return body;
        }
        const retryable = res.status === 429 || res.status >= 500;
        lastErr = new UpstreamError('http', res.status, this.name);
        const ra = Number(res.headers?.get('retry-after'));
        this.lastRetryAfterMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0;
        if (!retryable) {
          // a 4xx (404 for an unknown title, 401 for a bad key) is not an outage: do not trip the breaker for 404/422
          if (res.status === 401 || res.status === 403) this.recordFailure();
          throw lastErr;
        }
      } catch (err) {
        if (err instanceof UpstreamError && err.kind === 'http' && !(err.status === 429 || (err.status ?? 0) >= 500)) throw err;
        lastErr = err instanceof UpstreamError ? err : new UpstreamError('network', null, this.name);
        if (lastErr.kind === 'parse') throw lastErr;
      }
    }
    this.recordFailure();
    throw lastErr ?? new UpstreamError('network', null, this.name);
  }

  private lastRetryAfterMs = 0;

  private recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openUntil = this.now() + this.cooldownMs;
      this.failures = 0;
    }
  }

  private async once(url: string, headers: Record<string, string>) {
    this.calls++;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new UpstreamError('timeout', null, this.name));
      }, this.timeoutMs);
    });
    try {
      const mergedHeaders = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', Accept: 'application/json', ...headers };
      return await Promise.race([this.fetchFn(url, { headers: mergedHeaders, signal: ctrl.signal }), timeout]);
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      throw new UpstreamError('network', null, this.name);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
