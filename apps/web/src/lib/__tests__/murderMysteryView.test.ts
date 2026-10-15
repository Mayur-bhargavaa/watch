import test from 'node:test';
import assert from 'node:assert/strict';
import type { MurderGameView, MurderPlayer, MurderPublicCharacter, MurderScoreRow, MurderWhisper } from '@synccinema/common';
import {
  canHostMurder, startCheck, phaseTitle, roundLabel, murderErrorText, characterName, whisperTargets, whisperCheck, whisperThread, whisperPartners,
  accuseCheck, accusableCharacters, accusationProgress, readyProgress, cluesByRound, evidenceByRound, canShareClue, sortRows, podiumOrder,
  pointsBreakdown, iWon, stepVisible, resultHeadline, podiumLabel, REVEAL_STEPS
} from '../murderMysteryView';

const P = (id: string, extra: Partial<MurderPlayer> = {}): MurderPlayer => ({ userId: id, displayName: id.toUpperCase(), seat: Number(id.slice(1)), connected: true, left: false, characterId: `c${id.slice(1)}`, ...extra });
const players = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].map((id) => P(id));
const chars: MurderPublicCharacter[] = players.map((p) => ({ id: p.characterId as string, name: `Char ${p.userId}`, bio: 'bio', userId: p.userId, withdrawn: false }));
const view = (over: Partial<MurderGameView> = {}): MurderGameView => ({
  game: 'murder-mystery', phase: 'CLUE_ROUND', round: 2, roundCount: 4, caseChoice: 'random', cases: [], case: null, players, characters: chars, clues: [], evidence: [],
  readyUserIds: [], accusedUserIds: [], phaseEndsAt: null, phaseDurationMs: 0, serverNow: 0, me: null, result: null, log: [], gamesPlayed: 0, statusMessage: '', ...over
});
const row = (id: string, total: number, rank: number, extra: Partial<MurderScoreRow> = {}): MurderScoreRow => ({
  rank, userId: id, displayName: id.toUpperCase(), characterId: `c${id.slice(1)}`, left: false, isMurderer: false, accusedCharacterId: null, accusedMotive: '', correct: false,
  correctOrder: null, base: 0, speedBonus: 0, murdererBonus: 0, sharedClues: 0, shareBonus: 0, total, ...extra
});

test('hosting needs the Creator Pass; the start rule counts connected players', () => {
  assert.equal(canHostMurder('free'), false);
  assert.equal(canHostMurder('plus'), false);
  assert.equal(canHostMurder('creator'), true);
  assert.equal(canHostMurder(undefined), false);
  assert.equal(startCheck(false, 12).ok, false);
  assert.equal(startCheck(true, 5).ok, false);
  assert.match(startCheck(true, 5).reason, /Need 1 more player/);
  assert.equal(startCheck(true, 6).ok, true);
  assert.equal(startCheck(true, 2, 2).ok, true);
});

test('phase and round labels, error texts', () => {
  assert.equal(phaseTitle('CLUE_ROUND'), 'Clue round');
  assert.equal(phaseTitle('nope'), 'Murder Mystery Night');
  assert.equal(roundLabel(view()), 'Clue round 2 of 4');
  assert.equal(roundLabel(view({ phase: 'ACCUSATION', round: 4 })), 'Accusation');
  assert.match(murderErrorText('UPGRADE_REQUIRED'), /Creator Pass/);
  assert.equal(murderErrorText('X', 'custom'), 'custom');
  assert.equal(murderErrorText('RATE_LIMITED'), 'Slow down a little.');
});

test('whispers: targets, validation, threads and partners', () => {
  const v = view({ players: [...players.slice(0, 5), P('p5', { left: true })] });
  assert.deepEqual(whisperTargets(v, 'p0').map((p) => p.userId), ['p1', 'p2', 'p3', 'p4']);
  assert.equal(whisperCheck('hi', null, 5).ok, false);
  assert.equal(whisperCheck('hi', 'p1', 0).ok, false);
  assert.equal(whisperCheck('   ', 'p1', 3).ok, false);
  assert.equal(whisperCheck('x'.repeat(141), 'p1', 3).ok, false);
  assert.equal(whisperCheck('x'.repeat(140), 'p1', 3).ok, true);
  const w = (id: string, from: string, to: string, at: number): MurderWhisper => ({ id, round: 1, fromUserId: from, toUserId: to, text: id, at });
  const list = [w('a', 'p0', 'p1', 3), w('b', 'p1', 'p0', 1), w('c', 'p2', 'p0', 5), w('d', 'p3', 'p4', 9)];
  assert.deepEqual(whisperThread(list, 'p0', 'p1').map((x) => x.id), ['b', 'a']);
  assert.deepEqual(whisperThread(list, 'p0', null), []);
  assert.deepEqual(whisperPartners(list, 'p0').map((p) => [p.userId, p.count]), [['p2', 1], ['p1', 2]]);
});

test('accusation: cannot accuse yourself, motive length, accusable list and progress', () => {
  assert.equal(accuseCheck(null, '', 'c0').ok, false);
  assert.equal(accuseCheck('c0', '', 'c0').ok, false);
  assert.equal(accuseCheck('c1', 'x'.repeat(121), 'c0').ok, false);
  assert.equal(accuseCheck('c1', 'x'.repeat(120), 'c0').ok, true);
  assert.equal(accuseCheck('c1', '', 'c0').ok, true);
  assert.deepEqual(accusableCharacters(view(), 'c0').map((c) => c.id), ['c1', 'c2', 'c3', 'c4', 'c5']);
  assert.deepEqual(accusationProgress(view({ accusedUserIds: ['p0', 'p3'] })), { submitted: 2, needed: 6 });
  const left = view({ players: [...players.slice(0, 5), P('p5', { left: true })], accusedUserIds: ['p5', 'p1'] });
  assert.deepEqual(accusationProgress(left), { submitted: 1, needed: 5 });
  assert.deepEqual(readyProgress(view({ readyUserIds: ['p0'], players: [...players.slice(0, 5), P('p5', { connected: false })] })), { ready: 1, needed: 5 });
});

test('clues: grouping and the share rule', () => {
  const clues = [{ id: 'a', round: 1, text: 'a', shared: false }, { id: 'b', round: 2, text: 'b', shared: false }, { id: 'c', round: 2, text: 'c', shared: true }];
  assert.deepEqual(cluesByRound(clues).map((g) => [g.round, g.clues.length]), [[2, 2], [1, 1]]);
  const ev = [{ clueId: 'x', round: 2, text: '', sharedByUserId: 'p1', characterId: 'c1' }, { clueId: 'y', round: 1, text: '', sharedByUserId: 'p2', characterId: 'c2' }];
  assert.deepEqual(evidenceByRound(ev).map((g) => g.round), [1, 2]);
  const me: any = { sharesLeft: 2 };
  assert.equal(canShareClue({ phase: 'CLUE_ROUND', me }, { shared: false }), true);
  assert.equal(canShareClue({ phase: 'CLUE_ROUND', me }, { shared: true }), false);
  assert.equal(canShareClue({ phase: 'ACCUSATION', me }, { shared: false }), false);
  assert.equal(canShareClue({ phase: 'CLUE_ROUND', me: { sharesLeft: 0 } as any }, { shared: false }), false);
  assert.equal(canShareClue({ phase: 'CLUE_ROUND', me: null }, { shared: false }), false);
});

test('results: ranking, podium order, breakdown, winner and headlines', () => {
  const rows = [row('p0', 50, 3), row('p1', 175, 1, { correct: true, base: 100, speedBonus: 25, shareBonus: 50 }), row('p2', 100, 2, { correct: true, base: 100 }), row('p3', 0, 4)];
  assert.deepEqual(sortRows(rows).map((r) => r.userId), ['p1', 'p2', 'p0', 'p3']);
  assert.deepEqual(podiumOrder(rows).map((r) => r.userId), ['p2', 'p1', 'p0']);
  assert.deepEqual(podiumOrder(rows.slice(0, 2)).map((r) => r.userId), ['p1', 'p0']);
  assert.equal(pointsBreakdown(rows[1]), 'Correct 100 + Speed 25 + Clues 50');
  assert.equal(pointsBreakdown(rows[3]), 'No points');
  const result: any = { murdererCharacterId: 'c4', winnerUserId: 'p1', rows: [...rows, row('p4', 150, 1, { isMurderer: true, murdererBonus: 150 })] };
  const v = view({ result });
  assert.equal(iWon(v, 'p1'), true);
  assert.equal(iWon(v, 'p0'), false);
  assert.equal(iWon(view(), 'p1'), false);
  assert.equal(characterName(v, 'c4'), 'Char p4');
  assert.equal(characterName(v, 'zzz'), 'Unknown');
  assert.equal(resultHeadline(v, 'p4', false), 'You got away with it');
  assert.equal(resultHeadline(v, 'p1', false), 'You solved it: Char p4');
  assert.equal(resultHeadline(v, 'p0', false), 'It was Char p4');
  assert.equal(resultHeadline(v, 'px', true), 'Char p4 did it');
  assert.equal(podiumLabel(1), '1st');
  assert.equal(podiumLabel(4), '4th');
});

test('reveal steps are cumulative', () => {
  assert.equal(REVEAL_STEPS[0], 'murderer');
  assert.equal(stepVisible(0, 'murderer'), true);
  assert.equal(stepVisible(0, 'motive'), false);
  assert.equal(stepVisible(2, 'method'), true);
  assert.equal(stepVisible(2, 'secrets'), false);
  assert.equal(stepVisible(4, 'accusations'), true);
});
