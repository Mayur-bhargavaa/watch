import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { registerListRoutes } from '../routes/lists.js';
import { MemorySharedListStore, addItem, createList, leaveList, ranked, toggleVote, type SharedList } from '../services/sharedLists.js';

const snap = (n: number) => ({ titleKey: `tmdb:movie:${n}`, title: `Movie ${n}`, posterPath: null, year: 2020, mediaType: 'movie' as const });

test('pure rules: add counts as a vote, vote toggles, ranking, leaving', () => {
  let l = (createList('a', ' Friday  night ', ['b', 'b', 'a', 'c'], 1, 'l1') as any).list as SharedList;
  assert.equal(l.name, 'Friday night');
  assert.deepEqual(l.memberIds, ['a', 'b', 'c']);
  l = (addItem(l, 'a', snap(1), 10) as any).list;
  l = (addItem(l, 'b', snap(2), 11) as any).list;
  assert.equal((addItem(l, 'b', snap(2), 12) as any).status, 409);
  assert.equal((addItem(l, 'zed', snap(3), 12) as any).status, 403);
  l = (toggleVote(l, 'c', 'tmdb:movie:2') as any).list;
  assert.deepEqual(ranked(l).map((i) => i.titleKey), ['tmdb:movie:2', 'tmdb:movie:1']); // 2 has two votes
  const before = JSON.stringify(l);
  l = (toggleVote(l, 'c', 'tmdb:movie:2') as any).list;
  assert.deepEqual(ranked(l).map((i) => i.titleKey), ['tmdb:movie:1', 'tmdb:movie:2']); // tie keeps the added order
  assert.notEqual(JSON.stringify(l), before);
  const left = (leaveList(l, 'a') as any).list as SharedList; // owner leaves: b takes over, a's votes go
  assert.equal(left.ownerId, 'b');
  assert.ok(left.items.every((i) => !i.votes.includes('a')));
  assert.equal((createList('a', '  ', [], 1) as any).status, 400);
  assert.equal((createList('a', 'x', Array.from({ length: 8 }, (_, i) => `f${i}`), 1) as any).status, 400);
  let solo = (createList('a', 'x', [], 1, 'l2') as any).list;
  assert.equal((leaveList(solo, 'a') as any).list, null);
});

async function build(friends: Array<[string, string]> = [['a', 'b'], ['a', 'c']]) {
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const store = new MemorySharedListStore();
  const notes: any[] = [];
  const isF = async (x: string, y: string) => friends.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  await registerListRoutes(app, { store, areFriends: isF, notify: (ids, n) => notes.push({ ids, ...n }), now: () => 1000 });
  const h = (id: string, extra: any = {}) => ({ authorization: `Bearer ${app.jwt.sign({ id, displayName: id.toUpperCase(), isAnonymous: false, ...extra })}` });
  return { app, store, notes, h };
}

test('routes: auth required, friends only, members only', async () => {
  const { app, h } = await build();
  for (const [method, url] of [['GET', '/api/lists'], ['POST', '/api/lists'], ['GET', '/api/lists/x'], ['POST', '/api/lists/x/items'], ['POST', '/api/lists/x/leave']] as const) {
    for (const headers of [{}, { authorization: 'Bearer nope' }, h('g', { isAnonymous: true })]) {
      assert.equal((await app.inject({ method, url, headers: headers as any, payload: {} })).statusCode, 401, `${method} ${url}`);
    }
  }
  const notFriend = await app.inject({ method: 'POST', url: '/api/lists', headers: h('a'), payload: { name: 'L', memberIds: ['stranger'] } });
  assert.equal(notFriend.statusCode, 403);
  const made = await app.inject({ method: 'POST', url: '/api/lists', headers: h('a'), payload: { name: 'L', memberIds: ['b'] } });
  assert.equal(made.statusCode, 201);
  const id = made.json().list.id;
  // an outsider cannot see or change it, and cannot tell it exists
  for (const r of [await app.inject({ url: `/api/lists/${id}`, headers: h('c') }), await app.inject({ method: 'POST', url: `/api/lists/${id}/items`, headers: h('c'), payload: { ...snap(1) } }), await app.inject({ method: 'POST', url: `/api/lists/${id}/leave`, headers: h('c') })]) {
    assert.equal(r.statusCode, 404);
  }
  assert.deepEqual((await app.inject({ url: '/api/lists', headers: h('c') })).json().lists, []);
  await app.close();
});

test('routes: add, vote, remove, add member, leave, with pushes to the others', async () => {
  const { app, h, notes } = await build();
  const id = (await app.inject({ method: 'POST', url: '/api/lists', headers: h('a'), payload: { name: 'L', memberIds: ['b'] } })).json().list.id;
  assert.deepEqual(notes[0].ids, ['b']);
  const add = (n: number, who = 'a') => app.inject({ method: 'POST', url: `/api/lists/${id}/items`, headers: h(who), payload: snap(n) });
  assert.equal((await add(1)).statusCode, 201);
  assert.deepEqual(notes[1].ids, ['b']);
  assert.equal((await add(1)).statusCode, 409);
  assert.equal((await app.inject({ method: 'POST', url: `/api/lists/${id}/items`, headers: h('a'), payload: { ...snap(2), titleKey: 'bad key' } })).statusCode, 400);
  assert.equal((await add(2, 'b')).statusCode, 201);
  const voted = (await app.inject({ method: 'POST', url: `/api/lists/${id}/items/tmdb:movie:2/vote`, headers: h('a') })).json().list;
  assert.deepEqual(voted.items.map((i: any) => [i.titleKey, i.voteCount, i.voted]), [['tmdb:movie:2', 2, true], ['tmdb:movie:1', 1, true]]);
  // only the adder or the owner removes; b cannot remove a's title, a (owner) can remove b's
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/lists/${id}/items/tmdb:movie:1`, headers: h('b') })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/lists/${id}/items/tmdb:movie:2`, headers: h('a') })).statusCode, 200);
  // add a friend; only the owner, and only a friend
  assert.equal((await app.inject({ method: 'POST', url: `/api/lists/${id}/members`, headers: h('b'), payload: { userId: 'c' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: `/api/lists/${id}/members`, headers: h('a'), payload: { userId: 'zed' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: `/api/lists/${id}/members`, headers: h('a'), payload: { userId: 'c' } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/lists/${id}/leave`, headers: h('c') })).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/lists', headers: h('c') })).json().lists, []);
  await app.close();
});

test('concurrent saves never lose a change', async () => {
  const { app, h } = await build();
  const id = (await app.inject({ method: 'POST', url: '/api/lists', headers: h('a'), payload: { name: 'L', memberIds: ['b', 'c'] } })).json().list.id;
  const rs = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => app.inject({ method: 'POST', url: `/api/lists/${id}/items`, headers: h(['a', 'b', 'c'][n % 3]), payload: snap(n) })));
  assert.ok(rs.every((r) => r.statusCode === 201), rs.map((r) => r.statusCode).join());
  assert.equal((await app.inject({ url: `/api/lists/${id}`, headers: h('a') })).json().list.items.length, 6);
  await app.close();
});
