'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession, UserSession, getGameRoute, getGameTitle, recordActiveDeviceToken, getWsTicket, WS_BASE } from '../lib/api';
import { getRandomRoast, RoastCategory } from '../lib/roastMessages';
import type { IconName } from '../components/ui/AppIcon';
import { ChatStore } from '../lib/chatStore';
import { CallSignaling } from '../lib/callSignaling';
import { ActiveDeviceSession, previewMessageText } from '@synccinema/common';
import { getClientDeviceInfo, ClientDeviceInfo } from '../lib/deviceToken';
import {
  notificationStorageKey,
  LEGACY_NOTIFICATION_KEY,
  nextReconnectDelay,
  createDeduper,
  createChatBatcher,
  summariseChats,
  shouldShowOsBanner,
  safeInternalLink,
  emitGameInvite,
  IncomingChat
} from '../lib/notifyHelpers';
import { ensurePushSubscription } from '../lib/push';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: IconName;
  category: 'nudge' | 'game' | 'watch' | 'streak' | 'system';
  link: string;
  fromName?: string;
  fromAvatar?: string;
  createdAt: number;
  read: boolean;
  /** notifications with the same tag replace each other (one per chat conversation) */
  tag?: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  permission: NotificationPermission | 'unsupported';
  showPermissionModal: boolean;
  /** newest first, at most MAX_TOASTS */
  toasts: AppNotification[];
  /** newest toast (kept for older callers) */
  activeToast: AppNotification | null;
  activeDevice: ActiveDeviceSession | null;
  currentDevice: ClientDeviceInfo;
  isMobileActive: boolean;
  isCurrentDeviceActive: boolean;
  switchToThisDevice: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  dismissPermissionModal: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  dismissToast: (id?: string) => void;
  triggerLocalNotification: (data: {
    title: string;
    body: string;
    link?: string;
    category?: RoastCategory;
    fromName?: string;
  }) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const MAX_TOASTS = 3;
const MAX_STORED = 50;
const MODAL_DISMISSED_KEY = 'watch_notif_modal_dismissed_session';

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn('[Notification] audio unavailable:', err);
    return null;
  }
}

// Synthesize pleasant sound with Web Audio API (compatible with Safari & iOS WebKit)
function playChimeSound() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // Audio can be blocked until the user interacts with the page; the toast still shows
  }
}

type PushOptions = { forced?: boolean; tag?: string; renotify?: boolean; silentChime?: boolean };

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [activeDevice, setActiveDevice] = useState<ActiveDeviceSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentDevice] = useState<ClientDeviceInfo>(() => getClientDeviceInfo());

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const socketRef = useRef<WebSocket | null>(null);
  const activeDeviceRef = useRef<ActiveDeviceSession | null>(null);
  const userIdRef = useRef<string | null>(null);
  const dedupeRef = useRef(createDeduper(300));

  activeDeviceRef.current = activeDevice;
  userIdRef.current = userId;

  const changeActiveDevice = useCallback((next: ActiveDeviceSession | null) => {
    // Only update state when the device really changed: a new object every time would re-render every consumer
    setActiveDevice((prev) => (prev?.deviceId === next?.deviceId && prev?.deviceType === next?.deviceType ? prev : next));
  }, []);

  // Which account is signed in (changes on sign-in / sign-out / account switch, also from other tabs)
  useEffect(() => {
    const sync = () => setUserId(getStoredSession()?.user?.id ?? null);
    sync();
    window.addEventListener('synccinema:session-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('synccinema:session-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Notification history is stored per account (the old shared key leaked it to the next person on this browser)
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_NOTIFICATION_KEY);
    } catch {}
    const key = notificationStorageKey(userId);
    if (!key) {
      setNotifications([]);
      return;
    }
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      setNotifications(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      console.warn('[Notification] stored notifications were unreadable:', err);
      setNotifications([]);
    }
  }, [userId]);

  const updateNotifications = useCallback((fn: (prev: AppNotification[]) => AppNotification[]) => {
    setNotifications((prev) => {
      const next = fn(prev).slice(0, MAX_STORED);
      const key = notificationStorageKey(userIdRef.current);
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch (err) {
          console.warn('[Notification] could not save notifications:', err);
        }
      }
      return next;
    });
  }, []);

  // Bootstrap: active device, service worker, permission state
  useEffect(() => {
    const session = getStoredSession();
    if (session?.user?.activeDevice) changeActiveDevice(session.user.activeDevice);
    if (session?.token) {
      recordActiveDeviceToken()
        .then((res) => {
          if (res?.activeDevice) changeActiveDevice(res.activeDevice);
        })
        .catch((err) => console.warn('[Notification] could not record this device:', err));
    } else {
      changeActiveDevice({
        deviceId: currentDevice.deviceId,
        deviceType: currentDevice.deviceType,
        deviceToken: currentDevice.deviceToken,
        browserName: currentDevice.browserName,
        lastActiveAt: Date.now()
      });
    }
  }, [userId, currentDevice, changeActiveDevice]);

  useEffect(() => {
    // Service worker: needed for OS banners on Chrome and for Web Push
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[Notification] service worker registration failed:', err));
    }
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default' && !sessionStorage.getItem(MODAL_DISMISSED_KEY)) {
        setShowPermissionModal(true);
      }
    } else {
      setPermission('unsupported');
    }
  }, []);

  // Keep this browser registered for Web Push while signed in; re-register if the browser rotated the subscription
  useEffect(() => {
    if (!userId || permission !== 'granted') return;
    void ensurePushSubscription();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'push:resubscribe') void ensurePushSubscription();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [userId, permission]);

  // Audio unlocker on user interaction (strictly required by Safari and iOS WebKit)
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const dismissToast = useCallback((id?: string) => {
    const timers = toastTimersRef.current;
    if (id) {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.delete(id);
      setToasts((prev) => prev.filter((n) => n.id !== id));
    } else {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      setToasts([]);
    }
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // OS-level banner via the service worker, falling back to the Notification constructor (Safari macOS)
  const dispatchDesktopNotification = useCallback(
    async (notif: AppNotification, opts: PushOptions) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      // Don't pop a banner while the user is already looking at the app: the in-app toast covers that
      if (!shouldShowOsBanner({ forced: opts.forced, focused: document.hasFocus(), hidden: document.hidden })) return;

      // Smart device routing: a laptop stays quiet while the user's active device is their phone
      const active = activeDeviceRef.current;
      if (!opts.forced && currentDevice.deviceType !== 'mobile' && active?.deviceType === 'mobile') return;

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const iconUrl = new URL('/logos/direct.png', window.location.origin).href;
      const url = safeInternalLink(notif.link);
      const tag = opts.tag || notif.id;

      // WebKit throws a TypeError for badge / silent / requireInteraction / renotify
      const options: NotificationOptions & Record<string, unknown> = { body: notif.body, tag, icon: iconUrl, data: { url } };
      if (!isSafari) {
        options.badge = iconUrl;
        if (opts.renotify) options.renotify = true;
      }

      if ('serviceWorker' in navigator) {
        try {
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
          ]);
          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(notif.title, options);
            return;
          }
        } catch (err) {
          console.warn('[Notification] service worker banner failed, using Notification():', err);
        }
      }

      try {
        const n = new Notification(notif.title, { body: notif.body, tag, icon: iconUrl, data: { url } });
        n.onclick = () => {
          try {
            window.focus();
            n.close();
          } catch {}
          router.push(url);
        };
      } catch (err) {
        console.warn('[Notification] banner failed:', err);
      }
    },
    [router, currentDevice]
  );

  // Record the notification, chime, show a toast and (when useful) an OS banner
  const pushNotification = useCallback(
    (item: Omit<AppNotification, 'id' | 'createdAt' | 'read'>, opts: PushOptions = {}) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const tag = opts.tag ?? item.tag;
      const notif: AppNotification = { ...item, tag, id, createdAt: Date.now(), read: false };

      // One entry per tag (e.g. per chat conversation) instead of a pile of near-identical rows
      updateNotifications((prev) => [notif, ...prev.filter((n) => !tag || n.tag !== tag)]);

      const active = activeDeviceRef.current;
      if (!opts.silentChime && (opts.forced || currentDevice.deviceType === 'mobile' || active?.deviceType !== 'mobile')) {
        playChimeSound();
      }

      setToasts((prev) => {
        const replaced = tag ? prev.filter((t) => t.tag === tag) : [];
        replaced.forEach((t) => {
          const timer = toastTimersRef.current.get(t.id);
          if (timer) clearTimeout(timer);
          toastTimersRef.current.delete(t.id);
        });
        const next = [notif, ...prev.filter((t) => !tag || t.tag !== tag)];
        next.slice(MAX_TOASTS).forEach((t) => {
          const timer = toastTimersRef.current.get(t.id);
          if (timer) clearTimeout(timer);
          toastTimersRef.current.delete(t.id);
        });
        return next.slice(0, MAX_TOASTS);
      });
      toastTimersRef.current.set(
        id,
        setTimeout(() => dismissToast(id), 6500)
      );

      void dispatchDesktopNotification(notif, { ...opts, tag });
    },
    [dispatchDesktopNotification, updateNotifications, dismissToast, currentDevice]
  );

  // The socket handlers outlive renders, so they call the latest version through a ref (no reconnect when it changes)
  const pushRef = useRef(pushNotification);
  pushRef.current = pushNotification;

  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setShowPermissionModal(false);
      return false;
    }
    // The browser never shows the prompt again once blocked: the UI explains how to unblock instead
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return false;
    }

    try {
      let resolvedStatus: NotificationPermission = Notification.permission;
      try {
        // Legacy Safari uses a callback, modern browsers a Promise
        const resultOrPromise = Notification.requestPermission((status) => {
          if (status) {
            resolvedStatus = status;
            setPermission(status);
          }
        });
        const thenable = resultOrPromise as unknown as { then?: unknown } | undefined;
        if (thenable && typeof thenable.then === 'function') {
          const promiseResult = await (resultOrPromise as Promise<NotificationPermission>);
          if (promiseResult) resolvedStatus = promiseResult;
        }
      } catch {
        resolvedStatus = Notification.permission;
      }

      const finalStatus = resolvedStatus || Notification.permission;
      setPermission(finalStatus);
      setShowPermissionModal(false);

      if (finalStatus === 'granted') {
        pushNotification(
          {
            title: 'Notifications Activated!',
            body: "You'll now get partner roasts, game invites and watch party alerts even when this tab is hidden.",
            category: 'system',
            icon: 'bell',
            link: '/dashboard'
          },
          { forced: true }
        );
        return true;
      }
      sessionStorage.setItem(MODAL_DISMISSED_KEY, 'true');
      return false;
    } catch (err) {
      console.warn('[Notification] requestPermission error:', err);
      setShowPermissionModal(false);
      return false;
    }
  };

  const dismissPermissionModal = () => {
    setShowPermissionModal(false);
    sessionStorage.setItem(MODAL_DISMISSED_KEY, 'true');
  };

  const markAsRead = useCallback(
    (id: string) => updateNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [updateNotifications]
  );
  const markAllAsRead = useCallback(
    () => updateNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [updateNotifications]
  );
  const clearAll = useCallback(() => updateNotifications(() => []), [updateNotifications]);

  const triggerLocalNotification = (data: { title: string; body: string; link?: string; category?: RoastCategory; fromName?: string }) => {
    const roast = getRandomRoast(data.category || 'nudge', data.fromName);
    pushNotification(
      {
        title: data.title || roast.title,
        body: data.body || roast.body,
        icon: roast.icon,
        category: data.category || 'nudge',
        link: data.link || '/dashboard',
        fromName: data.fromName
      },
      { forced: true }
    );
  };

  // Live events over /ws/presence. Reconnects with backoff, stops when signed out, and does not depend on
  // anything that changes during normal use (so it is not torn down and rebuilt on every notification).
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const dedupe = dedupeRef.current;

    // Several messages arriving together (a backlog after reconnecting, a chatty friend) become ONE alert
    const batcher = createChatBatcher((items: IncomingChat[]) => {
      const summary = summariseChats(items);
      if (!summary) return;
      const onChatPage = window.location.pathname === '/chat' && !document.hidden;
      if (onChatPage) {
        playChimeSound();
        return;
      }
      pushRef.current(
        {
          title: summary.title,
          body: summary.body,
          icon: 'message',
          category: 'system',
          link: summary.senderId ? `/chat?userId=${encodeURIComponent(summary.senderId)}` : '/chat',
          fromName: items[items.length - 1].senderName,
          fromAvatar: summary.senderAvatar
        },
        { tag: summary.conversationId ? `chat:${summary.conversationId}` : 'chat:multiple', renotify: true }
      );
    });

    const scheduleReconnect = () => {
      if (!active || !getStoredSession()?.user) return; // signed out: nothing to reconnect to
      reconnectTimer = setTimeout(() => void connect(), nextReconnectDelay(attempt++));
    };

    const connect = async () => {
      if (!active || !getStoredSession()?.user) return;
      let ticket: string;
      try {
        ticket = await getWsTicket();
      } catch {
        scheduleReconnect();
        return;
      }
      if (!active) return;

      const params = new URLSearchParams({
        ticket,
        deviceId: currentDevice.deviceId,
        deviceType: currentDevice.deviceType,
        deviceToken: currentDevice.deviceToken,
        browserName: currentDevice.browserName
      });

      let ws: WebSocket;
      try {
        ws = new WebSocket(`${WS_BASE}/ws/presence?${params.toString()}`);
      } catch (err) {
        console.warn('[Notification] could not open the presence socket:', err);
        scheduleReconnect();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        ChatStore.registerSocketSender((payload) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        });
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'presence:heartbeat' }));
        }, 15000);
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!data || !data.type) return;

        switch (data.type) {
          case 'presence:connected':
            attempt = 0; // healthy connection: next drop starts the backoff from scratch
            changeActiveDevice(data.activeDevice || null);
            return;
          case 'presence:active_device_changed':
            changeActiveDevice(data.activeDevice || null);
            return;
          case 'chat:message': {
            const msg = data.message;
            if (!msg) return;
            ChatStore.receiveIncomingMessage(msg);
            if (!dedupe.first(msg.id ? `chat:${msg.id}` : undefined)) return;
            batcher.add({
              conversationId: msg.conversationId || msg.senderId || 'unknown',
              senderId: msg.senderId,
              senderName: msg.senderName || 'A friend',
              senderAvatar: msg.senderAvatar,
              preview: previewMessageText(msg.content, msg.type)
            });
            return;
          }
          case 'chat:status_update':
            ChatStore.updateMessageStatus(data.messageId, data.conversationId, data.status, data.messageIds);
            return;
          case 'chat:message_updated':
            // a reaction was added or taken back (by the other person or from the phone app)
            if (data.message?.id && Array.isArray(data.message.reactions)) ChatStore.applyServerReactions(data.message.conversationId, data.message.id, data.message.reactions);
            return;
          case 'chat:view_once_opened':
            if (data.messageId) ChatStore.markViewOnceOpened(data.conversationId, data.messageId, false);
            return;
          case 'presence:user_status':
            ChatStore.setUserOnline(data.userId, data.isOnline, data.lastSeen);
            return;
          case 'presence:initial_online_users':
            if (Array.isArray(data.userIds)) ChatStore.setInitialOnlineUsers(data.userIds);
            return;
          case 'partner:ping': {
            const payload = data.payload || {};
            if (!dedupe.first(payload.id ? `ping:${payload.id}` : undefined)) return;
            const sender = payload.fromName || 'Your Partner';
            const roast = payload.customMessage
              ? { title: `${sender} Nudged You!`, body: payload.customMessage, icon: 'message' as IconName }
              : getRandomRoast(payload.roomCode ? 'game' : 'nudge', sender);
            pushRef.current({
              title: roast.title,
              body: roast.body,
              icon: roast.icon,
              category: payload.roomCode ? 'game' : 'nudge',
              link: getGameRoute(payload.gameType, payload.roomCode),
              fromName: sender,
              fromAvatar: payload.fromAvatar
            });
            return;
          }
          case 'partner:game_invite': {
            const payload = data.payload || data.invite || {};
            if (!dedupe.first(payload.id ? `invite:${payload.id}` : payload.roomCode ? `invite:${payload.roomCode}` : undefined)) return;
            const sender = payload.fromDisplayName || 'Your Partner';
            const roast = getRandomRoast('game', sender);
            emitGameInvite(payload); // pages such as Ludo show their own invite card from this
            pushRef.current({
              title: `${sender} challenged you to ${getGameTitle(payload.gameType, payload.roomCode)}!`,
              body: roast.body,
              icon: 'game',
              category: 'game',
              link: getGameRoute(payload.gameType, payload.roomCode),
              fromName: sender,
              fromAvatar: payload.fromAvatar
            });
            return;
          }
          case 'partner:nudge': {
            const payload = data.payload || {};
            if (!dedupe.first(payload.id ? `nudge:${payload.id}` : undefined)) return;
            const sender = payload.fromName || 'Your Partner';
            const roast = payload.message
              ? { title: `${sender} sent a roast!`, body: payload.message, icon: 'fire' as IconName }
              : getRandomRoast('nudge', sender);
            pushRef.current({
              title: roast.title,
              body: roast.body,
              icon: roast.icon,
              category: 'nudge',
              link: safeInternalLink(payload.link, '/friends'),
              fromName: sender,
              fromAvatar: payload.fromAvatar
            });
            return;
          }
          case 'partner:request':
          case 'partner:accepted':
          case 'game:launched': {
            const payload = data.payload || {};
            if (!dedupe.first(payload.id ? `${data.type}:${payload.id}` : undefined)) return;
            const isGame = data.type === 'game:launched';
            pushRef.current(
              {
                title: String(payload.title || (isGame ? 'Game update' : 'Partner update')).slice(0, 120),
                body: String(payload.body || (isGame ? '' : 'Open Friends to respond.')).slice(0, 200),
                icon: isGame ? 'game' : 'users',
                category: isGame ? 'game' : 'system',
                link: safeInternalLink(payload.link, isGame ? '/games' : '/friends'),
                fromName: payload.fromDisplayName,
                fromAvatar: payload.fromAvatarUrl || undefined
              },
              { tag: payload.id ? `${data.type}:${payload.id}` : undefined }
            );
            if (!isGame && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('partner-requests-changed'));
            return;
          }
          case 'plan:notification': {
            const payload = data.payload || {};
            if (!dedupe.first(payload.id ? `plan:${payload.id}:${payload.title}` : undefined)) return;
            pushRef.current(
              {
                title: String(payload.title || 'Plan update').slice(0, 120),
                body: String(payload.body || '').slice(0, 200),
                icon: 'calendar',
                category: 'watch',
                link: safeInternalLink(payload.link, '/plans')
              },
              { tag: payload.id ? `plan:${payload.id}` : undefined }
            );
            return;
          }
          default:
            if (typeof data.type === 'string' && data.type.startsWith('call:')) CallSignaling.dispatch(data);
        }
      };

      ws.onclose = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (socketRef.current === ws) socketRef.current = null;
        scheduleReconnect();
      };
      ws.onerror = () => ws.close();
    };

    void connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeat) clearInterval(heartbeat);
      batcher.cancel();
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [userId, currentDevice, changeActiveDevice]);

  const switchToThisDevice = useCallback(async () => {
    try {
      const res = await recordActiveDeviceToken();
      if (res?.activeDevice) changeActiveDevice(res.activeDevice);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'presence:activate_device', ...currentDevice }));
      }
    } catch (err) {
      console.warn('[Notification] could not switch device:', err);
    }
  }, [currentDevice, changeActiveDevice]);

  const isMobileActive = activeDevice?.deviceType === 'mobile';
  const isCurrentDeviceActive = !activeDevice || activeDevice.deviceId === currentDevice.deviceId;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
        showPermissionModal,
        toasts,
        activeToast: toasts[0] ?? null,
        activeDevice,
        currentDevice,
        isMobileActive,
        isCurrentDeviceActive,
        switchToThisDevice,
        requestPermission,
        dismissPermissionModal,
        markAsRead,
        markAllAsRead,
        clearAll,
        dismissToast,
        triggerLocalNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
