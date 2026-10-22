/** Pure game id / route resolution (exact ids and known aliases only; no substring guessing). */

export type CanonicalGameId = 'ludo' | 'four-in-a-row' | 'tic-tac-toe' | 'zero-cross' | 'pen-fight' | 'rock-paper-scissors' | 'color-clash' | 'bingo' | 'doodle-duel' | 'tambola' | 'chess' | 'imposter' | 'emoji-charades' | 'mafia-night' | 'quiz-show' | 'murder-mystery' | 'tournament';

const ALIASES: Record<string, CanonicalGameId> = {
  'ludo': 'ludo',
  'four-in-a-row': 'four-in-a-row',
  'connect-four': 'four-in-a-row',
  'connect4': 'four-in-a-row',
  'tic-tac-toe': 'tic-tac-toe',
  'tictactoe': 'tic-tac-toe',
  'zero-cross': 'zero-cross',
  'zerocross': 'zero-cross',
  'zero-cut': 'zero-cross',
  'pen-fight': 'pen-fight',
  'penfight': 'pen-fight',
  'pen-battle': 'pen-fight',
  'rock-paper-scissors': 'rock-paper-scissors',
  'rps': 'rock-paper-scissors',
  'color-clash': 'color-clash',
  'colorclash': 'color-clash',
  'clash': 'color-clash',
  'rockpaperscissors': 'rock-paper-scissors',
  'bingo': 'bingo',
  'bingo-duel': 'bingo',
  'doodle-duel': 'doodle-duel',
  'doodle': 'doodle-duel',
  'pictionary': 'doodle-duel',
  'tambola': 'tambola',
  'housie': 'tambola',
  'chess': 'chess',
  'imposter': 'imposter',
  'emoji-charades': 'emoji-charades',
  'emojicharades': 'emoji-charades',
  'charades': 'emoji-charades',
  'mafia-night': 'mafia-night',
  'mafianight': 'mafia-night',
  'mafia': 'mafia-night',
  'quiz-show': 'quiz-show',
  'quizshow': 'quiz-show',
  'quiz': 'quiz-show',
  'murder-mystery': 'murder-mystery',
  'murdermystery': 'murder-mystery',
  'murder': 'murder-mystery',
  'mystery': 'murder-mystery',
  'tournament': 'tournament',
  'tournament-arena': 'tournament',
  'arena': 'tournament'
};

const PREFIXES: [string, CanonicalGameId][] = [
  ['TAMBOLA-', 'tambola'], ['BINGO-', 'bingo'], ['TIC-', 'tic-tac-toe'], ['ZERO-', 'zero-cross'], ['PEN-', 'pen-fight'], ['RPS-', 'rock-paper-scissors'], ['CLASH-', 'color-clash'], ['FOUR-', 'four-in-a-row'],
  ['DOODLE-', 'doodle-duel'], ['CHESS-', 'chess'], ['IMPOSTER-', 'imposter'], ['EMOJI-', 'emoji-charades'], ['MAFIA-', 'mafia-night'], ['QUIZ-', 'quiz-show'], ['MURDER-', 'murder-mystery'], ['ARENA-', 'tournament'], ['LUDO-', 'ludo']
];

export const GAME_BASE_PATHS: Record<CanonicalGameId, string> = {
  'ludo': '/games/ludo',
  'four-in-a-row': '/games/four-in-a-row',
  'tic-tac-toe': '/games/tic-tac-toe',
  'zero-cross': '/games/zero-cross',
  'pen-fight': '/games/pen-fight',
  'rock-paper-scissors': '/games/rock-paper-scissors',
  'color-clash': '/games/color-clash',
  'bingo': '/games/bingo',
  'doodle-duel': '/games/doodle-duel',
  'tambola': '/games/tambola',
  'chess': '/games/chess',
  'imposter': '/games/imposter',
  'emoji-charades': '/games/emoji-charades',
  'mafia-night': '/games/mafia',
  'quiz-show': '/games/quiz-show',
  'murder-mystery': '/games/murder-mystery',
  'tournament': '/games/tournament'
};

export const GAME_TITLES: Record<CanonicalGameId, string> = {
  'ludo': 'Ludo',
  'four-in-a-row': 'Four in a Row',
  'tic-tac-toe': 'Tic-Tac-Toe',
  'zero-cross': 'Zero Cross',
  'pen-fight': 'Pen Fight',
  'rock-paper-scissors': 'Rock Paper Scissors',
  'color-clash': 'Color Clash',
  'bingo': 'Bingo Duel',
  'doodle-duel': 'Doodle Duel',
  'tambola': 'Tambola',
  'chess': 'Chess',
  'imposter': 'Imposter',
  'emoji-charades': 'Emoji Charades',
  'mafia-night': 'Mafia Night',
  'quiz-show': 'Quiz Show Studio',
  'murder-mystery': 'Murder Mystery Night',
  'tournament': 'Tournament Arena'
};

/** Exact id or alias -> canonical id; null for unknown types. */
export function canonicalGameId(gameType?: string | null): CanonicalGameId | null {
  const key = (gameType || '').trim().toLowerCase();
  return key ? ALIASES[key] || null : null;
}

export function gameIdFromRoomCode(roomCode?: string | null): CanonicalGameId | null {
  const code = (roomCode || '').toUpperCase();
  for (const [prefix, id] of PREFIXES) if (code.startsWith(prefix)) return id;
  return null;
}

/**
 * Resolve a game for routing. An explicit unknown gameType resolves to null (caller shows the hub);
 * no gameType at all falls back to the room code prefix and then to Ludo (legacy plain codes).
 */
export function resolveGameId(gameType?: string | null, roomCode?: string | null): CanonicalGameId | null {
  if (gameType && gameType.trim()) return canonicalGameId(gameType);
  return gameIdFromRoomCode(roomCode) || 'ludo';
}

export function gameRoutePath(gameType?: string | null, roomCode?: string | null): string {
  const id = resolveGameId(gameType, roomCode);
  if (!id) return '/games';
  const base = GAME_BASE_PATHS[id];
  return roomCode ? `${base}?room=${encodeURIComponent(roomCode)}` : base;
}

export function gameTitleFor(gameType?: string | null, roomCode?: string | null): string {
  const id = resolveGameId(gameType, roomCode);
  return id ? GAME_TITLES[id] : 'Game';
}
