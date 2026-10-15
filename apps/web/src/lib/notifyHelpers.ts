/**
 * Pure helpers behind NotificationContext (kept free of React / DOM so they can be unit-tested).
 */
import { summariseSenders } from '@synccinema/common';

const LEGACY_STORAGE_KEY = 'watch_party_notifications_v1';

/** Notifications are stored per account so the next person on a shared browser never sees them. */
export function notificationStorageKey(userId: string | null | undefined): string | null {
  return userId ? `${LEGACY_STORAGE_KEY}:${userId}` : null;
}
export const LEGACY_NOTIFICATION_KEY = LEGACY_STORAGE_KEY;

/** Exponential backoff with jitter: ~1s, 2s, 4s … capped at 30s. */
export function nextReconnectDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.5 + random() * 0.5));
}

/** Remembers recently seen event ids so the same event arriving twice is handled once. */
export function createDeduper(max = 200) {
  const seen = new Set<string>();
  return {
    /** true the first time `id` is seen; ids that are missing are never treated as duplicates */
    first(id: string | undefined | null): boolean {
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > max) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
      return true;
    },
    clear: () => seen.clear()
  };
}

export interface IncomingChat {
  conversationId: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  preview: string;
}
export interface ChatSummary {
  conversationId: string | null;
  /** set when every message came from one conversation, so the click can open it */
  senderId: string | null;
  senderAvatar?: string;
  title: string;
  body: string;
  count: number;
}

/** One notification per burst: several messages (or a backlog after reconnect) collapse into a summary. */
export function summariseChats(items: IncomingChat[]): ChatSummary | null {
  if (items.length === 0) return null;
  if (items.length === 1) {
    const m = items[0];
    return { conversationId: m.conversationId, senderId: m.senderId ?? null, senderAvatar: m.senderAvatar, title: m.senderName, body: m.preview, count: 1 };
  }
  const names = items.map((i) => i.senderName);
  const conversations = new Set(items.map((i) => i.conversationId));
  const who = summariseSenders(names);
  const last = items[items.length - 1];
  return {
    conversationId: conversations.size === 1 ? last.conversationId : null,
    senderId: conversations.size === 1 ? last.senderId ?? null : null,
    senderAvatar: conversations.size === 1 ? last.senderAvatar : undefined,
    title: `${items.length} new messages`,
    body: conversations.size === 1 ? `${who}: ${last.preview}` : `From ${who}`,
    count: items.length
  };
}

/** Collects messages for `windowMs`, then calls `onFlush` once with everything that arrived. */
export function createChatBatcher(
  onFlush: (items: IncomingChat[]) => void,
  windowMs = 700,
  timers: { set: typeof setTimeout; clear: typeof clearTimeout } = { set: setTimeout, clear: clearTimeout }
) {
  let items: IncomingChat[] = [];
  let handle: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (handle) timers.clear(handle);
    handle = null;
    const out = items;
    items = [];
    if (out.length) onFlush(out);
  };
  return {
    add(item: IncomingChat) {
      items.push(item);
      if (!handle) handle = timers.set(flush, windowMs);
    },
    flush,
    cancel() {
      if (handle) timers.clear(handle);
      handle = null;
      items = [];
    }
  };
}

/** The OS banner is only useful when the user is not already looking at the app. */
export function shouldShowOsBanner(opts: { forced?: boolean; focused: boolean; hidden: boolean }): boolean {
  if (opts.forced) return true;
  return !(opts.focused && !opts.hidden);
}

/** Same-origin in-app path for a notification link; anything else falls back to the dashboard. */
export function safeInternalLink(link: string | undefined | null, fallback = '/dashboard'): string {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return fallback;
  return link;
}

/** Tiny pub/sub so pages (e.g. Ludo) get game invites without opening a second presence socket. */
type InviteListener = (invite: Record<string, any>) => void;
const inviteListeners = new Set<InviteListener>();
export function subscribeGameInvites(fn: InviteListener): () => void {
  inviteListeners.add(fn);
  return () => {
    inviteListeners.delete(fn);
  };
}
export function emitGameInvite(invite: Record<string, any>): void {
  for (const fn of inviteListeners) {
    try {
      fn(invite);
    } catch (err) {
      console.warn('[notifications] invite listener failed:', err);
    }
  }
}

/** Shows an OS notification for an incoming call (tag per call so it replaces itself, click focuses the app). */
export function showCallNotification(opts: { callId: string; title: string; body: string }): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!shouldShowOsBanner({ focused: document.hasFocus(), hidden: document.hidden })) return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: `call:${opts.callId}`,
      icon: new URL('/logos/direct.png', window.location.origin).href
    });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch (err) {
        console.warn('[notifications] call banner click failed:', err);
      }
    };
  } catch (err) {
    console.warn('[notifications] call banner failed:', err);
  }
}
