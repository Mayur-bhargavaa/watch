import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpoPushToken, pushService, type ExpoMessage } from '../services/pushService.js';

const TOKEN = 'ExponentPushToken[abc_DEF-123]';

function fakeDb(token: string | null | undefined, updates: Array<string | null> = []) {
  return {
    listPushSubscriptions: async () => [],
    deletePushSubscription: async () => undefined,
    getExpoPushToken: async () => token ?? null,
    setExpoPushToken: async (_id: string, t: string | null) => { updates.push(t); }
  } as any;
}

test('only real Expo push tokens are accepted', () => {
  assert.equal(isExpoPushToken(TOKEN), true);
  assert.equal(isExpoPushToken('ExpoPushToken[xyz]'), true);
  assert.equal(isExpoPushToken('https://evil.example/x'), false);
  assert.equal(isExpoPushToken('ExponentPushToken[bad token]'), false);
  assert.equal(isExpoPushToken(undefined), false);
});

test('a message for a user with the mobile app is sent to the phone with the right shape', async () => {
  const sent: ExpoMessage[] = [];
  pushService.setExpoSenderForTests(async (m) => { sent.push(...m); return [{ status: 'ok' }]; });
  const n = await pushService.notifyUser(fakeDb(TOKEN), 'u1', { title: 'Amy', body: 'hello', tag: 'chat:1', url: '/chat?userId=amy' });
  assert.equal(n, 1);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], { to: TOKEN, title: 'Amy', body: 'hello', sound: 'default', priority: 'high', channelId: 'default', ttl: 86400, data: { url: '/chat?userId=amy', tag: 'chat:1' } });
  pushService.setExpoSenderForTests(null);
});

test('nothing is sent when the phone has no token or a foreign one', async () => {
  let calls = 0;
  pushService.setExpoSenderForTests(async () => { calls += 1; return [{ status: 'ok' }]; });
  for (const token of [undefined, null, 'https://x.test', 'ExponentPushToken[bad token]']) {
    assert.equal(await pushService.notifyUser(fakeDb(token), 'u1', { title: 't', body: 'b' }), 0);
  }
  assert.equal(calls, 0);
  pushService.setExpoSenderForTests(null);
});

test('a dead token (app uninstalled) is forgotten, and a failing sender never throws', async () => {
  const updates: any[] = [];
  pushService.setExpoSenderForTests(async () => [{ status: 'error', error: 'DeviceNotRegistered' }]);
  assert.equal(await pushService.notifyUser(fakeDb(TOKEN, updates), 'u1', { title: 't', body: 'b' }), 0);
  assert.deepEqual(updates, [null]);
  pushService.setExpoSenderForTests(async () => { throw new Error('network down'); });
  assert.equal(await pushService.notifyUser(fakeDb(TOKEN), 'u1', { title: 't', body: 'b' }), 0);
  pushService.setExpoSenderForTests(null);
});

test('"only" limits a push to one side: phone only skips browsers, web only skips the phone', async () => {
  const sent: ExpoMessage[] = [];
  pushService.setExpoSenderForTests(async (m) => { sent.push(...m); return [{ status: 'ok' }]; });
  pushService.setSenderForTests(async () => undefined); // browser push switched on, so the browser lookup is reached
  let browserLookups = 0;
  const db = { ...fakeDb(TOKEN), listPushSubscriptions: async () => { browserLookups += 1; return []; } };
  assert.equal(await pushService.notifyUser(db, 'u1', { title: 't', body: 'b', only: 'phone' }), 1);
  assert.equal(browserLookups, 0);
  assert.equal(await pushService.notifyUser(db, 'u1', { title: 't', body: 'b', only: 'web' }), 0);
  assert.equal(sent.length, 1); // the second call never reached the phone
  assert.equal(await pushService.notifyUser(db, 'u1', { title: 't', body: 'b' }), 1);
  assert.equal(browserLookups, 2); // 'web' and the unrestricted call looked at browsers; 'phone' did not
  pushService.setSenderForTests(null);
  pushService.setExpoSenderForTests(null);
});

test('phoneFirst: the phone always gets it, browsers only when the person has no phone app', async () => {
  const sent: ExpoMessage[] = [];
  pushService.setExpoSenderForTests(async (m) => { sent.push(...m); return [{ status: 'ok' }]; });
  pushService.setSenderForTests(async () => undefined);
  let browserLookups = 0;
  const withPhone = { ...fakeDb(TOKEN), listPushSubscriptions: async () => { browserLookups += 1; return []; } };
  const noPhone = { ...fakeDb(null), listPushSubscriptions: async () => { browserLookups += 1; return []; } };
  // website not in use, person has the phone: phone only
  await pushService.notifyUser(withPhone, 'u1', { title: 't', body: 'b', phoneFirst: true });
  assert.equal(sent.length, 1);
  assert.equal(browserLookups, 0);
  // website in use (phoneFirst false): phone AND browsers
  await pushService.notifyUser(withPhone, 'u1', { title: 't', body: 'b', phoneFirst: false });
  assert.equal(sent.length, 2);
  assert.equal(browserLookups, 1);
  // no phone app at all: browsers are used even when the website is not in use
  await pushService.notifyUser(noPhone, 'u1', { title: 't', body: 'b', phoneFirst: true });
  assert.equal(sent.length, 2);
  assert.equal(browserLookups, 2);
  pushService.setSenderForTests(null);
  pushService.setExpoSenderForTests(null);
});

test('a call push uses the loud "calls" channel and expires after 45 seconds', async () => {
  const sent: ExpoMessage[] = [];
  pushService.setExpoSenderForTests(async (m) => { sent.push(...m); return [{ status: 'ok' }]; });
  await pushService.notifyUser(fakeDb(TOKEN), 'u1', { title: 'Amy is calling', body: 'Incoming voice call', tag: 'call:c1', url: '/chat?userId=amy&call=c1', category: 'call', phoneFirst: false });
  assert.equal(sent[0].channelId, 'calls');
  assert.equal(sent[0].ttl, 45);
  assert.equal(sent[0].data.type, 'call');
  pushService.setExpoSenderForTests(null);
});
