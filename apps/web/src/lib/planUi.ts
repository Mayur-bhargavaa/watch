import { PLAN_TIMEZONES, getPlanWindow } from '@synccinema/common';
import type { Plan } from '../types/plans';
import type { IconName } from '../components/ui/AppIcon';

export type PlanFilter = 'ALL' | 'movie' | 'game' | 'birthday' | 'other';

type Kind = 'movie' | 'game';

/** Which of movie/game the plan's steps are made of (null when empty, mixed, or only hangouts). */
export function inferStepKind(activities: Pick<Plan['activities'][number], 'type'>[] | undefined): Kind | null {
  const kinds = new Set((activities || []).map((a) => a.type));
  const hasMovie = kinds.has('movie');
  const hasGame = kinds.has('game');
  if (hasMovie && !hasGame) return 'movie';
  if (hasGame && !hasMovie) return 'game';
  return null;
}

/** One category per plan. What the plan actually contains wins over the occasion that was picked first. */
export function planCategory(plan: Pick<Plan, 'type'> & { activities?: Plan['activities'] }): Exclude<PlanFilter, 'ALL'> {
  const kind = inferStepKind(plan.activities);
  if (kind) return kind;
  if (plan.type === 'movie') return 'movie';
  if (plan.type === 'game') return 'game';
  if (plan.type === 'birthday') return 'birthday';
  return 'other';
}

const TYPE_ICONS: Record<Plan['type'], IconName> = {
  movie: 'movie',
  game: 'game',
  birthday: 'cake',
  anniversary: 'heart',
  party: 'party',
  hangout: 'coffee',
  custom: 'sparkles'
};

/** The icon to show: what the steps are made of wins over the occasion; a plan with both movies and games is generic. */
export function planIconName(plan: Pick<Plan, 'type'> & { activities?: Plan['activities'] }): IconName {
  const kind = inferStepKind(plan.activities);
  if (kind === 'game') return 'game';
  if (kind === 'movie') return 'movie';
  const kinds = new Set((plan.activities || []).map((a) => a.type));
  if (kinds.has('movie') && kinds.has('game')) return 'sparkles';
  return TYPE_ICONS[plan.type] || 'sparkles';
}

export function countPlans(plans: Plan[]) {
  const counts = { all: plans.length, movies: 0, games: 0, birthdays: 0, other: 0 };
  for (const p of plans) {
    const c = planCategory(p);
    if (c === 'movie') counts.movies++;
    else if (c === 'game') counts.games++;
    else if (c === 'birthday') counts.birthdays++;
    else counts.other++;
  }
  return counts;
}

export function matchesFilter(plan: Plan, filter: string): boolean {
  return filter === 'ALL' || planCategory(plan) === filter;
}

const TYPE_LABELS: Record<Plan['type'], string> = {
  movie: 'Movie night',
  game: 'Game night',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  party: 'Party',
  hangout: 'Hangout',
  custom: 'Event'
};

/** Badge text from what the plan really contains ("Movie + Game" only when it has both). */
export function planBadgeLabel(plan: Plan): string {
  if (plan.tagLabel) return plan.tagLabel;
  const kinds = new Set((plan.activities || []).map((a) => a.type));
  if (kinds.has('movie') && kinds.has('game')) return 'Movie + Game';
  const kind = inferStepKind(plan.activities);
  if (kind) return TYPE_LABELS[kind];
  return TYPE_LABELS[plan.type] || 'Event';
}

export function participantCounts(plan: Pick<Plan, 'participants'>) {
  const list = plan.participants || [];
  return {
    going: list.filter((p) => p.status === 'GOING').length,
    maybe: list.filter((p) => p.status === 'MAYBE').length,
    cantGo: list.filter((p) => p.status === 'CANT_GO').length,
    invited: list.filter((p) => p.status === 'INVITED' || !p.status).length,
    total: list.length
  };
}

export function initialsOf(name: string | undefined | null): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The user's own timezone as a plan timezone label, e.g. "IST (UTC+5:30)". */
export function guessTimezoneLabel(now: Date = new Date()): string {
  const offset = -now.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const text = `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? ':' + String(abs % 60).padStart(2, '0') : ''}`;
  return PLAN_TIMEZONES.find((t) => t.value.endsWith(`(${text})`))?.value || text;
}

/** The plan's start in the viewer's own timezone ("Sun, 27 Sep, 9:00 pm GMT+5:30"). */
export function localStartLabel(plan: Pick<Plan, 'date' | 'time' | 'endTime' | 'timezone'>, locale?: string): string | null {
  const w = getPlanWindow(plan);
  if (!w) return null;
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(w.startMs));
}

/** Activity buttons may only open pages of this app (plans created before the server check could hold any link). */
export function safeActionUrl(url: string | undefined | null, fallback = '/rooms'): string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : fallback;
}
