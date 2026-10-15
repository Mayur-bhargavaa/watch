/** Web Push subscription management (the server sends banners to devices whose browser is closed). */
import { API_BASE } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Subscribes this browser (when permitted) and registers it with the server. Returns false when push is unavailable. */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const cfgRes = await fetch(`${API_BASE}/api/push/config`);
    if (!cfgRes.ok) return false;
    const cfg = (await cfgRes.json()) as { enabled?: boolean; publicKey?: string };
    if (!cfg.enabled || !cfg.publicKey) return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) });
    }
    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    return res.ok;
  } catch (err) {
    console.warn('[push] could not subscribe:', err);
    return false;
  }
}

/** Removes this browser's subscription (called on sign-out so the next person doesn't receive the old account's alerts). */
export async function removePushSubscription(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      keepalive: true
    }).catch(() => {});
    await sub.unsubscribe();
  } catch (err) {
    console.warn('[push] could not unsubscribe:', err);
  }
}
