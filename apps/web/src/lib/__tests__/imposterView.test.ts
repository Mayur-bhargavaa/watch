import test from 'node:test';
import assert from 'node:assert/strict';
import type { ImposterGameView } from '@synccinema/common';
import {
  canHostImposter,
  startCheck,
  clockOffset,
  msLeft,
  ringFraction,
  secondsLabel,
  phaseTitle,
  voteTargets,
  canVote,
  voteProgress,
  clueRows,
  clueDone,
  leaderboard,
  resultHeadline,
  myPoints,
  imposterErrorText,
  clueDraftProblem
} from '../imposterView';
import { canonicalGameId, gameRoutePath, gameTitleFor, gameIdFromRoomCode } from '../gameRoutes';
import { decideOnClose, isTerminalErrorCode, mapGameError } from '../gameConnection';

const players = (n = 5) =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `P${i}`, seat: i, connected: true, left: false }));

function view(over: Partial<ImposterGameView> = {}): ImposterGameView {
  return {
    game: 'imposter',
    phase: 'VOTE',
    round: 1,
    totalRounds: 3,
    clueRounds: 2,
    players: players(),
    scores: {},
    phaseEndsAt: 10_000,
    phaseDurationMs: 30_000,
    serverNow: 0,
    category: 'Foods',
    me: null,
    clueRound: 1,
    currentTurnUserId: null,
    clues: [],
    readyToVote: [],
    votedUserIds: [],
    myVote: null,
    accusedUserId: null,
    result: null,
    history: [],
    winnerUserIds: [],
    statusMessage: '',
    ...over
  };
}

test('only a VIP (plus) or Creator pass can host', () => {
  assert.equal(canHostImposter('free'), false);
  assert.equal(canHostImposter(undefined), false);
  assert.equal(canHostImposter('plus'), true);
  assert.equal(canHostImposter('creator'), true);
});

test('lobby start check: host only, at least 4 connected players', () => {
  assert.equal(startCheck(false, 6).ok, false);
  assert.equal(startCheck(true, 3).ok, false);
  assert.match(startCheck(true, 3).reason, /1 more player/);
  assert.match(startCheck(true, 2).reason, /2 more players/);
  assert.equal(startCheck(true, 4).ok, true);
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
  assert.equal(secondsLabel(0), '0');
  assert.equal(secondsLabel(-50), '0');
});

test('phase titles', () => {
  assert.equal(phaseTitle('CLUES'), 'Give a clue');
  assert.equal(phaseTitle('GUESS'), 'Last chance');
  assert.equal(phaseTitle('nope'), 'Imposter');
  assert.equal(phaseTitle(undefined), 'Imposter');
});

test('voting: no self target, left players excluded, votes are final', () => {
  const ps = players();
  ps[3].left = true;
  const v = view({ players: ps });
  assert.deepEqual(voteTargets(v, 'u0').map((p) => p.userId), ['u1', 'u2', 'u4']);
  assert.equal(canVote(v, 'u0'), true);
  assert.equal(canVote(view({ players: ps, myVote: 'u2' }), 'u0'), false);
  assert.equal(canVote(view({ players: ps, phase: 'DISCUSS' }), 'u0'), false);
  assert.equal(canVote(v, 'u3'), false, 'a player who left cannot vote');
  assert.equal(canVote(v, 'stranger'), false);
});

test('vote progress counts only connected players', () => {
  const ps = players();
  ps[4].connected = false;
  assert.deepEqual(voteProgress(view({ players: ps, votedUserIds: ['u0', 'u4'] })), { voted: 1, needed: 4 });
});

test('clue board: one row per player in seat order, skipped turns are null, missing ones are null too', () => {
  const v = view({
    clues: [
      { round: 1, userId: 'u1', word: 'ship' },
      { round: 1, userId: 'u0', word: null },
      { round: 2, userId: 'u1', word: 'ice' }
    ]
  });
  const rows = clueRows(v);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { userId: 'u0', name: 'P0', words: [null, null] });
  assert.deepEqual(rows[1].words, ['ship', 'ice']);
  assert.equal(clueDone(v.clues, 'u0', 1), true, 'a skipped turn still counts as done');
  assert.equal(clueDone(v.clues, 'u0', 2), false);
});

test('leaderboard sorts by score and shares ranks', () => {
  const rows = leaderboard({ players: players(4), scores: { u0: 3, u1: 5, u2: 3, u3: 0 } });
  assert.deepEqual(rows.map((r) => [r.userId, r.rank]), [['u1', 1], ['u0', 2], ['u2', 2], ['u3', 4]]);
});

test('result headline and points depend on who is looking', () => {
  const result = {
    round: 1, category: 'Foods', word: 'Pizza', imposterId: 'u1', accusedUserId: 'u1', tie: false, votes: {}, tally: {},
    guess: 'Burger', guessCorrect: false, winner: 'crew' as const, points: { u0: 2, u2: 1 }, reason: 'caught'
  };
  const v = view({ phase: 'RESULT', result });
  assert.equal(resultHeadline(v, 'u0'), 'The crew wins the round');
  assert.equal(resultHeadline(v, 'u1'), 'You were caught');
  assert.equal(resultHeadline(v, 'x', true), 'The crew wins the round');
  const bluff = view({ phase: 'RESULT', result: { ...result, winner: 'imposter' } });
  assert.equal(resultHeadline(bluff, 'u1'), 'You fooled everyone');
  assert.equal(resultHeadline(bluff, 'u0'), 'P1 fooled the crew');
  assert.equal(resultHeadline(view({ phase: 'RESULT', result: { ...result, voided: true, winner: 'none' } }), 'u0'), 'Round cancelled');
  assert.equal(resultHeadline(view(), 'u0'), '');
  assert.equal(myPoints(v, 'u0'), 2);
  assert.equal(myPoints(v, 'u1'), 0);
  assert.equal(myPoints(view(), 'u1'), 0);
});

test('error texts are friendly and keep the server message otherwise', () => {
  assert.match(imposterErrorText('UPGRADE_REQUIRED'), /Watch\+/);
  assert.equal(imposterErrorText('NOT_YOUR_TURN'), 'It is not your turn.');
  assert.equal(imposterErrorText('INVALID_INPUT', 'That clue gives the secret word away.'), 'That clue gives the secret word away.');
  assert.match(imposterErrorText(undefined), /Try again/);
});

test('clue draft check mirrors the one-word rule', () => {
  assert.equal(clueDraftProblem('ship'), null);
  assert.equal(clueDraftProblem('  '), 'Type one word');
  assert.equal(clueDraftProblem('two words'), 'One word only');
  assert.equal(clueDraftProblem('x'.repeat(25)), 'Max 24 characters');
});

test('routing knows Imposter (alias, room-code prefix, path, title)', () => {
  assert.equal(canonicalGameId('Imposter'), 'imposter');
  assert.equal(gameIdFromRoomCode('IMPOSTER-AB12CD34'), 'imposter');
  assert.equal(gameRoutePath('imposter', 'IMPOSTER-AB12'), '/games/imposter?room=IMPOSTER-AB12');
  assert.equal(gameRoutePath(undefined, 'IMPOSTER-AB12'), '/games/imposter?room=IMPOSTER-AB12');
  assert.equal(gameTitleFor('imposter'), 'Imposter');
  assert.equal(canonicalGameId('impostor'), null);
});

test('a refused host (UPGRADE_REQUIRED) is a terminal connection error, not a reconnect loop', () => {
  assert.equal(isTerminalErrorCode('UPGRADE_REQUIRED'), true);
  assert.deepEqual(decideOnClose({ code: 4402, reason: 'UPGRADE_REQUIRED' }, null, 0), { action: 'stop', reason: 'UPGRADE_REQUIRED' });
  assert.deepEqual(decideOnClose({}, 'UPGRADE_REQUIRED', 0), { action: 'stop', reason: 'UPGRADE_REQUIRED' });
  assert.equal(mapGameError({ code: 'WRONG_PHASE' }).message, 'That is not possible in this part of the game.');
});
