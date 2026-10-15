import {
  TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC,
  TOURNAMENT_JOIN_WINDOW_SEC,
  TOURNAMENT_LOG_MAX,
  TOURNAMENT_MAX_EXTRA_GAMES,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_MIN_PLAYERS,
  TOURNAMENT_STUCK_SEC,
  TOURNAMENT_DEFAULT_GAME,
  TOURNAMENT_GAME_NAMES,
  orderLobbyPlayers,
  tournamentRoundName,
  tournamentThirdPlaceAvailable,
  TournamentConfig,
  TournamentGameView,
  TournamentLogKind,
  TournamentMatch,
  TournamentMe,
  TournamentPlayer,
  TournamentResultReason,
  TournamentServerState,
  TournamentSource,
  TournamentStandingRow,
  TournamentStandings
} from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';
import { secureRandom } from '../util/random.js';

/**
 * Tournament Arena engine: pure, server-authoritative rules for a single-elimination bracket. No sockets, no timers, no database,
 * no game rooms.
 *  - the clock (`now`, epoch ms) and the random source (`rng`, [0, 1)) are injected, so tests are deterministic
 *  - the engine never plays a match: the manager creates a real game room per pairing and reports the result of THAT room's
 *    server state back through `reportGame`. No player and not the host can submit a winner
 *  - every mutating call returns `TournamentEffects`: the game rooms the manager must close because the match was decided without them
 *  - stale or duplicate messages change nothing (a result for a room that is not the current room of an open match is ignored)
 */

/**
 * TESTING ONLY: TOURNAMENT_TEST_MIN_PLAYERS=2..4 lets a tournament start with fewer players so one person can try it with a few
 * browsers (2 players = one match, the final). Ignored in production and for any other value; the default stays 4.
 */
export function tournamentMinPlayers(): number {
  const n = Number(process.env.TOURNAMENT_TEST_MIN_PLAYERS);
  return process.env.NODE_ENV !== 'production' && Number.isInteger(n) && n >= 2 && n <= TOURNAMENT_MIN_PLAYERS ? n : TOURNAMENT_MIN_PLAYERS;
}

export interface TournamentSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  /** room seat (join order) */
  seat: number;
  connected?: boolean;
}

export interface TournamentHostSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  connected?: boolean;
}

export interface TournamentEffects {
  /** ids of game rooms the manager must end (their match was decided without them) */
  closeRooms: string[];
}

const noEffects = (): TournamentEffects => ({ closeRooms: [] });

// ---------------------------------------------------------------------
// Rate limiting (host actions), keyed by `${roomId}:${userId}:${kind}`
// ---------------------------------------------------------------------

const rateBuckets = new Map<string, number[]>();

export function tournamentRateAllowed(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearTournamentRate(roomId: string): void {
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.startsWith(`${roomId}:`)) rateBuckets.delete(key);
  }
}

// ---------------------------------------------------------------------
// Pure bracket helpers (exported for tests)
// ---------------------------------------------------------------------

/** Smallest power of two that is >= n (and at least 2). */
export function bracketSizeFor(playerCount: number): number {
  let size = 2;
  while (size < playerCount) size *= 2;
  return size;
}

/**
 * Seed positions of a bracket of `size` slots: consecutive pairs are the first round matches (1 vs size, 2 vs size-1 ...), arranged so
 * that the top seeds can only meet in the late rounds. Seeds above the player count are byes.
 */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** Fisher-Yates shuffle with an injected random source. Returns a new array. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const matchWinsNeeded = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

export class TournamentEngine {
  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private static requireHost(state: TournamentServerState, userId: string): void {
    if (state.host.userId !== userId || state.host.left) throw new GameRuleError('HOST_ONLY', 'Only the organiser can do this');
  }

  private static player(state: TournamentServerState, userId: unknown): TournamentPlayer | undefined {
    return typeof userId === 'string' ? state.players.find((p) => p.userId === userId) : undefined;
  }

  private static name(state: TournamentServerState, userId: string | null | undefined): string {
    return (userId && this.player(state, userId)?.displayName) || 'Someone';
  }

  private static log(state: TournamentServerState, kind: TournamentLogKind, text: string, now: number, matchId?: string): void {
    state.logSeq += 1;
    state.log.push({ id: state.logSeq, at: now, kind, text, ...(matchId ? { matchId } : {}) });
    if (state.log.length > TOURNAMENT_LOG_MAX) state.log.splice(0, state.log.length - TOURNAMENT_LOG_MAX);
  }

  private static match(state: TournamentServerState, id: unknown): TournamentMatch | undefined {
    return typeof id === 'string' ? state.matches.find((m) => m.id === id) : undefined;
  }

  private static label(state: TournamentServerState, m: TournamentMatch): string {
    return m.kind === 'THIRD' ? 'the third place match' : m.roundName === 'Final' ? 'the Final' : m.roundName;
  }

  private static gameName(state: TournamentServerState): string {
    return TOURNAMENT_GAME_NAMES[state.config.game] ?? state.config.game;
  }

  /** The player with the better (lower) seed of a match; null when a seat is empty. */
  public static higherSeed(m: TournamentMatch): string | null {
    if (!m.a || !m.b) return null;
    return (m.seedA ?? Infinity) <= (m.seedB ?? Infinity) ? m.a : m.b;
  }

  /**
   * Who takes seat 0 (first move / white) in the NEXT game room of the match: the higher seed in the first game, then the sides alternate.
   * Returns [seat0, seat1] or null when the match has no two players.
   */
  public static seatOrder(m: TournamentMatch): [string, string] | null {
    const top = this.higherSeed(m);
    if (!top || !m.a || !m.b) return null;
    const other = top === m.a ? m.b : m.a;
    return m.gameNo % 2 === 0 ? [top, other] : [other, top];
  }

  // -------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------

  public static createLobbyState(host: TournamentHostSeat): TournamentServerState {
    return {
      game: 'tournament',
      phase: 'REGISTRATION',
      host: { userId: host.userId, displayName: host.displayName, avatarUrl: host.avatarUrl ?? null, connected: host.connected !== false, left: false },
      config: { game: TOURNAMENT_DEFAULT_GAME, thirdPlace: false, finalBestOf: 1 },
      seedOrder: [],
      players: [],
      matches: [],
      rounds: 0,
      bracketSize: 0,
      log: [],
      logSeq: 0,
      championUserId: null,
      runnerUpUserId: null,
      thirdPlaceUserId: null,
      startedAt: null,
      endedAt: null,
      statusMessage: 'Pick the game, let the players join, then start the bracket.',
      internal: { kicked: [], roomSeq: 0 }
    };
  }

  private static requireRegistration(state: TournamentServerState, userId: string): void {
    this.requireHost(state, userId);
    if (state.phase !== 'REGISTRATION') throw new GameRuleError('WRONG_PHASE', 'The tournament has already started');
  }

  /** Host: game, third place match, Final length. Only before the start. */
  public static setConfig(state: TournamentServerState, userId: string, patch: Partial<TournamentConfig>): TournamentConfig {
    this.requireRegistration(state, userId);
    const next: TournamentConfig = { ...state.config };
    if (patch.game !== undefined) next.game = patch.game;
    if (patch.thirdPlace !== undefined) next.thirdPlace = patch.thirdPlace;
    if (patch.finalBestOf !== undefined) next.finalBestOf = patch.finalBestOf;
    state.config = next;
    return next;
  }

  /** Host: a new random seed order of the players currently seated. */
  public static shuffleSeeds(state: TournamentServerState, userId: string, seats: readonly TournamentSeat[], rng: () => number = secureRandom): string[] {
    this.requireRegistration(state, userId);
    const order = orderLobbyPlayers(seats, state.seedOrder).map((s) => s.userId);
    state.seedOrder = shuffled(order, rng);
    return state.seedOrder;
  }

  /** Host: removes a player before the start (the manager removes the seat). The player cannot join this tournament again. */
  public static kick(state: TournamentServerState, userId: string, target: string): void {
    this.requireRegistration(state, userId);
    if (target === state.host.userId) throw new GameRuleError('INVALID_INPUT', 'The organiser cannot be removed');
    if (!state.internal.kicked.includes(target)) state.internal.kicked.push(target);
    state.seedOrder = state.seedOrder.filter((id) => id !== target);
  }

  public static isKicked(state: TournamentServerState, userId: string): boolean {
    return state.internal.kicked.includes(userId);
  }

  /** The problem that stops the host from starting, or null. */
  public static startProblem(state: TournamentServerState, playerCount: number): string | null {
    const min = tournamentMinPlayers();
    if (playerCount < min) return `At least ${min} players are needed to start (${playerCount} joined)`;
    if (playerCount > TOURNAMENT_MAX_PLAYERS) return `At most ${TOURNAMENT_MAX_PLAYERS} players can play`;
    return null;
  }

  // -------------------------------------------------------------------
  // Bracket
  // -------------------------------------------------------------------

  /** The empty bracket for `players` (already in seed order). Round 1 byes are NOT resolved here. */
  public static buildMatches(players: readonly TournamentPlayer[], config: TournamentConfig): { matches: TournamentMatch[]; rounds: number; size: number } {
    const n = players.length;
    const size = bracketSizeFor(n);
    const rounds = Math.round(Math.log2(size));
    const order = bracketOrder(size);
    const bySeed = new Map(players.map((p) => [p.seed, p]));
    const matches: TournamentMatch[] = [];
    const blank = (id: string, kind: 'MAIN' | 'THIRD', round: number, index: number, bestOf: 1 | 3, srcA: TournamentSource, srcB: TournamentSource): TournamentMatch => ({
      id, kind, round, index,
      roundName: kind === 'THIRD' ? 'Third place' : tournamentRoundName(round, rounds),
      a: null, b: null, seedA: null, seedB: null, srcA, srcB,
      status: 'SCHEDULED', bye: false, bestOf,
      winsA: 0, winsB: 0, draws: 0,
      winnerUserId: null, loserUserId: null, reason: null,
      gameNo: 0, roomId: null, roomCode: null, joined: [],
      createdAt: null, joinDeadline: null, liveAt: null, doneAt: null, doubleNoShowAt: null,
      games: []
    });
    for (let round = 1; round <= rounds; round++) {
      const count = size / 2 ** round;
      for (let i = 0; i < count; i++) {
        const id = `R${round}M${i + 1}`;
        const bestOf: 1 | 3 = round === rounds ? config.finalBestOf : 1;
        if (round === 1) {
          const sa = order[2 * i];
          const sb = order[2 * i + 1];
          const m = blank(id, 'MAIN', 1, i, bestOf, sa <= n ? { kind: 'seed', seed: sa } : { kind: 'bye' }, sb <= n ? { kind: 'seed', seed: sb } : { kind: 'bye' });
          const pa = bySeed.get(sa);
          const pb = bySeed.get(sb);
          m.a = pa?.userId ?? null;
          m.b = pb?.userId ?? null;
          m.seedA = pa ? sa : null;
          m.seedB = pb ? sb : null;
          m.bye = !pa || !pb;
          matches.push(m);
        } else {
          matches.push(blank(id, 'MAIN', round, i, bestOf, { kind: 'winner', matchId: `R${round - 1}M${2 * i + 1}` }, { kind: 'winner', matchId: `R${round - 1}M${2 * i + 2}` }));
        }
      }
    }
    if (config.thirdPlace && tournamentThirdPlaceAvailable(n) && rounds >= 2) {
      matches.push(blank('THIRD', 'THIRD', rounds, 0, 1, { kind: 'loser', matchId: `R${rounds - 1}M1` }, { kind: 'loser', matchId: `R${rounds - 1}M2` }));
    }
    return { matches, rounds, size };
  }

  /** LOBBY -> RUNNING: seeds the players (the host's order, else join order), builds the bracket, resolves the byes. */
  public static createInitialState(lobby: TournamentServerState, seats: readonly TournamentSeat[], now: number): TournamentServerState {
    if (lobby.phase !== 'REGISTRATION') throw new GameRuleError('WRONG_PHASE', 'The tournament has already started');
    const problem = this.startProblem(lobby, seats.length);
    if (problem) throw new GameRuleError('INVALID_INPUT', problem);
    const ids = new Set(seats.map((s) => s.userId));
    if (ids.size !== seats.length || ids.has(lobby.host.userId)) throw new GameRuleError('INVALID_INPUT', 'Duplicate player in the tournament');
    const ordered = orderLobbyPlayers(seats, lobby.seedOrder);
    const players: TournamentPlayer[] = ordered.map((s, i) => ({
      userId: s.userId,
      displayName: s.displayName,
      avatarUrl: s.avatarUrl ?? null,
      seat: s.seat,
      seed: i + 1,
      connected: s.connected !== false,
      left: false,
      eliminated: false
    }));
    const config: TournamentConfig = { ...lobby.config, thirdPlace: lobby.config.thirdPlace && tournamentThirdPlaceAvailable(players.length) };
    const { matches, rounds, size } = this.buildMatches(players, config);
    const state: TournamentServerState = {
      ...lobby,
      host: { ...lobby.host },
      config,
      phase: 'RUNNING',
      seedOrder: players.map((p) => p.userId),
      players,
      matches,
      rounds,
      bracketSize: size,
      log: [],
      logSeq: 0,
      championUserId: null,
      runnerUpUserId: null,
      thirdPlaceUserId: null,
      startedAt: now,
      endedAt: null,
      statusMessage: 'The bracket is set. Matches start as soon as both players are known.',
      internal: { kicked: [...lobby.internal.kicked], roomSeq: 0 }
    };
    const finalBestOfText = config.finalBestOf === 3 ? ', the Final is best of 3' : '';
    this.log(state, 'system', `Tournament started: ${players.length} players, ${this.gameName(state)}, ${rounds} ${rounds === 1 ? 'round' : 'rounds'}${config.thirdPlace ? ', third place match' : ''}${finalBestOfText}.`, now);
    const effects = noEffects();
    for (const m of state.matches) {
      if (m.kind === 'MAIN' && m.round === 1 && m.bye) {
        const winner = m.a ?? m.b;
        if (winner) this.finishMatch(state, m, winner, 'bye', now, effects, false);
      } else if (m.kind === 'MAIN' && m.round === 1) {
        this.markReady(state, m);
      }
    }
    this.settle(state, now, effects);
    return state;
  }

  /** Both players known and nothing decided yet: the match waits for its game room. */
  private static markReady(state: TournamentServerState, m: TournamentMatch): void {
    if (m.status !== 'SCHEDULED' || !m.a || !m.b) return;
    m.status = 'PENDING_PLAYERS';
  }

  /** Puts `userId` into a slot of a later match. */
  private static place(state: TournamentServerState, target: TournamentMatch, slot: 'a' | 'b', userId: string | null): void {
    if (!userId) return;
    const p = this.player(state, userId);
    if (slot === 'a') { target.a = userId; target.seedA = p?.seed ?? null; } else { target.b = userId; target.seedB = p?.seed ?? null; }
    this.markReady(state, target);
  }

  /** Decides a match, moves the winner (and the loser of a semi-final) on, and checks whether the tournament is over. */
  private static finishMatch(
    state: TournamentServerState,
    m: TournamentMatch,
    winnerId: string,
    reason: TournamentResultReason,
    now: number,
    effects: TournamentEffects,
    closeRoom: boolean
  ): void {
    if (m.status === 'DONE') return;
    const loserId = m.bye ? null : m.a === winnerId ? m.b : m.a;
    m.winnerUserId = winnerId;
    m.loserUserId = loserId;
    m.reason = reason;
    m.status = 'DONE';
    m.doneAt = now;
    m.joinDeadline = null;
    m.doubleNoShowAt = null;
    if (closeRoom && m.roomId) effects.closeRooms.push(m.roomId);
    if (m.kind === 'MAIN' && loserId) {
      const lp = this.player(state, loserId);
      if (lp) lp.eliminated = true;
    }
    if (m.kind === 'MAIN') {
      const next = this.nextMain(state, m);
      if (next) this.place(state, next, m.index % 2 === 0 ? 'a' : 'b', winnerId);
      if (m.round === state.rounds - 1) {
        const third = state.matches.find((x) => x.kind === 'THIRD');
        if (third) this.place(state, third, m.index % 2 === 0 ? 'a' : 'b', loserId);
      }
      if (m.round === state.rounds) {
        state.championUserId = winnerId;
        state.runnerUpUserId = loserId;
      }
    } else {
      state.thirdPlaceUserId = winnerId;
    }
    this.checkComplete(state, now, effects);
  }

  private static checkComplete(state: TournamentServerState, now: number, effects: TournamentEffects): void {
    if (state.phase !== 'RUNNING') return;
    const final = state.matches.find((x) => x.kind === 'MAIN' && x.round === state.rounds);
    const third = state.matches.find((x) => x.kind === 'THIRD');
    if (!final || final.status !== 'DONE' || (third && third.status !== 'DONE')) return;
    const champ = this.player(state, state.championUserId);
    if (!champ || champ.left) {
      const abortEffects = this.abort(state, 'Everybody still in the bracket left, so the tournament ended.', now);
      effects.closeRooms.push(...abortEffects.closeRooms);
      return;
    }
    state.phase = 'COMPLETE';
    state.endedAt = now;
    state.statusMessage = `${champ.displayName} is the champion!`;
    this.log(state, 'system', `${champ.displayName} won the tournament.`, now);
  }

  /** A player left the tournament: any open match with them is decided at once, until nothing is left to settle. */
  private static settle(state: TournamentServerState, now: number, effects: TournamentEffects): void {
    for (let guard = 0; guard < 200; guard++) {
      if (state.phase !== 'RUNNING') return;
      const m = state.matches.find((x) => x.status !== 'DONE' && x.status !== 'SCHEDULED' && x.a && x.b && (this.player(state, x.a)?.left || this.player(state, x.b)?.left));
      if (!m || !m.a || !m.b) return;
      const aLeft = Boolean(this.player(state, m.a)?.left);
      const bLeft = Boolean(this.player(state, m.b)?.left);
      const winner = aLeft && bLeft ? (this.higherSeed(m) as string) : aLeft ? m.b : m.a;
      const loser = winner === m.a ? m.b : m.a;
      this.log(state, 'forfeit', `${this.name(state, winner)} advances: ${this.name(state, loser)} left the tournament (${this.label(state, m)}).`, now, m.id);
      this.finishMatch(state, m, winner, 'forfeit', now, effects, true);
    }
  }

  // -------------------------------------------------------------------
  // Match rooms and results
  // -------------------------------------------------------------------

  /** Matches that have both players and no game room yet (the manager creates the rooms, then calls attachRoom). */
  public static matchesNeedingRoom(state: TournamentServerState): TournamentMatch[] {
    if (state.phase !== 'RUNNING') return [];
    return state.matches
      .filter((m) => m.status === 'PENDING_PLAYERS' && !m.roomId && m.a && m.b)
      .sort((x, y) => x.round - y.round || x.index - y.index);
  }

  public static attachRoom(state: TournamentServerState, matchId: string, room: { roomId: string; roomCode: string }, now: number): void {
    const m = this.match(state, matchId);
    if (!m || state.phase !== 'RUNNING' || m.status !== 'PENDING_PLAYERS' || m.roomId) throw new GameRuleError('ILLEGAL_MOVE', 'That match does not need a game room');
    const [x, y] = this.seatOrder(m) ?? [m.a, m.b];
    m.roomId = room.roomId;
    m.roomCode = room.roomCode;
    m.gameNo += 1;
    m.joined = [];
    m.createdAt = now;
    m.joinDeadline = now + TOURNAMENT_JOIN_WINDOW_SEC * 1000;
    m.doubleNoShowAt = null;
    state.internal.roomSeq += 1;
    this.log(state, 'system', `${this.label(state, m).replace(/^./, (c) => c.toUpperCase())}: ${this.name(state, x)} vs ${this.name(state, y)} is ready${m.gameNo > 1 ? ` (game ${m.gameNo})` : ''}.`, now, m.id);
  }

  /** A player opened the current game room of their match. */
  public static noteJoined(state: TournamentServerState, roomId: string, userId: string): boolean {
    const m = state.matches.find((x) => x.roomId === roomId && x.status === 'PENDING_PLAYERS');
    if (!m || (m.a !== userId && m.b !== userId) || m.doubleNoShowAt !== null || m.joined.includes(userId)) return false;
    m.joined.push(userId);
    return true;
  }

  /** The game room started (both players are in): the match is LIVE. */
  public static markLive(state: TournamentServerState, roomId: string, now: number): boolean {
    const m = state.matches.find((x) => x.roomId === roomId && x.status === 'PENDING_PLAYERS');
    if (!m || !m.a || !m.b) return false;
    m.status = 'LIVE';
    m.liveAt = now;
    m.joined = [m.a, m.b];
    m.joinDeadline = null;
    m.doubleNoShowAt = null;
    return true;
  }

  /**
   * The result of ONE game room, taken from its server game state by the manager: the winner's user id, or null for a draw / a room
   * that ended without a winner. Anything that is not the current room of an open match, or a winner who is not in that match, is ignored.
   * A win adds to the series; a draw replays in a new room (up to TOURNAMENT_MAX_EXTRA_GAMES times), then the player with more game wins
   * (else the higher seed) advances.
   */
  public static reportGame(state: TournamentServerState, roomId: string, winnerUserId: string | null, now: number): TournamentEffects {
    const effects = noEffects();
    if (state.phase !== 'RUNNING') return effects;
    const m = state.matches.find((x) => x.roomId === roomId && (x.status === 'PENDING_PLAYERS' || x.status === 'LIVE'));
    if (!m || !m.a || !m.b) return effects;
    if (winnerUserId !== null && winnerUserId !== m.a && winnerUserId !== m.b) return effects;
    m.games.push({ gameNo: m.gameNo, roomCode: m.roomCode ?? '', winnerUserId });
    const label = this.label(state, m);
    if (winnerUserId) {
      if (winnerUserId === m.a) m.winsA += 1; else m.winsB += 1;
      const need = matchWinsNeeded(m.bestOf);
      if ((winnerUserId === m.a ? m.winsA : m.winsB) >= need) {
        const loser = winnerUserId === m.a ? m.b : m.a;
        const score = m.bestOf > 1 ? ` ${Math.max(m.winsA, m.winsB)}-${Math.min(m.winsA, m.winsB)}` : '';
        this.log(state, 'result', `${this.name(state, winnerUserId)} beat ${this.name(state, loser)}${score} (${label}).`, now, m.id);
        this.finishMatch(state, m, winnerUserId, 'played', now, effects, false);
        this.settle(state, now, effects);
        return effects;
      }
      this.log(state, 'result', `${this.name(state, winnerUserId)} won game ${m.gameNo} against ${this.name(state, winnerUserId === m.a ? m.b : m.a)} (${m.winsA}-${m.winsB}, ${label}).`, now, m.id);
    } else {
      m.draws += 1;
      if (m.draws > TOURNAMENT_MAX_EXTRA_GAMES) {
        const winner = m.winsA > m.winsB ? m.a : m.winsB > m.winsA ? m.b : (this.higherSeed(m) as string);
        this.log(state, 'result', `${this.name(state, winner)} advances after ${m.draws} drawn games (${m.winsA !== m.winsB ? 'more games won' : 'higher seed'}, ${label}).`, now, m.id);
        this.finishMatch(state, m, winner, 'draw_tiebreak', now, effects, false);
        this.settle(state, now, effects);
        return effects;
      }
      this.log(state, 'result', `Game ${m.gameNo} of ${this.name(state, m.a)} vs ${this.name(state, m.b)} was a draw: replaying in a new room (${label}).`, now, m.id);
    }
    // the series goes on: a new game room is needed
    m.status = 'PENDING_PLAYERS';
    m.roomId = null;
    m.roomCode = null;
    m.joined = [];
    m.createdAt = null;
    m.joinDeadline = null;
    m.liveAt = null;
    m.doubleNoShowAt = null;
    return effects;
  }

  // -------------------------------------------------------------------
  // Clock: no-shows
  // -------------------------------------------------------------------

  /**
   * Settles the deadlines. A player who never opened the match room forfeits (the other one advances). When nobody did, the host gets
   * TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC to pick who advances, then the higher seed advances.
   */
  public static tick(state: TournamentServerState, now: number): TournamentEffects {
    const effects = noEffects();
    if (state.phase !== 'RUNNING') return effects;
    for (const m of state.matches) {
      if (m.status !== 'PENDING_PLAYERS' || !m.roomId || !m.a || !m.b) continue;
      if (m.doubleNoShowAt !== null) {
        if (now >= m.doubleNoShowAt + TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC * 1000) {
          const winner = this.higherSeed(m) as string;
          this.log(state, 'forfeit', `${this.name(state, winner)} advances as the higher seed: nobody opened the match room (${this.label(state, m)}).`, now, m.id);
          this.finishMatch(state, m, winner, 'double_no_show', now, effects, true);
        }
        continue;
      }
      if (m.joinDeadline === null || now < m.joinDeadline) continue;
      const aIn = m.joined.includes(m.a);
      const bIn = m.joined.includes(m.b);
      if (aIn && bIn) continue;
      if (aIn || bIn) {
        const winner = aIn ? m.a : m.b;
        const absent = aIn ? m.b : m.a;
        this.log(state, 'forfeit', `${this.name(state, winner)} advances: ${this.name(state, absent)} did not show up (${this.label(state, m)}).`, now, m.id);
        this.finishMatch(state, m, winner, 'no_show', now, effects, true);
      } else {
        m.doubleNoShowAt = now;
        this.log(state, 'forfeit', `Nobody opened ${this.name(state, m.a)} vs ${this.name(state, m.b)}. The organiser can pick who advances; otherwise the higher seed advances in ${TOURNAMENT_DOUBLE_NO_SHOW_HOST_SEC} seconds.`, now, m.id);
      }
    }
    this.settle(state, now, effects);
    return effects;
  }

  // -------------------------------------------------------------------
  // Host actions
  // -------------------------------------------------------------------

  /** Why the host may not advance a player in this match right now (null = allowed). */
  public static hostAdvanceProblem(state: TournamentServerState, m: TournamentMatch, now: number): string | null {
    if (state.phase !== 'RUNNING') return 'The tournament is not running';
    if (m.status === 'DONE') return 'That match already has a result';
    if (m.status === 'SCHEDULED' || !m.a || !m.b) return 'That match has no players yet';
    const stuck = m.createdAt !== null && now - m.createdAt >= TOURNAMENT_STUCK_SEC * 1000;
    if (stuck || m.doubleNoShowAt !== null) return null;
    return 'You can only advance a player when a match is stuck (no result after 10 minutes) or nobody showed up';
  }

  /** Host: advances one of the two players of a stuck match (or after a double no-show). Logged publicly. */
  public static hostAdvance(state: TournamentServerState, hostId: string, matchId: string, userId: string, now: number): TournamentEffects {
    this.requireHost(state, hostId);
    const m = this.match(state, matchId);
    if (!m) throw new GameRuleError('INVALID_INPUT', 'That match does not exist');
    if (m.a !== userId && m.b !== userId) throw new GameRuleError('INVALID_INPUT', 'That player is not in this match');
    const problem = this.hostAdvanceProblem(state, m, now);
    if (problem) throw new GameRuleError('ILLEGAL_MOVE', problem);
    const effects = noEffects();
    const why = m.doubleNoShowAt !== null ? 'nobody showed up' : 'the match was stuck';
    this.log(state, 'host', `The organiser advanced ${this.name(state, userId)} (${why}, ${this.label(state, m)}).`, now, m.id);
    this.finishMatch(state, m, userId, 'host_advance', now, effects, true);
    this.settle(state, now, effects);
    return effects;
  }

  // -------------------------------------------------------------------
  // Leaving and aborting
  // -------------------------------------------------------------------

  /** Ends the tournament early (the organiser ended it or left, or too few players remain). Safe to call twice. */
  public static abort(state: TournamentServerState, message: string, now: number): TournamentEffects {
    const effects = noEffects();
    if (state.phase === 'ABORTED' || state.phase === 'COMPLETE') return effects;
    for (const m of state.matches) {
      if (m.status !== 'DONE' && m.roomId) effects.closeRooms.push(m.roomId);
    }
    state.phase = 'ABORTED';
    state.endedAt = now;
    state.statusMessage = message;
    this.log(state, 'system', message, now);
    return effects;
  }

  /** The organiser left for good: the tournament ends. */
  public static hostLeft(state: TournamentServerState, now: number): TournamentEffects {
    if (state.host.left) return noEffects();
    state.host.left = true;
    state.host.connected = false;
    return this.abort(state, 'The organiser left, so the tournament ended.', now);
  }

  /**
   * A player left the tournament for good (explicit leave). Every remaining match of theirs is forfeited: the current opponent advances.
   * With fewer than 2 players left the tournament ends instead. Leaving a finished tournament changes nothing.
   */
  public static playerLeft(state: TournamentServerState, userId: string, now: number): TournamentEffects {
    const effects = noEffects();
    const p = this.player(state, userId);
    if (!p || p.left || state.phase !== 'RUNNING') return effects;
    p.left = true;
    p.connected = false;
    this.log(state, 'forfeit', `${p.displayName} left the tournament.`, now);
    if (state.players.filter((x) => !x.left).length < 2) {
      const aborted = this.abort(state, 'Fewer than 2 players are left, so the tournament ended.', now);
      effects.closeRooms.push(...aborted.closeRooms);
      return effects;
    }
    this.settle(state, now, effects);
    return effects;
  }

  public static setConnected(state: TournamentServerState, userId: string, connected: boolean): void {
    if (state.host.userId === userId) {
      if (!state.host.left) state.host.connected = connected;
      return;
    }
    const p = this.player(state, userId);
    if (p && !p.left) p.connected = connected;
  }

  /** Match of `userId` that is waiting for them or running right now (their current room). */
  public static activeMatchOf(state: TournamentServerState, userId: string): TournamentMatch | undefined {
    return state.matches.find((m) => (m.status === 'PENDING_PLAYERS' || m.status === 'LIVE') && (m.a === userId || m.b === userId));
  }

  // -------------------------------------------------------------------
  // Standings
  // -------------------------------------------------------------------

  public static standings(state: TournamentServerState): TournamentStandings {
    const done = state.matches.filter((m) => m.status === 'DONE');
    const finalRound = state.rounds;
    const rank = new Map<string, { rank: number; label: string }>();
    const third = state.matches.find((m) => m.kind === 'THIRD');
    if (state.championUserId) rank.set(state.championUserId, { rank: 1, label: 'Champion' });
    if (state.runnerUpUserId) rank.set(state.runnerUpUserId, { rank: 2, label: 'Runner-up' });
    if (third?.status === 'DONE') {
      if (third.winnerUserId) rank.set(third.winnerUserId, { rank: 3, label: 'Third place' });
      if (third.loserUserId) rank.set(third.loserUserId, { rank: 4, label: 'Fourth place' });
    }
    for (const m of done) {
      if (m.kind !== 'MAIN' || !m.loserUserId || rank.has(m.loserUserId)) continue;
      const base = state.bracketSize / 2 ** m.round + 1;
      rank.set(m.loserUserId, { rank: base, label: m.round === finalRound - 1 ? 'Semi-finalist' : `Out in the ${m.roundName}` });
    }
    const wins = new Map<string, number>();
    const losses = new Map<string, number>();
    for (const m of done) {
      if (m.bye || !m.winnerUserId) continue;
      wins.set(m.winnerUserId, (wins.get(m.winnerUserId) ?? 0) + 1);
      if (m.loserUserId) losses.set(m.loserUserId, (losses.get(m.loserUserId) ?? 0) + 1);
    }
    const rows: TournamentStandingRow[] = state.players
      .map((p) => {
        const r = rank.get(p.userId) ?? { rank: state.players.length, label: 'Did not play' };
        return {
          rank: r.rank,
          userId: p.userId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl ?? null,
          seed: p.seed,
          label: r.label,
          matchWins: wins.get(p.userId) ?? 0,
          matchLosses: losses.get(p.userId) ?? 0,
          left: p.left
        };
      })
      .sort((a, b) => a.rank - b.rank || a.seed - b.seed);
    return {
      championUserId: state.championUserId,
      runnerUpUserId: state.runnerUpUserId,
      thirdPlaceUserId: third?.status === 'DONE' ? state.thirdPlaceUserId : null,
      rows
    };
  }

  // -------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------

  /** True for the full server state (it carries the internal bookkeeping); false for a view. */
  public static isServerState(state: unknown): boolean {
    const s = state as any;
    return Boolean(s && typeof s === 'object' && s.game === 'tournament' && s.internal && typeof s.internal === 'object');
  }

  /**
   * The view for ONE recipient. Nothing in a tournament is secret; the view only drops the internal bookkeeping (the kick list) and adds
   * the viewer's own summary (`me`). Spectators and strangers get `me.role = 'spectator'`.
   */
  public static publicStateFor(state: TournamentServerState | TournamentGameView | null | undefined, viewerId: string | null | undefined, now: number = Date.now()): TournamentGameView | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as TournamentGameView; // already a view
    const s = state as TournamentServerState;
    const isHost = typeof viewerId === 'string' && viewerId === s.host.userId && !s.host.left;
    const viewer = typeof viewerId === 'string' ? this.player(s, viewerId) : undefined;
    const standings = s.phase === 'COMPLETE' ? this.standings(s) : null;
    let me: TournamentMe | null = null;
    if (isHost) {
      me = { role: 'host', seed: null, eliminated: false, left: false, activeMatchId: null, upcomingMatchId: null, rank: null };
    } else if (viewer) {
      const active = this.activeMatchOf(s, viewer.userId);
      const placed = !viewer.left && !viewer.eliminated
        ? s.matches.find((m) => m.status === 'SCHEDULED' && m.kind === 'MAIN' && (m.a === viewer.userId || m.b === viewer.userId))
        : undefined;
      const following = active && active.kind === 'MAIN' ? this.nextMain(s, active) : undefined;
      const upcoming = placed ?? (following && following.status === 'SCHEDULED' ? following : undefined);
      me = {
        role: 'player',
        seed: viewer.seed,
        eliminated: viewer.eliminated,
        left: viewer.left,
        activeMatchId: active?.id ?? null,
        upcomingMatchId: upcoming?.id ?? null,
        rank: standings?.rows.find((r) => r.userId === viewer.userId)?.rank ?? null
      };
    } else if (s.phase === 'REGISTRATION') {
      // only seated people are in a lobby (watching needs a started tournament), and the lobby state does not list them
      me = { role: 'player', seed: null, eliminated: false, left: false, activeMatchId: null, upcomingMatchId: null, rank: null };
    } else {
      me = { role: 'spectator', seed: null, eliminated: false, left: false, activeMatchId: null, upcomingMatchId: null, rank: null };
    }
    return {
      game: 'tournament',
      phase: s.phase,
      host: { ...s.host },
      config: { ...s.config },
      seedOrder: [...s.seedOrder],
      players: s.players.map((p) => ({ ...p })),
      matches: s.matches.map((m) => ({ ...m, srcA: { ...m.srcA }, srcB: { ...m.srcB }, joined: [...m.joined], games: m.games.map((g) => ({ ...g })) })),
      rounds: s.rounds,
      bracketSize: s.bracketSize,
      log: s.log.map((l) => ({ ...l })),
      standings,
      minPlayers: tournamentMinPlayers(),
      maxPlayers: TOURNAMENT_MAX_PLAYERS,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      serverNow: now,
      me,
      statusMessage: s.statusMessage
    };
  }

  /** The main match the winner of `m` moves on to (null for the Final). */
  private static nextMain(state: TournamentServerState, m: TournamentMatch): TournamentMatch | undefined {
    return state.matches.find((x) => x.kind === 'MAIN' && x.round === m.round + 1 && x.index === Math.floor(m.index / 2));
  }
}
