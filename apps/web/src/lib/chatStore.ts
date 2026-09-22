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

// Initial Mock Seed Data reflecting user's social circle on Watch (fallback for guests)
const DEFAULT_PARTICIPANTS: Record<string, ChatUser> = {
  rahul: {
    id: 'user_rahul',
    displayName: 'Rahul Sharma',
    username: '@rahul_s',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    onlineStatus: 'ONLINE',
    partnerCode: 'RAHUL99',
    streakDays: 14,
    moviesWatched: 8,
    gamesPlayed: 14,
    plansCount: 5,
    friendsSince: 'September 2026',
    isFriend: true
  },
  dhruv: {
    id: 'user_dhruv',
    displayName: 'Dhruv Verma',
    username: '@dhruvv',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    onlineStatus: 'ONLINE',
    partnerCode: 'DHRUV42',
    streakDays: 9,
    moviesWatched: 5,
    gamesPlayed: 18,
    plansCount: 3,
    friendsSince: 'August 2026',
    isFriend: true
  },
  mansi: {
    id: 'user_mansi',
    displayName: 'Mansi Gupta',
    username: '@mansi_g',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    onlineStatus: 'AWAY',
    lastSeen: '12 min ago',
    partnerCode: 'MANSI07',
    streakDays: 21,
    moviesWatched: 12,
    gamesPlayed: 7,
    plansCount: 6,
    friendsSince: 'July 2026',
    isFriend: true
  },
  kunal: {
    id: 'user_kunal',
    displayName: 'Kunal Singhania',
    username: '@kunal_s',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    onlineStatus: 'OFFLINE',
    lastSeen: '2 hours ago',
    partnerCode: 'KUNAL18',
    streakDays: 0,
    moviesWatched: 0,
    gamesPlayed: 2,
    plansCount: 0,
    friendsSince: 'Pending',
    isFriend: false
  }
};

const INITIAL_CONVERSATIONS: ChatConversation[] = [
  {
    id: 'conv_rahul',
    type: 'direct',
    name: 'Rahul Sharma',
    avatarUrl: DEFAULT_PARTICIPANTS.rahul.avatarUrl,
    participants: [DEFAULT_PARTICIPANTS.rahul],
    unreadCount: 1,
    updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isPinned: true
  },
  {
    id: 'conv_group_friday',
    type: 'group',
    name: '🍿 Friday Night Crew',
    avatarUrl: null,
    participants: [
      DEFAULT_PARTICIPANTS.rahul,
      DEFAULT_PARTICIPANTS.dhruv,
      DEFAULT_PARTICIPANTS.mansi
    ],
    unreadCount: 2,
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isPinned: true
  },
  {
    id: 'conv_dhruv',
    type: 'direct',
    name: 'Dhruv Verma',
    avatarUrl: DEFAULT_PARTICIPANTS.dhruv.avatarUrl,
    participants: [DEFAULT_PARTICIPANTS.dhruv],
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'conv_mansi',
    type: 'direct',
    name: 'Mansi Gupta',
    avatarUrl: DEFAULT_PARTICIPANTS.mansi.avatarUrl,
    participants: [DEFAULT_PARTICIPANTS.mansi],
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'conv_kunal',
    type: 'direct',
    name: 'Kunal Singhania',
    avatarUrl: DEFAULT_PARTICIPANTS.kunal.avatarUrl,
    participants: [DEFAULT_PARTICIPANTS.kunal],
    unreadCount: 1,
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    isRequest: true
  }
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  conv_rahul: [
    {
      id: 'msg_r_1',
      conversationId: 'conv_rahul',
      senderId: 'user_rahul',
      senderName: 'Rahul Sharma',
      senderAvatar: DEFAULT_PARTICIPANTS.rahul.avatarUrl,
      type: 'text',
      content: 'Bro are we watching Interstellar tonight? 🚀',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'msg_r_2',
      conversationId: 'conv_rahul',
      senderId: 'current_user',
      senderName: 'You',
      type: 'text',
      content: 'Yep! 100% down for it 😂',
      createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      status: 'read',
      reactions: [{ emoji: '🔥', count: 1, userIds: ['user_rahul'] }]
    },
    {
      id: 'msg_r_3',
      conversationId: 'conv_rahul',
      senderId: 'user_rahul',
      senderName: 'Rahul Sharma',
      senderAvatar: DEFAULT_PARTICIPANTS.rahul.avatarUrl,
      type: 'movie',
      content: 'Shared Interstellar (4K IMAX Experience)',
      metadata: {
        movie: {
          title: 'Interstellar',
          duration: '2h 49m',
          year: '2014',
          genres: ['Sci-Fi', 'Adventure', 'Drama'],
          posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80',
          streamUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E'
        }
      },
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      status: 'read',
      reactions: [{ emoji: '❤️', count: 1, userIds: ['current_user'] }]
    },
    {
      id: 'msg_r_4',
      conversationId: 'conv_rahul',
      senderId: 'current_user',
      senderName: 'You',
      type: 'plan',
      content: 'Created plan: Friday Movie Night',
      metadata: {
        plan: {
          id: 'plan_friday_night',
          title: '🍿 Friday Movie Night',
          date: 'Tonight',
          time: '9:00 PM',
          movieTitle: 'Interstellar (4K IMAX)',
          activity: 'Watch Together + Ludo after'
        }
      },
      createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'msg_r_5',
      conversationId: 'conv_rahul',
      senderId: 'user_rahul',
      senderName: 'Rahul Sharma',
      senderAvatar: DEFAULT_PARTICIPANTS.rahul.avatarUrl,
      type: 'voice',
      content: 'Voice note (0:12)',
      metadata: {
        voice: {
          audioUrl: '/audio/voice_sample.mp3',
          durationSeconds: 12,
          waveform: [15, 30, 65, 80, 45, 90, 75, 50, 85, 95, 60, 40, 70, 55, 30, 20]
        }
      },
      createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'msg_r_6',
      conversationId: 'conv_rahul',
      senderId: 'user_rahul',
      senderName: 'Rahul Sharma',
      senderAvatar: DEFAULT_PARTICIPANTS.rahul.avatarUrl,
      type: 'text',
      content: '9 PM sharp then! See you inside Cinema room! 🍿',
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      status: 'delivered'
    }
  ],
  conv_group_friday: [
    {
      id: 'msg_g_1',
      conversationId: 'conv_group_friday',
      senderId: 'user_mansi',
      senderName: 'Mansi Gupta',
      senderAvatar: DEFAULT_PARTICIPANTS.mansi.avatarUrl,
      type: 'text',
      content: 'Hey crew! Who is up for games after movie tonight?',
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'msg_g_2',
      conversationId: 'conv_group_friday',
      senderId: 'user_dhruv',
      senderName: 'Dhruv Verma',
      senderAvatar: DEFAULT_PARTICIPANTS.dhruv.avatarUrl,
      type: 'game',
      content: 'Invited crew to Ludo Night',
      metadata: {
        game: {
          gameType: 'ludo',
          roomCode: 'LUDO-CREW',
          title: 'Ludo Night Party',
          mode: 'Classic 4-Player',
          playersCount: '2–4 Players'
        }
      },
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      status: 'read',
      reactions: [{ emoji: '🔥', count: 3, userIds: ['user_rahul', 'user_mansi', 'current_user'] }]
    },
    {
      id: 'msg_g_3',
      conversationId: 'conv_group_friday',
      senderId: 'user_rahul',
      senderName: 'Rahul Sharma',
      senderAvatar: DEFAULT_PARTICIPANTS.rahul.avatarUrl,
      type: 'text',
      content: 'I’m definitely winning this time 😂',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      status: 'delivered'
    }
  ],
  conv_dhruv: [
    {
      id: 'msg_d_1',
      conversationId: 'conv_dhruv',
      senderId: 'user_dhruv',
      senderName: 'Dhruv Verma',
      senderAvatar: DEFAULT_PARTICIPANTS.dhruv.avatarUrl,
      type: 'text',
      content: 'Bro quick Chess match before dinner? ♟️',
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'msg_d_2',
      conversationId: 'conv_dhruv',
      senderId: 'user_dhruv',
      senderName: 'Dhruv Verma',
      senderAvatar: DEFAULT_PARTICIPANTS.dhruv.avatarUrl,
      type: 'game',
      content: 'Chess Match Invitation',
      metadata: {
        game: {
          gameType: 'chess',
          roomCode: 'CHESS-789',
          title: 'Blitz Chess Match',
          mode: '10 min Rapid',
          playersCount: '2 Players'
        }
      },
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      status: 'read'
    }
  ],
  conv_mansi: [
    {
      id: 'msg_m_1',
      conversationId: 'conv_mansi',
      senderId: 'user_mansi',
      senderName: 'Mansi Gupta',
      senderAvatar: DEFAULT_PARTICIPANTS.mansi.avatarUrl,
      type: 'text',
      content: 'Loved the movie recommendation! See you at 9 ❤️',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      status: 'read',
      reactions: [{ emoji: '❤️', count: 1, userIds: ['current_user'] }]
    }
  ],
  conv_kunal: [
    {
      id: 'msg_k_1',
      conversationId: 'conv_kunal',
      senderId: 'user_kunal',
      senderName: 'Kunal Singhania',
      senderAvatar: DEFAULT_PARTICIPANTS.kunal.avatarUrl,
      type: 'text',
      content: 'Hey! Kunal from college here. Would love to watch movies together on Watch! 🍿',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      status: 'delivered'
    }
  ]
};

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

  private static getStorageKey(userId?: string): string {
    const s = getStoredSession();
    const uid = userId || s?.user?.id || 'guest';
    return `${STORAGE_PREFIX}${uid}`;
  }

  static getConversations(): ChatConversation[] {
    let convs: ChatConversation[] = INITIAL_CONVERSATIONS;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.getStorageKey() + '_conversations');
        if (stored) {
          convs = JSON.parse(stored);
        } else {
          this.saveConversations(INITIAL_CONVERSATIONS);
        }
      } catch {}
    }
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

  static getMessages(conversationId: string): ChatMessage[] {
    if (typeof window === 'undefined') return INITIAL_MESSAGES[conversationId] || [];
    try {
      const stored = localStorage.getItem(`${this.getStorageKey()}_msgs_${conversationId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    const init = INITIAL_MESSAGES[conversationId] || [];
    this.saveMessages(conversationId, init);
    return init;
  }

  static saveMessages(conversationId: string, messages: ChatMessage[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${this.getStorageKey()}_msgs_${conversationId}`, JSON.stringify(messages));
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
            let existing = cleanConvs.find(
              (c) => c.type === 'direct' && c.participants.some((p) => p.id === friend.id)
            );
            if (!existing) {
              const newConv: ChatConversation = {
                id: `conv_${friend.id}`,
                type: 'direct',
                name: friend.displayName,
                title: friend.displayName,
                avatarUrl: friend.avatarUrl,
                avatar: friend.avatarUrl || undefined,
                participants: [chatUser],
                messages: [],
                unreadCount: 0,
                updatedAt: item.createdAt || new Date().toISOString()
              };
              cleanConvs.push(newConv);
              changed = true;
            } else {
              existing.name = friend.displayName;
              existing.title = friend.displayName;
              existing.avatarUrl = friend.avatarUrl;
              existing.avatar = friend.avatarUrl || undefined;
              existing.participants = [chatUser];
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

        if (changed) {
          this.saveConversations(cleanConvs);
        } else {
          notify();
        }
      }
    } catch (err) {
      console.warn('Friends sync non-blocking error:', err);
    }
  }

  static initialize(): void {
    if (typeof window !== 'undefined') {
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
    const s = getStoredSession();
    // For authenticated users, prioritize real friends
    if (s?.token && Object.keys(realFriendsMap).length > 0) {
      const userMap: Record<string, ChatUser> = { ...realFriendsMap };
      const convs = this.getConversations();
      for (const c of convs) {
        for (const p of c.participants || []) {
          if (p?.id && !userMap[p.id]) {
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

    // Fallback for demo or guest mode
    const userMap: Record<string, ChatUser> = {};
    if (!s?.token) {
      Object.values(DEFAULT_PARTICIPANTS).forEach((p) => {
        userMap[p.id] = {
          ...p,
          name: p.displayName,
          avatar: p.avatarUrl || undefined,
          isOnline: p.onlineStatus === 'ONLINE'
        };
      });
    }

    const convs = this.getConversations();
    for (const c of convs) {
      for (const p of c.participants || []) {
        if (p?.id && !userMap[p.id]) {
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
    const s = getStoredSession();
    if (s?.token) {
      return realRequestsList;
    }
    const convs = this.getConversations();
    return convs
      .filter((c) => c.isRequest)
      .map((c) => {
        const other = c.participants[0] || { displayName: c.name, avatarUrl: c.avatarUrl };
        return {
          id: c.id,
          senderId: other.id,
          senderName: other.displayName || c.name,
          senderAvatar: other.avatarUrl || undefined,
          previewText: c.lastMessage?.content || 'Sent you a message request',
          createdAt: c.updatedAt
        };
      });
  }

  static getOrCreateDirectConversation(targetUser: ChatUser): ChatConversation {
    const convs = this.getConversations();
    let existing = convs.find(c => c.type === 'direct' && c.participants.some(p => p.id === targetUser.id));
    if (existing) return existing;

    const newConv: ChatConversation = {
      id: `conv_${targetUser.id}`,
      type: 'direct',
      name: targetUser.displayName || targetUser.name || 'Friend',
      title: targetUser.displayName || targetUser.name || 'Friend',
      avatarUrl: targetUser.avatarUrl || targetUser.avatar,
      avatar: targetUser.avatarUrl || targetUser.avatar || undefined,
      participants: [targetUser],
      messages: [],
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
    const convs = this.getConversations();
    const convIndex = convs.findIndex(c => c.id === conversationId);
    if (convIndex >= 0) {
      convs[convIndex].lastMessage = newMsg;
      convs[convIndex].updatedAt = newMsg.createdAt;
      // Re-sort with newest active conversation on top (unless pinned)
      convs.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      this.saveConversations(convs);
    }

    // Determine target recipient for live delivery
    let recipientId: string | undefined;
    const currentConv = convs.find(c => c.id === conversationId);
    const otherParticipant = currentConv?.participants.find(p => p.id !== senderId);
    if (otherParticipant) {
      recipientId = otherParticipant.id;
    } else if (conversationId.startsWith('conv_')) {
      recipientId = conversationId.replace('conv_', '');
    }

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

    // Auto-echo response after 1.5s if talking to Rahul or Dhruv for realistic social feel
    if (conversationId === 'conv_rahul') {
      setTimeout(() => {
        this.receiveSimulatedReply(
          'conv_rahul',
          DEFAULT_PARTICIPANTS.rahul,
          type === 'plan' ? 'Got the plan invitation! Count me in 🔥' :
          type === 'game' || type === 'game_invite' ? 'Accepting the challenge right now! 🎮' :
          type === 'movie' || type === 'movie_share' ? 'Looks awesome! Loading it up now ✨' :
          'Awesome! Watch makes it so smooth 👌'
        );
      }, 1400);
    }

    return newMsg;
  }

  private static receiveSimulatedReply(conversationId: string, fromUser: ChatUser, text: string) {
    const replyMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      senderId: fromUser.id,
      senderName: fromUser.displayName,
      senderAvatar: fromUser.avatarUrl,
      type: 'text',
      content: text,
      createdAt: new Date().toISOString(),
      status: 'delivered'
    };

    const msgs = this.getMessages(conversationId);
    msgs.push(replyMsg);
    this.saveMessages(conversationId, msgs);

    const convs = this.getConversations();
    const idx = convs.findIndex(c => c.id === conversationId);
    if (idx >= 0) {
      convs[idx].lastMessage = replyMsg;
      convs[idx].updatedAt = replyMsg.createdAt;
      this.saveConversations(convs);
    }
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

  static markViewOnceOpened(conversationId: string, messageId: string): void {
    const msgs = this.getMessages(conversationId);
    const msg = msgs.find(m => m.id === messageId);
    if (!msg) return;
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
    const conversationId = incoming.conversationId;
    if (!conversationId) return;

    const msgs = this.getMessages(conversationId);
    const existingIndex = msgs.findIndex((m) => m.id === incoming.id);
    if (existingIndex >= 0) {
      msgs[existingIndex] = { ...msgs[existingIndex], ...incoming };
    } else {
      msgs.push(incoming);
    }
    this.saveMessages(conversationId, msgs);

    const convs = this.getConversations();
    let conv = convs.find((c) => c.id === conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        type: 'direct',
        name: incoming.senderName || 'Friend',
        title: incoming.senderName || 'Friend',
        avatarUrl: incoming.senderAvatar || null,
        avatar: incoming.senderAvatar || undefined,
        participants: [
          {
            id: incoming.senderId,
            displayName: incoming.senderName || 'Friend',
            name: incoming.senderName || 'Friend',
            avatarUrl: incoming.senderAvatar || null,
            avatar: incoming.senderAvatar || undefined,
            onlineStatus: 'ONLINE',
            isOnline: true
          }
        ],
        messages: [incoming],
        lastMessage: incoming,
        unreadCount: 1,
        updatedAt: incoming.createdAt
      };
      convs.unshift(conv);
    } else {
      conv.lastMessage = incoming;
      conv.updatedAt = incoming.createdAt;
      if (typeof window !== 'undefined') {
        const activeId = sessionStorage.getItem('watch_active_conv_id');
        if (activeId !== conversationId) {
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
      if (activeId === conversationId) {
        this.markAsRead(conversationId, incoming.senderId);
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
    const targetConvs = conversationId ? convs.filter((c) => c.id === conversationId) : convs;

    for (const c of targetConvs) {
      const msgs = this.getMessages(c.id);
      let changed = false;
      for (const m of msgs) {
        const matches =
          (messageId && m.id === messageId) ||
          (messageIds && messageIds.includes(m.id)) ||
          (!messageId && !messageIds && status === 'read');
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

  static async fetchRemoteMessages(conversationId: string): Promise<void> {
    const s = getStoredSession();
    if (!s?.token || !conversationId) return;

    try {
      const res = await fetch(`${API_BASE}/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
        headers: {
          Authorization: `Bearer ${s.token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          const localMsgs = this.getMessages(conversationId);
          const msgMap = new Map<string, ChatMessage>();
          localMsgs.forEach((m) => msgMap.set(m.id, m));
          data.messages.forEach((m: ChatMessage) => {
            const existing = msgMap.get(m.id);
            if (existing) {
              msgMap.set(m.id, { ...existing, ...m });
            } else {
              msgMap.set(m.id, m);
            }
          });
          const merged = Array.from(msgMap.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          this.saveMessages(conversationId, merged);

          if (merged.length > 0) {
            const convs = this.getConversations();
            const conv = convs.find((c) => c.id === conversationId);
            if (conv) {
              conv.lastMessage = merged[merged.length - 1];
              conv.updatedAt = merged[merged.length - 1].createdAt;
              this.saveConversations(convs);
            }
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
