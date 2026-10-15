import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

// Manager level tests of Imposter with fake sockets: wiring, per-recipient redaction, disconnect / abort, rematch.

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
  /** the latest Imposter view this socket received (any message type) */
  view(): any {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const p = this.sent[i].payload;
      if (p?.gameState?.game === 'imposter') return p.gameState;
      if (p?.room?.gameState?.game === 'imposter') return p.room.gameState;
    }
    return null;
  }
  text() { return JSON.stringify(this.sent); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

const IDS = ['a', 'b', 'c', 'd', 'e'];

/** A WAITING Imposter lobby with `n` connected players (a is the host). */
function lobby(n = 5) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'imposter', maxPlayers: 8 });
  const ids = IDS.slice(0, n);
  for (const id of ids.slice(1)) m.joinRoom(r.roomCode, U(id));
  const socks: Record<string, FakeSocket> = {};
  for (const id of ids) { socks[id] = new FakeSocket(); m.registerClient(socks[id] as any, r.id, U(id)); }
  const get = () => db.getGameRoomById(r.id)!;
  const state = (): any => get().gameState;
  /** makes the current phase / turn due and lets the server clock settle it */
  const fastForward = () => {
    const st = state();
    if (st.phaseEndsAt !== null) st.phaseEndsAt = 0;
    db.updateGameRoomState(r.id, st, 0);
    m.tickImposter(r.id);
  };
  const watch = (id: string) => {
    const s = new FakeSocket();
    m.registerClient(s as any, r.id, U(id), { spectate: true, canSpectate: true });
    return s;
  };
  return { db, m, id: r.id as string, code: r.roomCode as string, ids, socks, get, state, fastForward, watch };
}

function started(n = 5, rounds = 3) {
  const t = lobby(n);
  t.socks.a.msg('imposter:start', { rounds });
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  const st = t.state();
  return { ...t, imposter: st.secret.imposterId as string, word: st.secret.word as string };
}

test('IMP manager: lobby has no game state; a room needs 4 connected players and only the host starts it', () => {
  const t = lobby(3);
  assert.equal(t.get().minPlayers, 4);
  assert.equal(t.get().maxPlayers, 8);
  assert.equal(t.get().gameState, null);
  assert.ok(!t.socks.a.text().includes('"secret"'));
  t.socks.a.msg('imposter:start', { rounds: 3 });
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT']);
  const t5 = lobby(5);
  t5.socks.b.msg('imposter:start', { rounds: 3 });
  assert.deepEqual(t5.socks.b.errors(), ['HOST_ONLY']);
  t5.socks.a.msg('imposter:start', { rounds: 4 });
  assert.deepEqual(t5.socks.a.errors(), ['INVALID_INPUT']);
  assert.equal(t5.get().status, 'WAITING');
  t5.socks.a.msg('imposter:start', { rounds: 5 });
  assert.equal(t5.get().status, 'PLAYING');
  assert.equal(t5.state().totalRounds, 5);
  t5.socks.a.msg('imposter:start', { rounds: 3 }); // second start is refused, nothing changes
  assert.ok(t5.socks.a.errors().includes('ILLEGAL_MOVE'));
  assert.equal(t5.state().totalRounds, 5);
});

test('IMP manager: no auto start, and a full table is closed to a 9th player', () => {
  const t = lobby(5);
  assert.equal(t.get().status, 'WAITING', 'only the host starts a game');
  for (const id of ['f', 'g', 'h']) t.m.joinRoom(t.code, U(id));
  assert.throws(() => t.m.joinRoom(t.code, U('i')), /full/i);
});

test('IMP manager: every recipient gets only their own view (imposter never the word, spectators nothing private)', () => {
  const t = started(5);
  const spec = t.watch('s1');
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.game, 'imposter');
    assert.equal(v.phase, 'REVEAL');
    if (id === t.imposter) assert.deepEqual(v.me, { role: 'imposter', word: null });
    else assert.deepEqual(v.me, { role: 'crew', word: t.word });
    const text = t.socks[id].text();
    assert.ok(!text.includes('"secret"') && !text.includes('"imposterId"'), `${id} got server-only fields`);
    if (id === t.imposter) assert.ok(!text.toLowerCase().includes(t.word.toLowerCase()), 'the imposter received the word');
  }
  const sv = spec.view();
  assert.equal(sv.me, null);
  assert.ok(!spec.text().toLowerCase().includes(t.word.toLowerCase()));
  assert.ok(!spec.text().includes('"secret"') && !spec.text().includes('"imposterId"'));
  // the room row itself is projected for REST / sync consumers too
  const projected: any = t.m.projectRoomFor(t.get(), t.imposter);
  assert.equal(projected.gameState.me.word, null);
  const other: any = t.m.projectRoomFor(t.get(), 'nobody');
  assert.equal(other.gameState.me, null);
  assert.ok(!JSON.stringify(other).toLowerCase().includes(t.word.toLowerCase()));
});

test('IMP manager: a spectator is read-only', () => {
  const t = started(5);
  const spec = t.watch('s1');
  for (const type of ['imposter:clue', 'imposter:vote', 'imposter:ready', 'imposter:guess', 'imposter:start']) spec.msg(type, { word: 'x', targetUserId: 'a', guess: 'x', rounds: 3 });
  assert.equal(spec.errors().length, 5);
  assert.ok(spec.errors().every(c => c === 'SPECTATOR'));
  assert.equal(t.state().clues.length, 0);
});

test('IMP manager: turns, clue rules and the server clock (a stalled player cannot stall the game)', () => {
  const t = started(5);
  t.fastForward(); // REVEAL over
  assert.equal(t.state().phase, 'CLUES');
  const first = t.state().currentTurnUserId;
  const other = t.ids.find(id => id !== first)!;
  t.socks[other].msg('imposter:clue', { word: 'nope' });
  assert.deepEqual(t.socks[other].errors(), ['NOT_YOUR_TURN']);
  t.socks[first].msg('imposter:clue', { word: 'two words' });
  assert.deepEqual(t.socks[first].errors(), ['INVALID_INPUT']);
  if (first !== t.imposter) {
    t.socks[first].msg('imposter:clue', { word: t.word });
    assert.equal(t.socks[first].errors().length, 2, 'the secret word is refused for the crew');
  }
  t.socks[first].msg('imposter:clue', { word: 'hint' });
  assert.equal(t.state().clues.length, 1);
  assert.notEqual(t.state().currentTurnUserId, first);
  // nobody answers any more: the server clock skips every remaining turn, the discussion and the vote
  for (let i = 0; i < 30 && t.state().phase !== 'RESULT'; i++) t.fastForward();
  assert.equal(t.state().phase, 'RESULT');
  assert.equal(t.state().lastResult.winner, 'imposter');
  // everybody got the secrets with the result, nobody before
  for (const id of t.ids) assert.equal(t.socks[id].view().result.word, t.word);
});

test('IMP manager: malformed payloads are refused and rate limited, nothing changes', () => {
  const t = started(5);
  t.fastForward();
  const first = t.state().currentTurnUserId;
  const before = JSON.stringify(t.state());
  for (const junk of [null, 'x', 5, [], { word: { a: 1 } }, { word: 'x'.repeat(30) }]) t.socks[first].msg('imposter:clue', junk as any);
  assert.ok(t.socks[first].errors().includes('INVALID_INPUT'));
  assert.ok(t.socks[first].errors().includes('RATE_LIMITED'), 'the flood hit the limiter');
  assert.equal(JSON.stringify(t.state()), before);
  t.socks[first].msg('imposter:vote', { targetUserId: t.ids.find(i => i !== first) });
  assert.ok(t.socks[first].errors().includes('WRONG_PHASE') || t.socks[first].errors().includes('RATE_LIMITED'));
});

test('IMP manager: a disconnected player is skipped, keeps the seat and can return', async () => {
  const t = started(5);
  t.fastForward();
  const away = t.state().currentTurnUserId;
  t.socks[away].close();
  await new Promise(r => setImmediate(r));
  assert.equal(t.state().players.find((p: any) => p.userId === away).connected, false);
  assert.notEqual(t.state().currentTurnUserId, away, 'their turn was skipped at once');
  assert.deepEqual(t.state().clues[0], { round: 1, userId: away, word: null });
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U(away));
  assert.equal(t.state().players.find((p: any) => p.userId === away).connected, true);
  assert.equal(back.of('game:sync')[0].payload.room.gameState.game, 'imposter');
  assert.equal(t.get().players.find((p) => p.userId === away)?.status !== 'LEFT', true);
});

test('IMP manager: fewer than 3 players left aborts cleanly, the room is finished, no secrets are revealed', () => {
  const t = started(4);
  const leavers = t.ids.filter(id => id !== t.imposter).slice(0, 2);
  t.socks[leavers[0]].msg('game:leave');
  assert.equal(t.state().phase, 'REVEAL', '3 players keep playing');
  assert.equal(t.get().status, 'PLAYING');
  t.socks[leavers[1]].msg('game:leave');
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
  const remaining = t.ids.filter(id => !leavers.includes(id));
  for (const id of remaining) {
    const v = t.socks[id].view();
    assert.equal(v.phase, 'ABORTED');
    assert.match(v.statusMessage, /few|enough/i);
    assert.equal(v.result, null);
    assert.ok(!t.socks[id].text().includes('"imposterId"'));
  }
  // the timer is gone and late actions are refused
  t.socks[remaining[0]].msg('imposter:clue', { word: 'late' });
  assert.ok(t.socks[remaining[0]].errors().length > 0);
});

test('IMP manager: the imposter leaving voids the round; everyone is told who it was only through the result', () => {
  const t = started(5);
  t.socks[t.imposter].msg('game:leave');
  assert.equal(t.state().phase, 'RESULT');
  assert.equal(t.state().lastResult.voided, true);
  assert.equal(t.get().status, 'PLAYING');
  for (const id of t.ids.filter(i => i !== t.imposter)) assert.equal(t.socks[id].view().result.imposterId, t.imposter);
});

test('IMP manager: after the last round the game finishes and everybody can rematch (new roles, fresh scores)', () => {
  const t = started(4, 3);
  let guard = 0;
  while (t.get().status === 'PLAYING' && guard++ < 400) t.fastForward();
  assert.equal(t.state().phase, 'FINISHED');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.state().history.length, 3);
  for (const id of t.ids) assert.equal(t.socks[id].view().phase, 'FINISHED');
  const usedBefore: string[] = t.state().secret.usedWords;
  assert.equal(usedBefore.length, 3);

  for (const id of t.ids) t.socks[id].msg('game:rematch');
  // the manager restarts after a short delay
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      try {
        assert.equal(t.get().status, 'PLAYING');
        const st = t.state();
        assert.equal(st.phase, 'REVEAL');
        assert.equal(st.round, 1);
        assert.deepEqual(Object.values(st.scores), [0, 0, 0, 0]);
        assert.equal(st.history.length, 0);
        assert.ok(!usedBefore.includes(st.secret.word), 'the rematch does not reuse the previous words');
        for (const id of t.ids) assert.equal(t.socks[id].view().phase, 'REVEAL');
        resolve();
      } catch (e) { reject(e); }
    }, 900);
  });
});

test('IMP manager: a rematch of a game one player left from is still possible with 4 or more players', async () => {
  const t = started(5, 3);
  t.socks.e.msg('game:leave'); // 4 still seated, game continues
  let guard = 0;
  while (t.get().status === 'PLAYING' && guard++ < 400) t.fastForward();
  assert.equal(t.get().status, 'FINISHED');
  for (const id of ['a', 'b', 'c', 'd']) t.socks[id].msg('game:rematch');
  await new Promise(r => setTimeout(r, 900));
  assert.equal(t.get().status, 'PLAYING');
  assert.equal(t.state().players.length, 4);
  assert.ok(t.state().players.every((p: any) => p.userId !== 'e'));
});
