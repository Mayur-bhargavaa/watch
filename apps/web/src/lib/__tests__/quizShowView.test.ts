import test from 'node:test';
import assert from 'node:assert/strict';
import type { QuizGameView, QuizLeaderboardRow, QuizMe } from '@synccinema/common';
import {
  canHostQuiz, startCheck, phaseTitle, progressLabel, optionStyle, OPTION_STYLES, leaderboardWindow, podium, ordinal, barFraction, formatPoints,
  playerQuestionState, allLockedOut, blankQuestion, validateQuestion, questionPayload, canAddQuestion, quizErrorText, chatLockedReason, secondsText, playerName
} from '../quizShowView';

const row = (id: string, rank: number, extra: Partial<QuizLeaderboardRow> = {}): QuizLeaderboardRow => ({ rank, userId: id, displayName: id.toUpperCase(), score: 1000 - rank, streak: 0, correctCount: 0, left: false, connected: true, ...extra });
const rows = Array.from({ length: 14 }, (_, i) => row(`p${i}`, i + 1));
const me = (over: Partial<QuizMe> = {}): QuizMe => ({ role: 'player', myOption: null, answered: false, buzzed: false, lockedOut: false, isActiveAnswerer: false, queuePosition: null, rank: null, score: 0, ...over });
const view = (over: Partial<QuizGameView> = {}): QuizGameView => ({
  game: 'quiz-show', phase: 'QUESTION', host: { userId: 'h', displayName: 'Host', connected: true, left: false }, players: [], questionCount: 3, questionIndex: 0,
  question: { id: 'q1', index: 0, total: 3, type: 'MULTIPLE_CHOICE', text: 'Q?', options: ['a', 'b'], timeLimitSec: 20, points: 100 },
  phaseEndsAt: null, phaseDurationMs: 0, serverNow: 0, me: me(), answeredCount: 0, answerCounts: null, hostQuestion: null, draft: null, buzz: null, reveal: null,
  leaderboard: [], winnerUserId: null, statusMessage: '', ...over
});

test('hosting needs the Creator Pass (not Watch+): guests of any pass can still join', () => {
  assert.equal(canHostQuiz('free'), false);
  assert.equal(canHostQuiz('plus'), false);
  assert.equal(canHostQuiz('creator'), true);
  assert.equal(canHostQuiz(undefined), false);
  assert.equal(canHostQuiz('admin'), false);
});

test('start rule: the host, at least one question and at least one connected player', () => {
  assert.equal(startCheck(false, 5, 5).ok, false);
  assert.equal(startCheck(true, 5, 0).ok, false);
  assert.match(startCheck(true, 5, 0).reason, /Add at least one question/);
  assert.equal(startCheck(true, 0, 3).ok, false);
  assert.match(startCheck(true, 0, 3).reason, /Waiting for a player/);
  assert.equal(startCheck(true, 1, 1).ok, true);
  assert.match(startCheck(true, 1, 1).reason, /1 question, 1 player/);
  assert.match(startCheck(true, 12, 8).reason, /8 questions, 12 players/);
});

test('titles, progress and the four muted option hues', () => {
  assert.equal(phaseTitle('REVEAL'), 'Answer');
  assert.equal(phaseTitle('nope'), 'Quiz Show Studio');
  assert.equal(progressLabel(view({ questionIndex: 2 })), 'Question 3 of 3');
  assert.equal(progressLabel(view({ phase: 'FINAL' })), 'Final results');
  assert.equal(progressLabel(view({ phase: 'LOBBY', questionIndex: -1 })), 'Lobby');
  assert.equal(OPTION_STYLES.length, 4);
  assert.match(optionStyle(0).bg, /rose-700/);
  assert.match(optionStyle(1).bg, /blue-700/);
  assert.match(optionStyle(2).bg, /amber-700/);
  assert.match(optionStyle(3).bg, /emerald-700/);
  assert.equal(optionStyle(5).letter, 'B', 'wraps around');
  for (const s of OPTION_STYLES) assert.ok(!/gradient|neon|glow|blur|\/\d/.test(s.bg), 'solid hues only');
});

test('leaderboard window: top 10 plus the viewer\'s own row when they are further down', () => {
  const a = leaderboardWindow(rows, 'p2');
  assert.equal(a.top.length, 10);
  assert.equal(a.mine, null);
  assert.equal(a.hidden, 4);
  const b = leaderboardWindow(rows, 'p12');
  assert.equal(b.mine?.rank, 13);
  assert.equal(b.hidden, 3);
  assert.equal(leaderboardWindow(rows, null).mine, null);
  assert.equal(leaderboardWindow(rows, 'ghost').mine, null);
  assert.equal(leaderboardWindow(rows, 'p12', 5).top.length, 5);
  assert.equal(leaderboardWindow(rows.slice(0, 3), 'p1').hidden, 0);
});

test('podium order is 2nd, 1st, 3rd and copes with fewer than three players', () => {
  assert.deepEqual(podium(rows).map((r) => r.rank), [2, 1, 3]);
  assert.deepEqual(podium(rows.slice(0, 2)).map((r) => r.rank), [2, 1]);
  assert.deepEqual(podium(rows.slice(0, 1)).map((r) => r.rank), [1]);
  assert.deepEqual(podium([]), []);
});

test('ordinals, bars and points text', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
  assert.equal(barFraction(3, [1, 3, 0]), 1);
  assert.equal(barFraction(0, [0, 0]), 0);
  assert.equal(barFraction(1, [2, 4]), 0.25);
  assert.equal(formatPoints(120), '+120');
  assert.equal(formatPoints(-50), '-50');
  assert.equal(formatPoints(0), '0');
  assert.equal(secondsText(0), '0');
  assert.equal(secondsText(1), '1');
  assert.equal(secondsText(14_001), '15');
  assert.equal(playerName({ host: view().host, players: [] }, 'h'), 'Host');
  assert.equal(playerName({ host: view().host, players: [] }, 'x'), 'Player');
});

test('what the player screen shows: intro, answering, answered, reveal, buzz, buzzed, turn, locked', () => {
  assert.equal(playerQuestionState(view({ phase: 'INTRO' })), 'waiting');
  assert.equal(playerQuestionState(view()), 'answering');
  assert.equal(playerQuestionState(view({ me: me({ answered: true, myOption: 1 }) })), 'answered');
  assert.equal(playerQuestionState(view({ phase: 'REVEAL' })), 'reveal');
  assert.equal(playerQuestionState(view({ me: null })), 'idle');
  assert.equal(playerQuestionState(view({ me: me({ role: 'host' }) })), 'idle');
  const buzzer = { ...view().question!, type: 'BUZZER' as const, options: [] };
  assert.equal(playerQuestionState(view({ question: buzzer })), 'buzz');
  assert.equal(playerQuestionState(view({ question: buzzer, me: me({ buzzed: true, queuePosition: 2 }) })), 'buzzed');
  assert.equal(playerQuestionState(view({ question: buzzer, me: me({ buzzed: true, isActiveAnswerer: true }) })), 'turn');
  assert.equal(playerQuestionState(view({ question: buzzer, me: me({ lockedOut: true }) })), 'locked');
  assert.equal(playerQuestionState(view({ phase: 'FINAL' })), 'idle');
});

test('everybody locked out is detected from the public buzz block', () => {
  const players = ['a', 'b'].map((id, i) => ({ userId: id, displayName: id, seat: i, connected: true, left: false, score: 0, streak: 0, correctCount: 0, totalAnswerMs: 0 }));
  const buzz = (lockedOut: string[]) => ({ queue: [], lockedOut, activeUserId: null, answerEndsAt: null, activeText: null });
  assert.equal(allLockedOut({ players, buzz: buzz(['a']) }), false);
  assert.equal(allLockedOut({ players, buzz: buzz(['a', 'b']) }), true);
  assert.equal(allLockedOut({ players: [{ ...players[1], left: true }, players[0]], buzz: buzz(['a']) }), true, 'players who left are not waited for');
  assert.equal(allLockedOut({ players, buzz: null }), false);
});

test('quiz editor validation mirrors the server rules', () => {
  const ok = { ...blankQuestion(), text: 'Capital?', options: ['Paris', 'Rome', '', ''].slice(0, 2), correctIndex: 0 };
  assert.deepEqual(validateQuestion(ok), []);
  assert.deepEqual(validateQuestion(blankQuestion()).sort(), ['Fill in every option or remove the empty ones', 'Write the question'].sort());
  assert.ok(validateQuestion({ ...ok, text: 'x'.repeat(201) }).some((p) => /at most 200/.test(p)));
  assert.ok(validateQuestion({ ...ok, text: '   ' }).includes('Write the question'));
  assert.ok(validateQuestion({ ...ok, options: ['a'.repeat(81), 'b'] }).some((p) => /at most 80/.test(p)));
  assert.ok(validateQuestion({ ...ok, options: ['same', 'SAME'] }).some((p) => /different/.test(p)));
  assert.ok(validateQuestion({ ...ok, options: ['only'] }).some((p) => /2 to 4/.test(p)));
  assert.ok(validateQuestion({ ...ok, options: ['a', 'b', 'c', 'd', 'e'] }).some((p) => /2 to 4/.test(p)));
  assert.ok(validateQuestion({ ...ok, correctIndex: 5 }).some((p) => /correct option/.test(p)));
  assert.ok(validateQuestion({ ...ok, correctIndex: -1 }).some((p) => /correct option/.test(p)));
  assert.ok(validateQuestion({ ...ok, note: 'n'.repeat(121) }).some((p) => /at most 120/.test(p)));
  assert.deepEqual(validateQuestion({ ...blankQuestion('BUZZER'), text: 'Who?' }), []);
  assert.deepEqual(validateQuestion({ ...blankQuestion('BUZZER'), text: '' }), ['Write the question']);
});

test('editor payloads: buzzer questions carry no options and the fixed 45 s clock', () => {
  const b = questionPayload({ ...blankQuestion('BUZZER'), text: 'Who?', options: ['ignored'], timeLimitSec: 10, points: 200, note: 'Jaws' });
  assert.deepEqual([b.type, b.options, b.correctIndex, b.timeLimitSec, b.points, b.note], ['BUZZER', [], -1, 45, 200, 'Jaws']);
  const m = questionPayload({ ...blankQuestion(), text: 'Q', options: ['a', 'b'], correctIndex: 1, timeLimitSec: 30 });
  assert.deepEqual([m.type, m.options, m.correctIndex, m.timeLimitSec], ['MULTIPLE_CHOICE', ['a', 'b'], 1, 30]);
  assert.equal(blankQuestion().options.length, 4);
  assert.equal(canAddQuestion(39), true);
  assert.equal(canAddQuestion(40), false);
});

test('error texts and the chat lock reason', () => {
  assert.match(quizErrorText('UPGRADE_REQUIRED'), /Creator Pass/);
  assert.match(quizErrorText('HOST_ONLY'), /quiz master/);
  assert.equal(quizErrorText('CHAT_LOCKED', 'Chat is locked while you are answering'), 'Chat is locked while you are answering');
  assert.equal(quizErrorText('WEIRD', 'Because.'), 'Because.');
  assert.equal(quizErrorText(undefined), 'That did not work. Try again.');
  assert.equal(chatLockedReason({ phase: 'QUESTION', me: me({ isActiveAnswerer: true }) }, false), 'Chat is locked while you answer');
  assert.equal(chatLockedReason({ phase: 'QUESTION', me: me() }, false), '');
  assert.equal(chatLockedReason({ phase: 'QUESTION', me: null }, true), 'Spectators can only watch');
  assert.equal(chatLockedReason({ phase: 'REVEAL', me: me({ isActiveAnswerer: true }) }, false), '');
});
