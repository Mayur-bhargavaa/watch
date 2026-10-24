import type { ProductTourState } from '@synccinema/common';

/** Bump this when the app gets a longer tour that people who already finished the first one should see again. */
export const TOUR_VERSION = 1;

export type TourAction = { kind: 'finish'; status: 'completed' | 'skipped' } | { kind: 'invalid' };

/** The body of PUT /api/user/tour: `{ status: 'completed' | 'skipped' }`. Anything else is refused. */
export function parseTourBody(body: unknown): TourAction {
  const status = (body as { status?: unknown } | null | undefined)?.status;
  return status === 'completed' || status === 'skipped' ? { kind: 'finish', status } : { kind: 'invalid' };
}

export function buildTourState(status: 'completed' | 'skipped', now: Date = new Date()): ProductTourState {
  return { status, version: TOUR_VERSION, at: now.toISOString() };
}

/** Whether this account still has to see the tour (nothing stored, or a tour older than the current version). */
export function tourNeeded(state: ProductTourState | null | undefined): boolean {
  return !state || state.version < TOUR_VERSION;
}
