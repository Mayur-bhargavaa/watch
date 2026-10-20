import { cleanChatContent } from './directMessage.js';

/** WhatsApp lets you edit for 15 minutes; the same limit here. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TEXT = 4000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const validMessageId = (id: unknown): id is string => typeof id === 'string' && ID_RE.test(id);

type Stored = { senderId?: string; recipientId?: string; type?: string; content?: string; createdAt?: string; isDeleted?: boolean; isPinned?: boolean } | null;
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
