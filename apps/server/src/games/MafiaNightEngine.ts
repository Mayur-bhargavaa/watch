import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_SKIP_VOTE,
  MafiaChatChannel,
  MafiaGameView,
  MafiaInvestigation,
  MafiaLogEntry,
  MafiaNightAction,
  MafiaPlayer,
  MafiaRole,
  MafiaServerState,
  MafiaVoteResult,
  MafiaWinner,
  mafiaRoleCounts
} from '@synccinema/common';
import { secureInt } from '../util/random.js';
import { GameRuleError } from './GameRuleError.js';

/**
 * Mafia Night engine: pure, server-authoritative rules. No sockets, no timers, no database.
 *  - the clock is injected (`now` is epoch ms on every call) and the RNG is injectable, so tests are deterministic
 *  - the full state (`MafiaServerState`) holds every role and every night action; it never leaves the server.
 *    Every recipient gets `publicStateFor(state, viewerId)`, a redacted copy (the same idea as ImposterEngine.publicStateFor)
 *  - every action first settles any expired phase (`tick`), so a late message can never act on a finished phase
 */

/** Random integer in [0, maxExclusive). Defaults to crypto randomness. */
export type MafiaRng = (maxExclusive: number) => number;

const envMs = (name: string, fallback: number): number => {
  if (process.env.NODE_ENV === 'production') return fallback; // test-only timer switches are ignored in production
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 100 ? Math.floor(v) : fallback;
};

/** Phase lengths. Only the reveal / dawn / vote result length can be shortened for tests, through the environment. */
export const MAFIA_TIMING = {
  revealMs: envMs('MAFIA_REVEAL_MS', 8_000),
  nightMs: 30_000,
  dawnMs: envMs('MAFIA_DAWN_MS', 8_000),
  dayMs: 60_000,
  voteMs: 30_000,
  voteResultMs: envMs('MAFIA_VOTE_RESULT_MS', 8_000)
} as const;

/** When a phase expires and the tick is at most this late, the next phase starts at the old deadline (no drift between phases). */
const CHAIN_SLACK_MS = 2_000;

/** The game aborts when fewer than this many players (still seated) remain. */
export const MAFIA_MIN_ACTIVE = 3;

/**
 * TESTING ONLY: MAFIA_TEST_MIN_PLAYERS=2..5 lets a lobby start with fewer players so one person can try the game with a few
 * browsers (2 players: Mafia + Detective; 3: + a Villager). Ignored in production and for any other value; the default stays 5.
 */
export function mafiaMinPlayers(): number {
  const n = Number(process.env.MAFIA_TEST_MIN_PLAYERS);
  return process.env.NODE_ENV !== 'production' && Number.isInteger(n) && n >= 2 && n <= MAFIA_MIN_PLAYERS ? n : MAFIA_MIN_PLAYERS;
}
/** Seated players below which a running game aborts. */
export function mafiaMinActive(): number {
  return Math.min(MAFIA_MIN_ACTIVE, mafiaMinPlayers());
}

export interface MafiaSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  connected?: boolean;
}

const RUNNING = new Set(['ROLE_REVEAL', 'NIGHT', 'DAWN', 'DAY', 'VOTE', 'VOTE_RESULT']);

export const ROLE_LABEL: Record<MafiaRole, string> = { mafia: 'Mafia', doctor: 'Doctor', detective: 'Detective', villager: 'Villager' };

// ---------------------------------------------------------------------
// Rate limiting (night action / vote / ready / chat messages), keyed by `${roomId}:${userId}:${kind}`
// ---------------------------------------------------------------------

const rateBuckets = new Map<string, number[]>();

export function mafiaRateAllowed(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearMafiaRate(roomId: string): void {
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.startsWith(`${roomId}:`)) rateBuckets.delete(key);
  }
}

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

export class MafiaNightEngine {
  /** Players that are still in the game (not left for good), in seat order. */
  public static activePlayers(state: MafiaServerState): MafiaPlayer[] {
    return state.players.filter((p) => !p.left);
  }

  public static livingPlayers(state: MafiaServerState): MafiaPlayer[] {
    return state.players.filter((p) => !p.left && p.alive);
  }

  private static connectedLiving(state: MafiaServerState): MafiaPlayer[] {
    return state.players.filter((p) => !p.left && p.alive && p.connected);
  }

  private static findPlayer(state: MafiaServerState, userId: unknown): MafiaPlayer | undefined {
    return typeof userId === 'string' ? state.players.find((p) => p.userId === userId) : undefined;
  }

  private static requirePlayer(state: MafiaServerState, userId: string): MafiaPlayer {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) throw new GameRuleError('NOT_PLAYER', 'You are not a player in this game');
    return p;
  }

  private static requireLiving(state: MafiaServerState, userId: string): MafiaPlayer {
    const p = this.requirePlayer(state, userId);
    if (!p.alive) throw new GameRuleError('ILLEGAL_MOVE', 'You are out of the game');
    return p;
  }

  private static roleOf(state: MafiaServerState, userId: string): MafiaRole | undefined {
    return state.secret.roles[userId];
  }

  private static name(state: MafiaServerState, userId: string | null | undefined): string {
    return (userId && this.findPlayer(state, userId)?.displayName) || 'Someone';
  }

  private static setPhase(state: MafiaServerState, phase: MafiaServerState['phase'], now: number, durationMs: number | null): void {
    state.phase = phase;
    state.phaseEndsAt = durationMs === null ? null : now + durationMs;
    state.phaseDurationMs = durationMs ?? 0;
  }

  /** Roles for `n` players in a random order (Fisher-Yates over the role list with the injected RNG). */
  public static dealRoles(userIds: string[], rng: MafiaRng = secureInt): Record<string, MafiaRole> {
    const c = mafiaRoleCounts(userIds.length);
    const deck: MafiaRole[] = [
      ...Array<MafiaRole>(c.mafia).fill('mafia'),
      ...Array<MafiaRole>(c.doctor).fill('doctor'),
      ...Array<MafiaRole>(c.detective).fill('detective'),
      ...Array<MafiaRole>(c.villager).fill('villager')
    ];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = rng(i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const roles: Record<string, MafiaRole> = {};
    userIds.forEach((id, i) => { roles[id] = deck[i]; });
    return roles;
  }

  /** New game: validates the seats, deals the roles and enters ROLE_REVEAL. */
  public static createInitialState(seats: MafiaSeat[], now: number, opts: { rng?: MafiaRng } = {}): MafiaServerState {
    if (!Array.isArray(seats) || seats.length < mafiaMinPlayers() || seats.length > MAFIA_MAX_PLAYERS) {
      throw new GameRuleError('INVALID_INPUT', `Mafia Night needs ${mafiaMinPlayers()} to ${MAFIA_MAX_PLAYERS} players`);
    }
    if (new Set(seats.map((s) => s.userId)).size !== seats.length) {
      throw new GameRuleError('INVALID_INPUT', 'Duplicate player in the game');
    }
    const players: MafiaPlayer[] = [...seats]
      .sort((a, b) => a.seat - b.seat)
      .map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl ?? null,
        seat: s.seat,
        connected: s.connected !== false,
        left: false,
        alive: true,
        role: null
      }));
    const state: MafiaServerState = {
      game: 'mafia-night',
      phase: 'ROLE_REVEAL',
      round: 0,
      players,
      phaseEndsAt: null,
      phaseDurationMs: 0,
      readyToVote: [],
      voteHistory: [],
      log: [],
      winner: null,
      statusMessage: 'Check your role.',
      secret: { roles: this.dealRoles(players.map((p) => p.userId), opts.rng ?? secureInt) },
      night: { kill: {}, seq: 0, save: null, check: null, lastSaved: null },
      investigations: {},
      votes: {},
      lastDawnDeath: null,
      lastVote: null
    };
    this.setPhase(state, 'ROLE_REVEAL', now, MAFIA_TIMING.revealMs);
    return state;
  }

  // -------------------------------------------------------------------
  // Win condition
  // -------------------------------------------------------------------

  /** Town wins when no mafia is left alive; the mafia win when the living mafia are at least as many as the living others. */
  public static checkWin(state: MafiaServerState): MafiaWinner | null {
    const living = this.livingPlayers(state);
    const mafia = living.filter((p) => this.roleOf(state, p.userId) === 'mafia').length;
    const others = living.length - mafia;
    if (mafia === 0) return 'town';
    // Test-size games (under 4 seated players) need a strict majority, otherwise 1 mafia vs 1 other ends the game at the first dawn
    if (state.players.length < 4 ? mafia > others : mafia >= others) return 'mafia';
    return null;
  }

  private static finishGame(state: MafiaServerState, winner: MafiaWinner): void {
    state.winner = winner;
    // game over: every role becomes public
    for (const p of state.players) p.role = this.roleOf(state, p.userId) ?? null;
    state.readyToVote = [];
    state.statusMessage = winner === 'town' ? 'The town wins! Every mafia member is gone.' : 'The mafia win! They now match the town.';
    this.setPhase(state, 'FINISHED', 0, null);
  }

  // -------------------------------------------------------------------
  // Phase machine
  // -------------------------------------------------------------------

  private static startNight(state: MafiaServerState, now: number): void {
    state.round += 1;
    state.night.kill = {};
    state.night.save = null;
    state.night.check = null;
    state.votes = {};
    state.readyToVote = [];
    state.lastVote = null;
    state.lastDawnDeath = null;
    state.statusMessage = `Night ${state.round}. The town sleeps.`;
    this.setPhase(state, 'NIGHT', now, MAFIA_TIMING.nightMs);
  }

  /** Kills a player: they stop playing and their role becomes public. */
  private static eliminate(state: MafiaServerState, userId: string): void {
    const p = this.findPlayer(state, userId);
    if (!p || !p.alive) return;
    p.alive = false;
    p.role = this.roleOf(state, userId) ?? null;
    delete state.votes[userId];
    delete state.night.kill[userId];
    state.readyToVote = state.readyToVote.filter((id) => id !== userId);
  }

  /** The mafia's victim: the most chosen target among the living mafia; a tie goes to the most recent choice. */
  private static chosenVictim(state: MafiaServerState): string | null {
    const counts = new Map<string, { n: number; seq: number }>();
    for (const [mafiaId, choice] of Object.entries(state.night.kill)) {
      const m = this.findPlayer(state, mafiaId);
      const t = this.findPlayer(state, choice.target);
      if (!m || m.left || !m.alive || this.roleOf(state, mafiaId) !== 'mafia') continue;
      if (!t || t.left || !t.alive || this.roleOf(state, t.userId) === 'mafia') continue;
      const cur = counts.get(choice.target) ?? { n: 0, seq: 0 };
      counts.set(choice.target, { n: cur.n + 1, seq: Math.max(cur.seq, choice.seq) });
    }
    let best: string | null = null;
    let bestN = 0;
    let bestSeq = -1;
    for (const [target, c] of counts) {
      if (c.n > bestN || (c.n === bestN && c.seq > bestSeq)) { best = target; bestN = c.n; bestSeq = c.seq; }
    }
    return best;
  }

  /** End of NIGHT: the victim dies unless the doctor saved them; the detective gets an answer. Says nothing about a save. */
  private static resolveNight(state: MafiaServerState, now: number): void {
    const victim = this.chosenVictim(state);
    const doctor = state.players.find((p) => this.roleOf(state, p.userId) === 'doctor');
    const saveTarget = doctor && !doctor.left && doctor.alive ? state.night.save : null;
    const diedId = victim && victim !== saveTarget ? victim : null;

    // the detective's answer, computed from the real roles BEFORE anyone dies (a dying detective still learns it)
    const detective = state.players.find((p) => this.roleOf(state, p.userId) === 'detective');
    if (detective && !detective.left && detective.alive && state.night.check) {
      const target = this.findPlayer(state, state.night.check);
      if (target && !target.left) {
        const list = (state.investigations[detective.userId] ??= []);
        list.push({ round: state.round, targetUserId: target.userId, isMafia: this.roleOf(state, target.userId) === 'mafia' });
      }
    }

    state.night.lastSaved = saveTarget;
    state.night.save = null;
    state.night.check = null;
    state.night.kill = {};

    state.lastDawnDeath = diedId;
    if (diedId) {
      this.eliminate(state, diedId);
      const role = this.roleOf(state, diedId) ?? null;
      const text = `${this.name(state, diedId)} was killed in the night. They were ${role === 'mafia' ? 'in the Mafia' : `a ${ROLE_LABEL[role ?? 'villager']}`}.`;
      state.log.push({ round: state.round, kind: 'night_death', userId: diedId, role, text });
      state.statusMessage = text;
    } else {
      const text = 'Nobody died in the night.';
      state.log.push({ round: state.round, kind: 'night_peace', userId: null, role: null, text });
      state.statusMessage = text;
    }
    this.setPhase(state, 'DAWN', now, MAFIA_TIMING.dawnMs);
  }

  private static beginDay(state: MafiaServerState, now: number): void {
    state.readyToVote = [];
    state.statusMessage = 'Discuss who the mafia could be, then vote.';
    this.setPhase(state, 'DAY', now, MAFIA_TIMING.dayMs);
  }

  private static beginVote(state: MafiaServerState, now: number): void {
    state.votes = {};
    state.statusMessage = 'Vote to eliminate a player, or skip.';
    this.setPhase(state, 'VOTE', now, MAFIA_TIMING.voteMs);
  }

  /** Counts the votes of living players for living players (or skip). */
  private static tally(state: MafiaServerState): { votes: Record<string, string>; tally: Record<string, number> } {
    const votes: Record<string, string> = {};
    const tally: Record<string, number> = {};
    for (const [voter, target] of Object.entries(state.votes)) {
      const v = this.findPlayer(state, voter);
      if (!v || v.left || !v.alive) continue;
      if (target !== MAFIA_SKIP_VOTE) {
        const t = this.findPlayer(state, target);
        if (!t || t.left || !t.alive || voter === target) continue;
      }
      votes[voter] = target;
      tally[target] = (tally[target] ?? 0) + 1;
    }
    return { votes, tally };
  }

  /** End of VOTE: more than half of the living players must pick the same player to eliminate them; ties and a skip majority eliminate nobody. */
  private static resolveVotes(state: MafiaServerState, now: number): void {
    const { votes, tally } = this.tally(state);
    const living = this.livingPlayers(state).length;
    const needed = Math.floor(living / 2) + 1;
    const players = Object.entries(tally).filter(([t]) => t !== MAFIA_SKIP_VOTE);
    const topN = Math.max(0, ...players.map(([, n]) => n));
    const top = players.filter(([, n]) => n === topN && topN > 0).map(([id]) => id);
    const skipN = tally[MAFIA_SKIP_VOTE] ?? 0;

    let outcome: MafiaVoteResult['outcome'];
    let eliminated: string | null = null;
    let text: string;
    if (top.length === 1 && topN >= needed) {
      outcome = 'eliminated';
      eliminated = top[0];
    } else if (skipN >= needed) {
      outcome = 'skip';
    } else if (top.length > 1) {
      outcome = 'tie';
    } else {
      outcome = 'no_majority';
    }

    let role: MafiaRole | null = null;
    if (eliminated) {
      role = this.roleOf(state, eliminated) ?? null;
      this.eliminate(state, eliminated);
      text = `${this.name(state, eliminated)} was voted out. They were ${role === 'mafia' ? 'in the Mafia' : `a ${ROLE_LABEL[role ?? 'villager']}`}.`;
      state.log.push({ round: state.round, kind: 'elimination', userId: eliminated, role, text });
    } else {
      text = outcome === 'skip' ? 'The town chose to skip. Nobody was eliminated.' : outcome === 'tie' ? 'The vote was tied. Nobody was eliminated.' : 'No player got a majority. Nobody was eliminated.';
      state.log.push({ round: state.round, kind: 'no_elimination', userId: null, role: null, text });
    }
    const result: MafiaVoteResult = { round: state.round, votes, tally, needed, outcome, eliminatedUserId: eliminated, eliminatedRole: role, text };
    state.voteHistory.push(result);
    state.lastVote = result;
    state.statusMessage = text;
    state.votes = {};
    this.setPhase(state, 'VOTE_RESULT', now, MAFIA_TIMING.voteResultMs);
  }

  /** Ends the game early without a winner (not enough players left). Safe to call twice. Reveals nothing. */
  public static abort(state: MafiaServerState, message: string): void {
    if (state.phase === 'ABORTED' || state.phase === 'FINISHED') return;
    state.phase = 'ABORTED';
    state.phaseEndsAt = null;
    state.phaseDurationMs = 0;
    state.winner = 'none';
    state.statusMessage = message;
  }

  /**
   * Applies everything that is due at `now`: expired phases, "everybody is ready / has voted". Returns true when the state
   * changed. Call it from the server timer and before every action.
   */
  public static tick(state: MafiaServerState, now: number): boolean {
    let changed = false;
    for (let guard = 0; guard < 64; guard++) {
      if (state.phase === 'FINISHED' || state.phase === 'ABORTED') break;
      if (this.activePlayers(state).length < mafiaMinActive()) {
        this.abort(state, 'Not enough players are left to continue.');
        changed = true;
        break;
      }
      const due = state.phaseEndsAt !== null && now >= state.phaseEndsAt;
      const startAt = due && now - (state.phaseEndsAt as number) <= CHAIN_SLACK_MS ? (state.phaseEndsAt as number) : now;
      let progressed = false;

      switch (state.phase) {
        case 'ROLE_REVEAL':
          if (due) { this.startNight(state, startAt); progressed = true; }
          break;
        case 'NIGHT':
          // A fixed length on purpose: an early end would show how many players had a night action to take.
          if (due) { this.resolveNight(state, startAt); progressed = true; }
          break;
        case 'DAWN':
          if (due) {
            const w = this.checkWin(state);
            if (w) this.finishGame(state, w); else this.beginDay(state, startAt);
            progressed = true;
          }
          break;
        case 'DAY': {
          const present = this.connectedLiving(state);
          const everyoneReady = present.length > 0 && present.every((p) => state.readyToVote.includes(p.userId));
          if (due || everyoneReady) { this.beginVote(state, due ? startAt : now); progressed = true; }
          break;
        }
        case 'VOTE': {
          const present = this.connectedLiving(state);
          const everyoneVoted = present.length > 0 && present.every((p) => state.votes[p.userId] !== undefined);
          if (due || everyoneVoted) { this.resolveVotes(state, due ? startAt : now); progressed = true; }
          break;
        }
        case 'VOTE_RESULT':
          if (due) {
            const w = this.checkWin(state);
            if (w) this.finishGame(state, w); else this.startNight(state, startAt);
            progressed = true;
          }
          break;
      }
      if (!progressed) break;
      changed = true;
    }
    return changed;
  }

  // -------------------------------------------------------------------
  // Player actions (each throws GameRuleError for anything out of phase / role / invalid)
  // -------------------------------------------------------------------

  /**
   * One secret night action. `action` must be the one of the sender's real role (the server never trusts the client's idea of its
   * role). Returns false when nothing changed (the same choice again). A mafia member may change their pick until the night ends
   * (the latest choice counts); the doctor and the detective choose once.
   */
  public static submitNightAction(state: MafiaServerState, userId: string, action: MafiaNightAction, targetId: unknown, now: number): boolean {
    this.tick(state, now);
    const me = this.requireLiving(state, userId);
    if (state.phase !== 'NIGHT') throw new GameRuleError('WRONG_PHASE', 'It is not night');
    const role = this.roleOf(state, userId);
    const expected: MafiaNightAction | null = role === 'mafia' ? 'kill' : role === 'doctor' ? 'save' : role === 'detective' ? 'investigate' : null;
    if (!expected) throw new GameRuleError('ILLEGAL_MOVE', 'Your role has no night action');
    if (action !== expected) throw new GameRuleError('ILLEGAL_MOVE', 'That action does not belong to your role');
    if (typeof targetId !== 'string') throw new GameRuleError('INVALID_INPUT', 'Pick a player');
    const target = this.findPlayer(state, targetId);
    if (!target || target.left || !target.alive) throw new GameRuleError('INVALID_INPUT', 'Pick a player who is still alive');

    if (expected === 'kill') {
      if (targetId === me.userId || this.roleOf(state, targetId) === 'mafia') throw new GameRuleError('ILLEGAL_MOVE', 'You cannot target a member of the mafia');
      if (state.night.kill[userId]?.target === targetId) return false;
      state.night.kill[userId] = { target: targetId, seq: ++state.night.seq };
      return true;
    }
    if (expected === 'save') {
      if (targetId === state.night.lastSaved) throw new GameRuleError('ILLEGAL_MOVE', 'You cannot save the same player two nights in a row');
      if (state.night.save !== null) {
        if (state.night.save === targetId) return false;
        throw new GameRuleError('ALREADY_VOTED', 'You already made your choice tonight');
      }
      state.night.save = targetId;
      return true;
    }
    if (targetId === me.userId) throw new GameRuleError('ILLEGAL_MOVE', 'You cannot investigate yourself');
    if (state.night.check !== null) {
      if (state.night.check === targetId) return false;
      throw new GameRuleError('ALREADY_VOTED', 'You already made your choice tonight');
    }
    state.night.check = targetId;
    return true;
  }

  /** "Ready to vote" shortcut during DAY (living players only). Returns false when the player was already ready. */
  public static markReady(state: MafiaServerState, userId: string, now: number): boolean {
    this.tick(state, now);
    this.requireLiving(state, userId);
    if (state.phase !== 'DAY') throw new GameRuleError('WRONG_PHASE', 'Discussion is not running right now');
    if (state.readyToVote.includes(userId)) return false;
    state.readyToVote.push(userId);
    this.tick(state, now);
    return true;
  }

  /** One vote (a living player, or `skip`) during VOTE. Repeating the same vote is a no-op (false); changing it is refused. */
  public static castVote(state: MafiaServerState, voterId: string, targetId: unknown, now: number): boolean {
    this.tick(state, now);
    this.requireLiving(state, voterId);
    if (state.phase !== 'VOTE') throw new GameRuleError('WRONG_PHASE', 'Voting is not open right now');
    if (typeof targetId !== 'string') throw new GameRuleError('INVALID_INPUT', 'Pick a player to vote for');
    if (targetId !== MAFIA_SKIP_VOTE) {
      if (targetId === voterId) throw new GameRuleError('ILLEGAL_MOVE', 'You cannot vote for yourself');
      const target = this.findPlayer(state, targetId);
      if (!target || target.left) throw new GameRuleError('INVALID_INPUT', 'That player is not in this game');
      if (!target.alive) throw new GameRuleError('INVALID_INPUT', 'That player is already out of the game');
    }
    const existing = state.votes[voterId];
    if (existing !== undefined) {
      if (existing === targetId) return false;
      throw new GameRuleError('ALREADY_VOTED', 'Your vote is final');
    }
    state.votes[voterId] = targetId;
    this.tick(state, now);
    return true;
  }

  // -------------------------------------------------------------------
  // Chat channels
  // -------------------------------------------------------------------

  /**
   * Which channel a player's chat message goes to right now, or a CHAT_LOCKED error:
   *  - living players chat in the town square during DAY and VOTE only
   *  - during NIGHT only the living mafia can chat, to each other
   *  - dead players (and players who left) chat in the graveyard, with the other dead players only
   *  - once the game is over (or never started) everybody chats in the open
   */
  public static chatChannelFor(state: MafiaServerState | MafiaGameView, userId: string): MafiaChatChannel {
    const p = this.findPlayer(state as MafiaServerState, userId);
    if (!p) throw new GameRuleError('NOT_PLAYER', 'You are not a player in this game');
    if (state.phase === 'FINISHED' || state.phase === 'ABORTED') return 'town';
    if (!p.alive || p.left) return 'dead';
    if (state.phase === 'DAY' || state.phase === 'VOTE') return 'town';
    if (state.phase === 'NIGHT' && this.isServerState(state) && this.roleOf(state as MafiaServerState, userId) === 'mafia') return 'mafia';
    throw new GameRuleError('CHAT_LOCKED', state.phase === 'NIGHT' ? 'The town is asleep. Chat opens at dawn.' : 'Chat opens during the day.');
  }

  /** Can this viewer read messages of `channel` right now? (Used for the chat history and for every chat broadcast.) */
  public static canReadChannel(state: MafiaServerState | null | undefined, viewerId: string | null | undefined, channel: MafiaChatChannel): boolean {
    if (!state || !this.isServerState(state)) return channel === 'town';
    if (channel === 'town') return true;
    const p = typeof viewerId === 'string' ? this.findPlayer(state, viewerId) : undefined;
    if (!p) return false; // spectators / strangers: public channel only
    if (channel === 'dead') return !p.alive || p.left;
    return p.alive && !p.left && this.roleOf(state, p.userId) === 'mafia';
  }

  // -------------------------------------------------------------------
  // Connection / membership
  // -------------------------------------------------------------------

  public static setConnected(state: MafiaServerState, userId: string, connected: boolean): void {
    const p = this.findPlayer(state, userId);
    if (p && !p.left) p.connected = connected;
  }

  /**
   * A player left for good (explicit leave, or the reconnect window ran out). They count as dead (their role is revealed) and
   * the game goes on; fewer than 3 players left aborts it; if that ends the fight the game finishes at once.
   * Returns true when the game was aborted.
   */
  public static removePlayer(state: MafiaServerState, userId: string, now: number): boolean {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) return state.phase === 'ABORTED';
    const wasAlive = p.alive;
    p.left = true;
    p.connected = false;
    delete state.votes[userId];
    for (const [voter, target] of Object.entries(state.votes)) {
      if (target === userId) delete state.votes[voter];
    }
    delete state.night.kill[userId];
    const leaverRole = this.roleOf(state, userId);
    if (state.night.save === userId || leaverRole === 'doctor') state.night.save = null;
    if (state.night.check === userId || leaverRole === 'detective') state.night.check = null;
    state.readyToVote = state.readyToVote.filter((id) => id !== userId);

    if (RUNNING.has(state.phase) && wasAlive) {
      const role = this.roleOf(state, userId) ?? null;
      this.eliminate(state, userId);
      state.log.push({
        round: state.round,
        kind: 'left',
        userId,
        role,
        text: `${p.displayName} left the game. They were ${role === 'mafia' ? 'in the Mafia' : `a ${ROLE_LABEL[role ?? 'villager']}`}.`
      });
    }
    if (this.activePlayers(state).length < mafiaMinActive()) {
      this.abort(state, 'Too few players are left, so the game ended.');
      return true;
    }
    if (RUNNING.has(state.phase)) {
      const w = this.checkWin(state);
      if (w) this.finishGame(state, w);
    }
    this.tick(state, now);
    return state.phase === 'ABORTED';
  }

  // -------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------

  /** True for the full server state (it still carries the roles); false for a redacted view. */
  public static isServerState(state: unknown): boolean {
    return Boolean(state && typeof state === 'object' && (state as any).secret !== undefined);
  }

  /**
   * The redacted copy of the state for ONE recipient. Rules:
   *  - a role is public only when its owner died / was voted out / left, or when the game is over; before that it goes to the owner
   *    alone (the mafia also see their living teammates)
   *  - night actions are never public: the actor sees their own pick (the mafia see their team's picks), the detective gets only
   *    their own answers
   *  - individual votes: nobody until the vote ends (you see your own vote and who has voted, not for whom)
   *  - dead players keep their own role and the public log, but not the roles or teammates of the living
   *  - spectators (and strangers) get the public view only (`me` is null)
   */
  public static publicStateFor(state: MafiaServerState | MafiaGameView | null | undefined, viewerId: string | null | undefined, now: number = Date.now()): MafiaGameView | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as MafiaGameView; // already redacted
    const s = state as MafiaServerState;
    const viewer = typeof viewerId === 'string' ? this.findPlayer(s, viewerId) : undefined;
    const over = s.phase === 'FINISHED';

    let me: MafiaGameView['me'] = null;
    if (viewer && !viewer.left) {
      const role = this.roleOf(s, viewer.userId) as MafiaRole;
      const live = viewer.alive && RUNNING.has(s.phase);
      const action: MafiaNightAction | null = !live ? null : role === 'mafia' ? 'kill' : role === 'doctor' ? 'save' : role === 'detective' ? 'investigate' : null;
      const nightLive = s.phase === 'NIGHT' && viewer.alive;
      const teamChoices: Record<string, string> = {};
      if (role === 'mafia' && viewer.alive && nightLive) {
        for (const [id, c] of Object.entries(s.night.kill)) {
          const m = this.findPlayer(s, id);
          if (m && !m.left && m.alive) teamChoices[id] = c.target;
        }
      }
      me = {
        role,
        alive: viewer.alive,
        teammates: role === 'mafia' && viewer.alive
          ? s.players.filter((p) => p.userId !== viewer.userId && !p.left && p.alive && this.roleOf(s, p.userId) === 'mafia').map((p) => p.userId)
          : [],
        nightAction: action,
        nightChoice: !nightLive ? null : role === 'mafia' ? s.night.kill[viewer.userId]?.target ?? null : role === 'doctor' ? s.night.save : role === 'detective' ? s.night.check : null,
        teamChoices,
        lastSavedUserId: role === 'doctor' ? s.night.lastSaved : null,
        investigations: role === 'detective' ? (s.investigations[viewer.userId] ?? []).map((i: MafiaInvestigation) => ({ ...i })) : []
      };
    }

    const result = s.phase === 'VOTE_RESULT' ? s.lastVote : null;
    const clone = (r: MafiaVoteResult): MafiaVoteResult => ({ ...r, votes: { ...r.votes }, tally: { ...r.tally } });

    return {
      game: 'mafia-night',
      phase: s.phase,
      round: s.round,
      // `role` of each player is already the public one (null while alive until the game is over)
      players: s.players.map((p) => ({ ...p, role: over ? this.roleOf(s, p.userId) ?? null : p.alive ? null : p.role })),
      phaseEndsAt: s.phaseEndsAt,
      phaseDurationMs: s.phaseDurationMs,
      serverNow: now,
      me,
      readyToVote: s.phase === 'DAY' ? [...s.readyToVote] : [],
      votedUserIds: s.phase === 'VOTE' ? Object.keys(s.votes) : [],
      myVote: viewer && !viewer.left && s.phase === 'VOTE' ? s.votes[viewer.userId] ?? null : null,
      dawnDeathUserId: s.phase === 'DAWN' ? s.lastDawnDeath : null,
      voteResult: result ? clone(result) : null,
      voteHistory: s.voteHistory.filter((h) => !(s.phase === 'VOTE_RESULT' && h === s.lastVote)).map(clone),
      log: s.log.map((l: MafiaLogEntry) => ({ ...l })),
      winner: over || s.phase === 'ABORTED' ? s.winner : null,
      statusMessage: s.statusMessage
    };
  }
}
