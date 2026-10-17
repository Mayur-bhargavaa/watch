# Security and deployment guide

Everything here was checked against the code. "Owner" marks tasks that only the account owner can do (dashboards, legal, secrets); the rest is done in code or by configuration. Payments detail is in `BILLING.md`; the repeatable test suite is described in `.claude/skills/security-audit/SKILL.md` and its findings catalogue is `.claude/skills/security-audit/BUGS.md`.

## 1. Rotate these secrets now (owner)

* `apps/server/.env` is git-ignored today (`.gitignore` has `.env` and `.env.*`, with `!.env.example`), BUT it was committed once: commit `7c5ddb5` added `apps/server/.env` and `93e0caf` removed it. The file is therefore still in the git history, and the remote is `github.com/Mayur-bhargavaa/watch`. Treat every value that file ever held as exposed.
* Rotate: the MongoDB Atlas database password (create a new least-privilege user, delete the old one, restrict the Atlas network access list to your server IP), `JWT_SECRET` (all sessions end, which is fine), SMTP password, and any other key that file contained.
* The Razorpay key that was pasted into a chat must be regenerated in the Razorpay dashboard (and the old one deleted). Same for any Razorpay webhook secret used then.
* After rotating, optionally purge the file from history (`git filter-repo --path apps/server/.env --invert-paths`, then force-push); rotation is what actually protects you, because clones and caches keep old copies.
* Never paste real keys into chats, issues, screenshots or the docs. Use placeholders.

## 2. How security works in the code

### Authentication and sessions

* Passwords: hashed with scrypt (64-byte key, random salt, format `scrypt$<salt>$<key>`, `apps/server/src/util/password.ts`). Old plaintext rows are upgraded on login; `scripts/hash-legacy-passwords.mjs` upgrades the rest (dry run by default, `--apply` writes).
* Session: a signed JWT (`@fastify/jwt`, secret `JWT_SECRET`, at least 16 characters or the server refuses to start). Browsers send `X-Session-Mode: cookie` and receive the JWT only in an httpOnly cookie `sc_session` (Secure in production, `SameSite=Lax` by default, lifetime `SESSION_MAX_AGE_SEC`, default 30 days); the response body carries the placeholder `cookie-session`, so scripts on the page cannot read the token. API clients can still use `Authorization: Bearer`.
* CSRF: a state-changing `/api/` request that authenticates with the cookie must come from an origin in `CORS_ORIGINS`, or (no Origin header) carry `X-Session-Mode: cookie`. With `SameSite=None` the Origin check is mandatory.
* Global auth gate: every `/api` route needs a valid, non-anonymous JWT except this list: `GET /api/health`, `GET /api/billing/catalog`, the two billing webhooks, and `POST /api/auth/` guest, login, register, verify-email, forgot-password, reset-password, logout.
* WebSockets: the browser first calls `POST /api/auth/ws-ticket` and gets a one-time ticket valid 30 seconds, then opens `/ws/rooms/:slug`, `/ws/games/:code` or `/ws/presence` with `?ticket=`. The JWT never appears in a URL. Frames are capped at 512 KB and validated with zod.
* Email: sign-up is verify-first: `POST /api/auth/register` always answers the same way and the account is only created when the mailbox owner opens the emailed link (token valid 24 hours); password-reset tokens are valid 30 minutes. In production the server refuses to boot without working SMTP.
* Entitlements (passes) are decided only on the server from the stored subscription; clients never set a tier (`BILLING.md`).

### Rate limiting (`@fastify/rate-limit` plus `KeyedLimiter`, all configurable through `RATE_LIMIT_*`)

| Limit | Default | Variable |
|---|---|---|
| All routes, per IP | 600 per minute | `RATE_LIMIT_GLOBAL_MAX` |
| Login, per IP+email and per account | 10 per 15 minutes | `RATE_LIMIT_LOGIN_MAX` |
| Auth endpoints (login, guest, forgot, reset, verify), per IP | 60 per 15 minutes | `RATE_LIMIT_AUTH_IP_MAX` |
| Registration, per IP | 20 per hour | `RATE_LIMIT_REGISTER_MAX` |
| Reset emails, per address | 3 per hour | `RATE_LIMIT_RESET_EMAIL_MAX` |
| Game room join | 30 per minute | `RATE_LIMIT_JOIN_MAX` |
| Partner pings/invites/nudges per sender, per sender and target | 30 and 8 per minute | `RATE_LIMIT_PARTNER_ACTION_MAX`, `RATE_LIMIT_PARTNER_TARGET_MAX` |
| Partner pair requests | 10 per hour | `RATE_LIMIT_PARTNER_REQUEST_MAX` |
| WebSocket auto-create of rooms | 10 per minute | `RATE_LIMIT_WS_CREATE_MAX` |
| Friend discovery | 30 per minute | `RATE_LIMIT_DISCOVER_MAX` |
| Billing calls / waitlist | 10 per minute / 10 per hour | `RATE_LIMIT_BILLING_MAX`, `RATE_LIMIT_WAITLIST_MAX` |
| Plans: create / join / write | 20 per hour / 20 per minute / 120 per minute | `RATE_LIMIT_PLAN_CREATE_MAX`, `RATE_LIMIT_PLAN_JOIN_MAX`, `RATE_LIMIT_PLAN_WRITE_MAX` |
| Game "Notify me" | 30 per minute | `RATE_LIMIT_GAME_INTEREST_MAX` |
| Catalog reads / matchmaker / watchlist and queue writes, per user and IP | 120 / 20 / 60 per minute | none (set in `routes/catalog.ts`) |
| Game spectators | 10 per room, 20 joins per minute | `GAME_MAX_SPECTATORS` |

Limits are per process, in memory. Behind a proxy set `TRUST_PROXY` or every user shares one bucket.

### CORS, headers

* CORS: only origins in `CORS_ORIGINS` may make credentialed calls. In production the variable is mandatory and every entry must be `https://`, otherwise the server refuses to start.
* `@fastify/helmet` runs on the API with default headers (and `Cross-Origin-Resource-Policy: cross-origin`). The API returns JSON only, so its default CSP is not the page CSP.
* The Next.js web app sets no CSP or other security headers itself (`apps/web/next.config.js` only configures redirects). Unverified: whether your Nginx or CDN adds them. Add at least HSTS, `X-Content-Type-Options`, `Referrer-Policy` and a CSP at the proxy (owner / deployment task).
* Errors: 5xx responses never leak internals (`Internal server error`).

### Webhooks

Razorpay: HMAC-SHA256 hex of the raw body against `x-razorpay-signature`. Stripe: `Stripe-Signature` (`t=...,v1=...`), HMAC of `t.body`, 5 minute tolerance, constant-time compare. Each event id is stored once (`billing_events`, TTL index of 400 days) so replays are ignored. Without the matching webhook secret the endpoint refuses events.

### Privacy, GDPR and data deletion

* `DELETE /api/privacy/data` (signed in) erases the account and its personal data: user record, password-reset tokens, push subscriptions, subscription, billing waitlist and payment history, direct messages, friendships, streaks, hosted plans, partner links and requests, game "Notify me" rows, the unified watchlist, activity logs and the SQLite copies. Refund audit rows keep no user id afterwards.
* Video is never stored or proxied. Tracked data: playback timestamps and state, chat, reactions, activity logs.
* Legal pages `/terms`, `/privacy`, `/refunds` are drafts (see section 4).

### Test-only switches and why production ignores them

| Switch | Effect | Production behaviour |
|---|---|---|
| `BILLING_MODE=mock`, `/api/billing/mock/*` | hands out paid tiers | server refuses to boot with mock in production |
| `BILLING_TEST_USERS` | "skip payment" for listed accounts | ignored when `NODE_ENV=production` |
| `IMPOSTER_/MAFIA_/MURDER_/TOURNAMENT_TEST_MIN_PLAYERS` | start games with fewer players | ignored in production |
| `MAIL_TRANSPORT=memory` | mail kept in memory instead of sent | NOT blocked in production: never set it there |
| `*_REVEAL_MS`, `*_RESULT_MS`, `MAFIA_DAWN_MS`, `QUIZ_*_MS`, `EMOJI_CHARADES_*_MS` | shorter game phases (min 100 ms) | NOT blocked in production: never set them there |

Unit tests pin the database to a dead port (`apps/server/src/__tests__/_noRealDb.ts`) so they cannot touch real data.

### Known weak spots found while writing this guide (fix in code)

* `apps/web/src/app/api/upload/route.ts` accepts an unauthenticated multipart upload of any file type and size and writes it to `public/uploads/chat/` with the client-supplied extension (HTML or SVG uploads would be served from your origin, so this is a stored-XSS and disk-filling risk). The chat upload helper (`lib/uploadMedia.ts`) uses Cloudinary first when its variables are set and this route as a fallback. Remove the fallback or add authentication, a size limit and an extension/content-type allow-list.
* Voice and video calls (`apps/web/src/context/CallContext.tsx`) use only public Google STUN servers. Without a TURN relay, calls fail for users behind symmetric NATs or strict firewalls (common on mobile networks and offices). See section 3, TURN.
* Phase-length and `MAIL_TRANSPORT` test variables are honoured in production (table above). Harmless unless someone with server access sets them.
* `.env.example` mentions `JWT_EXPIRES_IN`, which nothing reads (the lifetime is `SESSION_MAX_AGE_SEC`).
* Rate-limit counters live in memory, so they reset on restart and are not shared between several server processes.

## 3. Production deployment checklist

Server environment (`apps/server/.env`; the PM2 example in `ecosystem.config.cjs` loads it and sets `NODE_ENV=production`):

| Item | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Secure cookies, boot guards, test switches off |
| `MONGODB_URI` | dedicated least-privilege user, Atlas IP allow-list | required |
| `JWT_SECRET` | long random string, newly generated | required, rotate per section 1 |
| `CORS_ORIGINS` | your https web origin(s) | required, https only |
| `WEB_BASE_URL` | `https://...` | email links, checkout return |
| `TRUST_PROXY` | `1` (one proxy hop) or the proxy IPs | correct client IPs and rate limits |
| `SMTP_*` / `SMTP_URL`, `MAIL_FROM`, `MAIL_REPLY_TO` | working mailbox | server refuses to boot without mail in production |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`, subject `mailto:` your address | otherwise a pair is generated once and stored in MongoDB; set your own so they are under your control |
| `BILLING_MODE=live` plus provider variables | per `BILLING.md` | boot guard checks completeness; run `npm run billing:check` |
| Not set | `BILLING_TEST_USERS`, `MAIL_TRANSPORT`, `*_TEST_MIN_PLAYERS`, `*_MS` phase switches, `BILLING_MODE=mock` | test-only |
| TMDB / Watchmode / YouTube keys | see `CINEVERSE.md` | Discover; TMDB free keys are non-commercial |

Infrastructure:

* Reverse proxy (Nginx or similar) with https; route `/api` and `/ws` to the server (port 4000) and everything else to the web app. The web client uses its own origin for the API when it is not on localhost, so same-origin routing is required. Proxy WebSocket upgrades. The PM2 example runs the web app on port 3005 (`next start -p 3005`), the server on 4000.
* Build before deploy: `npm run build` (the server runs `dist/index.js`; `packages/common` must be built first).
* Data: MongoDB is the main store. A SQLite file (default `./synccinema.db`, relative to the server's working directory) still holds rooms, playback and chat history, plans and game rooms, so back it up and keep it on persistent disk. `*.db` files are git-ignored.
* Backups (owner): enable Atlas backups or scheduled `mongodump`, copy the SQLite file, and test a restore once.
* TURN (owner plus a small code change): run a TURN server (for example coturn) or use a hosted one, and add its URL and credentials to the `iceServers` list in `apps/web/src/context/CallContext.tsx`. Until then calls can fail on strict networks.
* Monitoring (owner): `GET /api/health` returns status and a database ping (2 s timeout); point an uptime monitor at it. Fastify logs JSON (`LOG_LEVEL`); ship PM2 logs somewhere searchable and alert on 5xx and webhook failures.
* Email deliverability (owner): set SPF, DKIM and DMARC for the sending domain, use a dedicated sender, watch bounces. Without them verification and reset emails land in spam. The server uses plain SMTP through nodemailer; DKIM signing is done by your SMTP provider (the code has no DKIM setting).
* Updates: run `npm audit --omit=dev` regularly (also part of the audit).

## 4. Hosting readiness: before going public

| Task | Owner only? | Status in the repo |
|---|---|---|
| Fill in company name, address, contact, grievance officer, effective date, court city and refund window in `apps/web/src/lib/legal.ts` (all values currently start with `TODO`) | yes | placeholders; `billing:check` and the game-launch email refuse to proceed while they exist |
| Lawyer review of `/terms`, `/privacy`, `/refunds`, then remove the "Draft" banner (`DRAFT_NOTICE` in `legal.ts`, `components/legal/LegalLayout.tsx`) | yes | drafts exist |
| Razorpay and Stripe KYC / business verification | yes | code ready |
| GST registration, invoices and filing (Indian prices are shown GST-inclusive); VAT or sales tax for international sales (Stripe Tax can help) | yes (accountant) | not in code |
| Create plans, prices, webhooks, Stripe customer portal in the dashboards; test-mode end to end (purchase, renewal, failed payment, cancel, resume, refund) then live keys | yes | steps in `BILLING.md` |
| Pilot: `BILLING_ALLOWLIST` with a few accounts, charge and refund once yourself, then open to everyone | yes | supported |
| Rotate exposed secrets (section 1) | yes | open |
| Email deliverability (SPF, DKIM, DMARC) | yes | open |
| Backups, monitoring, TURN (section 3) | yes | open |
| TMDB commercial licence, Watchmode paid plan, check the rights of the free-movie links (`CINEVERSE.md`) | yes | open |
| Chrome Web Store listing text in `packages/extension/CHROMEWEBSTORE.md` | yes | draft; still uses the old SyncCinema name |
| Fix the upload route and security headers (section 2) | no (code) | open |
| Run the security audit and `npm run billing:check` on the final build | either | tools ready |

## 5. Running the security audit

```bash
npm run audit:security                                         # everything, about 3 minutes
.claude/skills/security-audit/scripts/run-all.sh --quick       # static checks and live attacks, about 1 minute
npx tsx .claude/skills/security-audit/scripts/security-tests.ts --only SEC-02,SEC-14
```

It needs `mongod` on the PATH. It boots the server in-process against a throwaway local `mongod` on a random port, from an empty working directory so `apps/server/.env` is never loaded, and attacks only that local copy. `FAIL` means the vulnerability is present, `PASS` means fixed. Never repoint it at a real deployment. Details and the findings catalogue: `.claude/skills/security-audit/SKILL.md`, `.claude/skills/security-audit/BUGS.md`. The `.claude/` folder is git-ignored in this repo, so these files are not in version control.
