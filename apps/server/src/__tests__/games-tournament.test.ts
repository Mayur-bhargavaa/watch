import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import type { TournamentMatch, TournamentServerState } from '@synccinema/common';
import {
  TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC,
  TOURNAMENT_JOIN_WINDOW_SEC,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_STUCK_SEC,
  orderLobbyPlayers,
  tournamentRoundName,
  tournamentThirdPlaceAvailable
} from '@synccinema/common';
import { TournamentEngine, bracketOrder, bracketSizeFor, shuffled, tournamentMinPlayers, tournamentRateAllowed } from '../games/TournamentEngine.js';
import { tournamentAdvanceSchema, tournamentConfigSchema, tournamentKickSchema, parseTournamentPayload } from '../games/tournamentSchemas.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { GAME_DEFINITIONS, parseGameType } from '../games/GameDefinitions.js';

const T0 = 1_700_000_000_000;
const E = TournamentEngine;
const HOST = 'host';
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i + 1}`, displayName: `Player${i + 1}`, seat: i + 1 }));

/** A running tournament with n players seeded in join order (u1 = seed 1). */
function start(n: number, config: { thirdPlace?: boolean; finalBestOf?: 1 | 3; game?: any } = {}, order?: string[]): TournamentServerState {
  const lobby = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  if (Object.keys(config).length) E.setConfig(lobby, HOST, config);
  if (order) lobby.seedOrder = order;
  // the engine tests run with the real minimum (4) unless n is smaller: allow 2..3 players through the testing switch
  const prev = process.env.TOURNAMENT_TEST_MIN_PLAYERS;
  if (n < 4) process.env.TOURNAMENT_TEST_MIN_PLAYERS = String(n);
  try {
    return E.createInitialState(lobby, seats(n), T0);
  } finally {
    process.env.TOURNAMENT_TEST_MIN_PLAYERS = prev ?? '';
  }
}

let roomSeq = 0;
/** Gives every match that needs one a game room; returns the matches. */
function attachAll(s: TournamentServerState, now: number): TournamentMatch[] {
  const need = E.matchesNeedingRoom(s);
  for (const m of need) {
    roomSeq += 1;
    E.attachRoom(s, m.id, { roomId: `room${roomSeq}`, roomCode: `TIC-${roomSeq}` }, now);
  }
  return need;
}
const active = (s: TournamentServerState) => s.matches.filter((m) => m.status === 'PENDING_PLAYERS' || m.status === 'LIVE');
/** The current room of a match (a function, so TypeScript does not narrow the field after an assertion). */
const rid = (m: TournamentMatch): string => m.roomId as string;
const seedOf = (s: TournamentServerState, id: string | null) => s.players.find((p) => p.userId === id)?.seed ?? null;

/** Plays the whole tournament: every game is won by the better seed (or by `pick`). */
function playOut(s: TournamentServerState, now = T0 + 1000, pick?: (m: TournamentMatch) => string | null): number {
  let guard = 0;
  while (s.phase === 'RUNNING' && guard++ < 500) {
    attachAll(s, now);
    const live = active(s);
    assert.ok(live.length > 0, 'a running tournament always has an open match');
    for (const m of live) {
      const winner = pick ? pick(m) : E.higherSeed(m);
      E.markLive(s, rid(m), now);
      E.reportGame(s, rid(m), winner, now);
    }
    now += 1000;
  }
  return now;
}

// ---------------------------------------------------------------------
// Bracket generation
// ---------------------------------------------------------------------

test('TOURNAMENT bracket: seed positions follow the standard order and sizes are powers of two', () => {
  assert.deepEqual(bracketOrder(2), [1, 2]);
  assert.deepEqual(bracketOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(bracketOrder(16).slice(0, 4), [1, 16, 8, 9]);
  assert.equal(bracketSizeFor(2), 2);
  assert.equal(bracketSizeFor(3), 4);
  assert.equal(bracketSizeFor(5), 8);
  assert.equal(bracketSizeFor(17), 32);
  assert.equal(bracketSizeFor(32), 32);
  for (const size of [2, 4, 8, 16, 32]) {
    const o = bracketOrder(size);
    assert.equal(new Set(o).size, size, 'every seed appears once');
    // the pairs of every round add up to the same number (1 + size, then the sums of the next rounds)
    for (let i = 0; i < size; i += 2) assert.equal(o[i] + o[i + 1], size + 1);
  }
});

test('TOURNAMENT bracket: every player count from 2 to 32 (byes, rounds, no player twice, third place)', () => {
  for (let n = 2; n <= 32; n++) {
    const s = start(n, { thirdPlace: true });
    const size = bracketSizeFor(n);
    const rounds = Math.log2(size);
    assert.equal(s.rounds, rounds, `n=${n} rounds`);
    assert.equal(s.bracketSize, size);
    const main = s.matches.filter((m) => m.kind === 'MAIN');
    assert.equal(main.length, size - 1, `n=${n} main matches`);
    const third = s.matches.filter((m) => m.kind === 'THIRD');
    assert.equal(third.length, tournamentThirdPlaceAvailable(n) ? 1 : 0, `n=${n} third place`);
    assert.equal(s.config.thirdPlace, tournamentThirdPlaceAvailable(n));
    for (let r = 1; r <= rounds; r++) {
      assert.equal(main.filter((m) => m.round === r).length, size / 2 ** r, `n=${n} round ${r}`);
      const names = new Set(main.filter((m) => m.round === r).map((m) => m.roundName));
      assert.deepEqual([...names], [tournamentRoundName(r, rounds)]);
    }
    // seeds: every player is placed once in round 1, byes are exactly size - n and belong to the top seeds
    const r1 = main.filter((m) => m.round === 1);
    const placed = r1.flatMap((m) => [m.a, m.b]).filter(Boolean) as string[];
    assert.equal(placed.length, n);
    assert.equal(new Set(placed).size, n, `n=${n}: no player twice in round 1`);
    const byes = r1.filter((m) => m.bye);
    assert.equal(byes.length, size - n, `n=${n} byes`);
    const byeSeeds = byes.map((m) => (m.a ? m.seedA : m.seedB) as number).sort((x, y) => x - y);
    assert.deepEqual(byeSeeds, Array.from({ length: size - n }, (_, i) => i + 1), `n=${n}: the top seeds get the byes`);
    for (const m of byes) {
      assert.equal(m.status, 'DONE');
      assert.equal(m.reason, 'bye');
      assert.equal(m.loserUserId, null);
      assert.ok(m.winnerUserId);
    }
    // a bye winner is already in round 2
    for (const m of byes) {
      const next = main.find((x) => x.round === 2 && x.index === Math.floor(m.index / 2));
      if (next) assert.ok(next.a === m.winnerUserId || next.b === m.winnerUserId, `n=${n}: bye winner advanced`);
    }
    // no player twice in any round
    for (let r = 1; r <= rounds; r++) {
      const ids = main.filter((m) => m.round === r).flatMap((m) => [m.a, m.b]).filter(Boolean) as string[];
      assert.equal(new Set(ids).size, ids.length, `n=${n} round ${r}: no player twice`);
    }
    // the matches that are ready are the ones with two players
    const ready = E.matchesNeedingRoom(s);
    assert.ok(ready.every((m) => m.a && m.b && m.status === 'PENDING_PLAYERS'));
    assert.ok(ready.length >= 1, `n=${n} has something to play`);
    assert.equal(s.phase, 'RUNNING');
  }
});

test('TOURNAMENT bracket: round names', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => tournamentRoundName(r, 5)), ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final']);
  assert.deepEqual([1, 2, 3].map((r) => tournamentRoundName(r, 3)), ['Quarter-finals', 'Semi-finals', 'Final']);
  assert.equal(tournamentRoundName(1, 1), 'Final');
  assert.equal(start(32).matches[0].roundName, 'Round of 32');
  assert.equal(start(16).matches[0].roundName, 'Round of 16');
  assert.equal(start(8).matches[0].roundName, 'Quarter-finals');
  assert.equal(start(4).matches[0].roundName, 'Semi-finals');
  assert.equal(start(2).matches[0].roundName, 'Final');
});

test('TOURNAMENT bracket: seeding follows join order, or the host order', () => {
  const s = start(4);
  const m1 = s.matches.find((m) => m.id === 'R1M1')!;
  const m2 = s.matches.find((m) => m.id === 'R1M2')!;
  assert.deepEqual([m1.a, m1.b], ['u1', 'u4']);
  assert.deepEqual([m2.a, m2.b], ['u2', 'u3']);
  assert.deepEqual(s.players.map((p) => p.seed), [1, 2, 3, 4]);
  const shuffledOrder = start(4, {}, ['u3', 'u1', 'u4', 'u2']);
  assert.equal(shuffledOrder.players.find((p) => p.userId === 'u3')?.seed, 1);
  assert.equal(shuffledOrder.players.find((p) => p.userId === 'u2')?.seed, 4);
  // a new joiner who is not in the shuffled order goes last, a leaver is dropped
  const ordered = orderLobbyPlayers(seats(4), ['u3', 'ghost', 'u1']);
  assert.deepEqual(ordered.map((x) => x.userId), ['u3', 'u1', 'u2', 'u4']);
});

test('TOURNAMENT bracket: a top-seed-always-wins run gives champion 1, runner-up 2 and the right matches for every n', () => {
  for (let n = 2; n <= 32; n++) {
    const s = start(n, { thirdPlace: true });
    playOut(s);
    assert.equal(s.phase, 'COMPLETE', `n=${n}`);
    assert.equal(seedOf(s, s.championUserId), 1, `n=${n} champion`);
    assert.equal(seedOf(s, s.runnerUpUserId), 2, `n=${n} runner-up`);
    assert.ok(s.matches.every((m) => m.status === 'DONE'), `n=${n} every match decided`);
    if (tournamentThirdPlaceAvailable(n)) assert.equal(seedOf(s, s.thirdPlaceUserId), 3, `n=${n} third place`);
    const st = E.standings(s);
    assert.equal(st.rows.length, n);
    assert.equal(st.rows[0].rank, 1);
    assert.equal(st.rows[0].label, 'Champion');
    assert.equal(st.rows[1].label, 'Runner-up');
    assert.equal(new Set(st.rows.map((r) => r.userId)).size, n, 'one row per player');
    for (const m of s.matches) assert.equal(m.reason === 'bye' || m.reason === 'played', true);
  }
});

test('TOURNAMENT bracket: a round overlaps with the next one (a match is ready as soon as both players are known)', () => {
  const s = start(8);
  attachAll(s, T0);
  assert.equal(active(s).length, 4);
  const m = s.matches.find((x) => x.id === 'R1M1')!; // 1 v 8
  E.markLive(s, rid(m), T0);
  E.reportGame(s, rid(m), 'u1', T0);
  // the semi-final slot has one player: not ready yet, the other quarter-final is still open
  const semi = s.matches.find((x) => x.id === 'R2M1')!;
  assert.equal(semi.a, 'u1');
  assert.equal(semi.b, null);
  assert.equal(semi.status, 'SCHEDULED');
  assert.equal(E.matchesNeedingRoom(s).length, 0);
  const m2 = s.matches.find((x) => x.id === 'R1M2')!; // 4 v 5
  E.reportGame(s, rid(m2), 'u4', T0);
  assert.equal(semi.b, 'u4');
  assert.equal(semi.status, 'PENDING_PLAYERS');
  assert.deepEqual(E.matchesNeedingRoom(s).map((x) => x.id), ['R2M1'], 'round 2 starts while round 1 still has open matches');
  assert.equal(active(s).filter((x) => x.round === 1).length, 2);
});

test('TOURNAMENT bracket: third place only when switched on and only from 4 players; losing semi-finalists play it', () => {
  assert.equal(start(8).matches.some((m) => m.kind === 'THIRD'), false, 'off by default');
  assert.equal(start(3, { thirdPlace: true }).matches.some((m) => m.kind === 'THIRD'), false, 'not with 3 players');
  assert.equal(start(2, { thirdPlace: true }).matches.some((m) => m.kind === 'THIRD'), false);
  const s = start(4, { thirdPlace: true });
  const third = s.matches.find((m) => m.kind === 'THIRD')!;
  assert.equal(third.roundName, 'Third place');
  assert.equal(third.status, 'SCHEDULED');
  attachAll(s, T0);
  for (const m of active(s)) { E.markLive(s, rid(m), T0); E.reportGame(s, rid(m), E.higherSeed(m), T0); }
  // the Final and the third place match are both ready
  assert.deepEqual(new Set([third.a, third.b]), new Set(['u3', 'u4']));
  assert.equal(third.status, 'PENDING_PLAYERS');
  const final = s.matches.find((m) => m.id === 'R2M1')!;
  assert.deepEqual(new Set([final.a, final.b]), new Set(['u1', 'u2']));
  // the Final alone does not end the tournament while the third place match is open
  attachAll(s, T0 + 1);
  E.markLive(s, rid(final), T0 + 1);
  E.reportGame(s, rid(final), 'u1', T0 + 1);
  assert.equal(s.phase, 'RUNNING');
  assert.equal(s.championUserId, 'u1');
  E.markLive(s, rid(third), T0 + 1);
  E.reportGame(s, rid(third), 'u4', T0 + 2);
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(s.thirdPlaceUserId, 'u4');
  const st = E.standings(s);
  assert.deepEqual(st.rows.map((r) => r.userId), ['u1', 'u2', 'u4', 'u3']);
  assert.deepEqual(st.rows.map((r) => r.rank), [1, 2, 3, 4]);
  assert.equal(st.thirdPlaceUserId, 'u4');
});

test('TOURNAMENT standings: without a third place match both losing semi-finalists share rank 3', () => {
  const s = start(8);
  playOut(s);
  const st = E.standings(s);
  assert.deepEqual(st.rows.map((r) => r.rank), [1, 2, 3, 3, 5, 5, 5, 5]);
  assert.equal(st.thirdPlaceUserId, null);
  assert.equal(st.rows[2].label, 'Semi-finalist');
  assert.equal(st.rows[4].label, 'Out in the Quarter-finals');
  assert.equal(st.rows[0].matchWins, 3);
  assert.equal(st.rows[1].matchWins, 2);
  assert.equal(st.rows[1].matchLosses, 1);
  assert.equal(E.standings(start(5)).rows.length, 5);
});

// ---------------------------------------------------------------------
// Results: wins, draws, series
// ---------------------------------------------------------------------

test('TOURNAMENT result: the winner advances, the loser is eliminated, a stale or duplicate report changes nothing', () => {
  const s = start(4);
  attachAll(s, T0);
  const m = s.matches.find((x) => x.id === 'R1M1')!;
  const room = rid(m);
  const before = JSON.stringify(s);
  assert.deepEqual(E.reportGame(s, 'unknown-room', 'u1', T0).closeRooms, []);
  E.reportGame(s, room, 'intruder', T0); // not a player of the match
  assert.equal(JSON.stringify(s), before, 'unknown room / winner not in the match: nothing changes');
  E.markLive(s, room, T0);
  assert.equal(m.status, 'LIVE');
  E.reportGame(s, room, 'u4', T0 + 5);
  assert.equal(m.status, 'DONE');
  assert.equal(m.winnerUserId, 'u4');
  assert.equal(m.loserUserId, 'u1');
  assert.equal(m.reason, 'played');
  assert.equal(s.players.find((p) => p.userId === 'u1')?.eliminated, true);
  const after = JSON.stringify(s);
  E.reportGame(s, room, 'u1', T0 + 6); // a duplicate / late message for the same room
  E.reportGame(s, room, null, T0 + 7);
  assert.equal(JSON.stringify(s), after, 'a duplicate report changes nothing');
  const final = s.matches.find((x) => x.id === 'R2M1')!;
  assert.equal(final.a, 'u4');
});

test('TOURNAMENT result: a draw replays in a NEW room with swapped sides, twice at most, then the higher seed advances', () => {
  const s = start(2);
  const m = s.matches[0];
  assert.deepEqual(E.seatOrder(m), ['u1', 'u2'], 'the higher seed takes the first seat in game 1');
  attachAll(s, T0);
  const room1 = rid(m);
  assert.equal(m.gameNo, 1);
  E.markLive(s, room1, T0);
  E.reportGame(s, room1, null, T0 + 1); // draw 1
  assert.equal(m.status, 'PENDING_PLAYERS');
  assert.equal(m.roomId, null, 'the old room is gone, a new one is needed');
  assert.equal(m.draws, 1);
  assert.deepEqual(E.matchesNeedingRoom(s).map((x) => x.id), [m.id]);
  assert.deepEqual(E.seatOrder(m), ['u2', 'u1'], 'sides swap in game 2');
  attachAll(s, T0 + 2);
  assert.equal(m.gameNo, 2);
  assert.notEqual(m.roomId, room1);
  assert.deepEqual(m.joined, [], 'the join window starts again');
  E.markLive(s, rid(m), T0 + 2);
  E.reportGame(s, rid(m), null, T0 + 3); // draw 2
  assert.equal(m.draws, 2);
  assert.equal(m.status, 'PENDING_PLAYERS');
  assert.deepEqual(E.seatOrder(m), ['u1', 'u2']);
  attachAll(s, T0 + 4);
  assert.equal(m.gameNo, 3, 'the original game plus two extra games');
  E.markLive(s, rid(m), T0 + 4);
  E.reportGame(s, rid(m), null, T0 + 5); // draw 3: the cap is reached
  assert.equal(m.status, 'DONE');
  assert.equal(m.winnerUserId, 'u1', 'the higher seed advances');
  assert.equal(m.reason, 'draw_tiebreak');
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(m.games.length, 3);
  assert.ok(s.log.some((l) => /drawn games/.test(l.text)));
});

test('TOURNAMENT result: a win after a draw ends the match; the lower seed can win', () => {
  const s = start(2);
  const m = s.matches[0];
  attachAll(s, T0);
  E.markLive(s, rid(m), T0);
  E.reportGame(s, rid(m), null, T0);
  attachAll(s, T0 + 1);
  E.markLive(s, rid(m), T0 + 1);
  E.reportGame(s, rid(m), 'u2', T0 + 2);
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(s.championUserId, 'u2');
  assert.equal(m.reason, 'played');
});

test('TOURNAMENT result: best of 3 applies to the Final only', () => {
  const s = start(4, { finalBestOf: 3 });
  assert.deepEqual(s.matches.map((m) => m.bestOf), [1, 1, 3]);
  attachAll(s, T0);
  for (const m of active(s)) { E.markLive(s, rid(m), T0); E.reportGame(s, rid(m), E.higherSeed(m), T0); }
  const final = s.matches.find((m) => m.id === 'R2M1')!;
  attachAll(s, T0 + 1);
  E.markLive(s, rid(final), T0 + 1);
  E.reportGame(s, rid(final), 'u2', T0 + 1); // 0-1
  assert.equal(final.status, 'PENDING_PLAYERS');
  assert.equal(final.winsB, 1);
  assert.equal(s.phase, 'RUNNING');
  assert.equal(final.roomId, null);
  attachAll(s, T0 + 2);
  assert.equal(final.gameNo, 2);
  E.markLive(s, rid(final), T0 + 2);
  E.reportGame(s, rid(final), 'u1', T0 + 2); // 1-1
  assert.equal(s.phase, 'RUNNING');
  attachAll(s, T0 + 3);
  E.markLive(s, rid(final), T0 + 3);
  E.reportGame(s, rid(final), 'u2', T0 + 3); // 1-2: u2 wins the series
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(s.championUserId, 'u2');
  assert.equal(final.winsA + final.winsB, 3);
  assert.ok(s.log.some((l) => /beat .* 2-1/.test(l.text)));
});

test('TOURNAMENT result: draws in a series use the same cap and then the game lead decides', () => {
  const s = start(2, { finalBestOf: 3 });
  const m = s.matches[0];
  attachAll(s, T0);
  E.markLive(s, rid(m), T0);
  E.reportGame(s, rid(m), 'u2', T0); // u2 leads 0-1
  for (let i = 0; i < 3; i++) {
    attachAll(s, T0 + 1 + i);
    E.markLive(s, rid(m), T0 + 1 + i);
    E.reportGame(s, rid(m), null, T0 + 1 + i);
  }
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(s.championUserId, 'u2', 'the player with more game wins beats the higher seed when the draws run out');
});

// ---------------------------------------------------------------------
// No-shows
// ---------------------------------------------------------------------

test('TOURNAMENT no-show: the player who never opened the match room forfeits when the 120 s are over', () => {
  const s = start(4);
  attachAll(s, T0);
  const m = s.matches.find((x) => x.id === 'R1M1')!;
  assert.equal(m.joinDeadline, T0 + TOURNAMENT_JOIN_WINDOW_SEC * 1000);
  assert.equal(E.noteJoined(s, rid(m), 'u1'), true);
  assert.equal(E.noteJoined(s, rid(m), 'u1'), false, 'twice changes nothing');
  assert.equal(E.noteJoined(s, rid(m), 'stranger'), false);
  assert.deepEqual(E.tick(s, T0 + 119_000).closeRooms, [], 'not yet');
  assert.equal(m.status, 'PENDING_PLAYERS');
  const fx = E.tick(s, T0 + 120_000);
  assert.equal(m.status, 'DONE');
  assert.equal(m.winnerUserId, 'u1');
  assert.equal(m.reason, 'no_show');
  assert.ok(fx.closeRooms.includes(rid(m)), 'the unused room is closed');
  assert.ok(s.log.some((l) => l.kind === 'forfeit' && /did not show up/.test(l.text)));
  // the other match (nobody joined) is in its host window, not decided yet
  const other = s.matches.find((x) => x.id === 'R1M2')!;
  assert.equal(other.status, 'PENDING_PLAYERS');
  assert.equal(other.doubleNoShowAt, T0 + 120_000);
});

test('TOURNAMENT no-show: when both players stay away the host may pick, otherwise the higher seed advances', () => {
  const s = start(4);
  attachAll(s, T0);
  const m = s.matches.find((x) => x.id === 'R1M2')!; // u2 (seed 2) vs u3
  E.tick(s, T0 + 120_000);
  assert.equal(m.doubleNoShowAt, T0 + 120_000);
  assert.equal(E.noteJoined(s, rid(m), 'u3'), false, 'a late arrival after the double no-show window opened does not count');
  // the host window: the host can advance either player
  const fx = E.hostAdvance(s, HOST, m.id, 'u3', T0 + 130_000);
  assert.equal(m.winnerUserId, 'u3');
  assert.equal(m.reason, 'host_advance');
  assert.deepEqual(fx.closeRooms, [m.roomId]);
  assert.ok(s.log.some((l) => l.kind === 'host' && /nobody showed up/.test(l.text)));
  // without the host: the higher seed advances after the window
  const s2 = start(4);
  attachAll(s2, T0);
  E.tick(s2, T0 + 120_000);
  const m2 = s2.matches.find((x) => x.id === 'R1M2')!;
  E.tick(s2, T0 + 120_000 + TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC * 1000 - 1);
  assert.equal(m2.status, 'PENDING_PLAYERS');
  const fx2 = E.tick(s2, T0 + 120_000 + TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC * 1000);
  assert.equal(m2.status, 'DONE');
  assert.equal(m2.winnerUserId, 'u2');
  assert.equal(m2.reason, 'double_no_show');
  assert.ok(fx2.closeRooms.includes(rid(m2)));
  assert.equal(s2.matches.find((x) => x.id === 'R1M1')?.winnerUserId, 'u1', 'the other double no-show resolved the same way');
});

test('TOURNAMENT no-show: a live match has no join deadline; a replay room gets a fresh one', () => {
  const s = start(2);
  const m = s.matches[0];
  attachAll(s, T0);
  E.markLive(s, rid(m), T0 + 10_000);
  assert.equal(m.joinDeadline, null);
  E.tick(s, T0 + 10 * 60_000);
  assert.equal(m.status, 'LIVE', 'a running game is never a no-show');
  E.reportGame(s, rid(m), null, T0 + 11 * 60_000);
  attachAll(s, T0 + 11 * 60_000);
  assert.equal(m.joinDeadline, T0 + 11 * 60_000 + 120_000);
});

// ---------------------------------------------------------------------
// Host advance
// ---------------------------------------------------------------------

test('TOURNAMENT host advance: only the host, only for a stuck match, only a player of the match, logged publicly', () => {
  const s = start(4);
  attachAll(s, T0);
  const m = s.matches.find((x) => x.id === 'R1M1')!;
  E.markLive(s, rid(m), T0);
  const raises = (fn: () => void, code: string) => assert.throws(fn, (e: any) => e instanceof GameRuleError && e.code === code);
  raises(() => E.hostAdvance(s, 'u1', m.id, 'u1', T0 + 60 * 60_000), 'HOST_ONLY');
  raises(() => E.hostAdvance(s, HOST, m.id, 'u1', T0 + 60_000), 'ILLEGAL_MOVE'); // not stuck yet
  raises(() => E.hostAdvance(s, HOST, m.id, 'u1', T0 + TOURNAMENT_STUCK_SEC * 1000 - 1), 'ILLEGAL_MOVE');
  raises(() => E.hostAdvance(s, HOST, m.id, 'u2', T0 + TOURNAMENT_STUCK_SEC * 1000), 'INVALID_INPUT'); // u2 is not in this match
  raises(() => E.hostAdvance(s, HOST, 'NOPE', 'u1', T0 + TOURNAMENT_STUCK_SEC * 1000), 'INVALID_INPUT');
  const future = s.matches.find((x) => x.id === 'R2M1')!;
  raises(() => E.hostAdvance(s, HOST, future.id, 'u1', T0 + 60 * 60_000), 'INVALID_INPUT'); // no players yet
  assert.equal(m.status, 'LIVE');
  const fx = E.hostAdvance(s, HOST, m.id, 'u4', T0 + TOURNAMENT_STUCK_SEC * 1000);
  assert.equal(m.winnerUserId, 'u4');
  assert.equal(m.reason, 'host_advance');
  assert.deepEqual(fx.closeRooms, [m.roomId], 'the live room is closed');
  const entry = s.log.find((l) => l.kind === 'host');
  assert.ok(entry && /organiser advanced Player4/.test(entry.text) && entry.matchId === m.id);
  raises(() => E.hostAdvance(s, HOST, m.id, 'u1', T0 + 60 * 60_000), 'ILLEGAL_MOVE'); // already decided
});

test('TOURNAMENT host advance: a normal running match cannot be advanced by anybody', () => {
  const s = start(2);
  attachAll(s, T0);
  const m = s.matches[0];
  E.markLive(s, rid(m), T0);
  for (const who of [HOST, 'u1', 'u2']) {
    assert.throws(() => E.hostAdvance(s, who, m.id, 'u1', T0 + 5 * 60_000), GameRuleError);
  }
  assert.equal(m.status, 'LIVE');
  assert.equal(E.hostAdvanceProblem(s, m, T0 + 5 * 60_000) !== null, true);
  assert.equal(E.hostAdvanceProblem(s, m, T0 + TOURNAMENT_STUCK_SEC * 1000), null);
});

// ---------------------------------------------------------------------
// Leaving, kicking, aborting
// ---------------------------------------------------------------------

test('TOURNAMENT leave: a player who leaves forfeits the current match and every later one', () => {
  const s = start(8);
  attachAll(s, T0);
  const live = s.matches.find((m) => m.id === 'R1M1')!; // u1 v u8
  E.markLive(s, rid(live), T0);
  const fx = E.playerLeft(s, 'u1', T0 + 5);
  assert.equal(live.status, 'DONE');
  assert.equal(live.winnerUserId, 'u8');
  assert.equal(live.reason, 'forfeit');
  assert.deepEqual(fx.closeRooms, [live.roomId]);
  assert.equal(s.players.find((p) => p.userId === 'u1')?.left, true);
  // a result for the old room afterwards changes nothing
  const snap = JSON.stringify(s);
  E.reportGame(s, rid(live), 'u1', T0 + 6);
  assert.equal(JSON.stringify(s), snap);
  // finish the rest: nobody can be forced to play against a player who left
  E.playerLeft(s, 'u8', T0 + 7); // u8 advanced into the quarter... then left: the next opponent advances
  playOut(s, T0 + 10);
  assert.equal(s.phase, 'COMPLETE');
  assert.notEqual(s.championUserId, 'u1');
  assert.notEqual(s.championUserId, 'u8');
});

test('TOURNAMENT leave: a leaver whose opponent is not known yet forfeits as soon as the opponent arrives', () => {
  const s = start(4);
  attachAll(s, T0);
  const m1 = s.matches.find((m) => m.id === 'R1M1')!; // u1 v u4
  const m2 = s.matches.find((m) => m.id === 'R1M2')!; // u2 v u3
  E.markLive(s, rid(m1), T0);
  E.reportGame(s, rid(m1), 'u1', T0); // u1 waits in the final
  E.playerLeft(s, 'u1', T0 + 1); // u1 leaves before the final is set
  const final = s.matches.find((m) => m.id === 'R2M1')!;
  assert.equal(final.status, 'SCHEDULED');
  E.markLive(s, rid(m2), T0 + 2);
  E.reportGame(s, rid(m2), 'u3', T0 + 2);
  assert.equal(final.status, 'DONE', 'the final is decided at once: u1 is gone');
  assert.equal(final.winnerUserId, 'u3');
  assert.equal(s.phase, 'COMPLETE');
  assert.equal(s.championUserId, 'u3');
});

test('TOURNAMENT leave: with fewer than 2 players left the tournament is aborted; a finished one is untouched', () => {
  const s = start(2);
  attachAll(s, T0);
  const m = s.matches[0];
  const fx = E.playerLeft(s, 'u1', T0 + 1);
  assert.equal(s.phase, 'ABORTED');
  assert.ok(fx.closeRooms.includes(rid(m)));
  assert.match(s.statusMessage, /Fewer than 2 players/);
  // 4 players: one leaving does not abort
  const s4 = start(4);
  E.playerLeft(s4, 'u2', T0 + 1);
  assert.equal(s4.phase, 'RUNNING');
  assert.equal(s4.matches.find((x) => x.id === 'R1M2')?.winnerUserId, 'u3');
  // finished: leaving changes nothing
  const done = start(2);
  playOut(done);
  const snap = JSON.stringify(done);
  assert.deepEqual(E.playerLeft(done, 'u1', T0 + 99_999).closeRooms, []);
  assert.equal(JSON.stringify(done), snap);
  assert.equal(done.phase, 'COMPLETE');
});

test('TOURNAMENT leave: a leaving player is counted once; unknown players change nothing', () => {
  const s = start(4);
  E.playerLeft(s, 'u2', T0);
  const snap = JSON.stringify(s);
  E.playerLeft(s, 'u2', T0 + 1);
  E.playerLeft(s, 'nobody', T0 + 1);
  assert.equal(JSON.stringify(s), snap);
});

test('TOURNAMENT leave: a champion who would be a leaver is never crowned: the tournament ends instead', () => {
  const s = start(4);
  // everybody in the bracket is gone (set directly: playerLeft would already abort when fewer than 2 remain)
  for (const p of s.players) p.left = true;
  E.tick(s, T0);
  assert.equal(s.phase, 'ABORTED');
  assert.match(s.statusMessage, /Everybody still in the bracket left/);
  const five = start(5);
  for (const id of ['u1', 'u2', 'u3', 'u4']) E.playerLeft(five, id, T0 + 1);
  assert.equal(five.phase, 'ABORTED', 'fewer than 2 players remain');
});

test('TOURNAMENT abort: closes every open game room, is safe twice, host leaving aborts', () => {
  const s = start(8);
  attachAll(s, T0);
  const rooms = active(s).map((m) => m.roomId);
  const fx = E.hostLeft(s, T0 + 5);
  assert.equal(s.phase, 'ABORTED');
  assert.deepEqual(new Set(fx.closeRooms), new Set(rooms));
  assert.equal(s.host.left, true);
  assert.deepEqual(E.abort(s, 'again', T0 + 6).closeRooms, [], 'aborting twice does nothing');
  assert.deepEqual(E.hostLeft(s, T0 + 7).closeRooms, []);
  assert.deepEqual(E.reportGame(s, rooms[0] as string, 'u1', T0 + 8).closeRooms, [], 'results after an abort are ignored');
  assert.equal(s.matches.filter((m) => m.status === 'DONE').length, 0);
  assert.deepEqual(E.matchesNeedingRoom(s), [], 'an aborted tournament creates no more rooms');
  assert.deepEqual(E.tick(s, T0 + 10 * 60_000).closeRooms, []);
});

// ---------------------------------------------------------------------
// Registration: config, shuffle, kick, start
// ---------------------------------------------------------------------

test('TOURNAMENT registration: only the host changes the settings, shuffles or kicks, and only before the start', () => {
  const lobby = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  assert.equal(lobby.phase, 'REGISTRATION');
  assert.deepEqual(lobby.config, { game: 'tic-tac-toe', thirdPlace: false, finalBestOf: 1 });
  const raises = (fn: () => void, code: string) => assert.throws(fn, (e: any) => e instanceof GameRuleError && e.code === code);
  raises(() => E.setConfig(lobby, 'u1', { thirdPlace: true }), 'HOST_ONLY');
  raises(() => E.shuffleSeeds(lobby, 'u1', seats(4)), 'HOST_ONLY');
  raises(() => E.kick(lobby, 'u1', 'u2'), 'HOST_ONLY');
  E.setConfig(lobby, HOST, { game: 'chess', thirdPlace: true, finalBestOf: 3 });
  assert.deepEqual(lobby.config, { game: 'chess', thirdPlace: true, finalBestOf: 3 });
  E.setConfig(lobby, HOST, { thirdPlace: false });
  assert.equal(lobby.config.game, 'chess', 'a partial change keeps the rest');
  raises(() => E.kick(lobby, HOST, HOST), 'INVALID_INPUT');
  E.kick(lobby, HOST, 'u2');
  assert.equal(E.isKicked(lobby, 'u2'), true);
  assert.equal(E.isKicked(lobby, 'u1'), false);
  const running = start(4);
  raises(() => E.setConfig(running, HOST, { game: 'chess' }), 'WRONG_PHASE');
  raises(() => E.shuffleSeeds(running, HOST, seats(4)), 'WRONG_PHASE');
  raises(() => E.kick(running, HOST, 'u1'), 'WRONG_PHASE');
  raises(() => E.createInitialState(running, seats(4), T0), 'WRONG_PHASE');
});

test('TOURNAMENT registration: the seed shuffle uses the injected random source and keeps every player once', () => {
  const lobby = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  const zero = () => 0;
  const a = E.shuffleSeeds(lobby, HOST, seats(6), zero);
  assert.equal(new Set(a).size, 6);
  const b = E.shuffleSeeds(E.createLobbyState({ userId: HOST, displayName: 'Host' }), HOST, seats(6), zero);
  assert.deepEqual(a, b, 'same random source, same order');
  let i = 0;
  const seq = [0.9, 0.1, 0.5, 0.3, 0.7];
  const c = shuffled(['a', 'b', 'c', 'd', 'e', 'f'], () => seq[i++ % seq.length]);
  assert.deepEqual([...c].sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
  // the shuffled order really becomes the seeding
  const started = E.createInitialState(lobby, seats(6), T0);
  assert.deepEqual(started.players.map((p) => p.userId), a);
  assert.equal(started.players[0].seed, 1);
  // a late joiner / a leaver after the shuffle
  const l2 = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  E.shuffleSeeds(l2, HOST, seats(4), () => 0.5);
  const merged = orderLobbyPlayers([...seats(4).slice(1), { userId: 'late', displayName: 'Late', seat: 9 }], l2.seedOrder).map((x) => x.userId);
  assert.equal(merged[merged.length - 1], 'late');
  assert.ok(!merged.includes('u1'));
});

test('TOURNAMENT registration: start needs the minimum number of players (4, or 2..4 in the testing mode)', () => {
  const lobby = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  const prev = process.env.TOURNAMENT_TEST_MIN_PLAYERS;
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.TOURNAMENT_TEST_MIN_PLAYERS = '';
    assert.equal(tournamentMinPlayers(), 4);
    assert.match(E.startProblem(lobby, 3) as string, /At least 4 players/);
    assert.equal(E.startProblem(lobby, 4), null);
    assert.equal(E.startProblem(lobby, 32), null);
    assert.match(E.startProblem(lobby, TOURNAMENT_MAX_PLAYERS + 1) as string, /At most 32/);
    assert.throws(() => E.createInitialState(lobby, seats(3), T0), GameRuleError);
    for (const [v, expected] of [['2', 2], ['3', 3], ['4', 4], ['1', 4], ['5', 4], ['0', 4], ['abc', 4], ['2.5', 4], ['-2', 4], [' ', 4], ['', 4]] as const) {
      process.env.TOURNAMENT_TEST_MIN_PLAYERS = v;
      assert.equal(tournamentMinPlayers(), expected, `value "${v}"`);
    }
    process.env.TOURNAMENT_TEST_MIN_PLAYERS = '2';
    assert.equal(E.startProblem(lobby, 2), null);
    assert.equal(E.createInitialState(lobby, seats(2), T0).bracketSize, 2);
    process.env.NODE_ENV = 'production';
    assert.equal(tournamentMinPlayers(), 4, 'ignored in production');
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.TOURNAMENT_TEST_MIN_PLAYERS = prev ?? '';
  }
});

test('TOURNAMENT registration: a duplicate player or the host in the seats is refused', () => {
  const lobby = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  const dup = [...seats(4), { userId: 'u1', displayName: 'Again', seat: 10 }];
  assert.throws(() => E.createInitialState(lobby, dup, T0), GameRuleError);
  assert.throws(() => E.createInitialState(lobby, [...seats(3), { userId: HOST, displayName: 'Host', seat: 0 }], T0), GameRuleError);
});

// ---------------------------------------------------------------------
// Restart / resume
// ---------------------------------------------------------------------

test('TOURNAMENT resume: the state is plain JSON, a restarted server continues exactly where it stopped', () => {
  const s = start(8, { thirdPlace: true });
  attachAll(s, T0);
  const m = s.matches.find((x) => x.id === 'R1M1')!;
  E.markLive(s, rid(m), T0 + 1);
  E.reportGame(s, rid(m), 'u1', T0 + 2);
  const restored: TournamentServerState = JSON.parse(JSON.stringify(s));
  assert.deepEqual(restored, s);
  assert.equal(E.isServerState(restored), true);
  // the deadline of the other matches still holds after the restart: a no-show is settled by the next tick
  E.tick(restored, T0 + 120_000);
  assert.ok(restored.matches.some((x) => x.doubleNoShowAt !== null), 'the join deadline survived the restart');
  // open matches keep their room, so the manager can re-check those rooms that finished while the server was down
  const open = restored.matches.filter((x) => x.status === 'PENDING_PLAYERS' && x.roomId);
  assert.ok(open.length > 0);
  const room = open[0].roomId as string;
  E.reportGame(restored, room, E.higherSeed(open[0]), T0 + 130_000);
  assert.equal(restored.matches.find((x) => x.roomId === room)?.status, 'DONE');
  playOut(restored, T0 + 200_000);
  assert.equal(restored.phase, 'COMPLETE');
  assert.equal(seedOf(restored, restored.championUserId), 1);
});

// ---------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------

test('TOURNAMENT view: no internal bookkeeping, a summary for the viewer, standings only when complete', () => {
  const s = start(4);
  E.kick(E.createLobbyState({ userId: HOST, displayName: 'Host' }), HOST, 'x');
  s.internal.kicked.push('kicked-user-xyz');
  attachAll(s, T0);
  const view = E.publicStateFor(s, 'u1', T0 + 5)!;
  assert.equal(view.game, 'tournament');
  assert.equal(view.serverNow, T0 + 5);
  const text = JSON.stringify(view);
  assert.ok(!text.includes('kicked-user-xyz'), 'the kick list never reaches a client');
  assert.ok(!text.includes('"internal"'));
  assert.equal(E.isServerState(view), false);
  assert.equal(E.isServerState(s), true);
  assert.equal(E.publicStateFor(view as any, 'u1', T0), view, 'an already built view passes through');
  assert.equal(view.me?.role, 'player');
  assert.equal(view.me?.seed, 1);
  assert.equal(view.me?.activeMatchId, 'R1M1');
  assert.equal(view.me?.upcomingMatchId, 'R2M1', 'the match the winner moves on to');
  assert.equal(E.publicStateFor(s, HOST)!.me?.role, 'host');
  assert.equal(E.publicStateFor(s, 'stranger')!.me?.role, 'spectator');
  assert.equal(E.publicStateFor(s, null)!.me?.role, 'spectator');
  assert.equal(view.standings, null);
  assert.equal(view.minPlayers, 4);
  assert.equal(view.maxPlayers, 32);
  playOut(s);
  const done = E.publicStateFor(s, 'u3')!;
  assert.equal(done.phase, 'COMPLETE');
  assert.equal(done.standings?.championUserId, s.championUserId);
  assert.equal(done.me?.rank, done.standings?.rows.find((r) => r.userId === 'u3')?.rank);
  assert.equal(E.publicStateFor(null, 'u1'), null);
  // the view is a copy: changing it never changes the state
  view.matches[0].roundName = 'changed';
  assert.notEqual(s.matches[0].roundName, 'changed');
});

test('TOURNAMENT view: in the lobby every non-organiser viewer is a seated player (the lobby state does not list them)', () => {
  const lobby = E.createLobbyState({ userId: HOST, displayName: 'Host' });
  assert.equal(E.publicStateFor(lobby, 'u1')!.me?.role, 'player');
  assert.equal(E.publicStateFor(lobby, HOST)!.me?.role, 'host');
  assert.equal(E.publicStateFor(lobby, 'u1')!.phase, 'REGISTRATION');
  assert.equal(E.publicStateFor(lobby, 'u1')!.matches.length, 0);
});

test('TOURNAMENT view: a player who left or was eliminated has no upcoming match', () => {
  const s = start(4);
  attachAll(s, T0);
  const m = s.matches.find((x) => x.id === 'R1M1')!;
  E.markLive(s, rid(m), T0);
  E.reportGame(s, rid(m), 'u1', T0);
  const loser = E.publicStateFor(s, 'u4')!.me!;
  assert.equal(loser.eliminated, true);
  assert.equal(loser.activeMatchId, null);
  assert.equal(loser.upcomingMatchId, null);
  const winner = E.publicStateFor(s, 'u1')!.me!;
  assert.equal(winner.upcomingMatchId, 'R2M1');
  assert.equal(winner.activeMatchId, null);
});

test('TOURNAMENT view: connection flags follow setConnected', () => {
  const s = start(4);
  E.setConnected(s, 'u1', false);
  E.setConnected(s, HOST, false);
  assert.equal(s.players.find((p) => p.userId === 'u1')?.connected, false);
  assert.equal(s.host.connected, false);
  E.setConnected(s, 'u1', true);
  assert.equal(s.players.find((p) => p.userId === 'u1')?.connected, true);
  E.setConnected(s, 'nobody', true);
});

// ---------------------------------------------------------------------
// Schemas, definitions, rate limiter
// ---------------------------------------------------------------------

test('TOURNAMENT schemas: payloads are validated strictly', () => {
  assert.deepEqual(parseTournamentPayload(tournamentConfigSchema, { game: 'chess' }), { game: 'chess' });
  assert.deepEqual(parseTournamentPayload(tournamentConfigSchema, { thirdPlace: true, finalBestOf: 3 }), { thirdPlace: true, finalBestOf: 3 });
  for (const bad of [{}, null, undefined, { game: 'ludo' }, { game: 'bingo' }, { thirdPlace: 'yes' }, { finalBestOf: 2 }, { finalBestOf: '3' }, { game: 'chess', extra: 1 }, [], 'x']) {
    assert.throws(() => parseTournamentPayload(tournamentConfigSchema, bad), (e: any) => e instanceof GameRuleError && e.code === 'INVALID_INPUT', JSON.stringify(bad));
  }
  assert.deepEqual(parseTournamentPayload(tournamentKickSchema, { userId: 'u1' }), { userId: 'u1' });
  for (const bad of [{}, { userId: '' }, { userId: 5 }, { userId: 'x'.repeat(81) }, { userId: 'u1', extra: 1 }]) {
    assert.throws(() => parseTournamentPayload(tournamentKickSchema, bad), GameRuleError);
  }
  assert.deepEqual(parseTournamentPayload(tournamentAdvanceSchema, { matchId: 'R1M2', userId: 'u1' }), { matchId: 'R1M2', userId: 'u1' });
  for (const bad of [{ matchId: 'R1M2' }, { userId: 'u1' }, { matchId: '../x', userId: 'u1' }, { matchId: 'R1 M2', userId: 'u1' }, { matchId: 'R'.repeat(25), userId: 'u1' }, { matchId: 'R1M2', userId: 'u1', winner: 'u1' }]) {
    assert.throws(() => parseTournamentPayload(tournamentAdvanceSchema, bad), GameRuleError, JSON.stringify(bad));
  }
});

test('TOURNAMENT definition: a Creator game for 4 to 32 players plus the host, no partner mode, no matchmaking, aliases', () => {
  const def = GAME_DEFINITIONS.tournament;
  assert.equal(def.name, 'Tournament Arena');
  assert.equal(def.requiredHostTier, 'creator');
  assert.equal(def.minPlayers, 4);
  assert.equal(def.maxPlayers, 33);
  assert.deepEqual(def.playerOptions, [33]);
  assert.equal(def.supportsPartnerMode, false);
  assert.equal(def.supportsPublicMatchmaking, false);
  for (const alias of ['tournament', 'tournament-arena', 'arena', 'Tournament', ' ARENA ']) assert.equal(parseGameType(alias), 'tournament', alias);
  assert.equal(parseGameType('tournaments'), null);
  assert.equal(parseGameType('quiz'), 'quiz-show', 'the other aliases are untouched');
});

test('TOURNAMENT rate limiter: allows the budget, then refuses until the window passes', () => {
  const key = `room:${Math.random()}:host`;
  for (let i = 0; i < 3; i++) assert.equal(tournamentRateAllowed(key, 3, 1000, T0), true);
  assert.equal(tournamentRateAllowed(key, 3, 1000, T0 + 10), false);
  assert.equal(tournamentRateAllowed(key, 3, 1000, T0 + 1001), true);
});
