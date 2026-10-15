import type { WebSocket } from 'ws';

/**
 * Per-socket protection for every WebSocket endpoint:
 *  - token-bucket rate limit (a flooding client is warned, then disconnected)
 *  - frame size / JSON / envelope validation ({type: string, payload?: object})
 *  - invalid-frame counter with a log line instead of a stack trace per frame
 */
export interface GuardOptions {
  label: string;
  /** sustained messages per second */
  ratePerSec?: number;
  /** burst capacity */
  burst?: number;
  /** invalid frames tolerated per minute before the socket is closed */
  maxInvalidPerMin?: number;
  maxFrameBytes?: number;
}

export class SocketGuard {
  private tokens: number;
  private last = Date.now();
  private invalid: number[] = [];
  private warned = false;
  private readonly rate: number;
  private readonly burst: number;
  private readonly maxInvalid: number;
  private readonly maxBytes: number;

  constructor(private ws: WebSocket, private opts: GuardOptions, private who: string) {
    this.rate = opts.ratePerSec ?? 60;
    this.burst = opts.burst ?? 200;
    this.maxInvalid = opts.maxInvalidPerMin ?? 30;
    this.maxBytes = opts.maxFrameBytes ?? 512 * 1024;
    this.tokens = this.burst;
  }

  /** Returns the parsed envelope, or null when the frame must be dropped. */
  accept(raw: unknown): { type: string; [k: string]: any } | null {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) {
      if (!this.warned) {
        this.warned = true;
        console.warn(`[ws:${this.opts.label}] rate limit hit by ${this.who}; slowing then closing if it continues`);
        this.send({ type: 'error:notification', payload: { code: 'RATE_LIMITED', message: 'You are sending messages too fast.' } });
      }
      this.invalid.push(now);
      this.violation();
      return null;
    }
    this.tokens -= 1;
    this.warned = false;

    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');
    if (text.length > this.maxBytes) return this.bad('frame too large');
    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return this.bad('invalid JSON');
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return this.bad('not an object');
    if (typeof msg.type !== 'string' || msg.type.length === 0 || msg.type.length > 64) return this.bad('bad type');
    if (msg.payload !== undefined && (msg.payload === null || typeof msg.payload !== 'object')) {
      // payload must be an object when present; treat null/scalars as empty rather than crashing handlers
      msg.payload = undefined;
    }
    return msg;
  }

  /** One short log line instead of a stack trace per bad frame. */
  failed(context: string, err: unknown): void {
    this.invalid.push(Date.now());
    const m = (err as any)?.message ?? err;
    console.warn(`[ws:${this.opts.label}] handler error (${context}) from ${this.who}: ${String(m).slice(0, 160)}`);
    this.violation();
  }

  private bad(reason: string): null {
    this.invalid.push(Date.now());
    console.warn(`[ws:${this.opts.label}] dropped frame from ${this.who}: ${reason}`);
    this.violation();
    return null;
  }

  private violation(): void {
    const cutoff = Date.now() - 60_000;
    this.invalid = this.invalid.filter((t) => t > cutoff);
    if (this.invalid.length > this.maxInvalid || this.tokens < -50) {
      console.warn(`[ws:${this.opts.label}] closing ${this.who}: too many invalid/abusive frames`);
      try { this.ws.close(1008, 'Abusive traffic'); } catch {}
    }
  }

  private send(o: unknown) {
    try { this.ws.send(JSON.stringify(o)); } catch {}
  }
}
