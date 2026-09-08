export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export interface UserSession {
  token: string;
  user: {
    id: string;
    displayName: string;
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
      activityMode: params.activityMode || 'CINEMA'
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
