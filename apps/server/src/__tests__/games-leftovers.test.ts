import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

const U = (n: string, avatarUrl: string | null = null) => ({ id: n, displayName: n.toUpperCase(), avatarUrl });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class FakeSocket {
  readyState = 1;
  sent: any[] = [];
  private handlers: Record<string, Array<(...a: any[]) => void>> = {};
  send(d: string) { this.sent.push(JSON.parse(d)); }
  on(ev: string, fn: (...a: any[]) => void) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev: string, ...a: any[]) { for (const h of this.handlers[ev] || []) h(...a); }
  close() { if (this.readyState === 3) return; this.readyState = 3; setImmediate(() => this.emit('close')); }
  msg(type: string, payload?: any) { this.emit('message', JSON.stringify({ type, payload })); }
  of(type: string) { return this.sent.filter(m => m.type === type); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

function mk() {
  const db = new DatabaseService(':memory:');
  const m = new GameRoomManager(db, { graceMsPlaying: 120, graceMsWaiting: 120, sweep: false });
  managers.push(m);
  return { db, m: m as any };
}

function room(gameType: string, n = 2, users?: any[]) {
  const { db, m } = mk();
  const us = users || ['a', 'b', 'c', 'd'].slice(0, n).map(i => U(i));
  const r = m.createGameRoom({ hostUser: us[0], gameType, maxPlayers: n });
  for (const u of us.slice(1)) m.joinRoom(r.roomCode, u);
  const socks: Record<string, FakeSocket> = {};
  for (const u of us) { socks[u.id] = new FakeSocket(); m.registerClient(socks[u.id] as any, r.id, u); }
  return { db, m, id: r.id as string, socks, get: () => db.getGameRoomById(r.id)! };
}

test('GR-27: sweep closes abandoned PLAYING rooms and purges old finished rows (and their seats)', () => {
  const { db, m } = mk();
  const t = room('tic-tac-toe');
  // a PLAYING room nobody is connected to (server restart)
  const r = m.createGameRoom({ hostUser: U('x'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  m.joinRoom(r.roomCode, U('y'));
  db.updateGameRoomStatus(r.id, 'PLAYING', new Date().toISOString());
  // a live PLAYING room is untouched
  const far = Date.now() + 3 * 3_600_000;
  t.m.sweepStaleRooms(far);
  assert.equal(t.get().status, 'PLAYING');
  m.sweepStaleRooms(far);
  assert.equal(db.getGameRoomById(r.id)!.status, 'FINISHED');
  // finished rows older than the retention are deleted; recent ones are kept
  m.sweepStaleRooms(far);
  assert.ok(db.getGameRoomById(r.id));
  m.sweepStaleRooms(far + 31 * 24 * 3_600_000);
  assert.equal(db.getGameRoomById(r.id), null);
});

test('CH-21: the auto-started chess game keeps both avatars', () => {
  const t = room('chess', 2, [U('a', 'https://img/a.png'), U('b', 'https://img/b.png')]);
  const gs: any = t.get().gameState;
  assert.equal(gs.whitePlayer.avatarUrl, 'https://img/a.png');
  assert.equal(gs.blackPlayer.avatarUrl, 'https://img/b.png');
});

test('DD-13: a doodle forfeit sets finalWinnerUserId / finalWinnerDisplayName', async () => {
  const t = room('doodle-duel');
  t.socks.a.msg('doodle:start', {});
  assert.equal(t.get().status, 'PLAYING');
  t.socks.b.msg('game:leave');
  await sleep(50);
  const gs: any = t.get().gameState;
  assert.equal(gs.finalWinnerUserId, 'a');
  assert.equal(gs.finalWinnerDisplayName, 'A');
  assert.equal(gs.phase, 'FINISHED');
});

test('TA-14: a 2-player tambola forfeit leaves a finished state with a winner and summary', async () => {
  const t = room('tambola');
  t.socks.a.msg('bingo:start', {});
  assert.equal(t.get().status, 'PLAYING');
  t.socks.b.msg('game:leave');
  await sleep(50);
  const cur = t.get();
  assert.equal(cur.status, 'FINISHED');
  const gs: any = cur.gameState;
  assert.equal(gs.phase, 'FINISHED');
  assert.equal(gs.winnerUserId, 'a');
  assert.equal(gs.gameSummary.winnerUserId, 'a');
  assert.ok(gs.gameSummary.finalScores);
});

test('DD-7: rematch in a bot game completes with the single human vote; outsiders never count', async () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'doodle-duel', maxPlayers: 2 });
  const sa = new FakeSocket();
  m.registerClient(sa as any, r.id, U('a'));
  sa.msg('doodle:start', {});
  assert.ok(db.getGameRoomById(r.id)!.players.some((p: any) => p.userId === 'bot_duelist'), 'bot seated');
  sa.msg('game:rematch'); // mid game: refused
  assert.equal(sa.of('game:error').at(-1)?.payload.code, 'REMATCH_UNAVAILABLE');
  m.stopDoodleTimer(r.id);
  db.updateGameRoomStatus(r.id, 'FINISHED', undefined, new Date().toISOString());
  const spec = new FakeSocket();
  m.registerClient(spec as any, r.id, U('spec'));
  assert.equal(spec.readyState, 3, 'spectator is rejected');
  sa.msg('game:rematch');
  const status = sa.of('game:rematch_status').at(-1)!.payload;
  assert.equal(status.totalNeeded, 1);
  assert.equal(status.allVoted, true);
  await sleep(700);
  assert.equal(db.getGameRoomById(r.id)!.status, 'PLAYING');
});

test('DD-14: leaving a bot practice game does not crown the bot', async () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'doodle-duel', maxPlayers: 2 });
  const sa = new FakeSocket();
  m.registerClient(sa as any, r.id, U('a'));
  sa.msg('doodle:start', {});
  sa.msg('game:leave');
  await sleep(50);
  const cur = db.getGameRoomById(r.id)!;
  assert.equal(cur.status, 'FINISHED');
  assert.ok(!(cur.gameState as any).winnerUserId, 'no bot winner');
});

test('LU-9: an auto-created room is private and cannot be matched publicly', () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'ludo', maxPlayers: 4, isPrivate: true, customCode: 'ABCDE' });
  assert.equal(r.isPrivate, true);
  assert.equal(db.findOpenWaitingGameRoom('ludo', 4, 'zzz'), null);
});
