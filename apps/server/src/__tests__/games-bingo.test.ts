import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { BingoDuelEngine, publicStateFor as duelPublic } from '../games/BingoDuelEngine.js';
import { BingoEngine, DEFAULT_BINGO_CONFIG, publicStateFor as tamPublic } from '../games/BingoEngine.js';

const A = 'a';
const B = 'b';
const ids = [A, B];
const duel = (cfg: any = {}, starter = 0) => BingoDuelEngine.createInitialState('r', ids, cfg, undefined, starter) as any;
const tambola = (cfg: any = {}) =>
  BingoEngine.createInitialState([{ userId: A, displayName: 'Ann' }, { userId: B, displayName: 'Bob' }], BingoEngine.sanitizeConfig(cfg)) as any;

// ---------------- Bingo Duel engine ----------------
test('BD-1/BD-4 set_board is rejected once the match is running, after calls and when finished', () => {
  const s = duel({ pattern: 'firstRow' });
  BingoDuelEngine.selectNumber(s, A, 25, ids);
  const crafted = [[25, 3, 17, 9, 11], [1, 2, 4, 5, 6], [7, 8, 10, 12, 13], [14, 15, 16, 18, 19], [20, 21, 22, 23, 24]];
  const before = JSON.stringify(s.boards[B]);
  const r = BingoDuelEngine.setPlayerBoard(s, B, crafted, ids);
  assert.equal(r.success, false);
  assert.equal(JSON.stringify(s.boards[B]), before);
  s.phase = 'FINISHED';
  assert.equal(BingoDuelEngine.setPlayerBoard(s, B, crafted, ids).success, false);
  assert.equal(s.phase, 'FINISHED');
});

test('BD-20 setPlayerBoard (setup phase) requires 5 arrays of 5 integers', () => {
  const s = duel();
  s.phase = 'SETUP';
  const ragged = [Array.from({ length: 25 }, (_, i) => i + 1), [], [], [], []];
  assert.equal(BingoDuelEngine.setPlayerBoard(s, A, ragged as any, ids).success, false);
  const floats = BingoDuelEngine.generateBoard().map(r => r.map(n => n));
  floats[0][0] = 1.5;
  assert.equal(BingoDuelEngine.setPlayerBoard(s, A, floats, ids).success, false);
  assert.equal(BingoDuelEngine.setPlayerBoard(s, A, BingoDuelEngine.generateBoard(), ids).success, true);
});

test('BD-2 a claim is only valid while PLAYING: one winner per round, no claims after the match ended', () => {
  const s = duel({ pattern: 'anyRow', mode: 'classic' });
  // give both players the same board so both complete on the same pick
  s.boards[B] = s.boards[A].map((r: number[]) => [...r]);
  for (const n of s.boards[A][0]) {
    const pickerId = s.currentTurnUserId;
    BingoDuelEngine.selectNumber(s, pickerId, n, ids);
  }
  const first = BingoDuelEngine.claimBingo(s, A, 'Ann', { [A]: 'Ann', [B]: 'Bob' });
  assert.equal(s.phase, 'FINISHED');
  const winner = s.winnerUserId;
  const second = BingoDuelEngine.claimBingo(s, B, 'Bob', { [A]: 'Ann', [B]: 'Bob' });
  assert.equal(second.valid, false);
  assert.equal(s.winnerUserId, winner, 'late claim must not overwrite the winner');
  assert.equal(s.roundHistory.length, 1);
  assert.ok(first.winnerUserId === winner);
});

test('BD-13 simultaneous completion: the player who picked the completing number wins, whoever claims first', () => {
  const s = duel({ pattern: 'firstRow' }, 0);
  s.boards[B] = s.boards[A].map((r: number[]) => [...r]);
  const row = s.boards[A][0];
  // A and B alternate; make the LAST pick of the row be made by B
  const others = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].filter(n => !row.includes(n));
  // pick fillers so that turns line up: the row numbers get called last
  const order = [...others.slice(0, 0), ...row];
  // ensure B makes the final pick: if A would, insert one filler pick first
  const turnsNeeded = order.length;
  const finalPicker = (s.currentTurnUserId === A ? (turnsNeeded % 2 === 1 ? A : B) : (turnsNeeded % 2 === 1 ? B : A));
  if (finalPicker !== B) order.unshift(others[0]);
  for (const n of order) BingoDuelEngine.selectNumber(s, s.currentTurnUserId, n, ids);
  assert.equal(s.callerUserId, B);
  const r = BingoDuelEngine.claimBingo(s, A, 'Ann', { [A]: 'Ann', [B]: 'Bob' });
  assert.equal(r.winnerUserId, B);
  assert.equal(s.winnerUserId, B);
});

test('BD-4 next_round only works from ROUND_OVER', () => {
  const s = duel({ mode: 'bestOf3', pattern: 'firstRow' });
  const marksBefore = JSON.stringify(s.playerMarks);
  const round = s.currentRound;
  BingoDuelEngine.startNextRound(s);
  assert.equal(s.currentRound, round, 'mid-round next_round is a no-op');
  assert.equal(JSON.stringify(s.playerMarks), marksBefore);
  s.phase = 'FINISHED';
  BingoDuelEngine.startNextRound(s);
  assert.equal(s.phase, 'FINISHED');
  s.phase = 'ROUND_OVER';
  const starter = s.roundStarterUserId;
  BingoDuelEngine.startNextRound(s);
  assert.equal(s.phase, 'PLAYING');
  assert.equal(s.currentRound, round + 1);
  assert.notEqual(s.roundStarterUserId, starter, 'BD-21 starter alternates');
});

test('BD-7 select_number rejects fractional / NaN / out of range numbers', () => {
  const s = duel();
  for (const bad of [3.5, NaN, 0, 26, Infinity, -1]) {
    const r = BingoDuelEngine.selectNumber(s, s.currentTurnUserId, bad, ids);
    assert.equal(r.success, false, String(bad));
  }
  assert.equal(s.calledNumbers.length, 0);
  assert.equal(BingoDuelEngine.selectNumber(s, 'stranger', 3, ids).success, false);
});

test('BD-17 mark is idempotent (never un-marks), only called numbers, only while PLAYING', () => {
  const s = duel({ pattern: 'anyRow' });
  BingoDuelEngine.selectNumber(s, s.currentTurnUserId, 7, ids);
  assert.ok(s.playerMarks[A].includes(7));
  BingoDuelEngine.markNumber(s, A, 7);
  assert.deepEqual(s.playerMarks[A], [7]);
  assert.equal(BingoDuelEngine.markNumber(s, A, 9).success, false, 'uncalled');
  assert.equal(BingoDuelEngine.markNumber(s, 'stranger', 7).success, false);
  s.phase = 'FINISHED';
  assert.equal(BingoDuelEngine.markNumber(s, A, 7).success, false);
});

test('BD-11 callNext marks boards for every player', () => {
  const s = duel({ pattern: 'anyRow' });
  const r = BingoDuelEngine.callNext(s);
  assert.ok(r.calledNumber);
  assert.deepEqual(s.playerMarks[A], [r.calledNumber]);
  assert.deepEqual(s.playerMarks[B], [r.calledNumber]);
});

test('BD-12 when all 25 numbers are called and nobody can win the round resolves (no deadlock)', () => {
  const s = duel({ pattern: 'custom', customPattern: Array.from({ length: 5 }, () => [true, false, false, false, false]) });
  // custom with a single column of 5 cells completes on a full board, so force an unwinnable state by hand
  s.config.customPattern = Array.from({ length: 5 }, () => new Array(5).fill(false));
  for (let n = 1; n <= 25; n++) BingoDuelEngine.selectNumber(s, s.currentTurnUserId, n, ids);
  assert.equal(s.phase, 'FINISHED');
  assert.equal(s.winnerUserId, null);
});

test('BD-19 config is validated', () => {
  assert.throws(() => BingoDuelEngine.sanitizeConfig({ pattern: 'bogus' }));
  assert.throws(() => BingoDuelEngine.sanitizeConfig({ mode: 'weird' }));
  assert.throws(() => BingoDuelEngine.sanitizeConfig({ falseBingoPenalty: -5 }));
  assert.throws(() => BingoDuelEngine.sanitizeConfig({ falseBingoPenalty: 1e9 }));
  assert.throws(() => BingoDuelEngine.sanitizeConfig({ pattern: 'custom', customPattern: Array.from({ length: 5 }, () => new Array(5).fill(false)) }));
  assert.throws(() => BingoDuelEngine.sanitizeConfig('x'));
  const ok: any = BingoDuelEngine.sanitizeConfig({ pattern: 'anyRow', evil: 1 });
  assert.equal(ok.pattern, 'anyRow');
  assert.equal('evil' in ok, false);
});

test('BD-3 duel publicStateFor hides opponent board, future queue and opponent marks', () => {
  const s = duel({ pattern: 'anyRow' });
  BingoDuelEngine.selectNumber(s, s.currentTurnUserId, 5, ids);
  const p: any = duelPublic(s, A);
  assert.deepEqual(Object.keys(p.boards), [A]);
  assert.deepEqual(p.callQueue, []);
  assert.equal(p.remainingCount, 24);
  assert.equal(p.playerMarks[B], undefined);
  assert.equal(p.markedCounts[B], 1);
  assert.equal(p.playerProgress[B].matchedIndices, undefined);
  assert.ok(s.callQueue.length === 24 && s.boards[B], 'input untouched');
  assert.deepEqual(Object.keys((duelPublic(s, 'spectator') as any).boards), []);
  assert.deepEqual(Object.keys((duelPublic(s, null) as any).boards), []);
});

// ---------------- Tambola engine ----------------
test('TA ticket generation always yields valid 90-ball tickets', () => {
  for (let i = 0; i < 300; i++) {
    const t = BingoEngine.generateTambolaTicket();
    assert.ok(BingoEngine.isValidTambolaTicket(t), JSON.stringify(t));
  }
  const q = BingoEngine.generateCallQueue('90-ball');
  assert.equal(new Set(q).size, 90);
  assert.equal(Math.min(...q), 1);
  assert.equal(Math.max(...q), 90);
});

test('TA-1 tambola publicStateFor hides other tickets, draw order and other marks', () => {
  const s = tambola();
  BingoEngine.callNext(s);
  const p: any = tamPublic(s, A);
  assert.deepEqual(Object.keys(p.tickets), [A]);
  assert.deepEqual(p.callQueue, []);
  assert.equal(p.remainingCount, 89);
  assert.equal(p.playerMarked[B], undefined);
  assert.equal(p.markedCounts[B], 0);
  assert.equal(s.callQueue.length, 89, 'input untouched');
  assert.deepEqual(Object.keys((tamPublic(s, 'spectator') as any).tickets), []);
});

test('TA-4 claims are rejected after the game finished and the result cannot change', () => {
  const s = tambola();
  s.calledNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  s.callQueue = [];
  assert.equal(BingoEngine.validateClaim(s, A, 'Ann', 'housefull').valid, true);
  assert.equal(s.phase, 'FINISHED');
  const scores = JSON.stringify(s.scores);
  const r = BingoEngine.validateClaim(s, B, 'Bob', 'topLine');
  assert.equal(r.valid, false);
  assert.equal(JSON.stringify(s.scores), scores);
});

test('TA-6 winner name/ties are derived from the top scorer, housefull claimer wins ties', () => {
  const s = tambola({ winConditions: { early5: true, topLine: true, middleLine: true, bottomLine: true, fourCorners: true, housefull: true }, points: { early5: 20, topLine: 20, middleLine: 20, bottomLine: 20, fourCorners: 20, housefull: 100 } });
  s.calledNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  for (const c of ['early5', 'topLine', 'middleLine', 'bottomLine', 'fourCorners'] as const) {
    assert.equal(BingoEngine.validateClaim(s, A, 'Ann', c).valid, true);
  }
  assert.equal(BingoEngine.validateClaim(s, B, 'Bob', 'housefull').valid, true);
  assert.equal(s.scores[A], 100);
  assert.equal(s.scores[B], 100);
  assert.equal(s.winnerUserId, B, 'tie goes to the housefull claimer');
  assert.equal(s.winnerDisplayName, 'Bob');
  const s2 = tambola();
  s2.calledNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  BingoEngine.validateClaim(s2, A, 'Ann', 'early5');
  BingoEngine.validateClaim(s2, A, 'Ann', 'topLine');
  BingoEngine.validateClaim(s2, A, 'Ann', 'middleLine');
  BingoEngine.validateClaim(s2, A, 'Ann', 'bottomLine');
  BingoEngine.validateClaim(s2, A, 'Ann', 'fourCorners');
  BingoEngine.validateClaim(s2, B, 'Bob', 'housefull');
  assert.equal(s2.winnerUserId, B);
  assert.equal(s2.winnerDisplayName, 'Bob');
  assert.equal(s2.scores[A] > 0, true);
});

test('TA-7 unsupported / empty-target prizes cannot be claimed with zero numbers called', () => {
  const s = tambola();
  s.config.winConditions.xPattern = true; // bypass the sanitizer on purpose
  const r = BingoEngine.validateClaim(s, A, 'Ann', 'xPattern' as any);
  assert.equal(r.valid, false);
  assert.equal(s.scores[A], 0);
  assert.throws(() => BingoEngine.sanitizeConfig({ winConditions: { xPattern: true } }));
});

test('TA-8 mark only accepts called numbers on the caller\'s own ticket, idempotently, while PLAYING', () => {
  const s = tambola();
  BingoEngine.callNext(s);
  const called = s.currentNumber as number;
  const mine: number[] = s.tickets[A].cells.flat().filter((n: any) => n !== null);
  const notMine = Array.from({ length: 90 }, (_, i) => i + 1).find(n => !mine.includes(n))!;
  BingoEngine.markNumber(s, A, 999);
  BingoEngine.markNumber(s, A, NaN);
  BingoEngine.markNumber(s, A, notMine);
  BingoEngine.markNumber(s, 'zzz', called);
  assert.deepEqual(s.playerMarked[A], []);
  assert.equal(s.playerMarked['zzz'], undefined);
  // an on-ticket number that was not called yet
  const uncalled = mine.find(n => !s.calledNumbers.includes(n))!;
  BingoEngine.markNumber(s, A, uncalled);
  assert.deepEqual(s.playerMarked[A], []);
  // mark a called number on my ticket
  s.calledNumbers.push(mine.find(n => !s.calledNumbers.includes(n))!);
  const c2 = s.calledNumbers[s.calledNumbers.length - 1];
  BingoEngine.markNumber(s, A, c2, true);
  BingoEngine.markNumber(s, A, c2, true);
  assert.deepEqual(s.playerMarked[A], [c2]);
  BingoEngine.markNumber(s, A, c2, false);
  BingoEngine.markNumber(s, A, c2, false);
  assert.deepEqual(s.playerMarked[A], []);
  s.phase = 'FINISHED';
  BingoEngine.markNumber(s, A, c2, true);
  assert.deepEqual(s.playerMarked[A], []);
});

test('TA-9 config is validated (speed, winConditions, mode, points)', () => {
  assert.throws(() => BingoEngine.sanitizeConfig({ callingSpeed: 'abc' }));
  assert.throws(() => BingoEngine.sanitizeConfig({ callingSpeed: NaN }));
  assert.throws(() => BingoEngine.sanitizeConfig({ callingSpeed: 5 }));
  assert.throws(() => BingoEngine.sanitizeConfig({ winConditions: null }));
  assert.throws(() => BingoEngine.sanitizeConfig({ mode: '75-ball' }));
  assert.throws(() => BingoEngine.sanitizeConfig({ points: { housefull: -5 } }));
  assert.throws(() => BingoEngine.sanitizeConfig({ falseClaimPenalty: NaN }));
  const ok = BingoEngine.sanitizeConfig({ callingSpeed: 1500 });
  assert.equal(ok.callingSpeed, 1500);
  assert.equal(ok.mode, '90-ball');
  // createInitialState itself never trusts its config either
  assert.throws(() => BingoEngine.createInitialState([{ userId: A, displayName: 'A' }], { ...DEFAULT_BINGO_CONFIG, mode: '75-ball' as any }));
  const s = BingoEngine.createInitialState([{ userId: A, displayName: 'A' }], DEFAULT_BINGO_CONFIG);
  assert.equal(s.mode, '90-ball');
  assert.equal(s.tickets[A].cells.length, 3);
});

test('TA-19 running out of numbers finishes the game with a summary', () => {
  const s = tambola({ winConditions: { housefull: false, topLine: true } });
  s.callQueue = [];
  const r = BingoEngine.callNext(s);
  assert.equal(r.isFinished, true);
  assert.equal(s.phase, 'FINISHED');
  assert.ok(s.gameSummary);
});

// ---------------- handler level ----------------
function setup(gameType: 'bingo' | 'tambola') {
  const db = new DatabaseService(':memory:');
  const mgr = new GameRoomManager(db as any);
  const mk = (id: string) => ({ id, displayName: id.toUpperCase() });
  for (const id of ['host', 'guest', 'spec']) {
    try { (db as any).createUser({ id, email: `${id}@x.test`, displayName: id.toUpperCase(), passwordHash: 'x' }); } catch {}
  }
  const room = mgr.createGameRoom({ hostUser: mk('host'), gameType: gameType as any, maxPlayers: 2 });
  const logs: Record<string, any[]> = { host: [], guest: [], spec: [] };
  const attach = (id: string) => {
    const sock: any = { readyState: 1, send(m: string) { logs[id].push(JSON.parse(m)); }, close() {}, on() {} };
    mgr.registerClient(sock, room.id, mk(id));
  };
  attach('host');
  mgr.joinRoom(room.roomCode, mk('guest'));
  attach('guest');
  return { db, mgr, room, logs, attach };
}
const stop = (mgr: any, id: string) => mgr.stopBingoAutoCall(id);
const errs = (log: any[]) => log.filter(m => m.type === 'bingo:error');

test('BD-3/TA-1 handlers never send other players\' boards/tickets or the future queue', () => {
  for (const type of ['bingo', 'tambola'] as const) {
    const { db, mgr, room, logs } = setup(type);
    if (type === 'tambola') mgr.handleBingoStart(room.id, 'host');
    const gs: any = db.getGameRoomById(room.id)!.gameState;
    assert.ok(gs, type);
    if (type === 'bingo') {
      const turn = gs.currentTurnUserId;
      mgr.handleBingoSelectNumber(room.id, turn, 7);
      mgr.handleBingoMark(room.id, turn, 7);
    } else {
      mgr.tickBingoAutoCall(room.id);
      mgr.handleBingoMark(room.id, 'guest', 99);
    }
    const final: any = db.getGameRoomById(room.id)!.gameState;
    for (const [viewer, other] of [['host', 'guest'], ['guest', 'host']]) {
      const text = JSON.stringify(logs[viewer]);
      if (type === 'bingo') {
        assert.ok(!text.includes(JSON.stringify(final.boards[other])), `${viewer} saw ${other}'s board in ${logs[viewer].filter(m => JSON.stringify(m).includes(JSON.stringify(final.boards[other]))).map(m => m.type)}`);
      } else {
        assert.ok(!text.includes(JSON.stringify(final.tickets[other])), `${viewer} saw ${other}'s ticket`);
      }
      assert.ok(!/"callQueue":\[\d/.test(text), `${viewer} saw the call queue`);
    }
    stop(mgr, room.id);
  }
});

test('BD-1/BD-2/BD-4 handlers: set_board mid-game, next_round mid-round and late claims are rejected with feedback', () => {
  const { db, mgr, room, logs } = setup('bingo');
  const gs0: any = db.getGameRoomById(room.id)!.gameState;
  const other = gs0.currentTurnUserId === 'host' ? 'guest' : 'host';
  mgr.handleBingoSetBoard(room.id, other, BingoDuelEngine.generateBoard());
  assert.ok(errs(logs[other]).length >= 1);
  mgr.handleBingoNextRound(room.id, 'host');
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).currentRound, 1);
  assert.ok(errs(logs.host).length >= 1);
  // outsider cannot act
  mgr.handleBingoSelectNumber(room.id, 'spec', 3);
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).calledNumbers.length, 0);
  stop(mgr, room.id);
});

test('TA-10/BD-8 bingo:start is host only and only from WAITING with 2+ players', () => {
  const { db, mgr, room, logs } = setup('tambola');
  mgr.handleBingoStart(room.id, 'guest');
  assert.ok(errs(logs.guest).length >= 1);
  assert.equal(db.getGameRoomById(room.id)!.gameState == null, true);
  mgr.handleBingoStart(room.id, 'host');
  const t1: any = db.getGameRoomById(room.id)!.gameState;
  assert.ok(t1);
  mgr.handleBingoStart(room.id, 'host'); // restart attempt
  const t2: any = db.getGameRoomById(room.id)!.gameState;
  assert.equal(JSON.stringify(t2.tickets), JSON.stringify(t1.tickets));
  assert.ok(errs(logs.host).length >= 1);
  stop(mgr, room.id);
});

test('BD-6/TA-16 host config is persisted and validated server side', () => {
  const { db, mgr, room, logs } = setup('tambola');
  mgr.handleBingoConfigUpdate(room.id, 'host', { callingSpeed: 'abc' });
  assert.ok(errs(logs.host).length >= 1);
  mgr.handleBingoConfigUpdate(room.id, 'host', { callingSpeed: 2000, falseClaimPenalty: 5 });
  mgr.handleBingoStart(room.id, 'host');
  const gs: any = db.getGameRoomById(room.id)!.gameState;
  assert.equal(gs.config.callingSpeed, 2000);
  assert.equal(gs.config.falseClaimPenalty, 5);
  mgr.handleBingoConfigUpdate(room.id, 'guest', { callingSpeed: 900 });
  assert.ok(errs(logs.guest).length >= 1);
  stop(mgr, room.id);
});

test('TA-4 handler: claims after game over are rejected with feedback and do not change the result', () => {
  const { db, mgr, room, logs } = setup('tambola');
  mgr.handleBingoStart(room.id, 'host');
  const gs: any = db.getGameRoomById(room.id)!.gameState;
  gs.calledNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  gs.callQueue = [];
  db.updateGameRoomState(room.id, gs);
  mgr.handleBingoClaim(room.id, 'host', 'housefull');
  const done: any = db.getGameRoomById(room.id)!.gameState;
  assert.equal(done.phase, 'FINISHED');
  const scores = JSON.stringify(done.scores);
  mgr.handleBingoClaim(room.id, 'guest', 'topLine');
  assert.equal(JSON.stringify((db.getGameRoomById(room.id)!.gameState as any).scores), scores);
  assert.ok(errs(logs.guest).length >= 1);
  assert.equal((mgr as any).bingoTimers.has(room.id), false, 'timer stopped when the game ended');
});

test('TA-5 ensureBingoTimer re-arms the draw timer and the timer stops once nobody is connected', () => {
  const { db, mgr, room } = setup('tambola');
  mgr.handleBingoStart(room.id, 'host');
  stop(mgr, room.id);
  assert.equal((mgr as any).bingoTimers.has(room.id), false);
  mgr.ensureBingoTimer(room.id);
  assert.equal((mgr as any).bingoTimers.has(room.id), true);
  // everybody disconnects: next tick stops the timer
  (mgr as any).roomClients.set(room.id, new Set());
  mgr.tickBingoAutoCall(room.id);
  assert.equal((mgr as any).bingoTimers.has(room.id), false);
  void db;
});

test('BD-14 an idle turn is auto-picked after the turn timeout', () => {
  const { db, mgr, room } = setup('bingo');
  const gs: any = db.getGameRoomById(room.id)!.gameState;
  const idle = gs.currentTurnUserId;
  gs.turnStartedAt = Date.now() - 60_000;
  db.updateGameRoomState(room.id, gs);
  mgr.tickBingoAutoCall(room.id);
  const after: any = db.getGameRoomById(room.id)!.gameState;
  assert.equal(after.calledNumbers.length, 1);
  assert.notEqual(after.currentTurnUserId, idle);
  stop(mgr, room.id);
});
