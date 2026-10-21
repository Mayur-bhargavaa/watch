/** Only the host of a room may start sharing a screen to it (the server decides; the app only hides the button). */
export const mayStartScreenShare = (role: string | undefined): boolean => role === 'HOST';

export interface Checkin { positionSeconds: number; title?: string }

/** "Where are you in the show": a number of seconds (0 to 24 h) and an optional short title. Anything else is refused. */
export function cleanCheckin(payload: unknown): Checkin | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { positionSeconds?: unknown; title?: unknown };
  const n = Number(p.positionSeconds);
  if (!Number.isFinite(n) || n < 0 || n > 86_400) return null;
  const title = typeof p.title === 'string' ? p.title.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 80) : '';
  return { positionSeconds: Math.floor(n), ...(title ? { title } : {}) };
}

/**
 * Who may send a screen-share signal. Only the presenter sends the offer; answers and candidates travel between the presenter and a viewer
 * (one of the two ends must be the presenter). Anyone else posing as the presenter, or two viewers talking over the presenter's line, is refused.
 */
export function mayRelayScreenSignal(
  signal: { type?: unknown; streamKind?: unknown } | undefined,
  presenterId: string | undefined,
  fromId: string,
  toId: string
): boolean {
  if (!signal || signal.streamKind !== 'screen') return true; // not a screen signal: the normal call rules apply
  if (!presenterId) return false; // nobody is presenting: a screen signal has no business here
  if (signal.type === 'offer') return fromId === presenterId;
  return fromId === presenterId || toId === presenterId;
}

/** One line of structured, privacy-safe log: names and counts only, never tokens, cookies or media. */
export function screenLog(event: string, fields: Record<string, string | number | boolean | null>): string {
  return JSON.stringify({ scope: 'screen', event, ...fields });
}
