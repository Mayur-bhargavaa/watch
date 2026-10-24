import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDirectMessage, cleanVoice, MAX_VOICE_DATA_URL } from '../services/directMessage.js';

const deps = { areConnected: async () => true, getDirectMessageById: async () => null };
const sender = { id: 'a', displayName: 'Asha' };
const audio = (mime = 'audio/mp4', n = 1000) => `data:${mime};base64,${'QUJD'.repeat(n / 4)}`;
const send = (body: any) => prepareDirectMessage(deps, sender, { recipientId: 'b', content: '🎤 Voice message', type: 'voice', ...body }, () => false);

test('voice: audio is stored once in mediaUrl, metadata holds duration and waveform only', async () => {
  const r: any = await send({ mediaUrl: audio(), metadata: { voice: { duration: 12.4, waveform: [10, 200, -5, 'x', 50] } } });
  assert.equal(r.ok, true);
  assert.equal(r.msg.type, 'voice');
  assert.equal(r.msg.mediaUrl, audio());
  assert.deepEqual(r.msg.metadata, { voice: { duration: 12, waveform: [10, 100, 0, 0, 50] } });
  assert.equal(r.msg.content, '🎤 Voice message');
});

test('voice: recorder codec parameters are accepted (the website sends audio/webm;codecs=opus)', async () => {
  const r: any = await send({ mediaUrl: audio('audio/webm;codecs=opus'), metadata: { voice: { duration: 3 } } });
  assert.equal(r.ok, true);
  assert.equal(r.msg.mediaUrl, audio('audio/webm;codecs=opus'));
});

test('voice: the old website payload (audio repeated in metadata.voice.audioUrl) works and is not stored twice', async () => {
  const a = audio('audio/webm;codecs=opus', 4000);
  const both: any = await send({ mediaUrl: a, metadata: { voice: { duration: 5, audioUrl: a, waveform: [1, 2] } } });
  assert.equal(both.ok, true);
  assert.equal(JSON.stringify(both.msg.metadata).includes('base64'), false);
  const onlyMeta: any = await send({ mediaUrl: undefined, metadata: { voice: { duration: 5, audioUrl: a } } });
  assert.equal(onlyMeta.ok, true);
  assert.equal(onlyMeta.msg.mediaUrl, a);
});

test('voice: refuses no audio, non-audio data, links, oversize; clamps the duration', async () => {
  for (const mediaUrl of [undefined, '', 'https://example.com/a.mp3', 'data:image/png;base64,QUJD', 'data:audio/mp4;base64,not base64!!']) {
    const r: any = await send({ mediaUrl, metadata: { voice: { duration: 3 } } });
    assert.equal(r.ok, false, String(mediaUrl));
    assert.equal(r.status, 400);
  }
  const big: any = await send({ mediaUrl: audio('audio/mp4', MAX_VOICE_DATA_URL + 100), metadata: { voice: { duration: 3 } } });
  assert.equal(big.ok, false);
  assert.match(big.error, /too long/);
  assert.equal((cleanVoice({ mediaUrl: audio(), metadata: { voice: { duration: 9999 } } }) as any).voice.duration, 180);
  assert.equal((cleanVoice({ mediaUrl: audio(), metadata: { voice: { duration: 0 } } }) as any).voice.duration, 1);
  assert.equal((cleanVoice({ mediaUrl: audio(), metadata: { voice: { waveform: Array(500).fill(50) } } }) as any).voice.waveform.length, 64);
});

test('voice: a caption or content in the request cannot replace the label, and only friends can send', async () => {
  const r: any = await send({ content: '<script>x</script>', mediaUrl: audio(), metadata: { voice: { duration: 2 } } });
  assert.equal(r.msg.content, '🎤 Voice message');
  const no: any = await prepareDirectMessage({ ...deps, areConnected: async () => false }, sender, { recipientId: 'b', content: 'x', type: 'voice', mediaUrl: audio() }, () => false);
  assert.equal(no.status, 403);
});

test('other messages are unchanged: photos with codec-free data URLs and text', async () => {
  const photo: any = await prepareDirectMessage(deps, sender, { recipientId: 'b', content: '📷 Photo', type: 'image', mediaUrl: 'data:image/jpeg;base64,QUJD' }, () => false);
  assert.equal(photo.msg.mediaUrl, 'data:image/jpeg;base64,QUJD');
  const text: any = await prepareDirectMessage(deps, sender, { recipientId: 'b', content: 'hi' }, () => false);
  assert.equal(text.msg.type, 'text');
  assert.equal(text.msg.metadata, undefined);
});
