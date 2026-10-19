import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityTracker, IS_PASSIVE_REQUEST, WEB_ACTIVE_WINDOW_MS, CHAT_OPEN_WINDOW_MS, platformOf } from '../services/activityTracker.js';

test('the website counts as in use only after the person DID something there, and only for 15 minutes', () => {
  let t = 1_000_000;
  const a = new ActivityTracker(() => t);
  assert.equal(a.webActive('u'), false); // nothing known
  a.touch('u', 'app'); // the phone's activity never matters: it always gets notifications
  assert.equal(a.webActive('u'), false);
  a.touch('u', 'web');
  assert.equal(a.webActive('u'), true);
  t += WEB_ACTIVE_WINDOW_MS - 1;
  assert.equal(a.webActive('u'), true);
  t += 2;
  assert.equal(a.webActive('u'), false);
  assert.equal(a.webActive('someone-else'), false);
});

test('a conversation fetched a moment ago is open; it closes after a few seconds', () => {
  let t = 5_000;
  const a = new ActivityTracker(() => t);
  assert.equal(a.isChatOpen('me', 'amy'), false);
  a.chatViewed('me', 'amy');
  assert.equal(a.isChatOpen('me', 'amy'), true);
  assert.equal(a.isChatOpen('me', 'bob'), false);
  assert.equal(a.isChatOpen('amy', 'me'), false); // per person
  t += CHAT_OPEN_WINDOW_MS + 1;
  assert.equal(a.isChatOpen('me', 'amy'), false);
});

test('website calls are recognised by their cookie-session header, app calls are not', () => {
  assert.equal(platformOf({ 'x-session-mode': 'cookie' }), 'web');
  assert.equal(platformOf({ 'x-session-mode': 'COOKIE' }), 'web');
  assert.equal(platformOf({ authorization: 'Bearer x' }), 'app');
});

test('reads and keep-alive calls do not count as doing something', () => {
  for (const url of ['/api/chat/read', '/api/auth/ws-ticket', '/api/auth/session', '/api/presence/heartbeat', '/api/notifications/subscribe']) assert.equal(IS_PASSIVE_REQUEST.test(url), true, url);
  for (const url of ['/api/chat/messages', '/api/games/rooms', '/api/friends/add', '/api/plans']) assert.equal(IS_PASSIVE_REQUEST.test(url), false, url);
});
