import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import type { MafiaRole, MafiaServerState } from '@synccinema/common';
import { mafiaRoleCounts } from '@synccinema/common';
import {
  MafiaNightEngine,
  MAFIA_TIMING,
  mafiaMinActive,
  mafiaMinPlayers,
  mafiaRateAllowed
} from '../games/MafiaNightEngine.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';
import { mafiaNightActionSchema, mafiaNightVoteSchema, parseMafiaNightPayload } from '../games/mafiaNightSchemas.js';

const T0 = 1_700_000_000_000;
const T = MAFIA_TIMING;
const E = MafiaNightEngine;

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `Player${i}`, seat: i }));

/** Fixed roles (white-box): u0 mafia (u1 too from 7 players), then doctor, detective, villagers. */
function rolesFor(n: number): Record<string, MafiaRole> {
  const c = mafiaRoleCounts(n);
  const list: MafiaRole[] = [
    ...Array<MafiaRole>(c.mafia).fill('mafia'),
    ...Array<MafiaRole>(c.doctor).fill('doctor'),
    ...Array<MafiaRole>(c.detective).fill('detective'),
    ...Array<MafiaRole>(c.villager).fill('villager')
  ];
  return Object.fromEntries(list.map((r, i) => [`u${i}`, r]));
}

/** A game of n players with known roles, at the start of ROLE_REVEAL. */
function newGame(n = 5): MafiaServerState {
  const s = E.createInitialState(seats(n), T0, { rng: () => 0 });
  s.secret.roles = rolesFor(n);
  return s;
}
const idOf = (s: MafiaServerState, role: MafiaRole, nth = 0) => Object.entries(s.secret.roles).filter(([, r]) => r === role)[nth][0];

/** Runs the clock to the start of NIGHT 1. Returns the fake time at which NIGHT started. */
function toNight(s: MafiaServerState): number {
  const at = s.phaseEndsAt!;
  E.tick(s, at);
  assert.equal(s.phase, 'NIGHT');
  return at;
}
/** NIGHT -> DAWN (the night is a fixed length). Returns the time DAWN started. */
function endNight(s: MafiaServerState, nightStart: number): number {
  const at = nightStart + T.nightMs;
  E.tick(s, at);
  assert.equal(s.phase, 'DAWN');
  return at;
}
/** DAWN -> DAY -> everybody ready -> VOTE. Returns the fake time. */
function toVote(s: MafiaServerState, dawnStart: number): number {
  let now = dawnStart + T.dawnMs;
  E.tick(s, now);
  assert.equal(s.phase, 'DAY');
  for (const p of E.livingPlayers(s)) { now += 10; E.markReady(s, p.userId, now); }
  assert.equal(s.phase, 'VOTE');
  return now;
}
function throwsRule(fn: () => unknown, code?: string): GameRuleError {
  try { fn(); } catch (e) {
    assert.ok(e instanceof GameRuleError, `expected GameRuleError, got ${e}`);
    if (code) assert.equal((e as GameRuleError).code, code);
    return e as GameRuleError;
  }
  assert.fail('expected a GameRuleError');
}
const view = (s: MafiaServerState, viewer: string | null) => E.publicStateFor(s, viewer, T0)!;
const text = (v: unknown) => JSON.stringify(v);

// ---------------------------------------------------------------- definitions, roles, setup

test('MAFIA definitions: a VIP game for 5 to 10, no partner mode, no matchmaking, aliases resolve', () => {
  const d = GAME_DEFINITIONS['mafia-night'];
  assert.equal(d.minPlayers, 5);
  assert.equal(d.maxPlayers, 10);
  assert.deepEqual(d.playerOptions, [5, 6, 7, 8, 9, 10]);
  assert.equal(d.requiredHostTier, 'plus');
  assert.equal(d.supportsPartnerMode, false);
  assert.equal(d.supportsPublicMatchmaking, false);
  for (const a of ['mafia-night', 'Mafia', ' MAFIANIGHT ']) assert.equal(parseGameType(a), 'mafia-night', a);
});

test('MAFIA roles: the counts follow the table size (1/2/3 mafia, one doctor and detective, rest villagers)', () => {
  const expect: Record<number, [number, number, number, number]> = {
    5: [1, 1, 1, 2], 6: [1, 1, 1, 3], 7: [2, 1, 1, 3], 8: [2, 1, 1, 4], 9: [3, 1, 1, 4], 10: [3, 1, 1, 5]
  };
  for (const [n, [m, d, t, v]] of Object.entries(expect)) {
    assert.deepEqual(mafiaRoleCounts(Number(n)), { mafia: m, doctor: d, detective: t, villager: v }, `n=${n}`);
    for (let i = 0; i < 20; i++) {
      const g = E.createInitialState(seats(Number(n)), T0);
      const roles = Object.values(g.secret.roles);
      assert.equal(roles.length, Number(n));
      for (const [role, want] of [['mafia', m], ['doctor', d], ['detective', t], ['villager', v]] as const) {
        assert.equal(roles.filter((r) => r === role).length, want, `${role} for ${n} players`);
      }
    }
  }
  assert.deepEqual(mafiaRoleCounts(4), { mafia: 1, doctor: 0, detective: 1, villager: 2 }, 'testing table: no doctor');
});

test('MAFIA roles: the dealing uses the injected RNG and really shuffles (every seat can get every role)', () => {
  const ids = seats(5).map((s) => s.userId);
  const a = E.dealRoles(ids, () => 0);
  const b = E.dealRoles(ids, () => 0);
  assert.deepEqual(a, b, 'same RNG, same deal');
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) seen.add(E.dealRoles(ids)['u0']);
  assert.deepEqual([...seen].sort(), ['detective', 'doctor', 'mafia', 'villager']);
});

test('MAFIA setup: 5 to 10 distinct players, everyone alive, starts in ROLE_REVEAL, nothing public', () => {
  throwsRule(() => E.createInitialState(seats(4), T0), 'INVALID_INPUT');
  throwsRule(() => E.createInitialState(seats(11), T0), 'INVALID_INPUT');
  throwsRule(() => E.createInitialState([...seats(4), { userId: 'u0', displayName: 'dup', seat: 9 }], T0), 'INVALID_INPUT');
  const s = E.createInitialState(seats(6), T0);
  assert.equal(s.phase, 'ROLE_REVEAL');
  assert.equal(s.phaseEndsAt, T0 + T.revealMs);
  assert.ok(s.players.every((p) => p.alive && !p.left && p.role === null));
  assert.equal(s.round, 0);
});

test('MAFIA test switch: MAFIA_TEST_MIN_PLAYERS (2 to 5) only outside production, any other value is ignored', () => {
  const env = process.env;
  const keep = { t: env.MAFIA_TEST_MIN_PLAYERS, n: env.NODE_ENV };
  try {
    env.MAFIA_TEST_MIN_PLAYERS = ''; assert.equal(mafiaMinPlayers(), 5);
    env.MAFIA_TEST_MIN_PLAYERS = '4'; assert.equal(mafiaMinPlayers(), 4);
    assert.equal(mafiaMinActive(), 3);
    const s = E.createInitialState(seats(4), T0);
    assert.deepEqual(Object.values(s.secret.roles).sort(), ['detective', 'mafia', 'villager', 'villager']);
    env.MAFIA_TEST_MIN_PLAYERS = '5'; assert.equal(mafiaMinPlayers(), 5);
    env.MAFIA_TEST_MIN_PLAYERS = '2'; assert.equal(mafiaMinPlayers(), 2); assert.equal(mafiaMinActive(), 2);
    const two = E.createInitialState(seats(2), T0);
    assert.deepEqual(Object.values(two.secret.roles).sort(), ['detective', 'mafia']);
    assert.equal(E.checkWin(two), null, '1 mafia vs 1 other must not end a 2-player test game at once');
    for (const bad of ['6', '1', '0', 'abc', '4.5', '-1', '10']) { env.MAFIA_TEST_MIN_PLAYERS = bad; assert.equal(mafiaMinPlayers(), 5, bad); }
    env.MAFIA_TEST_MIN_PLAYERS = '4'; (env as any).NODE_ENV = 'production';
    assert.equal(mafiaMinPlayers(), 5, 'ignored in production');
  } finally {
    env.MAFIA_TEST_MIN_PLAYERS = keep.t ?? '';
    if (keep.n === undefined) delete (env as any).NODE_ENV; else (env as any).NODE_ENV = keep.n;
  }
  assert.equal(mafiaMinPlayers(), 5);
});

// ---------------------------------------------------------------- night

test('MAFIA night: the mafia kill, the victim dies at dawn and their role is public', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  assert.equal(s.round, 1);
  const mafia = idOf(s, 'mafia');
  assert.equal(E.submitNightAction(s, mafia, 'kill', 'u3', n0 + 1000), true);
  const d0 = endNight(s, n0);
  assert.equal(s.phase, 'DAWN');
  assert.equal(s.players.find((p) => p.userId === 'u3')!.alive, false);
  assert.equal(s.players.find((p) => p.userId === 'u3')!.role, 'villager');
  assert.equal(view(s, 'u4').dawnDeathUserId, 'u3');
  assert.match(s.statusMessage, /Player3 was killed/);
  assert.equal(s.phaseEndsAt, d0 + T.dawnMs);
});

test('MAFIA night: the doctor saves the victim, and saving yourself works', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u3', n0 + 1);
  E.submitNightAction(s, 'u1', 'save', 'u3', n0 + 2);
  endNight(s, n0);
  assert.ok(s.players.every((p) => p.alive), 'saved: nobody died');
  assert.equal(view(s, 'u4').dawnDeathUserId, null);
  // self-save: the doctor is the victim and saves themselves
  const t = newGame(5);
  const m0 = toNight(t);
  E.submitNightAction(t, 'u0', 'kill', 'u1', m0 + 1);
  E.submitNightAction(t, 'u1', 'save', 'u1', m0 + 2);
  endNight(t, m0);
  assert.ok(t.players.every((p) => p.alive), 'doctor saved themselves');
});

test('MAFIA night: the doctor cannot save the same player two nights in a row, may skip, then save again', () => {
  const s = newGame(6);
  let n = toNight(s);
  E.submitNightAction(s, 'u1', 'save', 'u3', n + 1);
  let d = endNight(s, n);
  assert.equal(s.night.lastSaved, 'u3');
  // night 2 via a skipped vote
  let now = toVote(s, d);
  for (const p of E.livingPlayers(s)) E.castVote(s, p.userId, 'skip', (now += 10));
  assert.equal(s.phase, 'VOTE_RESULT');
  E.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'NIGHT');
  n = s.phaseEndsAt! - T.nightMs;
  const before = text(s);
  throwsRule(() => E.submitNightAction(s, 'u1', 'save', 'u3', n + 1), 'ILLEGAL_MOVE');
  assert.equal(text(s), before, 'a refused action changes nothing');
  assert.equal(view(s, 'u1').me!.lastSavedUserId, 'u3');
  assert.equal(view(s, 'u0').me!.lastSavedUserId, null, 'only the doctor knows');
  E.submitNightAction(s, 'u1', 'save', 'u4', n + 2); // somebody else is fine
  d = endNight(s, n);
  // night 3: a different pick is allowed, and after a skipped night the same player is allowed again
  now = toVote(s, d);
  for (const p of E.livingPlayers(s)) E.castVote(s, p.userId, 'skip', (now += 10));
  E.tick(s, s.phaseEndsAt!);
  n = s.phaseEndsAt! - T.nightMs;
  d = endNight(s, n); // the doctor does nothing: lastSaved resets
  assert.equal(s.night.lastSaved, null);
  now = toVote(s, d);
  for (const p of E.livingPlayers(s)) E.castVote(s, p.userId, 'skip', (now += 10));
  E.tick(s, s.phaseEndsAt!);
  n = s.phaseEndsAt! - T.nightMs;
  assert.equal(E.submitNightAction(s, 'u1', 'save', 'u4', n + 1), true, 'saving the same player again after a night off');
});

test('MAFIA night: the detective gets a private answer at dawn (Mafia / Not mafia), never during the night', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  E.submitNightAction(s, 'u2', 'investigate', 'u0', n0 + 1);
  assert.deepEqual(view(s, 'u2').me!.investigations, [], 'no answer yet at night');
  assert.equal(view(s, 'u2').me!.nightChoice, 'u0');
  endNight(s, n0);
  assert.deepEqual(view(s, 'u2').me!.investigations, [{ round: 1, targetUserId: 'u0', isMafia: true }]);
  for (const other of ['u0', 'u1', 'u3', 'u4', null]) {
    assert.ok(!text(view(s, other)).includes('isMafia'), `${other} must not see the answer`);
  }
  // an innocent answer
  const t = newGame(5);
  const m0 = toNight(t);
  E.submitNightAction(t, 'u2', 'investigate', 'u3', m0 + 1);
  endNight(t, m0);
  assert.equal(view(t, 'u2').me!.investigations[0].isMafia, false);
  // the detective may be killed the same night and still gets the answer
  const w = newGame(5);
  const k0 = toNight(w);
  E.submitNightAction(w, 'u2', 'investigate', 'u0', k0 + 1);
  E.submitNightAction(w, 'u0', 'kill', 'u2', k0 + 2);
  endNight(w, k0);
  assert.equal(w.players.find((p) => p.userId === 'u2')!.alive, false);
  assert.equal(view(w, 'u2').me!.investigations[0].isMafia, true);
  // the detective cannot investigate themselves
  const x = newGame(5);
  const x0 = toNight(x);
  throwsRule(() => E.submitNightAction(x, 'u2', 'investigate', 'u2', x0 + 1), 'ILLEGAL_MOVE');
});

test('MAFIA night: no action is allowed (nobody dies), and the night is always a fixed length', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u3', n0 + 1);
  E.submitNightAction(s, 'u1', 'save', 'u3', n0 + 2);
  E.submitNightAction(s, 'u2', 'investigate', 'u4', n0 + 3);
  E.tick(s, n0 + T.nightMs - 1);
  assert.equal(s.phase, 'NIGHT', 'everybody acted but the night does not end early (it would show who has a role)');
  const t = newGame(5);
  const m0 = toNight(t);
  endNight(t, m0);
  assert.ok(t.players.every((p) => p.alive));
  assert.match(t.statusMessage, /Nobody died/);
});

test('MAFIA night: several mafia agree by majority, a tie goes to the latest choice, they may change their mind', () => {
  const s = newGame(8); // u0, u1 mafia
  const n0 = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u4', n0 + 1);
  E.submitNightAction(s, 'u1', 'kill', 'u5', n0 + 2);
  assert.deepEqual(view(s, 'u0').me!.teamChoices, { u0: 'u4', u1: 'u5' }, 'teammates see each other\'s picks');
  assert.equal(E.submitNightAction(s, 'u0', 'kill', 'u4', n0 + 3), false, 'the same pick again changes nothing');
  endNight(s, n0);
  assert.equal(s.players.find((p) => p.userId === 'u5')!.alive, false, 'tie: the latest choice (u1) won');
  assert.equal(s.players.find((p) => p.userId === 'u4')!.alive, true);
  // changing the pick: last choice counts; 3 mafia, 2 against 1
  const t = newGame(9); // u0, u1, u2 mafia
  const m0 = toNight(t);
  E.submitNightAction(t, 'u0', 'kill', 'u5', m0 + 1);
  E.submitNightAction(t, 'u1', 'kill', 'u6', m0 + 2);
  E.submitNightAction(t, 'u2', 'kill', 'u5', m0 + 3);
  E.submitNightAction(t, 'u0', 'kill', 'u6', m0 + 4); // u0 changes: now 2 for u6
  endNight(t, m0);
  assert.equal(t.players.find((p) => p.userId === 'u6')!.alive, false);
  assert.equal(t.players.find((p) => p.userId === 'u5')!.alive, true);
  // a mafia member cannot target a teammate or themselves
  const u = newGame(8);
  const q0 = toNight(u);
  throwsRule(() => E.submitNightAction(u, 'u0', 'kill', 'u1', q0 + 1), 'ILLEGAL_MOVE');
  throwsRule(() => E.submitNightAction(u, 'u0', 'kill', 'u0', q0 + 1), 'ILLEGAL_MOVE');
});

test('MAFIA night: wrong phase, wrong role, dead actor, dead target, bad input and a second doctor / detective pick are refused without changing anything', () => {
  const s = newGame(5);
  throwsRule(() => E.submitNightAction(s, 'u0', 'kill', 'u3', T0 + 1), 'WRONG_PHASE'); // ROLE_REVEAL
  const n0 = toNight(s);
  const before = text(s);
  throwsRule(() => E.submitNightAction(s, 'u3', 'kill', 'u4', n0 + 1), 'ILLEGAL_MOVE'); // villager
  throwsRule(() => E.submitNightAction(s, 'u0', 'save', 'u3', n0 + 1), 'ILLEGAL_MOVE'); // mafia sending a doctor action
  throwsRule(() => E.submitNightAction(s, 'u1', 'kill', 'u3', n0 + 1), 'ILLEGAL_MOVE'); // doctor sending a mafia action
  throwsRule(() => E.submitNightAction(s, 'u0', 'kill', 'nobody', n0 + 1), 'INVALID_INPUT');
  throwsRule(() => E.submitNightAction(s, 'u0', 'kill', 42 as any, n0 + 1), 'INVALID_INPUT');
  throwsRule(() => E.submitNightAction(s, 'stranger', 'kill', 'u3', n0 + 1), 'NOT_PLAYER');
  assert.equal(text(s), before);
  E.submitNightAction(s, 'u1', 'save', 'u3', n0 + 2);
  assert.equal(E.submitNightAction(s, 'u1', 'save', 'u3', n0 + 3), false, 'same pick again: no-op');
  throwsRule(() => E.submitNightAction(s, 'u1', 'save', 'u4', n0 + 4), 'ALREADY_VOTED');
  E.submitNightAction(s, 'u2', 'investigate', 'u3', n0 + 5);
  throwsRule(() => E.submitNightAction(s, 'u2', 'investigate', 'u4', n0 + 6), 'ALREADY_VOTED');
  // a dead player cannot act and a dead player cannot be targeted
  const d = endNight(s, n0);
  const t = newGame(6);
  const m0 = toNight(t);
  E.submitNightAction(t, 'u0', 'kill', 'u1', m0 + 1);
  const dd = endNight(t, m0);
  assert.equal(t.players.find((p) => p.userId === 'u1')!.alive, false);
  let now = toVote(t, dd);
  for (const p of E.livingPlayers(t)) E.castVote(t, p.userId, 'skip', (now += 10));
  E.tick(t, t.phaseEndsAt!);
  const n2 = t.phaseEndsAt! - T.nightMs;
  throwsRule(() => E.submitNightAction(t, 'u1', 'save', 'u3', n2 + 1), 'ILLEGAL_MOVE'); // the dead doctor
  throwsRule(() => E.submitNightAction(t, 'u0', 'kill', 'u1', n2 + 1), 'INVALID_INPUT'); // dead target
  void d;
});

test('MAFIA night: after the night ends a late night action is refused (WRONG_PHASE) and changes nothing', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  E.tick(s, n0 + T.nightMs + 10);
  const before = text(s);
  throwsRule(() => E.submitNightAction(s, 'u0', 'kill', 'u3', n0 + T.nightMs + 20), 'WRONG_PHASE');
  assert.equal(text(s), before);
});

// ---------------------------------------------------------------- dawn announcements

test('MAFIA dawn: "nobody died" is identical whether the doctor saved the victim or the mafia did nothing', () => {
  const saved = newGame(5);
  const a = toNight(saved);
  E.submitNightAction(saved, 'u0', 'kill', 'u3', a + 1);
  E.submitNightAction(saved, 'u1', 'save', 'u3', a + 2);
  endNight(saved, a);
  const quiet = newGame(5);
  const b = toNight(quiet);
  endNight(quiet, b);
  const strip = (v: any) => ({ ...v, serverNow: 0, phaseEndsAt: 0 });
  for (const who of ['u0', 'u1', 'u2', 'u3', 'u4', null]) {
    const vs = view(saved, who); const vq = view(quiet, who);
    assert.equal(vs.dawnDeathUserId, null);
    assert.equal(vs.statusMessage, 'Nobody died in the night.');
    assert.deepEqual(vs.log, vq.log, `public log differs for ${who}`);
    assert.deepEqual(vs.players, vq.players);
    if (who !== 'u0' && who !== 'u1') assert.deepEqual(strip({ ...vs, me: null }), strip({ ...vq, me: null }), `${who} could tell the two nights apart`);
  }
});

test('MAFIA dawn: the dawn lasts a few seconds, then the day starts (or the game ends)', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  const d0 = endNight(s, n0);
  E.tick(s, d0 + T.dawnMs - 1);
  assert.equal(s.phase, 'DAWN');
  E.tick(s, d0 + T.dawnMs);
  assert.equal(s.phase, 'DAY');
  assert.equal(s.phaseEndsAt, d0 + T.dawnMs + T.dayMs);
});

// ---------------------------------------------------------------- day and vote

test('MAFIA day: "ready to vote" needs every connected living player; dead players cannot press it', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u4', n0 + 1);
  const d0 = endNight(s, n0);
  let now = d0 + T.dawnMs;
  E.tick(s, now);
  throwsRule(() => E.markReady(s, 'u4', now + 1), 'ILLEGAL_MOVE'); // dead
  assert.equal(E.markReady(s, 'u0', now + 2), true);
  assert.equal(E.markReady(s, 'u0', now + 3), false, 'ready twice: no-op');
  E.setConnected(s, 'u3', false); // a player who is away is not waited for
  E.markReady(s, 'u1', now + 4);
  E.markReady(s, 'u2', now + 5);
  assert.equal(s.phase, 'VOTE');
  void now;
});

test('MAFIA day: the discussion ends by itself after 60 s', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  const d0 = endNight(s, n0);
  E.tick(s, d0 + T.dawnMs);
  E.tick(s, d0 + T.dawnMs + T.dayMs);
  assert.equal(s.phase, 'VOTE');
  assert.equal(s.phaseEndsAt, d0 + T.dawnMs + T.dayMs + T.voteMs);
});

test('MAFIA vote: a majority of the living players eliminates, their role is revealed, votes become public afterwards', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  const d0 = endNight(s, n0);
  let now = toVote(s, d0);
  for (const id of ['u0', 'u1', 'u2']) E.castVote(s, id, 'u3', (now += 10)); // 3 of 5 = majority
  assert.equal(s.phase, 'VOTE', 'still waiting for the last two');
  // while the vote runs nobody sees who voted for whom
  const mid = view(s, 'u4');
  assert.deepEqual(mid.votedUserIds.sort(), ['u0', 'u1', 'u2']);
  assert.equal(mid.myVote, null);
  assert.ok(!text(mid).includes('"votes"') || mid.voteResult === null);
  assert.equal(view(s, 'u0').myVote, 'u3');
  E.castVote(s, 'u3', 'skip', (now += 10));
  E.castVote(s, 'u4', 'u3', (now += 10));
  assert.equal(s.phase, 'VOTE_RESULT');
  const v = view(s, 'u4');
  assert.equal(v.voteResult!.outcome, 'eliminated');
  assert.equal(v.voteResult!.eliminatedUserId, 'u3');
  assert.equal(v.voteResult!.eliminatedRole, 'villager');
  assert.deepEqual(v.voteResult!.votes, { u0: 'u3', u1: 'u3', u2: 'u3', u3: 'skip', u4: 'u3' });
  assert.equal(v.players.find((p) => p.userId === 'u3')!.role, 'villager');
  assert.equal(v.players.find((p) => p.userId === 'u3')!.alive, false);
  E.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'NIGHT');
  assert.equal(s.round, 2);
  assert.equal(view(s, 'u4').voteHistory.length, 1);
});

test('MAFIA vote: ties, a skip majority and a plurality without a majority eliminate nobody', () => {
  const run = (votes: Record<string, string>, n = 6) => {
    const s = newGame(n);
    const n0 = toNight(s);
    const d0 = endNight(s, n0);
    let now = toVote(s, d0);
    for (const [v, t] of Object.entries(votes)) E.castVote(s, v, t, (now += 10));
    E.tick(s, s.phaseEndsAt!);
    return s;
  };
  // 6 living, 3 needed. tie 2-2 (+ skip 2)
  let s = run({ u0: 'u3', u1: 'u3', u2: 'u4', u3: 'u4', u4: 'skip', u5: 'skip' });
  assert.equal(s.voteHistory[0].outcome, 'tie');
  assert.equal(s.voteHistory[0].eliminatedUserId, null);
  assert.ok(s.players.every((p) => p.alive));
  // skip majority
  s = run({ u0: 'skip', u1: 'skip', u2: 'skip', u3: 'skip', u4: 'u3', u5: 'u0' });
  assert.equal(s.voteHistory[0].outcome, 'skip');
  assert.ok(s.players.every((p) => p.alive));
  // plurality 2 of 6, no majority
  s = run({ u0: 'u3', u1: 'u3', u2: 'u4' });
  assert.equal(s.voteHistory[0].outcome, 'no_majority');
  assert.ok(s.players.every((p) => p.alive));
  // nobody votes at all
  s = run({});
  assert.equal(s.voteHistory[0].outcome, 'no_majority');
  // exactly half is not a majority (6 living players: 4 are needed)
  s = run({ u0: 'u3', u1: 'u3', u2: 'u3' }, 6);
  assert.equal(s.voteHistory[0].outcome, 'no_majority');
  assert.equal(s.voteHistory[0].needed, 4);
  s = run({ u0: 'u3', u1: 'u3', u2: 'u3', u4: 'u3' }, 6);
  assert.equal(s.voteHistory[0].outcome, 'eliminated');
});

test('MAFIA vote: self votes, dead targets, unknown targets, changes and out-of-phase votes are refused; repeating is a no-op', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u4', n0 + 1);
  const d0 = endNight(s, n0);
  throwsRule(() => E.castVote(s, 'u0', 'u3', d0 + 1), 'WRONG_PHASE');
  let now = toVote(s, d0);
  const before = text(s);
  throwsRule(() => E.castVote(s, 'u0', 'u0', now + 1), 'ILLEGAL_MOVE'); // self
  throwsRule(() => E.castVote(s, 'u0', 'u4', now + 1), 'INVALID_INPUT'); // dead target
  throwsRule(() => E.castVote(s, 'u0', 'nobody', now + 1), 'INVALID_INPUT');
  throwsRule(() => E.castVote(s, 'u0', 7 as any, now + 1), 'INVALID_INPUT');
  throwsRule(() => E.castVote(s, 'u4', 'u3', now + 1), 'ILLEGAL_MOVE'); // dead voter
  throwsRule(() => E.castVote(s, 'stranger', 'u3', now + 1), 'NOT_PLAYER');
  assert.equal(text(s), before, 'nothing changed');
  assert.equal(E.castVote(s, 'u0', 'u3', (now += 10)), true);
  assert.equal(E.castVote(s, 'u0', 'u3', (now += 10)), false, 'same vote twice: no-op');
  throwsRule(() => E.castVote(s, 'u0', 'u2', now + 1), 'ALREADY_VOTED');
  throwsRule(() => E.castVote(s, 'u0', 'skip', now + 1), 'ALREADY_VOTED');
  assert.deepEqual(Object.keys(s.votes), ['u0']);
});

test('MAFIA vote: a vote that is too late (after the 30 s) is refused', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  const d0 = endNight(s, n0);
  const now = toVote(s, d0);
  const late = s.phaseEndsAt! + 5;
  throwsRule(() => E.castVote(s, 'u0', 'u3', late), 'WRONG_PHASE');
  assert.equal(s.phase, 'VOTE_RESULT');
  assert.equal(s.voteHistory[0].outcome, 'no_majority');
  void now;
});

// ---------------------------------------------------------------- win conditions

test('MAFIA win: the town wins when the last mafia member is voted out; everyone\'s roles are then public', () => {
  const s = newGame(5);
  const n0 = toNight(s);
  const d0 = endNight(s, n0);
  let now = toVote(s, d0);
  for (const id of ['u1', 'u2', 'u3']) E.castVote(s, id, 'u0', (now += 10));
  E.castVote(s, 'u0', 'u1', (now += 10));
  E.castVote(s, 'u4', 'u0', (now += 10));
  assert.equal(s.phase, 'VOTE_RESULT');
  E.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'FINISHED');
  assert.equal(s.winner, 'town');
  const v = view(s, 'u3');
  assert.equal(v.winner, 'town');
  assert.deepEqual(v.players.map((p) => p.role), ['mafia', 'doctor', 'detective', 'villager', 'villager']);
  assert.equal(view(s, null).players[0].role, 'mafia', 'spectators get the roles at game over too');
});

test('MAFIA win: the mafia win when they are at least as many as everybody else (checked at dawn)', () => {
  const s = newGame(5); // 1 mafia vs 4: kill two over two nights
  let n = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u3', n + 1);
  let d = endNight(s, n);
  let now = toVote(s, d);
  for (const p of E.livingPlayers(s)) E.castVote(s, p.userId, 'skip', (now += 10));
  E.tick(s, s.phaseEndsAt!);
  n = s.phaseEndsAt! - T.nightMs;
  E.submitNightAction(s, 'u0', 'kill', 'u4', n + 1);
  d = endNight(s, n);
  assert.equal(s.phase, 'DAWN', '1 mafia vs 2 others: not yet');
  now = toVote(s, d);
  for (const p of E.livingPlayers(s)) E.castVote(s, p.userId, 'skip', (now += 10));
  E.tick(s, s.phaseEndsAt!);
  n = s.phaseEndsAt! - T.nightMs;
  E.submitNightAction(s, 'u0', 'kill', 'u1', n + 1); // 1 mafia vs doctor dead -> detective only: 1 vs 1
  endNight(s, n);
  E.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'FINISHED');
  assert.equal(s.winner, 'mafia');
  assert.equal(view(s, 'u2').winner, 'mafia');
});

test('MAFIA win: after a vote the game goes on while the mafia are still outnumbered', () => {
  const s = newGame(5); // u0 mafia, u1 doctor, u2 detective, u3,u4 villagers
  const n = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u3', n + 1);
  const d = endNight(s, n);
  let now = toVote(s, d); // 4 alive: u0,u1,u2,u4
  for (const id of ['u0', 'u1', 'u4']) E.castVote(s, id, 'u2', (now += 10)); // town eliminates their own detective: 3 needed
  E.castVote(s, 'u2', 'u0', (now += 10));
  assert.equal(s.voteHistory[0].eliminatedUserId, 'u2');
  E.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'NIGHT', '1 mafia vs 2 others');
});

test('MAFIA win: a 7 player table needs both mafia gone', () => {
  const s = newGame(7);
  assert.equal(E.checkWin(s), null);
  s.players[0].alive = false;
  assert.equal(E.checkWin(s), null);
  s.players[1].alive = false;
  assert.equal(E.checkWin(s), 'town');
  const t = newGame(7);
  for (const i of [2, 3, 4]) t.players[i].alive = false; // 2 mafia vs 2 others (u5, u6)
  assert.equal(E.checkWin(t), 'mafia');
});

// ---------------------------------------------------------------- leaving, disconnecting, aborting

test('MAFIA leave: a player who leaves is dead, their role is revealed, the game goes on', () => {
  const s = newGame(6);
  const n = toNight(s);
  assert.equal(E.removePlayer(s, 'u3', n + 5), false);
  const p = s.players.find((x) => x.userId === 'u3')!;
  assert.equal(p.left, true);
  assert.equal(p.alive, false);
  assert.equal(p.role, 'villager');
  assert.equal(s.log.at(-1)!.kind, 'left');
  assert.equal(s.phase, 'NIGHT');
  assert.equal(view(s, 'u4').players.find((x) => x.userId === 'u3')!.role, 'villager');
  // leaving twice is a no-op
  assert.equal(E.removePlayer(s, 'u3', n + 6), false);
  assert.equal(s.log.filter((l) => l.kind === 'left').length, 1);
});

test('MAFIA leave: the last mafia leaving ends the game for the town; a leaving doctor\'s pick disappears', () => {
  const s = newGame(5);
  toNight(s);
  E.removePlayer(s, 'u0', T0 + T.revealMs + 5);
  assert.equal(s.phase, 'FINISHED');
  assert.equal(s.winner, 'town');
  const t = newGame(6);
  const n = toNight(t);
  E.submitNightAction(t, 'u1', 'save', 'u3', n + 1);
  E.submitNightAction(t, 'u0', 'kill', 'u3', n + 2);
  E.removePlayer(t, 'u1', n + 3);
  assert.equal(t.night.save, null);
  endNight(t, n);
  assert.equal(t.players.find((x) => x.userId === 'u3')!.alive, false, 'the leaving doctor no longer protects anybody');
});

test('MAFIA leave: a leaver\'s vote is dropped and votes for them are dropped', () => {
  const s = newGame(6);
  const n = toNight(s);
  const d = endNight(s, n);
  let now = toVote(s, d);
  E.castVote(s, 'u1', 'u3', (now += 10));
  E.castVote(s, 'u2', 'u4', (now += 10));
  E.removePlayer(s, 'u3', now + 5);
  assert.equal(s.votes.u1, undefined);
  assert.equal(s.votes.u2, 'u4');
});

test('MAFIA abort: fewer than 3 seated players aborts cleanly with no winner and no role revealed', () => {
  const s = newGame(5);
  toNight(s);
  assert.equal(E.removePlayer(s, 'u3', T0 + 9000), false);
  assert.equal(E.removePlayer(s, 'u4', T0 + 9001), false, '3 seated players keep playing');
  assert.equal(s.phase, 'NIGHT');
  assert.equal(E.removePlayer(s, 'u2', T0 + 9002), true);
  assert.equal(s.phase, 'ABORTED');
  assert.equal(s.winner, 'none');
  assert.match(s.statusMessage, /few|enough/i);
  const v = view(s, 'u0');
  assert.equal(v.winner, 'none');
  assert.equal(v.players.find((p) => p.userId === 'u1')!.role, null, 'living players\' roles stay hidden on an abort');
  // late actions are refused, the engine stays aborted
  throwsRule(() => E.castVote(s, 'u0', 'u1', T0 + 10000));
  E.abort(s, 'again');
  assert.equal(s.phase, 'ABORTED');
  assert.equal(E.tick(s, T0 + 999999), false);
});

test('MAFIA abort: the tick aborts a game whose seated players dropped below 3', () => {
  const s = newGame(5);
  for (const i of [2, 3, 4]) s.players[i].left = true;
  assert.equal(E.tick(s, T0), true);
  assert.equal(s.phase, 'ABORTED');
});

test('MAFIA disconnect: a disconnected living player is not waited for during the vote, and reconnecting restores them', () => {
  const s = newGame(5);
  const n = toNight(s);
  const d = endNight(s, n);
  let now = toVote(s, d);
  E.setConnected(s, 'u4', false);
  for (const id of ['u0', 'u1', 'u2', 'u3']) E.castVote(s, id, 'skip', (now += 10));
  assert.equal(s.phase, 'VOTE_RESULT', 'everybody present voted, the away player did not hold the vote up');
  assert.equal(s.players.find((p) => p.userId === 'u4')!.alive, true, 'away is not dead');
  E.setConnected(s, 'u4', true);
  assert.equal(s.players.find((p) => p.userId === 'u4')!.connected, true);
});

// ---------------------------------------------------------------- clock

test('MAFIA clock: a late tick chains from the old deadline, a very late one restarts the clock; a tick is idempotent', () => {
  const s = newGame(5);
  E.tick(s, s.phaseEndsAt! + 500);
  assert.equal(s.phase, 'NIGHT');
  assert.equal(s.phaseEndsAt, T0 + T.revealMs + T.nightMs, 'no drift');
  const t = newGame(5);
  const far = T0 + T.revealMs + 60_000;
  E.tick(t, far);
  assert.equal(t.phase, 'NIGHT');
  assert.equal(t.phaseEndsAt, far + T.nightMs, 'a paused server restarts the clock at now');
  const snap = text(t);
  assert.equal(E.tick(t, far), false);
  assert.equal(text(t), snap);
});

test('MAFIA clock: with nobody doing anything the game plays itself to an end without throwing', () => {
  const s = newGame(5);
  let now = T0;
  for (let i = 0; i < 400 && s.phase !== 'FINISHED' && s.phase !== 'ABORTED'; i++) {
    now = (s.phaseEndsAt ?? now) + 1;
    E.tick(s, now);
  }
  // nobody died and nobody was voted out: the loop never ends by itself, but it never breaks either
  assert.ok(['NIGHT', 'DAWN', 'DAY', 'VOTE', 'VOTE_RESULT'].includes(s.phase));
  assert.ok(s.round > 10);
});

// ---------------------------------------------------------------- chat channels

test('MAFIA chat: living players chat in DAY and VOTE only; at night only the living mafia, to each other', () => {
  const s = newGame(5);
  throwsRule(() => E.chatChannelFor(s, 'u3'), 'CHAT_LOCKED'); // ROLE_REVEAL
  throwsRule(() => E.chatChannelFor(s, 'u0'), 'CHAT_LOCKED');
  const n = toNight(s);
  throwsRule(() => E.chatChannelFor(s, 'u3'), 'CHAT_LOCKED'); // villager at night
  throwsRule(() => E.chatChannelFor(s, 'u1'), 'CHAT_LOCKED'); // doctor
  throwsRule(() => E.chatChannelFor(s, 'u2'), 'CHAT_LOCKED'); // detective
  assert.equal(E.chatChannelFor(s, 'u0'), 'mafia');
  E.submitNightAction(s, 'u0', 'kill', 'u4', n + 1);
  const d = endNight(s, n);
  throwsRule(() => E.chatChannelFor(s, 'u3'), 'CHAT_LOCKED'); // DAWN
  throwsRule(() => E.chatChannelFor(s, 'u0'), 'CHAT_LOCKED');
  E.tick(s, d + T.dawnMs);
  assert.equal(E.chatChannelFor(s, 'u3'), 'town');
  assert.equal(E.chatChannelFor(s, 'u0'), 'town', 'the mafia chat in the open by day');
  assert.equal(E.chatChannelFor(s, 'u4'), 'dead', 'the dead talk to the dead');
  throwsRule(() => E.chatChannelFor(s, 'nobody'), 'NOT_PLAYER');
});

test('MAFIA chat: who can read which channel (spectators and the living never see the graveyard or the mafia den)', () => {
  const s = newGame(5);
  const n = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u4', n + 1);
  endNight(s, n);
  const read = (who: string | null, ch: 'town' | 'mafia' | 'dead') => E.canReadChannel(s, who, ch);
  for (const who of ['u0', 'u1', 'u2', 'u3', 'u4', null]) assert.equal(read(who, 'town'), true);
  assert.deepEqual(['u0', 'u1', 'u2', 'u3', 'u4', null].map((w) => read(w, 'mafia')), [true, false, false, false, false, false]);
  assert.deepEqual(['u0', 'u1', 'u2', 'u3', 'u4', null].map((w) => read(w, 'dead')), [false, false, false, false, true, false]);
  // a dead mafia member no longer reads the mafia den (the living are not told anything by the dead, and vice versa)
  const t = newGame(8);
  t.players[0].alive = false;
  assert.equal(E.canReadChannel(t, 'u0', 'mafia'), false);
  assert.equal(E.canReadChannel(t, 'u1', 'mafia'), true);
  // after the game everybody talks in the open
  const g = newGame(5);
  g.phase = 'FINISHED';
  assert.equal(E.chatChannelFor(g, 'u4'), 'town');
});

// ---------------------------------------------------------------- redaction

function secretsOfOthers(s: MafiaServerState, viewer: string | null): string[] {
  // everything a viewer must not see: other players' hidden roles
  return s.players
    .filter((p) => p.userId !== viewer && p.alive)
    .map((p) => `"${p.userId}"`);
}

test('MAFIA redaction: no view carries the server-only blocks, ever', () => {
  const s = newGame(7);
  const n = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u5', n + 1);
  E.submitNightAction(s, 'u2', 'save', 'u5', n + 2);
  E.submitNightAction(s, 'u3', 'investigate', 'u1', n + 3);
  for (const phase of ['NIGHT', 'DAWN', 'DAY'] as const) {
    if (phase === 'DAWN') endNight(s, n);
    if (phase === 'DAY') E.tick(s, s.phaseEndsAt!);
    for (const who of [...s.players.map((p) => p.userId), null, 'stranger']) {
      const t = text(view(s, who));
      for (const forbidden of ['"secret"', '"roles"', '"night"', '"lastSaved"', '"votes":{"u']) {
        assert.ok(!t.includes(forbidden), `${phase}/${who} view contains ${forbidden}`);
      }
      assert.ok(!E.isServerState(view(s, who)));
    }
  }
});

test('MAFIA redaction: a villager sees only their own role; nobody else\'s hidden role or any night action', () => {
  const s = newGame(7); // u0,u1 mafia; u2 doctor; u3 detective; u4,u5,u6 villagers
  const n = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u5', n + 1);
  E.submitNightAction(s, 'u2', 'save', 'u4', n + 2);
  E.submitNightAction(s, 'u3', 'investigate', 'u1', n + 3);
  const v = view(s, 'u4');
  assert.deepEqual(v.me, { role: 'villager', alive: true, teammates: [], nightAction: null, nightChoice: null, teamChoices: {}, lastSavedUserId: null, investigations: [] });
  assert.ok(v.players.every((p) => p.role === null), 'no public role while everybody lives');
  const t = text(v);
  for (const needle of ['"mafia"', '"doctor"', '"detective"', 'isMafia', '"u5","u2"']) assert.ok(!t.includes(needle), `villager view contains ${needle}`);
  assert.ok(!t.includes('"targetUserId"'));
});

test('MAFIA redaction: only the mafia learn their teammates; the doctor and the detective see only their own pick', () => {
  const s = newGame(7);
  const n = toNight(s);
  E.submitNightAction(s, 'u0', 'kill', 'u5', n + 1);
  E.submitNightAction(s, 'u2', 'save', 'u4', n + 2);
  E.submitNightAction(s, 'u3', 'investigate', 'u1', n + 3);
  assert.deepEqual(view(s, 'u0').me!.teammates, ['u1']);
  assert.deepEqual(view(s, 'u1').me!.teammates, ['u0']);
  for (const other of ['u2', 'u3', 'u4', 'u5', 'u6', null]) assert.deepEqual(view(s, other)?.me?.teammates ?? [], [], `${other} got teammates`);
  // the doctor
  const doc = view(s, 'u2');
  assert.equal(doc.me!.role, 'doctor');
  assert.equal(doc.me!.nightAction, 'save');
  assert.equal(doc.me!.nightChoice, 'u4');
  assert.deepEqual(doc.me!.teamChoices, {});
  assert.ok(!JSON.stringify(doc.me).includes('"u5"'), 'the doctor never learns the mafia victim');
  // the detective
  const det = view(s, 'u3');
  assert.equal(det.me!.nightChoice, 'u1');
  assert.ok(!JSON.stringify(det.me).includes('"u5"'));
  // the mafia never see who the doctor / detective picked or who they are
  const maf = view(s, 'u0');
  assert.ok(!JSON.stringify(maf).includes('"doctor"') && !JSON.stringify(maf).includes('"detective"'));
  assert.deepEqual(maf.me!.teamChoices, { u0: 'u5' });
  // spectators and strangers: public only
  for (const nobody of [null, 'stranger']) {
    const sp = view(s, nobody);
    assert.equal(sp.me, null);
    assert.equal(sp.myVote, null);
    const t = text(sp);
    for (const needle of ['"mafia"', '"doctor"', '"detective"', '"villager"', 'teamChoices', 'nightChoice', 'investigations']) assert.ok(!t.includes(needle), `spectator view contains ${needle}`);
  }
});

test('MAFIA redaction: the dead keep their own role and the public log but learn no living role or teammate', () => {
  const s = newGame(8); // u0,u1 mafia
  const n = toNight(s);
  throwsRule(() => E.submitNightAction(s, 'u0', 'kill', 'u1', n + 1), 'ILLEGAL_MOVE'); // a teammate: refused, kill a villager instead
  assert.equal(s.night.kill.u0, undefined);
  E.submitNightAction(s, 'u0', 'kill', 'u5', n + 1);
  endNight(s, n);
  const deadVillager = view(s, 'u5');
  assert.equal(deadVillager.me!.alive, false);
  assert.equal(deadVillager.me!.role, 'villager');
  assert.equal(deadVillager.me!.nightAction, null);
  const t = text(deadVillager);
  for (const needle of ['"mafia"', '"doctor"', '"detective"']) assert.ok(!t.includes(needle), `dead villager view contains ${needle}`);
  assert.equal(deadVillager.players.find((p) => p.userId === 'u5')!.role, 'villager', 'the dead player\'s own role is public');
  assert.ok(deadVillager.log.length === 1 && deadVillager.log[0].kind === 'night_death');
  // a dead MAFIA member does not get the list of living teammates
  const dm = newGame(8);
  const m0 = toNight(dm);
  dm.players[0].alive = false;
  dm.players[0].role = 'mafia';
  void m0;
  const dmView = view(dm, 'u0');
  assert.deepEqual(dmView.me!.teammates, []);
  assert.equal(dmView.me!.role, 'mafia');
  assert.equal(dmView.players.find((p) => p.userId === 'u1')!.role, null, 'the living teammate stays hidden');
});

test('MAFIA redaction: votes stay hidden during the vote and become public at the result; the vote view never shows another player\'s target', () => {
  const s = newGame(5);
  const n = toNight(s);
  const d = endNight(s, n);
  let now = toVote(s, d);
  E.castVote(s, 'u0', 'u3', (now += 10));
  E.castVote(s, 'u1', 'skip', (now += 10));
  for (const who of ['u2', 'u3', null]) {
    const v = view(s, who);
    assert.deepEqual(v.votedUserIds.sort(), ['u0', 'u1']);
    assert.equal(v.myVote, null);
    assert.equal(v.voteResult, null);
    assert.ok(!text(v).includes('"u0":"u3"'));
    assert.ok(!text(v).includes('"u1":"skip"'));
  }
  assert.equal(view(s, 'u1').myVote, 'skip');
  E.castVote(s, 'u2', 'skip', (now += 10)); E.castVote(s, 'u3', 'skip', (now += 10)); E.castVote(s, 'u4', 'skip', (now += 10));
  assert.equal(s.phase, 'VOTE_RESULT');
  assert.deepEqual(view(s, null).voteResult!.votes, { u0: 'u3', u1: 'skip', u2: 'skip', u3: 'skip', u4: 'skip' });
});

test('MAFIA redaction: a view that is already redacted passes through, and no input yields null', () => {
  const s = newGame(5);
  const v = view(s, 'u0');
  assert.equal(E.publicStateFor(v, 'u1'), v);
  assert.equal(E.publicStateFor(null, 'u0'), null);
  assert.equal(E.publicStateFor(undefined, 'u0'), null);
  const copy = JSON.parse(text(s));
  view(s, 'u0'); view(s, null);
  assert.deepEqual(JSON.parse(text(s)), copy, 'building a view never mutates the state');
});

test('MAFIA redaction: a game that ended in a win shows every role in the final view only', () => {
  const s = newGame(5);
  const n = toNight(s);
  assert.ok(view(s, 'u3').players.every((p) => p.role === null));
  E.removePlayer(s, 'u0', n + 1);
  assert.equal(s.phase, 'FINISHED');
  const f = view(s, 'u3');
  assert.deepEqual(f.players.map((p) => p.role), ['mafia', 'doctor', 'detective', 'villager', 'villager']);
  assert.equal(f.me!.teammates.length, 0);
});

// ---------------------------------------------------------------- limiter, schemas

test('MAFIA rate limiter: at most N per window per key, then free again', () => {
  const key = 'room:user:night';
  for (let i = 0; i < 5; i++) assert.equal(mafiaRateAllowed(key, 5, 1000, 1000 + i), true);
  assert.equal(mafiaRateAllowed(key, 5, 1000, 1010), false);
  assert.equal(mafiaRateAllowed(key, 5, 1000, 2100), true);
  assert.equal(mafiaRateAllowed('other', 5, 1000, 1010), true, 'keys are independent');
});

test('MAFIA schemas: night action and vote payloads are validated and unknown keys are dropped', () => {
  assert.deepEqual(parseMafiaNightPayload(mafiaNightActionSchema, { action: 'kill', targetUserId: 'u1', extra: 1 }), { action: 'kill', targetUserId: 'u1' });
  for (const junk of [null, 'x', 5, [], {}, { action: 'kill' }, { action: 'poison', targetUserId: 'u1' }, { action: 'kill', targetUserId: { $ne: 1 } }, { action: 'save', targetUserId: '' }, { action: 'save', targetUserId: 'x'.repeat(200) }]) {
    throwsRule(() => parseMafiaNightPayload(mafiaNightActionSchema, junk), 'INVALID_INPUT');
  }
  assert.deepEqual(parseMafiaNightPayload(mafiaNightVoteSchema, { targetUserId: 'skip' }), { targetUserId: 'skip' });
  for (const junk of [null, 'x', 5, [], {}, { targetUserId: ['a'] }, { targetUserId: 7 }]) throwsRule(() => parseMafiaNightPayload(mafiaNightVoteSchema, junk), 'INVALID_INPUT');
});
