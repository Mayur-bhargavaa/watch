'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession, UserSession } from '../lib/api';
import { getRandomRoast, RoastCategory } from '../lib/roastMessages';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  emoji?: string;
  category: 'nudge' | 'game' | 'watch' | 'streak' | 'system';
  link: string;
  fromName?: string;
  fromAvatar?: string;
  createdAt: number;
  read: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  permission: NotificationPermission | 'unsupported';
  showPermissionModal: boolean;
  activeToast: AppNotification | null;
  requestPermission: () => Promise<boolean>;
  dismissPermissionModal: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  dismissToast: () => void;
  triggerLocalNotification: (data: {
    title: string;
    body: string;
    link?: string;
    category?: RoastCategory;
    fromName?: string;
  }) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = 'watch_party_notifications_v1';
const MODAL_DISMISSED_KEY = 'watch_notif_modal_dismissed_session';

// Synthesize pleasant sound with Web Audio API
function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
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
    // Ignore audio autoplay restrictions
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load notifications from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch {}

    // Register Service Worker for reliable OS-level desktop notifications in Chrome
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => {
          console.warn('[Watch] ServiceWorker registration notice:', err);
        });
    }

    // Check browser notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      // If permission is 'default' (not asked or not granted), show full blur modal
      if (Notification.permission === 'default') {
        const dismissed = sessionStorage.getItem(MODAL_DISMISSED_KEY);
        if (!dismissed) {
          setShowPermissionModal(true);
        }
      }
    }
  }, []);

  // Sync to local storage
  const saveNotifications = (newList: AppNotification[]) => {
    setNotifications(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList.slice(0, 50)));
    } catch {}
  };

  // Dispatch native browser notification (using ServiceWorker for persistent Chrome OS popups)
  const dispatchBrowserNotification = useCallback(
    async (notif: AppNotification) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      const title = notif.title;
      const iconUrl =
        typeof window !== 'undefined'
          ? new URL('/logos/direct.png', window.location.origin).href
          : '/logos/direct.png';

      const options: NotificationOptions = {
        body: notif.body,
        icon: iconUrl,
        badge: iconUrl,
        tag: notif.id,
        data: { url: notif.link || '/dashboard' },
        requireInteraction: true,
        silent: false
      };

      let delivered = false;

      // 1. Try ServiceWorkerRegistration.showNotification (works across tabs, minimized, and background windows)
      if ('serviceWorker' in navigator) {
        try {
          // Timeout after 800ms so we never hang if serviceWorker.ready is stuck
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
          ]);

          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title, options);
            delivered = true;
          }
        } catch (swErr) {
          console.warn('[Watch] SW showNotification failed, using fallback:', swErr);
        }
      }

      // 2. Fallback to standard Window Notification API if SW was not ready
      if (!delivered) {
        try {
          const n = new Notification(title, options);
          n.onclick = (e) => {
            e.preventDefault();
            window.focus();
            if (notif.link) {
              router.push(notif.link);
            }
            n.close();
          };
        } catch (notifErr) {
          console.warn('[Watch] Window Notification failed:', notifErr);
        }
      }
    },
    [router]
  );

  // Add notification, sound, and show toast + browser alert
  const pushNotification = useCallback(
    (item: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
      const newNotif: AppNotification = {
        ...item,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        read: false
      };

      setNotifications((prev) => {
        const updated = [newNotif, ...prev.filter((n) => n.id !== newNotif.id)].slice(0, 50);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Play audio chime
      playChimeSound();

      // Show toast
      setActiveToast(newNotif);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 6500);

      // Trigger native notification
      dispatchBrowserNotification(newNotif);
    },
    [dispatchBrowserNotification]
  );

  // Request browser notification permission
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setShowPermissionModal(false);
      return false;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        setShowPermissionModal(false);
        playChimeSound();
        pushNotification({
          title: 'Notifications Activated! 🎉',
          body: 'You are now ready to receive partner roasts, game invites, and watch party syncs!',
          category: 'system',
          emoji: '🔔',
          link: '/dashboard'
        });
        return true;
      } else {
        setShowPermissionModal(false);
        sessionStorage.setItem(MODAL_DISMISSED_KEY, 'true');
        return false;
      }
    } catch {
      setShowPermissionModal(false);
      return false;
    }
  };

  const dismissPermissionModal = () => {
    setShowPermissionModal(false);
    sessionStorage.setItem(MODAL_DISMISSED_KEY, 'true');
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const clearAll = () => {
    saveNotifications([]);
  };

  const dismissToast = () => {
    setActiveToast(null);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  };

  // Helper to trigger a local test or custom notification
  const triggerLocalNotification = (data: {
    title: string;
    body: string;
    link?: string;
    category?: RoastCategory;
    fromName?: string;
  }) => {
    const roast = getRandomRoast(data.category || 'nudge', data.fromName);
    pushNotification({
      title: data.title || roast.title,
      body: data.body || roast.body,
      emoji: roast.emoji,
      category: data.category || 'nudge',
      link: data.link || '/dashboard',
      fromName: data.fromName
    });
  };

  // Connect to /ws/presence WebSocket to listen for live events
  useEffect(() => {
    let active = true;

    const connectPresence = () => {
      if (!active) return;
      const session: UserSession | null = getStoredSession();
      const token = session?.token;
      const guestId = session?.user?.id;
      const guestName = session?.user?.displayName;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const url = `${wsProtocol}//${wsHost}/ws/presence?${token ? `token=${encodeURIComponent(token)}` : `guestId=${encodeURIComponent(guestId || '')}&guestName=${encodeURIComponent(guestName || '')}`}`;

      try {
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          // Heartbeat interval
          const hbInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'presence:heartbeat' }));
            } else {
              clearInterval(hbInterval);
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || !data.type) return;

            // Handle Partner Ping
            if (data.type === 'partner:ping') {
              const payload = data.payload || {};
              const sender = payload.fromName || 'Your Partner';
              const gameType = payload.gameType || 'ludo';
              const targetUrl = payload.roomCode
                ? `/games/${gameType === 'four-in-a-row' ? 'four-in-a-row' : 'ludo'}?room=${payload.roomCode}`
                : `/games/${gameType === 'four-in-a-row' ? 'four-in-a-row' : 'ludo'}`;

              const roast = payload.customMessage
                ? { title: `${sender} Nudged You! 💬`, body: payload.customMessage, emoji: '💬' }
                : getRandomRoast(payload.roomCode ? 'game' : 'nudge', sender);

              pushNotification({
                title: roast.title,
                body: roast.body,
                emoji: roast.emoji,
                category: payload.roomCode ? 'game' : 'nudge',
                link: targetUrl,
                fromName: sender
              });
            }

            // Handle Partner Game Invite
            if (data.type === 'partner:game_invite') {
              const payload = data.payload || {};
              const sender = payload.fromDisplayName || 'Your Partner';
              const gameType = payload.gameType || 'ludo';
              const roomCode = payload.roomCode;
              const targetUrl = `/games/${gameType === 'four-in-a-row' ? 'four-in-a-row' : 'ludo'}?room=${roomCode}`;

              const roast = getRandomRoast('game', sender);
              pushNotification({
                title: `🎮 ${sender} challenged you to ${gameType === 'four-in-a-row' ? 'Four in a Row' : 'Ludo'}!`,
                body: roast.body,
                emoji: '🎲',
                category: 'game',
                link: targetUrl,
                fromName: sender
              });
            }

            // Handle Nudge
            if (data.type === 'partner:nudge') {
              const payload = data.payload || {};
              const sender = payload.fromName || 'Your Partner';
              const roast = payload.message
                ? { title: `${sender} sent a roast! 🌶️`, body: payload.message, emoji: '🌶️' }
                : getRandomRoast('nudge', sender);

              pushNotification({
                title: roast.title,
                body: roast.body,
                emoji: roast.emoji,
                category: 'nudge',
                link: payload.link || '/friends',
                fromName: sender
              });
            }
          } catch {}
        };

        ws.onclose = () => {
          if (active) {
            reconnectTimeoutRef.current = setTimeout(connectPresence, 5000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (active) {
          reconnectTimeoutRef.current = setTimeout(connectPresence, 6000);
        }
      }
    };

    connectPresence();

    return () => {
      active = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [pushNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
        showPermissionModal,
        activeToast,
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
