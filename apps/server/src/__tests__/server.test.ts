import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { WebSocket } from 'ws';

// The server refuses to boot without these. Tests never touch a real database: unless MONGODB_URI is
// provided, a throwaway local mongod is started on a random port and removed afterwards.
process.env.JWT_SECRET ||= 'test-' + 'x'.repeat(40);
process.env.LOG_LEVEL ||= 'silent';
process.env.MAIL_TRANSPORT = 'memory';
let mongod: ChildProcess | null = null;
let mongoDir = '';
async function ensureMongo(): Promise<void> {
  if (process.env.MONGODB_URI) return;
  const port: number = await new Promise((res) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as any).port; s.close(() => res(p)); });
  });
  mongoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-mongo-'));
  mongod = spawn('mongod', ['--dbpath', mongoDir, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' });
  mongod.on('error', () => {});
  process.env.MONGODB_URI = `mongodb://127.0.0.1:${port}/`;
  for (let i = 0; i < 80; i++) {
    if (await new Promise<boolean>((r) => { const c = net.connect(port, '127.0.0.1'); c.on('connect', () => { c.destroy(); r(true); }); c.on('error', () => r(false)); })) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('mongod did not start; install MongoDB or set MONGODB_URI to a disposable instance');
}

test('SyncCinema Server End-to-End Test Suite', async (t) => {
  await ensureMongo();
  const { createServer } = await import('../index.js');
  let app: any;
  let db: any;
  let baseUrl = '';
  let wsBaseUrl = '';
  try {
    const serverObj = await createServer(':memory:');
    app = serverObj.app;
    db = serverObj.db;
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
    wsBaseUrl = `ws://127.0.0.1:${port}`;
  } catch (err) {
    console.error('SERVER TEST SETUP ERROR:', err);
    throw err;
  }

  t.after(async () => {
    if (app) await app.close();
    mongod?.kill('SIGKILL');
    if (mongoDir) fs.rmSync(mongoDir, { recursive: true, force: true });
  });

  // WebSockets authenticate with one-time tickets, never a JWT in the URL
  async function wsUrl(path: string, token: string) {
    const r = await fetch(`${baseUrl}/api/auth/ws-ticket`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const { ticket } = await r.json();
    return `${wsBaseUrl}${path}?ticket=${encodeURIComponent(ticket)}`;
  }

  let seq = 0;
  let hostToken = '';
  let hostUserId = '';
  let roomSlug = '';
  let roomId = '';

  // Signup is verify-first: register, read the confirmation link from the in-memory mailer, confirm it.
  async function register(displayName: string, password = 'securePassword123') {
    const { mailer } = await import('../services/mailer.js');
    const email = `e2e${++seq}_${Date.now()}@stitchbyte.in`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    assert.equal(res.status, 200);
    let token = '';
    for (let i = 0; i < 80 && !token; i++) {
      const mail = mailer.outbox.find((m) => m.to === email);
      token = mail ? /verify=([A-Za-z0-9_-]+)/.exec(mail.text)?.[1] ?? '' : '';
      if (!token) await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(token, 'confirmation email was not sent');
    const v = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    assert.equal(v.status, 200);
    const data = await v.json();
    return { email, password, token: data.token as string, user: data.user };
  }

  await t.test('1. Registration (guest sign-in is disabled)', async () => {
    const guest = await fetch(`${baseUrl}/api/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(guest.status, 403);

    const host = await register('Alex Host');
    assert.ok(host.token);
    assert.equal(host.user.displayName, 'Alex Host');
    hostToken = host.token;
    hostUserId = host.user.id;
  });

  await t.test('2. Room Creation', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        title: 'Friday Movie Night',
        sourceUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
        mediaTitle: 'Sample Film'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.room.slug);
    assert.equal(data.room.title, 'Friday Movie Night');
    assert.equal(data.room.currentMedia.provider, 'youtube');
    assert.equal(data.room.currentMedia.providerMediaId, 'L_LUpnjgPso');
    roomSlug = data.room.slug;
    roomId = data.room.id;
  });

  await t.test('3. WebSocket Connect & Initial State Snapshot', async () => {
    const ws = new WebSocket(await wsUrl(`/ws/rooms/${roomSlug}`, hostToken));

    const snapshotPromise = new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'room:state') {
          resolve(msg.payload);
        }
      });
    });

    const snapshot = await snapshotPromise;
    assert.equal(snapshot.room.slug, roomSlug);
    assert.equal(snapshot.myRole, 'HOST');
    assert.equal(snapshot.room.playbackState.state, 'PAUSED');
    assert.equal(snapshot.room.playbackState.position, 0);

    ws.close();
  });

  await t.test('4. Clock Sync Ping / Pong Exchange', async () => {
    const ws = new WebSocket(await wsUrl(`/ws/rooms/${roomSlug}`, hostToken));

    await new Promise((resolve) => ws.on('open', resolve));

    const t1 = Date.now();
    ws.send(JSON.stringify({
      type: 'sync:ping',
      roomId,
      timestamp: t1,
      payload: { t1 }
    }));

    const pongPromise = new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'sync:pong') {
          resolve(msg.payload);
        }
      });
    });

    const pong = await pongPromise;
    assert.equal(pong.t1, t1);
    assert.ok(pong.serverTime >= t1);

    ws.close();
  });

  await t.test('5. Multi-User Synchronization: Host Play, Seek & Participant Sync', async () => {
    const sarah = await register('SarahViewer');
    const hostWs = new WebSocket(await wsUrl(`/ws/rooms/${roomSlug}`, hostToken));
    const participantWs = new WebSocket(await wsUrl(`/ws/rooms/${roomSlug}`, sarah.token));

    await Promise.all([
      new Promise((res) => hostWs.on('open', res)),
      new Promise((res) => participantWs.on('open', res))
    ]);

    // Host sends PLAY command
    const playUpdatePromise = new Promise<any>((resolve) => {
      participantWs.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'playback:update') {
          resolve(msg.payload);
        }
      });
    });

    hostWs.send(JSON.stringify({
      type: 'playback:command',
      roomId,
      timestamp: Date.now(),
      payload: {
        action: 'PLAY',
        position: 120.5,
        version: 1
      }
    }));

    const playUpdate = await playUpdatePromise;
    assert.equal(playUpdate.playbackState.state, 'PLAYING');
    assert.equal(playUpdate.playbackState.position, 120.5);
    assert.equal(playUpdate.playbackState.version, 2);

    // Participant sends reaction
    const reactionPromise = new Promise<any>((resolve) => {
      hostWs.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'reaction:broadcast') {
          resolve(msg.payload);
        }
      });
    });

    participantWs.send(JSON.stringify({
      type: 'reaction:send',
      roomId,
      timestamp: Date.now(),
      payload: {
        code: 'joy',
        emoji: '😂',
        mediaTimestamp: 125.0
      }
    }));

    const reaction = await reactionPromise;
    assert.equal(reaction.emoji, '😂');
    assert.equal(reaction.mediaTimestamp, 125.0);

    hostWs.close();
    participantWs.close();
  });

  await t.test('6. Post-Watch Recap & Reaction Heatmap API', async () => {
    const res = await fetch(`${baseUrl}/api/rooms/${roomSlug}/recap`, { headers: { Authorization: `Bearer ${hostToken}` } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.heatmap));
    assert.ok(data.heatmap.length > 0);
    assert.equal(data.heatmap[0].topEmoji, '😂');
  });

  await t.test('7. GDPR Data Deletion', async () => {
    const res = await fetch(`${baseUrl}/api/privacy/data`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${hostToken}`
      }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  await t.test('8. User Login & Account Verification', async () => {
    const acct = await register('RetroGamer');
    const bad = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acct.email, password: 'wrong-password' })
    });
    assert.equal(bad.status, 401);

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acct.email, password: acct.password })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user.email, acct.email);
    assert.equal(data.user.displayName, 'RetroGamer');

    // Verify /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${data.token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.id, data.user.id);
  });

  await t.test('9. Room Creation Auth Protection (401 when missing token)', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Room Attempt'
      })
    });
    assert.equal(res.status, 401);
  });

  await t.test('10. Game Lounge Creation & Real-Time Multiplayer Sync', async () => {
    const { token } = await register('GameMaster');

    // Create room with activityMode: 'GAMING'
    const roomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Trivia & Arcade Party',
        activityMode: 'GAMING'
      })
    });
    assert.equal(roomRes.status, 200);
    const roomData = await roomRes.json();
    assert.equal(roomData.room.activityMode, 'GAMING');
    assert.equal(roomData.room.title, 'Trivia & Arcade Party');

    // Connect player 1 and player 2 to WebSocket
    const playerTwo = await register('PlayerTwo');
    const ws1 = new WebSocket(await wsUrl(`/ws/rooms/${roomData.room.slug}`, token));
    const ws2 = new WebSocket(await wsUrl(`/ws/rooms/${roomData.room.slug}`, playerTwo.token));

    await Promise.all([
      new Promise(r => ws1.on('open', r)),
      new Promise(r => ws2.on('open', r))
    ]);

    // Send game:action from ws1 and verify ws2 receives it
    const gameActionPromise = new Promise<any>((resolve) => {
      ws2.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'game:action') {
          resolve(msg.payload);
        }
      });
    });

    ws1.send(JSON.stringify({
      type: 'game:action',
      roomId: roomData.room.id,
      timestamp: Date.now(),
      payload: {
        gameType: 'trivia',
        action: 'SUBMIT_ANSWER',
        isCorrect: true,
        userName: 'GameMaster'
      }
    }));

    const receivedGameAction = await gameActionPromise;
    assert.equal(receivedGameAction.gameType, 'trivia');
    assert.equal(receivedGameAction.action, 'SUBMIT_ANSWER');
    assert.equal(receivedGameAction.userName, 'GameMaster');

    ws1.close();
    ws2.close();
  });
});
