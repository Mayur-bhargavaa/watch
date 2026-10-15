/**
 * Pure helpers for the game room socket (no browser APIs) so they can be unit-tested.
 */

export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 15000;
export const RECONNECT_MAX_ATTEMPTS = 12;

/** Exponential backoff with a cap. `rand` returns 0..1 (injectable for tests); jitter adds up to 25%. */
export function reconnectDelayMs(attempt: number, rand: () => number = Math.random): number {
  const n = Math.max(0, Math.floor(attempt));
  const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, n));
  const jitter = base * 0.25 * Math.min(1, Math.max(0, rand()));
  return Math.min(RECONNECT_MAX_MS, Math.round(base + jitter));
}

export type CloseDecision =
  | { action: 'reconnect' }
  | { action: 'stop'; reason: 'AUTH_REQUIRED' | 'NOT_A_PLAYER' | 'SPECTATOR_LIMIT' | 'ROOM_GONE' | 'KICKED' | 'GAVE_UP' | 'UPGRADE_REQUIRED' };

const TERMINAL_CODES: Record<string, 'AUTH_REQUIRED' | 'NOT_A_PLAYER' | 'SPECTATOR_LIMIT' | 'ROOM_GONE' | 'UPGRADE_REQUIRED'> = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  NOT_A_PLAYER: 'NOT_A_PLAYER',
  SPECTATOR_LIMIT: 'SPECTATOR_LIMIT',
  GAME_ROOM_NOT_FOUND: 'ROOM_GONE',
  ROOM_CANCELLED: 'ROOM_GONE',
  ROOM_CLOSED: 'ROOM_GONE'
};

/** Non-terminal error:notification codes: the socket stays open, reconnect policy is untouched. */
export function isTerminalErrorCode(code: string | undefined | null): boolean {
  return Boolean(code && TERMINAL_CODES[code]);
}

export function terminalReasonForCode(code: string | undefined | null): 'AUTH_REQUIRED' | 'NOT_A_PLAYER' | 'SPECTATOR_LIMIT' | 'ROOM_GONE' | 'UPGRADE_REQUIRED' | null {
  return code ? TERMINAL_CODES[code] || null : null;
}

/** Decide what to do when the socket closed. `terminalCode` is a code seen in a prior error:notification. */
export function decideOnClose(
  event: { code?: number; reason?: string },
  terminalCode: string | null,
  attempt: number
): CloseDecision {
  const reason = (event.reason || '').toUpperCase();
  const fromCode = terminalReasonForCode(terminalCode);
  if (fromCode) return { action: 'stop', reason: fromCode };
  if (event.code === 4001 || reason === 'AUTH_REQUIRED') return { action: 'stop', reason: 'AUTH_REQUIRED' };
  if (event.code === 4403 || reason === 'NOT_A_PLAYER') return { action: 'stop', reason: 'NOT_A_PLAYER' };
  if (reason === 'GAME_ROOM_NOT_FOUND' || reason === 'ROOM_CANCELLED') return { action: 'stop', reason: 'ROOM_GONE' };
  if (event.code === 4402 || reason === 'UPGRADE_REQUIRED') return { action: 'stop', reason: 'UPGRADE_REQUIRED' };
  if (reason === 'REPLACED' || reason === 'KICKED' || reason === 'SESSION_REPLACED' || reason.includes('REPLACED')) {
    return { action: 'stop', reason: 'KICKED' };
  }
  if (attempt >= RECONNECT_MAX_ATTEMPTS) return { action: 'stop', reason: 'GAVE_UP' };
  return { action: 'reconnect' };
}

export interface GameErrorInfo {
  code: string;
  message: string;
  action?: string;
}

const FRIENDLY: Record<string, string> = {
  NOT_YOUR_TURN: 'It is not your turn.',
  NOT_PLAYER: 'You are not a player in this game.',
  NOT_PLAYING: 'The game is not in progress.',
  GAME_OVER: 'The game is already over.',
  WRONG_GAME: 'That action does not belong to this game.',
  HOST_ONLY: 'Only the host can do that.',
  SPECTATOR: 'Spectators cannot do that.',
  REMATCH_UNAVAILABLE: 'A rematch is not available right now (the game must be finished and everyone still present).',
  WRONG_PHASE: 'That is not possible in this part of the game.',
  ALREADY_VOTED: 'Your vote is final.',
  RATE_LIMITED: 'Slow down a little.',
  UPGRADE_REQUIRED: 'Hosting this game needs Watch+ (VIP Pass). You can still join a friend\'s game.',
  INVALID_REACTION: 'That reaction could not be sent.',
  INVALID_INPUT: 'That input was not valid.',
  ACTION_FAILED: 'That action could not be completed.'
};

export function mapGameError(payload: any): GameErrorInfo {
  const code = typeof payload?.code === 'string' && payload.code ? payload.code : 'ACTION_FAILED';
  const raw = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const message = raw || FRIENDLY[code] || FRIENDLY.ACTION_FAILED;
  const action = typeof payload?.action === 'string' ? payload.action : undefined;
  return { code, message, action };
}

const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|‍|️|⃣|[0-9#*]|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}])+$/u;

/** Mirrors the server rule: a short string made only of emoji glyphs. */
export function isValidReactionEmoji(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 8 && EMOJI_RE.test(value);
}

/** Safe string for rendering a broadcast reaction (never an object). Returns null when it should be dropped. */
export function sanitizeReactionEmoji(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > 16) return null;
  return s;
}

/**
 * Decide the "you won by forfeit" banner for game:player_left.
 * Only when the server says isWinner and the winner is me.
 */
export function forfeitWinForMe(
  payload: { isWinner?: boolean; winnerUserId?: string | null; userId?: string },
  myUserId: string
): boolean {
  return Boolean(
    payload?.isWinner === true &&
      myUserId &&
      payload.winnerUserId === myUserId &&
      payload.userId !== myUserId
  );
}
