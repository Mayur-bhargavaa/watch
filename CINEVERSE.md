# Cineverse (movie and TV discovery)

"Find your next obsession. Watch it together." Route: `/discover`. Discover is now the app's Home page: the sidebar item is called "Home" and points to `/discover`, the PWA `start_url` is `/discover`, and `/dashboard` redirects there (`next.config.js` redirects: `/dashboard?tab=games` goes to `/games`, `/dashboard?search=x` goes to `/discover?q=x`, plain `/dashboard` goes to `/discover`; the client-side `app/dashboard/page.tsx` also maps the old `tab=` values for watchlist, rooms and friends). Free for every signed-in account: there is no pass gating, and BILLING.md is unchanged.

## What is real and what is not

| Works with no keys (server side) | Needs `TMDB_API_KEY` or `TMDB_READ_TOKEN` | Needs `WATCHMODE_API_KEY` |
|---|---|---|
| The page, navigation, the server-saved watchlist (add, remove, list), the room party queue (propose, vote, confirm, countdown, ready) | Search, filters, trending, all collections, the spotlight, the matchmaker, title pages, cast, recommendations | "Where to watch" by region, provider links, the provider filter, "Available on Your Platforms", provider boost in the matchmaker |

The "Watch Free Movies" collection also has a built-in fallback that needs no key (see Collections), but the `/discover` page itself shows only the setup message while `GET /api/catalog/status` says the catalog is not configured. Without a TMDB key every data route answers `503 { "error": "Catalog is not configured", "code": "CATALOG_NOT_CONFIGURED" }` and the page shows an owner-facing setup message (never fake titles). Without a Watchmode key everything else works and availability is hidden with the note "Availability data is not enabled". `YOUTUBE_API_KEY` is optional and only finds an official trailer id.

Nothing visual and no real provider response was ever seen while building this (no browser, no API keys): all provider behaviour is covered by tests with a fake `fetch` and recorded-shape fixtures.

## Licences and quotas (read before going live)

* TMDB: a free key is for non-commercial use. Commercial use needs a licence agreement with TMDB. The required attribution is shown in the /discover footer.
* Watchmode: the free plan is small (about 1,000 calls a month at the time of writing); production use needs a paid plan. Each title needs up to 2 calls the first time (id mapping, cached 7 days; availability, cached 30 minutes), so the provider filter and the platform row cost the most. The caches and rate limits below exist to protect that quota.
* YouTube Data API: quota is per Google Cloud project (search costs 100 units per call, cached 6 hours per title).
* Netflix, Prime Video and JioHotstar are external services. We do not use any public catalog, search, playback or login API of theirs. Availability and links come only from the licensed availability source (Watchmode). Playback capability for them is "none" and room sync is "coordinated start" only. Frame-accurate playback sync for them is NOT available and needs authorisation from each provider.

## Architecture

```
web /discover  ->  /api/catalog/*  (apps/server/src/routes/catalog.ts)
                        |
                CatalogService (services/catalog/service.ts)
                  cache (TTL, stale-while-revalidate, in-flight de-dup, LRU)
                  UpstreamClient (8 s timeout, bounded retries, circuit breaker)
                  adapters: tmdb.ts (metadata)  watchmode.ts (availability)  youtube.ts (trailer id)
Room: web Party queue panel <-> WebSocket room:title_* <-> RoomSyncManager <-> sync/titleQueue.ts (pure state machine)
```

Why `/api/catalog/...`: the project convention is `/api/...` (billing, games, plans); there is no `/api/v1`, so the routes follow it. The global auth gate in `index.ts` already protects every `/api` route that is not on its public list, so all Cineverse routes need a signed-in, non-anonymous account (this also protects the owner's API quota).

Five concepts are kept apart in types and code (`packages/common/src/catalog.ts`): (1) catalog metadata (`CatalogTitle`, TMDB), (2) streaming availability (`ProviderOffer`, only `verified: true` from Watchmode), (3) provider destination URL (`ProviderOffer.destinationUrl`, https only), (4) playback capability and (5) room sync capability (`TitleCapabilities`).

Files: `apps/server/src/services/catalog/` (cache, upstream, adapters, collections, matchmaker, service, watchlist), `apps/server/src/routes/catalog.ts`, `apps/server/src/sync/titleQueue.ts` (+ schemas in `sync/schemas.ts`), web `apps/web/src/lib/catalog/` (pure helpers and API client), `apps/web/src/components/discover/`, `apps/web/src/components/room/PartyQueuePanel.tsx`, pages under `apps/web/src/app/discover/`.

## Normalised model

`CatalogTitle`: `id` (`tmdb:movie:603`), `source`, `sourceId`, `mediaType` (`movie|tv`), `title`, `overview`, `posterPath`, `backdropPath`, `releaseDate`, `genres[]`, `runtimeMinutes`, `rating`, `ratingSource` (always `"TMDB"`), `voteCount`, `providers[]`, `region`, `externalUrl`, plus details-only fields (`seasons`, `episodes`, `cast` top 8, `crew` directors/creators, `tagline`, `trailerYoutubeId`). Missing or malformed upstream fields become `null` or empty, never guessed. Image paths must match `/^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/` and URLs are built only from `https://image.tmdb.org/t/p/` + a fixed size + the path.

`ProviderOffer`: `id`, `name`, `type` (`subscription|rent|buy|free`), `logoUrl`, `destinationUrl|null`, `verified`. An empty `providers` list means "none verified", not "unavailable"; when availability cannot be checked the field is absent and the UI says so.

Region: `?region=` (allowlisted ISO alpha-2), else the CDN country headers / Accept-Language through the billing `detectCountry` helper, else `CATALOG_DEFAULT_REGION` (default `IN`).

## Endpoints

| Method and path | Purpose |
|---|---|
| `GET /api/catalog/status` | `{ configured, availability, trailers, defaultRegion, region }` (no secrets) |
| `GET /api/catalog/search?q&type&genre&year&sort&provider&region&page` | text search or discover; `year` is `2015` or `2010-2020`; `sort` is `popularity|rating|release`; `provider` needs Watchmode |
| `GET /api/catalog/trending?region&type` | TMDB weekly trending |
| `GET /api/catalog/genres` | genre list (cached 24 h) |
| `GET /api/catalog/titles/:source/:mediaType/:id` | details + verified providers |
| `GET /api/catalog/titles/.../providers?region` | verified providers with capabilities |
| `GET /api/catalog/titles/.../recommendations` | TMDB recommendations |
| `GET /api/catalog/collections/:slug?region&providers` | a curated row (below) |
| `POST /api/catalog/matchmaker` | body `{ mood, time, genres[], providers[], mode, seed }` |
| `GET/POST /api/catalog/watchlist`, `DELETE /api/catalog/watchlist/:titleKey` (or `?titleKey=`) | the caller's private list: titles and links together (see Watchlist) |
| `GET /api/catalog/rooms/:slug/titles`, `POST /api/catalog/rooms/:slug/titles/(propose|vote|confirm|ready|clear)` | REST twin of the room messages (members only) |

Every query, param and body is validated with zod (bounded lengths, enums, integer ranges, `strict()` so unknown parameters are a 400). Errors: 400 `BAD_REQUEST`, 401, 403, 404, 409 `WATCHLIST_FULL`, 429 `RATE_LIMITED`, 502 `CATALOG_UPSTREAM`, 503 `CATALOG_NOT_CONFIGURED` / upstream breaker open.

## Collections (defined once in `services/catalog/collections.ts`)

Each has a one-line "How we pick these" caption shown in the UI, taken from the same definition. 13 slugs exist (`COLLECTION_SLUGS`); `GET /api/catalog/collections/:slug` answers 404 `NOT_FOUND` for any other. Rows shown on the page, in order: Watch Free Movies, Trending, Trending in India, Bollywood Hits, Because You Saved (hidden when empty), South Indian, Indian Series, Hidden Gems, One-Night Binge, Mind-Bending, Comfort Cinema, Critically Loved, after the hero (which uses the spotlight/trending/Indian rows).

* Watch Free Movies (`free-movies`, kind `free`): a curated list in `services/catalog/freeMoviesData.json` (21 entries today, every one a `youtube.com/watch` link: 18 Hindi and Tamil films such as Hera Pheri, Jab We Met, Anand and Deewaar, plus Tears of Steel, Big Buck Bunny and Night of the Living Dead). With a TMDB key each entry is enriched with live TMDB details; without one the embedded data (title, poster, rating, link) is used. The titles show a free offer ("YouTube (Free)") and the title page has a "Watch free" action that starts a room with that link. Cached 10 min per region. Licence note: only the last three are well known open-licence or public-domain films; whether the uploaders of the other 18 allow embedding and public re-use is NOT verified in the repo, so check each link before launch (a link removed or blocked from embedding simply stops playing).

* Tonight's Spotlight (`spotlight`): one title from this week's TMDB trending (with a backdrop and an overview), picked by a hash of the UTC date and region, so it is the same all day and never changes on re-render.
* Trending Across the Universe: TMDB trending, TMDB order.
* Trending in India: popular recently in India (not live trending data): movies and TV with TMDB `with_origin_country=IN`, released in the last 120 days (`primary_release_date` / `first_air_date` `.gte` = today - 120 days, `.lte` = today), at least 5 votes, merged by popularity.
* Bollywood Hits: movies with `with_original_language=hi`, `region=IN`, `vote_count.gte=150`, release date up to today, popularity first.
* South Indian Blockbusters: movies in `ta`, `te`, `ml`, `kn` (one discover call per language, because TMDB takes one code), `vote_count.gte=100`, release date up to today; merged, de-duplicated, sorted by popularity, capped at 20. A failing language call only drops that language.
* Indian Series: TV with `with_origin_country=IN`, `vote_count.gte=50`, first air date up to today, popularity first.
* Hidden Gems: discover with rating >= 7.3 and 300 to 3,000 votes, best rated first, then drop mainstream titles (TMDB popularity >= 60).
* One-Night Binge: movies of 100 minutes or less rated 6.8+, plus TV rated 7+ whose details show exactly 1 season and 8 episodes or fewer (details checked, cached 6 h).
* Mind-Bending Stories: Science Fiction / Mystery / Thriller (TV: Mystery / Sci-Fi and Fantasy), rating 7+, 1,000+ votes. No keyword ids are used.
* Comfort Cinema: Comedy / Animation / Family, rating 7+, 1,000+ votes.
* Critically Loved: rating >= 8.0 with 1,500+ votes (500+ for TV); the UI labels it "TMDB 8.1".
* Because You Saved: TMDB recommendations seeded from the caller's three most recent watchlist titles, excluding titles already saved. Hidden when the watchlist is empty; nothing is faked.
* Available on Your Platforms: trending + popular titles whose availability in the region is verified on the platforms the person picked. The endpoint still exists; the /discover page no longer shows this row, and the Matchmaker card was removed from the page too (the `POST /api/catalog/matchmaker` endpoint, its tests and the server code are kept for later).

The /discover hero is a multi-banner carousel like Home (arrows, dots on mobile, thumbnails on desktop, swipe, arrow keys, no auto-advance), built in the browser from 3 titles of Trending and 3 from the Indian rows (only titles with a backdrop, de-duplicated). The signed-in user's standing Bitmoji sits behind its top-right corner, as on Home.

## Matchmaker (deterministic, not AI; server endpoint only, the Discover page no longer shows it)

`services/catalog/matchmaker.ts`, unit tested. `score = mood + genre preference + time fit + quality + provider boost + audience fit`.

* Mood: genre weights per mood (for example chill favours Comedy/Family/Animation and penalises Horror/Thriller; mind-bending favours Sci-Fi/Mystery/Thriller); nostalgic also rewards older releases (<= 2000 +3, <= 2010 +2). Capped at 6.
* Preferred genres: +2 each, capped at +4.
* Time: under30 needs runtime <= 30; under90 needs a movie <= 90 or a TV episode <= 45; longer has no limit. A known runtime over the limit removes the title; an unknown runtime costs 1.5 points and no time claim is made.
* Quality: 0 to +2 from the TMDB rating with 100+ votes.
* Providers: +4 for a verified subscription/free offer on a chosen provider, +1.5 for rent/buy; only when availability was verified.
* Audience: group +1 for widely loved titles (7+ with 1,000+ votes); solo +1 for lesser-known ones (7.3+ under 1,500 votes).
* Tie-break and pick: titles with equal score are ordered by an FNV-1a hash of `seed|titleId`. The pick is chosen among the top scorers within 1 point of the best using the seed; "Pick again" steps through the shortlist. The seed is the room code plus the UTC day (or the user id plus the day), so people in one room see the same pick.
* The "why this" line only lists criteria that matched. Candidates come from TMDB discover for the mood genres (and the time limit), with details fetched (cached) for the top 24 so runtimes are real.

## Room party queue protocol

Messages (client to server), payloads validated strictly in `sync/schemas.ts` (unknown or oversized fields are rejected with `INVALID_PAYLOAD`): `room:title_propose {titleKey, snapshot, provider?}`, `room:title_vote {titleKey}`, `room:title_confirm {titleKey, snapshot?, provider?, region?, startAt?, version?}` (host only), `room:title_ready {titleKey, version?}`, `room:title_clear {version?}` (host only). Server to client: `room:title_state {state, serverTime}` broadcast on every change, and `titleState` inside the `room:state` snapshot on join and reconnect.

State (`TitleRoomState`): `version`, `selectionVersion`, `queue` (max 5; proposer, votes, snapshot), `selected` (title, provider, `destinationUrl`, `capabilities`, `startAt`, `ready[]`, `confirmedBy`). Rules, in `sync/titleQueue.ts` (pure, tested) and enforced by `RoomSyncManager`:

* Only room members act. Votes are one per member per title (voting again withdraws it). Proposing a queued title adds your vote. A full queue refuses new titles.
* Confirm and clear are host only. A guest's forged confirm is refused with `FORBIDDEN` and changes nothing.
* Confirming NEVER issues playback commands or media changes. For a YouTube video the host can still use `media:change` exactly as before.
* `destinationUrl` is set only if the server asks the catalog service for that provider's verified link and gets an https URL back. A client can never supply a link.
* `startAt` must be within the next 10 minutes. Clients count down using the existing clock-offset mechanism, so everyone sees the same countdown. "I'm ready" is a manual tap.
* Stale events: confirm, ready and clear carrying a `version` older than `selectionVersion` are ignored (the sender gets the authoritative state back). Clients also ignore `room:title_state` frames older than what they hold.
* The title state lives in server memory like other live room state (it is not written to SQLite) and is dropped when the host ends the room; a server restart empties the queue.

The room page has a "Queue" tab (compact panel) with the queue, votes, the host's Confirm button, the countdown and ready buttons, and plainly says that playback on external services is not synchronised frame by frame.

## Watchlist (ONE list for the whole app)

There is a single watchlist per account, server-saved, and the sidebar's "Watchlist" page (`/watchlist`) is the one place to view and manage it. Every save / remove button in the app (Discover hero, rows, search results, title page, matchmaker, home page cards) reads and changes the same client store (`apps/web/src/lib/catalog/watchlist.ts`, module-level cache + subscribers, optimistic add / remove with rollback, de-duplicated requests, `storage` event for other tabs, guests get a sign-in prompt). The old localStorage list (`stitchbyte_watchlist`, seeded with sample items) is gone; see "Migration" below.

Collection `catalog_watchlist` in MongoDB, two kinds of row in the same list:

* `kind: 'title'` (also: any document with NO `kind`, written before links existed): `{ userId, titleKey: 'tmdb:movie:603', title, posterPath, year, mediaType, addedAt }`.
* `kind: 'link'`: `{ userId, titleKey: 'link:<16 hex>', title, url, platform, thumbnail, category, tagline, addedAt }`. `titleKey` is `link:` + a hash of the normalised URL (https only, host lower-cased, fragment and default port dropped, every YouTube spelling reduced to one watch URL), so the same page can never be saved twice. The client never chooses the key. The server fetches nothing from the URL; a YouTube link gets `https://img.youtube.com/vi/<id>/hqdefault.jpg` as its thumbnail.

Unique index `(userId, titleKey)`, index `(userId, addedAt)`, cap 500 per user for BOTH kinds together, always queried by the caller's id (private), removed by `deleteUserData` (GDPR). The cap check is count, insert, re-count: if two adds race at the limit the over-cap row takes itself back out (both may then be refused, but the list can never stay above 500). No migration of stored documents is needed.

API: `GET /api/catalog/watchlist` returns `{ items, max }` with both kinds newest first (each item has `kind`). `POST` accepts either `{ titleKey, title, posterPath, year, mediaType }` (kind optional) or `{ kind: 'link', title, url, platform?, thumbnail?, category?, tagline? }` and answers `{ ok, duplicate, titleKey }`. `DELETE /api/catalog/watchlist/:titleKey` (or `?titleKey=`) removes either kind. Everything is `strict()` zod plus server-side clean-up: https only, real DNS host (no IP literals, no localhost / internal names, no credentials), no control characters anywhere, bounded lengths (url 2048, title 200, platform 40, category 60, tagline 140, thumbnail 500).

Migration of the old on-device list: on the FIRST signed-in load of `/watchlist` (and only there) the page reads `stitchbyte_watchlist`, skips the four hard-coded sample URLs the old page seeded (Interstellar, Stranger Things 4, The Boys Season 4, Cyberpunk 2077: `LEGACY_SAMPLE_URLS` in `lib/catalog/legacyWatchlist.ts`), uploads the remaining items as link items (4 at a time, at most 50 per visit because writes are limited to 60 a minute, never more than the room left under the cap) and removes the key only when every upload either succeeded, was a duplicate, was refused for good (invalid) or can never fit (list full). A network, server or rate-limit failure keeps the key, so nothing is lost and the next visit retries. It never blocks the page. The key is per browser, not per account: whoever signs in first on that browser imports it.

## Search (ONE search box, in the header)

`components/layout/HeaderSearch.tsx` inside `AppHeader` is the only search of the app. Classification is `classifySearchInput` in `lib/headerSearch.ts`: a YouTube link or id starts a watch party (as before); a room link (`.../room/<code>`) or a generated-looking room code (8 characters of letters, digits, `-`, `_` with at least one digit, `-` or `_`) opens the room; anything else is free text. Free text gives debounced (280 ms) live suggestions in an accessible combobox (arrow keys, Enter, Escape, click outside, `aria-activedescendant`, polite result count): Movies & shows (top 5 from `GET /api/catalog/search`, aborted when you keep typing), Games (live games of the games hub, `lib/gamesHub.ts`, linking to the game route), "Join room" when the text could be a custom room code, and "See all results". Enter without choosing goes to `/discover?q=<text>`. Guests get no catalog suggestions; 503 `CATALOG_NOT_CONFIGURED` hides "Movies & shows" and Enter still opens /discover (which shows the owner setup message); any other error shows a quiet "Search unavailable" row.

Behaviour change to know about: a bare single word that is not shaped like a generated room code (for example `avengers`) used to open `/room/avengers`; it now searches Discover, with a "Join room" suggestion one arrow key away for custom codes.

Discover has no search box any more, only filters (type, genre, year, sort, service). The text and filters live in the URL (`/discover?q=&type=&genre=&year=&sort=&provider=`, helpers in `lib/catalog/urlState.ts`), a "Results for" chip clears `q`, and the old `/dashboard?search=` redirects to `/discover?q=`. The games hub, the old watchlist page and the dashboard no longer have their own title search.

## Caching, limits, safety

* Cache TTLs: search 60 s, trending 15 min, details 6 h, providers 30 min, genres 24 h, id mapping 7 days, collections 10 min; stale-while-revalidate windows; a stale copy is served if the upstream is down (up to 24 h); max entries `CATALOG_CACHE_MAX_ENTRIES` (default 1000, LRU). Concurrent identical requests share one upstream call.
* Upstream: 8 s timeout, up to 2 retries with backoff on 429/5xx (honours `Retry-After`, capped at 2 s), a circuit breaker (5 consecutive failures open it for 30 s). Error messages never contain URLs or keys.
* Rate limits per user and per IP: catalog reads 120/min, matchmaker 20/min, watchlist and room writes 60/min.
* Keys live only in server env; no response, log or error includes them. Provider links are validated (https only, no credentials, real DNS host, no IP literals or internal names) and rendered with `target="_blank" rel="noopener noreferrer"` and the caption "Opens <provider>. You may need to sign in there." There are no server-side redirects. Nothing is proxied, downloaded or transcoded, and no streaming credentials are collected.

## Env vars (apps/server/.env.example, placeholders only)

`TMDB_READ_TOKEN` or `TMDB_API_KEY`, `WATCHMODE_API_KEY`, `YOUTUBE_API_KEY`, `CATALOG_DEFAULT_REGION` (default `IN`), `CATALOG_CACHE_MAX_ENTRIES` (50 to 20000, default 1000). Full environment table: README.md.

## Run locally

1. Get a TMDB key (free account, Settings > API) and put `TMDB_READ_TOKEN=` or `TMDB_API_KEY=` in `apps/server/.env`. Optionally add `WATCHMODE_API_KEY=`.
2. Restart the server, open `/discover` while signed in (guests are asked to sign in).
3. Room queue: open a room, use the "Queue" tab, or "Find a title" which opens `/discover?room=<code>`.

## Tests

* Server unit (`apps/server/src/__tests__/catalog-*.test.ts` and `free-movies.test.ts`, each starts with `import './_noRealDb.js';`, fake `fetch`, injected clock): adapters and fixtures, cache / retry / breaker / timeout, service paths (not configured, no Watchmode, regions, link validation), collections (`catalog-india.test.ts` for the Indian ones), matchmaker, title queue (pure and through `RoomSyncManager` with fake sockets), routes (auth, validation, 503, secrets, watchlist privacy / duplicates / cap, rate limits, room REST).
* Web unit (`apps/web/src/lib/__tests__/catalogHelpers.test.ts`, `heroSlides.test.ts`): hero slide builder, carousel index math, Bitmoji url, filters to query, year parsing, debounce, search state machine, provider grouping, safe external link, image URLs, optimistic watchlist reducer, countdown helpers.
* Dynamic security (`.claude/skills/security-audit/scripts/security-tests.ts`): SEC-200 (catalog auth, 503, 400s, no leaks), SEC-201 (watchlist privacy / ownership / duplicates), SEC-202 (party queue over WebSocket and REST), SEC-203 (link validation), SEC-204 (URL-hash duplicates, one mixed list), SEC-205 (link privacy, guests refused, key validation), SEC-206 (cap across both kinds, race), SEC-207 (old documents, GDPR deletion).
* Server unit: `catalog-watchlist.test.ts` (link items, cap, privacy, old documents, Mongo store with a fake collection). Web unit: `unifiedWatchlist.test.ts` (input classification, suggestions, URL state, legacy migration, the watchlist store, sidebar routes).

## Known limitations

* No friends' recommendations: there is no "recommended to friends" data in the project and none was invented. No live-room counts, popularity or friend activity is shown anywhere.
* Provider filter and platform row verify availability title by title (bounded to 20 to 36 titles per request), so a filtered page can be short; use "Load more".
* Text search applies genre and year filters to the returned page (TMDB's text search cannot filter upstream), so pages can be shorter than 20.
* Rooms listed for "Propose to" are the rooms the person hosts (the existing `/api/user/rooms` returns hosted rooms); a member can propose from inside the room's Queue tab or by opening Discover with `?room=<code>`.
* The party queue is in memory (lost on server restart).
* Two simultaneous adds at exactly 500 can both be refused (the cap is enforced by count, insert, re-count and rollback), never both kept.
* The old on-device list is migrated per browser, not per account, and at most 50 links per visit.
