import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { registerChatThemeRoutes } from '../routes/chatTheme.js';
import { MemoryChatThemeStore, cleanThemeId } from '../services/chatTheme.js';

async function build() {
  const app = fastify();
  await app.register(fastifyJwt, { secret: 'x'.repeat(32) });
  const store = new MemoryChatThemeStore();
  const told: any[] = [];
  const friends = [['a', 'b']];
  await registerChatThemeRoutes(app, {
    store, now: () => 7,
    areConnected: async (x, y) => friends.some(([p, q]) => (p === x && q === y) || (p === y && q === x)),
    convId: (x, y) => [x, y].sort().join('_'),
    tell: (ids, payload) => told.push({ ids, payload }),
  });
  const h = (id: string, extra: any = {}) => ({ authorization: `Bearer ${app.jwt.sign({ id, isAnonymous: false, ...extra })}` });
  return { app, store, told, h };
}

test('theme ids: a short lowercase name, null or "default" clears, anything else is refused', () => {
  assert.equal(cleanThemeId('ocean'), 'ocean');
  assert.equal(cleanThemeId('golden-hour'), 'golden-hour');
  assert.equal(cleanThemeId(null), null);
  assert.equal(cleanThemeId('default'), null);
  for (const bad of ['', 'A', 'Ocean', '1x', 'x'.repeat(40), 'a b', '<b>', 5, undefined, {}]) assert.equal(cleanThemeId(bad), undefined, String(bad));
});

test('routes: sign-in required, friends only', async () => {
  const { app, h } = await build();
  for (const headers of [{}, { authorization: 'Bearer nope' }, h('g', { isAnonymous: true })]) {
    assert.equal((await app.inject({ url: '/api/chat/theme?userId=b', headers: headers as any })).statusCode, 401);
    assert.equal((await app.inject({ method: 'PUT', url: '/api/chat/theme', headers: headers as any, payload: { userId: 'b', themeId: 'ocean' } })).statusCode, 401);
  }
  assert.equal((await app.inject({ method: 'PUT', url: '/api/chat/theme', headers: h('a'), payload: { userId: 'stranger', themeId: 'ocean' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/chat/theme?userId=stranger', headers: h('a') })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/chat/theme', headers: h('a'), payload: { userId: 'a', themeId: 'ocean' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/chat/theme', headers: h('a'), payload: { userId: 'b', themeId: 'Bad Theme' } })).statusCode, 400);
  await app.close();
});

test('routes: one person sets it, both read it and both are told live; clearing works', async () => {
  const { app, h, told, store } = await build();
  const put = await app.inject({ method: 'PUT', url: '/api/chat/theme', headers: h('a'), payload: { userId: 'b', themeId: 'ocean' } });
  assert.equal(put.statusCode, 200);
  assert.deepEqual(told[0], { ids: ['a', 'b'], payload: { type: 'chat:theme', conversationId: 'a_b', themeId: 'ocean', by: 'a', users: ['a', 'b'] } });
  assert.deepEqual((await app.inject({ url: '/api/chat/theme?userId=a', headers: h('b') })).json(), { themeId: 'ocean', setBy: 'a' });
  assert.deepEqual((await app.inject({ url: '/api/chat/theme?userId=b', headers: h('a') })).json(), { themeId: 'ocean', setBy: 'a' });
  await app.inject({ method: 'PUT', url: '/api/chat/theme', headers: h('b'), payload: { userId: 'a', themeId: 'default' } });
  assert.equal(store.rows.size, 0);
  assert.deepEqual((await app.inject({ url: '/api/chat/theme?userId=b', headers: h('a') })).json(), { themeId: null, setBy: null });
  assert.equal(told[1].payload.themeId, null);
  await app.close();
});
