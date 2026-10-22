import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { PenFightEngine } from '../games/PenFightEngine.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DatabaseService } from '../db/database.js';

const P = [
  { userId: 'a', displayName: 'A', seat: 0 },
  { userId: 'b', displayName: 'B', seat: 1 }
];
const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });

const managers: any[] = [];
after(() => {
  for (const m of managers) { try { m.dispose(); } catch { /* ignore */ } }
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
});

function setup(gameType: string) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db);
  managers.push(m);
  const room = m.createGameRoom({ hostUser: U('a'), gameType, maxPlayers: 2 });
  m.joinRoom(room.roomCode, U('b'));
  m.startGame(db.getGameRoomById(room.id)!);
  const msgs: any[] = [];
  // both players are connected, so broadcasts reach them
  for (const u of ['a', 'b']) {
    const sock: any = { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }), close() {}, on() {}, ping() {}, terminate() {} };
    m.registerClient(sock, room.id, U(u));
  }
  const mk = (u: string) => ({ socket: { readyState: 1, send: (d: string) => msgs.push({ u, ...JSON.parse(d) }), close() {}, on() {} }, roomId: room.id, userId: u, displayName: u.toUpperCase() });
  return { db, m, msgs, mk, code: room.roomCode as string, get: () => db.getGameRoomById(room.id)! };
}
const lastError = (msgs: any[]) => [...msgs].reverse().find((x) => x.type === 'game:error');

// ---------- engine ----------
test('Pen Fight: a new match starts with both pens on the desk, nobody ahead', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  assert.equal(s.pens[0].x < s.desk.width / 2, true);
  assert.equal(s.pens[1].x > s.desk.width / 2, true);
  assert.deepEqual(s.scores, [0, 0]);
  assert.equal(s.round, 1);
  assert.equal(s.winner, null);
  assert.equal(s.currentTurnSeat, 0);
});

test('Pen Fight: the wrong player, or a flick with no angle or power, is refused and changes nothing', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  assert.throws(() => PenFightEngine.flick(s, 1, 0, 0.5, P), (e: any) => e instanceof GameRuleError && e.code === 'NOT_YOUR_TURN');
  for (const [angle, power] of [[NaN, 0.5], [0, Infinity], ['x' as any, 0.5], [0, undefined as any]] as const) {
    assert.throws(() => PenFightEngine.flick(s, 0, angle, power, P), (e: any) => e instanceof GameRuleError && e.code === 'INVALID_INPUT');
  }
  assert.equal(s.moveCount, 0);
});

test('Pen Fight: a flick is the same every time it is played (the server and every screen agree)', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  const a = PenFightEngine.flick(s, 0, 0.1, 0.6, P);
  const b = PenFightEngine.flick(s, 0, 0.1, 0.6, P);
  assert.deepEqual(a.flick, b.flick);
  assert.ok(a.flick.frames.length > 5);
});

test('Pen Fight: a gentle flick leaves both pens on the desk and passes the turn', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  const r = PenFightEngine.flick(s, 0, 0, 0.3, P);
  assert.equal(r.roundOver, null);
  assert.equal(r.state.currentTurnSeat, 1);
  assert.equal(r.state.pens[0].x > s.pens[0].x, true);
  assert.equal(r.state.flicksThisRound, 1);
});

test('Pen Fight: knocking the other pen off the desk wins the round and starts the next one', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  s.pens[0] = { x: 600, y: 300, out: false };
  s.pens[1] = { x: 700, y: 300, out: false };
  const r = PenFightEngine.flick(s, 0, 0, 1, P);
  assert.equal(r.roundOver?.winnerSeat, 0);
  assert.equal(r.roundOver?.reason, 'knocked_out');
  assert.deepEqual(r.state.scores, [1, 0]);
  assert.equal(r.state.round, 2);
  assert.equal(r.state.pens[0].out, false); // pens are back on their marks
  assert.equal(r.state.currentTurnSeat, 1); // the other player starts the next round
  assert.equal(r.matchOver, false);
});

test('Pen Fight: sliding your own pen off the desk gives the round to the other player', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  const r = PenFightEngine.flick(s, 0, -Math.PI / 2, 1, P); // straight at the top edge, full power
  assert.equal(r.roundOver?.reason, 'self_out');
  assert.equal(r.roundOver?.winnerSeat, 1);
  assert.deepEqual(r.state.scores, [0, 1]);
});

test('Pen Fight: the third round win ends the match and names the winner', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  s.scores = [2, 0];
  s.currentTurnSeat = 1;
  const r = PenFightEngine.flick(s, 1, Math.PI / 2, 1, P); // seat 1 slides off the bottom edge
  assert.equal(r.matchOver, true);
  assert.equal(r.state.winner, 'X');
  assert.equal(r.state.winnerUserId, 'a');
  assert.throws(() => PenFightEngine.flick(r.state, 0, 0, 0.5, P), (e: any) => e.code === 'GAME_OVER');
});

test('Pen Fight: with no knock-out after the last flick, the pen nearer the middle takes the round', () => {
  const s = PenFightEngine.createInitialState(P, 0);
  s.flicksThisRound = s.maxFlicksPerRound - 1;
  s.pens[0] = { x: 480, y: 300, out: false };
  s.pens[1] = { x: 900, y: 300, out: false };
  const r = PenFightEngine.flick(s, 0, Math.PI, 0.06, P); // a tiny nudge
  assert.equal(r.roundOver?.reason, 'closest_to_center');
  assert.equal(r.roundOver?.winnerSeat, 0);
});

// ---------- the game room ----------
test('Pen Fight room: the definition, aliases and room code exist', () => {
  assert.equal(GAME_DEFINITIONS['pen-fight'].maxPlayers, 2);
  assert.equal(parseGameType('penfight'), 'pen-fight');
  assert.equal(parseGameType('zerocross'), 'zero-cross');
  assert.ok(setup('pen-fight').code.startsWith('PEN-'));
  assert.ok(setup('zero-cross').code.startsWith('ZERO-'));
});

test('Pen Fight room: a flick is played on the server and broadcast with its frames', () => {
  const t = setup('pen-fight');
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:penfight_flick', payload: { angle: 0, power: 0.4 } });
  const msg = t.msgs.find((x) => x.type === 'game:pen_flicked');
  assert.ok(msg, 'a pen_flicked message was sent');
  assert.ok(msg.payload.flick.frames.length > 2);
  assert.equal(t.get().gameState.currentTurnSeat, 1);
  assert.equal(t.get().gameState.moveCount, 1);
});

test('Pen Fight room: the wrong turn and junk input come back as errors and change nothing', () => {
  const t = setup('pen-fight');
  (t.m as any).handleClientMessage(t.mk('b'), { type: 'game:penfight_flick', payload: { angle: 0, power: 0.4 } });
  assert.equal(lastError(t.msgs)?.payload.code, 'NOT_YOUR_TURN');
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:penfight_flick', payload: { angle: 'left', power: {} } });
  assert.equal(lastError(t.msgs)?.payload.code, 'INVALID_INPUT');
  assert.equal(t.get().gameState.moveCount, 0);
});

test('Pen Fight room: winning the match finishes the room', () => {
  const t = setup('pen-fight');
  const gs = t.get().gameState;
  gs.scores = [2, 0];
  t.db.updateGameRoomState(t.get().id, gs, 0);
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:penfight_flick', payload: { angle: Math.PI, power: 1 } }); // seat 0 slides off the left edge
  // seat 1 wins the round, but needs 3: the match goes on
  assert.equal(t.get().status, 'PLAYING');
  const g2 = t.get().gameState;
  g2.scores = [0, 2];
  g2.currentTurnSeat = 0;
  t.db.updateGameRoomState(t.get().id, g2, 0);
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:penfight_flick', payload: { angle: Math.PI, power: 1 } });
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.get().gameState.winner, 'O');
});
