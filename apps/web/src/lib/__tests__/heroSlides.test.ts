import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogTitle } from '@synccinema/common';
import { HERO_MAX_SLIDES, buildHeroSlides, clampIndex, heroTag, interleaveTitles, isHeroUsable, keyDelta, stepIndex, swipeDelta } from '../catalog/heroSlides';
import { DEFAULT_STANDING_BITMOJI, bitmojiForSession, getStandingBitmojiUrl } from '../bitmoji';

const t = (id: number, o: Partial<CatalogTitle> = {}): CatalogTitle => ({ id: `tmdb:movie:${id}`, source: 'tmdb', sourceId: String(id), mediaType: 'movie', title: `T${id}`, overview: 'o', posterPath: null, backdropPath: `/b${id}.jpg`, releaseDate: null, genres: [], runtimeMinutes: null, rating: null, ratingSource: 'TMDB', voteCount: 0, providers: [], region: 'IN', externalUrl: null, ...o });
const ids = (l: CatalogTitle[]) => l.map((x) => x.sourceId);

test('hero slides: only titles with a backdrop qualify', () => {
  assert.equal(isHeroUsable(t(1)), true);
  assert.equal(isHeroUsable(t(1, { backdropPath: null })), false);
  assert.equal(isHeroUsable(t(1, { title: '' })), false);
  const s = buildHeroSlides([{ titles: [t(1, { backdropPath: null }), t(2), t(3, { backdropPath: null }), t(4)], take: 3 }]);
  assert.deepEqual(ids(s), ['2', '4']);
});

test('hero slides: 3 + 3, de-duplicated by title key, order is stable', () => {
  const trending = [t(1), t(2), t(3), t(4), t(5)];
  const indian = interleaveTitles([[t(2), t(10), t(11)], [t(20), t(1), t(21)], [t(30)]]);
  assert.deepEqual(ids(indian), ['2', '20', '30', '10', '1', '11', '21']);
  const s = buildHeroSlides([{ titles: trending, take: 3 }, { titles: indian, take: 3 }]);
  assert.deepEqual(ids(s), ['1', '2', '3', '20', '30', '10']);
  assert.deepEqual(ids(buildHeroSlides([{ titles: trending, take: 3 }, { titles: indian, take: 3 }])), ids(s));
  assert.equal(new Set(s.map((x) => x.id)).size, s.length);
});

test('hero slides: the cap holds, and a short group is topped up from what is left', () => {
  const many = Array.from({ length: 30 }, (_, i) => t(i + 1));
  assert.equal(buildHeroSlides([{ titles: many, take: 20 }]).length, HERO_MAX_SLIDES);
  assert.equal(buildHeroSlides([{ titles: many, take: 20 }], 4).length, 4);
  // trending failed (empty): the Indian rows fill the carousel
  assert.deepEqual(ids(buildHeroSlides([{ titles: [], take: 3 }, { titles: many, take: 3 }])), ['1', '2', '3', '4', '5', '6']);
  // the Indian rows are short: trending leftovers fill the gap
  assert.deepEqual(ids(buildHeroSlides([{ titles: many.slice(0, 8), take: 3 }, { titles: [t(100)], take: 3 }])), ['1', '2', '3', '100', '4', '5']);
  assert.deepEqual(buildHeroSlides([]), []);
});

test('hero tag: kind plus the first genre', () => {
  assert.equal(heroTag(t(1)), 'Movie');
  assert.equal(heroTag(t(1, { mediaType: 'tv', genres: [{ id: 18, name: 'Drama' }, { id: 35, name: 'Comedy' }] })), 'TV Series · Drama');
});

test('carousel index math: wraps both ways, clamps, ignores empty lists', () => {
  assert.equal(stepIndex(0, -1, 6), 5);
  assert.equal(stepIndex(5, 1, 6), 0);
  assert.equal(stepIndex(2, 1, 6), 3);
  assert.equal(stepIndex(0, -7, 6), 5);
  assert.equal(stepIndex(3, 1, 0), 0);
  assert.equal(clampIndex(9, 6), 5);
  assert.equal(clampIndex(-3, 6), 0);
  assert.equal(clampIndex(2.9, 6), 2);
  assert.equal(clampIndex(Number.NaN, 6), 0);
  assert.equal(clampIndex(1, 0), 0);
});

test('swipe and keyboard: same 45px threshold as Home, arrows only', () => {
  assert.equal(swipeDelta(300, 200), 1);
  assert.equal(swipeDelta(200, 300), -1);
  assert.equal(swipeDelta(300, 255), 0);
  assert.equal(swipeDelta(300, 254), 1);
  assert.equal(swipeDelta(null, 100), 0);
  assert.equal(keyDelta('ArrowRight'), 1);
  assert.equal(keyDelta('ArrowLeft'), -1);
  assert.equal(keyDelta('ArrowUp'), 0);
  assert.equal(keyDelta('Enter'), 0);
});

test('standing bitmoji url: same rules as Home', () => {
  assert.equal(getStandingBitmojiUrl(undefined), DEFAULT_STANDING_BITMOJI);
  assert.equal(getStandingBitmojiUrl('/avatars/me.png'), '/avatars/me.png');
  assert.equal(getStandingBitmojiUrl('https://api.dicebear.com/7.x/avataaars/svg?seed=a&radius=50&backgroundColor=ffffff'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=a');
  assert.equal(getStandingBitmojiUrl('https://x.test/a.svg?seed=a&radius=10'), 'https://x.test/a.svg?seed=a');
});

test('bitmoji for a session: signed-in users with an avatar only', () => {
  const user = (o: object) => ({ token: 'tok', user: { avatarUrl: '/avatars/me.png', isAnonymous: false, ...o } });
  assert.equal(bitmojiForSession(user({})), '/avatars/me.png');
  assert.equal(bitmojiForSession(null), null);
  assert.equal(bitmojiForSession(undefined), null);
  assert.equal(bitmojiForSession(user({ isAnonymous: true })), null, 'guest');
  assert.equal(bitmojiForSession(user({ avatarUrl: undefined })), null, 'no avatar');
  assert.equal(bitmojiForSession(user({ avatarUrl: '   ' })), null, 'blank avatar');
  assert.equal(bitmojiForSession({ token: '', user: { avatarUrl: '/avatars/me.png' } }), null, 'no token');
  assert.equal(bitmojiForSession({ token: 'tok', user: null }), null);
  assert.equal(bitmojiForSession(user({ avatarUrl: 'https://x.test/a.svg?seed=z&radius=5' })), 'https://x.test/a.svg?seed=z');
});
