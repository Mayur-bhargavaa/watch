import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import type { QuizPlayer, QuizQuestionInput, QuizServerState } from '@synccinema/common';
import { QUIZ_MAX_QUESTIONS } from '@synccinema/common';
import { QuizShowEngine, QUIZ_TIMING, quizMinPlayers, quizRateAllowed, quizSpeedPoints, quizStreakBonus } from '../games/QuizShowEngine.js';
import { quizAnswerSchema, quizEditSchema, parseQuizPayload, sanitizeQuizText } from '../games/quizShowSchemas.js';
import { MOVIE_NIGHT_STARTER_PACK } from '../games/quizStarterPack.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';

const T0 = 1_700_000_000_000;
const E = QuizShowEngine;
const HOST = 'host';
const NOTE = 'SECRET-NOTE-XYZ';

const mc = (over: Partial<QuizQuestionInput> = {}): QuizQuestionInput => ({
  type: 'MULTIPLE_CHOICE', text: 'Capital of France?', options: ['Berlin', 'Paris', 'Rome', 'Madrid'], correctIndex: 1, timeLimitSec: 20, points: 100, note: '', ...over
});
const buzzerQ = (over: Partial<QuizQuestionInput> = {}): QuizQuestionInput => ({
  type: 'BUZZER', text: 'Who directed Jaws?', options: [], correctIndex: -1, timeLimitSec: 45, points: 200, note: NOTE, ...over
});
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `Player${i}`, seat: i }));

/** A lobby with the questions already added by the host. */
function lobby(inputs: QuizQuestionInput[]): QuizServerState {
  const s = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  for (const q of inputs) E.addQuestion(s, HOST, q);
  return s;
}
/** A running game (n players) at the start of the first INTRO. */
function game(inputs: QuizQuestionInput[], n = 3): QuizServerState {
  const l = lobby(inputs);
  return E.createInitialState({ userId: HOST, displayName: 'Host' }, seats(n), l.quiz, T0, l.idSeq);
}
/** Moves an INTRO to its QUESTION; returns the time the question opened. */
function open(s: QuizServerState, at = (s.phaseEndsAt as number)): number {
  assert.equal(s.phase, 'INTRO');
  E.tick(s, at);
  assert.equal(s.phase, 'QUESTION');
  return s.questionStartedAt;
}
const qid = (s: QuizServerState) => s.quiz[s.questionIndex].id;
const err = (fn: () => unknown): string => {
  try { fn(); } catch (e) { return e instanceof GameRuleError ? e.code : `OTHER:${(e as Error).message}`; }
  return 'NO_ERROR';
};
const view = (s: QuizServerState, id: string | null) => E.publicStateFor(s, id, T0)!;
const json = (s: QuizServerState, id: string | null) => JSON.stringify(view(s, id));

// ---------------------------------------------------------------------------- validation

test('QUIZ validation: question limits (text 200, options 80, 2-4 options, one correct, time 10/20/30, points 100/200/300, note 120)', () => {
  const n = (raw: unknown) => E.normalizeQuestion(raw);
  assert.equal(n(mc({ text: 'x'.repeat(200) })).text.length, 200);
  assert.equal(err(() => n(mc({ text: 'x'.repeat(201) }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ text: '   ' }))), 'INVALID_INPUT');
  assert.equal(n(mc({ options: ['a'.repeat(80), 'b'] })).options[0].length, 80);
  assert.equal(err(() => n(mc({ options: ['a'.repeat(81), 'b'] }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ options: ['only one'], correctIndex: 0 }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 0 }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ options: ['a', 'b', ''], correctIndex: 0 }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ options: ['same', 'Same'], correctIndex: 0 }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ correctIndex: 4 }))), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ correctIndex: -1 }))), 'INVALID_INPUT');
  assert.equal(err(() => n({ ...mc(), correctIndex: undefined })), 'INVALID_INPUT');
  assert.equal(err(() => n(mc({ timeLimitSec: 15 }))), 'INVALID_INPUT');
  for (const t of [10, 20, 30]) assert.equal(n(mc({ timeLimitSec: t })).timeLimitSec, t);
  assert.equal(err(() => n(mc({ points: 150 as any }))), 'INVALID_INPUT');
  for (const p of [100, 200, 300] as const) assert.equal(n(mc({ points: p })).points, p);
  assert.equal(n(mc({ note: 'n'.repeat(120) })).note.length, 120);
  assert.equal(err(() => n(mc({ note: 'n'.repeat(121) }))), 'INVALID_INPUT');
  assert.equal(err(() => n({ type: 'ESSAY', text: 'hi' })), 'INVALID_INPUT');
  assert.equal(err(() => n('not an object')), 'INVALID_INPUT');
  const b = n(buzzerQ({ options: ['ignored'], correctIndex: 3, timeLimitSec: 10 }));
  assert.deepEqual([b.options, b.correctIndex, b.timeLimitSec], [[], -1, 45]);
  assert.equal(b.note, NOTE);
});

test('QUIZ validation: text is sanitised (control chars stripped, spaces collapsed) and unknown keys dropped', () => {
  assert.equal(sanitizeQuizText('  a\u0000b\n\t c ​ d  '), 'a b c d');
  const q: any = E.normalizeQuestion({ ...mc({ text: ' Who \u0007 is   it? ' }), evil: '<script>', __proto__: { x: 1 } });
  assert.equal(q.text, 'Who is it?');
  assert.equal(q.evil, undefined);
  assert.equal(E.normalizeQuestion(mc({ options: [' Par\u0000is ', 'Rome'], correctIndex: 0 })).options[0], 'Par is');
});

test('QUIZ validation: a quiz has 1 to 40 questions, edits are host only and only in the lobby', () => {
  const s = lobby([]);
  assert.match(E.startProblem(s) ?? '', /at least one/);
  for (let i = 0; i < QUIZ_MAX_QUESTIONS; i++) E.addQuestion(s, HOST, mc({ text: `Q${i}` }));
  assert.equal(E.startProblem(s), null);
  assert.equal(err(() => E.addQuestion(s, HOST, mc())), 'INVALID_INPUT');
  assert.equal(err(() => E.addQuestion(s, 'u0', mc())), 'HOST_ONLY');
  assert.equal(err(() => E.deleteQuestion(s, 'u0', 'q1')), 'HOST_ONLY');
  assert.equal(err(() => E.moveQuestion(s, 'u0', 'q1', 'down')), 'HOST_ONLY');
  assert.equal(err(() => E.loadQuestions(s, 'u0', [mc()])), 'HOST_ONLY');
  const g = game([mc()]);
  assert.equal(err(() => E.addQuestion(g, HOST, mc())), 'WRONG_PHASE');
});

test('QUIZ edit: add / update / delete / move keep ids stable; the starter pack loads 12 valid questions', () => {
  const s = lobby([mc({ text: 'one' }), mc({ text: 'two' }), mc({ text: 'three' })]);
  const [a, b, c] = s.quiz.map((q) => q.id);
  assert.equal(new Set([a, b, c]).size, 3);
  assert.equal(E.moveQuestion(s, HOST, a, 'up'), false);
  assert.equal(E.moveQuestion(s, HOST, a, 'down'), true);
  assert.deepEqual(s.quiz.map((q) => q.id), [b, a, c]);
  assert.equal(E.moveQuestion(s, HOST, c, 'down'), false);
  E.updateQuestion(s, HOST, a, mc({ text: 'changed', correctIndex: 2 }));
  assert.equal(s.quiz[1].text, 'changed');
  assert.equal(s.quiz[1].id, a);
  E.deleteQuestion(s, HOST, b);
  assert.deepEqual(s.quiz.map((q) => q.id), [a, c]);
  const added = E.addQuestion(s, HOST, mc({ text: 'new' }));
  assert.ok(![a, b, c].includes(added.id), 'a deleted id must not be reused');
  assert.equal(err(() => E.updateQuestion(s, HOST, 'nope', mc())), 'INVALID_INPUT');
  E.loadQuestions(s, HOST, MOVIE_NIGHT_STARTER_PACK);
  assert.equal(s.quiz.length, 12);
  assert.ok(s.quiz.filter((q) => q.type === 'MULTIPLE_CHOICE').length >= 8);
  assert.ok(s.quiz.filter((q) => q.type === 'BUZZER').length >= 2);
  assert.equal(new Set(s.quiz.map((q) => q.id)).size, 12);
  E.clearQuestions(s, HOST);
  assert.equal(s.quiz.length, 0);
});

test('QUIZ schemas: edit / answer payloads are validated and unknown ops refused', () => {
  assert.equal(parseQuizPayload(quizEditSchema, { op: 'add', question: mc() }).op, 'add');
  assert.throws(() => parseQuizPayload(quizEditSchema, { op: 'drop_table' }), GameRuleError);
  assert.throws(() => parseQuizPayload(quizEditSchema, { op: 'move', id: 'q1', direction: 'sideways' }), GameRuleError);
  assert.throws(() => parseQuizPayload(quizEditSchema, { op: 'add', question: { type: 'MULTIPLE_CHOICE', text: 'x' } }), GameRuleError);
  assert.throws(() => parseQuizPayload(quizAnswerSchema, { questionId: 'q1', optionIndex: 4 }), GameRuleError);
  assert.throws(() => parseQuizPayload(quizAnswerSchema, { questionId: 'q1', optionIndex: '1' }), GameRuleError);
  assert.throws(() => parseQuizPayload(quizAnswerSchema, null), GameRuleError);
});

test('QUIZ definitions: creator game, 1 host + up to 30 players, no partner / matchmaking, aliases', () => {
  const d = GAME_DEFINITIONS['quiz-show'];
  assert.equal(d.requiredHostTier, 'creator');
  assert.equal(d.name, 'Quiz Show Studio');
  assert.deepEqual([d.minPlayers, d.maxPlayers, d.supportsPartnerMode, d.supportsPublicMatchmaking], [2, 31, false, false]);
  for (const a of ['quiz-show', 'quizshow', 'QUIZ', ' Quiz-Show ']) assert.equal(parseGameType(a), 'quiz-show');
  assert.equal(parseGameType('quiz-night'), null);
  assert.equal(quizMinPlayers(), 1);
});

// ---------------------------------------------------------------------------- start

test('QUIZ start: needs 1-30 players besides the host and a quiz of 1-40 questions', () => {
  const l = lobby([mc()]);
  const start = (n: number, quiz = l.quiz) => () => E.createInitialState({ userId: HOST, displayName: 'H' }, seats(n), quiz, T0);
  assert.equal(err(start(0)), 'INVALID_INPUT');
  assert.equal(err(start(31)), 'INVALID_INPUT');
  assert.equal(err(start(1, [])), 'INVALID_INPUT');
  assert.equal(err(() => E.createInitialState({ userId: 'u0', displayName: 'H' }, seats(2), l.quiz, T0)), 'INVALID_INPUT'); // host among the players
  const s = start(30)();
  assert.equal(s.phase, 'INTRO');
  assert.equal(s.players.length, 30);
  assert.equal(s.phaseEndsAt, T0 + QUIZ_TIMING.introMs);
  assert.ok(s.players.every((p) => p.score === 0));
});

// ---------------------------------------------------------------------------- multiple choice scoring

test('QUIZ scoring: base x (0.5 + 0.5 x remaining / limit), rounded; wrong or no answer scores 0', () => {
  assert.equal(quizSpeedPoints(100, 20_000, 20_000), 100);
  assert.equal(quizSpeedPoints(100, 10_000, 20_000), 75);
  assert.equal(quizSpeedPoints(100, 0, 20_000), 50);
  assert.equal(quizSpeedPoints(300, 3_333, 10_000), 200);
  assert.equal(quizSpeedPoints(200, -5, 10_000), 100);
  const s = game([mc({ points: 100, timeLimitSec: 20 })], 4);
  const t = open(s);
  assert.equal(E.submitAnswer(s, 'u0', qid(s), 1, t), true); // instant, correct
  assert.equal(E.submitAnswer(s, 'u1', qid(s), 1, t + 10_000), true); // half the time, correct
  assert.equal(E.submitAnswer(s, 'u2', qid(s), 0, t + 1_000), true); // wrong
  assert.equal(s.players[0].score, 0, 'no score is added before the reveal');
  E.tick(s, t + 20_000); // u3 never answers
  assert.equal(s.phase, 'REVEAL');
  assert.deepEqual(s.players.map((p) => p.score), [100, 75, 0, 0]);
  assert.deepEqual(s.reveal!.optionCounts, [1, 2, 0, 0]);
  assert.equal(s.reveal!.correctIndex, 1);
  assert.equal(s.reveal!.answerText, 'Paris');
  assert.deepEqual(s.reveal!.results.map((r) => [r.userId, r.optionIndex, r.correct, r.points]), [['u0', 1, true, 100], ['u1', 1, true, 75], ['u2', 0, false, 0], ['u3', null, false, 0]]);
  assert.equal(s.reveal!.noWinner, false);
});

test('QUIZ scoring: streak bonus +10 per consecutive correct answer beyond the first, max +50, reset by a wrong or missing answer', () => {
  assert.deepEqual([1, 2, 3, 6, 7, 20].map(quizStreakBonus), [0, 10, 20, 50, 50, 50]);
  const qs = Array.from({ length: 8 }, (_, i) => mc({ text: `Q${i}` }));
  const s = game(qs, 2);
  const gains: number[] = [];
  let prev = 0;
  for (let i = 0; i < 8; i++) {
    const t = open(s);
    E.submitAnswer(s, 'u0', qid(s), 1, t); // always instant and correct
    E.submitAnswer(s, 'u1', qid(s), 1, t);
    assert.equal(s.phase, 'REVEAL', 'everybody answered: reveal at once');
    gains.push(s.players[0].score - prev);
    prev = s.players[0].score;
    E.tick(s, s.phaseEndsAt as number);
  }
  assert.deepEqual(gains, [100, 110, 120, 130, 140, 150, 150, 150]);
  // a wrong answer resets
  const w = game([mc(), mc(), mc()], 2);
  let t = open(w); E.submitAnswer(w, 'u0', qid(w), 1, t); E.submitAnswer(w, 'u1', qid(w), 1, t);
  E.tick(w, w.phaseEndsAt as number); t = open(w);
  E.submitAnswer(w, 'u0', qid(w), 0, t); E.submitAnswer(w, 'u1', qid(w), 1, t);
  assert.equal(w.players[0].streak, 0);
  assert.equal(w.players[1].streak, 2);
  E.tick(w, w.phaseEndsAt as number); t = open(w);
  E.submitAnswer(w, 'u0', qid(w), 1, t); E.submitAnswer(w, 'u1', qid(w), 1, t);
  assert.equal(w.players[0].score, 100 + 0 + 100, 'streak restarts at 1: no bonus');
  assert.equal(w.players[1].score, 100 + 110 + 120);
});

test('QUIZ answers: once only, never changed, never outside QUESTION, never for a question that moved on', () => {
  const s = game([mc(), mc()], 3);
  const first = qid(s);
  assert.equal(err(() => E.submitAnswer(s, 'u0', first, 1, T0 + 1)), 'WRONG_PHASE', 'INTRO');
  const t = open(s);
  assert.equal(E.submitAnswer(s, 'u0', first, 0, t + 10), true);
  assert.equal(E.submitAnswer(s, 'u0', first, 1, t + 20), false, 'a second answer is ignored');
  assert.equal(s.answers.u0.optionIndex, 0, 'the first answer stays');
  assert.equal(err(() => E.submitAnswer(s, 'u0', first, 9, t + 30)), 'INVALID_INPUT');
  assert.equal(err(() => E.submitAnswer(s, HOST, first, 1, t + 30)), 'NOT_PLAYER');
  assert.equal(err(() => E.submitAnswer(s, 'stranger', first, 1, t + 30)), 'NOT_PLAYER');
  assert.equal(err(() => E.submitAnswer(s, 'u1', 'wrong-id', 1, t + 30)), 'WRONG_PHASE');
  assert.equal(err(() => E.buzz(s, 'u1', first, t + 30)), 'ILLEGAL_MOVE', 'not a buzzer question');
  // too late: the question has expired, so the tick reveals it before the answer is looked at
  assert.equal(err(() => E.submitAnswer(s, 'u1', first, 1, t + 20_001)), 'WRONG_PHASE');
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.answers.u1, undefined);
  assert.equal(err(() => E.submitAnswer(s, 'u2', first, 1, t + 20_002)), 'WRONG_PHASE');
  // next question: an answer to the old one is refused
  E.tick(s, s.phaseEndsAt as number);
  const t2 = open(s);
  assert.equal(err(() => E.submitAnswer(s, 'u1', first, 1, t2 + 1)), 'WRONG_PHASE');
  assert.equal(E.submitAnswer(s, 'u1', qid(s), 1, t2 + 1), true);
});

test('QUIZ leaderboard ties: more points, then fewer total answer ms, then join order', () => {
  const p = (userId: string, seat: number, score: number, ms: number): QuizPlayer => ({ userId, displayName: userId, seat, connected: true, left: false, score, streak: 0, correctCount: 0, totalAnswerMs: ms });
  const rows = E.leaderboard([p('a', 0, 100, 5000), p('b', 1, 300, 9000), p('c', 2, 100, 2000), p('d', 3, 100, 2000), p('e', 4, 0, 0)]);
  assert.deepEqual(rows.map((r) => [r.userId, r.rank]), [['b', 1], ['c', 2], ['d', 3], ['a', 4], ['e', 5]]);
  // the speed of correct answers is the second key in a live game
  const s = game([mc()], 2);
  const t = open(s);
  E.submitAnswer(s, 'u1', qid(s), 1, t + 1000);
  E.submitAnswer(s, 'u0', qid(s), 1, t + 1000);
  assert.equal(s.players[0].totalAnswerMs, 1000);
  assert.deepEqual(E.leaderboard(s.players).map((r) => r.userId), ['u0', 'u1'], 'equal score and time: join order');
});

// ---------------------------------------------------------------------------- flow

test('QUIZ flow: INTRO 3 s -> QUESTION -> REVEAL ~6 s -> next INTRO -> FINAL with the winner; timers advance on their own', () => {
  const s = game([mc(), mc()], 2);
  assert.equal(s.phase, 'INTRO');
  assert.equal(view(s, 'u0').question!.index, 0);
  let t = open(s);
  E.submitAnswer(s, 'u0', qid(s), 1, t);
  E.tick(s, t + 20_000); // u1 absent from the answers: the clock decides
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.phaseEndsAt! - (t + 20_000), QUIZ_TIMING.revealMs);
  E.tick(s, s.phaseEndsAt as number);
  assert.equal(s.phase, 'INTRO');
  assert.equal(s.questionIndex, 1);
  assert.equal(s.reveal, null);
  t = open(s);
  E.submitAnswer(s, 'u0', qid(s), 1, t);
  E.tick(s, t + 20_000);
  E.tick(s, s.phaseEndsAt as number);
  assert.equal(s.phase, 'FINAL');
  assert.equal(s.winnerUserId, 'u0');
  assert.equal(view(s, 'u1').winnerUserId, 'u0');
  assert.equal(E.tick(s, T0 + 10 ** 9), false, 'a finished quiz does not move');
});

test('QUIZ flow: a slightly late tick chains from the old deadline; a very late one starts the next phase fresh (no question is skipped)', () => {
  const s = game([mc(), mc()], 2);
  E.tick(s, T0 + QUIZ_TIMING.introMs + 1500); // 1.5 s late: the question opens at the old deadline
  assert.equal(s.phase, 'QUESTION');
  assert.equal(s.questionStartedAt, T0 + QUIZ_TIMING.introMs);
  const late = T0 + 10 * 60_000;
  E.tick(s, late); // the server slept for minutes: the question is revealed, nothing is skipped
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.questionIndex, 0);
  E.tick(s, late + QUIZ_TIMING.revealMs);
  assert.equal(s.phase, 'INTRO');
  assert.equal(s.questionIndex, 1);
});

test('QUIZ host controls: Reveal now, Next question, Skip question, End quiz (host only, right phase)', () => {
  const s = game([mc(), mc(), mc()], 2);
  assert.equal(err(() => E.hostControl(s, 'u0', 'skip', T0 + 1)), 'HOST_ONLY');
  assert.equal(err(() => E.hostControl(s, 'u0', 'end', T0 + 1)), 'HOST_ONLY');
  assert.equal(err(() => E.hostControl(s, HOST, 'reveal', T0 + 1)), 'WRONG_PHASE', 'nothing is open yet');
  assert.equal(E.hostControl(s, HOST, 'next', T0 + 1), true, 'next during the intro opens the question');
  assert.equal(s.phase, 'QUESTION');
  const t = s.questionStartedAt;
  E.submitAnswer(s, 'u0', qid(s), 1, t + 100);
  assert.equal(E.hostControl(s, HOST, 'reveal', t + 200), true);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.players[0].score > 0, true);
  assert.equal(err(() => E.hostControl(s, HOST, 'reveal', t + 300)), 'WRONG_PHASE');
  assert.equal(E.hostControl(s, HOST, 'next', t + 300), true);
  assert.equal(s.phase, 'INTRO');
  assert.equal(s.questionIndex, 1);
  const t2 = open(s);
  E.submitAnswer(s, 'u0', qid(s), 1, t2 + 100);
  const before = s.players[0].score;
  assert.equal(E.hostControl(s, HOST, 'skip', t2 + 200), true);
  assert.equal(s.questionIndex, 2, 'skip drops the question without a reveal');
  assert.equal(s.players[0].score, before, 'a skipped question scores nothing');
  assert.equal(s.reveal, null);
  open(s);
  assert.equal(E.hostControl(s, HOST, 'end', s.questionStartedAt + 1), true);
  assert.equal(s.phase, 'FINAL');
  assert.equal(err(() => E.hostControl(s, HOST, 'next', T0)), 'WRONG_PHASE');
});

test('QUIZ flow: when every connected player answered the question reveals at once; a disconnected player is not waited for', () => {
  const s = game([mc()], 3);
  const t = open(s);
  E.setConnected(s, 'u2', false);
  E.submitAnswer(s, 'u0', qid(s), 1, t + 10);
  assert.equal(s.phase, 'QUESTION');
  E.submitAnswer(s, 'u1', qid(s), 0, t + 20);
  assert.equal(s.phase, 'REVEAL');
});

// ---------------------------------------------------------------------------- buzzer

test('QUIZ buzzer: the server orders buzzes, the first gets a 15 s window, wrong = lockout + half the points (floor 0), the next in line answers', () => {
  const s = game([buzzerQ({ points: 200 })], 4);
  const t = open(s);
  s.players[1].score = 150;
  s.players[2].score = 40;
  assert.equal(E.buzz(s, 'u1', qid(s), t + 100), true);
  assert.equal(E.buzz(s, 'u2', qid(s), t + 150), true);
  assert.equal(E.buzz(s, 'u1', qid(s), t + 160), false, 'a second buzz changes nothing');
  assert.deepEqual(s.buzz.queue, ['u1', 'u2']);
  assert.equal(s.buzz.activeUserId, 'u1');
  assert.equal(s.buzz.answerEndsAt, t + 100 + QUIZ_TIMING.buzzerAnswerMs);
  assert.equal(err(() => E.submitBuzzAnswer(s, 'u2', qid(s), 'mine', t + 200)), 'ILLEGAL_MOVE', 'not their turn');
  assert.equal(E.submitBuzzAnswer(s, 'u1', qid(s), '  Spielberg  ', t + 200), true);
  assert.equal(s.buzz.texts.u1, 'Spielberg');
  assert.equal(err(() => E.judge(s, 'u1', qid(s), true, t + 300)), 'HOST_ONLY');
  E.judge(s, HOST, qid(s), false, t + 300);
  assert.equal(s.players[1].score, 50, '150 - 100');
  assert.deepEqual(s.buzz.lockedOut, ['u1']);
  assert.equal(s.buzz.activeUserId, 'u2', 'the next buzzer is up');
  assert.equal(err(() => E.buzz(s, 'u1', qid(s), t + 400)), 'ILLEGAL_MOVE', 'locked out');
  E.judge(s, HOST, qid(s), false, t + 500);
  assert.equal(s.players[2].score, 0, '40 - 100 floors at 0');
  assert.equal(s.buzz.activeUserId, null);
  assert.equal(s.phase, 'QUESTION', 'still open: others may buzz');
  E.buzz(s, 'u3', qid(s), t + 600);
  assert.equal(s.buzz.activeUserId, 'u3');
  E.judge(s, HOST, qid(s), true, t + 700);
  assert.equal(s.phase, 'REVEAL');
  assert.equal(s.players[3].score, 200);
  assert.equal(s.reveal!.noWinner, false);
  assert.deepEqual(s.reveal!.results.map((r) => [r.userId, r.correct, r.points]), [['u1', false, -100], ['u2', false, -40], ['u3', true, 200]]);
  assert.equal(s.reveal!.answerText, NOTE);
  assert.equal(err(() => E.judge(s, HOST, qid(s), true, t + 800)), 'WRONG_PHASE');
});

test('QUIZ buzzer: first buzz wins by arrival order, not by seat; nobody active = judge refused', () => {
  const s = game([buzzerQ()], 3);
  const t = open(s);
  assert.equal(err(() => E.judge(s, HOST, qid(s), true, t + 1)), 'ILLEGAL_MOVE');
  E.buzz(s, 'u2', qid(s), t + 5);
  E.buzz(s, 'u0', qid(s), t + 6);
  assert.equal(s.buzz.activeUserId, 'u2');
  assert.equal(err(() => E.submitAnswer(s, 'u0', qid(s), 0, t + 7)), 'ILLEGAL_MOVE', 'MC answer on a buzzer question');
});

test('QUIZ buzzer: the 15 s window runs out (lockout without penalty, next buzzer up); all locked out waits for the host; the 45 s clock reveals', () => {
  const s = game([buzzerQ({ points: 100 })], 2);
  const t = open(s);
  s.players[0].score = 80;
  E.buzz(s, 'u0', qid(s), t + 1000);
  E.buzz(s, 'u1', qid(s), t + 2000);
  E.tick(s, t + 1000 + QUIZ_TIMING.buzzerAnswerMs);
  assert.equal(s.buzz.activeUserId, 'u1');
  assert.equal(s.players[0].score, 80, 'no penalty for running out of time');
  assert.deepEqual(s.buzz.lockedOut, ['u0']);
  assert.equal(s.buzz.answerEndsAt, t + 1000 + 2 * QUIZ_TIMING.buzzerAnswerMs, 'the next window starts when the previous one ended');
  E.tick(s, s.buzz.answerEndsAt as number);
  assert.deepEqual(s.buzz.lockedOut, ['u0', 'u1']);
  assert.equal(s.phase, 'QUESTION', 'everybody is locked out: the host decides');
  assert.match(s.statusMessage, /locked out/i);
  assert.equal(E.hostControl(s, HOST, 'reveal', t + 40_000), true);
  assert.equal(s.reveal!.noWinner, true);
  // timer end without any buzz
  const s2 = game([buzzerQ()], 2);
  const t2 = open(s2);
  E.tick(s2, t2 + 44_999);
  assert.equal(s2.phase, 'QUESTION');
  E.tick(s2, t2 + 45_000);
  assert.equal(s2.phase, 'REVEAL');
  assert.equal(s2.reveal!.noWinner, true);
});

test('QUIZ buzzer: a correct answer scores the question points plus the streak bonus', () => {
  const s = game([buzzerQ({ points: 100 }), buzzerQ({ points: 100 })], 2);
  let t = open(s);
  E.buzz(s, 'u0', qid(s), t + 100); E.judge(s, HOST, qid(s), true, t + 200);
  assert.equal(s.players[0].score, 100);
  E.tick(s, s.phaseEndsAt as number); t = open(s);
  E.buzz(s, 'u0', qid(s), t + 100); E.judge(s, HOST, qid(s), true, t + 200);
  assert.equal(s.players[0].score, 100 + 110);
  assert.equal(s.players[0].totalAnswerMs, 200);
});

test('QUIZ buzzer: a player who leaves while answering hands the window to the next buzzer', () => {
  const s = game([buzzerQ()], 3);
  const t = open(s);
  E.buzz(s, 'u0', qid(s), t + 1); E.buzz(s, 'u1', qid(s), t + 2);
  E.removePlayer(s, 'u0', t + 100);
  assert.equal(s.buzz.activeUserId, 'u1');
  assert.deepEqual(s.buzz.queue, ['u1']);
});

// ---------------------------------------------------------------------------- leave / abort / rematch

test('QUIZ host leaves: the quiz is ABORTED, no podium', () => {
  const s = game([mc(), mc()], 3);
  open(s);
  assert.equal(E.removePlayer(s, HOST, T0 + 5000), true);
  assert.equal(s.phase, 'ABORTED');
  assert.equal(s.winnerUserId, null);
  assert.equal(E.removePlayer(s, HOST, T0 + 5001), true, 'safe to call twice');
  assert.equal(view(s, 'u0').phase, 'ABORTED');
});

test('QUIZ player leaves: the score stays on the leaderboard marked "left"; when every player left the quiz aborts', () => {
  const s = game([mc(), mc()], 3);
  let t = open(s);
  E.submitAnswer(s, 'u0', qid(s), 1, t); E.submitAnswer(s, 'u1', qid(s), 1, t + 5000); E.submitAnswer(s, 'u2', qid(s), 1, t + 6000);
  assert.equal(E.removePlayer(s, 'u0', t + 7000), false);
  const row = view(s, 'u1').leaderboard.find((r) => r.userId === 'u0')!;
  assert.equal(row.left, true);
  assert.equal(row.score, 100);
  assert.equal(row.rank, 1);
  assert.equal(err(() => E.submitAnswer(s, 'u0', qid(s), 1, t + 8000)), 'NOT_PLAYER');
  E.tick(s, s.phaseEndsAt as number); t = open(s);
  E.removePlayer(s, 'u1', t + 1);
  assert.equal(s.phase, 'QUESTION');
  assert.equal(E.removePlayer(s, 'u2', t + 2), true);
  assert.equal(s.phase, 'ABORTED');
  assert.ok(s.players.every((p) => p.left));
  // an answer of a player who left before the reveal still counts for what they answered
  const g = game([mc()], 2);
  const t3 = open(g);
  E.submitAnswer(g, 'u0', qid(g), 1, t3);
  E.removePlayer(g, 'u0', t3 + 10);
  E.tick(g, t3 + 20_000);
  assert.equal(g.players[0].score, 100);
});

test('QUIZ rematch: the same quiz with scores reset; the host can also go back to the lobby to edit it', () => {
  const s = game([mc(), mc()], 2);
  let t = open(s); E.submitAnswer(s, 'u0', qid(s), 1, t);
  E.hostControl(s, HOST, 'end', t + 100);
  assert.equal(s.phase, 'FINAL');
  assert.equal(err(() => E.backToLobby(s, 'u0')), 'HOST_ONLY');
  const again = E.createInitialState(s.host, seats(2), s.quiz, T0 + 50_000, s.idSeq);
  assert.equal(again.phase, 'INTRO');
  assert.equal(again.questionIndex, 0);
  assert.deepEqual(again.quiz.map((q) => q.id), s.quiz.map((q) => q.id));
  assert.ok(again.players.every((p) => p.score === 0 && p.streak === 0 && p.totalAnswerMs === 0));
  assert.equal(again.winnerUserId, null);
  const lobbyAgain = E.backToLobby(s, HOST);
  assert.equal(lobbyAgain.phase, 'LOBBY');
  assert.equal(lobbyAgain.quiz.length, 2);
  assert.equal(lobbyAgain.players.length, 0);
  E.addQuestion(lobbyAgain, HOST, mc({ text: 'third' }));
  assert.equal(lobbyAgain.quiz.length, 3);
  assert.equal(new Set(lobbyAgain.quiz.map((q) => q.id)).size, 3);
  assert.equal(err(() => E.backToLobby(game([mc()]), HOST)), 'WRONG_PHASE');
  t = 0;
});

test('QUIZ chat lock: only the player whose buzzer answer window is open', () => {
  const s = game([buzzerQ()], 2);
  const t = open(s);
  assert.equal(E.chatLockedFor(s, 'u0'), false);
  E.buzz(s, 'u0', qid(s), t + 1);
  assert.equal(E.chatLockedFor(s, 'u0'), true);
  assert.equal(E.chatLockedFor(s, 'u1'), false);
  assert.equal(E.chatLockedFor(s, HOST), false);
  assert.equal(E.chatLockedFor(view(s, 'u0'), 'u0'), true);
  E.judge(s, HOST, qid(s), false, t + 2);
  assert.equal(E.chatLockedFor(s, 'u0'), false);
});

test('QUIZ rate limiter: sliding window per key', () => {
  for (let i = 0; i < 4; i++) assert.equal(quizRateAllowed('r:u:answer', 4, 3000, 1000 + i), true);
  assert.equal(quizRateAllowed('r:u:answer', 4, 3000, 1010), false);
  assert.equal(quizRateAllowed('r:u:answer', 4, 3000, 4100), true);
  assert.equal(quizRateAllowed('r:other:answer', 4, 3000, 1010), true);
});

// ---------------------------------------------------------------------------- redaction

test('QUIZ redaction: before the reveal a player or spectator never gets the correct option or the note; the host does', () => {
  const s = game([mc({ note: NOTE, correctIndex: 2 }), buzzerQ()], 3);
  for (const phase of ['INTRO', 'QUESTION'] as const) {
    if (phase === 'QUESTION') open(s);
    for (const id of ['u0', 'u1', 'u2', 'stranger', null]) {
      const text = json(s, id);
      assert.ok(!text.includes(NOTE), `${id} saw the note in ${phase}`);
      assert.ok(!text.includes('correctIndex'), `${id} saw correctIndex in ${phase}`);
      assert.ok(!text.includes('"quiz"') && !text.includes('"answers"') && !text.includes('"draft":[') , `${id} got server-only fields`);
      assert.equal(view(s, id).hostQuestion, null);
      assert.equal(view(s, id).reveal, null);
      assert.equal(view(s, id).answerCounts, null);
    }
    const h = view(s, HOST);
    assert.equal(h.hostQuestion!.correctIndex, 2);
    assert.equal(h.hostQuestion!.note, NOTE);
  }
  // spectators and strangers have no `me`
  assert.equal(view(s, null).me, null);
  assert.equal(view(s, 'stranger').me, null);
  // the buzzer question's note is host only too
  const b = game([buzzerQ()], 2);
  open(b);
  for (const id of ['u0', 'u1', null]) assert.ok(!json(b, id).includes(NOTE));
  assert.equal(view(b, HOST).hostQuestion!.note, NOTE);
});

test('QUIZ redaction: the correct answer appears for everybody only once the question is revealed', () => {
  const s = game([mc({ note: NOTE, correctIndex: 2 })], 2);
  const t = open(s);
  E.submitAnswer(s, 'u0', qid(s), 2, t + 50);
  E.hostControl(s, HOST, 'reveal', t + 100);
  for (const id of ['u0', 'u1', null, HOST]) {
    const v = view(s, id);
    assert.equal(v.reveal!.correctIndex, 2);
    assert.equal(v.reveal!.note, NOTE);
    assert.equal(v.phase, 'REVEAL');
  }
  E.tick(s, s.phaseEndsAt as number);
  assert.equal(s.phase, 'FINAL');
  assert.ok(!json(s, 'u1').includes(NOTE), 'the final screen carries no question data');
  assert.equal(view(s, 'u1').question, null);
});

test('QUIZ redaction: other players\' answers stay hidden until the reveal; the host sees live counts, not who chose what', () => {
  const s = game([mc()], 3);
  const t = open(s);
  E.submitAnswer(s, 'u0', qid(s), 3, t + 50);
  const u1 = view(s, 'u1');
  assert.equal(u1.me!.myOption, null);
  assert.equal(u1.me!.answered, false);
  assert.ok(!JSON.stringify(u1).includes('optionIndex'), 'no per-player choice in another player\'s view');
  assert.equal(view(s, 'u0').me!.myOption, 3, 'my own answer is mine to see');
  assert.equal(view(s, 'u0').me!.answered, true);
  const sp = JSON.stringify(view(s, null));
  assert.ok(!sp.includes('optionIndex') && !sp.includes('"myOption":3'));
  const h = view(s, HOST);
  assert.deepEqual(h.answerCounts, [0, 0, 0, 1]);
  assert.equal(h.answeredCount, 1);
  assert.ok(!JSON.stringify(h).includes('optionIndex'), 'the host sees counts, not who chose what');
  E.hostControl(s, HOST, 'reveal', t + 100);
  const after = view(s, 'u1');
  assert.equal(after.reveal!.results.find((r) => r.userId === 'u0')!.optionIndex, 3, 'choices are public at the reveal');
});

test('QUIZ redaction: the draft quiz (with its answers) goes to the host in the lobby only', () => {
  const s = lobby([mc({ note: NOTE })]);
  assert.equal(view(s, HOST).draft!.length, 1);
  assert.equal(view(s, HOST).draft![0].correctIndex, 1);
  for (const id of ['u0', 'stranger', null]) {
    const v = view(s, id);
    assert.equal(v.draft, null);
    assert.equal(v.questionCount, 1);
    assert.ok(!JSON.stringify(v).includes(NOTE));
    assert.ok(!JSON.stringify(v).includes('correctIndex'));
  }
  assert.equal(view(s, HOST).phase, 'LOBBY');
});

test('QUIZ redaction: a buzzer answer typed by the active player is shown to the host and that player only', () => {
  const s = game([buzzerQ()], 3);
  const t = open(s);
  E.buzz(s, 'u0', qid(s), t + 1);
  E.buzz(s, 'u1', qid(s), t + 2);
  E.submitBuzzAnswer(s, 'u0', qid(s), 'TYPED-GUESS', t + 3);
  assert.equal(view(s, HOST).buzz!.activeText, 'TYPED-GUESS');
  assert.equal(view(s, 'u0').buzz!.activeText, 'TYPED-GUESS');
  for (const id of ['u1', 'u2', null]) assert.ok(!json(s, id).includes('TYPED-GUESS'), `${id} saw the typed answer`);
  assert.deepEqual(view(s, 'u2').buzz!.queue, ['u0', 'u1'], 'the buzz order itself is public');
  assert.equal(view(s, 'u1').me!.queuePosition, 2);
});

test('QUIZ redaction: publicStateFor of an already redacted view is a no-op and never mutates the state', () => {
  const s = game([mc({ note: NOTE })], 2);
  open(s);
  const before = JSON.stringify(s);
  const v = view(s, 'u0');
  assert.equal(E.publicStateFor(v, 'u1'), v);
  assert.equal(JSON.stringify(s), before);
  assert.equal(E.publicStateFor(null, 'u0'), null);
  assert.equal(E.isServerState(s), true);
  assert.equal(E.isServerState(v), false);
});
