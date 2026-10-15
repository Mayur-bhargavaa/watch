import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { parseGameType, seatColorsFor } from '../games/GameDefinitions.js';

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class FakeSocket {
  readyState = 1;
  sent: any[] = [];
  private handlers: Record<string, Array<(...a: any[]) => void>> = {};
  send(d: string) { this.sent.push(JSON.parse(d)); }
  on(ev: string, fn: (...a: any[]) => void) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev: string, ...a: any[]) { for (const h of this.handlers[ev] || []) h(...a); }
  /** like ws: close() flips readyState and fires `close` asynchronously */
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    setImmediate(() => this.emit('close'));
  }
  /** the other side vanished */
  drop() { this.close(); }
  msg(type: string, payload?: any) { this.emit('message', JSON.stringify({ type, payload })); }
  of(type: string) { return this.sent.filter(m => m.type === type); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

function mk(opts: { grace?: number; lobbyGrace?: number } = {}) {
  const db = new DatabaseService(':memory:');
  const m = new GameRoomManager(db, { graceMsPlaying: opts.grace ?? 120, graceMsWaiting: opts.lobbyGrace ?? 120, sweep: false });
  managers.push(m);
  return { db, m: m as any };
}

/** creates a room with `n` players, all connected with a live socket (auto-start games start) */
function room(gameType: string, n = 2, opts: { grace?: number; lobbyGrace?: number } = {}) {
  const { db, m } = mk(opts);
  const ids = ['a', 'b', 'c', 'd'].slice(0, n);
  const r = m.createGameRoom({ hostUser: U('a'), gameType, maxPlayers: n });
  for (const id of ids.slice(1)) m.joinRoom(r.roomCode, U(id)); // REST style join: no socket
  const socks: Record<string, FakeSocket> = {};
  for (const id of ids) {
    socks[id] = new FakeSocket();
    m.registerClient(socks[id] as any, r.id, U(id));
  }
  return { db, m, id: r.id as string, code: r.roomCode as string, socks, get: () => db.getGameRoomById(r.id)! };
}

test('GR-12: a REST-only join does not auto-start or count as connected; the socket does', () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  const sa = new FakeSocket();
  m.registerClient(sa as any, r.id, U('a'));
  m.joinRoom(r.roomCode, U('b')); // REST join
  const cur = db.getGameRoomById(r.id)!;
  assert.equal(cur.status, 'WAITING');
  assert.equal(cur.players.find((p: any) => p.userId === 'b')?.isConnected, false);
  assert.equal(db.findUserActiveGameRoom('b'), null);
  const sb = new FakeSocket();
  m.registerClient(sb as any, r.id, U('b'));
  assert.equal(db.getGameRoomById(r.id)!.status, 'PLAYING');
});

test('GR-3: a user who is not seated cannot connect to a running room; a full lobby is closed too', () => {
  const t = room('tic-tac-toe');
  const sc = new FakeSocket();
  t.m.registerClient(sc as any, t.id, U('c'));
  assert.equal(sc.of('error:notification')[0].payload.code, 'NOT_A_PLAYER');
  assert.equal(sc.readyState, 3);
  assert.equal(sc.of('game:sync').length, 0);
  // and cannot trigger anything
  const before = JSON.stringify(t.get().gameState);
  sc.msg('game:rematch');
  assert.equal(JSON.stringify(t.get().gameState), before);
  assert.equal(t.m.rematchVotes.size, 0);
});

test('LU-1/GR-2: a second socket of the same user never makes the connected player forfeit', async () => {
  const t = room('tic-tac-toe');
  const old = t.socks.a;
  const fresh = new FakeSocket();
  t.m.registerClient(fresh as any, t.id, U('a')); // second tab / reconnect before the old socket was reaped
  await sleep(400); // > grace (120ms) and the old socket's async close event
  const cur = t.get();
  assert.equal(cur.status, 'PLAYING');
  assert.equal(cur.players.find((p: any) => p.userId === 'a')?.isConnected, true);
  assert.equal(t.m.isUserOnline('a'), true);
  assert.equal(t.socks.b.of('game:player_left').length, 0);
  assert.equal(t.socks.b.of('game:player_disconnected').length, 0);
  assert.equal(old.readyState, 3);
});

test('LU-5/GR-15: grace is long by default and a reconnect inside the window cancels the forfeit', async () => {
  const db = new DatabaseService(':memory:');
  const dflt: any = new GameRoomManager(db, { sweep: false });
  managers.push(dflt);
  const r = dflt.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  dflt.joinRoom(r.roomCode, U('b'));
  const sa = new FakeSocket(), sb = new FakeSocket();
  dflt.registerClient(sa as any, r.id, U('a'));
  dflt.registerClient(sb as any, r.id, U('b'));
  sa.drop();
  await sleep(30);
  const dc = sb.of('game:player_disconnected')[0];
  assert.ok(dc.payload.graceSeconds >= 30, `grace ${dc.payload.graceSeconds}s`);

  // short grace: reconnect in time
  const t = room('tic-tac-toe', 2, { grace: 250 });
  t.socks.a.drop();
  await sleep(60);
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U('a'));
  await sleep(400);
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.socks.b.of('game:player_left').length, 0);
});

test('GR-1/LU-2: leaving or disconnecting after the game ended does not rewrite the winner', async () => {
  for (const how of ['leave', 'drop']) {
    const t = room('tic-tac-toe');
    const gs = t.get().gameState;
    gs.winner = 'X'; gs.winnerUserId = 'a'; gs.statusMessage = 'a wins';
    t.db.updateGameRoomState(t.id, gs, 0, 0);
    t.db.updateGameRoomStatus(t.id, 'FINISHED', undefined, new Date().toISOString());
    if (how === 'leave') t.socks.a.msg('game:leave'); else t.socks.a.drop();
    await sleep(350);
    const cur = t.get();
    assert.equal(cur.status, 'FINISHED');
    assert.equal(cur.gameState.winnerUserId, 'a', how);
    assert.equal(cur.gameState.winner, 'X');
    assert.equal(cur.gameState.statusMessage, 'a wins');
    for (const left of t.socks.b.of('game:player_left')) assert.equal(left.payload.isWinner, false);
  }
});

test('LU-17: explicit leave then socket close broadcasts player_left exactly once', async () => {
  const t = room('tic-tac-toe');
  t.socks.a.msg('game:leave');
  t.socks.a.close();
  await sleep(350);
  assert.equal(t.socks.b.of('game:player_left').length, 1);
  assert.equal(t.socks.b.of('game:player_left')[0].payload.winnerUserId, 'b');
  assert.equal(t.get().gameState.winnerUserId, 'b');
});

test('GR-11: both players dropping does not crown anybody', async () => {
  const t = room('tic-tac-toe');
  t.socks.a.drop();
  t.socks.b.drop();
  await sleep(500);
  const cur = t.get();
  assert.equal(cur.status, 'FINISHED');
  assert.ok(!cur.gameState.winnerUserId && !cur.gameState.winner, 'no winner');
});

test('GR-11b: one drops, the other returns later: the absent one forfeits only after his own window', async () => {
  const t = room('tic-tac-toe', 2, { grace: 150 });
  t.socks.a.drop();
  t.socks.b.drop();
  await sleep(60);
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U('b'));
  await sleep(400);
  const cur = t.get();
  assert.equal(cur.status, 'FINISHED');
  assert.equal(cur.gameState.winnerUserId, 'b');
});

test('GR-13: per-room timers: joining another room does not cancel the forfeit in the first', async () => {
  const t = room('tic-tac-toe');
  const other = t.m.createGameRoom({ hostUser: U('x'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  t.socks.a.drop();
  await sleep(20);
  t.m.registerClient(new FakeSocket() as any, other.id, U('a')); // a joins another room (auto-seat)
  await sleep(400);
  const cur = t.get();
  assert.equal(cur.status, 'FINISHED');
  assert.equal(cur.gameState.winnerUserId, 'b');
  // sendToUser reaches the socket of the right room
  const sk = new FakeSocket();
  t.m.registerClient(sk as any, other.id, U('x'));
  assert.equal(t.m.sendToUser('x', { type: 'ping:test', roomId: other.id }), true);
  assert.equal(sk.of('ping:test').length, 1);
});

test('LU-3/GR-14: in a 3 player ludo game a leaver is eliminated and skipped; the game goes on, last one standing wins', () => {
  const t = room('ludo', 3);
  assert.equal(t.get().status, 'PLAYING');
  const gs0 = t.get().gameState;
  assert.equal(gs0.currentTurnSeat, 0);
  t.socks.a.msg('game:leave'); // seat 0 (current turn) leaves
  let cur = t.get();
  assert.equal(cur.status, 'PLAYING');
  assert.ok(cur.gameState.eliminatedSeats.includes(0));
  assert.notEqual(cur.gameState.currentTurnSeat, 0, 'turn moved off the leaver');
  const lp = t.socks.b.of('game:player_left')[0].payload;
  assert.equal(lp.isWinner, false);
  assert.equal(lp.eliminatedSeat, 0);
  assert.equal(t.get().players.find((p: any) => p.userId === 'a')?.status, 'LEFT');
  // a LEFT player cannot act
  t.socks.a.msg('game:roll_dice');
  // reconnecting after leaving a running game is refused
  const sk = new FakeSocket();
  t.m.registerClient(sk as any, t.id, U('a'));
  assert.equal(sk.of('error:notification')[0].payload.code, 'NOT_A_PLAYER');
  // second leaver: last player wins
  t.socks.b.msg('game:leave');
  cur = t.get();
  assert.equal(cur.status, 'FINISHED');
  assert.equal(cur.gameState.winnerUserId, 'c');
});

test('LU-7/GR-16: rematch only after FINISHED, never with a leaver, votes cleared on new game', async () => {
  const t = room('tic-tac-toe');
  // mid-game votes are refused and not recorded
  t.socks.a.msg('game:rematch');
  t.socks.b.msg('game:rematch');
  assert.equal(t.m.rematchVotes.size, 0);
  assert.equal(t.get().gameState.moveCount, 0);
  assert.equal(t.socks.a.of('game:error')[0].payload.code, 'REMATCH_UNAVAILABLE');
  assert.equal(t.socks.a.of('game:rematch_agreed').length, 0);

  // finish the game, one player votes, game restarts through both votes, votes are gone afterwards
  const gs = t.get().gameState;
  gs.winner = 'X'; gs.winnerUserId = 'a';
  t.db.updateGameRoomState(t.id, gs, 0, 0);
  t.db.updateGameRoomStatus(t.id, 'FINISHED', undefined, new Date().toISOString());
  t.socks.a.msg('game:rematch');
  assert.equal(t.socks.b.of('game:rematch_status').at(-1).payload.votedCount, 1);
  t.socks.b.msg('game:rematch');
  await sleep(700);
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.m.rematchVotes.size, 0);
  assert.equal(t.get().gameState.moveCount, 0);

  // after a new game finishes and a player left, the remaining one cannot start a rematch
  const t2 = room('tic-tac-toe');
  const g2 = t2.get().gameState; g2.winner = 'X'; g2.winnerUserId = 'a';
  t2.db.updateGameRoomState(t2.id, g2, 0, 0);
  t2.db.updateGameRoomStatus(t2.id, 'FINISHED', undefined, new Date().toISOString());
  t2.socks.b.msg('game:rematch'); // b votes
  t2.socks.a.msg('game:leave'); // a leaves: votes dropped, b told
  assert.equal(t2.m.rematchVotes.size, 0);
  assert.ok(t2.socks.b.of('game:rematch_declined').length >= 1);
  t2.socks.b.msg('game:rematch');
  assert.equal(t2.socks.b.of('game:error').at(-1).payload.code, 'REMATCH_UNAVAILABLE');
  assert.equal(t2.get().status, 'FINISHED');
});

test('GR-7: host leaves a lobby: host is transferred, empty lobby is cancelled and not matchable', async () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'doodle-duel', maxPlayers: 2 });
  const sa = new FakeSocket(), sb = new FakeSocket();
  m.registerClient(sa as any, r.id, U('a'));
  m.registerClient(sb as any, r.id, U('b'));
  assert.equal(db.getGameRoomById(r.id)!.players.length, 2);
  sa.msg('game:leave');
  let cur = db.getGameRoomById(r.id)!;
  assert.equal(cur.hostUserId, 'b');
  assert.equal(cur.players.length, 1);
  assert.equal(sb.of('game:player_left')[0].payload.hostUserId, 'b');
  sb.drop();
  await sleep(300);
  cur = db.getGameRoomById(r.id)!;
  assert.equal(cur.status, 'CANCELLED');
  assert.equal(db.findOpenWaitingGameRoom('doodle-duel', 2, 'zzz'), null);
});

test('GR-12b: sweep releases a REST seat that never connected and cancels the empty lobby', () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  m.sweepStaleRooms(Date.now() + 3 * 60_000);
  assert.equal(db.getGameRoomById(r.id)!.status, 'CANCELLED');
});

test('GR-8: tambola rooms for 5-20 players can be created and joined', () => {
  const { db, m } = mk();
  for (const n of [5, 10, 20]) {
    const r = m.createGameRoom({ hostUser: U('h' + n), gameType: 'tambola', maxPlayers: n });
    for (let i = 0; i < n - 1; i++) m.joinRoom(r.roomCode, U(`p${n}_${i}`));
    const cur = db.getGameRoomById(r.id)!;
    assert.equal(cur.players.length, n);
    assert.ok(cur.players.every((p: any) => typeof p.color === 'string' && p.color));
  }
  assert.equal(seatColorsFor('tambola', 7).length, 7);
});

test('GR-9: reaction must be a short emoji string; objects / markup / long strings are not relayed', () => {
  const t = room('tic-tac-toe');
  const before = t.socks.b.of('game:reaction_broadcast').length;
  for (const bad of [{ x: 1 }, ['a'], 5, '<img src=x onerror=1>', 'x'.repeat(100), '', null]) {
    t.socks.a.msg('game:reaction', { emoji: bad });
  }
  assert.equal(t.socks.b.of('game:reaction_broadcast').length, before);
  assert.equal(t.socks.a.of('game:error').at(-1).payload.code, 'INVALID_REACTION');
  t.socks.a.msg('game:reaction', { emoji: '❤️' });
  t.socks.a.msg('game:reaction', { emoji: '\u{1F602}' });
  assert.equal(t.socks.b.of('game:reaction_broadcast').length, before + 2);
});

test('GR-24: rule errors reach the acting socket as game:error', () => {
  const t = room('tic-tac-toe');
  t.socks.b.msg('game:roll_dice'); // wrong game for this room
  const e = t.socks.b.of('game:error').at(-1);
  assert.ok(e && e.payload.code && e.payload.message);
});

test('GR-4: doodle secret word is not sent to the guesser (reconnect broadcast, sync); drawer still sees it', () => {
  const t = room('doodle-duel');
  t.m.startGame(t.get()); // doodle is lobby based: the host starts it
  const SECRET = 'Zyxwvutsrq';
  const gs = t.get().gameState;
  gs.phase = 'DRAWING'; gs.drawerUserId = 'a'; gs.secretWord = SECRET; gs.wordChoices = [SECRET];
  t.db.updateGameRoomState(t.id, gs);
  t.socks.b.sent.length = 0; t.socks.a.sent.length = 0;
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U('a')); // drawer reconnects
  assert.ok(!JSON.stringify(t.socks.b.sent).includes(SECRET), 'guesser got the secret word');
  assert.ok(JSON.stringify(again.sent).includes(SECRET), 'drawer lost the word');
  // projection helper (REST path)
  const view = t.m.projectRoomFor(t.get(), 'b');
  assert.ok(!JSON.stringify(view).includes(SECRET));
});

test('GR-4b: bingo boards of the opponent are never broadcast raw', () => {
  const t = room('bingo');
  const gs = t.get().gameState;
  assert.ok(gs.boards.a && gs.boards.b);
  t.socks.a.sent.length = 0; t.socks.b.sent.length = 0;
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U('a'));
  for (const msg of t.socks.b.sent) {
    const st = msg.payload?.gameState ?? msg.payload?.room?.gameState;
    if (st?.boards) assert.ok(!st.boards.a, `${msg.type} leaks a's board to b`);
  }
  const view = t.m.projectRoomFor(t.get(), 'b');
  assert.ok(!view.gameState.boards.a);
});

test('GR-10: lobby config written on a room object survives later reads and is used by startGame', () => {
  const { db, m } = mk();
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'chess', maxPlayers: 2 });
  const lobby = db.getGameRoomById(r.id)!;
  (lobby as any).chessConfig = { baseTimeMs: 61_000 };
  assert.deepEqual((db.getGameRoomById(r.id) as any).chessConfig, { baseTimeMs: 61_000 });
  assert.deepEqual((db.getGameRoomByCode(r.roomCode) as any).chessConfig, { baseTimeMs: 61_000 });
  assert.ok(!JSON.stringify(db.getGameRoomById(r.id)).includes('chessConfig'), 'not leaked into payloads');
});

test('GR-32: game type resolution is exact; unknown types are not Ludo', () => {
  assert.equal(parseGameType('tic-tac-toe'), 'tic-tac-toe');
  assert.equal(parseGameType('Doodle'), 'doodle-duel');
  assert.equal(parseGameType('tictactoe'), 'tic-tac-toe');
  assert.equal(parseGameType('definitely-not-a-game'), null);
  assert.equal(parseGameType('radical'), null); // no substring matching ("tic" in "...tic...")
  const { m } = mk();
  assert.match(m.generateRoomCode('chess'), /^CHESS-/);
  assert.match(m.generateRoomCode('tic-tac-toe'), /^TIC-/);
});
