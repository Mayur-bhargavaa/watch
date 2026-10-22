import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { RpsEngine, beats, CHOICES, DEFAULT_RPS_CONFIG, type RpsSecret } from '../games/RpsEngine.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DatabaseService } from '../db/database.js';
import type { RpsChoice, RpsGameState } from '@synccinema/common';

const P = [
  { userId: 'a', displayName: 'A', seat: 0 },
  { userId: 'b', displayName: 'B', seat: 1 }
];
const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const T0 = 1_700_000_000_000;
const cfg = DEFAULT_RPS_CONFIG;
const code = (c: string) => (e: unknown) => e instanceof GameRuleError && e.code === c;

type Run = { s: RpsGameState; sec: RpsSecret | null; now: number };
function start(format: string = 'best-of-3'): Run {
  const m = RpsEngine.createMatch(P, { now: T0, format, matchId: 'm' });
  return { s: m.state, sec: m.secret, now: T0 };
}
/** jump to the end of the current phase and advance */
function tick(r: Run, extra = 30): Run {
  const now = Date.parse(r.s.deadlineAt as string) + extra;
  const step = RpsEngine.advance(r.s, r.sec, P, now, cfg);
  return { s: step.state, sec: step.secret, now };
}
const toChoosing = (r: Run): Run => tick(r);
/** both players lock these choices, then run the reveal and the result phase */
function playRound(r: Run, a: RpsChoice, b: RpsChoice): Run {
  let x = toChoosing(r);
  const s1 = RpsEngine.lock(x.s, x.sec, 0, x.s.roundId, a, x.now, cfg);
  const s2 = RpsEngine.lock(s1.state, s1.secret, 1, s1.state.roundId, b, x.now, cfg);
  x = { s: s2.state, sec: s2.secret, now: x.now };
  x = tick(x); // revealing -> round-result or match-result
  return x;
}

// ---------------------------------------------------------------- the rules
test('all nine combinations: rock beats scissors, paper beats rock, scissors beats paper, equal is a draw', () => {
  const expected: Record<string, 0 | 1 | -1> = {
    'rock,rock': 0, 'rock,paper': -1, 'rock,scissors': 1,
    'paper,rock': 1, 'paper,paper': 0, 'paper,scissors': -1,
    'scissors,rock': -1, 'scissors,paper': 1, 'scissors,scissors': 0
  };
  let n = 0;
  for (const a of CHOICES) for (const b of CHOICES) { assert.equal(beats(a, b), expected[`${a},${b}`], `${a} vs ${b}`); n++; }
  assert.equal(n, 9);
});

test('a match starts with a countdown, then the choosing phase opens with a 10 second server deadline', () => {
  const r = start();
  assert.equal(r.s.status, 'countdown');
  assert.equal(r.s.round, 1);
  assert.equal(r.s.deadlineAt, new Date(T0 + 3000).toISOString());
  const c = toChoosing(r);
  assert.equal(c.s.status, 'choosing');
  assert.equal(Date.parse(c.s.deadlineAt as string) - Date.parse(r.s.deadlineAt as string), 10_000);
  assert.deepEqual(c.s.locked, [false, false]);
});

test('formats: single is one round, best of 3 needs 2 wins, best of 5 needs 3; unknown formats fall back to best of 3', () => {
  assert.equal(start('single').s.winsNeeded, 1);
  assert.equal(start('best-of-3').s.winsNeeded, 2);
  assert.equal(start('best-of-5').s.winsNeeded, 3);
  assert.equal(start('nonsense').s.format, 'best-of-3');
});

test('a single round decides the match, and a draw is a tied match', () => {
  let r = playRound(start('single'), 'rock', 'scissors');
  assert.equal(r.s.status, 'match-result');
  assert.equal(r.s.winner, 'X');
  assert.equal(r.s.winnerUserId, 'a');
  r = playRound(start('single'), 'paper', 'paper');
  assert.equal(r.s.status, 'match-result');
  assert.equal(r.s.isDraw, true);
  assert.equal(r.s.winner, null);
});

test('best of 3: a draw does not count, the first to two wins takes the match', () => {
  let r = playRound(start(), 'rock', 'rock'); // draw
  assert.equal(r.s.status, 'round-result');
  assert.deepEqual(r.s.scores, [0, 0]);
  r = tick(r); // next round countdown
  assert.equal(r.s.round, 2);
  r = playRound(r, 'rock', 'scissors'); // a wins
  assert.deepEqual(r.s.scores, [1, 0]);
  r = tick(r);
  r = playRound(r, 'rock', 'paper'); // b wins
  assert.deepEqual(r.s.scores, [1, 1]);
  r = tick(r);
  assert.equal(r.s.round, 4);
  r = playRound(r, 'scissors', 'paper'); // a wins the match
  assert.equal(r.s.status, 'match-result');
  assert.deepEqual(r.s.scores, [2, 1]);
  assert.equal(r.s.winnerUserId, 'a');
});

test('best of 5 needs three wins', () => {
  let r = start('best-of-5');
  for (let i = 0; i < 2; i++) { r = playRound(r, 'paper', 'rock'); r = tick(r); }
  assert.equal(r.s.status, 'countdown');
  assert.deepEqual(r.s.scores, [2, 0]);
  r = playRound(r, 'paper', 'rock');
  assert.equal(r.s.status, 'match-result');
  assert.deepEqual(r.s.scores, [3, 0]);
});

test('a long run of draws ends at the round limit with the higher score (or a draw)', () => {
  let r = start('best-of-3');
  for (let i = 0; i < cfg.maxRounds; i++) {
    r = playRound(r, 'rock', 'rock');
    if (r.s.status === 'match-result') break;
    r = tick(r);
  }
  assert.equal(r.s.status, 'match-result');
  assert.equal(r.s.isDraw, true);
  assert.equal(r.s.finishReason, 'round-limit');
});

// ---------------------------------------------------------------- choices
test('only rock, paper or scissors are accepted, in the choosing phase, for the right round', () => {
  const r = toChoosing(start());
  for (const bad of ['lizard', '', 'ROCK', 5, null, undefined, {}, ['rock']]) {
    assert.throws(() => RpsEngine.select(r.s, r.sec, 0, r.s.roundId, bad, r.now), code('INVALID_INPUT'), String(bad));
  }
  assert.throws(() => RpsEngine.select(r.s, r.sec, 0, 'm:99', 'rock', r.now), code('STALE_ROUND'));
  assert.throws(() => RpsEngine.select(r.s, r.sec, 0, undefined, 'rock', r.now), code('STALE_ROUND'));
  assert.throws(() => RpsEngine.select(r.s, r.sec, 2, r.s.roundId, 'rock', r.now), code('NOT_PLAYER'));
  const counting = start();
  assert.throws(() => RpsEngine.select(counting.s, counting.sec, 0, counting.s.roundId, 'rock', T0), code('NOT_CHOOSING'));
});

test('a pick can change until it is locked; a locked choice can never change or be sent twice', () => {
  const r = toChoosing(start());
  let sec = RpsEngine.select(r.s, r.sec, 0, r.s.roundId, 'rock', r.now);
  sec = RpsEngine.select(r.s, sec, 0, r.s.roundId, 'paper', r.now); // changed before locking
  assert.equal(sec.picks[0], 'paper');
  const locked = RpsEngine.lock(r.s, sec, 0, r.s.roundId, undefined, r.now);
  assert.deepEqual(locked.state.locked, [true, false]);
  assert.throws(() => RpsEngine.select(locked.state, locked.secret, 0, r.s.roundId, 'scissors', r.now), code('ALREADY_LOCKED'));
  assert.throws(() => RpsEngine.lock(locked.state, locked.secret, 0, r.s.roundId, 'scissors', r.now), code('ALREADY_LOCKED'));
  assert.throws(() => RpsEngine.lock(r.s, r.sec, 1, r.s.roundId, undefined, r.now), code('INVALID_INPUT')); // nothing picked yet
});

test('a pick may be locked in the same step it is made', () => {
  const r = toChoosing(start());
  const step = RpsEngine.lock(r.s, r.sec, 1, r.s.roundId, 'scissors', r.now);
  assert.deepEqual(step.state.locked, [false, true]);
});

test('with changing switched off, a first pick sticks', () => {
  const strict = { ...cfg, allowChange: false };
  const r = toChoosing(start());
  const sec = RpsEngine.select(r.s, r.sec, 0, r.s.roundId, 'rock', r.now, strict);
  assert.throws(() => RpsEngine.select(r.s, sec, 0, r.s.roundId, 'paper', r.now, strict), code('ALREADY_LOCKED'));
});

test('the public state never carries a choice before the reveal', () => {
  const r = toChoosing(start());
  const one = RpsEngine.lock(r.s, r.sec, 0, r.s.roundId, 'scissors', r.now);
  const json = JSON.stringify(one.state);
  for (const word of CHOICES) assert.equal(json.includes(word), false, `"${word}" must not appear before the reveal`);
  assert.equal(one.state.reveal, null);
  assert.deepEqual(one.state.locked, [true, false]); // only WHO has locked
});

test('both locked reveals both choices together, then the result applies the score', () => {
  const r = toChoosing(start());
  const a = RpsEngine.lock(r.s, r.sec, 0, r.s.roundId, 'rock', r.now);
  const b = RpsEngine.lock(a.state, a.secret, 1, r.s.roundId, 'paper', r.now);
  assert.equal(b.state.status, 'revealing');
  assert.deepEqual(b.state.reveal?.choices, ['rock', 'paper']);
  assert.equal(b.state.reveal?.winnerSeat, 1);
  assert.deepEqual(b.state.scores, [0, 0], 'the score moves only at the result');
  assert.equal(b.secret, null, 'nothing is left to protect');
  const after = tick({ s: b.state, sec: b.secret, now: r.now });
  assert.equal(after.s.status, 'round-result');
  assert.deepEqual(after.s.scores, [0, 1]);
});

// ---------------------------------------------------------------- time
test('a choice after the deadline is refused', () => {
  const r = toChoosing(start());
  const late = Date.parse(r.s.deadlineAt as string);
  assert.throws(() => RpsEngine.lock(r.s, RpsEngine.select(r.s, r.sec, 0, r.s.roundId, 'rock', r.now), 0, r.s.roundId, undefined, late), code('TOO_LATE'));
  assert.throws(() => RpsEngine.select(r.s, r.sec, 0, r.s.roundId, 'rock', late), code('TOO_LATE'));
});

test('time runs out: the player who locked wins the round (default policy); a pick that was not locked still counts', () => {
  const r = toChoosing(start());
  const one = RpsEngine.lock(r.s, r.sec, 0, r.s.roundId, 'rock', r.now);
  const out = tick({ s: one.state, sec: one.secret, now: r.now });
  assert.equal(out.s.status, 'revealing');
  assert.equal(out.s.reveal?.reason, 'timeout-award');
  assert.equal(out.s.reveal?.winnerSeat, 0);
  assert.deepEqual(out.s.reveal?.timedOut, [1]);
  // picked but never locked: counts as that choice
  const sec = RpsEngine.select(r.s, r.sec, 1, r.s.roundId, 'paper', r.now);
  const out2 = tick({ s: r.s, sec, now: r.now });
  assert.deepEqual(out2.s.reveal?.choices, [null, 'paper']);
  assert.equal(out2.s.reveal?.winnerSeat, 1);
});

test('nobody locks in time: the round is a draw; with the draw policy a single timeout is a draw too', () => {
  const r = toChoosing(start());
  const out = tick(r);
  assert.equal(out.s.reveal?.reason, 'timeout-draw');
  assert.equal(out.s.reveal?.winnerSeat, null);
  const one = RpsEngine.lock(r.s, r.sec, 0, r.s.roundId, 'rock', r.now);
  const step = RpsEngine.advance(one.state, one.secret, P, Date.parse(r.s.deadlineAt as string) + 30, { ...cfg, timeoutPolicy: 'draw' });
  assert.equal(step.state.reveal?.winnerSeat, null);
});

test('a server that was late catches up through every phase that was due, once', () => {
  const r = start();
  const step = RpsEngine.advance(r.s, r.sec, P, T0 + 3000 + 10_000 + 1500 + 3000 + 60_000, cfg);
  assert.ok(step.state.round >= 2 || step.state.status !== 'countdown');
  const again = RpsEngine.advance(step.state, step.secret, P, T0 + 3000 + 10_000 + 1500 + 3000 + 60_000, cfg);
  assert.equal(again.changed, false, 'nothing is applied twice');
});

test('a round is resolved exactly once: advancing again changes nothing', () => {
  let r = toChoosing(start());
  const a = RpsEngine.lock(r.s, r.sec, 0, r.s.roundId, 'rock', r.now);
  const b = RpsEngine.lock(a.state, a.secret, 1, r.s.roundId, 'scissors', r.now);
  const same = RpsEngine.advance(b.state, b.secret, P, r.now, cfg); // before the reveal deadline
  assert.equal(same.changed, false);
  assert.throws(() => RpsEngine.lock(b.state, b.secret, 0, r.s.roundId, 'rock', r.now), code('NOT_CHOOSING'));
});

// ---------------------------------------------------------------- ending early
test('forfeit gives the match to the other player; cancel ends it with no winner; neither works twice', () => {
  const r = toChoosing(start());
  const f = RpsEngine.forfeit(r.s, 1, 'A', P);
  assert.equal(f.status, 'forfeit');
  assert.equal(f.winnerUserId, 'b');
  assert.equal(RpsEngine.forfeit(f, 0, 'B', P), f);
  const c = RpsEngine.cancel(r.s);
  assert.equal(c.status, 'cancelled');
  assert.equal(c.winner, null);
  assert.equal(RpsEngine.advance(c, null, P, T0 + 10 ** 9, cfg).changed, false);
});

// ---------------------------------------------------------------- the room: real handlers and sockets
const managers: any[] = [];
after(() => {
  for (const m of managers) { try { m.dispose(); } catch { /* ignore */ } }
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
});

function setup(opts: { join?: boolean } = {}) {
  const db = new DatabaseService(':memory:');
  let now = T0;
  const m: any = new GameRoomManager(db, { clock: () => now });
  managers.push(m);
  const room = m.createGameRoom({ hostUser: U('a'), gameType: 'rock-paper-scissors', maxPlayers: 2 });
  const msgs: any[] = [];
  const clients: Record<string, any> = {};
  const connect = (u: string, spectate = false) => {
    const sock: any = { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }), close() {}, on() {}, ping() {}, terminate() {} };
    m.registerClient(sock, room.id, U(u), spectate ? { spectate: true, canSpectate: true } : {});
    clients[u] = { socket: sock, roomId: room.id, userId: u, displayName: u.toUpperCase() };
    return clients[u];
  };
  const act = (u: string, type: string, payload?: any) => m.handleClientMessage(clients[u] ?? { socket: { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }) }, roomId: room.id, userId: u, displayName: u }, { type, payload });
  connect('a');
  if (opts.join !== false) { m.joinRoom(room.roomCode, U('b')); connect('b'); }
  return {
    db, m, msgs, act, connect, id: room.id as string, code: room.roomCode as string,
    get: () => db.getGameRoomById(room.id)!,
    gs: () => db.getGameRoomById(room.id)!.gameState as RpsGameState,
    setNow: (n: number) => { now = n; },
    /** move the server clock and let the phase timer's work happen */
    at: (ms: number) => { now = T0 + ms; m.tickRps(room.id); },
    lastError: () => [...msgs].reverse().find((x) => x.type === 'game:error'),
    states: (u: string) => msgs.filter((x) => x.to === u && x.type === 'game:rps_state')
  };
}
/** a started match is in countdown; open the choosing phase */
const choosing = (t: ReturnType<typeof setup>) => { t.at(3100); assert.equal(t.gs().status, 'choosing'); return t.gs().roundId; };

test('room: both players join, the match starts with a countdown and a server deadline', () => {
  const t = setup();
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.gs().status, 'countdown');
  assert.equal(t.gs().format, 'best-of-3');
  assert.ok(t.gs().deadlineAt);
  assert.ok(t.msgs.some((x) => x.type === 'game:started' && x.payload.serverTime));
});

test('room: private choices never reach the other player or a spectator before the reveal', () => {
  const t = setup();
  t.connect('watcher', true);
  const rid = choosing(t);
  t.msgs.length = 0;
  t.act('a', 'game:rps_choose', { roundId: rid, choice: 'scissors' });
  t.act('a', 'game:rps_lock', { roundId: rid });
  const seenByOthers = t.msgs.filter((x) => x.to !== 'a');
  assert.ok(seenByOthers.length > 0, 'the others are told that a player has locked');
  assert.ok(seenByOthers.some((x) => x.type === 'game:rps_state' && x.payload.gameState.locked[0] === true));
  for (const m of seenByOthers) for (const word of CHOICES) assert.equal(JSON.stringify(m).includes(word), false, `${m.to} saw "${word}" in ${m.type}`);
  // the player's own copy is private to them
  assert.ok(t.msgs.some((x) => x.to === 'a' && x.type === 'game:rps_choice_ack' && x.payload.choice === 'scissors' && x.payload.locked === true));
  // the stored (public) room state holds no choice either
  for (const word of CHOICES) assert.equal(JSON.stringify(t.get().gameState).includes(word), false);
  assert.equal(t.get().players.length, 2);
});

test('room: when both have locked, every viewer gets the same reveal and the score follows at the result', () => {
  const t = setup();
  t.connect('watcher', true);
  const rid = choosing(t);
  t.act('a', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  t.act('b', 'game:rps_lock', { roundId: rid, choice: 'paper' });
  assert.equal(t.gs().status, 'revealing');
  const reveals = ['a', 'b', 'watcher'].map((u) => t.states(u).at(-1).payload.gameState.reveal);
  assert.deepEqual(reveals[0], reveals[1]);
  assert.deepEqual(reveals[0], reveals[2]);
  assert.deepEqual(reveals[0].choices, ['rock', 'paper']);
  assert.equal(reveals[0].winnerSeat, 1);
  t.at(3100 + 1600);
  assert.equal(t.gs().status, 'round-result');
  assert.deepEqual(t.gs().scores, [0, 1]);
});

test('room: a whole best-of-3 match runs on server phases to a final result and finishes the room', () => {
  const t = setup();
  let clock = 0;
  const play = (a: string, b: string) => {
    clock += 3100; t.at(clock);
    const rid = t.gs().roundId;
    t.act('a', 'game:rps_lock', { roundId: rid, choice: a });
    t.act('b', 'game:rps_lock', { roundId: rid, choice: b });
    clock += 1600; t.at(clock);
    clock += 3100; t.at(clock);
  };
  play('rock', 'scissors');
  play('paper', 'paper');
  play('scissors', 'rock');
  play('paper', 'rock');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.gs().status, 'match-result');
  assert.deepEqual(t.gs().scores, [2, 1]);
  assert.equal(t.gs().winnerUserId, 'a');
  assert.equal(t.states('b').at(-1).payload.finished, true);
});

test('room: spectators and strangers cannot choose, and a duplicate, late or stale submission is refused', () => {
  const t = setup();
  t.connect('watcher', true);
  const rid = choosing(t);
  t.act('watcher', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  assert.equal(t.lastError().payload.code, 'NOT_PLAYER');
  t.act('stranger', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  assert.equal(t.lastError().payload.code, 'NOT_PLAYER');
  t.act('a', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  t.act('a', 'game:rps_lock', { roundId: rid, choice: 'paper' }); // repeated
  assert.equal(t.lastError().payload.code, 'ALREADY_LOCKED');
  t.act('a', 'game:rps_choose', { roundId: rid, choice: 'paper' }); // change after lock
  assert.equal(t.lastError().payload.code, 'ALREADY_LOCKED');
  t.act('b', 'game:rps_lock', { roundId: 'nope:9', choice: 'rock' });
  assert.equal(t.lastError().payload.code, 'STALE_ROUND');
  t.act('b', 'game:rps_lock', { roundId: rid, choice: 'lizard' });
  assert.equal(t.lastError().payload.code, 'INVALID_INPUT');
  t.at(3100 + 10_100); // the choosing time is over: b never locked
  assert.equal(t.gs().status, 'revealing');
  t.act('b', 'game:rps_lock', { roundId: rid, choice: 'rock' }); // late
  assert.ok(['NOT_CHOOSING', 'STALE_ROUND', 'TOO_LATE'].includes(t.lastError().payload.code));
  assert.equal(t.gs().reveal?.reason, 'timeout-award');
});

test('room: malformed requests are refused and change nothing', () => {
  const t = setup();
  const rid = choosing(t);
  const before = JSON.stringify(t.gs());
  for (const bad of [null, undefined, 5, 'rock', [], {}]) {
    t.act('a', 'game:rps_lock', bad);
    assert.ok(t.lastError(), JSON.stringify(bad));
  }
  assert.equal(JSON.stringify(t.gs()), before);
  assert.ok(rid);
});

test('room: both players locking at the same moment resolve the round exactly once', () => {
  const t = setup();
  const rid = choosing(t);
  t.act('a', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  t.act('b', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  const v = t.gs().version;
  assert.equal(t.gs().status, 'revealing');
  t.act('b', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  assert.equal(t.gs().version, v);
  assert.equal(t.states('a').filter((x) => x.payload.event === 'revealing').length, 1);
});

test('room: a reconnecting player gets the same round, their own pick, and never the other player\'s', () => {
  const t = setup();
  const rid = choosing(t);
  t.act('a', 'game:rps_choose', { roundId: rid, choice: 'paper' });
  t.act('b', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  const before = t.gs();
  t.msgs.length = 0;
  t.connect('a'); // a reopens the page
  const sync = t.msgs.find((x) => x.to === 'a' && x.type === 'game:sync');
  assert.equal(sync.payload.room.gameState.roundId, rid);
  assert.equal(sync.payload.rps.myPick, 'paper');
  assert.equal(sync.payload.rps.myLocked, false);
  assert.equal(t.gs().version, before.version, 'the round is not restarted');
  assert.equal(JSON.stringify(sync).includes('"rock"'), false, "b's locked choice must not be in a's sync");
  t.msgs.length = 0;
  t.connect('b');
  const syncB = t.msgs.find((x) => x.to === 'b' && x.type === 'game:sync');
  assert.equal(syncB.payload.rps.myPick, 'rock');
  assert.equal(syncB.payload.rps.myLocked, true);
});

test('room: the host picks the format before the match, nobody else can, and not while a match runs', () => {
  const t = setup({ join: false });
  t.act('a', 'game:rps_config', { format: 'best-of-5' });
  assert.equal(t.msgs.find((x) => x.type === 'game:rps_config_updated')?.payload.format, 'best-of-5');
  t.act('a', 'game:rps_config', { format: 'best-of-9' });
  assert.equal(t.lastError().payload.code, 'INVALID_INPUT');
  t.m.joinRoom(t.code, U('b'));
  t.connect('b');
  assert.equal(t.gs().format, 'best-of-5');
  assert.equal(t.gs().winsNeeded, 3);
  t.act('b', 'game:rps_config', { format: 'single' });
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  t.act('a', 'game:rps_config', { format: 'single' });
  assert.equal(t.lastError().payload.code, 'ILLEGAL_MOVE');
});

test('room: only the host can cancel; both players are told', () => {
  const t = setup();
  t.act('b', 'game:rps_cancel');
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  t.act('a', 'game:rps_cancel');
  assert.equal(t.gs().status, 'cancelled');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.states('b').at(-1).payload.event, 'cancelled');
});

test('room: a player who leaves forfeits; their opponent wins', () => {
  const t = setup();
  choosing(t);
  t.act('b', 'game:leave');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.gs().status, 'forfeit');
  assert.equal(t.gs().winnerUserId, 'a');
});

test('room: a rematch is a clean new match with no old choices or scores', async () => {
  const t = setup();
  const rid = choosing(t);
  t.act('a', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  t.act('a', 'game:rps_cancel');
  const oldMatch = t.gs().matchId;
  t.act('a', 'game:rematch');
  t.act('b', 'game:rematch');
  await new Promise((r) => setTimeout(r, 800));
  assert.equal(t.get().status, 'PLAYING');
  assert.notEqual(t.gs().matchId, oldMatch);
  assert.deepEqual(t.gs().scores, [0, 0]);
  assert.deepEqual(t.gs().locked, [false, false]);
  assert.equal(t.gs().reveal, null);
  const rid2 = (t.at(3100 + 3100), t.gs().roundId); // the rematch began at 3100: its countdown ends 3 s later
  t.act('b', 'game:rps_lock', { roundId: rid2, choice: 'paper' });
  assert.deepEqual(t.gs().locked, [false, true], 'a starts with nothing locked');
});

test('room: after a server restart a round that was being chosen starts its choosing time again, and nothing leaks', () => {
  const t = setup();
  const rid = choosing(t);
  t.act('a', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  t.m.stopRpsTimer(t.id);
  t.m.rpsSecrets.delete(t.id); // as if the process restarted: private picks lived in memory
  t.setNow(T0 + 5000);
  t.m.ensureRpsTimer(t.id);
  assert.equal(t.gs().status, 'choosing');
  assert.deepEqual(t.gs().locked, [false, false]);
  assert.ok(Date.parse(t.gs().deadlineAt as string) > T0 + 5000);
});

test('room: an action sent to another room\'s match does nothing there', () => {
  const t1 = setup();
  const t2 = setup();
  const rid = choosing(t1);
  t1.act('a', 'game:rps_lock', { roundId: rid, choice: 'rock' });
  assert.deepEqual(t2.gs().locked, [false, false]);
});
