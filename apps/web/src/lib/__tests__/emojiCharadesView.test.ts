import test from 'node:test';
import assert from 'node:assert/strict';
import type { EmojiCharadesGameView } from '@synccinema/common';
import {
  canHostEmojiCharades,
  startCheck,
  clockOffset,
  msLeft,
  ringFraction,
  secondsLabel,
  nextHintSeconds,
  phaseTitle,
  hintWords,
  hintLabel,
  solvedStrip,
  leaderboard,
  podium,
  myPoints,
  guessDraftProblem,
  feedbackFor,
  emojiCharadesErrorText
} from '../emojiCharadesView';
import { canonicalGameId, gameRoutePath, gameTitleFor, gameIdFromRoomCode } from '../gameRoutes';

const players = (n = 4) =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `P${i}`, seat: i, connected: true, left: false }));

function view(over: Partial<EmojiCharadesGameView> = {}): EmojiCharadesGameView {
  return {
    game: 'emoji-charades',
    phase: 'PLAY',
    mode: 'race',
    round: 1,
    totalRounds: 3,
    players: players(),
    scores: {},
    phaseEndsAt: 10_000,
    phaseDurationMs: 60_000,
    serverNow: 0,
    emoji: ['A', 'B', 'C'],
    genre: 'Action',
    difficulty: 2,
    hintTier: 0,
    hint: null,
    nextHintAt: null,
    solvedUserIds: [],
    me: null,
    result: null,
    history: [],
    winnerUserIds: [],
    statusMessage: '',
    ...over
  };
}

test('only a VIP (plus) or Creator pass can host', () => {
  assert.equal(canHostEmojiCharades('free'), false);
  assert.equal(canHostEmojiCharades(undefined), false);
  assert.equal(canHostEmojiCharades('plus'), true);
  assert.equal(canHostEmojiCharades('creator'), true);
});

test('lobby start check: host only, at least 2 connected players', () => {
  assert.equal(startCheck(false, 6).ok, false);
  assert.equal(startCheck(true, 1).ok, false);
  assert.match(startCheck(true, 1).reason, /1 more player/);
  assert.match(startCheck(true, 0).reason, /2 more players/);
  assert.equal(startCheck(true, 2).ok, true);
  assert.equal(startCheck(true, 8).ok, true);
});

test('timer helpers use the server clock offset and clamp', () => {
  assert.equal(clockOffset(5000, 4000), 1000);
  assert.equal(clockOffset(undefined, 4000), 0);
  const v = view({ phaseEndsAt: 10_000, phaseDurationMs: 20_000 });
  assert.equal(msLeft(v, 4000, 1000), 5000);
  assert.equal(msLeft(v, 20_000, 0), 0);
  assert.equal(msLeft(view({ phaseEndsAt: null }), 1, 0), 0);
  assert.equal(ringFraction(v, 4000, 1000), 0.25);
  assert.equal(ringFraction(v, 99_999, 0), 0);
  assert.equal(ringFraction(view({ phaseDurationMs: 0 }), 1, 0), 0);
  assert.equal(secondsLabel(4001), '5');
  assert.equal(secondsLabel(-50), '0');
});

test('next hint countdown', () => {
  assert.equal(nextHintSeconds(view({ nextHintAt: 20_000 }), 5000, 0), 15);
  assert.equal(nextHintSeconds(view({ nextHintAt: 20_000 }), 25_000, 0), 0);
  assert.equal(nextHintSeconds(view({ nextHintAt: null }), 5000, 0), null);
  assert.equal(nextHintSeconds(null, 5000, 0), null);
});

test('phase titles and hint labels', () => {
  assert.equal(phaseTitle('COUNTDOWN'), 'Get ready');
  assert.equal(phaseTitle('PLAY'), 'Guess it');
  assert.equal(phaseTitle('nope'), 'Emoji Charades');
  assert.equal(phaseTitle(undefined), 'Emoji Charades');
  assert.match(hintLabel(0), /clock/);
  assert.match(hintLabel(1), /count/i);
  assert.match(hintLabel(2), /first letters/i);
});

test('hintWords splits the masked answer into words of cells', () => {
  assert.deepEqual(hintWords('_ _ _   _ _ _ _'), [['_', '_', '_'], ['_', '_', '_', '_']]);
  assert.deepEqual(hintWords('T _ _   D _ _ _'), [['T', '_', '_'], ['D', '_', '_', '_']]);
  assert.deepEqual(hintWords('E . _ .'), [['E', '.', '_', '.']]);
  assert.deepEqual(hintWords(null), []);
  assert.deepEqual(hintWords(''), []);
});

test('who-solved strip: solvers first in solve order, then the others; names and order only', () => {
  const ps = players(4);
  ps[3].left = true;
  const rows = solvedStrip(view({ players: ps, solvedUserIds: ['u2', 'u0'] }));
  assert.deepEqual(rows.map((r) => [r.userId, r.order, r.solved]), [['u2', 1, true], ['u0', 2, true], ['u1', null, false]]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['connected', 'name', 'order', 'solved', 'userId']);
  assert.equal(solvedStrip(view({ solvedUserIds: [] })).length, 4);
});

test('leaderboard sorts by score and shares ranks; the podium holds the top 3 who are still in', () => {
  const ps = players(5);
  ps[1].left = true;
  const v = { players: ps, scores: { u0: 300, u1: 500, u2: 300, u3: 100, u4: 0 } };
  const rows = leaderboard(v);
  assert.deepEqual(rows.map((r) => [r.userId, r.rank]), [['u1', 1], ['u0', 2], ['u2', 2], ['u3', 4], ['u4', 5]]);
  assert.deepEqual(podium(v).map((r) => r.userId), ['u0', 'u2', 'u3']);
});

test('points earned in the round that just ended', () => {
  const result = { round: 1, answer: 'x', emoji: [], genre: 'g', difficulty: 1, solves: [], unsolvedUserIds: [], points: { u0: 120 }, reason: '' };
  assert.equal(myPoints(view({ phase: 'REVEAL', result }), 'u0'), 120);
  assert.equal(myPoints(view({ phase: 'REVEAL', result }), 'u1'), 0);
  assert.equal(myPoints(view(), 'u0'), 0);
});

test('guess draft check mirrors the server rules', () => {
  assert.equal(guessDraftProblem('The Dark Knight'), null);
  assert.equal(guessDraftProblem('   '), 'Type a movie or show');
  assert.equal(guessDraftProblem('!!!'), 'Type a movie or show');
  assert.match(guessDraftProblem('x'.repeat(61)) ?? '', /Max 60/);
  assert.equal(guessDraftProblem('x'.repeat(60)), null);
  assert.equal(guessDraftProblem('3 Idiots'), null);
});

test('feedback comes from the latest own guess only', () => {
  assert.equal(feedbackFor(view({ me: null })), null);
  const base = { solved: false, answer: null, wrongGuesses: 0, guessesLeft: 12, points: 0 };
  assert.equal(feedbackFor(view({ me: { ...base, guesses: [] } })), null);
  assert.deepEqual(feedbackFor(view({ me: { ...base, guesses: [{ text: 'a', kind: 'wrong' }] } })), { kind: 'wrong', text: 'Not it' });
  assert.deepEqual(feedbackFor(view({ me: { ...base, guesses: [{ text: 'a', kind: 'wrong' }, { text: 'b', kind: 'close' }] } })), { kind: 'close', text: 'So close!' });
});

test('error texts', () => {
  assert.match(emojiCharadesErrorText('ALREADY_SOLVED'), /already solved/);
  assert.match(emojiCharadesErrorText('TOO_MANY_GUESSES'), /No guesses left/);
  assert.match(emojiCharadesErrorText('UPGRADE_REQUIRED'), /Watch\+/);
  assert.equal(emojiCharadesErrorText('WHATEVER', 'server text'), 'server text');
  assert.equal(emojiCharadesErrorText(undefined), 'That did not work. Try again.');
});

test('game routes know Emoji Charades (id, aliases, room code prefix, title)', () => {
  assert.equal(canonicalGameId('emoji-charades'), 'emoji-charades');
  assert.equal(canonicalGameId('Emoji-Charades'), 'emoji-charades');
  assert.equal(canonicalGameId('emojicharades'), 'emoji-charades');
  assert.equal(canonicalGameId('charades'), 'emoji-charades');
  assert.equal(canonicalGameId('charade'), null);
  assert.equal(gameIdFromRoomCode('EMOJI-ABCD1234'), 'emoji-charades');
  assert.equal(gameRoutePath('emoji-charades', 'EMOJI-ABCD1234'), '/games/emoji-charades?room=EMOJI-ABCD1234');
  assert.equal(gameRoutePath(undefined, 'EMOJI-ABCD1234'), '/games/emoji-charades?room=EMOJI-ABCD1234');
  assert.equal(gameTitleFor('emoji-charades'), 'Emoji Charades');
  assert.equal(canonicalGameId('imposter'), 'imposter');
});
