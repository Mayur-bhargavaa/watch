import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

// Manager level tests of Tournament Arena with fake sockets: the tournament room, the REAL match rooms it creates, the finished-room hook
// (a real tic-tac-toe match is played through the real handlers), forfeits, no-shows, host actions, rematch refusal, restart, and the proof
// that normal games without a tournament are unaffected by the hook.

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const T0 = 1_700_000_000_000;

class FakeSocket {
  readyState = 1;
  sent: any[] = [];
  private handlers: Record<string, Array<(...a: any[]) => void>> = {};
  send(d: string) { this.sent.push(JSON.parse(d)); }
  on(ev: string, fn: (...a: any[]) => void) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev: string, ...a: any[]) { for (const h of this.handlers[ev] || []) h(...a); }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    setImmediate(() => this.emit('close'));
  }
  msg(type: string, payload?: any) { this.emit('message', JSON.stringify({ type, payload })); }
  of(type: string) { return this.sent.filter((m) => m.type === type); }
  errors() { return this.of('game:error').map((m) => m.payload.code); }
  view(): any {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const p = this.sent[i].payload;
      if (p?.gameState?.game === 'tournament') return p.gameState;
      if (p?.room?.gameState?.game === 'tournament') return p.room.gameState;
    }
    return null;
  }
  text() { return JSON.stringify(this.sent); }
}

const flush = () => new Promise<void>((r) => setImmediate(r));
const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

interface Opts { n?: number; clock?: { t: number }; db?: DatabaseService; game?: string }

/** Organiser `h` + n players p1..pn, everybody connected to the tournament room, in the lobby. */
function arena(opts: Opts = {}) {
  const n = opts.n ?? 4;
  const db = opts.db ?? new DatabaseService(':memory:');
  const clock = opts.clock ?? { t: T0 };
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false, clock: () => clock.t, rng: () => 0.5 });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const notices: Array<{ uid: string; notice: any }> = [];
  m.setTournamentNotifier((uid: string, notice: any) => notices.push({ uid, notice }));
  const r = m.createGameRoom({ hostUser: U('h'), gameType: 'tournament', maxPlayers: 33 });
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  for (const id of ids) m.joinRoom(r.roomCode, U(id));
  const host = new FakeSocket();
  m.registerClient(host as any, r.id, U('h'));
  const socks: Record<string, FakeSocket> = {};
  for (const id of ids) { socks[id] = new FakeSocket(); m.registerClient(socks[id] as any, r.id, U(id)); }
  const get = () => db.getGameRoomById(r.id)!;
  const state = (): any => get().gameState;
  const matchOf = (id: string) => state().matches.find((x: any) => x.id === id);
  const roomOf = (matchId: string) => db.getGameRoomById(matchOf(matchId).roomId)!;
  /** Both players of a match open its room (as the web page does); returns their sockets. */
  const open = (matchId: string, who: string[] = [matchOf(matchId).a, matchOf(matchId).b]) => {
    const room = roomOf(matchId);
    const out: Record<string, FakeSocket> = {};
    for (const uid of who) { out[uid] = new FakeSocket(); m.registerClient(out[uid] as any, room.id, U(uid)); }
    return out;
  };
  /** Plays a tic-tac-toe game in the match room so that `winner` wins (or draws when winner is null). */
  const playTtt = (matchId: string, ms: Record<string, FakeSocket>, winner: string | null) => {
    const room = roomOf(matchId);
    assert.equal(room.status, 'PLAYING', `match ${matchId} room started: ${JSON.stringify(Object.values(ms).map((s) => s.errors()))}`);
    const [x, o] = [...room.players].sort((a, b) => a.seat - b.seat).map((p) => p.userId);
    const xWins = [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]] as const;
    const oWins = [[x, 0], [o, 3], [x, 1], [o, 4], [x, 8], [o, 5]] as const;
    const draw = [[x, 0], [o, 1], [x, 2], [o, 4], [x, 3], [o, 5], [x, 7], [o, 6], [x, 8]] as const;
    const seq = winner === null ? draw : winner === x ? xWins : oWins;
    for (const [uid, cell] of seq) ms[uid].msg('game:tictactoe_move', { cellIndex: cell });
  };
  /** The whole life of a match: open, play, wait for the hook. */
  const playMatch = async (matchId: string, winner: string | null) => {
    const ms = open(matchId);
    playTtt(matchId, ms, winner);
    await flush();
    return ms;
  };
  const setClock = (t: number) => { clock.t = t; };
  return { db, m, id: r.id as string, code: r.roomCode as string, ids, host, socks, get, state, matchOf, roomOf, open, playTtt, playMatch, notices, clock, setClock };
}

/** An arena whose tournament has started (4 players: u1..u4 seeded p1..p4). */
function running(n = 4, opts: Opts = {}) {
  const t = arena({ ...opts, n });
  t.host.msg('tournament:start');
  assert.equal(t.get().status, 'PLAYING', t.host.errors().join());
  return t;
}

// ---------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------

test('TOURNAMENT manager: a room is a lobby for 4 to 32 players plus the organiser, ARENA- code, organiser is not a player', () => {
  const t = arena();
  assert.ok(/^ARENA-/.test(t.code), t.code);
  assert.equal(t.get().gameType, 'tournament');
  assert.equal(t.get().maxPlayers, 33);
  assert.equal(t.get().minPlayers, 5, 'the organiser plus 4 players');
  assert.equal(t.get().status, 'WAITING');
  assert.equal(t.state().phase, 'REGISTRATION');
  assert.equal(t.get().hostUserId, 'h');
  assert.equal(t.get().tournamentId, undefined, 'a tournament room is not a match room');
  assert.equal(t.socks.p1.view().me.role, 'player');
  assert.equal(t.host.view().me.role, 'host');
});

test('TOURNAMENT manager: only the organiser configures, shuffles, kicks and starts', () => {
  const t = arena();
  const p = t.socks.p1;
  p.msg('tournament:config', { game: 'chess' });
  p.msg('tournament:shuffle');
  p.msg('tournament:kick', { userId: 'p2' });
  p.msg('tournament:start');
  p.msg('tournament:advance', { matchId: 'R1M1', userId: 'p1' });
  p.msg('tournament:end');
  assert.deepEqual(p.errors(), ['HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY']);
  assert.equal(t.state().config.game, 'tic-tac-toe');
  assert.equal(t.get().status, 'WAITING');
  t.host.msg('tournament:config', { game: 'chess', thirdPlace: true, finalBestOf: 3 });
  assert.deepEqual(t.state().config, { game: 'chess', thirdPlace: true, finalBestOf: 3 });
  assert.deepEqual(t.socks.p2.view().config, { game: 'chess', thirdPlace: true, finalBestOf: 3 }, 'everybody sees the settings');
});

test('TOURNAMENT manager: settings are validated (zod) and rate limited', () => {
  const t = arena();
  for (const bad of [{ game: 'ludo' }, { game: 'bingo' }, { finalBestOf: 2 }, { thirdPlace: 'yes' }, {}, { game: 'chess', admin: true }, null, 'x']) {
    t.host.msg('tournament:config', bad);
  }
  assert.ok(t.host.errors().every((c) => c === 'INVALID_INPUT' || c === 'RATE_LIMITED'), t.host.errors().join());
  assert.equal(t.state().config.game, 'tic-tac-toe');
  for (let i = 0; i < 12; i++) t.host.msg('tournament:config', { thirdPlace: i % 2 === 0 });
  assert.ok(t.host.errors().includes('RATE_LIMITED'), 'host settings are limited');
});

test('TOURNAMENT manager: shuffle changes the seed order with the injected random source and everybody sees it', () => {
  const t = arena({ n: 5 });
  assert.deepEqual(t.state().seedOrder, []);
  t.host.msg('tournament:shuffle');
  assert.equal(t.state().seedOrder.length, 5);
  assert.deepEqual([...t.state().seedOrder].sort(), ['p1', 'p2', 'p3', 'p4', 'p5']);
  assert.deepEqual(t.socks.p3.view().seedOrder, t.state().seedOrder);
  t.host.msg('tournament:start');
  assert.equal(t.get().status, 'PLAYING');
  assert.deepEqual(t.state().players.map((p: any) => p.userId), t.state().seedOrder, 'the shuffled order is the seeding');
  t.host.msg('tournament:shuffle');
  assert.ok(t.host.errors().includes('WRONG_PHASE'), 'no shuffle after the start');
});

test('TOURNAMENT manager: start needs 4 connected players; the organiser is not counted', () => {
  const t = arena({ n: 3 });
  t.host.msg('tournament:start');
  assert.deepEqual(t.host.errors(), ['INVALID_INPUT']);
  assert.equal(t.get().status, 'WAITING');
  const late = new FakeSocket();
  t.m.joinRoom(t.code, U('p4')); // a REST seat with no socket yet
  t.host.msg('tournament:start');
  assert.equal(t.host.errors().length, 2);
  assert.match(t.host.of('game:error')[1].payload.message, /P4 is not connected/);
  t.m.registerClient(late as any, t.id, U('p4'));
  t.host.msg('tournament:start');
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.state().players.length, 4);
  t.host.msg('tournament:start');
  assert.ok(t.host.errors().includes('ILLEGAL_MOVE'), 'start twice is refused');
});

test('TOURNAMENT manager: kick removes a player, who cannot join again (REST or socket)', async () => {
  const t = arena({ n: 5 });
  t.host.msg('tournament:kick', { userId: 'p2' });
  assert.equal(t.get().players.some((p) => p.userId === 'p2'), false);
  assert.equal(t.socks.p2.of('tournament:kicked').length, 1);
  assert.throws(() => t.m.joinRoom(t.code, U('p2')), /removed you/);
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U('p2'));
  assert.equal(again.of('error:notification')[0]?.payload.code, 'KICKED');
  assert.equal(t.get().players.some((p) => p.userId === 'p2'), false);
  t.host.msg('tournament:kick', { userId: 'h' });
  t.host.msg('tournament:kick', { userId: 'nobody' });
  t.host.msg('tournament:kick', {});
  assert.deepEqual(t.host.errors(), ['INVALID_INPUT', 'INVALID_INPUT', 'INVALID_INPUT']);
  const text = t.socks.p3.text();
  assert.ok(!text.includes('"kicked"'), 'the kick list never reaches a client');
  t.host.msg('tournament:start');
  assert.equal(t.state().players.length, 4);
  assert.ok(!t.state().players.some((p: any) => p.userId === 'p2'));
  t.host.msg('tournament:kick', { userId: 'p3' });
  assert.ok(t.host.errors().includes('WRONG_PHASE'), 'no kick after the start');
});

test('TOURNAMENT manager: a player cannot join twice, and nobody can join after the start', () => {
  const t = arena();
  const before = t.get().players.length;
  t.m.joinRoom(t.code, U('p1')); // already seated: the same seat
  assert.equal(t.get().players.length, before);
  t.host.msg('tournament:start');
  assert.throws(() => t.m.joinRoom(t.code, U('late')), /already started/);
  const lateSock = new FakeSocket();
  t.m.registerClient(lateSock as any, t.id, U('late'));
  assert.equal(lateSock.of('error:notification')[0]?.payload.code, 'NOT_A_PLAYER');
  assert.equal(t.get().players.some((p) => p.userId === 'late'), false);
});

test('TOURNAMENT manager: joins are rate limited per user (8 a minute)', () => {
  const t = arena({ n: 1 });
  let joined = 0;
  let refused = 0;
  for (let i = 0; i < 12; i++) {
    try {
      t.m.joinRoom(t.code, U('spam'));
      t.db.removePlayerFromGameRoom(t.id, 'spam'); // leaves again
      joined += 1;
    } catch (e: any) {
      assert.match(String(e.message), /Too many attempts/);
      refused += 1;
    }
  }
  assert.equal(joined, 8);
  assert.equal(refused, 4);
});

// ---------------------------------------------------------------------
// Start: real match rooms
// ---------------------------------------------------------------------

test('TOURNAMENT manager: the start creates a REAL private game room per first-round match with exactly the two players seated', () => {
  const t = running(4);
  const s = t.state();
  assert.equal(s.phase, 'RUNNING');
  assert.equal(s.matches.length, 3);
  for (const id of ['R1M1', 'R1M2']) {
    const match = t.matchOf(id);
    assert.equal(match.status, 'PENDING_PLAYERS');
    const room = t.roomOf(id);
    assert.equal(room.gameType, 'tic-tac-toe');
    assert.equal(room.status, 'WAITING');
    assert.equal(room.isPrivate, true);
    assert.equal(room.maxPlayers, 2);
    assert.equal(room.tournamentId, t.id);
    assert.equal(room.tournamentCode, t.code);
    assert.deepEqual(room.players.map((p) => p.userId).sort(), [match.a, match.b].sort(), 'exactly the two players, pre-seated');
    assert.ok(/^TIC-/.test(room.roomCode));
    assert.equal(match.joinDeadline, T0 + 120_000);
  }
  assert.equal(t.matchOf('R2M1').status, 'SCHEDULED');
  assert.equal(t.matchOf('R2M1').roomId, null);
  // the seat of the higher seed is seat 0 (X, first move)
  assert.equal(t.roomOf('R1M1').players.find((p) => p.seat === 0)?.userId, 'p1');
  // both players are told: WS message to the tournament room + an in-app notification
  const ready = t.socks.p1.of('tournament:match_ready');
  assert.equal(ready.length, 1);
  assert.equal(ready[0].payload.roomCode, t.matchOf('R1M1').roomCode);
  assert.equal(ready[0].payload.opponent.userId, 'p4');
  assert.equal(ready[0].payload.game, 'tic-tac-toe');
  assert.equal(t.socks.p4.of('tournament:match_ready').length, 1);
  assert.equal(t.socks.p2.of('tournament:match_ready')[0].payload.matchId, 'R1M2');
  assert.equal(t.host.of('tournament:match_ready').length, 0, 'the organiser is not a player');
  assert.equal(t.notices.length, 4);
  assert.deepEqual(t.notices.map((x) => x.uid).sort(), ['p1', 'p2', 'p3', 'p4']);
  assert.ok(t.notices.every((x) => /Open it within 120 seconds/.test(x.notice.body) && x.notice.gameType === 'tic-tac-toe'));
  // nothing else is created
  assert.equal(t.db.getGameRoomByCode(t.code)!.id, t.id);
});

test('TOURNAMENT manager: match rooms cannot be joined or watched by non-participants; seats are never freed', () => {
  const t = running(4);
  const room = t.roomOf('R1M1');
  // a player of ANOTHER match, an outsider and the organiser
  for (const intruder of ['p2', 'h', 'stranger']) {
    assert.throws(() => t.m.joinRoom(room.roomCode, U(intruder)), /reserved for the two players/, intruder);
    const sock = new FakeSocket();
    t.m.registerClient(sock as any, room.id, U(intruder));
    assert.equal(sock.of('error:notification')[0]?.payload.code, 'NOT_A_PLAYER', intruder);
    assert.equal(sock.of('game:sync').length, 0, 'no state is sent to a non-participant');
  }
  // spectating needs the friend rule: without it the socket is refused
  const spec = new FakeSocket();
  t.m.registerClient(spec as any, room.id, U('stranger'), { spectate: true, canSpectate: false });
  assert.equal(spec.of('error:notification')[0]?.payload.code, 'NOT_A_PLAYER');
  assert.deepEqual(t.db.getGameRoomById(room.id)!.players.map((p) => p.userId).sort(), ['p1', 'p4']);
  // a participant who disconnects keeps the seat (the 120 s rule decides, not a freed seat)
  const s1 = new FakeSocket();
  t.m.registerClient(s1 as any, room.id, U('p1'));
  s1.close();
  return flush().then(() => new Promise<void>((r) => setTimeout(r, 400))).then(() => {
    assert.deepEqual(t.db.getGameRoomById(room.id)!.players.map((p) => p.userId).sort(), ['p1', 'p4']);
    assert.equal(t.db.getGameRoomById(room.id)!.status, 'WAITING');
    assert.throws(() => t.m.joinRoom(room.roomCode, U('stranger')), /reserved/);
  });
});

test('TOURNAMENT manager: the REST matchmaking / partner lookups never return a tournament match room', () => {
  const t = running(4);
  assert.equal(t.db.findUserWaitingGameRoom('p1'), null, 'p1 only has a tournament match room open');
  assert.equal(t.db.findOpenWaitingGameRoom('tic-tac-toe', 2), null);
  const normal = t.m.createGameRoom({ hostUser: U('p1'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  assert.equal(t.db.findUserWaitingGameRoom('p1')?.id, normal.id, 'a normal waiting room is found as before');
});

// ---------------------------------------------------------------------
// The finished-room hook: a real match drives the bracket
// ---------------------------------------------------------------------

test('TOURNAMENT hook: a real tic-tac-toe match is played through the real handlers and its winner advances', async () => {
  const t = running(4);
  const ms = t.open('R1M1');
  assert.equal(t.roomOf('R1M1').status, 'PLAYING', 'both players opened the room: the game started by itself');
  assert.equal(t.matchOf('R1M1').status, 'LIVE');
  assert.deepEqual(t.matchOf('R1M1').joined.sort(), ['p1', 'p4']);
  t.playTtt('R1M1', ms, 'p4'); // the lower seed wins
  await flush();
  const match = t.matchOf('R1M1');
  assert.equal(match.status, 'DONE');
  assert.equal(match.winnerUserId, 'p4');
  assert.equal(match.reason, 'played');
  assert.equal(t.roomOf('R1M1').status, 'FINISHED');
  assert.equal(t.roomOf('R1M1').gameState.winnerUserId, 'p4', 'the result is the room state winner');
  assert.equal(t.matchOf('R2M1').a, 'p4');
  assert.equal(t.state().players.find((p: any) => p.userId === 'p1').eliminated, true);
  assert.equal(t.socks.p3.view().matches.find((x: any) => x.id === 'R1M1').winnerUserId, 'p4', 'everybody sees the result');
});

test('TOURNAMENT hook: the whole 4-player tournament, final included, ends with a champion, standings and a finished room', async () => {
  const t = running(4);
  await t.playMatch('R1M1', 'p1');
  assert.equal(t.matchOf('R2M1').status, 'SCHEDULED', 'the final waits for the other semi-final');
  await t.playMatch('R1M2', 'p3');
  const final = t.matchOf('R2M1');
  assert.equal(final.status, 'PENDING_PLAYERS');
  assert.deepEqual([final.a, final.b].sort(), ['p1', 'p3']);
  const room = t.roomOf('R2M1');
  assert.equal(room.tournamentId, t.id);
  assert.equal(t.socks.p3.of('tournament:match_ready').length, 2, 'p3 is told about the final too');
  await t.playMatch('R2M1', 'p3');
  assert.equal(t.state().phase, 'COMPLETE');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.state().championUserId, 'p3');
  assert.equal(t.state().runnerUpUserId, 'p1');
  const view = t.socks.p2.view();
  assert.equal(view.phase, 'COMPLETE');
  assert.equal(view.standings.championUserId, 'p3');
  assert.deepEqual(view.standings.rows.map((r: any) => r.rank), [1, 2, 3, 3]);
  assert.equal(t.host.view().standings.rows[0].label, 'Champion');
  assert.equal(t.socks.p1.of('tournament:state').at(-1).payload.roomStatus, 'FINISHED');
});

test('TOURNAMENT hook: a draw is replayed in a NEW room (sides swapped); the higher seed advances after the extra games', async () => {
  const t = running(4);
  const firstRoom = t.matchOf('R1M1').roomId;
  const ms = t.open('R1M1');
  t.playTtt('R1M1', ms, null);
  await flush();
  let match = t.matchOf('R1M1');
  assert.equal(t.db.getGameRoomById(firstRoom)!.status, 'FINISHED');
  assert.equal(match.status, 'PENDING_PLAYERS');
  assert.equal(match.draws, 1);
  assert.equal(match.gameNo, 2, 'a new game room was created');
  assert.notEqual(match.roomId, firstRoom);
  assert.equal(t.roomOf('R1M1').players.find((p) => p.seat === 0)?.userId, 'p4', 'the sides swapped');
  const ms2 = t.open('R1M1');
  t.playTtt('R1M1', ms2, null);
  await flush();
  const ms3 = t.open('R1M1');
  t.playTtt('R1M1', ms3, null);
  await flush();
  match = t.matchOf('R1M1');
  assert.equal(match.status, 'DONE');
  assert.equal(match.winnerUserId, 'p1', 'three draws: the higher seed advances');
  assert.equal(match.reason, 'draw_tiebreak');
  assert.equal(match.games.length, 3);
});

test('TOURNAMENT hook: a player who leaves the match room mid-game loses it by forfeit and the opponent advances', async () => {
  const t = running(4);
  const ms = t.open('R1M2');
  ms.p3.msg('game:leave');
  await flush();
  const match = t.matchOf('R1M2');
  assert.equal(t.roomOf('R1M2').status, 'FINISHED');
  assert.equal(match.status, 'DONE');
  assert.equal(match.winnerUserId, 'p2', 'p3 left: the other player wins by forfeit, and the hook reports it');
  assert.equal(match.reason, 'played');
});

test('TOURNAMENT hook: leaving a match room that has not started forfeits the match; a plain disconnect does not', async () => {
  const t = running(4);
  const one = t.open('R1M1', ['p1']);
  one.p1.close();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(t.matchOf('R1M1').status, 'PENDING_PLAYERS', 'a disconnect keeps the match');
  const again = t.open('R1M1', ['p1']);
  again.p1.msg('game:leave');
  await flush();
  assert.equal(t.roomOf('R1M1').status, 'CANCELLED');
  assert.equal(t.matchOf('R1M1').status, 'DONE');
  assert.equal(t.matchOf('R1M1').winnerUserId, 'p4', 'the player who left forfeits');
  assert.equal(t.matchOf('R1M1').reason, 'played');
});

test('TOURNAMENT hook: a room that ends with nobody winning (everybody gone) is a draw: replayed in a new room', async () => {
  const t = running(4);
  const ms = t.open('R1M1');
  ms.p1.close();
  ms.p4.close();
  await new Promise((r) => setTimeout(r, 600));
  const match = t.matchOf('R1M1');
  assert.equal(match.draws, 1, 'abandoned by both: no winner');
  assert.equal(match.status, 'PENDING_PLAYERS');
  assert.equal(match.gameNo, 2);
});

test('TOURNAMENT hook: only a seated engine winner counts; results never come from messages', async () => {
  const t = running(4);
  const ms = t.open('R1M1');
  const sockets = [ms.p1, ms.p4, t.socks.p1, t.socks.p2, t.host];
  for (const s of sockets) {
    s.msg('tournament:report', { matchId: 'R1M1', winnerUserId: 'p4' });
    s.msg('tournament:result', { matchId: 'R1M1', winnerUserId: 'p4' });
    s.msg('tournament:set_winner', { roomId: t.matchOf('R1M1').roomId, winnerUserId: 'p4' });
  }
  await flush();
  assert.equal(t.matchOf('R1M1').status, 'LIVE');
  assert.equal(t.matchOf('R1M1').winnerUserId, null);
  assert.ok(t.socks.p1.errors().filter((c) => c === 'INVALID_INPUT').length >= 3);
  // a fake finished-room event for a room that is not watched is ignored, so is one for a loser's claim
  const gp = JSON.stringify(t.state());
  (t.m as any).dispatchRoomFinished('not-a-room', 'FINISHED');
  assert.equal(JSON.stringify(t.state()), gp);
});

// ---------------------------------------------------------------------
// Rematch and restarts of a match room
// ---------------------------------------------------------------------

test('TOURNAMENT match rooms refuse rematch, host restart and chess settings', async () => {
  const t = running(4);
  const ms = await t.playMatch('R1M1', 'p1');
  assert.equal(t.roomOf('R1M1').status, 'FINISHED');
  ms.p1.msg('game:rematch');
  ms.p4.msg('game:rematch');
  assert.deepEqual(ms.p1.errors(), ['REMATCH_UNAVAILABLE']);
  assert.deepEqual(ms.p4.errors(), ['REMATCH_UNAVAILABLE']);
  assert.match(ms.p1.of('game:error')[0].payload.message, /tournament match/);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(t.roomOf('R1M1').status, 'FINISHED', 'no new game started in the finished match room');
  assert.equal(ms.p1.of('game:rematch_status').length, 0);
  assert.equal(t.matchOf('R1M1').gameNo, 1);
  // the same for a chess match room
  const chess = arena({ n: 4 });
  chess.host.msg('tournament:config', { game: 'chess' });
  chess.host.msg('tournament:start');
  assert.equal(chess.state().config.game, 'chess');
  const room = chess.roomOf('R1M1');
  assert.equal(room.gameType, 'chess');
  assert.ok(/^CHESS-/.test(room.roomCode));
  const cs = chess.open('R1M1');
  assert.equal(chess.roomOf('R1M1').status, 'PLAYING', 'chess starts by itself when both players are in');
  const hostSock = cs[chess.roomOf('R1M1').hostUserId];
  hostSock.msg('chess:start', {});
  hostSock.msg('chess:config_update', { config: { timeControl: 'bullet' } });
  assert.deepEqual(hostSock.errors(), ['ILLEGAL_MOVE', 'ILLEGAL_MOVE']);
});

test('TOURNAMENT game choices: four in a row also runs as a match room', () => {
  const t = arena({ n: 4 });
  t.host.msg('tournament:config', { game: 'four-in-a-row' });
  t.host.msg('tournament:start');
  const room = t.roomOf('R1M1');
  assert.equal(room.gameType, 'four-in-a-row');
  assert.ok(/^FOUR-/.test(room.roomCode));
  assert.equal(room.tournamentId, t.id);
});

// ---------------------------------------------------------------------
// No-shows, host advance, leaving, aborting (fake clock)
// ---------------------------------------------------------------------

test('TOURNAMENT no-show: the player who never opened the match room forfeits after 120 s; the unused room is closed', async () => {
  const t = running(4);
  t.open('R1M1', ['p1']); // p4 never comes
  t.setClock(T0 + 119_000);
  t.m.tickTournament(t.id);
  assert.equal(t.matchOf('R1M1').status, 'PENDING_PLAYERS');
  t.setClock(T0 + 121_000);
  t.m.tickTournament(t.id);
  await flush();
  const match = t.matchOf('R1M1');
  assert.equal(match.status, 'DONE');
  assert.equal(match.winnerUserId, 'p1');
  assert.equal(match.reason, 'no_show');
  assert.equal(t.roomOf('R1M1').status, 'CANCELLED');
  assert.ok(t.state().log.some((l: any) => l.kind === 'forfeit' && /P4 did not show up/.test(l.text)));
  // the other match (nobody came) is in the host window
  assert.notEqual(t.matchOf('R1M2').doubleNoShowAt, null);
  assert.equal(t.matchOf('R1M2').status, 'PENDING_PLAYERS');
});

test('TOURNAMENT no-show: both absent: the host may pick, else the higher seed advances after the window; late arrivals do not count', async () => {
  const t = running(4);
  t.setClock(T0 + 121_000);
  t.m.tickTournament(t.id);
  assert.notEqual(t.matchOf('R1M2').doubleNoShowAt, null);
  // the host picks the lower seed in match 2
  t.host.msg('tournament:advance', { matchId: 'R1M2', userId: 'p3' });
  assert.deepEqual(t.host.errors(), []);
  assert.equal(t.matchOf('R1M2').winnerUserId, 'p3');
  assert.equal(t.matchOf('R1M2').reason, 'host_advance');
  assert.equal(t.roomOf('R1M2').status, 'CANCELLED');
  assert.ok(t.state().log.some((l: any) => l.kind === 'host' && /nobody showed up/.test(l.text)), 'public log');
  // match 1: nobody decides, the window runs out
  t.setClock(T0 + 121_000 + 61_000);
  t.m.tickTournament(t.id);
  assert.equal(t.matchOf('R1M1').winnerUserId, 'p1');
  assert.equal(t.matchOf('R1M1').reason, 'double_no_show');
  // the final is now ready between the two advanced players
  assert.deepEqual([t.matchOf('R2M1').a, t.matchOf('R2M1').b].sort(), ['p1', 'p3']);
  assert.equal(t.matchOf('R2M1').status, 'PENDING_PLAYERS');
});

test('TOURNAMENT host advance: refused for a normal running match, allowed only after 10 minutes (stuck); players can never advance', async () => {
  const t = running(4);
  const ms = t.open('R1M1');
  assert.equal(t.matchOf('R1M1').status, 'LIVE');
  t.host.msg('tournament:advance', { matchId: 'R1M1', userId: 'p1' });
  assert.deepEqual(t.host.errors(), ['ILLEGAL_MOVE'], 'not stuck yet');
  t.socks.p1.msg('tournament:advance', { matchId: 'R1M1', userId: 'p1' });
  t.socks.p2.msg('tournament:advance', { matchId: 'R1M1', userId: 'p4' });
  ms.p1.msg('tournament:advance', { matchId: 'R1M1', userId: 'p1' }); // even from inside the match room
  assert.deepEqual(t.socks.p1.errors(), ['HOST_ONLY']);
  assert.deepEqual(t.socks.p2.errors(), ['HOST_ONLY']);
  assert.deepEqual(ms.p1.errors(), ['WRONG_GAME']);
  assert.equal(t.matchOf('R1M1').status, 'LIVE');
  t.setClock(T0 + 10 * 60_000 + 1);
  t.host.msg('tournament:advance', { matchId: 'R1M1', userId: 'p4' });
  assert.equal(t.host.errors().length, 1);
  await flush();
  assert.equal(t.matchOf('R1M1').winnerUserId, 'p4');
  assert.equal(t.matchOf('R1M1').reason, 'host_advance');
  const room = t.roomOf('R1M1');
  assert.equal(room.status, 'FINISHED');
  assert.equal(room.gameState.winnerUserId, 'p4', 'the live room shows the decided winner');
  assert.equal(ms.p4.of('game:player_left').length, 1);
  assert.equal(ms.p4.of('game:player_left')[0].payload.winnerUserId, 'p4');
  assert.equal(ms.p1.of('tournament:match_closed').length, 1);
  assert.equal(t.matchOf('R2M1').a, 'p4');
  // a bad payload
  t.host.msg('tournament:advance', { matchId: 'R1M1' });
  t.host.msg('tournament:advance', { matchId: 'R1M2', userId: 'p1' });
  assert.ok(t.host.errors().includes('INVALID_INPUT'));
});

test('TOURNAMENT leave: a player who leaves the tournament forfeits the current match room and every later match', async () => {
  const t = running(4);
  const ms = t.open('R1M2'); // p2 vs p3 live
  assert.equal(t.matchOf('R1M2').status, 'LIVE');
  t.socks.p2.msg('game:leave'); // leaves the TOURNAMENT room (the match room socket stays open)
  await flush();
  const match = t.matchOf('R1M2');
  assert.equal(match.status, 'DONE');
  assert.equal(match.winnerUserId, 'p3');
  assert.equal(match.reason, 'forfeit');
  assert.equal(t.roomOf('R1M2').status, 'FINISHED');
  assert.equal(t.roomOf('R1M2').gameState.winnerUserId, 'p3', 'the room tells the page that p3 wins');
  assert.equal(ms.p3.of('game:player_left').at(-1).payload.winnerUserId, 'p3');
  assert.equal(t.state().players.find((p: any) => p.userId === 'p2').left, true);
  assert.equal(t.state().phase, 'RUNNING');
  // future matches: p3 plays on; if p3 leaves too, the finalist from the other semi gets a walkover
  await t.playMatch('R1M1', 'p1');
  assert.equal(t.matchOf('R2M1').status, 'PENDING_PLAYERS');
  t.socks.p3.msg('game:leave');
  await flush();
  assert.equal(t.matchOf('R2M1').winnerUserId, 'p1');
  assert.equal(t.state().phase, 'COMPLETE');
  assert.equal(t.state().championUserId, 'p1');
});

test('TOURNAMENT leave: a disconnect from the tournament page is NOT a departure (players leave it to play their match)', async () => {
  const t = running(4);
  t.socks.p1.close();
  t.socks.p2.close();
  await new Promise((r) => setTimeout(r, 500)); // longer than the 150 ms grace
  assert.equal(t.state().players.find((p: any) => p.userId === 'p1').left, false);
  assert.equal(t.state().players.find((p: any) => p.userId === 'p1').connected, false);
  assert.equal(t.state().phase, 'RUNNING');
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U('p1'));
  assert.equal(t.state().players.find((p: any) => p.userId === 'p1').connected, true);
  assert.equal(back.view().me.activeMatchId, 'R1M1');
});

test('TOURNAMENT abort: the organiser leaving ends the tournament and closes every open match room; ending it too', async () => {
  const t = running(4);
  t.open('R1M1'); // live
  t.host.msg('game:leave');
  await flush();
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.roomOf('R1M1').status, 'FINISHED');
  assert.equal(t.roomOf('R1M2').status, 'CANCELLED');
  assert.equal(t.socks.p2.view().phase, 'ABORTED');
  assert.match(t.socks.p2.view().statusMessage, /organiser left/);
  // ended by the organiser
  const e = running(4);
  e.socks.p1.msg('tournament:end');
  assert.deepEqual(e.socks.p1.errors(), ['HOST_ONLY']);
  e.host.msg('tournament:end');
  assert.equal(e.state().phase, 'ABORTED');
  assert.equal(e.get().status, 'FINISHED');
  e.host.msg('tournament:end');
  assert.ok(e.host.errors().includes('ILLEGAL_MOVE'));
  // in the lobby: the room is closed
  const l = arena({ n: 2 });
  l.host.msg('tournament:end');
  assert.equal(l.get().status, 'CANCELLED');
  assert.equal(l.state().phase, 'ABORTED');
});

test('TOURNAMENT abort: the organiser leaving the lobby closes the room', () => {
  const t = arena({ n: 3 });
  t.host.msg('game:leave');
  assert.equal(t.get().status, 'CANCELLED');
});

test('TOURNAMENT abort: fewer than 2 players left ends it; 4 players with one leaver keeps going', async () => {
  const t = running(4);
  t.socks.p1.msg('game:leave');
  await flush();
  assert.equal(t.state().phase, 'RUNNING');
  t.socks.p2.msg('game:leave');
  await flush();
  assert.equal(t.state().phase, 'RUNNING');
  t.socks.p3.msg('game:leave'); // only p4 is left
  await flush();
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
});

test('TOURNAMENT abort: nobody around for 5 minutes ends the tournament', async () => {
  const t = running(4);
  for (const s of [t.host, ...Object.values(t.socks)]) s.close();
  await new Promise((r) => setTimeout(r, 300));
  t.setClock(T0 + 4 * 60_000);
  t.m.tickTournament(t.id);
  assert.equal(t.state().phase, 'RUNNING', 'not yet');
  // everyone's match rooms resolved by no-shows meanwhile
  t.setClock(T0 + 6 * 60_000);
  t.m.tickTournament(t.id);
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
});

// ---------------------------------------------------------------------
// Restart / resume
// ---------------------------------------------------------------------

test('TOURNAMENT resume: after a restart the timer is re-armed and a match room that finished while the server was down is settled', async () => {
  const t = running(4);
  const ms = t.open('R1M1');
  t.playTtt('R1M1', ms, 'p1');
  // simulate the server going down right after the room finished: nobody told the tournament
  t.m.dispose();
  managers.splice(managers.indexOf(t.m), 1);
  const roomId = t.matchOf('R1M1').roomId;
  assert.equal(t.matchOf('R1M1').status, 'LIVE', 'the tournament never heard of the result');
  // (the hook was deferred and dispose() removed the listener: the tournament state is stale, exactly as after a crash)
  await flush();
  assert.equal(t.matchOf('R1M1').status === 'LIVE' || t.matchOf('R1M1').status === 'DONE', true);
  const second: any = new GameRoomManager(t.db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false, clock: () => t.clock.t });
  second.recordGameStreaks = async () => {};
  managers.push(second);
  assert.equal(second.resumeTournaments(), 1);
  const after = t.db.getGameRoomById(t.id)!.gameState as any;
  assert.equal(after.matches.find((x: any) => x.id === 'R1M1').status, 'DONE');
  assert.equal(after.matches.find((x: any) => x.id === 'R1M1').winnerUserId, 'p1');
  assert.equal(after.matches.find((x: any) => x.id === 'R1M1').roomId, roomId);
  // the other match room is watched again: its result still reaches the bracket
  assert.ok(second.tournamentTimers.has(t.id));
  assert.ok(second.watchedRooms.has(t.matchOf('R1M2').roomId));
  const sock = new FakeSocket();
  second.registerClient(sock as any, t.matchOf('R1M2').roomId, U('p2'));
  const sock2 = new FakeSocket();
  second.registerClient(sock2 as any, t.matchOf('R1M2').roomId, U('p3'));
  const room2 = t.db.getGameRoomById(t.matchOf('R1M2').roomId)!;
  assert.equal(room2.status, 'PLAYING');
  const [x, o] = [...room2.players].sort((a, b) => a.seat - b.seat).map((p) => p.userId);
  const by: Record<string, FakeSocket> = { [x]: x === 'p2' ? sock : sock2, [o]: o === 'p2' ? sock : sock2 };
  for (const [uid, cell] of [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]] as const) by[uid].msg('game:tictactoe_move', { cellIndex: cell });
  await flush();
  const final = t.db.getGameRoomById(t.id)!.gameState as any;
  assert.equal(final.matches.find((m: any) => m.id === 'R1M2').winnerUserId, x);
  assert.equal(final.matches.find((m: any) => m.id === 'R2M1').status, 'PENDING_PLAYERS');
  assert.ok(final.matches.find((m: any) => m.id === 'R2M1').roomId, 'the final got its room after the restart');
});

test('TOURNAMENT resume: a join window that ran out while the server was down is settled by the first tick', async () => {
  const clock = { t: T0 };
  const t = running(4, { clock });
  t.m.dispose();
  managers.splice(managers.indexOf(t.m), 1);
  clock.t = T0 + 10 * 60_000; // the server came back 10 minutes later
  const second: any = new GameRoomManager(t.db, { sweep: false, clock: () => clock.t });
  second.recordGameStreaks = async () => {};
  managers.push(second);
  second.resumeTournaments();
  const state = t.db.getGameRoomById(t.id)!.gameState as any;
  assert.notEqual(state.matches.find((m: any) => m.id === 'R1M1').doubleNoShowAt, null, 'nobody opened the rooms: the double no-show window started');
});

// ---------------------------------------------------------------------
// Testing-only switch
// ---------------------------------------------------------------------

test('TOURNAMENT test switch: TOURNAMENT_TEST_MIN_PLAYERS=2 lets two people run a one-match tournament (the final)', async () => {
  const prev = process.env.TOURNAMENT_TEST_MIN_PLAYERS;
  process.env.TOURNAMENT_TEST_MIN_PLAYERS = '2';
  try {
    const t = arena({ n: 2 });
    assert.equal(t.get().minPlayers, 3);
    t.host.msg('tournament:start');
    assert.equal(t.get().status, 'PLAYING', t.host.errors().join());
    assert.equal(t.state().matches.length, 1);
    assert.equal(t.matchOf('R1M1').roundName, 'Final');
    await t.playMatch('R1M1', 'p2');
    assert.equal(t.state().phase, 'COMPLETE');
    assert.equal(t.state().championUserId, 'p2');
    assert.equal(t.socks.p1.view().standings.rows[1].label, 'Runner-up');
  } finally {
    process.env.TOURNAMENT_TEST_MIN_PLAYERS = prev ?? '';
  }
});

// ---------------------------------------------------------------------
// Views, spectators, chat
// ---------------------------------------------------------------------

test('TOURNAMENT views: a spectator gets the public view and cannot act; chat reaches the room; views carry no internal data', async () => {
  const t = running(4);
  const spec = new FakeSocket();
  t.m.registerClient(spec as any, t.id, U('fan'), { spectate: true, canSpectate: true });
  assert.equal(spec.view().me.role, 'spectator');
  assert.equal(spec.view().phase, 'RUNNING');
  spec.msg('tournament:start');
  spec.msg('tournament:advance', { matchId: 'R1M1', userId: 'p1' });
  assert.deepEqual(spec.errors(), ['SPECTATOR', 'SPECTATOR']);
  t.socks.p1.msg('game:chat', { content: 'good luck' });
  assert.equal(t.socks.p2.of('game:chat_message').length, 1);
  assert.equal(spec.of('game:chat_message').length, 1, 'spectators read the chat');
  for (const s of [t.host, t.socks.p1, spec]) {
    assert.ok(!s.text().includes('"internal"'), 'internal bookkeeping stays on the server');
    assert.equal(s.view().game, 'tournament');
  }
  assert.equal(t.host.view().me.role, 'host');
  assert.equal(t.socks.p4.view().me.seed, 4);
  assert.equal(t.socks.p4.view().me.activeMatchId, 'R1M1');
  await flush();
});

test('TOURNAMENT views: the REST projection of a running tournament room', () => {
  const t = running(4);
  const projected = t.m.projectRoomFor(t.get(), 'p1');
  assert.equal(projected.gameState.game, 'tournament');
  assert.equal(projected.gameState.me.role, 'player');
  assert.ok(!JSON.stringify(projected).includes('"internal"'));
});

// ---------------------------------------------------------------------
// The hook is optional and changes nothing for the existing games
// ---------------------------------------------------------------------

test('HOOK: a normal tic-tac-toe room finishes, rematches and reports to nobody exactly as before', async () => {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const events: any[] = [];
  m.onGameRoomFinished((e: any) => events.push(e));
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  assert.equal(r.tournamentId, undefined);
  m.joinRoom(r.roomCode, U('b'));
  const a = new FakeSocket();
  const b = new FakeSocket();
  m.registerClient(a as any, r.id, U('a'));
  m.registerClient(b as any, r.id, U('b'));
  assert.equal(db.getGameRoomById(r.id)!.status, 'PLAYING');
  assert.equal((db.getGameRoomById(r.id) as any).tournamentId, undefined, 'no tournament fields on a normal room payload');
  assert.ok(!JSON.stringify(db.getGameRoomById(r.id)).includes('tournament'));
  for (const [s, cell] of [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]] as const) s.msg('game:tictactoe_move', { cellIndex: cell });
  await flush();
  assert.equal(db.getGameRoomById(r.id)!.status, 'FINISHED');
  assert.equal(db.getGameRoomById(r.id)!.gameState.winnerUserId, 'a');
  assert.deepEqual(events, [], 'nobody watched this room: the registry reported nothing');
  assert.equal((m as any).watchedRooms.size, 0);
  // the rematch still works for a normal room
  a.msg('game:rematch');
  b.msg('game:rematch');
  assert.equal(a.of('game:rematch_agreed').length, 1);
  await new Promise((res) => setTimeout(res, 700));
  assert.equal(db.getGameRoomById(r.id)!.status, 'PLAYING', 'a normal room starts the rematch');
  assert.deepEqual(a.errors(), []);
});

test('HOOK: a registered listener hears about a watched room only, once, with the engine winner (win, draw, forfeit, abandoned)', async () => {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const events: any[] = [];
  const off = m.onGameRoomFinished((e: any) => events.push(e));
  const mk = (type: string) => {
    const r = m.createGameRoom({ hostUser: U('a'), gameType: type, maxPlayers: 2 });
    m.joinRoom(r.roomCode, U('b'));
    const a = new FakeSocket();
    const b = new FakeSocket();
    m.registerClient(a as any, r.id, U('a'));
    m.registerClient(b as any, r.id, U('b'));
    return { r, a, b };
  };
  // a win
  const w = mk('tic-tac-toe');
  m.watchGameRoom(w.r.id, 'watcher-1');
  const other = mk('tic-tac-toe'); // not watched
  for (const [s, cell] of [[w.a, 0], [w.b, 3], [w.a, 1], [w.b, 4], [w.a, 2]] as const) s.msg('game:tictactoe_move', { cellIndex: cell });
  for (const [s, cell] of [[other.a, 0], [other.b, 3], [other.a, 1], [other.b, 4], [other.a, 2]] as const) s.msg('game:tictactoe_move', { cellIndex: cell });
  await flush();
  assert.equal(events.length, 1);
  assert.equal(events[0].roomId, w.r.id);
  assert.equal(events[0].winnerUserId, 'a');
  assert.equal(events[0].watcher, 'watcher-1');
  assert.equal(events[0].status, 'FINISHED');
  assert.equal(events[0].gameType, 'tic-tac-toe');
  // a draw
  const d = mk('tic-tac-toe');
  m.watchGameRoom(d.r.id, 'watcher-2');
  for (const [s, cell] of [[d.a, 0], [d.b, 1], [d.a, 2], [d.b, 4], [d.a, 3], [d.b, 5], [d.a, 7], [d.b, 6], [d.a, 8]] as const) s.msg('game:tictactoe_move', { cellIndex: cell });
  await flush();
  assert.equal(events.length, 2);
  assert.equal(events[1].winnerUserId, null);
  // a forfeit by leaving (four in a row)
  const f = mk('four-in-a-row');
  m.watchGameRoom(f.r.id, 'watcher-3');
  f.a.msg('game:leave');
  await flush();
  assert.equal(events.length, 3);
  assert.equal(events[2].winnerUserId, 'b');
  // unsubscribing stops the reports
  off();
  const g = mk('tic-tac-toe');
  m.watchGameRoom(g.r.id, 'watcher-4');
  g.a.msg('game:leave');
  await flush();
  assert.equal(events.length, 3);
  // a duplicate end of the same room is reported once
  const h = mk('tic-tac-toe');
  m.onGameRoomFinished((e: any) => events.push(e));
  m.watchGameRoom(h.r.id, 'watcher-5');
  db.updateGameRoomStatus(h.r.id, 'FINISHED', undefined, new Date().toISOString());
  db.updateGameRoomStatus(h.r.id, 'FINISHED', undefined, new Date().toISOString());
  await flush();
  assert.equal(events.filter((e) => e.roomId === h.r.id).length, 1);
  assert.equal(events.find((e) => e.roomId === h.r.id).winnerUserId, null);
});

test('HOOK: a throwing listener never breaks the game that finished', async () => {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  m.onGameRoomFinished(() => { throw new Error('boom'); });
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  m.joinRoom(r.roomCode, U('b'));
  const a = new FakeSocket();
  const b = new FakeSocket();
  m.registerClient(a as any, r.id, U('a'));
  m.registerClient(b as any, r.id, U('b'));
  m.watchGameRoom(r.id, 'w');
  for (const [s, cell] of [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]] as const) s.msg('game:tictactoe_move', { cellIndex: cell });
  await flush();
  assert.equal(db.getGameRoomById(r.id)!.status, 'FINISHED');
  assert.equal(db.getGameRoomById(r.id)!.gameState.winnerUserId, 'a');
});

test('HOOK: two managers on one database each hear their own watched rooms (the db wrapper is installed once)', async () => {
  const db = new DatabaseService(':memory:');
  const m1: any = new GameRoomManager(db, { sweep: false });
  const m2: any = new GameRoomManager(db, { sweep: false });
  m1.recordGameStreaks = async () => {};
  m2.recordGameStreaks = async () => {};
  managers.push(m1, m2);
  const e1: any[] = [];
  const e2: any[] = [];
  m1.onGameRoomFinished((e: any) => e1.push(e));
  m2.onGameRoomFinished((e: any) => e2.push(e));
  const r = m1.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  m1.watchGameRoom(r.id, 'x');
  db.updateGameRoomStatus(r.id, 'CANCELLED', undefined, new Date().toISOString());
  await flush();
  assert.equal(e1.length, 1);
  assert.equal(e2.length, 0);
  m1.dispose();
  const r2 = m2.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  m2.watchGameRoom(r2.id, 'y');
  db.updateGameRoomStatus(r2.id, 'CANCELLED', undefined, new Date().toISOString());
  await flush();
  assert.equal(e2.length, 1, 'the second manager still hears its rooms after the first was disposed');
  assert.equal(e1.length, 1);
});
