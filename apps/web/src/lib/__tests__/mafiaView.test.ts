import test from 'node:test';
import assert from 'node:assert/strict';
import type { MafiaGameView, MafiaMe, MafiaPlayer } from '@synccinema/common';
import {
  canHostMafia, startCheck, phaseTitle, nightTargets, nightPickLocked, voteTargets, canVote, voteProgress, votesNeeded,
  chatTabs, defaultChatTab, channelMessages, chatLockedReason, nightQuiet, mafiaErrorText, timelineByRound, winnerHeadline, iWon, roleBadgeClass, playerName
} from '../mafiaView';

const P = (id: string, alive = true, extra: Partial<MafiaPlayer> = {}): MafiaPlayer => ({ userId: id, displayName: id.toUpperCase(), seat: Number(id.slice(1)), connected: true, left: false, alive, role: null, ...extra });
const players = ['p0', 'p1', 'p2', 'p3', 'p4'].map((id) => P(id));
const me = (over: Partial<MafiaMe>): MafiaMe => ({ role: 'villager', alive: true, teammates: [], nightAction: null, nightChoice: null, teamChoices: {}, lastSavedUserId: null, investigations: [], ...over });
const view = (over: Partial<MafiaGameView> = {}): MafiaGameView => ({
  game: 'mafia-night', phase: 'NIGHT', round: 1, players, phaseEndsAt: null, phaseDurationMs: 0, serverNow: 0, me: me({}), readyToVote: [], votedUserIds: [], myVote: null,
  dawnDeathUserId: null, voteResult: null, voteHistory: [], log: [], winner: null, statusMessage: '', ...over
});

test('hosting needs Watch+ or Creator; the start rule counts connected players', () => {
  assert.equal(canHostMafia('free'), false);
  assert.equal(canHostMafia('plus'), true);
  assert.equal(canHostMafia('creator'), true);
  assert.equal(canHostMafia(undefined), false);
  assert.equal(startCheck(false, 9).ok, false);
  assert.equal(startCheck(true, 4).ok, false);
  assert.match(startCheck(true, 4).reason, /Need 1 more player/);
  assert.equal(startCheck(true, 5).ok, true);
  assert.equal(startCheck(true, 4, 4).ok, true);
});

test('phase titles and role badges', () => {
  assert.equal(phaseTitle('NIGHT'), 'Night');
  assert.equal(phaseTitle('nope'), 'Mafia Night');
  assert.match(roleBadgeClass('mafia'), /red-700/);
  assert.match(roleBadgeClass('villager'), /emerald-700/);
  assert.match(roleBadgeClass('doctor'), /blue-700/);
  assert.match(roleBadgeClass('detective'), /amber-700/);
  assert.equal(playerName(players, 'p1'), 'P1');
  assert.equal(playerName(players, 'skip'), 'Skip');
});

test('night targets show only what each role may do', () => {
  const mafia = view({ me: me({ role: 'mafia', nightAction: 'kill', teammates: ['p1'] }) });
  assert.deepEqual(nightTargets(mafia, 'p0').map((p) => p.userId), ['p2', 'p3', 'p4']);
  const doctor = view({ me: me({ role: 'doctor', nightAction: 'save', lastSavedUserId: 'p3' }) });
  assert.deepEqual(nightTargets(doctor, 'p1').map((p) => p.userId), ['p0', 'p1', 'p2', 'p4'], 'self allowed, last saved not');
  const det = view({ me: me({ role: 'detective', nightAction: 'investigate' }) });
  assert.deepEqual(nightTargets(det, 'p2').map((p) => p.userId), ['p0', 'p1', 'p3', 'p4']);
  assert.deepEqual(nightTargets(view(), 'p4'), [], 'villagers have no action');
  assert.deepEqual(nightTargets(view({ me: null }), 'x'), [], 'spectators have no action');
  assert.equal(nightPickLocked(view({ me: me({ nightAction: 'save', nightChoice: 'p2' }) })), true);
  assert.equal(nightPickLocked(view({ me: me({ nightAction: 'kill', nightChoice: 'p2' }) })), false);
});

test('vote helpers: living others only, one vote, progress counts connected living players', () => {
  const v = view({ phase: 'VOTE', players: [...players.slice(0, 4), P('p4', false)], votedUserIds: ['p0'] });
  assert.deepEqual(voteTargets(v, 'p0').map((p) => p.userId), ['p1', 'p2', 'p3']);
  assert.equal(canVote(v), true);
  assert.equal(canVote({ ...v, myVote: 'skip' }), false);
  assert.equal(canVote({ ...v, me: me({ alive: false }) }), false);
  assert.equal(canVote({ ...v, phase: 'DAY' }), false);
  assert.deepEqual(voteProgress(v), { voted: 1, needed: 4 });
  assert.deepEqual([4, 5, 6, 7].map(votesNeeded), [3, 3, 4, 4]);
});

test('chat tabs follow the channel rules', () => {
  const town = chatTabs(view({ phase: 'DAY' }), false);
  assert.deepEqual(town.map((t) => [t.id, t.writable]), [['town', true]]);
  assert.equal(chatTabs(view({ phase: 'NIGHT' }), false)[0].writable, false);
  const mafia = chatTabs(view({ phase: 'NIGHT', me: me({ role: 'mafia' }) }), false);
  assert.deepEqual(mafia.map((t) => [t.id, t.writable]), [['town', false], ['mafia', true]]);
  assert.equal(defaultChatTab(mafia), 'mafia');
  assert.equal(chatTabs(view({ phase: 'DAY', me: me({ role: 'mafia' }) }), false)[1].writable, false, 'the den is closed by day');
  const dead = chatTabs(view({ phase: 'DAY', me: me({ alive: false }) }), false);
  assert.deepEqual(dead.map((t) => [t.id, t.writable]), [['town', false], ['dead', true]]);
  assert.equal(defaultChatTab(dead), 'dead');
  const spec = chatTabs(view({ phase: 'DAY', me: null }), true);
  assert.deepEqual(spec.map((t) => [t.id, t.writable]), [['town', false]]);
  assert.equal(chatTabs(view({ phase: 'FINISHED' }), false).length, 1);
  assert.equal(chatTabs(view({ phase: 'FINISHED' }), false)[0].writable, true);
  assert.equal(defaultChatTab(town), 'town');
  assert.match(chatLockedReason(view({ phase: 'NIGHT' }), { id: 'town', label: 'Town', writable: false }, false), /asleep/);
  assert.equal(chatLockedReason(view(), { id: 'town', label: 'Town', writable: true }, false), '');
  assert.match(chatLockedReason(view(), { id: 'town', label: 'Town', writable: false }, true), /watch/i);
});

test('messages are split by channel (no channel means the town)', () => {
  const msgs = [{ id: 1, channel: 'mafia' as const }, { id: 2 }, { id: 3, channel: 'town' as const }, { id: 4, channel: 'dead' as const }];
  assert.deepEqual(channelMessages(msgs, 'town').map((m) => m.id), [2, 3]);
  assert.deepEqual(channelMessages(msgs, 'mafia').map((m) => m.id), [1]);
  assert.deepEqual(channelMessages(msgs, 'dead').map((m) => m.id), [4]);
});

test('the mic is quieted during the night only', () => {
  assert.equal(nightQuiet('NIGHT'), true);
  for (const p of ['DAY', 'VOTE', 'DAWN', 'ROLE_REVEAL', 'FINISHED', undefined]) assert.equal(nightQuiet(p), false);
});

test('error text, timeline and winner headline', () => {
  assert.equal(mafiaErrorText('RATE_LIMITED'), 'Slow down a little.');
  assert.equal(mafiaErrorText('CHAT_LOCKED', 'Chat opens at dawn'), 'Chat opens at dawn');
  assert.equal(mafiaErrorText('X', 'boom'), 'boom');
  assert.equal(mafiaErrorText(undefined), 'That did not work. Try again.');
  const log = [
    { round: 2, kind: 'elimination' as const, userId: 'p1', role: 'villager' as const, text: 'b' },
    { round: 1, kind: 'night_death' as const, userId: 'p2', role: null, text: 'a' },
    { round: 1, kind: 'elimination' as const, userId: 'p3', role: null, text: 'c' }
  ];
  assert.deepEqual(timelineByRound(log).map((g) => [g.round, g.entries.length]), [[1, 2], [2, 1]]);
  assert.equal(winnerHeadline(view({ winner: 'town', me: me({ role: 'doctor' }) })), 'The town wins. You won');
  assert.equal(winnerHeadline(view({ winner: 'town', me: me({ role: 'mafia' }) })), 'The town wins. You lost');
  assert.equal(winnerHeadline(view({ winner: 'mafia', me: null }), true), 'The mafia win');
  assert.equal(winnerHeadline(view({ winner: 'none' })), 'Game ended');
  assert.equal(iWon(view({ winner: 'mafia', me: me({ role: 'mafia' }) })), true);
  assert.equal(iWon(view({ winner: 'town', me: me({ role: 'mafia' }) })), false);
  assert.equal(iWon(view({ winner: null })), false);
});
