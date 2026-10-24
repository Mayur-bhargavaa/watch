import { nanoid } from 'nanoid';
import { sanitizeSvg, safeUrl } from '@synccinema/common';
import { extractParticipantIdsFromConvId, toCanonicalConvId } from '../db/database.js';
import { str, plainText } from '../util/validate.js';

const MSG_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TEXT = 4000;

/** Sanitise untrusted sticker/media metadata before it is stored and relayed to other users' browsers. */
export function cleanMetadata(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  let size = 0;
  try { size = JSON.stringify(raw).length; } catch { return null; }
  if (size > 60_000) return null;
  const meta: Record<string, any> = JSON.parse(JSON.stringify(raw));
  const sticker = meta.sticker;
  if (sticker && typeof sticker === 'object') {
    if ('drawingSvg' in sticker) {
      const clean = sanitizeSvg(sticker.drawingSvg);
      if (clean) sticker.drawingSvg = clean; else delete sticker.drawingSvg;
    }
    for (const k of ['gifUrl', 'webpUrl', 'url']) {
      if (k in sticker) {
        const u = safeUrl(sticker[k], { allowRelative: true });
        if (u) sticker[k] = u; else delete sticker[k];
      }
    }
    for (const k of ['name', 'tagline', 'emoji', 'caption']) {
      if (typeof sticker[k] === 'string') sticker[k] = sticker[k].slice(0, 120);
    }
  }
  return meta;
}

/** [draw:<svg>|caption] stickers travel inside `content`; the svg part must pass the sanitizer. */
export function cleanChatContent(content: string): string {
  if (content.startsWith('[draw:')) {
    const inner = content.slice(6, content.endsWith(']') ? -1 : undefined);
    const pipe = inner.lastIndexOf('|');
    const svg = pipe === -1 ? inner : inner.slice(0, pipe);
    const caption = (pipe === -1 ? '' : inner.slice(pipe + 1)).replace(/[\]|<>]/g, '').slice(0, 60);
    const clean = sanitizeSvg(svg);
    return clean ? `[draw:${clean}${caption ? `|${caption}` : ''}]` : '[unsafe sticker removed]';
  }
  return content;
}

/** A media data URL as a browser or phone produces it. Recorders add parameters, e.g. `data:audio/webm;codecs=opus;base64,`. */
const DATA_URL_RE = /^data:(image|audio|video)\/[a-z0-9.+-]+(?:;[a-z0-9._=+-]+)*;base64,[A-Za-z0-9+/=]+$/i;
const AUDIO_URL_RE = /^data:audio\/[a-z0-9.+-]+(?:;[a-z0-9._=+-]+)*;base64,[A-Za-z0-9+/=]+$/i;
/** A voice note travels as a data URL (about 600 KB of audio = 800 KB of base64). */
export const MAX_VOICE_DATA_URL = 880_000;
export const MAX_VOICE_SECONDS = 180;
export const VOICE_LABEL = '🎤 Voice message';

/**
 * The voice part of a message: `{ duration (whole seconds, 1..180), waveform (up to 64 bars, 0..100) }`. The audio itself
 * lives ONCE, in `mediaUrl`; the old website also repeated it in `metadata.voice.audioUrl`, which is accepted as the audio
 * when `mediaUrl` is missing and is never stored twice.
 */
export function cleanVoice(body: any): { mediaUrl: string; voice: { duration: number; waveform: number[] } } | { error: string } {
  const raw = body?.metadata?.voice && typeof body.metadata.voice === 'object' ? body.metadata.voice : {};
  const candidates = [body?.mediaUrl, raw.audioUrl];
  const audio = candidates.find((u) => typeof u === 'string' && AUDIO_URL_RE.test(u));
  if (!audio) return { error: 'A voice message needs audio (a recording of a supported type).' };
  if (audio.length > MAX_VOICE_DATA_URL) return { error: 'That voice message is too long to send. Keep it under about two minutes.' };
  const d = Number(raw.durationSeconds ?? raw.duration);
  const duration = Number.isFinite(d) ? Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round(d))) : 1;
  const waveform = Array.isArray(raw.waveform)
    ? raw.waveform.slice(0, 64).map((n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0))
    : [];
  return { mediaUrl: audio, voice: { duration, waveform } };
}

export interface DirectMessageDeps {
  areConnected(a: string, b: string): Promise<boolean>;
  getDirectMessageById(id: string): Promise<any | null>;
}

export type PreparedMessage =
  | { ok: true; msg: Record<string, any>; recipientId: string }
  | { ok: false; status: number; error: string };

/**
 * Single choke point for every direct message (HTTP and WebSocket): validates the payload, checks the
 * friendship, forces sender identity from the authenticated user and sanitises everything relayed to others.
 */
export async function prepareDirectMessage(
  deps: DirectMessageDeps,
  sender: { id: string; displayName: string; avatarUrl?: string | null },
  input: any,
  isRecipientOnline: (id: string) => boolean
): Promise<PreparedMessage> {
  const body = input && typeof input === 'object' ? input : {};
  const content = typeof body.content === 'string' ? body.content : '';
  if (typeof body.conversationId !== 'string' && typeof body.recipientId !== 'string') {
    return { ok: false, status: 400, error: 'conversationId and content are required' };
  }
  if (!content) return { ok: false, status: 400, error: 'conversationId and content are required' };
  const isMedia = content.startsWith('[draw:') || content.startsWith('[custom_img:') || content.startsWith('[gif:');
  if (content.length > (isMedia ? 60_000 : MAX_TEXT)) {
    return { ok: false, status: 400, error: `Message is too long (max ${MAX_TEXT} characters)` };
  }

  let recipientId = typeof body.recipientId === 'string' ? body.recipientId : undefined;
  if (!recipientId && typeof body.conversationId === 'string') {
    recipientId = extractParticipantIdsFromConvId(body.conversationId, sender.id).otherUserId || undefined;
  }
  if (!recipientId || !(await deps.areConnected(sender.id, recipientId))) {
    return { ok: false, status: 403, error: 'You can only message your friends or partner.' };
  }

  // Ids are client-suggested (optimistic UI) but can never overwrite someone else's message
  let id = `msg_${Date.now()}_${nanoid(6)}`;
  if (typeof body.id === 'string' && MSG_ID_RE.test(body.id)) {
    const existing = await deps.getDirectMessageById(body.id);
    if (existing && existing.senderId !== sender.id) {
      return { ok: false, status: 409, error: 'Message id already in use' };
    }
    id = body.id;
  }

  let mediaUrl: string | undefined;
  if (typeof body.mediaUrl === 'string' && body.mediaUrl) {
    mediaUrl =
      DATA_URL_RE.test(body.mediaUrl) && body.mediaUrl.length < 900_000
        ? body.mediaUrl
        : safeUrl(body.mediaUrl, { allowRelative: true }) || undefined;
  }

  const replyTo =
    body.replyTo && typeof body.replyTo === 'object'
      ? {
          id: str(body.replyTo.id, 64),
          senderId: str(body.replyTo.senderId, 64),
          senderName: plainText(body.replyTo.senderName, 60),
          content: str(body.replyTo.content, 300),
          type: str(body.replyTo.type, 20)
        }
      : undefined;

  const type = typeof body.type === 'string' && /^[a-z_]{1,20}$/.test(body.type) ? body.type : 'text';
  let voice: { duration: number; waveform: number[] } | undefined;
  if (type === 'voice') {
    const v = cleanVoice(body);
    if ('error' in v) return { ok: false, status: 400, error: v.error };
    mediaUrl = v.mediaUrl;
    voice = v.voice;
  }

  const msg = {
    id,
    conversationId: toCanonicalConvId(sender.id, recipientId),
    senderId: sender.id,
    senderName: sender.displayName, // identity always comes from the token, never the body
    senderAvatar: sender.avatarUrl || undefined,
    recipientId,
    type,
    content: type === 'voice' ? VOICE_LABEL : cleanChatContent(content),
    mediaUrl,
    metadata: type === 'voice' ? { voice } : cleanMetadata(body.metadata) || undefined,
    replyTo,
    status: isRecipientOnline(recipientId) ? 'delivered' : 'sent',
    createdAt: new Date().toISOString()
  };
  return { ok: true, msg, recipientId };
}
