#!/usr/bin/env node
/**
 * READ-ONLY retention report for the Watch+ go-live decision (see BILLING.md "Validate retention before charging").
 * Run it yourself against YOUR OWN database:   MONGODB_URI=... npm run retention:report
 * It only issues find/count queries through a wrapper that exposes no write method. It prints no connection string.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { computeRetention, pct } from './lib/retention.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#') || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnvFile(join(ROOT, 'apps/server/.env'));

console.log('==============================================================');
console.log(' READ-ONLY retention report. No data is written or changed.');
console.log(' Run it against your own database only.');
console.log('==============================================================');

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(2); }

const require = createRequire(join(ROOT, 'apps/server/package.json'));
const { MongoClient } = require('mongodb');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred', appName: 'retention-report-readonly' });

/** Only reads are reachable from the report code. */
const readOnly = (db, name) => {
  const col = db.collection(name);
  return { find: (q, o) => col.find(q, o), countDocuments: (q) => col.countDocuments(q) };
};

try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'stitchbyte_watch_party');
  const users = await readOnly(db, 'users').find({}, { projection: { _id: 1, createdAt: 1 } }).toArray();
  const logs = await readOnly(db, 'party_activity_logs').find({ 'data.userId': { $exists: true } }, { projection: { epochMs: 1, 'data.userId': 1 } }).toArray();
  const dms = await readOnly(db, 'direct_messages').find({}, { projection: { senderId: 1, createdAt: 1 } }).toArray();
  const plans = await readOnly(db, 'plans').find({}, { projection: { hostId: 1, createdAt: 1 } }).toArray();
  const streaks = await readOnly(db, 'friend_streaks').find({}, { projection: { userIds: 1, currentStreak: 1, lastWatchedDate: 1 } }).toArray();
  const friendships = await readOnly(db, 'friendships').find({}, { projection: { userIds: 1, status: 1 } }).toArray();

  const events = [
    ...logs.map((l) => ({ userId: l.data?.userId, at: l.epochMs })),
    ...dms.map((d) => ({ userId: d.senderId, at: d.createdAt })),
    ...plans.map((p) => ({ userId: p.hostId, at: p.createdAt })),
    ...streaks.flatMap((s) => (s.userIds || []).map((id) => ({ userId: id, at: s.lastWatchedDate })))
  ];
  const r = computeRetention({
    users: users.map((u) => ({ id: u._id, createdAt: u.createdAt })),
    events,
    plans: plans.map((p) => ({ hostId: p.hostId })),
    streaks, friendships, now: Date.now()
  });

  const row = (k, v) => console.log(`  ${k.padEnd(38)} ${v}`);
  console.log(`\nData sources: users ${users.length}, activity logs ${logs.length}, direct messages ${dms.length}, plans ${plans.length}, streaks ${streaks.length}, friendships ${friendships.length}\n`);
  row('Users', r.users);
  row('Weekly active users (7d)', r.weeklyActiveUsers);
  row('Monthly active users (30d)', r.monthlyActiveUsers);
  for (const n of [1, 7, 30]) {
    const x = r.returnRate[`d${n}`];
    row(`D${n} return`, `${pct(x.rate)}  (${x.returned} of ${x.eligible} eligible signups)`);
  }
  row('Plans created (all time)', r.plansCreated);
  row('Plans per weekly active user', r.plansPerActiveUser === null ? 'n/a' : r.plansPerActiveUser.toFixed(2));
  row('Hosts near the free plan cap (8+)', r.hostsNearFreeCap);
  row('Active users with a live streak', pct(r.activeWithStreakShare));
  row('Active users with friends', pct(r.activeWithFriendsShare));
  console.log(`\nVERDICT: ${r.verdict.label}  (${r.verdict.signals} signals)`);
  for (const x of r.verdict.reasons) console.log(`  - ${x}`);
  console.log(`\n${r.verdict.caveat}`);
} catch (err) {
  console.error('Report failed:', err && err.message ? String(err.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]') : 'unknown error');
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
