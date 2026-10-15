import {
  MURDER_CLUE_ROUNDS,
  MURDER_MAX_PLAYERS,
  MURDER_MAX_SHARES,
  MURDER_MIN_ACTIVE,
  MURDER_MIN_PLAYERS,
  MURDER_MOTIVE_MAX,
  MURDER_PHASE_SECONDS,
  MURDER_RANDOM_CASE,
  MURDER_SCORING,
  MURDER_WHISPERS_PER_ROUND,
  MURDER_WHISPER_MAX,
  MurderCaseDef,
  MurderCaseSummary,
  MurderCard,
  MurderEvidence,
  MurderGameView,
  MurderLogEntry,
  MurderMe,
  MurderPrivateClue,
  MurderPublicCharacter,
  MurderPublicRound,
  MurderResult,
  MurderScoreRow,
  MurderServerState,
  MurderWhisper
} from '@synccinema/common';
import { secureInt } from '../util/random.js';
import { GameRuleError } from './GameRuleError.js';
import { MURDER_CASES } from './murderMysteryCases.js';

/**
 * Murder Mystery Night engine: pure, server-authoritative rules. No sockets, no timers, no database.
 *  - the clock is injected (`now` is epoch ms on every call) and the RNG is injectable, so tests are deterministic
 *  - the full state (`MurderServerState`) holds the case id, who plays whom, every whisper and accusation; it never leaves the server.
 *    Every recipient gets `publicStateFor(state, viewerId)`, a redacted copy (the same idea as MafiaNightEngine.publicStateFor)
 *  - the case text itself is looked up in the catalogue (`MurderMysteryEngine.catalogue`, injectable for tests); private clues are
 *    never stored per player: the view of a player derives them from the round number and the character they play
 *  - every action first settles any expired phase (`tick`), so a late message can never act on a finished phase
 */

/** Random integer in [0, maxExclusive). Defaults to crypto randomness. */
export type MurderRng = (maxExclusive: number) => number;

const envMs = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 100 ? Math.floor(v) : fallback;
};

/** Phase lengths. Only the reveal / result length can be shortened for tests, through the environment. */
export const MURDER_TIMING = {
  revealMs: envMs('MURDER_REVEAL_MS', MURDER_PHASE_SECONDS.reveal * 1000),
  roundMs: MURDER_PHASE_SECONDS.round * 1000,
  accusationMs: MURDER_PHASE_SECONDS.accusation * 1000,
  resultMs: envMs('MURDER_RESULT_MS', MURDER_PHASE_SECONDS.result * 1000)
} as const;

/** When a phase expires and the tick is at most this late, the next phase starts at the old deadline (no drift between phases). */
const CHAIN_SLACK_MS = 2_000;
/** A host "next" within this time of a phase start is ignored (a double click must not skip two rounds). */
const ADVANCE_DWELL_MS = 2_000;

/**
 * TESTING ONLY: MURDER_TEST_MIN_PLAYERS=2..6 lets a lobby start with fewer players so one person can try the game with a few
 * browsers (2 players: the murderer + 1 other). Ignored in production and for any other value; the default stays 6.
 */
export function murderMinPlayers(): number {
  const n = Number(process.env.MURDER_TEST_MIN_PLAYERS);
  return process.env.NODE_ENV !== 'production' && Number.isInteger(n) && n >= 2 && n <= MURDER_MIN_PLAYERS ? n : MURDER_MIN_PLAYERS;
}
/** Seated players below which a running game aborts. */
export function murderMinActive(): number {
  return Math.min(MURDER_MIN_ACTIVE, murderMinPlayers());
}

export interface MurderSeat {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number;
  connected?: boolean;
}

const RUNNING = new Set(['CHARACTER_REVEAL', 'CLUE_ROUND', 'ACCUSATION']);

// ---------------------------------------------------------------------
// Rate limiting (accusation / whisper / share-clue / ready / chat), keyed by `${roomId}:${userId}:${kind}`
// ---------------------------------------------------------------------

const rateBuckets = new Map<string, number[]>();

export function murderRateAllowed(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export function clearMurderRate(roomId: string): void {
  for (const key of Array.from(rateBuckets.keys())) {
    if (key.startsWith(`${roomId}:`)) rateBuckets.delete(key);
  }
}

/** Plain text of a player message: control characters out, whitespace collapsed, trimmed. */
export function cleanMurderText(raw: unknown): string {
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------

function shuffle<T>(items: T[], rng: MurderRng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The characters used by a game of `n` players: always the murderer, then the `required` characters, then random others.
 * With fewer players than `required` (testing only) the murderer comes first and the rest of the places go to randomly picked
 * required characters. Returns the ids of the characters in the game and of the absent ones.
 */
export function pickCharacters(c: MurderCaseDef, n: number, rng: MurderRng = secureInt): { used: string[]; absent: string[] } {
  const murderer = c.solution.murdererId;
  const required = Array.from(new Set(c.required.filter((id) => id !== murderer)));
  const others = c.characters.map((x) => x.id).filter((id) => id !== murderer && !required.includes(id));
  let used: string[];
  if (n >= required.length + 1) {
    used = [murderer, ...required, ...shuffle(others, rng).slice(0, n - 1 - required.length)];
  } else {
    used = [murderer, ...shuffle(required, rng).slice(0, Math.max(0, n - 1))];
  }
  return { used, absent: c.characters.map((x) => x.id).filter((id) => !used.includes(id)) };
}

/** Deals the characters of a case to the players at random (the murderer's character goes to a random player). */
export function dealCharacters(c: MurderCaseDef, userIds: string[], rng: MurderRng = secureInt): { assignment: Record<string, string>; absent: string[]; murdererUserId: string } {
  const { used, absent } = pickCharacters(c, userIds.length, rng);
  const deck = shuffle(used, rng);
  const assignment: Record<string, string> = {};
  userIds.forEach((id, i) => { assignment[id] = deck[i]; });
  const murdererUserId = userIds.find((id) => assignment[id] === c.solution.murdererId) as string;
  return { assignment, absent, murdererUserId };
}

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

export class MurderMysteryEngine {
  /** The case catalogue (tests may replace it). */
  public static catalogue: readonly MurderCaseDef[] = MURDER_CASES;

  public static caseSummaries(): MurderCaseSummary[] {
    return this.catalogue.map((c) => ({ id: c.id, title: c.title, tagline: c.tagline, blurb: c.blurb, victimName: c.victim.name }));
  }

  private static caseById(id: string | null | undefined): MurderCaseDef | undefined {
    return id ? this.catalogue.find((c) => c.id === id) : undefined;
  }

  private static caseOf(state: MurderServerState): MurderCaseDef {
    const c = this.caseById(state.secret.caseId);
    if (!c) throw new GameRuleError('NOT_PLAYING', 'The case is not available');
    return c;
  }

  /** Players that are still in the game (not withdrawn), in seat order. */
  public static activePlayers(state: MurderServerState): MurderServerState['players'] {
    return state.players.filter((p) => !p.left);
  }

  private static connectedActive(state: MurderServerState): MurderServerState['players'] {
    return state.players.filter((p) => !p.left && p.connected);
  }

  private static findPlayer(state: MurderServerState, userId: unknown) {
    return typeof userId === 'string' ? state.players.find((p) => p.userId === userId) : undefined;
  }

  private static requirePlayer(state: MurderServerState, userId: string) {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) throw new GameRuleError('NOT_PLAYER', 'You are not a player in this game');
    return p;
  }

  private static setPhase(state: MurderServerState, phase: MurderServerState['phase'], now: number, durationMs: number | null): void {
    state.phase = phase;
    state.phaseEndsAt = durationMs === null ? null : now + durationMs;
    state.phaseDurationMs = durationMs ?? 0;
  }

  /** The lobby state a room carries before the game starts (the host picks the case here). */
  public static createLobbyState(opts: { usedCaseIds?: string[]; gamesPlayed?: number; caseChoice?: string } = {}): MurderServerState {
    return {
      game: 'murder-mystery',
      phase: 'LOBBY',
      round: 0,
      roundCount: MURDER_CLUE_ROUNDS,
      caseChoice: opts.caseChoice ?? MURDER_RANDOM_CASE,
      players: [],
      phaseEndsAt: null,
      phaseDurationMs: 0,
      log: [],
      evidence: [],
      readyUserIds: [],
      gamesPlayed: opts.gamesPlayed ?? 0,
      statusMessage: 'Waiting for the host to start.',
      secret: {
        caseId: null,
        assignment: {},
        absent: [],
        murdererUserId: null,
        accusations: {},
        accuseSeq: 0,
        whispers: [],
        whisperCounts: {},
        shared: {},
        whisperSeq: 0,
        usedCaseIds: opts.usedCaseIds ?? [],
        result: null
      }
    };
  }

  /** The host's case choice in the lobby: a catalogue id or `random`. Returns false when nothing changed. */
  public static pickCase(state: MurderServerState, choice: unknown): boolean {
    if (state.phase !== 'LOBBY') throw new GameRuleError('ILLEGAL_MOVE', 'The case can only be chosen in the lobby');
    if (typeof choice !== 'string' || (choice !== MURDER_RANDOM_CASE && !this.caseById(choice))) {
      throw new GameRuleError('INVALID_INPUT', 'Pick one of the cases or random');
    }
    if (state.caseChoice === choice) return false;
    state.caseChoice = choice;
    return true;
  }

  /** The case a new game plays: the host's choice, or (random / a rematch) a case not played yet in this room, never the last one twice. */
  public static chooseCase(choice: string, usedCaseIds: string[], rng: MurderRng = secureInt, forceDifferent = false): MurderCaseDef {
    const all = this.catalogue;
    if (all.length === 0) throw new GameRuleError('NOT_PLAYING', 'There are no cases');
    const last = usedCaseIds[usedCaseIds.length - 1];
    if (!forceDifferent && choice !== MURDER_RANDOM_CASE) {
      const picked = this.caseById(choice);
      if (picked) return picked;
    }
    let pool = all.filter((c) => !usedCaseIds.includes(c.id));
    if (pool.length === 0) pool = all.filter((c) => c.id !== last);
    if (pool.length === 0) pool = [...all];
    return pool[rng(pool.length)];
  }

  /**
   * New game: validates the seats, picks the case, deals the characters and enters CHARACTER_REVEAL.
   * `forceDifferent` (a rematch) never replays the case that was just played.
   */
  public static createInitialState(
    seats: MurderSeat[],
    now: number,
    opts: { rng?: MurderRng; caseChoice?: string; usedCaseIds?: string[]; gamesPlayed?: number; forceDifferent?: boolean } = {}
  ): MurderServerState {
    if (!Array.isArray(seats) || seats.length < murderMinPlayers() || seats.length > MURDER_MAX_PLAYERS) {
      throw new GameRuleError('INVALID_INPUT', `Murder Mystery Night needs ${murderMinPlayers()} to ${MURDER_MAX_PLAYERS} players`);
    }
    if (new Set(seats.map((s) => s.userId)).size !== seats.length) {
      throw new GameRuleError('INVALID_INPUT', 'Duplicate player in the game');
    }
    const rng = opts.rng ?? secureInt;
    const usedCaseIds = [...(opts.usedCaseIds ?? [])];
    const c = this.chooseCase(opts.caseChoice ?? MURDER_RANDOM_CASE, usedCaseIds, rng, Boolean(opts.forceDifferent));
    const sorted = [...seats].sort((a, b) => a.seat - b.seat);
    const deal = dealCharacters(c, sorted.map((s) => s.userId), rng);
    const state = this.createLobbyState({ usedCaseIds: [...usedCaseIds, c.id], gamesPlayed: opts.gamesPlayed ?? 0, caseChoice: opts.caseChoice ?? MURDER_RANDOM_CASE });
    state.players = sorted.map((s) => ({
      userId: s.userId,
      displayName: s.displayName,
      avatarUrl: s.avatarUrl ?? null,
      seat: s.seat,
      connected: s.connected !== false,
      left: false,
      characterId: deal.assignment[s.userId]
    }));
    state.secret.caseId = c.id;
    state.secret.assignment = deal.assignment;
    state.secret.absent = deal.absent;
    state.secret.murdererUserId = deal.murdererUserId;
    state.log.push({ round: 0, kind: 'start', text: `${c.victim.name} is dead. Everybody in the room is a suspect.` });
    state.statusMessage = 'Read your character card.';
    this.setPhase(state, 'CHARACTER_REVEAL', now, MURDER_TIMING.revealMs);
    return state;
  }

  // -------------------------------------------------------------------
  // Phase machine
  // -------------------------------------------------------------------

  private static startRound(state: MurderServerState, now: number): void {
    const c = this.caseOf(state);
    state.round += 1;
    state.readyUserIds = [];
    state.log.push({ round: state.round, kind: 'round', text: `Clue round ${state.round}: ${c.rounds[state.round - 1]?.title ?? ''}`.trim() });
    state.statusMessage = `Clue round ${state.round} of ${state.roundCount}. Discuss, whisper and compare what you know.`;
    this.setPhase(state, 'CLUE_ROUND', now, MURDER_TIMING.roundMs);
  }

  private static startAccusation(state: MurderServerState, now: number): void {
    state.readyUserIds = [];
    state.statusMessage = 'Time to accuse. Who did it, and why?';
    this.setPhase(state, 'ACCUSATION', now, MURDER_TIMING.accusationMs);
  }

  private static nextClueStep(state: MurderServerState, now: number): void {
    if (state.round < state.roundCount) this.startRound(state, now);
    else this.startAccusation(state, now);
  }

  /** The murderer's side of the table and the scores (see MURDER_SCORING). Pure given the accusations. */
  private static computeResult(state: MurderServerState): MurderResult {
    const c = this.caseOf(state);
    const murdererCharacterId = c.solution.murdererId;
    const murdererUserId = state.secret.murdererUserId as string;
    const murdererPlayer = this.findPlayer(state, murdererUserId);
    const murdererLeft = Boolean(murdererPlayer?.left);

    const accusations = state.secret.accusations;
    const live = state.players.filter((p) => !p.left);
    const others = live.filter((p) => p.userId !== murdererUserId);
    const isCorrect = (userId: string): boolean => accusations[userId]?.characterId === murdererCharacterId && userId !== murdererUserId;
    const correctPlayers = live.filter((p) => isCorrect(p.userId)).sort((a, b) => accusations[a.userId].seq - accusations[b.userId].seq);
    const correctCount = correctPlayers.length;
    const murdererSurvived = !murdererLeft && others.length > 0 && correctCount * 2 < others.length;

    const rows: MurderScoreRow[] = state.players.map((p) => {
      const acc = accusations[p.userId];
      const orderIdx = correctPlayers.findIndex((x) => x.userId === p.userId);
      const correct = orderIdx >= 0;
      const isMurderer = p.userId === murdererUserId;
      const sharedClues = Math.min(MURDER_MAX_SHARES, (state.secret.shared[p.userId] ?? []).length);
      const base = correct ? MURDER_SCORING.correct : 0;
      const speedBonus = correct && orderIdx < MURDER_SCORING.speedSlots ? MURDER_SCORING.speedBonus : 0;
      const murdererBonus = isMurderer && murdererSurvived ? MURDER_SCORING.murdererSurvives : 0;
      const shareBonus = sharedClues * MURDER_SCORING.perSharedClue;
      return {
        rank: 0,
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? null,
        characterId: state.secret.assignment[p.userId],
        left: p.left,
        isMurderer,
        accusedCharacterId: acc ? acc.characterId : null,
        accusedMotive: acc ? acc.motive : '',
        correct,
        correctOrder: correct ? orderIdx + 1 : null,
        base,
        speedBonus,
        murdererBonus,
        sharedClues,
        shareBonus,
        total: base + speedBonus + murdererBonus + shareBonus
      };
    });
    rows.sort((a, b) => b.total - a.total || (a.correctOrder ?? 99) - (b.correctOrder ?? 99) || (state.players.findIndex((p) => p.userId === a.userId) - state.players.findIndex((p) => p.userId === b.userId)));
    rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1; });
    const top = rows.filter((r) => r.rank === 1);

    const characters = state.players.map((p) => {
      const def = c.characters.find((x) => x.id === state.secret.assignment[p.userId]) as MurderCaseDef['characters'][number];
      return {
        id: def.id,
        name: def.name,
        userId: p.userId,
        relationship: def.relationship,
        secretMotive: def.secretMotive,
        alibi: def.alibi,
        alibiTruth: def.alibiTruth,
        secret: def.secret,
        isMurderer: def.id === murdererCharacterId,
        withdrawn: p.left
      };
    });

    return {
      murdererCharacterId,
      murdererUserId,
      motive: c.solution.motive,
      method: c.solution.method,
      summary: c.solution.summary,
      timeline: [...c.timeline],
      characters,
      rows,
      correctCount,
      otherCount: others.length,
      murdererSurvived,
      winnerUserId: top.length === 1 ? top[0].userId : null
    };
  }

  private static startResult(state: MurderServerState, now: number): void {
    const c = this.caseOf(state);
    state.readyUserIds = [];
    state.secret.result = this.computeResult(state);
    const murderer = c.characters.find((x) => x.id === c.solution.murdererId);
    state.log.push({ round: state.round, kind: 'result', text: `The murderer was ${murderer?.name ?? 'unknown'}.` });
    state.statusMessage = `The murderer was ${murderer?.name ?? 'unknown'}.`;
    this.setPhase(state, 'RESULT', now, MURDER_TIMING.resultMs);
  }

  private static finishGame(state: MurderServerState): void {
    state.readyUserIds = [];
    state.statusMessage = 'Case closed. Final leaderboard.';
    this.setPhase(state, 'FINAL', 0, null);
  }

  /** Ends the game early (not enough players left). Safe to call twice. Reveals nothing. */
  public static abort(state: MurderServerState, message: string): void {
    if (state.phase === 'ABORTED' || state.phase === 'FINAL') return;
    state.phase = 'ABORTED';
    state.phaseEndsAt = null;
    state.phaseDurationMs = 0;
    state.statusMessage = message;
  }

  /**
   * Applies everything that is due at `now`: expired phases, "everybody is ready / has accused". Returns true when the state
   * changed. Call it from the server timer and before every action.
   */
  public static tick(state: MurderServerState, now: number): boolean {
    let changed = false;
    for (let guard = 0; guard < 64; guard++) {
      if (state.phase === 'LOBBY' || state.phase === 'FINAL' || state.phase === 'ABORTED') break;
      if (RUNNING.has(state.phase) && this.activePlayers(state).length < murderMinActive()) {
        this.abort(state, 'Not enough players are left to continue.');
        changed = true;
        break;
      }
      const due = state.phaseEndsAt !== null && now >= state.phaseEndsAt;
      const startAt = due && now - (state.phaseEndsAt as number) <= CHAIN_SLACK_MS ? (state.phaseEndsAt as number) : now;
      let progressed = false;

      switch (state.phase) {
        case 'CHARACTER_REVEAL':
          if (due) { this.startRound(state, startAt); progressed = true; }
          break;
        case 'CLUE_ROUND': {
          const present = this.connectedActive(state);
          const everyoneReady = present.length > 0 && present.every((p) => state.readyUserIds.includes(p.userId));
          if (due || everyoneReady) { this.nextClueStep(state, due ? startAt : now); progressed = true; }
          break;
        }
        case 'ACCUSATION': {
          const present = this.connectedActive(state);
          const everyoneDone = present.length > 0 && present.every((p) => state.secret.accusations[p.userId] !== undefined);
          if (due || everyoneDone) { this.startResult(state, due ? startAt : now); progressed = true; }
          break;
        }
        case 'RESULT':
          if (due) { this.finishGame(state); progressed = true; }
          break;
      }
      if (!progressed) break;
      changed = true;
    }
    return changed;
  }

  // -------------------------------------------------------------------
  // Player actions (each throws GameRuleError for anything out of phase / invalid)
  // -------------------------------------------------------------------

  /**
   * Host pacing (the caller checks that the sender is the host): next clue round early (the last round goes to the accusation),
   * or RESULT to the final leaderboard. Returns false when nothing changed (a double press right after a phase started).
   */
  public static advance(state: MurderServerState, now: number): boolean {
    this.tick(state, now);
    if (state.phase !== 'CLUE_ROUND' && state.phase !== 'RESULT') throw new GameRuleError('WRONG_PHASE', 'Nothing to skip right now');
    const startedAt = (state.phaseEndsAt ?? now) - state.phaseDurationMs;
    if (now - startedAt < ADVANCE_DWELL_MS) return false;
    if (state.phase === 'RESULT') this.finishGame(state);
    else this.nextClueStep(state, now);
    this.tick(state, now);
    return true;
  }

  /** "Ready for the next round" during a clue round. Returns false when the player was already ready. */
  public static markReady(state: MurderServerState, userId: string, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    if (state.phase !== 'CLUE_ROUND') throw new GameRuleError('WRONG_PHASE', 'Discussion is not running right now');
    if (state.readyUserIds.includes(userId)) return false;
    state.readyUserIds.push(userId);
    this.tick(state, now);
    return true;
  }

  /** A private whisper to one other player (clue rounds only, 5 per round, 140 characters). */
  public static whisper(state: MurderServerState, fromUserId: string, toUserId: unknown, text: unknown, now: number): MurderWhisper {
    this.tick(state, now);
    this.requirePlayer(state, fromUserId);
    if (state.phase !== 'CLUE_ROUND') throw new GameRuleError('WRONG_PHASE', 'Whispers are only possible during a clue round');
    if (typeof toUserId !== 'string') throw new GameRuleError('INVALID_INPUT', 'Pick a player to whisper to');
    if (toUserId === fromUserId) throw new GameRuleError('ILLEGAL_MOVE', 'You cannot whisper to yourself');
    const to = this.findPlayer(state, toUserId);
    if (!to || to.left) throw new GameRuleError('INVALID_INPUT', 'That player is not in the game');
    const clean = cleanMurderText(text);
    if (!clean) throw new GameRuleError('INVALID_INPUT', 'Write something to whisper');
    if (clean.length > MURDER_WHISPER_MAX) throw new GameRuleError('INVALID_INPUT', `A whisper is at most ${MURDER_WHISPER_MAX} characters`);
    const counts = (state.secret.whisperCounts[fromUserId] ??= {});
    if ((counts[state.round] ?? 0) >= MURDER_WHISPERS_PER_ROUND) {
      throw new GameRuleError('ILLEGAL_MOVE', `You have used your ${MURDER_WHISPERS_PER_ROUND} whispers for this round`);
    }
    counts[state.round] = (counts[state.round] ?? 0) + 1;
    const w: MurderWhisper = { id: `w${++state.secret.whisperSeq}`, round: state.round, fromUserId, toUserId, text: clean, at: now };
    state.secret.whispers.push(w);
    return w;
  }

  /** The private clues of the rounds opened so far that belong to `characterId`. */
  private static cluesOf(c: MurderCaseDef, characterId: string, upToRound: number): Array<{ id: string; round: number; text: string }> {
    const out: Array<{ id: string; round: number; text: string }> = [];
    c.rounds.slice(0, Math.max(0, upToRound)).forEach((r, i) => {
      for (const clue of r.privateClues) if (clue.ownerId === characterId) out.push({ id: clue.id, round: i + 1, text: clue.text });
    });
    return out;
  }

  /** "Reveal my clue to everyone": adds one of the player's own delivered clues to the public evidence board (3 per game). */
  public static shareClue(state: MurderServerState, userId: string, clueId: unknown, now: number): boolean {
    this.tick(state, now);
    const me = this.requirePlayer(state, userId);
    if (state.phase !== 'CLUE_ROUND') throw new GameRuleError('WRONG_PHASE', 'Clues can only be shared during a clue round');
    const c = this.caseOf(state);
    const characterId = state.secret.assignment[userId];
    const clue = typeof clueId === 'string' ? this.cluesOf(c, characterId, state.round).find((x) => x.id === clueId) : undefined;
    if (!clue) throw new GameRuleError('INVALID_INPUT', 'That is not one of your clues');
    const mine = (state.secret.shared[userId] ??= []);
    if (mine.includes(clue.id)) return false;
    if (mine.length >= MURDER_MAX_SHARES) throw new GameRuleError('ILLEGAL_MOVE', `You can reveal at most ${MURDER_MAX_SHARES} clues per game`);
    mine.push(clue.id);
    const ev: MurderEvidence = { clueId: clue.id, round: clue.round, text: clue.text, sharedByUserId: userId, characterId };
    state.evidence.push(ev);
    const name = c.characters.find((x) => x.id === characterId)?.name ?? me.displayName;
    state.log.push({ round: state.round, kind: 'evidence', text: `${name} revealed a clue to everyone.` });
    return true;
  }

  /** The secret accusation: which character is the murderer, plus a short motive guess. Final once sent. */
  public static accuse(state: MurderServerState, userId: string, characterId: unknown, motive: unknown, now: number): boolean {
    this.tick(state, now);
    this.requirePlayer(state, userId);
    if (state.phase !== 'ACCUSATION') throw new GameRuleError('WRONG_PHASE', 'Accusations are not open right now');
    if (typeof characterId !== 'string' || !Object.values(state.secret.assignment).includes(characterId)) {
      throw new GameRuleError('INVALID_INPUT', 'Pick one of the characters in this game');
    }
    if (state.secret.assignment[userId] === characterId) throw new GameRuleError('ILLEGAL_MOVE', 'You cannot accuse your own character');
    const clean = cleanMurderText(motive);
    if (clean.length > MURDER_MOTIVE_MAX) throw new GameRuleError('INVALID_INPUT', `Keep the motive under ${MURDER_MOTIVE_MAX} characters`);
    const existing = state.secret.accusations[userId];
    if (existing) {
      if (existing.characterId === characterId && existing.motive === clean) return false;
      throw new GameRuleError('ALREADY_VOTED', 'Your accusation is final');
    }
    state.secret.accusations[userId] = { characterId, motive: clean, seq: ++state.secret.accuseSeq };
    this.tick(state, now);
    return true;
  }

  // -------------------------------------------------------------------
  // Connection / membership
  // -------------------------------------------------------------------

  public static setConnected(state: MurderServerState, userId: string, connected: boolean): void {
    const p = this.findPlayer(state, userId);
    if (p && !p.left) p.connected = connected;
  }

  /**
   * A player left for good (explicit leave, or the reconnect window ran out): "withdrawn". Their character is announced as having
   * left the party, their secrets stay hidden until RESULT, they stop acting (an unsent accusation is dropped). The game goes on,
   * also when the murderer withdrew; fewer than 4 seated players left aborts it (nothing revealed).
   * Returns true when the game was aborted.
   */
  public static removePlayer(state: MurderServerState, userId: string, now: number): boolean {
    const p = this.findPlayer(state, userId);
    if (!p || p.left) return state.phase === 'ABORTED';
    p.left = true;
    p.connected = false;
    state.readyUserIds = state.readyUserIds.filter((id) => id !== userId);
    if (RUNNING.has(state.phase)) {
      delete state.secret.accusations[userId];
      const c = this.caseById(state.secret.caseId);
      const name = c?.characters.find((x) => x.id === state.secret.assignment[userId])?.name ?? p.displayName;
      state.log.push({ round: state.round, kind: 'left', text: `${name} has left the party.` });
      if (this.activePlayers(state).length < murderMinActive()) {
        this.abort(state, 'Too few players are left, so the game ended.');
        return true;
      }
    }
    this.tick(state, now);
    return state.phase === 'ABORTED';
  }

  // -------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------

  /** True for the full server state (it carries `secret`); false for a redacted view. */
  public static isServerState(state: unknown): boolean {
    return Boolean(state && typeof state === 'object' && (state as any).secret !== undefined);
  }

  private static cardFor(c: MurderCaseDef, characterId: string): MurderCard {
    const def = c.characters.find((x) => x.id === characterId) as MurderCaseDef['characters'][number];
    const isMurderer = characterId === c.solution.murdererId;
    return {
      characterId,
      name: def.name,
      bio: def.bio,
      relationship: def.relationship,
      secretMotive: def.secretMotive,
      alibi: def.alibi,
      secret: def.secret,
      isMurderer,
      method: isMurderer ? c.solution.method : null,
      bluffNote: isMurderer ? 'You are the murderer. Never confess. Bluff, stay close to the truth where you can, and steer suspicion elsewhere. Your alibi is only partly true.' : null
    };
  }

  /**
   * The redacted copy of the state for ONE recipient. Rules:
   *  - a character card goes to its owner alone; the murderer's identity, the method, the motive and the other characters' secrets
   *    stay on the server until RESULT
   *  - private clues are derived for the owner only (a clue becomes public only when the owner shares it, through `evidence`)
   *  - whispers: only the sender and the receiver see them
   *  - accusations: nobody sees them before RESULT (everybody sees who has submitted, not whom they accused)
   *  - spectators, strangers and players who withdrew get the public view only (`me` is null); an aborted game reveals nothing
   */
  public static publicStateFor(state: MurderServerState | MurderGameView | null | undefined, viewerId: string | null | undefined, now: number = Date.now()): MurderGameView | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as MurderGameView; // already redacted
    const s = state as MurderServerState;
    const lobby = s.phase === 'LOBBY';
    const c = lobby ? undefined : this.caseById(s.secret.caseId);
    const revealed = s.phase === 'RESULT' || s.phase === 'FINAL';
    const viewer = typeof viewerId === 'string' ? this.findPlayer(s, viewerId) : undefined;

    let me: MurderMe | null = null;
    if (c && viewer && !viewer.left && s.phase !== 'ABORTED') {
      const characterId = s.secret.assignment[viewer.userId];
      const shared = new Set(s.secret.shared[viewer.userId] ?? []);
      const clueRound = s.phase === 'CHARACTER_REVEAL' ? 0 : s.round;
      const privateClues: MurderPrivateClue[] = this.cluesOf(c, characterId, clueRound).map((x) => ({ id: x.id, round: x.round, text: x.text, shared: shared.has(x.id) }));
      const used = s.secret.whisperCounts[viewer.userId]?.[s.round] ?? 0;
      const acc = s.secret.accusations[viewer.userId];
      me = {
        characterId,
        card: this.cardFor(c, characterId),
        privateClues,
        sharesLeft: Math.max(0, MURDER_MAX_SHARES - shared.size),
        whispers: s.secret.whispers.filter((w) => w.fromUserId === viewer.userId || w.toUserId === viewer.userId).map((w) => ({ ...w })),
        whispersLeft: s.phase === 'CLUE_ROUND' ? Math.max(0, MURDER_WHISPERS_PER_ROUND - used) : 0,
        ready: s.readyUserIds.includes(viewer.userId),
        myAccusation: acc ? { characterId: acc.characterId, motive: acc.motive } : null
      };
    }

    const characters: MurderPublicCharacter[] = c
      ? s.players.map((p) => {
          const def = c.characters.find((x) => x.id === s.secret.assignment[p.userId]) as MurderCaseDef['characters'][number];
          return { id: def.id, name: def.name, bio: def.bio, userId: p.userId, withdrawn: p.left };
        })
      : [];

    const openRounds = c && s.phase !== 'CHARACTER_REVEAL' ? s.round : 0;
    const clues: MurderPublicRound[] = c
      ? c.rounds.slice(0, openRounds).map((r, i) => ({ round: i + 1, title: r.title, clues: r.publicClues.map((x) => ({ id: x.id, text: x.text })) }))
      : [];

    return {
      game: 'murder-mystery',
      phase: s.phase,
      round: s.round,
      roundCount: s.roundCount,
      caseChoice: s.caseChoice,
      cases: lobby ? this.caseSummaries() : [],
      case: c ? { id: c.id, title: c.title, blurb: c.blurb, victim: { ...c.victim } } : null,
      players: s.players.map((p) => ({ ...p, characterId: lobby ? null : s.secret.assignment[p.userId] ?? null })),
      characters,
      clues,
      evidence: s.evidence.map((e) => ({ ...e })),
      readyUserIds: s.phase === 'CLUE_ROUND' ? [...s.readyUserIds] : [],
      accusedUserIds: s.phase === 'ACCUSATION' ? Object.keys(s.secret.accusations) : [],
      phaseEndsAt: s.phaseEndsAt,
      phaseDurationMs: s.phaseDurationMs,
      serverNow: now,
      me,
      result: revealed && s.secret.result ? JSON.parse(JSON.stringify(s.secret.result)) : null,
      log: s.log.map((l: MurderLogEntry) => ({ ...l })),
      gamesPlayed: s.gamesPlayed,
      statusMessage: s.statusMessage
    };
  }
}
