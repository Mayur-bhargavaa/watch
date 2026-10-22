import { createGameRoom, getGameTitle } from '@/lib/api';
import type { ChatGamePayload } from '@/types/chat';

export const GAME_OPTIONS = [
  { id: 'ludo', label: '🎲 Ludo Party' },
  { id: 'bingo', label: '🔢 Bingo Duel' },
  { id: 'chess', label: '♟️ Chess Duel' },
  { id: 'doodle-duel', label: '🎨 Doodle Duel' },
  { id: 'tic-tac-toe', label: '⭕ Tic-Tac-Toe' },
  { id: 'zero-cross', label: '✖️ Zero Cross' },
  { id: 'pen-fight', label: '🖊️ Pen Fight' },
  { id: 'rock-paper-scissors', label: '✊ Rock Paper Scissors' },
  { id: 'color-clash', label: '🃏 Color Clash' },
  { id: 'four-in-a-row', label: '🔴 Four in a Row' },
  { id: 'tambola', label: '🎟️ Tambola' }
] as const;

/** UI ids sometimes use short names; the API wants the canonical game type. */
export function normalizeGameType(raw: string): string {
  if (raw === 'doodle') return 'doodle-duel';
  if (raw === 'tictactoe') return 'tic-tac-toe';
  return raw;
}

export function maxPlayersFor(gameType: string): number {
  if (gameType === 'ludo' || gameType === 'color-clash') return 4;
  if (gameType === 'tambola') return 20;
  return 2;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Room-code prefix used by the server for each game. */
export function roomPrefixFor(gameType: string): string {
  if (gameType.includes('bingo')) return 'BINGO';
  if (gameType.includes('chess')) return 'CHESS';
  if (gameType.includes('doodle')) return 'DOODLE';
  if (gameType.includes('zero')) return 'ZERO';
  if (gameType.includes('pen')) return 'PEN';
  if (gameType.includes('rock') || gameType === 'rps') return 'RPS';
  if (gameType.includes('clash')) return 'CLASH';
  if (gameType.includes('tic')) return 'TIC';
  if (gameType.includes('four') || gameType.includes('connect')) return 'FOUR';
  if (gameType.includes('tambola')) return 'TAMBOLA';
  return 'LUDO';
}

/** `PREFIX-XXXXXXXX` from crypto randomness (same shape the server generates; the old code used Math.random and 4 chars). */
export function fallbackRoomCode(gameType: string, randomBytes: (n: number) => Uint8Array = defaultRandomBytes): string {
  const bytes = randomBytes(8);
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${roomPrefixFor(gameType)}-${suffix}`;
}

function defaultRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out);
  else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** Creates the room on the server (falling back to a locally generated code the host's page will create on connect). */
export async function createGameInvite(
  selectedGame: string,
  session: { token: string; user: { displayName: string } }
): Promise<ChatGamePayload> {
  const gameType = normalizeGameType(selectedGame);
  const maxPlayers = maxPlayersFor(gameType);

  let roomCode = '';
  try {
    const res = await createGameRoom(session.token, gameType as never, maxPlayers, false);
    roomCode = res?.room?.roomCode || '';
  } catch (err) {
    console.warn('Could not pre-create the room, using a generated code:', err);
  }
  if (!roomCode) roomCode = fallbackRoomCode(gameType);

  return {
    gameType: gameType as ChatGamePayload['gameType'],
    roomCode,
    roomId: roomCode,
    title: `${getGameTitle(gameType)} Challenge`,
    playersCount: 1,
    maxPlayers,
    hostName: session.user.displayName,
    status: 'waiting'
  };
}
