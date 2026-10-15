// Pure helpers for the Tambola page (90-ball housie).

export type TambolaPrize = 'early5' | 'topLine' | 'middleLine' | 'bottomLine' | 'fourCorners' | 'housefull';

export const TAMBOLA_PRIZES: { id: TambolaPrize; label: string }[] = [
  { id: 'housefull', label: 'Housefull' },
  { id: 'topLine', label: 'Top Line' },
  { id: 'middleLine', label: 'Middle Line' },
  { id: 'bottomLine', label: 'Bottom Line' },
  { id: 'fourCorners', label: 'Four Corners' },
  { id: 'early5', label: 'Early 5' }
];

type Cells = (number | null)[][];

function rowNums(cells: Cells, r: number): number[] {
  return (cells[r] || []).filter((n): n is number => typeof n === 'number');
}

/** Numbers on the ticket that a prize needs; early5 needs any 5 of all numbers. */
export function prizeTargets(cells: Cells, prize: TambolaPrize): number[] {
  const r0 = rowNums(cells, 0);
  const r2 = rowNums(cells, 2);
  switch (prize) {
    case 'topLine': return r0;
    case 'middleLine': return rowNums(cells, 1);
    case 'bottomLine': return r2;
    case 'fourCorners':
      return [r0[0], r0[r0.length - 1], r2[0], r2[r2.length - 1]].filter((n): n is number => typeof n === 'number');
    default:
      return [0, 1, 2].flatMap((r) => rowNums(cells, r));
  }
}

/** Progress of one prize measured against the numbers that were actually called. */
export function prizeProgress(cells: Cells, prize: TambolaPrize, called: Set<number>): { current: number; total: number; met: boolean } {
  const targets = prizeTargets(cells, prize);
  const hit = targets.filter((n) => called.has(n)).length;
  const total = prize === 'early5' ? 5 : targets.length;
  return { current: Math.min(hit, total), total, met: total > 0 && hit >= total };
}

/** Prizes that are enabled, not yet claimed by anyone and complete on the called numbers (priority order). */
export function claimablePrizes(
  cells: Cells,
  called: Set<number>,
  claimed: Record<string, unknown> | undefined | null,
  enabled: Record<string, boolean> | undefined | null
): TambolaPrize[] {
  return TAMBOLA_PRIZES.filter(({ id }) => {
    if (enabled && !enabled[id]) return false;
    if (claimed && claimed[id]) return false;
    return prizeProgress(cells, id, called).met;
  }).map((p) => p.id);
}

/** Most recent calls first, limited to `count` (default 5). Input is chronological. */
export function recentCalls(calledNumbers: number[] | undefined | null, count = 5): number[] {
  const list = Array.isArray(calledNumbers) ? calledNumbers : [];
  return list.slice(-count).reverse();
}

/** Final scoreboard rows sorted by score desc with display names resolved from players/playerNames. */
export function scoreboard(
  scores: Record<string, number>,
  names: Record<string, string | undefined>
): { userId: string; name: string; score: number }[] {
  return Object.entries(scores || {})
    .map(([userId, score]) => ({ userId, name: names[userId] || 'Player', score: Number(score) || 0 }))
    .sort((a, b) => b.score - a.score);
}

/** Distinct accent colours for up to 20 seats (cycles beyond). */
export const SEAT_COLORS = [
  '#ff3864', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#ef4444', '#84cc16',
  '#f97316', '#06b6d4', '#a855f7', '#22c55e', '#eab308', '#e11d48', '#3b82f6', '#d946ef', '#65a30d', '#0d9488'
];
export function seatColor(index: number): string {
  const i = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  return SEAT_COLORS[i % SEAT_COLORS.length];
}
