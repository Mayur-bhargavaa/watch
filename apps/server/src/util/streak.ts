/**
 * A streak is only alive if the pair was active today or yesterday. A stored counter older than that is broken:
 * showing it ("2 days", "expires today") after a missed day was a bug. The counter itself is reset when the next
 * session is recorded; reads just must not report a dead streak as alive.
 */
export function effectiveStreak(
  stored: { currentStreak?: number; lastWatchedDate?: string | null } | null | undefined,
  today: string,
  yesterday: string
): { currentStreak: number; completedToday: boolean; atRisk: boolean } {
  const last = stored?.lastWatchedDate || null;
  const completedToday = last === today;
  const alive = completedToday || last === yesterday;
  const currentStreak = alive ? stored?.currentStreak || 0 : 0;
  // "At risk" = alive from yesterday but today's session has not happened yet
  const atRisk = !completedToday && last === yesterday && currentStreak > 0;
  return { currentStreak, completedToday, atRisk };
}
