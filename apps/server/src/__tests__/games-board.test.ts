import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { LudoEngine } from '../games/LudoEngine.js';
import { FourInARowEngine } from '../games/FourInARowEngine.js';
import { TicTacToeEngine } from '../games/TicTacToeEngine.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS } from '../games/GameDefinitions.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DatabaseService } from '../db/database.js';

const P = [
  { userId: 'a', displayName: 'A', seat: 0 },
  { userId: 'b', displayName: 'B', seat: 1 }
];
const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });

const managers: any[] = [];
after(() => {
  for (const m of managers) { try { m.dispose(); m.stopLudoTurnTimer?.(''); } catch { /* ignore */ } }
  // Importing the manager pulls in the Mongo logger, which keeps the event loop alive: exit once reporting is done
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
});

function setup(gameType: string, maxPlayers = 2) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db);
  managers.push(m);
  const room = m.createGameRoom({ hostUser: U('a'), gameType, maxPlayers });
  for (let i = 1; i < maxPlayers; i++) m.joinRoom(room.roomCode, U(String.fromCharCode(97 + i)));
  m.startGame(db.getGameRoomById(room.id)!); // auto-start normally happens when sockets register
  const msgs: any[] = [];
  const mk = (u: string) => {
    const sock: any = { readyState: 1, send: (d: string) => msgs.push({ u, ...JSON.parse(d) }), close() {}, on() {} };
    const c: any = { socket: sock, roomId: room.id, userId: u, displayName: u.toUpperCase() };
    return c;
  };
  return { db, m, id: room.id as string, msgs, mk, get: () => db.getGameRoomById(room.id)! };
}
const lastError = (msgs: any[]) => [...msgs].reverse().find(x => x.type === 'game:error');

// ---------- Four in a Row ----------
test('FR-3: NaN / fractional / non-number columns are rejected and do not burn the turn', () => {
  const s = FourInARowEngine.createInitialState(P, 0);
  for (const bad of [NaN, 2.5, undefined as any, null as any, '' as any, '3' as any, -1, 7, Infinity]) {
    assert.throws(() => FourInARowEngine.dropDisc(s, 0, bad, P[0], P), GameRuleError, String(bad));
  }
  assert.equal(s.moveCount, 0);
  assert.equal(s.currentTurnSeat, 0);
});

test('FR-3/TT-14: handler routes invalid column to a game:error and leaves the state untouched', () => {
  const t = setup('four-in-a-row');
  const c = t.mk('a');
  for (const payload of [{}, { column: 2.5 }, { column: null }, { column: '' }, { column: [] }, { column: 'x' }]) {
    (t.m as any).handleClientMessage(c, { type: 'game:drop_disc', payload });
  }
  assert.equal(lastError(t.msgs)?.payload.code, 'INVALID_INPUT');
  assert.equal(t.get().gameState.moveCount, 0);
  (t.m as any).handleClientMessage(c, { type: 'game:drop_disc', payload: { column: 3 } });
  assert.equal(t.get().gameState.moveCount, 1);
});

test('FR-5: a drawn Four in a Row marks the room FINISHED', () => {
  const t = setup('four-in-a-row');
  const gs = t.get().gameState;
  // Board with no four-in-a-row anywhere and a single empty cell at row 0 col 0
  const pattern = ['RRYYRRY', 'YYRRYYR', 'RRYYRRY', 'YYRRYYR', 'RRYYRRY', 'YYRRYYR'];
  gs.board = pattern.map(r => r.split('').map(ch => ch));
  gs.board[0][0] = null;
  gs.currentTurnSeat = 0;
  gs.currentTurnColor = 'red';
  t.db.updateGameRoomState(t.id, gs, 0);
  const full = gs.board.map((r: any[]) => [...r]);
  full[0][0] = 'R';
  assert.equal(FourInARowEngine.checkWin(full as any), null, 'fixture must be a drawn position');
  t.m.handleDropDisc(t.id, 'a', 0);
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.get().gameState.isDraw, true);
  assert.throws(() => t.m.handleDropDisc(t.id, 'b', 1), /finished/);
});

test('FR-6: rematch alternates the starting seat', () => {
  const t = setup('four-in-a-row');
  assert.equal(t.get().gameState.currentTurnSeat, 0);
  const gs = t.get().gameState;
  gs.winner = 'R';
  t.db.updateGameRoomState(t.id, gs, 0);
  t.m.startGame(t.get());
  assert.equal(t.get().gameState.currentTurnSeat, 1);
  assert.equal(t.get().gameState.currentTurnColor, 'yellow');
});

// ---------- Tic-Tac-Toe ----------
test('TT-13: malformed cell indexes are rejected with INVALID_INPUT', () => {
  const s = TicTacToeEngine.createInitialState(P, 0);
  for (const bad of ['' as any, false as any, [] as any, true as any, 1.5, NaN, null as any, undefined as any, -1, 9]) {
    assert.throws(
      () => TicTacToeEngine.makeMove(s, 0, bad, P[0], P),
      (e: any) => e instanceof GameRuleError && e.code === 'INVALID_INPUT',
      String(bad)
    );
  }
  const t = setup('tic-tac-toe');
  const c = t.mk('a');
  for (const payload of [{}, { cellIndex: '' }, { cellIndex: false }, { cellIndex: [] }, { cellIndex: true }, { cellIndex: 1.5 }]) {
    (t.m as any).handleClientMessage(c, { type: 'game:tictactoe_move', payload });
    assert.equal(lastError(t.msgs)?.payload.code, 'INVALID_INPUT');
  }
  assert.equal(t.get().gameState.moveCount, 0);
});

test('TT-14: rejections (out of turn, occupied) are sent to the client as game:error', () => {
  const t = setup('tic-tac-toe');
  (t.m as any).handleClientMessage(t.mk('b'), { type: 'game:tictactoe_move', payload: { cellIndex: 0 } });
  assert.equal(lastError(t.msgs)?.payload.code, 'NOT_YOUR_TURN');
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:tictactoe_move', payload: { cellIndex: 0 } });
  (t.m as any).handleClientMessage(t.mk('b'), { type: 'game:tictactoe_move', payload: { cellIndex: 0 } });
  assert.equal(lastError(t.msgs)?.payload.code, 'CELL_OCCUPIED');
});

test('TT-6: a drawn Tic-Tac-Toe marks the room FINISHED', () => {
  const t = setup('tic-tac-toe');
  const gs = t.get().gameState;
  gs.board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null];
  gs.moveCount = 8;
  gs.currentTurnSeat = 0;
  t.db.updateGameRoomState(t.id, gs, 0);
  t.m.handleTicTacToeMove(t.id, 'a', 8);
  assert.equal(t.get().gameState.isDraw, true);
  assert.equal(t.get().status, 'FINISHED');
});

test('TT-5: rematch alternates the starter (seat 1 / O moves first next game)', () => {
  const t = setup('tic-tac-toe');
  const gs = t.get().gameState;
  gs.isDraw = true;
  t.db.updateGameRoomState(t.id, gs, 0);
  t.m.startGame(t.get());
  assert.equal(t.get().gameState.currentTurnSeat, 1);
  assert.equal(t.get().gameState.currentTurnMark, 'O');
  t.m.startGame(t.get()); // previous game not finished: starter unchanged
  assert.equal(t.get().gameState.currentTurnSeat, 1);
});

test('LU-13: board handlers check game type, room phase and player status', () => {
  const ttt = setup('tic-tac-toe');
  assert.throws(() => ttt.m.handleRollDice(ttt.id, 'a'), (e: any) => e.code === 'WRONG_GAME');
  assert.throws(() => ttt.m.handleMoveToken(ttt.id, 'a', 0), (e: any) => e.code === 'WRONG_GAME');
  assert.throws(() => ttt.m.handleTicTacToeMove(ttt.id, 'zzz', 0), (e: any) => e.code === 'NOT_PLAYER');
  const lu = setup('ludo');
  assert.throws(() => lu.m.handleDropDisc(lu.id, 'a', 0), (e: any) => e.code === 'WRONG_GAME');
  lu.db.updateGameRoomStatus(lu.id, 'FINISHED', undefined, new Date().toISOString());
  assert.throws(() => lu.m.handleRollDice(lu.id, 'a'), (e: any) => e.code === 'GAME_OVER');
});

// ---------- Ludo ----------
test('LU-13: a LEFT player cannot roll or move', () => {
  const t = setup('ludo');
  const r = t.get();
  const pl: any = r.players.find((p: any) => p.userId === 'a');
  pl.status = 'LEFT';
  (t.db as any).updateGameRoomPlayerStatus?.(t.id, 'a', 'LEFT');
  const stub: any = { ...r, players: r.players };
  assert.throws(() => (t.m as any).assertBoardPlayer(stub, 'a', 'ludo'), (e: any) => e.code === 'NOT_PLAYER');
});

test('LU-14: ludo rule violations reach the client as game:error with a code', () => {
  const t = setup('ludo');
  (t.m as any).handleClientMessage(t.mk('b'), { type: 'game:roll_dice' });
  assert.equal(lastError(t.msgs)?.payload.code, 'NOT_YOUR_TURN');
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:move_token', payload: { tokenId: 0 } });
  assert.equal(lastError(t.msgs)?.payload.code, 'MUST_ROLL');
  (t.m as any).handleClientMessage(t.mk('a'), { type: 'game:move_token', payload: { tokenId: '0' } });
  assert.equal(lastError(t.msgs)?.payload.code, 'MUST_ROLL'); // phase checked first
});

test('Ludo: invalid token ids are rejected as INVALID_INPUT without changing state', () => {
  const t = setup('ludo');
  const s = t.get().gameState;
  s.canRoll = false; s.diceValue = 6; s.legalMoves = [0, 1, 2, 3];
  for (const bad of [1.5, NaN, -1, 4, '0' as any, null as any, undefined as any]) {
    assert.throws(() => LudoEngine.moveToken(s, 0, bad), (e: any) => e.code === 'INVALID_INPUT', String(bad));
  }
});

test('LU-10: landing on a tile with two stacked opponent tokens captures both', () => {
  const players = [
    { userId: 'a', displayName: 'A', seat: 0, color: 'red' as const },
    { userId: 'b', displayName: 'B', seat: 1, color: 'yellow' as const }
  ];
  const s = LudoEngine.createInitialState(players, 2);
  // red step 4 -> ring 4 ; yellow step 30 -> ring (26+30)%52 = 4 (non-safe)
  s.tokens.red[0].step = 1;
  s.tokens.yellow[0].step = 30;
  s.tokens.yellow[1].step = 30;
  s.canRoll = false; s.diceValue = 3; s.legalMoves = [0];
  const res = LudoEngine.moveToken(s, 0, 0);
  assert.equal(res.state.tokens.yellow[0].step, -1);
  assert.equal(res.state.tokens.yellow[1].step, -1);
  assert.equal(res.capturedTokens?.length, 2);
  assert.equal(res.earnedBonusRoll, true);
});

test('LU-11: 4-player seat order follows the board clockwise (red, blue, yellow, green)', () => {
  assert.deepEqual(GAME_DEFINITIONS.ludo.colorAssignments[4], ['red', 'blue', 'yellow', 'green']);
});

test('LU-3 (engine half): eliminated seats are skipped when the turn advances', () => {
  const players = [
    { userId: 'a', displayName: 'A', seat: 0, color: 'red' as const },
    { userId: 'b', displayName: 'B', seat: 1, color: 'blue' as const },
    { userId: 'c', displayName: 'C', seat: 2, color: 'yellow' as const }
  ];
  const s: any = LudoEngine.createInitialState(players, 3);
  s.eliminatedSeats = [1];
  s.tokens.red[0].step = 10;
  s.canRoll = false; s.diceValue = 2; s.legalMoves = [0];
  const res = LudoEngine.moveToken(s, 0, 0);
  assert.equal(res.state.currentTurnSeat, 2);
});

test('LU-4: Ludo turn timer auto-plays an idle seat and stops when the game ends', async () => {
  const prev = process.env.LUDO_TURN_TIMEOUT_MS;
  // The constant is read at import time; drive the auto-play entry point directly instead.
  const t = setup('ludo');
  const before = t.get().gameState;
  assert.equal(before.canRoll, true);
  (t.m as any).autoPlayLudoTurn(t.id, 0);
  const after = t.get().gameState;
  assert.ok(after.diceValue !== null || after.currentTurnSeat !== 0 || after.lastDrawnDiceValue !== undefined);
  assert.ok((t.m as any).ludoTurnTimers.has(t.id), 'timer re-armed while the game runs');
  t.db.updateGameRoomStatus(t.id, 'FINISHED', undefined, new Date().toISOString());
  (t.m as any).stopLudoTurnTimer(t.id);
  assert.equal((t.m as any).ludoTurnTimers.has(t.id), false);
  if (prev !== undefined) process.env.LUDO_TURN_TIMEOUT_MS = prev;
});
