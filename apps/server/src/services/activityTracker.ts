/**
 * Notification routing between the phone app and the website.
 *
 *  - The PHONE always gets notifications (when the app registered a push token).
 *  - The WEBSITE gets them only while it is in use: its last action (`touch`) was recent. A person who has the phone but is not
 *    on the website is not buzzed twice. A person with NO phone app is always sent to the browser (nothing else would reach them).
 *  - `touch` is called when someone DOES something (a request that changes data). Polling reads do not count, so an idle website
 *    tab cannot claim to be "in use".
 *  - `chatViewed` / `isChatOpen`: a person who fetched a conversation a moment ago has it open, so a new message in it needs no
 *    notification at all.
 * In memory only (a restart forgets: the website then counts as "not in use", the phone is unaffected).
 */
export type Platform = 'app' | 'web';

export const WEB_ACTIVE_WINDOW_MS = 15 * 60 * 1000;
export const CHAT_OPEN_WINDOW_MS = 15 * 1000;
const MAX_ENTRIES = 20_000;

export class ActivityTracker {
  private lastWeb = new Map<string, number>();
  private chats = new Map<string, number>();

  constructor(private now: () => number = Date.now) {}

  touch(userId: string, platform: Platform): void {
    if (platform !== 'web') return; // only the website's activity matters: the phone always gets its notifications
    this.lastWeb.set(userId, this.now());
    this.prune(this.lastWeb, (v) => v, WEB_ACTIVE_WINDOW_MS);
  }

  /** The person did something on the website in the last 15 minutes. */
  webActive(userId: string): boolean {
    const at = this.lastWeb.get(userId);
    return at !== undefined && this.now() - at <= WEB_ACTIVE_WINDOW_MS;
  }

  chatViewed(userId: string, otherUserId: string): void {
    this.chats.set(`${userId}|${otherUserId}`, this.now());
    this.prune(this.chats, (v) => v, CHAT_OPEN_WINDOW_MS * 4);
  }

  isChatOpen(userId: string, otherUserId: string): boolean {
    const at = this.chats.get(`${userId}|${otherUserId}`);
    return at !== undefined && this.now() - at <= CHAT_OPEN_WINDOW_MS;
  }

  private prune<V>(map: Map<string, V>, at: (v: V) => number, ttl: number): void {
    if (map.size <= MAX_ENTRIES) return;
    const cutoff = this.now() - ttl;
    for (const [k, v] of map) if (at(v) < cutoff) map.delete(k);
  }
}

/** The website sends `X-Session-Mode: cookie` on every call; the mobile app uses a bearer token and never sends it. */
export const platformOf = (headers: Record<string, unknown>): Platform => (String(headers['x-session-mode'] ?? '').toLowerCase() === 'cookie' ? 'web' : 'app');

/** Calls that only read or only keep a session alive: they say nothing about where the person is. */
export const IS_PASSIVE_REQUEST = /^\/api\/(chat\/read|auth\/(ws-ticket|session)|presence|notifications\/(subscribe|unsubscribe))\b/;
