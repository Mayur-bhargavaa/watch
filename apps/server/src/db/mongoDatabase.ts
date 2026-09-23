import { MongoClient, Db, Collection } from 'mongodb';
import { nanoid } from 'nanoid';
import {
  User,
  Room,
  RoomMember,
  MediaItem,
  RoomPlaybackState,
  Reaction,
  ChatMessage,
  Role,
  RoomPrivacy,
  GameRoom,
  GameRoomPlayer,
  PartnerConnection,
  GameRoomStatus,
  LudoColor
} from '@synccinema/common';
import { extractParticipantIdsFromConvId, toCanonicalConvId } from './database.js';

export interface FriendStreak {
  id: string;
  userId1: string;
  userId2: string;
  currentStreak: number;
  longestStreak: number;
  lastWatchedDate: string | null;
  totalMinutesWatched: number;
  createdAt: string;
  updatedAt: string;
}

export interface FriendWithStreak {
  friendshipId: string;
  friendUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    partnerCode: string;
    isOnline: boolean;
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastWatchedDate: string | null;
    completedToday: boolean;
    atRisk: boolean;
    totalMinutesWatched: number;
  };
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

export class MongoDatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private readonly defaultUri = 'mongodb+srv://DBmayur:Mayur%402608@cluster0.ytcpzbb.mongodb.net/';
  private readonly dbName = 'stitchbyte_watch_party';

  constructor(uri?: string) {
    const mongoUri = uri || process.env.MONGODB_URI || this.defaultUri;
    this.client = new MongoClient(mongoUri);
    this.db = this.client.db(this.dbName);
  }

  async connect(): Promise<void> {
    if (this.client) {
      await this.client.connect();
      console.log('🍃 MongoDatabaseService connected to', this.dbName);
    }
  }

  get usersCol(): Collection<any> {
    return this.db!.collection('users');
  }

  get directMessagesCol(): Collection<any> {
    return this.db!.collection('direct_messages');
  }

  get friendshipsCol(): Collection<any> {
    return this.db!.collection('friendships');
  }

  get streaksCol(): Collection<any> {
    return this.db!.collection('friend_streaks');
  }

  get plansCol(): Collection<any> {
    return this.db!.collection('plans');
  }

  get usernameHistoryCol(): Collection<any> {
    return this.db!.collection('username_change_history');
  }

  get partnerConnectionsCol(): Collection<any> {
    return this.db!.collection('partner_connections');
  }

  // ==========================================
  // USERS
  // ==========================================

  private mapUserDoc(doc: any): User {
    return {
      id: doc._id || doc.id,
      email: doc.email || undefined,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl || undefined,
      isAnonymous: Boolean(doc.isAnonymous),
      partnerCode: doc.partnerCode,
      dateOfBirth: doc.dateOfBirth || undefined,
      anniversaryDate: doc.anniversaryDate || undefined,
      isMarried: Boolean(doc.isMarried),
      relationshipStatus: doc.relationshipStatus || undefined,
      gender: doc.gender || undefined,
      pronouns: doc.pronouns || undefined,
      location: doc.location || undefined,
      bio: doc.bio || undefined,
      favoriteGenres: Array.isArray(doc.favoriteGenres) ? doc.favoriteGenres : undefined,
      viewingVibe: doc.viewingVibe || undefined,
      age: typeof doc.age === 'number' ? doc.age : undefined,
      createdAt: doc.createdAt
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.usersCol.findOne({ _id: id });
    if (!doc) return null;
    return this.mapUserDoc(doc);
  }

  async getUserByEmail(email: string): Promise<{ user: User; passwordHash?: string } | null> {
    const normalized = email.trim().toLowerCase();
    const doc = await this.usersCol.findOne({ email: normalized });
    if (!doc) return null;
    return {
      user: this.mapUserDoc(doc),
      passwordHash: doc.passwordHash || undefined
    };
  }

  async getUserByPartnerCode(code: string): Promise<User | null> {
    const doc = await this.usersCol.findOne({ partnerCode: code.toUpperCase() });
    if (!doc) return null;
    return this.mapUserDoc(doc);
  }

  async createUser(
    user: {
      id: string;
      email?: string | null;
      displayName: string;
      avatarUrl?: string | null;
      isAnonymous?: boolean;
      partnerCode?: string;
      dateOfBirth?: string | null;
      anniversaryDate?: string | null;
      isMarried?: boolean | null;
      age?: number | null;
      createdAt: string;
    },
    passwordHash?: string
  ): Promise<User> {
    const partnerCode = user.partnerCode || (await this.generateUniquePartnerCode(user.displayName));
    const doc: any = {
      _id: user.id,
      id: user.id,
      email: user.email ? user.email.trim().toLowerCase() : undefined,
      passwordHash: passwordHash || null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
      isAnonymous: Boolean(user.isAnonymous),
      partnerCode,
      dateOfBirth: user.dateOfBirth || null,
      anniversaryDate: user.anniversaryDate || null,
      isMarried: Boolean(user.isMarried),
      age: user.age || null,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.usersCol.updateOne({ _id: user.id }, { $set: doc }, { upsert: true });
    return this.mapUserDoc(doc);
  }

  async setPassword(email: string, passwordHash: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const res = await this.usersCol.updateOne(
      { email: normalized },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );
    return res.matchedCount > 0;
  }

  async updateUser(
    id: string,
    updates: {
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
    }
  ): Promise<User | null> {
    const setObj: any = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        setObj[k] = v;
      }
    }
    await this.usersCol.updateOne({ _id: id }, { $set: setObj });
    return this.getUserById(id);
  }

  async generateUniquePartnerCode(displayName?: string): Promise<string> {
    const rawPrefix = (displayName || 'USER')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 5)
      .toUpperCase();
    const prefix = rawPrefix.length >= 3 ? rawPrefix : 'PLAYER';

    for (let attempt = 0; attempt < 20; attempt++) {
      const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      const code = `${prefix}${suffix}`;
      const existing = await this.usersCol.findOne({ partnerCode: code });
      if (!existing) {
        return code;
      }
    }
    return `USR${nanoid(5).toUpperCase()}`;
  }

  async ensureUserPartnerCode(
    userId: string,
    displayName?: string,
    avatarUrl?: string | null,
    isAnonymous?: boolean,
    email?: string | null
  ): Promise<string> {
    const userDoc = await this.usersCol.findOne({ _id: userId });
    if (userDoc?.partnerCode) {
      return userDoc.partnerCode;
    }
    const newCode = await this.generateUniquePartnerCode(displayName);
    await this.usersCol.updateOne(
      { _id: userId },
      {
        $set: {
          partnerCode: newCode,
          displayName: displayName || userDoc?.displayName || 'User',
          avatarUrl: avatarUrl ?? userDoc?.avatarUrl,
          isAnonymous: Boolean(isAnonymous ?? userDoc?.isAnonymous),
          email: email ? email.trim().toLowerCase() : (userDoc?.email || null),
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
    return newCode;
  }

  async getPartnerCodeStatus(userId: string) {
    const userDoc = await this.usersCol.findOne({ _id: userId });
    const currentCode = userDoc?.partnerCode || '';
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentChanges = await this.usernameHistoryCol
      .find({ userId, changedAt: { $gte: cutoff } })
      .sort({ changedAt: -1 })
      .toArray();

    const maxChanges = 2;
    const changesUsed = recentChanges.length;
    const changesRemaining = Math.max(0, maxChanges - changesUsed);
    const canChange = changesRemaining > 0;
    let nextAvailableAt: string | null = null;
    if (!canChange && recentChanges.length > 0) {
      const oldest = new Date(recentChanges[recentChanges.length - 1].changedAt);
      const nextDate = new Date(oldest.getTime() + 30 * 24 * 60 * 60 * 1000);
      nextAvailableAt = nextDate.toISOString();
    }

    return {
      currentCode,
      changesUsed,
      changesRemaining,
      maxChanges,
      periodDays: 30,
      canChange,
      nextAvailableAt
    };
  }

  async changePartnerCode(userId: string, requestedCode: string) {
    const clean = requestedCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 3 || clean.length > 12) {
      return { success: false, error: 'Code must be between 3 and 12 alphanumeric characters' };
    }
    const status = await this.getPartnerCodeStatus(userId);
    if (!status.canChange) {
      return { success: false, error: `You have reached the maximum code changes. Next change available at ${status.nextAvailableAt}` };
    }
    const existing = await this.usersCol.findOne({ partnerCode: clean, _id: { $ne: userId } });
    if (existing) {
      return { success: false, error: 'This code is already taken. Please choose another.' };
    }
    const userDoc = await this.usersCol.findOne({ _id: userId });
    const oldCode = userDoc?.partnerCode || '';
    await this.usersCol.updateOne({ _id: userId }, { $set: { partnerCode: clean, updatedAt: new Date().toISOString() } });
    await this.usernameHistoryCol.insertOne({
      _id: `hist_${nanoid(10)}`,
      userId,
      oldCode,
      newCode: clean,
      changedAt: new Date().toISOString()
    });
    return {
      success: true,
      partnerCode: clean,
      changesRemaining: status.changesRemaining - 1,
      changesUsed: status.changesUsed + 1
    };
  }

  // ==========================================
  // DIRECT CHAT MESSAGES
  // ==========================================

  async saveDirectChatMessage(msg: {
    id: string;
    conversationId: string;
    senderId: string;
    senderName?: string;
    senderAvatar?: string;
    recipientId?: string;
    type?: string;
    content: string;
    mediaUrl?: string;
    metadata?: any;
    replyTo?: any;
    status?: string;
    createdAt?: string;
  }): Promise<void> {
    let canonicalId = msg.conversationId;
    if (msg.senderId && msg.recipientId && msg.recipientId !== '') {
      canonicalId = toCanonicalConvId(msg.senderId, msg.recipientId);
    }
    const doc: any = {
      _id: msg.id,
      id: msg.id,
      conversationId: canonicalId,
      senderId: msg.senderId,
      senderName: msg.senderName || '',
      senderAvatar: msg.senderAvatar || null,
      recipientId: msg.recipientId || null,
      type: msg.type || 'text',
      content: msg.content,
      mediaUrl: msg.mediaUrl || null,
      metadata: msg.metadata || null,
      replyTo: msg.replyTo || null,
      status: msg.status || 'sent',
      isDeleted: false,
      createdAt: msg.createdAt || new Date().toISOString()
    };
    await this.directMessagesCol.updateOne({ _id: msg.id }, { $set: doc }, { upsert: true });
  }

  async getDirectChatMessages(
    conversationId: string,
    currentUserId?: string,
    limitOrOptions: number | { limit?: number; before?: string; after?: string } = 100
  ): Promise<any[]> {
    const opts = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
    const limit = opts.limit || 100;

    const { userIds, otherUserId } = extractParticipantIdsFromConvId(conversationId, currentUserId);
    const otherId = otherUserId || (userIds.length === 2 ? (userIds[0] === currentUserId ? userIds[1] : userIds[0]) : (userIds[0] !== currentUserId ? userIds[0] : null));

    let query: any = { isDeleted: { $ne: true } };

    if (currentUserId && otherId && currentUserId !== otherId) {
      const canonicalId = toCanonicalConvId(currentUserId, otherId);
      query.$or = [
        { conversationId },
        { conversationId: canonicalId },
        { conversationId: `conv_${otherId}` },
        { conversationId: `conv_${currentUserId}` },
        { senderId: currentUserId, recipientId: otherId },
        { senderId: otherId, recipientId: currentUserId }
      ];
    } else {
      query.conversationId = conversationId;
    }

    if (opts.before) {
      query.createdAt = { ...query.createdAt, $lt: opts.before };
    }
    if (opts.after) {
      query.createdAt = { ...query.createdAt, $gt: opts.after };
    }

    const docs = await this.directMessagesCol
      .find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();

    return docs.map((d: any) => ({
      id: d._id || d.id,
      conversationId: d.conversationId,
      senderId: d.senderId,
      senderName: d.senderName,
      senderAvatar: d.senderAvatar,
      recipientId: d.recipientId,
      type: d.type || 'text',
      content: d.content,
      mediaUrl: d.mediaUrl,
      metadata: d.metadata,
      replyTo: d.replyTo,
      status: d.status || 'sent',
      createdAt: d.createdAt
    }));
  }

  async markDirectMessagesAsDelivered(recipientId: string): Promise<any[]> {
    const pending = await this.directMessagesCol
      .find({ recipientId, status: 'sent', isDeleted: { $ne: true } })
      .toArray();

    if (pending.length > 0) {
      await this.directMessagesCol.updateMany(
        { recipientId, status: 'sent', isDeleted: { $ne: true } },
        { $set: { status: 'delivered' } }
      );
    }

    return pending.map((d: any) => ({
      id: d._id || d.id,
      conversationId: d.conversationId,
      senderId: d.senderId,
      senderName: d.senderName,
      senderAvatar: d.senderAvatar,
      recipientId: d.recipientId,
      type: d.type,
      content: d.content,
      mediaUrl: d.mediaUrl,
      metadata: d.metadata,
      replyTo: d.replyTo,
      status: 'delivered',
      createdAt: d.createdAt
    }));
  }

  async markDirectMessagesAsRead(conversationId: string, readerUserId: string): Promise<{ id: string; senderId: string }[]> {
    const { userIds, otherUserId } = extractParticipantIdsFromConvId(conversationId, readerUserId);
    const otherId = otherUserId || (userIds.length === 2 ? (userIds[0] === readerUserId ? userIds[1] : userIds[0]) : (userIds[0] !== readerUserId ? userIds[0] : null));

    let query: any = {
      isDeleted: { $ne: true },
      status: { $ne: 'read' },
      senderId: { $ne: readerUserId }
    };

    if (otherId && otherId !== readerUserId) {
      const canonicalId = toCanonicalConvId(readerUserId, otherId);
      query.$or = [
        { conversationId },
        { conversationId: canonicalId },
        { conversationId: `conv_${otherId}` },
        { conversationId: `conv_${readerUserId}` },
        { recipientId: readerUserId },
        { senderId: otherId, recipientId: readerUserId }
      ];
    } else {
      query.conversationId = conversationId;
    }

    const unread = await this.directMessagesCol.find(query).toArray();
    if (unread.length > 0) {
      await this.directMessagesCol.updateMany(query, { $set: { status: 'read' } });
    }

    return unread.map((u: any) => ({ id: u._id || u.id, senderId: u.senderId }));
  }

  async markDirectMessageViewOnceOpened(messageId: string): Promise<{ conversationId: string; senderId: string; recipientId: string } | null> {
    const doc = await this.directMessagesCol.findOne({ _id: messageId });
    if (!doc) return null;

    const meta = doc.metadata || {};
    meta.viewOnceOpened = true;
    meta.viewOnceOpenedAt = new Date().toISOString();

    await this.directMessagesCol.updateOne({ _id: messageId }, { $set: { metadata: meta } });

    return {
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      recipientId: doc.recipientId
    };
  }

  // ==========================================
  // FRIENDSHIPS & STREAKS
  // ==========================================

  async getFriendsWithStreaks(userId: string, isOnlineCheck: (id: string) => boolean = () => false): Promise<FriendWithStreak[]> {
    const friendships = await this.friendshipsCol
      .find({ userIds: userId, status: 'ACCEPTED' })
      .toArray();

    const result: FriendWithStreak[] = [];
    const seenFriendIds = new Set<string>();

    for (const f of friendships) {
      const otherId = f.userId1 === userId ? f.userId2 : f.userId1;
      if (!otherId || otherId === userId || seenFriendIds.has(otherId)) continue;
      seenFriendIds.add(otherId);

      const friendUser = await this.usersCol.findOne({ _id: otherId });
      if (!friendUser) continue;

      const pair = [userId, otherId].sort();
      const streakDoc = await this.streaksCol.findOne({ userIds: { $all: pair } });

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const lastWatched = streakDoc?.lastWatchedDate || null;
      const completedToday = lastWatched === today;
      const atRisk = !completedToday && lastWatched !== yesterday && (streakDoc?.currentStreak || 0) > 0;

      result.push({
        friendshipId: f._id || f.id,
        friendUser: {
          id: friendUser._id || friendUser.id,
          displayName: friendUser.displayName,
          avatarUrl: friendUser.avatarUrl,
          partnerCode: friendUser.partnerCode,
          isOnline: isOnlineCheck(friendUser._id || friendUser.id)
        },
        streak: {
          currentStreak: streakDoc?.currentStreak || 0,
          longestStreak: streakDoc?.longestStreak || 0,
          lastWatchedDate: lastWatched,
          completedToday,
          atRisk,
          totalMinutesWatched: streakDoc?.totalMinutesWatched || 0
        },
        createdAt: f.createdAt
      });
    }

    return result;
  }

  async getFriendRequests(userId: string): Promise<FriendRequestsData> {
    const incomingRows = await this.friendshipsCol
      .find({ userId2: userId, status: 'PENDING' })
      .toArray();
    const outgoingRows = await this.friendshipsCol
      .find({ userId1: userId, status: 'PENDING' })
      .toArray();

    const incoming: FriendRequestItem[] = [];
    const seenIncoming = new Set<string>();
    for (const r of incomingRows) {
      if (seenIncoming.has(r.userId1)) continue;
      seenIncoming.add(r.userId1);
      const u = await this.usersCol.findOne({ _id: r.userId1 });
      if (u) {
        incoming.push({
          requestId: r._id || r.id,
          user: {
            id: u._id || u.id,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            partnerCode: u.partnerCode
          },
          createdAt: r.createdAt
        });
      }
    }

    const outgoing: FriendRequestItem[] = [];
    const seenOutgoing = new Set<string>();
    for (const r of outgoingRows) {
      if (seenOutgoing.has(r.userId2)) continue;
      seenOutgoing.add(r.userId2);
      const u = await this.usersCol.findOne({ _id: r.userId2 });
      if (u) {
        outgoing.push({
          requestId: r._id || r.id,
          user: {
            id: u._id || u.id,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            partnerCode: u.partnerCode
          },
          createdAt: r.createdAt
        });
      }
    }

    return { incoming, outgoing };
  }

  async sendFriendRequest(userId: string, targetFriendCode: string) {
    const clean = targetFriendCode.trim().toUpperCase();
    const target = await this.usersCol.findOne({ partnerCode: clean });
    if (!target) {
      throw new Error(`User with friend code "${clean}" not found.`);
    }
    const targetUserId = target._id || target.id;
    if (targetUserId === userId) {
      throw new Error('You cannot add yourself as a friend.');
    }

    const pair = [userId, targetUserId].sort();
    const existing = await this.friendshipsCol.findOne({ userIds: { $all: pair } });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new Error(`You are already friends with ${target.displayName}.`);
      }
      if (existing.userId1 === userId) {
        return { status: 'PENDING', message: `Friend request already sent to ${target.displayName}.` };
      }
      // Reverse direction: accept!
      await this.friendshipsCol.updateMany(
        { userIds: { $all: pair } },
        { $set: { status: 'ACCEPTED', updatedAt: new Date().toISOString() } }
      );
      const friends = await this.getFriendsWithStreaks(userId);
      const friend = friends.find((f) => f.friendUser.id === targetUserId);
      return { status: 'ACCEPTED', friend, message: `You are now friends with ${target.displayName}!` };
    }

    const reqId = `fr_${nanoid(10)}`;
    await this.friendshipsCol.insertOne({
      _id: reqId,
      id: reqId,
      userId1: userId,
      userId2: targetUserId,
      userIds: pair,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return { status: 'PENDING', message: `Friend request sent to ${target.displayName}!` };
  }

  async acceptFriendRequest(userId: string, senderUserId: string): Promise<FriendWithStreak> {
    const pair = [userId, senderUserId].sort();
    await this.friendshipsCol.updateMany(
      { userIds: { $all: pair } },
      { $set: { status: 'ACCEPTED', updatedAt: new Date().toISOString() } }
    );
    const friends = await this.getFriendsWithStreaks(userId);
    const friend = friends.find((f) => f.friendUser.id === senderUserId);
    if (!friend) throw new Error('Failed to load accepted friend');
    return friend;
  }

  async declineFriendRequest(userId: string, senderUserId: string): Promise<void> {
    const pair = [userId, senderUserId].sort();
    await this.friendshipsCol.deleteMany({ userIds: { $all: pair } });
  }

  async cancelFriendRequest(userId: string, targetUserId: string): Promise<void> {
    const pair = [userId, targetUserId].sort();
    await this.friendshipsCol.deleteMany({ userIds: { $all: pair } });
  }

  async removeFriend(userId: string, friendUserId: string): Promise<void> {
    const pair = [userId, friendUserId].sort();
    await this.friendshipsCol.deleteMany({ userIds: { $all: pair } });
  }

  async getDiscoverableUsers(currentUserId: string, search?: string): Promise<DiscoverableUserItem[]> {
    const query: any = { _id: { $ne: currentUserId }, isAnonymous: { $ne: true } };
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { displayName: { $regex: s, $options: 'i' } },
        { partnerCode: { $regex: s, $options: 'i' } }
      ];
    }

    const users = await this.usersCol.find(query).limit(50).toArray();
    const result: DiscoverableUserItem[] = [];

    for (const u of users) {
      const targetId = u._id || u.id;
      const pair = [currentUserId, targetId].sort();
      const friendship = await this.friendshipsCol.findOne({ userIds: { $all: pair } });

      let requestStatus: 'NONE' | 'SENT' | 'RECEIVED' = 'NONE';
      if (friendship) {
        if (friendship.status === 'ACCEPTED') continue; // already friends
        if (friendship.userId1 === currentUserId) requestStatus = 'SENT';
        else requestStatus = 'RECEIVED';
      }

      result.push({
        id: targetId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        partnerCode: u.partnerCode,
        requestStatus
      });
    }

    return result;
  }

  async recordSessionBetweenUsers(userIdA: string, userIdB: string, minutes: number = 1) {
    const pair = [userIdA, userIdB].sort();
    const streakDoc = await this.streaksCol.findOne({ userIds: { $all: pair } });

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let currentStreak = streakDoc?.currentStreak || 0;
    let longestStreak = streakDoc?.longestStreak || 0;
    const lastWatched = streakDoc?.lastWatchedDate || null;
    const totalMinutes = (streakDoc?.totalMinutesWatched || 0) + minutes;

    let status: 'ALREADY_COMPLETED' | 'EXTENDED' | 'RESET_STARTED' = 'ALREADY_COMPLETED';

    if (lastWatched === today) {
      status = 'ALREADY_COMPLETED';
    } else if (lastWatched === yesterday) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      status = 'EXTENDED';
    } else {
      currentStreak = 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      status = 'RESET_STARTED';
    }

    const updated = {
      _id: streakDoc?._id || `stk_${pair.join('_')}`,
      userId1: pair[0],
      userId2: pair[1],
      userIds: pair,
      currentStreak,
      longestStreak,
      lastWatchedDate: today,
      totalMinutesWatched: totalMinutes,
      updatedAt: new Date().toISOString()
    };

    await this.streaksCol.updateOne({ userIds: { $all: pair } }, { $set: updated }, { upsert: true });

    return {
      streak: {
        currentStreak,
        longestStreak,
        lastWatchedDate: today,
        totalMinutesWatched: totalMinutes,
        completedToday: true,
        atRisk: false
      },
      status
    };
  }

  // ==========================================
  // PLANS
  // ==========================================

  async createPlan(plan: any): Promise<any> {
    const doc = {
      _id: plan.id,
      id: plan.id,
      hostId: plan.hostId,
      title: plan.title,
      emoji: plan.emoji,
      type: plan.type,
      date: plan.date,
      dateFormatted: plan.dateFormatted,
      time: plan.time,
      endTime: plan.endTime,
      timezone: plan.timezone,
      description: plan.description,
      activities: plan.activities || [],
      participants: plan.participants || [],
      voting: plan.voting || null,
      reminder: plan.reminder || null,
      recurring: plan.recurring || null,
      chatMessages: plan.chatMessages || [],
      createdAt: plan.createdAt || new Date().toISOString(),
      isPast: Boolean(plan.isPast)
    };
    await this.plansCol.updateOne({ _id: plan.id }, { $set: doc }, { upsert: true });
    return doc;
  }

  async getPlans(): Promise<any[]> {
    return this.plansCol.find({}).sort({ createdAt: -1 }).toArray();
  }

  async getPlanById(id: string): Promise<any | null> {
    return this.plansCol.findOne({ _id: id });
  }

  async updatePlan(id: string, updates: any): Promise<any | null> {
    await this.plansCol.updateOne({ _id: id }, { $set: updates });
    return this.getPlanById(id);
  }

  async deletePlan(id: string): Promise<boolean> {
    const res = await this.plansCol.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }

  // ==========================================
  // PARTNER CONNECTIONS
  // ==========================================

  async getPartner(userId: string): Promise<PartnerConnection | null> {
    const conn = await this.partnerConnectionsCol
      .find({ userId, status: 'ACCEPTED' })
      .sort({ updatedAt: -1 })
      .limit(1)
      .next();

    let partnerUserId: string | null = null;
    let connId = '';
    let createdAt = new Date().toISOString();
    let updatedAt = new Date().toISOString();

    if (conn) {
      partnerUserId = conn.partnerUserId;
      connId = conn.id || conn._id;
      createdAt = conn.createdAt || createdAt;
      updatedAt = conn.updatedAt || updatedAt;
    } else {
      // Fallback: check active friendships
      const friendship = await this.friendshipsCol.findOne({
        userIds: userId
      });
      if (friendship) {
        partnerUserId = friendship.userId1 === userId ? friendship.userId2 : friendship.userId1;
        connId = friendship._id || friendship.id;
        createdAt = friendship.createdAt || createdAt;
        updatedAt = friendship.createdAt || updatedAt;
      }
    }

    if (!partnerUserId) return null;

    const partnerUser = await this.getUserById(partnerUserId);
    if (!partnerUser) return null;

    return {
      id: connId,
      userId,
      partnerUserId,
      status: 'ACCEPTED',
      partnerUser: {
        id: partnerUser.id,
        displayName: partnerUser.displayName,
        avatarUrl: partnerUser.avatarUrl,
        partnerCode: partnerUser.partnerCode || ''
      },
      createdAt,
      updatedAt
    };
  }

  async connectPartner(userId: string, targetPartnerCode: string): Promise<PartnerConnection> {
    const targetUser = await this.getUserByPartnerCode(targetPartnerCode.toUpperCase().trim());
    if (!targetUser) {
      throw new Error('Partner Code not found. Please verify the code and try again.');
    }
    if (targetUser.id === userId) {
      throw new Error('You cannot enter your own Partner Code.');
    }

    const now = new Date().toISOString();
    const connId1 = `pconn_${nanoid(10)}`;
    const connId2 = `pconn_${nanoid(10)}`;

    await this.partnerConnectionsCol.updateOne(
      { userId, partnerUserId: targetUser.id },
      {
        $set: { status: 'ACCEPTED', updatedAt: now },
        $setOnInsert: { id: connId1, _id: connId1, userId, partnerUserId: targetUser.id, createdAt: now }
      },
      { upsert: true }
    );

    await this.partnerConnectionsCol.updateOne(
      { userId: targetUser.id, partnerUserId: userId },
      {
        $set: { status: 'ACCEPTED', updatedAt: now },
        $setOnInsert: { id: connId2, _id: connId2, userId: targetUser.id, partnerUserId: userId, createdAt: now }
      },
      { upsert: true }
    );

    return {
      id: connId1,
      userId,
      partnerUserId: targetUser.id,
      status: 'ACCEPTED',
      partnerUser: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        avatarUrl: targetUser.avatarUrl,
        partnerCode: targetUser.partnerCode || targetPartnerCode.toUpperCase()
      },
      createdAt: now,
      updatedAt: now
    };
  }

  async disconnectPartner(userId: string): Promise<void> {
    await this.partnerConnectionsCol.deleteMany({
      $or: [{ userId }, { partnerUserId: userId }]
    });
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.usersCol.deleteOne({ _id: userId });
    await this.directMessagesCol.deleteMany({
      $or: [{ senderId: userId }, { recipientId: userId }]
    });
    await this.friendshipsCol.deleteMany({ userIds: userId });
    await this.streaksCol.deleteMany({ userIds: userId });
    await this.partnerConnectionsCol.deleteMany({
      $or: [{ userId }, { partnerUserId: userId }]
    });
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}

export const mongoDb = new MongoDatabaseService();
