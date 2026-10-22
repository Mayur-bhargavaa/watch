import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClashTable, ColorPickerDialog } from '../ClashTable';
import { ClashCardBack, ClashCardFace } from '../ClashCard';
import type { ClashCard, ClashPlayerView, ClashPublicState } from '@synccinema/common';

const card = (color: ClashCard['color'], kind: ClashCard['kind'], value: number | null, id: string): ClashCard => ({ id, color, kind, value });
const P = (n: number, cards = 7): ClashPlayerView[] => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, displayName: `Player${i}`, seat: i, cards, declared: false, left: false }));
const HAND = [card('red', 'number', 5, 'h1'), card('blue', 'number', 9, 'h2'), card(null, 'wild', null, 'h3'), card('green', 'skip', null, 'h4')];
const state = (over: Partial<ClashPublicState> = {}): ClashPublicState => ({
  game: 'color-clash', gameId: 'g', rules: { turnSeconds: 30, reverseTwoPlayers: 'skip', drawFourChallenge: true, voluntaryDraw: true, playDrawnCard: true, lastCardPenalty: 2, lastCardWindowSeconds: 5 },
  status: 'active', players: P(3), currentSeat: 0, direction: 1, activeColor: 'red', top: card('red', 'number', 3, 'top'), drawCount: 70, discardCount: 4, turnPhase: 'play', pending: null,
  lastCardWindow: null, deadlineAt: new Date(Date.now() + 20_000).toISOString(), winnerSeat: null, winnerUserId: null, winner: null, isDraw: false, points: null, finishReason: null,
  version: 5, moveCount: 4, lastEvent: null, statusMessage: '', startingSeat: 0, currentTurnSeat: 0, mySeat: 0, myHand: HAND, playable: ['h1', 'h3'], canDraw: true, canPass: false,
  canChallengeWild: false, canDeclare: false, catchable: [], ...over
});
const noop = () => {};
const html = (s: unknown, o: { online?: boolean } = {}) => renderToStaticMarkup(React.createElement(ClashTable, {
  state: s as ClashPublicState | null, online: o.online ?? true, clockOffsetMs: 0, connectedIds: new Set(['u0', 'u1', 'u2', 'u3']), onPlay: noop, onDraw: noop, onPass: noop, onDeclare: noop, onCatch: noop, onChallenge: noop
}));

test('your hand is shown as real cards with names a screen reader can say', () => {
  const out = html(state());
  for (const label of ['Red 5', 'Blue 9', 'Wild', 'Green Skip']) assert.ok(out.includes(`aria-label="${label}"`), label);
  assert.ok(out.includes('Your hand, 4 cards'));
});

test('legal cards are highlighted and the rest are dimmed and marked disabled', () => {
  const out = html(state());
  assert.ok(/aria-label="Red 5"[^>]*aria-disabled="false"/.test(out) || /aria-pressed="false" aria-disabled="false"/.test(out));
  assert.ok(/aria-label="Blue 9"[^>]*aria-disabled="true"/.test(out));
  assert.ok(/aria-label="Green Skip"[^>]*aria-disabled="true"/.test(out));
  assert.ok(/aria-label="Wild"[^>]*aria-disabled="false"/.test(out));
});

test('opponents show only face-down cards and counts, never a card face', () => {
  const out = html(state({ players: P(4, 5), mySeat: 0 }));
  const backs = out.match(/role="img" aria-label="Card"/g) ?? [];
  assert.equal(backs.length, 3 * 5, 'five face-down cards for each of the three opponents');
  assert.ok(out.includes('Player1, 5 cards'));
  assert.ok(out.includes('Player3, 5 cards'));
  // the only faces on the page are my hand and the top of the pile
  const faces = (out.match(/aria-label="(Red|Blue|Green|Yellow) \d|aria-label="Wild"|aria-label="(Red|Blue|Green|Yellow) (Skip|Reverse|Draw Two)"/g) ?? []).length;
  assert.equal(faces, HAND.length + 1);
});

test('turn indicators: your turn says what to do; another turn names the player and rings them', () => {
  assert.ok(html(state()).includes('Your turn: play a card'));
  const other = html(state({ currentSeat: 1, canDraw: false, playable: [] }));
  assert.ok(other.includes('Player1&#x27;s turn') || other.includes("Player1's turn"));
  assert.ok(other.includes('their turn'));
});

test('the table shows the active colour (with its name), the direction and the timer', () => {
  const out = html(state({ activeColor: 'blue', direction: -1 }));
  assert.ok(out.includes('Active colour: Blue'));
  assert.ok(out.includes('Direction: counter-clockwise'));
  assert.ok(out.includes('role="timer"'));
  assert.ok(/\d+s</.test(out));
  assert.ok(html(state({ deadlineAt: null })).includes('No turn timer'));
});

test('Draw, Pass, Challenge and LAST CARD appear only when the server says they are possible', () => {
  const base = html(state({ canDraw: false }));
  assert.ok(!base.includes('Pass</button>') && !base.includes('Challenge +4') && !base.includes('LAST CARD!'));
  assert.ok(html(state({ canPass: true, turnPhase: 'drawn' })).includes('>Pass</button>'));
  const wild = html(state({ turnPhase: 'challenge', canChallengeWild: true, playable: [], pending: { kind: 'wild-four', fromSeat: 1, targetSeat: 0 } }));
  assert.ok(wild.includes('Challenge +4'));
  assert.ok(wild.includes('Draw 4'));
  assert.ok(html(state({ canDeclare: true })).includes('LAST CARD!'));
  // drawing is disabled when it is not allowed
  assert.ok(/<button type="button" disabled=""[^>]*>Draw card/.test(html(state({ canDraw: false }))));
});

test('a player who can be caught shows a Catch button; one who declared shows the badge', () => {
  const players = P(3);
  players[1].cards = 1;
  assert.ok(html(state({ players, catchable: [1] })).includes('Catch! (no Last Card)'));
  players[1].declared = true;
  const out = html(state({ players }));
  assert.ok(out.includes('LAST CARD!'));
  assert.ok(!out.includes('Catch! (no Last Card)'));
});

test('offline or not your turn: the pile and the buttons cannot be used', () => {
  assert.ok(/disabled=""[^>]*aria-label="Draw pile/.test(html(state({ canDraw: false }))) || html(state({ canDraw: false })).includes('disabled=""'));
  assert.ok(/<button type="button" disabled=""[^>]*>Draw card/.test(html(state(), { online: false })));
});

test('a spectator watches: no hand, no actions, a clear note', () => {
  const out = html(state({ mySeat: null, myHand: null, playable: [], canDraw: false }));
  assert.ok(out.includes('You are watching'));
  assert.ok(!out.includes('Your hand'));
  assert.ok(!out.includes('Draw card'));
});

test('a finished game shows nothing playable; a table from another game is not drawn', () => {
  const done = html(state({ status: 'finished', winnerSeat: 1, playable: [], canDraw: false }));
  assert.ok(!done.includes('Draw card'));
  assert.ok(done.includes('Game over') || done.includes('wins'));
  assert.ok(html({ board: [] }).includes('not a Color Clash game'));
  assert.equal(html(null), '');
});

test('the colour chooser is a dialog with four named colours and a way back', () => {
  const out = renderToStaticMarkup(React.createElement(ColorPickerDialog, { onPick: noop, onCancel: noop }));
  assert.ok(out.includes('role="dialog"') && out.includes('aria-modal="true"'));
  for (const name of ['Red', 'Blue', 'Green', 'Yellow']) assert.ok(out.includes(`>${name}</button>`), name);
  assert.ok(out.includes('Keep my card'));
});

test('a card face never shows only a colour: it also has a number, a mark or an icon, and a name', () => {
  const skip = renderToStaticMarkup(React.createElement(ClashCardFace, { card: card('red', 'skip', null, 'x'), size: 'hand' }));
  assert.ok(skip.includes('aria-label="Red Skip"') && skip.includes('<svg'));
  const back = renderToStaticMarkup(React.createElement(ClashCardBack, { size: 'pile' }));
  assert.ok(!/Red|Blue|Green|Yellow|Skip|Wild/.test(back), 'the back says nothing about the face');
});

test('animations respect reduced motion', () => {
  const players = P(3);
  players[1].cards = 1;
  const out = html(state({ players, catchable: [1], canDeclare: true, deadlineAt: new Date(Date.now() + 3000).toISOString() }));
  const tags = out.match(/<[^>]*class="[^"]*"[^>]*>/g) ?? [];
  for (const tag of tags) {
    const classes = (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    const bare = classes.filter((c) => /^animate-/.test(c) && c !== 'animate-fadeIn');
    if (bare.length) assert.ok(classes.includes('motion-reduce:animate-none'), `a bare ${bare[0]} needs motion-reduce:animate-none`);
  }
});

test('the top card of the pile is a block with a size (a bare inline span would collapse to nothing)', () => {
  const out = renderToStaticMarkup(React.createElement(ClashCardFace, { card: card('red', 'number', 3, 'top'), size: 'pile' }));
  assert.ok(/<span class="block [^"]*w-\[66px\][^"]*" role="img"/.test(out));
});
