import { effectiveStreak } from '../util/streak.js';
import { createHash } from 'node:crypto';
import { secureCode } from '../util/random.js';
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
  LudoColor,
  ActiveDeviceSession
} from '@synccinema/common';
import { extractParticipantIdsFromConvId, toCanonicalConvId } from './database.js';
import { computeEntitlement, type SubscriptionDoc } from '../services/billing.js';

export interface FriendStreak {
  id: string;
  userId1: string;
  userId2: string;
  currentStreak: number;
  longestStreak: number;
  lastWatchedDate: string | null;
  totalMinutesWatched: number;
  /** length of the last run of streak days ending at lastWatchedDate (kept after the streak breaks, for the calendar) */
  lastRunLength?: number;
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
    membershipTier?: 'free' | 'plus' | 'creator';
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastWatchedDate: string | null;
    completedToday: boolean;
    atRisk: boolean;
    totalMinutesWatched: number;
    lastRunLength?: number;
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
  private readonly dbName = 'stitchbyte_watch_party';

  constructor(uri?: string) {
    try { (process as any).loadEnvFile?.(); } catch {}
    const mongoUri = uri || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set. Refusing to start without an explicit database connection string.');
    }
    this.client = new MongoClient(mongoUri);
    this.db = this.client.db(this.dbName);
  }

  /** Cheap round trip used by the health endpoint. */
  async ping(): Promise<void> {
    await this.db!.command({ ping: 1 });
  }

  async connect(): Promise<void> {
    if (this.client) {
      await this.client.connect();
      console.log('🍃 MongoDatabaseService connected to', this.dbName);
      await this.ensurePlanIndexes();
    }
  }

  private async ensurePlanIndexes(): Promise<void> {
    try {
      const col = this.plansCol;
      await col.createIndex({ hostId: 1 });
      await col.createIndex({ 'participants.userId': 1 });
      await col.createIndex({ reminderDueAt: 1 }, { sparse: true });
      await col.createIndex({ endsAt: 1 }, { sparse: true });
    } catch (err) {
      console.warn('[mongo] could not create plan indexes:', (err as Error)?.message || err);
    }
    try {
      await this.db!.collection('billing_events').createIndex({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });
      await this.subscriptionsCol.createIndex({ providerSubscriptionId: 1 }, { sparse: true });
      await this.billingWaitlistCol.createIndex({ userId: 1, tier: 1 }, { unique: true });
      await this.billingPaymentsCol.createIndex({ userId: 1, paidAt: -1 });
      await this.billingPaymentsCol.createIndex({ refs: 1 });
      await this.subscriptionsCol.createIndex({ providerCustomerId: 1 }, { sparse: true });
    } catch (err) {
      console.warn('[mongo] could not create billing indexes:', (err as Error)?.message || err);
    }
    try {
      await this.partnerRequestsCol.createIndex({ requesterId: 1, recipientId: 1 }, { unique: true });
      await this.partnerRequestsCol.createIndex({ recipientId: 1 });
      await this.partnerRequestsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await this.gameInterestCol.createIndex({ userId: 1, gameId: 1 }, { unique: true });
      await this.gameInterestCol.createIndex({ gameId: 1, notifyPending: 1 });
    } catch (err) {
      console.warn('[mongo] could not create partner request / game interest indexes:', (err as Error)?.message || err);
    }
    try {
      await this.watchlistCol.createIndex({ userId: 1, titleKey: 1 }, { unique: true });
      await this.watchlistCol.createIndex({ userId: 1, addedAt: -1 });
    } catch (err) {
      console.warn('[mongo] could not create watchlist indexes:', (err as Error)?.message || err);
    }
  }

  // --- Billing (subscriptions hold provider ids only: never card data) ---------------------------------------
  get subscriptionsCol(): Collection<any> {
    return this.db!.collection('subscriptions');
  }
  get billingEventsCol(): Collection<any> {
    return this.db!.collection('billing_events');
  }
  get billingWaitlistCol(): Collection<any> {
    return this.db!.collection('billing_waitlist');
  }
  /** One minimal row per successful charge: ids, amount, currency, date. Never card data. */
  get billingPaymentsCol(): Collection<any> {
    return this.db!.collection('billing_payments');
  }
  /** Append-only operator trail for money events that do not change access (refunds). */
  get billingAuditCol(): Collection<any> {
    return this.db!.collection('billing_audit');
  }

  async findSubscriptionByCustomerId(providerCustomerId: string): Promise<SubscriptionDoc | null> {
    return (await this.subscriptionsCol.findOne({ providerCustomerId })) as SubscriptionDoc | null;
  }

  async recordBillingPayment(p: { eventId: string; userId: string; provider: string; amount: number; currency: string; paidAt: number; refs: string[] }): Promise<void> {
    await this.billingPaymentsCol.updateOne(
      { _id: p.eventId as any },
      { $setOnInsert: { provider: p.provider, userId: p.userId, amount: p.amount, currency: p.currency, paidAt: p.paidAt, refs: p.refs, createdAt: Date.now() } },
      { upsert: true }
    );
  }

  async listBillingPayments(userId: string, limit = 20): Promise<{ id: string; paidAt: number; amount: number; currency: string; status: string; provider: string }[]> {
    const rows = await this.billingPaymentsCol.find({ userId }).sort({ paidAt: -1 }).limit(limit).toArray();
    return rows.map((r: any) => ({ id: String(r._id), paidAt: r.paidAt, amount: r.amount, currency: r.currency, status: 'paid', provider: r.provider }));
  }

  async findPaymentUserByRefs(refs: string[]): Promise<string | null> {
    if (!refs.length) return null;
    const r = await this.billingPaymentsCol.findOne({ refs: { $in: refs } });
    return r ? String(r.userId) : null;
  }

  async recordBillingAudit(row: { eventId: string; provider: string; type: string; userId: string | null; amount: number; currency: string; refs: string[]; refundId?: string | null }): Promise<void> {
    await this.billingAuditCol.updateOne({ _id: row.eventId as any }, { $setOnInsert: { ...row, at: Date.now() } }, { upsert: true });
  }

  async getSubscription(userId: string): Promise<SubscriptionDoc | null> {
    return (await this.subscriptionsCol.findOne({ _id: userId })) as SubscriptionDoc | null;
  }

  async findSubscriptionByProviderId(providerSubscriptionId: string): Promise<SubscriptionDoc | null> {
    return (await this.subscriptionsCol.findOne({ providerSubscriptionId })) as SubscriptionDoc | null;
  }

  /** Merge a state change into the user's single subscription row. Without a tier it only updates an existing row. */
  async applySubscriptionPatch(userId: string, patch: Record<string, any>): Promise<boolean> {
    const now = Date.now();
    const set: Record<string, any> = { updatedAt: now };
    for (const [k, v] of Object.entries(patch)) if (v !== undefined && v !== null) set[k] = v;
    delete set._id;
    delete set.createdAt;
    if (!set.tier) {
      const r = await this.subscriptionsCol.updateOne({ _id: userId }, { $set: set });
      return r.matchedCount > 0;
    }
    await this.subscriptionsCol.updateOne(
      { _id: userId },
      {
        $set: set,
        $setOnInsert: {
          createdAt: now,
          ...(set.interval ? {} : { interval: 'monthly' }),
          ...(set.currency ? {} : { currency: 'USD' }),
          ...(set.status ? {} : { status: 'active' }),
          ...(set.currentPeriodEnd !== undefined ? {} : { currentPeriodEnd: null }),
          ...(set.cancelAtPeriodEnd !== undefined ? {} : { cancelAtPeriodEnd: false }),
          ...(set.providerCustomerId ? {} : { providerCustomerId: null }),
          ...(set.providerSubscriptionId ? {} : { providerSubscriptionId: null })
        }
      } as any,
      { upsert: true }
    );
    return true;
  }

  /** Atomically records a webhook event id. Returns false when it was already processed (replay). */
  async claimBillingEvent(eventId: string, provider: string): Promise<boolean> {
    try {
      await this.billingEventsCol.insertOne({ _id: eventId as any, provider, createdAt: new Date() });
      return true;
    } catch (err: any) {
      if (err?.code === 11000) return false;
      throw err;
    }
  }

  async releaseBillingEvent(eventId: string): Promise<void> {
    await this.billingEventsCol.deleteOne({ _id: eventId as any });
  }

  async addBillingWaitlist(userId: string, tier: string): Promise<void> {
    await this.billingWaitlistCol.updateOne({ userId, tier }, { $setOnInsert: { userId, tier, createdAt: Date.now() } }, { upsert: true });
  }

  async getBillingWaitlist(userId: string): Promise<string[]> {
    return (await this.billingWaitlistCol.find({ userId }).toArray()).map((d: any) => d.tier);
  }

  /** Effective membership tier of each user (computed from the stored subscription, never trusted from clients). */
  async getMembershipTiers(userIds: string[]): Promise<Map<string, 'free' | 'plus' | 'creator'>> {
    const out = new Map<string, 'free' | 'plus' | 'creator'>();
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return out;
    const subs = await this.subscriptionsCol.find({ _id: { $in: ids } }).toArray();
    const bySub = new Map(subs.map((s: any) => [s._id, s]));
    for (const id of ids) out.set(id, computeEntitlement(bySub.get(id) as any).tier);
    return out;
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

  get partnerRequestsCol(): Collection<any> {
    return this.db!.collection('partner_requests');
  }
  get gameInterestCol(): Collection<any> {
    return this.db!.collection('game_interest');
  }
  /** Cineverse availability quota counters (no personal data): _id `<provider>:<YYYY-MM>`, { provider, month, count }. */
  get catalogQuotaCol(): Collection<any> {
    return this.db!.collection('catalog_quota');
  }
  /** Cineverse personal watchlist (private; one row per user + title). */
  get watchlistCol(): Collection<any> {
    return this.db!.collection('catalog_watchlist');
  }

  // --- Partner requests (consent flow: a partner code only lets you ASK) ----------------------------------------
  async arePartners(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;
    return Boolean(await this.partnerConnectionsCol.findOne({ userId: userA, partnerUserId: userB, status: 'ACCEPTED' }));
  }

  /**
   * Creates a pending request. Results: created | duplicate (already pending from me) | reverse (they already asked me)
   * | cooldown (they declined within 24 h). A stale (expired, TTL not yet run) row is replaced.
   */
  async createPartnerRequest(requesterId: string, recipientId: string, now = Date.now()): Promise<{ result: 'created' | 'duplicate' | 'reverse' | 'cooldown' }> {
    const reverse = await this.partnerRequestsCol.findOne({ requesterId: recipientId, recipientId: requesterId, status: 'PENDING', expiresAt: { $gt: new Date(now) } });
    if (reverse) return { result: 'reverse' };
    const existing = await this.partnerRequestsCol.findOne({ requesterId, recipientId });
    if (existing && existing.expiresAt && existing.expiresAt.getTime() > now) {
      return { result: existing.status === 'DECLINED' ? 'cooldown' : 'duplicate' };
    }
    const doc = {
      requesterId,
      recipientId,
      status: 'PENDING',
      createdAt: now,
      expiresAt: new Date(now + 14 * 24 * 3600 * 1000)
    };
    try {
      await this.partnerRequestsCol.updateOne({ requesterId, recipientId }, { $set: { status: doc.status, createdAt: doc.createdAt, expiresAt: doc.expiresAt }, $unset: { declinedAt: '' }, $setOnInsert: { _id: `preq_${nanoid(10)}` as any, requesterId, recipientId } }, { upsert: true });
    } catch (err: any) {
      if (err?.code === 11000) return { result: 'duplicate' };
      throw err;
    }
    return { result: 'created' };
  }

  async getPendingPartnerRequest(requesterId: string, recipientId: string, now = Date.now()): Promise<any | null> {
    return this.partnerRequestsCol.findOne({ requesterId, recipientId, status: 'PENDING', expiresAt: { $gt: new Date(now) } });
  }

  async listPartnerRequests(userId: string, now = Date.now()): Promise<{ incoming: any[]; outgoing: any[] }> {
    const live = { status: 'PENDING', expiresAt: { $gt: new Date(now) } };
    const [inc, out] = await Promise.all([
      this.partnerRequestsCol.find({ recipientId: userId, ...live }).sort({ createdAt: -1 }).limit(50).toArray(),
      this.partnerRequestsCol.find({ requesterId: userId, ...live }).sort({ createdAt: -1 }).limit(50).toArray()
    ]);
    const shape = async (rows: any[], otherKey: 'requesterId' | 'recipientId') =>
      (await Promise.all(rows.map(async (r) => {
        const u = await this.getUserById(r[otherKey]);
        if (!u) return null;
        return { userId: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl || null, createdAt: r.createdAt };
      }))).filter(Boolean) as any[];
    return { incoming: await shape(inc, 'requesterId'), outgoing: await shape(out, 'recipientId') };
  }

  async declinePartnerRequest(requesterId: string, recipientId: string, now = Date.now()): Promise<boolean> {
    const r = await this.partnerRequestsCol.updateOne(
      { requesterId, recipientId, status: 'PENDING', expiresAt: { $gt: new Date(now) } },
      { $set: { status: 'DECLINED', declinedAt: now, expiresAt: new Date(now + 24 * 3600 * 1000) } }
    );
    return r.modifiedCount > 0;
  }

  async cancelPartnerRequest(requesterId: string, recipientId: string): Promise<boolean> {
    const r = await this.partnerRequestsCol.deleteOne({ requesterId, recipientId, status: 'PENDING' });
    return r.deletedCount > 0;
  }

  /** Accepts a pending request: removes it and creates the two accepted connection rows. Null when there is no live request. */
  async acceptPartnerRequest(requesterId: string, recipientId: string, now = Date.now()): Promise<PartnerConnection | null> {
    const del = await this.partnerRequestsCol.findOneAndDelete({ requesterId, recipientId, status: 'PENDING', expiresAt: { $gt: new Date(now) } });
    if (!del) return null;
    const requester = await this.getUserById(requesterId);
    if (!requester?.partnerCode) return null;
    return this.connectPartner(recipientId, requester.partnerCode);
  }

  // --- Coming-soon game interest ("Notify me") ---------------------------------------------------------------
  async addGameInterest(userId: string, gameId: string): Promise<void> {
    await this.gameInterestCol.updateOne({ userId, gameId }, { $setOnInsert: { userId, gameId, createdAt: Date.now() } }, { upsert: true });
  }
  async removeGameInterest(userId: string, gameId: string): Promise<void> {
    await this.gameInterestCol.deleteOne({ userId, gameId });
  }
  async getGameInterest(userId: string): Promise<string[]> {
    return (await this.gameInterestCol.find({ userId }).limit(100).toArray()).map((d: any) => d.gameId);
  }
  /** Owner script: flag every interest row of a game for the launch job. Returns how many rows exist/are flagged. */
  async markGameLaunchPending(gameId: string, apply: boolean): Promise<number> {
    if (!apply) return this.gameInterestCol.countDocuments({ gameId });
    const r = await this.gameInterestCol.updateMany({ gameId }, { $set: { notifyPending: true } });
    return r.matchedCount;
  }
  async claimPendingGameLaunchRows(limit = 200): Promise<Array<{ userId: string; gameId: string }>> {
    return (await this.gameInterestCol.find({ notifyPending: true }).limit(limit).toArray()).map((d: any) => ({ userId: d.userId, gameId: d.gameId }));
  }
  async deleteGameInterestRow(userId: string, gameId: string): Promise<void> {
    await this.gameInterestCol.deleteOne({ userId, gameId });
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
      activeDevice: doc.activeDevice || undefined,
      discoverable: doc.discoverable !== false,
      createdAt: doc.createdAt
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.usersCol.findOne({ _id: id });
    if (!doc) return null;
    return this.mapUserDoc(doc);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids || ids.length === 0) return [];
    const docs = await this.usersCol.find({ _id: { $in: ids } }).toArray();
    return docs.map((d: any) => this.mapUserDoc(d));
  }

  async updateUserActiveDevice(userId: string, device: ActiveDeviceSession): Promise<void> {
    await this.usersCol.updateOne(
      { _id: userId },
      {
        $set: {
          activeDevice: device,
          updatedAt: new Date().toISOString()
        }
      }
    );
  }

  /** The Expo push token of the phone with the mobile app (kept apart from `activeDevice`, which the website's presence can replace). */
  async setExpoPushToken(userId: string, token: string | null): Promise<void> {
    await this.usersCol.updateOne({ _id: userId }, token ? { $set: { expoPushToken: token, expoPushTokenAt: new Date().toISOString() } } : { $unset: { expoPushToken: '', expoPushTokenAt: '' } });
  }

  async getExpoPushToken(userId: string): Promise<string | null> {
    const doc = await this.usersCol.findOne({ _id: userId }, { projection: { expoPushToken: 1 } });
    return typeof doc?.expoPushToken === 'string' ? doc.expoPushToken : null;
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
      avatarUrl: user.avatarUrl || null,
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

  get pendingRegistrationsCol(): Collection<any> {
    return this.db!.collection('pending_registrations');
  }

  /** Signup waits for the mailbox owner: only a hash of the token is stored, one pending signup per email. */
  async savePendingRegistration(tokenHash: string, data: Record<string, any>, expiresAtMs: number): Promise<void> {
    await this.pendingRegistrationsCol.deleteMany({ $or: [{ email: data.email }, { expiresAt: { $lt: Date.now() } }] });
    await this.pendingRegistrationsCol.insertOne({ _id: tokenHash, ...data, expiresAt: expiresAtMs, usedAt: null, createdAt: Date.now() });
  }

  async consumePendingRegistration(tokenHash: string): Promise<Record<string, any> | null> {
    // Atomic find-and-delete: the pending row (and its password hash) is gone the moment it is used
    const res = await this.pendingRegistrationsCol.findOneAndDelete({ _id: tokenHash, expiresAt: { $gt: Date.now() } });
    const doc: any = (res as any)?.value !== undefined ? (res as any).value : res;
    return doc || null;
  }

  /**
   * Returns the stored value for `key`, creating it with `make()` the first time. Atomic: if several server instances
   * start together, exactly one value is stored and every instance reads that same one.
   */
  async getOrCreateServerConfig<T extends object>(key: string, make: () => T): Promise<T> {
    const col = this.db!.collection('server_config');
    await col.updateOne({ _id: key as any }, { $setOnInsert: { value: make(), createdAt: new Date().toISOString() } }, { upsert: true });
    const doc: any = await col.findOne({ _id: key as any });
    return doc.value as T;
  }

  get pushSubscriptionsCol(): Collection<any> {
    return this.db!.collection('push_subscriptions');
  }

  async countPushSubscriptions(userId: string): Promise<number> {
    return this.pushSubscriptionsCol.countDocuments({ userId });
  }

  /** One row per endpoint. Re-subscribing the same browser (even as another user) moves it to the new owner. */
  async savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string): Promise<void> {
    await this.pushSubscriptionsCol.updateOne(
      { _id: createHash('sha256').update(sub.endpoint).digest('hex') } as any,
      { $set: { userId, endpoint: sub.endpoint, keys: sub.keys, userAgent: (userAgent || '').slice(0, 200), updatedAt: Date.now() }, $setOnInsert: { createdAt: Date.now() } },
      { upsert: true }
    );
  }

  async listPushSubscriptions(userId: string): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }[]> {
    const docs = await this.pushSubscriptionsCol.find({ userId }).toArray();
    return docs.map((d: any) => ({ endpoint: d.endpoint, keys: d.keys }));
  }

  async deletePushSubscription(endpoint: string, userId?: string): Promise<void> {
    await this.pushSubscriptionsCol.deleteOne({ _id: createHash('sha256').update(endpoint).digest('hex') as any, ...(userId ? { userId } : {}) });
  }

  get passwordResetsCol(): Collection<any> {
    return this.db!.collection('password_resets');
  }

  async setPasswordById(userId: string, passwordHash: string): Promise<boolean> {
    const res = await this.usersCol.updateOne({ _id: userId }, { $set: { passwordHash, updatedAt: new Date().toISOString() } });
    return res.matchedCount > 0;
  }

  /** Stores only the SHA-256 of a reset token; one live token per user. */
  async savePasswordReset(tokenHash: string, userId: string, expiresAtMs: number): Promise<void> {
    await this.passwordResetsCol.deleteMany({ $or: [{ userId }, { expiresAt: { $lt: Date.now() } }] });
    await this.passwordResetsCol.insertOne({ _id: tokenHash, userId, expiresAt: expiresAtMs, usedAt: null, createdAt: Date.now() });
  }

  /** Atomically marks a valid, unused, unexpired token as used and returns its user id (single-use). */
  async consumePasswordReset(tokenHash: string): Promise<string | null> {
    const res = await this.passwordResetsCol.findOneAndUpdate(
      { _id: tokenHash, usedAt: null, expiresAt: { $gt: Date.now() } },
      { $set: { usedAt: Date.now() } }
    );
    const doc: any = (res as any)?.value !== undefined ? (res as any).value : res;
    return doc?.userId ?? null;
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
      discoverable?: boolean;
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
      const suffix = secureCode(4);
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

    let docs: any[];
    if (opts.after) {
      query.createdAt = { ...query.createdAt, $gt: opts.after };
      docs = await this.directMessagesCol
        .find(query)
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
    } else if (opts.before) {
      query.createdAt = { ...query.createdAt, $lt: opts.before };
      const rawDocs = await this.directMessagesCol
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      docs = rawDocs.reverse();
    } else {
      const rawDocs = await this.directMessagesCol
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      docs = rawDocs.reverse();
    }

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

  async getDirectMessageById(messageId: string): Promise<any | null> {
    return this.directMessagesCol.findOne({ _id: messageId });
  }

  /** True when the two users are accepted friends or are linked as partners. */
  async areConnected(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;
    const pair = [userA, userB].sort();
    const friend = await this.friendshipsCol.findOne({ userIds: { $all: pair }, status: 'ACCEPTED' });
    if (friend) return true;
    const partner = await this.partnerConnectionsCol.findOne({ userId: userA, partnerUserId: userB, status: 'ACCEPTED' });
    return Boolean(partner);
  }

  async areFriends(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;
    const pair = [userA, userB].sort();
    return Boolean(await this.friendshipsCol.findOne({ userIds: { $all: pair }, status: 'ACCEPTED' }));
  }

  async markDirectMessageViewOnceOpened(messageId: string, openerUserId: string): Promise<{ conversationId: string; senderId: string; recipientId: string } | null> {
    const doc = await this.directMessagesCol.findOne({ _id: messageId });
    if (!doc) return null;
    // Only the recipient can open a view-once message
    if (doc.recipientId !== openerUserId) return null;

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
    const tiers = await this.getMembershipTiers(friendships.map((f: any) => (f.userId1 === userId ? f.userId2 : f.userId1)));

    for (const f of friendships) {
      const otherId = f.userId1 === userId ? f.userId2 : f.userId1;
      if (!otherId || otherId === userId || seenFriendIds.has(otherId)) continue;
      seenFriendIds.add(otherId);

      const friendUser = await this.usersCol.findOne({ _id: otherId });
      if (!friendUser) continue;

      const pair = [userId, otherId].sort();
      const deterministicStreakId = `stk_${pair.join('_')}`;
      const streakDoc = await this.streaksCol.findOne({
        $or: [
          { _id: deterministicStreakId },
          { userIds: { $all: pair } }
        ]
      });

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const lastWatched = streakDoc?.lastWatchedDate || null;
      const { currentStreak, completedToday, atRisk } = effectiveStreak(streakDoc, today, yesterday);

      result.push({
        friendshipId: f._id || f.id,
        friendUser: {
          id: friendUser._id || friendUser.id,
          displayName: friendUser.displayName,
          avatarUrl: friendUser.avatarUrl,
          partnerCode: friendUser.partnerCode,
          isOnline: isOnlineCheck(friendUser._id || friendUser.id),
          membershipTier: tiers.get(friendUser._id || friendUser.id) || 'free'
        },
        streak: {
          currentStreak,
          longestStreak: streakDoc?.longestStreak || 0,
          lastWatchedDate: lastWatched,
          completedToday,
          atRisk,
          totalMinutesWatched: streakDoc?.totalMinutesWatched || 0,
          lastRunLength: streakDoc?.currentStreak || 0
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
    const query: any = { _id: { $ne: currentUserId }, isAnonymous: { $ne: true }, discoverable: { $ne: false } };
    if (search && search.trim()) {
      const s = search.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const deterministicStreakId = `stk_${pair.join('_')}`;
    const streakDoc = await this.streaksCol.findOne({
      $or: [
        { _id: deterministicStreakId },
        { userIds: { $all: pair } }
      ]
    });

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

    const streakId = streakDoc?._id || deterministicStreakId;
    const updated = {
      _id: streakId,
      id: streakId,
      userId1: pair[0],
      userId2: pair[1],
      userIds: pair,
      currentStreak,
      longestStreak,
      lastWatchedDate: today,
      totalMinutesWatched: totalMinutes,
      updatedAt: new Date().toISOString()
    };

    await this.streaksCol.updateOne({ _id: streakId }, { $set: updated }, { upsert: true });

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

  /** Inserts a fully built plan (the route builds participants/chat/id; nothing here trusts a client). */
  async createPlan(doc: any): Promise<any> {
    await this.plansCol.insertOne({ ...doc, remindersSent: doc.remindersSent || [], _id: doc.id });
    return doc;
  }

  /** Plans the user hosts or takes part in (indexed lookup, never the whole collection). */
  async getPlansForUser(userId: string, limit = 200): Promise<any[]> {
    return this.plansCol
      .find({ $or: [{ hostId: userId }, { 'participants.userId': userId }] })
      .limit(limit)
      .toArray();
  }

  async countHostedPlans(userId: string): Promise<number> {
    return this.plansCol.countDocuments({ hostId: userId });
  }

  async getPlanById(id: string): Promise<any | null> {
    return this.plansCol.findOne({ _id: id });
  }

  /** Host edits of descriptive fields (whitelisted; participants, chat and votes have their own atomic methods). */
  async updatePlan(id: string, updates: any): Promise<any | null> {
    const ALLOWED = ['title', 'emoji', 'type', 'tagLabel', 'posterUrl', 'posterOverlayText', 'date', 'time', 'endTime', 'timezone', 'description', 'activities', 'reminder', 'recurring', 'startsAt', 'endsAt', 'reminderDueAt', 'reminderSentAt'];
    const safe: Record<string, any> = {};
    for (const k of ALLOWED) if (updates && Object.prototype.hasOwnProperty.call(updates, k)) safe[k] = updates[k];
    if (Object.keys(safe).length === 0) return this.getPlanById(id);
    await this.plansCol.updateOne({ _id: id }, { $set: safe });
    return this.getPlanById(id);
  }

  async deletePlan(id: string): Promise<boolean> {
    const res = await this.plansCol.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }

  // Atomic plan mutations: two people answering/chatting at once must not overwrite each other.

  async pushPlanChat(id: string, message: any): Promise<void> {
    await this.plansCol.updateOne({ _id: id }, { $push: { chatMessages: { $each: [message], $slice: -500 } } } as any);
  }

  /** Adds a participant unless already present. Returns false when the plan is full or the user already took part. */
  async addPlanParticipant(id: string, participant: any, maxParticipants: number): Promise<boolean> {
    const res = await this.plansCol.updateOne(
      { _id: id, 'participants.userId': { $ne: participant.userId }, [`participants.${maxParticipants - 1}`]: { $exists: false } },
      { $push: { participants: participant } }
    );
    return res.modifiedCount === 1;
  }

  async setPlanParticipantStatus(id: string, userId: string, status: string): Promise<boolean> {
    const res = await this.plansCol.updateOne({ _id: id, 'participants.userId': userId }, { $set: { 'participants.$.status': status } });
    return res.matchedCount === 1;
  }

  async removePlanParticipant(id: string, userId: string): Promise<void> {
    await this.plansCol.updateOne({ _id: id }, { $pull: { participants: { userId } } } as any);
    await this.plansCol.updateOne({ _id: id, 'voting.options': { $exists: true } }, { $pull: { 'voting.options.$[].votes': userId } } as any);
  }

  /** One vote per person: clears the user's other votes, then records the chosen option. */
  async setPlanVote(id: string, userId: string, optionId: string): Promise<boolean> {
    const exists = await this.plansCol.countDocuments({ _id: id, 'voting.options.id': optionId });
    if (!exists) return false;
    await this.plansCol.updateOne({ _id: id }, { $pull: { 'voting.options.$[].votes': userId } } as any);
    await this.plansCol.updateOne({ _id: id }, { $addToSet: { 'voting.options.$[o].votes': userId } } as any, { arrayFilters: [{ 'o.id': optionId }] });
    return true;
  }

  async addPlanVoteOption(id: string, option: any, maxOptions: number): Promise<boolean> {
    const res = await this.plansCol.updateOne(
      { _id: id, voting: { $ne: null }, [`voting.options.${maxOptions - 1}`]: { $exists: false }, 'voting.isClosed': { $ne: true } },
      { $push: { 'voting.options': option } }
    );
    return res.modifiedCount === 1;
  }

  async confirmPlanVote(id: string, title: string): Promise<boolean> {
    const res = await this.plansCol.updateOne(
      { _id: id, voting: { $ne: null } },
      { $set: { 'voting.isClosed': true, 'voting.confirmedTitle': title } }
    );
    return res.matchedCount === 1;
  }

  // Scheduler support (reminders, recurring plans)

  /** Marks the reminder as sent; true only for the one caller that wins (safe with several server instances). */
  async claimPlanReminder(id: string): Promise<boolean> {
    const res = await this.plansCol.updateOne({ _id: id, reminderSentAt: null }, { $set: { reminderSentAt: Date.now() } });
    return res.modifiedCount === 1;
  }

  /**
   * Atomically claims a milestone reminder ('4h', '30m') for a plan.
   * Returns true only for the winning server instance that claimed the milestone.
   */
  async claimPlanMilestoneReminder(id: string, milestone: string): Promise<boolean> {
    const res = await this.plansCol.updateOne(
      { _id: id, remindersSent: { $ne: milestone } },
      { $addToSet: { remindersSent: milestone } }
    );
    return res.modifiedCount === 1;
  }

  async getUpcomingPlansForMilestones(now: number): Promise<any[]> {
    return this.plansCol
      .find({ startsAt: { $gt: now, $lte: now + 5 * 3600_000 } })
      .limit(500)
      .toArray();
  }

  async getPlansWithReminderDue(now: number): Promise<any[]> {
    return this.plansCol
      .find({ reminderDueAt: { $lte: now }, startsAt: { $gt: now }, reminderSentAt: null })
      .limit(500)
      .toArray();
  }

  async getFinishedRecurringPlans(now: number): Promise<any[]> {
    return this.plansCol
      .find({ recurring: { $in: ['weekly', 'monthly'] }, endsAt: { $lt: now - 60 * 60_000 } })
      .limit(200)
      .toArray();
  }

  /** Moves a recurring plan to its next date. Guarded by the old `endsAt` so only one instance rolls it. */
  async rollPlanForward(id: string, previousEndsAt: number, fields: Record<string, any>, resetParticipants: boolean): Promise<boolean> {
    const plan = await this.getPlanById(id);
    if (!plan || plan.endsAt !== previousEndsAt) return false;
    const participants = (plan.participants || []).map((p: any) => ({ ...p, status: p.isHost ? 'GOING' : 'INVITED' }));
    const voting = plan.voting
      ? { ...plan.voting, isClosed: false, confirmedTitle: undefined, options: (plan.voting.options || []).map((o: any) => ({ ...o, votes: [] })) }
      : null;
    const res = await this.plansCol.updateOne(
      { _id: id, endsAt: previousEndsAt },
      { $set: { ...fields, reminderSentAt: null, ...(resetParticipants ? { participants } : {}), ...(voting ? { voting } : {}) } }
    );
    return res.modifiedCount === 1;
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
    await this.passwordResetsCol.deleteMany({ userId });
    await this.pushSubscriptionsCol.deleteMany({ userId });
    await this.subscriptionsCol.deleteOne({ _id: userId });
    await this.billingWaitlistCol.deleteMany({ userId });
    await this.billingPaymentsCol.deleteMany({ userId });
    await this.billingAuditCol.updateMany({ userId }, { $set: { userId: null } });
    await this.directMessagesCol.deleteMany({
      $or: [{ senderId: userId }, { recipientId: userId }]
    });
    await this.friendshipsCol.deleteMany({ userIds: userId });
    await this.streaksCol.deleteMany({ userIds: userId });
    // Plans: hosted ones go with the account; elsewhere the person is removed and their chat lines anonymised
    await this.plansCol.deleteMany({ hostId: userId });
    await this.plansCol.updateMany({ 'participants.userId': userId }, { $pull: { participants: { userId } } } as any);
    await this.plansCol.updateMany({ 'voting.options.votes': userId }, { $pull: { 'voting.options.$[].votes': userId } } as any);
    await this.plansCol.updateMany(
      { 'chatMessages.userId': userId },
      { $set: { 'chatMessages.$[m].displayName': 'Deleted user', 'chatMessages.$[m].avatarUrl': null, 'chatMessages.$[m].userId': 'deleted' } },
      { arrayFilters: [{ 'm.userId': userId }] }
    );
    await this.partnerConnectionsCol.deleteMany({
      $or: [{ userId }, { partnerUserId: userId }]
    });
    await this.partnerRequestsCol.deleteMany({ $or: [{ requesterId: userId }, { recipientId: userId }] });
    await this.gameInterestCol.deleteMany({ userId });
    await this.watchlistCol.deleteMany({ userId });
    await this.usernameHistoryCol.deleteMany({ userId });
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}

export const mongoDb = new MongoDatabaseService();
