# Billing (Watch+)

Server code: `apps/server/src/services/billing.ts` (catalog, entitlements, provider calls, webhook verification) and the "Billing / subscriptions" block in `apps/server/src/index.ts`. Shared tier definitions and prices: `packages/common/src/membership.ts`.

## Tiers: real vs coming soon

| Tier | Name | Badge | Purchasable |
|------|------|-------|-------------|
| `free` | Watch Free | Standard Pass | n/a |
| `plus` | Watch+ | VIP Pass | yes |
| `creator` | Communities & Creators | Creator Pass | no (waitlist only; Quiz Show Studio is built, the other Creator features are not) |

What Watch+ really does today (all enforced on the server, see the table below): VIP badge, 50 hosted plans, recurring plans, bigger rooms, premium theater themes, premium avatar styles, reaction packs, full recaps, personal watch stats and hosting Imposter, Emoji Charades and Mafia Night. Anything not in that table is not built and must be labelled "Soon" (never advertise it as available); the AI party host was dropped from the plan. Prices are illustrative starting points in `TIER_PRICES`; validate retention before charging (see below).

## India vs international

The server picks the region from CDN headers (`cf-ipcountry`, `x-vercel-ip-country`, `cloudfront-viewer-country`), else `?country=XX` (the web sends a guess), else the `Accept-Language` region.

- India: INR through **Razorpay** (UPI, cards, netbanking). We create a Razorpay subscription and send the person to its hosted `short_url`.
- Everywhere else: USD (EUR/GBP selectable) through **Stripe** Checkout (cards, Apple/Google Pay).

Card, UPI and bank details are entered on Razorpay/Stripe pages only. No card data touches this server, and nothing of that kind is stored: the `subscriptions` collection keeps provider ids, tier, status and dates.

## Endpoints

`GET /api/billing/catalog` (public), `GET /api/billing/me` (adds `canPurchase`), `GET /api/billing/history` (your last 20 recorded charges: `{ payments: [{ id, paidAt, amount, currency, status, provider }], invoicesNote }`), `POST /api/billing/checkout|cancel|resume|portal|waitlist`, `POST /api/billing/webhooks/razorpay|stripe` (public, signature-verified), and in mock mode `POST /api/billing/mock/activate|expire`.

## Setting up Razorpay

1. Complete KYC, then work in Test Mode first.
2. Subscriptions > Plans: create `Watch+ monthly` (INR 99.00 / month) and `Watch+ yearly` (INR 990.00 / year). Copy the plan ids into `RAZORPAY_PLAN_PLUS_MONTHLY` / `RAZORPAY_PLAN_PLUS_YEARLY`.
3. API Keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
4. Webhooks: URL `https://<api-host>/api/billing/webhooks/razorpay`, choose your own secret (`RAZORPAY_WEBHOOK_SECRET`), events: `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, plus `refund.processed` and `payment.refunded` (recorded in the audit log only).
5. Cancelling calls the cancel API with `cancel_at_cycle_end=1`: access continues until the period end. A Razorpay subscription cannot be resumed after cancelling; the person subscribes again.

## Setting up Stripe

1. Use the test-mode API key first.
2. Product catalog: product `Watch+` with six recurring prices (monthly and yearly in USD, EUR, GBP) matching `TIER_PRICES`; put the `price_...` ids in `STRIPE_PRICE_PLUS_{MONTHLY|YEARLY}_{USD|EUR|GBP}`.
3. Developers > Webhooks: endpoint `https://<api-host>/api/billing/webhooks/stripe`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, plus `invoice.paid` (renewal receipts in the payment history) and `charge.refunded` (audit log only). Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Settings > Billing > Customer portal: enable it (cards, invoices, cancellation). `POST /api/billing/portal` opens it.
5. Test locally with the Stripe CLI: `stripe listen --forward-to localhost:4000/api/billing/webhooks/stripe` (use the secret it prints).

## Going live checklist

Automated by code (run `npm run billing:check` to see where you stand; it prints PASS/FAIL/WARN and exits with the number of FAILs):

- [x] Terms, Privacy and Refund/Cancellation pages exist as drafts at `/terms`, `/privacy`, `/refunds`, linked from the pricing page, the landing footer and the sign-in screen. Company details live in one file, `apps/web/src/lib/legal.ts`.
- [x] Provider adapters are tested against a fake `fetch` and documented webhook fixtures (`apps/server/src/__tests__/billing.test.ts`): request URLs, auth, bodies, state mapping, period ends, refunds, unknown and malformed events. SEC-83..SEC-96 cover the same over HTTP.
- [x] Pilot allow-list: `BILLING_ALLOWLIST` limits who can start checkout.
- [x] Refunds are recorded idempotently in `billing_audit` and never revoke access automatically.
- [x] Payment history in the profile (`GET /api/billing/history`, from `billing_payments`, no card data; removed by account deletion).
- [x] Boot guard: the server refuses `mock` in production and `live` without a fully configured provider.
- [x] `npm run billing:check` verifies env: mode, production, provider variables (all six Stripe price ids), webhook secrets, https URLs, `TRUST_PROXY`, legal placeholders, mock disabled.
- [x] `npm run retention:report` prints the numbers to validate before charging (see below).
- [x] The pricing page lists "soon" features as soon.

Remaining for the OWNER (these cannot be done in code):

- [ ] Fill in `apps/web/src/lib/legal.ts` (company name, address, contact and grievance officer, effective date, courts city, refund window) and have a lawyer review the three pages. They show a "Draft" banner until you remove it in `components/legal/LegalLayout.tsx` and `DRAFT_NOTICE` in `legal.ts`.
- [ ] Razorpay and Stripe KYC/business verification complete.
- [ ] GST: Indian prices are shown GST-inclusive. GSTIN registration, invoices and filing need an accountant. For international sales ask about VAT/sales tax (Stripe Tax can help).
- [ ] Create the plans, prices, webhooks and the Stripe customer portal in the provider dashboards (steps above) and set the env variables on the server (`BILLING_MODE=live`, `NODE_ENV=production`, https `WEB_BASE_URL` / `CORS_ORIGINS`, `TRUST_PROXY`). Webhook URLs must be reachable over https.
- [ ] Test mode end to end in the real dashboards: purchase, renewal, failed payment, cancel, resume (Stripe), refund. Then switch to live keys.
- [ ] Run `npm run retention:report` against your own database and decide on price.

## Launch plan

1. Pilot: set `BILLING_ALLOWLIST=friend1@example.com,friend2@example.com` (emails or user ids, comma separated) together with `BILLING_MODE=live`. Only these people can start a checkout; everybody else sees "Payments open soon" on the pricing page and gets 403 `NOT_IN_PILOT` from the API. Charge real money once yourself and refund it from the dashboard to check the whole flow, receipts and the audit log.
2. Watch a few weeks of renewals, failed payments and `npm run retention:report`.
3. Widen: unset `BILLING_ALLOWLIST` and restart the server. Everyone can then purchase.

## Operations notes

- Refund: do it in the provider dashboard. The webhook writes a `billing_audit` row (`type: refund`, amount, currency, user when known) and access stays. To end access, cancel the subscription as well.
- Payment history rows are created from `subscription.charged` (Razorpay), `checkout.session.completed` and renewal `invoice.paid` (Stripe). Amounts are minor units. Tax invoices are emailed by the provider.
- Unknown webhook event types are acknowledged with 200 and ignored; malformed JSON is 400.

## What each pass really changes (verified in code and tests)

| Area | Standard (free) | VIP / Watch+ | Creator |
|------|-----------------|--------------|---------|
| Badge next to the name, profile pass card, sidebar plan line | yes | yes | yes |
| Hosted plans at once | 10 | 50 | 200 |
| Recurring weekly/monthly plans | no | yes | yes |
| Watch room size (set by the HOST's pass; SEC-117) | 6 | 10 | 12 |
| Theater themes (SEC-118) | Cinema Dark, Theme 1, Theme 2 | all six | all six |
| Games (the seven classic duel/party games) | same for everyone | same | same |
| Imposter (4-8 player social game; the HOST's pass decides, SEC-123..126) | can join and watch a VIP host's room, cannot create one (`UPGRADE_REQUIRED`) | host | host |
| Emoji Charades (2-8 player movie puzzle race; the HOST's pass decides, SEC-127..130) | can join and watch a VIP host's room, cannot create one (`UPGRADE_REQUIRED`) | host | host |
| Mafia Night (5-10 player social deduction game; the HOST's pass decides, SEC-131..135) | can join and watch a VIP host's room, cannot create one (`UPGRADE_REQUIRED`) | host | host |
| Quiz Show Studio (host-run live quiz, up to 30 players; the HOST's pass decides, SEC-136..139) | can join and watch a Creator host's room, cannot create one (`UPGRADE_REQUIRED`) | can join, cannot host (a VIP host is refused with a message naming the Creator Pass) | host |
| Murder Mystery Night (scripted 6-12 player whodunit; the HOST's pass decides, SEC-140..144) | can join and watch a Creator host's room, cannot create one (`UPGRADE_REQUIRED`) | can join, cannot host (a VIP host is refused with a message naming the Creator Pass) | host |
| Upcoming games (not built, shown locked as "Coming soon" with a Notify me button) | see them | none left | Creator: Tournament Arena |
| Premium avatar styles (8 extra styles, SEC-120) | no | yes | yes |
| Reaction packs (3 extra packs, SEC-121) | Classic only | all | all |
| Room recap | basic (watchers, reactions, top 3 moments) | full (heatmap, chat highlights, per-person stats) | full |
| Personal watch stats on the profile (SEC-122) | locked | yes | yes |
| Branded spaces, moderation, audience analytics | not built | n/a | not built ("Soon") |

The seven classic games (Ludo, Four in a Row, Tic-Tac-Toe, Bingo Duel, Tambola, Doodle Duel, Chess) are NOT gated by any pass. **Imposter** is a VIP game: `GAME_DEFINITIONS.imposter.requiredHostTier = 'plus'` and the server refuses a free HOST on every room-creation path (REST `POST /api/games/rooms` and the WebSocket `?create=1` auto-create answer `UPGRADE_REQUIRED`; partner mode and public matchmaking are not supported for it at all). Guests of any pass can join (room code / friend invite) and friends can spectate. **Emoji Charades** works the same way (`GAME_DEFINITIONS['emoji-charades'].requiredHostTier = 'plus'`, same two creation paths gated, no partner mode, no public matchmaking, 2 to 8 players). **Mafia Night** works the same way (`GAME_DEFINITIONS['mafia-night'].requiredHostTier = 'plus'`, same two creation paths gated, no partner mode, no public matchmaking, 5 to 10 players, route `/games/mafia`). **Quiz Show Studio** is a Creator game: `GAME_DEFINITIONS['quiz-show'].requiredHostTier = 'creator'`, the same two creation paths are gated (a free or Watch+ host gets `403 UPGRADE_REQUIRED` with a message that names the Creator Pass), no partner mode, no public matchmaking, a quiz master plus 1 to 30 players, route `/games/quiz-show`. Guests of any pass can join and friends can spectate. **Murder Mystery Night** is a Creator game too: `GAME_DEFINITIONS['murder-mystery'].requiredHostTier = 'creator'`, the same two creation paths are gated (`403 UPGRADE_REQUIRED` naming the Creator Pass), no partner mode, no public matchmaking, 6 to 12 players (the host plays too), route `/games/murder-mystery`; guests of any pass can join and friends can spectate. The only upcoming game left (Tournament Arena) is defined in `packages/common/src/membership.ts` (`UPCOMING_GAMES`) with the pass that will unlock it; nothing there is playable yet. Chat, reactions, friends and streaks are the same for all passes.

## Testing a pass without Razorpay (owner only)

Set `BILLING_TEST_USERS=you@example.com` in `apps/server/.env` (never in production; the server ignores it when `NODE_ENV=production`). Only the listed accounts then see a dashed "Test mode: skip payment" button on `/pricing` and "Test mode: back to free". It activates the pass for that account only, with provider `mock`, and plays the same celebration as a real payment. Everyone else still goes to Razorpay. Remove the line before launch. SEC-119 covers it.

## How entitlements work

`computeEntitlement(subscription, now)` is the only place a tier is decided, from the stored row in `subscriptions` (one document per user):

- `active`: entitled (with a 3 day slack past the period end for a late renewal webhook).
- `canceled` but before `currentPeriodEnd`: still entitled; the web shows when it ends.
- `past_due`: 7 day grace after the period end.
- anything else: `free`.

Client input never sets a tier. Webhooks are verified (Razorpay: HMAC-SHA256 hex of the raw body vs `x-razorpay-signature`; Stripe: `Stripe-Signature` `t=...,v1=...` HMAC of `t.body`, 5 minute window, constant-time compare) and idempotent: each event id is stored once in `billing_events` and repeats are ignored. A downgrade never deletes data: plans that already exist keep working, only NEW recurring plans or hosting beyond the free cap are blocked (403 `UPGRADE_REQUIRED` / `PLAN_LIMIT_REACHED`). Account deletion removes the subscription, waitlist and payment-history rows (refund audit rows keep no user id afterwards).

## Adding a tier or a feature

1. Add the tier to `TIER_INFO` and `TIER_PRICES` in `packages/common/src/membership.ts` and (if purchasable) price/plan ids in the provider dashboards and env.
2. Add its feature list to `FEATURES` in `billing.ts`; mark unbuilt things `soon`.
3. Enforce the feature on the server from `computeEntitlement(...)` / `TIER_INFO[tier].limits`; only then switch the feature to `available`.
4. Add a SEC test in `.claude/skills/security-audit/scripts/security-tests.ts`.

## Validate retention before charging

The prices are guesses. Before turning on `live`, check that people come back and that the free tier is not already enough: `MONGODB_URI=... npm run retention:report` (read-only; it prints a banner and only runs find/count queries). It reports users, weekly active users, D1/D7/D30 return rate (from signup date vs later activity in the activity logs, direct messages, plans and streaks), plans per active user, share of active users with a live streak and with friends, and a verdict line ("free tier probably enough" or "monetisable signals"). It is a rough guide: activity logs only exist while the logger was connected, and small samples mislead. Start with a small group (the pilot), test the price, and keep the "soon" features honest.

## Local development

Set `BILLING_MODE=mock` (never in production): checkout returns `/billing/success?mock=1`, and `POST /api/billing/mock/activate {tier, interval}` / `mock/expire` flip the signed-in user's subscription.


## Testing switches for the party games (development only)
- `IMPOSTER_TEST_MIN_PLAYERS=2` (or `3`) lets an Imposter lobby start with fewer than 4 players so one person can try it with a couple of browsers.
- `MAFIA_TEST_MIN_PLAYERS=4` (or `5`) lets a Mafia Night lobby start with 4 players (1 Mafia, 1 Detective, 2 Villagers, no Doctor) so one person can try it with a few browsers. 
- `MURDER_TEST_MIN_PLAYERS=2..6` lets a Murder Mystery Night lobby start with fewer than 6 players so one person can try it with a few browsers. A game of N players uses N of the case's 12 characters: always the murderer, then the case's `required` characters, then random others (when `required` is larger than N, the murderer first and then randomly chosen required characters). With 2 players a game still runs (the murderer + 1 other); the game aborts below 2 seated players in that mode (below 4 normally).
- `MURDER_REVEAL_MS` / `MURDER_RESULT_MS` (milliseconds, at least 100) shorten the character reveal / result phases (testing only; the clue rounds and the accusation keep their real 90 s / 60 s).

All the `*_TEST_MIN_PLAYERS` switches are ignored when `NODE_ENV=production` and for any other value; the defaults stay 4 (Imposter), 5 (Mafia Night) and 6 (Murder Mystery Night). The unit tests (`_noRealDb.ts`) and the security harness pin them off.
