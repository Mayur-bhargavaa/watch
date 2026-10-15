import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runGameLaunchJob, launchNotification } from '../services/gameLaunch.js';
import { isComingSoonGame, COMING_SOON_GAMES } from '../games/comingSoon.js';

function fakeStore(rows: Array<{ userId: string; gameId: string }>) {
  return {
    rows,
    async claimPendingGameLaunchRows() { return [...this.rows]; },
    async deleteGameInterestRow(userId: string, gameId: string) { this.rows = this.rows.filter((r) => !(r.userId === userId && r.gameId === gameId)); }
  };
}

// The production catalogue is empty (every built game is live), so these tests use their own fake game id and register it in the
// coming-soon map only for the duration of one test (removed in a finally block).
const FAKE = 'future-game-x';
async function withFakeGame<T>(fn: () => Promise<T> | T): Promise<T> {
  COMING_SOON_GAMES[FAKE] = 'Future Game X';
  try {
    return await fn();
  } finally {
    delete COMING_SOON_GAMES[FAKE];
  }
}

test('launch job notifies every pending user once and deletes their rows', () => withFakeGame(async () => {
  const store = fakeStore([{ userId: 'a', gameId: FAKE }, { userId: 'b', gameId: FAKE }]);
  const got: Array<[string, string]> = [];
  assert.equal(await runGameLaunchJob(store, (u, n) => got.push([u, n.title])), 2);
  assert.deepEqual(got, [['a', 'Future Game X is now live'], ['b', 'Future Game X is now live']]);
  assert.equal(store.rows.length, 0);
  assert.equal(await runGameLaunchJob(store, () => assert.fail('second run must not notify')), 0);
}));

test('launch job keeps a row when delivery throws, so the next tick retries', async () => {
  // the job itself never needs the catalogue: an id that is not in it is shown as is
  const store = fakeStore([{ userId: 'a', gameId: FAKE }, { userId: 'b', gameId: FAKE }]);
  assert.equal(await runGameLaunchJob(store, (u) => { if (u === 'a') throw new Error('boom'); }), 1);
  assert.deepEqual(store.rows.map((r) => r.userId), ['a']);
  assert.equal(launchNotification(FAKE).title, `${FAKE} is now live`);
});

test('a game that just launched (no longer coming soon) is announced by its real name', () => {
  assert.equal(launchNotification('tournament').title, 'Tournament Arena is now live');
  assert.equal(launchNotification('quiz-show').title, 'Quiz Show Studio is now live');
  assert.equal(launchNotification('mafia').title, 'Mafia Night is now live');
  assert.equal(launchNotification('totally-unknown').title, 'totally-unknown is now live');
});

test('the production coming-soon list is empty: every built game is live, nothing can be "notified" about', () => {
  assert.deepEqual(Object.keys(COMING_SOON_GAMES), []);
  for (const live of ['tournament', 'murder-mystery', 'quiz-show', 'mafia-night', 'ludo']) assert.ok(!isComingSoonGame(live), `${live} is live, not coming soon`);
});

test('coming-soon list validates ids and notifications are plain text', () => withFakeGame(() => {
  assert.ok(isComingSoonGame(FAKE));
  assert.ok(!isComingSoonGame('murder-mystery'), 'a live game is no longer coming soon');
  assert.ok(!isComingSoonGame('ludo') && !isComingSoonGame('__proto__') && !isComingSoonGame(5));
  for (const id of Object.keys(COMING_SOON_GAMES)) assert.match(launchNotification(id).title, /^[\x20-\x7e]+ is now live$/);
}));
