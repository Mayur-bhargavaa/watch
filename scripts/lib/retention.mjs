/**
 * Pure retention maths for scripts/retention-report.mjs (no I/O, so it is unit tested).
 * A rough guide for "is the free tier already enough?", not analytics.
 */
const DAY = 86_400_000;

export const toMs = (v) => {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string' && v) {
    const t = /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};
const dayIndex = (ms) => Math.floor(ms / DAY);
const share = (n, d) => (d > 0 ? n / d : null);

/**
 * input: {
 *   users: [{ id, createdAt }],
 *   events: [{ userId, at }]                 // any dated activity by a person (logs, messages sent, plans hosted, streak days)
 *   plans: [{ hostId }],
 *   streaks: [{ userIds: [a, b], currentStreak, lastWatchedDate }],
 *   friendships: [{ userIds: [a, b], status }],
 *   now: ms
 * }
 */
export function computeRetention({ users = [], events = [], plans = [], streaks = [], friendships = [], now = Date.now() }) {
  const signup = new Map();
  for (const u of users) {
    const t = toMs(u.createdAt);
    if (u.id && t) signup.set(String(u.id), t);
  }
  // activity day sets per known user
  const days = new Map();
  const lastSeen = new Map();
  for (const e of events) {
    const id = e && e.userId != null ? String(e.userId) : '';
    const t = toMs(e?.at);
    if (!id || !t || !signup.has(id) || t > now) continue;
    if (!days.has(id)) days.set(id, new Set());
    days.get(id).add(dayIndex(t));
    if (!(lastSeen.get(id) >= t)) lastSeen.set(id, t);
  }
  const activeSince = (ms) => [...lastSeen.entries()].filter(([, t]) => t >= now - ms).map(([id]) => id);
  const weeklyActive = activeSince(7 * DAY);
  const monthlyActive = activeSince(30 * DAY);

  const ret = {};
  for (const n of [1, 7, 30]) {
    let eligible = 0, returned = 0;
    for (const [id, t] of signup) {
      if (now < t + (n + 1) * DAY) continue; // day N is not over yet
      eligible++;
      if (days.get(id)?.has(dayIndex(t) + n)) returned++;
    }
    ret[`d${n}`] = { eligible, returned, rate: share(returned, eligible) };
  }

  const wauSet = new Set(weeklyActive);
  const plansByHost = new Map();
  for (const p of plans) if (p?.hostId) plansByHost.set(String(p.hostId), (plansByHost.get(String(p.hostId)) || 0) + 1);
  const plansByActive = weeklyActive.reduce((s, id) => s + (plansByHost.get(id) || 0), 0);

  const today = dayIndex(now);
  const streakUsers = new Set();
  for (const s of streaks) {
    const last = toMs(s?.lastWatchedDate);
    if (!(s?.currentStreak > 0) || !last || dayIndex(last) < today - 1) continue; // same rule as effectiveStreak: alive today or yesterday
    for (const id of s.userIds || []) streakUsers.add(String(id));
  }
  const friendUsers = new Set();
  for (const f of friendships) {
    if (f?.status && f.status !== 'ACCEPTED') continue;
    for (const id of f.userIds || []) friendUsers.add(String(id));
  }

  const metrics = {
    users: signup.size,
    weeklyActiveUsers: wauSet.size,
    monthlyActiveUsers: monthlyActive.length,
    returnRate: ret,
    plansCreated: plans.length,
    plansPerActiveUser: share(plansByActive, wauSet.size),
    hostsNearFreeCap: [...plansByHost.values()].filter((c) => c >= 8).length,
    activeWithStreakShare: share(weeklyActive.filter((id) => streakUsers.has(id)).length, wauSet.size),
    activeWithFriendsShare: share(weeklyActive.filter((id) => friendUsers.has(id)).length, wauSet.size)
  };
  return { ...metrics, verdict: verdict(metrics) };
}

/** Rough decision aid. Thresholds are guesses: tune them to your own goals. */
export function verdict(m) {
  const caveat = 'Rough guide only: small samples and incomplete activity data (logs exist only while the activity logger was connected) can mislead. Talk to your users before pricing.';
  if (m.users < 50 || m.weeklyActiveUsers < 15) {
    return { label: 'not enough data', signals: 0, reasons: [`only ${m.users} users and ${m.weeklyActiveUsers} weekly active; wait for more before judging`], caveat };
  }
  const reasons = [];
  const checks = [
    [m.returnRate.d7.rate !== null && m.returnRate.d7.rate >= 0.2, `D7 return ${pct(m.returnRate.d7.rate)} (target 20%+)`],
    [m.activeWithStreakShare !== null && m.activeWithStreakShare >= 0.25, `active users with a live streak ${pct(m.activeWithStreakShare)} (target 25%+)`],
    [m.plansPerActiveUser !== null && m.plansPerActiveUser >= 1, `plans per active user ${m.plansPerActiveUser === null ? 'n/a' : m.plansPerActiveUser.toFixed(2)} (target 1+)`],
    [m.activeWithFriendsShare !== null && m.activeWithFriendsShare >= 0.6, `active users with friends ${pct(m.activeWithFriendsShare)} (target 60%+)`],
    [m.hostsNearFreeCap >= 3, `${m.hostsNearFreeCap} hosts near the free plan cap (target 3+)`]
  ];
  let signals = 0;
  for (const [ok, text] of checks) { if (ok) signals++; reasons.push(`${ok ? 'signal' : 'weak'}: ${text}`); }
  return signals >= 3
    ? { label: 'monetisable signals', signals, reasons, caveat }
    : { label: 'free tier probably enough', signals, reasons, caveat };
}

export const pct = (r) => (r === null || r === undefined ? 'n/a' : `${Math.round(r * 1000) / 10}%`);
