import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ImposterServerState } from '@synccinema/common';
import {
  ImposterEngine,
  IMPOSTER_TIMING,
  clueRevealsWord,
  guessMatches,
  imposterRateAllowed,
  normalizeWord,
  sanitizeClue
} from '../games/ImposterEngine.js';
import { IMPOSTER_CATEGORIES, allImposterWords } from '../games/imposterWords.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';
import { imposterStartSchema, imposterClueSchema, imposterVoteSchema, parseImposterPayload } from '../games/imposterSchemas.js';

const T0 = 1_700_000_000_000;
const T = IMPOSTER_TIMING;

const seats = (n = 5) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `Player${i}`, seat: i }));
/** Deterministic RNG: returns the listed values (mod max) in order, then 0. */
const fixedRng = (seq: number[]) => { let i = 0; return (max: number) => (seq[i++] ?? 0) % max; };
/** rng order per round: category, word in the category's unused pool, imposter among the active players. */
function newGame(n = 5, rounds = 3, rng: number[] = [0, 0, 1]): ImposterServerState {
  return ImposterEngine.createInitialState(seats(n), rounds, T0, { rng: fixedRng(rng) });
}
const WORD = 'Titanic'; // category 0, word 0
const IMPOSTER = 'u1';

/** Fake clock helper: the time at which a phase that started at `from` is due. */
const after = (from: number, ms: number) => from + ms;

function throwsRule(fn: () => unknown, code?: string): GameRuleError {
  try { fn(); } catch (e) {
    assert.ok(e instanceof GameRuleError, `expected GameRuleError, got ${e}`);
    if (code) assert.equal((e as GameRuleError).code, code);
    return e as GameRuleError;
  }
  assert.fail('expected a GameRuleError');
}

/** From REVEAL: wait out the reveal, then everybody gives both clues. Returns the current fake time. */
function playClues(s: ImposterServerState, start = s.phaseEndsAt! - T.revealMs): number {
  let now = after(start, T.revealMs);
  ImposterEngine.tick(s, now);
  assert.equal(s.phase, 'CLUES');
  let n = 0;
  while (s.phase === 'CLUES') {
    now += 1000;
    ImposterEngine.submitClue(s, s.currentTurnUserId!, `hint${n++}`, now);
  }
  return now;
}
/** To VOTE: clues, then everybody presses "ready to vote". */
function toVote(s: ImposterServerState): number {
  let now = playClues(s);
  assert.equal(s.phase, 'DISCUSS');
  for (const p of ImposterEngine.activePlayers(s)) { now += 100; ImposterEngine.markReady(s, p.userId, now); }
  assert.equal(s.phase, 'VOTE');
  return now;
}
function voteAll(s: ImposterServerState, targetFor: (voter: string) => string, now: number): void {
  for (const p of ImposterEngine.activePlayers(s)) {
    if (s.phase !== 'VOTE') break;
    ImposterEngine.castVote(s, p.userId, targetFor(p.userId), (now += 50));
  }
}
const view = (s: ImposterServerState, viewer: string | null) => ImposterEngine.publicStateFor(s, viewer, T0)!;

// ---------------------------------------------------------------- word list & definitions

test('IMP word list: 14 curated categories of 12 unique words, movie themed ones included', () => {
  assert.equal(IMPOSTER_CATEGORIES.length, 14);
  for (const c of IMPOSTER_CATEGORIES) assert.equal(c.words.length, 12, c.name);
  const names = IMPOSTER_CATEGORIES.map((c) => c.name);
  for (const n of ['Famous Movies', 'Movie Snacks', 'Cinema Genres', 'Superheroes', 'Foods', 'Animals', 'Countries', 'Sports', 'Jobs', 'Places in a City', 'Things in a Kitchen', 'Festivals']) {
    assert.ok(names.includes(n), n);
  }
  const words = allImposterWords();
  assert.equal(new Set(words.map(normalizeWord)).size, words.length, 'words are unique across categories');
  for (const c of IMPOSTER_CATEGORIES) assert.ok(!c.words.map(normalizeWord).includes(normalizeWord(c.name)), `${c.name} contains its own name`);
});

test('IMP game definition: 4-8 players, VIP host, no partner mode, no public matchmaking, alias resolves', () => {
  const d = GAME_DEFINITIONS.imposter;
  assert.equal(d.minPlayers, 4);
  assert.equal(d.maxPlayers, 8);
  assert.deepEqual(d.playerOptions, [4, 5, 6, 7, 8]);
  assert.equal(d.supportsPartnerMode, false);
  assert.equal(d.supportsPublicMatchmaking, false);
  assert.equal(d.requiredHostTier, 'plus');
  assert.equal(parseGameType('Imposter'), 'imposter');
  assert.equal(parseGameType('impostor'), null);
});

test('IMP zod schemas: unknown keys dropped, wrong types / values refused as INVALID_INPUT', () => {
  assert.deepEqual(parseImposterPayload(imposterStartSchema, {}), { rounds: 3 });
  assert.deepEqual(parseImposterPayload(imposterStartSchema, { rounds: 5, hax: 1 }), { rounds: 5 });
  throwsRule(() => parseImposterPayload(imposterStartSchema, { rounds: 4 }), 'INVALID_INPUT');
  throwsRule(() => parseImposterPayload(imposterStartSchema, { rounds: '5' }), 'INVALID_INPUT');
  throwsRule(() => parseImposterPayload(imposterClueSchema, { word: 'x'.repeat(25) }), 'INVALID_INPUT');
  throwsRule(() => parseImposterPayload(imposterClueSchema, { word: { a: 1 } }), 'INVALID_INPUT');
  throwsRule(() => parseImposterPayload(imposterVoteSchema, null), 'INVALID_INPUT');
});

// ---------------------------------------------------------------- setup & roles

test('IMP createInitialState validates the player count, rounds and duplicates', () => {
  throwsRule(() => ImposterEngine.createInitialState(seats(3), 3, T0), 'INVALID_INPUT');
  throwsRule(() => ImposterEngine.createInitialState(seats(9), 3, T0), 'INVALID_INPUT');
  throwsRule(() => ImposterEngine.createInitialState(seats(5), 4, T0), 'INVALID_INPUT');
  const dup = seats(4); dup[1].userId = 'u0';
  throwsRule(() => ImposterEngine.createInitialState(dup, 3, T0), 'INVALID_INPUT');
  for (const n of [4, 5, 6, 7, 8]) assert.equal(ImposterEngine.createInitialState(seats(n), 5, T0).players.length, n);
});

test('IMP roles: exactly one imposter; crew see category + word, the imposter only the category', () => {
  const s = newGame();
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.round, 1);
  assert.equal(s.secret.word, WORD);
  assert.equal(s.secret.category, 'Famous Movies');
  assert.equal(s.secret.imposterId, IMPOSTER);
  for (const p of s.players) {
    const v = view(s, p.userId);
    assert.equal(v.category, 'Famous Movies');
    if (p.userId === IMPOSTER) assert.deepEqual(v.me, { role: 'imposter', word: null });
    else assert.deepEqual(v.me, { role: 'crew', word: WORD });
  }
  assert.equal(IMPOSTER_CATEGORIES.some((c) => c.name === s.secret.category && c.words.includes(s.secret.word)), true);
});

test('IMP roles are random but always one imposter among the seated players (crypto rng by default)', () => {
  const seen = new Set<string>();
  const cats = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const s = ImposterEngine.createInitialState(seats(6), 3, T0);
    assert.ok(s.players.some((p) => p.userId === s.secret.imposterId));
    seen.add(s.secret.imposterId);
    cats.add(s.secret.category);
    assert.equal(s.players.filter((p) => view(s, p.userId).me?.role === 'imposter').length, 1);
  }
  assert.ok(seen.size > 1, 'the imposter is not always the same seat');
  assert.ok(cats.size > 1, 'categories vary');
});

test('IMP a word is not repeated within a game and a rematch can exclude the previous words', () => {
  const s = ImposterEngine.createInitialState(seats(5), 5, T0, { rng: fixedRng([0, 0, 0, 0, 0, 0]) });
  const used = new Set([s.secret.word]);
  for (let r = 2; r <= 5; r++) {
    ImposterEngine.startRound(s, T0);
    assert.ok(!used.has(s.secret.word), 'repeated word');
    used.add(s.secret.word);
  }
  const next = ImposterEngine.createInitialState(seats(5), 3, T0, { rng: fixedRng([0, 0, 0]), usedWords: s.secret.usedWords });
  assert.ok(!s.secret.usedWords.slice(0, 4).includes(next.secret.word));
});

// ---------------------------------------------------------------- phases & clock

test('IMP phase flow with a fake clock: REVEAL -> CLUES (2 rounds, seat order) -> DISCUSS -> VOTE -> RESULT', () => {
  const s = newGame(4);
  assert.equal(s.phaseEndsAt, T0 + T.revealMs);
  ImposterEngine.tick(s, T0 + T.revealMs - 1);
  assert.equal(s.phase, 'REVEAL', 'not due yet');
  ImposterEngine.tick(s, T0 + T.revealMs);
  assert.equal(s.phase, 'CLUES');
  assert.equal(s.clueRound, 1);
  assert.equal(s.currentTurnUserId, 'u0');
  assert.equal(s.phaseEndsAt, T0 + T.revealMs + T.clueTurnMs);

  const order: string[] = [];
  let now = T0 + T.revealMs;
  while (s.phase === 'CLUES') {
    order.push(`${s.clueRound}:${s.currentTurnUserId}`);
    now += 500;
    ImposterEngine.submitClue(s, s.currentTurnUserId!, 'popular', now);
  }
  assert.deepEqual(order, ['1:u0', '1:u1', '1:u2', '1:u3', '2:u0', '2:u1', '2:u2', '2:u3']);
  assert.equal(s.clues.length, 8);
  assert.equal(s.phase, 'DISCUSS');
  assert.equal(s.phaseEndsAt, now + T.discussMs);
  assert.equal(s.currentTurnUserId, null);

  ImposterEngine.tick(s, now + T.discussMs - 1);
  assert.equal(s.phase, 'DISCUSS');
  const discussEnd = now + T.discussMs;
  ImposterEngine.tick(s, discussEnd);
  assert.equal(s.phase, 'VOTE');
  assert.equal(s.phaseEndsAt, discussEnd + T.voteMs);
  ImposterEngine.tick(s, discussEnd + T.voteMs); // nobody voted: tie -> imposter wins
  assert.equal(s.phase, 'RESULT');
  assert.equal(s.lastResult!.winner, 'imposter');
});

test('IMP a clue turn that times out is skipped (auto-skip) and the next player is up', () => {
  const s = newGame(4);
  let now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  assert.equal(s.currentTurnUserId, 'u0');
  now += T.clueTurnMs;
  ImposterEngine.tick(s, now);
  assert.equal(s.currentTurnUserId, 'u1');
  assert.deepEqual(s.clues, [{ round: 1, userId: 'u0', word: null }]);
  // with nobody acting, ticking every second walks through every remaining turn, the discussion and the vote
  for (let i = 0; i < 400 && s.phase !== 'RESULT'; i++) ImposterEngine.tick(s, (now += 1000));
  assert.equal(s.phase, 'RESULT');
  assert.equal(s.clues.length, 8);
  assert.ok(s.clues.every((c) => c.word === null));
  // a tick that is long overdue (server was paused) restarts the clock instead of racing through the whole game
  const late = newGame(4);
  ImposterEngine.tick(late, T0 + T.revealMs + 60_000);
  assert.equal(late.phase, 'CLUES');
  assert.equal(late.currentTurnUserId, 'u0');
  assert.equal(late.phaseEndsAt, T0 + T.revealMs + 60_000 + T.clueTurnMs);
});

test('IMP the discussion ends early when every connected player is ready; ready is idempotent', () => {
  const s = newGame(4);
  let now = playClues(s);
  assert.equal(ImposterEngine.markReady(s, 'u0', now += 10), true);
  assert.equal(ImposterEngine.markReady(s, 'u0', now += 10), false, 'repeat is a no-op');
  assert.deepEqual(s.readyToVote, ['u0']);
  ImposterEngine.markReady(s, 'u1', now += 10);
  ImposterEngine.markReady(s, 'u2', now += 10);
  assert.equal(s.phase, 'DISCUSS');
  ImposterEngine.markReady(s, 'u3', now += 10);
  assert.equal(s.phase, 'VOTE');
  throwsRule(() => ImposterEngine.markReady(s, 'u0', now + 10), 'WRONG_PHASE');
});

test('IMP ticking is idempotent and a late action cannot act on an expired phase', () => {
  const s = newGame(4);
  const now = after(T0, T.revealMs);
  assert.equal(ImposterEngine.tick(s, now), true);
  const snapshot = JSON.stringify(s);
  assert.equal(ImposterEngine.tick(s, now), false);
  assert.equal(JSON.stringify(s), snapshot);
  // u0's turn expired 1 ms ago: the clue arrives late and is refused (the turn already moved on)
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 'late', now + T.clueTurnMs + 1), 'NOT_YOUR_TURN');
  assert.deepEqual(s.clues[0], { round: 1, userId: 'u0', word: null });
});

// ---------------------------------------------------------------- clues

test('IMP clue is one word, max 24 chars, sanitised', () => {
  assert.equal(sanitizeClue('  ship  '), 'ship');
  assert.equal(sanitizeClue("rock-n'roll"), "rock-n'roll");
  assert.equal(sanitizeClue('x'.repeat(24)), 'x'.repeat(24));
  for (const bad of ['', '   ', 'two words', 'x'.repeat(25), '<b>hi</b>', 'a\nb', 'a\tb', 'hello!', 42, null, undefined, {}, ['a']]) {
    assert.equal(sanitizeClue(bad as any), null, JSON.stringify(bad));
  }
  assert.equal(sanitizeClue('\u200bocean\u200b'), 'ocean');
  assert.equal(sanitizeClue('sea\u0000'), 'sea');
});

test('IMP the secret word is rejected as a clue (case, plural, inside a longer word, main word of a phrase)', () => {
  assert.ok(clueRevealsWord('titanic', 'Titanic'));
  assert.ok(clueRevealsWord('TITANIC', 'Titanic'));
  assert.ok(clueRevealsWord('titanics', 'Titanic'));
  assert.ok(clueRevealsWord('spiderman', 'Spider-Man'));
  assert.ok(clueRevealsWord('godfather', 'The Godfather'));
  assert.ok(!clueRevealsWord('ship', 'Titanic'));
  assert.ok(!clueRevealsWord('iceberg', 'Titanic'));
  assert.ok(!clueRevealsWord('top', 'Top Gun'), 'short tokens are not banned');

  const s = newGame(4);
  let now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  // u0 is crew: the word is refused and the turn is kept
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 'Titanic', now + 10), 'INVALID_INPUT');
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', ' tItAnIc ', now + 20), 'INVALID_INPUT');
  assert.equal(s.currentTurnUserId, 'u0');
  assert.equal(s.clues.length, 0);
  ImposterEngine.submitClue(s, 'u0', 'ship', now + 30);
  assert.equal(s.currentTurnUserId, 'u1');
});

test('IMP the imposter is never told whether their clue matches the word (no oracle)', () => {
  const s = newGame(4);
  const now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  ImposterEngine.submitClue(s, 'u0', 'ship', now + 1); // crew
  assert.equal(s.currentTurnUserId, IMPOSTER);
  // the imposter guesses the word as a clue: accepted like any other clue, so a refusal cannot leak the secret
  ImposterEngine.submitClue(s, IMPOSTER, 'Titanic', now + 2);
  assert.equal(s.clues[1].word, 'Titanic');
});

test('IMP clues out of turn / out of phase / from outsiders are refused and change nothing', () => {
  const s = newGame(4);
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 'early', T0 + 5), 'WRONG_PHASE'); // still REVEAL
  const now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  const before = JSON.stringify(s);
  throwsRule(() => ImposterEngine.submitClue(s, 'u2', 'sneaky', now + 1), 'NOT_YOUR_TURN');
  throwsRule(() => ImposterEngine.submitClue(s, 'stranger', 'sneaky', now + 1), 'NOT_PLAYER');
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 'two words', now + 1), 'INVALID_INPUT');
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 12345 as any, now + 1), 'INVALID_INPUT');
  assert.equal(JSON.stringify(s), before);
  ImposterEngine.submitClue(s, 'u0', 'ship', now + 2);
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 'again', now + 3), 'NOT_YOUR_TURN'); // repeated message
  assert.equal(s.clues.length, 1);
});

// ---------------------------------------------------------------- voting & results

test('IMP voting: no self vote, no unknown target, only in VOTE, final once cast, repeat is a no-op', () => {
  const s = newGame(5);
  throwsRule(() => ImposterEngine.castVote(s, 'u0', 'u2', T0 + 1), 'WRONG_PHASE');
  let now = toVote(s);
  throwsRule(() => ImposterEngine.castVote(s, 'u0', 'u0', (now += 1)), 'ILLEGAL_MOVE');
  throwsRule(() => ImposterEngine.castVote(s, 'u0', 'nobody', (now += 1)), 'INVALID_INPUT');
  throwsRule(() => ImposterEngine.castVote(s, 'u0', 7 as any, (now += 1)), 'INVALID_INPUT');
  throwsRule(() => ImposterEngine.castVote(s, 'stranger', 'u0', (now += 1)), 'NOT_PLAYER');
  assert.equal(ImposterEngine.castVote(s, 'u0', 'u2', (now += 1)), true);
  assert.equal(ImposterEngine.castVote(s, 'u0', 'u2', (now += 1)), false, 'same vote again is idempotent');
  throwsRule(() => ImposterEngine.castVote(s, 'u0', 'u3', (now += 1)), 'ALREADY_VOTED');
  assert.deepEqual(s.votes, { u0: 'u2' });
});

test('IMP votes stay hidden until the round result (only who voted, and your own vote, are visible)', () => {
  const s = newGame(5);
  let now = toVote(s);
  ImposterEngine.castVote(s, 'u0', 'u2', (now += 1));
  ImposterEngine.castVote(s, 'u3', 'u2', (now += 1));
  const v0 = view(s, 'u0');
  assert.deepEqual(v0.votedUserIds.sort(), ['u0', 'u3']);
  assert.equal(v0.myVote, 'u2');
  assert.equal(view(s, 'u1').myVote, null);
  for (const viewer of ['u0', 'u1', 'u4', 'spectator', null]) {
    const json = JSON.stringify(view(s, viewer));
    assert.ok(!json.includes('"votes"'), 'no votes map before the result');
    assert.ok(!json.includes('"tally"'));
  }
  assert.equal(view(s, 'spectator').myVote, null);
});

test('IMP the voting phase ends as soon as every connected player has voted', () => {
  const s = newGame(5);
  let now = toVote(s);
  ImposterEngine.setConnected(s, 'u4', false); // away: not required
  voteAll(s, (voter) => (voter === 'u0' ? 'u1' : 'u0'), now);
  assert.notEqual(s.phase, 'VOTE');
});

test('IMP result: most voted player is accused; a tie means the imposter wins (+3)', () => {
  const s = newGame(5);
  let now = toVote(s);
  // 5 players, 2 votes each for u2 and u3, one for u0: tie for the top
  const votes: Record<string, string> = { u0: 'u2', u1: 'u3', u2: 'u3', u3: 'u2', u4: 'u0' };
  voteAll(s, (v) => votes[v], now);
  assert.equal(s.phase, 'RESULT');
  const r = s.lastResult!;
  assert.equal(r.tie, true);
  assert.equal(r.accusedUserId, null);
  assert.equal(r.winner, 'imposter');
  assert.equal(s.scores[IMPOSTER], 3);
  assert.equal(Object.values(s.scores).reduce((a, b) => a + b, 0), 3);
  assert.deepEqual(r.points, { [IMPOSTER]: 3 });
  assert.equal(r.word, WORD);
  assert.equal(r.imposterId, IMPOSTER);
});

test('IMP result: accusing a crew member means the imposter wins (+3), no last-chance guess', () => {
  const s = newGame(5);
  const now = toVote(s);
  voteAll(s, (v) => (v === 'u2' ? 'u3' : 'u2'), now); // u2 gets 4 votes
  assert.equal(s.phase, 'RESULT');
  assert.equal(s.lastResult!.accusedUserId, 'u2');
  assert.equal(s.lastResult!.winner, 'imposter');
  assert.equal(s.scores[IMPOSTER], 3);
  assert.equal(s.guess, null);
});

test('IMP result: nobody voted at all counts as a tie', () => {
  const s = newGame(4);
  const now = toVote(s);
  ImposterEngine.tick(s, now + T.voteMs + 1);
  assert.equal(s.lastResult!.tie, true);
  assert.equal(s.lastResult!.winner, 'imposter');
});

// ---------------------------------------------------------------- last chance guess

function toGuess(n = 5): { s: ImposterServerState; now: number } {
  const s = newGame(n);
  const now = toVote(s);
  voteAll(s, (v) => (v === IMPOSTER ? 'u0' : IMPOSTER), now);
  assert.equal(s.phase, 'GUESS');
  return { s, now: now + 1000 };
}

test('IMP caught imposter gets one 20 s guess; a correct guess (case-insensitive, trimmed) makes the imposter win', () => {
  const { s, now } = toGuess();
  assert.equal(s.accusedUserId, IMPOSTER);
  assert.equal(s.phaseDurationMs, T.guessMs);
  throwsRule(() => ImposterEngine.submitGuess(s, 'u0', 'Titanic', now), 'NOT_YOUR_TURN');
  throwsRule(() => ImposterEngine.submitGuess(s, IMPOSTER, '   ', now), 'INVALID_INPUT');
  ImposterEngine.submitGuess(s, IMPOSTER, '  tItAnIc ', now);
  assert.equal(s.phase, 'RESULT');
  assert.equal(s.lastResult!.winner, 'imposter');
  assert.equal(s.lastResult!.guessCorrect, true);
  assert.equal(s.scores[IMPOSTER], 3);
  throwsRule(() => ImposterEngine.submitGuess(s, IMPOSTER, 'Titanic', now + 1), 'WRONG_PHASE'); // repeated / late guess
});

test('IMP a wrong guess means the crew wins: +2 for each crew member who voted for the imposter, +1 for the others', () => {
  const s = newGame(5);
  const now = toVote(s);
  // u0 u2 u3 vote the imposter (u1); u4 votes u0; the imposter votes u0
  const votes: Record<string, string> = { u0: IMPOSTER, u1: 'u0', u2: IMPOSTER, u3: IMPOSTER, u4: 'u0' };
  voteAll(s, (v) => votes[v], now);
  assert.equal(s.phase, 'GUESS');
  ImposterEngine.submitGuess(s, IMPOSTER, 'Avatar', now + 2000);
  assert.equal(s.lastResult!.winner, 'crew');
  assert.equal(s.lastResult!.guessCorrect, false);
  assert.deepEqual(s.scores, { u0: 2, u1: 0, u2: 2, u3: 2, u4: 1 });
});

test('IMP a missing guess (20 s timeout) or a disconnected imposter means the crew wins', () => {
  const a = toGuess();
  ImposterEngine.tick(a.s, a.s.phaseEndsAt! - 1);
  assert.equal(a.s.phase, 'GUESS');
  ImposterEngine.tick(a.s, a.s.phaseEndsAt!);
  assert.equal(a.s.phase, 'RESULT');
  assert.equal(a.s.lastResult!.winner, 'crew');
  assert.equal(a.s.lastResult!.guess, null);

  const b = toGuess();
  ImposterEngine.setConnected(b.s, IMPOSTER, false);
  ImposterEngine.tick(b.s, b.now);
  assert.equal(b.s.phase, 'RESULT');
  assert.equal(b.s.lastResult!.winner, 'crew');
});

test('IMP guess matching ignores case, spacing, punctuation and a leading "the"', () => {
  assert.ok(guessMatches(' spider man ', 'Spider-Man'));
  assert.ok(guessMatches('GODFATHER', 'The Godfather'));
  assert.ok(guessMatches('the godfather', 'The Godfather'));
  assert.ok(!guessMatches('godfather 2', 'The Godfather'));
  assert.ok(!guessMatches('', 'Titanic'));
});

// ---------------------------------------------------------------- whole game, scoring, rematch

test('IMP the leaderboard is cumulative; after the last round the game is FINISHED with the winner(s)', () => {
  const s = newGame(4, 3, [0, 0, 1, 0, 0, 2, 0, 0, 3]);
  let now = T0;
  const roundWinners: string[] = [];
  for (let round = 1; round <= 3; round++) {
    assert.equal(s.round, round);
    const imp = s.secret.imposterId;
    const start = s.phaseEndsAt! - T.revealMs;
    now = toVote(s);
    void start;
    // everybody accuses the imposter; the imposter accuses someone else; wrong guess -> crew wins the round
    voteAll(s, (v) => (v === imp ? (imp === 'u0' ? 'u1' : 'u0') : imp), now);
    assert.equal(s.phase, 'GUESS');
    ImposterEngine.submitGuess(s, imp, 'definitely wrong', now + 2000);
    assert.equal(s.phase, 'RESULT');
    roundWinners.push(s.lastResult!.winner);
    ImposterEngine.tick(s, s.phaseEndsAt!);
  }
  assert.deepEqual(roundWinners, ['crew', 'crew', 'crew']);
  assert.equal(s.phase, 'FINISHED');
  assert.equal(s.history.length, 3);
  const total = Object.values(s.scores).reduce((a, b) => a + b, 0);
  assert.equal(total, s.history.reduce((sum, h) => sum + Object.values(h.points).reduce((a, b) => a + b, 0), 0));
  const best = Math.max(...Object.values(s.scores));
  assert.deepEqual(s.winnerUserIds.slice().sort(), Object.keys(s.scores).filter((u) => s.scores[u] === best).sort());
  assert.ok(s.statusMessage.length > 0);
  assert.equal(s.phaseEndsAt, null);
  // nothing is accepted after the end
  throwsRule(() => ImposterEngine.castVote(s, 'u0', 'u1', now + 99999), 'WRONG_PHASE');
  assert.equal(ImposterEngine.tick(s, now + 10 * 60_000), false);
});

test('IMP a RESULT phase advances to the next round by itself with a new word and imposter', () => {
  const rng = fixedRng([0, 0, 1, 1, 0, 2]);
  const s = ImposterEngine.createInitialState(seats(5), 3, T0, { rng });
  const now = toVote(s);
  ImposterEngine.tick(s, now + T.voteMs + 1, rng); // tie -> RESULT
  assert.equal(s.phase, 'RESULT');
  const firstWord = s.secret.word;
  ImposterEngine.tick(s, s.phaseEndsAt!, rng);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.round, 2);
  assert.notEqual(s.secret.word, firstWord);
  assert.equal(s.secret.imposterId, 'u2');
  assert.deepEqual(s.clues, []);
  assert.deepEqual(s.votes, {});
  assert.equal(s.scores[IMPOSTER], 3, 'scores carry over');
});

// ---------------------------------------------------------------- disconnect / abort

test('IMP a player who is disconnected on their turn is skipped; they keep their seat and can return', () => {
  const s = newGame(5);
  const now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  ImposterEngine.submitClue(s, 'u0', 'ship', now + 1);
  assert.equal(s.currentTurnUserId, IMPOSTER);
  ImposterEngine.setConnected(s, IMPOSTER, false);
  ImposterEngine.tick(s, now + 2); // skipped immediately, no waiting for the 20 s
  assert.equal(s.currentTurnUserId, 'u2');
  assert.deepEqual(s.clues[1], { round: 1, userId: IMPOSTER, word: null });
  assert.equal(s.players.find((p) => p.userId === IMPOSTER)!.left, false);
  // they return before their next turn in clue round 2 and can play it
  ImposterEngine.setConnected(s, IMPOSTER, true);
  for (const u of ['u2', 'u3', 'u4']) ImposterEngine.submitClue(s, u, 'word', now + 5);
  ImposterEngine.submitClue(s, 'u0', 'again', now + 6);
  assert.equal(s.clueRound, 2);
  assert.equal(s.currentTurnUserId, IMPOSTER);
});

test('IMP a leaver who is not the imposter loses their vote; votes against them are cleared', () => {
  const s = newGame(5);
  const now = toVote(s);
  ImposterEngine.castVote(s, 'u0', 'u3', now + 1);
  ImposterEngine.castVote(s, 'u2', 'u4', now + 2);
  assert.equal(ImposterEngine.removePlayer(s, 'u3', now + 3), false);
  assert.deepEqual(s.votes, { u2: 'u4' }, 'vote for u3 dropped, so u0 may vote again');
  ImposterEngine.castVote(s, 'u0', 'u4', now + 4);
  throwsRule(() => ImposterEngine.castVote(s, 'u3', 'u4', now + 5), 'NOT_PLAYER');
  throwsRule(() => ImposterEngine.castVote(s, 'u1', 'u3', now + 5), 'INVALID_INPUT');
  assert.equal(ImposterEngine.removePlayer(s, 'u3', now + 6), false, 'second removal is a no-op');
});

test('IMP the imposter leaving voids the round (nobody scores) and play continues', () => {
  const s = newGame(5);
  const now = toVote(s);
  assert.equal(ImposterEngine.removePlayer(s, IMPOSTER, now + 1), false);
  assert.equal(s.phase, 'RESULT');
  assert.equal(s.lastResult!.voided, true);
  assert.equal(s.lastResult!.winner, 'none');
  assert.ok(Object.values(s.scores).every((n) => n === 0));
  ImposterEngine.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.round, 2);
  assert.ok(ImposterEngine.activePlayers(s).every((p) => p.userId !== IMPOSTER));
  assert.notEqual(s.secret.imposterId, IMPOSTER);
});

test('IMP fewer than 3 players left aborts the game cleanly with a message; nothing works afterwards', () => {
  const s = newGame(4);
  const now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  assert.equal(ImposterEngine.removePlayer(s, 'u2', now + 1), false); // 3 left: still going
  assert.equal(s.phase, 'CLUES');
  assert.equal(ImposterEngine.removePlayer(s, 'u3', now + 2), true); // 2 left: abort
  assert.equal(s.phase, 'ABORTED');
  assert.ok(/few|enough/i.test(s.statusMessage));
  assert.equal(s.currentTurnUserId, null);
  assert.equal(s.phaseEndsAt, null);
  throwsRule(() => ImposterEngine.submitClue(s, 'u0', 'ship', now + 3), 'WRONG_PHASE');
  assert.equal(ImposterEngine.tick(s, now + 10 * 60_000), false);
  // the abort never reveals the round's secrets
  const json = JSON.stringify(view(s, 'u0'));
  assert.ok(!json.includes(WORD) && !json.includes('imposterId'));
  const manual = newGame(5);
  ImposterEngine.abort(manual, 'bye');
  ImposterEngine.abort(manual, 'again');
  assert.equal(manual.statusMessage, 'bye');
});

test('IMP only 3 players left keeps playing (the minimum), and disconnected players do not block the phases', () => {
  const s = newGame(4);
  ImposterEngine.removePlayer(s, 'u3', T0 + 1);
  assert.equal(s.phase, 'REVEAL');
  const now = playClues(s);
  assert.equal(s.clues.length, 6);
  ImposterEngine.setConnected(s, 'u2', false);
  ImposterEngine.markReady(s, 'u0', now + 1);
  ImposterEngine.markReady(s, 'u1', now + 2);
  assert.equal(s.phase, 'VOTE', 'the disconnected player is not awaited');
});

// ---------------------------------------------------------------- information security

const SPECTATORS = ['spectator', 'someone-else', '', null, undefined];

/** Collect a serialized view for every kind of recipient. */
function allViews(s: ImposterServerState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of s.players) out[p.userId] = JSON.stringify(ImposterEngine.publicStateFor(s, p.userId, T0));
  for (const sp of SPECTATORS) out[`spectator:${String(sp)}`] = JSON.stringify(ImposterEngine.publicStateFor(s, sp as any, T0));
  return out;
}

test('IMP redaction: the secret word never reaches the imposter or a spectator, in any phase before the result', () => {
  const s = newGame(5);
  const check = (label: string) => {
    if (s.phase === 'RESULT' || s.phase === 'FINISHED') return;
    for (const [who, json] of Object.entries(allViews(s))) {
      const isCrew = !who.startsWith('spectator') && who !== IMPOSTER;
      if (!isCrew) assert.ok(!json.toLowerCase().includes(WORD.toLowerCase()), `${label}: word leaked to ${who}`);
      assert.ok(!json.includes('"secret"'), `${label}: secret block sent to ${who}`);
      assert.ok(!json.includes('imposterId'), `${label}: imposterId sent to ${who}`);
      // only the imposter's own view says "imposter"; nobody else gets any role hint about another player
      const roles = JSON.parse(json).me;
      if (who === IMPOSTER) assert.deepEqual(roles, { role: 'imposter', word: null });
      else if (isCrew) assert.deepEqual(roles, { role: 'crew', word: WORD });
      else assert.equal(roles, null, `${label}: spectator got a role`);
    }
  };
  check('REVEAL');
  let now = after(T0, T.revealMs);
  ImposterEngine.tick(s, now);
  while (s.phase === 'CLUES') {
    check(`CLUES turn ${s.currentTurnUserId}`);
    ImposterEngine.submitClue(s, s.currentTurnUserId!, 'hint', (now += 10));
  }
  check('DISCUSS');
  for (const p of s.players) ImposterEngine.markReady(s, p.userId, (now += 10));
  check('VOTE');
  ImposterEngine.castVote(s, 'u0', 'u2', (now += 10));
  check('VOTE after a vote');
  // in VOTE nobody sees the votes: a crew member's view must not even show who voted for whom
  for (const json of Object.values(allViews(s))) assert.ok(!json.includes('"u2"') || !/"votes"/.test(json));
});

test('IMP redaction: the imposter id and the word appear only in the RESULT record (and then for everyone, spectators too)', () => {
  const s = newGame(5);
  const now = toVote(s);
  voteAll(s, (v) => (v === 'u2' ? 'u3' : 'u2'), now); // innocent accused -> straight to RESULT
  assert.equal(s.phase, 'RESULT');
  for (const [who, json] of Object.entries(allViews(s))) {
    const v = JSON.parse(json);
    assert.equal(v.result.imposterId, IMPOSTER, who);
    assert.equal(v.result.word, WORD, who);
    assert.equal(v.me, null, `${who}: private role block is gone during RESULT`);
    assert.ok(!json.includes('"secret"'));
  }
});

test('IMP redaction: in the next round the new secret is hidden again; old words only live in the public history', () => {
  const rng = fixedRng([0, 0, 1, 2, 0, 3]);
  const s = ImposterEngine.createInitialState(seats(5), 3, T0, { rng });
  const first = s.secret.word;
  const now = toVote(s);
  ImposterEngine.tick(s, now + T.voteMs + 1, rng);
  ImposterEngine.tick(s, s.phaseEndsAt!, rng);
  assert.equal(s.round, 2);
  assert.notEqual(s.secret.word, first);
  const spectator = JSON.stringify(view(s, 'spectator'));
  assert.ok(!spectator.includes(s.secret.word));
  assert.ok(spectator.includes(first), 'finished rounds are public');
  const imposterView = JSON.stringify(view(s, s.secret.imposterId));
  assert.ok(!imposterView.includes(s.secret.word));
});

test('IMP redaction: the accused is public during the guess, the word is still hidden from the imposter and spectators', () => {
  const { s } = toGuess();
  assert.equal(view(s, 'spectator').accusedUserId, IMPOSTER);
  for (const who of [IMPOSTER, 'spectator', null]) {
    const json = JSON.stringify(view(s, who as any));
    assert.ok(!json.includes(WORD));
    assert.ok(!json.includes('"imposterId"'));
  }
  assert.deepEqual(view(s, IMPOSTER).me, { role: 'imposter', word: null });
  assert.equal(view(s, 'u0').me!.word, WORD);
});

test('IMP publicStateFor never mutates the state and passes an already redacted view through unchanged', () => {
  const s = newGame(5);
  const before = JSON.stringify(s);
  const v = ImposterEngine.publicStateFor(s, IMPOSTER, T0)!;
  assert.equal(JSON.stringify(s), before);
  assert.equal(ImposterEngine.publicStateFor(v, 'u0', T0), v);
  assert.equal(ImposterEngine.isServerState(s), true);
  assert.equal(ImposterEngine.isServerState(v), false);
  assert.equal(ImposterEngine.publicStateFor(null, 'u0'), null);
  // a player who left gets no private block
  ImposterEngine.removePlayer(s, 'u0', T0 + 1);
  assert.equal(view(s, 'u0').me, null);
});

test('IMP the view carries the clock and the timers so the client can draw a ring', () => {
  const s = newGame(4);
  const v = ImposterEngine.publicStateFor(s, 'u0', 123456)!;
  assert.equal(v.serverNow, 123456);
  assert.equal(v.phaseDurationMs, T.revealMs);
  assert.equal(v.phaseEndsAt, T0 + T.revealMs);
  assert.equal(v.round, 1);
  assert.equal(v.totalRounds, 3);
  assert.equal(v.clueRounds, 2);
});

// ---------------------------------------------------------------- rate limiter

test('IMP rate limiter: sliding window per key', () => {
  const key = 'room:user:clue';
  assert.equal(imposterRateAllowed(key, 2, 1000, 0), true);
  assert.equal(imposterRateAllowed(key, 2, 1000, 10), true);
  assert.equal(imposterRateAllowed(key, 2, 1000, 20), false);
  assert.equal(imposterRateAllowed(key, 2, 1000, 1500), true);
  assert.equal(imposterRateAllowed('other', 2, 1000, 20), true);
});
