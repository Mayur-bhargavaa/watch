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
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Sender = (sub: StoredSubscription, payload: string) => Promise<void>;

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

  /** Sends a notification to every device the user subscribed; dead subscriptions (404/410) are removed. */
  async notifyUser(db: MongoDatabaseService, userId: string, payload: PushPayload): Promise<number> {
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
