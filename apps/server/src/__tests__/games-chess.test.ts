import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { ChessEngine, sanitizeChessConfig } from '../games/ChessEngine.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DatabaseService } from '../db/database.js';

const W = { id: 'white', displayName: 'White' };
const B = { id: 'black', displayName: 'Black' };
const newGame = (cfg: any = { baseTimeMs: 60000, incrementMs: 0 }) => ChessEngine.initGameState('room1', W, B, cfg);
const play = (s: any, ...sans: string[]) => {
  for (const [i, m] of sans.entries()) {
    const c = new Chess(s.fen);
    const mv = c.move(m);
    const r = ChessEngine.makeMove(s, s.turn === 'w' ? 'white' : 'black', mv.from, mv.to, mv.promotion as any);
    assert.ok(r.success, `move ${i} ${m}: ${r.message}`);
  }
};

function perft(c: Chess, d: number): number {
  if (d === 0) return 1;
  let n = 0;
  for (const m of c.moves({ verbose: true })) { c.move(m); n += perft(c, d - 1); c.undo(); }
  return n;
}

test('perft: start position and Kiwipete match reference counts', () => {
  const s = new Chess();
  assert.deepEqual([1, 2, 3, 4].map(d => perft(s, d)), [20, 400, 8902, 197281]);
  const k = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  assert.deepEqual([1, 2, 3].map(d => perft(new Chess(k), d)), [48, 2039, 97862]);
});

test('CH-1 draw accept with no offer is rejected and changes nothing', () => {
  const s = newGame();
  const r = ChessEngine.respondDraw(s, 'black', true);
  assert.equal(r.success, false);
  assert.equal(s.status, 'ACTIVE');
  // offerer cannot accept their own offer
  ChessEngine.offerDraw(s, 'white');
  assert.equal(ChessEngine.respondDraw(s, 'white', true).success, false);
  assert.equal(s.status, 'ACTIVE');
  assert.equal(s.drawOfferFrom, 'white');
  // only one offer at a time
  assert.equal(ChessEngine.offerDraw(s, 'black').success, false);
  assert.equal(ChessEngine.respondDraw(s, 'black', true).accepted, true);
  assert.equal(s.status, 'DRAW');
});

test('CH-2 outsiders cannot resign/offer/respond', () => {
  const s = newGame();
  ChessEngine.resign(s, 'spectator');
  assert.equal(s.status, 'ACTIVE');
  assert.equal(ChessEngine.offerDraw(s, 'spectator').success, false);
  ChessEngine.offerDraw(s, 'white');
  assert.equal(ChessEngine.respondDraw(s, 'spectator', true).success, false);
  assert.equal(s.status, 'ACTIVE');
  play(s, 'e4');
  assert.equal(ChessEngine.requestTakeback(s, 'spectator').success, false);
});

test('CH-3 clock is charged once, CH-7 illegal moves are free, CH-22 first move is free', () => {
  const s = newGame();
  s.lastMoveTimestamp = Date.now() - 30000;
  play(s, 'e4');
  assert.equal(s.whitePlayer.timeRemainingMs, 60000); // before first move: nothing charged
  s.lastMoveTimestamp = Date.now() - 5000;
  const bad = ChessEngine.makeMove(s, 'black', 'e7', 'e2');
  assert.equal(bad.success, false);
  assert.equal(s.blackPlayer.timeRemainingMs, 60000);
  const ok = ChessEngine.makeMove(s, 'black', 'e7', 'e5');
  assert.ok(ok.success);
  assert.ok(Math.abs(s.blackPlayer.timeRemainingMs - 55000) < 200);
});

test('increment is added and flag falls on the mover', () => {
  const s = newGame({ baseTimeMs: 60000, incrementMs: 2000 });
  play(s, 'e4');
  assert.equal(s.whitePlayer.timeRemainingMs, 62000);
  s.lastMoveTimestamp = Date.now() - 61000;
  const r = ChessEngine.makeMove(s, 'black', 'e7', 'e5');
  assert.equal(s.status, 'TIMEOUT');
  assert.equal(s.winnerUserId, 'white');
  assert.equal(s.blackPlayer.timeRemainingMs, 0);
  assert.equal(r.move, undefined);
});

test('CH-4 takeback restores position, turn and clocks', () => {
  const s = newGame();
  play(s, 'e4', 'e5', 'Nf3');
  ChessEngine.requestTakeback(s, 'white');
  const r = ChessEngine.respondTakeback(s, 'black', true);
  assert.equal(r.accepted, true);
  assert.equal(s.moves.length, 2);
  assert.equal(s.turn, 'w');
  const c = new Chess(); c.move('e4'); c.move('e5');
  assert.equal(s.fen, c.fen());
  assert.equal(s.historySan.length, 2);
  // takeback to start
  const t = newGame();
  play(t, 'e4');
  ChessEngine.requestTakeback(t, 'white');
  ChessEngine.respondTakeback(t, 'black', true);
  assert.equal(t.fen, new Chess().fen());
});

test('CH-6 threefold repetition detected', () => {
  const s = newGame();
  play(s, 'Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8');
  assert.equal(s.status, 'DRAW');
  assert.equal(s.drawReason, 'threefold_repetition');
});

test('CH-8 stale offers cleared by move; no responses after game over', () => {
  const s = newGame();
  ChessEngine.offerDraw(s, 'white');
  play(s, 'e4');
  assert.equal(s.drawOfferFrom, null);
  const m = newGame();
  play(m, 'f3', 'e5', 'g4');
  ChessEngine.offerDraw(m, 'white');
  play(m, 'Qh4');
  assert.equal(m.status, 'CHECKMATE');
  assert.equal(ChessEngine.respondDraw(m, 'black', true).success, false);
  assert.equal(m.status, 'CHECKMATE');
  assert.equal(ChessEngine.respondTakeback(m, 'black', true).success, false);
  assert.equal(m.status, 'CHECKMATE');
});

test('CH-9 config is whitelisted and clamped', () => {
  const c = sanitizeChessConfig({ baseTimeMs: -5, incrementMs: -1e9, evil: 1, allowTakeback: 'yes' });
  assert.equal(c.baseTimeMs, 10000);
  assert.equal(c.incrementMs, 0);
  assert.equal((c as any).evil, undefined);
  assert.equal(c.allowTakeback, true);
  assert.equal(sanitizeChessConfig({ baseTimeMs: 'abc' }).baseTimeMs, 600000);
  assert.equal(sanitizeChessConfig({ baseTimeMs: 1e15 }).baseTimeMs, 3 * 3600 * 1000);
  assert.equal(sanitizeChessConfig({ presetId: 'bullet-1-0' }).baseTimeMs, 60000);
  const s = newGame({ baseTimeMs: NaN });
  assert.equal(s.whitePlayer.timeRemainingMs, 600000);
});

test('payload validation: bad squares / promotion rejected', () => {
  const s = newGame();
  for (const [f, t] of [['e9', 'e4'], ['', 'e4'], ['e2', 'z4'], [{} as any, 'e4'], ['e2e', 'e4']]) {
    assert.equal(ChessEngine.makeMove(s, 'white', f as any, t as any).success, false);
  }
  assert.equal(ChessEngine.makeMove(s, 'white', 'e2', 'e4', 'k' as any).success, false);
  assert.equal(ChessEngine.makeMove(s, 'black', 'e7', 'e5').success, false); // not your turn
  assert.equal(s.moves.length, 0);
});

test('CH-15 timeout vs insufficient material follows FIDE', () => {
  const t = (fen: string, flagged: 'w' | 'b') => {
    const s = newGame();
    s.fen = fen;
    s.turn = flagged;
    ChessEngine.handleTimeout(s, flagged);
    return s.status;
  };
  // winner (white) K+N vs flagger (black) K+Q -> win on time
  assert.equal(t('4k2q/8/8/8/8/8/8/4KN2 b - - 0 1', 'b'), 'TIMEOUT');
  // winner K+B vs flagger K+P -> win
  assert.equal(t('4k3/4p3/8/8/8/8/8/4KB2 b - - 0 1', 'b'), 'TIMEOUT');
  // winner K+2N vs K+R -> win
  assert.equal(t('4k2r/8/8/8/8/8/8/3NKN2 b - - 0 1', 'b'), 'TIMEOUT');
  // winner bare king -> draw
  assert.equal(t('4k2q/8/8/8/8/8/8/4K3 b - - 0 1', 'b'), 'DRAW'); // winner has bare king
  assert.equal(t('4k3/8/8/8/8/8/8/4KN2 b - - 0 1', 'b'), 'DRAW'); // K+N vs bare K
});

// ---------- handler level ----------
function setup() {
  const db = new DatabaseService(':memory:');
  const mgr: any = new GameRoomManager(db);
  const s = newGame();
  db.createGameRoom({
    id: 'room1', roomCode: 'CHESS-TEST', gameType: 'chess', hostUserId: 'white', maxPlayers: 2, minPlayers: 2,
    isPrivate: true, status: 'PLAYING', players: [], gameState: s, createdAt: new Date().toISOString()
  } as any);
  db.updateGameRoomStatus('room1', 'PLAYING', new Date().toISOString());
  const sent: any[] = [];
  mgr.broadcast = (_r: string, m: any) => { sent.push(m); };
  return { db, mgr, sent };
}

test('CH-1/CH-2 handler: stray draw accept & outsider resign leave the room playing', () => {
  const { db, mgr, sent } = setup();
  mgr.handleChessDrawResponse('room1', 'black', true);
  mgr.handleChessResign('room1', 'spectator');
  assert.equal(db.getGameRoomById('room1')!.status, 'PLAYING');
  assert.equal(sent.length, 0);
  mgr.handleChessMove('room1', 'white', 'e2', 'e4');
  assert.equal(sent.at(-1).type, 'chess:move_accepted');
  mgr.stopChessClock('room1');
});

test('CH-8 handler: no moves after resignation and game_over sent once', () => {
  const { db, mgr, sent } = setup();
  mgr.handleChessResign('room1', 'white');
  assert.equal(db.getGameRoomById('room1')!.status, 'FINISHED');
  assert.equal(sent.filter(m => m.type === 'chess:game_over').length, 1);
  mgr.handleChessResign('room1', 'black');
  mgr.handleChessDrawResponse('room1', 'black', true);
  assert.equal(sent.filter(m => m.type === 'chess:game_over').length, 1);
});

test('CH-9 handler: chess:start cannot restart a live game', () => {
  const { db, mgr } = setup();
  const before = db.getGameRoomById('room1')!.gameState.gameId;
  mgr.handleChessStart('room1', 'white', { baseTimeMs: -5 });
  assert.equal(db.getGameRoomById('room1')!.gameState.gameId, before);
});

test('CH-13 ensureChessClock starts a ticker for a persisted PLAYING game', () => {
  const { mgr } = setup();
  assert.equal(mgr.chessTimers.has('room1'), false);
  mgr.ensureChessClock('room1');
  assert.equal(mgr.chessTimers.has('room1'), true);
  mgr.stopChessClock('room1');
  assert.equal(mgr.chessTimers.has('room1'), false);
});
