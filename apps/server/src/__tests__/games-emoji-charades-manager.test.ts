import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

// Manager level tests of Emoji Charades with fake sockets: wiring, per-recipient redaction, guesses, disconnect / abort, rematch.

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });

class FakeSocket {
  readyState = 1;
  sent: any[] = [];
  private handlers: Record<string, Array<(...a: any[]) => void>> = {};
  send(d: string) { this.sent.push(JSON.parse(d)); }
  on(ev: string, fn: (...a: any[]) => void) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev: string, ...a: any[]) { for (const h of this.handlers[ev] || []) h(...a); }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    setImmediate(() => this.emit('close'));
  }
  msg(type: string, payload?: any) { this.emit('message', JSON.stringify({ type, payload })); }
  of(type: string) { return this.sent.filter(m => m.type === type); }
  errors() { return this.of('game:error').map(m => m.payload.code); }
  /** the latest Emoji Charades view this socket received (any message type) */
  view(): any {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const p = this.sent[i].payload;
      if (p?.gameState?.game === 'emoji-charades') return p.gameState;
      if (p?.room?.gameState?.game === 'emoji-charades') return p.room.gameState;
    }
    return null;
  }
  text() { return JSON.stringify(this.sent); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

const IDS = ['a', 'b', 'c', 'd', 'e'];

/** True when `text` contains the answer. Short titles ("Up") are matched as whole JSON strings, so ordinary words do not cause false hits. */
function leaks(text: string, answer: string): boolean {
  const lower = text.toLowerCase();
  const a = answer.toLowerCase();
  return lower.includes(`"${a}"`) || (answer.replace(/\W/g, '').length >= 6 && lower.includes(a));
}

/** A WAITING Emoji Charades lobby with `n` connected players (a is the host). */
function lobby(n = 3) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'emoji-charades', maxPlayers: 8 });
  const ids = IDS.slice(0, n);
  for (const id of ids.slice(1)) m.joinRoom(r.roomCode, U(id));
  const socks: Record<string, FakeSocket> = {};
  for (const id of ids) { socks[id] = new FakeSocket(); m.registerClient(socks[id] as any, r.id, U(id)); }
  const get = () => db.getGameRoomById(r.id)!;
  const state = (): any => get().gameState;
  /** makes the current phase due and lets the server clock settle it */
  const fastForward = () => {
    const st = state();
    if (st.phaseEndsAt !== null) st.phaseEndsAt = 0;
    // keep the hint schedule consistent with the (virtual) clock: move everything into the past
    if (st.phase === 'PLAY') st.hintAt = [0, 0];
    db.updateGameRoomState(r.id, st, 0);
    m.tickEmojiCharades(r.id);
  };
  const watch = (id: string) => {
    const s = new FakeSocket();
    m.registerClient(s as any, r.id, U(id), { spectate: true, canSpectate: true });
    return s;
  };
  return { db, m, id: r.id as string, code: r.roomCode as string, ids, socks, get, state, fastForward, watch };
}

/** Started game, moved to the PLAY phase. */
function playing(n = 3, rounds = 3) {
  const t = lobby(n);
  t.socks.a.msg('emoji-charades:start', { rounds });
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  t.fastForward(); // countdown over
  assert.equal(t.state().phase, 'PLAY');
  return { ...t, answer: t.state().secret.answer as string, alternates: t.state().secret.alternates as string[] };
}

test('ECH manager: lobby has no game state; 2 connected players are needed and only the host starts; rounds are validated', () => {
  const t1 = lobby(1);
  assert.equal(t1.get().minPlayers, 2);
  assert.equal(t1.get().maxPlayers, 8);
  assert.equal(t1.get().gameState, null);
  assert.ok(!t1.socks.a.text().includes('"secret"'));
  t1.socks.a.msg('emoji-charades:start', { rounds: 3 });
  assert.deepEqual(t1.socks.a.errors(), ['INVALID_INPUT'], 'one player cannot start');
  const t = lobby(3);
  t.socks.b.msg('emoji-charades:start', { rounds: 3 });
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY']);
  t.socks.a.msg('emoji-charades:start', { rounds: 4 });
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT']);
  t.socks.a.msg('emoji-charades:start', { rounds: 3, mode: 'teams' });
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT', 'INVALID_INPUT']);
  assert.equal(t.get().status, 'WAITING');
  t.socks.a.msg('emoji-charades:start', { rounds: 5, mode: 'race' });
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.state().totalRounds, 5);
  assert.equal(t.state().phase, 'COUNTDOWN');
  t.socks.a.msg('emoji-charades:start', { rounds: 3 }); // a second start is refused, nothing changes
  assert.ok(t.socks.a.errors().includes('ILLEGAL_MOVE'));
  assert.equal(t.state().totalRounds, 5);
});

test('ECH manager: no auto start, room code prefix, and a full table is closed to a 9th player', () => {
  const t = lobby(2);
  assert.equal(t.get().status, 'WAITING', 'only the host starts a game');
  assert.match(t.code, /^EMOJI-/);
  for (const id of ['c', 'd', 'e', 'f', 'g', 'h']) t.m.joinRoom(t.code, U(id));
  assert.throws(() => t.m.joinRoom(t.code, U('i')), /full/i);
});

test('ECH manager: every recipient gets only their own view; nobody but a solver and the REVEAL result sees the answer', () => {
  const t = playing(4);
  const spec = t.watch('s1');
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.game, 'emoji-charades');
    assert.equal(v.phase, 'PLAY');
    assert.ok(Array.isArray(v.emoji) && v.emoji.length >= 3);
    assert.equal(v.me.solved, false);
    assert.equal(v.me.answer, null);
    const text = t.socks[id].text();
    assert.ok(!leaks(text, t.answer), `${id} received the answer`);
    for (const alt of t.alternates) assert.ok(!leaks(text, alt), `${id} received an alternate`);
    assert.ok(!text.includes('"secret"') && !text.includes('"alternates"'), `${id} got server-only fields`);
  }
  const sv = spec.view();
  assert.equal(sv.me, null);
  assert.ok(!leaks(spec.text(), t.answer));
  assert.ok(!spec.text().includes('"secret"'));
  // the room row is projected for REST / sync consumers too
  const projected: any = t.m.projectRoomFor(t.get(), 'b');
  assert.equal(projected.gameState.me.answer, null);
  assert.ok(!leaks(JSON.stringify(projected), t.answer));
  const other: any = t.m.projectRoomFor(t.get(), 'nobody');
  assert.equal(other.gameState.me, null);
  assert.ok(!leaks(JSON.stringify(other), t.answer));
});

test('ECH manager: a correct guess locks the player in and only that player gets the answer; wrong guesses stay private', () => {
  const t = playing(4);
  const spec = t.watch('s1');
  t.socks.b.msg('emoji-charades:guess', { guess: 'definitely not it' });
  assert.equal(t.socks.b.view().me.wrongGuesses, 1);
  assert.equal(t.socks.c.view().me.wrongGuesses, 0);
  for (const id of ['a', 'c', 'd']) assert.ok(!t.socks[id].text().includes('definitely not it'), `${id} saw a private guess`);
  assert.ok(!spec.text().includes('definitely not it'));
  t.socks.c.msg('emoji-charades:guess', { guess: t.answer.toLowerCase() });
  assert.equal(t.state().phase, 'PLAY');
  assert.deepEqual(t.state().solves.map((x: any) => x.userId), ['c']);
  const cv = t.socks.c.view();
  assert.equal(cv.me.solved, true);
  assert.equal(cv.me.answer, t.answer);
  assert.ok(cv.me.points >= 130, 'first solver bonus applied');
  for (const id of ['a', 'b', 'd']) {
    const v = t.socks[id].view();
    assert.deepEqual(v.solvedUserIds, ['c']);
    assert.equal(v.me.answer, null);
    assert.ok(!leaks(JSON.stringify(t.socks[id].sent.slice(-1)), t.answer), `${id} received the answer after c solved`);
  }
  assert.ok(!leaks(spec.text(), t.answer), 'the spectator received the answer');
});

test('ECH manager: guesses out of phase, repeated, malformed or from a spectator change nothing; floods are rate limited', () => {
  const t = lobby(3);
  t.socks.b.msg('emoji-charades:guess', { guess: 'anything' });
  assert.ok(t.socks.b.errors().includes('NOT_PLAYING'), 'no game yet');
  t.socks.a.msg('emoji-charades:start', { rounds: 3 });
  t.socks.c.msg('emoji-charades:guess', { guess: 'countdown guess' });
  assert.ok(t.socks.c.errors().includes('WRONG_PHASE'), 'countdown');
  t.fastForward();
  const spec = t.watch('s1');
  spec.msg('emoji-charades:guess', { guess: 'x' });
  spec.msg('emoji-charades:start', { rounds: 3 });
  assert.deepEqual(spec.errors(), ['SPECTATOR', 'SPECTATOR']);
  const before = JSON.stringify(t.state().guesses) + JSON.stringify(t.state().solves);
  assert.equal(before, '{}[]');
  for (const junk of [null, 'x', 5, [], { guess: { a: 1 } }, { guess: 'x'.repeat(61) }, { guess: '' }]) t.socks.b.msg('emoji-charades:guess', junk as any);
  assert.ok(t.socks.b.errors().includes('INVALID_INPUT'));
  assert.ok(t.socks.b.errors().includes('RATE_LIMITED'), 'the flood hit the limiter (4 per 3 s)');
  assert.equal(JSON.stringify(t.state().guesses) + JSON.stringify(t.state().solves), before);
  // duplicates are refused without cost
  t.socks.a.msg('emoji-charades:guess', { guess: 'Same Guess' });
  t.socks.a.msg('emoji-charades:guess', { guess: 'same guess!' });
  assert.ok(t.socks.a.errors().includes('DUPLICATE_GUESS'));
  assert.equal(t.state().guesses.a.length, 1);
  // after the deadline a guess is late
  t.fastForward();
  assert.equal(t.state().phase, 'REVEAL');
  t.socks.c.msg('emoji-charades:guess', { guess: t.state().secret.answer });
  assert.ok(t.socks.c.errors().filter((c) => c === 'WRONG_PHASE').length >= 2);
  assert.deepEqual(t.state().solves, []);
  assert.equal(t.state().scores.c, 0);
});

test('ECH manager: the server clock runs the whole game on its own; the result reveals the answer to everybody at REVEAL', () => {
  const t = playing(3, 3);
  const spec = t.watch('s1');
  const answer = t.answer;
  t.fastForward(); // PLAY over, nobody solved
  assert.equal(t.state().phase, 'REVEAL');
  for (const id of t.ids) assert.equal(t.socks[id].view().result.answer, answer);
  assert.equal(spec.view().result.answer, answer);
  let guard = 0;
  while (t.get().status === 'PLAYING' && guard++ < 60) t.fastForward();
  assert.equal(t.state().phase, 'FINAL');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.state().history.length, 3);
  assert.equal(new Set(t.state().history.map((h: any) => h.answer)).size, 3, 'no puzzle twice in a game');
  for (const id of t.ids) assert.equal(t.socks[id].view().phase, 'FINAL');
});

test('ECH manager: everybody connected solving ends the round at once; hints are delivered as the clock runs', () => {
  const t = playing(2);
  // hint schedule: the view carries the next hint time and (after it passes) the masked answer, never the answer
  assert.equal(typeof t.socks.a.view().nextHintAt, 'number');
  const st = t.state();
  st.hintAt = [0, st.hintAt[1]];
  t.db.updateGameRoomState(t.id, st, 0);
  t.m.tickEmojiCharades(t.id);
  const hv = t.socks.a.view();
  assert.equal(hv.hintTier, 1);
  assert.match(hv.hint, /^[_ ]+$/);
  assert.ok(!leaks(JSON.stringify(hv), t.answer));
  t.socks.a.msg('emoji-charades:guess', { guess: t.answer });
  assert.equal(t.state().phase, 'PLAY');
  t.socks.b.msg('emoji-charades:guess', { guess: t.answer });
  assert.equal(t.state().phase, 'REVEAL', 'everybody solved it');
  assert.equal(t.state().scores.a > 0 && t.state().scores.b > 0, true);
  assert.equal(t.state().solves[0].hintTier, 1, 'the hint tier visible at solve time reduced the base');
});

test('ECH manager: a solved player cannot give the answer away in the chat while the puzzle is live', () => {
  const t = playing(3);
  t.socks.a.msg('game:chat', { content: 'hello before solving' });
  assert.equal(t.socks.a.errors().length, 0);
  assert.equal(t.socks.b.of('game:chat_message').length, 1);
  t.socks.a.msg('emoji-charades:guess', { guess: t.answer });
  assert.equal(t.state().solves.length, 1);
  t.socks.a.msg('game:chat', { content: `it is ${t.answer}` });
  assert.deepEqual(t.socks.a.errors(), ['CHAT_LOCKED']);
  assert.equal(t.socks.b.of('game:chat_message').length, 1, 'the leak never reached the others');
  assert.ok(!leaks(t.socks.b.text(), t.answer));
  // an unsolved player can still chat; after the reveal everybody can
  t.socks.b.msg('game:chat', { content: 'any ideas?' });
  assert.equal(t.socks.b.errors().length, 0);
  t.fastForward();
  assert.equal(t.state().phase, 'REVEAL');
  t.socks.a.msg('game:chat', { content: 'it was easy' });
  assert.deepEqual(t.socks.a.errors(), ['CHAT_LOCKED']);
});

test('ECH manager: a disconnected player is not waited for, keeps the seat, can return and then solve', async () => {
  const t = playing(3);
  t.socks.c.close();
  await new Promise(r => setImmediate(r));
  assert.equal(t.state().players.find((p: any) => p.userId === 'c').connected, false);
  t.socks.a.msg('emoji-charades:guess', { guess: t.answer });
  t.socks.b.msg('emoji-charades:guess', { guess: t.answer });
  assert.equal(t.state().phase, 'REVEAL', 'the disconnected player was not waited for');
  assert.equal(t.state().scores.c, 0);
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U('c'));
  assert.equal(t.state().players.find((p: any) => p.userId === 'c').connected, true);
  assert.equal(back.of('game:sync')[0].payload.room.gameState.game, 'emoji-charades');
  assert.equal(back.of('game:sync')[0].payload.room.gameState.phase, 'REVEAL');
  assert.equal(t.get().players.find((p) => p.userId === 'c')?.status !== 'LEFT', true);
});

test('ECH manager: a reconnecting player in a running round gets their own view without the answer', async () => {
  const t = playing(3);
  t.socks.b.close();
  await new Promise(r => setImmediate(r));
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U('b'));
  const v = back.of('game:sync')[0].payload.room.gameState;
  assert.equal(v.phase, 'PLAY');
  assert.equal(v.me.answer, null);
  assert.ok(!leaks(back.text(), t.answer));
  assert.ok(!back.text().includes('"secret"'));
});

test('ECH manager: fewer than 2 players left aborts cleanly, the room is finished, no answer is revealed', () => {
  const t = playing(3);
  t.socks.c.msg('game:leave');
  assert.equal(t.state().phase, 'PLAY', '2 players keep playing');
  assert.equal(t.get().status, 'PLAYING');
  t.socks.b.msg('game:leave');
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
  const v = t.socks.a.view();
  assert.equal(v.phase, 'ABORTED');
  assert.match(v.statusMessage, /few|enough/i);
  assert.equal(v.result, null);
  assert.ok(!leaks(t.socks.a.text(), t.answer));
  assert.ok(!t.socks.a.text().includes('"secret"'));
  t.socks.a.msg('emoji-charades:guess', { guess: t.answer });
  assert.ok(t.socks.a.errors().length > 0, 'late actions are refused');
});

test('ECH manager: after the last round the game finishes and everybody can rematch (new puzzles, fresh scores); 2 players are enough', async () => {
  const t = playing(2, 3);
  t.socks.a.msg('emoji-charades:guess', { guess: t.answer });
  let guard = 0;
  while (t.get().status === 'PLAYING' && guard++ < 60) t.fastForward();
  assert.equal(t.state().phase, 'FINAL');
  assert.deepEqual(t.state().winnerUserIds, ['a']);
  const usedBefore: string[] = t.state().secret.usedPuzzleIds;
  assert.equal(usedBefore.length, 3);
  for (const id of t.ids) t.socks[id].msg('game:rematch');
  await new Promise(r => setTimeout(r, 900));
  assert.equal(t.get().status, 'PLAYING');
  const st = t.state();
  assert.equal(st.phase, 'COUNTDOWN');
  assert.equal(st.round, 1);
  assert.deepEqual(Object.values(st.scores), [0, 0]);
  assert.equal(st.history.length, 0);
  assert.ok(!usedBefore.includes(st.secret.puzzleId), 'the rematch does not reuse the previous puzzles');
});

test('ECH manager: a rematch after one of 3 players left is still possible with 2; with 1 left it is refused', async () => {
  const t = playing(3, 3);
  t.socks.c.msg('game:leave');
  let guard = 0;
  while (t.get().status === 'PLAYING' && guard++ < 60) t.fastForward();
  assert.equal(t.get().status, 'FINISHED');
  for (const id of ['a', 'b']) t.socks[id].msg('game:rematch');
  await new Promise(r => setTimeout(r, 900));
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.state().players.length, 2);
  assert.ok(t.state().players.every((p: any) => p.userId !== 'c'));
});

test('ECH manager: a rematch with only one player still seated is refused', () => {
  const t = playing(2, 3);
  t.socks.b.msg('game:leave'); // 1 left: aborted
  assert.equal(t.get().status, 'FINISHED');
  t.socks.a.msg('game:rematch');
  assert.ok(t.socks.a.errors().includes('REMATCH_UNAVAILABLE'));
});
