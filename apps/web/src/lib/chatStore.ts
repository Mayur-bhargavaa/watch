'use client';

import {
  ChatConversation,
  ChatMessage,
  ChatMessageReaction,
  ChatUser,
  ChatMessageType,
  ChatMessageMetadata,
  ChatMessageRequest
} from '../types/chat';
import {
  getStoredSession,
  getFriendsWithStreaks,
  acceptFriendRequest,
  declineFriendRequest,
  addFriendByCode,
  API_BASE
} from './api';
import {
  toCanonicalConvId,
  extractParticipantIds,
  conversationAliases,
  isSameConversation,
  normalizeConversationId
} from './chatIds';

export { toCanonicalConvId };

const directPeerIdOf = (convId: string, myId?: string) => extractParticipantIds(convId, myId).otherUserId;

const STORAGE_PREFIX = 'watch_chat_v2_';

// Real-time state cache for authenticated user
let realFriendsMap: Record<string, ChatUser> = {};
let realRequestsList: ChatMessageRequest[] = [];
let cachedMyFriendCode: string = '';
// Conversations whose history was already pulled this session (avoids refetching every friend on every sync tick)
const hydratedConversations = new Set<string>();
let syncTimer: ReturnType<typeof setInterval> | null = null;
let storageListenerInstalled = false;

/** Resolves `currentUserId` (ignoring the legacy 'current-user' placeholder) to the signed-in user's id. */
function resolveMyId(currentUserId?: string): string | undefined {
  if (currentUserId && currentUserId !== 'current-user') return currentUserId;
  return typeof window !== 'undefined' ? getStoredSession()?.user?.id : undefined;
}

export function extractParticipantIdsFromConvId(
  convId: string,
  currentUserId?: string
): { userIds: string[]; otherUserId?: string } {
  return extractParticipantIds(convId, resolveMyId(currentUserId));
}

// All data in Chat is strictly real from MongoDB and WebSocket — no fake mock data
const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};

const MOCK_CONV_IDS = new Set(['conv_rahul', 'conv_group_friday', 'conv_dhruv', 'conv_mansi', 'conv_kunal']);
const MOCK_USER_IDS = new Set(['user_rahul', 'user_dhruv', 'user_mansi', 'user_kunal', 'rahul', 'dhruv', 'mansi', 'kunal']);
const MOCK_NAMES = new Set(['rahul sharma', 'dhruv verma', 'mansi gupta', 'kunal singhania', '🍿 friday night crew', 'friday night crew']);

export function isMockUser(u: any): boolean {
  if (!u) return false;
  if (u.id && MOCK_USER_IDS.has(String(u.id).toLowerCase())) return true;
  const name = (u.displayName || u.name || '').trim().toLowerCase();
  if (name && MOCK_NAMES.has(name)) return true;
  return false;
}

export function isMockConversation(c: any): boolean {
  if (!c) return false;
  if (c.id && MOCK_CONV_IDS.has(String(c.id).toLowerCase())) return true;
  const name = (c.name || c.title || '').trim().toLowerCase();
  if (name && MOCK_NAMES.has(name)) return true;
  if (Array.isArray(c.participants) && c.participants.length > 0) {
    if (c.participants.every((p: any) => isMockUser(p))) return true;
  }
  return false;
}

/** Chat storage/network failures are non-fatal; keep them visible in development instead of swallowing them. */
function chatWarn(context: string, err?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[chat] ${context}`, err ?? '');
  }
}

/** Last-activity time of a conversation (last message when known, else its own timestamp). */
function activityTime(c: ChatConversation): number {
  return new Date(c.lastMessage?.createdAt || c.updatedAt || 0).getTime() || 0;
}

/** Pinned first, then newest activity first, then id - a total order, so the list never reshuffles on its own. */
export function compareConversations(a: ChatConversation, b: ChatConversation): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  return activityTime(b) - activityTime(a) || a.id.localeCompare(b.id);
}

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Bumped on every store change. getConversations() derives the whole list (parses localStorage, merges duplicates,
 * recomputes last messages) and used to do that on EVERY call - several times per render. The result is now cached
 * and only rebuilt after something actually changed (a notify()).
 */
let conversationsVersion = 0;

function notify() {
  conversationsVersion += 1;
  listeners.forEach(fn => {
    try {
      fn();
    } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
  });
}

export class ChatStore {
  private static socketSender: ((msg: any) => void) | null = null;
  private static memoryMessages: Map<string, ChatMessage[]> = new Map();
  private static memoryConversations: ChatConversation[] = [];

  static registerSocketSender(sender: (msg: any) => void): void {
    this.socketSender = sender;
  }

  static sendRawSocket(msg: any): void {
    if (this.socketSender) {
      try {
        this.socketSender(msg);
      } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
    }
  }

  private static getStorageKey(userId?: string): string {
    const s = getStoredSession();
    const uid = userId || s?.user?.id || 'guest';
    return `${STORAGE_PREFIX}${uid}`;
  }

  private static safeSetLocalStorage(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      console.warn('LocalStorage quota limit reached, pruning stale message caches...', e);
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key && k.startsWith(STORAGE_PREFIX) && k.includes('_msgs_')) {
            toDelete.push(k);
          }
        }
        toDelete.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(key, value);
      } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
    }
  }

  private static serializeConversations(convs: ChatConversation[]): string {
    const stripped = convs.map((c) => {
      const { messages: _messages, ...rest } = c;
      return rest;
    });
    return JSON.stringify(stripped);
  }

  static purgeMockData(): void {
    if (typeof window === 'undefined') return;
    try {
      const s = getStoredSession();
      const myId = s?.user?.id;
      const storageKey = this.getStorageKey() + '_conversations';
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter((c: any) => {
              if (isMockConversation(c)) return false;
              if (myId && (c.id === `conv_${myId}` || c.id === `conv_${myId}_${myId}`)) return false;
              return true;
            });
            this.safeSetLocalStorage(storageKey, this.serializeConversations(clean));
          }
        } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
      }
      localStorage.removeItem(`${STORAGE_PREFIX}guest_conversations`);
      for (const id of MOCK_CONV_IDS) {
        localStorage.removeItem(`${this.getStorageKey()}_msgs_${id}`);
        localStorage.removeItem(`${STORAGE_PREFIX}guest_msgs_${id}`);
      }
    } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
  }

  private static convCache: { version: number; userId: string; list: ChatConversation[] } | null = null;

  /**
   * The conversation list (pinned first, newest activity next). Cached between store changes; every call returns
   * fresh copies of the conversation objects, so callers may edit them (and then saveConversations) safely.
   */
  static getConversations(): ChatConversation[] {
    const userId = getStoredSession()?.user?.id || '';
    let cache = this.convCache;
    if (!cache || cache.version !== conversationsVersion || cache.userId !== userId) {
      const list = this.computeConversations();
      // computeConversations may persist merges (and so notify); record the version AFTER it finished
      cache = { version: conversationsVersion, userId, list };
      this.convCache = cache;
    }
    return cache.list.map((c) => ({ ...c }));
  }

  private static computeConversations(): ChatConversation[] {
    let convs: ChatConversation[] = [];
    if (typeof window !== 'undefined') {
      try {
        const key = this.getStorageKey() + '_conversations';
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            convs = parsed.filter((c: any) => !isMockConversation(c));
            if (convs.length !== parsed.length) {
              this.safeSetLocalStorage(key, this.serializeConversations(convs));
            }
          }
        }
      } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
    }

    // Auto-merge / deduplicate any duplicate direct conversations pointing to the same user
    const s = getStoredSession();
    const myId = s?.user?.id;
    const deduplicated: ChatConversation[] = [];
    const seenFriendMap = new Map<string, ChatConversation>();
    let hadDuplicates = false;

    for (const c of convs) {
      if (c.type === 'group') {
        deduplicated.push(c);
        continue;
      }

      // Identify the other participant in this 1-on-1 direct chat
      const otherParticipant = c.participants?.find((p) => p && p.id && myId && p.id !== myId);
      const { otherUserId } = extractParticipantIdsFromConvId(c.id, myId);
      const friendId = (otherParticipant?.id && otherParticipant.id !== myId) ? otherParticipant.id : (otherUserId && otherUserId !== myId ? otherUserId : undefined);

      if (!friendId || friendId === myId) {
        deduplicated.push(c);
        continue;
      }
      const friendKey = friendId;

      // Canonical 1-on-1 ID
      const canonicalId = (myId && friendId && friendId !== myId) ? toCanonicalConvId(myId, friendId) : c.id;

      if (seenFriendMap.has(friendKey)) {
        hadDuplicates = true;
        const existingConv = seenFriendMap.get(friendKey)!;

        // Ensure existing conversation retains canonical ID
        existingConv.id = canonicalId;

        // Merge messages from c into canonicalId
        const msgs1 = this.getMessages(existingConv.id);
        const msgs2 = this.getMessages(c.id);
        const msgMap = new Map<string, ChatMessage>();
        msgs1.forEach((m) => msgMap.set(m.id, { ...m, conversationId: canonicalId }));
        msgs2.forEach((m) => msgMap.set(m.id, { ...m, conversationId: canonicalId }));
        const merged = Array.from(msgMap.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        this.saveMessages(canonicalId, merged);
        if (merged.length > 0) {
          existingConv.lastMessage = merged[merged.length - 1];
          existingConv.updatedAt = merged[merged.length - 1].createdAt;
        }
        existingConv.unreadCount = Math.max(existingConv.unreadCount || 0, c.unreadCount || 0);

        // Safely remove ONLY non-canonical duplicate storage
        if (c.id !== canonicalId) {
          try {
            localStorage.removeItem(`${this.getStorageKey()}_msgs_${c.id}`);
          } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
        }
      } else {
        // Enforce canonical ID for the conversation
        c.id = canonicalId;
        seenFriendMap.set(friendKey, c);
        deduplicated.push(c);
      }
    }

    if (hadDuplicates && typeof window !== 'undefined') {
      try {
        this.safeSetLocalStorage(this.getStorageKey() + '_conversations', this.serializeConversations(deduplicated));
      } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
    }
    convs = deduplicated;

    // Auto-merge all authenticated friends into convs if missing
    if (myId && realFriendsMap && Object.keys(realFriendsMap).length > 0) {
      const myUser: ChatUser = {
        id: myId,
        displayName: s?.user?.displayName || 'You',
        name: s?.user?.displayName || 'You',
        avatarUrl: s?.user?.avatarUrl || null,
        avatar: s?.user?.avatarUrl || undefined,
        onlineStatus: 'ONLINE',
        isOnline: true
      };

      for (const [friendId, chatUser] of Object.entries(realFriendsMap)) {
        if (!friendId || friendId === myId) continue;
        const canonicalId = toCanonicalConvId(myId, friendId);

        const existing = convs.find(
          (c) =>
            c.type === 'direct' &&
            (c.id === canonicalId ||
              c.id === `conv_${friendId}` ||
              c.participants?.some((p) => p && p.id === friendId))
        );

        if (!existing) {
          const msgs = this.getMessages(canonicalId);
          const lastMsg = msgs[msgs.length - 1] || null;
          const unreadCount = msgs.filter((m) => m.senderId === friendId && m.status !== 'read').length;
          const newConv: ChatConversation = {
            id: canonicalId,
            type: 'direct',
            name: chatUser.displayName || chatUser.name || 'Friend',
            title: chatUser.displayName || chatUser.name || 'Friend',
            avatarUrl: chatUser.avatarUrl || chatUser.avatar,
            avatar: chatUser.avatarUrl || chatUser.avatar || undefined,
            participants: [myUser, chatUser],
            messages: msgs,
            lastMessage: lastMsg,
            unreadCount,
            updatedAt: lastMsg?.createdAt || new Date().toISOString()
          };
          convs.push(newConv);
        }
      }
    }

    // Sort by newest activity first
    convs.sort(compareConversations);

    return convs.map(c => {
      const msgs = this.getMessages(c.id);
      return {
        ...c,
        title: c.title || c.name,
        avatar: c.avatar || c.avatarUrl || undefined,
        messages: msgs,
        lastMessage: c.lastMessage || msgs[msgs.length - 1] || null
      };
    });
  }

  static saveConversations(convs: ChatConversation[]): void {
    this.memoryConversations = convs;
    if (typeof window === 'undefined') return;
    try {
      this.safeSetLocalStorage(this.getStorageKey() + '_conversations', this.serializeConversations(convs));
    } catch (e) {
      console.warn('saveConversations local storage error:', e);
    } finally {
      notify();
    }
  }

  private static getOpenedViewOnceSet(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('watchparty_opened_view_once_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
    return new Set();
  }

  private static recordOpenedViewOnceId(messageId: string): void {
    if (typeof window === 'undefined' || !messageId) return;
    try {
      const set = this.getOpenedViewOnceSet();
      if (!set.has(messageId)) {
        set.add(messageId);
        localStorage.setItem('watchparty_opened_view_once_ids', JSON.stringify(Array.from(set)));
      }
    } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
  }

  static isViewOnceOpened(messageId: string): boolean {
    if (!messageId) return false;
    return this.getOpenedViewOnceSet().has(messageId);
  }

  static getConversationAliases(conversationId: string): string[] {
    return conversationAliases(conversationId, getStoredSession()?.user?.id);
  }

  static getMessages(conversationId: string): ChatMessage[] {
    if (!conversationId) return [];

    // 1. Check in-memory store first for instant access
    const cached = this.memoryMessages.get(conversationId);
    if (cached && cached.length > 0) {
      return cached.slice(); // copy: callers get their own array and never mutate the shared cache
    }

    if (typeof window === 'undefined') return INITIAL_MESSAGES[conversationId] || [];

    const msgMap = new Map<string, ChatMessage>();
    const aliases = this.getConversationAliases(conversationId);

    // Read messages from primary key and any alias keys to prevent message fragmentation
    for (const key of aliases) {
      try {
        const stored = localStorage.getItem(`${this.getStorageKey()}_msgs_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((m) => {
              if (m && m.id) {
                const existing = msgMap.get(m.id);
                if (!existing || (m.createdAt && new Date(m.createdAt).getTime() >= new Date(existing.createdAt || 0).getTime())) {
                  msgMap.set(m.id, { ...existing, ...m, conversationId });
                }
              }
            });
          }
        }
      } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
    }

    let msgs: ChatMessage[] = [];
    if (msgMap.size === 0) {
      msgs = INITIAL_MESSAGES[conversationId] || [];
      if (msgs.length > 0) {
        this.saveMessages(conversationId, msgs);
      }
    } else {
      msgs = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    // Apply permanent view-once opened flags
    const openedSet = this.getOpenedViewOnceSet();
    if (openedSet.size > 0 && Array.isArray(msgs)) {
      for (const m of msgs) {
        if (openedSet.has(m.id)) {
          if (!m.metadata) m.metadata = {};
          m.metadata.viewOnceOpened = true;
        }
      }
    }

    // Populate in-memory cache
    if (msgs.length > 0) {
      this.memoryMessages.set(conversationId, msgs);
      for (const alias of aliases) {
        this.memoryMessages.set(alias, msgs);
      }
    }

    return msgs.slice();
  }

  static saveMessages(conversationId: string, messages: ChatMessage[]): void {
    if (!conversationId) return;

    // 1. Always update memory cache immediately so UI gets instant updates
    const snapshot = messages.slice();
    this.memoryMessages.set(conversationId, snapshot);
    const aliases = this.getConversationAliases(conversationId);
    for (const alias of aliases) {
      this.memoryMessages.set(alias, snapshot);
    }

    // 2. Persist recent slice (latest 50 messages) to localStorage
    if (typeof window !== 'undefined') {
      try {
        const toStore = messages.slice(-50);
        const serialized = JSON.stringify(toStore);
        this.safeSetLocalStorage(`${this.getStorageKey()}_msgs_${conversationId}`, serialized);
        for (const alias of aliases) {
          if (alias !== conversationId) {
            this.safeSetLocalStorage(`${this.getStorageKey()}_msgs_${alias}`, serialized);
          }
        }
      } catch (e) {
        console.warn('saveMessages localStorage error:', e);
      }
    }

    // 3. Always notify subscribers regardless of storage state
    notify();
  }

  // Real-time synchronization: Load actual friends and requests from existing getFriendsWithStreaks() without touching DB
  static async syncWithExistingFriends(): Promise<void> {
    const s = getStoredSession();
    if (!s?.token) return;

    try {
      const res = await getFriendsWithStreaks(s.token).catch((err) => {
        chatWarn('friends list unavailable', err);
        return null;
      });

      if (res) {
        if (res.myFriendCode) {
          cachedMyFriendCode = res.myFriendCode;
        }

        const convs = this.getConversations();
        // When real authenticated user has friends, remove the mock seed placeholders
        const cleanConvs = convs.filter(
          (c) => !['conv_rahul', 'conv_dhruv', 'conv_mansi', 'conv_kunal', 'conv_group_friday'].includes(c.id)
        );

        // Build the new friends map off to the side and swap it in at the end, so readers never see an empty map
        const nextFriends: Record<string, ChatUser> = {};

        if (res.friends && Array.isArray(res.friends)) {
          for (const item of res.friends) {
            const friend = item.friendUser;
            if (!friend || !friend.id) continue;

            const chatUser: ChatUser = {
              id: friend.id,
              displayName: friend.displayName || 'Friend',
              name: friend.displayName || 'Friend',
              username: friend.partnerCode ? `${friend.partnerCode}` : undefined,
              avatarUrl: friend.avatarUrl,
              avatar: friend.avatarUrl || undefined,
              onlineStatus: friend.isOnline ? 'ONLINE' : 'OFFLINE',
              isOnline: Boolean(friend.isOnline),
              partnerCode: friend.partnerCode,
              streakDays: item.streak?.currentStreak || 0,
              moviesWatched: Math.floor((item.streak?.totalMinutesWatched || 0) / 100),
              gamesPlayed: 0,
              plansCount: 0,
              sharedStats: {
                moviesWatched: Math.floor((item.streak?.totalMinutesWatched || 0) / 100),
                gamesPlayed: 0,
                plansCompleted: 0
              },
              friendsSince: item.createdAt
                ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                : 'Connected',
              isFriend: true
            };

            nextFriends[friend.id] = chatUser;

            // Check if conversation already exists for this real friend
            const myId = s?.user?.id;
            const canonicalConvId = myId ? `conv_${[myId, friend.id].sort().join('_')}` : `conv_${friend.id}`;
            const myUser: ChatUser | null = myId ? {
              id: myId,
              displayName: s?.user?.displayName || 'You',
              name: s?.user?.displayName || 'You',
              avatarUrl: s?.user?.avatarUrl || null,
              avatar: s?.user?.avatarUrl || undefined,
              onlineStatus: 'ONLINE',
              isOnline: true
            } : null;
            const participants = myUser ? [myUser, chatUser] : [chatUser];

            // Load history once per friend per session; later updates arrive over the WebSocket / active-chat poll
            if (!hydratedConversations.has(canonicalConvId)) {
              hydratedConversations.add(canonicalConvId);
              void this.fetchRemoteMessages(canonicalConvId, { limit: 50 });
            }

            let existing = cleanConvs.find(
              (c) =>
                c.type === 'direct' &&
                (c.id === canonicalConvId ||
                  c.id === `conv_${friend.id}` ||
                  c.participants.some((p) => p && p.id === friend.id))
            );

            const msgs = this.getMessages(canonicalConvId);
            const lastMsg = msgs[msgs.length - 1] || null;
            const unreadCount = msgs.filter((m) => m.senderId === friend.id && m.status !== 'read').length;

            if (!existing) {
              const newConv: ChatConversation = {
                id: canonicalConvId,
                type: 'direct',
                name: friend.displayName,
                title: friend.displayName,
                avatarUrl: friend.avatarUrl,
                avatar: friend.avatarUrl || undefined,
                participants,
                messages: msgs,
                lastMessage: lastMsg,
                unreadCount,
                updatedAt: lastMsg?.createdAt || item.createdAt || new Date().toISOString()
              };
              cleanConvs.push(newConv);
            } else {
              existing.id = canonicalConvId;
              existing.name = friend.displayName;
              existing.title = friend.displayName;
              existing.avatarUrl = friend.avatarUrl;
              existing.avatar = friend.avatarUrl || undefined;
              existing.participants = participants;
              existing.messages = msgs;
              existing.lastMessage = lastMsg;
              existing.unreadCount = unreadCount;
              if (lastMsg?.createdAt) {
                existing.updatedAt = lastMsg.createdAt;
              }
            }
          }
        }

        // Map real incoming requests
        if (res.requests?.incoming && Array.isArray(res.requests.incoming)) {
          realRequestsList = res.requests.incoming.map((req) => ({
            id: req.requestId,
            senderId: req.user.id,
            senderName: req.user.displayName,
            senderAvatar: req.user.avatarUrl || undefined,
            previewText: `Wants to connect with you! Code: #${req.user.partnerCode}`,
            createdAt: req.createdAt
          }));
        } else {
          realRequestsList = [];
        }

        // Preserve live presence for friends we already knew, then swap the map in one step
        for (const [id, f] of Object.entries(nextFriends)) {
          if (realFriendsMap[id] && realFriendsMap[id].isOnline && !f.isOnline) {
            // server list is authoritative but may lag the WebSocket by a poll; keep the fresher 'online'
            f.isOnline = realFriendsMap[id].isOnline;
            f.onlineStatus = realFriendsMap[id].onlineStatus;
          }
        }
        realFriendsMap = nextFriends;
        this.saveConversations(cleanConvs);
      }
    } catch (err) {
      console.warn('Friends sync non-blocking error:', err);
    }
  }

  static initialize(): void {
    if (typeof window !== 'undefined') {
      this.purgeMockData();

      // Auto-purge any bloated keys (> 200KB) from localStorage so existing frozen users are freed immediately
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(STORAGE_PREFIX) || k.startsWith('watch_chat_'))) {
            const item = localStorage.getItem(k);
            if (item && item.length > 200000) {
              toRemove.push(k);
            }
          }
        }
        toRemove.forEach((k) => {
          console.log(`[ChatStore] Purging bloated key to unblock quota: ${k}`);
          localStorage.removeItem(k);
        });
      } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }

      const s = getStoredSession();
      const myId = s?.user?.id;
      if (myId) {
        try {
          // Remove contaminated self-conversation messages key if it was created
          localStorage.removeItem(`${this.getStorageKey()}_msgs_conv_${myId}`);
        } catch (err) {
        chatWarn('non-fatal storage/network error', err);
      }
      }

      // Another tab changed our chat data: drop in-memory copies and rebuild from storage
      if (!storageListenerInstalled) {
        storageListenerInstalled = true;
        window.addEventListener('storage', (e) => {
          if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
          this.memoryMessages.clear();
          notify();
        });
      }

      this.getConversations();
      void this.syncWithExistingFriends();

      // Keep friends and online status fresh (friend list only; message history comes over the WebSocket)
      if (!syncTimer) {
        syncTimer = setInterval(() => {
          void this.syncWithExistingFriends();
        }, 15000);
      }
    }
  }

  /** Stops background syncing (call on sign-out). */
  static dispose(): void {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    hydratedConversations.clear();
    realFriendsMap = {};
    realRequestsList = [];
    this.memoryMessages.clear();
    this.memoryConversations = [];
    this.convCache = null;
    conversationsVersion += 1;
  }

  static getUsers(): Record<string, ChatUser> {
    const userMap: Record<string, ChatUser> = {};
    for (const [id, u] of Object.entries(realFriendsMap)) {
      if (!isMockUser(u)) {
        userMap[id] = u;
      }
    }
    const convs = this.getConversations();
    for (const c of convs) {
      if (isMockConversation(c)) continue;
      for (const p of c.participants || []) {
        if (p?.id && !userMap[p.id] && !isMockUser(p)) {
          userMap[p.id] = {
            ...p,
            name: p.displayName || p.name || 'Friend',
            avatar: p.avatarUrl || p.avatar || undefined,
            isOnline: p.onlineStatus === 'ONLINE' || Boolean(p.isOnline)
          };
        }
      }
    }
    return userMap;
  }

  static getRequests(): ChatMessageRequest[] {
    return realRequestsList.filter(r => !isMockUser({ id: r.senderId, displayName: r.senderName }));
  }

  static getOrCreateDirectConversation(targetUser: ChatUser): ChatConversation {
    const s = getStoredSession();
    const myId = s?.user?.id;
    const canonicalId = myId ? `conv_${[myId, targetUser.id].sort().join('_')}` : `conv_${targetUser.id}`;
    const convs = this.getConversations();
    let existing = convs.find(
      (c) =>
        c.type === 'direct' &&
        (c.id === canonicalId ||
          c.id === `conv_${targetUser.id}` ||
          c.participants?.some((p) => p && p.id === targetUser.id))
    );

    const targetDisplayName = targetUser.displayName || targetUser.name || 'Friend';
    const targetAvatar = targetUser.avatarUrl || targetUser.avatar || null;

    if (existing) {
      // Opening a conversation must never change its timestamp or position in the list
      // (it used to bump `updatedAt` and move the chat to the top, then the next sync moved it back = list "jumping").
      const updatedTarget = { ...targetUser, displayName: targetDisplayName, name: targetDisplayName, avatarUrl: targetAvatar, avatar: targetAvatar || undefined };
      const next: ChatConversation = {
        ...existing,
        id: canonicalId,
        ...(targetDisplayName && targetDisplayName !== 'Friend' ? { name: targetDisplayName, title: targetDisplayName } : {}),
        ...(targetAvatar ? { avatarUrl: targetAvatar, avatar: targetAvatar } : {}),
        ...(myId ? { participants: [this.buildMyUser(), updatedTarget] } : {})
      };
      // Idempotent: only persist (and notify subscribers) when something visible actually changed,
      // otherwise opening a chat re-renders the list, which re-opens the chat, which re-renders... forever.
      const peerOf = (c: ChatConversation) => c.participants?.find((p) => p && p.id === targetUser.id);
      const unchanged =
        next.id === existing.id &&
        next.name === existing.name &&
        next.avatarUrl === existing.avatarUrl &&
        peerOf(next)?.displayName === peerOf(existing)?.displayName &&
        (peerOf(next)?.avatarUrl ?? null) === (peerOf(existing)?.avatarUrl ?? null) &&
        (next.participants?.length ?? 0) === (existing.participants?.length ?? 0);
      if (!unchanged) {
        this.saveConversations(convs.map((c) => (c === existing ? next : c)));
      }
      return next;
    }

    const msgs = this.getMessages(canonicalId);
    const myUser: ChatUser | null = myId ? {
      id: myId,
      displayName: s?.user?.displayName || 'You',
      name: s?.user?.displayName || 'You',
      avatarUrl: s?.user?.avatarUrl || null,
      avatar: s?.user?.avatarUrl || undefined,
      onlineStatus: 'ONLINE',
      isOnline: true
    } : null;
    const updatedTarget: ChatUser = {
      ...targetUser,
      displayName: targetDisplayName,
      name: targetDisplayName,
      avatarUrl: targetAvatar,
      avatar: targetAvatar || undefined
    };
    const participants = myUser ? [myUser, updatedTarget] : [updatedTarget];

    const newConv: ChatConversation = {
      id: canonicalId,
      type: 'direct',
      name: targetDisplayName,
      title: targetDisplayName,
      avatarUrl: targetAvatar,
      avatar: targetAvatar || undefined,
      participants,
      messages: msgs,
      lastMessage: msgs[msgs.length - 1] || null,
      unreadCount: 0,
      updatedAt: new Date().toISOString()
    };
    convs.unshift(newConv);
    this.saveConversations(convs);
    return newConv;
  }

  static createGroupConversation(name: string, memberIds: string[]): ChatConversation {
    const allUsers = this.getUsers();
    const members = memberIds.map(id => allUsers[id] || {
      id,
      displayName: id,
      onlineStatus: 'ONLINE' as const,
      isOnline: true
    });
    return this.createGroup(name, members);
  }

  static markAsRead(conversationId: string, senderId?: string): void {
    this.markConversationRead(conversationId, senderId);
  }

  static toggleReaction(conversationId: string, messageId: string, emoji: string, _currentUserId?: string): void {
    this.addReaction(conversationId, messageId, emoji);
  }

  static togglePin(conversationId: string, messageId: string): void {
    this.togglePinMessage(conversationId, messageId);
  }

  static declineRequest(conversationId: string): Promise<void> {
    return this.ignoreRequest(conversationId);
  }

  static sendMessage(
    arg1: string | {
      conversationId: string;
      senderId?: string;
      senderName?: string;
      senderAvatar?: string | null;
      content: string;
      type?: ChatMessageType;
      mediaUrl?: string;
      metadata?: ChatMessageMetadata;
      replyTo?: { id: string; senderName: string; content: string; type?: ChatMessageType } | null;
    },
    arg2?: string,
    arg3: ChatMessageType = 'text',
    arg4?: ChatMessageMetadata,
    arg5?: ChatMessage['replyTo']
  ): ChatMessage {
    const s = getStoredSession();
    const myId = s?.user?.id || 'current_user';
    const myName = s?.user?.displayName || 'You';
    const myAvatar = s?.user?.avatarUrl;

    let conversationId: string;
    let content: string;
    let type: ChatMessageType = 'text';
    let metadata: ChatMessageMetadata | undefined;
    let replyTo: ChatMessage['replyTo'] | undefined;
    let senderId = myId;
    let senderName = myName;
    let senderAvatar = myAvatar;
    let mediaUrl: string | undefined;

    if (typeof arg1 === 'object') {
      conversationId = arg1.conversationId;
      content = arg1.content;
      type = arg1.type || 'text';
      mediaUrl = arg1.mediaUrl;
      metadata = arg1.metadata;
      replyTo = arg1.replyTo;
      if (arg1.senderId) senderId = arg1.senderId;
      if (arg1.senderName) senderName = arg1.senderName;
      if (arg1.senderAvatar !== undefined) senderAvatar = arg1.senderAvatar || undefined;
    } else {
      conversationId = arg1;
      content = arg2 || '';
      type = arg3;
      metadata = arg4;
      replyTo = arg5;
    }

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      senderId,
      senderName,
      senderAvatar,
      type,
      content,
      mediaUrl,
      metadata,
      replyTo,
      createdAt: new Date().toISOString(),
      status: 'sent'
    };

    const msgs = [...this.getMessages(conversationId), newMsg];
    this.saveMessages(conversationId, msgs);

    // Update conversation last message & time
    const convs = this.getConversations();
    const convIndex = convs.findIndex((c) => isSameConversation(c.id, conversationId, myId));

    // Determine target recipient for live delivery
    let recipientId: string | undefined;
    const currentConv = convIndex >= 0 ? convs[convIndex] : undefined;
    const otherParticipant = currentConv?.participants.find((p) => p && p.id !== senderId);
    if (otherParticipant) {
      recipientId = otherParticipant.id;
    } else if (conversationId) {
      const { otherUserId } = extractParticipantIdsFromConvId(conversationId, senderId);
      recipientId = otherUserId;
    }

    if (convIndex >= 0) {
      convs[convIndex].lastMessage = newMsg;
      convs[convIndex].updatedAt = newMsg.createdAt;
      convs[convIndex].messages = msgs;
    } else {
      // Create new conversation in convs array so it appears immediately in Messages list
      const otherUser = recipientId
        ? realFriendsMap[recipientId] || {
            id: recipientId,
            displayName: senderName || 'Friend',
            name: senderName || 'Friend',
            onlineStatus: 'ONLINE' as const,
            isOnline: true
          }
        : undefined;

      const myUser: ChatUser = {
        id: myId,
        displayName: s?.user?.displayName || 'You',
        name: s?.user?.displayName || 'You',
        avatarUrl: s?.user?.avatarUrl || null,
        avatar: s?.user?.avatarUrl || undefined,
        onlineStatus: 'ONLINE',
        isOnline: true
      };
      const participants = otherUser ? [myUser, otherUser] : [myUser];

      const newConv: ChatConversation = {
        id: conversationId,
        type: 'direct',
        name: otherUser?.displayName || otherUser?.name || 'Friend',
        title: otherUser?.displayName || otherUser?.name || 'Friend',
        avatarUrl: otherUser?.avatarUrl || otherUser?.avatar || null,
        avatar: otherUser?.avatarUrl || otherUser?.avatar || undefined,
        participants,
        messages: msgs,
        lastMessage: newMsg,
        unreadCount: 0,
        updatedAt: newMsg.createdAt
      };
      convs.unshift(newConv);
    }

    // Re-sort with newest active conversation on top (unless pinned)
    convs.sort(compareConversations);
    this.saveConversations(convs);

    // 1. Dispatch live via WebSocket
    if (this.socketSender) {
      try {
        this.socketSender({
          type: 'chat:send',
          message: {
            ...newMsg,
            recipientId
          }
        });
      } catch (e) {
        console.warn('Socket send failed:', e);
      }
    }

    // 2. Dispatch via HTTP for guaranteed persistence
    void this.deliverOverHttp(newMsg, conversationId, recipientId);

    return newMsg;
  }

  /**
   * POSTs a message to the server. A rejected or unreachable request marks the message `failed`
   * (shown with a Retry button) instead of leaving it looking "sent" forever.
   */
  private static async deliverOverHttp(msg: ChatMessage, conversationId: string, recipientId?: string): Promise<void> {
    const s = getStoredSession();
    if (!s?.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
        body: JSON.stringify({ ...msg, recipientId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        chatWarn(`message ${msg.id} rejected (${res.status})`, data?.error);
        this.updateMessageStatus(msg.id, conversationId, 'failed');
        return;
      }
      if (data.message?.status) {
        this.updateMessageStatus(msg.id, conversationId, data.message.status);
      }
    } catch (err) {
      chatWarn(`message ${msg.id} could not be sent`, err);
      this.updateMessageStatus(msg.id, conversationId, 'failed');
    }
  }

  /** Retries a message that is marked `failed`. */
  static resendMessage(conversationId: string, messageId: string): void {
    const msg = this.patchMessage(conversationId, messageId, (m) => ({ ...m, status: 'sending' }));
    if (!msg) return;
    const myId = getStoredSession()?.user?.id;
    void this.deliverOverHttp(msg, conversationId, msg.recipientId || directPeerIdOf(conversationId, myId));
  }

  /** Replaces one message with an updated copy (new object => memoised bubbles re-render) and saves the list. */
  private static patchMessage(
    conversationId: string,
    messageId: string,
    update: (m: ChatMessage) => ChatMessage
  ): ChatMessage | null {
    const msgs = this.getMessages(conversationId);
    const i = msgs.findIndex((m) => m.id === messageId);
    if (i < 0) return null;
    const updated = update(msgs[i]);
    msgs[i] = updated;
    this.saveMessages(conversationId, msgs);
    return updated;
  }

  static addReaction(conversationId: string, messageId: string, emoji: string): void {
    const myId = getStoredSession()?.user?.id || 'current_user';

    this.patchMessage(conversationId, messageId, (msg) => {
      const reactions = (msg.reactions || []).map((r) => ({ ...r, userIds: [...r.userIds] }));
      const existing = reactions.find((r) => r.emoji === emoji);
      if (!existing) {
        reactions.push({ emoji, count: 1, userIds: [myId] });
      } else if (existing.userIds.includes(myId)) {
        existing.userIds = existing.userIds.filter((id) => id !== myId); // toggle off
        existing.count = existing.userIds.length;
      } else {
        existing.userIds.push(myId);
        existing.count = existing.userIds.length;
      }
      return { ...msg, reactions: reactions.filter((r) => r.count > 0) };
    });
    void this.sendReactionToServer(messageId, emoji);
  }

  /** Reactions live on the server so both people (and the phone app) see them: the local copy above shows it at once, this tells the server. */
  private static async sendReactionToServer(messageId: string, emoji: string): Promise<void> {
    const s = getStoredSession();
    if (!s?.token || !/^[A-Za-z0-9_-]{1,64}$/.test(messageId)) return;
    try {
      await fetch(`${API_BASE}/api/chat/messages/${encodeURIComponent(messageId)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
        body: JSON.stringify({ emoji })
      });
    } catch {
      // offline: the reaction stays on this device only
    }
  }

  /** The server says what a message's reactions are now (the other person reacted, or reacted from the phone app). */
  static applyServerReactions(conversationId: string, messageId: string, reactions: ChatMessageReaction[]): void {
    this.patchMessage(conversationId, messageId, (msg) => ({ ...msg, reactions: reactions.filter((r) => r.userIds.length > 0).map((r) => ({ emoji: r.emoji, userIds: r.userIds, count: r.userIds.length })) }));
  }

  static togglePinMessage(conversationId: string, messageId: string): void {
    this.patchMessage(conversationId, messageId, (m) => ({ ...m, isPinned: !m.isPinned }));
  }

  static deleteMessage(conversationId: string, messageId: string): void {
    let msgs = this.getMessages(conversationId);
    msgs = msgs.filter(m => m.id !== messageId);
    this.saveMessages(conversationId, msgs);

    const convs = this.getConversations();
    const conv = convs.find(c => c.id === conversationId);
    if (conv && conv.lastMessage?.id === messageId) {
      conv.lastMessage = msgs[msgs.length - 1] || null;
      this.saveConversations(convs);
    }
  }

  static markViewOnceOpened(conversationId: string, messageId: string, notifyServer = true): void {
    if (!messageId) return;

    // 1. Record permanently in the local opened set so it can NEVER revert on this client
    this.recordOpenedViewOnceId(messageId);

    // 2. Update the message (in the given conversation, or search all conversations when no id was given)
    const openedAt = new Date().toISOString();
    const markOpened = (m: ChatMessage): ChatMessage => ({
      ...m,
      metadata: { ...(m.metadata || {}), viewOnceOpened: true, viewOnceOpenedAt: openedAt }
    });
    let updated: ChatMessage | null = null;
    let ownerConvId = conversationId;
    if (conversationId) {
      updated = this.patchMessage(conversationId, messageId, markOpened);
    } else {
      for (const c of this.getConversations()) {
        updated = this.patchMessage(c.id, messageId, markOpened);
        if (updated) {
          ownerConvId = c.id;
          break;
        }
      }
    }
    if (updated) {
      const convs = this.getConversations();
      const conv = convs.find((c) => c.id === ownerConvId);
      if (conv && conv.lastMessage?.id === messageId) {
        conv.lastMessage = updated;
        this.saveConversations(convs);
      }
    }

    // 3. Notify all reactive components immediately
    notify();

    // 4. Tell the server and the sender (WebSocket + REST)
    if (!notifyServer) return;
    try {
      this.socketSender?.({ type: 'chat:view_once_opened', conversationId, messageId });
    } catch (err) {
      chatWarn('view-once socket notify failed', err);
    }
    const s = getStoredSession();
    if (s?.token) {
      fetch(`${API_BASE}/api/chat/view-once-opened`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
        body: JSON.stringify({ messageId, conversationId })
      }).catch((err) => chatWarn('view-once REST notify failed', err));
    }
  }

  static markConversationRead(conversationId: string, senderId?: string): void {
    const convs = this.getConversations();
    const conv = convs.find((c) => c.id === conversationId);
    const s = getStoredSession();
    const myId = s?.user?.id || 'current_user';

    const readMessageIds: string[] = [];
    const msgs = this.getMessages(conversationId).map((m) => {
      if (m.senderId !== myId && m.status !== 'read') {
        readMessageIds.push(m.id);
        return { ...m, status: 'read' as const };
      }
      return m;
    });
    const targetSenderId = senderId || conv?.participants.find((p) => p.id !== myId)?.id;

    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0;
      this.saveConversations(convs);
    }
    if (readMessageIds.length > 0) {
      this.saveMessages(conversationId, msgs);
    }

    try {
      if (this.socketSender && targetSenderId) {
        this.socketSender({ type: 'chat:read', conversationId, messageIds: readMessageIds, senderId: targetSenderId });
      }
    } catch (err) {
      chatWarn('read receipt socket send failed', err);
    }

    if (s?.token) {
      fetch(`${API_BASE}/api/chat/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
        body: JSON.stringify({ conversationId, senderId: targetSenderId })
      }).catch((err) => chatWarn('read receipt REST failed', err));
    }

    notify();
  }

  /** True when the user currently has this conversation open (so a new message is read immediately). */
  private static isViewing(targetConvId: string, canonicalConvId: string, incomingConvId: string, myId?: string): boolean {
    if (typeof window === 'undefined') return false;
    const activeId = sessionStorage.getItem('watch_active_conv_id');
    if (!activeId) return false;
    return [targetConvId, canonicalConvId, incomingConvId].some((id) => isSameConversation(activeId, id, myId));
  }

  static receiveIncomingMessage(incoming: ChatMessage): void {
    const s = getStoredSession();
    const myId = s?.user?.id;
    const conversationId = incoming.conversationId;
    if (!conversationId && !incoming.senderId) return;

    const convs = this.getConversations();
    const { otherUserId: convOtherId } = extractParticipantIdsFromConvId(conversationId, myId);
    const otherUserId = incoming.senderId === myId ? incoming.recipientId || convOtherId : incoming.senderId;
    const canonicalConvId =
      myId && otherUserId ? toCanonicalConvId(myId, otherUserId) : conversationId || `conv_${incoming.senderId}`;

    // Make sure the sender is known so getUsers() can show them
    if (incoming.senderId && incoming.senderId !== myId && !realFriendsMap[incoming.senderId]) {
      realFriendsMap[incoming.senderId] = {
        id: incoming.senderId,
        displayName: incoming.senderName || 'Friend',
        name: incoming.senderName || 'Friend',
        avatarUrl: incoming.senderAvatar || null,
        avatar: incoming.senderAvatar || undefined,
        onlineStatus: 'ONLINE',
        isOnline: true
      };
    }

    // Existing conversation: same canonical/received id, or the same direct peer (never a substring match)
    let conv = convs.find(
      (c) =>
        isSameConversation(c.id, canonicalConvId, myId) ||
        isSameConversation(c.id, conversationId, myId) ||
        (c.type === 'direct' && otherUserId && c.participants?.some((p) => p.id === otherUserId))
    );

    const targetConvId = conv ? conv.id : canonicalConvId;
    const normalizedMsg: ChatMessage = { ...incoming, conversationId: targetConvId };

    const msgs = this.getMessages(targetConvId);
    const existingIndex = msgs.findIndex((m) => m.id === normalizedMsg.id);
    const isNewMessage = existingIndex < 0;
    const existingMsg = isNewMessage ? null : msgs[existingIndex];

    const isOpened = Boolean(
      existingMsg?.metadata?.viewOnceOpened || normalizedMsg.metadata?.viewOnceOpened || this.isViewOnceOpened(normalizedMsg.id)
    );
    const merged: ChatMessage = {
      ...(existingMsg || {}),
      ...normalizedMsg,
      metadata: {
        ...(existingMsg?.metadata || {}),
        ...(normalizedMsg.metadata || {}),
        ...(isOpened ? { viewOnceOpened: true } : {})
      }
    };
    if (existingMsg) msgs[existingIndex] = merged;
    else msgs.push(merged);

    this.saveMessages(targetConvId, msgs);
    if (canonicalConvId && targetConvId !== canonicalConvId) {
      this.saveMessages(canonicalConvId, msgs);
    }

    const viewing = this.isViewing(targetConvId, canonicalConvId, incoming.conversationId, myId);
    if (!conv) {
      const senderUser: ChatUser = {
        id: incoming.senderId,
        displayName: incoming.senderName || 'Friend',
        name: incoming.senderName || 'Friend',
        avatarUrl: incoming.senderAvatar || null,
        avatar: incoming.senderAvatar || undefined,
        onlineStatus: 'ONLINE',
        isOnline: true
      };
      conv = {
        id: targetConvId,
        type: 'direct',
        name: incoming.senderName || 'Friend',
        title: incoming.senderName || 'Friend',
        avatarUrl: incoming.senderAvatar || null,
        avatar: incoming.senderAvatar || undefined,
        participants: myId ? [this.buildMyUser(), senderUser] : [senderUser],
        messages: msgs,
        lastMessage: merged,
        unreadCount: viewing ? 0 : 1,
        updatedAt: incoming.createdAt || new Date().toISOString()
      };
      convs.unshift(conv);
    } else {
      conv.lastMessage = merged;
      conv.updatedAt = merged.createdAt;
      conv.messages = msgs;
      // Only count as unread when the user is NOT looking at this conversation
      if (isNewMessage && !viewing) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
      convs.sort(compareConversations);
    }
    this.saveConversations(convs);

    if (viewing) {
      this.markAsRead(targetConvId, incoming.senderId);
    }
  }

  /** The signed-in user as a ChatUser (used for conversation participant lists). */
  private static buildMyUser(): ChatUser {
    const s = getStoredSession();
    return {
      id: s?.user?.id || 'current_user',
      displayName: s?.user?.displayName || 'You',
      name: s?.user?.displayName || 'You',
      avatarUrl: s?.user?.avatarUrl || null,
      avatar: s?.user?.avatarUrl || undefined,
      onlineStatus: 'ONLINE',
      isOnline: true
    };
  }

  /**
   * Updates delivery status. Receipts never downgrade a message ('read' is final) and a blanket "read" receipt
   * (no ids) only applies to the sender's OWN messages in that one conversation.
   */
  static updateMessageStatus(
    messageId?: string,
    conversationId?: string,
    status: ChatMessage['status'] = 'delivered',
    messageIds?: string[]
  ): void {
    const myId = getStoredSession()?.user?.id;
    const wholeConversationRead = !messageId && !messageIds && status === 'read';
    const idSet = new Set<string>([...(messageIds || []), ...(messageId ? [messageId] : [])]);

    for (const c of this.getConversations()) {
      if (wholeConversationRead && conversationId && !isSameConversation(c.id, conversationId, myId)) continue;

      let changed = false;
      const next = this.getMessages(c.id).map((m) => {
        const matches = idSet.has(m.id) || (wholeConversationRead && m.senderId === myId);
        if (!matches || m.status === status) return m;
        if (m.status === 'read' && status !== 'read') return m; // never downgrade
        changed = true;
        return { ...m, status };
      });
      if (changed) this.saveMessages(c.id, next);
    }
    notify();
  }

  static async fetchRemoteMessages(
    conversationId: string,
    options?: { before?: string; after?: string; limit?: number }
  ): Promise<void> {
    const s = getStoredSession();
    if (!s?.token || !conversationId) return;

    const myId = s.user?.id;
    const canonicalId = normalizeConversationId(conversationId, myId);

    try {
      const params = new URLSearchParams({ conversationId: canonicalId, limit: String(options?.limit || 100) });
      if (options?.before) params.set('before', options.before);
      if (options?.after) params.set('after', options.after);

      const res = await fetch(`${API_BASE}/api/chat/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${s.token}` }
      });
      if (!res.ok) {
        chatWarn(`fetching messages failed (${res.status})`);
        return;
      }
      const data = await res.json();
      if (!data.success || !Array.isArray(data.messages) || data.messages.length === 0) return;

      // Merge with what we already have (all aliases), keeping local view-once state and reactions
      const msgMap = new Map<string, ChatMessage>();
      this.getMessages(canonicalId).forEach((m) => msgMap.set(m.id, m));
      let added = 0;
      data.messages.forEach((m: ChatMessage) => {
        const existing = msgMap.get(m.id);
        if (!existing) added += 1;
        const isOpened = Boolean(existing?.metadata?.viewOnceOpened || m.metadata?.viewOnceOpened || this.isViewOnceOpened(m.id));
        msgMap.set(m.id, {
          ...(existing || {}),
          ...m,
          // never let a poll move a message backwards (e.g. 'read' -> 'delivered')
          status: existing?.status === 'read' ? 'read' : m.status || existing?.status || 'sent',
          conversationId: canonicalId,
          metadata: {
            ...(existing?.metadata || {}),
            ...(m.metadata || {}),
            ...(isOpened ? { viewOnceOpened: true } : {})
          }
        });
      });
      const merged = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      this.saveMessages(canonicalId, merged);
      if (conversationId !== canonicalId) this.saveMessages(conversationId, merged);

      // Update ONLY the matching conversation (exact id / same peer), never whichever chat happens to contain our id
      const convs = this.getConversations();
      const conv = convs.find((c) => isSameConversation(c.id, canonicalId, myId));
      if (conv) {
        conv.id = canonicalId;
        conv.lastMessage = merged[merged.length - 1];
        conv.updatedAt = merged[merged.length - 1].createdAt;
        this.saveConversations(convs);
      } else if (added > 0) {
        notify();
      }
    } catch (err) {
      chatWarn('fetchRemoteMessages failed', err);
    }
  }

  static setUserOnline(userId: string, isOnline: boolean, lastSeen?: string): void {
    if (realFriendsMap[userId]) {
      realFriendsMap[userId].isOnline = isOnline;
      realFriendsMap[userId].onlineStatus = isOnline ? 'ONLINE' : 'OFFLINE';
      if (lastSeen) realFriendsMap[userId].lastSeen = lastSeen;
    }

    const convs = this.getConversations();
    let changed = false;
    for (const c of convs) {
      for (const p of c.participants || []) {
        if (p.id === userId) {
          p.isOnline = isOnline;
          p.onlineStatus = isOnline ? 'ONLINE' : 'OFFLINE';
          if (lastSeen) p.lastSeen = lastSeen;
          changed = true;
        }
      }
    }
    if (changed) {
      this.saveConversations(convs);
    } else {
      notify();
    }
  }

  static setInitialOnlineUsers(userIds: string[]): void {
    const idSet = new Set(userIds);
    Object.values(realFriendsMap).forEach((f) => {
      f.isOnline = idSet.has(f.id);
      f.onlineStatus = f.isOnline ? 'ONLINE' : 'OFFLINE';
    });

    const convs = this.getConversations();
    let changed = false;
    for (const c of convs) {
      for (const p of c.participants || []) {
        const online = idSet.has(p.id);
        if (p.isOnline !== online) {
          p.isOnline = online;
          p.onlineStatus = online ? 'ONLINE' : 'OFFLINE';
          changed = true;
        }
      }
    }
    if (changed) {
      this.saveConversations(convs);
    } else {
      notify();
    }
  }

  static createGroup(name: string, members: ChatUser[]): ChatConversation {
    const newGroup: ChatConversation = {
      id: `conv_group_${Date.now()}`,
      type: 'group',
      name: name || 'New Watch Group',
      title: name || 'New Watch Group',
      avatarUrl: null,
      avatar: undefined,
      participants: members,
      messages: [],
      unreadCount: 0,
      updatedAt: new Date().toISOString()
    };

    const convs = this.getConversations();
    convs.unshift(newGroup);
    this.saveConversations(convs);

    this.sendMessage(
      newGroup.id,
      `Created group "${newGroup.name}" with ${members.length} members 🎉`,
      'system'
    );

    return newGroup;
  }

  static async acceptRequest(requestId: string): Promise<void> {
    const s = getStoredSession();
    const req = realRequestsList.find((r) => r.id === requestId);
    if (s?.token && req?.senderId) {
      try {
        await acceptFriendRequest(s.token, req.senderId);
        await this.syncWithExistingFriends();
        return;
      } catch (err) {
        console.warn('Failed to accept request:', err);
      }
    }

    // Fallback for local conversation request
    const convs = this.getConversations();
    const conv = convs.find((c) => c.id === requestId);
    if (conv) {
      conv.isRequest = false;
      this.saveConversations(convs);
      this.sendMessage(requestId, 'Accepted message request. You can now chat! ✨', 'system');
    }
  }

  static async ignoreRequest(requestId: string): Promise<void> {
    const s = getStoredSession();
    const req = realRequestsList.find((r) => r.id === requestId);
    if (s?.token && req?.senderId) {
      try {
        await declineFriendRequest(s.token, req.senderId);
        await this.syncWithExistingFriends();
        return;
      } catch (err) {
        console.warn('Failed to decline request:', err);
      }
    }

    let convs = this.getConversations();
    convs = convs.filter((c) => c.id !== requestId);
    this.saveConversations(convs);
  }

  static async addNewFriend(friendCode: string): Promise<{ success: boolean; message: string }> {
    const s = getStoredSession();
    if (!s?.token) return { success: false, message: 'Please log in to add friends' };
    try {
      const res = await addFriendByCode(s.token, friendCode.trim().replace(/^#/, ''));
      await this.syncWithExistingFriends();
      return { success: true, message: res.message || 'Friend request sent!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to connect friend' };
    }
  }

  static getMyFriendCode(): string {
    const s = getStoredSession();
    return cachedMyFriendCode || s?.user?.partnerCode || '';
  }

  static getUnreadTotalCount(): number {
    const convs = this.getConversations();
    return convs.reduce((acc, c) => acc + (c.isRequest ? 0 : c.unreadCount || 0), 0);
  }

  static subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
}
