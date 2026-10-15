/**
 * Typing-indicator controller (pure, so it can be unit-tested with fake timers).
 *
 * The old composer called onTyping(true) on EVERY keystroke and only sent `false` when the box became empty, so the
 * other person saw "typing..." forever once you stopped mid-sentence. This sends `true` at most once per `throttleMs`,
 * and `false` after `idleMs` without typing (or immediately via stop(): on send, blur and unmount).
 */
export interface TypingTimers {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const realTimers: TypingTimers = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
};

export class TypingController {
  private active = false;
  private lastSent = 0;
  private idleHandle: unknown = null;

  constructor(
    private emit: (isTyping: boolean) => void,
    private opts: { throttleMs?: number; idleMs?: number } = {},
    private timers: TypingTimers = realTimers
  ) {}

  /** Call on every input change with whether the box currently has text. */
  input(hasText: boolean): void {
    if (!hasText) {
      this.stop();
      return;
    }
    const now = this.timers.now();
    if (!this.active || now - this.lastSent >= (this.opts.throttleMs ?? 2500)) {
      this.active = true;
      this.lastSent = now;
      this.emit(true);
    }
    if (this.idleHandle) this.timers.clearTimeout(this.idleHandle);
    this.idleHandle = this.timers.setTimeout(() => this.stop(), this.opts.idleMs ?? 3000);
  }

  /** Sends `false` (once) and cancels the idle timer. */
  stop(): void {
    if (this.idleHandle) {
      this.timers.clearTimeout(this.idleHandle);
      this.idleHandle = null;
    }
    if (this.active) {
      this.active = false;
      this.emit(false);
    }
  }
}
