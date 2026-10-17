import './_noRealDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogTitle, MatchmakerRequest, ProviderOffer } from '@synccinema/common';
import { rankCandidates, scoreTitle, choosePick, seededHash, timeLimitMinutes } from '../services/catalog/matchmaker.js';
import { CatalogService } from '../services/catalog/service.js';
import { fakeFetch, page, listMovie, tmdbMovieDetails } from './catalogFixtures.js';

const t = (id: number, o: Partial<CatalogTitle> = {}): CatalogTitle => ({
  id: `tmdb:movie:${id}`, source: 'tmdb', sourceId: String(id), mediaType: 'movie', title: `T${id}`, overview: '', posterPath: null, backdropPath: null,
  releaseDate: '2015-01-01', genres: [{ id: 35, name: 'Comedy' }], genreIds: [35], runtimeMinutes: 95, rating: 7.4, ratingSource: 'TMDB', voteCount: 2000, providers: [], region: 'IN', externalUrl: null, ...o
});
const req = (o: Partial<MatchmakerRequest> = {}): MatchmakerRequest => ({ mood: 'funny', time: 'longer', genres: [], providers: [], mode: 'group', seed: 'room-1', ...o });
const offer = (name: string, type: ProviderOffer['type'] = 'subscription'): ProviderOffer => ({ id: name, name, type, logoUrl: null, destinationUrl: null, verified: true });

test('deterministic: equal inputs and seed give identical output', () => {
  const pool = Array.from({ length: 20 }, (_, i) => t(i + 1, { rating: 7 + (i % 3) * 0.1 }));
  const a = rankCandidates(pool, { req: req() });
  const b = rankCandidates([...pool].reverse(), { req: req() });
  assert.deepEqual(a.picks.map((p) => p.title.id), b.picks.map((p) => p.title.id));
  assert.equal(a.pickIndex, b.pickIndex);
  assert.equal(a.picks.length, 6);
});

test('different seeds only change the tie-break, never the scores', () => {
  const pool = Array.from({ length: 12 }, (_, i) => t(i + 1));
  const a = rankCandidates(pool, { req: req({ seed: 'a' }) });
  const b = rankCandidates(pool, { req: req({ seed: 'b' }) });
  assert.deepEqual(a.picks.map((p) => p.score), b.picks.map((p) => p.score));
  assert.notDeepEqual(a.picks.map((p) => p.title.id), b.picks.map((p) => p.title.id));
});

test('mood weights drive the ranking', () => {
  const comedy = t(1, { genres: [{ id: 35, name: 'Comedy' }], genreIds: [35] });
  const horror = t(2, { genres: [{ id: 27, name: 'Horror' }], genreIds: [27] });
  assert.equal(rankCandidates([horror, comedy], { req: req({ mood: 'chill' }) }).picks[0].title.id, comedy.id);
  const thriller = t(3, { genres: [{ id: 53, name: 'Thriller' }], genreIds: [53] });
  assert.equal(rankCandidates([comedy, thriller], { req: req({ mood: 'thrilling' }) }).picks[0].title.id, thriller.id);
});

test('nostalgic rewards older releases', () => {
  const old = t(1, { releaseDate: '1995-06-01' });
  const recent = t(2, { releaseDate: '2022-06-01' });
  assert.equal(rankCandidates([recent, old], { req: req({ mood: 'nostalgic' }) }).picks[0].title.id, old.id);
});

test('time limits: known runtimes above the limit are removed, unknown runtime is penalised and unexplained', () => {
  const long = t(1, { runtimeMinutes: 150 });
  const fits = t(2, { runtimeMinutes: 85 });
  const unknown = t(3, { runtimeMinutes: null });
  const r = rankCandidates([long, fits, unknown], { req: req({ time: 'under90' }) });
  assert.deepEqual(r.picks.map((p) => p.title.id), [fits.id, unknown.id]);
  assert.match(r.picks[0].reason, /85 min, fits under 90/);
  assert.doesNotMatch(r.picks[1].reason, /min/);
  const ep = t(4, { mediaType: 'tv', runtimeMinutes: 25 });
  assert.ok(scoreTitle(ep, { req: req({ time: 'under30' }) }));
  assert.equal(scoreTitle(t(5, { mediaType: 'tv', runtimeMinutes: 55 }), { req: req({ time: 'under90' }) }), null);
  assert.equal(scoreTitle(t(6, { runtimeMinutes: 31 }), { req: req({ time: 'under30' }) }), null);
  assert.equal(timeLimitMinutes('longer'), null);
});

test('providers: verified offers are boosted, only when availability was checked', () => {
  const on = t(1);
  const off = t(2);
  const availability = new Map([[on.id, [offer('Netflix')]], [off.id, [offer('Prime Video')]]]);
  const r = rankCandidates([off, on], { req: req({ providers: ['netflix'] }), availability });
  assert.equal(r.picks[0].title.id, on.id);
  assert.match(r.picks[0].reason, /on Netflix/);
  const unchecked = scoreTitle(on, { req: req({ providers: ['netflix'] }) })!;
  assert.doesNotMatch(unchecked.reason, /Netflix/, 'no availability claim without verified data');
  const rent = scoreTitle(on, { req: req({ providers: ['netflix'] }), availability: new Map([[on.id, [offer('Netflix', 'rent')]]]) })!;
  assert.ok(rent.score < r.picks[0].score);
});

test('reasons are built only from matched criteria', () => {
  const x = t(1, { genres: [{ id: 35, name: 'Comedy' }, { id: 10751, name: 'Family' }], rating: 8.1, voteCount: 5000 });
  const s = scoreTitle(x, { req: req({ mood: 'funny', genres: [35] }) })!;
  assert.match(s.reason, /funny: Comedy/);
  assert.match(s.reason, /your genres: Comedy/);
  assert.match(s.reason, /TMDB 8.1/);
  assert.equal(scoreTitle(t(2, { genres: [], genreIds: [], rating: null, voteCount: 0 }), { req: req({ mode: 'solo' }) })!.reason, 'Closest overall match');
});

test('pick is deterministic per seed and "pick again" walks the shortlist', () => {
  const picks = [{ score: 9 }, { score: 8.5 }, { score: 8.2 }, { score: 5 }];
  assert.equal(choosePick(picks, 'seed', 0), choosePick(picks, 'seed', 0));
  assert.ok(choosePick(picks, 'seed', 0) < 3, 'first pick comes from the near-top pool');
  const seen = new Set([0, 1, 2, 3].map((n) => choosePick(picks, 'seed', n)));
  assert.equal(seen.size, 4);
  assert.equal(choosePick([], 's', 0), -1);
  assert.equal(seededHash('a'), seededHash('a'));
});

test('service.matchmaker returns real catalog candidates, time-limited, deterministic', async () => {
  const f = fakeFetch([
    ['/discover/movie', page([listMovie(603, { genre_ids: [35] }), listMovie(604, { genre_ids: [35] })])],
    ['/discover/tv', page([])],
    ['/movie/603?', { ...tmdbMovieDetails, genres: [{ id: 35, name: 'Comedy' }], runtime: 85 }],
    ['/movie/604?', { ...tmdbMovieDetails, id: 604, title: 'Long One', genres: [{ id: 35, name: 'Comedy' }], runtime: 140 }]
  ]);
  const s = new CatalogService({ TMDB_API_KEY: 'k' }, { fetchFn: f.fn });
  const r1 = await s.matchmaker(req({ time: 'under90' }));
  const r2 = await s.matchmaker(req({ time: 'under90' }));
  assert.deepEqual(r1.picks.map((p) => p.title.id), ['tmdb:movie:603']);
  assert.deepEqual(r1, r2);
  assert.equal(r1.availabilityChecked, false);
  assert.match(r1.method, /No AI/);
  assert.ok(f.calls.some((u) => u.includes('with_runtime.lte=90')));
});
