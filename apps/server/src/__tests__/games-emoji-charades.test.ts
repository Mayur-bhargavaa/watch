import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import type { EmojiCharadesServerState } from '@synccinema/common';
import {
  EmojiCharadesEngine,
  EMOJI_CHARADES_TIMING,
  acceptedKeys,
  buildHint,
  editDistance,
  emojiCharadesRateAllowed,
  guessMatches,
  isCloseGuess,
  normalizeGuess,
  scoreSolve
} from '../games/EmojiCharadesEngine.js';
import { EMOJI_CHARADES_PUZZLES, splitEmoji } from '../games/emojiCharadesPuzzles.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';
import { emojiCharadesStartSchema, emojiCharadesGuessSchema, parseEmojiCharadesPayload } from '../games/emojiCharadesSchemas.js';

const T0 = 1_700_000_000_000;
const T = EMOJI_CHARADES_TIMING;

const seats = (n = 3) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `Player${i}`, seat: i }));
/** Deterministic RNG: returns the listed values (mod max) in order, then 0. */
const fixedRng = (seq: number[]) => { let i = 0; return (max: number) => (seq[i++] ?? 0) % max; };
const idx = (id: string) => EMOJI_CHARADES_PUZZLES.findIndex((p) => p.id === id);
/** A game whose first puzzle is `puzzleId` (default "The Dark Knight", which has an alternate). */
function newGame(n = 3, rounds = 3, puzzleId = 'dark-knight'): EmojiCharadesServerState {
  return EmojiCharadesEngine.createInitialState(seats(n), rounds, T0, { rng: fixedRng([idx(puzzleId)]) });
}
const ANSWER = 'The Dark Knight';

function throwsRule(fn: () => unknown, code?: string): GameRuleError {
  try { fn(); } catch (e) {
    assert.ok(e instanceof GameRuleError, `expected GameRuleError, got ${e}`);
    if (code) assert.equal((e as GameRuleError).code, code);
    return e as GameRuleError;
  }
  assert.fail('expected a GameRuleError');
}

/** COUNTDOWN over: the time at which PLAY started. */
function toPlay(s: EmojiCharadesServerState): number {
  const start = s.phaseEndsAt!;
  EmojiCharadesEngine.tick(s, start);
  assert.equal(s.phase, 'PLAY');
  return start;
}
const view = (s: EmojiCharadesServerState, viewer: string | null) => EmojiCharadesEngine.publicStateFor(s, viewer, T0)!;

// ---------------------------------------------------------------- puzzle list & definitions

test('ECH puzzle list: about 60 unique puzzles, 3-7 emoji each, difficulty 1-3, Hollywood + Bollywood + TV, alternates do not collide', () => {
  assert.ok(EMOJI_CHARADES_PUZZLES.length >= 55 && EMOJI_CHARADES_PUZZLES.length <= 80, `count ${EMOJI_CHARADES_PUZZLES.length}`);
  assert.equal(new Set(EMOJI_CHARADES_PUZZLES.map((p) => p.id)).size, EMOJI_CHARADES_PUZZLES.length, 'ids are unique');
  const allKeys: string[] = [];
  for (const p of EMOJI_CHARADES_PUZZLES) {
    const n = splitEmoji(p.emoji).length;
    assert.ok(n >= 3 && n <= 7, `${p.id}: ${n} emoji`);
    assert.ok([1, 2, 3].includes(p.difficulty), p.id);
    assert.ok(p.genre.length > 0 && p.answer.trim().length > 0, p.id);
    assert.ok(acceptedKeys(p.answer, p.alternates).length >= 1, p.id);
    allKeys.push(...acceptedKeys(p.answer, p.alternates));
  }
  assert.equal(new Set(allKeys).size, allKeys.length, 'an answer or alternate is accepted by two different puzzles');
  for (const region of ['hollywood', 'bollywood', 'tv']) assert.ok(EMOJI_CHARADES_PUZZLES.filter((p) => p.region === region).length >= 10, region);
  for (const d of [1, 2, 3]) assert.ok(EMOJI_CHARADES_PUZZLES.filter((p) => p.difficulty === d).length >= 8, `difficulty ${d}`);
  const dk = EMOJI_CHARADES_PUZZLES.find((p) => p.id === 'dark-knight')!;
  assert.deepEqual([dk.answer, ...dk.alternates], ['The Dark Knight', 'Dark Knight']);
});

test('ECH splitEmoji keeps a flag, a family and a pirate flag as one emoji each', () => {
  assert.equal(splitEmoji('🇫🇷🇮🇳').length, 2);
  assert.equal(splitEmoji('👨‍👩‍👧‍👦🏴‍☠️❤️').length, 3);
});

test('ECH game definition: 2-8 players, VIP host, no partner mode, no public matchmaking, aliases resolve', () => {
  const d = GAME_DEFINITIONS['emoji-charades'];
  assert.equal(d.minPlayers, 2);
  assert.equal(d.maxPlayers, 8);
  assert.deepEqual(d.playerOptions, [2, 3, 4, 5, 6, 7, 8]);
  assert.equal(d.supportsPartnerMode, false);
  assert.equal(d.supportsPublicMatchmaking, false);
  assert.equal(d.requiredHostTier, 'plus');
  for (const a of ['emoji-charades', 'Emoji-Charades', 'emojicharades', 'charades', ' CHARADES ']) assert.equal(parseGameType(a), 'emoji-charades', a);
  assert.equal(parseGameType('charade'), null);
  assert.equal(GAME_DEFINITIONS.imposter.requiredHostTier, 'plus');
});

test('ECH zod schemas: unknown keys dropped, wrong types / values refused as INVALID_INPUT', () => {
  assert.deepEqual(parseEmojiCharadesPayload(emojiCharadesStartSchema, {}), { rounds: 3, mode: 'race' });
  assert.deepEqual(parseEmojiCharadesPayload(emojiCharadesStartSchema, { rounds: 5, mode: 'race', hax: 1 }), { rounds: 5, mode: 'race' });
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesStartSchema, { rounds: 4 }), 'INVALID_INPUT');
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesStartSchema, { rounds: '5' }), 'INVALID_INPUT');
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesStartSchema, { mode: 'teams' }), 'INVALID_INPUT');
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesGuessSchema, { guess: 'x'.repeat(61) }), 'INVALID_INPUT');
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesGuessSchema, { guess: { $ne: 1 } }), 'INVALID_INPUT');
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesGuessSchema, { guess: '' }), 'INVALID_INPUT');
  throwsRule(() => parseEmojiCharadesPayload(emojiCharadesGuessSchema, null), 'INVALID_INPUT');
  assert.deepEqual(parseEmojiCharadesPayload(emojiCharadesGuessSchema, { guess: 'x'.repeat(60) }), { guess: 'x'.repeat(60) });
});

// ---------------------------------------------------------------- normalisation, alternates, close feedback

test('ECH normalizeGuess: case, spaces, punctuation, accents, "&" and a leading the / a / an are ignored', () => {
  for (const g of ['The Dark Knight', 'the dark knight', '  DARK   KNIGHT ', 'Dark Knight!!', 'darkknight', 'THE-DARK-KNIGHT', 'a dark knight']) {
    assert.equal(normalizeGuess(g), 'darkknight', g);
  }
  assert.equal(normalizeGuess('Spider-Man'), normalizeGuess('spiderman'));
  assert.equal(normalizeGuess('Amélie'), 'amelie');
  assert.equal(normalizeGuess('Ocean’s Eleven'), normalizeGuess('oceans eleven'));
  assert.equal(normalizeGuess('Tom & Jerry'), normalizeGuess('Tom and Jerry'));
  assert.equal(normalizeGuess('The'), 'the', 'a lone article is kept');
  assert.equal(normalizeGuess('!!!'), '');
  assert.equal(normalizeGuess('E.T.'), normalizeGuess('ET'));
  assert.equal(normalizeGuess('3 Idiots'), '3idiots');
  assert.equal(normalizeGuess('Café'), 'cafe');
});

test('ECH guessMatches: the title and every alternate are accepted, near misses are not', () => {
  assert.ok(guessMatches('dark knight', 'The Dark Knight', ['Dark Knight']));
  assert.ok(guessMatches('THE DARK KNIGHT', 'The Dark Knight', ['Dark Knight']));
  assert.ok(guessMatches('three idiots', '3 Idiots', ['Three Idiots']));
  assert.ok(guessMatches('DDLJ', 'Dilwale Dulhania Le Jayenge', ['DDLJ']));
  assert.ok(guessMatches('Harry Potter and the Philosopher’s Stone', 'Harry Potter', ['Harry Potter and the Philosophers Stone']));
  assert.ok(!guessMatches('The Dark Night', 'The Dark Knight', ['Dark Knight']));
  assert.ok(!guessMatches('dark', 'The Dark Knight', ['Dark Knight']));
  assert.ok(!guessMatches('', 'The Dark Knight'));
  assert.ok(!guessMatches('???', 'The Dark Knight'));
  assert.ok(!guessMatches('the', 'The Dark Knight'));
});

test('ECH close feedback: edit distance 1 (2 for long titles) is "close", exact and far guesses are not, tiny titles never are', () => {
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('', 'abc'), 3);
  assert.ok(isCloseGuess('The Dark Night', 'The Dark Knight', ['Dark Knight']));
  assert.ok(isCloseGuess('Titanc', 'Titanic'));
  assert.ok(isCloseGuess('Jurasic Prk', 'Jurassic Park'), 'distance 2 on a long title');
  assert.ok(!isCloseGuess('Titanic', 'Titanic'), 'an exact match is correct, not close');
  assert.ok(!isCloseGuess('Tomato', 'Titanic'));
  assert.ok(!isCloseGuess('Titnc', 'Titanic'), 'distance 2 on a 7 letter title is not close');
  assert.ok(isCloseGuess('Jaw', 'Jaws'), 'a 4 letter title is close at distance 1');
  assert.ok(!isCloseGuess('Jam', 'Jaw') && !isCloseGuess('Za', 'Jaws'), 'a 3 letter title gets no close hint');
  assert.ok(!isCloseGuess('Ups', 'Up'), 'a 2 letter title never gets a close hint');
  assert.ok(!isCloseGuess('', 'Titanic'));
});

test('ECH buildHint: blanks with 3 spaces between words, then the first letter of each word; punctuation is kept', () => {
  assert.equal(buildHint('The Dark Knight', 1), '_ _ _   _ _ _ _   _ _ _ _ _ _');
  assert.equal(buildHint('The Dark Knight', 2), 'T _ _   D _ _ _   K _ _ _ _ _');
  assert.equal(buildHint('Jaws', 2), 'J _ _ _');
  assert.equal(buildHint('Spider-Man', 1), '_ _ _ _ _ _ - _ _ _');
  assert.equal(buildHint('E.T.', 2), 'E . _ .');
  assert.equal(buildHint('  Tom   and Jerry ', 1), '_ _ _   _ _ _   _ _ _ _ _');
});

// ---------------------------------------------------------------- setup & puzzle selection

test('ECH createInitialState validates the player count, rounds, mode and duplicates', () => {
  throwsRule(() => EmojiCharadesEngine.createInitialState(seats(1), 3, T0), 'INVALID_INPUT');
  throwsRule(() => EmojiCharadesEngine.createInitialState(seats(9), 3, T0), 'INVALID_INPUT');
  throwsRule(() => EmojiCharadesEngine.createInitialState(seats(3), 4, T0), 'INVALID_INPUT');
  throwsRule(() => EmojiCharadesEngine.createInitialState(seats(3), 3, T0, { mode: 'teams' as any }), 'INVALID_INPUT');
  const dup = seats(3); dup[1].userId = 'u0';
  throwsRule(() => EmojiCharadesEngine.createInitialState(dup, 3, T0), 'INVALID_INPUT');
  for (const n of [2, 3, 4, 5, 6, 7, 8]) assert.equal(EmojiCharadesEngine.createInitialState(seats(n), 5, T0).players.length, n);
});

test('ECH a new game starts in the COUNTDOWN (3 s) with round 1, zero scores and nothing public about the puzzle', () => {
  const s = newGame();
  assert.equal(s.phase, 'COUNTDOWN');
  assert.equal(s.round, 1);
  assert.equal(s.phaseEndsAt, T0 + 3000);
  assert.equal(T.countdownMs, 3000);
  assert.equal(T.playMs, 60_000);
  assert.equal(T.revealMs, 6000);
  assert.deepEqual(Object.values(s.scores), [0, 0, 0]);
  const v = view(s, 'u0');
  assert.equal(v.emoji, null);
  assert.equal(v.genre, null);
  assert.equal(v.hint, null);
});

test('ECH puzzle selection: no repeats within a game, even with the real random source and over many games', () => {
  for (let g = 0; g < 40; g++) {
    const s = EmojiCharadesEngine.createInitialState(seats(3), 5, T0);
    let now = T0;
    const seen = new Set<string>([s.secret.puzzleId]);
    for (let r = 1; r < 5; r++) {
      now = s.phaseEndsAt!;
      EmojiCharadesEngine.tick(s, now); // countdown -> play
      now = s.phaseEndsAt!;
      EmojiCharadesEngine.tick(s, now); // play -> reveal (nobody solved)
      now = s.phaseEndsAt!;
      EmojiCharadesEngine.tick(s, now); // reveal -> next round
      assert.equal(s.round, r + 1);
      assert.ok(!seen.has(s.secret.puzzleId), `puzzle ${s.secret.puzzleId} repeated`);
      seen.add(s.secret.puzzleId);
    }
    assert.equal(seen.size, 5);
  }
});

test('ECH a rematch avoids the previous game\'s puzzles, and an exhausted list starts over instead of failing', () => {
  const first = EmojiCharadesEngine.createInitialState(seats(3), 3, T0, { rng: fixedRng([idx('titanic')]) });
  const second = EmojiCharadesEngine.createInitialState(seats(3), 3, T0, { rng: fixedRng([0]), usedPuzzleIds: first.secret.usedPuzzleIds });
  assert.notEqual(second.secret.puzzleId, 'titanic');
  const all = EMOJI_CHARADES_PUZZLES.map((p) => p.id);
  const exhausted = EmojiCharadesEngine.createInitialState(seats(3), 3, T0, { rng: fixedRng([0]), usedPuzzleIds: all });
  assert.ok(all.includes(exhausted.secret.puzzleId));
  assert.equal(exhausted.secret.usedPuzzleIds.length, 1, 'the used list restarted');
});

// ---------------------------------------------------------------- phases, hints (fake clock)

test('ECH hint scheduling with a fake clock: nothing before 20 s, blanks at 20 s, first letters at 40 s, timeout at 60 s', () => {
  const s = newGame();
  const start = toPlay(s);
  assert.equal(s.phaseEndsAt, start + 60_000);
  assert.equal(s.nextHintAt, start + 20_000);
  assert.equal(view(s, 'u0').hint, null);
  EmojiCharadesEngine.tick(s, start + 19_999);
  assert.equal(s.hintTier, 0);
  assert.equal(view(s, 'u0').hint, null);
  EmojiCharadesEngine.tick(s, start + 20_000);
  assert.equal(s.hintTier, 1);
  assert.equal(view(s, 'u0').hint, '_ _ _   _ _ _ _   _ _ _ _ _ _');
  assert.equal(view(s, 'u0').nextHintAt, start + 40_000);
  EmojiCharadesEngine.tick(s, start + 39_999);
  assert.equal(s.hintTier, 1);
  EmojiCharadesEngine.tick(s, start + 40_000);
  assert.equal(s.hintTier, 2);
  assert.equal(view(s, 'u0').hint, 'T _ _   D _ _ _   K _ _ _ _ _');
  assert.equal(view(s, 'u0').nextHintAt, null);
  EmojiCharadesEngine.tick(s, start + 59_999);
  assert.equal(s.phase, 'PLAY');
  EmojiCharadesEngine.tick(s, start + 60_000);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.phaseEndsAt, start + 60_000 + 6000);
  assert.equal(s.lastResult!.answer, ANSWER);
  assert.deepEqual(s.lastResult!.unsolvedUserIds, ['u0', 'u1', 'u2']);
  assert.match(s.statusMessage, /nobody solved/i);
});

test('ECH a late tick jumps straight to the due hint tier (no hint is skipped, none is invented)', () => {
  const s = newGame();
  const start = toPlay(s);
  EmojiCharadesEngine.tick(s, start + 45_000);
  assert.equal(s.hintTier, 2);
  assert.equal(s.hint, 'T _ _   D _ _ _   K _ _ _ _ _');
});

test('ECH after the reveal the next round starts at the old deadline; after the last round the game is FINAL', () => {
  const s = newGame(3, 3);
  let now = toPlay(s);
  EmojiCharadesEngine.tick(s, now + 60_000);
  assert.equal(s.phase, 'REVEAL');
  const revealEnd = s.phaseEndsAt!;
  EmojiCharadesEngine.tick(s, revealEnd + 40, fixedRng([0]));
  assert.equal(s.phase, 'COUNTDOWN');
  assert.equal(s.round, 2);
  assert.equal(s.phaseEndsAt, revealEnd + 3000, 'no drift: the countdown starts at the reveal deadline');
  assert.equal(s.history.length, 1);
  // round 2 and 3
  for (let r = 2; r <= 3; r++) {
    now = toPlay(s);
    EmojiCharadesEngine.tick(s, now + 60_000);
    EmojiCharadesEngine.tick(s, s.phaseEndsAt!, fixedRng([0]));
  }
  assert.equal(s.phase, 'FINAL');
  assert.equal(s.phaseEndsAt, null);
  assert.equal(s.history.length, 3);
  assert.deepEqual(s.winnerUserIds, [], 'nobody scored, so nobody wins');
});

test('ECH a long server pause restarts the clock at "now" instead of racing through the missed phases', () => {
  const s = newGame();
  const start = toPlay(s);
  EmojiCharadesEngine.tick(s, start + 60_000 + 3_600_000); // an hour late
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.phaseEndsAt, start + 60_000 + 3_600_000 + 6000);
});

// ---------------------------------------------------------------- scoring

test('ECH scoreSolve: 100 base - 20 per hint tier + up to 100 speed + 30 for the first solver', () => {
  assert.equal(scoreSolve(0, 60_000, 60_000, true), 230);
  assert.equal(scoreSolve(0, 60_000, 60_000, false), 200);
  assert.equal(scoreSolve(1, 30_000, 60_000, false), 80 + 50);
  assert.equal(scoreSolve(2, 0, 60_000, false), 60);
  assert.equal(scoreSolve(2, 15_000, 60_000, true), 60 + 25 + 30);
  assert.equal(scoreSolve(0, -5000, 60_000, false), 100, 'no negative speed bonus');
  assert.equal(scoreSolve(0, 999_999, 60_000, false), 200, 'speed bonus is capped');
});

test('ECH scoring in a game: first solver bonus, speed, hint penalty at solve time, live cumulative scores', () => {
  const s = newGame(4);
  const start = toPlay(s);
  // u0 solves at 6 s: no hint, 54 s left -> 100 + 90 + 30
  const a = EmojiCharadesEngine.submitGuess(s, 'u0', 'the dark knight', start + 6000);
  assert.deepEqual(a, { kind: 'correct', points: 220 });
  assert.equal(s.scores.u0, 220);
  assert.equal(s.hintTier, 0);
  // u1 solves at 30 s: blanks visible (tier 1) -> 80 + round(100 * 30/60) = 130, no first bonus
  const b = EmojiCharadesEngine.submitGuess(s, 'u1', 'Dark Knight', start + 30_000);
  assert.deepEqual(b, { kind: 'correct', points: 130 });
  // u2 solves at 50 s: tier 2 -> 60 + round(100 * 10/60) = 77
  const c = EmojiCharadesEngine.submitGuess(s, 'u2', 'DARK KNIGHT', start + 50_000);
  assert.deepEqual(c, { kind: 'correct', points: 77 });
  assert.deepEqual(s.solves.map((x) => [x.userId, x.order, x.hintTier]), [['u0', 1, 0], ['u1', 2, 1], ['u2', 3, 2]]);
  assert.equal(s.phase, 'PLAY', 'u3 has not solved it yet');
  EmojiCharadesEngine.tick(s, start + 60_000);
  assert.equal(s.phase, 'REVEAL');
  assert.deepEqual(s.lastResult!.points, { u0: 220, u1: 130, u2: 77 });
  assert.deepEqual(s.lastResult!.unsolvedUserIds, ['u3']);
  assert.deepEqual(s.scores, { u0: 220, u1: 130, u2: 77, u3: 0 });
});

test('ECH early finish: the round ends at once when every connected player solved; disconnected players are not waited for', () => {
  const s = newGame(3);
  const start = toPlay(s);
  EmojiCharadesEngine.setConnected(s, 'u2', false);
  EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 1000);
  assert.equal(s.phase, 'PLAY');
  EmojiCharadesEngine.submitGuess(s, 'u1', ANSWER, start + 2000);
  assert.equal(s.phase, 'REVEAL', 'all connected players solved');
  assert.equal(s.phaseEndsAt, start + 2000 + 6000);
  assert.match(s.statusMessage, /everybody solved/i);
  assert.deepEqual(s.lastResult!.unsolvedUserIds, ['u2']);
  assert.equal(s.scores.u2, 0, 'a disconnected player scores nothing');
});

test('ECH a player who solved scores once; further guesses are refused and change nothing', () => {
  const s = newGame(3);
  const start = toPlay(s);
  EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 1000);
  const before = JSON.stringify(s);
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 2000), 'ALREADY_SOLVED');
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', 'something else', start + 2000), 'ALREADY_SOLVED');
  assert.equal(JSON.stringify(s), before);
});

// ---------------------------------------------------------------- guesses

test('ECH wrong guesses are recorded privately, "so close" only for near misses, repeats are refused without cost', () => {
  const s = newGame(3);
  const start = toPlay(s);
  assert.deepEqual(EmojiCharadesEngine.submitGuess(s, 'u1', 'Titanic', start + 1000), { kind: 'wrong', points: 0 });
  assert.deepEqual(EmojiCharadesEngine.submitGuess(s, 'u1', 'The Dark Night', start + 1100), { kind: 'close', points: 0 });
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u1', 'the dark night!', start + 1200), 'DUPLICATE_GUESS');
  assert.equal(view(s, 'u1').me!.wrongGuesses, 2);
  assert.deepEqual(view(s, 'u1').me!.guesses, [{ text: 'Titanic', kind: 'wrong' }, { text: 'The Dark Night', kind: 'close' }]);
  assert.equal(view(s, 'u1').me!.guessesLeft, 10);
  // nobody else sees any of it
  for (const viewer of ['u0', 'u2', null, 'spectator']) {
    const text = JSON.stringify(view(s, viewer));
    assert.ok(!text.includes('Titanic') && !text.includes('Dark Night') && !text.includes('"close"'), `guess leaked to ${viewer}`);
  }
  assert.equal(s.scores.u1, 0);
});

test('ECH at most 12 wrong guesses per player and round; a new round resets the count', () => {
  const s = newGame(3);
  const start = toPlay(s);
  for (let i = 0; i < 12; i++) EmojiCharadesEngine.submitGuess(s, 'u0', `wrong ${i}`, start + 1000 + i);
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', 'one more', start + 2000), 'TOO_MANY_GUESSES');
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 2001), 'TOO_MANY_GUESSES'); // out of guesses means out, also for the right one
  assert.equal(view(s, 'u0').me!.guessesLeft, 0);
  assert.equal(view(s, 'u1').me!.guessesLeft, 12);
  EmojiCharadesEngine.tick(s, start + 60_000);
  EmojiCharadesEngine.tick(s, s.phaseEndsAt!, fixedRng([0]));
  assert.equal(s.round, 2);
  assert.deepEqual(s.guesses, {});
});

test('ECH out-of-phase, late, junk and non-player guesses are refused and do not change the state', () => {
  const s = newGame(3);
  const snapshot = () => JSON.stringify(s);
  let before = snapshot();
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, T0 + 1000), 'WRONG_PHASE'); // countdown
  assert.equal(snapshot(), before);
  const start = toPlay(s);
  before = snapshot();
  for (const junk of [null, undefined, 5, {}, [], '', '   ', 'x'.repeat(61), '!!!', '\n\t']) {
    throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', junk as any, start + 1000), 'INVALID_INPUT');
  }
  assert.equal(snapshot(), before);
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'stranger', ANSWER, start + 1000), 'NOT_PLAYER');
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, '__proto__', ANSWER, start + 1000), 'NOT_PLAYER');
  assert.equal(snapshot(), before);
  // after the deadline the guess is late: the round is settled first, then the guess is refused
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 60_001), 'WRONG_PHASE');
  assert.equal(s.phase, 'REVEAL');
  assert.deepEqual(s.solves, []);
  assert.equal(s.scores.u0, 0);
  // reveal: no more guesses either
  before = snapshot();
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 61_000), 'WRONG_PHASE');
  assert.equal(snapshot(), before);
});

// ---------------------------------------------------------------- connection, departure, abort

test('ECH a disconnected player keeps the seat; reconnecting works; their guess is still checked against the seat, not the socket', () => {
  const s = newGame(3);
  const start = toPlay(s);
  EmojiCharadesEngine.setConnected(s, 'u1', false);
  assert.equal(s.players.find((p) => p.userId === 'u1')!.connected, false);
  assert.equal(s.players.find((p) => p.userId === 'u1')!.left, false);
  EmojiCharadesEngine.setConnected(s, 'u1', true);
  EmojiCharadesEngine.submitGuess(s, 'u1', ANSWER, start + 1000);
  assert.equal(s.solves[0].userId, 'u1');
  EmojiCharadesEngine.setConnected(s, 'ghost', true); // unknown ids are ignored
});

test('ECH removePlayer: 3 -> 2 players keeps playing (and may end the round), 2 -> 1 aborts cleanly', () => {
  const s = newGame(3);
  const start = toPlay(s);
  EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 1000);
  EmojiCharadesEngine.submitGuess(s, 'u1', ANSWER, start + 2000);
  assert.equal(s.phase, 'PLAY');
  // u2, the last unsolved player, leaves: everybody left has solved it
  assert.equal(EmojiCharadesEngine.removePlayer(s, 'u2', start + 3000), false);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.scores.u0 > 0, true, 'points earned are kept');
  assert.deepEqual(s.lastResult!.unsolvedUserIds, []);
  // next round with 2 players; one more leaves -> abort
  EmojiCharadesEngine.tick(s, s.phaseEndsAt!, fixedRng([0]));
  assert.equal(s.phase, 'COUNTDOWN');
  assert.equal(EmojiCharadesEngine.removePlayer(s, 'u1', s.phaseEndsAt! - 1000), true);
  assert.equal(s.phase, 'ABORTED');
  assert.equal(s.phaseEndsAt, null);
  assert.equal(EmojiCharadesEngine.removePlayer(s, 'u1', T0), true, 'removing twice is harmless');
  throwsRule(() => EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, T0 + 10), 'WRONG_PHASE');
  const text = JSON.stringify(view(s, 'u0'));
  assert.ok(!text.includes(s.secret.answer), 'the puzzle of the round that was cut short stays secret');
  assert.ok(!EmojiCharadesEngine.tick(s, T0 + 1_000_000), 'an aborted game no longer changes');
});

test('ECH a 2 player game aborts when one of them leaves, and abort() is idempotent', () => {
  const s = newGame(2);
  toPlay(s);
  assert.equal(EmojiCharadesEngine.removePlayer(s, 'u0', T0 + 4000), true);
  assert.equal(s.phase, 'ABORTED');
  EmojiCharadesEngine.abort(s, 'again');
  assert.match(s.statusMessage, /few/i);
});

test('ECH FINAL: winner = highest score (ties share, leavers do not win)', () => {
  const s = newGame(3, 3);
  let start = toPlay(s);
  EmojiCharadesEngine.submitGuess(s, 'u0', ANSWER, start + 1000);
  EmojiCharadesEngine.submitGuess(s, 'u1', ANSWER, start + 1000);
  EmojiCharadesEngine.submitGuess(s, 'u2', ANSWER, start + 1000);
  for (let r = 2; r <= 3; r++) {
    EmojiCharadesEngine.tick(s, s.phaseEndsAt!, fixedRng([r])); // reveal -> next round
    start = toPlay(s);
    EmojiCharadesEngine.tick(s, start + 60_000);
  }
  EmojiCharadesEngine.tick(s, s.phaseEndsAt!);
  assert.equal(s.phase, 'FINAL');
  assert.equal(s.winnerUserIds.length, 1, 'u0 solved first and scored the first solver bonus');
  assert.equal(s.winnerUserIds[0], 'u0');
  assert.match(s.statusMessage, /Player0 wins/);
});

// ---------------------------------------------------------------- redaction

test('ECH redaction: before the reveal, unsolved players and spectators never receive the answer or its alternates', () => {
  const s = newGame(4);
  const check = (at: number, stage: string) => {
    for (const viewer of ['u0', 'u1', 'u2', 'u3', null, 'someone-not-in-the-game', '__proto__']) {
      const v = EmojiCharadesEngine.publicStateFor(s, viewer, at)!;
      const text = JSON.stringify(v);
      const lower = text.toLowerCase();
      assert.ok(!lower.includes('dark knight') && !lower.includes('darkknight'), `${stage}/${viewer} received the answer`);
      assert.ok(!text.includes('"secret"') && !text.includes('"alternates"') && !text.includes('"puzzleId"'), `${stage}/${viewer} received a server only field`);
      assert.equal(v.result, null);
      assert.equal(v.me?.answer ?? null, null);
    }
  };
  check(T0 + 100, 'countdown');
  const start = toPlay(s);
  check(start, 'play start');
  EmojiCharadesEngine.tick(s, start + 20_000);
  check(start + 20_000, 'hint 1');
  EmojiCharadesEngine.tick(s, start + 40_000);
  check(start + 40_000, 'hint 2');
  // wrong guesses of one player do not leak the answer to the others either
  EmojiCharadesEngine.submitGuess(s, 'u1', 'The Dark Night', start + 41_000);
  check(start + 41_000, 'after a close guess');
});

test('ECH redaction: a player who solved sees the answer (only them), the others see only that they solved', () => {
  const s = newGame(4);
  const start = toPlay(s);
  EmojiCharadesEngine.submitGuess(s, 'u2', 'dark knight', start + 5000);
  assert.equal(s.phase, 'PLAY');
  const solver = view(s, 'u2');
  assert.equal(solver.me!.solved, true);
  assert.equal(solver.me!.answer, ANSWER);
  assert.ok(solver.me!.points > 0);
  assert.deepEqual(solver.solvedUserIds, ['u2']);
  for (const viewer of ['u0', 'u1', 'u3', null, 'spectator']) {
    const v = view(s, viewer);
    assert.deepEqual(v.solvedUserIds, ['u2'], 'names / order are public');
    assert.equal(v.me?.answer ?? null, null);
    assert.ok(!JSON.stringify(v).toLowerCase().includes('dark knight'), `${viewer} got the answer`);
    assert.ok(!JSON.stringify(v).toLowerCase().includes('darkknight'));
  }
  // the puzzle itself (emoji, genre) is public during PLAY
  assert.deepEqual(view(s, null).emoji, splitEmoji(EMOJI_CHARADES_PUZZLES.find((p) => p.id === 'dark-knight')!.emoji));
  assert.equal(view(s, null).genre, 'Action');
  assert.equal(view(s, null).me, null, 'spectators get no personal block');
});

test('ECH redaction: the answer is public in REVEAL and in the history afterwards, never for the round being played', () => {
  const s = newGame(3, 3);
  const start = toPlay(s);
  EmojiCharadesEngine.tick(s, start + 60_000);
  for (const viewer of ['u0', null]) {
    const v = view(s, viewer);
    assert.equal(v.phase, 'REVEAL');
    assert.equal(v.result!.answer, ANSWER);
    assert.equal(v.history.length, 1);
    assert.equal(v.hint, null);
  }
  EmojiCharadesEngine.tick(s, s.phaseEndsAt!, fixedRng([idx('titanic')]));
  const next = JSON.stringify(view(s, 'u0'));
  assert.ok(next.includes('The Dark Knight'), 'the finished round stays in the history');
  assert.ok(!next.includes('Titanic'), 'the next puzzle is hidden in its countdown');
  assert.equal(view(s, 'u0').emoji, null);
  const s2 = toPlay(s);
  EmojiCharadesEngine.tick(s, s2 + 1000);
  assert.ok(!JSON.stringify(view(s, null)).includes('Titanic'), 'and during its play phase');
});

test('ECH publicStateFor is pure (does not mutate the server state) and passes an already redacted view through', () => {
  const s = newGame(3);
  toPlay(s);
  const before = JSON.stringify(s);
  const v = EmojiCharadesEngine.publicStateFor(s, 'u0', T0)!;
  assert.equal(JSON.stringify(s), before);
  v.players[0].displayName = 'changed';
  v.scores.u0 = 999;
  assert.equal(JSON.stringify(s), before, 'the view is a copy');
  assert.equal(EmojiCharadesEngine.publicStateFor(v, 'u1'), v);
  assert.equal(EmojiCharadesEngine.publicStateFor(null, 'u0'), null);
  assert.equal(EmojiCharadesEngine.isServerState(s), true);
  assert.equal(EmojiCharadesEngine.isServerState(v), false);
});

// ---------------------------------------------------------------- rate limiter

test('ECH rate limiter: 4 per 3 s window per key, independent keys, window slides', () => {
  const key = `room:${Math.random()}:guess`;
  for (let i = 0; i < 4; i++) assert.equal(emojiCharadesRateAllowed(key, 4, 3000, 1000 + i), true);
  assert.equal(emojiCharadesRateAllowed(key, 4, 3000, 1100), false);
  assert.equal(emojiCharadesRateAllowed(`${key}2`, 4, 3000, 1100), true);
  assert.equal(emojiCharadesRateAllowed(key, 4, 3000, 4100), true);
});
