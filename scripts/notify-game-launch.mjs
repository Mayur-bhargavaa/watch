#!/usr/bin/env node
/**
 * Flags everyone who asked to be notified about a coming-soon game. The running server's launch job (60 s tick) then
 * sends each of them one push + in-app notification "<Game> is now live" and deletes the row.
 *
 *   node scripts/notify-game-launch.mjs <gameId>            dry run: only counts
 *   node scripts/notify-game-launch.mjs <gameId> --apply    flag the rows
 *
 * Needs the server environment (MONGODB_URI), e.g. run from apps/server with its .env loaded.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, 'apps/server/.env');
if (!process.env.MONGODB_URI && existsSync(envFile)) process.loadEnvFile(envFile);
const { MongoClient } = createRequire(resolve(root, 'apps/server/package.json'))('mongodb');

const [gameId, ...flags] = process.argv.slice(2);
const apply = flags.includes('--apply');
if (!gameId || gameId.startsWith('-')) {
  console.error('usage: node scripts/notify-game-launch.mjs <gameId> [--apply]');
  process.exit(2);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set.');
  process.exit(2);
}
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const col = client.db('stitchbyte_watch_party').collection('game_interest');
  const total = await col.countDocuments({ gameId });
  if (!apply) {
    console.log(`[dry run] ${total} user(s) asked to be notified about "${gameId}". Re-run with --apply to send.`);
  } else {
    const r = await col.updateMany({ gameId }, { $set: { notifyPending: true } });
    console.log(`Flagged ${r.matchedCount} user(s) for "${gameId}". The server sends the notifications within about a minute.`);
  }
} finally {
  await client.close();
}
