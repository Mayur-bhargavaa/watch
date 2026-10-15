/**
 * Pure helpers for chat conversation ids (no browser APIs, no storage), so they can be unit-tested.
 *
 * A direct conversation between two users is stored under the canonical id `conv_<idA>_<idB>` (ids sorted).
 * Older data also used `conv_<friendId>` and unsorted pairs, so every lookup resolves ids to the *peer user*
 * and compares conversations by that, never by substring matching (which used to attach messages to the wrong chat).
 */

const GROUP_PREFIX = 'conv_group_';

export function toCanonicalConvId(userA: string, userB: string): string {
  return `conv_${[userA, userB].sort().join('_')}`;
}

export function isGroupConvId(convId: string | undefined | null): boolean {
  return Boolean(convId && convId.startsWith(GROUP_PREFIX));
}

/** Splits a conversation id into participant ids. `myId` decides which participant is "the other one". */
export function extractParticipantIds(
  convId: string,
  myId?: string
): { userIds: string[]; otherUserId?: string } {
  if (!convId) {
    return { userIds: [] };
  }
  const raw = convId.startsWith('conv_') ? convId.slice(5) : convId;

  // Pattern: usr_AAA_usr_BBB or AAA_usr_BBB
  if (raw.includes('_usr_')) {
    const idx = raw.indexOf('_usr_');
    const u1 = raw.slice(0, idx);
    const u2 = raw.slice(idx + 1); // keeps the 'usr_' prefix
    const otherUserId = myId ? (u1 === myId ? u2 : u2 === myId ? u1 : u2) : u2;
    return { userIds: [u1, u2], otherUserId };
  }

  // Fallback: the current user's id is somewhere inside the raw id
  if (myId && raw.includes(myId)) {
    let remainder = raw.replace(myId, '');
    if (remainder.startsWith('_')) remainder = remainder.slice(1);
    if (remainder.endsWith('_')) remainder = remainder.slice(0, -1);
    if (remainder) {
      return { userIds: [myId, remainder], otherUserId: remainder };
    }
  }

  if (raw.includes('_')) {
    const parts = raw.split('_');
    // Single user id with prefix usr_ (e.g. usr_qu8M4HFI04)
    if (parts.length === 2 && parts[0] === 'usr') {
      const singleUserId = `usr_${parts[1]}`;
      return { userIds: [singleUserId], otherUserId: myId && singleUserId === myId ? undefined : singleUserId };
    }
    // General two-part id: AAA_BBB
    if (parts.length === 2) {
      const [u1, u2] = parts;
      const otherUserId = myId ? (u1 === myId ? u2 : u2 === myId ? u1 : u2) : u2;
      return { userIds: [u1, u2], otherUserId };
    }
  }

  return { userIds: [raw], otherUserId: myId && raw === myId ? undefined : raw };
}

/** The other user of a direct conversation id, or undefined for groups / unresolvable ids. */
export function directPeerId(convId: string, myId?: string): string | undefined {
  if (!convId || isGroupConvId(convId)) return undefined;
  const { otherUserId } = extractParticipantIds(convId, myId);
  return otherUserId && otherUserId !== myId ? otherUserId : undefined;
}

/** Canonical id for direct conversations (when both users are known); the id itself otherwise. */
export function normalizeConversationId(convId: string, myId?: string): string {
  if (!convId) return convId;
  const peer = directPeerId(convId, myId);
  return myId && peer ? toCanonicalConvId(myId, peer) : convId;
}

/** Every storage key a conversation's messages may live under (canonical + legacy `conv_<friendId>`). */
export function conversationAliases(convId: string, myId?: string): string[] {
  const aliases = new Set<string>([convId]);
  const peer = directPeerId(convId, myId);
  if (peer) {
    aliases.add(`conv_${peer}`);
    if (myId) aliases.add(toCanonicalConvId(myId, peer));
  }
  // `conv_<myId>` would be shared by every chat of the current user and cross-contaminate them
  if (myId) aliases.delete(`conv_${myId}`);
  return Array.from(aliases);
}

/** True when both ids refer to the same conversation (exact match, or the same direct peer). Never substring-based. */
export function isSameConversation(a: string | undefined | null, b: string | undefined | null, myId?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (isGroupConvId(a) || isGroupConvId(b)) return false;
  const pa = directPeerId(a, myId);
  const pb = directPeerId(b, myId);
  return Boolean(pa && pb && pa === pb);
}
