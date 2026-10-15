import './_noRealDb.js'; // never reach a real database from tests
// NOTE: the mongo module reads ./.env on import; the manager's streak recorder is stubbed in setup() so no connection is made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DoodleDuelEngine, DEFAULT_DOODLE_CONFIG, DOODLE_LIMITS } from '../games/DoodleDuelEngine.js';

const SECRET = 'Zyxwvutsrq';

function mkState(over: any = {}) {
  const s: any = DoodleDuelEngine.createInitialState(
    [{ userId: 'a', displayName: 'A' }, { userId: 'b', displayName: 'B' }],
    { ...DEFAULT_DOODLE_CONFIG, ...over }
  );
  DoodleDuelEngine.startRoundIntro(s, 'a', 'b');
  s.drawerDisplayName = 'A';
  s.guesserDisplayName = 'B';
  return s;
}
function drawing(word = 'Elephant', over: any = {}) {
  const s = mkState(over);
  DoodleDuelEngine.startDrawing(s, { word, icon: 'x', category: 'Animals', difficulty: 'easy', hint: 'big' });
  return s;
}

// ---------- engine ----------
test('DD-2 publicStateFor hides the secret from guesser/spectator, shows it to drawer and after the round', () => {
  const s = drawing(SECRET);
  assert.equal(DoodleDuelEngine.publicStateFor(s, 'a').secretWord, SECRET);
  for (const v of ['b', 'spectator', null, undefined]) {
    const p = DoodleDuelEngine.publicStateFor(s, v as any);
    assert.ok(!JSON.stringify(p).includes(SECRET), `leak for ${v}`);
    assert.equal(p.hint, null);
  }
  assert.equal(s.secretWord, SECRET, 'input not mutated');
  s.phase = 'ROUND_RESULT';
  assert.equal(DoodleDuelEngine.publicStateFor(s, 'b').secretWord, SECRET);
});

test('DD-3 drawer cannot guess; only the guesser can', () => {
  const s = drawing('Elephant');
  const r = DoodleDuelEngine.submitGuess(s, 'a', 'A', 'elephant');
  assert.equal(r.rejected, 'not_guesser');
  assert.equal(s.phase, 'DRAWING');
  assert.deepEqual(s.scores, { a: 0, b: 0 });
  assert.equal(DoodleDuelEngine.submitGuess(s, 'spectator', 'S', 'elephant').rejected, 'not_guesser');
  assert.equal(DoodleDuelEngine.submitGuess(s, 'b', 'B', 'elephant').isCorrect, true);
});

test('DD-8/DD-16/DD-19 guess matching and validation', () => {
  const s = drawing('Élephant');
  assert.equal(DoodleDuelEngine.submitGuess(s, 'b', 'B', undefined as any).rejected, 'invalid');
  assert.equal(DoodleDuelEngine.submitGuess(s, 'b', 'B', '   ').rejected, 'empty');
  assert.equal(DoodleDuelEngine.submitGuess(s, 'b', 'B', '!!!').rejected, 'empty');
  assert.equal(s.guesses.length, 0);
  const long = DoodleDuelEngine.submitGuess(s, 'b', 'B', 'x'.repeat(5000));
  assert.ok(s.guesses[0].text.length <= DOODLE_LIMITS.maxGuessLength);
  assert.equal(long.isCorrect, false);
  assert.equal(DoodleDuelEngine.submitGuess(s, 'b', 'B', 'x'.repeat(5000)).rejected, 'duplicate');
  assert.ok(DoodleDuelEngine.checkGuess('  ELEPHANT ', 'Élephant'));
  assert.ok(DoodleDuelEngine.checkGuess('elephants', 'Elephant'));
  assert.ok(DoodleDuelEngine.checkGuess('日本', '日本'));
  assert.ok(DoodleDuelEngine.checkGuess('Ice-cream!', 'ice cream'));
  assert.equal(DoodleDuelEngine.checkGuess('', '!!!'), false);
  assert.equal(DoodleDuelEngine.checkGuess('!!!', '!!!'), false);
});

test('DD-8 guess cap per round and DD-19 no guesses after round end', () => {
  const s = drawing('Elephant');
  for (let i = 0; i < DOODLE_LIMITS.maxGuessesPerRound; i++) DoodleDuelEngine.submitGuess(s, 'b', 'B', `wrong${i}`);
  assert.equal(DoodleDuelEngine.submitGuess(s, 'b', 'B', 'another').rejected, 'too_many');
  const s2 = drawing('Elephant');
  s2.phase = 'ROUND_RESULT';
  assert.equal(DoodleDuelEngine.submitGuess(s2, 'b', 'B', 'elephant').rejected, 'not_guessing');
  assert.equal(s2.guesses.length, 0);
});

test('DD-20 time bonus is measured across the whole round, never negative', () => {
  const s = drawing('Elephant', { drawTime: 60, guessTime: 60 });
  s.timeRemaining = 1; // DRAWING, 59s used
  const late = DoodleDuelEngine.submitGuess(s, 'b', 'B', 'elephant');
  const g = drawing('Elephant', { drawTime: 60, guessTime: 60 });
  DoodleDuelEngine.startGuessing(g);
  g.timeRemaining = 59; // 61s of the round used
  const lateG = DoodleDuelEngine.submitGuess(g, 'b', 'B', 'elephant');
  assert.ok(lateG.points <= late.points, `61s into the round (${lateG.points}) must not outscore 59s (${late.points})`);
  assert.ok(lateG.points < 100);
  assert.ok((Object.values(g.scores) as number[]).every(v => v >= 0));
  assert.equal(DoodleDuelEngine.calculatePoints(1000, 'time_based', true), 10);
});

test('DD-13 tie has no winner; unique leader recorded with name', () => {
  const s = mkState({ rounds: 2 });
  s.round = 2; s.phase = 'ROUND_RESULT';
  DoodleDuelEngine.advanceToNextRound(s);
  assert.equal(s.phase, 'FINISHED');
  assert.equal(s.finalWinnerUserId, null);
  const t = mkState({ rounds: 2 });
  t.round = 2; t.scores.b = 150;
  DoodleDuelEngine.advanceToNextRound(t);
  assert.equal(t.finalWinnerUserId, 'b');
  assert.equal(t.finalWinnerDisplayName, 'B');
});

test('DD-9 config sanitising (strings, NaN, huge values, odd rounds, bad custom words)', () => {
  const c = DoodleDuelEngine.sanitizeConfig({
    drawTime: 'abc', guessTime: 1e9, rounds: 7, customWords: 'str', difficulty: 'nope', scoringMode: {}, useCustomWords: 'yes'
  });
  assert.equal(c.drawTime, 60);
  assert.equal(c.guessTime, 60);
  assert.equal(c.rounds, 8);
  assert.deepEqual(c.customWords, []);
  assert.equal(c.difficulty, 'mixed');
  assert.equal(c.useCustomWords, false);
  assert.equal(DoodleDuelEngine.sanitizeConfig({ rounds: -5 }).rounds, 2);
  assert.equal(DoodleDuelEngine.sanitizeConfig({ rounds: NaN }).rounds, 6);
  const w = DoodleDuelEngine.sanitizeConfig({ customWords: ['ok', '!!!', 'OK', 'x'.repeat(100), 5, '日本'] });
  assert.deepEqual(w.customWords, ['ok', '日本']);
  assert.equal(DoodleDuelEngine.createInitialState([{ userId: 'a', displayName: 'A' }], { ...DEFAULT_DOODLE_CONFIG, rounds: 2 }).totalRounds, 2);
});

test('DD-4 choose_word must be one of the offered words', () => {
  const s = mkState();
  DoodleDuelEngine.advanceToWordChoice(s);
  assert.equal(DoodleDuelEngine.resolveChosenWord(s, 'ZZZ-not-offered'), null);
  assert.equal(DoodleDuelEngine.resolveChosenWord(s, undefined), null);
  const offered = (s.wordChoices as any[])[0].word;
  assert.equal(DoodleDuelEngine.resolveChosenWord(s, ` ${offered.toUpperCase()} `)?.word.toLowerCase(), offered.toLowerCase());
});

test('DD-17/18 custom words get slots, timeout auto-pick keeps custom, hard pool does not repeat inside a game', () => {
  const cfg = { ...DEFAULT_DOODLE_CONFIG, useCustomWords: true, customWords: ['Zorblax'] };
  let seen = 0;
  for (let i = 0; i < 200; i++) if (DoodleDuelEngine.getWordChoices(cfg).some(w => w.word === 'Zorblax')) seen++;
  assert.ok(seen > 100, `custom word appeared only ${seen}/200`);

  const s = mkState({ useCustomWords: true, customWords: ['Zorblax'] });
  s.phase = 'WORD_CHOICE';
  s.wordChoices = [{ word: 'Zorblax', icon: 'x', category: 'Custom', difficulty: 'medium' }];
  s.timeRemaining = 1;
  DoodleDuelEngine.tick(s);
  assert.equal(s.phase, 'DRAWING');
  assert.equal(s.secretWord, 'Zorblax');
  assert.equal(s.secretWordCategory, 'Custom');

  const used = new Set<string>();
  const hard = { ...DEFAULT_DOODLE_CONFIG, difficulty: 'hard' as const };
  for (let r = 0; r < 6; r++) {
    const ch = DoodleDuelEngine.getWordChoices(hard, used);
    assert.equal(new Set(ch.map(c => c.word)).size, 3);
    const pick = ch[0].word.toLowerCase();
    assert.ok(!used.has(pick), `round ${r} repeated ${pick}`);
    used.add(pick);
  }
});

test('DD-5 stroke validation', () => {
  const ok = { id: 's1', color: '#ff3864', size: 5, points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] };
  assert.ok(DoodleDuelEngine.validateStroke(ok));
  assert.equal(DoodleDuelEngine.validateStroke(null), null);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, points: 'xxxxxxxxxx' }), null);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, color: 'url(javascript:)' }), null);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, size: NaN }), null);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, points: [{ x: NaN, y: 0 }] }), null);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, points: Array.from({ length: 20000 }, () => ({ x: 0, y: 0 })) }), null);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, size: 1e9 })!.size, DOODLE_LIMITS.maxStrokeSize);
  assert.equal(DoodleDuelEngine.validateStroke({ ...ok, points: [{ x: 9, y: -3 }] })!.points[0].x, 1);
  const s = drawing();
  const big = DoodleDuelEngine.validateStroke({ ...ok, points: Array.from({ length: 600 }, () => ({ x: 0.5, y: 0.5 })) })!;
  let added = 0;
  while (DoodleDuelEngine.canAddStroke(s, big)) { s.strokes.push(big); added++; }
  assert.ok(added * 600 <= DOODLE_LIMITS.maxTotalPoints);
});

test('DD-12 hint becomes available for short guess times too (half way), never during drawing', () => {
  const s = drawing('Elephant', { guessTime: 30, drawTime: 30 });
  s.timeRemaining = 2; DoodleDuelEngine.tick(s); // DRAWING 1 -> still drawing
  assert.equal(s.hintAvailable, false);
  DoodleDuelEngine.tick(s); // -> GUESSING
  assert.equal(s.phase, 'GUESSING');
  for (let i = 0; i < 16; i++) DoodleDuelEngine.tick(s);
  assert.equal(s.hintAvailable, true);
});

// ---------- handler level ----------
function setup() {
  const db = new DatabaseService(':memory:');
  const mgr = new GameRoomManager(db as any, { sweep: false });
  (mgr as any).recordGameStreaks = async () => {}; // never touch a real MongoDB from tests
  const mk = (id: string) => ({ id, displayName: id.toUpperCase() });
  for (const id of ['host', 'guest', 'spec']) {
    try { (db as any).createUser({ id, email: `${id}@x.test`, displayName: id.toUpperCase(), passwordHash: 'x' }); } catch {}
  }
  const room = mgr.createGameRoom({ hostUser: mk('host'), gameType: 'doodle-duel' as any, maxPlayers: 2 });
  mgr.joinRoom(room.roomCode, mk('guest'));
  const logs: Record<string, any[]> = { host: [], guest: [], spec: [] };
  for (const id of ['host', 'guest', 'spec']) {
    const sock: any = { readyState: 1, send(m: string) { logs[id].push(JSON.parse(m)); }, close() {}, on() {} };
    mgr.registerClient(sock, room.id, mk(id));
  }
  return { db, mgr, room, logs };
}
const cleanup = (mgr: any, roomId: string) => mgr.stopDoodleTimer(roomId);

test('DD-1 role swap mid-round by guesser or spectator is rejected and never leaks the secret', () => {
  const { db, mgr, room, logs } = setup();
  mgr.handleDoodleStart(room.id, 'host');
  const gs0: any = db.getGameRoomById(room.id)!.gameState;
  const drawer = gs0.drawerUserId;
  const guesser = gs0.guesserUserId;
  const s: any = gs0;
  DoodleDuelEngine.advanceToWordChoice(s);
  db.updateGameRoomState(room.id, s);
  mgr.handleDoodleChooseWord(room.id, drawer, s.wordChoices[0].word);
  const word = (db.getGameRoomById(room.id)!.gameState as any).secretWord;
  assert.ok(word);

  mgr.handleDoodleSelectRole(room.id, guesser, guesser);
  mgr.handleDoodleSelectRole(room.id, 'spec', 'spec');
  mgr.handleDoodleSelectRole(room.id, 'guest', 'host');
  const after: any = db.getGameRoomById(room.id)!.gameState;
  assert.equal(after.drawerUserId, drawer);
  mgr.broadcastDoodleState(room.id);
  for (const v of ['guest', 'host', 'spec']) {
    const isDrawer = v === drawer;
    const leaked = JSON.stringify(logs[v].filter(m => m.type !== 'doodle:error')).includes(word);
    if (!isDrawer) assert.equal(leaked, false, `${v} saw the secret word`);
  }
  assert.ok(logs[guesser === 'guest' ? 'guest' : 'host'].some(m => m.type === 'doodle:error'));
  cleanup(mgr, room.id);
});

test('DD-4/5/10 handlers: choose_word phase check, strokes only while drawing, restart rejected', () => {
  const { db, mgr, room, logs } = setup();
  mgr.handleDoodleStart(room.id, 'host');
  let gs: any = db.getGameRoomById(room.id)!.gameState;
  const drawer = gs.drawerUserId;
  mgr.handleDoodleChooseWord(room.id, drawer, 'Elephant'); // ROUND_INTRO: rejected
  gs = db.getGameRoomById(room.id)!.gameState;
  assert.equal(gs.phase, 'ROUND_INTRO');

  DoodleDuelEngine.advanceToWordChoice(gs); db.updateGameRoomState(room.id, gs);
  mgr.handleDoodleChooseWord(room.id, drawer, 'ZZZ-not-offered');
  mgr.handleDoodleChooseWord(room.id, drawer, undefined as any);
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).phase, 'WORD_CHOICE');
  mgr.handleDoodleChooseWord(room.id, drawer, gs.wordChoices[0].word);
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).phase, 'DRAWING');

  const stroke = { id: 'x', color: '#ff3864', size: 4, points: [{ x: 0.1, y: 0.1 }] };
  mgr.handleDoodleStroke(room.id, drawer, null);
  mgr.handleDoodleStroke(room.id, drawer, { ...stroke, color: 'url(javascript:)' });
  mgr.handleDoodleStroke(room.id, drawer, stroke);
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).strokes.length, 1);

  mgr.handleDoodleStart(room.id, 'host'); // restart mid-game
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).phase, 'DRAWING');
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).strokes.length, 1);

  mgr.handleDoodleDoneDrawing(room.id, drawer);
  mgr.handleDoodleStroke(room.id, drawer, { ...stroke, id: 'y' });
  mgr.handleDoodleClear(room.id, drawer);
  mgr.handleDoodleUndo(room.id, drawer);
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).strokes.length, 1);
  const guesser = drawer === 'host' ? 'guest' : 'host';
  assert.ok(logs[guesser === 'host' ? 'host' : 'guest'].length >= 0);
  cleanup(mgr, room.id);
});

test('DD-3/DD-19 handler: drawer guess and late guesses are rejected with an error to the sender only', () => {
  const { db, mgr, room, logs } = setup();
  mgr.handleDoodleStart(room.id, 'host');
  let gs: any = db.getGameRoomById(room.id)!.gameState;
  const drawer = gs.drawerUserId; const guesser = drawer === 'host' ? 'guest' : 'host';
  DoodleDuelEngine.startDrawing(gs, { word: 'Elephant', icon: 'x', category: 'Animals', difficulty: 'easy', hint: 'h' });
  db.updateGameRoomState(room.id, gs);
  mgr.handleDoodleGuess(room.id, drawer, 'Elephant');
  gs = db.getGameRoomById(room.id)!.gameState;
  assert.equal(gs.phase, 'DRAWING');
  assert.ok(logs[drawer].some(m => m.type === 'doodle:error' && m.payload.code === 'not_guesser'));
  assert.ok(!logs[guesser].some(m => m.type === 'doodle:error'));
  mgr.handleDoodleGuess(room.id, guesser, 'elephant');
  gs = db.getGameRoomById(room.id)!.gameState;
  assert.equal(gs.phase, 'ROUND_RESULT');
  const before = logs[guesser].filter(m => m.type === 'doodle:guess_result').length;
  mgr.handleDoodleGuess(room.id, guesser, 'elephant');
  assert.equal(logs[guesser].filter(m => m.type === 'doodle:guess_result').length, before);
  cleanup(mgr, room.id);
});

test('DD-6/DD-9/DD-10 config persists, sets totalRounds, is validated and locked after start', () => {
  const { db, mgr, room } = setup();
  mgr.handleDoodleConfigUpdate(room.id, 'guest', { rounds: 2 }); // non-host ignored
  mgr.handleDoodleConfigUpdate(room.id, 'host', { rounds: 2, drawTime: 30, guessTime: 'abc', customWords: 'str' });
  const cfg: any = (db.getGameRoomById(room.id)!.gameState as any).config;
  assert.equal(cfg.rounds, 2); assert.equal(cfg.drawTime, 30); assert.equal(cfg.guessTime, 60);
  mgr.handleDoodleSelectRole(room.id, 'host', 'drawer'); // state already exists with defaults previously
  mgr.handleDoodleStart(room.id, 'host', { rounds: 4 } as any);
  const gs: any = db.getGameRoomById(room.id)!.gameState;
  assert.equal(gs.config.rounds, 4);
  assert.equal(gs.totalRounds, 4);
  assert.equal(gs.config.drawTime, 30);
  mgr.handleDoodleConfigUpdate(room.id, 'host', { rounds: 10 });
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).config.rounds, 4);
  cleanup(mgr, room.id);
});

test('DD-25 both players choosing drawer: the host choice wins; start is host-only with error feedback', () => {
  const { db, mgr, room, logs } = setup();
  mgr.handleDoodleSelectRole(room.id, 'host', 'drawer');
  mgr.handleDoodleSelectRole(room.id, 'guest', 'drawer');
  mgr.handleDoodleStart(room.id, 'guest');
  assert.ok(logs.guest.some(m => m.type === 'doodle:error' && m.payload.code === 'not_host'));
  mgr.handleDoodleStart(room.id, 'host');
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).drawerUserId, 'host');
  cleanup(mgr, room.id);
});

test('DD-14/timer: timer stops when the room has no connected clients', () => {
  const { db, mgr, room } = setup();
  mgr.handleDoodleStart(room.id, 'host');
  assert.ok((mgr as any).doodleTimers.has(room.id));
  (mgr as any).roomClients.set(room.id, new Set());
  const t0 = (db.getGameRoomById(room.id)!.gameState as any).timeRemaining;
  mgr.tickDoodleTimer(room.id);
  assert.equal((mgr as any).doodleTimers.has(room.id), false);
  assert.equal((db.getGameRoomById(room.id)!.gameState as any).timeRemaining, t0);
});
