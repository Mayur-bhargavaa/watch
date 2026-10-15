#!/usr/bin/env node
/**
 * One-time "this game is live" email to the people who tapped "Notify me" for it.
 * RUN THIS YOURSELF: it reads your real database and sends real email. Nothing here runs automatically.
 *
 *   node scripts/email-game-launch.mjs <gameId> --preview            writes scripts/previews/<gameId>.html and prints the text version (no DB, no SMTP)
 *   node scripts/email-game-launch.mjs <gameId> --test-to you@x.com  sends ONE sample to that address (SMTP only, no DB)
 *   node scripts/email-game-launch.mjs <gameId>                      dry run: counts recipients and shows masked addresses (reads the DB, sends nothing)
 *   node scripts/email-game-launch.mjs <gameId> --send [--limit N]   sends for real (add --company/--address/--contact to fill the footer without editing legal.ts), one every ~1.2 s, and marks each row emailedAt so nobody gets it twice
 *
 * Run it BEFORE scripts/notify-game-launch.mjs: that script's server job deletes the interest rows after the in-app push.
 * Needs apps/server/.env (MONGODB_URI, SMTP_* / MAIL_FROM, WEB_BASE_URL). Fill in the company details in apps/web/src/lib/legal.ts
 * first: a bulk email must show who sent it (the script refuses to --send while they are TODO placeholders).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_EMAILS, renderGameLaunchEmail } from './lib/game-launch-email.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const gameId = args.find((a) => !a.startsWith('-'));
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!gameId || !GAME_EMAILS[gameId]) {
  console.error(`usage: node scripts/email-game-launch.mjs <${Object.keys(GAME_EMAILS).join('|')}> [--preview | --test-to addr | --send [--limit N]]`);
  process.exit(2);
}

/** The sender block comes from apps/web/src/lib/legal.ts (parsed as text so this script needs no TypeScript). */
function readSender() {
  const src = readFileSync(resolve(root, 'apps/web/src/lib/legal.ts'), 'utf8');
  const pick = (k) => new RegExp(`${k}:\\s*'([^']*)'`).exec(src)?.[1] || '';
  return { companyName: pick('companyName'), address: pick('address'), contactEmail: pick('contactEmail') };
}
const isTodo = (v) => !v || v.startsWith('TODO');
const mask = (e) => e.replace(/^(.).*(@.*)$/, '$1***$2');

// The footer sender can be given on the command line instead of editing legal.ts:
//   --company "StitchByte (stitchbyte.in)" --address "Your postal address" --contact you@stitchbyte.in
const sender = readSender();
if (opt('--company')) sender.companyName = opt('--company');
if (opt('--address')) sender.address = opt('--address');
if (opt('--contact')) sender.contactEmail = opt('--contact');

// ---- preview: no environment, no database, no SMTP -------------------------------------------------------------
if (flag('--preview')) {
  const mail = renderGameLaunchEmail({ gameId, name: 'Alex Sample', webBase: 'https://your-site.example', sender });
  const dir = resolve(root, 'scripts/previews');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${gameId}.html`);
  writeFileSync(file, mail.html);
  console.log(`Subject: ${mail.subject}\n\n${mail.text}\n\nHTML preview written to ${file}`);
  process.exit(0);
}

const envFile = resolve(root, 'apps/server/.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const webBase = process.env.WEB_BASE_URL;
if (!webBase) { console.error('WEB_BASE_URL is not set in apps/server/.env'); process.exit(2); }
const requireServer = createRequire(resolve(root, 'apps/server/package.json'));
const nodemailer = requireServer('nodemailer');

function transport() {
  if (process.env.SMTP_URL) return nodemailer.createTransport(process.env.SMTP_URL);
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === '1' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined
  });
}
const from = process.env.MAIL_FROM || process.env.SMTP_USER;
const send = async (tp, to, name) => {
  const mail = renderGameLaunchEmail({ gameId, name, webBase, sender });
  return tp.sendMail({ from, to, replyTo: process.env.MAIL_REPLY_TO || undefined, subject: mail.subject, text: mail.text, html: mail.html });
};

// ---- test: one sample to your own address (SMTP only) ------------------------------------------------------------
if (flag('--test-to')) {
  const to = opt('--test-to');
  if (!to || !to.includes('@')) { console.error('--test-to needs an email address'); process.exit(2); }
  if (!from) { console.error('MAIL_FROM / SMTP_USER is not set'); process.exit(2); }
  const info = await send(transport(), to, 'Test');
  console.log(`Sample sent to ${mask(to)}: ${String(info.response || '').slice(0, 80)}`);
  process.exit(0);
}

// ---- dry run / send: reads the database ----------------------------------------------------------------------------
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set.'); process.exit(2); }
const doSend = flag('--send');
if (doSend) {
  if (!from) { console.error('MAIL_FROM / SMTP_USER is not set'); process.exit(2); }
  const todo = Object.entries(sender).filter(([k, v]) => k !== 'address' && isTodo(v)).map(([k]) => k);
  if (isTodo(sender.address)) { sender.address = ''; console.warn('Note: no postal address given (--address), the footer will show the company and contact email only.'); }
  if (todo.length) { console.error(`Refusing to send: fill in ${todo.join(', ')} in apps/web/src/lib/legal.ts first (a bulk email must show who sent it).`); process.exit(2); }
}
const limit = Number(opt('--limit')) > 0 ? Number(opt('--limit')) : Infinity;
const { MongoClient } = requireServer('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const db = client.db('stitchbyte_watch_party');
  const rows = await db.collection('game_interest').find({ gameId, emailedAt: { $exists: false } }).toArray();
  const ids = [...new Set(rows.map((r) => r.userId))];
  const users = await db.collection('users').find({ _id: { $in: ids }, email: { $type: 'string' }, isAnonymous: { $ne: true } }).project({ _id: 1, email: 1, displayName: 1 }).toArray();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const targets = rows.map((r) => byId.get(r.userId)).filter(Boolean);
  const unique = [...new Map(targets.map((u) => [u.email.toLowerCase(), u])).values()].slice(0, limit);
  console.log(`${rows.length} interest row(s) for "${gameId}" (not emailed yet), ${unique.length} deliverable address(es).`);
  if (!doSend) {
    for (const u of unique.slice(0, 10)) console.log(`  would email ${mask(u.email)}`);
    console.log('[dry run] nothing sent. Re-run with --send to email them.');
  } else {
    const tp = transport();
    let ok = 0, failed = 0;
    for (const u of unique) {
      try {
        await send(tp, u.email, u.displayName);
        await db.collection('game_interest').updateMany({ gameId, userId: String(u._id) }, { $set: { emailedAt: new Date() } });
        ok++;
      } catch (e) {
        failed++;
        console.error(`  failed ${mask(u.email)}: ${String(e?.message || e).slice(0, 100)}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    console.log(`Done. Sent ${ok}, failed ${failed}. Failed rows are not marked, so re-running retries only them.`);
  }
} finally {
  await client.close();
}
