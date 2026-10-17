# Changelog

A plain-language summary of what was built across the recent working sessions, in approximate order (earliest first). There are no release dates; items inside a step are not strictly ordered. Details live in the doc named in brackets.

## Security and foundations
* Security hardening of the first version: cookie sessions with CSRF checks, one-time WebSocket tickets, scrypt password hashing, verify-first sign-up, password reset by email, rate limits, host-only room controls, GDPR data deletion. A repeatable security suite (static checks and live attack tests) was added. [SECURITY.md, `.claude/skills/security-audit`]
* Test safety: unit tests were pinned away from the real database (`_noRealDb.ts`), and a cleanup script exists for leftovers from earlier runs. [GAMES_BUGS.md]

## Games
* Audit of the first seven games (Ludo, Tic-Tac-Toe, Four in a Row, Bingo Duel, Tambola, Doodle Duel, Chess) with 175 findings fixed: turn timers, reconnect grace, rematch rules, hidden-information fixes, friend spectating, partner pairing by request and accept. [GAMES_BUGS.md]
* Six more games: Imposter, Emoji Charades, Mafia Night (VIP to host), then Quiz Show Studio, Murder Mystery Night and Tournament Arena (Creator to host). The hub got dedicated 3D card art for every game. 13 games in total. [GAMES_BUGS.md]
* "Notify me" for coming-soon games, plus owner scripts to push and email "now live" notices. All games are live now, so the coming-soon list is empty. [BILLING.md]

## Passes and billing
* Standard, VIP (Watch+) and Creator passes with server-side entitlements: hosted-plan limits, room size, themes, avatar styles, reaction packs, full recaps, watch stats, game hosting by tier. [BILLING.md]
* Razorpay (India, INR) and Stripe (USD, EUR, GBP) checkout, verified idempotent webhooks, payment history, refund audit log, pilot allow-list, owner test switch, `billing:check` and `retention:report`, `razorpay-setup.mjs`. Draft Terms, Privacy and Refund pages. [BILLING.md]

## Social, notifications, plans
* Friends, streaks, partner mode, direct chat, nudges and invites.
* Notifications: in-app bell, Web Push (VAPID), installable PWA.
* Plans and events: create, join, calendar, recurring plans (VIP and up). Plans were reviewed in an earlier session (the review report file no longer exists).
* Watch rooms: themes, virtual seats, reaction packs, post-watch recap with heatmap.

## Cineverse (Discover)
* Movie and TV discovery (TMDB, optional Watchmode and YouTube): search and filters, curated collections including four Indian ones, title pages, a deterministic matchmaker (server only now), and a room party queue with voting and a synchronised start countdown. A "Watch Free Movies" row with a curated list of free links. [CINEVERSE.md]
* Discover became the Home page: the sidebar item "Home" opens `/discover`, `/dashboard` redirects to it, the Matchmaker card and platform row were removed from the page (server endpoints kept).
* ONE unified, server-saved watchlist (titles and links) replacing the old on-device list, with a one-time migration of old items. ONE search box in the header (YouTube link, room code, titles, games). [CINEVERSE.md]

## Landing page and polish
* Scroll-reveal animation on the landing page, new sidebar and header layout (search, plan pill and notification bell together), carousel changes, fixes to dashboard thumbnails.

## Email and owner tooling
* Mailer with SMTP settings and reply-to, game-launch email script with preview, test send, dry run and real send (marks each recipient so nobody gets two). Owner scripts for billing checks, retention numbers and cleanup. [BILLING.md, README.md]

## Documentation
* README, BILLING, GAMES_BUGS (current status of all 13 games), CINEVERSE, SECURITY (security, deployment and hosting-readiness guide), APP_OVERVIEW and this changelog were rewritten or refreshed against the code.
