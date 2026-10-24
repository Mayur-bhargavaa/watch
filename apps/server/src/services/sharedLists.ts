import { nanoid } from 'nanoid';
import type { TitleSnapshot } from '@synccinema/common';

/**
 * Shared watch lists: a small list a few friends build together ("Friday movie night"). Anyone in it can add a title and
 * vote (one vote per person per title); the most voted titles rise to the top. Pure rules, no I/O: the store and the
 * routes are elsewhere. Every change returns a new list and never touches the one it was given.
 */
export const LIST_NAME_MAX = 60;
export const LIST_MAX_MEMBERS = 8;
export const LIST_MAX_ITEMS = 50;
export const LISTS_PER_USER = 20;

export interface ListItem extends TitleSnapshot {
  addedBy: string;
  addedAt: number;
  /** ids of the members who voted for it */
  votes: string[];
}
export interface SharedList {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  items: ListItem[];
  createdAt: number;
  /** bumped on every save; a save made from an old copy is refused (optimistic concurrency) */
  rev: number;
}

export type Change<T = SharedList> = { ok: true; list: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export function cleanListName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIST_NAME_MAX);
  return t || null;
}

export const isMember = (l: Pick<SharedList, 'memberIds'>, userId: string): boolean => l.memberIds.includes(userId);

export function createList(ownerId: string, name: unknown, friendIds: readonly string[], now: number, id = `lst_${nanoid(10)}`): Change {
  const clean = cleanListName(name);
  if (!clean) return fail(400, 'Give the list a name.');
  const others = [...new Set(friendIds.filter((f) => typeof f === 'string' && f && f !== ownerId))];
  if (others.length + 1 > LIST_MAX_MEMBERS) return fail(400, `A list holds up to ${LIST_MAX_MEMBERS} people.`);
  return { ok: true, list: { id, name: clean, ownerId, memberIds: [ownerId, ...others], items: [], createdAt: now, rev: 0 } };
}

export function addItem(list: SharedList, userId: string, snap: TitleSnapshot, now: number): Change {
  if (!isMember(list, userId)) return fail(403, 'You are not in this list.');
  if (list.items.some((i) => i.titleKey === snap.titleKey)) return fail(409, 'That title is already in the list.');
  if (list.items.length >= LIST_MAX_ITEMS) return fail(409, `A list holds up to ${LIST_MAX_ITEMS} titles.`);
  // adding something is a vote for it
  return { ok: true, list: { ...list, items: [...list.items, { ...snap, addedBy: userId, addedAt: now, votes: [userId] }] } };
}

export function removeItem(list: SharedList, userId: string, titleKey: string): Change {
  const item = list.items.find((i) => i.titleKey === titleKey);
  if (!isMember(list, userId)) return fail(403, 'You are not in this list.');
  if (!item) return fail(404, 'That title is not in the list.');
  if (item.addedBy !== userId && list.ownerId !== userId) return fail(403, 'Only the person who added it, or the list owner, can remove it.');
  return { ok: true, list: { ...list, items: list.items.filter((i) => i.titleKey !== titleKey) } };
}

/** Votes for a title, or takes the vote back when there already is one. */
export function toggleVote(list: SharedList, userId: string, titleKey: string): Change {
  if (!isMember(list, userId)) return fail(403, 'You are not in this list.');
  if (!list.items.some((i) => i.titleKey === titleKey)) return fail(404, 'That title is not in the list.');
  return { ok: true, list: { ...list, items: list.items.map((i) => (i.titleKey !== titleKey ? i : { ...i, votes: i.votes.includes(userId) ? i.votes.filter((v) => v !== userId) : [...i.votes, userId] })) } };
}

/** The owner adds a friend (the route checks the friendship). */
export function addMember(list: SharedList, byUserId: string, userId: string): Change {
  if (list.ownerId !== byUserId) return fail(403, 'Only the list owner can add people.');
  if (isMember(list, userId)) return fail(409, 'Already in the list.');
  if (list.memberIds.length >= LIST_MAX_MEMBERS) return fail(409, `A list holds up to ${LIST_MAX_MEMBERS} people.`);
  return { ok: true, list: { ...list, memberIds: [...list.memberIds, userId] } };
}

/** Leaving takes your votes with you. The owner leaving hands the list to the next member, or ends it when nobody is left (list: null). */
export function leaveList(list: SharedList, userId: string): Change<SharedList | null> {
  if (!isMember(list, userId)) return fail(403, 'You are not in this list.');
  const memberIds = list.memberIds.filter((m) => m !== userId);
  if (!memberIds.length) return { ok: true, list: null };
  const items = list.items.map((i) => ({ ...i, votes: i.votes.filter((v) => v !== userId) }));
  return { ok: true, list: { ...list, memberIds, items, ownerId: list.ownerId === userId ? memberIds[0] : list.ownerId } };
}

/** Most votes first; ties keep the order they were added in. */
export const ranked = (list: Pick<SharedList, 'items'>): ListItem[] => list.items.map((item, order) => ({ item, order })).sort((a, b) => b.item.votes.length - a.item.votes.length || a.order - b.order).map((x) => x.item);

/** What the app is sent: the list with its items ranked, and which ones the caller voted for. */
export function viewOf(list: SharedList, viewerId: string) {
  return {
    id: list.id, name: list.name, ownerId: list.ownerId, memberIds: list.memberIds, createdAt: list.createdAt,
    items: ranked(list).map((i) => ({ titleKey: i.titleKey, title: i.title, posterPath: i.posterPath, year: i.year, mediaType: i.mediaType, addedBy: i.addedBy, addedAt: i.addedAt, voteCount: i.votes.length, voted: i.votes.includes(viewerId) }))
  };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────────────────────
export interface SharedListStore {
  listFor(userId: string): Promise<SharedList[]>;
  get(id: string): Promise<SharedList | null>;
  create(list: SharedList): Promise<void>;
  /** Saves `next` only when the stored copy still has revision `expectedRev`; false = someone changed it meanwhile. */
  replace(next: SharedList, expectedRev: number): Promise<boolean>;
  remove(id: string): Promise<void>;
  countOwned(userId: string): Promise<number>;
}

export class MemorySharedListStore implements SharedListStore {
  private rows = new Map<string, SharedList>();
  async listFor(userId: string) { return [...this.rows.values()].filter((l) => isMember(l, userId)).map((l) => structuredClone(l)).sort((a, b) => b.createdAt - a.createdAt); }
  async get(id: string) { const l = this.rows.get(id); return l ? structuredClone(l) : null; }
  async create(list: SharedList) { this.rows.set(list.id, structuredClone(list)); }
  async replace(next: SharedList, expectedRev: number) {
    const cur = this.rows.get(next.id);
    if (!cur || cur.rev !== expectedRev) return false;
    this.rows.set(next.id, structuredClone({ ...next, rev: expectedRev + 1 }));
    return true;
  }
  async remove(id: string) { this.rows.delete(id); }
  async countOwned(userId: string) { return [...this.rows.values()].filter((l) => l.ownerId === userId).length; }
}

interface ColLike {
  find(q: any): { sort(s: any): { limit(n: number): { toArray(): Promise<any[]> } } };
  findOne(q: any): Promise<any | null>;
  insertOne(doc: any): Promise<unknown>;
  replaceOne(q: any, doc: any): Promise<{ modifiedCount?: number; matchedCount?: number }>;
  deleteOne(q: any): Promise<unknown>;
  countDocuments(q: any): Promise<number>;
}
const fromDoc = (d: any): SharedList => ({ id: d._id, name: d.name, ownerId: d.ownerId, memberIds: d.memberIds ?? [], items: d.items ?? [], createdAt: d.createdAt, rev: d.rev ?? 0 });
const toDoc = (l: SharedList) => ({ _id: l.id, name: l.name, ownerId: l.ownerId, memberIds: l.memberIds, items: l.items, createdAt: l.createdAt, rev: l.rev });

export class MongoSharedListStore implements SharedListStore {
  constructor(private col: () => ColLike) {}
  async listFor(userId: string) { return (await this.col().find({ memberIds: userId }).sort({ createdAt: -1 }).limit(LISTS_PER_USER * 2).toArray()).map(fromDoc); }
  async get(id: string) { const d = await this.col().findOne({ _id: id }); return d ? fromDoc(d) : null; }
  async create(list: SharedList) { await this.col().insertOne(toDoc(list)); }
  async replace(next: SharedList, expectedRev: number) {
    const r = await this.col().replaceOne({ _id: next.id, rev: expectedRev }, toDoc({ ...next, rev: expectedRev + 1 }));
    return (r.modifiedCount ?? r.matchedCount ?? 0) > 0;
  }
  async remove(id: string) { await this.col().deleteOne({ _id: id }); }
  async countOwned(userId: string) { return this.col().countDocuments({ ownerId: userId }); }
}
