import { randomInt, randomUUID } from 'node:crypto';
import { CLASH_COLORS, CLASH_DEFAULT_RULES, CLASH_TURN_SECONDS } from '@synccinema/common';
import type { ClashCard, ClashColor, ClashEvent, ClashKind, ClashPlayerView, ClashPublicState, ClashRules } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

/**
 * Color Clash: the authoritative rules for a 2 to 4 player shedding card game. Pure: every function takes the clock (`now`, ms) and a
 * random source (`rng(n)` = an integer in [0, n)), so a test can replay a game exactly and the server uses crypto randomness.
 *
 * THE DECK (108 cards, documented here and tested):
 *   per colour (x4): one 0, two each of 1-9 (19 numbers), two Skip, two Reverse, two Draw Two  = 25 cards
 *   wild:            4 Wild, 4 Wild Draw Four                                                 =  8 cards
 *
 * THE DEFAULT RULES (every one is a switch in ClashRules):
 *   - 7 cards each; the first discard is turned over until it is a NUMBER card (action and wild cards go to the bottom of the pile)
 *   - the first player is chosen at random; play starts clockwise (seat order)
 *   - a card matches by colour, by number, or by action type; a Wild matches anything
 *   - Skip: the next player loses their turn. Reverse: direction flips (with two players it acts as Skip).
 *   - Draw Two: the next player draws two and loses their turn. NO stacking.
 *   - Wild Draw Four: the player picks the colour; the next player either draws four and loses their turn, or CHALLENGES: if the player
 *     had a card of the colour that was active before it, the player draws four instead; if not, the challenger draws six. The
 *     challenge only ever reveals "yes" or "no", never a hand.
 *   - a player with no playable card draws one card; if it can be played they may play it, otherwise (or if they decline) the turn passes.
 *     With voluntaryDraw a player may draw even when they could play.
 *   - one card left: the player must declare "last card". Until the window closes anyone else can catch them (they draw the penalty).
 *   - the turn clock runs on the server; when it runs out the player draws one card and the turn passes (a pending Wild Draw Four is accepted).
 *   - the winner is the first to play their last card, after that card's effect has been applied; a last Wild Draw Four waits for the challenge.
 *   - a player who leaves returns their cards to the bottom of the draw pile and play goes on without them.
 */

const MAX_MOVE_ID = 64;
const KEEP_MOVE_IDS = 24;
const HAND_SIZE = 7;

export type ClashRng = (n: number) => number;
export const secureRng: ClashRng = (n) => randomInt(n);

type Player = { userId: string; displayName: string; seat: number };

export interface ClashServerState {
  game: 'color-clash';
  gameId: string;
  rules: ClashRules;
  status: 'active' | 'finished' | 'forfeit' | 'cancelled';
  players: Array<{ userId: string; displayName: string; seat: number; declared: boolean; left: boolean }>;
  currentSeat: number;
  direction: 1 | -1;
  activeColor: ClashColor;
  top: ClashCard;
  turnPhase: 'play' | 'drawn' | 'challenge';
  pending: { kind: 'wild-four'; fromSeat: number; targetSeat: number; winPending: boolean } | null;
  lastCardWindow: { seat: number; until: string } | null;
  deadlineAt: string | null;
  winnerSeat: number | null;
  winnerUserId: string | null;
  points: number | null;
  finishReason: string | null;
  startingSeat: number;
  version: number;
  moveCount: number;
  lastEvent: ClashEvent | null;
  statusMessage: string;
  processedMoveIds: string[];
  /** EVERYTHING that must stay on the server. Its presence marks a state as the full server copy (see publicStateFor). */
  secret: {
    hands: Record<number, ClashCard[]>;
    drawPile: ClashCard[];
    discardPile: ClashCard[];
    drawnCardId: string | null;
    /** for the open Wild Draw Four: did the player hold a card of the colour that was active before it? */
    wildFour: { fromSeat: number; hadActiveColor: boolean } | null;
  };
}

// ---------------------------------------------------------------- the deck
const COLOR_CODE: Record<ClashColor, string> = { red: 'r', blue: 'b', green: 'g', yellow: 'y' };

/** the 108 cards in a fixed order, each with its own id */
export function createDeck(): ClashCard[] {
  const cards: ClashCard[] = [];
  let n = 0;
  const add = (color: ClashColor | null, kind: ClashKind, value: number | null) => {
    const tag = color ? COLOR_CODE[color] : 'w';
    cards.push({ id: `${tag}-${kind === 'number' ? `n${value}` : kind}-${n++}`, color, kind, value });
  };
  for (const color of CLASH_COLORS) {
    add(color, 'number', 0);
    for (let v = 1; v <= 9; v++) { add(color, 'number', v); add(color, 'number', v); }
    for (const kind of ['skip', 'reverse', 'draw-two'] as const) { add(color, kind, null); add(color, kind, null); }
  }
  for (let i = 0; i < 4; i++) { add(null, 'wild', null); add(null, 'wild-draw-four', null); }
  return cards;
}

/** Fisher-Yates with the given random source; returns a new array */
export function shuffle<T>(items: readonly T[], rng: ClashRng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const cardPoints = (c: ClashCard): number => (c.kind === 'number' ? (c.value ?? 0) : c.kind === 'wild' || c.kind === 'wild-draw-four' ? 50 : 20);

/** the rules profile with every value checked: unknown or tampered values fall back to the default */
export function sanitizeRules(raw: unknown): ClashRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = CLASH_DEFAULT_RULES;
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  const num = (v: unknown, def: number, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : def);
  const turn = r.turnSeconds === null ? null : typeof r.turnSeconds === 'number' && (CLASH_TURN_SECONDS as readonly (number | null)[]).includes(r.turnSeconds) ? r.turnSeconds : d.turnSeconds;
  return {
    turnSeconds: turn,
    reverseTwoPlayers: r.reverseTwoPlayers === 'normal' ? 'normal' : 'skip',
    drawFourChallenge: bool(r.drawFourChallenge, d.drawFourChallenge),
    voluntaryDraw: bool(r.voluntaryDraw, d.voluntaryDraw),
    playDrawnCard: bool(r.playDrawnCard, d.playDrawnCard),
    lastCardPenalty: num(r.lastCardPenalty, d.lastCardPenalty, 1, 4),
    lastCardWindowSeconds: num(r.lastCardWindowSeconds, d.lastCardWindowSeconds, 2, 15)
  };
}

const iso = (ms: number): string => new Date(ms).toISOString();

export interface ClashAction {
  type: 'play' | 'draw' | 'pass' | 'declare' | 'catch' | 'challenge-wild';
  cardId?: string;
  color?: unknown;
  target?: number;
  moveId?: string | null;
  baseVersion?: number;
}

export interface ClashResult {
  state: ClashServerState;
  /** the same move id was already applied: nothing changed */
  duplicate: boolean;
}

export class ClashEngine {
  static isServerState(state: unknown): state is ClashServerState {
    return !!state && typeof state === 'object' && (state as any).game === 'color-clash' && (state as any).secret !== undefined;
  }

  static isLive(state: ClashServerState): boolean {
    return state.status === 'active';
  }

  // ---------------------------------------------------------------- setup
  static createMatch(players: Player[], opts: { now: number; rules?: unknown; rng?: ClashRng; gameId?: string; startingSeat?: number }): ClashServerState {
    const rng = opts.rng ?? secureRng;
    if (players.length < 2 || players.length > 4) throw new GameRuleError('INVALID_INPUT', 'Color Clash needs 2 to 4 players');
    if (new Set(players.map((p) => p.seat)).size !== players.length) throw new GameRuleError('INVALID_INPUT', 'Players must have different seats');
    const rules = sanitizeRules(opts.rules);
    const seated = [...players].sort((a, b) => a.seat - b.seat);
    let deck = shuffle(createDeck(), rng);
    const hands: Record<number, ClashCard[]> = {};
    for (const p of seated) hands[p.seat] = [];
    for (let i = 0; i < HAND_SIZE; i++) for (const p of seated) hands[p.seat].push(deck.pop() as ClashCard);
    // the first discard must be a number card: anything else goes to the bottom of the pile
    const skipped: ClashCard[] = [];
    let top = deck.pop() as ClashCard;
    while (top.kind !== 'number') { skipped.push(top); top = deck.pop() as ClashCard; }
    deck = [...skipped, ...deck];
    const first = typeof opts.startingSeat === 'number' && seated.some((p) => p.seat === opts.startingSeat) ? (opts.startingSeat as number) : seated[rng(seated.length)].seat;
    const firstName = seated.find((p) => p.seat === first)?.displayName ?? 'Player';
    return {
      game: 'color-clash',
      gameId: opts.gameId ?? randomUUID(),
      rules,
      status: 'active',
      players: seated.map((p) => ({ userId: p.userId, displayName: p.displayName, seat: p.seat, declared: false, left: false })),
      currentSeat: first,
      direction: 1,
      activeColor: top.color as ClashColor,
      top,
      turnPhase: 'play',
      pending: null,
      lastCardWindow: null,
      deadlineAt: rules.turnSeconds === null ? null : iso(opts.now + rules.turnSeconds * 1000),
      winnerSeat: null,
      winnerUserId: null,
      points: null,
      finishReason: null,
      startingSeat: first,
      version: 1,
      moveCount: 0,
      lastEvent: null,
      statusMessage: `${firstName} goes first. Match the colour or the number!`,
      processedMoveIds: [],
      secret: { hands, drawPile: deck, discardPile: [], drawnCardId: null, wildFour: null }
    };
  }

  // ---------------------------------------------------------------- reading the table
  static handOf(state: ClashServerState, seat: number): ClashCard[] {
    return state.secret.hands[seat] ?? [];
  }
  private static activeSeats(state: ClashServerState): number[] {
    return state.players.filter((p) => !p.left).map((p) => p.seat);
  }
  private static nameOf(state: ClashServerState, seat: number | null): string {
    return state.players.find((p) => p.seat === seat)?.displayName ?? 'A player';
  }
  /** the seat after `seat` in the current direction, skipping players who left */
  static nextSeat(state: ClashServerState, seat: number, steps = 1): number {
    const seats = this.activeSeats(state).sort((a, b) => a - b);
    let idx = seats.indexOf(seat);
    if (idx === -1) idx = 0;
    return seats[(((idx + state.direction * steps) % seats.length) + seats.length) % seats.length];
  }

  /** can `card` be played on the table as it is (active colour, top card)? A Wild Draw Four is judged by the rules profile. */
  static matches(state: ClashServerState, card: ClashCard, hand: ClashCard[]): boolean {
    if (card.kind === 'wild') return true;
    if (card.kind === 'wild-draw-four') {
      return state.rules.drawFourChallenge ? true : !hand.some((c) => c.id !== card.id && c.color === state.activeColor);
    }
    if (card.color === state.activeColor) return true;
    const top = state.top;
    if (top.kind === 'number') return card.kind === 'number' && card.value === top.value;
    if (top.kind === 'wild' || top.kind === 'wild-draw-four') return false;
    return card.kind === top.kind;
  }

  /** ids the seat may play right now */
  static playableIds(state: ClashServerState, seat: number): string[] {
    if (!this.isLive(state) || state.currentSeat !== seat || state.turnPhase === 'challenge') return [];
    const hand = this.handOf(state, seat);
    if (state.turnPhase === 'drawn') {
      const drawn = hand.find((c) => c.id === state.secret.drawnCardId);
      return drawn && this.matches(state, drawn, hand) ? [drawn.id] : [];
    }
    return hand.filter((c) => this.matches(state, c, hand)).map((c) => c.id);
  }

  // ---------------------------------------------------------------- drawing
  /** the next card from the draw pile; when it runs out the discards (except the top card) are shuffled back in */
  private static takeCard(state: ClashServerState, rng: ClashRng): ClashCard | null {
    const s = state.secret;
    if (s.drawPile.length === 0 && s.discardPile.length > 0) {
      s.drawPile = shuffle(s.discardPile, rng);
      s.discardPile = [];
    }
    return s.drawPile.pop() ?? null;
  }
  private static drawInto(state: ClashServerState, seat: number, count: number, rng: ClashRng): number {
    let got = 0;
    for (let i = 0; i < count; i++) {
      const c = this.takeCard(state, rng);
      if (!c) break;
      state.secret.hands[seat].push(c);
      got++;
    }
    // more cards than two means the earlier "last card" declaration no longer applies
    if (state.secret.hands[seat].length > 2) this.player(state, seat).declared = false;
    return got;
  }
  private static player(state: ClashServerState, seat: number) {
    return state.players.find((p) => p.seat === seat) as ClashServerState['players'][number];
  }

  private static clone(state: ClashServerState): ClashServerState {
    return {
      ...state,
      players: state.players.map((p) => ({ ...p })),
      processedMoveIds: [...state.processedMoveIds],
      secret: {
        hands: Object.fromEntries(Object.entries(state.secret.hands).map(([k, v]) => [k, [...v]])),
        drawPile: [...state.secret.drawPile],
        discardPile: [...state.secret.discardPile],
        drawnCardId: state.secret.drawnCardId,
        wildFour: state.secret.wildFour ? { ...state.secret.wildFour } : null
      }
    };
  }

  private static turnDeadline(state: ClashServerState, now: number): string | null {
    return state.rules.turnSeconds === null ? null : iso(now + state.rules.turnSeconds * 1000);
  }

  /** hand the turn to `seat` with a fresh clock */
  private static startTurn(state: ClashServerState, seat: number, now: number): void {
    state.currentSeat = seat;
    state.turnPhase = 'play';
    state.secret.drawnCardId = null;
    state.deadlineAt = this.turnDeadline(state, now);
  }

  private static finish(state: ClashServerState, winnerSeat: number, reason: string): void {
    const winner = this.player(state, winnerSeat);
    const points = state.players.filter((p) => p.seat !== winnerSeat).reduce((sum, p) => sum + (state.secret.hands[p.seat] ?? []).reduce((n, c) => n + cardPoints(c), 0), 0);
    state.status = 'finished';
    state.winnerSeat = winnerSeat;
    state.winnerUserId = winner.userId;
    state.points = points;
    state.finishReason = reason;
    state.deadlineAt = null;
    state.lastCardWindow = null;
    state.pending = null;
    state.turnPhase = 'play';
    state.statusMessage = `${winner.displayName} wins and scores ${points} points!`;
  }

  // ---------------------------------------------------------------- time
  /** applies what the clock decides: a turn that ran out, or a "last card" window that closed. Call before every action and from the timer. */
  static advance(prev: ClashServerState, now: number, rng: ClashRng = secureRng): { state: ClashServerState; changed: boolean } {
    if (!this.isLive(prev)) return { state: prev, changed: false };
    let state = prev;
    let changed = false;
    if (state.lastCardWindow && now >= Date.parse(state.lastCardWindow.until)) {
      state = this.clone(state);
      state.lastCardWindow = null;
      state.version += 1;
      changed = true;
    }
    if (state.deadlineAt && now >= Date.parse(state.deadlineAt)) {
      state = this.clone(state);
      const seat = state.currentSeat;
      const name = this.nameOf(state, seat);
      if (state.turnPhase === 'challenge' && state.pending) {
        this.acceptWildFour(state, now, rng, true);
      } else if (state.turnPhase === 'drawn') {
        state.lastEvent = { kind: 'timeout', seat, note: 'passed' };
        state.statusMessage = `${name} ran out of time and passed.`;
        this.startTurn(state, this.nextSeat(state, seat), now);
      } else {
        const got = this.drawInto(state, seat, 1, rng);
        state.lastEvent = { kind: 'timeout', seat, count: got };
        state.statusMessage = `${name} ran out of time and drew a card.`;
        this.startTurn(state, this.nextSeat(state, seat), now);
      }
      state.version += 1;
      state.moveCount += 1;
      changed = true;
    }
    return { state, changed };
  }

  // ---------------------------------------------------------------- actions
  static apply(prev: ClashServerState, seat: number, action: ClashAction, now: number, rng: ClashRng = secureRng): ClashResult {
    const moveId = typeof action.moveId === 'string' && action.moveId.length > 0 && action.moveId.length <= MAX_MOVE_ID ? action.moveId : null;
    if (action.moveId !== undefined && action.moveId !== null && moveId === null) throw new GameRuleError('INVALID_INPUT', 'Invalid move id');
    if (moveId && prev.processedMoveIds.includes(moveId)) return { state: prev, duplicate: true };
    if (!this.isLive(prev)) throw new GameRuleError('GAME_OVER', 'This game is over');
    if (!prev.players.some((p) => p.seat === seat && !p.left)) throw new GameRuleError('NOT_PLAYER', 'You are not in this game');
    if (action.baseVersion !== undefined && (!Number.isInteger(action.baseVersion) || action.baseVersion < prev.version)) {
      throw new GameRuleError('STALE_STATE', 'Your screen is out of date. The latest table was sent.');
    }
    const state = this.clone(prev);
    if (moveId) state.processedMoveIds = [...state.processedMoveIds, moveId].slice(-KEEP_MOVE_IDS);

    switch (action.type) {
      case 'declare': this.declare(state, seat, now); break;
      case 'catch': this.catchPlayer(state, seat, action.target, now, rng); break;
      case 'challenge-wild': this.challengeWild(state, seat, now, rng); break;
      case 'draw': this.draw(state, seat, now, rng); break;
      case 'pass': this.pass(state, seat, now); break;
      case 'play': this.play(state, seat, action, now, rng); break;
      default: throw new GameRuleError('INVALID_INPUT', 'Unknown action');
    }
    state.version += 1;
    state.moveCount += 1;
    return { state, duplicate: false };
  }

  private static requireTurn(state: ClashServerState, seat: number): void {
    if (seat !== state.currentSeat) throw new GameRuleError('NOT_YOUR_TURN', `It is not your turn (it is ${this.nameOf(state, state.currentSeat)}'s)`);
  }

  private static declare(state: ClashServerState, seat: number, now: number): void {
    const hand = this.handOf(state, seat);
    if (hand.length > 2 || hand.length === 0) throw new GameRuleError('ILLEGAL_MOVE', 'You can declare "last card" when you have two cards or one card left');
    this.player(state, seat).declared = true;
    if (state.lastCardWindow?.seat === seat) state.lastCardWindow = null;
    state.lastEvent = { kind: 'declare', seat };
    state.statusMessage = `${this.nameOf(state, seat)} declares LAST CARD!`;
    void now;
  }

  private static catchPlayer(state: ClashServerState, caller: number, target: unknown, now: number, rng: ClashRng): void {
    if (typeof target !== 'number' || !Number.isInteger(target)) throw new GameRuleError('INVALID_INPUT', 'Say who you are catching');
    const win = state.lastCardWindow;
    const victim = state.players.find((p) => p.seat === target && !p.left);
    if (!victim || target === caller) throw new GameRuleError('ILLEGAL_MOVE', 'There is nobody to catch');
    if (!win || win.seat !== target || now >= Date.parse(win.until) || victim.declared || this.handOf(state, target).length !== 1) {
      throw new GameRuleError('ILLEGAL_MOVE', 'Too late, or they already declared');
    }
    const got = this.drawInto(state, target, state.rules.lastCardPenalty, rng);
    state.lastCardWindow = null;
    state.lastEvent = { kind: 'penalty', seat: target, count: got, note: 'last-card' };
    state.statusMessage = `${this.nameOf(state, caller)} caught ${victim.displayName}! ${victim.displayName} draws ${got}.`;
  }

  private static draw(state: ClashServerState, seat: number, now: number, rng: ClashRng): void {
    this.requireTurn(state, seat);
    if (state.turnPhase === 'challenge') {
      this.acceptWildFour(state, now, rng, false);
      return;
    }
    if (state.turnPhase === 'drawn') throw new GameRuleError('ILLEGAL_MOVE', 'You already drew: play that card or pass');
    const playable = this.playableIds(state, seat);
    if (playable.length > 0 && !state.rules.voluntaryDraw) throw new GameRuleError('ILLEGAL_MOVE', 'You have a card you can play');
    const card = this.takeCard(state, rng);
    if (!card) {
      // nothing left to draw anywhere: the turn passes
      state.lastEvent = { kind: 'pass', seat };
      state.statusMessage = `${this.nameOf(state, seat)} cannot draw (no cards left) and passes.`;
      this.startTurn(state, this.nextSeat(state, seat), now);
      return;
    }
    state.secret.hands[seat].push(card);
    if (state.secret.hands[seat].length > 2) this.player(state, seat).declared = false;
    state.lastEvent = { kind: 'draw', seat, count: 1 };
    if (state.rules.playDrawnCard && this.matches(state, card, state.secret.hands[seat])) {
      state.turnPhase = 'drawn';
      state.secret.drawnCardId = card.id;
      state.deadlineAt = this.turnDeadline(state, now);
      state.statusMessage = `${this.nameOf(state, seat)} drew a card and may play it.`;
    } else {
      state.statusMessage = `${this.nameOf(state, seat)} drew a card.`;
      this.startTurn(state, this.nextSeat(state, seat), now);
    }
  }

  private static pass(state: ClashServerState, seat: number, now: number): void {
    this.requireTurn(state, seat);
    if (state.turnPhase !== 'drawn') throw new GameRuleError('ILLEGAL_MOVE', 'You can only pass after drawing a card');
    state.lastEvent = { kind: 'pass', seat };
    state.statusMessage = `${this.nameOf(state, seat)} passes.`;
    this.startTurn(state, this.nextSeat(state, seat), now);
  }

  private static play(state: ClashServerState, seat: number, action: ClashAction, now: number, rng: ClashRng): void {
    this.requireTurn(state, seat);
    if (state.turnPhase === 'challenge') throw new GameRuleError('ILLEGAL_MOVE', 'Accept the Wild Draw Four (draw) or challenge it first');
    if (typeof action.cardId !== 'string' || action.cardId.length === 0) throw new GameRuleError('INVALID_INPUT', 'Say which card');
    const hand = state.secret.hands[seat];
    const idx = hand.findIndex((c) => c.id === action.cardId);
    if (idx === -1) throw new GameRuleError('NOT_YOUR_CARD', 'That card is not in your hand');
    const card = hand[idx];
    if (state.turnPhase === 'drawn' && card.id !== state.secret.drawnCardId) throw new GameRuleError('ILLEGAL_MOVE', 'You can only play the card you just drew, or pass');
    if (!this.matches(state, card, hand)) throw new GameRuleError('ILLEGAL_MOVE', card.kind === 'wild-draw-four' ? 'You can only play a Wild Draw Four when you have no card of the active colour' : 'That card does not match');
    let chosen: ClashColor | null = null;
    if (card.color === null) {
      if (typeof action.color !== 'string' || !(CLASH_COLORS as readonly string[]).includes(action.color)) throw new GameRuleError('INVALID_INPUT', 'Choose a colour for the Wild card');
      chosen = action.color as ClashColor;
    }
    const prevColor = state.activeColor;
    const hadActiveColor = card.kind === 'wild-draw-four' && hand.some((c) => c.id !== card.id && c.color === prevColor);

    // the card leaves the hand and goes on the pile
    hand.splice(idx, 1);
    state.secret.discardPile.push(state.top);
    state.top = card;
    state.activeColor = chosen ?? (card.color as ClashColor);
    state.secret.drawnCardId = null;
    state.lastCardWindow = null;
    if (hand.length > 1) this.player(state, seat).declared = false;
    const name = this.nameOf(state, seat);
    state.lastEvent = { kind: 'play', seat, card, ...(chosen ? { color: chosen } : {}) };
    state.statusMessage = `${name} played ${describe(card)}${chosen ? ` and chose ${chosen}` : ''}.`;

    const empty = hand.length === 0;
    const next = this.nextSeat(state, seat);
    const active = this.activeSeats(state).length;

    // one card left without a declaration: the others get a short window to catch it
    if (hand.length === 1 && !this.player(state, seat).declared) {
      state.lastCardWindow = { seat, until: iso(now + state.rules.lastCardWindowSeconds * 1000) };
    }

    switch (card.kind) {
      case 'skip':
        if (empty) return this.finish(state, seat, 'emptied');
        state.lastEvent = { ...state.lastEvent, target: next };
        state.statusMessage += ` ${this.nameOf(state, next)} is skipped.`;
        this.startTurn(state, this.nextSeat(state, seat, 2), now);
        return;
      case 'reverse': {
        state.direction = (state.direction === 1 ? -1 : 1) as 1 | -1;
        if (empty) return this.finish(state, seat, 'emptied');
        if (active === 2 && state.rules.reverseTwoPlayers === 'skip') {
          state.statusMessage += ` With two players Reverse is a Skip: ${name} plays again.`;
          this.startTurn(state, seat, now);
        } else {
          state.statusMessage += ' The direction reverses.';
          this.startTurn(state, this.nextSeat(state, seat), now);
        }
        return;
      }
      case 'draw-two': {
        const got = this.drawInto(state, next, 2, rng);
        state.lastEvent = { ...state.lastEvent, target: next, count: got };
        state.statusMessage += ` ${this.nameOf(state, next)} draws ${got} and loses a turn.`;
        if (empty) return this.finish(state, seat, 'emptied');
        this.startTurn(state, this.nextSeat(state, seat, 2), now);
        return;
      }
      case 'wild-draw-four': {
        if (!state.rules.drawFourChallenge) {
          const got = this.drawInto(state, next, 4, rng);
          state.lastEvent = { ...state.lastEvent, target: next, count: got };
          state.statusMessage += ` ${this.nameOf(state, next)} draws ${got} and loses a turn.`;
          if (empty) return this.finish(state, seat, 'emptied');
          this.startTurn(state, this.nextSeat(state, seat, 2), now);
          return;
        }
        // the next player decides: accept (draw four) or challenge. A last Wild Draw Four waits for that decision before it can win.
        state.secret.wildFour = { fromSeat: seat, hadActiveColor };
        state.pending = { kind: 'wild-four', fromSeat: seat, targetSeat: next, winPending: empty };
        state.currentSeat = next;
        state.turnPhase = 'challenge';
        state.deadlineAt = this.turnDeadline(state, now);
        state.lastEvent = { ...state.lastEvent, target: next };
        state.statusMessage += ` ${this.nameOf(state, next)} must draw four or challenge.`;
        return;
      }
      default:
        if (empty) return this.finish(state, seat, 'emptied');
        this.startTurn(state, next, now);
    }
  }

  /** the target of a Wild Draw Four draws four and loses their turn (a last Wild Draw Four now wins) */
  private static acceptWildFour(state: ClashServerState, now: number, rng: ClashRng, timedOut: boolean): void {
    const pending = state.pending;
    if (!pending) throw new GameRuleError('ILLEGAL_MOVE', 'There is no Wild Draw Four to accept');
    const target = pending.targetSeat;
    const got = this.drawInto(state, target, 4, rng);
    state.lastEvent = { kind: timedOut ? 'timeout' : 'draw', seat: target, count: got, note: 'wild-four' };
    state.statusMessage = `${this.nameOf(state, target)} ${timedOut ? 'ran out of time and ' : ''}draws ${got} and loses a turn.`;
    state.pending = null;
    state.secret.wildFour = null;
    if (pending.winPending) return this.finish(state, pending.fromSeat, 'emptied');
    this.startTurn(state, this.nextSeat(state, target), now);
  }

  private static challengeWild(state: ClashServerState, seat: number, now: number, rng: ClashRng): void {
    const pending = state.pending;
    if (!pending || state.turnPhase !== 'challenge') throw new GameRuleError('ILLEGAL_MOVE', 'There is nothing to challenge');
    if (seat !== pending.targetSeat) throw new GameRuleError('NOT_YOUR_TURN', 'Only the player who must draw can challenge');
    const info = state.secret.wildFour;
    const guilty = !!info?.hadActiveColor;
    const from = pending.fromSeat;
    state.pending = null;
    state.secret.wildFour = null;
    if (guilty) {
      // it was not a legal play: the player who played it draws four instead, and the challenger plays on
      const got = this.drawInto(state, from, 4, rng);
      state.lastEvent = { kind: 'challenge', seat, target: from, success: true, count: got };
      state.statusMessage = `${this.nameOf(state, seat)} challenged and was right! ${this.nameOf(state, from)} draws ${got}.`;
      this.startTurn(state, seat, now);
      return;
    }
    // it was legal: the challenger draws six (the four plus two) and loses their turn
    const got = this.drawInto(state, seat, 6, rng);
    state.lastEvent = { kind: 'challenge', seat, target: from, success: false, count: got };
    state.statusMessage = `${this.nameOf(state, seat)} challenged and was wrong. ${this.nameOf(state, seat)} draws ${got}.`;
    if (pending.winPending) return this.finish(state, from, 'emptied');
    this.startTurn(state, this.nextSeat(state, seat), now);
  }

  // ---------------------------------------------------------------- leaving, ending
  /** a player left for good: their cards go to the bottom of the draw pile and play goes on without them */
  static removePlayer(prev: ClashServerState, seat: number, now: number): ClashServerState {
    if (!this.isLive(prev)) return prev;
    const state = this.clone(prev);
    const p = state.players.find((x) => x.seat === seat);
    if (!p || p.left) return prev;
    const cards = state.secret.hands[seat] ?? [];
    state.secret.drawPile = [...cards, ...state.secret.drawPile];
    state.secret.hands[seat] = [];
    p.left = true;
    p.declared = false;
    if (state.lastCardWindow?.seat === seat) state.lastCardWindow = null;
    const wasCurrent = state.currentSeat === seat;
    if (state.pending && (state.pending.fromSeat === seat || state.pending.targetSeat === seat)) {
      state.pending = null;
      state.secret.wildFour = null;
    }
    if (wasCurrent || state.turnPhase === 'challenge') {
      const from = wasCurrent ? seat : state.currentSeat;
      const next = (() => { const seats = this.activeSeats(state).sort((a, b) => a - b); return seats.find((s) => s > from) ?? seats[0]; })();
      this.startTurn(state, next, now);
    }
    state.lastEvent = { kind: 'pass', seat, note: 'left' };
    state.statusMessage = `${p.displayName} left the game.`;
    state.version += 1;
    return state;
  }

  /** everybody else left: the last player standing wins */
  static forfeitWin(prev: ClashServerState, winnerSeat: number, leaverName: string): ClashServerState {
    if (!this.isLive(prev)) return prev;
    const state = this.clone(prev);
    this.finish(state, winnerSeat, 'forfeit');
    state.status = 'forfeit';
    state.statusMessage = `${leaverName} left the game. ${this.nameOf(state, winnerSeat)} wins!`;
    state.version += 1;
    return state;
  }

  static cancel(prev: ClashServerState): ClashServerState {
    if (!this.isLive(prev)) return prev;
    const state = this.clone(prev);
    state.status = 'cancelled';
    state.deadlineAt = null;
    state.lastCardWindow = null;
    state.pending = null;
    state.finishReason = 'cancelled';
    state.statusMessage = 'The game was cancelled.';
    state.version += 1;
    return state;
  }

  // ---------------------------------------------------------------- what a screen may see
  /**
   * The state for ONE viewer: the table, plus that viewer's own hand and what they may do. Everybody else's cards, the draw pile's
   * order and the discard pile's contents never leave the server. A spectator (or someone who is not in the game) gets no hand.
   */
  static publicStateFor(state: ClashServerState | ClashPublicState | null | undefined, viewerId: string | null | undefined, serverNowMs?: number): ClashPublicState | null {
    if (!state) return null;
    if (!this.isServerState(state)) return state as ClashPublicState; // already redacted
    const s = state;
    const me = typeof viewerId === 'string' ? s.players.find((p) => p.userId === viewerId && !p.left) : undefined;
    const live = this.isLive(s);
    const mySeat = me ? me.seat : null;
    const myHand = me ? [...(s.secret.hands[me.seat] ?? [])] : null;
    const myTurn = live && me !== undefined && s.currentSeat === me.seat;
    const playable = me && live ? this.playableIds(s, me.seat) : [];
    const players: ClashPlayerView[] = s.players.map((p) => ({ userId: p.userId, displayName: p.displayName, seat: p.seat, cards: (s.secret.hands[p.seat] ?? []).length, declared: p.declared, left: p.left }));
    const win = s.lastCardWindow;
    const now = serverNowMs ?? Date.now();
    const catchable = me && live && win && now < Date.parse(win.until) && win.seat !== me.seat && !s.players.find((p) => p.seat === win.seat)?.declared && (s.secret.hands[win.seat] ?? []).length === 1 ? [win.seat] : [];
    return {
      game: 'color-clash',
      gameId: s.gameId,
      rules: s.rules,
      status: s.status,
      players,
      currentSeat: s.currentSeat,
      direction: s.direction,
      activeColor: s.activeColor,
      top: s.top,
      drawCount: s.secret.drawPile.length,
      discardCount: s.secret.discardPile.length + 1,
      turnPhase: s.turnPhase,
      pending: s.pending ? { kind: 'wild-four', fromSeat: s.pending.fromSeat, targetSeat: s.pending.targetSeat } : null,
      lastCardWindow: win,
      deadlineAt: s.deadlineAt,
      winnerSeat: s.winnerSeat,
      winnerUserId: s.winnerUserId,
      winner: s.winnerSeat === null ? null : s.winnerSeat === 0 ? 'X' : 'O',
      isDraw: s.status === 'cancelled',
      points: s.points,
      finishReason: s.finishReason,
      version: s.version,
      moveCount: s.moveCount,
      lastEvent: s.lastEvent,
      statusMessage: s.statusMessage,
      startingSeat: s.startingSeat,
      currentTurnSeat: s.currentSeat,
      mySeat,
      myHand,
      playable,
      canDraw: myTurn && (s.turnPhase === 'challenge' || (s.turnPhase === 'play' && (playable.length === 0 || s.rules.voluntaryDraw))),
      canPass: myTurn && s.turnPhase === 'drawn',
      canChallengeWild: myTurn && s.turnPhase === 'challenge' && s.pending?.targetSeat === me?.seat,
      canDeclare: !!me && live && (s.secret.hands[me.seat]?.length ?? 0) > 0 && (s.secret.hands[me.seat]?.length ?? 0) <= 2 && !me.declared,
      catchable
    };
  }
}

const KIND_NAME: Record<ClashKind, string> = { number: '', skip: 'Skip', reverse: 'Reverse', 'draw-two': 'Draw Two', wild: 'Wild', 'wild-draw-four': 'Wild Draw Four' };
/** a short readable name of a card ("red 5", "blue Skip", "Wild") */
export function describe(card: ClashCard): string {
  const color = card.color ? `${card.color} ` : '';
  return card.kind === 'number' ? `${color}${card.value}` : `${color}${KIND_NAME[card.kind]}`.trim();
}
