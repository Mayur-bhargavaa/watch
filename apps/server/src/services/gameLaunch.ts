import { COMING_SOON_GAMES } from '../games/comingSoon.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';

export interface GameLaunchStore {
  claimPendingGameLaunchRows(limit?: number): Promise<Array<{ userId: string; gameId: string }>>;
  deleteGameInterestRow(userId: string, gameId: string): Promise<void>;
}

/** Plain-text notification for one launched game; `link` is where the game opens. */
export function launchNotification(gameId: string) {
  // a game that was just launched is no longer in the coming-soon list: its name comes from the game definitions
  const title = COMING_SOON_GAMES[gameId] || GAME_DEFINITIONS[parseGameType(gameId) ?? '']?.name || gameId;
  return { id: `launch:${gameId}`, title: `${title} is now live`, body: 'Open the games hub to play it.', link: '/games' };
}

/**
 * Sends one notification per pending interest row, then deletes the row. A row is deleted only after `notify` returned
 * without throwing, so a crash between the two retries on the next tick (at-least-once, usually exactly once).
 */
export async function runGameLaunchJob(
  store: GameLaunchStore,
  notify: (userId: string, n: ReturnType<typeof launchNotification>) => void
): Promise<number> {
  const rows = await store.claimPendingGameLaunchRows(200);
  let sent = 0;
  for (const row of rows) {
    try {
      notify(row.userId, launchNotification(row.gameId));
      await store.deleteGameInterestRow(row.userId, row.gameId);
      sent++;
    } catch {
      // leave the row; the next tick retries
    }
  }
  return sent;
}
