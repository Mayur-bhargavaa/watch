import test from 'node:test';
import assert from 'node:assert/strict';
import { ClashEngine, createDeck, shuffle, cardPoints, sanitizeRules, describe as describeCard, type ClashServerState, type ClashRng } from '../games/ClashEngine.js';
import { GameRuleError } from '../games/GameRuleError.js';
import { CLASH_DEFAULT_RULES } from '@synccinema/common';
import type { ClashCard, ClashColor, ClashKind } from '@synccinema/common';

const T0 = 1_700_000_000_000;
/** a repeatable random source: the same seed always gives the same game */
const seeded = (seed: number): ClashRng => {
  let a = seed >>> 0;
  return (n) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
};
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `P${i}`, seat: i }));
const code = (c: string) => (e: unknown) => e instanceof GameRuleError && e.code === c;

let serial = 1000;
const card = (color: ClashColor | null, kind: ClashKind, value: number | null = null): ClashCard => ({ id: `t${serial++}`, color, kind, value });
const num = (color: ClashColor, v: number) => card(color, 'number', v);

/** a match with exactly these hands and top card, seat 0 to play */
function table(n: number, hands: ClashCard[][], top: ClashCard, opts: { rules?: any; seat?: number; color?: ClashColor; pile?: ClashCard[] } = {}): ClashServerState {
  const s = ClashEngine.createMatch(players(n), { now: T0, rules: opts.rules, rng: seeded(1), startingSeat: opts.seat ?? 0 });
  for (let i = 0; i < n; i++) s.secret.hands[i] = hands[i] ?? [num('red', 1), num('red', 2), num('red', 3)];
  s.top = top;
  s.activeColor = opts.color ?? (top.color as ClashColor);
  s.secret.drawPile = opts.pile ?? Array.from({ length: 30 }, (_, i) => num('yellow', i % 10));
  s.secret.discardPile = [];
  return s;
}
const play = (s: ClashServerState, seat: number, c: ClashCard, color?: string, now = T0 + 1000, rng = seeded(2)) => ClashEngine.apply(s, seat, { type: 'play', cardId: c.id, color }, now, rng).state;
const act = (s: ClashServerState, seat: number, type: any, extra: any = {}, now = T0 + 1000) => ClashEngine.apply(s, seat, { type, ...extra }, now, seeded(3)).state;
const count = (s: ClashServerState, seat: number) => s.secret.hands[seat].length;
const allCards = (s: ClashServerState): ClashCard[] => [...Object.values(s.secret.hands).flat(), ...s.secret.drawPile, ...s.secret.discardPile, s.top];

// ---------------------------------------------------------------- deck, shuffle, deal
test('the deck has 108 cards, all with their own id, built exactly as documented', () => {
  const deck = createDeck();
  assert.equal(deck.length, 108);
  assert.equal(new Set(deck.map((c) => c.id)).size, 108, 'unique ids');
  for (const color of ['red', 'blue', 'green', 'yellow'] as const) {
    const mine = deck.filter((c) => c.color === color);
    assert.equal(mine.length, 25, color);
    assert.equal(mine.filter((c) => c.kind === 'number' && c.value === 0).length, 1);
    for (let v = 1; v <= 9; v++) assert.equal(mine.filter((c) => c.kind === 'number' && c.value === v).length, 2, `${color} ${v}`);
    for (const k of ['skip', 'reverse', 'draw-two']) assert.equal(mine.filter((c) => c.kind === k).length, 2, `${color} ${k}`);
  }
  assert.equal(deck.filter((c) => c.kind === 'wild').length, 4);
  assert.equal(deck.filter((c) => c.kind === 'wild-draw-four').length, 4);
  assert.ok(deck.filter((c) => c.color === null).every((c) => c.kind === 'wild' || c.kind === 'wild-draw-four'));
});

test('shuffling neither loses nor duplicates a card, and different seeds give different orders', () => {
  const deck = createDeck();
  const a = shuffle(deck, seeded(1));
  const b = shuffle(deck, seeded(2));
  assert.deepEqual([...a.map((c) => c.id)].sort(), [...deck.map((c) => c.id)].sort());
  assert.notDeepEqual(a.map((c) => c.id), b.map((c) => c.id));
  assert.deepEqual(a.map((c) => c.id), shuffle(deck, seeded(1)).map((c) => c.id), 'the same seed repeats');
  assert.equal(deck[0].id, createDeck()[0].id, 'the input is not changed');
});

test('dealing gives 7 cards to each of 2, 3 and 4 players, a number card on the pile, and every one of the 108 cards exactly once', () => {
  for (const n of [2, 3, 4]) {
    for (let seed = 1; seed <= 25; seed++) {
      const s = ClashEngine.createMatch(players(n), { now: T0, rng: seeded(seed) });
      for (let i = 0; i < n; i++) assert.equal(count(s, i), 7);
      assert.equal(s.top.kind, 'number', 'the first discard is a number card');
      assert.equal(s.activeColor, s.top.color);
      const ids = allCards(s).map((c) => c.id);
      assert.equal(ids.length, 108);
      assert.equal(new Set(ids).size, 108, `${n} players, seed ${seed}: no card duplicated or lost`);
      assert.ok(players(n).some((p) => p.seat === s.currentSeat));
      assert.equal(s.direction, 1);
    }
  }
});

test('2 to 4 players only; seats must differ', () => {
  assert.throws(() => ClashEngine.createMatch(players(1), { now: T0 }), code('INVALID_INPUT'));
  assert.throws(() => ClashEngine.createMatch(players(5), { now: T0 }), code('INVALID_INPUT'));
  assert.throws(() => ClashEngine.createMatch([{ userId: 'a', displayName: 'A', seat: 0 }, { userId: 'b', displayName: 'B', seat: 0 }], { now: T0 }), code('INVALID_INPUT'));
});

test('the first player is fair: over many games every seat gets to start', () => {
  const starters = new Set<number>();
  for (let seed = 1; seed < 80; seed++) starters.add(ClashEngine.createMatch(players(4), { now: T0, rng: seeded(seed) }).currentSeat);
  assert.deepEqual([...starters].sort(), [0, 1, 2, 3]);
});

test('rules: unknown or tampered values fall back to the documented defaults', () => {
  assert.deepEqual(sanitizeRules(undefined), CLASH_DEFAULT_RULES);
  assert.deepEqual(sanitizeRules({ turnSeconds: 7, lastCardPenalty: 99, reverseTwoPlayers: 'zzz', drawFourChallenge: 'yes' }), CLASH_DEFAULT_RULES);
  assert.equal(sanitizeRules({ turnSeconds: null }).turnSeconds, null);
  assert.equal(sanitizeRules({ turnSeconds: 60 }).turnSeconds, 60);
  assert.equal(sanitizeRules({ drawFourChallenge: false }).drawFourChallenge, false);
});

// ---------------------------------------------------------------- legal plays
test('a card matches by colour, by number, by action type; a Wild matches anything; nothing else does', () => {
  const top = num('red', 5);
  const hand = [num('red', 9), num('blue', 5), num('blue', 7), card('red', 'skip'), card(null, 'wild')];
  const s = table(2, [hand, []], top);
  assert.deepEqual(ClashEngine.playableIds(s, 0), [hand[0].id, hand[1].id, hand[3].id, hand[4].id]);
  const onSkip = table(2, [[card('blue', 'skip'), num('blue', 3)], []], card('green', 'skip'));
  assert.deepEqual(ClashEngine.playableIds(onSkip, 0), [onSkip.secret.hands[0][0].id]);
});

test('an illegal card, a card that is not yours, and a play out of turn are refused and change nothing', () => {
  const h = [num('blue', 7), num('red', 2)];
  const s = table(3, [h, [num('green', 1)], [num('green', 2)]], num('red', 5));
  assert.throws(() => play(s, 0, h[0]), code('ILLEGAL_MOVE'));
  assert.throws(() => play(s, 0, num('red', 5)), code('NOT_YOUR_CARD'));
  assert.throws(() => play(s, 1, s.secret.hands[1][0]), code('NOT_YOUR_TURN'));
  assert.throws(() => ClashEngine.apply(s, 0, { type: 'play' }, T0, seeded(1)), code('INVALID_INPUT'));
  assert.throws(() => ClashEngine.apply(s, 9, { type: 'draw' }, T0, seeded(1)), code('NOT_PLAYER'));
  assert.equal(s.version, 1);
  assert.equal(count(s, 0), 2);
});

test('a number card is played: it becomes the top, the turn passes, version goes up by one', () => {
  const h = [num('red', 2), num('blue', 9)];
  const s = table(3, [h, [num('green', 1), num('green', 2)], [num('green', 3), num('green', 4)]], num('red', 5));
  const n = play(s, 0, h[0]);
  assert.equal(n.top.id, h[0].id);
  assert.equal(n.currentSeat, 1);
  assert.equal(count(n, 0), 1);
  assert.equal(n.version, 2);
  assert.equal(n.secret.discardPile.length, 1, 'the old top goes under the new one');
  assert.equal(allCards(n).length, allCards(s).length);
});

test('a Wild needs a valid colour; the colour it names becomes active for the next player', () => {
  const w = card(null, 'wild');
  const s = table(2, [[w, num('blue', 9)], [num('green', 1), num('red', 4)]], num('red', 5));
  assert.throws(() => play(s, 0, w), code('INVALID_INPUT'));
  assert.throws(() => play(s, 0, w, 'purple'), code('INVALID_INPUT'));
  const n = play(s, 0, w, 'green');
  assert.equal(n.activeColor, 'green');
  assert.equal(n.currentSeat, 1);
  assert.deepEqual(ClashEngine.playableIds(n, 1), [n.secret.hands[1][0].id], 'only green now (the red 4 no longer matches)');
});

test('with challenges off, a Wild Draw Four is legal only when the hand has no card of the active colour', () => {
  const w4 = card(null, 'wild-draw-four');
  const rules = { drawFourChallenge: false };
  const blocked = table(2, [[w4, num('red', 9)], [num('green', 1)]], num('red', 5), { rules });
  assert.throws(() => play(blocked, 0, w4, 'blue'), code('ILLEGAL_MOVE'));
  const free = table(2, [[w4, num('blue', 9)], [num('green', 1)]], num('red', 5), { rules });
  const n = play(free, 0, w4, 'blue');
  assert.equal(count(n, 1), 5, 'the next player drew four at once');
  assert.equal(n.currentSeat, 0, 'and lost their turn (two players: back to seat 0)');
});

// ---------------------------------------------------------------- action cards and turn order
test('Skip passes over the next player, in 2, 3 and 4 player games', () => {
  const sk = card('red', 'skip');
  for (const n of [3, 4]) {
    const s = table(n, [[sk, num('red', 1)], ...Array.from({ length: n - 1 }, () => [num('green', 1), num('green', 2)])], num('red', 5));
    assert.equal(play(s, 0, sk).currentSeat, 2, `${n} players`);
  }
  const two = table(2, [[sk, num('red', 1)], [num('green', 1)]], num('red', 5));
  assert.equal(play(two, 0, sk).currentSeat, 0, 'two players: the skipped player is the other one, so the same player goes again');
});

test('Reverse flips the direction in 3 and 4 player games; with two players it acts as Skip (or as a normal turn when the rule says so)', () => {
  const rv = card('red', 'reverse');
  const three = table(3, [[rv, num('red', 1)], [num('green', 1)], [num('green', 2)]], num('red', 5));
  const r3 = play(three, 0, rv);
  assert.equal(r3.direction, -1);
  assert.equal(r3.currentSeat, 2, 'counter-clockwise from seat 0 is seat 2');
  assert.equal(ClashEngine.nextSeat(r3, 2), 1);
  const two = table(2, [[rv, num('red', 1)], [num('green', 1)]], num('red', 5));
  assert.equal(play(two, 0, rv).currentSeat, 0);
  const normal = table(2, [[rv, num('red', 1)], [num('green', 1)]], num('red', 5), { rules: { reverseTwoPlayers: 'normal' } });
  assert.equal(play(normal, 0, rv).currentSeat, 1);
});

test('Draw Two makes the next player draw two and lose their turn (no stacking)', () => {
  const d2 = card('red', 'draw-two');
  const s = table(3, [[d2, num('red', 1)], [num('green', 1)], [num('green', 2)]], num('red', 5));
  const n = play(s, 0, d2);
  assert.equal(count(n, 1), 3);
  assert.equal(n.currentSeat, 2);
  // the target cannot answer with another Draw Two: it is not their turn
  assert.throws(() => play(n, 1, card('red', 'draw-two')), code('NOT_YOUR_TURN'));
});

test('turn order follows the direction and skips a player who left', () => {
  const s = table(4, [[], [], [], []], num('red', 5));
  assert.equal(ClashEngine.nextSeat(s, 0), 1);
  assert.equal(ClashEngine.nextSeat(s, 3), 0);
  s.direction = -1;
  assert.equal(ClashEngine.nextSeat(s, 0), 3);
  s.players[3].left = true;
  assert.equal(ClashEngine.nextSeat(s, 0), 2);
});

// ---------------------------------------------------------------- Wild Draw Four challenge
function wildFourTable(guilty: boolean, extra: ClashCard[] = []) {
  const w4 = card(null, 'wild-draw-four');
  // seat 0 holds a red card (a card of the active colour) only when guilty
  const hand0 = [w4, guilty ? num('red', 8) : num('blue', 8), ...extra];
  const s = table(3, [hand0, [num('green', 1), num('green', 2)], [num('green', 3), num('green', 4)]], num('red', 5));
  return { s, w4 };
}

test('Wild Draw Four: the next player must decide; accepting draws four and loses the turn', () => {
  const { s, w4 } = wildFourTable(false);
  const n = play(s, 0, w4, 'blue');
  assert.equal(n.turnPhase, 'challenge');
  assert.equal(n.currentSeat, 1);
  assert.deepEqual(n.pending && { from: n.pending.fromSeat, to: n.pending.targetSeat }, { from: 0, to: 1 });
  assert.throws(() => play(n, 1, n.secret.hands[1][0]), code('ILLEGAL_MOVE'));
  const accepted = act(n, 1, 'draw');
  assert.equal(count(accepted, 1), 6);
  assert.equal(accepted.pending, null);
  assert.equal(accepted.currentSeat, 2, 'seat 1 lost the turn');
  assert.equal(accepted.activeColor, 'blue');
});

test('a successful challenge: the Wild Draw Four player draws four and the challenger plays on', () => {
  const { s, w4 } = wildFourTable(true);
  const n = play(s, 0, w4, 'blue');
  const c = act(n, 1, 'challenge-wild');
  assert.equal(count(c, 0), 2 + 4 - 1, 'seat 0 had 2 cards after playing, then drew four');
  assert.equal(count(c, 1), 2, 'the challenger drew nothing');
  assert.equal(c.currentSeat, 1, 'and it is their turn');
  assert.equal(c.lastEvent?.kind, 'challenge');
  assert.equal(c.lastEvent?.success, true);
});

test('a failed challenge: the challenger draws six and loses the turn', () => {
  const { s, w4 } = wildFourTable(false);
  const n = play(s, 0, w4, 'blue');
  const c = act(n, 1, 'challenge-wild');
  assert.equal(count(c, 1), 2 + 6);
  assert.equal(c.currentSeat, 2);
  assert.equal(c.lastEvent?.success, false);
});

test('only the player who has to draw can challenge, and only while one is pending; resolving twice is impossible', () => {
  const { s, w4 } = wildFourTable(false);
  const n = play(s, 0, w4, 'blue');
  assert.throws(() => act(n, 2, 'challenge-wild'), code('NOT_YOUR_TURN'));
  assert.throws(() => act(n, 0, 'challenge-wild'), code('NOT_YOUR_TURN'));
  const done = act(n, 1, 'challenge-wild');
  assert.throws(() => act(done, 1, 'challenge-wild'), (e: any) => e instanceof GameRuleError);
  assert.throws(() => act(table(2, [[], []], num('red', 1)), 0, 'challenge-wild'), code('ILLEGAL_MOVE'));
});

test('the challenger learns only success or failure, never the hand', () => {
  const { s, w4 } = wildFourTable(true, [num('green', 9)]);
  const n = play(s, 0, w4, 'blue');
  const c = act(n, 1, 'challenge-wild');
  const view = ClashEngine.publicStateFor(c, 'u1', T0) as any;
  const text = JSON.stringify(view);
  for (const cardInHand of c.secret.hands[0]) assert.equal(text.includes(cardInHand.id), false, 'seat 0 hand stays private');
});

// ---------------------------------------------------------------- drawing
test('drawing: a playable drawn card may be played at once, or the player passes; an unplayable one ends the turn', () => {
  const playable = num('red', 7);
  const s = table(2, [[num('blue', 1), num('blue', 2)], [num('green', 1)]], num('red', 5), { pile: [num('yellow', 3), playable] }); // draws from the end
  const d = act(s, 0, 'draw');
  assert.equal(d.turnPhase, 'drawn');
  assert.deepEqual(ClashEngine.playableIds(d, 0), [playable.id]);
  assert.throws(() => play(d, 0, d.secret.hands[0][0]), code('ILLEGAL_MOVE'), 'only the drawn card');
  assert.throws(() => act(d, 0, 'draw'), code('ILLEGAL_MOVE'));
  const played = play(d, 0, playable);
  assert.equal(played.top.id, playable.id);
  assert.equal(played.currentSeat, 1);
  const passed = act(d, 0, 'pass');
  assert.equal(passed.currentSeat, 1);
  assert.equal(count(passed, 0), 3, 'the drawn card stays in the hand');
  // not playable
  const t = table(2, [[num('blue', 1)], [num('green', 1)]], num('red', 5), { pile: [num('green', 9)] });
  const dd = act(t, 0, 'draw');
  assert.equal(dd.turnPhase, 'play');
  assert.equal(dd.currentSeat, 1);
});

test('passing is only possible after drawing; drawing with a playable card depends on the voluntary-draw rule', () => {
  const s = table(2, [[num('red', 1)], [num('green', 1)]], num('red', 5));
  assert.throws(() => act(s, 0, 'pass'), code('ILLEGAL_MOVE'));
  assert.equal(act(s, 0, 'draw').version, 2, 'voluntary draw is allowed by default');
  const strict = table(2, [[num('red', 1)], [num('green', 1)]], num('red', 5), { rules: { voluntaryDraw: false } });
  assert.throws(() => act(strict, 0, 'draw'), code('ILLEGAL_MOVE'));
});

test('when the draw pile runs out the discards (except the top) are shuffled back; no card is lost or duplicated', () => {
  const s = table(2, [[num('blue', 1)], [num('green', 1)]], num('red', 5), { pile: [] });
  s.secret.discardPile = [num('yellow', 1), num('yellow', 2), num('yellow', 3)];
  const before = allCards(s).length;
  const d = act(s, 0, 'draw');
  assert.equal(count(d, 0), 2);
  assert.equal(d.secret.drawPile.length + d.secret.discardPile.length, 2);
  assert.equal(allCards(d).length, before);
  assert.equal(new Set(allCards(d).map((c) => c.id)).size, before);
  // nothing anywhere: the turn just passes
  const empty = table(2, [[num('blue', 1)], [num('green', 1)]], num('red', 5), { pile: [] });
  const e = act(empty, 0, 'draw');
  assert.equal(e.currentSeat, 1);
});

// ---------------------------------------------------------------- last card
test('playing down to one card without declaring opens a window to be caught; declaring first avoids it', () => {
  const h = [num('red', 2), num('red', 3)];
  const s = table(3, [h, [num('green', 1), num('green', 2)], [num('green', 3), num('green', 4)]], num('red', 5));
  const n = play(s, 0, h[0], undefined, T0 + 1000);
  assert.equal(n.lastCardWindow?.seat, 0);
  assert.equal(n.lastCardWindow?.until, new Date(T0 + 1000 + 5000).toISOString());
  const declaredFirst = act(s, 0, 'declare');
  assert.equal(declaredFirst.players[0].declared, true);
  const n2 = play(declaredFirst, 0, h[0]);
  assert.equal(n2.lastCardWindow, null);
  assert.equal(n2.players[0].declared, true);
});

test('catching an undeclared one-card player in time gives them the penalty; too late, already declared, or no longer one card: refused', () => {
  const h = [num('red', 2), num('red', 3)];
  const s = table(3, [h, [num('green', 1), num('green', 2)], [num('green', 3), num('green', 4)]], num('red', 5));
  const n = play(s, 0, h[0], undefined, T0 + 1000);
  assert.throws(() => act(n, 0, 'catch', { target: 0 }, T0 + 1500), code('ILLEGAL_MOVE'), 'you cannot catch yourself');
  assert.throws(() => act(n, 1, 'catch', { target: 0 }, T0 + 1000 + 5000), code('ILLEGAL_MOVE'), 'the window closed');
  assert.throws(() => act(n, 1, 'catch', { target: 2 }, T0 + 1500), code('ILLEGAL_MOVE'), 'nobody there');
  const caught = act(n, 1, 'catch', { target: 0 }, T0 + 1500);
  assert.equal(count(caught, 0), 3, 'drew the 2 card penalty');
  assert.equal(caught.lastCardWindow, null);
  assert.throws(() => act(caught, 2, 'catch', { target: 0 }, T0 + 1600), code('ILLEGAL_MOVE'), 'only caught once');
  // declared in time: the window closes and nobody can catch them
  const saved = act(n, 0, 'declare', {}, T0 + 1200);
  assert.throws(() => act(saved, 1, 'catch', { target: 0 }, T0 + 1300), code('ILLEGAL_MOVE'));
});

test('declaring is only possible with two cards or one card left', () => {
  const s = table(2, [[num('red', 1), num('red', 2), num('red', 3)], [num('green', 1)]], num('red', 5));
  assert.throws(() => act(s, 0, 'declare'), code('ILLEGAL_MOVE'));
  assert.equal(act(s, 1, 'declare').players[1].declared, true);
});

test('drawing cancels an earlier declaration; the window closes by itself on the clock', () => {
  const s = table(2, [[num('red', 1), num('red', 2)], [num('green', 1)]], num('red', 5));
  const d = act(act(s, 0, 'declare'), 0, 'draw');
  assert.equal(d.players[0].declared, false, 'three cards now: the declaration no longer applies');
  const h = [num('red', 2), num('red', 3)];
  const t = table(3, [h, [num('green', 1)], [num('green', 2)]], num('red', 5));
  const n = play(t, 0, h[0], undefined, T0 + 1000);
  const later = ClashEngine.advance(n, T0 + 1000 + 5000, seeded(1));
  assert.equal(later.changed, true);
  assert.equal(later.state.lastCardWindow, null);
});

// ---------------------------------------------------------------- winning
test('playing the last card wins at once and scores the cards left in the other hands', () => {
  const last = num('red', 2);
  const s = table(3, [[last], [num('green', 4), card('green', 'skip')], [card(null, 'wild')]], num('red', 5));
  const n = play(s, 0, last);
  assert.equal(n.status, 'finished');
  assert.equal(n.winnerSeat, 0);
  assert.equal(n.winnerUserId, 'u0');
  assert.equal(n.points, 4 + 20 + 50);
  assert.equal(n.deadlineAt, null);
  assert.throws(() => act(n, 1, 'draw'), code('GAME_OVER'));
  assert.throws(() => play(n, 0, last), code('GAME_OVER'));
});

test('a last Draw Two still makes the next player draw before the winner is declared', () => {
  const d2 = card('red', 'draw-two');
  const s = table(2, [[d2], [num('green', 1)]], num('red', 5));
  const n = play(s, 0, d2);
  assert.equal(n.status, 'finished');
  assert.equal(count(n, 1), 3);
  assert.equal(n.points, 1 + 9 + 8, 'the two drawn cards (a yellow 9 and a yellow 8 from the pile) count in the score');
});

test('a last Wild Draw Four waits for the challenge: accepted it wins, a successful challenge stops the win', () => {
  const w4a = card(null, 'wild-draw-four');
  const s = table(2, [[w4a], [num('green', 1), num('green', 2)]], num('red', 5));
  const n = play(s, 0, w4a, 'blue');
  assert.equal(n.status, 'active', 'not yet');
  assert.equal(n.pending?.winPending, true);
  const won = act(n, 1, 'draw');
  assert.equal(won.status, 'finished');
  assert.equal(won.winnerSeat, 0);
  assert.equal(count(won, 1), 2 + 4);
  // guilty and challenged: no win, four more cards
  const w4b = card(null, 'wild-draw-four');
  const g = table(2, [[w4b, num('red', 9)], [num('green', 1)]], num('red', 5), { rules: { drawFourChallenge: true } });
  g.secret.hands[0] = [w4b];
  // make it guilty: the hand had a red card when the Wild Draw Four was played, so play it from two cards then...
  const g2 = table(2, [[w4b, num('red', 9)], [num('green', 1)]], num('red', 5));
  const p1 = play(g2, 0, w4b, 'blue');
  assert.equal(p1.pending?.winPending, false);
  const c = act(p1, 1, 'challenge-wild');
  assert.equal(c.status, 'active');
});

test('the winner is announced once: nothing can be done after the end', () => {
  const last = num('red', 2);
  const s = table(2, [[last], [num('green', 1)]], num('red', 5));
  const n = play(s, 0, last);
  for (const t of ['draw', 'pass', 'declare', 'challenge-wild'] as const) assert.throws(() => act(n, 1, t), code('GAME_OVER'));
  assert.equal(ClashEngine.advance(n, T0 + 10 ** 9, seeded(1)).changed, false);
});

// ---------------------------------------------------------------- the clock
test('a turn that runs out draws a card and passes; a Wild Draw Four that is not answered is accepted', () => {
  const s = table(3, [[num('blue', 1)], [num('green', 1)], [num('green', 2)]], num('red', 5));
  assert.equal(s.deadlineAt, new Date(T0 + 30_000).toISOString());
  const same = ClashEngine.advance(s, T0 + 29_000, seeded(1));
  assert.equal(same.changed, false);
  const out = ClashEngine.advance(s, T0 + 30_000, seeded(1));
  assert.equal(out.changed, true);
  assert.equal(count(out.state, 0), 2);
  assert.equal(out.state.currentSeat, 1);
  assert.equal(out.state.lastEvent?.kind, 'timeout');
  assert.equal(out.state.deadlineAt, new Date(T0 + 60_000).toISOString());
  // a pending Wild Draw Four
  const w4 = card(null, 'wild-draw-four');
  const w = table(3, [[w4, num('blue', 8)], [num('green', 1)], [num('green', 2)]], num('red', 5));
  const p = play(w, 0, w4, 'blue', T0 + 1000);
  const timedOut = ClashEngine.advance(p, T0 + 1000 + 30_000, seeded(1));
  assert.equal(count(timedOut.state, 1), 5);
  assert.equal(timedOut.state.currentSeat, 2);
});

test('after drawing a playable card, running out of time passes the turn; an unlimited game has no clock', () => {
  const s = table(2, [[num('blue', 1)], [num('green', 1)]], num('red', 5), { pile: [num('red', 7)] });
  const d = act(s, 0, 'draw');
  assert.equal(d.turnPhase, 'drawn');
  const out = ClashEngine.advance(d, Date.parse(d.deadlineAt as string), seeded(1));
  assert.equal(out.state.currentSeat, 1);
  const u = table(2, [[num('blue', 1)], [num('green', 1)]], num('red', 5), { rules: { turnSeconds: null } });
  assert.equal(ClashEngine.advance({ ...u, deadlineAt: null }, T0 + 10 ** 12, seeded(1)).changed, false);
});

// ---------------------------------------------------------------- versions, idempotency, leaving
test('the version rises by exactly one per accepted action; a resent move id changes nothing; a stale version is refused', () => {
  const h = [num('red', 2), num('red', 3), num('red', 4)];
  const s = table(2, [h, [num('green', 1), num('green', 2)]], num('red', 5));
  const first = ClashEngine.apply(s, 0, { type: 'play', cardId: h[0].id, moveId: 'm1' }, T0, seeded(1));
  assert.equal(first.state.version, 2);
  const again = ClashEngine.apply(first.state, 0, { type: 'play', cardId: h[0].id, moveId: 'm1' }, T0, seeded(1));
  assert.equal(again.duplicate, true);
  assert.equal(again.state, first.state);
  assert.throws(() => ClashEngine.apply(first.state, 1, { type: 'draw', baseVersion: 1 }, T0, seeded(1)), code('STALE_STATE'));
  assert.doesNotThrow(() => ClashEngine.apply(first.state, 1, { type: 'draw', baseVersion: 2 }, T0, seeded(1)));
  assert.throws(() => ClashEngine.apply(s, 0, { type: 'draw', moveId: 'x'.repeat(65) }, T0, seeded(1)), code('INVALID_INPUT'));
});

test('a player who leaves returns their cards to the draw pile (nothing lost) and the turn moves on', () => {
  const s = table(3, [[num('red', 1), num('red', 2)], [num('green', 1), num('green', 2), num('green', 3)], [num('green', 4)]], num('red', 5));
  const before = allCards(s).length;
  const n = ClashEngine.removePlayer(s, 0, T0 + 1000);
  assert.equal(n.players[0].left, true);
  assert.equal(n.currentSeat, 1);
  assert.equal(allCards(n).length, before);
  assert.equal(count(n, 0), 0);
  assert.equal(ClashEngine.nextSeat(n, 2), 1, 'seat 0 is skipped from now on');
  const w = ClashEngine.forfeitWin(n, 1, 'P0');
  assert.equal(w.status, 'forfeit');
  assert.equal(w.winnerSeat, 1);
});

test('a leaver with a Wild Draw Four pending against them clears it', () => {
  const w4 = card(null, 'wild-draw-four');
  const s = table(3, [[w4, num('blue', 8)], [num('green', 1)], [num('green', 2)]], num('red', 5));
  const p = play(s, 0, w4, 'blue');
  const n = ClashEngine.removePlayer(p, 1, T0 + 2000);
  assert.equal(n.pending, null);
  assert.equal(n.turnPhase, 'play');
  assert.equal(n.currentSeat, 2);
});

test('cancelling ends the game with no winner', () => {
  const c = ClashEngine.cancel(table(2, [[], []], num('red', 1)));
  assert.equal(c.status, 'cancelled');
  assert.equal(c.winnerSeat, null);
});

// ---------------------------------------------------------------- privacy
test('a player sees their own hand and what they may do, never anyone else\'s cards or the pile order', () => {
  const s = ClashEngine.createMatch(players(4), { now: T0, rng: seeded(7), startingSeat: 0 });
  for (const viewer of ['u0', 'u1', 'u2', 'u3']) {
    const view = ClashEngine.publicStateFor(s, viewer, T0) as any;
    assert.equal(view.secret, undefined);
    assert.equal(view.myHand.length, 7);
    const text = JSON.stringify(view);
    for (const p of s.players) if (p.userId !== viewer) for (const c of s.secret.hands[p.seat]) assert.equal(text.includes(c.id), false, `${viewer} must not see ${p.userId}'s ${c.id}`);
    for (const c of s.secret.drawPile) assert.equal(text.includes(c.id), false, 'the draw pile is never revealed');
    assert.equal(view.drawCount, s.secret.drawPile.length);
    assert.deepEqual(view.players.map((p: any) => p.cards), [7, 7, 7, 7]);
    assert.ok(view.playable.every((id: string) => view.myHand.some((c: ClashCard) => c.id === id)));
  }
  const spectator = ClashEngine.publicStateFor(s, 'watcher', T0) as any;
  assert.equal(spectator.myHand, null);
  assert.equal(spectator.mySeat, null);
  assert.deepEqual(spectator.playable, []);
  assert.equal(spectator.canDraw, false);
  const view0 = ClashEngine.publicStateFor(s, `u${s.currentSeat}`, T0) as any;
  assert.equal(view0.canDraw, true);
  assert.equal(ClashEngine.publicStateFor(view0, 'u0', T0), view0, 'a state already redacted is returned as it is');
});

test('card names and points', () => {
  assert.equal(describeCard(num('red', 5)), 'red 5');
  assert.equal(describeCard(card('blue', 'draw-two')), 'blue Draw Two');
  assert.equal(describeCard(card(null, 'wild')), 'Wild');
  assert.equal(cardPoints(num('red', 7)), 7);
  assert.equal(cardPoints(card('red', 'skip')), 20);
  assert.equal(cardPoints(card(null, 'wild-draw-four')), 50);
});

test('a whole game played by the legal moves alone always ends, never loses a card, and the winner is the one with an empty hand', () => {
  for (const n of [2, 3, 4]) {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = seeded(seed * 31 + n);
      let s = ClashEngine.createMatch(players(n), { now: T0, rng, rules: { turnSeconds: null } });
      let now = T0;
      for (let step = 0; step < 3000 && ClashEngine.isLive(s); step++) {
        now += 1000;
        const seat = s.currentSeat;
        const legal = ClashEngine.playableIds(s, seat);
        if (s.turnPhase === 'challenge') s = act(s, seat, 'draw', {}, now);
        else if (legal.length > 0) {
          const c = s.secret.hands[seat].find((x) => x.id === legal[0]) as ClashCard;
          s = ClashEngine.apply(s, seat, { type: 'play', cardId: c.id, color: c.color === null ? 'red' : undefined }, now, rng).state;
        } else if (s.turnPhase === 'drawn') s = act(s, seat, 'pass', {}, now);
        else s = ClashEngine.apply(s, seat, { type: 'draw' }, now, rng).state;
        assert.equal(new Set(allCards(s).map((x) => x.id)).size, 108, 'every card is still there exactly once');
      }
      assert.equal(s.status, 'finished', `${n} players, seed ${seed} ended`);
      assert.equal(count(s, s.winnerSeat as number), 0);
    }
  }
});
