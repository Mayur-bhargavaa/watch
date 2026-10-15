import { gameRoutePath, gameTitleFor } from './gameRoutes';
import type { GameRoom, User, GameType, ActiveDeviceSession } from '@synccinema/common';
import { getClientDeviceInfo, ClientDeviceInfo } from './deviceToken';
import { notificationStorageKey, LEGACY_NOTIFICATION_KEY } from './notifyHelpers';

const isClient = typeof window !== 'undefined';
const isRemoteClient = isClient && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export const API_BASE = isRemoteClient
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

export const WS_BASE = isRemoteClient
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000');

export interface UserSession {
  token: string;
  user: {
    id: string;
    email?: string | null;
    displayName: string;
    partnerCode?: string;
    avatarUrl?: string;
    isAnonymous: boolean;
    activeDevice?: ActiveDeviceSession | null;
    dateOfBirth?: string | null;
    anniversaryDate?: string | null;
    isMarried?: boolean | null;
    relationshipStatus?: string | null;
    gender?: string | null;
    pronouns?: string | null;
    location?: string | null;
    bio?: string | null;
    favoriteGenres?: string[] | null;
    viewingVibe?: string | null;
    age?: number | null;
    discoverable?: boolean;
    membership?: { tier: 'free' | 'plus' | 'creator'; badge: string; badgeLabel: string };
  };
}

/**
 * Browser sessions live in an httpOnly cookie that JavaScript cannot read. What we keep in localStorage is
 * only this placeholder, so existing `Bearer ${token}` call sites keep working: the fetch wrapper below
 * drops the placeholder header and lets the cookie authenticate the request.
 */
export const SESSION_PLACEHOLDER = 'cookie-session';

let apiFetchInstalled = false;
function installApiFetch(): void {
  if (apiFetchInstalled || typeof window === 'undefined') return;
  apiFetchInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (!url.startsWith(API_BASE)) return original(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (headers.get('Authorization') === `Bearer ${SESSION_PLACEHOLDER}`) headers.delete('Authorization');
    headers.set('X-Session-Mode', 'cookie');
    return original(input, { ...init, headers, credentials: 'include' });
  };
  void migrateLegacyToken();
}

/** One-time upgrade for users who still have a real JWT in localStorage from before cookie sessions. */
async function migrateLegacyToken(): Promise<void> {
  try {
    const raw = localStorage.getItem('synccinema_session');
    if (!raw) return;
    const session = JSON.parse(raw) as UserSession;
    if (!session?.token || session.token === SESSION_PLACEHOLDER) return;
    const res = await fetch(`${API_BASE}/api/auth/session`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('synccinema_session', JSON.stringify({ ...session, token: SESSION_PLACEHOLDER, user: data.user || session.user }));
    }
  } catch {}
}

/** One-time ticket for opening a WebSocket (so no credential ever appears in a URL). */
export async function getWsTicket(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/ws-ticket`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) throw new Error('Not signed in');
  return (await res.json()).ticket as string;
}

/** Authorization header from the stored session (empty when signed out). */
export function authHeaders(): Record<string, string> {
  const t = getStoredSession()?.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function getStoredSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('synccinema_session');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setStoredSession(session: UserSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('synccinema_session', JSON.stringify(session));
  // Notify same-tab listeners (e.g. AppSidebar avatar) about the update
  window.dispatchEvent(new Event('synccinema:session-updated'));
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  // Notifications belong to the account: drop them and this browser's push subscription on sign-out
  try {
    const userId = getStoredSession()?.user?.id;
    if (userId) localStorage.removeItem(notificationStorageKey(userId)!);
    localStorage.removeItem(LEGACY_NOTIFICATION_KEY);
    localStorage.removeItem('stitchbyte_watch_plans_v5'); // old shared plans cache
  } catch (err) {
    console.warn('[session] could not clear stored notifications:', err);
  }
  void import('./push').then((m) => m.removePushSubscription()).catch(() => {});
  localStorage.removeItem('synccinema_session');
  window.dispatchEvent(new Event('synccinema:session-updated'));
  // Ask the server to expire the httpOnly cookie
  fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', keepalive: true }).catch(() => {});
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not send the reset email');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not reset the password');
  }
  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
}

export async function setPassword(_email: string, newPassword: string, currentPassword?: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE}/api/auth/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ newPassword, currentPassword })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to set password');
  }

  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
}

export async function loginUser(email: string, password?: string, displayName?: string): Promise<UserSession> {
  const deviceInfo = typeof window !== 'undefined' ? getClientDeviceInfo() : undefined;
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, deviceInfo })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err: any = new Error(errorData.error || 'Failed to login');
    if (errorData.needsPasswordSetup) {
      err.needsPasswordSetup = true;
    }
    throw err;
  }

  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
}

export async function recordActiveDeviceToken(
  info?: Partial<ClientDeviceInfo>
): Promise<{ success: boolean; activeDevice: ActiveDeviceSession } | null> {
  try {
    const session = getStoredSession();
    const token = session?.token;
    const device = { ...getClientDeviceInfo(), ...info };

    const res = await fetch(`${API_BASE}/api/notifications/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        userId: session?.user?.id,
        ...device
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (session && data.activeDevice) {
      session.user.activeDevice = data.activeDevice;
      setStoredSession(session);
    }
    return data;
  } catch {
    return null;
  }
}

export interface RegisterPayload {
  email: string;
  password?: string;
  displayName: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  anniversaryDate?: string;
  isMarried?: boolean;
  age?: number;
}

/** Signup is verify-first: the account is only created when the emailed link is opened (see verifyEmail). */
export async function registerUser(
  payloadOrEmail: string | RegisterPayload,
  password?: string,
  displayName?: string
): Promise<{ pending: true; message: string }> {
  const body =
    typeof payloadOrEmail === 'object'
      ? payloadOrEmail
      : { email: payloadOrEmail, password, displayName: displayName || '' };

  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to register');
  }
  return res.json();
}

export async function verifyEmail(token: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'This confirmation link is invalid or has expired.');
  }
  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
}

export async function fetchCurrentUser(token?: string): Promise<UserSession | null> {
  const current = getStoredSession();
  const authToken = token || current?.token;
  if (!authToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.user && current) {
      const updatedSession: UserSession = {
        ...current,
        user: {
          ...current.user,
          ...data.user
        }
      };
      setStoredSession(updatedSession);
      return updatedSession;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateUserProfile(updates: {
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  anniversaryDate?: string;
  isMarried?: boolean;
  relationshipStatus?: string;
  gender?: string;
  pronouns?: string;
  location?: string;
  bio?: string;
  favoriteGenres?: string[];
  viewingVibe?: string;
  age?: number;
  discoverable?: boolean;
}): Promise<UserSession['user']> {
  const current = getStoredSession();
  if (!current?.token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${current.token}`
    },
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update profile');
  }

  const data = await res.json();
  const updatedSession: UserSession = {
    ...current,
    user: {
      ...current.user,
      ...data.user
    }
  };
  setStoredSession(updatedSession);
  return updatedSession.user;
}

export interface PartnerCodeStatus {
  currentCode: string;
  changesUsed: number;
  changesRemaining: number;
  maxChanges: number;
  periodDays: number;
  canChange: boolean;
  nextAvailableAt: string | null;
}

export async function getPartnerCodeStatus(): Promise<PartnerCodeStatus> {
  const current = getStoredSession();
  if (!current?.token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/user/partner-code/status`, {
    headers: {
      Authorization: `Bearer ${current.token}`
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch partner code status');
  }
  return res.json();
}

export async function changePartnerCode(newCode: string): Promise<{ success: boolean; partnerCode: string; changesRemaining: number }> {
  const current = getStoredSession();
  if (!current?.token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/user/partner-code`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${current.token}`
    },
    body: JSON.stringify({ newCode })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to change username');
  }

  // Update stored session with new partnerCode
  const updatedSession: UserSession = {
    ...current,
    user: {
      ...current.user,
      partnerCode: data.partnerCode
    }
  };
  setStoredSession(updatedSession);

  return data;
}

export async function ensureSession(): Promise<UserSession> {
  const existing = getStoredSession();
  if (existing && !existing.user?.isAnonymous) {
    return existing;
  }

  // Clear any leftover guest or anonymous session
  clearStoredSession();

  // Redirect browser to login with return path
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  }

  throw new Error('Authentication required. Please sign in or create an account to continue.');
}

export async function createPartyRoom(params: {
  title?: string;
  sourceUrl?: string;
  mediaTitle?: string;
  privacy?: 'PUBLIC' | 'INVITE_ONLY' | 'PRIVATE';
  activityMode?: 'CINEMA' | 'GAMING';
  roomCode?: string;
  slug?: string;
  token: string;
}): Promise<{ room: any; inviteUrl: string }> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`
    },
    body: JSON.stringify({
      title: params.title,
      sourceUrl: params.sourceUrl,
      mediaTitle: params.mediaTitle,
      privacy: params.privacy,
      activityMode: params.activityMode || 'CINEMA',
      roomCode: params.roomCode,
      slug: params.slug
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create room');
  }

  return res.json();
}

export async function getUserRooms(token: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/user/rooms`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.rooms || [];
}

export interface PartnerPresence {
  found: boolean;
  online: boolean;
  partnerCode: string;
  partner?: {
    code: string;
    displayName: string;
    avatarUrl?: string;
    currentRoom?: string;
  };
}

export interface PartnerPing {
  id: string;
  fromCode: string;
  fromName: string;
  targetCode: string;
  roomCode?: string;
  gameType: string;
  createdAt: number;
  read: boolean;
}

export async function pingPartner(params: {
  targetCode: string;
  fromCode?: string;
  fromName?: string;
  roomCode?: string;
  gameType?: string;
  customMessage?: string;
}): Promise<{ success: boolean; deliveredLive: boolean; ping: PartnerPing }> {
  const res = await fetch(`${API_BASE}/api/games/partner/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to ping partner');
  }
  return res.json();
}

export async function sendPartnerNudge(
  token: string,
  params: {
    targetPartnerCode: string;
    message?: string;
    category?: string;
    link?: string;
  }
): Promise<{ success: boolean; deliveredLive: boolean; nudge: any }> {
  const res = await fetch(`${API_BASE}/api/friends/nudge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send nudge');
  }
  return res.json();
}

export async function getUserMe(token: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/user/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to get user details');
  return res.json();
}

export async function getUserPartner(token: string): Promise<{
  partner: {
    id: string;
    displayName: string;
    partnerCode: string;
    avatarUrl?: string | null;
    online: boolean;
  } | null;
}> {
  const res = await fetch(`${API_BASE}/api/user/partner`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to get partner status');
  return res.json();
}

export async function connectUserPartner(
  token: string,
  partnerCode?: string,
  friendUserId?: string
): Promise<{ success: boolean; partner?: any; requested?: boolean; pending?: boolean; recipient?: { id: string; displayName: string; avatarUrl: string | null } }> {
  const res = await fetch(`${API_BASE}/api/user/partner/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ partnerCode, friendUserId })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to connect partner');
  }
  return res.json();
}

/** Text for a partner code that created a request instead of linking at once. */
export function partnerRequestNotice(res: { requested?: boolean; recipient?: { displayName: string } } | null | undefined): string | null {
  return res?.requested ? `Request sent. Waiting for ${res.recipient?.displayName || 'them'} to accept.` : null;
}

export interface PartnerRequestRow { userId: string; displayName: string; avatarUrl: string | null; createdAt: number }

async function partnerRequestCall(token: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API_BASE}/api/user/partner/requests${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const getPartnerRequests = (token: string): Promise<{ incoming: PartnerRequestRow[]; outgoing: PartnerRequestRow[] }> => partnerRequestCall(token, '');
export const acceptPartnerRequest = (token: string, requesterUserId: string) => partnerRequestCall(token, '/accept', { requesterUserId });
export const declinePartnerRequest = (token: string, requesterUserId: string) => partnerRequestCall(token, '/decline', { requesterUserId });
export const cancelPartnerRequest = (token: string, recipientUserId: string) => partnerRequestCall(token, '/cancel', { recipientUserId });

export async function getGameInterest(token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/games/interest`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Could not load your notify list');
  return (await res.json()).gameIds || [];
}
export async function setGameInterest(token: string, gameId: string, on: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/games/interest${on ? '' : `/${encodeURIComponent(gameId)}`}`, {
    method: on ? 'POST' : 'DELETE',
    headers: { Authorization: `Bearer ${token}`, ...(on ? { 'Content-Type': 'application/json' } : {}) },
    body: on ? JSON.stringify({ gameId }) : undefined
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not update your notify list');
  }
}

export async function disconnectUserPartner(token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/partner`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to disconnect partner');
  }
  return res.json();
}

export async function matchmakeGame(
  token: string,
  gameType: 'ludo' | 'four-in-a-row' = 'ludo',
  maxPlayers: number = 2
): Promise<{ room: GameRoom; joinedExisting: boolean }> {
  const res = await fetch(`${API_BASE}/api/games/matchmake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ gameType, maxPlayers })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to find/create game match');
  }
  return res.json();
}

export async function createGameRoom(
  token: string,
  gameType: GameType = 'ludo',
  maxPlayers: number = 2,
  isPrivate = false,
  customCode?: string
): Promise<{ room: GameRoom }> {
  const res = await fetch(`${API_BASE}/api/games/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ gameType, maxPlayers, isPrivate, customCode })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create game room');
  }
  return res.json();
}

export async function getGameRoom(code: string): Promise<{ room: GameRoom; isFull?: boolean; canJoin?: boolean; spectatable?: boolean }> {
  const res = await fetch(`${API_BASE}/api/games/rooms/${encodeURIComponent(code)}`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to get game room');
  }
  return res.json();
}

export async function joinGameRoom(token: string, code: string): Promise<{ room: GameRoom }> {
  const res = await fetch(`${API_BASE}/api/games/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to join game room');
  }
  return res.json();
}

export async function invitePartnerToGame(
  token: string,
  targetPartnerCode: string,
  roomCode: string,
  gameType = 'ludo'
): Promise<{ success: boolean; deliveredLive: boolean; ping: any }> {
  const res = await fetch(`${API_BASE}/api/games/partner/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ targetPartnerCode, roomCode, gameType })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to invite partner');
  }
  return res.json();
}

export async function sendHeartbeat(token: string): Promise<{
  status: string;
  isOnline: boolean;
  myPartnerCode?: string;
  partner: {
    id: string;
    displayName: string;
    partnerCode: string;
    avatarUrl?: string | null;
    online: boolean;
  } | null;
}> {
  const res = await fetch(`${API_BASE}/api/user/heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Heartbeat failed');
  return res.json();
}

export async function playWithPartner(
  token: string,
  gameType: GameType = 'ludo',
  friendUserId?: string
): Promise<{
  success: boolean;
  room: GameRoom;
  joinedPartnerRoom: boolean;
  inviteUrl: string;
}> {
  const base = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.origin
    : API_BASE;

  try {
    const res = await fetch(`${base}/api/games/partner/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ gameType, friendUserId, targetUserId: friendUserId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to start match with partner');
    }
    return res.json();
  } catch (err: any) {
    console.error('Error in playWithPartner:', err);
    throw new Error(err.message || 'Network error connecting to partner service');
  }
}

export async function createGameRoomWithPartner(
  gameType: GameType = 'bingo',
  friendUserId?: string
): Promise<{ room: GameRoom; inviteUrl?: string }> {
  const s = getStoredSession();
  if (!s?.token) throw new Error('Not authenticated');
  const res = await playWithPartner(s.token, gameType, friendUserId);
  return { room: res.room, inviteUrl: res.inviteUrl };
}

export async function joinGameRoomByCode(code: string): Promise<{ room: GameRoom }> {
  const s = getStoredSession();
  if (!s?.token) throw new Error('Not authenticated');
  return joinGameRoom(s.token, code);
}

export function getGameRoute(gameType?: string, roomCode?: string): string {
  return gameRoutePath(gameType, roomCode);
}

export function getGameTitle(gameType?: string, roomCode?: string): string {
  return gameTitleFor(gameType, roomCode);
}

// =====================================================================
// Snapchat-Style Friends & Daily Streaks (🔥) API
// =====================================================================

export interface FriendStreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastWatchedDate: string | null;
  completedToday: boolean;
  atRisk: boolean;
  totalMinutesWatched: number;
  /** length of the last run of streak days ending at lastWatchedDate (still set after the streak breaks) */
  lastRunLength?: number;
}

export interface FriendUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  partnerCode: string;
  isOnline: boolean;
  membershipTier?: 'free' | 'plus' | 'creator';
}

export interface FriendWithStreak {
  friendshipId: string;
  friendUser: FriendUser;
  streak: FriendStreakInfo;
  createdAt: string;
}

export interface FriendRequestItem {
  requestId: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    partnerCode: string;
  };
  createdAt: string;
}

export interface FriendRequestsData {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}

export interface DiscoverableUserItem {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  partnerCode: string;
  requestStatus: 'NONE' | 'SENT' | 'RECEIVED';
}

export async function getFriendsWithStreaks(token: string): Promise<{
  friends: FriendWithStreak[];
  requests?: FriendRequestsData;
  pendingRequestsCount?: number;
  myFriendCode: string;
}> {
  const res = await fetch(`${API_BASE}/api/friends`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch friends');
  }
  return res.json();
}

export async function getFriendRequests(token: string): Promise<FriendRequestsData> {
  const res = await fetch(`${API_BASE}/api/friends/requests`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch friend requests');
  }
  return res.json();
}

export async function getDiscoverableUsers(token: string, search?: string): Promise<{
  success: boolean;
  users: DiscoverableUserItem[];
}> {
  const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const res = await fetch(`${API_BASE}/api/friends/discover${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch discoverable users');
  }
  return res.json();
}

export async function addFriendByCode(token: string, friendCode: string): Promise<{
  success: boolean;
  status: 'PENDING' | 'ACCEPTED';
  friend?: FriendWithStreak;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/friends/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ friendCode })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to add friend');
  }
  return res.json();
}

export async function acceptFriendRequest(token: string, senderUserId: string): Promise<{
  success: boolean;
  friend: FriendWithStreak;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/friends/requests/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ senderUserId })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to accept friend request');
  }
  return res.json();
}

export async function declineFriendRequest(token: string, senderUserId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/friends/requests/decline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ senderUserId })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to decline friend request');
  }
  return res.json();
}

export async function cancelFriendRequest(token: string, targetUserId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/friends/requests/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ targetUserId })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to cancel friend request');
  }
  return res.json();
}

export async function removeFriend(token: string, friendUserId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/friends/${encodeURIComponent(friendUserId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to remove friend');
  }
  return res.json();
}

export async function recordFriendStreak(
  token: string,
  friendUserId: string,
  minutes: number = 1
): Promise<{
  success: boolean;
  status: 'ALREADY_COMPLETED' | 'EXTENDED' | 'RESET_STARTED';
  streak: FriendStreakInfo;
}> {
  const res = await fetch(`${API_BASE}/api/streaks/record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ friendUserId, minutes })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to record streak');
  }
  return res.json();
}

export interface ActiveFriendInGame {
  friend: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    partnerCode?: string;
    isOnline: boolean;
  };
  game: {
    roomId: string;
    roomCode: string;
    gameType: string;
    gameTitle: string;
    status: 'WAITING' | 'PLAYING';
    playerCount: number;
    maxPlayers: number;
    isHost: boolean;
    joinUrl: string;
    /** PLAYING rooms of a friend that the caller may watch read-only. */
    canSpectate?: boolean;
    spectateUrl?: string;
    spectatorCount?: number;
  };
}

export async function getActiveFriendsInGames(token: string): Promise<{ success: boolean; activeFriends: ActiveFriendInGame[] }> {
  const res = await fetch(`${API_BASE}/api/games/active-friends`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    return { success: false, activeFriends: [] };
  }
  return res.json();
}

installApiFetch();
