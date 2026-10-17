# Watch (StitchByte / SyncCinema)

Watch is a social viewing and gaming platform. Friends watch a video together in a private room with the playback kept in sync, chat and react while it plays, talk over voice or video, and play party games in the same app. It never stores, proxies or re-streams video: content plays from the original source (YouTube embeds, direct video links, a free-movie list, or the viewer's own streaming account).

Other docs: `BILLING.md` (passes, payments), `CINEVERSE.md` (Discover / catalog), `GAMES_BUGS.md` (games audit and current games status), `SECURITY.md` (security, deployment, go-live checklist), `CHANGELOG.md` (what was built), `APP_OVERVIEW.md` (architecture notes), `.claude/skills/security-audit/SKILL.md` (security test suite).

## Features

| Area | What exists |
|---|---|
| Watch rooms | Synced playback (clock sync plus drift correction, host controls), timestamped chat, floating reactions, recap with reaction heatmap, room themes, virtual seats, WebRTC voice and video |
| Discover (Home) | `/discover` is the Home page: sidebar "Home" goes there and `/dashboard` redirects to it. Hero carousel, curated rows, filters, title pages, "Watch Free Movies" row (see `CINEVERSE.md`) |
| Watchlist | ONE server-saved watchlist per account (titles and links), page `/watchlist`, same store behind every save button |
| Search | ONE search box in the header: a YouTube link starts a watch party, a room code or room link opens the room, free text searches movies and shows and games |
| Games | 13 games, see the table below |
| Social | Friends, friend requests, streaks, partner mode (pair two people), direct chat, nudges and invites |
| Plans and events | Schedule watch events, join, calendar view, recurring plans (VIP and up) |
| Notifications | In-app bell, Web Push (VAPID), installable PWA (`manifest.ts`, `public/sw.js`) |
| Passes | Standard (free), VIP (Watch+), Creator, see below |
| Legal pages | `/terms`, `/privacy`, `/refunds` (drafts until `apps/web/src/lib/legal.ts` is filled in) |
| Chrome extension | `packages/extension` (Manifest V3 tab observer for YouTube, Netflix, Disney+, Prime Video) |

### Games (13, from `apps/web/src/lib/gamesHub.ts` and `apps/server/src/games/GameDefinitions.ts`)

| Game | Players | Who can host |
|---|---|---|
| Ludo Party | 2-4 | everyone |
| Tic Tac Toe | 2 | everyone |
| Four in a Row | 2 | everyone |
| Bingo Duel | 2 | everyone |
| Tambola | 2-20 | everyone |
| Doodle Duel | 2 | everyone |
| Chess | 2 | everyone |
| Imposter | 4-8 | VIP pass or higher |
| Emoji Charades | 2-8 | VIP pass or higher |
| Mafia Night | 5-10 | VIP pass or higher |
| Quiz Show Studio | quiz master plus 1-30 | Creator pass |
| Murder Mystery Night | 6-12 | Creator pass |
| Tournament Arena | organiser plus 4-32 | Creator pass |

Anyone of any pass can join a VIP or Creator game with a room code or a friend invite; only hosting is gated. Details per game: `GAMES_BUGS.md`.

### Passes (`TIER_INFO` in `packages/common/src/membership.ts`, features list in `apps/server/src/services/billing.ts`)

| | Standard (free) | VIP (Watch+) | Creator |
|---|---|---|---|
| Hosted plans at once | 10 | 50 | 200 |
| Recurring plans | no | yes | yes |
| Watch room size (set by the host's pass) | 6 | 10 | 12 |
| Premium theater themes, avatar styles, reaction packs | no | yes | yes |
| Full recaps and personal watch stats | no (basic recap) | yes | yes |
| Host Imposter, Emoji Charades, Mafia Night | no | yes | yes |
| Host Quiz Show Studio, Murder Mystery Night, Tournament Arena | no | no | yes |
| Branded spaces, moderation, audience analytics | not built | not built | listed as "Soon" |

Prices are in `TIER_PRICES` (INR 99/month or 990/year for Watch+, INR 149/month or 1490/year for Creator; USD, EUR and GBP also defined). Full detail and setup: `BILLING.md`.

## Repository layout

```
apps/server/      Fastify 5 + @fastify/websocket API and realtime server (port 4000)
  src/index.ts      REST routes, WebSocket endpoints (/ws/rooms/:slug, /ws/games/:code, /ws/presence), security hooks
  src/sync/         RoomSyncManager (watch-room state machine), titleQueue (party queue)
  src/games/        one engine per game plus GameRoomManager and GameDefinitions
  src/services/     billing, mailer, push, plans, catalog/ (Cineverse), mongoLogger
  src/routes/       catalog.ts (/api/catalog/*)
  src/db/           MongoDB service (main store) and a SQLite service (node:sqlite, rooms, playback, chats, plans, game rooms)
  src/__tests__/    unit and integration tests
apps/web/         Next 16 App Router, React 18, Tailwind (dev port 3000)
packages/common/  @synccinema/common: shared types, zod protocol, sync math, tiers and prices
packages/extension/  Chrome extension
scripts/          owner tools (billing check, retention report, game-launch email, Razorpay plan setup, one-off migrations) and tests
.claude/skills/security-audit/   security test suite (static checks, live attack tests, BUGS.md)
ecosystem.config.cjs   example PM2 config (server from dist/, web `next start -p 3005`)
```

## Prerequisites

* Node.js 20 or newer (the repo is used with v24.7.0; the server uses the built-in `node:sqlite`, which needs a recent Node) and npm 10 or newer.
* A MongoDB database (Atlas or local). The server refuses to start without `MONGODB_URI` and `JWT_SECRET`.
* Optional: `mongod` on your PATH for the security test suite (`brew install mongodb-community`).

Keep the project OUT of `~/Documents` or any iCloud-synced folder. File syncing makes installs, builds and the test runs very slow and causes `EIO` errors and timeouts. Move it to a plain folder such as `~/dev/watch_party`.

## Install and run locally

```bash
npm install
cp apps/server/.env.example apps/server/.env   # then edit: set MONGODB_URI and JWT_SECRET (16+ characters)
npm run build -w @synccinema/common            # the server and web import the built common package
npm run dev:server                             # API and WebSockets on http://localhost:4000
npm run dev:web                                # web app on http://localhost:3000 (next dev -p 3000)
```

Use a throwaway or development database in `apps/server/.env`, never your production cluster. Without SMTP settings in development, sign-up emails are not delivered; the server prints the link in its console instead. When the page runs on `localhost` it talks to `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` (defaults `http://localhost:4000`, `ws://localhost:4000`); on any other host it uses the page's own origin, so a reverse proxy must send `/api` and `/ws` to the server.

## Build and run for production

```bash
npm run build            # builds all workspaces (common, server, web, extension)
npm run build:server     # common + server only
NODE_ENV=production node apps/server/dist/index.js     # or: npm start -w @synccinema/server
npm start -w @synccinema/web                            # next start (port 3000 unless -p is given)
```

Production needs the settings in the checklist in `SECURITY.md`. `ecosystem.config.cjs` shows a PM2 setup behind Nginx.

## Environment variables

Server variables go in `apps/server/.env` (git-ignored; copy from `apps/server/.env.example`). Never commit real values and never paste them into chats or issues. "Prod" is the behaviour when `NODE_ENV=production`.

### Core server

| Variable | Purpose | Required | Default | Used in |
|---|---|---|---|---|
| `MONGODB_URI` | MongoDB connection string | yes (server refuses to start) | none | `db/mongoDatabase.ts`, `services/mongoLogger.ts`, scripts |
| `JWT_SECRET` | signs session tokens, 16+ characters | yes | none | `index.ts` |
| `NODE_ENV` | `production` turns on Secure cookies and the boot guards | prod: yes | unset | many |
| `PORT`, `HOST` | listen address | no | `4000`, `0.0.0.0` | `index.ts` |
| `CORS_ORIGINS` | comma separated allowed web origins | prod: yes, every entry must be https | localhost origins (3000, 3005) | `index.ts` |
| `WEB_BASE_URL` | public web URL for email links and checkout return | prod: yes (billing live requires it) | first CORS origin | `index.ts`, `billing.ts`, scripts |
| `TRUST_PROXY` | `true`, a hop count (e.g. `1`) or proxy IPs/CIDRs; needed behind Nginx or Cloudflare | prod: yes (a warning is printed if unset) | off | `index.ts` |
| `COOKIE_SECURE` | `1` forces Secure on the session cookie | no | on in prod | `index.ts` |
| `COOKIE_SAMESITE` | `lax`, `strict` or `none` (none forces Secure and an Origin check) | no | `lax` | `index.ts` |
| `SESSION_MAX_AGE_SEC` | session lifetime | no | 2592000 (30 days) | `index.ts` |
| `LOG_LEVEL` | Fastify log level | no | `info` | `index.ts` |

### Email, push

| Variable | Purpose | Required | Default | Used in |
|---|---|---|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | SMTP login (or use `SMTP_URL`) | prod: yes (server refuses to boot without mail and verifies the login) | none | `services/mailer.ts`, `scripts/email-game-launch.mjs` |
| `SMTP_URL` | single SMTP URL instead of the separate variables | alternative | none | same |
| `MAIL_FROM`, `MAIL_REPLY_TO` | sender and reply-to | recommended | `SMTP_USER` / none | same |
| `MAIL_TRANSPORT` | `memory` keeps mail in memory. TEST-ONLY: used by tests; never set in production | no | unset | `services/mailer.ts` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push identity. If unset a key pair is generated once and stored in MongoDB | no (recommended to set in prod) | generated, subject `mailto:admin@localhost` | `services/pushService.ts` |

### Billing (see `BILLING.md`)

| Variable | Purpose | Required | Default |
|---|---|---|---|
| `BILLING_MODE` | `off`, `mock` or `live`. `mock` is refused in production | no | `off` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay API and webhook | live with Razorpay | none |
| `RAZORPAY_PLAN_PLUS_MONTHLY`, `RAZORPAY_PLAN_PLUS_YEARLY` | Watch+ plan ids | live with Razorpay | none |
| `RAZORPAY_PLAN_CREATOR_MONTHLY`, `RAZORPAY_PLAN_CREATOR_YEARLY` | Creator plan ids; when both are set Creator becomes purchasable through Razorpay | no | none (Creator is waitlist only) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe API and webhook | live with Stripe | none |
| `STRIPE_PRICE_PLUS_{MONTHLY,YEARLY}_{USD,EUR,GBP}` | six Stripe price ids | live with Stripe | none |
| `BILLING_ALLOWLIST` | comma separated emails or user ids allowed to start checkout (pilot) | no | everybody |
| `BILLING_TEST_USERS` | TEST-ONLY: accounts that get a "skip payment" button. Ignored when `NODE_ENV=production` | no | unset |

### Cineverse (see `CINEVERSE.md`)

| Variable | Purpose | Required | Default |
|---|---|---|---|
| `TMDB_READ_TOKEN` or `TMDB_API_KEY` | TMDB metadata; without one every catalog data route answers 503 | for Discover | none |
| `WATCHMODE_API_KEY` | where-to-watch availability | no | none |
| `YOUTUBE_API_KEY` | official trailer id lookup | no | none |
| `CATALOG_DEFAULT_REGION` | region when the request has none | no | `IN` |
| `CATALOG_CACHE_MAX_ENTRIES` | in-memory cache size (50 to 20000) | no | 1000 |

### Rate limits (all optional integers, defaults in `SECURITY.md`)

`RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_AUTH_IP_MAX`, `RATE_LIMIT_REGISTER_MAX`, `RATE_LIMIT_JOIN_MAX`, `RATE_LIMIT_RESET_EMAIL_MAX`, `RATE_LIMIT_PARTNER_ACTION_MAX`, `RATE_LIMIT_PARTNER_TARGET_MAX`, `RATE_LIMIT_PARTNER_REQUEST_MAX`, `RATE_LIMIT_WS_CREATE_MAX`, `RATE_LIMIT_DISCOVER_MAX`, `RATE_LIMIT_BILLING_MAX`, `RATE_LIMIT_WAITLIST_MAX`, `RATE_LIMIT_PLAN_CREATE_MAX`, `RATE_LIMIT_PLAN_JOIN_MAX`, `RATE_LIMIT_PLAN_WRITE_MAX`, `RATE_LIMIT_GAME_INTEREST_MAX` (all read in `index.ts`).

### Games

| Variable | Purpose | Default |
|---|---|---|
| `GAME_DISCONNECT_GRACE_MS`, `GAME_LOBBY_GRACE_MS` | forfeit grace while playing / in a lobby | 45000 / 10000 |
| `GAME_MAX_SPECTATORS` | read-only spectators per room | 10 |
| `LUDO_TURN_TIMEOUT_MS` | auto-play an idle Ludo turn, `0` disables | 45000 |
| `IMPOSTER_TEST_MIN_PLAYERS`, `MAFIA_TEST_MIN_PLAYERS`, `MURDER_TEST_MIN_PLAYERS`, `TOURNAMENT_TEST_MIN_PLAYERS` | TEST-ONLY: lets a lobby start with fewer players. Ignored when `NODE_ENV=production` | unset |
| `IMPOSTER_REVEAL_MS`, `IMPOSTER_RESULT_MS`, `MAFIA_REVEAL_MS`, `MAFIA_DAWN_MS`, `MAFIA_VOTE_RESULT_MS`, `MURDER_REVEAL_MS`, `MURDER_RESULT_MS`, `QUIZ_INTRO_MS`, `QUIZ_REVEAL_MS`, `EMOJI_CHARADES_COUNTDOWN_MS`, `EMOJI_CHARADES_PLAY_MS`, `EMOJI_CHARADES_REVEAL_MS` | TEST-ONLY: shorten phase lengths (minimum 100). Note: unlike the switches above, these are NOT disabled in production, so do not set them there | built-in lengths |

### Web (`apps/web`)

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | API and WebSocket base, only used when the page runs on localhost | `http://localhost:4000`, `ws://localhost:4000` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | optional Cloudinary unsigned upload for chat images | unset |
| `NEXT_DIST_DIR` | alternate build directory (lets a second build live beside a running dev server) | `.next` |
| `PORT` | read by `next start` (the PM2 example sets 3005) | 3000 |

### Scripts only

| Variable | Used by |
|---|---|
| `MONGODB_URI` (+ `MONGODB_DB`, default `stitchbyte_watch_party`) | `hash-legacy-passwords`, `retention-report`, `cleanup-test-records`, `email-game-launch`, `notify-game-launch`, `dedupe-friendships`, `migrate-sqlite-to-mongo` (several also read `apps/server/.env` automatically) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | `razorpay-setup.mjs` (calls Razorpay) |

`apps/server/.env.example` also lists `JWT_EXPIRES_IN`. No code reads it (session length is `SESSION_MAX_AGE_SEC`), so setting it has no effect.

## Tests and checks

```bash
# shared package
npm run build -w @synccinema/common && npm test -w @synccinema/common

# server unit tests (compiled first; they pin MONGODB_URI to a dead port so they cannot reach a real database)
npm run build:server
cd apps/server && node --test --test-force-exit dist/__tests__/games-mafia.test.js    # one file
# `npm test -w @synccinema/server` runs every dist test, including server.test.js (see below)

# web unit tests and lint
npm test -w @synccinema/web
npm run lint -w @synccinema/web

# owner scripts' tests (pure, no network, no database)
npm run test:scripts

# static check: no emoji in the interface source
python3 scripts/check-no-emoji.py

# Ludo regression script and a watch-room simulation
npm run test:ludo
npm run test:sim

# security audit (static checks, live attacks on a throwaway server and mongod, type checks, npm audit)
npm run audit:security                                   # about 3 minutes; add --quick via the script path for ~1 minute
.claude/skills/security-audit/scripts/run-all.sh --quick
```

Notes:

* `apps/server/src/__tests__/server.test.ts` starts its own server and its own throwaway `mongod`. It is slow and is known to hang on some machines (it needs `mongod` installed, and an iCloud folder makes it worse). Run it through the audit wrapper (`.claude/skills/security-audit/scripts/with-mongo.sh`) or skip it with a file-specific `node --test`.
* Every server unit test that loads game or Mongo code starts with `import './_noRealDb.js';`. It sets `MONGODB_URI` to a dead local port (`127.0.0.1:1`) because the Mongo modules call `process.loadEnvFile()` on `apps/server/.env` but never override variables that are already set. This guarantees tests cannot touch a real database, and it also blanks the `*_TEST_MIN_PLAYERS` switches. Never run a test or script that loads `apps/server/.env` against a database you care about.
* The dynamic security suite runs the real server against a disposable `mongod` on a random port, from an empty working directory. See `.claude/skills/security-audit/SKILL.md` and `SECURITY.md`.

## Useful npm scripts (repo root)

| Command | What it does |
|---|---|
| `npm run dev:server` / `npm run dev:web` | development servers (4000 / 3000) |
| `npm run build` / `npm run build:server` | build everything / common plus server |
| `npm test` | tests of every workspace (long; prefer the targeted commands above) |
| `npm run billing:check` | go-live checklist for billing; prints PASS/FAIL/WARN, never prints secret values, exit code = number of FAILs |
| `npm run retention:report` | read-only retention numbers from YOUR database (`MONGODB_URI=... npm run retention:report`) |
| `npm run email:game-launch -- <gameId> --preview` | game-launch email: `--preview` (no database, no SMTP), `--test-to you@x.com`, no flag = dry run, `--send [--limit N]` = real send. See "Owner scripts" in `BILLING.md` and the header of `scripts/email-game-launch.mjs` |
| `npm run test:scripts` | unit tests for the owner scripts |
| `npm run test:ludo`, `npm run test:sim` | Ludo regression, watch-party simulation |
| `npm run audit:security` | the security audit |

Scripts that are not wired as npm scripts: `node scripts/razorpay-setup.mjs` (creates the Razorpay plans in your account), `scripts/notify-game-launch.mjs`, `scripts/cleanup-test-records.mjs`, `scripts/hash-legacy-passwords.mjs`, `scripts/dedupe-friendships.mjs`, `scripts/migrate-sqlite-to-mongo.mjs`. All of them touch real data or providers: run them yourself, deliberately.

## Going public

Read `SECURITY.md` (production checklist, hosting readiness, owner-only tasks) and `BILLING.md` (payments) first.
