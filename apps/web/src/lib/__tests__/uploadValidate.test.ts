import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUpload, sniffUpload, UPLOAD_MAX_BYTES } from '../uploadValidate';

const pad = (head: number[] | string, n = 32) => {
  const h = typeof head === 'string' ? Array.from(Buffer.from(head, 'latin1')) : head;
  return Uint8Array.from([...h, ...new Array(Math.max(0, n - h.length)).fill(0)]);
};

test('real images, audio and video are recognised by content, with a fixed safe extension', () => {
  assert.equal(sniffUpload(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext, 'jpg');
  assert.equal(sniffUpload(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime, 'image/png');
  assert.equal(sniffUpload(pad('GIF89a'))?.ext, 'gif');
  assert.equal(sniffUpload(Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), 0, 0]))?.ext, 'webp');
  assert.equal(sniffUpload(pad('OggS'))?.ext, 'ogg');
  assert.equal(sniffUpload(pad([0x1a, 0x45, 0xdf, 0xa3]))?.ext, 'webm');
  assert.equal(sniffUpload(Uint8Array.from([0, 0, 0, 24, ...Buffer.from('ftypmp42'), 0, 0, 0, 0]))?.ext, 'mp4');
});

test('SVG, HTML, scripts, executables and empty or tiny files are refused whatever the client calls them', () => {
  for (const body of ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', '<!doctype html><script>alert(1)</script>', '<?xml version="1.0"?><svg/>', 'MZ\u0090\u0000\u0003 exe exe exe', '#!/bin/sh\nrm -rf / ok ok ok']) {
    const r = checkUpload(Uint8Array.from(Buffer.from(body, 'latin1')));
    assert.equal(r.ok, false, body);
  }
  assert.deepEqual(checkUpload(new Uint8Array(0)), { ok: false, status: 400, error: 'Empty file' });
  assert.equal(checkUpload(new Uint8Array(5)).ok, false);
});

test('files over the size cap are refused with 413', () => {
  const big = new Uint8Array(UPLOAD_MAX_BYTES + 1);
  big.set([0xff, 0xd8, 0xff]);
  const r = checkUpload(big);
  assert.equal(r.ok === false && r.status, 413);
});
