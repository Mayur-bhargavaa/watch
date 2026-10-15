import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

// Manager level tests of Quiz Show Studio with fake sockets: wiring, quiz building, per-recipient redaction, quiet answers,
// buzzer + chat lock, disconnect / leave / abort, rematch, spectators.

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const NOTE = 'SECRET-NOTE-XYZ';

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
  view(): any {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const p = this.sent[i].payload;
      if (p?.gameState?.game === 'quiz-show') return p.gameState;
      if (p?.room?.gameState?.game === 'quiz-show') return p.room.gameState;
    }
    return null;
  }
  chats() { return this.of('game:chat_message').map(m => m.payload); }
  text() { return JSON.stringify(this.sent); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

const IDS = ['a', 'b', 'c', 'd', 'e'];
const mcInput = (over: any = {}) => ({ type: 'MULTIPLE_CHOICE', text: 'Capital of France?', options: ['Berlin', 'Paris', 'Rome', 'Madrid'], correctIndex: 1, timeLimitSec: 20, points: 100, note: NOTE, ...over });
const buzzInput = (over: any = {}) => ({ type: 'BUZZER', text: 'Who directed Jaws?', points: 200, note: NOTE, ...over });

/** Host `a` + (n - 1) players, everybody connected, nothing started. */
function lobby(n = 3) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'quiz-show', maxPlayers: 31 });
  const ids = IDS.slice(0, n);
  for (const id of ids.slice(1)) m.joinRoom(r.roomCode, U(id));
  const socks: Record<string, FakeSocket> = {};
  for (const id of ids) { socks[id] = new FakeSocket(); m.registerClient(socks[id] as any, r.id, U(id)); }
  const get = () => db.getGameRoomById(r.id)!;
  const state = (): any => get().gameState;
  const ff = () => {
    const st = state();
    if (st.phaseEndsAt !== null) st.phaseEndsAt = 0;
    if (st.buzz?.answerEndsAt) st.buzz.answerEndsAt = 0;
    db.updateGameRoomState(r.id, st, 0);
    m.tickQuiz(r.id);
  };
  const watch = (id: string) => {
    const s = new FakeSocket();
    m.registerClient(s as any, r.id, U(id), { spectate: true, canSpectate: true });
    return s;
  };
  return { db, m, id: r.id as string, code: r.roomCode as string, ids, socks, get, state, ff, watch };
}

/** A started game: one multiple choice question (+ optionally a buzzer one). */
function started(n = 3, quiz: any[] = [mcInput(), buzzInput()]) {
  const t = lobby(n);
  for (const q of quiz) t.socks.a.msg('quiz-show:edit', { op: 'add', question: q });
  t.socks.a.msg('quiz-show:start');
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  return t;
}
const toQuestion = (t: ReturnType<typeof started>) => { t.ff(); assert.equal(t.state().phase, 'QUESTION'); return t.state().quiz[t.state().questionIndex].id as string; };

test('QUIZ manager: a room is a lobby with an empty draft; min 2 people, 31 seats, QUIZ- code; the host starts, not a player', () => {
  const t = lobby(3);
  assert.equal(t.get().minPlayers, 2);
  assert.equal(t.get().maxPlayers, 31);
  assert.equal(t.get().status, 'WAITING');
  assert.ok(/^QUIZ-/.test(t.code));
  assert.equal(t.state().game, 'quiz-show');
  assert.equal(t.state().phase, 'LOBBY');
  assert.equal(t.get().hostUserId, 'a');
  t.socks.b.msg('quiz-show:start');
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY']);
  t.socks.a.msg('quiz-show:start');
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT'], 'a quiz needs a question first');
  assert.equal(t.get().status, 'WAITING');
});

test('QUIZ manager: the host needs at least 1 connected player (host + 1 = 2 people is enough)', () => {
  const t = lobby(1);
  t.socks.a.msg('quiz-show:edit', { op: 'add', question: mcInput() });
  t.socks.a.msg('quiz-show:start');
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT']);
  const t2 = lobby(2);
  t2.socks.a.msg('quiz-show:edit', { op: 'add', question: mcInput() });
  t2.socks.a.msg('quiz-show:start');
  assert.equal(t2.get().status, 'PLAYING');
  assert.equal(t2.state().players.length, 1);
  t2.socks.a.msg('quiz-show:start');
  assert.ok(t2.socks.a.errors().includes('ILLEGAL_MOVE'));
});

test('QUIZ manager: only the host edits the quiz; players never receive the draft answers; edits are rate limited', () => {
  const t = lobby(3);
  t.socks.b.msg('quiz-show:edit', { op: 'add', question: mcInput() });
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY']);
  assert.equal(t.state().quiz.length, 0);
  t.socks.a.msg('quiz-show:edit', { op: 'add', question: mcInput() });
  assert.equal(t.state().quiz.length, 1);
  assert.equal(t.socks.a.view().draft[0].correctIndex, 1, 'the host sees the draft with its answers');
  assert.equal(t.socks.a.view().draft[0].note, NOTE);
  for (const id of ['b', 'c']) {
    assert.equal(t.socks[id].view().questionCount, 1, `${id} sees the count`);
    assert.equal(t.socks[id].view().draft, null);
    assert.ok(!t.socks[id].text().includes(NOTE), `${id} saw the note`);
    assert.ok(!t.socks[id].text().includes('correctIndex'), `${id} saw correctIndex`);
  }
  t.socks.a.msg('quiz-show:edit', { op: 'add', question: { type: 'MULTIPLE_CHOICE', text: 'x'.repeat(201), options: ['a', 'b'], correctIndex: 0 } });
  assert.ok(t.socks.a.errors().includes('INVALID_INPUT'));
  t.socks.a.msg('quiz-show:edit', { op: 'starter' });
  assert.equal(t.state().quiz.length, 12);
  for (let i = 0; i < 12; i++) t.socks.a.msg('quiz-show:edit', { op: 'clear' });
  assert.ok(t.socks.a.errors().includes('RATE_LIMITED'), 'edits are limited to 10 per 5 s');
});

test('QUIZ manager: a player or the REST projection of the lobby never shows the draft answers', () => {
  const t = lobby(3);
  t.socks.a.msg('quiz-show:edit', { op: 'add', question: mcInput() });
  const asPlayer: any = t.m.projectRoomFor(t.get(), 'b');
  assert.equal(asPlayer.gameState.draft, null);
  assert.ok(!JSON.stringify(asPlayer).includes(NOTE));
  const asHost: any = t.m.projectRoomFor(t.get(), 'a');
  assert.equal(asHost.gameState.draft.length, 1);
  const stranger: any = t.m.projectRoomFor(t.get(), 'zed');
  assert.ok(!JSON.stringify(stranger).includes(NOTE));
  const sync = t.socks.b.of('game:sync')[0].payload.room.gameState;
  assert.equal(sync.draft, null);
});

test('QUIZ manager: start gives everyone their own view; the host sees the answer, players and spectators do not', () => {
  const t = started(3, [mcInput({ correctIndex: 2 })]);
  const spec = t.watch('s1');
  assert.equal(t.get().startedAt !== undefined, true);
  for (const id of ['b', 'c']) {
    const v = t.socks[id].view();
    assert.equal(v.phase, 'INTRO');
    assert.equal(v.me.role, 'player');
    assert.equal(v.hostQuestion, null);
    assert.ok(!t.socks[id].text().includes(NOTE));
    assert.ok(!t.socks[id].text().includes('correctIndex'), `${id} saw correctIndex`);
  }
  const h = t.socks.a.view();
  assert.equal(h.me.role, 'host');
  assert.equal(h.hostQuestion.correctIndex, 2);
  assert.equal(h.hostQuestion.note, NOTE);
  assert.equal(spec.view().me, null);
  assert.ok(!spec.text().includes(NOTE) && !spec.text().includes('correctIndex'));
  assert.equal(spec.view().hostQuestion, null);
});

test('QUIZ manager: answers are quiet (host + sender only), once only, reveal when everybody answered, scores appear at the reveal', () => {
  const t = started(3, [mcInput()]);
  const q = toQuestion(t);
  const cBefore = t.socks.c.sent.length;
  t.socks.b.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  assert.equal(t.socks.b.view().me.myOption, 1);
  assert.deepEqual(t.socks.a.view().answerCounts, [0, 1, 0, 0]);
  assert.equal(t.socks.c.sent.length, cBefore, 'another player is not told that somebody answered');
  assert.ok(!t.socks.c.text().includes('"myOption":1'));
  t.socks.b.msg('quiz-show:answer', { questionId: q, optionIndex: 3 }); // ignored
  assert.equal(t.state().answers.b.optionIndex, 1);
  assert.equal(t.state().players[0].score, 0, 'no score before the reveal');
  t.socks.c.msg('quiz-show:answer', { questionId: q, optionIndex: 0 });
  assert.equal(t.state().phase, 'REVEAL');
  for (const id of ['b', 'c']) {
    const v = t.socks[id].view();
    assert.equal(v.phase, 'REVEAL');
    assert.equal(v.reveal.correctIndex, 1);
    assert.equal(v.reveal.note, NOTE);
    assert.equal(v.me.score, id === 'b' ? v.me.score : 0);
  }
  assert.ok(t.socks.b.view().me.score > 0);
  // a late answer for the question that is already revealed changes nothing
  t.socks.c.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  assert.ok(t.socks.c.errors().includes('WRONG_PHASE'));
  assert.equal(t.state().players.find((p: any) => p.userId === 'c').score, 0);
});

test('QUIZ manager: players cannot send host actions; the host cannot answer; rate limits apply', () => {
  const t = started(3, [mcInput(), mcInput()]);
  const q = toQuestion(t);
  for (const [type, payload] of [['quiz-show:control', { action: 'end' }], ['quiz-show:control', { action: 'reveal' }], ['quiz-show:judge', { questionId: q, correct: true }], ['quiz-show:rematch', {}], ['quiz-show:edit_again', {}], ['quiz-show:edit', { op: 'clear' }]] as const) {
    t.socks.b.msg(type, payload);
  }
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY', 'HOST_ONLY']);
  assert.equal(t.state().phase, 'QUESTION');
  assert.equal(t.state().quiz.length, 2);
  t.socks.a.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  assert.ok(t.socks.a.errors().includes('NOT_PLAYER'));
  for (let i = 0; i < 6; i++) t.socks.c.msg('quiz-show:answer', { questionId: q, optionIndex: 9 });
  assert.ok(t.socks.c.errors().includes('RATE_LIMITED'), 'answers are limited to 4 per 3 s');
  t.socks.c.msg('quiz-show:control', { action: 'bogus' });
  assert.ok(t.socks.c.errors().includes('HOST_ONLY'));
  t.socks.a.msg('quiz-show:control', { action: 'bogus' });
  assert.ok(t.socks.a.errors().includes('INVALID_INPUT'));
});

test('QUIZ manager: host controls reveal / next / skip / end and the quiz ends in FINAL with the room FINISHED', () => {
  const t = started(3, [mcInput(), mcInput()]);
  toQuestion(t);
  t.socks.a.msg('quiz-show:control', { action: 'reveal' });
  assert.equal(t.state().phase, 'REVEAL');
  t.socks.a.msg('quiz-show:control', { action: 'next' });
  assert.equal(t.state().phase, 'INTRO');
  assert.equal(t.state().questionIndex, 1);
  t.socks.a.msg('quiz-show:control', { action: 'end' });
  assert.equal(t.state().phase, 'FINAL');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.socks.b.view().phase, 'FINAL');
  assert.equal(t.socks.b.view().question, null);
});

test('QUIZ manager: buzzer flow over sockets, the host judges, chat is locked only for the answering player', () => {
  const t = started(3, [buzzInput({ points: 100 })]);
  const q = toQuestion(t);
  t.socks.c.msg('quiz-show:buzz', { questionId: q });
  t.socks.b.msg('quiz-show:buzz', { questionId: q });
  assert.deepEqual(t.state().buzz.queue, ['c', 'b']);
  assert.deepEqual(t.socks.b.view().buzz.queue, ['c', 'b']);
  t.socks.c.msg('quiz-show:buzz_answer', { questionId: q, text: 'TYPED-GUESS' });
  assert.equal(t.socks.a.view().buzz.activeText, 'TYPED-GUESS');
  assert.equal(t.socks.c.view().buzz.activeText, 'TYPED-GUESS');
  assert.ok(!t.socks.b.text().includes('TYPED-GUESS'));
  assert.ok(!t.socks.b.text().includes(NOTE));
  t.socks.c.msg('game:chat', { content: 'psst the answer is' });
  assert.ok(t.socks.c.errors().includes('CHAT_LOCKED'));
  t.socks.b.msg('game:chat', { content: 'good luck' });
  assert.equal(t.socks.b.errors().includes('CHAT_LOCKED'), false);
  assert.equal(t.socks.a.chats().some(m => m.content === 'good luck'), true);
  assert.equal(t.socks.a.chats().some(m => m.content.includes('psst')), false);
  t.socks.b.msg('quiz-show:judge', { questionId: q, correct: true });
  assert.ok(t.socks.b.errors().includes('HOST_ONLY'));
  t.socks.a.msg('quiz-show:judge', { questionId: q, correct: false });
  assert.deepEqual(t.state().buzz.lockedOut, ['c']);
  assert.equal(t.state().buzz.activeUserId, 'b');
  t.socks.c.msg('game:chat', { content: 'sorry' });
  assert.equal(t.socks.a.chats().some(m => m.content === 'sorry'), true, 'chat opens again once the window closed');
  t.socks.a.msg('quiz-show:judge', { questionId: q, correct: true });
  assert.equal(t.state().phase, 'REVEAL');
  assert.equal(t.socks.b.view().reveal.answerText, NOTE);
  assert.equal(t.state().players.find((p: any) => p.userId === 'b').score, 100);
});

test('QUIZ manager: timers advance on their own (intro -> question -> reveal -> final)', () => {
  const t = started(2, [mcInput()]);
  t.ff(); assert.equal(t.state().phase, 'QUESTION');
  t.ff(); assert.equal(t.state().phase, 'REVEAL');
  t.ff(); assert.equal(t.state().phase, 'FINAL');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.socks.b.view().winnerUserId, null, 'nobody scored');
});

test('QUIZ manager: a spectator is read-only and sees the public view only', () => {
  const t = started(3, [mcInput()]);
  const spec = t.watch('s1');
  for (const type of ['quiz-show:answer', 'quiz-show:buzz', 'quiz-show:control', 'quiz-show:judge', 'quiz-show:edit', 'quiz-show:start', 'game:chat']) spec.msg(type, { questionId: 'q1', optionIndex: 0, content: 'hi', action: 'end' });
  assert.equal(spec.errors().length, 7);
  assert.ok(spec.errors().every(c => c === 'SPECTATOR'));
  assert.equal(t.state().phase, 'INTRO');
  const q = toQuestion(t);
  t.socks.b.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  assert.ok(!spec.text().includes('"myOption":1'));
});

test('QUIZ manager: a disconnected player is not waited for; reconnecting restores their own view', async () => {
  const t = started(3, [mcInput()]);
  const q = toQuestion(t);
  t.socks.c.close();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(t.state().players.find((p: any) => p.userId === 'c').connected, false);
  t.socks.b.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  assert.equal(t.state().phase, 'REVEAL', 'the only connected player answered');
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U('c'));
  assert.equal(t.state().players.find((p: any) => p.userId === 'c').connected, true);
  assert.equal(again.of('game:sync')[0].payload.room.gameState.me.role, 'player');
  assert.ok(!again.text().includes('"draft":['));
});

test('QUIZ manager: when the host leaves for good the quiz is ABORTED and the room finished (no host transfer)', () => {
  const t = started(3, [mcInput()]);
  toQuestion(t);
  t.socks.a.msg('game:leave');
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.get().hostUserId, 'a', 'the quiz master is never handed to a player');
  assert.equal(t.socks.b.view().phase, 'ABORTED');
  assert.equal(t.socks.b.of('game:player_left').length, 1);
});

test('QUIZ manager: a player leaving keeps the score, marked left; when every player left the quiz aborts', () => {
  const t = started(3, [mcInput(), mcInput()]);
  const q = toQuestion(t);
  t.socks.b.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  t.socks.c.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  assert.equal(t.state().phase, 'REVEAL');
  t.socks.b.msg('game:leave');
  assert.equal(t.state().phase, 'REVEAL');
  const row = t.socks.a.view().leaderboard.find((r: any) => r.userId === 'b');
  assert.equal(row.left, true);
  assert.ok(row.score > 0);
  t.socks.c.msg('game:leave');
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
});

test('QUIZ manager: everybody disconnected for good abandons the quiz cleanly', async () => {
  const t = started(2, [mcInput()]);
  toQuestion(t);
  t.socks.b.close(); t.socks.a.close();
  await new Promise(r => setTimeout(r, 450));
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.state().phase, 'ABORTED');
});

test('QUIZ manager: the host leaving the lobby closes the room', () => {
  const t = lobby(3);
  t.socks.a.msg('game:leave');
  assert.equal(t.get().status, 'CANCELLED');
  const left = t.socks.b.of('game:player_left')[0];
  assert.equal(left.payload.roomClosed, true);
});

test('QUIZ manager: a player leaving the lobby frees the seat and keeps the quiz', () => {
  const t = lobby(3);
  t.socks.a.msg('quiz-show:edit', { op: 'add', question: mcInput() });
  t.socks.c.msg('game:leave');
  assert.equal(t.get().status, 'WAITING');
  assert.equal(t.get().players.length, 2);
  assert.equal(t.state().quiz.length, 1);
});

test('QUIZ manager: rematch (host only) replays the same quiz with scores reset; edit again returns to the lobby', () => {
  const t = started(3, [mcInput()]);
  const q = toQuestion(t);
  t.socks.b.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  t.socks.c.msg('quiz-show:answer', { questionId: q, optionIndex: 1 });
  t.ff(); // reveal -> final
  assert.equal(t.state().phase, 'FINAL');
  t.socks.b.msg('quiz-show:rematch');
  t.socks.b.msg('game:rematch');
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY', 'HOST_ONLY']);
  t.socks.a.msg('quiz-show:rematch');
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  assert.equal(t.state().phase, 'INTRO');
  assert.ok(t.state().players.every((p: any) => p.score === 0));
  assert.equal(t.state().quiz.length, 1);
  // end it and edit again
  t.socks.a.msg('quiz-show:control', { action: 'end' });
  assert.equal(t.get().status, 'FINISHED');
  t.socks.c.msg('game:leave');
  t.socks.a.msg('quiz-show:edit_again');
  assert.equal(t.get().status, 'WAITING');
  assert.equal(t.state().phase, 'LOBBY');
  assert.equal(t.state().quiz.length, 1);
  assert.equal(t.get().players.some((p) => p.userId === 'c'), false, 'a player who left is removed from the lobby');
  assert.equal(t.socks.a.view().draft.length, 1);
  assert.equal(t.socks.b.view().phase, 'LOBBY');
  assert.equal(t.socks.b.view().draft, null);
  t.socks.a.msg('quiz-show:edit', { op: 'add', question: mcInput({ text: 'second' }) });
  assert.equal(t.state().quiz.length, 2);
  t.socks.a.msg('quiz-show:start');
  assert.equal(t.get().status, 'PLAYING');
});

test('QUIZ manager: up to 30 players plus the host fit; the 32nd person is refused', () => {
  const t = lobby(1);
  for (let i = 0; i < 30; i++) t.m.joinRoom(t.code, U(`p${i}`));
  assert.equal(t.get().players.length, 31);
  assert.throws(() => t.m.joinRoom(t.code, U('late')), /full/i);
});
