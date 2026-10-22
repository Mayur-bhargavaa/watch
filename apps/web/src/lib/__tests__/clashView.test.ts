import test from 'node:test';
import assert from 'node:assert/strict';
import { cardLabel, cardMark, eventText, isClashState, seatsAround, sortHand, turnPrompt, turnSeconds, resultTitle } from '../clashView';
import type { ClashCard, ClashPlayerView, ClashPublicState } from '@synccinema/common';

const card = (color: ClashCard['color'], kind: ClashCard['kind'], value: number | null = null, id = `${color}-${kind}-${value}`): ClashCard => ({ id, color, kind, value });
const P = (n: number): ClashPlayerView[] => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `P${i}`, seat: i, cards: 7, declared: false, left: false }));
const state = (over: Partial<ClashPublicState> = {}): ClashPublicState => ({
  game: 'color-clash', gameId: 'g', rules: { turnSeconds: 30, reverseTwoPlayers: 'skip', drawFourChallenge: true, voluntaryDraw: true, playDrawnCard: true, lastCardPenalty: 2, lastCardWindowSeconds: 5 },
  status: 'active', players: P(3), currentSeat: 0, direction: 1, activeColor: 'red', top: card('red', 'number', 5), drawCount: 80, discardCount: 1, turnPhase: 'play', pending: null,
  lastCardWindow: null, deadlineAt: new Date(1_000_000 + 30_000).toISOString(), winnerSeat: null, winnerUserId: null, winner: null, isDraw: false, points: null, finishReason: null,
  version: 3, moveCount: 2, lastEvent: null, statusMessage: '', startingSeat: 0, currentTurnSeat: 0, mySeat: 0, myHand: [], playable: [], canDraw: true, canPass: false,
  canChallengeWild: false, canDeclare: false, catchable: [], ...over
});

test('cards are named the way a screen reader should say them (colour first, so colour is never the only clue)', () => {
  assert.equal(cardLabel(card('red', 'number', 5)), 'Red 5');
  assert.equal(cardLabel(card('blue', 'skip')), 'Blue Skip');
  assert.equal(cardLabel(card('green', 'reverse')), 'Green Reverse');
  assert.equal(cardLabel(card('yellow', 'draw-two')), 'Yellow Draw Two');
  assert.equal(cardLabel(card(null, 'wild')), 'Wild');
  assert.equal(cardLabel(card(null, 'wild-draw-four')), 'Wild Draw Four');
  assert.equal(cardMark(card('red', 'number', 7)), '7');
  assert.equal(cardMark(card('red', 'draw-two')), '+2');
  assert.equal(cardMark(card(null, 'wild-draw-four')), '+4');
});

test('the hand is shown in a steady order: colour, then numbers up, then actions, wilds last', () => {
  const hand = [card(null, 'wild'), card('blue', 'skip'), card('red', 'number', 9, 'a'), card('red', 'number', 2, 'b'), card('blue', 'number', 4, 'c'), card('red', 'draw-two')];
  assert.deepEqual(sortHand(hand).map(cardLabel), ['Red 2', 'Red 9', 'Red Draw Two', 'Blue 4', 'Blue Skip', 'Wild']);
  assert.equal(hand.length, 6, 'the input is not changed');
});

test('where the others sit: across for one opponent, left and right for two, left / across / right for three, in play order', () => {
  assert.deepEqual(seatsAround(P(2), 0).map((x) => [x.player.seat, x.position]), [[1, 'top']]);
  assert.deepEqual(seatsAround(P(3), 0).map((x) => [x.player.seat, x.position]), [[1, 'left'], [2, 'right']]);
  assert.deepEqual(seatsAround(P(4), 0).map((x) => [x.player.seat, x.position]), [[1, 'left'], [2, 'top'], [3, 'right']]);
  // I am seat 2 of 4: the next player is seat 3 on my left
  assert.deepEqual(seatsAround(P(4), 2).map((x) => [x.player.seat, x.position]), [[3, 'left'], [0, 'top'], [1, 'right']]);
  // a spectator sees everyone; players who left are not drawn
  assert.equal(seatsAround(P(3), null).length, 3);
  assert.deepEqual(seatsAround(P(4), null).map((x) => x.position), ['left', 'top', 'right', 'bottom']);
  const left = P(4);
  left[1].left = true;
  assert.deepEqual(seatsAround(left, 0).map((x) => x.player.seat), [2, 3]);
});

test('the countdown comes from the server deadline and the clock offset', () => {
  const s = state();
  assert.equal(turnSeconds(s, 1_000_000, 0), 30);
  assert.equal(turnSeconds(s, 1_012_000, 0), 18);
  assert.equal(turnSeconds(s, 1_060_000, -60_000), 30);
  assert.equal(turnSeconds(s, 2_000_000, 0), 0);
  assert.equal(turnSeconds(state({ deadlineAt: null }), 1, 0), null);
});

test('the prompt says what to do, and who is on turn otherwise', () => {
  assert.equal(turnPrompt(state({ playable: ['x'] })).text, 'Your turn: play a card');
  assert.equal(turnPrompt(state()).text, 'Your turn: no card fits, draw one');
  assert.equal(turnPrompt(state({ turnPhase: 'drawn' })).text, 'Play the card you drew, or pass');
  assert.match(turnPrompt(state({ turnPhase: 'challenge', pending: { kind: 'wild-four', fromSeat: 2, targetSeat: 0 } })).text, /Wild Draw Four/);
  assert.equal(turnPrompt(state({ currentSeat: 1 })).text, "P1's turn");
  assert.equal(turnPrompt(state({ currentSeat: 1, mySeat: null })).tone, 'wait');
  assert.equal(turnPrompt(state({ status: 'finished', statusMessage: 'P0 wins' })).tone, 'over');
});

test('events are described in plain words', () => {
  const players = P(3);
  assert.equal(eventText({ kind: 'play', seat: 1, card: card('red', 'skip') }, players), 'P1 played Red Skip');
  assert.equal(eventText({ kind: 'play', seat: 1, card: card(null, 'wild'), color: 'blue' }, players), 'P1 played Wild and chose Blue');
  assert.equal(eventText({ kind: 'draw', seat: 2, count: 4 }, players), 'P2 drew 4 cards');
  assert.equal(eventText({ kind: 'declare', seat: 0 }, players), 'P0 says LAST CARD!');
  assert.equal(eventText({ kind: 'penalty', seat: 0, count: 2 }, players), 'P0 was caught and draws 2');
  assert.match(eventText({ kind: 'challenge', seat: 1, target: 2, success: true, count: 4 }, players) as string, /challenge worked/);
  assert.match(eventText({ kind: 'challenge', seat: 1, target: 2, success: false, count: 6 }, players) as string, /failed/);
  assert.equal(eventText(null, players), null);
});

test('only a table in the right format is drawn; result titles', () => {
  assert.equal(isClashState(state()), true);
  assert.equal(isClashState({ board: [] }), false);
  assert.equal(isClashState(null), false);
  assert.equal(resultTitle(state({ status: 'finished', winnerSeat: 0 })), 'YOU WIN!');
  assert.equal(resultTitle(state({ status: 'finished', winnerSeat: 2 })), 'P2 WINS');
  assert.equal(resultTitle(state({ status: 'finished', winnerSeat: 2, mySeat: null })), 'P2 WON!');
  assert.equal(resultTitle(state({ status: 'cancelled' })), 'GAME CANCELLED');
});
