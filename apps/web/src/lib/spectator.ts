/** Pure spectator-mode helpers (no browser APIs) so they can be unit-tested. */

export interface SpectatorInfo {
  role: 'player' | 'spectator';
  isSpectator: boolean;
  spectatorCount: number;
  spectators: string[];
}

/** True when a page URL asks for spectator mode (?spectate=1 / true). */
export function isSpectateRequested(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Adds `spectate=1` to the socket query when requested. Returns the same params object. */
export function applySpectateParam(params: URLSearchParams, spectate: boolean | undefined): URLSearchParams {
  if (spectate) {
    params.set('spectate', '1');
    // A spectator never creates rooms.
    params.delete('create');
  }
  return params;
}

/** Whether a socket message may be sent by a spectator (mirrors the server allow list). */
const SPECTATOR_ALLOWED = new Set(['game:leave', 'game:heartbeat', 'ping', 'game:ping', 'game:reaction']);
export function isSpectatorAllowedMessage(type: unknown): boolean {
  return typeof type === 'string' && SPECTATOR_ALLOWED.has(type);
}

function cleanNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is string => typeof n === 'string' && n.length > 0).slice(0, 5);
}

function cleanCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** Derives role/spectator info from a `game:sync` payload. Missing role means player. */
export function spectatorInfoFromSync(payload: any): SpectatorInfo {
  const isSpectator = payload?.role === 'spectator';
  const spectators = cleanNames(payload?.spectators);
  return {
    role: isSpectator ? 'spectator' : 'player',
    isSpectator,
    spectatorCount: cleanCount(payload?.spectatorCount, spectators.length),
    spectators
  };
}

/** Parses a `game:spectators` payload ({count, names}). */
export function spectatorsFromEvent(payload: any): { count: number; names: string[] } {
  const names = cleanNames(payload?.names);
  return { count: cleanCount(payload?.count, names.length), names };
}

export function spectatorBannerLabel(count: number): string {
  const n = Math.max(0, Math.floor(count || 0));
  return n <= 1 ? 'Watching with no one else' : `${n} watching`;
}

export type EndAction = 'rematch' | 'new_game' | 'back';

/**
 * What the end screen should offer.
 * - rematch: normal Rematch button (everyone still present, server did not refuse)
 * - new_game: opponent left / rematch refused, but opponent is still a friend: start a new room with them
 * - back: nothing to offer but returning to the games hub
 */
export function decideEndAction(input: {
  opponentLeft: boolean;
  rematchUnavailable: boolean;
  opponentUserId?: string | null;
  friendIds?: readonly string[] | null;
  isSpectator?: boolean;
}): EndAction {
  if (input.isSpectator) return 'back';
  if (!input.opponentLeft && !input.rematchUnavailable) return 'rematch';
  const id = input.opponentUserId;
  if (id && !id.startsWith('bot_') && !id.startsWith('guest_') && input.friendIds && input.friendIds.includes(id)) {
    return 'new_game';
  }
  return 'back';
}
