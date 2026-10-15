import { LudoColor, MembershipTier } from '@synccinema/common';

export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  playerOptions: number[];
  supportsPartnerMode: boolean;
  supportsPublicMatchmaking: boolean;
  /** VIP / Creator game: only a host with at least this pass may create a room (guests of any pass may join / watch) */
  requiredHostTier?: MembershipTier;
  colorAssignments: Record<number, LudoColor[]>;
}

export const GAME_DEFINITIONS: Record<string, GameDefinition> = {
  ludo: {
    id: 'ludo',
    name: 'Ludo Party',
    minPlayers: 2,
    maxPlayers: 4,
    playerOptions: [2, 3, 4],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      // 2 players: Diagonally opposite corners (Red at Bottom-Left vs Yellow at Top-Right)
      2: ['red', 'yellow'],
      // 3 players: Red, Blue, Green
      3: ['red', 'blue', 'green'],
      // 4 players: seat order follows the board clockwise (start tiles red 0, blue 13, yellow 26, green 39)
      4: ['red', 'blue', 'yellow', 'green']
    }
  },
  'four-in-a-row': {
    id: 'four-in-a-row',
    name: 'Four in a Row',
    minPlayers: 2,
    maxPlayers: 2,
    playerOptions: [2],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      2: ['red', 'yellow']
    }
  },
  'tic-tac-toe': {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    minPlayers: 2,
    maxPlayers: 2,
    playerOptions: [2],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      2: ['red', 'blue']
    }
  },
  bingo: {
    id: 'bingo',
    name: 'Bingo Duel',
    minPlayers: 2,
    maxPlayers: 2,
    playerOptions: [2],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      2: ['red', 'blue']
    }
  },
  'doodle-duel': {
    id: 'doodle-duel',
    name: 'Doodle Duel',
    minPlayers: 2,
    maxPlayers: 2,
    playerOptions: [2],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      2: ['red', 'blue']
    }
  },
  tambola: {
    id: 'tambola',
    name: 'Tambola',
    minPlayers: 2,
    maxPlayers: 20,
    playerOptions: [2, 3, 4, 5, 6, 7, 8, 10, 15, 20],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      2: ['red', 'blue'],
      3: ['red', 'blue', 'green'],
      4: ['red', 'blue', 'green', 'yellow']
    }
  },
  imposter: {
    id: 'imposter',
    name: 'Imposter',
    minPlayers: 4,
    maxPlayers: 8,
    playerOptions: [4, 5, 6, 7, 8],
    // invite by room code / friends only: no 2-player partner room, no public matchmaking
    supportsPartnerMode: false,
    supportsPublicMatchmaking: false,
    requiredHostTier: 'plus',
    colorAssignments: {}
  },
  'emoji-charades': {
    id: 'emoji-charades',
    name: 'Emoji Charades',
    minPlayers: 2,
    maxPlayers: 8,
    playerOptions: [2, 3, 4, 5, 6, 7, 8],
    // invite by room code / friends only: no 2-player partner room, no public matchmaking
    supportsPartnerMode: false,
    supportsPublicMatchmaking: false,
    requiredHostTier: 'plus',
    colorAssignments: {}
  },
  'mafia-night': {
    id: 'mafia-night',
    name: 'Mafia Night',
    minPlayers: 5,
    maxPlayers: 10,
    playerOptions: [5, 6, 7, 8, 9, 10],
    // invite by room code / friends only: no 2-player partner room, no public matchmaking
    supportsPartnerMode: false,
    supportsPublicMatchmaking: false,
    requiredHostTier: 'plus',
    colorAssignments: {}
  },
  'quiz-show': {
    id: 'quiz-show',
    name: 'Quiz Show Studio',
    // the host (quiz master) plus 1 to 30 players
    minPlayers: 2,
    maxPlayers: 31,
    playerOptions: [31],
    // invite by room code / friends only: no 2-player partner room, no public matchmaking
    supportsPartnerMode: false,
    supportsPublicMatchmaking: false,
    requiredHostTier: 'creator',
    colorAssignments: {}
  },
  'murder-mystery': {
    id: 'murder-mystery',
    name: 'Murder Mystery Night',
    minPlayers: 6,
    maxPlayers: 12,
    playerOptions: [6, 7, 8, 9, 10, 11, 12],
    // invite by room code / friends only: no 2-player partner room, no public matchmaking
    supportsPartnerMode: false,
    supportsPublicMatchmaking: false,
    requiredHostTier: 'creator',
    colorAssignments: {}
  },
  tournament: {
    id: 'tournament',
    name: 'Tournament Arena',
    // minPlayers counts the PLAYERS (4); the organiser is the host and does not play, so the room holds the host plus 4 to 32 players
    minPlayers: 4,
    maxPlayers: 33,
    playerOptions: [33],
    // invite by room code / friends only: no 2-player partner room, no public matchmaking
    supportsPartnerMode: false,
    supportsPublicMatchmaking: false,
    requiredHostTier: 'creator',
    colorAssignments: {}
  },
  chess: {
    id: 'chess',
    name: 'Chess',
    minPlayers: 2,
    maxPlayers: 2,
    playerOptions: [2],
    supportsPartnerMode: true,
    supportsPublicMatchmaking: true,
    colorAssignments: {
      2: ['red', 'yellow'] // White & Black internally
    }
  }
};

const FALLBACK_PALETTE: LudoColor[] = ['red', 'blue', 'green', 'yellow'];

/** Seat colours for `count` players. Games with many seats (Tambola 5-20) cycle the palette (GR-8). */
export function seatColorsFor(gameType: string, count: number): LudoColor[] {
  const explicit = GAME_DEFINITIONS[gameType]?.colorAssignments[count];
  if (explicit) return explicit;
  return Array.from({ length: Math.max(1, count) }, (_, i) => FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]);
}

/** Strict game type resolution: exact ids (and a few explicit aliases) only; unknown input returns null (GR-32). */
const GAME_TYPE_ALIASES: Record<string, string> = {
  ludo: 'ludo', 'four-in-a-row': 'four-in-a-row', fourinarow: 'four-in-a-row', 'connect-four': 'four-in-a-row', connect4: 'four-in-a-row',
  'tic-tac-toe': 'tic-tac-toe', tictactoe: 'tic-tac-toe', bingo: 'bingo', 'bingo-duel': 'bingo',
  'doodle-duel': 'doodle-duel', doodle: 'doodle-duel', pictionary: 'doodle-duel',
  tambola: 'tambola', housie: 'tambola', chess: 'chess',
  imposter: 'imposter',
  'emoji-charades': 'emoji-charades', emojicharades: 'emoji-charades', charades: 'emoji-charades',
  'mafia-night': 'mafia-night', mafianight: 'mafia-night', mafia: 'mafia-night',
  'quiz-show': 'quiz-show', quizshow: 'quiz-show', quiz: 'quiz-show',
  'murder-mystery': 'murder-mystery', murdermystery: 'murder-mystery', murder: 'murder-mystery', mystery: 'murder-mystery',
  tournament: 'tournament', 'tournament-arena': 'tournament', arena: 'tournament'
};
export function parseGameType(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return GAME_TYPE_ALIASES[key] ?? null;
}
