/**
 * Notification text helpers shared by the server (web-push payloads) and the web app (toasts / OS banners).
 * Chat messages can carry raw markup (`[draw:<svg…>|caption]`, `[custom_img:data:image/png;base64,…]`, `[gif:url]`);
 * that must never be shown as notification text.
 */

const MAX_PREVIEW = 100;

function truncate(text: string, max: number): string {
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** A short, safe, human-readable preview of a chat message for a notification. */
export function previewMessageText(content: string | undefined | null, type?: string, max = MAX_PREVIEW): string {
  const text = typeof content === 'string' ? content.trim() : '';

  if (text.startsWith('[draw:')) return 'Sent a sticker';
  if (text.startsWith('[sticker:')) return 'Sent a sticker';
  if (text.startsWith('[gif:')) return 'Sent a GIF';
  if (text.startsWith('[custom_img:')) return 'Sent a photo';

  switch (type) {
    case 'image':
      return text ? truncate(text, max - 3) : 'Sent a photo';
    case 'view_once':
      return 'Sent a view-once photo'; // never reveal a caption for view-once media
    case 'voice':
      return 'Sent a voice message';
    case 'sticker':
      return 'Sent a sticker';
    case 'plan':
      return 'Shared a watch plan';
    case 'game':
      return 'Sent a game invite';
    case 'movie':
      return 'Shared a movie';
    default:
      break;
  }
  return text ? truncate(text, max) : 'Sent a message';
}

/** "Aarav" or "Aarav, Priya +2" for a notification that summarises several senders. */
export function summariseSenders(names: string[], maxNames = 2): string {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length <= maxNames) return unique.join(', ') || 'a friend';
  return `${unique.slice(0, maxNames).join(', ')} +${unique.length - maxNames}`;
}
