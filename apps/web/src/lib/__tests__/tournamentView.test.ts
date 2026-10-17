import test from 'node:test';
import assert from 'node:assert/strict';
import type { TournamentGameView, TournamentMatch } from '@synccinema/common';
import {
  canHostTournament, startCheck, lobbyPlayers, bracketPreview, thirdPlaceAllowed, clockOffsetMs, secondsUntil, clockText, roundColumns,
  thirdPlaceMatch, slotLabel, matchTitle, matchChip, matchScore, reasonText, liveMatches, advanceState, progressLabel, podium, ordinal,
  matchRoomPath, tournamentErrorText, isMyMatch, gameName
} from '../tournamentView';

const T0 = 1_700_000_000_000;
const match = (over: Partial<TournamentMatch> = {}): TournamentMatch => ({
  id: 'R1M1', kind: 'MAIN', round: 1, index: 0, roundName: 'Semi-finals', a: 'u1', b: 'u4', seedA: 1, seedB: 4,
  srcA: { kind: 'seed', seed: 1 }, srcB: { kind: 'seed', seed: 4 }, status: 'PENDING_PLAYERS', bye: false, bestOf: 1, winsA: 0, winsB: 0, draws: 0,
  winnerUserId: null, loserUserId: null, reason: null, gameNo: 1, roomId: 'r1', roomCode: 'TIC-1', joined: [], createdAt: T0, joinDeadline: T0 + 120000,
  liveAt: null, doneAt: null, doubleNoShowAt: null, games: [], ...over
});
const view = (matches: TournamentMatch[], over: Partial<TournamentGameView> = {}): TournamentGameView => ({
  game: 'tournament', phase: 'RUNNING', host: { userId: 'h', displayName: 'Host', connected: true, left: false },
  config: { game: 'tic-tac-toe', thirdPlace: false, finalBestOf: 1 }, seedOrder: [],
  players: ['u1', 'u2', 'u3', 'u4'].map((id, i) => ({ userId: id, displayName: id.toUpperCase(), seat: i + 1, seed: i + 1, connected: true, left: false, eliminated: false })),
  matches, rounds: 2, bracketSize: 4, log: [], standings: null, minPlayers: 4, maxPlayers: 32, startedAt: T0, endedAt: null, serverNow: T0, me: null, statusMessage: '', ...over
});

test('only the Creator Pass organises', () => {
  assert.equal(canHostTournament('creator'), true);
  for (const t of ['free', 'plus', undefined, 'admin']) assert.equal(canHostTournament(t), false);
});

test('start check: organiser, minimum, connected players', () => {
  assert.equal(startCheck(false, 8, 8, 4).ok, false);
  assert.match(startCheck(true, 3, 3, 4).reason, /1 more player/);
  assert.match(startCheck(true, 4, 3, 4).reason, /not connected/);
  assert.equal(startCheck(true, 4, 4, 4).ok, true);
  assert.equal(startCheck(true, 2, 2, 2).ok, true);
});

test('lobby order follows the shuffle, skips the organiser and leavers', () => {
  const players = [
    { userId: 'h', displayName: 'H', seat: 0 }, { userId: 'a', displayName: 'A', seat: 1 }, { userId: 'b', displayName: 'B', seat: 2 },
    { userId: 'c', displayName: 'C', seat: 3, status: 'LEFT' }, { userId: 'd', displayName: 'D', seat: 4 }
  ];
  assert.deepEqual(lobbyPlayers(players, 'h', []).map((p) => [p.userId, p.seed]), [['a', 1], ['b', 2], ['d', 3]]);
  assert.deepEqual(lobbyPlayers(players, 'h', ['d', 'a']).map((p) => p.userId), ['d', 'a', 'b']);
});

test('bracket preview and third place', () => {
  assert.deepEqual(bracketPreview(5), { rounds: 3, byes: 3, size: 8 });
  assert.deepEqual(bracketPreview(8), { rounds: 3, byes: 0, size: 8 });
  assert.deepEqual(bracketPreview(1), { rounds: 0, byes: 0, size: 0 });
  assert.equal(thirdPlaceAllowed(3), false);
  assert.equal(thirdPlaceAllowed(4), true);
});

test('clock helpers', () => {
  assert.equal(clockOffsetMs(T0 + 500, T0), 500);
  assert.equal(clockOffsetMs(undefined, T0), 0);
  assert.equal(secondsUntil(T0 + 120000, 0, T0), 120);
  assert.equal(secondsUntil(T0 + 120000, 5000, T0), 115);
  assert.equal(secondsUntil(T0 - 1, 0, T0), 0);
  assert.equal(secondsUntil(null, 0, T0), 0);
  assert.equal(clockText(125), '2:05');
  assert.equal(clockText(-4), '0:00');
});

test('bracket columns, third place, slot labels and titles', () => {
  const r1 = match();
  const r2 = match({ id: 'R2M1', round: 2, index: 0, roundName: 'Final', a: null, b: null, srcA: { kind: 'winner', matchId: 'R1M1' }, srcB: { kind: 'winner', matchId: 'R1M2' }, status: 'SCHEDULED' });
  const r1b = match({ id: 'R1M2', index: 1, a: 'u2', b: 'u3' });
  const third = match({ id: 'THIRD', kind: 'THIRD', round: 2, roundName: 'Third place', a: null, b: null, srcA: { kind: 'loser', matchId: 'R1M1' }, srcB: { kind: 'loser', matchId: 'R1M2' }, status: 'SCHEDULED' });
  const v = view([r1, r1b, r2, third]);
  assert.deepEqual(roundColumns(v).map((c) => [c.name, c.matches.length]), [['Semi-finals', 2], ['Final', 1]]);
  assert.equal(thirdPlaceMatch(v)?.id, 'THIRD');
  assert.equal(slotLabel(v, r2, 'a').text, 'Winner of Semi-final 1');
  assert.equal(slotLabel(v, third, 'b').text, 'Loser of Semi-final 2');
  assert.equal(slotLabel(v, r1, 'a').text, 'U1');
  assert.equal(matchTitle(v, 'R2M1'), 'the Final');
  assert.equal(slotLabel(v, match({ a: null, srcA: { kind: 'bye' } }), 'a').text, 'Bye');
});

test('chips, scores, reasons', () => {
  assert.equal(matchChip(match()).label, 'Waiting for players');
  assert.equal(matchChip(match({ status: 'LIVE' })).tone, 'live');
  assert.equal(matchChip(match({ doubleNoShowAt: T0 })).tone, 'warn');
  assert.equal(matchChip(match({ status: 'DONE', bye: true })).label, 'Bye');
  assert.equal(matchChip(match({ status: 'SCHEDULED' })).tone, 'idle');
  assert.equal(matchScore(match()), null);
  assert.deepEqual(matchScore(match({ status: 'DONE', winsA: 2, winsB: 1 })), { a: 2, b: 1 });
  assert.equal(matchScore(match({ bye: true, status: 'DONE' })), null);
  assert.equal(reasonText('no_show'), 'Opponent did not show up');
  assert.equal(reasonText('played'), '');
  assert.equal(reasonText(null), '');
});

test('live matches list and my match', () => {
  const live = match({ id: 'R1M2', status: 'LIVE', roomCode: 'TIC-2' });
  const pending = match();
  const done = match({ id: 'X', status: 'DONE' });
  assert.deepEqual(liveMatches(view([pending, done, live])).map((m) => m.id), ['R1M2', 'R1M1']);
  assert.equal(isMyMatch(pending, 'u1'), true);
  assert.equal(isMyMatch(pending, 'u2'), false);
  assert.equal(isMyMatch(pending, null), false);
});

test('organiser advance rules mirror the server', () => {
  assert.equal(advanceState(match(), T0 + 60_000).allowed, false);
  assert.equal(advanceState(match(), T0 + 600_000).allowed, true);
  assert.equal(advanceState(match({ doubleNoShowAt: T0 }), T0 + 1000).allowed, true);
  assert.equal(advanceState(match({ status: 'DONE' }), T0).allowed, false);
  assert.equal(advanceState(match({ status: 'SCHEDULED', a: null }), T0).allowed, false);
});

test('progress label, podium, ordinal, paths, errors', () => {
  const v = view([match({ status: 'DONE' }), match({ id: 'R1M2', index: 1 })]);
  assert.match(progressLabel(v), /Semi-finals · 1\/2 matches done/);
  assert.equal(progressLabel({ ...v, phase: 'COMPLETE' }), 'Final results');
  const rows = [1, 2, 3, 3].map((rank, i) => ({ rank, userId: `u${i}`, displayName: `U${i}`, seed: i + 1, label: '', matchWins: 0, matchLosses: 0, left: false }));
  assert.deepEqual(podium({ championUserId: 'u0', runnerUpUserId: 'u1', thirdPlaceUserId: null, rows }).map((r) => r.rank), [2, 1, 3]);
  assert.deepEqual(podium(null), []);
  assert.equal(ordinal(1), '1st'); assert.equal(ordinal(12), '12th'); assert.equal(ordinal(23), '23rd');
  assert.equal(matchRoomPath('/games/chess', 'CHESS-AB'), '/games/chess?room=CHESS-AB');
  assert.equal(matchRoomPath('/games/chess', 'CHESS-AB', true), '/games/chess?room=CHESS-AB&spectate=1');
  assert.match(tournamentErrorText('UPGRADE_REQUIRED'), /Creator Pass/);
  assert.equal(tournamentErrorText('HOST_ONLY'), 'Only the organiser can do that.');
  assert.equal(gameName('chess'), 'Chess');
  assert.equal(gameName('x'), 'the game');
});
