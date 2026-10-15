// Room background themes shared by the in-room game screens (same artwork the Ludo room uses).
export interface GameRoomTheme {
  id: string;
  name: string;
  bgUrl: string;
}

export const GAME_ROOM_THEMES: GameRoomTheme[] = [
  { id: 'romantic', name: 'Romantic Candlelight', bgUrl: '/images/romantic_room_ambient_bg.jpg' },
  { id: 'cozy', name: 'Cozy Cottage', bgUrl: '/images/cozy_ludo_bg.jpg' },
  { id: 'theam1', name: 'Candlelit Cafe', bgUrl: '/theams/theam1.jpeg' },
  { id: 'theam2', name: 'Neon Romance', bgUrl: '/theams/theam2.jpeg' },
  { id: 'theam3', name: 'Better Together', bgUrl: '/theams/theam3.jpeg' },
  { id: 'theam4', name: 'Watch Together', bgUrl: '/theams/theam4.jpeg' },
  { id: 'theam5', name: 'Snuggle Cinema', bgUrl: '/theams/theam5.jpeg' },
  { id: 'theam6', name: 'Velvet Night', bgUrl: '/theams/theam6.jpeg' }
];

export function findGameRoomTheme(id: string | null | undefined): GameRoomTheme {
  return GAME_ROOM_THEMES.find((t) => t.id === id) || GAME_ROOM_THEMES[0];
}
