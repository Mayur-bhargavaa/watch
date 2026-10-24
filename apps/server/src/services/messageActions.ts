import { cleanChatContent } from './directMessage.js';

/** WhatsApp lets you edit for 15 minutes; the same limit here. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TEXT = 4000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const validMessageId = (id: unknown): id is string => typeof id === 'string' && ID_RE.test(id);

export interface StoredReaction { emoji: string; count: number; userIds: string[] }
type Stored = { senderId?: string; recipientId?: string; type?: string; content?: string; createdAt?: string; isDeleted?: boolean; isPinned?: boolean; reactions?: StoredReaction[] } | null;
export type ActionResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const isParticipant = (m: NonNullable<Stored>, userId: string) => m.senderId === userId || m.recipientId === userId;

/** Only the sender can change the text of a plain text message, and only for a while. */
export function prepareEdit(existing: Stored, userId: string, content: unknown, now = Date.now()): ActionResult<{ content: string; editedAt: string }> {
  if (!existing || existing.isDeleted) return { ok: false, status: 404, error: 'Message not found' };
  if (existing.senderId !== userId) return { ok: false, status: 403, error: 'You can only edit your own messages.' };
  if ((existing.type ?? 'text') !== 'text' || (existing.content ?? '').startsWith('[')) return { ok: false, status: 400, error: 'Only text messages can be edited.' };
  const created = Date.parse(existing.createdAt ?? '');
  if (!Number.isFinite(created) || now - created > EDIT_WINDOW_MS) return { ok: false, status: 400, error: 'Messages can only be edited for 15 minutes.' };
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return { ok: false, status: 400, error: 'Message cannot be empty.' };
  if (text.length > MAX_TEXT) return { ok: false, status: 400, error: `Message is too long (max ${MAX_TEXT} characters)` };
  return { ok: true, value: { content: cleanChatContent(text), editedAt: new Date(now).toISOString() } };
}

/** The sender removes a message for everyone. */
export function prepareDelete(existing: Stored, userId: string): ActionResult<{ recipientId: string }> {
  if (!existing || existing.isDeleted) return { ok: false, status: 404, error: 'Message not found' };
  if (existing.senderId !== userId) return { ok: false, status: 403, error: 'You can only delete your own messages.' };
  return { ok: true, value: { recipientId: existing.recipientId ?? '' } };
}

/** Either person in the chat can pin a message; pinning again unpins. */
export function preparePin(existing: Stored, userId: string): ActionResult<{ isPinned: boolean; otherId: string }> {
  if (!existing || existing.isDeleted) return { ok: false, status: 404, error: 'Message not found' };
  if (!isParticipant(existing, userId)) return { ok: false, status: 403, error: 'Not your conversation.' };
  const otherId = (existing.senderId === userId ? existing.recipientId : existing.senderId) ?? '';
  return { ok: true, value: { isPinned: !existing.isPinned, otherId } };
}

const MAX_REACTION_KINDS = 20;
/** One emoji (or a short emoji sequence such as a flag or a skin tone), never plain text. */
export function validReactionEmoji(emoji: unknown): emoji is string {
  return typeof emoji === 'string' && emoji.length > 0 && emoji.length <= 16 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji) && !/[A-Za-z0-9\s]/.test(emoji);
}

/**
 * Either person can react to any message; the same emoji again takes the reaction back (like the website). Returns the message's
 * new reaction list: `{ emoji, count, userIds }`, oldest reaction first, empty ones removed.
 */
export function prepareReaction(existing: Stored, userId: string, emoji: unknown): ActionResult<{ reactions: StoredReaction[]; otherId: string; added: boolean }> {
  if (!existing || existing.isDeleted) return { ok: false, status: 404, error: 'Message not found' };
  if (!isParticipant(existing, userId)) return { ok: false, status: 403, error: 'Not your conversation.' };
  if (!validReactionEmoji(emoji)) return { ok: false, status: 400, error: 'Pick an emoji to react with.' };
  const reactions = (Array.isArray(existing.reactions) ? existing.reactions : []).map((r) => ({ emoji: r.emoji, count: r.userIds.length, userIds: [...r.userIds] }));
  const found = reactions.find((r) => r.emoji === emoji);
  let added = true;
  if (!found) {
    if (reactions.length >= MAX_REACTION_KINDS) return { ok: false, status: 400, error: 'This message has too many different reactions.' };
    reactions.push({ emoji, count: 1, userIds: [userId] });
  } else if (found.userIds.includes(userId)) {
    found.userIds = found.userIds.filter((id) => id !== userId);
    found.count = found.userIds.length;
    added = false;
  } else {
    found.userIds.push(userId);
    found.count = found.userIds.length;
  }
  const otherId = (existing.senderId === userId ? existing.recipientId : existing.senderId) ?? '';
  return { ok: true, value: { reactions: reactions.filter((r) => r.count > 0), otherId, added } };
}
