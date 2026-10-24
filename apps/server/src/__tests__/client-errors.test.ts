import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fastify from 'fastify';
import { registerClientErrorRoutes } from '../routes/clientErrors.js';
import { MemoryClientErrorSink, cleanReport, fingerprint, scrub } from '../services/clientErrors.js';

const body = (over: any = {}) => ({ message: 'Cannot read property x of undefined', stack: 'TypeError: boom\n at Foo (index.bundle:10:20)\n at Bar (index.bundle:30:5)', where: 'lists/[id]', fatal: false, appVersion: '1.1.0', platform: 'android', osVersion: '14', ...over });

test('scrub removes tokens, emails and long secrets', () => {
  const t = scrub('failed with Bearer abc.def.ghi for a@b.com and eyJhbGciOi.eyJzdWIiOjF9.sig123 key ' + 'A'.repeat(50));
  assert.ok(!/abc\.def|a@b\.com|eyJhbGci|AAAAAAAAAA/.test(t), t);
});

test('cleanReport needs a message, trims size and keeps flags', () => {
  assert.equal(cleanReport({}), null);
  assert.equal(cleanReport(null), null);
  const r = cleanReport(body({ message: 'word '.repeat(2000), stack: 'at foo '.repeat(9000), fatal: true }))!;
  assert.ok(r.message.length >= 499 && r.message.length <= 500);
  assert.equal(r.stack.length, 4000);
  assert.equal(r.fatal, true);
  assert.equal(cleanReport({ message: 'm', fatal: 'yes' })!.fatal, false);
});

test('the same bug gets the same fingerprint, a different one does not', () => {
  const a = cleanReport(body())!;
  const b = cleanReport(body({ stack: a.stack.replace(/:\d+:\d+/g, ':99:99'), message: 'Cannot read property x of undefined' }))!;
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint(cleanReport(body({ message: 'Different failure' }))!));
  assert.notEqual(fingerprint(a), fingerprint(cleanReport(body({ appVersion: '1.2.0' }))!));
});

test('route: open to signed-out callers, groups repeats, reports new bugs once, limits floods', async () => {
  const app = fastify();
  const sink = new MemoryClientErrorSink();
  const fresh: string[] = [];
  await registerClientErrorRoutes(app, { sink, onNew: (_id, s) => fresh.push(s), perMinute: 3, now: () => 5 });
  const post = (payload: any) => app.inject({ method: 'POST', url: '/api/client-errors', payload });
  assert.equal((await post(body())).statusCode, 204);
  assert.equal((await post(body())).statusCode, 204);
  assert.equal(sink.rows.size, 1);
  assert.equal([...sink.rows.values()][0].count, 2);
  assert.equal(fresh.length, 1);
  assert.match(fresh[0], /android 1\.1\.0 @lists/);
  assert.equal((await post({})).statusCode, 400);
  assert.equal((await post(body())).statusCode, 429); // 4th call in the minute
  await app.close();
});

test('route: a body past the size limit is refused', async () => {
  const app = fastify();
  await registerClientErrorRoutes(app, { sink: new MemoryClientErrorSink() });
  const r = await app.inject({ method: 'POST', url: '/api/client-errors', payload: { message: 'x'.repeat(40_000) } });
  assert.equal(r.statusCode, 413);
  await app.close();
});
