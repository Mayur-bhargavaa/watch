import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePlayback, GUEST_COMMAND_GAP_MS } from '../sync/playbackRules.js';

const base = { state: 'PLAYING' as const, authoritative: 61.5, storedPosition: 10, requested: 999, sinceLastGuestCommandMs: 10_000 };

test('host and co-host keep full control: pause captures the exact position, play and seek go where asked', () => {
  assert.deepEqual(decidePlayback({ ...base, isController: true, action: 'PAUSE' }), { type: 'apply', position: 61.5 });
  assert.deepEqual(decidePlayback({ ...base, isController: true, action: 'PLAY', state: 'PAUSED' }), { type: 'apply', position: 999 });
  assert.deepEqual(decidePlayback({ ...base, isController: true, action: 'SEEK', state: 'PAUSED' }), { type: 'apply', position: 999 });
  // a repeated PLAY from the host still goes through (it re-aligns everyone)
  assert.deepEqual(decidePlayback({ ...base, isController: true, action: 'PLAY' }), { type: 'apply', position: 999 });
});

test('anyone else can pause for everybody, at the room position, not the one they send', () => {
  assert.deepEqual(decidePlayback({ ...base, isController: false, action: 'PAUSE' }), { type: 'apply', position: 61.5 });
});

test('anyone else can resume, from where it stopped, never from a position they send', () => {
  assert.deepEqual(decidePlayback({ ...base, isController: false, action: 'PLAY', state: 'PAUSED' }), { type: 'apply', position: 10 });
});

test('anyone else cannot seek', () => {
  const d = decidePlayback({ ...base, isController: false, action: 'SEEK' });
  assert.equal(d.type, 'deny');
});

test('a guest command that changes nothing, or comes too fast, is ignored', () => {
  assert.deepEqual(decidePlayback({ ...base, isController: false, action: 'PLAY' }), { type: 'ignore' }); // already playing (a rebuffering phone reports PLAYING again)
  assert.deepEqual(decidePlayback({ ...base, isController: false, action: 'PAUSE', state: 'PAUSED' }), { type: 'ignore' });
  assert.deepEqual(decidePlayback({ ...base, isController: false, action: 'PAUSE', sinceLastGuestCommandMs: GUEST_COMMAND_GAP_MS - 1 }), { type: 'ignore' });
  assert.equal(decidePlayback({ ...base, isController: false, action: 'PAUSE', sinceLastGuestCommandMs: GUEST_COMMAND_GAP_MS }).type, 'apply');
});
