// One-off migration: replace legacy PLAINTEXT passwords in MongoDB with scrypt hashes.
// The server also upgrades a row on that user's next successful login, but accounts that never log
// in again would otherwise stay plaintext at rest.
//
//   MONGODB_URI=... node scripts/hash-legacy-passwords.mjs            # dry run, prints counts only
//   MONGODB_URI=... node scripts/hash-legacy-passwords.mjs --apply    # write the hashes
//
// Format must match apps/server/src/util/password.ts:  scrypt$<salt b64>$<key b64>  (64-byte key)
import { MongoClient } from 'mongodb';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

const client = new MongoClient(uri);
await client.connect();
const users = client.db(process.env.MONGODB_DB || 'stitchbyte_watch_party').collection('users');

let legacy = 0;
let migrated = 0;
for await (const doc of users.find({ passwordHash: { $type: 'string', $not: /^scrypt\$/ } })) {
  legacy++;
  if (!apply) continue;
  const salt = randomBytes(16);
  const key = await scrypt(doc.passwordHash, salt, 64);
  const hash = `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
  const res = await users.updateOne({ _id: doc._id, passwordHash: doc.passwordHash }, { $set: { passwordHash: hash } });
  migrated += res.modifiedCount;
}
console.log(`${legacy} account(s) with a plaintext password${apply ? `, ${migrated} migrated` : ' (dry run, nothing written; pass --apply)'}.`);
await client.close();
