import { UPCOMING_GAMES } from '@synccinema/common';

/** Games shown as "Coming soon" (VIP and Creator rows) in the web hub. A user can ask to be notified when one launches. */
export const COMING_SOON_GAMES: Record<string, string> = Object.fromEntries(UPCOMING_GAMES.map((g) => [g.id, g.title]));

export const isComingSoonGame = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(COMING_SOON_GAMES, id);

export const comingSoonTitle = (id: string): string => COMING_SOON_GAMES[id] || id;
