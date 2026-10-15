import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---- minimal browser environment (must exist BEFORE chatStore/api are imported) ----
class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;
let handler: Handler = () => ({ body: { success: true, messages: [] } });
const calls: { url: string; method: string; body?: any }[] = [];
const g = globalThis as any;
g.window = g;
g.location = { hostname: 'localhost', protocol: 'http:', host: 'localhost:3000', origin: 'http://localhost:3000', pathname: '/chat', search: '', href: 'http://localhost:3000/chat' };
g.localStorage = new MemoryStorage();
g.sessionStorage = new MemoryStorage();
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.dispatchEvent = () => true;
g.fetch = async (url: any, init?: RequestInit) => {
  const u = String(url);
  calls.push({ url: u, method: init?.method || 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const r = await handler(u, init);
  const status = r.status ?? 200;
  return { ok: status >= 200 && status < 300, status, json: async () => r.body } as Response;
};

const ME = 'usr_ME_1';
const P1 = 'usr_Al';
const P2 = 'usr_Alan'; // P1 is a substring of P2 on purpose
// Loaded after the fake browser globals above exist (dynamic import because the module reads `window` at load time)
let ChatStore: (typeof import('../chatStore'))['ChatStore'];
let toCanonicalConvId: (typeof import('../chatIds'))['toCanonicalConvId'];
before(async () => {
  ({ ChatStore } = await import('../chatStore'));
  ({ toCanonicalConvId } = await import('../chatIds'));
});

const user = (id: string, name: string) => ({ id, displayName: name, name, onlineStatus: 'OFFLINE' as const, isOnline: false });
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  g.localStorage.clear();
  g.sessionStorage.clear();
  g.localStorage.setItem('synccinema_session', JSON.stringify({ token: 'cookie-session', user: { id: ME, displayName: 'Me', isAnonymous: false } }));
  ChatStore.dispose();
  calls.length = 0;
  handler = () => ({ body: { success: true, message: { status: 'delivered' }, messages: [] } });
});

function setup() {
  const c1 = ChatStore.getOrCreateDirectConversation(user(P1, 'Al'));
  const c2 = ChatStore.getOrCreateDirectConversation(user(P2, 'Alan'));
  return { c1, c2 };
}

test('a message goes ONLY to its own conversation, even when one peer id contains another', async () => {
  const { c1, c2 } = setup();
  const sent = ChatStore.sendMessage(c1.id, 'hello Al');
  await wait();
  assert.equal(ChatStore.getMessages(c1.id).some((m) => m.id === sent.id), true);
  assert.equal(ChatStore.getMessages(c2.id).some((m) => m.id === sent.id), false, 'leaked into the Alan conversation');
  const convs = ChatStore.getConversations();
  assert.equal(convs.find((c) => c.id === c2.id)?.lastMessage?.id ?? null, null);
  assert.equal(convs.find((c) => c.id === c1.id)?.lastMessage?.id, sent.id);
});

test('a blanket "read" receipt only touches MY messages in THAT conversation', async () => {
  const { c1, c2 } = setup();
  const mine1 = ChatStore.sendMessage(c1.id, 'mine in 1');
  const mine2 = ChatStore.sendMessage(c2.id, 'mine in 2');
  ChatStore.receiveIncomingMessage({ id: 'in1', conversationId: c1.id, senderId: P1, senderName: 'Al', type: 'text', content: 'theirs', createdAt: new Date().toISOString(), status: 'delivered' });
  await wait();

  ChatStore.updateMessageStatus(undefined, c1.id, 'read');

  const m1 = ChatStore.getMessages(c1.id);
  assert.equal(m1.find((m) => m.id === mine1.id)?.status, 'read', 'my message should be read');
  assert.notEqual(m1.find((m) => m.id === 'in1')?.status, 'read', 'their message must not be marked read by their receipt');
  assert.notEqual(ChatStore.getMessages(c2.id).find((m) => m.id === mine2.id)?.status, 'read', 'other conversation must be untouched');
});

test('status never downgrades from read', async () => {
  const { c1 } = setup();
  const m = ChatStore.sendMessage(c1.id, 'x');
  await wait();
  ChatStore.updateMessageStatus(m.id, c1.id, 'read');
  ChatStore.updateMessageStatus(m.id, c1.id, 'delivered');
  assert.equal(ChatStore.getMessages(c1.id).find((x) => x.id === m.id)?.status, 'read');
});

test('a message the server rejects is marked failed, and Retry sends it again', async () => {
  const { c1 } = setup();
  handler = () => ({ status: 403, body: { error: 'You can only message your friends or partner.' } });
  const m = ChatStore.sendMessage(c1.id, 'not friends');
  await wait(50);
  assert.equal(ChatStore.getMessages(c1.id).find((x) => x.id === m.id)?.status, 'failed');

  handler = () => ({ body: { success: true, message: { status: 'sent' } } });
  ChatStore.resendMessage(c1.id, m.id);
  await wait(50);
  assert.equal(ChatStore.getMessages(c1.id).find((x) => x.id === m.id)?.status, 'sent');
  assert.equal(calls.filter((c) => c.url.endsWith('/api/chat/messages') && c.method === 'POST').length, 2);
});

test('network failure also marks the message failed', async () => {
  const { c1 } = setup();
  handler = () => { throw new Error('offline'); };
  const m = ChatStore.sendMessage(c1.id, 'offline');
  await wait(50);
  assert.equal(ChatStore.getMessages(c1.id).find((x) => x.id === m.id)?.status, 'failed');
});

test('reactions are immutable updates (memoised bubbles must see a new object)', async () => {
  const { c1 } = setup();
  const m = ChatStore.sendMessage(c1.id, 'react to me');
  await wait();
  const before = ChatStore.getMessages(c1.id).find((x) => x.id === m.id)!;
  ChatStore.addReaction(c1.id, m.id, '🔥');
  const after = ChatStore.getMessages(c1.id).find((x) => x.id === m.id)!;
  assert.notEqual(before, after);
  assert.equal(before.reactions, undefined, 'the old object must not be mutated');
  assert.deepEqual(after.reactions?.map((r) => [r.emoji, r.count]), [['🔥', 1]]);
  ChatStore.addReaction(c1.id, m.id, '🔥'); // toggle off
  assert.equal(ChatStore.getMessages(c1.id).find((x) => x.id === m.id)?.reactions?.length, 0);
});

test('getMessages hands out copies: mutating the result cannot corrupt the store', async () => {
  const { c1 } = setup();
  ChatStore.sendMessage(c1.id, 'one');
  await wait();
  const copy = ChatStore.getMessages(c1.id);
  copy.length = 0;
  assert.equal(ChatStore.getMessages(c1.id).length, 1);
});

test('fetching history for one chat never rewrites another chat', async () => {
  const { c1, c2 } = setup();
  const keep = ChatStore.sendMessage(c1.id, 'stays in 1');
  await wait();
  handler = (url) => url.includes('/api/chat/messages?')
    ? { body: { success: true, messages: [{ id: 'srv1', conversationId: c2.id, senderId: P2, senderName: 'Alan', type: 'text', content: 'hi from Alan', createdAt: new Date(Date.now() + 1000).toISOString(), status: 'delivered' }] } }
    : { body: { success: true } };
  await ChatStore.fetchRemoteMessages(c2.id);

  const convs = ChatStore.getConversations();
  const conv1 = convs.find((c) => c.id === c1.id)!;
  assert.ok(conv1, 'conversation 1 keeps its id');
  assert.equal(conv1.lastMessage?.id, keep.id, 'conversation 1 last message must not change');
  assert.equal(convs.find((c) => c.id === toCanonicalConvId(ME, P2))?.lastMessage?.id, 'srv1');
});

test('friend sync loads history once per friend, not on every tick', async () => {
  handler = (url) => {
    if (url.endsWith('/api/friends')) {
      return { body: { friends: [{ friendshipId: 'f1', createdAt: new Date().toISOString(), friendUser: { id: P1, displayName: 'Al', partnerCode: 'AL1', isOnline: false }, streak: { currentStreak: 3 } }], requests: { incoming: [], outgoing: [] }, myFriendCode: 'ME1' } };
    }
    return { body: { success: true, messages: [] } };
  };
  await ChatStore.syncWithExistingFriends();
  await wait();
  await ChatStore.syncWithExistingFriends();
  await ChatStore.syncWithExistingFriends();
  await wait();
  const historyCalls = calls.filter((c) => c.url.includes('/api/chat/messages?'));
  assert.equal(historyCalls.length, 1, `history fetched ${historyCalls.length}x for one friend`);
  const friend = ChatStore.getUsers()[P1];
  assert.equal(friend?.gamesPlayed, 0, 'stats must not be invented from the streak');
});

test('incoming messages bump unread only when the chat is not open', async () => {
  const { c1 } = setup();
  const incoming = (id: string) => ({ id, conversationId: c1.id, senderId: P1, senderName: 'Al', type: 'text' as const, content: id, createdAt: new Date().toISOString(), status: 'delivered' as const });

  ChatStore.receiveIncomingMessage(incoming('a'));
  assert.equal(ChatStore.getConversations().find((c) => c.id === c1.id)?.unreadCount, 1);

  g.sessionStorage.setItem('watch_active_conv_id', c1.id);
  ChatStore.receiveIncomingMessage(incoming('b'));
  assert.equal(ChatStore.getConversations().find((c) => c.id === c1.id)?.unreadCount, 0, 'open chat should be marked read');

  ChatStore.receiveIncomingMessage(incoming('b')); // duplicate delivery (WebSocket + HTTP)
  assert.equal(ChatStore.getMessages(c1.id).filter((m) => m.id === 'b').length, 1, 'duplicate must be merged');
});

test('opening a conversation never reorders the list or changes its timestamp (the "chat jumps down then back up" bug)', async () => {
  const { c1, c2 } = setup();
  // c1 has older activity than c2
  ChatStore.receiveIncomingMessage({ id: 'old', conversationId: c1.id, senderId: P1, senderName: 'Al', type: 'text', content: 'old', createdAt: new Date(Date.now() - 60_000).toISOString(), status: 'delivered' });
  ChatStore.receiveIncomingMessage({ id: 'new', conversationId: c2.id, senderId: P2, senderName: 'Alan', type: 'text', content: 'new', createdAt: new Date().toISOString(), status: 'delivered' });
  const order = () => ChatStore.getConversations().map((c) => c.id);
  const before = order();
  const stamp = ChatStore.getConversations().find((c) => c.id === c1.id)!.updatedAt;

  // what the chat screen does when the user clicks the older conversation (twice, as effects re-run)
  ChatStore.getOrCreateDirectConversation(user(P1, 'Al'));
  ChatStore.getOrCreateDirectConversation(user(P1, 'Al'));
  ChatStore.markAsRead(c1.id, P1);

  assert.deepEqual(order(), before, 'selecting a chat must not change the list order');
  assert.equal(ChatStore.getConversations().find((c) => c.id === c1.id)!.updatedAt, stamp, 'selecting a chat must not touch updatedAt');
});

test('opening the same conversation repeatedly is idempotent (does not notify subscribers each time)', async () => {
  setup();
  let notifications = 0;
  const off = ChatStore.subscribe(() => { notifications += 1; });
  ChatStore.getOrCreateDirectConversation(user(P1, 'Al'));
  ChatStore.getOrCreateDirectConversation(user(P1, 'Al'));
  ChatStore.getOrCreateDirectConversation(user(P1, 'Al'));
  off();
  assert.equal(notifications, 0, `got ${notifications} notifications for no-op selections (causes render loops)`);
});

test('the conversation list is cached between changes (no re-parsing localStorage on every call)', async () => {
  const { c1 } = setup();
  const realGet = g.localStorage.getItem.bind(g.localStorage);
  let convReads = 0;
  g.localStorage.getItem = (k: string) => { if (k.endsWith('_conversations')) convReads += 1; return realGet(k); };
  try {
    ChatStore.getConversations(); // may rebuild once (after setup's writes)
    const baseline = convReads;
    for (let i = 0; i < 20; i++) ChatStore.getConversations();
    assert.equal(convReads - baseline, 0, `re-read conversations from storage ${convReads - baseline}x for 20 unchanged calls`);

    // ...but any change invalidates it immediately
    const m = ChatStore.sendMessage(c1.id, 'cache must notice this');
    assert.equal(ChatStore.getConversations().find((c) => c.id === c1.id)?.lastMessage?.id, m.id);
    ChatStore.setUserOnline(P1, true);
    assert.equal(ChatStore.getConversations().find((c) => c.id === c1.id)?.participants.find((p) => p.id === P1)?.isOnline, true);
  } finally {
    g.localStorage.getItem = realGet;
  }
});

test('callers cannot corrupt the cache by editing the objects they receive', async () => {
  const { c1 } = setup();
  const first = ChatStore.getConversations().find((c) => c.id === c1.id)!;
  first.name = 'HACKED';
  first.unreadCount = 99;
  const second = ChatStore.getConversations().find((c) => c.id === c1.id)!;
  assert.notEqual(second.name, 'HACKED');
  assert.notEqual(second.unreadCount, 99);
});
