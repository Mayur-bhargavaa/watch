import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { ClashEngine, type ClashServerState } from '../games/ClashEngine.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { DatabaseService } from '../db/database.js';
import type { ClashCard, ClashPublicState } from '@synccinema/common';

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const T0 = 1_700_000_000_000;
const seeded = (seed: number) => {
  let a = seed >>> 0;
  return (n: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
};

const managers: any[] = [];
after(() => {
  for (const m of managers) { try { m.dispose(); } catch { /* ignore */ } }
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
});

const NAMES = ['a', 'b', 'c', 'd', 'e'];
/** a room of `n` joined and connected players (the first is the host); nobody is ready and the game has not started */
function lobby(n: number, maxPlayers = 4) {
  const db = new DatabaseService(':memory:');
  let now = T0;
  const m: any = new GameRoomManager(db, { clock: () => now });
  m.clashRng = seeded(11);
  managers.push(m);
  const room = m.createGameRoom({ hostUser: U('a'), gameType: 'color-clash', maxPlayers });
  const msgs: any[] = [];
  const clients: Record<string, any> = {};
  const connect = (u: string, spectate = false) => {
    const sock: any = { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }), close() {}, on() {}, ping() {}, terminate() {} };
    m.registerClient(sock, room.id, U(u), spectate ? { spectate: true, canSpectate: true } : {});
    clients[u] = { socket: sock, roomId: room.id, userId: u, displayName: u.toUpperCase() };
    return clients[u];
  };
  const act = (u: string, type: string, payload?: any) => m.handleClientMessage(clients[u] ?? { socket: { readyState: 1, send: (d: string) => msgs.push({ to: u, ...JSON.parse(d) }) }, roomId: room.id, userId: u, displayName: u }, { type, payload });
  connect('a');
  for (let i = 1; i < n; i++) { m.joinRoom(room.roomCode, U(NAMES[i])); connect(NAMES[i]); }
  const t = {
    db, m, msgs, act, connect, id: room.id as string, code: room.roomCode as string,
    get: () => db.getGameRoomById(room.id)!,
    gs: () => db.getGameRoomById(room.id)!.gameState as ClashServerState,
    setNow: (x: number) => { now = x; },
    at: (ms: number) => { now = T0 + ms; m.tickClash(room.id); },
    lastError: () => [...msgs].reverse().find((x) => x.type === 'game:error'),
    /** everything this user has been sent, as one string */
    seen: (u: string) => JSON.stringify(msgs.filter((x) => x.to === u)),
    /** the latest table this user was sent, from any message that carries one */
    view: (u: string) => [...msgs].reverse().map((x) => (x.to === u ? (x.payload?.gameState ?? x.payload?.room?.gameState) : null)).find((g) => g && g.game === 'color-clash') as ClashPublicState,
    readyAll: () => { for (let i = 0; i < n; i++) act(NAMES[i], 'game:clash_ready', { ready: true }); },
    start: () => { t.readyAll(); act('a', 'game:clash_start'); }
  };
  return t;
}
const hands = (t: ReturnType<typeof lobby>) => t.gs().players.map((p) => ({ userId: p.userId, ids: t.gs().secret.hands[p.seat].map((c) => c.id) }));

// ---------------------------------------------------------------- the lobby
test('lobby: players join and leave before the start, ready flags are shared, only the host starts', () => {
  const t = lobby(2);
  assert.equal(t.get().status, 'WAITING');
  t.act('b', 'game:clash_ready', { ready: true });
  const lob = [...t.msgs].reverse().find((x) => x.type === 'game:clash_lobby');
  assert.deepEqual(lob.payload.ready, ['b']);
  t.act('b', 'game:clash_start');
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  t.act('a', 'game:clash_start'); // b is ready, the host is ready by starting
  assert.equal(t.get().status, 'PLAYING');
});

test('lobby: the host cannot start until every connected player is ready, or with fewer than 2', () => {
  const solo = lobby(1);
  solo.act('a', 'game:clash_start');
  assert.equal(solo.lastError().payload.code, 'INVALID_INPUT');
  const t = lobby(3);
  t.act('a', 'game:clash_start');
  assert.equal(t.lastError().payload.code, 'INVALID_INPUT');
  assert.match(t.lastError().payload.message, /Waiting for B, C/);
  t.act('b', 'game:clash_ready', { ready: true });
  t.act('c', 'game:clash_ready', { ready: true });
  t.act('c', 'game:clash_ready', { ready: false });
  t.act('a', 'game:clash_start');
  assert.equal(t.get().status, 'WAITING');
  t.act('c', 'game:clash_ready', { ready: true });
  t.act('a', 'game:clash_start');
  assert.equal(t.get().status, 'PLAYING');
});

test('lobby: the host sets the rule profile; nobody else can; bad values are replaced by defaults; the game uses it', () => {
  const t = lobby(2);
  t.act('b', 'game:clash_config', { turnSeconds: 15 });
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  t.act('a', 'game:clash_config', { turnSeconds: 15, drawFourChallenge: false, lastCardPenalty: 99, reverseTwoPlayers: 'normal' });
  const lob = [...t.msgs].reverse().find((x) => x.type === 'game:clash_lobby').payload.rules;
  assert.equal(lob.turnSeconds, 15);
  assert.equal(lob.drawFourChallenge, false);
  assert.equal(lob.lastCardPenalty, 2, 'a value outside the allowed range falls back to the default');
  assert.equal(lob.reverseTwoPlayers, 'normal');
  t.act('a', 'game:clash_config', 'nonsense');
  assert.equal(t.lastError().payload.code, 'INVALID_INPUT');
  t.start();
  assert.equal(t.gs().rules.turnSeconds, 15);
  assert.equal(t.gs().deadlineAt, new Date(T0 + 15_000).toISOString());
  t.act('a', 'game:clash_config', { turnSeconds: 60 });
  assert.equal(t.lastError().payload.code, 'ILLEGAL_MOVE');
});

test('lobby: a fifth player cannot join, and nobody can join after the start', () => {
  const t = lobby(4);
  assert.throws(() => t.m.joinRoom(t.code, U('e')));
  t.start();
  assert.equal(t.get().status, 'PLAYING');
  assert.throws(() => t.m.joinRoom(t.code, U('e')));
  // a late arrival can only watch
  const watcher = t.connect('e', true);
  assert.ok(watcher);
  assert.equal(t.get().players.length, 4);
});

// ---------------------------------------------------------------- starting with 2, 3 and 4 players, private hands
for (const n of [2, 3, 4]) {
  test(`start with ${n} players: 7 cards each, only seated players play, and each player is sent only their own hand`, () => {
    const t = lobby(n);
    const watcher = t.connect('watcher', true);
    assert.ok(watcher);
    t.start();
    assert.equal(t.get().status, 'PLAYING');
    const server = t.gs();
    assert.equal(server.players.length, n);
    for (const h of hands(t)) assert.equal(h.ids.length, 7);
    for (let i = 0; i < n; i++) {
      const me = NAMES[i];
      const view = t.view(me);
      assert.ok(view, `${me} got the table`);
      assert.equal(view.myHand!.length, 7);
      assert.deepEqual(view.myHand!.map((c) => c.id).sort(), [...server.secret.hands[i].map((c) => c.id)].sort(), 'it is their own hand');
      const text = t.seen(me);
      for (const other of hands(t)) if (other.userId !== me) for (const id of other.ids) assert.equal(text.includes(id), false, `${me} must never receive ${other.userId}'s card ${id}`);
      for (const c of server.secret.drawPile) assert.equal(text.includes(c.id), false, 'the draw pile order is never sent');
      assert.equal(view.players.length, n);
      assert.ok(view.players.every((p) => p.cards === 7));
    }
    const sw = t.seen('watcher');
    for (const h of hands(t)) for (const id of h.ids) assert.equal(sw.includes(id), false, 'a spectator sees no hand');
    assert.equal(t.view('watcher')?.myHand ?? null, null);
    assert.equal(JSON.stringify(t.get()).includes('myHand'), false);
  });
}

test('a sync (reconnect) gives the player the same table with their own hand, and nobody else\'s', () => {
  const t = lobby(3);
  t.start();
  const before = t.gs().version;
  t.msgs.length = 0;
  t.connect('b');
  const sync = t.msgs.find((x) => x.to === 'b' && x.type === 'game:sync');
  assert.ok(sync);
  const view = sync.payload.room.gameState as ClashPublicState;
  assert.equal(view.version, before, 'the game was not restarted');
  assert.deepEqual(view.myHand!.map((c) => c.id).sort(), t.gs().secret.hands[1].map((c) => c.id).sort());
  const text = JSON.stringify(sync);
  for (const other of hands(t)) if (other.userId !== 'b') for (const id of other.ids) assert.equal(text.includes(id), false);
  assert.equal(text.includes('"secret"'), false);
});

test('the REST view of a room (projectRoomFor) hides every hand as well', () => {
  const t = lobby(3);
  t.start();
  const view = t.m.projectRoomFor(t.get(), 'c');
  const text = JSON.stringify(view);
  for (const other of hands(t)) if (other.userId !== 'c') for (const id of other.ids) assert.equal(text.includes(id), false);
  assert.equal(view.gameState.myHand.length, 7);
  const asStranger = JSON.stringify(t.m.projectRoomFor(t.get(), 'stranger'));
  for (const h of hands(t)) for (const id of h.ids) assert.equal(asStranger.includes(id), false);
});

// ---------------------------------------------------------------- playing through the room
function cur(t: ReturnType<typeof lobby>) { return NAMES[t.gs().currentSeat]; }
/** a legal play (or a draw) by whoever's turn it is */
function oneMove(t: ReturnType<typeof lobby>) {
  const s = t.gs();
  const seat = s.currentSeat;
  const who = NAMES[seat];
  if (s.turnPhase === 'challenge') return t.act(who, 'game:clash_draw');
  const legal = ClashEngine.playableIds(s, seat);
  if (legal.length) {
    const c = s.secret.hands[seat].find((x) => x.id === legal[0]) as ClashCard;
    return t.act(who, 'game:clash_play', { cardId: c.id, color: c.color ? undefined : 'blue', baseVersion: s.version });
  }
  if (s.turnPhase === 'drawn') return t.act(who, 'game:clash_pass');
  return t.act(who, 'game:clash_draw');
}

test('room: every accepted move reaches every player as their own projection, with a rising version', () => {
  const t = lobby(3);
  t.start();
  const versions: number[] = [t.gs().version];
  for (let i = 0; i < 12 && t.get().status === 'PLAYING'; i++) { oneMove(t); versions.push(t.gs().version); }
  for (let i = 1; i < versions.length; i++) assert.equal(versions[i], versions[i - 1] + 1);
  for (let i = 0; i < 3; i++) {
    const v = t.view(NAMES[i]);
    assert.equal(v.version, t.gs().version);
    assert.deepEqual(v.myHand!.map((c) => c.id).sort(), t.gs().secret.hands[i].map((c) => c.id).sort());
    const text = t.seen(NAMES[i]);
    for (const other of hands(t)) if (other.userId !== NAMES[i]) for (const id of other.ids) assert.equal(text.includes(id), false, `${NAMES[i]} saw ${id} of ${other.userId}`);
  }
});

test('room: spectators, strangers, out-of-turn players, cards that are not yours and illegal cards are all refused', () => {
  const t = lobby(3);
  t.connect('watcher', true);
  t.start();
  const s = t.gs();
  const seat = s.currentSeat;
  const other = NAMES[(seat + 1) % 3];
  t.act('watcher', 'game:clash_draw');
  assert.equal(t.lastError().payload.code, 'NOT_PLAYER');
  t.act('stranger', 'game:clash_play', { cardId: s.secret.hands[0][0].id });
  assert.equal(t.lastError().payload.code, 'NOT_PLAYER');
  t.act(other, 'game:clash_draw');
  assert.equal(t.lastError().payload.code, 'NOT_YOUR_TURN');
  t.act(NAMES[seat], 'game:clash_play', { cardId: s.secret.hands[(seat + 1) % 3][0].id });
  assert.equal(t.lastError().payload.code, 'NOT_YOUR_CARD');
  const illegal = s.secret.hands[seat].find((c) => !ClashEngine.playableIds(s, seat).includes(c.id));
  if (illegal) { t.act(NAMES[seat], 'game:clash_play', { cardId: illegal.id }); assert.equal(t.lastError().payload.code, 'ILLEGAL_MOVE'); }
  assert.equal(t.gs().version, s.version, 'nothing changed');
});

test('room: malformed requests are refused and change nothing', () => {
  const t = lobby(2);
  t.start();
  const before = JSON.stringify(t.gs());
  const who = cur(t);
  for (const bad of ['text', 5, [], { cardId: 5 }, { cardId: '' }, { cardId: 'x', moveId: 5 }, { cardId: 'x', baseVersion: 'a' }]) {
    t.act(who, 'game:clash_play', bad);
    assert.ok(t.lastError(), JSON.stringify(bad));
  }
  t.act(who, 'game:clash_catch', { target: 'z' });
  assert.equal(JSON.stringify(t.gs()), before);
});

test('room: a resent move is applied once; a stale screen is told the latest table; simultaneous moves resolve in order', () => {
  const t = lobby(2);
  t.start();
  const s = t.gs();
  const who = NAMES[s.currentSeat];
  const next = NAMES[1 - s.currentSeat];
  const legal = ClashEngine.playableIds(s, s.currentSeat);
  const cardId = legal.length ? legal[0] : null;
  if (cardId) {
    const c = s.secret.hands[s.currentSeat].find((x) => x.id === cardId) as ClashCard;
    const payload = { cardId, color: c.color ? undefined : 'red', moveId: 'dup-1' };
    t.act(who, 'game:clash_play', payload);
    const v = t.gs().version;
    t.act(who, 'game:clash_play', payload);
    assert.equal(t.gs().version, v, 'the resend did nothing');
    assert.equal(t.view(who).version, v);
  } else {
    t.act(who, 'game:clash_draw', { moveId: 'dup-1' });
    const v = t.gs().version;
    t.act(who, 'game:clash_draw', { moveId: 'dup-1' });
    assert.equal(t.gs().version, v);
  }
  // the other player acts with an old version in their hands
  t.act(next, 'game:clash_draw', { baseVersion: 1 });
  assert.equal(t.lastError().payload.code, 'STALE_STATE');
  assert.equal(t.msgs.filter((x) => x.to === next && x.payload?.resync).length, 1);
  // both try to act at once: only the player whose turn it is gets in
  const before = t.gs().version;
  t.act(who, 'game:clash_draw');
  assert.equal(t.lastError().payload.code, 'NOT_YOUR_TURN');
  assert.equal(t.gs().version, before);
});

test('room: the turn clock is the server\'s: when it runs out the player draws a card and the turn passes', () => {
  const t = lobby(3);
  t.start();
  const first = t.gs().currentSeat;
  t.at(29_000);
  assert.equal(t.gs().currentSeat, first, 'not yet');
  t.at(30_000);
  assert.equal(t.gs().currentSeat, (first + 1) % 3);
  assert.equal(t.gs().secret.hands[first].length, 8);
  assert.equal(t.view(NAMES[first]).lastEvent?.kind, 'timeout');
  t.at(60_000);
  assert.equal(t.gs().currentSeat, (first + 2) % 3);
});

test('room: a suspended app cannot pause the match: after a long silence the timer still moves the game on (and a server restart settles it)', () => {
  const t = lobby(2);
  t.start();
  t.m.stopClashTimer(t.id); // as if the process restarted
  t.setNow(T0 + 31_000);
  t.m.ensureClashTimer(t.id);
  assert.equal(t.gs().lastEvent?.kind, 'timeout');
});

test('room: a player who leaves a 3-player game: the others play on, their cards go back to the pile; in a 2-player game the other wins', () => {
  const t = lobby(3);
  t.start();
  const total = (s: ClashServerState) => Object.values(s.secret.hands).flat().length + s.secret.drawPile.length + s.secret.discardPile.length + 1;
  assert.equal(total(t.gs()), 108);
  t.act('c', 'game:leave');
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.gs().players.find((p) => p.userId === 'c')!.left, true);
  assert.equal(total(t.gs()), 108, 'no card was lost');
  assert.notEqual(t.gs().currentSeat, 2);
  oneMove(t);
  const two = lobby(2);
  two.start();
  two.act('b', 'game:leave');
  assert.equal(two.get().status, 'FINISHED');
  assert.equal(two.gs().status, 'forfeit');
  assert.equal(two.gs().winnerUserId, 'a');
});

test('room: a whole game runs to a winner through the real handlers, with every card accounted for', () => {
  for (const n of [2, 3, 4]) {
    const t = lobby(n);
    t.start();
    let guard = 0;
    while (t.get().status === 'PLAYING' && guard++ < 1500) {
      t.setNow(T0 + guard * 1000);
      oneMove(t);
      const s = t.gs();
      assert.equal(Object.values(s.secret.hands).flat().length + s.secret.drawPile.length + s.secret.discardPile.length + 1, 108);
    }
    assert.equal(t.get().status, 'FINISHED', `${n} players finished`);
    const done = t.gs();
    assert.equal(done.status, 'finished');
    assert.equal(done.secret.hands[done.winnerSeat as number].length, 0);
    assert.ok(typeof done.points === 'number');
    assert.equal(t.view('a').winnerUserId, done.winnerUserId);
    assert.equal(t.view('a').finishReason, 'emptied');
  }
});

test('room: only the host can cancel; a rematch starts a clean game with a new deck and new hands', async () => {
  const t = lobby(3);
  t.start();
  t.act('b', 'game:clash_cancel');
  assert.equal(t.lastError().payload.code, 'HOST_ONLY');
  const oldId = t.gs().gameId;
  const oldHands = hands(t).map((h) => h.ids.join());
  t.act('a', 'game:clash_cancel');
  assert.equal(t.gs().status, 'cancelled');
  assert.equal(t.get().status, 'FINISHED');
  for (const u of ['a', 'b', 'c']) t.act(u, 'game:rematch');
  await new Promise((r) => setTimeout(r, 800));
  assert.equal(t.get().status, 'PLAYING');
  assert.notEqual(t.gs().gameId, oldId);
  assert.notDeepEqual(hands(t).map((h) => h.ids.join()), oldHands);
  for (const h of hands(t)) assert.equal(h.ids.length, 7);
  assert.equal(t.gs().version, 1);
});

test('room: an action in another room\'s game does nothing here', () => {
  const t1 = lobby(2);
  const t2 = lobby(2);
  t1.start();
  t2.start();
  const v = t2.gs().version;
  t1.act(cur(t1), 'game:clash_draw');
  assert.equal(t2.gs().version, v);
});
