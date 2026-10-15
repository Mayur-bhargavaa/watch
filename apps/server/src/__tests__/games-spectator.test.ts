import './_noRealDb.js'; // never reach a real database from tests
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { DoodleDuelEngine } from '../games/DoodleDuelEngine.js';
import { GameRoomManager } from '../games/GameRoomManager.js';

const U = (n: string) => ({ id: n, displayName: n.toUpperCase(), avatarUrl: null });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
}

const managers: GameRoomManager[] = [];
after(() => { for (const m of managers) m.dispose(); });

/** a PLAYING room of `gameType` between host `a` and `b`, both with open sockets */
function playing(gameType: string, grace = 150) {
  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { graceMsPlaying: grace, graceMsWaiting: grace, sweep: false });
  m.recordGameStreaks = async () => {};
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType, maxPlayers: 2 });
  m.joinRoom(r.roomCode, U('b'));
  const socks: Record<string, FakeSocket> = { a: new FakeSocket(), b: new FakeSocket() };
  m.registerClient(socks.a as any, r.id, U('a'));
  m.registerClient(socks.b as any, r.id, U('b'));
  const watch = (id: string, canSpectate = true) => {
    const s = new FakeSocket();
    m.registerClient(s as any, r.id, U(id), { spectate: true, canSpectate });
    return s;
  };
  return { db, m, id: r.id as string, code: r.roomCode as string, socks, watch, get: () => db.getGameRoomById(r.id)! };
}

test('a friend spectates a PLAYING room and receives the projected state', () => {
  const t = playing('tic-tac-toe');
  assert.equal(t.get().status, 'PLAYING');
  const s = t.watch('f1');
  const sync = s.of('game:sync')[0];
  assert.ok(sync, 'game:sync received');
  assert.equal(sync.payload.role, 'spectator');
  assert.equal(sync.payload.spectatorCount, 1);
  assert.equal(sync.payload.myPlayer, null);
  assert.equal(sync.payload.room.status, 'PLAYING');
  assert.equal(t.get().players.length, 2); // not seated
  assert.ok(!t.get().players.some((p: any) => p.userId === 'f1'));
  const evt = t.socks.a.of('game:spectators').pop();
  assert.equal(evt.payload.count, 1);
  assert.deepEqual(evt.payload.names, ['F1']);
  // spectators receive room events
  const before = s.sent.length;
  t.socks.a.msg('game:chat', { content: 'hello' });
  assert.ok(s.sent.slice(before).some(m => m.type === 'game:chat_message'));
  // players get role: 'player'
  assert.equal(t.socks.a.of('game:sync')[0].payload.role, 'player');
});

test('non-friend / no spectate flag gets NOT_A_PLAYER; WAITING and unknown states are refused', () => {
  const t = playing('tic-tac-toe');
  const nf = t.watch('x', false);
  assert.equal(nf.of('error:notification')[0].payload.code, 'NOT_A_PLAYER');
  assert.equal(nf.readyState, 3);
  assert.equal(nf.of('game:sync').length, 0);
  const plain = new FakeSocket();
  t.m.registerClient(plain as any, t.id, U('y')); // no ?spectate=1
  assert.equal(plain.of('error:notification')[0].payload.code, 'NOT_A_PLAYER');
  assert.equal(t.m.spectatorCount(t.id), 0);

  const db = new DatabaseService(':memory:');
  const m: any = new GameRoomManager(db, { sweep: false });
  managers.push(m);
  const r = m.createGameRoom({ hostUser: U('a'), gameType: 'tic-tac-toe', maxPlayers: 2 });
  const w = new FakeSocket();
  m.registerClient(w as any, r.id, U('f'), { spectate: true, canSpectate: true });
  assert.equal(w.of('error:notification')[0].payload.code, 'NOT_A_PLAYER');
  assert.equal(db.getGameRoomById(r.id)!.players.length, 1); // did not take a seat either
});

test('spectator cap per room and per-user join rate limit', () => {
  const t = playing('tic-tac-toe');
  for (let i = 0; i < 10; i++) assert.equal(t.watch(`s${i}`).of('game:sync').length, 1);
  const extra = t.watch('s10');
  assert.equal(extra.of('error:notification')[0].payload.code, 'SPECTATOR_LIMIT');
  assert.equal(t.m.spectatorCount(t.id), 10);
  // rate limit: the same user reconnecting over and over
  const t2 = playing('tic-tac-toe');
  let limited = false;
  for (let i = 0; i < 30; i++) {
    const s = t2.watch('flap');
    if (s.of('error:notification')[0]?.payload.code === 'RATE_LIMITED') { limited = true; break; }
  }
  assert.ok(limited);
});

test('a spectator cannot act: every other message returns SPECTATOR and changes nothing', () => {
  const t = playing('tic-tac-toe');
  const s = t.watch('f1');
  const snapshot = () => JSON.stringify({ r: t.get(), votes: t.m.rematchVotes.size, chat: t.m.roomChatHistory.size, th: t.m.roomThemes.size });
  const before = snapshot();
  const types = [
    'game:tictactoe_move', 'game:roll_dice', 'game:move_token', 'game:drop_disc', 'game:chat', 'game:typing',
    'game:rematch', 'game:rematch_decline', 'game:change_theme', 'game:nudge', 'chess:move', 'chess:resign',
    'chess:config_update', 'bingo:start', 'bingo:claim', 'bingo:config', 'doodle:start', 'doodle:guess',
    'game:start', 'webrtc:signal', 'voice:state', 'camera:state', 'totally:unknown'
  ];
  for (const type of types) {
    s.msg(type, { content: 'x', index: 0, col: 0, number: 1, accept: true, targetUserId: 'a', config: { x: 1 } });
  }
  const errs = s.of('game:error');
  assert.equal(errs.length, types.length);
  assert.ok(errs.every(e => e.payload.code === 'SPECTATOR'));
  assert.equal(snapshot(), before);
  assert.equal(t.socks.a.of('game:chat_message').length, 0);
  // heartbeat / ping are fine
  s.msg('game:heartbeat'); s.msg('ping');
  assert.equal(s.of('game:error').length, types.length);
});

test('spectator reactions are validated and rate limited; game:leave detaches', () => {
  const t = playing('tic-tac-toe');
  const s = t.watch('f1');
  s.msg('game:reaction', { emoji: '🎉' });
  assert.equal(t.socks.a.of('game:reaction_broadcast')[0].payload.spectator, true);
  s.msg('game:reaction', { emoji: '🎉' }); // < 1 s later
  assert.equal(s.of('game:error').pop().payload.code, 'RATE_LIMITED');
  s.msg('game:reaction', { emoji: { evil: true } });
  assert.equal(s.of('game:error').pop().payload.code, 'INVALID_REACTION');
  s.msg('game:leave');
  assert.equal(t.m.spectatorCount(t.id), 0);
  assert.equal(t.socks.a.of('game:spectators').pop().payload.count, 0);
  assert.equal(t.get().status, 'PLAYING');
});

test('a spectator disconnecting does not forfeit or change the game; players are not affected by joins', async () => {
  const t = playing('tic-tac-toe', 100);
  const stateBefore = JSON.stringify(t.get().gameState);
  const s = t.watch('f1');
  assert.equal(t.get().players.length, 2);
  s.close();
  await sleep(350); // longer than the grace period
  const cur = t.get();
  assert.equal(cur.status, 'PLAYING');
  assert.ok(cur.players.every((p: any) => p.status !== 'LEFT'));
  assert.equal(JSON.stringify(cur.gameState), stateBefore);
  assert.equal(t.socks.a.of('game:player_left').length, 0);
  assert.equal(t.socks.a.of('game:player_disconnected').length, 0);
  assert.equal(t.m.spectatorCount(t.id), 0);
  assert.equal(t.m.isUserOnline('f1'), false);
});

test('a seated player opening ?spectate=1 is a normal player', () => {
  const t = playing('tic-tac-toe');
  const again = new FakeSocket();
  t.m.registerClient(again as any, t.id, U('a'), { spectate: true, canSpectate: true });
  assert.equal(again.of('game:sync')[0].payload.role, 'player');
  assert.equal(t.m.spectatorCount(t.id), 0);
  assert.ok(t.m.isUserOnline('a'));
});

test('spectators never receive secrets: doodle word, bingo boards, tambola tickets / queue', () => {
  // Doodle Duel
  {
    const t = playing('doodle-duel');
    const s = t.watch('f1');
    t.m.handleDoodleStart(t.id, 'a');
    const gs: any = t.get().gameState;
    const drawer = gs.drawerUserId;
    // drive to a drawing round with a secret word
    const mod: any = t.m;
    DoodleDuelEngine.advanceToWordChoice(gs);
    t.db.updateGameRoomState(t.id, gs);
    mod.handleDoodleChooseWord(t.id, drawer, gs.wordChoices[0].word);
    mod.broadcastDoodleState(t.id);
    const st: any = t.get().gameState;
    const word = st.secretWord;
    assert.ok(word, 'a secret word exists');
    assert.ok(!JSON.stringify(s.sent).includes(word), 'spectator saw the doodle secret word');
    // a spectator joining mid-round gets a sync without the word as well
    const late = t.watch('f2');
    assert.ok(!JSON.stringify(late.sent).includes(word));
    mod.stopDoodleTimer(t.id);
  }
  // Bingo Duel + Tambola
  for (const type of ['bingo', 'tambola'] as const) {
    const t = playing(type);
    const s = t.watch('f1');
    if (type === 'tambola') t.m.handleBingoStart(t.id, 'a');
    const gs: any = t.get().gameState;
    assert.ok(gs, type);
    if (type === 'bingo') {
      const turn = gs.currentTurnUserId;
      t.m.handleBingoSelectNumber(t.id, turn, 7);
      t.m.handleBingoMark(t.id, turn, 7);
    } else {
      t.m.tickBingoAutoCall(t.id);
    }
    const late = t.watch('f2'); // joins after secrets exist
    const final: any = t.get().gameState;
    for (const log of [s.sent, late.sent]) {
      const text = JSON.stringify(log);
      for (const other of ['a', 'b']) {
        const secret = type === 'bingo' ? final.boards?.[other] : final.tickets?.[other];
        assert.ok(secret, `${type} secret for ${other}`);
        assert.ok(!text.includes(JSON.stringify(secret)), `${type}: spectator saw ${other}'s board/ticket`);
      }
      assert.ok(!/"callQueue":\[\d/.test(text), `${type}: spectator saw the draw queue`);
    }
    // and the players still get their own
    const mine = JSON.stringify(t.socks.a.sent);
    const own = type === 'bingo' ? final.boards.a : final.tickets.a;
    assert.ok(mine.includes(JSON.stringify(own)), `${type}: player lost their own data`);
    t.m.stopBingoAutoCall(t.id);
  }
});
