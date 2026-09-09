import type { GameRoom, User } from '@synccinema/common';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export interface UserSession {
  token: string;
  user: {
    id: string;
    displayName: string;
    partnerCode?: string;
    avatarUrl?: string;
    isAnonymous: boolean;
  };
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
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('synccinema_session');
}

export async function loginUser(email: string, password?: string, displayName?: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to login');
  }

  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
}

export async function registerUser(email: string, password: string, displayName: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to register');
  }

  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
}

export async function ensureSession(preferredName?: string): Promise<UserSession> {
  const existing = getStoredSession();
  if (existing) return existing;

  const res = await fetch(`${API_BASE}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: preferredName })
  });

  if (!res.ok) {
    throw new Error('Failed to create guest session');
  }

  const session = (await res.json()) as UserSession;
  setStoredSession(session);
  return session;
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

export async function registerPartnerCode(params: {
  userId?: string;
  displayName?: string;
  customCode?: string;
  avatarUrl?: string;
  token?: string;
}): Promise<{ partnerCode: string; entry: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.token) headers['Authorization'] = `Bearer ${params.token}`;

  const res = await fetch(`${API_BASE}/api/games/partner/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error('Failed to register partner code');
  return res.json();
}

export async function checkPartnerStatus(code: string): Promise<PartnerPresence> {
  try {
    const res = await fetch(`${API_BASE}/api/games/partner/${encodeURIComponent(code)}`);
    if (!res.ok) return { found: false, online: false, partnerCode: code };
    return await res.json();
  } catch {
    return { found: false, online: false, partnerCode: code };
  }
}

export async function pingPartner(params: {
  targetCode: string;
  fromCode?: string;
  fromName?: string;
  roomCode?: string;
  gameType?: string;
}): Promise<{ success: boolean; deliveredLive: boolean; ping: PartnerPing }> {
  const res = await fetch(`${API_BASE}/api/games/partner/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to ping partner');
  }
  return res.json();
}

export async function getPartnerPings(code: string): Promise<PartnerPing[]> {
  try {
    const res = await fetch(`${API_BASE}/api/games/partner/${encodeURIComponent(code)}/pings`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.pings || [];
  } catch {
    return [];
  }
}

export async function markPartnerPingsRead(code: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/games/partner/pings/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCode: code })
    });
  } catch {}
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
  partnerCode: string
): Promise<{ success: boolean; partner: any }> {
  const res = await fetch(`${API_BASE}/api/user/partner/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ partnerCode })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to connect partner');
  }
  return res.json();
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
  gameType: 'ludo' | 'four-in-a-row' = 'ludo',
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

export async function getGameRoom(code: string): Promise<{ room: GameRoom; isFull?: boolean; canJoin?: boolean }> {
  const res = await fetch(`${API_BASE}/api/games/rooms/${encodeURIComponent(code)}`);
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
  gameType: 'ludo' | 'four-in-a-row' = 'ludo'
): Promise<{
  success: boolean;
  room: GameRoom;
  joinedPartnerRoom: boolean;
  inviteUrl: string;
}> {
  const res = await fetch(`${API_BASE}/api/games/partner/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ gameType })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to start match with partner');
  }
  return res.json();
}



