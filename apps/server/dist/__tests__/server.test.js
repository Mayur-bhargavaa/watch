import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createServer } from '../index.js';
test('SyncCinema Server End-to-End Test Suite', async (t) => {
    let app;
    let db;
    let baseUrl = '';
    let wsBaseUrl = '';
    try {
        const serverObj = await createServer(':memory:');
        app = serverObj.app;
        db = serverObj.db;
        const address = await app.listen({ port: 0, host: '127.0.0.1' });
        const port = app.server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        wsBaseUrl = `ws://127.0.0.1:${port}`;
    }
    catch (err) {
        console.error('SERVER TEST SETUP ERROR:', err);
        throw err;
    }
    t.after(async () => {
        if (app)
            await app.close();
    });
    let hostToken = '';
    let hostUserId = '';
    let roomSlug = '';
    let roomId = '';
    await t.test('1. Guest Authentication', async () => {
        const res = await fetch(`${baseUrl}/api/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: 'Alex Host' })
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.token);
        assert.equal(data.user.displayName, 'Alex Host');
        hostToken = data.token;
        hostUserId = data.user.id;
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
        const ws = new WebSocket(`${wsBaseUrl}/ws/rooms/${roomSlug}?token=${hostToken}`);
        const snapshotPromise = new Promise((resolve) => {
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
        const ws = new WebSocket(`${wsBaseUrl}/ws/rooms/${roomSlug}?token=${hostToken}`);
        await new Promise((resolve) => ws.on('open', resolve));
        const t1 = Date.now();
        ws.send(JSON.stringify({
            type: 'sync:ping',
            roomId,
            timestamp: t1,
            payload: { t1 }
        }));
        const pongPromise = new Promise((resolve) => {
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
        const hostWs = new WebSocket(`${wsBaseUrl}/ws/rooms/${roomSlug}?token=${hostToken}`);
        const participantWs = new WebSocket(`${wsBaseUrl}/ws/rooms/${roomSlug}?guestName=SarahViewer`);
        await Promise.all([
            new Promise((res) => hostWs.on('open', res)),
            new Promise((res) => participantWs.on('open', res))
        ]);
        // Host sends PLAY command
        const playUpdatePromise = new Promise((resolve) => {
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
        const reactionPromise = new Promise((resolve) => {
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
        const res = await fetch(`${baseUrl}/api/rooms/${roomSlug}/recap`);
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
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'gamer@stitchbyte.in',
                password: 'securePassword123',
                displayName: 'RetroGamer'
            })
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.token);
        assert.equal(data.user.email, 'gamer@stitchbyte.in');
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
        // Login user first
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'host@games.local', displayName: 'GameMaster' })
        });
        const { token } = await loginRes.json();
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
        const ws1 = new WebSocket(`${wsBaseUrl}/ws/rooms/${roomData.room.slug}?token=${token}`);
        const ws2 = new WebSocket(`${wsBaseUrl}/ws/rooms/${roomData.room.slug}?guestName=PlayerTwo`);
        await Promise.all([
            new Promise(r => ws1.on('open', r)),
            new Promise(r => ws2.on('open', r))
        ]);
        // Send game:action from ws1 and verify ws2 receives it
        const gameActionPromise = new Promise((resolve) => {
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
