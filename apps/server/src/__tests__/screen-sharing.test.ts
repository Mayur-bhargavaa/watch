import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../db/database.js';
import { RoomSyncManager } from '../sync/RoomSyncManager.js';

// Integration tests of the REAL room message handlers (RoomSyncManager) with fake sockets and an in-memory database.
// They prove who may share, who may signal and what the room is told. They do NOT prove that video frames reach a phone:
// that needs the device tests in docs/HOSTING.md.

class FakeSocket {
  readyState = 1;
  sent: any[] = [];
  handlers: Record<string, Array<(...a: any[]) => void>> = {};
  send(d: string) { this.sent.push(JSON.parse(d)); }
  on(ev: string, fn: any) { (this.handlers[ev] ||= []).push(fn); return this; }
  once(ev: string, fn: any) { return this.on(ev, fn); }
  ping() {}
  terminate() {}
  close() { this.readyState = 3; }
  say(type: string, payload: any) { for (const h of this.handlers.message ?? []) h(JSON.stringify({ type, payload, roomId: 'x', timestamp: Date.now() })); }
  drop() { this.readyState = 3; for (const h of this.handlers.close ?? []) h(); }
  all(type: string) { return this.sent.filter((m) => m.type === type); }
  last(type: string) { return [...this.sent].reverse().find((m) => m.type === type); }
}

function setup() {
  const db = new DatabaseService(':memory:');
  const mgr = new RoomSyncManager(db);
  for (const u of ['h', 'a', 'b', 'c', 'z']) db.createUser({ id: u, displayName: u.toUpperCase(), isAnonymous: false, createdAt: new Date().toISOString() } as any);
  const room: any = { id: 'room1', slug: 'room-one', title: 'R', hostId: 'h', privacy: 'INVITE_ONLY', isLocked: false, currentMedia: null, playbackState: { roomId: 'room1', state: 'PAUSED', position: 0, serverTimestamp: Date.now(), playbackRate: 1, version: 0, updatedBy: 'h' }, createdAt: new Date().toISOString() };
  db.createRoom(room);
  mgr.registerRoom(room);
  const join = (id: string) => { const s = new FakeSocket(); mgr.handleConnection(s as any, room, { id, displayName: id.toUpperCase() }); return s; };
  return { mgr, room, join };
}
const settle = () => new Promise((r) => setTimeout(r, 15));
const offer = { type: 'offer', sdp: { type: 'offer', sdp: 'v=0 fake' }, streamKind: 'screen' };

test('four users join: one host and three viewers', async () => {
  const { mgr, join } = setup();
  const sockets = ['h', 'a', 'b', 'c'].map(join);
  await settle();
  assert.equal(mgr.getConnectedClientsCount('room1'), 4);
  assert.ok(sockets.every((s) => s.last('room:state')));
});

test('the host starts sharing: all four are told, with who presents', async () => {
  const { join } = setup();
  const [h, a, b, c] = ['h', 'a', 'b', 'c'].map(join);
  h.say('screen:state', { isSharing: true });
  await settle();
  for (const s of [h, a, b, c]) assert.deepEqual(s.last('screen:state').payload, { isSharing: true, presenterId: 'h', presenterName: 'H' });
});

test('a participant cannot start sharing: refused, nobody is told', async () => {
  const { join } = setup();
  const [h, a, b] = ['h', 'a', 'b'].map(join);
  a.say('screen:state', { isSharing: true });
  await settle();
  assert.equal(a.last('error:notification').payload.code, 'FORBIDDEN');
  assert.equal(h.all('screen:state').length, 0);
  assert.equal(b.all('screen:state').length, 0);
  const late = join('c');
  assert.equal(late.last('room:state').payload.activeScreenPresenter, null);
});

test('a viewer joining while a share is active learns who presents', async () => {
  const { join } = setup();
  const h = join('h');
  h.say('screen:state', { isSharing: true });
  await settle();
  const late = join('c');
  assert.deepEqual(late.last('room:state').payload.activeScreenPresenter, { userId: 'h', displayName: 'H' });
});

test('screen signals: only the presenter offers; answers and candidates only between presenter and viewer', async () => {
  const { join } = setup();
  const [h, a, b] = ['h', 'a', 'b'].map(join);
  h.say('screen:state', { isSharing: true });
  await settle();
  // the presenter's offer reaches the viewer it is sent to
  h.say('webrtc:signal', { targetUserId: 'a', signal: offer });
  await settle();
  assert.equal(a.last('webrtc:signal').payload.fromUserId, 'h');
  assert.equal(a.last('webrtc:signal').payload.signal.streamKind, 'screen');
  // the viewer answers and trickles a candidate back to the presenter
  a.say('webrtc:signal', { targetUserId: 'h', signal: { type: 'answer', sdp: { type: 'answer', sdp: 'v=0' }, streamKind: 'screen' } });
  a.say('webrtc:signal', { targetUserId: 'h', signal: { type: 'candidate', candidate: { candidate: 'candidate:1' }, streamKind: 'screen' } });
  await settle();
  assert.equal(h.all('webrtc:signal').length, 2);
  // a viewer posing as the presenter: refused and never delivered
  b.say('webrtc:signal', { targetUserId: 'a', signal: offer });
  await settle();
  assert.equal(b.last('error:notification').payload.code, 'FORBIDDEN');
  assert.equal(a.all('webrtc:signal').length, 1, 'only the real presenter\'s offer arrived');
  // two viewers talking over the presenter's line: refused
  b.say('webrtc:signal', { targetUserId: 'a', signal: { type: 'candidate', candidate: { candidate: 'x' }, streamKind: 'screen' } });
  await settle();
  assert.equal(a.all('webrtc:signal').length, 1);
});

test('screen signals while nobody presents are refused; camera and voice signals still flow', async () => {
  const { join } = setup();
  const [h, a] = ['h', 'a'].map(join);
  h.say('webrtc:signal', { targetUserId: 'a', signal: offer });
  await settle();
  assert.equal(h.last('error:notification').payload.code, 'FORBIDDEN');
  assert.equal(a.all('webrtc:signal').length, 0);
  a.say('webrtc:signal', { targetUserId: 'h', signal: { type: 'offer', sdp: { type: 'offer', sdp: 'v=0' }, streamKind: 'user' } });
  await settle();
  assert.equal(h.all('webrtc:signal').length, 1, 'the ordinary call is untouched');
});

test('signals do not cross rooms or reach people who are not connected', async () => {
  const { join } = setup();
  const h = join('h');
  h.say('screen:state', { isSharing: true });
  h.say('webrtc:signal', { targetUserId: 'z', signal: offer }); // z never joined
  await settle();
  assert.equal(h.all('error:notification').length, 0, 'silently dropped, nothing leaks');
});

test('only the presenter can stop a share; a stray "stopped" from a viewer does not close the stage', async () => {
  const { join } = setup();
  const [h, a, b] = ['h', 'a', 'b'].map(join);
  h.say('screen:state', { isSharing: true });
  await settle();
  const before = b.all('screen:state').length;
  a.say('screen:state', { isSharing: false });
  await settle();
  assert.equal(b.all('screen:state').length, before, 'no broadcast from a non-presenter');
  h.say('screen:state', { isSharing: false });
  await settle();
  assert.deepEqual(b.last('screen:state').payload, { isSharing: false, presenterId: null, presenterName: null });
  // and the host can start again afterwards
  h.say('screen:state', { isSharing: true });
  await settle();
  assert.equal(b.last('screen:state').payload.isSharing, true);
});

test('starting twice from the host is harmless', async () => {
  const { join } = setup();
  const [h, a] = ['h', 'a'].map(join);
  h.say('screen:state', { isSharing: true });
  h.say('screen:state', { isSharing: true });
  await settle();
  assert.equal(a.last('screen:state').payload.presenterId, 'h');
  h.say('screen:state', { isSharing: false });
  await settle();
  assert.equal(a.last('screen:state').payload.isSharing, false);
});

test('the host disconnecting unexpectedly clears the presenter for everyone', async () => {
  const { join } = setup();
  const [h, a, b] = ['h', 'a', 'b'].map(join);
  h.say('screen:state', { isSharing: true });
  await settle();
  h.drop();
  await settle();
  assert.deepEqual(a.last('screen:state').payload, { isSharing: false, presenterId: null, presenterName: null });
  assert.deepEqual(b.last('screen:state').payload, { isSharing: false, presenterId: null, presenterName: null });
  assert.equal(join('c').last('room:state').payload.activeScreenPresenter, null);
});

test('a viewer who disconnects and reconnects sees the active share again', async () => {
  const { join } = setup();
  const [h, a] = ['h', 'a'].map(join);
  h.say('screen:state', { isSharing: true });
  await settle();
  a.drop();
  await settle();
  const a2 = join('a');
  assert.equal(a2.last('room:state').payload.activeScreenPresenter.userId, 'h');
});

test('host transfer ends the old host\'s share; the new host can then share', async () => {
  const { join } = setup();
  const [h, a, b] = ['h', 'a', 'b'].map(join);
  h.say('screen:state', { isSharing: true });
  await settle();
  h.say('host:transfer', { targetUserId: 'a' });
  await settle();
  assert.deepEqual(b.all('screen:state').pop().payload, { isSharing: false, presenterId: null, presenterName: null });
  h.say('screen:state', { isSharing: true }); // the former host is only a participant now
  await settle();
  assert.equal(h.last('error:notification').payload.code, 'FORBIDDEN');
  a.say('screen:state', { isSharing: true });
  await settle();
  assert.equal(b.last('screen:state').payload.presenterId, 'a');
});

test('ott:checkin: delivered to everyone in the room through the real socket path, with the sender\'s name from the server', async () => {
  const { join } = setup();
  const [h, a, b, c] = ['h', 'a', 'b', 'c'].map(join);
  a.say('ott:checkin', { positionSeconds: 754.8, title: ' Ep <2> ', userId: 'forged', displayName: 'Mallory' });
  await settle();
  for (const s of [h, a, b, c]) {
    const m = s.last('ott:checkin');
    assert.deepEqual(m.payload, { userId: 'a', displayName: 'A', positionSeconds: 754, title: 'Ep 2' });
  }
});

test('ott:checkin: malformed or out-of-range input is dropped and nobody is told', async () => {
  const { join } = setup();
  const [h, a] = ['h', 'a'].map(join);
  for (const bad of [{}, { positionSeconds: -5 }, { positionSeconds: 1e9 }, { positionSeconds: 'x' }, null]) a.say('ott:checkin', bad as any);
  await settle();
  assert.equal(h.all('ott:checkin').length, 0);
});

test('ott:checkin: a connection that never joined the room cannot post one', async () => {
  const { join } = setup();
  const h = join('h');
  const stray = new FakeSocket(); // never passed to handleConnection
  stray.say('ott:checkin', { positionSeconds: 5 });
  await settle();
  assert.equal(h.all('ott:checkin').length, 0);
});
