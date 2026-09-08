import test from 'node:test';
import assert from 'node:assert/strict';
import { detectVideoProvider, NON_EMBEDDABLE_WARNING } from '../provider.js';

test('Provider Abstraction - Detection & Embedding Policy', () => {
  // YouTube Detection
  const yt = detectVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.provider, 'youtube');
  assert.equal(yt.canEmbed, true);
  assert.equal(yt.mediaId, 'dQw4w9WgXcQ');

  // Vimeo Detection
  const vimeo = detectVideoProvider('https://vimeo.com/76979871');
  assert.equal(vimeo.provider, 'vimeo');
  assert.equal(vimeo.canEmbed, true);
  assert.equal(vimeo.mediaId, '76979871');

  // Direct HTML5 Video Detection
  const html5 = detectVideoProvider('https://example.com/stream.mp4');
  assert.equal(html5.provider, 'html5');
  assert.equal(html5.canEmbed, true);

  // External / Non-embeddable OTT Providers (Netflix, Prime, Disney+)
  const netflix = detectVideoProvider('https://www.netflix.com/watch/81234567');
  assert.equal(netflix.provider, 'external_session');
  assert.equal(netflix.canEmbed, false);
  assert.equal(netflix.warningMessage, NON_EMBEDDABLE_WARNING);

  const disney = detectVideoProvider('https://www.disneyplus.com/video/12345');
  assert.equal(disney.provider, 'external_session');
  assert.equal(disney.canEmbed, false);
  assert.equal(disney.warningMessage, NON_EMBEDDABLE_WARNING);
});
