import type { GameRoom, User, GameType } from '@synccinema/common';

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
  // Notify same-tab listeners (e.g. AppSidebar avatar) about the update
  window.dispatchEvent(new Event('synccinema:session-updated'));
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('synccinema_session');
}

export async function checkEmail(email: string): Promise<{
  exists: boolean;
  hasPassword?: boolean;
  displayName?: string;
  avatarUrl?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      return { exists: false };
    }
    return await res.json();
  } catch {
    return { exists: false };
  }
}

export async function setPassword(email: string, newPassword: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE}/api/auth/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword })
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
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName })
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

export async function registerUser(
  payloadOrEmail: string | RegisterPayload,
  password?: string,
  displayName?: string
): Promise<UserSession> {
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
  customMessage?: string;
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

export async function sendPartnerNudge(
  token: string,
  params: {
    targetPartnerCode: string;
    message?: string;
    category?: string;
    link?: string;
  }
): Promise<{ success: boolean; deliveredLive: boolean; nudge: any }> {
  const res = await fetch(`${API_BASE}/api/notifications/nudge`, {
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
  partnerCode?: string,
  friendUserId?: string
): Promise<{ success: boolean; partner: any }> {
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
  const lower = (gameType || '').toLowerCase();
  const code = (roomCode || '').toUpperCase();

  let basePath = '/games/ludo';
  if (lower.includes('tambola') || lower.includes('housie') || code.startsWith('TAMBOLA-')) {
    basePath = '/games/tambola';
  } else if (lower.includes('bingo') || code.startsWith('BINGO-')) {
    basePath = '/games/bingo';
  } else if (lower.includes('tic') || code.startsWith('TIC-')) {
    basePath = '/games/tic-tac-toe';
  } else if (lower.includes('four') || lower.includes('connect') || code.startsWith('FOUR-')) {
    basePath = '/games/four-in-a-row';
  } else if (lower.includes('doodle') || lower.includes('draw') || lower.includes('pictionary') || code.startsWith('DOODLE-')) {
    basePath = '/games/doodle-duel';
  } else if (lower.includes('chess') || code.startsWith('CHESS-')) {
    basePath = '/games/chess';
  } else if (lower.includes('ludo') || code.startsWith('LUDO-')) {
    basePath = '/games/ludo';
  }
  return roomCode ? `${basePath}?room=${encodeURIComponent(roomCode)}` : basePath;
}

export function getGameTitle(gameType?: string, roomCode?: string): string {
  const lower = (gameType || '').toLowerCase();
  const code = (roomCode || '').toUpperCase();
  if (lower.includes('tambola') || lower.includes('housie') || code.startsWith('TAMBOLA-')) return 'Tambola';
  if (lower.includes('bingo') || code.startsWith('BINGO-')) return 'Bingo Duel';
  if (lower.includes('tic') || code.startsWith('TIC-')) return 'Tic-Tac-Toe';
  if (lower.includes('four') || lower.includes('connect') || code.startsWith('FOUR-')) return 'Four in a Row';
  if (lower.includes('doodle') || lower.includes('draw') || lower.includes('pictionary') || code.startsWith('DOODLE-')) return 'Doodle Duel';
  if (lower.includes('chess') || code.startsWith('CHESS-')) return 'Chess';
  return 'Ludo';
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
}

export interface FriendUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  partnerCode: string;
  isOnline: boolean;
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

// --- Real Plans API Endpoints ---
export async function getApiPlans(token?: string): Promise<{ plans: any[] }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans`, { headers });
  if (!res.ok) throw new Error('Failed to fetch plans');
  return res.json();
}

export async function getApiPlanById(id: string, token?: string): Promise<{ plan: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch plan');
  return res.json();
}

export async function createApiPlan(plan: any, token?: string): Promise<{ success: boolean; plan: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans`, {
    method: 'POST',
    headers,
    body: JSON.stringify(plan)
  });
  if (!res.ok) throw new Error('Failed to create plan');
  return res.json();
}

export async function updateApiPlan(id: string, updates: any, token?: string): Promise<{ success: boolean; plan: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update plan');
  return res.json();
}

export async function updateApiPlanRSVP(
  planId: string,
  payload: { userId: string; displayName?: string; avatarUrl?: string | null; status: string },
  token?: string
): Promise<{ success: boolean; plan: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans/${planId}/rsvp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update RSVP');
  return res.json();
}

export async function voteApiPlanOption(
  planId: string,
  payload: { optionId: string; userId: string },
  token?: string
): Promise<{ success: boolean; plan: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans/${planId}/vote`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to vote');
  return res.json();
}

export async function sendApiPlanChatMessage(
  planId: string,
  payload: { userId: string; displayName: string; avatarUrl?: string | null; text: string },
  token?: string
): Promise<{ success: boolean; message: any; plan: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans/${planId}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to send plan chat message');
  return res.json();
}

export async function deleteApiPlan(planId: string, token?: string): Promise<{ success: boolean; id: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/plans/${planId}`, {
    method: 'DELETE',
    headers
  });
  if (!res.ok) throw new Error('Failed to delete plan');
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


