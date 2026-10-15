import test from 'node:test';
import assert from 'node:assert/strict';
import { TypingController, type TypingTimers } from '../typing';
import { downsampleWaveform, pickAudioMimeType, describeMicError, VOICE_BARS } from '../voice';
import { validateImageFile, MAX_IMAGE_BYTES } from '../usePendingImage';
import { normalizeGameType, maxPlayersFor, roomPrefixFor, fallbackRoomCode } from '../gameInvite';
import { buildMoviePayload } from '../MovieDialog';

// ---- a manual clock so timer behaviour is deterministic ----
function fakeClock() {
  let now = 1_000_000;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: TypingTimers = {
    now: () => now,
    setTimeout: (fn, ms) => { const id = nextId++; pending.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (h) => { pending.delete(h as number); }
  };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = [...pending.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; pending.delete(due[0]); due[1].fn();
    }
    now = target;
  };
  return { timers, advance, pendingCount: () => pending.size };
}

test('typing: sends true once per throttle window, not on every keystroke', () => {
  const clock = fakeClock();
  const events: boolean[] = [];
  const t = new TypingController((v) => events.push(v), { throttleMs: 2500, idleMs: 3000 }, clock.timers);
  for (let i = 0; i < 10; i++) { t.input(true); clock.advance(100); } // 1 s of fast typing
  assert.deepEqual(events, [true]);
  clock.advance(2000); t.input(true); // beyond the throttle window: refresh once
  assert.deepEqual(events, [true, true]);
});

test('typing: sends false after the user stops typing (the old code left "typing..." on forever)', () => {
  const clock = fakeClock();
  const events: boolean[] = [];
  const t = new TypingController((v) => events.push(v), { idleMs: 3000 }, clock.timers);
  t.input(true);
  clock.advance(2999); assert.deepEqual(events, [true]);
  clock.advance(2); assert.deepEqual(events, [true, false]);
  clock.advance(10_000); assert.deepEqual(events, [true, false], 'false is sent only once');
});

test('typing: clearing the box, sending, or unmounting stops immediately and leaves no timer behind', () => {
  const clock = fakeClock();
  const events: boolean[] = [];
  const t = new TypingController((v) => events.push(v), {}, clock.timers);
  t.input(true); t.input(false);
  assert.deepEqual(events, [true, false]);
  assert.equal(clock.pendingCount(), 0);
  t.stop(); t.stop();
  assert.deepEqual(events, [true, false], 'stop() when already stopped emits nothing');
});

test('voice: waveform is always exactly VOICE_BARS bars, including very short clips', () => {
  assert.equal(downsampleWaveform([]).length, VOICE_BARS);
  assert.equal(downsampleWaveform([50, 60]).length, VOICE_BARS);
  const long = Array.from({ length: 1000 }, (_, i) => (i % 100) + 1);
  const bars = downsampleWaveform(long);
  assert.equal(bars.length, VOICE_BARS);
  assert.ok(bars.every((b) => b >= 1 && b <= 100));
});

test('voice: picks the first supported recording format, or lets the browser choose', () => {
  assert.equal(pickAudioMimeType((m) => m === 'audio/mp4'), 'audio/mp4'); // Safari
  assert.equal(pickAudioMimeType(() => true), 'audio/webm;codecs=opus');
  assert.equal(pickAudioMimeType(() => false), '');
});

test('voice: microphone errors become actionable messages (no raw alert() text)', () => {
  assert.match(describeMicError({ name: 'NotAllowedError' }), /denied/i);
  assert.match(describeMicError({ name: 'NotFoundError' }), /No microphone/i);
  assert.match(describeMicError({ message: 'boom' }), /boom/);
});

test('photos: only images up to 10 MB are accepted', () => {
  assert.equal(validateImageFile({ type: 'image/png', size: 1000 }), null);
  assert.match(validateImageFile({ type: 'application/pdf', size: 1000 }) || '', /image/i);
  assert.match(validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }) || '', /10 MB/);
  assert.equal(validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES }), null);
});

test('game invites: canonical type, player count and secure room-code shape', () => {
  assert.equal(normalizeGameType('doodle'), 'doodle-duel');
  assert.equal(normalizeGameType('tictactoe'), 'tic-tac-toe');
  assert.equal(normalizeGameType('chess'), 'chess');
  assert.equal(maxPlayersFor('ludo'), 4);
  assert.equal(maxPlayersFor('tambola'), 20);
  assert.equal(maxPlayersFor('chess'), 2);
  assert.equal(roomPrefixFor('four-in-a-row'), 'FOUR');

  const code = fallbackRoomCode('ludo');
  assert.match(code, /^LUDO-[A-HJ-NP-Z2-9]{8}$/, 'must match the server room-code format (8 unambiguous chars)');
  assert.notEqual(fallbackRoomCode('ludo'), fallbackRoomCode('ludo'), 'codes must not repeat');
  assert.match(fallbackRoomCode('bingo', () => new Uint8Array(8)), /^BINGO-AAAAAAAA$/);
});

test('sharing a movie sends only what the user typed (no invented year, rating, runtime or poster)', () => {
  assert.equal(buildMoviePayload('   ', 'x'), null);
  const p = buildMoviePayload('  Dune  ', 'Sci-Fi, , Adventure ')!;
  assert.equal(p.title, 'Dune');
  assert.deepEqual(p.genres, ['Sci-Fi', 'Adventure']);
  for (const invented of ['year', 'rating', 'duration', 'posterUrl']) {
    assert.equal((p as unknown as Record<string, unknown>)[invented], undefined, `${invented} must not be fabricated`);
  }
  assert.equal(buildMoviePayload('Dune', '')!.genres, undefined);
});
