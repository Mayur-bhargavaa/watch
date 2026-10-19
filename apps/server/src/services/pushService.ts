import webpush from 'web-push';
import type { MongoDatabaseService } from '../db/mongoDatabase.js';

export interface PushPayload {
  title: string;
  body: string;
  /** Same tag replaces the previous banner (one per conversation / call / invite). */
  tag?: string;
  /** App-relative path opened when the notification is clicked. */
  url?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  /** 'chat' messages go to every device (unless the chat is open); everything else goes to the device in use. */
  category?: 'chat';
  /** For chat messages: the sender. If the recipient has that conversation open, no notification is sent. */
  chatWith?: string;
  /** Send to this one side only: browsers ('web') or the phone ('phone'). Unset = both. */
  only?: 'web' | 'phone';
  /** The person has the phone app: skip browsers (they are not on the website right now). Browsers are still used when there is no phone app. */
  phoneFirst?: boolean;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Sender = (sub: StoredSubscription, payload: string) => Promise<void>;

/** A phone running the mobile app registers its Expo push token on POST /api/notifications/device-token. */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.length <= 200 && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: 'default';
  ttl: number;
  data: { url: string; tag?: string };
}
/** Returns the Expo "ticket" status per message ('ok' | 'error', plus the error code such as DeviceNotRegistered). */
export type ExpoSender = (messages: ExpoMessage[]) => Promise<Array<{ status: string; error?: string }>>;

/** Expo's push service (it forwards to Google FCM / Apple APNs). The URL is fixed: nothing user supplied is ever fetched. */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const defaultExpoSender: ExpoSender = async (messages) => {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`Expo push answered HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ status?: string; details?: { error?: string } }> };
  return (json.data ?? []).map((t) => ({ status: String(t.status ?? 'error'), error: t.details?.error }));
};

/**
 * Push services we accept subscriptions for. The server POSTs to the subscription `endpoint`, so accepting arbitrary
 * URLs would let a user make the server call internal addresses (SSRF). Only https + these hosts are allowed.
 */
const ALLOWED_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
  'push.microsoft.com'
];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function parseSubscription(body: unknown): StoredSubscription | null {
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!b || !isAllowedPushEndpoint(b.endpoint)) return null;
  const p256dh = b.keys?.p256dh;
  const auth = b.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (!B64URL.test(p256dh) || p256dh.length < 40 || p256dh.length > 200) return null;
  if (!B64URL.test(auth) || auth.length < 8 || auth.length > 64) return null;
  return { endpoint: b.endpoint, keys: { p256dh, auth } };
}

export const MAX_SUBSCRIPTIONS_PER_USER = 10;

class PushService {
  private sender: Sender | null = null;
  private expoSender: ExpoSender = defaultExpoSender;
  private vapidPublicKey = '';

  /**
   * VAPID identity of this server (one pair for everyone, never per user: every stored subscription is bound to the
   * public key it was created with). Order: VAPID_* environment variables, else a pair generated once and kept in
   * MongoDB (`server_config`) so it survives restarts and is shared by all instances. Without either, push is off.
   */
  async configure(db?: Pick<MongoDatabaseService, 'getOrCreateServerConfig'>): Promise<void> {
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';
    let pub = process.env.VAPID_PUBLIC_KEY;
    let priv = process.env.VAPID_PRIVATE_KEY;
    if ((!pub || !priv) && db) {
      try {
        const keys = await db.getOrCreateServerConfig('vapid', () => webpush.generateVAPIDKeys());
        pub = String(keys.publicKey);
        priv = String(keys.privateKey);
      } catch (err) {
        console.warn('[push] could not load/generate VAPID keys, push disabled:', (err as Error)?.message || err);
      }
    }
    if (!pub || !priv) {
      this.sender = null;
      this.vapidPublicKey = '';
      return;
    }
    webpush.setVapidDetails(subject, pub, priv);
    this.vapidPublicKey = pub;
    this.sender = async (sub, payload) => {
      await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: 'high', timeout: 8000 });
    };
  }

  isEnabled(): boolean {
    return this.sender !== null;
  }

  get publicKey(): string {
    return this.vapidPublicKey;
  }

  /** Test hook: replace the network sender. */
  setSenderForTests(sender: Sender | null, publicKey = 'test-public-key'): void {
    this.sender = sender;
    this.vapidPublicKey = sender ? publicKey : '';
  }

  /** Test hook: replace the Expo network sender. */
  setExpoSenderForTests(sender: ExpoSender | null): void {
    this.expoSender = sender ?? defaultExpoSender;
  }

  /**
   * Sends a notification to every device the user subscribed (browsers via Web Push) AND to the phone with the mobile app
   * (the Expo push token the app registered, stored apart from `activeDevice`). `payload.only` limits it to one side. Returns how many were delivered. Dead subscriptions / tokens are removed.
   */
  async notifyUser(db: MongoDatabaseService, userId: string, payload: PushPayload): Promise<number> {
    const token = payload.only === 'web' ? null : await db.getExpoPushToken(userId).catch(() => null);
    const hasPhone = isExpoPushToken(token);
    const skipBrowsers = payload.only === 'phone' || (payload.phoneFirst === true && hasPhone);
    const [web, phone] = await Promise.all([
      skipBrowsers ? 0 : this.notifyBrowsers(db, userId, payload),
      payload.only === 'web' || !hasPhone
        ? 0
        : this.notifyPhone(db, userId, token, payload).catch((err) => {
            console.warn('[push] phone delivery failed:', err?.message || err);
            return 0;
          })
    ]);
    return web + phone;
  }

  private async notifyPhone(db: MongoDatabaseService, userId: string, token: string, payload: PushPayload): Promise<number> {
    const message: ExpoMessage = {
      to: token,
      title: payload.title.slice(0, 120),
      body: payload.body.slice(0, 200),
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      ttl: 60 * 60 * 24,
      data: { url: payload.url && payload.url.startsWith('/') ? payload.url : '/dashboard', tag: payload.tag }
    };
    const [ticket] = await this.expoSender([message]);
    if (ticket?.status === 'ok') return 1;
    if (ticket?.error === 'DeviceNotRegistered') {
      // the app was uninstalled or the token expired: forget it so we stop trying
      await db.setExpoPushToken(userId, null).catch(() => undefined);
    }
    return 0;
  }

  /** Web Push to the user's browser subscriptions; dead subscriptions (404/410) are removed. */
  private async notifyBrowsers(db: MongoDatabaseService, userId: string, payload: PushPayload): Promise<number> {
    if (!this.sender) return 0;
    const subs = await db.listPushSubscriptions(userId);
    if (subs.length === 0) return 0;
    const body = JSON.stringify({
      title: payload.title.slice(0, 120),
      body: payload.body.slice(0, 200),
      tag: payload.tag,
      url: payload.url && payload.url.startsWith('/') ? payload.url : '/dashboard',
      renotify: Boolean(payload.renotify),
      requireInteraction: Boolean(payload.requireInteraction)
    });
    let delivered = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await this.sender!(sub, body);
          delivered += 1;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.deletePushSubscription(sub.endpoint).catch(() => undefined);
          } else {
            console.warn(`[push] delivery to a ${new URL(sub.endpoint).hostname} subscription failed:`, err?.statusCode || err?.message || err);
          }
        }
      })
    );
    return delivered;
  }
}

export const pushService = new PushService();
