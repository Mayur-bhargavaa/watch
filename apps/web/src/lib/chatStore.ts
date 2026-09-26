'use client';

import {
  ChatConversation,
  ChatMessage,
  ChatUser,
  ChatMessageReaction,
  ChatPlanPayload,
  ChatGamePayload,
  ChatMoviePayload,
  ChatMessageType,
  ChatMessageMetadata,
  ChatMessageRequest
} from '../types/chat';
import {
  getStoredSession,
  getFriendsWithStreaks,
  getUserPartner,
  acceptFriendRequest,
  declineFriendRequest,
  addFriendByCode,
  API_BASE
} from './api';

const STORAGE_PREFIX = 'watch_chat_v2_';

// Real-time state cache for authenticated user
let realFriendsMap: Record<string, ChatUser> = {};
let realRequestsList: ChatMessageRequest[] = [];
let cachedMyFriendCode: string = '';

export function extractParticipantIdsFromConvId(
  convId: string,
  currentUserId?: string
): { userIds: string[]; otherUserId?: string } {
  if (!convId) {
    return { userIds: [] };
  }
  const raw = convId.startsWith('conv_') ? convId.slice(5) : convId; // strip 'conv_'
  const realMyId = (currentUserId && currentUserId !== 'current-user')
    ? currentUserId
    : (typeof window !== 'undefined' ? getStoredSession()?.user?.id : undefined);

  // Pattern: usr_AAA_usr_BBB or AAA_usr_BBB
  if (raw.includes('_usr_')) {
    const idx = raw.indexOf('_usr_');
    const u1 = raw.slice(0, idx);
    const u2 = raw.slice(idx + 1); // includes 'usr_'
    const userIds = [u1, u2];
    const otherUserId = realMyId ? (u1 === realMyId ? u2 : (u2 === realMyId ? u1 : u2)) : u2;
    return { userIds, otherUserId };
  }

  // Fallback: If realMyId is inside raw
  if (realMyId && raw.includes(realMyId)) {
    let remainder = raw.replace(realMyId, '');
    if (remainder.startsWith('_')) remainder = remainder.slice(1);
    if (remainder.endsWith('_')) remainder = remainder.slice(0, -1);
    if (remainder) {
      return { userIds: [realMyId, remainder], otherUserId: remainder };
    }
  }

  if (raw.includes('_')) {
    const parts = raw.split('_');
    // Single user ID with prefix usr_ (e.g. usr_qu8M4HFI04)
    if (parts.length === 2 && parts[0] === 'usr') {
      const singleUserId = `usr_${parts[1]}`;
      const otherUserId = (realMyId && singleUserId === realMyId) ? undefined : singleUserId;
      return { userIds: [singleUserId], otherUserId };
    }
    // General two-part ID: AAA_BBB
    if (parts.length === 2 && parts[0] !== 'usr') {
      const u1 = parts[0];
      const u2 = parts[1];
      const userIds = [u1, u2];
      const otherUserId = realMyId ? (u1 === realMyId ? u2 : (u2 === realMyId ? u1 : u2)) : u2;
      return { userIds, otherUserId };
    }
  }

  const otherUserId = (realMyId && raw === realMyId) ? undefined : raw;
  return { userIds: [raw], otherUserId };
}

export function toCanonicalConvId(userA: string, userB: string): string {
  return `conv_${[userA, userB].sort().join('_')}`;
}

// All data in Chat is strictly real from MongoDB and WebSocket — no fake mock data
const DEFAULT_PARTICIPANTS: Record<string, ChatUser> = {};
const INITIAL_CONVERSATIONS: ChatConversation[] = [];
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

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {}
  });
}

export class ChatStore {
  private static socketSender: ((msg: any) => void) | null = null;

  static registerSocketSender(sender: (msg: any) => void): void {
    this.socketSender = sender;
  }

  static sendRawSocket(msg: any): void {
    if (this.socketSender) {
      try {
        this.socketSender(msg);
      } catch {}
    }
  }

  private static getStorageKey(userId?: string): string {
    const s = getStoredSession();
    const uid = userId || s?.user?.id || 'guest';
    return `${STORAGE_PREFIX}${uid}`;
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
            localStorage.setItem(storageKey, JSON.stringify(clean));
          }
        } catch {}
      }
      localStorage.removeItem(`${STORAGE_PREFIX}guest_conversations`);
      for (const id of MOCK_CONV_IDS) {
        localStorage.removeItem(`${this.getStorageKey()}_msgs_${id}`);
        localStorage.removeItem(`${STORAGE_PREFIX}guest_msgs_${id}`);
      }
    } catch {}
  }

  static getConversations(): ChatConversation[] {
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
              localStorage.setItem(key, JSON.stringify(convs));
            }
          }
        }
      } catch {}
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
          } catch {}
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
        localStorage.setItem(this.getStorageKey() + '_conversations', JSON.stringify(deduplicated));
      } catch {}
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
    convs.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

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
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey() + '_conversations', JSON.stringify(convs));
      notify();
    } catch {}
  }

  private static getOpenedViewOnceSet(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('watchparty_opened_view_once_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
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
    } catch {}
  }

  static isViewOnceOpened(messageId: string): boolean {
    if (!messageId) return false;
    return this.getOpenedViewOnceSet().has(messageId);
  }

  static getConversationAliases(conversationId: string): string[] {
    const s = getStoredSession();
    const myId = s?.user?.id;
    const aliases = new Set<string>([conversationId]);

    const { userIds, otherUserId } = extractParticipantIdsFromConvId(conversationId, myId);
    const friendId = otherUserId || userIds.find((id) => id !== myId);
    if (friendId && friendId !== myId) {
      aliases.add(`conv_${friendId}`);
      if (myId) {
        aliases.add(toCanonicalConvId(myId, friendId));
      }
    }
    // CRITICAL: NEVER include conv_${myId} in aliases, because the current user is
    // part of every chat, which would cause all separate conversations to cross-contaminate!
    if (myId) {
      aliases.delete(`conv_${myId}`);
    }
    return Array.from(aliases);
  }

  static getMessages(conversationId: string): ChatMessage[] {
    if (!conversationId) return [];
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
      } catch {}
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
    return msgs;
  }

  static saveMessages(conversationId: string, messages: ChatMessage[]): void {
    if (typeof window === 'undefined' || !conversationId) return;
    try {
      localStorage.setItem(`${this.getStorageKey()}_msgs_${conversationId}`, JSON.stringify(messages));
      // Also mirror to canonical ID if this was a legacy direct chat key
      const aliases = this.getConversationAliases(conversationId);
      for (const alias of aliases) {
        if (alias !== conversationId) {
          try {
            localStorage.setItem(`${this.getStorageKey()}_msgs_${alias}`, JSON.stringify(messages));
          } catch {}
        }
      }
      notify();
    } catch {}
  }

  // Real-time synchronization: Load actual friends and requests from existing getFriendsWithStreaks() without touching DB
  static async syncWithExistingFriends(): Promise<void> {
    const s = getStoredSession();
    if (!s?.token) return;

    try {
      const [res, partnerRes] = await Promise.all([
        getFriendsWithStreaks(s.token).catch(() => null),
        getUserPartner(s.token).catch(() => null)
      ]);

      if (res) {
        if (res.myFriendCode) {
          cachedMyFriendCode = res.myFriendCode;
        }

        const convs = this.getConversations();
        // When real authenticated user has friends, remove the mock seed placeholders
        let cleanConvs = convs.filter(
          (c) => !['conv_rahul', 'conv_dhruv', 'conv_mansi', 'conv_kunal', 'conv_group_friday'].includes(c.id)
        );
        let changed = cleanConvs.length !== convs.length;

        realFriendsMap = {};

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
              gamesPlayed: item.streak?.currentStreak || 0,
              plansCount: 0,
              sharedStats: {
                moviesWatched: Math.floor((item.streak?.totalMinutesWatched || 0) / 100),
                gamesPlayed: item.streak?.currentStreak || 0,
                plansCompleted: 0
              },
              friendsSince: item.createdAt
                ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                : 'Connected',
              isFriend: true
            };

            realFriendsMap[friend.id] = chatUser;

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

            // Fetch latest messages from remote server in background for this friend
            this.fetchRemoteMessages(canonicalConvId, { limit: 20 }).catch(() => {});

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
              changed = true;
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
              changed = true;
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

        this.saveConversations(cleanConvs);
      }
    } catch (err) {
      console.warn('Friends sync non-blocking error:', err);
    }
  }

  static initialize(): void {
    if (typeof window !== 'undefined') {
      this.purgeMockData();
      const s = getStoredSession();
      const myId = s?.user?.id;
      if (myId) {
        try {
          // Remove contaminated self-conversation messages key if it was created
          localStorage.removeItem(`${this.getStorageKey()}_msgs_conv_${myId}`);
        } catch {}
      }

      this.getConversations();
      this.syncWithExistingFriends().catch(() => {});

      // Keep friends and online status synced every 8 seconds
      if (!(window as any).__watch_chat_store_interval) {
        (window as any).__watch_chat_store_interval = setInterval(() => {
          this.syncWithExistingFriends().catch(() => {});
        }, 8000);
      }
    }
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
      existing.id = canonicalId;
      if (targetDisplayName && targetDisplayName !== 'Friend') {
        existing.name = targetDisplayName;
        existing.title = targetDisplayName;
      }
      if (targetAvatar) {
        existing.avatarUrl = targetAvatar;
        existing.avatar = targetAvatar || undefined;
      }
      existing.updatedAt = new Date().toISOString();

      if (myId) {
        const myUser: ChatUser = {
          id: myId,
          displayName: s?.user?.displayName || 'You',
          name: s?.user?.displayName || 'You',
          avatarUrl: s?.user?.avatarUrl || null,
          avatar: s?.user?.avatarUrl || undefined,
          onlineStatus: 'ONLINE',
          isOnline: true
        };
        const updatedTarget = {
          ...targetUser,
          displayName: targetDisplayName,
          name: targetDisplayName,
          avatarUrl: targetAvatar,
          avatar: targetAvatar || undefined
        };
        existing.participants = [myUser, updatedTarget];
      }

      const filtered = convs.filter((c) => c.id !== existing!.id);
      filtered.unshift(existing);
      this.saveConversations(filtered);
      return existing;
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

  static toggleReaction(conversationId: string, messageId: string, emoji: string, currentUserId?: string): void {
    this.addReaction(conversationId, messageId, emoji);
  }

  static togglePin(conversationId: string, messageId: string): void {
    this.togglePinMessage(conversationId, messageId);
  }

  static declineRequest(conversationId: string): void {
    this.ignoreRequest(conversationId);
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

    const msgs = this.getMessages(conversationId);
    msgs.push(newMsg);
    this.saveMessages(conversationId, msgs);

    // Update conversation last message & time
    let convs = this.getConversations();
    let convIndex = convs.findIndex(
      (c) =>
        c.id === conversationId ||
        (c.type === 'direct' &&
          c.id &&
          conversationId &&
          (c.id.includes(conversationId) || conversationId.includes(c.id)))
    );

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
    convs.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
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
    if (s?.token) {
      fetch(`${API_BASE}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.token}`
        },
        body: JSON.stringify({
          ...newMsg,
          recipientId
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.message?.status) {
            this.updateMessageStatus(newMsg.id, conversationId, data.message.status);
          }
        })
        .catch(() => {});
    }

    return newMsg;
  }

  static addReaction(conversationId: string, messageId: string, emoji: string): void {
    const s = getStoredSession();
    const myId = s?.user?.id || 'current_user';

    const msgs = this.getMessages(conversationId);
    const msg = msgs.find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = [];

    const existingReaction = msg.reactions.find(r => r.emoji === emoji);
    if (existingReaction) {
      if (existingReaction.userIds.includes(myId)) {
        // Toggle off
        existingReaction.userIds = existingReaction.userIds.filter(id => id !== myId);
        existingReaction.count = existingReaction.userIds.length;
        if (existingReaction.count === 0) {
          msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        existingReaction.userIds.push(myId);
        existingReaction.count = existingReaction.userIds.length;
      }
    } else {
      msg.reactions.push({ emoji, count: 1, userIds: [myId] });
    }

    this.saveMessages(conversationId, msgs);
  }

  static togglePinMessage(conversationId: string, messageId: string): void {
    const msgs = this.getMessages(conversationId);
    const msg = msgs.find(m => m.id === messageId);
    if (!msg) return;
    msg.isPinned = !msg.isPinned;
    this.saveMessages(conversationId, msgs);
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

    // 1. Record permanently in local opened set so it can NEVER revert on this client
    this.recordOpenedViewOnceId(messageId);

    // 2. Update message in target conversation
    if (conversationId) {
      const msgs = this.getMessages(conversationId);
      const msg = msgs.find(m => m.id === messageId);
      if (msg) {
        if (!msg.metadata) msg.metadata = {};
        msg.metadata.viewOnceOpened = true;
        msg.metadata.viewOnceOpenedAt = new Date().toISOString();
        this.saveMessages(conversationId, msgs);

        const convs = this.getConversations();
        const conv = convs.find(c => c.id === conversationId);
        if (conv && conv.lastMessage?.id === messageId) {
          conv.lastMessage = msg;
          this.saveConversations(convs);
        }
      }
    } else {
      // Find across all conversations if conversationId was omitted
      const convs = this.getConversations();
      for (const c of convs) {
        const msgs = this.getMessages(c.id);
        const msg = msgs.find(m => m.id === messageId);
        if (msg) {
          if (!msg.metadata) msg.metadata = {};
          msg.metadata.viewOnceOpened = true;
          msg.metadata.viewOnceOpenedAt = new Date().toISOString();
          this.saveMessages(c.id, msgs);
          if (c.lastMessage?.id === messageId) {
            c.lastMessage = msg;
            this.saveConversations(convs);
          }
          break;
        }
      }
    }

    // 3. Notify all reactive components immediately
    notify();

    // 4. Notify server and partner via WebSocket & REST API
    if (notifyServer) {
      if (this.socketSender) {
        try {
          this.socketSender({
            type: 'chat:view_once_opened',
            conversationId,
            messageId
          });
        } catch {}
      }

      const s = getStoredSession();
      if (s?.token) {
        fetch(`${API_BASE}/api/chat/view-once-opened`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s.token}`
          },
          body: JSON.stringify({ messageId, conversationId })
        }).catch(() => {});
      }
    }
  }

  static markConversationRead(conversationId: string, senderId?: string): void {
    const convs = this.getConversations();
    const conv = convs.find(c => c.id === conversationId);
    const s = getStoredSession();
    const myId = s?.user?.id || 'current_user';

    const msgs = this.getMessages(conversationId);
    let changed = false;
    const readMessageIds: string[] = [];
    const targetSenderId = senderId || conv?.participants.find(p => p.id !== myId)?.id;

    for (const m of msgs) {
      if (m.senderId !== myId && m.status !== 'read') {
        m.status = 'read';
        readMessageIds.push(m.id);
        changed = true;
      }
    }

    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0;
      this.saveConversations(convs);
    }

    if (changed) {
      this.saveMessages(conversationId, msgs);
    }

    if (this.socketSender && targetSenderId) {
      try {
        this.socketSender({
          type: 'chat:read',
          conversationId,
          messageIds: readMessageIds,
          senderId: targetSenderId
        });
      } catch {}
    }

    if (s?.token) {
      fetch(`${API_BASE}/api/chat/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.token}`
        },
        body: JSON.stringify({
          conversationId,
          senderId: targetSenderId
        })
      }).catch(() => {});
    }

    notify();
  }

  static receiveIncomingMessage(incoming: ChatMessage): void {
    const s = getStoredSession();
    const myId = s?.user?.id;
    const conversationId = incoming.conversationId;
    if (!conversationId && !incoming.senderId) return;

    const convs = this.getConversations();
    const { otherUserId: convOtherId } = extractParticipantIdsFromConvId(conversationId, myId);
    const otherUserId = incoming.senderId === myId ? (incoming.recipientId || convOtherId) : incoming.senderId;
    const canonicalConvId = (myId && otherUserId) ? toCanonicalConvId(myId, otherUserId) : (conversationId || `conv_${incoming.senderId}`);

    // Ensure sender user is present in realFriendsMap so getUsers() picks them up
    if (incoming.senderId && incoming.senderId !== myId) {
      if (!realFriendsMap[incoming.senderId]) {
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
    }

    // Find existing conversation: by canonical ID, by received ID, or by matching participant ID
    let conv = convs.find(
      (c) =>
        c.id === canonicalConvId ||
        c.id === conversationId ||
        (c.type === 'direct' &&
          otherUserId &&
          (c.participants?.some((p) => p.id === otherUserId) ||
            c.id === `conv_${otherUserId}`))
    );

    const targetConvId = conv ? conv.id : canonicalConvId;
    const normalizedMsg: ChatMessage = { ...incoming, conversationId: targetConvId };

    const msgs = this.getMessages(targetConvId);
    const existingIndex = msgs.findIndex((m) => m.id === normalizedMsg.id);
    const isNewMessage = existingIndex < 0;

    const existingMsg = existingIndex >= 0 ? msgs[existingIndex] : null;
    const isOpened = Boolean(
      existingMsg?.metadata?.viewOnceOpened ||
      normalizedMsg.metadata?.viewOnceOpened ||
      this.isViewOnceOpened(normalizedMsg.id)
    );
    const mergedMetadata = {
      ...(existingMsg?.metadata || {}),
      ...(normalizedMsg.metadata || {}),
      ...(isOpened ? { viewOnceOpened: true } : {})
    };

    if (existingIndex >= 0 && existingMsg) {
      // Message already exists — update fields and preserve opened state
      msgs[existingIndex] = {
        ...existingMsg,
        ...normalizedMsg,
        metadata: mergedMetadata
      };
    } else {
      msgs.push({
        ...normalizedMsg,
        metadata: mergedMetadata
      });
    }
    this.saveMessages(targetConvId, msgs);
    if (canonicalConvId && targetConvId !== canonicalConvId) {
      this.saveMessages(canonicalConvId, msgs);
    }

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
      const myUser: ChatUser | null = myId ? {
        id: myId,
        displayName: s?.user?.displayName || 'You',
        name: s?.user?.displayName || 'You',
        avatarUrl: s?.user?.avatarUrl || null,
        avatar: s?.user?.avatarUrl || undefined,
        onlineStatus: 'ONLINE',
        isOnline: true
      } : null;

      conv = {
        id: targetConvId,
        type: 'direct',
        name: incoming.senderName || 'Friend',
        title: incoming.senderName || 'Friend',
        avatarUrl: incoming.senderAvatar || null,
        avatar: incoming.senderAvatar || undefined,
        participants: myUser ? [myUser, senderUser] : [senderUser],
        messages: msgs,
        lastMessage: normalizedMsg,
        unreadCount: 1,
        updatedAt: incoming.createdAt || new Date().toISOString()
      };
      convs.unshift(conv);
    } else {
      conv.lastMessage = normalizedMsg;
      conv.updatedAt = normalizedMsg.createdAt;
      conv.messages = msgs;

      // Only increment unread if user is NOT currently looking at this conversation
      if (isNewMessage && typeof window !== 'undefined') {
        const activeId = sessionStorage.getItem('watch_active_conv_id');
        const isViewing =
          activeId === targetConvId ||
          activeId === canonicalConvId ||
          activeId === incoming.conversationId ||
          (otherUserId && (activeId === `conv_${otherUserId}` || (activeId && activeId.includes(otherUserId))));
        if (!isViewing) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
      }
      convs.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }
    this.saveConversations(convs);

    // If currently viewing this conversation, mark as read immediately
    if (typeof window !== 'undefined') {
      const activeId = sessionStorage.getItem('watch_active_conv_id');
      const isViewing =
        activeId === targetConvId ||
        activeId === canonicalConvId ||
        activeId === incoming.conversationId ||
        (otherUserId && (activeId === `conv_${otherUserId}` || (activeId && activeId.includes(otherUserId))));
      if (isViewing) {
        this.markAsRead(targetConvId, incoming.senderId);
      }
    }
  }

  static updateMessageStatus(
    messageId?: string,
    conversationId?: string,
    status: 'sent' | 'delivered' | 'read' = 'delivered',
    messageIds?: string[]
  ): void {
    const convs = this.getConversations();
    for (const c of convs) {
      const msgs = this.getMessages(c.id);
      let changed = false;
      for (const m of msgs) {
        const matches =
          (messageId && m.id === messageId) ||
          (messageIds && messageIds.includes(m.id)) ||
          (!messageId && !messageIds && status === 'read' && (
            !conversationId ||
            c.id === conversationId ||
            (conversationId.startsWith('conv_') && c.participants?.some((p) => conversationId.includes(p.id)))
          ));
        if (matches && m.status !== status) {
          if (m.status === 'read' && status !== 'read') continue;
          m.status = status;
          changed = true;
        }
      }
      if (changed) {
        this.saveMessages(c.id, msgs);
      }
    }
    notify();
  }

  static async fetchRemoteMessages(
    conversationId: string,
    options?: { before?: string; after?: string; limit?: number }
  ): Promise<void> {
    const s = getStoredSession();
    if (!s?.token || !conversationId) return;

    // Resolve canonical conversation ID
    const myId = s?.user?.id;
    const { otherUserId } = extractParticipantIdsFromConvId(conversationId, myId);
    const canonicalId = (myId && otherUserId) ? toCanonicalConvId(myId, otherUserId) : conversationId;

    try {
      const params = new URLSearchParams({
        conversationId: canonicalId,
        limit: String(options?.limit || 100)
      });
      if (options?.before) params.set('before', options.before);
      if (options?.after) params.set('after', options.after);

      const res = await fetch(`${API_BASE}/api/chat/messages?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${s.token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          // Read local messages using aliases to ensure all historical messages are merged
          const localMsgs = this.getMessages(canonicalId);
          const msgMap = new Map<string, ChatMessage>();
          localMsgs.forEach((m) => msgMap.set(m.id, m));
          data.messages.forEach((m: ChatMessage) => {
            const existing = msgMap.get(m.id);
            const isOpened = Boolean(
              existing?.metadata?.viewOnceOpened ||
              m.metadata?.viewOnceOpened ||
              this.isViewOnceOpened(m.id)
            );
            const mergedMeta = {
              ...(existing?.metadata || {}),
              ...(m.metadata || {}),
              ...(isOpened ? { viewOnceOpened: true } : {})
            };
            msgMap.set(m.id, {
              ...(existing || {}),
              ...m,
              conversationId: canonicalId,
              metadata: mergedMeta
            });
          });
          const merged = Array.from(msgMap.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          // Save under canonical ID and alias
          this.saveMessages(canonicalId, merged);
          if (conversationId !== canonicalId) {
            this.saveMessages(conversationId, merged);
          }

          const convs = this.getConversations();
          const conv = convs.find(
            (c) =>
              c.id === canonicalId ||
              c.id === conversationId ||
              (c.type === 'direct' && c.participants?.some((p) => canonicalId.includes(p.id)))
          );
          if (conv) {
            conv.id = canonicalId;
            if (merged.length > 0) {
              conv.lastMessage = merged[merged.length - 1];
              conv.updatedAt = merged[merged.length - 1].createdAt;
            }
            this.saveConversations(convs);
          } else {
            notify();
          }
        }
      }
    } catch {}
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
