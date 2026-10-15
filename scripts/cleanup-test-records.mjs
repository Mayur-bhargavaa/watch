#!/usr/bin/env node
/**
 * Finds (and, only when asked, deletes) leftovers that automated test runs may have written into a REAL database.
 * It exists because some game tests once ran against the live cluster (see GAMES_BUGS.md). Run it yourself against your
 * own MongoDB: nothing in this repo runs it for you.
 *
 *   node scripts/cleanup-test-records.mjs                      # dry run: only reports
 *   node scripts/cleanup-test-records.mjs --apply --yes        # deletes the orphan streak records it listed
 *   node scripts/cleanup-test-records.mjs --logs-from 2026-10-14T00:00:00Z --logs-to 2026-10-16T00:00:00Z
 *                                                              # reports activity logs in that window (what to review)
 *   node scripts/cleanup-test-records.mjs --logs-from ... --logs-to ... --apply --yes --delete-logs
 *                                                              # also deletes the logs in that window (be sure first!)
 *
 * What counts as a leftover:
 *  - friend_streaks whose users do not exist in `users` at all (a real streak always belongs to two real accounts;
 *    the test one was between the made-up ids "guest" and "host").
 *  - party_activity_logs inside the time window you give (you know when the tests ran; logs have no owner field to tell
 *    test entries from real ones, so they are never touched unless you pass --delete-logs AND a window).
 * MONGODB_URI is read from the environment or from apps/server/.env. The URI is never printed.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const apply = flag('--apply');
const yes = flag('--yes');
const deleteLogs = flag('--delete-logs');
const from = val('--logs-from');
const to = val('--logs-to');

if (!process.env.MONGODB_URI) {
  const envFile = resolve(process.cwd(), 'apps/server/.env');
  if (existsSync(envFile)) { try { process.loadEnvFile(envFile); } catch {} }
}
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set (put it in the environment or apps/server/.env).'); process.exit(2); }
if (apply && !yes) { console.error('--apply needs --yes as a second confirmation. Nothing was changed.'); process.exit(2); }
if (deleteLogs && (!from || !to)) { console.error('--delete-logs needs --logs-from and --logs-to. Nothing was changed.'); process.exit(2); }
for (const t of [from, to].filter(Boolean)) if (Number.isNaN(Date.parse(t))) { console.error(`Not a date: ${t}`); process.exit(2); }

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
console.log(apply ? 'MODE: APPLY (will delete what is listed below)' : 'MODE: dry run (nothing is changed)');
try {
  await client.connect();
  const db = client.db('stitchbyte_watch_party');

  // 1. streak records between users that do not exist
  const streaks = await db.collection('friend_streaks').find({}).toArray();
  const ids = new Set();
  for (const s of streaks) for (const id of [s.userId1, s.userId2, ...(s.userIds || [])]) if (id) ids.add(String(id));
  const existing = new Set((await db.collection('users').find({ _id: { $in: [...ids] } }, { projection: { _id: 1 } }).toArray()).map((u) => String(u._id)));
  const orphans = streaks.filter((s) => {
    const members = [s.userId1, s.userId2, ...(s.userIds || [])].filter(Boolean).map(String);
    return members.length > 0 && members.some((m) => !existing.has(m));
  });
  console.log(`\nfriend_streaks: ${streaks.length} total, ${orphans.length} refer to users that do not exist`);
  for (const s of orphans.slice(0, 50)) console.log(`  - ${s._id}  users: ${[s.userId1, s.userId2].filter(Boolean).join(' / ')}  last: ${s.lastWatchedDate || '-'}`);
  if (apply && orphans.length) {
    const r = await db.collection('friend_streaks').deleteMany({ _id: { $in: orphans.map((s) => s._id) } });
    console.log(`  deleted ${r.deletedCount} streak record(s)`);
  }

  // 2. activity logs in a window (report only unless --delete-logs)
  if (from && to) {
    const query = { epochMs: { $gte: Date.parse(from), $lt: Date.parse(to) } };
    const logs = db.collection('party_activity_logs');
    const byType = await logs.aggregate([{ $match: query }, { $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
    const total = byType.reduce((a, b) => a + b.n, 0);
    console.log(`\nparty_activity_logs between ${from} and ${to}: ${total} entries`);
    for (const t of byType) console.log(`  ${String(t._id).padEnd(30)} ${t.n}`);
    console.log('  (these include real activity from real people in that window: review before deleting)');
    if (apply && deleteLogs && total) {
      const r = await logs.deleteMany(query);
      console.log(`  deleted ${r.deletedCount} log entr${r.deletedCount === 1 ? 'y' : 'ies'}`);
    } else if (deleteLogs && !apply) {
      console.log('  (dry run: add --apply --yes to delete them)');
    }
  } else {
    console.log('\nActivity logs: pass --logs-from and --logs-to (the hours when the tests ran) to review them.');
  }
} finally {
  await client.close();
}
