import './_noRealDb.js'; // never reach a real database from tests
import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';
import { MurderMysteryEngine as E } from '../games/MurderMysteryEngine.js';

// Manager level tests of Murder Mystery Night with fake sockets: wiring, per-recipient redaction, quiet whispers, public chat,
// forged / out-of-phase / duplicate actions, disconnect / leave / abort, rematch with another case. Uses the bundled cases.

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      if (p?.gameState?.game === 'murder-mystery') return p.gameState;
      if (p?.room?.gameState?.game === 'murder-mystery') return p.room.gameState;
    }
    return null;
  }
  chats() { return this.of('game:chat_message').map(m => m.payload); }
  stateMsgs() { return this.of('murder-mystery:state').length; }
  text() { return JSON.stringify(this.sent); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });
const env = process.env as Record<string, string | undefined>;
const keepEnv = env.MURDER_TEST_MIN_PLAYERS;
afterEach(() => { env.MURDER_TEST_MIN_PLAYERS = keepEnv ?? ''; });

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function lobby(n = 6) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'murder-mystery', maxPlayers: 12 });
  const ids = IDS.slice(0, n);
  for (const id of ids.slice(1)) m.joinRoom(r.roomCode, U(id));
  const socks: Record<string, FakeSocket> = {};
  for (const id of ids) { socks[id] = new FakeSocket(); m.registerClient(socks[id] as any, r.id, U(id)); }
  const get = () => db.getGameRoomById(r.id)!;
  const state = (): any => get().gameState;
  const fastForward = () => {
    const st = state();
    if (st.phaseEndsAt !== null) st.phaseEndsAt = 0;
    db.updateGameRoomState(r.id, st, 0);
    m.tickMurder(r.id);
  };
  const watch = (id: string) => {
    const s = new FakeSocket();
    m.registerClient(s as any, r.id, U(id), { spectate: true, canSpectate: true });
    return s;
  };
  return { db, m, id: r.id as string, code: r.roomCode as string, ids, socks, get, state, fastForward, watch };
}

function started(n = 6, caseId = 'random') {
  const t = lobby(n);
  if (caseId !== 'random') t.socks.a.msg('murder-mystery:pick_case', { caseId });
  t.socks.a.msg('murder-mystery:start');
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  const st = t.state();
  const murderer: string = st.secret.murdererUserId;
  const charOf = (id: string): string => st.secret.assignment[id];
  const def = () => E.catalogue.find((c) => c.id === t.state().secret.caseId)!;
  const ownerOf = (cid: string) => t.ids.find(id => charOf(id) === cid);
  return { ...t, murderer, charOf, def, ownerOf, innocents: t.ids.filter(i => i !== murderer) };
}
type Started = ReturnType<typeof started>;
function toRound1(t: Started) { t.fastForward(); assert.equal(t.state().phase, 'CLUE_ROUND'); }
function toAccusation(t: Started) { for (let i = 0; i < 6 && t.state().phase !== 'ACCUSATION'; i++) t.fastForward(); assert.equal(t.state().phase, 'ACCUSATION'); }

test('MURDER manager: a room needs 6 connected players and only the host starts it; no auto start; 12 seats', () => {
  const t5 = lobby(5);
  assert.equal(t5.get().minPlayers, 6);
  assert.equal(t5.get().maxPlayers, 12);
  assert.ok(/^MURDER-/.test(t5.code));
  assert.equal(t5.get().gameState.phase, 'LOBBY');
  t5.socks.a.msg('murder-mystery:start');
  assert.deepEqual(t5.socks.a.errors(), ['INVALID_INPUT']);
  const t = lobby(6);
  assert.equal(t.get().status, 'WAITING');
  t.socks.b.msg('murder-mystery:start');
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY']);
  t.socks.a.msg('murder-mystery:start');
  assert.equal(t.get().status, 'PLAYING');
  t.socks.a.msg('murder-mystery:start');
  assert.ok(t.socks.a.errors().includes('ILLEGAL_MOVE'));
  const full = lobby(6);
  for (const id of ['g', 'h', 'i', 'j', 'k', 'l']) full.m.joinRoom(full.code, U(id));
  assert.throws(() => full.m.joinRoom(full.code, U('m')), /full/i);
});

test('MURDER manager: MURDER_TEST_MIN_PLAYERS lets two players start a game', () => {
  env.MURDER_TEST_MIN_PLAYERS = '2';
  const t = lobby(2);
  assert.equal(t.get().minPlayers, 2);
  t.socks.a.msg('murder-mystery:start');
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  assert.equal(t.state().players.length, 2);
  assert.equal(Object.values(t.state().secret.assignment).length, 2);
  assert.ok(t.socks.a.view().me.card);
  assert.ok(t.socks.b.view().me.card);
});

test('MURDER manager: the lobby carries the catalogue; only the host picks the case, only valid choices, only in the lobby', () => {
  const t = lobby(6);
  const v = t.socks.b.view();
  assert.equal(v.phase, 'LOBBY');
  assert.equal(v.cases.length, 3);
  assert.equal(v.caseChoice, 'random');
  assert.equal(v.me, null);
  t.socks.b.msg('murder-mystery:pick_case', { caseId: v.cases[1].id });
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY']);
  t.socks.a.msg('murder-mystery:pick_case', { caseId: 'nope' });
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT']);
  t.socks.a.msg('murder-mystery:pick_case', { caseId: 5 });
  t.socks.a.msg('murder-mystery:pick_case', {});
  assert.equal(t.socks.a.errors().length, 3);
  t.socks.a.msg('murder-mystery:pick_case', { caseId: v.cases[1].id });
  for (const id of t.ids) assert.equal(t.socks[id].view().caseChoice, v.cases[1].id, `${id} did not see the choice`);
  t.socks.a.msg('murder-mystery:start');
  assert.equal(t.state().secret.caseId, v.cases[1].id);
  t.socks.a.msg('murder-mystery:pick_case', { caseId: v.cases[0].id });
  assert.ok(t.socks.a.errors().includes('ILLEGAL_MOVE'));
  assert.equal(t.state().secret.caseId, v.cases[1].id);
});

test('MURDER manager: every recipient gets only their own character card; spectators and strangers nothing private', () => {
  const t = started(7);
  const spec = t.watch('s1');
  const c = t.def();
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.game, 'murder-mystery');
    assert.equal(v.phase, 'CHARACTER_REVEAL');
    assert.equal(v.me.characterId, t.charOf(id));
    assert.equal(v.me.card.isMurderer, id === t.murderer);
    const text = t.socks[id].text();
    assert.ok(!text.includes('"secret":{'), `${id} got the server secret block`);
    for (const other of t.ids.filter(x => x !== id)) {
      const def = c.characters.find(x => x.id === t.charOf(other))!;
      assert.ok(!text.includes(def.secretMotive) && !text.includes(def.secret) && !text.includes(def.alibi), `${id} saw the card of ${other}`);
    }
    if (id !== t.murderer) {
      assert.ok(!text.includes(c.solution.method), `${id} saw the method`);
      assert.ok(!text.includes('"isMurderer":true'));
      assert.ok(!text.includes(c.solution.motive));
    }
  }
  assert.equal(spec.view().me, null);
  for (const def of c.characters) assert.ok(!spec.text().includes(def.secretMotive) && !spec.text().includes(def.alibi), 'spectator saw a card');
  assert.ok(!spec.text().includes(c.solution.method));
  const projected: any = t.m.projectRoomFor(t.get(), t.innocents[0]);
  assert.equal(projected.gameState.me.characterId, t.charOf(t.innocents[0]));
  const stranger: any = t.m.projectRoomFor(t.get(), 'nobody');
  assert.equal(stranger.gameState.me, null);
  assert.ok(!JSON.stringify(stranger).includes(c.solution.method));
});

test('MURDER manager: a spectator is read-only', () => {
  const t = started(6);
  const spec = t.watch('s1');
  for (const type of ['murder-mystery:ready', 'murder-mystery:whisper', 'murder-mystery:share_clue', 'murder-mystery:accuse', 'murder-mystery:next', 'murder-mystery:start', 'game:chat']) spec.msg(type, { toUserId: 'a', text: 'hi', clueId: 'x', characterId: 'y', content: 'hi' });
  assert.equal(spec.errors().length, 7);
  assert.ok(spec.errors().every(c => c === 'SPECTATOR'));
});

test('MURDER manager: the clock runs reveal, four clue rounds, accusation; clues arrive per round; the host can skip a round', () => {
  const t = started(6);
  const c = t.def();
  t.fastForward();
  assert.equal(t.state().phase, 'CLUE_ROUND');
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.round, 1);
    assert.deepEqual(v.clues[0].clues.map((x: any) => x.id), c.rounds[0].publicClues.map(x => x.id));
    const expected = c.rounds[0].privateClues.filter(x => x.ownerId === t.charOf(id)).map(x => x.id);
    assert.deepEqual(v.me.privateClues.map((x: any) => x.id), expected);
  }
  t.socks.b.msg('murder-mystery:next');
  assert.deepEqual(t.socks.b.errors(), ['HOST_ONLY']);
  // the dwell guard: a host "next" right after the phase started changes nothing
  t.socks.a.msg('murder-mystery:next');
  assert.equal(t.state().round, 1);
  const st = t.state(); st.phaseEndsAt -= 5_000; t.db.updateGameRoomState(t.id, st, 0);
  t.socks.a.msg('murder-mystery:next');
  assert.equal(t.state().round, 2);
  for (const id of t.ids) assert.equal(t.socks[id].view().round, 2);
  // everybody ready: next round at once
  for (const id of t.ids) t.socks[id].msg('murder-mystery:ready');
  assert.equal(t.state().round, 3);
  t.fastForward(); t.fastForward();
  assert.equal(t.state().phase, 'ACCUSATION');
});

test('MURDER manager: a whisper reaches only its sender and receiver (nobody else is even notified); never a spectator', () => {
  const t = started(7);
  toRound1(t);
  const spec = t.watch('s1');
  const [a, b, c, d] = ['a', 'b', 'c', 'd'];
  const before = Object.fromEntries(t.ids.map(id => [id, t.socks[id].stateMsgs()]));
  const specBefore = spec.stateMsgs();
  t.socks[c].msg('murder-mystery:whisper', { toUserId: d, text: 'WHISPER-CD-TEXT' });
  assert.equal(t.socks[c].view().me.whispers[0].text, 'WHISPER-CD-TEXT');
  assert.equal(t.socks[d].view().me.whispers[0].fromUserId, c);
  assert.equal(t.socks[c].view().me.whispersLeft, 4);
  for (const id of t.ids.filter(x => x !== c && x !== d)) {
    assert.equal(t.socks[id].stateMsgs(), before[id], `${id} was notified of a whisper`);
    assert.ok(!t.socks[id].text().includes('WHISPER-CD-TEXT'), `${id} saw the whisper`);
  }
  assert.equal(spec.stateMsgs(), specBefore);
  assert.ok(!spec.text().includes('WHISPER-CD-TEXT'));
  // a late joiner / reconnect of a bystander gets it through nothing
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U(a));
  assert.ok(!again.text().includes('WHISPER-CD-TEXT'));
  const dAgain = new FakeSocket();
  t.m.registerClient(dAgain as any, t.id, U(d));
  assert.ok(dAgain.text().includes('WHISPER-CD-TEXT'), 'the receiver gets it back after a reconnect');
  // limits and malformed payloads
  t.socks[c].msg('murder-mystery:whisper', { toUserId: c, text: 'me' });
  t.socks[c].msg('murder-mystery:whisper', { toUserId: 'zz', text: 'x' });
  t.socks[c].msg('murder-mystery:whisper', { toUserId: d, text: 'y'.repeat(141) });
  t.socks[c].msg('murder-mystery:whisper', { toUserId: d });
  assert.deepEqual(t.socks[c].errors(), ['ILLEGAL_MOVE', 'INVALID_INPUT', 'INVALID_INPUT', 'INVALID_INPUT']);
  assert.ok(b);
});

test('MURDER manager: whispers are limited to 5 per round, and the message rate is limited too', () => {
  const t = started(6);
  toRound1(t);
  for (let i = 0; i < 5; i++) t.socks.c.msg('murder-mystery:whisper', { toUserId: 'd', text: `w${i}` });
  assert.deepEqual(t.socks.c.errors(), []);
  t.socks.c.msg('murder-mystery:whisper', { toUserId: 'd', text: 'sixth' });
  assert.deepEqual(t.socks.c.errors(), ['ILLEGAL_MOVE']);
  t.socks.c.msg('murder-mystery:whisper', { toUserId: 'd', text: 'seventh' });
  assert.deepEqual(t.socks.c.errors(), ['ILLEGAL_MOVE', 'RATE_LIMITED']);
  assert.equal(t.socks.d.view().me.whispers.length, 5);
});

test('MURDER manager: sharing a clue puts it on the public evidence board for everybody, spectators included; only own clues, once', () => {
  const t = started(6);
  toRound1(t);
  const spec = t.watch('s1');
  const c = t.def();
  const clue = c.rounds[0].privateClues.find(x => t.ownerOf(x.ownerId))!;
  const owner = t.ownerOf(clue.ownerId)!;
  const other = t.ids.find(id => id !== owner)!;
  t.socks[other].msg('murder-mystery:share_clue', { clueId: clue.id });
  assert.deepEqual(t.socks[other].errors(), ['INVALID_INPUT']);
  for (const id of t.ids) assert.ok(!t.socks[id].view().evidence.length);
  t.socks[owner].msg('murder-mystery:share_clue', { clueId: clue.id });
  for (const sock of [...t.ids.map(id => t.socks[id]), spec]) {
    const v = sock.view();
    assert.deepEqual(v.evidence.map((e: any) => [e.clueId, e.text, e.sharedByUserId]), [[clue.id, clue.text, owner]]);
  }
  assert.equal(t.socks[owner].view().me.sharesLeft, 2);
  const n = t.socks[other].stateMsgs();
  t.socks[owner].msg('murder-mystery:share_clue', { clueId: clue.id });
  assert.equal(t.socks[other].stateMsgs(), n, 'sharing twice changes nothing');
  t.socks[owner].msg('murder-mystery:share_clue', {});
  assert.ok(t.socks[owner].errors().includes('INVALID_INPUT'));
});

test('MURDER manager: accusations are secret until the result; out-of-phase, double, forged and malformed ones change nothing', () => {
  const t = started(6);
  toRound1(t);
  const c = t.def();
  const right = c.solution.murdererId;
  const [i1, i2] = t.innocents;
  t.socks[i1].msg('murder-mystery:accuse', { characterId: right, motive: 'too early' });
  assert.deepEqual(t.socks[i1].errors(), ['WRONG_PHASE']);
  assert.deepEqual(t.state().secret.accusations, {});
  toAccusation(t);
  // forged sender fields are ignored: the accusation always belongs to the socket's user
  t.socks[i1].msg('murder-mystery:accuse', { characterId: right, motive: 'ACCUSATION-SECRET-TEXT', userId: i2, fromUserId: i2 });
  assert.deepEqual(Object.keys(t.state().secret.accusations), [i1]);
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.deepEqual(v.accusedUserIds, [i1], `${id} sees who has accused`);
    assert.equal(t.socks[id].text().includes('ACCUSATION-SECRET-TEXT'), id === i1 || id === i1, `${id} accusation text`);
  }
  assert.equal(t.socks[i1].view().me.myAccusation.characterId, right);
  assert.equal(t.socks[i2].view().me.myAccusation, null);
  // duplicate / change / own character / unknown character / absent character
  const n = t.socks[i2].stateMsgs();
  t.socks[i1].msg('murder-mystery:accuse', { characterId: right, motive: 'ACCUSATION-SECRET-TEXT' });
  assert.equal(t.socks[i2].stateMsgs(), n, 'the same accusation again is a no-op');
  t.socks[i1].msg('murder-mystery:accuse', { characterId: t.charOf(i2), motive: 'changed my mind' });
  t.socks[i2].msg('murder-mystery:accuse', { characterId: t.charOf(i2), motive: '' });
  t.socks[i2].msg('murder-mystery:accuse', { characterId: 'nobody', motive: '' });
  t.socks[i2].msg('murder-mystery:accuse', { characterId: t.state().secret.absent[0], motive: '' });
  t.socks[i2].msg('murder-mystery:accuse', { motive: 'no character' });
  t.socks[t.innocents[2]].msg('murder-mystery:accuse', { characterId: right, motive: 'z'.repeat(1000) });
  assert.deepEqual(t.socks[i1].errors().slice(1), ['ALREADY_VOTED']);
  assert.deepEqual(t.socks[i2].errors(), ['ILLEGAL_MOVE', 'INVALID_INPUT', 'INVALID_INPUT', 'INVALID_INPUT']);
  assert.deepEqual(t.socks[t.innocents[2]].errors(), ['INVALID_INPUT']);
  assert.deepEqual(Object.keys(t.state().secret.accusations), [i1]);
});

test('MURDER manager: accuse rate limit; a stranger and a non-player cannot act', () => {
  const t = started(6);
  toAccusation(t);
  const [i1] = t.innocents;
  for (let i = 0; i < 4; i++) t.socks[i1].msg('murder-mystery:accuse', { characterId: 'nobody' });
  t.socks[i1].msg('murder-mystery:accuse', { characterId: 'nobody' });
  assert.equal(t.socks[i1].errors().pop(), 'RATE_LIMITED');
  const outsider = new FakeSocket();
  t.m.registerClient(outsider as any, t.id, U('zz'));
  outsider.msg('murder-mystery:accuse', { characterId: t.def().solution.murdererId });
  assert.ok(outsider.of('error:notification').length > 0 || outsider.readyState === 3 || outsider.errors().length > 0, 'a non-player was let in');
  assert.equal(t.state().secret.accusations.zz, undefined);
});

test('MURDER manager: full game to the result and the final leaderboard; the result reveals everything to everybody', () => {
  const t = started(6);
  const spec = t.watch('s1');
  const c = t.def();
  toAccusation(t);
  const right = c.solution.murdererId;
  for (const id of t.innocents) t.socks[id].msg('murder-mystery:accuse', { characterId: right, motive: `it was ${id}` });
  assert.equal(t.state().phase, 'ACCUSATION', 'the murderer has not accused');
  t.socks[t.murderer].msg('murder-mystery:accuse', { characterId: t.charOf(t.innocents[0]), motive: 'bluff' });
  assert.equal(t.state().phase, 'RESULT');
  for (const sock of [...t.ids.map(id => t.socks[id]), spec]) {
    const v = sock.view();
    assert.equal(v.phase, 'RESULT');
    assert.equal(v.result.murdererCharacterId, right);
    assert.equal(v.result.murdererUserId, t.murderer);
    assert.equal(v.result.method, c.solution.method);
    assert.equal(v.result.rows.length, 6);
    assert.equal(v.result.murdererSurvived, false);
    for (const row of v.result.rows) assert.equal(row.total, row.isMurderer ? 0 : row.correctOrder <= 3 ? 125 : 100);
    assert.ok(sock.text().includes(c.characters.find(x => x.id === t.charOf(t.innocents[1]))!.secretMotive));
  }
  assert.equal(t.get().status, 'PLAYING');
  t.socks.b.msg('murder-mystery:next');
  assert.ok(t.socks.b.errors().includes('HOST_ONLY'));
  t.fastForward();
  assert.equal(t.state().phase, 'FINAL');
  assert.equal(t.get().status, 'FINISHED');
  assert.equal(t.socks.c.view().phase, 'FINAL');
  assert.equal(t.socks.c.view().result.rows[0].rank, 1);
});

test('MURDER manager: rematch is host only and plays another case with new characters', async () => {
  const t = started(6, 'random');
  const firstCase = t.state().secret.caseId;
  toAccusation(t);
  t.fastForward(); t.fastForward();
  assert.equal(t.state().phase, 'FINAL');
  t.socks.b.msg('game:rematch');
  assert.ok(t.socks.b.errors().includes('HOST_ONLY'));
  t.socks.a.msg('game:rematch');
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  assert.equal(t.state().phase, 'CHARACTER_REVEAL');
  assert.notEqual(t.state().secret.caseId, firstCase);
  assert.equal(t.state().gamesPlayed, 1);
  assert.deepEqual(t.state().secret.accusations, {});
  assert.deepEqual(t.state().evidence, []);
  for (const id of t.ids) assert.equal(t.socks[id].view().me.card.characterId, t.state().secret.assignment[id]);
  await sleep(5);
});

test('MURDER manager: chat is one public channel for everybody (spectators read it, cannot write); whispers are not chat', () => {
  const t = started(6);
  toRound1(t);
  const spec = t.watch('s1');
  t.socks.c.msg('game:chat', { content: 'I suspect the butler' });
  for (const sock of [...t.ids.map(id => t.socks[id]), spec]) assert.deepEqual(sock.chats().map((m: any) => m.content), ['I suspect the butler']);
  t.socks.c.msg('murder-mystery:whisper', { toUserId: 'd', text: 'psst' });
  for (const id of t.ids.filter(x => x !== 'c' && x !== 'd')) assert.ok(!t.socks[id].text().includes('psst'));
  const lateSpec = t.watch('s2');
  assert.deepEqual(lateSpec.of('game:sync')[0].payload.chatHistory.map((m: any) => m.content), ['I suspect the butler']);
});

test('MURDER manager: a disconnected player keeps the seat and gets the card and clues back; a leaver is withdrawn', async () => {
  const t = started(7);
  toRound1(t);
  const away = t.innocents[0];
  t.socks[away].close();
  await sleep(5);
  assert.equal(t.state().players.find((p: any) => p.userId === away).connected, false);
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U(away));
  assert.equal(t.state().players.find((p: any) => p.userId === away).connected, true);
  const v = back.of('game:sync')[0].payload.room.gameState;
  assert.equal(v.me.characterId, t.charOf(away));
  const leaver = t.innocents[1];
  t.socks[leaver].msg('game:leave');
  const p = t.state().players.find((x: any) => x.userId === leaver);
  assert.equal(p.left, true);
  assert.equal(t.get().status, 'PLAYING');
  const c = t.def();
  const def = c.characters.find(x => x.id === t.charOf(leaver))!;
  for (const id of t.ids.filter(i => i !== leaver && i !== away)) {
    const view = t.socks[id].view();
    assert.equal(view.characters.find((x: any) => x.userId === leaver).withdrawn, true);
    assert.ok(view.log.some((l: any) => l.kind === 'left' && l.text.includes(def.name)));
    if (id !== leaver) assert.ok(!JSON.stringify(view.log).includes(def.secretMotive));
  }
  // the withdrawn player can no longer act
  t.socks[leaver].msg('murder-mystery:ready');
  assert.ok(!t.state().readyUserIds.includes(leaver), 'a departed session can no longer act');
  assert.throws(() => t.m.handleMurderReady(t.id, leaver), /not a player/i);
});

test('MURDER manager: when the murderer leaves the game goes on and nothing is revealed; they score 0 at the result', () => {
  const t = started(7);
  toRound1(t);
  t.socks[t.murderer].msg('game:leave');
  assert.equal(t.state().phase, 'CLUE_ROUND');
  const c = t.def();
  for (const id of t.innocents) {
    assert.ok(!t.socks[id].text().includes(c.solution.method), `${id} learned the method`);
    assert.ok(!t.socks[id].view().result);
  }
  toAccusation(t);
  const right = c.solution.murdererId;
  for (const id of t.innocents) t.socks[id].msg('murder-mystery:accuse', { characterId: right, motive: '' });
  assert.equal(t.state().phase, 'RESULT');
  const rows = t.socks[t.innocents[0]].view().result.rows;
  assert.equal(rows.find((r: any) => r.isMurderer).total, 0);
});

test('MURDER manager: fewer than 4 seated players abort cleanly; the room is finished and nothing is revealed', () => {
  const t = started(6);
  toRound1(t);
  t.socks.e.msg('game:leave');
  t.socks.f.msg('game:leave');
  assert.equal(t.state().phase, 'CLUE_ROUND', '4 seated players keep playing');
  const stay = t.ids.filter(i => i !== 'e' && i !== 'f' && i !== 'd');
  // The murderer legitimately holds the method in their OWN earlier frames (card.method), so only frames sent after the abort are
  // compared for everybody; players who are not the murderer must never have seen it at all.
  const before = Object.fromEntries(stay.map(id => [id, t.socks[id].sent.length]));
  t.socks.d.msg('game:leave');
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
  const c = t.def();
  for (const id of stay) {
    const v = t.socks[id].view();
    assert.equal(v.phase, 'ABORTED');
    assert.match(v.statusMessage, /few|enough/i);
    assert.equal(v.result, null);
    assert.equal(v.me, null);
    const after = JSON.stringify(t.socks[id].sent.slice(before[id]));
    assert.ok(!after.includes(c.solution.method), `${id} saw the method after the abort`);
    assert.ok(!after.includes('"isMurderer":true'));
    if (id !== t.murderer) {
      assert.ok(!t.socks[id].text().includes(c.solution.method), `${id} saw the method`);
      assert.ok(!t.socks[id].text().includes('"isMurderer":true'));
    }
  }
  t.socks[stay[0]].msg('murder-mystery:ready');
  assert.ok(t.socks[stay[0]].errors().length > 0);
});

test('MURDER manager: a game that is not running refuses every action', () => {
  const t = lobby(6);
  for (const [type, payload] of [['murder-mystery:ready', {}], ['murder-mystery:whisper', { toUserId: 'b', text: 'hi' }], ['murder-mystery:share_clue', { clueId: 'x' }], ['murder-mystery:accuse', { characterId: 'x', motive: '' }], ['murder-mystery:next', {}]] as Array<[string, any]>) {
    t.socks.a.msg(type, payload);
  }
  assert.equal(t.socks.a.errors().length, 5);
  assert.ok(t.socks.a.errors().every(c => c === 'NOT_PLAYING'));
});
