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
      // 2 players: Blue (Top-Right) vs Green (Bottom-Left) matching cozy reference UI
      2: ['blue', 'green'],
      // 3 players: Blue, Green, Yellow
      3: ['blue', 'green', 'yellow'],
      // 4 players: Blue, Green, Yellow, Red
      4: ['blue', 'green', 'yellow', 'red']
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
  }
};
