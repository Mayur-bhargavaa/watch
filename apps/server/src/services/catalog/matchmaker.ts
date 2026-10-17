import { providerKey, type CatalogTitle, type MatchMood, type MatchTime, type MatchmakerPick, type MatchmakerRequest } from '@synccinema/common';

/**
 * Watch Party Matchmaker: a DETERMINISTIC, rule-based scorer (no AI, no randomness, no learning).
 *
 *   score = mood + genre preference + time fit + quality + provider boost + audience fit
 *
 *  - mood            sum of genre weights from MOOD_GENRE_WEIGHTS (capped at 6); "nostalgic" also rewards older releases
 *  - genre preference +2 for each preferred genre the title has (capped at +4)
 *  - time fit        under30: runtime <= 30; under90: runtime <= 90 (a TV episode <= 45 counts, two episodes fit); longer: no limit.
 *                    A KNOWN runtime above the limit removes the title; an unknown runtime costs 1.5 points and no time reason is given.
 *  - quality         +0..2 from the TMDB rating when it has >= 100 votes
 *  - provider boost  +4 for a verified subscription/free offer on a selected provider, +1.5 for rent/buy (only with verified data)
 *  - audience fit    group: +1 for widely-loved titles (rating >= 7 with >= 1000 votes); solo: +1 for niche ones (rating >= 7.3, < 1500 votes)
 *
 * Ties are broken by a seeded hash (seed + title id), so equal inputs and equal seeds always give identical output
 * and two members using the same seed see the same shortlist order. The "pick" is chosen among the top scorers within
 * 1 point of the best score with the same seeded hash.
 */
export const MOOD_GENRE_WEIGHTS: Record<MatchMood, Record<number, number>> = {
  chill: { 35: 2, 10751: 2, 16: 1, 10749: 1, 99: 1, 10402: 1, 18: 0.5, 27: -2, 53: -1, 10752: -1 },
  thrilling: { 53: 3, 28: 2, 80: 2, 27: 1, 9648: 1, 12: 1, 10759: 2 },
  funny: { 35: 3, 16: 1, 10751: 1 },
  romantic: { 10749: 3, 18: 1, 35: 1, 10402: 0.5 },
  'mind-bending': { 878: 3, 9648: 3, 53: 2, 14: 1, 10765: 3 },
  nostalgic: { 10751: 1, 16: 1, 12: 1, 35: 0.5 }
};
export const MOOD_LABEL: Record<MatchMood, string> = { chill: 'chill', thrilling: 'thrilling', funny: 'funny', romantic: 'romantic', 'mind-bending': 'mind-bending', nostalgic: 'nostalgic' };
/** Genres used to fetch candidates for a mood (OR). */
export function moodSeedGenres(mood: MatchMood): number[] {
  return Object.entries(MOOD_GENRE_WEIGHTS[mood]).filter(([, w]) => w >= 1).map(([id]) => Number(id));
}
export function timeLimitMinutes(time: MatchTime): number | null {
  return time === 'under30' ? 30 : time === 'under90' ? 90 : null;
}

/** FNV-1a 32-bit, used only for the seeded tie-break. */
export function seededHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function timeFit(t: CatalogTitle, time: MatchTime): { ok: boolean; delta: number; reason: string | null } {
  const limit = timeLimitMinutes(time);
  if (limit === null) return { ok: true, delta: t.runtimeMinutes && t.runtimeMinutes >= 100 ? 1 : 0, reason: t.runtimeMinutes && t.runtimeMinutes >= 100 ? 'room for a long one' : null };
  const rt = t.runtimeMinutes;
  if (rt === null) return { ok: true, delta: -1.5, reason: null };
  const allowed = t.mediaType === 'tv' ? (time === 'under30' ? 30 : 45) : limit;
  if (rt > allowed) return { ok: false, delta: 0, reason: null };
  return { ok: true, delta: 1.5, reason: t.mediaType === 'tv' ? `${rt} min episodes` : `${rt} min, fits under ${limit}` };
}

export interface ScoreContext {
  req: MatchmakerRequest;
  /** providers verified per title id; undefined when availability was not checked */
  availability?: Map<string, CatalogTitle['providers']>;
}

export function scoreTitle(t: CatalogTitle, ctx: ScoreContext): { score: number; reason: string } | null {
  const { req } = ctx;
  const reasons: string[] = [];
  let score = 0;

  const fit = timeFit(t, req.time);
  if (!fit.ok) return null;
  score += fit.delta;

  const weights = MOOD_GENRE_WEIGHTS[req.mood];
  const ids = t.genreIds ?? t.genres.map((g) => g.id);
  let mood = 0;
  const moodNames: string[] = [];
  for (const g of t.genres) {
    const w = weights[g.id];
    if (w) {
      mood += w;
      if (w > 0) moodNames.push(g.name);
    }
  }
  if (req.mood === 'nostalgic' && t.releaseDate) {
    const y = Number(t.releaseDate.slice(0, 4));
    const bonus = y <= 2000 ? 3 : y <= 2010 ? 2 : 0;
    if (bonus) {
      mood += bonus;
      moodNames.push(`from ${y}`);
    }
  }
  mood = Math.min(6, mood);
  score += mood;
  if (mood > 0 && moodNames.length) reasons.push(`${MOOD_LABEL[req.mood]}: ${moodNames.slice(0, 2).join(', ')}`);

  const prefMatches = t.genres.filter((g) => req.genres.includes(g.id));
  if (prefMatches.length) {
    score += Math.min(4, prefMatches.length * 2);
    reasons.push(`your genres: ${prefMatches.map((g) => g.name).slice(0, 2).join(', ')}`);
  }
  void ids;

  if (fit.reason) reasons.push(fit.reason);

  if (t.rating !== null && t.voteCount >= 100) {
    score += Math.max(0, Math.min(2, (t.rating - 6) * 0.8));
    if (t.rating >= 7.5) reasons.push(`TMDB ${t.rating.toFixed(1)}`);
  }

  if (req.providers.length && ctx.availability) {
    const wanted = new Set(req.providers.map((p) => providerKey(p)));
    const offers = (ctx.availability.get(t.id) ?? []).filter((o) => o.verified && wanted.has(providerKey(o.name)));
    const flat = offers.find((o) => o.type === 'subscription' || o.type === 'free');
    if (flat) {
      score += 4;
      reasons.push(`on ${flat.name}`);
    } else if (offers[0]) {
      score += 1.5;
      reasons.push(`${offers[0].type} on ${offers[0].name}`);
    }
  }

  if (req.mode === 'group' && t.rating !== null && t.rating >= 7 && t.voteCount >= 1000) {
    score += 1;
    reasons.push('a safe group pick');
  } else if (req.mode === 'solo' && t.rating !== null && t.rating >= 7.3 && t.voteCount < 1500) {
    score += 1;
    reasons.push('a lesser-known find');
  }

  return { score: Math.round(score * 100) / 100, reason: reasons.length ? reasons.join(' · ') : 'Closest overall match' };
}

export interface MatchResult {
  picks: MatchmakerPick[];
  pickIndex: number;
}

export function rankCandidates(candidates: CatalogTitle[], ctx: ScoreContext, shortlist = 6): MatchResult {
  const scored: Array<MatchmakerPick & { tie: number }> = [];
  const seen = new Set<string>();
  for (const t of candidates) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const s = scoreTitle(t, ctx);
    if (s) scored.push({ title: t, score: s.score, reason: s.reason, tie: seededHash(`${ctx.req.seed}|${t.id}`) });
  }
  scored.sort((a, b) => b.score - a.score || a.tie - b.tie || a.title.id.localeCompare(b.title.id));
  const picks = scored.slice(0, shortlist).map(({ tie: _t, ...p }) => p);
  return { picks, pickIndex: choosePick(picks, ctx.req.seed, 0) };
}

/** Deterministic pick among shortlisted titles within 1 point of the best score; `attempt` implements "Pick again". */
export function choosePick(picks: Array<{ score: number }>, seed: string, attempt: number): number {
  if (!picks.length) return -1;
  const best = picks[0].score;
  const pool = Math.max(1, Math.min(picks.filter((p) => best - p.score <= 1).length, 3));
  const first = seededHash(seed) % pool;
  // "Pick again" steps through the whole shortlist from the first pick, so every attempt shows a different title
  return (first + Math.max(0, attempt)) % picks.length;
}
