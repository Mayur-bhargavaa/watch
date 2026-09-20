import { LudoColor } from '@synccinema/common';

export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  playerOptions: number[];
  supportsPartnerMode: boolean;
  supportsPublicMatchmaking: boolean;
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
      // 4 players: Red, Blue, Green, Yellow
      4: ['red', 'blue', 'green', 'yellow']
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
  }
};
