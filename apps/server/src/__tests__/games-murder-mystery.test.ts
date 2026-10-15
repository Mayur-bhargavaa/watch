import './_noRealDb.js'; // never reach a real database from tests
import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { MurderCaseDef, MurderServerState } from '@synccinema/common';
import { MURDER_SCORING } from '@synccinema/common';
import {
  MURDER_TIMING,
  MurderMysteryEngine as E,
  cleanMurderText,
  dealCharacters,
  murderMinActive,
  murderMinPlayers,
  murderRateAllowed,
  pickCharacters
} from '../games/MurderMysteryEngine.js';
import { MURDER_CASES } from '../games/murderMysteryCases.js';
import { GameRuleError } from '../games/GameRuleError.js';

// Engine tests of Murder Mystery Night on a FIXTURE catalogue (the real cases are checked in games-murder-mystery-cases.test.ts):
// dealing, phases with a fake clock, whispers, sharing clues, accusations and scoring, withdrawal, abort, rematch, redaction.

const T0 = 1_000_000;
const ID = (i: number) => `c${String(i).padStart(2, '0')}`;

/** A 12 character fixture case. Every secret text carries its own marker so a leak is easy to find. */
function fixtureCase(id: string, murderer = 1, required = [1, 2, 3, 4]): MurderCaseDef {
  const characters = Array.from({ length: 12 }, (_, k) => {
    const i = k + 1;
    return {
      id: ID(i),
      name: `Name${id}${ID(i)}`,
      bio: `BIO-${id}-${ID(i)}`,
      relationship: `REL-${id}-${ID(i)}`,
      secretMotive: `SECRETMOTIVE-${id}-${ID(i)}`,
      alibi: `ALIBI-${id}-${ID(i)}`,
      alibiTruth: `ALIBITRUTH-${id}-${ID(i)}`,
      secret: `PERSONALSECRET-${id}-${ID(i)}`
    };
  });
  const priv = (cid: string, owner: number, r: number) => ({ id: `${cid}`, ownerId: ID(owner), text: `PRIVCLUE-${id}-${cid}` });
  return {
    id,
    title: `Case ${id}`,
    tagline: `Tagline ${id}`,
    blurb: `Blurb ${id}`,
    victim: { name: `Victim ${id}`, bio: 'A victim.', causeOfDeath: 'Unknown' },
    characters,
    required: required.map(ID),
    solution: { murdererId: ID(murderer), motive: `SOLUTIONMOTIVE-${id}`, method: `SOLUTIONMETHOD-${id}`, summary: `SOLUTIONSUMMARY-${id}` },
    rounds: [
      { title: 'One', publicClues: [{ id: 'r1-a', text: `PUBCLUE-${id}-1` }], privateClues: [priv('r1-p1', 2, 1), priv('r1-p2', 5, 1), priv('r1-p3', 1, 1)] },
      { title: 'Two', publicClues: [{ id: 'r2-a', text: `PUBCLUE-${id}-2` }], privateClues: [priv('r2-p1', 3, 2), priv('r2-p2', 2, 2)] },
      { title: 'Three', publicClues: [{ id: 'r3-a', text: `PUBCLUE-${id}-3` }], privateClues: [priv('r3-p1', 4, 3), priv('r3-p2', 2, 3), priv('r3-p3', 2, 3)] },
      { title: 'Four', publicClues: [{ id: 'r4-a', text: `PUBCLUE-${id}-4` }], privateClues: [priv('r4-p1', 2, 4)] }
    ],
    timeline: [`TIMELINE-${id}-1`, `TIMELINE-${id}-2`]
  };
}

const FX_A = fixtureCase('A');
const FX_B = fixtureCase('B', 7, [7, 8, 9]);
const FX_C = fixtureCase('C', 3, [3, 1, 2, 4, 5, 6, 7]); // `required` bigger than a small table
const realCatalogue = E.catalogue;
E.catalogue = [FX_A, FX_B];
after(() => { E.catalogue = realCatalogue; });

const env = process.env as Record<string, string | undefined>;
const keepEnv = { t: env.MURDER_TEST_MIN_PLAYERS, n: env.NODE_ENV };
afterEach(() => {
  env.MURDER_TEST_MIN_PLAYERS = keepEnv.t ?? '';
  if (keepEnv.n === undefined) delete env.NODE_ENV; else env.NODE_ENV = keepEnv.n;
});

/** A seeded rng so every run deals the same. */
function seeded(seed: number) {
  let x = seed >>> 0;
  return (n: number) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n; };
}

const pid = (i: number) => `p${i}`;
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: pid(i + 1), displayName: `P${i + 1}`, avatarUrl: null, seat: i }));

function game(n = 6, opts: { caseChoice?: string; seed?: number } = {}) {
  const st = E.createInitialState(seats(n), T0, { rng: seeded(opts.seed ?? 7), caseChoice: opts.caseChoice ?? 'A' });
  const murderer = st.secret.murdererUserId as string;
  const charOf = (u: string) => st.secret.assignment[u];
  const ids = st.players.map((p) => p.userId);
  const innocents = ids.filter((u) => u !== murderer);
  const ownerOf = (cid: string) => ids.find((u) => charOf(u) === cid);
  return { st, murderer, charOf, ids, innocents, ownerOf };
}

/** to the first clue round */
function toRound1(g: ReturnType<typeof game>) {
  E.tick(g.st, T0 + MURDER_TIMING.revealMs);
  assert.equal(g.st.phase, 'CLUE_ROUND');
  assert.equal(g.st.round, 1);
}
/** to the ACCUSATION phase through the clock */
function toAccusation(g: ReturnType<typeof game>) {
  let t = T0 + MURDER_TIMING.revealMs;
  E.tick(g.st, t);
  for (let r = 1; r <= 4; r++) { t += MURDER_TIMING.roundMs; E.tick(g.st, t); }
  assert.equal(g.st.phase, 'ACCUSATION');
  return t;
}
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: any) => e instanceof GameRuleError && e.code === code, `expected ${code}`);

// ---------------------------------------------------------------------
// switches / helpers
// ---------------------------------------------------------------------

test('MURDER test switch: MURDER_TEST_MIN_PLAYERS (2 to 6) only outside production, any other value is ignored', () => {
  env.MURDER_TEST_MIN_PLAYERS = ''; assert.equal(murderMinPlayers(), 6); assert.equal(murderMinActive(), 4);
  env.MURDER_TEST_MIN_PLAYERS = '3'; assert.equal(murderMinPlayers(), 3); assert.equal(murderMinActive(), 3);
  env.MURDER_TEST_MIN_PLAYERS = '2'; assert.equal(murderMinPlayers(), 2); assert.equal(murderMinActive(), 2);
  env.MURDER_TEST_MIN_PLAYERS = '6'; assert.equal(murderMinPlayers(), 6);
  for (const bad of ['7', '1', '0', 'abc', '4.5', '-1', '12']) { env.MURDER_TEST_MIN_PLAYERS = bad; assert.equal(murderMinPlayers(), 6, bad); }
  env.MURDER_TEST_MIN_PLAYERS = '3'; (env as any).NODE_ENV = 'production';
  assert.equal(murderMinPlayers(), 6);
  throwsCode(() => E.createInitialState(seats(5), T0), 'INVALID_INPUT');
});

test('MURDER text helper strips control characters and collapses whitespace', () => {
  assert.equal(cleanMurderText('  a\n\tb\u0000   c  '), 'a b c');
  assert.equal(cleanMurderText(undefined), '');
});

test('MURDER rate limiter: counts per key inside the window', () => {
  assert.equal(murderRateAllowed('r:u:k', 2, 1000, 0), true);
  assert.equal(murderRateAllowed('r:u:k', 2, 1000, 10), true);
  assert.equal(murderRateAllowed('r:u:k', 2, 1000, 20), false);
  assert.equal(murderRateAllowed('r:u:k', 2, 1000, 1100), true);
});

// ---------------------------------------------------------------------
// dealing
// ---------------------------------------------------------------------

test('MURDER dealing: N = 2..12 uses N characters, always the murderer, one per player, murderer assigned to a player', () => {
  env.MURDER_TEST_MIN_PLAYERS = '2';
  for (let n = 2; n <= 12; n++) {
    for (const seed of [1, 2, 3]) {
      const ids = Array.from({ length: n }, (_, i) => pid(i + 1));
      const d = dealCharacters(FX_A, ids, seeded(seed * 31 + n));
      const used = Object.values(d.assignment);
      assert.equal(used.length, n);
      assert.equal(new Set(used).size, n, 'a character dealt twice');
      assert.ok(used.includes(FX_A.solution.murdererId), `murderer missing for n=${n}`);
      assert.equal(d.assignment[d.murdererUserId], FX_A.solution.murdererId);
      assert.ok(ids.includes(d.murdererUserId));
      assert.equal(d.absent.length, 12 - n);
      assert.ok(d.absent.every((a) => !used.includes(a)));
      if (n >= FX_A.required.length) for (const r of FX_A.required) assert.ok(used.includes(r), `required ${r} missing for n=${n}`);
    }
  }
});

test('MURDER dealing: with a table smaller than `required` the murderer comes first, then random required characters', () => {
  const p = pickCharacters(FX_C, 3, seeded(5));
  assert.equal(p.used.length, 3);
  assert.equal(p.used[0], ID(3));
  assert.ok(p.used.slice(1).every((id) => FX_C.required.includes(id) && id !== ID(3)));
  const full = pickCharacters(FX_C, 8, seeded(5));
  for (const r of FX_C.required) assert.ok(full.used.includes(r));
  assert.equal(new Set(full.used).size, 8);
});

test('MURDER dealing: the murderer\'s player is random (every seat gets it across seeds) and the rng is injectable', () => {
  const hit = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) hit.add(dealCharacters(FX_A, ['a', 'b', 'c', 'd', 'e', 'f'], seeded(seed)).murdererUserId);
  assert.equal(hit.size, 6);
  const a = dealCharacters(FX_A, ['a', 'b', 'c', 'd', 'e', 'f'], seeded(9));
  const b = dealCharacters(FX_A, ['a', 'b', 'c', 'd', 'e', 'f'], seeded(9));
  assert.deepEqual(a, b);
});

test('MURDER start: 6 to 12 players, no duplicates, the picked case is played and the game opens with the character reveal', () => {
  throwsCode(() => E.createInitialState(seats(5), T0), 'INVALID_INPUT');
  throwsCode(() => E.createInitialState(seats(13), T0), 'INVALID_INPUT');
  throwsCode(() => E.createInitialState([...seats(5), { userId: 'p1', displayName: 'dup', seat: 9 }], T0), 'INVALID_INPUT');
  const g = game(8, { caseChoice: 'B' });
  assert.equal(g.st.secret.caseId, 'B');
  assert.equal(g.st.phase, 'CHARACTER_REVEAL');
  assert.equal(g.st.phaseEndsAt, T0 + MURDER_TIMING.revealMs);
  assert.equal(MURDER_TIMING.revealMs, 15_000);
  assert.equal(MURDER_TIMING.roundMs, 90_000);
  assert.equal(MURDER_TIMING.accusationMs, 60_000);
  assert.equal(g.charOf(g.murderer), FX_B.solution.murdererId);
});

// ---------------------------------------------------------------------
// phases
// ---------------------------------------------------------------------

test('MURDER phases: reveal 15 s, four clue rounds of 90 s, accusation 60 s, result, final (fake clock)', () => {
  const g = game(6);
  const { st } = g;
  E.tick(st, T0 + 14_000);
  assert.equal(st.phase, 'CHARACTER_REVEAL');
  let t = T0 + 15_000;
  E.tick(st, t);
  assert.deepEqual([st.phase, st.round], ['CLUE_ROUND', 1]);
  for (let r = 2; r <= 4; r++) {
    t += 90_000 - 1;
    E.tick(st, t);
    assert.equal(st.round, r - 1);
    t += 1;
    E.tick(st, t);
    assert.deepEqual([st.phase, st.round], ['CLUE_ROUND', r]);
    assert.equal(st.phaseEndsAt, t + 90_000, 'phases chain without drift');
  }
  t += 90_000;
  E.tick(st, t);
  assert.equal(st.phase, 'ACCUSATION');
  assert.equal(st.round, 4);
  assert.equal(st.phaseEndsAt, t + 60_000);
  t += 60_000;
  E.tick(st, t);
  assert.equal(st.phase, 'RESULT');
  assert.ok(st.secret.result);
  t += MURDER_TIMING.resultMs;
  E.tick(st, t);
  assert.equal(st.phase, 'FINAL');
  assert.equal(st.phaseEndsAt, null);
  assert.equal(E.tick(st, t + 1e9), false);
});

test('MURDER phases: after a long pause (server asleep) only one phase advances and the next one starts from now (nobody loses a round)', () => {
  const g = game(6);
  const late = T0 + 15_000 + 3_000_000;
  E.tick(g.st, late);
  assert.deepEqual([g.st.phase, g.st.round], ['CLUE_ROUND', 1]);
  assert.equal(g.st.phaseEndsAt, late + 90_000);
  // a slightly late tick keeps the original cadence (within 2 s)
  const g2 = game(6);
  E.tick(g2.st, T0 + 15_000 + 1_500);
  assert.equal(g2.st.phaseEndsAt, T0 + 15_000 + 90_000);
});

test('MURDER phases: everybody ready ends a clue round early; an absent (disconnected) player is not waited for; round 4 goes to the accusation', () => {
  const g = game(6);
  toRound1(g);
  const t = T0 + 20_000;
  g.ids.slice(0, 5).forEach((u) => E.markReady(g.st, u, t));
  assert.equal(g.st.round, 1);
  E.setConnected(g.st, g.ids[5], false);
  E.tick(g.st, t);
  assert.equal(g.st.round, 2, 'the missing player is not waited for');
  assert.deepEqual(g.st.readyUserIds, []);
  assert.equal(E.markReady(g.st, g.ids[0], t), true);
  assert.equal(E.markReady(g.st, g.ids[0], t), false, 'ready twice is a no-op');
  throwsCode(() => E.markReady(g.st, 'stranger', t), 'NOT_PLAYER');
});

test('MURDER host next: skips to the next round, refuses a double press right after a phase start, RESULT goes to FINAL', () => {
  const g = game(6);
  throwsCode(() => E.advance(g.st, T0 + 1), 'WRONG_PHASE'); // reveal
  toRound1(g);
  const t0 = g.st.phaseEndsAt! - 90_000;
  assert.equal(E.advance(g.st, t0 + 500), false, 'dwell guard');
  assert.equal(g.st.round, 1);
  assert.equal(E.advance(g.st, t0 + 5_000), true);
  assert.equal(g.st.round, 2);
  assert.equal(E.advance(g.st, t0 + 5_100), false);
  assert.equal(g.st.round, 2);
  E.advance(g.st, t0 + 10_000); E.advance(g.st, t0 + 20_000);
  assert.equal(g.st.round, 4);
  E.advance(g.st, t0 + 30_000);
  assert.equal(g.st.phase, 'ACCUSATION');
  throwsCode(() => E.advance(g.st, t0 + 40_000), 'WRONG_PHASE');
  E.tick(g.st, t0 + 30_000 + 60_000);
  assert.equal(g.st.phase, 'RESULT');
  const rs = g.st.phaseEndsAt! - MURDER_TIMING.resultMs;
  assert.equal(E.advance(g.st, rs + 5_000), true);
  assert.equal(g.st.phase, 'FINAL');
});

test('MURDER accusation phase ends as soon as every present player has accused', () => {
  const g = game(6);
  const t = toAccusation(g);
  const target = (u: string) => g.ids.map(g.charOf).find((c) => c !== g.charOf(u))!;
  g.ids.slice(0, 5).forEach((u) => E.accuse(g.st, u, target(u), 'because', t + 1_000));
  assert.equal(g.st.phase, 'ACCUSATION');
  E.accuse(g.st, g.ids[5], target(g.ids[5]), '', t + 2_000);
  assert.equal(g.st.phase, 'RESULT');
});

// ---------------------------------------------------------------------
// whispers
// ---------------------------------------------------------------------

test('MURDER whispers: only in a clue round, to one other seated player, 140 characters, 5 per player per round', () => {
  const g = game(6);
  const [a, b, c] = g.ids;
  throwsCode(() => E.whisper(g.st, a, b, 'too early', T0 + 1), 'WRONG_PHASE');
  toRound1(g);
  const t = T0 + 20_000;
  throwsCode(() => E.whisper(g.st, a, a, 'me', t), 'ILLEGAL_MOVE');
  throwsCode(() => E.whisper(g.st, a, 'nobody', 'hi', t), 'INVALID_INPUT');
  throwsCode(() => E.whisper(g.st, a, 42, 'hi', t), 'INVALID_INPUT');
  throwsCode(() => E.whisper(g.st, a, b, '   ', t), 'INVALID_INPUT');
  throwsCode(() => E.whisper(g.st, a, b, 'x'.repeat(141), t), 'INVALID_INPUT');
  throwsCode(() => E.whisper(g.st, 'stranger', b, 'hi', t), 'NOT_PLAYER');
  assert.equal(E.whisper(g.st, a, b, 'x'.repeat(140), t).text.length, 140);
  for (let i = 0; i < 4; i++) E.whisper(g.st, a, c, `w${i}`, t + i);
  throwsCode(() => E.whisper(g.st, a, b, 'sixth', t + 10), 'ILLEGAL_MOVE');
  assert.equal(E.publicStateFor(g.st, a, t)!.me!.whispersLeft, 0);
  assert.equal(E.publicStateFor(g.st, b, t)!.me!.whispersLeft, 5, 'the limit is per sender');
  // the next round gives five new ones
  E.advance(g.st, g.st.phaseEndsAt! - 90_000 + 5_000);
  assert.equal(g.st.round, 2);
  assert.equal(E.publicStateFor(g.st, a, t)!.me!.whispersLeft, 5);
  E.whisper(g.st, a, b, 'new round', t + 6_000);
  assert.equal(E.publicStateFor(g.st, a, t)!.me!.whispersLeft, 4);
});

test('MURDER whispers: nobody whispers to / from a player who withdrew; whispers are not allowed in the accusation phase', () => {
  const g = game(7);
  toRound1(g);
  const t = T0 + 20_000;
  E.removePlayer(g.st, g.ids[6], t);
  throwsCode(() => E.whisper(g.st, g.ids[0], g.ids[6], 'hello', t), 'INVALID_INPUT');
  throwsCode(() => E.whisper(g.st, g.ids[6], g.ids[0], 'hello', t), 'NOT_PLAYER');
  toAccusation(g);
  throwsCode(() => E.whisper(g.st, g.ids[0], g.ids[1], 'late', T0 + 9e6), 'WRONG_PHASE');
});

test('MURDER whispers reach only the sender and the receiver', () => {
  const g = game(6);
  toRound1(g);
  const [a, b, c, d] = g.ids;
  E.whisper(g.st, a, b, 'WHISPER-SECRET-TEXT', T0 + 20_000);
  for (const [u, sees] of [[a, true], [b, true], [c, false], [d, false], ['spectator', false], [null, false]] as Array<[string | null, boolean]>) {
    const v = E.publicStateFor(g.st, u, T0 + 20_000)!;
    assert.equal(JSON.stringify(v).includes('WHISPER-SECRET-TEXT'), sees, `viewer ${u}`);
  }
  assert.equal(E.publicStateFor(g.st, b, 0)!.me!.whispers[0].fromUserId, a);
});

// ---------------------------------------------------------------------
// private clues and sharing
// ---------------------------------------------------------------------

test('MURDER private clues: delivered to their character\'s player round by round; a dropped character\'s clues go to nobody', () => {
  const g = game(6);
  const owner2 = g.ownerOf(ID(2))!;
  assert.deepEqual(E.publicStateFor(g.st, owner2, T0)!.me!.privateClues, [], 'nothing during the reveal');
  toRound1(g);
  assert.deepEqual(E.publicStateFor(g.st, owner2, T0)!.me!.privateClues.map((c) => c.id), ['r1-p1']);
  const absent = g.st.secret.absent;
  assert.ok(absent.length === 6);
  const everyone = g.ids.flatMap((u) => E.publicStateFor(g.st, u, T0)!.me!.privateClues.map((c) => c.id));
  const expected = FX_A.rounds[0].privateClues.filter((c) => !absent.includes(c.ownerId)).map((c) => c.id);
  assert.deepEqual(everyone.sort(), expected.sort());
  E.advance(g.st, g.st.phaseEndsAt! - 90_000 + 5_000);
  assert.deepEqual(E.publicStateFor(g.st, owner2, T0)!.me!.privateClues.map((c) => c.id), ['r1-p1', 'r2-p2']);
});

test('MURDER share clue: only your own delivered clues, once, three per game, only during a clue round; it joins the public evidence board', () => {
  const g = game(6);
  const owner2 = g.ownerOf(ID(2))!;
  const owner3 = g.ownerOf(ID(3))!;
  throwsCode(() => E.shareClue(g.st, owner2, 'r1-p1', T0 + 1), 'WRONG_PHASE');
  toRound1(g);
  const t = T0 + 20_000;
  throwsCode(() => E.shareClue(g.st, owner2, 'r2-p2', t), 'INVALID_INPUT'); // not delivered yet
  throwsCode(() => E.shareClue(g.st, owner3, 'r1-p1', t), 'INVALID_INPUT'); // somebody else's
  throwsCode(() => E.shareClue(g.st, owner2, 'nonsense', t), 'INVALID_INPUT');
  throwsCode(() => E.shareClue(g.st, owner2, 7, t), 'INVALID_INPUT');
  assert.equal(E.shareClue(g.st, owner2, 'r1-p1', t), true);
  assert.equal(E.shareClue(g.st, owner2, 'r1-p1', t), false, 'twice changes nothing');
  assert.equal(g.st.evidence.length, 1);
  const everyone = E.publicStateFor(g.st, g.ids.find((u) => u !== owner2)!, t)!;
  assert.deepEqual(everyone.evidence.map((e) => [e.clueId, e.sharedByUserId]), [['r1-p1', owner2]]);
  assert.ok(JSON.stringify(everyone).includes('PRIVCLUE-A-r1-p1'));
  assert.equal(E.publicStateFor(g.st, owner2, t)!.me!.privateClues[0].shared, true);
  // more rounds, up to the cap of three
  g.st.phaseEndsAt = t; E.tick(g.st, t); // round 2
  assert.equal(E.shareClue(g.st, owner2, 'r2-p2', t + 1), true);
  g.st.phaseEndsAt = t; E.tick(g.st, t + 1); // round 3
  assert.equal(E.shareClue(g.st, owner2, 'r3-p2', t + 2), true);
  assert.equal(E.publicStateFor(g.st, owner2, t)!.me!.sharesLeft, 0);
  throwsCode(() => E.shareClue(g.st, owner2, 'r3-p3', t + 3), 'ILLEGAL_MOVE');
  assert.equal(g.st.evidence.length, 3);
});

// ---------------------------------------------------------------------
// accusations and scoring
// ---------------------------------------------------------------------

function accuseAll(g: ReturnType<typeof game>, t: number, picks: Record<string, string | null>) {
  let i = 0;
  for (const [u, c] of Object.entries(picks)) if (c !== null) E.accuse(g.st, u, c, `motive ${u}`, t + ++i);
}
const row = (g: ReturnType<typeof game>, u: string) => g.st.secret.result!.rows.find((r) => r.userId === u)!;

test('MURDER accusation rules: only in the accusation phase, a character of this game, not your own, final once sent, 120 characters', () => {
  const g = game(6);
  const a = g.innocents[0];
  const right = FX_A.solution.murdererId;
  toRound1(g);
  throwsCode(() => E.accuse(g.st, a, right, '', T0 + 20_000), 'WRONG_PHASE');
  const t = toAccusation(g);
  throwsCode(() => E.accuse(g.st, a, 'nobody', '', t), 'INVALID_INPUT');
  throwsCode(() => E.accuse(g.st, a, g.st.secret.absent[0], '', t), 'INVALID_INPUT');
  throwsCode(() => E.accuse(g.st, a, g.charOf(a), '', t), 'ILLEGAL_MOVE');
  throwsCode(() => E.accuse(g.st, a, right, 'x'.repeat(121), t), 'INVALID_INPUT');
  throwsCode(() => E.accuse(g.st, 'stranger', right, '', t), 'NOT_PLAYER');
  assert.equal(E.accuse(g.st, a, right, '  long   motive ', t), true);
  assert.equal(g.st.secret.accusations[a].motive, 'long motive');
  assert.equal(E.accuse(g.st, a, right, 'long motive', t), false, 'the same again is a no-op');
  throwsCode(() => E.accuse(g.st, a, g.charOf(g.murderer) === right ? g.charOf(g.innocents[1]) : right, '', t), 'ALREADY_VOTED');
  assert.equal(g.st.secret.accuseSeq, 1);
});

test('MURDER scoring: correct +100, first three correct +25, wrong 0, murderer +150 when fewer than half got it', () => {
  const g = game(8);
  const right = FX_A.solution.murdererId;
  const t = toAccusation(g);
  const [i1, i2, i3, i4, i5, i6, i7] = g.innocents;
  const wrong = (u: string) => g.ids.map(g.charOf).find((c) => c !== right && c !== g.charOf(u))!;
  // 3 of 7 others get it right (3 * 2 < 7: the murderer survives); the speed order is the server order of submission
  accuseAll(g, t, { [i3]: right, [i1]: right, [i2]: right, [i4]: wrong(i4), [i5]: wrong(i5), [g.murderer]: wrong(g.murderer) });
  E.tick(g.st, t + 60_000);
  assert.equal(g.st.phase, 'RESULT');
  const res = g.st.secret.result!;
  assert.equal(res.murdererSurvived, true);
  assert.equal(res.correctCount, 3);
  assert.equal(res.otherCount, 7);
  assert.deepEqual([row(g, i3).correctOrder, row(g, i1).correctOrder, row(g, i2).correctOrder], [1, 2, 3]);
  for (const u of [i1, i2, i3]) { assert.equal(row(g, u).base, 100); assert.equal(row(g, u).speedBonus, 25); assert.equal(row(g, u).total, 125); }
  for (const u of [i4, i5, i6, i7]) assert.equal(row(g, u).total, 0);
  assert.equal(row(g, i6).accusedCharacterId, null, 'no accusation');
  assert.equal(row(g, g.murderer).murdererBonus, 150);
  assert.equal(row(g, g.murderer).total, 150);
  assert.equal(row(g, g.murderer).correct, false);
  assert.equal(res.rows[0].userId, g.murderer);
  assert.equal(res.winnerUserId, g.murderer);
});

test('MURDER scoring: the fourth correct accusation gets no speed bonus; half or more correct means the murderer scores 0', () => {
  const g = game(6);
  const right = FX_A.solution.murdererId;
  const t = toAccusation(g);
  const [i1, i2, i3, i4, i5] = g.innocents;
  accuseAll(g, t, { [i1]: right, [i2]: right, [i3]: right, [i4]: right, [i5]: g.ids.map(g.charOf).find((c) => c !== right && c !== g.charOf(i5))! });
  E.tick(g.st, t + 60_000);
  const res = g.st.secret.result!;
  assert.equal(res.correctCount, 4);
  assert.equal(res.murdererSurvived, false);
  assert.equal(row(g, g.murderer).total, 0);
  assert.equal(row(g, i4).speedBonus, 0);
  assert.equal(row(g, i4).total, 100);
  assert.equal(row(g, i3).total, 125);
  assert.equal(row(g, i5).total, 0);
});

test('MURDER scoring: exactly half correct is NOT fewer than half (murderer 0); one short of half survives', () => {
  // 6 players: 5 others, half = 2.5. 2 correct -> survives, 3 correct -> does not
  for (const [correct, survives] of [[2, true], [3, false]] as Array<[number, boolean]>) {
    const g = game(6);
    const right = FX_A.solution.murdererId;
    const t = toAccusation(g);
    const picks: Record<string, string> = {};
    g.innocents.forEach((u, i) => { picks[u] = i < correct ? right : g.ids.map(g.charOf).find((c) => c !== right && c !== g.charOf(u))!; });
    accuseAll(g, t, picks);
    E.tick(g.st, t + 60_000);
    assert.equal(g.st.secret.result!.murdererSurvived, survives, `${correct} correct`);
  }
  // 8 players: 7 others; 4 correct is more than half; 7 players -> 6 others, exactly 3 is half -> 0
  const g = game(7);
  const right = FX_A.solution.murdererId;
  const t = toAccusation(g);
  const picks: Record<string, string> = {};
  g.innocents.forEach((u, i) => { picks[u] = i < 3 ? right : g.ids.map(g.charOf).find((c) => c !== right && c !== g.charOf(u))!; });
  accuseAll(g, t, picks);
  E.tick(g.st, t + 60_000);
  assert.equal(g.st.secret.result!.murdererSurvived, false, 'exactly half');
});

test('MURDER scoring: the murderer cannot score by accusing; sharing clues adds +10 each (max 3) for everybody', () => {
  const g = game(6);
  toRound1(g);
  const owner2 = g.ownerOf(ID(2))!;
  E.shareClue(g.st, owner2, 'r1-p1', T0 + 20_000);
  const t = toAccusation(g);
  const right = FX_A.solution.murdererId;
  throwsCode(() => E.accuse(g.st, g.murderer, right, '', t), 'ILLEGAL_MOVE'); // own character
  E.tick(g.st, t + 60_000);
  assert.equal(row(g, owner2).shareBonus, 10);
  assert.equal(row(g, owner2).sharedClues, 1);
  assert.equal(row(g, owner2).total, 10 + (owner2 === g.murderer ? 150 : 0));
  assert.equal(MURDER_SCORING.perSharedClue, 10);
});

test('MURDER scoring: ties share a rank and nobody wins alone', () => {
  const g = game(6);
  const t = toAccusation(g);
  E.tick(g.st, t + 60_000); // nobody accused: the murderer survives alone
  const res = g.st.secret.result!;
  assert.equal(res.rows[0].userId, g.murderer);
  assert.equal(res.rows[0].rank, 1);
  assert.ok(res.rows.slice(1).every((r) => r.rank === 2 && r.total === 0));
  assert.equal(res.winnerUserId, g.murderer);

  const g2 = game(6);
  const t2 = toAccusation(g2);
  const picks: Record<string, string> = {};
  g2.innocents.forEach((u) => { picks[u] = FX_A.solution.murdererId; }); // everybody gets it: the murderer scores 0
  accuseAll(g2, t2, picks);
  assert.equal(g2.st.phase, 'ACCUSATION', 'the murderer has not accused yet');
  E.tick(g2.st, t2 + 60_000);
  assert.equal(g2.st.phase, 'RESULT');
  const rows = g2.st.secret.result!.rows;
  assert.deepEqual(rows.map((r) => r.total), [125, 125, 125, 100, 100, 0]);
  assert.equal(rows[5].userId, g2.murderer);
  assert.equal(g2.st.secret.result!.winnerUserId, null);
});

test('MURDER scoring: equal totals share a rank (competition ranking) and the top tie has no single winner', () => {
  const g = game(6);
  const right = FX_A.solution.murdererId;
  const t = toAccusation(g);
  // 4 players accuse correctly (speed bonus for 3): the 4th has 100, wrong ones 0; murderer 0 -> tie at the bottom
  const [i1, i2, i3, i4, i5] = g.innocents;
  accuseAll(g, t, { [i1]: right, [i2]: right, [i3]: right, [i4]: right });
  E.tick(g.st, t + 60_000);
  const ranks = g.st.secret.result!.rows.map((r) => [r.total, r.rank]);
  assert.deepEqual(ranks, [[125, 1], [125, 1], [125, 1], [100, 4], [0, 5], [0, 5]]);
  assert.equal(g.st.secret.result!.winnerUserId, null, 'three-way tie at the top');
  assert.equal(row(g, i5).total, 0);
});

// ---------------------------------------------------------------------
// withdrawal and abort
// ---------------------------------------------------------------------

test('MURDER withdrawal: the character is announced as gone, secrets stay hidden, the game goes on; their accusation is dropped', () => {
  const g = game(8);
  const leaver = g.innocents[0];
  const t = toAccusation(g);
  E.accuse(g.st, leaver, FX_A.solution.murdererId === g.charOf(leaver) ? g.charOf(g.innocents[1]) : FX_A.solution.murdererId, 'x', t);
  assert.equal(E.removePlayer(g.st, leaver, t + 1), false);
  assert.equal(g.st.secret.accusations[leaver], undefined);
  const v = E.publicStateFor(g.st, g.innocents[1], t + 2)!;
  assert.equal(v.players.find((p) => p.userId === leaver)!.left, true);
  assert.equal(v.characters.find((c) => c.userId === leaver)!.withdrawn, true);
  assert.ok(v.log.some((l) => l.kind === 'left' && l.text.includes(`Name${'A'}${g.charOf(leaver)}`)));
  const text = JSON.stringify(v);
  assert.ok(!text.includes(`SECRETMOTIVE-A-${g.charOf(leaver)}`));
  assert.ok(!text.includes('"isMurderer":true'));
  assert.equal(E.removePlayer(g.st, leaver, t + 3), false, 'twice is a no-op');
  assert.equal(g.st.log.filter((l) => l.kind === 'left').length, 1);
  E.tick(g.st, t + 60_000);
  assert.equal(g.st.phase, 'RESULT');
  assert.equal(row(g, leaver).left, true);
  assert.equal(row(g, leaver).total, 0);
});

test('MURDER withdrawal of the murderer: the game continues, accusations score normally, the murderer scores 0', () => {
  const g = game(7);
  toRound1(g);
  assert.equal(E.removePlayer(g.st, g.murderer, T0 + 20_000), false);
  assert.equal(g.st.phase, 'CLUE_ROUND');
  const pub = JSON.stringify(E.publicStateFor(g.st, g.innocents[0], T0 + 21_000));
  assert.ok(!pub.includes('SOLUTIONMETHOD') && !pub.includes('SOLUTIONMOTIVE'), 'nothing revealed by the withdrawal');
  const t = toAccusation(g);
  const right = FX_A.solution.murdererId;
  const [i1, i2] = g.innocents;
  accuseAll(g, t, { [i1]: right, [i2]: right });
  E.tick(g.st, t + 60_000);
  const res = g.st.secret.result!;
  assert.equal(res.murdererSurvived, false);
  assert.equal(row(g, g.murderer).total, 0);
  assert.equal(row(g, i1).total, 125);
  assert.equal(res.otherCount, 6);
  assert.equal(res.characters.find((c) => c.isMurderer)!.withdrawn, true);
});

test('MURDER abort: fewer than 4 seated players abort the game cleanly and reveal nothing', () => {
  const g = game(6);
  toRound1(g);
  assert.equal(E.removePlayer(g.st, g.ids[0], T0 + 20_000), false);
  assert.equal(E.removePlayer(g.st, g.ids[1], T0 + 20_001), false);
  assert.equal(E.removePlayer(g.st, g.ids[2], T0 + 20_002), true);
  assert.equal(g.st.phase, 'ABORTED');
  assert.equal(g.st.secret.result, null);
  for (const u of [...g.ids, 'spectator', null]) {
    const text = JSON.stringify(E.publicStateFor(g.st, u as any, T0 + 21_000));
    for (const leak of ['SOLUTIONMETHOD', 'SOLUTIONMOTIVE', 'SOLUTIONSUMMARY', 'SECRETMOTIVE', 'PERSONALSECRET', 'ALIBITRUTH', 'TIMELINE', '"result":{']) assert.ok(!text.includes(leak), `${u} saw ${leak}`);
  }
  assert.equal(E.publicStateFor(g.st, g.ids[4], T0)!.me, null);
  E.abort(g.st, 'again'); // safe twice
  assert.equal(g.st.phase, 'ABORTED');
  assert.equal(E.tick(g.st, T0 + 1e9), false);
});

test('MURDER abort: also from the tick when the table shrank, and with a testing table of 2 the game runs until one player is left', () => {
  env.MURDER_TEST_MIN_PLAYERS = '2';
  const st = E.createInitialState(seats(2), T0, { rng: seeded(3), caseChoice: 'A' });
  assert.equal(st.players.length, 2);
  assert.ok(Object.values(st.secret.assignment).includes(FX_A.solution.murdererId));
  let t = T0 + MURDER_TIMING.revealMs;
  E.tick(st, t);
  assert.equal(st.phase, 'CLUE_ROUND');
  const other = st.players.find((p) => p.userId !== st.secret.murdererUserId)!.userId;
  for (let r = 1; r <= 4; r++) { t += MURDER_TIMING.roundMs; E.tick(st, t); }
  assert.equal(st.phase, 'ACCUSATION');
  E.accuse(st, other, FX_A.solution.murdererId, 'it was you', t + 1);
  assert.equal(st.phase, 'ACCUSATION', 'the murderer has not accused yet');
  assert.equal(E.removePlayer(st, other, t + 2), true, 'one player left, fewer than 2');
  assert.equal(st.phase, 'ABORTED');
  // a 2 player game also plays through to the result
  const st2 = E.createInitialState(seats(2), T0, { rng: seeded(4), caseChoice: 'B' });
  let t2 = T0 + MURDER_TIMING.revealMs;
  E.tick(st2, t2);
  for (let r = 1; r <= 4; r++) { t2 += MURDER_TIMING.roundMs; E.tick(st2, t2); }
  const o2 = st2.players.find((p) => p.userId !== st2.secret.murdererUserId)!.userId;
  E.accuse(st2, o2, FX_B.solution.murdererId, '', t2 + 1);
  E.accuse(st2, st2.secret.murdererUserId!, st2.secret.assignment[o2], '', t2 + 2);
  assert.equal(st2.phase, 'RESULT');
  assert.equal(st2.secret.result!.rows.find((r) => r.userId === o2)!.total, 125);
});

// ---------------------------------------------------------------------
// rematch
// ---------------------------------------------------------------------

test('MURDER rematch: another case is picked (never the one just played); the host\'s choice only counts for the first game', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const first = E.createInitialState(seats(6), T0, { rng: seeded(seed), caseChoice: 'A' });
    assert.equal(first.secret.caseId, 'A');
    const second = E.createInitialState(seats(6), T0, { rng: seeded(seed + 100), caseChoice: first.caseChoice, usedCaseIds: first.secret.usedCaseIds, gamesPlayed: 1, forceDifferent: true });
    assert.equal(second.secret.caseId, 'B');
    assert.deepEqual(second.secret.usedCaseIds, ['A', 'B']);
    assert.equal(second.gamesPlayed, 1);
    const third = E.createInitialState(seats(6), T0, { rng: seeded(seed), usedCaseIds: second.secret.usedCaseIds, gamesPlayed: 2, forceDifferent: true });
    assert.equal(third.secret.caseId, 'A', 'all played: any but the last');
  }
  const rnd = E.createInitialState(seats(6), T0, { rng: seeded(1) });
  assert.ok(['A', 'B'].includes(rnd.secret.caseId!));
  assert.equal(rnd.secret.assignment[rnd.secret.murdererUserId!], (rnd.secret.caseId === 'A' ? FX_A : FX_B).solution.murdererId);
  // a fresh start has no leftovers
  assert.deepEqual(rnd.secret.accusations, {});
  assert.deepEqual(rnd.secret.whispers, []);
  assert.deepEqual(rnd.evidence, []);
});

test('MURDER lobby: the host picks a case from the catalogue or random; anything else is refused; only in the lobby', () => {
  const lobby = E.createLobbyState();
  assert.equal(lobby.phase, 'LOBBY');
  assert.equal(lobby.caseChoice, 'random');
  assert.equal(E.pickCase(lobby, 'B'), true);
  assert.equal(E.pickCase(lobby, 'B'), false);
  assert.equal(E.pickCase(lobby, 'random'), true);
  throwsCode(() => E.pickCase(lobby, 'nope'), 'INVALID_INPUT');
  throwsCode(() => E.pickCase(lobby, 5), 'INVALID_INPUT');
  const v = E.publicStateFor(lobby, 'host')!;
  assert.deepEqual(v.cases.map((c) => c.id), ['A', 'B']);
  assert.equal(v.case, null);
  assert.equal(v.me, null);
  assert.deepEqual(v.characters, []);
  const g = game(6);
  throwsCode(() => E.pickCase(g.st, 'A'), 'ILLEGAL_MOVE');
});

// ---------------------------------------------------------------------
// redaction
// ---------------------------------------------------------------------

function serial(v: unknown) { return JSON.stringify(v); }

test('MURDER redaction: before RESULT nobody gets another player\'s card, private clues, the solution, whispers or accusations', () => {
  const g = game(8);
  toRound1(g);
  const t = T0 + 20_000;
  const [a, b] = g.innocents;
  E.whisper(g.st, a, b, 'WHISPER-AB', t);
  E.shareClue(g.st, g.ownerOf(ID(2))!, 'r1-p1', t);
  const viewers: Array<string | null> = [...g.ids, 'spectator', null];
  const solutionLeaks = ['SOLUTIONMETHOD-A', 'SOLUTIONMOTIVE-A', 'SOLUTIONSUMMARY-A', 'TIMELINE-A', 'ALIBITRUTH-A', 'murdererUserId', 'murdererCharacterId'];
  const check = (stateT: number) => {
    for (const u of viewers) {
      const v = E.publicStateFor(g.st, u, stateT)!;
      const text = serial(v);
      const mine = u ? g.charOf(u) : null;
      for (const cid of g.ids.map(g.charOf)) {
        if (cid === mine) continue;
        for (const field of ['SECRETMOTIVE', 'ALIBI', 'PERSONALSECRET', 'REL']) {
          assert.ok(!text.includes(`${field}-A-${cid}"`) && !text.includes(`${field}-A-${cid}\\`), `${u} saw ${field} of ${cid}`);
        }
      }
      for (const leak of solutionLeaks) {
        if (leak.startsWith('SOLUTIONMETHOD') && u === g.murderer) continue;
        assert.ok(!text.includes(leak), `${u} saw ${leak}`);
      }
      assert.equal(v.result, null);
      assert.ok(!text.includes('"secret":{'));
      assert.ok(!text.includes('whisperCounts') && !text.includes('accusations'));
      if (u !== a && u !== b) assert.ok(!text.includes('WHISPER-AB'), `${u} saw the whisper`);
      // private clues: only the owner's own
      for (const clue of FX_A.rounds.flatMap((r) => r.privateClues)) {
        const visible = text.includes(`PRIVCLUE-A-${clue.id}`);
        const owner = g.ownerOf(clue.ownerId);
        const shared = clue.id === 'r1-p1';
        assert.equal(visible, shared || (owner === u && Number(clue.id[1]) <= g.st.round), `${u} / ${clue.id}`);
      }
      // the murderer alone knows
      const isMurderer = u === g.murderer;
      assert.equal(v.me?.card.isMurderer ?? false, isMurderer);
      assert.equal(text.includes('"isMurderer":true'), isMurderer);
      assert.equal(text.includes('SOLUTIONMETHOD-A'), isMurderer);
    }
  };
  check(t);
  // the accusation phase: nobody sees what anybody accused, only who has submitted
  const tt = toAccusation(g);
  const right = FX_A.solution.murdererId;
  E.accuse(g.st, a, right, 'ACCUSATION-MOTIVE-TEXT', tt);
  for (const u of viewers) {
    const v = E.publicStateFor(g.st, u, tt)!;
    assert.deepEqual(v.accusedUserIds, [a]);
    assert.equal(serial(v).includes('ACCUSATION-MOTIVE-TEXT'), u === a, `${u} accusation text`);
    assert.equal(v.me?.myAccusation?.characterId ?? null, u === a ? right : null);
  }
  check(tt);
  // RESULT: everything is public
  E.tick(g.st, tt + 60_000);
  assert.equal(g.st.phase, 'RESULT');
  for (const u of viewers) {
    const v = E.publicStateFor(g.st, u, tt + 61_000)!;
    const text = serial(v);
    assert.ok(v.result, `${u} has no result`);
    for (const must of ['SOLUTIONMETHOD-A', 'SOLUTIONMOTIVE-A', 'TIMELINE-A-1', 'ACCUSATION-MOTIVE-TEXT']) assert.ok(text.includes(must), `${u} misses ${must}`);
    for (const cid of g.ids.map(g.charOf)) assert.ok(text.includes(`SECRETMOTIVE-A-${cid}`) && text.includes(`ALIBITRUTH-A-${cid}`), `${u} misses ${cid}`);
    assert.equal(v.result!.murdererUserId, g.murderer);
  }
});

test('MURDER redaction: a withdrawn player and a spectator get the public view only (me is null)', () => {
  const g = game(8);
  toRound1(g);
  const leaver = g.innocents[0];
  E.removePlayer(g.st, leaver, T0 + 20_000);
  for (const u of [leaver, 'spectator', null]) {
    const v = E.publicStateFor(g.st, u, T0 + 21_000)!;
    assert.equal(v.me, null, String(u));
    const text = serial(v);
    for (const leak of ['SECRETMOTIVE', 'PERSONALSECRET', 'ALIBI-A', 'REL-A', 'PRIVCLUE', 'SOLUTION', 'isMurderer']) assert.ok(!text.includes(leak), `${u} saw ${leak}`);
    assert.ok(text.includes('PUBCLUE-A-1'), 'public clues are public');
    assert.ok(text.includes(`BIO-A-${g.charOf(g.innocents[1])}`), 'the public bios are public');
  }
});

test('MURDER redaction: public clues appear round by round, never ahead', () => {
  const g = game(6);
  assert.deepEqual(E.publicStateFor(g.st, g.ids[0], T0)!.clues, []);
  toRound1(g);
  let v = E.publicStateFor(g.st, g.ids[0], T0)!;
  assert.deepEqual(v.clues.map((c) => c.round), [1]);
  assert.ok(!serial(v).includes('PUBCLUE-A-2'));
  E.advance(g.st, g.st.phaseEndsAt! - 90_000 + 5_000);
  v = E.publicStateFor(g.st, g.ids[0], T0)!;
  assert.deepEqual(v.clues.map((c) => c.round), [1, 2]);
  assert.equal(v.case!.title, 'Case A');
  assert.equal(v.roundCount, 4);
});

test('MURDER publicStateFor is idempotent for a view, never mutates the server state, and a server state is recognised', () => {
  const g = game(6);
  toRound1(g);
  const before = JSON.stringify(g.st);
  const v = E.publicStateFor(g.st, g.ids[0], T0)!;
  assert.equal(JSON.stringify(g.st), before);
  assert.equal(E.isServerState(g.st), true);
  assert.equal(E.isServerState(v), false);
  assert.equal(E.publicStateFor(v, g.ids[1]), v);
  assert.equal(E.publicStateFor(null, 'x'), null);
  v.players[0].displayName = 'tampered';
  assert.notEqual(g.st.players[0].displayName, 'tampered');
});

test('MURDER catalogue: the bundled catalogue loads (3 cases) and the summaries carry no secrets', () => {
  assert.equal(MURDER_CASES.length, 3);
  E.catalogue = MURDER_CASES;
  try {
    const text = JSON.stringify(E.caseSummaries());
    for (const c of MURDER_CASES) {
      assert.ok(!text.includes(c.solution.method) && !text.includes(c.solution.motive));
      assert.ok(!text.includes(c.solution.murdererId));
    }
  } finally { E.catalogue = [FX_A, FX_B]; }
});
