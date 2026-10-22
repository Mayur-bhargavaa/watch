import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { ZeroCrossEngine, WINNING_LINES, sanitizeDuration } from '../games/ZeroCrossEngine.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DatabaseService } from '../db/database.js';
import type { ZeroCrossGameState } from '@synccinema/common';

const P = [
  { userId: 'a', displayName: 'A', seat: 0 },
  { userId: 'b', displayName: 'B', seat: 1 }
];
const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const T0 = 1_700_000_000_000;

const fresh = (opts: { durationSeconds?: number | null; startingSeat?: number } = {}): ZeroCrossGameState =>
  ZeroCrossEngine.createInitialState(P, { now: T0, gameId: 'g1', ...opts });
const place = (s: ZeroCrossGameState, seat: number, to: number, moveId?: string, now = T0 + 1000) => ZeroCrossEngine.apply(s, seat, { kind: 'place', to, moveId }, P, now);
const move = (s: ZeroCrossGameState, seat: number, from: number, to: number, moveId?: string, now = T0 + 1000) => ZeroCrossEngine.apply(s, seat, { kind: 'move', from, to, moveId }, P, now);
const code = (code: string) => (e: unknown) => e instanceof GameRuleError && e.code === code;

/** plays a list of placements (X, O, X, O, X, O) and returns the state */
function placed(cells: number[]): ZeroCrossGameState {
  let s = fresh();
  cells.forEach((c, i) => { s = place(s, i % 2, c).state; });
  return s;
}

// ---------------------------------------------------------------- the rules
test('a new match: empty board, three pieces each, X to place, clock set from the start time', () => {
  const s = fresh();
  assert.deepEqual(s.board, Array(9).fill(null));
  assert.deepEqual(s.remainingPlacements, { X: 3, O: 3 });
  assert.equal(s.phase, 'placement');
  assert.equal(s.status, 'active');
  assert.equal(s.currentTurnSeat, 0);
  assert.equal(s.durationSeconds, 300);
  assert.equal(s.deadlineAt, new Date(T0 + 300_000).toISOString());
  assert.equal(s.version, 1);
});

test('placement alternates and each player places exactly three pieces, then the pieces start moving', () => {
  // X0 O3 X1 O4 O... uses non-winning cells
  const s = placed([0, 3, 1, 4, 5, 8]);
  assert.equal(s.phase, 'movement');
  assert.deepEqual(s.remainingPlacements, { X: 0, O: 0 });
  assert.equal(s.board.filter((c) => c === 'X').length, 3);
  assert.equal(s.board.filter((c) => c === 'O').length, 3);
  assert.equal(s.board.filter((c) => c === null).length, 3);
  assert.equal(s.currentTurnSeat, 0); // X moves first after the placements
});

test('placing out of turn, on an occupied square, or on a bad square is refused and changes nothing', () => {
  const s = fresh();
  assert.throws(() => place(s, 1, 4), code('NOT_YOUR_TURN'));
  const one = place(s, 0, 4).state;
  assert.throws(() => place(one, 1, 4), code('CELL_OCCUPIED'));
  for (const bad of [-1, 9, 2.5, NaN, '3' as any, null as any, undefined as any]) {
    assert.throws(() => place(s, 0, bad), code('INVALID_INPUT'), String(bad));
  }
  assert.equal(s.version, 1);
  assert.deepEqual(s.board, Array(9).fill(null));
});

test('a placement after all three pieces are down, and a move during placement, are refused', () => {
  const s = fresh();
  assert.throws(() => move(s, 0, 0, 1), code('WRONG_PHASE'));
  const moving = placed([0, 3, 1, 4, 5, 8]);
  assert.throws(() => place(moving, 0, 2), code('WRONG_PHASE'));
  const spent = { ...fresh(), remainingPlacements: { X: 0, O: 3 } };
  assert.throws(() => place(spent, 0, 2), code('NO_PIECES_LEFT'));
});

test('moving: a piece goes to any empty square, the piece count never changes, and the turn passes', () => {
  const s = placed([0, 3, 1, 4, 5, 8]); // X: 0 1 5, O: 3 4 8
  const r = move(s, 0, 5, 7); // far from where it was, not adjacent
  assert.equal(r.state.board[5], null);
  assert.equal(r.state.board[7], 'X');
  assert.equal(r.state.board.filter((c) => c === 'X').length, 3);
  assert.equal(r.state.board.filter((c) => c === 'O').length, 3);
  assert.equal(r.state.currentTurnSeat, 1);
  assert.deepEqual(r.state.lastMove, { seat: 0, kind: 'move', from: 5, to: 7, moveId: null });
});

test('moving: the opponent\'s piece, an empty square, an occupied square, or the same square are refused', () => {
  const s = placed([0, 3, 1, 4, 5, 8]);
  assert.throws(() => move(s, 0, 3, 7), code('NOT_YOUR_PIECE'));
  assert.throws(() => move(s, 0, 2, 7), code('NO_PIECE'));
  assert.throws(() => move(s, 0, 0, 3), code('CELL_OCCUPIED'));
  assert.throws(() => move(s, 0, 0, 1), code('CELL_OCCUPIED'));
  assert.throws(() => move(s, 0, 0, 0), code('INVALID_INPUT'));
  assert.throws(() => move(s, 1, 3, 7), code('NOT_YOUR_TURN'));
  assert.throws(() => ZeroCrossEngine.apply(s, 0, { kind: 'move', to: 7 } as any, P, T0), code('INVALID_INPUT'));
  assert.deepEqual(s.board, placed([0, 3, 1, 4, 5, 8]).board);
});

test('all eight winning lines win, even straight from the placement phase', () => {
  assert.equal(WINNING_LINES.length, 8);
  for (const line of WINNING_LINES) {
    const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !line.includes(c));
    // X: line[0] O: others[0] X: line[1] O: others[1] X: line[2]
    let s = fresh();
    s = place(s, 0, line[0]).state;
    s = place(s, 1, others[0]).state;
    s = place(s, 0, line[1]).state;
    s = place(s, 1, others[1]).state;
    const r = place(s, 0, line[2]);
    assert.equal(r.finished, true, line.join(','));
    assert.equal(r.state.status, 'won');
    assert.equal(r.state.winner, 'X');
    assert.equal(r.state.winnerUserId, 'a');
    assert.deepEqual(r.state.winningLine, line);
    assert.equal(r.state.phase, 'finished');
  }
});

test('a move can win: sliding a piece to complete a line ends the match at once', () => {
  // X: 0 1 5, O: 3 4 8 -> X moves 5 -> 2 and makes the top row
  const s = placed([0, 3, 1, 4, 5, 8]);
  const r = move(s, 0, 5, 2);
  assert.equal(r.state.status, 'won');
  assert.deepEqual(r.state.winningLine, [0, 1, 2]);
  assert.throws(() => move(r.state, 1, 3, 5), code('GAME_OVER'));
});

test('O can win too, and the winner is the player who owns that mark', () => {
  // X 0 O 3 X 1 O 4 X 8 O 5 -> middle row for O
  const s = placed([0, 3, 1, 4, 8, 5]);
  assert.equal(s.status, 'won');
  assert.equal(s.winner, 'O');
  assert.equal(s.winnerUserId, 'b');
});

// ---------------------------------------------------------------- the clock
test('the clock is the server\'s deadline: a move just before it counts, one at or after it ends the match as a draw', () => {
  const s = fresh({ durationSeconds: 180 });
  const deadline = T0 + 180_000;
  assert.equal(ZeroCrossEngine.remainingMs(s, deadline - 1000), 1000);
  const ok = place(s, 0, 4, undefined, deadline - 1);
  assert.equal(ok.timedOut, false);
  const late = place(s, 0, 4, undefined, deadline);
  assert.equal(late.timedOut, true);
  assert.equal(late.state.status, 'timeout');
  assert.equal(late.state.isDraw, true);
  assert.equal(late.state.board[4], null, 'the late move is not applied');
});

test('a winning move accepted before the deadline stays a win; the clock cannot undo it', () => {
  let s = fresh({ durationSeconds: 180 });
  const before = T0 + 179_000;
  for (const [seat, cell] of [[0, 0], [1, 3], [0, 1], [1, 4]] as const) s = place(s, seat, cell, undefined, before).state;
  const win = place(s, 0, 2, undefined, before);
  assert.equal(win.state.status, 'won');
  assert.equal(ZeroCrossEngine.timeout(win.state).status, 'won'); // already finished: unchanged
});

test('a winning move that arrives exactly at the deadline loses the race: it is a draw', () => {
  let s = fresh({ durationSeconds: 180 });
  for (const [seat, cell] of [[0, 0], [1, 3], [0, 1], [1, 4]] as const) s = place(s, seat, cell).state;
  const r = place(s, 0, 2, undefined, T0 + 180_000);
  assert.equal(r.state.status, 'timeout');
  assert.equal(r.state.winner, null);
});

test('timeout makes a draw; an unlimited match has no deadline and never expires', () => {
  assert.equal(ZeroCrossEngine.timeout(fresh()).status, 'timeout');
  const u = fresh({ durationSeconds: null });
  assert.equal(u.deadlineAt, null);
  assert.equal(ZeroCrossEngine.remainingMs(u, T0 + 10 ** 12), null);
  assert.equal(ZeroCrossEngine.isExpired(u, T0 + 10 ** 12), false);
  assert.equal(place(u, 0, 4, undefined, T0 + 10 ** 12).timedOut, false);
});

test('only the four offered match lengths are accepted', () => {
  assert.equal(sanitizeDuration(180), 180);
  assert.equal(sanitizeDuration(300), 300);
  assert.equal(sanitizeDuration(600), 600);
  assert.equal(sanitizeDuration(null), null);
  assert.equal(sanitizeDuration(1), 300);
  assert.equal(sanitizeDuration('600'), 300);
});

// ---------------------------------------------------------------- surrender, versions, resent moves
test('surrender gives the match to the other player and cannot be done twice', () => {
  const s = placed([0, 3]);
  const r = ZeroCrossEngine.surrender(s, 1, P);
  assert.equal(r.status, 'surrendered');
  assert.equal(r.winner, 'X');
  assert.equal(r.winnerUserId, 'a');
  assert.equal(r.finishReason, 'surrendered');
  assert.throws(() => ZeroCrossEngine.surrender(r, 0, P), code('GAME_OVER'));
});

test('forfeit and cancel end the match with the right result', () => {
  const f = ZeroCrossEngine.forfeit(fresh(), 1, 'A', P);
  assert.equal(f.status, 'forfeit');
  assert.equal(f.winnerUserId, 'b');
  const c = ZeroCrossEngine.cancel(fresh());
  assert.equal(c.status, 'cancelled');
  assert.equal(c.winner, null);
  assert.equal(c.isDraw, true); // finished with no winner
});

test('the version goes up by exactly one for every accepted action', () => {
  let s = fresh();
  const seen = [s.version];
  for (const [seat, cell] of [[0, 0], [1, 4], [0, 8]] as const) {
    s = place(s, seat, cell).state;
    seen.push(s.version);
  }
  assert.deepEqual(seen, [1, 2, 3, 4]);
});

test('a move sent twice (same id) is applied once; a stale version is refused', () => {
  const s = fresh();
  const first = place(s, 0, 4, 'm1');
  const again = place(first.state, 0, 4, 'm1'); // resent: would be "not your turn" / "occupied" if applied
  assert.equal(again.duplicate, true);
  assert.equal(again.state, first.state);
  assert.throws(() => ZeroCrossEngine.apply(first.state, 1, { kind: 'place', to: 0, baseVersion: 1 }, P, T0), code('STALE_STATE'));
  assert.doesNotThrow(() => ZeroCrossEngine.apply(first.state, 1, { kind: 'place', to: 0, baseVersion: first.state.version }, P, T0));
  assert.throws(() => place(s, 0, 4, 'x'.repeat(65)), code('INVALID_INPUT'));
});

test('a move id is still recognised after the match is over (a late resend is not an error)', () => {
  let s = fresh();
  for (const [seat, cell, id] of [[0, 0, 'a1'], [1, 3, 'b1'], [0, 1, 'a2'], [1, 4, 'b2'], [0, 2, 'a3']] as const) s = place(s, seat, cell, id).state;
  assert.equal(s.status, 'won');
  assert.equal(place(s, 0, 2, 'a3').duplicate, true);
});

// ---------------------------------------------------------------- the room: real handlers, real sockets
const managers: any[] = [];
after(() => {
  for (const m of managers) { try { m.dispose(); } catch { /* ignore */ } }
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
});

function setup(opts: { join?: boolean; spectator?: boolean } = {}) {
  const db = new DatabaseService(':memory:');
  let now = T0;
  const m: any = new GameRoomManager(db, { clock: () => now });
  managers.push(m);
  const room = m.createGameRoom({ hostUser: U('a'), gameType: 'zero-cross', maxPlayers: 2 });
  const msgs: any[] = [];
  const clients: Record<string, any> = {};
  const connect = (u: string) => {
    const sock: any = { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }), close() {}, on() {}, ping() {}, terminate() {} };
    m.registerClient(sock, room.id, U(u));
    clients[u] = { socket: sock, roomId: room.id, userId: u, displayName: u.toUpperCase() };
    return clients[u];
  };
  const act = (u: string, type: string, payload?: any) => m.handleClientMessage(clients[u] ?? { socket: { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }) }, roomId: room.id, userId: u, displayName: u }, { type, payload });
  connect('a');
  if (opts.join !== false) {
    m.joinRoom(room.roomCode, U('b'));
    connect('b');
  }
  return {
    db, m, msgs, act, connect, id: room.id as string, code: room.roomCode as string,
    get: () => db.getGameRoomById(room.id)!,
    gs: () => db.getGameRoomById(room.id)!.gameState as ZeroCrossGameState,
    setNow: (n: number) => { now = n; },
    states: (u: string) => msgs.filter((x) => x.to === u && x.type === 'game:zerocross_state'),
    lastError: () => [...msgs].reverse().find((x) => x.type === 'game:error')
  };
}

test('room: two players join, the match starts with X / O and a 5 minute server deadline', () => {
  const t = setup();
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.gs().phase, 'placement');
  assert.equal(t.gs().deadlineAt, new Date(T0 + 300_000).toISOString());
  assert.equal(t.get().players.find((p) => p.userId === 'a')!.seat, 0);
});

test('room: both players receive the same accepted state for every move', () => {
  const t = setup();
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4, moveId: 'm1' });
  t.act('b', 'game:zerocross_action', { kind: 'place', to: 0, moveId: 'm2' });
  const a = t.states('a');
  const b = t.states('b');
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((m) => m.payload.gameState.version), b.map((m) => m.payload.gameState.version));
  assert.deepEqual(a[1].payload.gameState.board, b[1].payload.gameState.board);
  assert.equal(a[1].payload.gameState.board[4], 'X');
  assert.equal(a[1].payload.gameState.board[0], 'O');
  assert.ok(a[1].payload.serverTime, 'the server time travels with the state so screens can correct their clocks');
});

test('room: out-of-turn, non-player and malformed actions are refused and change nothing', () => {
  const t = setup();
  const before = JSON.stringify(t.gs());
  t.act('b', 'game:zerocross_action', { kind: 'place', to: 4 });
  assert.equal(t.lastError().payload.code, 'NOT_YOUR_TURN');
  t.act('spectator', 'game:zerocross_action', { kind: 'place', to: 4 });
  assert.equal(t.lastError().payload.code, 'NOT_PLAYER');
  for (const bad of [null, undefined, [], 'move', 7, {}, { kind: 'teleport', to: 1 }, { kind: 'place' }, { kind: 'place', to: 'x' }, { kind: 'place', to: 99 }, { kind: 'move', to: 1 }, { kind: 'place', to: 1, moveId: 5 }, { kind: 'place', to: 1, baseVersion: 'z' }]) {
    t.act('a', 'game:zerocross_action', bad);
    assert.equal(t.lastError().payload.code, 'INVALID_INPUT', JSON.stringify(bad));
  }
  assert.equal(JSON.stringify(t.gs()), before);
});

test('room: a resent move id is answered with the current board and not applied twice', () => {
  const t = setup();
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4, moveId: 'dup' });
  const v = t.gs().version;
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4, moveId: 'dup' });
  assert.equal(t.gs().version, v);
  assert.equal(t.states('a').at(-1).payload.resync, true);
});

test('room: a stale screen gets an error and the latest board', () => {
  const t = setup();
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4, baseVersion: 1 });
  t.act('b', 'game:zerocross_action', { kind: 'place', to: 0, baseVersion: 1 }); // b still thinks it is version 1
  assert.equal(t.lastError().payload.code, 'STALE_STATE');
  assert.equal(t.states('b').at(-1).payload.resync, true);
  assert.equal(t.gs().board[0], null);
});

test('room: both players acting at once: the first accepted action wins the turn, the second is refused', () => {
  const t = setup();
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4 });
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 5 }); // a again before b answered
  assert.equal(t.lastError().payload.code, 'NOT_YOUR_TURN');
  assert.equal(t.gs().board.filter((c) => c === 'X').length, 1);
});

test('room: a full match to a win, then rematch alternates who starts and gives a fresh match', async () => {
  const t = setup();
  for (const [u, to] of [['a', 0], ['b', 3], ['a', 1], ['b', 4], ['a', 2]] as const) t.act(u, 'game:zerocross_action', { kind: 'place', to });
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.gs().winnerUserId, 'a');
  const oldId = t.gs().gameId;
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 6 });
  assert.equal(t.lastError().payload.code, 'GAME_OVER');
  t.act('a', 'game:rematch');
  t.act('b', 'game:rematch');
  await new Promise((r) => setTimeout(r, 800)); // the server starts the rematch half a second after the last vote
  assert.equal(t.get().status, 'PLAYING');
  assert.notEqual(t.gs().gameId, oldId);
  assert.deepEqual(t.gs().board, Array(9).fill(null));
  assert.equal(t.gs().currentTurnSeat, 1, 'the other player starts the rematch');
});

test('room: surrender needs a player, ends the match for both, and cannot be repeated', () => {
  const t = setup();
  t.act('spectator', 'game:zerocross_surrender');
  assert.equal(t.lastError().payload.code, 'NOT_PLAYER');
  t.act('b', 'game:zerocross_surrender');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.gs().status, 'surrendered');
  assert.equal(t.gs().winnerUserId, 'a');
  const fin = t.states('a').at(-1).payload;
  assert.equal(fin.finished, true);
  assert.equal(fin.reason, 'surrendered');
  assert.deepEqual(fin.gameState, t.states('b').at(-1).payload.gameState);
  t.act('a', 'game:zerocross_surrender');
  assert.equal(t.lastError().payload.code, 'GAME_OVER');
});

test('room: the server clock ends the match as a draw at the deadline, with nobody acting', () => {
  const t = setup();
  t.setNow(T0 + 299_000);
  t.m.expireZeroCross(t.id);
  assert.equal(t.get().status, 'PLAYING', 'not yet');
  t.setNow(T0 + 300_000);
  t.m.expireZeroCross(t.id);
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.gs().status, 'timeout');
  assert.equal(t.gs().isDraw, true);
  assert.equal(t.states('b').at(-1).payload.finished, true);
});

test('room: a move that arrives after the deadline is not applied and the match is a draw', () => {
  const t = setup();
  t.setNow(T0 + 301_000);
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4 });
  assert.equal(t.gs().status, 'timeout');
  assert.equal(t.gs().board[4], null);
  assert.equal(t.states('a').at(-1).payload.rejected.reason, 'TIME_UP');
});

test('room: after a server restart a persisted match whose time ran out is settled, one with time left gets its clock back', () => {
  const t = setup();
  t.m.stopZeroCrossTimer?.(t.id); // as if the process had restarted: no timer in memory
  t.setNow(T0 + 400_000);
  t.m.ensureZeroCrossTimer(t.id);
  assert.equal(t.gs().status, 'timeout');
  const u = setup();
  u.m.stopZeroCrossTimer(u.id);
  u.setNow(T0 + 10_000);
  u.m.ensureZeroCrossTimer(u.id);
  assert.equal(u.gs().status, 'active');
  assert.ok(u.m.zeroCrossTimers.has(u.id));
});

test('room: the host picks the match length before it starts; nobody else can; bad values and a running match are refused', () => {
  const t = setup({ join: false });
  t.act('a', 'game:zerocross_config', { durationSeconds: 180 });
  assert.equal(t.msgs.find((x) => x.type === 'game:zerocross_config_updated').payload.durationSeconds, 180);
  t.act('a', 'game:zerocross_config', { durationSeconds: 42 });
  assert.equal(t.lastError().payload.code, 'INVALID_INPUT');
  t.m.joinRoom(t.code, U('b'));
  t.connect('b');
  assert.equal(t.gs().durationSeconds, 180);
  assert.equal(t.gs().deadlineAt, new Date(T0 + 180_000).toISOString());
  t.act('b', 'game:zerocross_config', { durationSeconds: 600 });
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  t.act('a', 'game:zerocross_config', { durationSeconds: 600 });
  assert.equal(t.lastError().payload.code, 'ILLEGAL_MOVE');
});

test('room: an unlimited match has no deadline', () => {
  const t = setup({ join: false });
  t.act('a', 'game:zerocross_config', { durationSeconds: null });
  t.m.joinRoom(t.code, U('b'));
  t.connect('b');
  assert.equal(t.gs().deadlineAt, null);
  assert.equal(t.gs().durationSeconds, null);
});

test('room: only the host can cancel a running match', () => {
  const t = setup();
  t.act('b', 'game:zerocross_cancel');
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  t.act('a', 'game:zerocross_cancel');
  assert.equal(t.gs().status, 'cancelled');
  assert.equal(t.get().status, 'FINISHED');
});

test('room: a player who leaves forfeits: the other player wins and both are told', () => {
  const t = setup();
  t.act('a', 'game:leave');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.gs().status, 'forfeit');
  assert.equal(t.gs().winnerUserId, 'b');
});

test('room: a reconnecting player gets the current authoritative state, not a new match', () => {
  const t = setup();
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4 });
  const id = t.gs().gameId;
  t.msgs.length = 0;
  t.connect('b'); // b opens another tab / reconnects
  const sync = t.msgs.find((x) => x.to === 'b' && x.type === 'game:sync');
  assert.ok(sync, 'a sync message is sent');
  assert.equal(sync.payload.room.gameState.gameId, id);
  assert.equal(sync.payload.room.gameState.board[4], 'X');
  assert.equal(t.gs().version, 2);
});

test('room: an action sent to another room\'s match does nothing there', () => {
  const t1 = setup();
  const t2 = setup();
  t1.act('a', 'game:zerocross_action', { kind: 'place', to: 4 });
  assert.equal(t2.gs().board[4], null);
  assert.equal(t2.gs().version, 1);
});

test('room: a match saved in the old format (before Zero Cross had its own rules) is refused with a clear message instead of crashing', () => {
  const t = setup();
  // what the first version of Zero Cross left in the database: a plain 3x3 state with no pieces or clock
  t.db.updateGameRoomState(t.id, { board: Array(9).fill(null), currentTurnSeat: 0, currentTurnMark: 'X', winner: null, isDraw: false, moveCount: 0 } as any, 0);
  t.act('a', 'game:zerocross_action', { kind: 'place', to: 4 });
  assert.equal(t.lastError().payload.code, 'NOT_PLAYING');
  t.act('a', 'game:zerocross_surrender');
  assert.equal(t.lastError().payload.code, 'NOT_PLAYING');
  t.m.ensureZeroCrossTimer(t.id); // must not throw
  assert.equal(ZeroCrossEngine.isValidState(t.gs()), false);
});
