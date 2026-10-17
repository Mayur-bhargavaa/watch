# Free movie, TV and anime data sources for Cineverse

Research date: 2026-10-17. Every fact below was read from the cited page on that date ("read 2026-10-17"). Where a page could not be loaded or was ambiguous the text says "unverified". This is research, not legal advice.

## (a) Answer to the owner

Yes, with caveats. We can add more catalogue data for free, but the key point is that the two sources Cineverse already depends on are the ones with commercial strings: the TMDB free key is non-commercial only (a paid subscription product needs a TMDB licence, price not published), and the Watchmode free plan is non-commercial only (2,500 credits a month, paid plans start at $349 a month). The best free additions are: TVmaze (no key, TV episodes, CC BY-SA, any purpose), Wikidata (CC0, id mapping and Indian film metadata), AniList (anime, free below $150 revenue a month), TheTVDB (free below $50k company revenue, attribution), and the Streaming Availability API (free plan explicitly allows commercial use, but only 1,000 requests a month; paid starts at $49). Real in-room playback is only legally safe for public-domain / Creative Commons films (Internet Archive, Blender open movies) and for content the rights holder lets be embedded. What stays paid or licensed: TMDB commercial use, Watchmode production, Rotten Tomatoes, JustWatch, IMDb data. Letterboxd, IMDb scraping and MDBList free tier are not usable for this product.

## (b) Comparison table

Verdicts: use now / use later / avoid. "Commercial on free tier" means a monetised app with paid subscriptions.

| Source | What it adds | Key? | Free limits | Commercial on free tier? | Attribution | India coverage | Verdict | Source URL (read 2026-10-17) |
|---|---|---|---|---|---|---|---|---|
| TMDB | Current metadata, images, cast, genres, trending, discover by language | Yes (free) | About 40 req/s ceiling, not guaranteed | NO. Commercial needs written licence; charging users for an app using TMDB data is named as commercial | TMDB logo plus "uses TMDB and the TMDB APIs but is not endorsed" notice; logo less prominent than ours | Strong for Hindi, Tamil, Telugu, Malayalam, Kannada (already used); quality of Bengali/Marathi/Punjabi unverified | Keep, but get licence before charging | https://www.themoviedb.org/api-terms-of-use ; https://developer.themoviedb.org/docs/faq ; https://developer.themoviedb.org/docs/rate-limiting ; https://www.themoviedb.org/api-for-business |
| OMDb | Plot, IMDb rating, Rotten Tomatoes score, posters (posters via patron only) | Yes | FREE key: 1,000 requests a day | Unverified. Page gives no commercial policy; site content is CC BY-NC 4.0 | Unverified | Weak (US-centric, not checked for regional) | Use later, only as optional ratings after confirming terms with owner | https://www.omdbapi.com/apikey.aspx ; https://www.omdbapi.com/ |
| TVmaze | TV shows, episodes, seasons, cast, schedules, images, external ids (IMDb, TheTVDB) | No key mentioned | At least 20 calls per 10 s per IP, 429 on excess | YES: CC BY-SA 4.0, "any purpose" with credit | Link back to TVmaze; ShareAlike applies to the data (see risks) | TV only, mostly Western; Indian TV coverage unverified | Use now (TV episodes) | https://www.tvmaze.com/api |
| Trakt | Trending, lists, watch history, ids | Yes (app) | Rate numbers unverified (official docs page did not render) | Staff on forum: "no restriction ... commercial use", "no cost" (Feb 2026); a user reports app creation now needs VIP (Aug 2026, not confirmed by staff) | Unverified | Unverified | Avoid for now (status unstable) | https://forums.trakt.tv/t/asking-about-api-commercial-uses-on-free-plan/99367 |
| TheTVDB v4 | TV and movie metadata, artwork, episode order, translations | Yes | Request limits unverified | Free only if company revenue under $50k a year; $1,000/yr for $50k-$250k; $10,000/yr for $250k-$1M | Required: "Metadata provided by TheTVDB..." with a link | Unverified | Use later (TV artwork), only if revenue tier fits | https://www.thetvdb.com/api-information |
| MDBList | Aggregated ratings (IMDb, TMDB, Trakt, etc. per marketing), id cross-mapping (imdb, tmdb, trakt, tvdb, mal) | Yes | Official page: daily limits depend on supporter tier, no figures. Third-party mirror lists paid tiers from 10,000/day; free tier unverified | Unverified (not covered by page) | Unverified | Unverified | Avoid until terms verified | https://api.mdblist.com/ ; https://mdblist.memberful.com/join |
| Fanart.tv | Logos, clearart, extra artwork | Yes | Official page returned 403; unverified | Unverified | Unverified | n/a | Avoid (unverified) | https://fanart.tv/get-an-api-key/ (403) |
| Streaming Availability API (Movie of the Night) | Where to watch in 65 countries, incl. India (Netflix, Prime, Apple TV, JioHotstar, Zee5, SonyLiv, Mubi, Curiosity Stream, Crunchyroll) | Yes | Free: 1,000 requests a month, hard cap, no overage; Starter $49 (25,000), Growth $99 (100,000), Scale $299 (1,000,000) | YES, page says commercial usage allowed on all plans including free | Required when data or images are public | India listed with the nine services above (catalogue types unverified) | Use now as Watchmode alternative or fallback | https://www.movieofthenight.com/about/api/pricing ; https://docs.movieofthenight.com/guide/countries-and-services |
| Watchmode | Streaming availability, deep links | Yes | Free: 2,500 credits a month (CINEVERSE.md says about 1,000, now out of date), max 3 countries, no deeplinks, no episode links | NO, free is non-commercial. Paid: Startup $349/mo (40,000), Business $599/mo (100,000), Enterprise custom | Required on free; not on paid | India not specifically verified | Keep only if budget exists; SA is cheaper | https://api.watchmode.com/ |
| JustWatch | Availability | n/a | No public self-serve API found; page directs to data-partner@justwatch.com | Partner contract | n/a | n/a | Avoid. Only unofficial scrapers exist; do not use | https://www.justwatch.com/us/JustWatch-Streaming-API |
| Jikan (unofficial MyAnimeList) | Anime and manga metadata | No | Rate limits could not be read (docs page did not render); unverified | Not stated. Repo says MIT code, asks you to respect MyAnimeList terms; it scrapes MAL | Unverified | Anime only | Use later with caution; prefer AniList | https://github.com/jikan-me/jikan-rest |
| AniList GraphQL | Anime and manga, covers, scores, schedules | No key for public queries (unverified) | 90 requests per minute (30 when degraded), 1-minute timeout on excess | YES under $150 revenue a month; above that needs commercial licence (contact@anilist.co) | Attribution rule unverified | Anime only | Use now for anime, with a revenue watch | https://raw.githubusercontent.com/AniList/ApiV2-GraphQL-Docs/master/docs/guide/terms-of-use.md ; .../rate-limiting.md |
| Kitsu | Anime metadata, posters, ratings, youtubeVideoId, streamingLinks | Public endpoint answered; key requirement unverified | Unverified | Terms unverified | Unverified | Anime only | Use later (fallback for anime) | https://kitsu.io/api/edge/anime |
| IMDb non-commercial datasets | ids, titles, ratings, episodes, crew (TSV, daily) | No | Download | NO: "personal and non-commercial use" | n/a | Includes regional AKAs but no posters/overviews | Avoid for the product (can be used for offline id research only if non-commercial) | https://data.imdb.com/non-commercial-datasets/ ; https://www.imdb.com/conditions |
| Wikidata / Wikipedia / Commons | Ids (IMDb, TMDB), labels in Indian languages, dates, cast links | No | WDQS: 60 s query cap, 60 s processing per 60 s per client, 5 parallel per IP, 429 then bans; User-Agent required | YES: structured data is CC0. Text in other namespaces CC BY-SA 4.0. Commons images carry their own licences (unverified) | None for CC0 data | Useful for regional films; coverage varies | Use later (id and label enrichment, cached offline) | https://www.wikidata.org/wiki/Wikidata:Licensing ; https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual |
| Internet Archive | Public-domain and freely licensed films, files, thumbnails | No | Advanced search returns JSON; numeric limits and automated-access policy NOT read (page did not render); Wayback rate limiting reported only by a secondary blog | Per item licence. Site terms unverified | Per item | Mostly Western classics; little Indian content verified | Use now (curated list) after reading item licences and the terms page | https://archive.org/advancedsearch.php ; https://archive.org/developers/ |
| YouTube Data API v3 | Trailers, free-to-watch uploads | Yes | 10,000 units a day; search.list is 1 unit but its own cap of 100 calls a day; videos.list 1 unit | Allowed (ad-enabled apps, selling a client). Cannot charge users to watch content in an embedded player | YouTube branding must stay | Whatever is uploaded | Keep; see legal section | https://developers.google.com/youtube/v3/determine_quota_cost ; https://developers.google.com/youtube/terms/developer-policies |
| Blender open movies | CC BY films (Big Buck Bunny, Sintel, Tears of Steel, Spring, Coffee Run, etc.) | No | Download or embed | CC BY per Blender (licence text not on the page I read, unverified there) | Credit Blender Foundation | n/a | Use now (small, safe seed for real playback) | https://studio.blender.org/films/ |
| Letterboxd | Ratings, lists | Request-only | n/a | Excluded uses include recommendation projects and anything recreating paid-tier features; page points to TMDB for general metadata | n/a | n/a | Avoid. Official page returned 403 to me; facts come from a search summary of the page, unverified | https://letterboxd.com/api-beta/ |
| Rotten Tomatoes | Critic scores | Approval and paid licence | Search summaries say about $60,000 a year; unverified | Paid | n/a | n/a | Avoid (no free public API found; secondary sources only) | not read at source |
| India OTT (Hoichoi, Aha, SunNXT, etc.) | n/a | n/a | n/a | n/a | n/a | n/a | I did not find or verify any official public metadata API. Unverified. Do not scrape. | not researched at source |

## (c) The legal reality

A paid-subscription watch-party product is commercial. Where each source stands:

Safe for commercial use as the page reads today (still keep attribution):
- TVmaze (CC BY-SA 4.0, credit and ShareAlike).
- Wikidata structured data (CC0).
- Streaming Availability API, all plans including free (attribution when public).
- AniList while revenue is under $150 a month; licence needed above.
- TheTVDB while company revenue is under $50k a year (attribution; paid tiers above).
- Blender open movies and Internet Archive items that are public domain or CC, per item.

Need a licence or paid plan before launch of paid features:
- TMDB (the page names "charging users for an app that integrates TMDB data" as commercial; contact sales@themoviedb.org; price not published).
- Watchmode (free plan is non-commercial; paid from $349 a month).
- JustWatch (partner contract only).
- Rotten Tomatoes (approval plus paid licence per secondary sources).

Non-commercial only: TMDB free key, Watchmode free plan, IMDb datasets, OMDb site content (CC BY-NC 4.0; API policy unverified).

Other traps:
- TMDB: cache no longer than 6 months; no machine-learning use; no derivatives. The existing `freeMoviesData.json` stores TMDB text and image URLs in the repo, which should be refreshed within the 6 month rule.
- Watchmode free: refresh or delete cached data within 30 days. YouTube: cached API data at most 30 days.
- YouTube: the policy says you cannot charge users to watch content in an embedded player. If rooms that play YouTube videos sit behind a paid pass, get that reviewed. Also no ad blocking, no separating audio from video.
- The repo's `freeMoviesData.json` has 21 entries, all of source "youtube", mostly full Hindi films on third-party YouTube URLs (the code labels some as "Internet Archive (Free Cinema)" but none are). I did not verify whether those uploaders own the rights. If they do not, embedding is a copyright risk. Only embed where the channel is the official rights holder.
- TVmaze ShareAlike: it applies to the TVmaze data itself; whether our merged normalised record counts as an adaptation is a legal question. Keep TVmaze-derived fields tagged by source and attributed.
- Mixing sources: TMDB terms contain no explicit clause on combining data but forbid derivatives. Showing several ratings together with each label and source name is the safe pattern.
- JustWatch attribution: the TMDB watch-provider page I read did not state it; unverified.

## (d) Integration plan fitted to the adapter architecture

Existing shape: adapters under `services/catalog/adapters/` (tmdb, watchmode, youtube) feed `CatalogService`, which uses `cache.ts` and `upstream.ts` (8 s timeout, 2 retries, breaker). `CatalogTitle` currently has `source: 'tmdb'` only, `ratingSource: 'TMDB'`, ids like `tmdb:movie:603`.

Model change needed first (small): widen `CatalogSource` and `ratingSource`; add optional `externalIds {tmdb, imdb, tvdb, tvmaze, anilist, wikidata}`, `ratings[] {source, value, votes}`, `attribution[]` (source ids used). Keep `tmdb:` as the canonical key; other sources attach to it.

Adapters in order:

1. TVmaze adapter (no key). Feeds: `seasons`, `episodes` list per season, `runtimeMinutes` per episode, `status`, TV `cast`, `externalIds` (IMDb, TheTVDB). Lookup by IMDb id (needs the TMDB external id call) or by name search. Cache: show details 24 h, episodes 6 h, search 1 h. Rate: single global limiter at 15 calls per 10 s; honour 429 with backoff; set a descriptive User-Agent. Quota: free, but with 1,000 title page views a day and about 2 calls each, 2,000 calls a day is fine.
2. Streaming Availability adapter (key, free 1,000 a month; paid $49 for 25,000). Feeds `providers[]` with `destinationUrl`, region IN, India services. Cache availability 6 to 24 h (not 30 minutes) to protect quota. Budget: 1,000 a month is about 33 a day, so at 1,000 title opens a day with a 24 h cache and say 20 percent unique titles you need 6,000 a month, so plan on Starter $49. Can replace Watchmode ($349) if coverage in India is adequate (unverified: confirm with a test key).
3. AniList adapter (no key, 90 per minute). Feeds anime `CatalogTitle` with `mediaType` extended to `anime` or tagged `genres: ['Anime']`, cover, banner, score (ratingSource "AniList"), episodes, trailer. Cache 6 h details, 15 min trending. Keep the revenue limit ($150 a month) in the owner decisions. Map to TMDB via title plus year, or via Kitsu or Wikidata where needed.
4. Wikidata enrichment job (offline, not per request). Run a SPARQL query on a schedule for Indian films with IMDb and TMDB ids and original-language labels (Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi) to fill the id map and regional titles. Respect the 60 s query cap, one query at a time, with a User-Agent. Store the result in our DB (CC0, so no TTL limit).
5. Internet Archive and Blender "Free Cinema" source. A curated list (not live search) of items whose licence is public domain or CC, each with `archiveId`, licence text, credit. Feeds `providers[]` with type `free` and `EMBEDDED_PROVIDER_CAPABILITIES`, which already gives playback `embedded` and roomSync `full`. This is the only place we can legally do real synchronised playback without a licence deal. Refresh the metadata from the advanced search API at most daily. Read each item licence by hand once.
6. TheTVDB (later, only if revenue qualifies) for artwork and alternative episode ordering, with the required attribution text.
7. Ratings: AniList scores and TMDB only for now. Avoid MDBList and OMDb until their terms are confirmed.

De-duplication and merge: canonical key stays `tmdb:<type>:<id>`. Id map table: `tmdb <-> imdb <-> tvdb <-> tvmaze <-> anilist <-> wikidata`, filled from TMDB `external_ids`, TVmaze `externals`, and Wikidata. Field precedence: TMDB for title, overview, images; TVmaze for episodes; AniList for anime fields; Streaming Availability for providers; Archive for free offers. Never overwrite a non-null field with a worse source; record the source per field group so attribution can be generated from what was actually shown. Existing `deduplicateTitles` should compare on id map first, then normalised title and year.

Attribution UI: one footer block on `/discover` and title pages that lists only the sources used on that page (TMDB logo and "not endorsed" notice, TVmaze link, AniList, TheTVDB sentence if used, Streaming Availability, Internet Archive item credit with licence).

Stale-cache rules to code in: TMDB 6 months max; Watchmode free 30 days; YouTube 30 days; ids only from Wikidata have no limit.

## (e) Risks and open questions for the owner

1. Will paid subscriptions go live on a surface that shows TMDB data? If yes, buy the TMDB licence (price not published; contact sales@themoviedb.org with the business description). Ask what it costs before building more on TMDB.
2. Watchmode at $349 a month versus Streaming Availability at $49 a month: confirm India coverage with a free test key before choosing.
3. Is revenue expected to stay under the AniList $150 a month and TheTVDB $50k a year thresholds?
4. Review the 21 YouTube free movies for rights; confirm YouTube embed in a paid-pass room is acceptable under the policy.
5. CINEVERSE.md has stale numbers: Watchmode free is now 2,500 credits for 3 countries (non-commercial); YouTube search quota page now says search.list costs 1 unit with a 100 calls a day cap, not 100 units.
6. Unverified items to close before relying on them: Jikan limits and terms, Kitsu terms, Trakt official terms and rate limits, TheTVDB request limits, Fanart.tv, MDBList free limits and terms, OMDb commercial policy, Internet Archive terms of use and automated access policy, TMDB Bengali, Marathi and Punjabi coverage, Hoichoi, Aha and SunNXT official APIs (none found, not researched at source), Rotten Tomatoes price.

## (f) What I would do first

1. Decide the TMDB licence and Watchmode vs Streaming Availability question with the owner (small, no code; blocks everything else).
2. Fix CINEVERSE.md licence numbers and widen the model (`externalIds`, `ratings[]`, `attribution[]`) (small).
3. TVmaze adapter for TV episodes and seasons plus attribution footer (medium).
4. Streaming Availability adapter, run behind the existing availability interface with a 24 h cache (medium).
5. Curated Internet Archive and Blender free-cinema list with embedded playback, replacing the unverified YouTube-only list where possible (medium; the licence reading is the long part).
6. AniList adapter for an Anime row (medium).
7. Wikidata offline id-map and regional-title job (large).
8. TheTVDB, Kitsu fallback, MDBList or OMDb ratings after their terms are verified (small each, after verification).
