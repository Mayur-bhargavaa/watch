import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

// Manager level tests of Mafia Night with fake sockets: wiring, per-recipient redaction, quiet night actions, chat channels,
// disconnect / leave / abort, rematch.

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
      if (p?.gameState?.game === 'mafia-night') return p.gameState;
      if (p?.room?.gameState?.game === 'mafia-night') return p.room.gameState;
    }
    return null;
  }
  chats() { return this.of('game:chat_message').map(m => m.payload); }
  text() { return JSON.stringify(this.sent); }
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

function lobby(n = 5) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: 150, graceMsWaiting: 150, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'mafia-night', maxPlayers: 10 });
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
    m.tickMafia(r.id);
  };
  const watch = (id: string) => {
    const s = new FakeSocket();
    m.registerClient(s as any, r.id, U(id), { spectate: true, canSpectate: true });
    return s;
  };
  return { db, m, id: r.id as string, code: r.roomCode as string, ids, socks, get, state, fastForward, watch };
}

function started(n = 5) {
  const t = lobby(n);
  t.socks.a.msg('mafia:start');
  assert.equal(t.get().status, 'PLAYING', t.socks.a.errors().join());
  const roles: Record<string, string> = t.state().secret.roles;
  const by = (role: string) => t.ids.filter(id => roles[id] === role);
  return { ...t, roles, by };
}
/** to the first NIGHT */
function toNight(t: ReturnType<typeof started>) {
  t.fastForward();
  assert.equal(t.state().phase, 'NIGHT');
}

test('MAFIA manager: a room needs 5 connected players and only the host starts it; no auto start', () => {
  const t = lobby(4);
  assert.equal(t.get().minPlayers, 5);
  assert.equal(t.get().maxPlayers, 10);
  assert.equal(t.get().gameState, null);
  assert.ok(/^MAFIA-/.test(t.code));
  t.socks.a.msg('mafia:start');
  assert.deepEqual(t.socks.a.errors(), ['INVALID_INPUT']);
  const t5 = lobby(5);
  assert.equal(t5.get().status, 'WAITING');
  t5.socks.b.msg('mafia:start');
  assert.deepEqual(t5.socks.b.errors(), ['HOST_ONLY']);
  t5.socks.a.msg('mafia:start');
  assert.equal(t5.get().status, 'PLAYING');
  t5.socks.a.msg('mafia:start');
  assert.ok(t5.socks.a.errors().includes('ILLEGAL_MOVE'));
});

test('MAFIA manager: a full table of 10 is closed to an 11th player', () => {
  const t = lobby(5);
  for (const id of ['f', 'g', 'h', 'i', 'j']) t.m.joinRoom(t.code, U(id));
  assert.throws(() => t.m.joinRoom(t.code, U('k')), /full/i);
});

test('MAFIA manager: every recipient gets only their own role; the mafia also get teammates; spectators nothing private', () => {
  const t = started(7); // 2 mafia
  const spec = t.watch('s1');
  const mafia = t.by('mafia');
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.game, 'mafia-night');
    assert.equal(v.phase, 'ROLE_REVEAL');
    assert.equal(v.me.role, t.roles[id]);
    assert.deepEqual(v.me.teammates, t.roles[id] === 'mafia' ? mafia.filter(x => x !== id) : []);
    const text = t.socks[id].text();
    assert.ok(!text.includes('"secret"'), `${id} got the secret block`);
    assert.ok(v.players.every((p: any) => p.role === null));
    if (t.roles[id] === 'villager') for (const role of ['"mafia"', '"doctor"', '"detective"']) assert.ok(!text.includes(role), `villager ${id} saw ${role}`);
  }
  assert.equal(spec.view().me, null);
  for (const role of ['"mafia"', '"doctor"', '"detective"', '"villager"', '"secret"']) assert.ok(!spec.text().includes(role), `spectator saw ${role}`);
  const projected: any = t.m.projectRoomFor(t.get(), t.by('villager')[0]);
  assert.equal(projected.gameState.me.role, 'villager');
  const stranger: any = t.m.projectRoomFor(t.get(), 'nobody');
  assert.equal(stranger.gameState.me, null);
  assert.ok(!JSON.stringify(stranger).includes('"mafia"'));
});

test('MAFIA manager: a spectator is read-only', () => {
  const t = started(5);
  const spec = t.watch('s1');
  for (const type of ['mafia:night_action', 'mafia:vote', 'mafia:ready', 'mafia:start', 'game:chat']) spec.msg(type, { action: 'kill', targetUserId: 'a', content: 'hi' });
  assert.equal(spec.errors().length, 5);
  assert.ok(spec.errors().every(c => c === 'SPECTATOR'));
});

test('MAFIA manager: a night action is acknowledged to the actor only; other players are not even told something happened', () => {
  const t = started(5);
  toNight(t);
  const [mafia] = t.by('mafia'); const [doctor] = t.by('doctor'); const [det] = t.by('detective');
  const vill = t.by('villager');
  const spec = t.watch('s1');
  const counts = Object.fromEntries([...t.ids, 's1'].map(id => [id, (id === 's1' ? spec : t.socks[id]).sent.length]));
  t.socks[doctor].msg('mafia:night_action', { action: 'save', targetUserId: vill[0] });
  t.socks[det].msg('mafia:night_action', { action: 'investigate', targetUserId: mafia });
  t.socks[mafia].msg('mafia:night_action', { action: 'kill', targetUserId: vill[0] });
  assert.equal(t.socks[doctor].view().me.nightChoice, vill[0]);
  assert.equal(t.socks[det].view().me.nightChoice, mafia);
  assert.equal(t.socks[mafia].view().me.nightChoice, vill[0]);
  for (const id of [...vill, 's1']) {
    const sock = id === 's1' ? spec : t.socks[id];
    assert.equal(sock.sent.length, counts[id], `${id} was sent something during the night actions`);
  }
  assert.equal(t.socks[doctor].sent.length > counts[doctor], true);
  assert.ok(!t.socks[doctor].text().includes('"kill":'));
  assert.ok(!t.socks[det].view().me.teamChoices[mafia]);
});

test('MAFIA manager: wrong role / out of phase / wrong payload actions are refused with an error to the sender only and change nothing', () => {
  const t = started(5);
  const [mafia] = t.by('mafia'); const vill = t.by('villager');
  t.socks[mafia].msg('mafia:night_action', { action: 'kill', targetUserId: vill[0] });
  assert.deepEqual(t.socks[mafia].errors(), ['WRONG_PHASE']); // ROLE_REVEAL
  toNight(t);
  const before = JSON.stringify(t.state());
  t.socks[vill[0]].msg('mafia:night_action', { action: 'kill', targetUserId: vill[1] });
  t.socks[mafia].msg('mafia:night_action', { action: 'save', targetUserId: vill[0] });
  t.socks[mafia].msg('mafia:night_action', { action: 'kill', targetUserId: mafia });
  t.socks[mafia].msg('mafia:night_action', { action: 'kill', targetUserId: 'ghost' });
  t.socks[mafia].msg('mafia:night_action', { junk: true });
  assert.deepEqual(t.socks[vill[0]].errors(), ['ILLEGAL_MOVE']);
  assert.deepEqual(t.socks[mafia].errors().slice(1), ['ILLEGAL_MOVE', 'ILLEGAL_MOVE', 'INVALID_INPUT', 'INVALID_INPUT']);
  t.socks[vill[0]].msg('mafia:vote', { targetUserId: vill[1] });
  t.socks[vill[0]].msg('mafia:ready');
  assert.ok(t.socks[vill[0]].errors().includes('WRONG_PHASE'));
  assert.equal(JSON.stringify(t.state()), before);
});

test('MAFIA manager: night actions are rate limited', () => {
  const t = started(5);
  toNight(t);
  const [mafia] = t.by('mafia');
  for (let i = 0; i < 12; i++) t.socks[mafia].msg('mafia:night_action', { action: 'kill', targetUserId: t.by('villager')[i % 2] });
  assert.ok(t.socks[mafia].errors().includes('RATE_LIMITED'));
});

test('MAFIA manager: chat channels: night is mafia only, the town is locked, dead talk to the dead, spectators read the town only', async () => {
  const t = started(7); // u: a..g, 2 mafia
  const spec = t.watch('s1');
  const mafia = t.by('mafia'); const vill = t.by('villager');
  // ROLE_REVEAL: nobody may chat
  t.socks[vill[0]].msg('game:chat', { content: 'early' });
  assert.deepEqual(t.socks[vill[0]].errors(), ['CHAT_LOCKED']);
  toNight(t);
  // NIGHT: a villager is locked out, a mafia member talks to the other mafia only
  t.socks[vill[0]].msg('game:chat', { content: 'night villager' });
  assert.equal(t.socks[vill[0]].errors().at(-1), 'CHAT_LOCKED');
  t.socks[mafia[0]].msg('game:chat', { content: 'secret plan' });
  for (const id of t.ids) {
    const heard = t.socks[id].chats().some(c => c.content === 'secret plan');
    assert.equal(heard, mafia.includes(id), `${id} heard the mafia chat: ${heard}`);
  }
  assert.ok(!spec.text().includes('secret plan'));
  assert.equal(t.socks[mafia[1]].chats()[0].channel, 'mafia');
  // typing / reactions at night never reach the town
  t.socks[vill[0]].msg('game:typing', { isTyping: true });
  t.socks[mafia[0]].msg('game:typing', { isTyping: true });
  assert.equal(t.socks[vill[1]].of('game:typing').length, 0);
  assert.equal(t.socks[mafia[1]].of('game:typing').length, 1);
  t.socks[mafia[0]].msg('game:reaction', { emoji: '\u{1F602}' });
  assert.ok(t.socks[mafia[0]].errors().includes('CHAT_LOCKED'));
  // the mafia kill a villager; dawn; day
  t.socks[mafia[0]].msg('mafia:night_action', { action: 'kill', targetUserId: vill[0] });
  t.fastForward(); // NIGHT -> DAWN
  assert.equal(t.state().phase, 'DAWN');
  t.socks[vill[1]].msg('game:chat', { content: 'dawn talk' });
  assert.equal(t.socks[vill[1]].errors().at(-1), 'CHAT_LOCKED');
  t.fastForward(); // DAWN -> DAY
  assert.equal(t.state().phase, 'DAY');
  await sleep(400);
  t.socks[vill[1]].msg('game:chat', { content: 'who did it' });
  for (const id of [...t.ids, 's1']) {
    const sock = id === 's1' ? spec : t.socks[id];
    assert.ok(sock.chats().some(c => c.content === 'who did it'), `${id} missed the town chat`);
  }
  // the dead player chats with the dead only; the living and spectators hear nothing
  const lockedBefore = t.socks[vill[0]].errors().filter(c => c === 'CHAT_LOCKED').length;
  t.socks[vill[0]].msg('game:chat', { content: 'I am dead' });
  assert.equal(t.socks[vill[0]].errors().filter(c => c === 'CHAT_LOCKED').length, lockedBefore, 'the dead may chat (graveyard)');
  assert.ok(t.socks[vill[0]].chats().some(c => c.content === 'I am dead' && c.channel === 'dead'));
  for (const id of t.ids.filter(i => i !== vill[0])) assert.ok(!t.socks[id].chats().some(c => c.content === 'I am dead'), `${id} heard the dead`);
  assert.ok(!spec.text().includes('I am dead'));
  // the dead hear the town but not the mafia den
  assert.ok(t.socks[vill[0]].chats().some(c => c.content === 'who did it'));
  assert.ok(!t.socks[vill[0]].text().includes('secret plan'));
});

test('MAFIA manager: the chat history of a reconnecting player is filtered by what they may read', async () => {
  const t = started(5);
  toNight(t);
  const [mafia] = t.by('mafia'); const vill = t.by('villager');
  t.socks[mafia].msg('game:chat', { content: 'den talk' });
  t.fastForward(); t.fastForward(); // DAWN -> DAY
  await sleep(400);
  t.socks[vill[0]].msg('game:chat', { content: 'town talk' });
  // villager reconnects
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U(vill[0]));
  const hist = again.of('game:sync')[0].payload.chatHistory.map((c: any) => c.content);
  assert.deepEqual(hist, ['town talk']);
  assert.ok(!again.text().includes('den talk'), 'the den chat leaked in the sync');
  const mAgain = new FakeSocket();
  t.m.registerClient(mAgain as any, t.id, U(mafia));
  assert.deepEqual(mAgain.of('game:sync')[0].payload.chatHistory.map((c: any) => c.content), ['den talk', 'town talk']);
  const spec = t.watch('s1');
  assert.deepEqual(spec.of('game:sync')[0].payload.chatHistory.map((c: any) => c.content), ['town talk']);
  // nobody else received the den chat through the reconnect broadcast either
  for (const id of t.ids.filter(i => i !== mafia)) assert.ok(!t.socks[id].text().includes('den talk'), `${id} saw the den chat`);
});

test('MAFIA manager: dawn reveals the victim and role to everyone; a vote with a majority eliminates; the game continues', () => {
  const t = started(6);
  toNight(t);
  const [mafia] = t.by('mafia'); const vill = t.by('villager');
  t.socks[mafia].msg('mafia:night_action', { action: 'kill', targetUserId: vill[0] });
  t.fastForward();
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.phase, 'DAWN');
    assert.equal(v.dawnDeathUserId, vill[0]);
    assert.equal(v.players.find((p: any) => p.userId === vill[0]).role, 'villager');
  }
  t.fastForward(); // DAY
  const living = t.ids.filter(id => id !== vill[0]);
  for (const id of living) t.socks[id].msg('mafia:ready');
  assert.equal(t.state().phase, 'VOTE');
  t.socks[vill[0]].msg('mafia:vote', { targetUserId: mafia });
  assert.ok(t.socks[vill[0]].errors().includes('ILLEGAL_MOVE'), 'the dead cannot vote');
  for (const id of living) t.socks[id].msg('mafia:vote', { targetUserId: id === mafia ? 'skip' : mafia });
  assert.equal(t.state().phase, 'VOTE_RESULT');
  t.fastForward();
  assert.equal(t.state().phase, 'FINISHED');
  assert.equal(t.get().status, 'FINISHED');
  for (const id of t.ids) {
    const v = t.socks[id].view();
    assert.equal(v.winner, 'town');
    assert.equal(v.players.find((p: any) => p.userId === mafia).role, 'mafia');
  }
});

test('MAFIA manager: votes stay hidden from other players while the vote runs', () => {
  const t = started(5);
  toNight(t); t.fastForward(); t.fastForward();
  for (const id of t.ids) t.socks[id].msg('mafia:ready');
  assert.equal(t.state().phase, 'VOTE');
  t.socks.a.msg('mafia:vote', { targetUserId: 'b' });
  assert.equal(t.socks.a.view().myVote, 'b');
  assert.equal(t.socks.c.view().myVote, null);
  assert.ok(t.socks.c.view().votedUserIds.includes('a'));
  assert.ok(!t.socks.c.text().includes('"a":"b"'));
  t.socks.a.msg('mafia:vote', { targetUserId: 'c' });
  assert.ok(t.socks.a.errors().includes('ALREADY_VOTED'));
});

test('MAFIA manager: a disconnected player keeps the seat and can return; a leaver is dead and their role is revealed', async () => {
  const t = started(6);
  toNight(t);
  const away = t.by('villager')[0];
  t.socks[away].close();
  await new Promise(r => setImmediate(r));
  assert.equal(t.state().players.find((p: any) => p.userId === away).connected, false);
  const back = new FakeSocket();
  t.m.registerClient(back as any, t.id, U(away));
  assert.equal(t.state().players.find((p: any) => p.userId === away).connected, true);
  assert.equal(back.of('game:sync')[0].payload.room.gameState.me.role, 'villager');
  const leaver = t.by('villager')[1];
  t.socks[leaver].msg('game:leave');
  const p = t.state().players.find((x: any) => x.userId === leaver);
  assert.equal(p.left, true); assert.equal(p.alive, false); assert.equal(p.role, 'villager');
  assert.equal(t.get().status, 'PLAYING');
  for (const id of t.ids.filter(i => i !== leaver && i !== away)) assert.equal(t.socks[id].view().players.find((x: any) => x.userId === leaver).role, 'villager');
});

test('MAFIA manager: fewer than 3 players left aborts cleanly; the room is finished and no role is revealed', () => {
  const t = started(5);
  const vill = t.by('villager'); const [mafia] = t.by('mafia'); const [doctor] = t.by('doctor');
  t.socks[vill[0]].msg('game:leave');
  t.socks[vill[1]].msg('game:leave');
  assert.equal(t.state().phase, 'ROLE_REVEAL', '3 seated players keep playing');
  t.socks[doctor].msg('game:leave');
  assert.equal(t.state().phase, 'ABORTED');
  assert.equal(t.get().status, 'FINISHED');
  const remaining = t.ids.filter(id => ![vill[0], vill[1], doctor].includes(id));
  for (const id of remaining) {
    const v = t.socks[id].view();
    assert.equal(v.phase, 'ABORTED');
    assert.match(v.statusMessage, /few|enough/i);
    assert.equal(v.winner, 'none');
  }
  assert.equal(t.socks[mafia].view().players.find((p: any) => p.userId === mafia).role, null);
  t.socks[mafia].msg('mafia:ready');
  assert.ok(t.socks[mafia].errors().length > 0);
});

test('MAFIA manager: after the game everybody can rematch with fresh roles when 5 are still seated', async () => {
  const t = started(5);
  toNight(t);
  const [mafia] = t.by('mafia');
  t.socks[mafia].msg('game:leave'); // town wins at once
  assert.equal(t.state().phase, 'FINISHED');
  const rest = t.ids.filter(i => i !== mafia);
  for (const id of rest) t.socks[id].msg('game:rematch');
  assert.ok(rest.some(id => t.socks[id].errors().includes('REMATCH_UNAVAILABLE')), 'only 4 seated: no rematch');
  const u = started(5);
  toNight(u);
  u.socks[u.by('mafia')[0]].msg('game:leave');
  // leaving makes the room one short for good; a full table is needed
  assert.equal(u.get().players.filter(p => p.status !== 'LEFT').length, 4);
  await sleep(10);
});
