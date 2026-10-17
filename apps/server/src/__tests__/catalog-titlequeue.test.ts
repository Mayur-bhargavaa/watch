import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_TITLE_STATE, TITLE_QUEUE_MAX, type TitleRoomState } from '@synccinema/common';
import { applyTitleAction, type TitleActor } from '../sync/titleQueue.js';
import { ROOM_PAYLOAD_SCHEMAS } from '../sync/schemas.js';
import { RoomSyncManager } from '../sync/RoomSyncManager.js';
import { DatabaseService } from '../db/database.js';

const host: TitleActor = { userId: 'h', displayName: 'Host', isHost: true, isMember: true };
const alice: TitleActor = { userId: 'a', displayName: 'Alice', isHost: false, isMember: true };
const bob: TitleActor = { userId: 'b', displayName: 'Bob', isHost: false, isMember: true };
const stranger: TitleActor = { userId: 's', displayName: 'Stranger', isHost: false, isMember: false };
const snap = (n: number) => ({ titleKey: `tmdb:movie:${n}`, title: `Movie ${n}`, posterPath: '/p.jpg', year: 2020, mediaType: 'movie' as const });
const propose = (n: number) => ({ type: 'room:title_propose' as const, payload: { titleKey: `tmdb:movie:${n}`, snapshot: snap(n) } });
const ctx = { now: 1_000_000 };
const run = (s: TitleRoomState, a: any, who: TitleActor, c: any = ctx) => applyTitleAction(s, a, who, c);

test('propose: member adds a title, proposer auto-votes, version bumps', () => {
  const r = run(EMPTY_TITLE_STATE, propose(1), alice);
  assert.ok(r.ok);
  assert.equal(r.state.version, 1);
  assert.equal(r.state.queue[0].proposedBy.userId, 'a');
  assert.deepEqual(r.state.queue[0].votes, ['a']);
});

test('propose: queue holds at most 5 titles; a re-proposal is just a vote', () => {
  let s = EMPTY_TITLE_STATE;
  for (let i = 1; i <= TITLE_QUEUE_MAX; i++) s = run(s, propose(i), alice).state;
  assert.equal(s.queue.length, 5);
  const full = run(s, propose(6), bob);
  assert.equal(full.ok, false);
  assert.equal(full.code, 'QUEUE_FULL');
  assert.equal(full.state, s);
  const again = run(s, propose(1), bob);
  assert.ok(again.ok);
  assert.deepEqual(again.state.queue[0].votes, ['a', 'b']);
  assert.equal(run(again.state, propose(1), bob).state, again.state, 'no change, no version bump');
});

test('propose rejects bad keys, mismatched snapshots, non-members', () => {
  assert.equal(run(EMPTY_TITLE_STATE, { type: 'room:title_propose', payload: { titleKey: 'x', snapshot: snap(1) } }, alice).code, 'INVALID_TITLE');
  assert.equal(run(EMPTY_TITLE_STATE, { type: 'room:title_propose', payload: { titleKey: 'tmdb:movie:2', snapshot: snap(1) } }, alice).code, 'INVALID_TITLE');
  assert.equal(run(EMPTY_TITLE_STATE, propose(1), stranger).code, 'NOT_MEMBER');
});

test('vote: one vote per member per title (second vote withdraws), unknown title rejected, non-member rejected', () => {
  let s = run(EMPTY_TITLE_STATE, propose(1), alice).state;
  s = run(s, { type: 'room:title_vote', payload: { titleKey: 'tmdb:movie:1' } }, bob).state;
  assert.deepEqual(s.queue[0].votes, ['a', 'b']);
  s = run(s, { type: 'room:title_vote', payload: { titleKey: 'tmdb:movie:1' } }, bob).state;
  assert.deepEqual(s.queue[0].votes, ['a']);
  assert.equal(run(s, { type: 'room:title_vote', payload: { titleKey: 'tmdb:movie:9' } }, bob).code, 'NOT_FOUND');
  assert.equal(run(s, { type: 'room:title_vote', payload: { titleKey: 'tmdb:movie:1' } }, stranger).code, 'NOT_MEMBER');
});

test('confirm: host only; moves the title out of the queue and records provider + start time', () => {
  const s = run(EMPTY_TITLE_STATE, propose(1), alice).state;
  const denied = run(s, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:1' } }, alice);
  assert.equal(denied.code, 'FORBIDDEN');
  const ok = run(s, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:1', provider: { id: '203', name: 'Netflix' }, startAt: ctx.now + 60_000 } }, host, { ...ctx, destinationUrl: 'https://www.netflix.com/title/1' });
  assert.ok(ok.ok);
  const sel = ok.state.selected!;
  assert.equal(sel.destinationUrl, 'https://www.netflix.com/title/1');
  assert.deepEqual(sel.capabilities, { playback: 'none', roomSync: 'coordinated_start' });
  assert.equal(sel.startAt, ctx.now + 60_000);
  assert.equal(ok.state.queue.length, 0);
  assert.equal(ok.state.selectionVersion, ok.state.version);
});

test('confirm: no provider means no link; bad start times rejected; any title can be confirmed with a snapshot', () => {
  const noProvider = run(EMPTY_TITLE_STATE, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:5', snapshot: snap(5) } }, host, { ...ctx, destinationUrl: 'https://x.example.com/1' });
  assert.ok(noProvider.ok);
  assert.equal(noProvider.state.selected!.destinationUrl, null, 'a link never exists without a provider');
  for (const startAt of [ctx.now - 60_000, ctx.now + 3 * 3600_000, NaN as any]) {
    assert.equal(run(EMPTY_TITLE_STATE, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:5', snapshot: snap(5), startAt } }, host).code, 'BAD_START_TIME');
  }
  assert.equal(run(EMPTY_TITLE_STATE, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:5' } }, host).code, 'INVALID_TITLE');
  assert.equal(capsOf(run(EMPTY_TITLE_STATE, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:5', snapshot: snap(5), provider: { id: '140', name: 'YouTube' } } }, host)).playback, 'embedded');
});
const capsOf = (r: any) => r.state.selected.capabilities;

test('stale events are ignored using the version counter', () => {
  let s = run(EMPTY_TITLE_STATE, propose(1), alice).state;
  s = run(s, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:1', version: s.version } }, host).state; // selectionVersion = 2
  const sel = s.selectionVersion;
  const staleConfirm = run(s, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:1', snapshot: snap(1), version: sel - 1 } }, host);
  assert.equal(staleConfirm.code, 'STALE_TITLE_STATE');
  assert.equal(staleConfirm.state, s);
  assert.equal(run(s, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:1', version: sel - 1 } }, alice).code, 'STALE_TITLE_STATE');
  assert.equal(run(s, { type: 'room:title_clear', payload: { version: sel - 1 } }, host).code, 'STALE_TITLE_STATE');
  assert.ok(run(s, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:1', version: sel } }, alice).ok);
  // votes after confirm bump version but must not make a host confirm "stale"
  const afterVote = run(s, propose(2), bob).state;
  assert.ok(run(afterVote, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:2', version: sel } }, host).ok);
});

test('ready: members mark themselves once, only for the selected title; clear is host only', () => {
  let s = run(EMPTY_TITLE_STATE, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:1', snapshot: snap(1) } }, host).state;
  assert.equal(run(s, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:2' } }, alice).code, 'STALE_TITLE_STATE');
  assert.equal(run(s, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:1' } }, stranger).code, 'NOT_MEMBER');
  s = run(s, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:1' } }, alice).state;
  const dup = run(s, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:1' } }, alice);
  assert.equal(dup.state, s);
  assert.deepEqual(s.selected!.ready, ['a']);
  assert.equal(run(s, { type: 'room:title_clear', payload: {} }, alice).code, 'FORBIDDEN');
  const cleared = run(s, { type: 'room:title_clear', payload: {} }, host);
  assert.equal(cleared.state.selected, null);
  assert.equal(run(EMPTY_TITLE_STATE, { type: 'room:title_ready', payload: { titleKey: 'tmdb:movie:1' } }, alice).code, 'NOTHING_SELECTED');
});

test('reducer never mutates the previous state', () => {
  const s = run(EMPTY_TITLE_STATE, propose(1), alice).state;
  const frozen = JSON.stringify(s);
  run(s, { type: 'room:title_vote', payload: { titleKey: 'tmdb:movie:1' } }, bob);
  run(s, { type: 'room:title_confirm', payload: { titleKey: 'tmdb:movie:1' } }, host);
  assert.equal(JSON.stringify(s), frozen);
});

test('websocket schemas: unknown fields, oversized and bad payloads are rejected', () => {
  const sch = ROOM_PAYLOAD_SCHEMAS;
  assert.ok(sch['room:title_propose'].safeParse({ titleKey: 'tmdb:movie:1', snapshot: snap(1) }).success);
  assert.equal(sch['room:title_propose'].safeParse({ titleKey: 'tmdb:movie:1', snapshot: snap(1), evil: 1 }).success, false);
  assert.equal(sch['room:title_propose'].safeParse({ titleKey: 'tmdb:movie:1', snapshot: { ...snap(1), title: 'x'.repeat(5000) } }).success, false);
  assert.equal(sch['room:title_propose'].safeParse({ titleKey: 'x'.repeat(500), snapshot: snap(1) }).success, false);
  assert.equal(sch['room:title_vote'].safeParse({}).success, false);
  assert.equal(sch['room:title_confirm'].safeParse({ titleKey: 'tmdb:movie:1', startAt: 'soon' }).success, false);
  assert.equal(sch['room:title_confirm'].safeParse({ titleKey: 'tmdb:movie:1', provider: { id: 'a', name: 'b', url: 'javascript:1' } }).success, false);
  assert.equal(sch['room:title_clear'].safeParse({ version: -1 }).success, false);
});

// ---- RoomSyncManager integration (fake sockets, in-memory SQLite) ------------------------------------------------------
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
  last(type: string) { return [...this.sent].reverse().find((m) => m.type === type); }
}
function setup() {
  const db = new DatabaseService(':memory:');
  const mgr = new RoomSyncManager(db);
  const mkUser = (id: string) => ({ id, displayName: id.toUpperCase() });
  for (const u of ['h', 'a', 'b']) db.createUser({ id: u, displayName: u.toUpperCase(), isAnonymous: false, createdAt: new Date().toISOString() } as any);
  const room: any = { id: 'room1', slug: 'room-one', title: 'R', hostId: 'h', privacy: 'INVITE_ONLY', isLocked: false, currentMedia: null, playbackState: { roomId: 'room1', state: 'PAUSED', position: 0, serverTimestamp: Date.now(), playbackRate: 1, version: 0, updatedBy: 'h' }, createdAt: new Date().toISOString() };
  db.createRoom(room);
  mgr.registerRoom(room);
  const join = (id: string) => { const s = new FakeSocket(); mgr.handleConnection(s as any, room, mkUser(id)); return s; };
  return { db, mgr, room, join, mkUser };
}
const settle = () => new Promise((r) => setTimeout(r, 15));

test('room: member proposes, everyone gets the state; host-only confirm; forged confirm by a guest rejected', async () => {
  const { mgr, join } = setup();
  const h = join('h'), a = join('a'), b = join('b');
  a.say('room:title_propose', { titleKey: 'tmdb:movie:1', snapshot: snap(1) });
  await settle();
  for (const s of [h, a, b]) assert.equal(s.last('room:title_state').payload.state.queue.length, 1);
  b.say('room:title_vote', { titleKey: 'tmdb:movie:1' });
  await settle();
  assert.deepEqual(h.last('room:title_state').payload.state.queue[0].votes, ['a', 'b']);
  a.say('room:title_confirm', { titleKey: 'tmdb:movie:1' }); // a guest forging a host action
  await settle();
  assert.equal(a.last('error:notification').payload.code, 'FORBIDDEN');
  assert.equal(mgr.getTitleState('room1').selected, null);
  h.say('room:title_confirm', { titleKey: 'tmdb:movie:1', provider: { id: '203', name: 'Netflix' } });
  await settle();
  const st = h.last('room:title_state').payload.state;
  assert.equal(st.selected.titleKey, 'tmdb:movie:1');
  assert.equal(st.selected.destinationUrl, null, 'no resolver configured: no link');
  // confirming a title never issues playback commands
  assert.equal(h.sent.filter((m) => m.type === 'playback:update' || m.type === 'media:updated').length, 0);
});

test('room: link only when the catalog resolver returns one', async () => {
  const { mgr, join } = setup();
  mgr.setTitleLinkResolver(async (k, p) => (p === '203' ? 'https://www.netflix.com/title/1' : null));
  const h = join('h');
  h.say('room:title_confirm', { titleKey: 'tmdb:movie:1', snapshot: snap(1), provider: { id: '203', name: 'Netflix' } });
  await settle();
  assert.equal(h.last('room:title_state').payload.state.selected.destinationUrl, 'https://www.netflix.com/title/1');
  mgr.setTitleLinkResolver(async () => { throw new Error('boom'); });
  h.say('room:title_confirm', { titleKey: 'tmdb:movie:2', snapshot: snap(2), provider: { id: '203', name: 'Netflix' } });
  await settle();
  assert.equal(h.last('room:title_state').payload.state.selected.destinationUrl, null);
});

test('room: oversized or unknown payloads are rejected by the router', async () => {
  const { mgr, join } = setup();
  const a = join('a');
  a.say('room:title_propose', { titleKey: 'tmdb:movie:1', snapshot: { ...snap(1), title: 'x'.repeat(10_000) } });
  a.say('room:title_vote', { titleKey: 'tmdb:movie:1', extra: true });
  await settle();
  assert.equal(a.sent.filter((m) => m.type === 'error:notification' && m.payload.code === 'INVALID_PAYLOAD').length, 2);
  assert.equal(mgr.getTitleState('room1').queue.length, 0);
});

test('room: reconnect snapshot carries the full title state; stale sender gets the authoritative state back', async () => {
  const { mgr, join } = setup();
  const h = join('h');
  const a = join('a');
  a.say('room:title_propose', { titleKey: 'tmdb:movie:1', snapshot: snap(1) });
  h.say('room:title_confirm', { titleKey: 'tmdb:movie:1' });
  await settle();
  const a2 = join('a'); // reconnect
  const snapshot = a2.last('room:state').payload;
  assert.equal(snapshot.titleState.selected.titleKey, 'tmdb:movie:1');
  assert.equal(snapshot.titleState.version, mgr.getTitleState('room1').version);
  h.say('room:title_confirm', { titleKey: 'tmdb:movie:2', snapshot: snap(2), version: 0 }); // stale host tab
  await settle();
  assert.equal(h.last('error:notification').payload.code, 'STALE_TITLE_STATE');
  assert.equal(h.last('room:title_state').payload.state.selected.titleKey, 'tmdb:movie:1');
  assert.equal(mgr.getTitleState('room1').selected!.titleKey, 'tmdb:movie:1');
});

test('room REST twin: non-members are rejected, members and host follow the same rules', async () => {
  const { mgr, room } = setup();
  const outsider = await mgr.applyTitleActionForUser('room-one', { id: 'zz', displayName: 'Z' }, { type: 'room:title_propose', payload: { titleKey: 'tmdb:movie:1', snapshot: snap(1) } });
  assert.equal(outsider.code, 'NOT_MEMBER');
  assert.equal(mgr.titleStateForUser('room-one', 'zz'), null);
  const hostRes = await mgr.applyTitleActionForUser('room-one', { id: 'h', displayName: 'H' }, { type: 'room:title_propose', payload: { titleKey: 'tmdb:movie:1', snapshot: snap(1) } });
  assert.ok(hostRes.ok);
  assert.equal(mgr.titleStateForUser('room-one', 'h')!.queue.length, 1);
  assert.equal((await mgr.applyTitleActionForUser('nope', { id: 'h', displayName: 'H' }, { type: 'room:title_clear', payload: {} })).roomFound, false);
  void room;
});
