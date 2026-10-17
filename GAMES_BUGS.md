# Games: current status, then the historical bug report

## Current status (13 games)

The audit below covers the first seven games (October 2026 review and fixes). Six more games were added afterwards. This section describes what exists NOW, verified against `apps/server/src/games/GameDefinitions.ts`, `apps/web/src/lib/gamesHub.ts` and the engines in `apps/server/src/games/`. The six newer games have their own unit tests (`games-<name>.test.ts` and `games-<name>-manager.test.ts` in `apps/server/src/__tests__/`) and live security tests, but have NOT had a line-by-line bug audit like the first seven.

| Game | Route | Players | Host pass | Rules in one line |
|---|---|---|---|---|
| Ludo Party | `/games/ludo` | 2-4 (options 2, 3, 4) | any | Roll, move four tokens round the board, capture, first to bring all home wins; 45 s turn timer auto-plays an idle seat |
| Tic Tac Toe | `/games/tic-tac-toe` | 2 | any | Three in a line on a 3x3 board; starting side alternates on rematch |
| Four in a Row | `/games/four-in-a-row` | 2 | any | Drop discs into columns, four in a line wins |
| Bingo Duel | `/games/bingo` | 2 | any | 1-25 on a 5x5 card, turn-based number picks, complete the pattern first; idle turn auto-picked after 45 s |
| Tambola | `/games/tambola` | 2-20 | any | 90-ball housie with tickets, numbers drawn by the server, players send claims that the server validates |
| Doodle Duel | `/games/doodle-duel` | 2 | any | One draws a server-offered word, the other guesses, then switch; the secret word goes only to the drawer |
| Chess | `/games/chess` | 2 | any | Standard rules (chess.js) with a server-kept clock; the clock keeps running during a disconnect grace (intended) |
| Imposter | `/games/imposter` | 4-8 | VIP+ | Everyone but one secret imposter sees the word; 2 clue rounds (3 or 5 game rounds), discuss, vote the imposter out; clue max 24 characters |
| Emoji Charades | `/games/emoji-charades` | 2-8 | VIP+ | Race to guess a movie or show from emoji; 60 s per puzzle, hints at 20 s and 40 s; 3 or 5 rounds; at most 12 wrong guesses per round; mode is `race` only |
| Mafia Night | `/games/mafia` | 5-10 | VIP+ | Night and day cycle; hidden Mafia (1 for 5-6 players, 2 for 7-8, 3 for 9-10), 1 Doctor, 1 Detective, rest Villagers; night actions, dawn, discussion, vote (or skip) |
| Quiz Show Studio | `/games/quiz-show` | quiz master plus 1-30 | Creator | Host writes up to 40 questions (multiple choice, 2-4 options, or buzzer); 10/20/30 s limits, 100/200/300 points, streak bonus +10 (max +50), buzzer wrong-answer penalty half the points, live leaderboard |
| Murder Mystery Night | `/games/murder-mystery` | 6-12 (host plays) | Creator | Scripted whodunit: character reveal (15 s), 4 clue rounds of 90 s with private clues, up to 5 whispers per round and a limited number of public clue reveals, accusation (60 s), result |
| Tournament Arena | `/games/tournament` | organiser plus 4-32 | Creator | Single-elimination bracket of 1v1 matches in Tic Tac Toe (default), Four in a Row or Chess; every match is a real private game room created by the server; 120 s window to open a match, host can resolve stuck or no-show matches |

Common behaviour (all in `GameRoomManager.ts` and `index.ts`):

* Pass gating: only HOSTING is gated (`requiredHostTier`). Imposter, Emoji Charades and Mafia Night need a VIP host; Quiz Show Studio, Murder Mystery Night and Tournament Arena need a Creator host. Both room-creation paths answer `403 UPGRADE_REQUIRED` for a lower pass. Anyone can join with a room code or friend invite. See `BILLING.md`.
* Partner mode (a 2-person room for two paired partners): the seven classic games only (`supportsPartnerMode`). The six newer games are invite-by-code or friends only.
* Public matchmaking (`POST /api/games/matchmake`): the seven classic games only (`supportsPublicMatchmaking`). The six newer games have none.
* Spectating: an accepted friend of a player can watch a game that is in progress (`?spectate=1` on `/ws/games/:code`), read-only, at most 10 per room (`GAME_MAX_SPECTATORS`), joins rate limited. Spectators never take a seat or vote and receive the same redacted view as any non-player (in Mafia Night only the town channel).
* Disconnects: 45 s grace while playing, 10 s in a lobby (`GAME_DISCONNECT_GRACE_MS`, `GAME_LOBBY_GRACE_MS`).
* All rules and hidden information (words, roles, answers) live on the server; clients receive redacted views.
* "Notify me" for coming-soon games exists, but `UPCOMING_GAMES` is empty today, so the hub shows no coming-soon section.

Test-only switches (development only; full list and wording in `BILLING.md` and the README env table):

| Game | Switch | Effect |
|---|---|---|
| Imposter | `IMPOSTER_TEST_MIN_PLAYERS=2` or `3` | lobby can start with fewer than 4; ignored in production |
| Mafia Night | `MAFIA_TEST_MIN_PLAYERS=2..5` | lobby can start with fewer than 5; ignored in production |
| Murder Mystery Night | `MURDER_TEST_MIN_PLAYERS=2..6` | lobby can start with fewer than 6 (2 players = murderer plus one other); ignored in production |
| Tournament Arena | `TOURNAMENT_TEST_MIN_PLAYERS=2..4` | 2 players = one final match; ignored in production |
| several | `*_REVEAL_MS`, `*_RESULT_MS`, `MAFIA_DAWN_MS`, `QUIZ_INTRO_MS`, `EMOJI_CHARADES_*_MS` | shorten phases for tests (minimum 100 ms); NOT ignored in production, so never set them there |
| Ludo | `LUDO_TURN_TIMEOUT_MS=0` | turns the idle-turn auto-play off |

Known limitations:

* Unverified: how running games behave across a server restart (live game state is held by `GameRoomManager` in memory; this was not tested).
* The six newer games have not been through a full line-by-line audit; their engines are covered by unit tests and the dynamic security suite only.
* Games were never played through to the end in a real browser by the automated checks (the browser smoke test only loaded the pages), so UI polish and timing issues can still exist.
* Voice and video calls use public Google STUN servers only (`apps/web/src/context/CallContext.tsx`); there is no TURN relay, so calls can fail on strict NATs (see `SECURITY.md`).
* Quiz Show Studio room capacity is 31 (host plus 30) and Tournament Arena 33 (organiser plus 32) in `GameDefinitions`.

---

# Historical report: games bug audit (first 7 games + shared room layer)

Date: 2026-10-14 (review), 2026-10-15 (fixes). **Status: all 175 findings are closed (174 fixed, 1 kept on purpose as intended design).** The report text further down is the original review, kept unchanged so each finding's description and reproduction are still available.

## Status after the fixes (2026-10-15)

| Result | Count |
|---|---:|
| Fixed | 174 |
| Closed as intended design (documented in code) | 1 |
| Open | 0 |

Every finding had its server half, web half or both addressed. Each reproduced finding got a regression test. The seven items that were first only partly fixed were closed in a second round:

| ID | How it was closed |
|---|---|
| GR-3 | Read-only **spectator mode**: an accepted friend of a player can watch a game in progress (`?spectate=1`, max 10 per room, 20 joins/min). Spectators never take a seat, get the same hidden-information view as any non-player, and can only send reactions and leave. The games hub has a "Watch" button for friends' games. |
| GR-21 | Pairing by partner code is now a **request and accept** flow (request, accept, decline with 24 h cooldown, cancel; live and push notifications; Friends page block). Accepted friends still link instantly. |
| GR-23 | A real **"Notify me"** list for coming-soon games, plus an owner script and a server job that sends one "now live" notice per person when a game launches. |
| GR-30 | The last small items (reply/user-name length in chat) are capped. |
| CH-23 | The unreachable Solo Practice code and its UI were removed from the chess page, board and waiting room. |
| FR-7 | When a rematch is refused because the opponent left, the end screens of Tic-Tac-Toe, Four in a Row, Ludo, Chess, Doodle, Bingo Duel and Tambola offer "Start a new game with <name>" (or "Back to games" if they are no longer a friend). |
| CH-14 | **Intended design:** the chess clock keeps running during the 45 s disconnect grace (standard for online chess); documented in a code comment on the clock logic. |

### Behaviour you will notice
- **Bingo Duel is turn-based only.** The timed auto-call was removed. An idle turn is auto-picked after 45 s, and a second `bingo:start` is rejected.
- **Tambola is 90-ball only** (a 75-ball config is rejected) and rooms of 5-20 players now work.
- **Players can no longer see each other's boards, tickets or the future draw order** (Bingo Duel, Tambola); the secret word in Doodle Duel is sent only to the drawer.
- **Doodle Duel:** the "draw anything" custom-word box was removed (the server now rejects words it did not offer); a guesser or spectator can no longer become the drawer mid-round.
- **Ludo** has a 45 s server turn timer (`LUDO_TURN_TIMEOUT_MS`, 0 turns it off) that auto-plays an idle seat, and the 4-player seat order is red, blue, yellow, green.
- **Disconnects:** 45 s grace while playing and 10 s in a lobby (`GAME_DISCONNECT_GRACE_MS`, `GAME_LOBBY_GRACE_MS`); a reconnect cancels the forfeit, and if both players drop nobody wins.
- **Rematches** need every active player, only after the game finished, and the starting side alternates.
- Rule errors reach the player as a `game:error` message (for example "not your turn"); the pages show them.

### How it was verified
- Security suite: **108 / 108** live tests pass (this includes the later features). Static checks 0 failing (includes the new STA-32 no-emoji and STA-33 no-real-database checks). `npm audit`: 0 vulnerabilities.
- New server regression tests: `games-shared`, `games-board`, `games-bingo`, `games-doodle`, `games-chess`, `games-leftovers`; the server unit suite is **148 / 148**. Ludo regression **24 / 24**. Chess engine checked with the standard move-count tests (start position and the "Kiwipete" position).
- Web: 93 unit tests, 0 lint errors, type check and production build pass.
- Browser smoke test (headless Chrome, two players, throwaway database): all seven game pages render for both players with no crash screen and no uncaught page errors (28 / 28 checks). The games were not played through to the end in a browser, so rules and animations were checked by tests, not by eye.
- Lint: no new errors; the older `no-floating-promises` warnings in the big game pages remain.

### Other things to know
- Some of the new server tests first ran against the real MongoDB (the game code loads `apps/server/.env`). That is now blocked (`__tests__/_noRealDb.ts`, check STA-33), but the earlier runs may have left a test streak record (`stk_guest_host` in `friend_streaks`) and some `party_activity_logs` entries in your live database. Please look and delete them by hand.
- One leftover control in Doodle Duel's pre-room lobby (a "draw time" picker) is still not connected to anything.

## Scope and method

Eight independent read-only reviews were run, one per game and one for the code all games share (rooms, joining, leaving, reconnecting, rematch, chat). Each reviewer read the server engine, the shared logic in `packages/common`, the web page and its components, and the relevant part of `GameRoomManager.ts`, then tried to prove findings by running the engines directly with scripts, or by opening real sockets against a throwaway in-process server and a disposable MongoDB (never a real database).

Games covered: **Ludo, Four in a Row, Tic-Tac-Toe, Bingo Duel, Tambola, Chess, Doodle Duel**, plus the shared room layer. Evidence labels: **VERIFIED** = reproduced by running code and seeing the wrong result; **CODE** = clear from reading, with the reasoning given. IDs: LU = Ludo, FR = Four in a Row, TT = Tic-Tac-Toe, BD = Bingo Duel, TA = Tambola, CH = Chess, DD = Doodle Duel, GR = shared room layer. Games found by only one reviewer may share a root cause with another (for example the 5-second disconnect rule); the shared-layer section lists those root causes once.

## Totals

| Game | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Ludo | 1 | 3 | 5 | 9 | 18 |
| Four in a Row | 0 | 4 | 5 | 4 | 13 |
| Tic-Tac-Toe | 0 | 2 | 8 | 10 | 20 |
| Bingo Duel | 1 | 5 | 10 | 7 | 23 |
| Tambola | 1 | 4 | 10 | 6 | 21 |
| Chess | 1 | 5 | 8 | 9 | 23 |
| Doodle Duel | 2 | 5 | 9 | 9 | 25 |
| Shared room layer (all games) | 0 | 10 | 17 | 5 | 32 |
| **All** | **6** | **38** | **72** | **59** | **175** |

75 of the 175 findings are VERIFIED by execution; the rest are CODE findings.

## Critical and High findings (fix these first)

| ID | Game | Severity | Title | Evidence | Location |
|---|---|---|---|---|---|
| BD-1 | Bingo Duel | Critical | Any player can swap their board mid-game (`bingo:set_board`) after seeing called numbers and win instantly | VERIFIED | BingoDuelEngine.ts:432-493; GameRoomManager.ts:1204 |
| CH-1 | Chess | Critical | `chess:draw_response` with `accept:true` and no valid offer freezes/ends the room (offerer even gets Accept button on own offer) | CODE (engine no-op VERIFIED) | GameRoomManager.ts:1912-1939; ChessEngine.ts:261-264; useGameRoom.ts:979; page.tsx:815 |
| DD-1 | Doodle Duel | Critical | Any room client (guesser or spectator) can make themselves drawer mid-round and receive the secret word via `doodle:select_role` | VERIFIED | GameRoomManager.ts:1405-1461, 1368-1400 |
| DD-2 | Doodle Duel | Critical | Secret word leaks to the guesser through `game:player_reconnected`, `game:player_left`, and `GET /api/games/rooms/:code` | VERIFIED | GameRoomManager.ts:2111-2115, 2500-2620; index.ts:1509-1521 |
| LU-1 | Ludo | Critical | Reconnecting/second socket makes the still-connected player forfeit after 5 s | VERIFIED | GameRoomManager.ts:2001-2030, 2556-2651 |
| TA-1 | Tambola | Critical | Server broadcasts the entire future draw order (`callQueue`) and every player's ticket to every client | VERIFIED (state) + CODE (broadcast) | GameRoomManager.ts:395-406, 795-805, 1124-1133, 2113-2123; BingoEngine.ts:280-299 |
| BD-2 | Bingo Duel | High | `claimBingo` has no phase check: both players win the same round; loser can claim after match FINISHED and overwrite the winner | VERIFIED | BingoDuelEngine.ts:652-737; GameRoomManager.ts:967 |
| BD-3 | Bingo Duel | High | Full game state (both boards, whole future call queue, all marks) is broadcast to both clients | VERIFIED | GameRoomManager.ts (every bingo broadcast `gameState: state`), game:sync ~2098 |
| BD-4 | Bingo Duel | High | Finished/round-over games can be reopened: `set_board` sets phase back to PLAYING; `next_round` works in any phase | VERIFIED | BingoDuelEngine.ts:479-482, 742; GameRoomManager.ts:858 |
| BD-5 | Bingo Duel | High | Any authenticated user who knows the room code can attach to a full room, receive all state (boards) and send game messages; outsider `select_number` self-heal flips phase to PLAYING | CODE | index.ts:2052-2117; GameRoomManager.ts:1137-1150 |
| BD-6 | Bingo Duel | High | Host's room config is never persisted: `config_update` is lost, auto-start uses defaults, rematch resets to defaults | CODE | GameRoomManager.ts:368, 831, 1253-1262; database.ts:2187 |
| CH-2 | Chess | High | No player-membership check: any connected user (spectator/outsider with room code) can resign Black, offer/accept draws, request/answer takebacks | VERIFIED (engine) + CODE | ChessEngine.ts:229-298; GameRoomManager.ts:1871-1973, 2294-2312; index.ts:2053-2119 |
| CH-3 | Chess | High | Clock double-deducted: 1s ticker subtracts AND `makeMove` subtracts full elapsed time again | VERIFIED | GameRoomManager.ts:1745; ChessEngine.ts:96-100 |
| CH-4 | Chess | High | Takeback does not restore the position (FEN/turn unchanged, moves popped) -> state desync | VERIFIED | ChessEngine.ts:299-329 |
| CH-5 | Chess | High | Leaving/disconnecting after game over rewrites result to ABANDONED and gives the win to the other player (winner leaving makes loser the "winner") | CODE | GameRoomManager.ts:2415-2436 (leave), 2594-2630 (grace timer) |
| CH-6 | Chess | High | Threefold repetition is never detected (fresh `Chess(fen)` has no history) | VERIFIED | ChessEngine.ts:108,192 |
| DD-3 | Doodle Duel | High | Drawer can "guess" the word: wins the round, scores 100+50 for themselves | VERIFIED | GameRoomManager.ts:1644-1688; DoodleDuelEngine.ts:345-420 |
| DD-4 | Doodle Duel | High | `doodle:choose_word` has no phase check and no validation against offered choices (restart drawing at any time, resurrect finished game, pick any word) | VERIFIED | GameRoomManager.ts:1555-1573 |
| DD-5 | Doodle Duel | High | Stroke/undo/clear/live_draw: no phase check, no shape/size/count validation; unbounded state growth re-broadcast and re-persisted every second | VERIFIED | GameRoomManager.ts:1586-1642, 1302-1320 |
| DD-6 | Doodle Duel | High | Configured `rounds` ignored when a gameState already exists; rematch resets config to defaults; `doodleConfig` is never persisted | VERIFIED | GameRoomManager.ts:1495-1500, 1702-1722, 384; DoodleDuelEngine.ts:241 |
| DD-7 | Doodle Duel | High | Rematch can never complete in a bot game; spectators' votes count; rematch accepted mid-game | VERIFIED (bot) / CODE | GameRoomManager.ts:529-580 |
| FR-1 | Four in a Row | High | Leaving/disconnecting after the game ends overwrites the result: the loser/leaver's opponent is declared winner (also turns a draw into a win) | CODE | GameRoomManager.ts:2467-2495, 2586-2600 (handleClientLeave / disconnect timer); page.tsx:2826-2831 |
| FR-2 | Four in a Row | High | Stale-socket close starts a forfeit timer for a user who is actually connected (refresh / second tab / network switch) | CODE | GameRoomManager.ts:1995-2010 (registerClient), 2562-2640 (handleClientDisconnection) |
| FR-3 | Four in a Row | High | NaN / fractional / missing column is accepted: a turn is burned and no disc is placed | VERIFIED | FourInARowEngine.ts:38-44, 172-174; GameRoomManager.ts:2193 |
| FR-4 | Four in a Row | High | Any room member (incl. a spectator/non-player) can vote rematch and restart a game, even mid-game, without the opponent's consent | CODE | GameRoomManager.ts:529-575 |
| GR-1 | Shared room layer (all games) | High | Leaving or disconnecting after a game ends rewrites the winner (the loser "wins") | VERIFIED (S1, S1b) | GameRoomManager.ts:2474, 2583 |
| GR-10 | Shared room layer (all games) | High | Host lobby settings (chess time control, bingo rounds/pattern, tambola) are silently discarded on auto-start | VERIFIED (S17) | GameRoomManager.ts:1253-1280, 1975-1990, 334-337, 366-381 |
| GR-2 | Shared room layer (all games) | High | A replaced/stale socket of the same user schedules a forfeit; the connected player loses after 5 s | VERIFIED (S2) | GameRoomManager.ts:2013-2021, 2560-2572 |
| GR-3 | Shared room layer (all games) | High | No membership check: any logged-in user with a room code can join as spectator and act (force rematch, resign chess for black) | VERIFIED (S4, S11) | GameRoomManager.ts:1995-2044, 2157, 529; index.ts:2087-2119 |
| GR-4 | Shared room layer (all games) | High | Private data sent to everyone: doodle secret word, Bingo Duel boards, REST room GET | VERIFIED (S5a, S6) | GameRoomManager.ts:2118-2122, 1450-1459, 417; index.ts:1509 |
| GR-5 | Shared room layer (all games) | High | `doodle:select_role` lets any client become the drawer mid-round (sees the secret word) | VERIFIED (S5b) | GameRoomManager.ts:1405-1461, 2242 |
| GR-6 | Shared room layer (all games) | High | Host can restart a running/finished game any time with arbitrary unvalidated config (chess `baseTimeMs:1` ends it instantly) | VERIFIED (S10) | GameRoomManager.ts:823-837, 1463, 1790-1823, 1975 |
| GR-7 | Shared room layer (all games) | High | Host is never transferred; abandoned empty rooms stay matchable and host-only games are dead | VERIFIED (S7) | GameRoomManager.ts:2575-2582; database.ts:2212 |
| GR-8 | Shared room layer (all games) | High | Tambola rooms for 5-20 players cannot be created (REST 400, WS auto-create TypeError) | VERIFIED (S8) | GameRoomManager.ts:205; GameDefinitions.ts:85-92; index.ts:2095; gameInvite.ts:21 |
| GR-9 | Shared room layer (all games) | High | One `game:reaction` with a non-string emoji is relayed verbatim and crashes every client's render | CODE (server relay VERIFIED S13b) | GameRoomManager.ts:2382-2395; ReactionGlyph.tsx:9 |
| LU-2 | Ludo | High | Winner leaving after the game ends flips the result: loser is recorded and shown as winner | VERIFIED | GameRoomManager.ts:2466-2490, 2575-2600 |
| LU-3 | Ludo | High | 3/4-player: leaver/disconnected seat stays in rotation, game stalls forever | VERIFIED | GameRoomManager.ts:2466, 2590; LudoEngine.ts:152-165,305 |
| LU-4 | Ludo | High | No turn timer / AFK handling for Ludo (only a "nudge" button) | CODE | GameRoomManager.ts (none exists); LudoGame.tsx:2735 |
| TA-2 | Tambola | High | Tambola rooms for 5-20 players cannot be created at all (only 2-4 colour tables exist); advertised 2-20 is broken | VERIFIED | GameDefinitions.ts:80-92; GameRoomManager.ts:210-211; index.ts:2095-2104 |
| TA-3 | Tambola | High | "CLAIM TAMBOLA!" button always claims a fixed-priority prize from local marks; middle/bottom line and four corners often unclaimable, false claims spammed | CODE | tambola/page.tsx:598-612 |
| TA-4 | Tambola | High | Claims are accepted after the game is FINISHED; scores and winner change after game over | VERIFIED | BingoEngine.ts:550-715; GameRoomManager.ts:967-1095 |
| TA-5 | Tambola | High | Auto-call timer is never restarted after server restart; game freezes forever (no number is ever drawn again) | CODE | GameRoomManager.ts:54, 704-722, 2060-2123 |
| TT-1 | Tic-Tac-Toe | High | Leaving (or disconnecting from) a finished game flips the result: the remaining player is made the winner, including after a draw | VERIFIED | GameRoomManager.ts:2467-2500, 2570-2605; page.tsx:1112, 1526 |
| TT-2 | Tic-Tac-Toe | High | Reconnecting while the old socket is still open makes the server forfeit the connected player 5 s later | VERIFIED | GameRoomManager.ts:2000-2020, 2152-2154, 2560-2651 |

## Medium and Low findings (index)

| ID | Game | Severity | Title | Evidence |
|---|---|---|---|---|
| BD-10 | Bingo Duel | Medium | Client shows "You win" to the loser whenever the opponent is disconnected/left after a finished game | CODE |
| BD-11 | Bingo Duel | Medium | `callNext` path (auto-call/manual call) never marks boards; auto-call timer runs only from round 2 on and mixes with turn picks | VERIFIED+CODE |
| BD-12 | Bingo Duel | Medium | When all 25 numbers are called with no winner the game never resolves (phase stays PLAYING; best-of series deadlocks) | VERIFIED |
| BD-13 | Bingo Duel | Medium | Simultaneous completion: no server-side tie-break; the picker's pick completes both boards and first claim message wins | CODE |
| BD-14 | Bingo Duel | Medium | No turn timer: an idle player stalls the game forever (only a Nudge button) | CODE |
| BD-15 | Bingo Duel | Medium | 5 s disconnect grace forfeits the whole best-of match on a refresh/network blip | CODE |
| BD-16 | Bingo Duel | Medium | Client overwrites local `duelConfig` from `gameState.config` on every state update (settings toggles revert, e.g. voice caller) | CODE |
| BD-7 | Bingo Duel | Medium | `select_number` accepts fractional numbers and NaN (consumes turn, corrupts call count, ends game early) | VERIFIED |
| BD-8 | Bingo Duel | Medium | Host can `bingo:start` (restart) mid-match or after finish; any rematch vote counts while a game is running | CODE |
| BD-9 | Bingo Duel | Medium | Leaving after a finished match overwrites the winner with the remaining player (forfeit logic ignores phase) | CODE |
| CH-10 | Chess | Medium | Rematch accepts votes from non-players and while game is in progress; 1 player + 1 outsider restarts a live game | CODE |
| CH-11 | Chess | Medium | Time-control preset buttons in lobby do nothing (`CHESS_TIME_PRESETS` is an array indexed by string id) | CODE |
| CH-12 | Chess | Medium | Non-player/spectator UI is treated as White: board enabled on White's turn, resign/draw buttons live | CODE |
| CH-13 | Chess | Medium | Chess clock ticker is never restarted after server restart/reload for a PLAYING room -> no flag-fall, free time | CODE |
| CH-14 | Chess | Medium | Disconnect does not pause the clock; refresh/network blip >5 s forfeits the game | CODE |
| CH-7 | Chess | Medium | Rejected/illegal moves still burn the mover's clock (state mutated before validation) | VERIFIED |
| CH-8 | Chess | Medium | Stale draw offer / takeback request still answerable after game over: CHECKMATE becomes DRAW / zombie CHECK | VERIFIED |
| CH-9 | Chess | Medium | Host can `chess:start` at any time (mid-game restart, no status check) with unvalidated client config (negative/NaN/huge clocks) | VERIFIED (config) + CODE |
| DD-10 | Doodle Duel | Medium | Host can re-send `doodle:start` at any time: restarts current round, re-rolls word, re-picks roles, keeps scores | VERIFIED |
| DD-11 | Doodle Duel | Medium | Hint text is never rendered in the UI; hint button costs 50 points and shows nothing; can be clicked repeatedly | CODE |
| DD-12 | Doodle Duel | Medium | Hint availability: never available for guessTime <= 30; UI threshold (35s left) does not match server threshold; button shown during DRAWING | VERIFIED (guessTime 20) / CODE |
| DD-13 | Doodle Duel | Medium | Forfeit/leave and ties: server writes `winnerUserId` (not `finalWinnerUserId`), `finalWinnerDisplayName` never set, tie winner arbitrary; Victory screen shows score-based winner even after forfeit | VERIFIED (tie) / CODE |
| DD-14 | Doodle Duel | Medium | 5s disconnect grace forfeits bot games and also fires after a normally finished game | CODE |
| DD-15 | Doodle Duel | Medium | Bot logic is hardcoded to 60s timings and a fixed squiggle unrelated to the word; bot guesser silent if config differs | CODE |
| DD-16 | Doodle Duel | Medium | Custom words with non-Latin characters or only punctuation can never be guessed; accented/plural guesses never match | VERIFIED |
| DD-8 | Doodle Duel | Medium | Guess text unbounded / non-string crashes; whitespace guesses stored; no per-round guess cap | VERIFIED |
| DD-9 | Doodle Duel | Medium | Host config (`doodle:config_update`, `doodle:start` payload) not validated; can change config mid-game, strings/NaN/huge values | VERIFIED |
| FR-5 | Four in a Row | Medium | Draw never marks the room FINISHED; state stays PLAYING and a later leave/disconnect forfeits a drawn game | CODE |
| FR-6 | Four in a Row | Medium | Rematch always starts with Red (seat 0); no alternation | CODE |
| FR-7 | Four in a Row | Medium | After a forfeit the remaining player cannot rematch (vote needs 2 but leaver stays in players); the room hangs on "Waiting (1/2)" | CODE |
| FR-8 | Four in a Row | Medium | Only 5s disconnect grace; a flaky mobile connection loses the game while client retry is 2s + ticket fetch | CODE |
| FR-9 | Four in a Row | Medium | Non-players can connect to a PLAYING room and watch, send nudges/chat/rematch decline (no spectator concept, no authorization) | CODE |
| GR-11 | Shared room layer (all games) | Medium | Both players disconnect: both forfeit timers fire, the last one overwrites, an absent player is declared winner | VERIFIED (S3) |
| GR-12 | Shared room layer (all games) | Medium | REST join creates ghost players who count as connected and auto-start the game | VERIFIED (S9) |
| GR-13 | Shared room layer (all games) | Medium | Per-user maps (`userClients`, `disconnectGraceTimers`) ignore rooms: joining another room cancels the forfeit in the first | VERIFIED (S12) |
| GR-14 | Shared room layer (all games) | Medium | No turn/inactivity timer and no leave handling for 3-4 player rooms; a gone player stalls the game forever | CODE |
| GR-15 | Shared room layer (all games) | Medium | 5 s reconnect grace is shorter than the client's own retry path (2 s retry + ticket fetch); refresh/network blips forfeit | CODE |
| GR-16 | Shared room layer (all games) | Medium | Rematch voting: counts leavers, accepts votes mid-game, counts spectators, never swaps sides | VERIFIED (S13a, S15, S4) |
| GR-17 | Shared room layer (all games) | Medium | Doodle strokes/live-draw are unvalidated and unbounded; full state is re-sent and re-persisted every second | VERIFIED (S5c) |
| GR-18 | Shared room layer (all games) | Medium | Client `game:player_left` always shows "You are the winner" even in lobbies, 3-4 player games or finished games | CODE |
| GR-19 | Shared room layer (all games) | Medium | `useGameRoom` does not reset state on roomCode change and its stale `onclose` reconnects to the OLD room | CODE |
| GR-20 | Shared room layer (all games) | Medium | Any `error:notification` (even RATE_LIMITED) permanently disables auto-reconnect; reconnect is fixed 2 s with no backoff/cap | CODE |
| GR-21 | Shared room layer (all games) | Medium | Partner link needs no consent from the other user (anyone with a partner code) | VERIFIED (S16a,b) |
| GR-22 | Shared room layer (all games) | Medium | Partner ping / invite / play have no rate limit; invites do not validate the room or game type | VERIFIED (S16c,d) |
| GR-23 | Shared room layer (all games) | Medium | "Notify Me" / "Stay Updated" show "Subscribed!" but nothing is stored or sent | CODE |
| GR-24 | Shared room layer (all games) | Medium | Rule/authorization errors are swallowed server-side; the client gets no feedback (host-only start, not your turn) | VERIFIED (S7c) |
| GR-25 | Shared room layer (all games) | Medium | Hub card click hijacks into a friend's room (even PLAYING or full) and blocks starting your own game | CODE |
| GR-26 | Shared room layer (all games) | Medium | GameLounge shows Chess and Pictionary/Doodle as "Coming Soon" and has no route for them | CODE |
| GR-27 | Shared room layer (all games) | Medium | Server restart loses chess clocks / tambola auto-call timers; rooms are never purged | CODE |
| LU-5 | Ludo | Medium | 5 s disconnect grace = forfeit; refresh, tab close, app switch or flaky mobile network loses the match | CODE |
| LU-6 | Ludo | Medium | Client fabricates a "you won by default" result when any player leaves a 3/4-player game | CODE |
| LU-7 | Ludo | Medium | Rematch: accepted mid-game, stale votes persist, leavers counted so 3/4p rematch can never complete | VERIFIED (mid-game), CODE (rest) |
| LU-8 | Ludo | Medium | "Sound effects" setting does nothing; a new AudioContext is created per sound and never closed | CODE |
| LU-9 | Ludo | Medium | Unknown room code auto-creates a public 4-player Ludo room (client always sends create=1) | CODE |
| TA-10 | Tambola | Medium | `bingo:start` has no status / player-count guard: host can restart a running game (new tickets) or start alone | CODE |
| TA-11 | Tambola | Medium | "Last Numbers" strip shows the first five numbers ever called, not the last five | CODE |
| TA-12 | Tambola | Medium | Local marks are never reset between games: after a rematch old marks persist on the new ticket and drive progress/claim logic | CODE |
| TA-13 | Tambola | Medium | UI is a hard-coded 2-player duel (one "opponent", "Call (x/2)", "2 Players"); 3-4 player rooms show only one rival; no pause/call UI for host | CODE |
| TA-14 | Tambola | Medium | Player leaving a 2-player Tambola game: room set FINISHED but game state has no winner/phase; Victory modal says "Winner Wins!" with no winner | CODE |
| TA-15 | Tambola | Medium | Victory scoreboard labels every other player with the winner's name and is not sorted | CODE |
| TA-6 | Tambola | Medium | Winner display name is wrong when the top scorer is not the player who made the last claim; ties resolved arbitrarily | VERIFIED |
| TA-7 | Tambola | Medium | Unsupported/empty-target conditions can be claimed with zero numbers called (free points) | VERIFIED |
| TA-8 | Tambola | Medium | `bingo:mark` accepts any number (uncalled, off-ticket, NaN, unbounded) and any socket; unbounded state growth broadcast to all | VERIFIED |
| TA-9 | Tambola | Medium | Host `config` is spread unvalidated: NaN `callingSpeed` makes timer fire every 1 ms, `winConditions:null` throws and strands a running game, `mode:'75-ball'` swaps tickets | VERIFIED (engine/arith) + CODE |
| TT-10 | Tic-Tac-Toe | Medium | After the opponent leaves, "Play Rematch" stays available and leads to an endless "Waiting for opponent" modal | CODE |
| TT-3 | Tic-Tac-Toe | Medium | Any authenticated non-player who knows the room code can vote or decline rematch; one real vote plus one outsider vote restarts the match | VERIFIED |
| TT-4 | Tic-Tac-Toe | Medium | Session scoreboard and win fanfare re-fire on every new `gameState` object or callback identity (sound toggle, reconnect, opponent leave) | CODE |
| TT-5 | Tic-Tac-Toe | Medium | Rematch always starts with seat 0 (host, X): no alternation of the starting player or symbol | VERIFIED |
| TT-6 | Tic-Tac-Toe | Medium | Drawn game never moves the room to FINISHED, so it stays PLAYING in the DB | VERIFIED |
| TT-7 | Tic-Tac-Toe | Medium | Rematch can be started mid-game (no game-over check) and the rematch has no membership or phase validation | VERIFIED |
| TT-8 | Tic-Tac-Toe | Medium | 5-second disconnect grace is too short; a brief mobile blip or background tab loses the game by forfeit | CODE |
| TT-9 | Tic-Tac-Toe | Medium | Opponent's reactions, nudges/roasts, typing and "opponent disconnected" status are received but never rendered by the page | CODE |
| BD-17 | Bingo Duel | Low | `markNumber` is a toggle and works in any phase; double click removes a mark; no phase check | VERIFIED |
| BD-18 | Bingo Duel | Low | Refresh during ROUND_OVER shows the wrong winner/defeat (state.winnerUserId is null until match end) | CODE |
| BD-19 | Bingo Duel | Low | Unvalidated config: bogus pattern/mode, negative penalty, empty custom pattern is unwinnable | VERIFIED |
| BD-20 | Bingo Duel | Low | `setPlayerBoard` accepts ragged rows and (as long as unique, in range) non-integer values | VERIFIED |
| BD-21 | Bingo Duel | Low | Host always moves first in every round and rematch (no alternation) | VERIFIED |
| BD-22 | Bingo Duel | Low | Auto-start race: client host sends `bingo:start` after server already auto-started, rerolling boards | CODE |
| BD-23 | Bingo Duel | Low | Line-completion voice/toast ref not reset between rounds, announcements for lines 1-4 suppressed in later rounds | CODE |
| CH-15 | Chess | Low | Timeout-vs-insufficient-material only inspects winner's pieces; K+N/K+B/K+2N vs opponent with pawns/queen/rook is wrongly a draw | VERIFIED |
| CH-16 | Chess | Low | Rematch never swaps colours (players[0] always White) | CODE |
| CH-17 | Chess | Low | Last-move highlight lost on reconnect/refresh, stale after takeback, not cleared on rematch (uses `lastChessMove`, not `gameState.lastMove`) | CODE |
| CH-18 | Chess | Low | Mobile clock bars show "10:00" when time is 0; bottom bar always labelled "(You)" even after manual flip | CODE |
| CH-19 | Chess | Low | Draw/takeback modals not restored on reconnect, persist over game-over, never cleared when a move is played; draw offers unlimited | CODE |
| CH-20 | Chess | Low | Client clocks only update every 1 s (no local interpolation); "critical" tenths display always `.0`; no drift correction | CODE |
| CH-21 | Chess | Low | Auto-start path (`startGame`) drops avatarUrl; Info drawer shows local default config instead of game's real config | CODE |
| CH-22 | Chess | Low | White's clock runs from game creation (before anyone has seen the board); first-move time is charged | CODE |
| CH-23 | Chess | Low | Dead/unfinished features: `spectators` never populated, `allowSpectators` unenforced, Solo Practice mode unreachable (`setIsPracticeMode` never called) | CODE |
| DD-17 | Doodle Duel | Low | Custom words are merged into the full pool, so they appear in only ~5% of rounds; lose hint/alias on timeout auto-pick | VERIFIED |
| DD-18 | Doodle Duel | Low | "Hard" pool has 5 words: repeats inside a 6-round game; `usedWords` fallback silently reuses words | VERIFIED |
| DD-19 | Doodle Duel | Low | Guess after round ended returns misleading `doodle:guess_result` (replays previous, possibly correct, guess) | CODE |
| DD-20 | Doodle Duel | Low | Time bonus is measured per phase: guessing in DRAWING at 59s gets 25 pts, same wall-clock in GUESSING gets 100; message "in Ns" misleading | VERIFIED |
| DD-21 | Doodle Duel | Low | Live-draw ghost stroke persists on guesser canvas (drawer pointer-up after phase change is swallowed; never cleared on new round/clear) | CODE |
| DD-22 | Doodle Duel | Low | DrawingCanvas re-allocates canvas and re-creates ResizeObserver on every state_sync (every second) because effect depends on `strokes` | CODE |
| DD-23 | Doodle Duel | Low | Live draw sends full point array every 35ms (quadratic payload); relayed with no validation | CODE |
| DD-24 | Doodle Duel | Low | Round timer progress ring uses drawTime for ROUND_INTRO/WORD_CHOICE/ROUND_RESULT phases | CODE |
| DD-25 | Doodle Duel | Low | Both players choosing "drawer" silently picks player 2; spectators treated as guessers in UI; server errors swallowed (no feedback, e.g. non-host Start) | CODE |
| FR-10 | Four in a Row | Low | Victory modal text for a forfeit says "connected 4 discs in a row!" and the draw text is shown/winner mixed after FR-1 | CODE |
| FR-11 | Four in a Row | Low | Hover preview / myColor wrong for non-seated viewers (myColor defaults to 'Y'); hover preview sticks on touch devices | CODE |
| FR-12 | Four in a Row | Low | Rematch vote cleared state: leaver's vote reset message also fires when it is the winner leaving a finished game; button label hardcoded "Waiting (1/2)" | CODE |
| FR-13 | Four in a Row | Low | Dead duplicate ConnectFour.tsx component (never imported) re-implements game logic; no col validation (remote DROP_DISC with `player` supplied by sender allows playing as either colour) | CODE |
| GR-28 | Shared room layer (all games) | Low | Chess clock decrements a fixed 1000 ms per interval tick (drift) instead of wall/monotonic time | CODE |
| GR-29 | Shared room layer (all games) | Low | Hub copy: "No bots, ever" and "12K+ friends are playing" vs doodle bot injection and hardcoded number | CODE |
| GR-30 | Shared room layer (all games) | Low | Memory: `roomChatHistory`/`roomThemes` never cleaned; 4000-char chat x 50; dead duplicate `game:nudge` case | CODE |
| GR-31 | Shared room layer (all games) | Low | `getPartnerPings`/`markPartnerPingsRead` call endpoints that do not exist (unauthenticated fetch, 404 swallowed) | CODE |
| GR-32 | Shared room layer (all games) | Low | Game type resolved by substring; unknown types silently become Ludo | CODE |
| LU-10 | Ludo | Low | Stacked opponent tokens: only one is captured | VERIFIED |
| LU-11 | Ludo | Low | 4-player turn order is not clockwise (red, blue, green, yellow vs board red, blue, yellow, green) | CODE |
| LU-12 | Ludo | Low | Pawn tap sends move twice on touch devices (onClick + onTouchEnd) | CODE |
| LU-13 | Ludo | Low | roll/move handlers do not check gameType, room status or player status (LEFT players can act) | VERIFIED (partial) |
| LU-14 | Ludo | Low | Rule violations are swallowed server-side, no error to client; dice UI relies on a 1.2 s stale-closure timeout | CODE |
| LU-15 | Ludo | Low | Reconnect/sync mid-animation: stale `lastTokenMove` and "first mover" fallback animate the wrong pawn | CODE |
| LU-16 | Ludo | Low | Rematch/leave copy hard-coded for 2 players; "has left" shown for a merely disconnected player; `opponentPlayer` = first other player | CODE |
| LU-17 | Ludo | Low | Duplicate `game:player_left` broadcasts (explicit leave then socket close) | CODE |
| LU-18 | Ludo | Low | Pawns are SVG-only: no keyboard access, role or aria labels; legal-move state is colour/animation only | CODE |
| TA-16 | Tambola | Low | `bingo:config_update` and `tambolaConfig` are stored on a throw-away DB object: settings are lost, rematch uses defaults | CODE |
| TA-17 | Tambola | Low | Rematch needs votes from every player ever seated (incl. leavers); can be triggered mid-game; stale votes | CODE |
| TA-18 | Tambola | Low | No host transfer: if the host leaves/disconnects, pause/manual call/start are dead | CODE |
| TA-19 | Tambola | Low | Game that exhausts all 90 numbers ends with no winner or summary (e.g. housefull disabled); modal shows "Winner" | VERIFIED |
| TA-20 | Tambola | Low | Unmark sends a toggle (`forceMark:false`): if the server lacks the mark, the "unmark" marks it; preview mode mutates a memoised Set | CODE |
| TA-21 | Tambola | Low | Tambola page accepts `bingo` (Duel) rooms without redirecting | CODE |
| TT-11 | Tic-Tac-Toe | Low | Explicit leave then socket close runs forfeit logic twice (duplicate `player_left` broadcasts) | VERIFIED |
| TT-12 | Tic-Tac-Toe | Low | Stale rematch vote survives `startGame`; a late or duplicate vote can later make a rematch one-sided | CODE |
| TT-13 | Tic-Tac-Toe | Low | Malformed `cellIndex` values coerce to valid cells (`""`, `false`, `[]` become 0, `true` becomes 1); `1.5`/NaN give a misleading "already occupied" error | VERIFIED |
| TT-14 | Tic-Tac-Toe | Low | Move rejections are only logged server-side; client gets no error, and moves clicked while the socket is not OPEN are silently dropped | CODE |
| TT-15 | Tic-Tac-Toe | Low | Win/turn banner shows `RED ()` / `RED'S TURN ()` (the X glyph is missing from the string) | CODE |
| TT-16 | Tic-Tac-Toe | Low | Move sound is silent for the first N moves after a rematch (`prevMoveCountRef` never reset) | CODE |
| TT-17 | Tic-Tac-Toe | Low | Chat does not auto-scroll to new messages (`chatBottomRef` assigned but never scrolled to; same ref attached to two nodes) | CODE |
| TT-18 | Tic-Tac-Toe | Low | Leaving the WAITING lobby with `game:leave` does not free the seat; a joiner within the 5 s grace window auto-starts a game against a ghost player | CODE |
| TT-19 | Tic-Tac-Toe | Low | If both players disconnect, both grace timers forfeit in turn and the last one wins; room ends FINISHED with a "winner" | CODE |
| TT-20 | Tic-Tac-Toe | Low | Wrong status and wrong error messaging for dead code: `TicTacToeGame.tsx` is unused and its logic duplicates the page | CODE |

# Detailed reports (one per game)

Each section below is the reviewer's full report: what was reviewed, the findings table, a detail entry per finding (what happens, how to reproduce, why it matters, suggested fix), and the areas that were checked and found correct.

## LUDO audit (read-only)

**Reviewed:** apps/server/src/games/LudoEngine.ts, Ludo paths in GameRoomManager.ts (create/join/start/roll/move/rematch/leave/disconnect/registerClient), GameDefinitions.ts, packages/common Ludo types, apps/web hooks/useGameRoom.ts, components/games/LudoGame.tsx (state/animation/controls/board geometry) and app/games/ludo/page.tsx (lobby, leave/rematch/winner flows). Ran scripts/test-ludo-bugs.ts (24/24 pass, but it is mostly string/static checks and covers none of the issues below). Repro scripts: `eng.ts` (engine), `mgr.ts` (manager with in-memory sqlite and fake sockets), `recon.ts` (reconnect) in this directory; run with `npx tsx` from the repo root.

### Findings

| ID | Severity | Title | Evidence | Location |
|---|---|---|---|---|
| LU-1 | Critical | Reconnecting/second socket makes the still-connected player forfeit after 5 s | VERIFIED | GameRoomManager.ts:2001-2030, 2556-2651 |
| LU-2 | High | Winner leaving after the game ends flips the result: loser is recorded and shown as winner | VERIFIED | GameRoomManager.ts:2466-2490, 2575-2600 |
| LU-3 | High | 3/4-player: leaver/disconnected seat stays in rotation, game stalls forever | VERIFIED | GameRoomManager.ts:2466, 2590; LudoEngine.ts:152-165,305 |
| LU-4 | High | No turn timer / AFK handling for Ludo (only a "nudge" button) | CODE | GameRoomManager.ts (none exists); LudoGame.tsx:2735 |
| LU-5 | Medium | 5 s disconnect grace = forfeit; refresh, tab close, app switch or flaky mobile network loses the match | CODE | GameRoomManager.ts:2565-2651 |
| LU-6 | Medium | Client fabricates a "you won by default" result when any player leaves a 3/4-player game | CODE | useGameRoom.ts:428-500; page.tsx:1488 |
| LU-7 | Medium | Rematch: accepted mid-game, stale votes persist, leavers counted so 3/4p rematch can never complete | VERIFIED (mid-game), CODE (rest) | GameRoomManager.ts:536-575 |
| LU-8 | Medium | "Sound effects" setting does nothing; a new AudioContext is created per sound and never closed | CODE | LudoGame.tsx:422-480; page.tsx:288,3062 |
| LU-9 | Medium | Unknown room code auto-creates a public 4-player Ludo room (client always sends create=1) | CODE | useGameRoom.ts:301-307; index.ts:2090-2100 |
| LU-10 | Low | Stacked opponent tokens: only one is captured | VERIFIED | LudoEngine.ts:257-271 |
| LU-11 | Low | 4-player turn order is not clockwise (red, blue, green, yellow vs board red, blue, yellow, green) | CODE | GameDefinitions.ts:25-26; LudoGame.tsx:~RING |
| LU-12 | Low | Pawn tap sends move twice on touch devices (onClick + onTouchEnd) | CODE | LudoGame.tsx:2548-2570 |
| LU-13 | Low | roll/move handlers do not check gameType, room status or player status (LEFT players can act) | VERIFIED (partial) | GameRoomManager.ts:446-500 |
| LU-14 | Low | Rule violations are swallowed server-side, no error to client; dice UI relies on a 1.2 s stale-closure timeout | CODE | GameRoomManager.ts:2127-2133; LudoGame.tsx:2766-2781 |
| LU-15 | Low | Reconnect/sync mid-animation: stale `lastTokenMove` and "first mover" fallback animate the wrong pawn | CODE | LudoGame.tsx:826-905 |
| LU-16 | Low | Rematch/leave copy hard-coded for 2 players; "has left" shown for a merely disconnected player; `opponentPlayer` = first other player | CODE | useGameRoom.ts:590-598; LudoGame.tsx:2733; page.tsx:951-1003 |
| LU-17 | Low | Duplicate `game:player_left` broadcasts (explicit leave then socket close) | CODE | GameRoomManager.ts:2466 + 2565 |
| LU-18 | Low | Pawns are SVG-only: no keyboard access, role or aria labels; legal-move state is colour/animation only | CODE | LudoGame.tsx:2530-2570 |

### Details

#### LU-1 (Critical, VERIFIED) Reconnect / second socket => forfeit of a connected player
`registerClient` clears the grace timer, then closes any older socket of the same user (`existing.socket.close()`). That old socket's `close` event then runs `handleClientDisconnection` for the OLD client object, which (a) does `userClients.delete(userId)`, wiping the NEW client's mapping, (b) `setGamePlayerConnected(false)`, (c) starts a fresh 5 s timer that is never cancelled because the new socket already registered. The timer body does not check whether the user is connected again, so in a 2-player game it finishes the game and names the other player winner.
Repro (`recon.ts`): 2-player room, both register sockets, u0 registers a second socket. After 6 s: status FINISHED, winner u1, u0 connected=false, `userClients.has('u0')` = false, u0 still has a live socket. Real triggers: page refresh before the old socket is reaped, network flap where the client reconnects (useGameRoom reconnects after 2 s) before the server notices the dead socket, opening the room in a 2nd tab. Two tabs of the same user also thrash: each connect closes the other tab's socket, which reconnects 2 s later and closes the first (useGameRoom.ts:340-356).
Fix: in the grace timer (and in `handleClientDisconnection`) ignore the event when `this.userClients.get(userId)?.socket !== client.socket` / a live client exists for the user; only delete `userClients` if it still points at the closing client.

#### LU-2 (High, VERIFIED) Winner leaving after game over becomes the loser
`handleClientLeave` and the grace timer run the forfeit branch whenever `room.status === PLAYING || READY || room.gameState` (gameState exists after FINISHED). With 2 players the remaining player is declared winner, overwriting `winnerColor`, `winnerUserId`, status message and DB `winner_seat`.
Repro (`mgr.ts`): u0 wins (red), then u0 sends leave (the "Go Home" button on the victory modal does `sendLeave()`). Result: status FINISHED, winnerColor=yellow, winnerUserId=u1, message "P0 left the game. You are the winner!". The loser's UI then shows the "Match Won / winner by default" modal and the persisted winner is wrong. The same happens when the winner's socket just closes (grace timer).
Fix: skip the forfeit logic when `room.status === 'FINISHED'` (or `gameState.winnerColor` already set).

#### LU-3 (High, VERIFIED) 3/4-player: leaver blocks the game
Forfeit is only handled when exactly one player remains (`remainingPlayers.length === 1`). For 3 or 4 players a leaver/disconnected player keeps their seat in `(currentTurnSeat + 1) % playersCount`; nobody else can act on that seat, and there is no skip/auto-play. Repro (`mgr.ts`): 3-player game, seat 1 leaves; play advances to seat 1: `currentTurnSeat = 1`, status PLAYING, game never progresses. The left player's userId is still in `room.players`, so a (reconnected) leaver could still act, see LU-13.
Fix: on leave/timeout in 3-4p games mark the seat as eliminated, skip it in the engine's next-seat computation (rollDice, no-legal-move and moveToken paths), and finish the game when one seat remains.

#### LU-4 (High, CODE) No turn timer
There is no server timer for Ludo (only doodle/chess/bingo have them). An AFK or sulking player freezes the table; the only recourse is the nudge button. Combined with LU-3 a stalled game never ends. Fix: per-turn deadline (e.g. 30-45 s) that auto-rolls and auto-moves (first legal / furthest token), and forfeits after N missed turns.

#### LU-5 (Medium, CODE) 5 s grace is too short
Any socket close (backgrounded mobile tab, Wi-Fi to LTE switch, laptop sleep, refresh that takes >5 s including `getWsTicket`) awards the match to the opponent after 5 s. The client auto-reconnect waits 2 s plus ticket fetch. Fix: 30-60 s grace for PLAYING games and cancel properly per room (the timer map is keyed by userId only, so a user in two rooms shares one timer).

#### LU-6 (Medium, CODE) Client invents a winner in 3/4-player
On `game:player_left` the client always runs the `!isMeLeaving` branch: sets `opponentLeftWin` ("You are the winner by default!") and writes `winnerUserId/winnerColor` into local `gameState` using `remainingHuman = first player that is not the leaver` (arbitrary in 3/4p) even though the server did not end the game (isWinner false). Locally `gameState.winnerColor` is truthy so the victory modal, party poppers and the dice button turn into REMATCH while the server game is still PLAYING. Fix: only apply the forfeit UI when payload.isWinner is true.

#### LU-7 (Medium) Rematch
VERIFIED: `handleRematch` has no `status === 'FINISHED'` check; with both players voting from the "Restart Match" button the game restarts mid-play (mgr.ts output: restarted). CODE: `rematchVotes` is never cleared if only one player votes (e.g. mid-game restart request ignored); when the game later ends, the other player's single click completes the stale vote and restarts without the first player's fresh consent. `totalNeeded = room.players.length` counts players who left, so a rematch can never complete after a 3/4p leaver or a left 2p opponent (button spins forever). `game:rematch_agreed` is hard-coded to 2/2 on the client. Fix: require FINISHED, clear votes on game start/finish/leave, compute needed from connected non-left players.

#### LU-8 (Medium, CODE) Sound
`soundEffectsEnabled` in page.tsx is only read by its own toggle; `LudoGame` has no prop for it, so turning sounds off has no effect. `playSound` constructs `new AudioContext()` on every call (every hop, dice tick, capture) and never closes it; browsers cap live contexts (Safari ~4, Chrome 6 historically) so sounds silently stop and memory/CPU grows over a long game. Fix: share one lazily created context, resume on user gesture, honour the setting.

#### LU-9 (Medium, CODE) Room-code typos create public rooms
`useGameRoom` always sends `create=1`; the server auto-creates unknown (well-formed) codes as a 4-player, non-private Ludo room (index.ts:2095). A mistyped join code or the join fallback in `handleJoinWithCode` therefore silently creates a public lobby that matchmaking can fill with strangers and needs 4 players to start. Fix: only send create=1 when the user explicitly creates; make auto-created rooms private.

#### LU-10 (Low, VERIFIED) Stacked tokens
`moveToken` breaks after the first captured token. Repro (`eng.ts` T1): red lands on a ring tile holding two yellow tokens: result yellow steps `[-1,4,-1,-1]`, only token 0 captured, the other stays on the same tile as the capturer. Either treat doubles as a block or capture all; current behaviour is order-dependent (token id order).

#### LU-11 (Low, CODE) Turn order in 4p
Seats are red, blue, green, yellow (GameDefinitions) while the ring start tiles are red 0, blue 13, yellow 26, green 39; clockwise board order is red, blue, yellow, green. Turns therefore jump TL, TR, BL, BR. Not an engine crash, just unconventional and confusing; the 2p (red/yellow) and 3p cases are fine.

#### LU-12 (Low, CODE) Double dispatch on tap
Each pawn `<g>` has both `onClick` and `onTouchEnd` calling `handlePawnClick`; on touch screens both fire. The server rejects the second message ("Must roll dice before moving token" / "not your turn") so there is no state damage, but it is wasted traffic and error noise, and with a bonus roll plus fast auto behaviour it relies purely on server validation. Fix: keep only onClick (or pointerup).

#### LU-13 (Low, VERIFIED partial) Weak handler guards
`handleRollDice/handleMoveToken` never check `room.gameType === 'ludo'`, `room.status === 'PLAYING'` or the player's status. On a tic-tac-toe room `game:roll_dice` reaches `LudoEngine.rollDice` and is only rejected by accident (`canRoll` undefined => "Dice has already been rolled"). Players with status LEFT stay in `room.players` and can still act if connected. The engine correctly rejects out-of-turn, double-roll, move-before-roll, illegal/bad/non-integer tokenId (`legalMoves.includes` is strict).

#### LU-14 (Low, CODE) Silent rejections
Errors from handlers are only `console.warn`ed; the client gets nothing, so a rejected roll (e.g. stale state, LU-12 duplicates) leaves the optimistic dice spinning until a 1.2 s timer whose closure captured the old `gameState.diceValue`; the timer is also not cleared on unmount. Fix: send an error/resync message and clear the timer in an effect.

#### LU-15 (Low, CODE) Animation after reconnect
The animation effect prefers `lastTokenMove`, which is never reset on `game:sync`/`game:started`. After a reconnect where several moves occurred, the fallback picks the first colour in ['red','green','yellow','blue'] whose token advanced, so the wrong pawn hops. Also `clearAnimTimeouts()` at the start of the next move cancels the capture rewind chain if a capture bonus move comes within ~1.5 s (victim relies on the next move's `setHeldVictimPawn(null)` to recover).

#### LU-16 (Low, CODE) 2-player assumptions in UI
Rematch copy ("Both players", 2/2), `opponentPlayer` (first non-me player) used for streak recording and the disconnected banner, and "X has left • tap to nudge" shown for a player who is only temporarily disconnected.

#### LU-17 (Low, CODE)
Explicit leave broadcasts `player_left` (reason LEFT) and the later socket close schedules another forfeit broadcast (reason DISCONNECTED) 5 s later, re-triggering the opponent-left modal.

#### LU-18 (Low, CODE) Accessibility
Pawns and legal-move highlights live in SVG with pointer handlers only: no tabindex, role, aria-label or key handler, so keyboard/screen-reader users cannot choose a pawn; "your turn / choose goti" is only conveyed visually in the dice button.

### Areas checked and found correct
- Dice: server-side `secureRandom`, 1-6, one roll per turn (`canRoll`), out-of-turn, move-before-roll, bad/duplicate token index all rejected.
- Six bonus, three-sixes-cancels-turn (counter resets on non-six and on pass), capture bonus, home bonus, exact roll to finish (step 55 accepts 1 only), yard exit only on 6, win when four tokens at 56.
- Safe squares (8 stars/starts) identical on client and server; own start tile safe against all colours; spawn onto a start tile does not capture.
- Home column mapping: last ring tile for each colour (50 steps) connects to the first home cell; board ring has 52 unique, contiguous coordinates (checked by script).
- 2/3-player seat/colour assignment, seat reuse in lobby, `playersCount` rotation; engine finishes game and blocks further rolls after a win.
- Player-count validation in `createGameRoom`; matchmaking excludes private rooms.
- Client cleanup: dice/anim/auto-move timers cleared on unmount, listener removal for PiP drag, socket closed and reconnect timer cleared on unmount, terminal errors stop reconnect.
- Single-legal-token auto-move keyed per roll (does not double fire on re-render).


---

## Four in a Row audit

### Summary
Reviewed apps/server/src/games/FourInARowEngine.ts, the four-in-a-row paths in GameRoomManager.ts (handleDropDisc, rematch, leave/disconnect/forfeit, registerClient, message router) and GameDefinitions.ts, the shared type in packages/common/src/types.ts, apps/web/src/app/games/four-in-a-row/page.tsx, hooks/useGameRoom.ts, games/connect4/page.tsx (pure redirect) and components/games/ConnectFour.tsx (unused). Engine win logic was fuzzed with 20,000 random games against a brute-force checker (0 mismatches); the real defects are input validation and room-lifecycle logic. Scratch script: scratchpad/games/t.ts.

### Findings

| ID | Severity | Title | Evidence | Location |
|----|----------|-------------|----------|----------|
| FR-1 | High | Leaving/disconnecting after the game ends overwrites the result: the loser/leaver's opponent is declared winner (also turns a draw into a win) | CODE | GameRoomManager.ts:2467-2495, 2586-2600 (handleClientLeave / disconnect timer); page.tsx:2826-2831 |
| FR-2 | High | Stale-socket close starts a forfeit timer for a user who is actually connected (refresh / second tab / network switch) | CODE | GameRoomManager.ts:1995-2010 (registerClient), 2562-2640 (handleClientDisconnection) |
| FR-3 | High | NaN / fractional / missing column is accepted: a turn is burned and no disc is placed | VERIFIED | FourInARowEngine.ts:38-44, 172-174; GameRoomManager.ts:2193 |
| FR-4 | High | Any room member (incl. a spectator/non-player) can vote rematch and restart a game, even mid-game, without the opponent's consent | CODE | GameRoomManager.ts:529-575 |
| FR-5 | Medium | Draw never marks the room FINISHED; state stays PLAYING and a later leave/disconnect forfeits a drawn game | CODE | GameRoomManager.ts:619-636 |
| FR-6 | Medium | Rematch always starts with Red (seat 0); no alternation | CODE | GameRoomManager.ts:363 |
| FR-7 | Medium | After a forfeit the remaining player cannot rematch (vote needs 2 but leaver stays in players); the room hangs on "Waiting (1/2)" | CODE | GameRoomManager.ts:535-541, 2467-2495; page.tsx:2805-2830 |
| FR-8 | Medium | Only 5s disconnect grace; a flaky mobile connection loses the game while client retry is 2s + ticket fetch | CODE | GameRoomManager.ts:2570-2640; useGameRoom.ts:357-363 |
| FR-9 | Medium | Non-players can connect to a PLAYING room and watch, send nudges/chat/rematch decline (no spectator concept, no authorization) | CODE | GameRoomManager.ts:2036-2050, 2169-2190; index.ts:2119 |
| FR-10 | Low | Victory modal text for a forfeit says "connected 4 discs in a row!" and the draw text is shown/winner mixed after FR-1 | CODE | page.tsx:2748-2752 |
| FR-11 | Low | Hover preview / myColor wrong for non-seated viewers (myColor defaults to 'Y'); hover preview sticks on touch devices | CODE | page.tsx:397, 2403 |
| FR-12 | Low | Rematch vote cleared state: leaver's vote reset message also fires when it is the winner leaving a finished game; button label hardcoded "Waiting (1/2)" | CODE | page.tsx:2850-2856 |
| FR-13 | Low | Dead duplicate ConnectFour.tsx component (never imported) re-implements game logic; no col validation (remote DROP_DISC with `player` supplied by sender allows playing as either colour) | CODE | components/games/ConnectFour.tsx:140-170 |

### Details

#### FR-1 (High) Game result overwritten when a player leaves after the game finished
What happens: handleClientLeave and the disconnect grace timer only check `room.status === PLAYING || READY || room.gameState` (gameState always exists) and `remainingPlayers.length === 1`. They never check that the game is already over. They set `gameState.winner/winnerUserId/winnerColor` to the remaining player, set the room FINISHED again and broadcast `game:player_left` with `isWinner: true`.
Repro: Red connects four and wins. Red clicks "Go Home" in the victory modal (page.tsx:2826, calls sendLeave) or just closes the tab (5s later). Server rewrites the stored result so Yellow is the winner; Yellow's client gets `opponentLeftWin` ("You are the winner!") and its local gameState winnerUserId/statusMessage are overwritten. For a draw, `winner` becomes set although `isDraw` stays true. Persisted `winner_seat` (updateGameRoomState 4th arg) also becomes Yellow, so history/stats are wrong.
Why it matters: the actual loser is shown/recorded as the winner whenever the winner leaves first; this is the normal post-game flow.
Fix: in both paths return early (no forfeit, just broadcast the leave) when `gameState.winner || gameState.isDraw || room.status === 'FINISHED'`.

#### FR-2 (High) Forfeit timer fires for a connected player
What happens: registerClient clears the grace timer, then closes any older socket of the same user (`existing.socket.close()`). That old socket's `close` event later runs handleClientDisconnection for the OLD client object, which deletes `userClients[userId]` (the new client), sets is_connected=false in the DB, broadcasts `player_disconnected`, and starts a fresh 5s timer that has no "is the user connected again?" check. After 5s, in a PLAYING room with 2 players the opponent is declared winner (or in WAITING the seat is freed) while the user is online.
Repro: open the room in two tabs (or let a mobile client reconnect while the server still holds the half-open old socket); old socket closes after the new one registers; 5s later the player forfeits.
Fix: in handleClientDisconnection ignore the close if the closing client is not the one currently in `roomClients`/`userClients` (`this.userClients.get(id) !== client`), and re-check connection state inside the timer.

#### FR-3 (High) Invalid column accepted: skipped turn, no disc
Input: WebSocket `{"type":"game:drop_disc","payload":{}}` (col becomes `Number(undefined)` = NaN), or `{"column":2.5}`. Engine guards are `col < 0 || col >= 7`, which are false for NaN and 2.5. `board[r][NaN]` is undefined so getLowestEmptyRow returns row 5; `nextBoard[5][NaN] = 'R'` creates an array property, not a cell.
VERIFIED output (t.ts): `col NaN accepted row 5 col NaN turn 1`, board row still all null but moveCount=3 after 3 such moves and turn flipped each time; the extra key 'NaN' / '2.5' exists on the row array. JSON serialisation drops it, so clients see only an empty move and the turn passing. Also `Number(null)`, `Number("")`, `Number([])` map to column 0 silently.
Why: a player can pass their turn at will (zugzwang exploit) and moveCount/ statusMessage are corrupted; broadcast carries col NaN (serialised as null).
Fix: require `Number.isInteger(col)` in dropDisc (and reject missing payload in the router).

#### FR-4 (High) Rematch can be forced by one player plus a spectator, or mid-game
handleRematch adds any `userId` to `votes` without checking the user is a seated player or that the game is finished, and `totalNeeded = room.players.length`. A non-player who connected (FR-9) plus one real player reaches 2 votes and startGame resets the board; two players can also restart a game that is in progress (e.g. when losing).
Fix: require seated player + `gameState.winner || isDraw` (or status FINISHED); count only player votes.

#### FR-5 (Medium) Draw leaves room PLAYING
handleDropDisc calls updateGameRoomStatus(FINISHED) only inside `if (result.isWinner)`. On a draw the DB status stays PLAYING, finishedAt unset, and currentTurnSeat is unchanged. Client isMyTurn (`room.status==='PLAYING' && seat===currentTurnSeat`) stays true for the last mover. A subsequent leave/disconnect then forfeits the drawn game (compounds FR-1). Fix: mark FINISHED when `result.isWinner || result.isDraw`.

#### FR-6 (Medium) Rematch starter
startGame always passes startingSeat 0, so the host/Red starts every rematch (the first-move advantage in Connect 4 is large). Fix: alternate (or give loser) the first move.

#### FR-7 (Medium) No rematch after opponent forfeits
Leaving mid-game does not remove the leaver from `room.players`; the victory modal still offers "Play Rematch", the vote needs `players.length` (2) so it can never complete, and the UI shows "Waiting (1/2)" forever. Fix: hide/disable rematch when the opponent LEFT, or count only connected players.

#### FR-8 (Medium) 5s reconnect grace
GRACE is hard-coded 5000ms in the server; the client reconnect waits 2s then fetches a WS ticket and reopens. A brief network drop/phone lock loses the game outright. Fix: lengthen grace (30-60s) for PLAYING Connect-4 with a visible countdown.

#### FR-9 (Medium) No spectator/authorisation model
registerClient only auto-joins in WAITING; in PLAYING any authenticated user who knows the room code is added to roomClients, receives game:sync and all broadcasts (chat, state), and can send `game:rematch`, `game:rematch_decline` (which cancels the real players' vote) and `game:nudge`. handleDropDisc correctly rejects non-players ("Player not in this game room"). Fix: reject or mark as spectator (read-only) non-players in non-WAITING rooms and ignore their control messages.

#### FR-10 / FR-11 / FR-12 (Low)
FR-10: victory modal always says "connected 4 discs in a row!" even for forfeit wins (winningLine null) and, after FR-1, mislabels results.
FR-11: `myColor` is `'Y'` for any viewer without a seat; touch devices keep `hoveredCol` after a tap so a ghost disc stays above the column.
FR-12: the "Waiting (1/2)" label is hardcoded and the `rematch_declined: opponent_left` broadcast is sent when anyone leaves, including the winner leaving a finished game.

#### FR-13 (Low) Dead ConnectFour.tsx
Never imported anywhere. Its remote DROP_DISC listener trusts `payload.player` from the sender and has stale-closure deps; harmless while unused but would be exploitable if wired in. Suggest deleting.

### Areas checked and found correct
- Win detection: horizontal, vertical, both diagonals, board borders, win formed by a middle piece; 20,000 random full games matched a brute-force checker; 55 of them were draws and detected correctly (VERIFIED).
- Gravity / lowest empty row, full-column rejection (error thrown), out-of-turn rejection, rejection after win/draw, negative and >=7 integer columns, string columns coerced via Number (aside from FR-3 cases).
- Win-line highlighting in the UI uses the engine's winningLine correctly; board clone avoids mutation of prior state.
- 2-player enforcement for seating (maxPlayers 2, auto-start on full); non-player drop attempts rejected server-side.
- /games/connect4 is a simple redirect to /games/four-in-a-row; client socket, reconnect timer and window listeners are cleaned on unmount; victory-modal timer is cleaned up.
- Reconnect/refresh state recovery: game:sync sends full authoritative state and chat history (apart from FR-2).


---

## Tic-Tac-Toe audit

**Reviewed:** `apps/server/src/games/TicTacToeEngine.ts` (all 150 lines), the tic-tac-toe paths of `GameRoomManager.ts` (move, rematch, leave, disconnect, registerClient, startGame) and `GameDefinitions.ts`, `apps/web/src/hooks/useGameRoom.ts` (message handling), and `apps/web/src/app/games/tic-tac-toe/page.tsx` (game, modals, scoreboard, chat, leave flows). `ModukoGame.tsx` is a Sudoku component and unrelated. `TicTacToeGame.tsx` is not imported anywhere (dead code).
**Method:** engine driven with `npx tsx` (`e.ts`); manager driven with a fake in-memory DB and fake sockets (`m.ts`, `m2.ts`, run with a dummy `MONGODB_URI`, no real DB). Scripts are in this directory.

### Findings

| ID | Severity | Title | Evidence | Location |
|---|---|---|---|---|
| TT-1 | High | Leaving (or disconnecting from) a finished game flips the result: the remaining player is made the winner, including after a draw | VERIFIED | GameRoomManager.ts:2467-2500, 2570-2605; page.tsx:1112, 1526 |
| TT-2 | High | Reconnecting while the old socket is still open makes the server forfeit the connected player 5 s later | VERIFIED | GameRoomManager.ts:2000-2020, 2152-2154, 2560-2651 |
| TT-3 | Medium | Any authenticated non-player who knows the room code can vote or decline rematch; one real vote plus one outsider vote restarts the match | VERIFIED | GameRoomManager.ts:529-580, index.ts:2087-2119 |
| TT-4 | Medium | Session scoreboard and win fanfare re-fire on every new `gameState` object or callback identity (sound toggle, reconnect, opponent leave) | CODE | page.tsx:729-753 |
| TT-5 | Medium | Rematch always starts with seat 0 (host, X): no alternation of the starting player or symbol | VERIFIED | GameRoomManager.ts:365 |
| TT-6 | Medium | Drawn game never moves the room to FINISHED, so it stays PLAYING in the DB | VERIFIED | GameRoomManager.ts:656-700 (draw not handled), 108-125 |
| TT-7 | Medium | Rematch can be started mid-game (no game-over check) and the rematch has no membership or phase validation | VERIFIED | GameRoomManager.ts:529-580 |
| TT-8 | Medium | 5-second disconnect grace is too short; a brief mobile blip or background tab loses the game by forfeit | CODE | GameRoomManager.ts:2651, hook reconnect delay useGameRoom.ts:356-362 |
| TT-9 | Medium | Opponent's reactions, nudges/roasts, typing and "opponent disconnected" status are received but never rendered by the page | CODE | page.tsx:327-341 (destructured, never used) |
| TT-10 | Medium | After the opponent leaves, "Play Rematch" stays available and leads to an endless "Waiting for opponent" modal | CODE | page.tsx:1504, 1039-1060; GameRoomManager.ts:2457 |
| TT-11 | Low | Explicit leave then socket close runs forfeit logic twice (duplicate `player_left` broadcasts) | VERIFIED | GameRoomManager.ts:2457, 2560 |
| TT-12 | Low | Stale rematch vote survives `startGame`; a late or duplicate vote can later make a rematch one-sided | CODE | GameRoomManager.ts:529-577 |
| TT-13 | Low | Malformed `cellIndex` values coerce to valid cells (`""`, `false`, `[]` become 0, `true` becomes 1); `1.5`/NaN give a misleading "already occupied" error | VERIFIED | GameRoomManager.ts:2197, TicTacToeEngine.ts:83-89 |
| TT-14 | Low | Move rejections are only logged server-side; client gets no error, and moves clicked while the socket is not OPEN are silently dropped | CODE | GameRoomManager.ts:2144-2149, useGameRoom.ts:1267 |
| TT-15 | Low | Win/turn banner shows `RED ()` / `RED'S TURN ()` (the X glyph is missing from the string) | CODE | page.tsx:2592, 2597 |
| TT-16 | Low | Move sound is silent for the first N moves after a rematch (`prevMoveCountRef` never reset) | CODE | page.tsx:729-737 |
| TT-17 | Low | Chat does not auto-scroll to new messages (`chatBottomRef` assigned but never scrolled to; same ref attached to two nodes) | CODE | page.tsx:304-306, 2870, 2992 |
| TT-18 | Low | Leaving the WAITING lobby with `game:leave` does not free the seat; a joiner within the 5 s grace window auto-starts a game against a ghost player | CODE | GameRoomManager.ts:2457-2500, 2570-2575 |
| TT-19 | Low | If both players disconnect, both grace timers forfeit in turn and the last one wins; room ends FINISHED with a "winner" | CODE | GameRoomManager.ts:2560-2651 |
| TT-20 | Low | Wrong status and wrong error messaging for dead code: `TicTacToeGame.tsx` is unused and its logic duplicates the page | CODE | components/games/TicTacToeGame.tsx |

### Details

#### TT-1 Leave/disconnect after game over flips the result (High, VERIFIED)
`handleClientLeave` and the disconnect grace timer only check `room.status === 'PLAYING' || 'READY' || room.gameState`. `gameState` is always set after the first game, so the forfeit block always runs, even when the game already ended. For tic-tac-toe it then overwrites `gameState.winner` with the remaining player's mark and sets "X left the game. You are the winner!".
Repro (m.ts): finish a game with A winning (X on 0,1,2), connect both, have A (the winner) send `game:leave`. Result: `winner` becomes `O`, `winnerUserId` becomes B. Draw case: B leaves after a full-board draw and `winner:"X"`, `isDraw:true` both set, `player_left` has `isWinner:true` for A. On the client, the loser sees "YOU WON THE MATCH!" (page.tsx:1112) and the board flips to a win, and the scoreboard counts it.
Why it matters: the winner clicking "Leave Game" on the result modal (page.tsx:1526) hands the win to the loser; draws turn into wins.
Fix: in both forfeit paths, skip when `gameState.winner || gameState.isDraw` (or status is already FINISHED); only broadcast `player_left` without a result.

#### TT-2 Reconnect with a live old socket forfeits the connected player (High, VERIFIED)
`registerClient` clears the grace timer, then closes the user's stale socket. The stale socket's `close` event fires afterwards and `handleClientDisconnection(oldClient)` runs: it deletes `userClients[user]` (which now points at the NEW client), marks the player disconnected, broadcasts `player_disconnected`, and starts a fresh 5 s grace timer. Nothing cancels it, so the live player is forfeited.
Repro (m2.ts): A has socket x1, registers x2 (e.g. half-open mobile socket, second tab, quick reconnect). After 5.6 s: room `FINISHED`, `winner:"O"` (B), `userClients.has('a') === false`. B received `player_disconnected` then `player_left`.
Why it matters: affects every game; reconnects on flaky networks lose the match while the player is actively connected. `isUserOnline`/`sendToUser` also break.
Fix: in the close handler ignore sockets that are no longer the registered client (`if (this.userClients.get(id) !== client) return;`) and remove stale clients before closing them.

#### TT-3 Outsiders can control rematch (Medium, VERIFIED)
The WS route (`index.ts:2087-2119`) registers any authenticated user for an existing room code; `handleRematch`/`handleRematchDecline` never check the sender is in `room.players`, and `totalNeeded = room.players.length` is compared with `votes.size`. m.ts: A votes, outsider `zzz` votes, game restarted after 500 ms with only one real vote. An outsider can also send `game:rematch_decline` to cancel every vote, and gets full room state (board, chat history).
Fix: require `room.players.some(p => p.userId === userId)` in both handlers (and ideally refuse WS registration for non-members of a started room).

#### TT-4 Scoreboard double counting (Medium, CODE)
The effect at page.tsx:729-753 runs on `[gameState, lastTicTacToeMove, playMarkSound, playWinFanfare, playDrawChime]` and increments `scores` whenever `gameState.winner` or `isDraw` is set. It re-runs on any new `gameState` object and whenever `soundEnabled` changes (the sound callbacks depend on it). Triggers after a game ends: toggling the sound button, `game:player_reconnected` (sets gameState again), `game:sync`, `game:player_left` (sets gameState twice), re-render of the hook's gameState via forfeit. Each re-run adds another win/draw and replays the fanfare. The scoreboard also resets on refresh.
Fix: count a result once, keyed by game identity (e.g. a ref holding the last counted `moveCount`+room start), and keep sound out of the dependency list.

#### TT-5 No starter rotation (Medium, VERIFIED)
`startGame` always calls `createInitialState(playerConfigs, 0)`; rematch reuses `startGame`. After a rematch seat 0 (host, X) always moves first; seats are never swapped. m.ts: after rematch `currentTurnSeat` is 0. Fix: pass the opposite starter (e.g. loser starts or alternate by a rematch counter) and swap marks if intended.

#### TT-6 Draw does not finish the room (Medium, VERIFIED)
`handleTicTacToeMove` calls `updateGameRoomStatus(..., 'FINISHED')` only when `isWinner`. After a draw m.ts shows `status PLAYING`. `getUserActiveGame`/`findUserActiveGameRoom` (GameRoomManager.ts:108-125) treat PLAYING rooms as active, so friends/dashboard keep showing both players "in a game". Combined with TT-1, a later leave triggers a forfeit. Fix: also set FINISHED on `isDraw`.

#### TT-7 Mid-game rematch (Medium, VERIFIED)
`handleRematch` does not check `gameState.winner || isDraw`. m.ts: after one move, both players sending `game:rematch` reset the board. A client that skips the UI guard can also use it to abandon a losing position when the opponent accepts a spurious request, and the popup shows "Rematch Challenge" mid-match. Fix: reject unless the game is finished.

#### TT-8 Short grace period (Medium, CODE)
The server grants 5 s (`graceSeconds: 5`); the client waits 2 s before reconnecting, then fetches a WS ticket and reconnects. iOS Safari backgrounding, a lift/tunnel, or a slow ticket request easily exceeds it and the player loses. Fix: 20-30 s grace for in-progress games and show the countdown to the opponent (see TT-9).

#### TT-9 Received events never shown (Medium, CODE)
`page.tsx:327-341` destructures `disconnectedPlayer`, `nudgeAlert`, `clearNudgeAlert`, `typingUsers`, `floatingReactions` but never references them. Result: reactions sent with the emoji bar are invisible to the opponent; roasts/nudges only play a chime/vibration; the opponent's "disconnected, reconnecting" state is never displayed, so a player waits on a silent board. Fix: render floating reactions, a nudge toast and a disconnect banner.

#### TT-10 Rematch offered to an absent opponent (Medium, CODE)
After `game:player_left` the win modal still shows "Play Rematch (0/2)". Clicking sends a vote that can never complete (`totalNeeded = room.players.length = 2`; the leaver stays in `players`). The user ends up on "Waiting for opponent to accept" until they cancel. Fix: hide/disable rematch when the opponent `isConnected === false` / `status LEFT`.

#### TT-11 Duplicate forfeit processing (Low, VERIFIED)
`game:leave` runs the forfeit, then the page navigates away and the socket `close` fires `handleClientDisconnection`, which starts a 5 s timer and forfeits again. m.ts showed multiple `player_left` / `player_disconnected` messages for one leave. The client sets `opponentLeftWin` twice. Fix: mark the client as left (or delete grace timer when leave was explicit).

#### TT-12 Stale rematch votes (Low, CODE)
Votes are only cleared on allVoted, decline, or leave. If a vote arrives after `allVoted` (double click, outsider) a new `Set{A}` is created and stays through the next game; at the next game end B alone completes it (`votes.size >= 2` with a stale vote). Fix: clear `rematchVotes` in `startGame` and validate membership (TT-3).

#### TT-13 Weak input coercion (Low, VERIFIED)
`Number(msg.payload?.cellIndex ?? msg.payload?.cell)` turns `""`, `false`, `[]`, `null`-with-no-fallback paths into 0 and `true` into 1, so a malformed message plays a cell. Engine only range-checks (`<0`, `>=9`); `1.5` and `NaN` are rejected only because `board[1.5]` is `undefined !== null` ("already occupied"). Not exploitable beyond the sender's own turn. Fix: `Number.isInteger(cellIndex)` check in the engine.

#### TT-14 Silent move failures (Low, CODE)
Server rejections are only `console.warn`ed; no `error:notification`/ack reaches the player. `makeTicTacToeMove` returns silently if the socket is not OPEN, so taps during a reconnect vanish without feedback. Fix: send a `game:move_rejected` message and show "Reconnecting..." disabling the board.

#### TT-15 Missing glyph in banner (Low, CODE)
`page.tsx:2592` `'RED ()'` and `:2597` `"RED'S TURN ()"` contain empty parentheses (the X mark is missing), while the blue side shows `(◯)`.

#### TT-16 Move sound after rematch (Low, CODE)
`prevMoveCountRef` only increases; the new game's `moveCount` restarts at 0 so mark sounds do not play until the count exceeds the previous game's value (page.tsx:729-737).

#### TT-17 Chat does not scroll (Low, CODE)
`chatBottomRef` is rendered at 2870 and 2992 but no `scrollIntoView` exists; `isUserScrolledUpRef` is maintained but unused. New messages arrive below the fold on mobile and desktop.

#### TT-18 Ghost seat after leaving the lobby (Low, CODE)
`handleClientLeave` only removes players in the forfeit branch; in WAITING it does nothing for the seat (removal occurs via the later disconnect grace timer, 5 s). A second player joining in that window fills `maxPlayers` and `startGame` runs with the leaver; when the timer fires the room is PLAYING, so the joiner wins by forfeit.

#### TT-19 Both players disconnected (Low, CODE)
Each grace timer picks "the other" as winner; both fire, last one overwrites the result and the room is recorded FINISHED with a winner although nobody played on.

#### TT-20 Dead component (Low, CODE)
`components/games/TicTacToeGame.tsx` is never imported; it duplicates board and winning-line code. Risk is divergence only.

### Checked and found correct
- All 8 winning lines detected for X (VERIFIED, e.ts), correct `winningLine` returned and highlighted (page and engine use the same indexes; line end points use first and last cell).
- Win on the 9th move is a win, not a draw; full board without a line is a draw.
- Moves on occupied cells, out-of-range (-1, 9, Infinity), wrong seat, not-your-turn, after game over, by non-player (`Player not in this game room`) are all rejected; state is copied, not mutated.
- Marks: seat 0 is X, seat 1 is O; starting seat 1 yields O first.
- Server is authoritative; clients cannot send another player's seat.
- Rematch normally requires both players (votes per userId in a Set), decline and leave clear votes and notify.
- Reconnect after a plain disconnect restores room and board via `game:sync`; `game:started` clears rematch UI state.
- Hook removes its socket, reconnect timer, and ignores messages after unmount; drag listeners in the page are cleaned up; win-modal timer is cleaned up.
- Victory/stalemate modal text matches `gameState.winner === myMark`; cells disabled when winner/draw or not your turn.


---

## Bingo Duel audit

### 1. Scope
Bingo Duel (2 players, 5x5 board of 1..25, alternate "pick a number" turns, patterns, rounds/best-of, false-claim penalty) is gameType `'bingo'`. It is implemented by:
- `apps/server/src/games/BingoDuelEngine.ts` (pure engine)
- `apps/server/src/games/GameRoomManager.ts` (`handleBingo*`, lines ~700-1290, WS dispatch ~2200, leave/disconnect ~2460-2650, rematch ~530)
- `packages/common/src/bingoDuel.ts` (types)
- web: `apps/web/src/app/games/bingo/page.tsx`, `apps/web/src/hooks/useGameRoom.ts`, `apps/web/src/components/games/bingo-duel/*`. `components/games/bingo/*` and `BingoEngine.ts` are Tambola and were not audited.

Engine bugs were reproduced with `/private/tmp/claude-501/-Users-mayurbhargava-Documents-watch-party/8293527e-c178-46d5-935c-80370aa8e918/scratchpad/games/bd.ts` (run with `npx tsx bd.ts`). Server/UI findings are from reading the code (CODE).

### 2. Findings

| ID | Sev | Title | Evidence | Location |
|---|---|---|---|---|
| BD-1 | Critical | Any player can swap their board mid-game (`bingo:set_board`) after seeing called numbers and win instantly | VERIFIED | BingoDuelEngine.ts:432-493; GameRoomManager.ts:1204 |
| BD-2 | High | `claimBingo` has no phase check: both players win the same round; loser can claim after match FINISHED and overwrite the winner | VERIFIED | BingoDuelEngine.ts:652-737; GameRoomManager.ts:967 |
| BD-3 | High | Full game state (both boards, whole future call queue, all marks) is broadcast to both clients | VERIFIED | GameRoomManager.ts (every bingo broadcast `gameState: state`), game:sync ~2098 |
| BD-4 | High | Finished/round-over games can be reopened: `set_board` sets phase back to PLAYING; `next_round` works in any phase | VERIFIED | BingoDuelEngine.ts:479-482, 742; GameRoomManager.ts:858 |
| BD-5 | High | Any authenticated user who knows the room code can attach to a full room, receive all state (boards) and send game messages; outsider `select_number` self-heal flips phase to PLAYING | CODE | index.ts:2052-2117; GameRoomManager.ts:1137-1150 |
| BD-6 | High | Host's room config is never persisted: `config_update` is lost, auto-start uses defaults, rematch resets to defaults | CODE | GameRoomManager.ts:368, 831, 1253-1262; database.ts:2187 |
| BD-7 | Medium | `select_number` accepts fractional numbers and NaN (consumes turn, corrupts call count, ends game early) | VERIFIED | BingoDuelEngine.ts:518-531; GameRoomManager.ts:2234 |
| BD-8 | Medium | Host can `bingo:start` (restart) mid-match or after finish; any rematch vote counts while a game is running | CODE | GameRoomManager.ts:823-835, 530-570 |
| BD-9 | Medium | Leaving after a finished match overwrites the winner with the remaining player (forfeit logic ignores phase) | CODE | GameRoomManager.ts:2492-2556, 2575-2640 |
| BD-10 | Medium | Client shows "You win" to the loser whenever the opponent is disconnected/left after a finished game | CODE | bingo/page.tsx:431-436, 2341-2348 |
| BD-11 | Medium | `callNext` path (auto-call/manual call) never marks boards; auto-call timer runs only from round 2 on and mixes with turn picks | VERIFIED+CODE | BingoDuelEngine.ts:584-607; GameRoomManager.ts:858-880, 404-436 |
| BD-12 | Medium | When all 25 numbers are called with no winner the game never resolves (phase stays PLAYING; best-of series deadlocks) | VERIFIED | BingoDuelEngine.ts:560-563, 593-596; GameRoomManager.ts:747-757 |
| BD-13 | Medium | Simultaneous completion: no server-side tie-break; the picker's pick completes both boards and first claim message wins | CODE | BingoDuelEngine.ts:543-558, 652 |
| BD-14 | Medium | No turn timer: an idle player stalls the game forever (only a Nudge button) | CODE | BingoDuelEngine.ts:514 |
| BD-15 | Medium | 5 s disconnect grace forfeits the whole best-of match on a refresh/network blip | CODE | GameRoomManager.ts:2570-2651 |
| BD-16 | Medium | Client overwrites local `duelConfig` from `gameState.config` on every state update (settings toggles revert, e.g. voice caller) | CODE | bingo/page.tsx:826-830, 2611 |
| BD-17 | Low | `markNumber` is a toggle and works in any phase; double click removes a mark; no phase check | VERIFIED | BingoDuelEngine.ts:612-647 |
| BD-18 | Low | Refresh during ROUND_OVER shows the wrong winner/defeat (state.winnerUserId is null until match end) | CODE | BingoDuelEngine.ts:718-728; bingo/page.tsx:2341-2348 |
| BD-19 | Low | Unvalidated config: bogus pattern/mode, negative penalty, empty custom pattern is unwinnable | VERIFIED | GameRoomManager.ts:831,1262; BingoDuelEngine.ts:336-354, 369-376 |
| BD-20 | Low | `setPlayerBoard` accepts ragged rows and (as long as unique, in range) non-integer values | VERIFIED | BingoDuelEngine.ts:439-459 |
| BD-21 | Low | Host always moves first in every round and rematch (no alternation) | VERIFIED | BingoDuelEngine.ts:414, 742-765 |
| BD-22 | Low | Auto-start race: client host sends `bingo:start` after server already auto-started, rerolling boards | CODE | bingo/page.tsx:420-427; GameRoomManager.ts:335 |
| BD-23 | Low | Line-completion voice/toast ref not reset between rounds, announcements for lines 1-4 suppressed in later rounds | CODE | bingo/page.tsx:638-678 |

### 3. Details

#### BD-1 (Critical, VERIFIED) set_board mid-game gives a free win
`setPlayerBoard` validates only that the grid holds 1..25 once. It has no phase, round, or "boards locked" check, and it re-evaluates progress against the existing `playerMarks` and `calledNumbers`. `bingo:set_board` is dispatched for any client (GameRoomManager.ts:2229).
Repro (bd.ts test 3): pattern `firstRow`, five numbers called `[25,3,17,9,11]`. Player B sends `bingo:set_board` with a board whose first row is exactly those five numbers. `ok:true, progress.isCompleted:true`, then `claimBingo` returns `valid:true`, phase FINISHED.
Why: a client sees every called number, so any player can always win in one message. The duel result is meaningless.
Fix: reject `set_board` unless phase is a pre-start setup phase (and not once any number is called); better, drop client-supplied boards entirely.

#### BD-2 (High, VERIFIED) double claim and claims after the end
`claimBingo` never checks `state.phase`. Both players have the same completed row (the pick auto-marks for both). Test 2: A claims (valid, ROUND_OVER), B claims (valid) -> `roundsWon {A:1,B:1}` and two history entries for one round. In a one-round match, after A's win (FINISHED) B's late claim returns `valid:true` and `winnerUserId` flips to B. The UI makes this likely: the claim button is shown while `myProgress.isCompleted`, and the loser's button is still there during the 3 s win-modal delay.
Fix: in `claimBingo` return invalid unless `phase==='PLAYING'`; also guard in `handleBingoClaim`.

#### BD-3 (High, VERIFIED) hidden information is sent to both clients
The engine state contains `boards` (all players), `callQueue` (the order of the remaining numbers; only relevant for auto-call mode) and all `playerMarks`. Every handler broadcasts `gameState: state` unfiltered, as does `game:sync`/`game:started`. Test 5 shows `boards.B` and `callQueue [2,13,7,21,20,...]` inside the state object. The UI never renders the opponent board, but a client can read it from the WS frames. In a pick-a-number duel, knowing the opponent's lines lets you pick numbers that complete yours while never helping theirs, and auto-call order is known in advance.
Fix: send a per-recipient sanitized state (own board only, no callQueue; opponent only gets progress counts), as already done for Doodle Duel (`sanitizeStateForGuesser`).

#### BD-4 (High, VERIFIED) reopening finished games
- `setPlayerBoard` sets `phase='PLAYING'` and resets `startedAt` when all players are ready, which is always true after start (`boardsReady` set true in `createInitialState`). Test 3: after FINISHED, `set_board` -> phase PLAYING.
- `handleBingoNextRound`/`startNextRound` only checks host; no check that phase is ROUND_OVER. Test 4: mid-round it wipes boards/calls and bumps the round; after FINISHED it flips to PLAYING with `winnerUserId` still set and `roundsWon` stale.
Impact: the host can wipe a round they are losing; a loser can resurrect a finished match. Room status in DB stays FINISHED while the game plays on.
Fix: guard `startNextRound` with `phase==='ROUND_OVER'`, guard `setPlayerBoard` as in BD-1.

#### BD-5 (High, CODE) non-players can attach and act
`/ws/games/:code` (index.ts:2052) authenticates a user and calls `registerClient` without checking that the user is a seated player. `registerClient` only auto-joins if the room is WAITING and not full; otherwise the socket is still registered, receives `game:sync` (with all boards) and all broadcasts, and may send `bingo:*`. Concretely `bingo:select_number` from an outsider hits the "self-healing" block in `handleBingoSelectNumber` (`!boards[userId]`) which sets `phase='PLAYING'` (reopens FINISHED/ROUND_OVER) before the turn check rejects it; `bingo:set_board`/`bingo:mark` create board/mark entries for the outsider (`startNextRound` then also generates boards for it). Codes look like `BINGO-XXXX`.
Fix: refuse registration (or mark read-only) unless the user is in `room.players`; remove the self-heal or limit to seated players.

#### BD-6 (High, CODE) host config is lost
`getGameRoomById` returns a fresh object built from SQLite each call (database.ts:2187), so `(room as any).bingoConfig = ...` set in `handleBingoConfigUpdate` (1262) is discarded; it only broadcasts. When the 2nd player joins, the server auto-starts with `DEFAULT_BINGO_DUEL_CONFIG` (GameRoomManager.ts:335/368: bingo is not excluded from auto-start). The client then syncs `duelConfig` from `gameState.config` (page.tsx:826), so the host's chosen pattern/mode/penalty are replaced by defaults (fiveLines, classic, 3 s) unless the host's late `bingo:start` wins a race (see BD-22). The rematch path (`handleRematch` -> `startGame(freshRoom)`) always uses defaults too. Best-of series configured in the lobby are therefore usually unreachable.
Fix: persist the config with the room (or keep it in a server Map), and exclude `bingo` from the auto-start so `bingo:start` starts it, as with tambola/doodle.

#### BD-7 (Medium, VERIFIED) fractional and NaN numbers
The check is `typeof n !== 'number' || n<1 || n>25`. `3.5` passes (called `[3.5]`, word "3.5", `callQueue` still 25 long); `NaN` passes the range test (both comparisons false) once (`Number(undefined)` from a payload without `number` is NaN). Test 1 flood: 25 alternating picks of non-integers produced `isFinished:true` with 0 real numbers called. Each such pick passes the turn to the opponent, and `calledNumbers.length>=25` ends the game early.
Fix: `Number.isInteger(n)` and range check.

#### BD-8 (Medium, CODE) restart without finishing
`handleBingoStart` only checks host; `startGame` replaces the state (new boards, rounds reset to 1, scores wiped) regardless of status. A host losing a best-of can restart. Also `handleRematch` has no check that the game is over, so both players (or one repeatedly) triggering `game:rematch` restart a live game; the vote set also is not limited to seated players.
Fix: only allow start from WAITING, and rematch from FINISHED.

#### BD-9 (Medium, CODE) leave after the match overwrites the result
`handleClientLeave` and the disconnect timer apply the forfeit branch for `room.gameState` truthy (always, once started), not only when the game is in progress. For bingo it sets `phase='FINISHED'`, `winnerUserId=<the remaining player>` and broadcasts `isWinner:true`. When the real winner clicks Leave/closes the tab on the end screen, the loser is recorded as the winner (persisted with `winner.seat`) and the client modal flips.
Fix: skip the forfeit logic when `phase==='FINISHED'` (status already FINISHED).

#### BD-10 (Medium, CODE) client inversion
page.tsx:431: `isOpponentLeft` is true whenever the game is over and the opponent is absent/not connected; the win modal then uses `isWinnerMe = isOpponentLeft ? true : ...` (line 2341-2348). If the winner closes the tab after a normal win, the loser's screen turns into a victory with confetti.
Fix: derive "opponent left" from the server `game:player_left` while the phase was not FINISHED, and use `winnerUserId`.

#### BD-11 (Medium, VERIFIED + CODE) call paths
`callNext` pushes to `calledNumbers` but does not update `playerMarks` (test 6: marks `[]`, progress 0/5), so with calls via the timer/host `bingo:call_next` players must mark manually (the UI's `handleCellClick` does this), while `selectNumber` auto-marks. The auto-call timer is started only from `handleBingoNextRound` (rounds 2+), never at game start (`startGame` starts it for tambola only), so round 1 is pure turn picking and later rounds get timer numbers *and* turn picks interleaved, with `currentTurnUserId` not advanced by timer calls. Config `autoCallSpeed` default is 5000 so this affects every multi-round match.
Fix: choose one mode per game (turn picks or auto-call), start/stop consistently, and mark in `callNext` or skip manual marking.

#### BD-12 (Medium, VERIFIED) no end when 25 numbers are called
Test 6/8: after all numbers are called `callNext`/`selectNumber` return `isFinished` but `phase` stays PLAYING, no winner, `roundHistory` unchanged. The handler marks the room FINISHED in SQLite and broadcasts `bingo:game_over` (client sets room FINISHED, winner shows as "Player"), but `bingo:claim` still works and `next_round` is not offered since phase is not ROUND_OVER. Reachable with unwinnable patterns (BD-19) or after a player unmarks numbers (BD-17).
Fix: on exhaustion set phase ROUND_OVER/FINISHED with an explicit draw result.

#### BD-13 (Medium, CODE) simultaneous bingo
`selectNumber` auto-marks the number for both boards. Since every board holds all 25 numbers, the opponent's lines often complete on the same call. Only the first `bingo:claim` message processed by the server wins; there is no server-side detection or defined tie-break (e.g. caller wins, or both-complete = draw), so the result depends on network latency. Combined with BD-2 both can win.
Fix: after each pick evaluate both players; if exactly one completed, auto-award; if both, apply a defined rule.

#### BD-14 (Medium, CODE) no turn timer
`currentTurnUserId` is advanced only by a successful pick. Nothing times out an inactive player; the only remedy is the Nudge chat message. A silent player holds the room hostage (the other can only leave).
Fix: per-turn timeout with auto-pick (random uncalled number).

#### BD-15 (Medium, CODE) 5 s grace
`handleClientDisconnection` finishes the room after 5 s offline and awards the opponent, even in a best-of-3 at 1-1. Mobile page refreshes, tab suspend and Wi-Fi switches often exceed 5 s. State is saved so a reconnect would otherwise recover.
Fix: longer grace (30-60 s) and notify; never forfeit a series on a blip.

#### BD-16 (Medium, CODE) config overwritten by state
`useEffect(..., [gameState?.config])` copies `gameState.config` into `duelConfig` on every new state object (each WS state message is a new object). The in-game settings toggle for the voice caller (page.tsx:2611) only changes local `duelConfig`, so it reverts on the next call/mark.
Fix: sync only when `gameState.config` content changes at start, and persist user-local toggles separately (`voiceCaller`/`sound` are local settings).

#### BD-17 (Low, VERIFIED) mark toggle
`markNumber` toggles; test 7 shows a pick's auto-mark can be removed by `bingo:mark` (marks `[]`). Two quick taps in the UI send two toggles (guard uses stale `myMarks`) leaving the number unmarked; for numbers from `callNext` that loses progress silently. No phase check, so marks change after the round ends.
Fix: make mark idempotent (add only), reject outside PLAYING.

#### BD-18 (Low, CODE) refresh in ROUND_OVER
`claimBingo` sets `winnerUserId` only when the match is over. The modal falls back to `lastBingoConditionWon`, which is empty after reload/reconnect, so both players see "Player" and `isWinnerMe=false` (defeat). Fix: use `roundHistory[roundHistory.length-1]`.

#### BD-19 (Low, VERIFIED) unvalidated config
`bingo:start` / `bingo:config_update` accept any JSON merged into config (test 12: `pattern:'bogus'`, `mode:'weird'`, `falseBingoPenalty:-5` stored). Unknown pattern silently evaluates as `anyRow`; an all-false `customPattern` can never complete (test 8: nothing is winnable, runs into BD-12); a giant penalty (e.g. 1e9) locks the claimer for a long time; extra keys are echoed to clients. Fix: validate against the known enums/ranges.

#### BD-20 (Low, VERIFIED) board validation gaps
`setPlayerBoard` checks `flat().length===25` only: `[[1..25],[],[],[],[]]` is accepted (test 3, "ragged board accepted"); `board[r][c]` is then undefined for rows 1-4 so that board can never match. Floats fail only by accident (duplicate check). Fix: require 5 arrays of 5 integers.

#### BD-21 (Low, VERIFIED) host always starts
`currentTurnUserId = playerUserIds[0]` in `createInitialState`, and `startNextRound` leaves the turn where it was. Rematch always gives the host the first pick; since the picker can complete lines (BD-13) this is a systematic edge. Fix: alternate / randomize the starter.

#### BD-22 (Low, CODE) double start race
Host's page effect sends `bingo:start` whenever `isWaiting` and 2 players are present (page.tsx:420-427), while the server has already auto-started on the 2nd join (GameRoomManager.ts:335). If the host's state has not yet received `game:started`, the extra start re-rolls boards (and, per BD-6, applies the host's config) mid first pick. Fix: see BD-6.

#### BD-23 (Low, CODE) speech/toast
`lastSpokenLineCountRef` resets only when `isPlaying` is false, but `isPlaying` stays true across ROUND_OVER and the next round, so in later rounds "Line completed" speech/toasts do not fire until the count exceeds the earlier round's count. Fix: reset on `currentRound` change.

### 4. Checked and found correct
- Board generation: Fisher-Yates over 1..25 using `secureRandom`; always a permutation (no duplicates, no range errors). Call queue likewise.
- `selectNumber`: out-of-turn rejected, repeats rejected, integers 1..25 removed from the queue and auto-marked for both; turn alternation correct for 2 players.
- `markNumber` rejects uncalled numbers (marks are intersected with `calledNumbers` in `evaluatePattern`), and a client can only mark on its own list (userId from the socket).
- Pattern evaluation (fiveLines with 12 lines, rows, columns, corners, X, plus, diagonals, full house, custom non-empty) behaved correctly in the tests; marks for uncalled numbers are ignored.
- False-claim penalty works for repeated claims (test 11); `bingo:claim_result` goes only to the claimer; claim/mark use `userId` from the authenticated socket.
- Host-only gating on start/next_round/call_next/pause/config_update; `targetRounds` mapping (bestOf3=2, bestOf5=3, quick/classic/custom=1).
- Intentional leave while playing forfeits to the opponent and stops the auto-call timer; the rematch vote state is cleared on leave; timers in the page (toast, nudge, win modal) are cleaned up by effects.


---

## Tambola (Housie) audit

**Reviewed:** the 90-ball Tambola game. Server: `apps/server/src/games/BingoEngine.ts` (tickets, draw queue, claim validation), the Bingo/Tambola section of `apps/server/src/games/GameRoomManager.ts` (start, auto-call timer, mark/claim/pause/rematch/leave handlers, WS dispatch), `GameDefinitions.ts`, `index.ts` room creation, and `packages/common/src/bingo.ts` (types). Client: `apps/web/src/app/games/tambola/page.tsx`, `hooks/useGameRoom.ts` (bingo:* cases), `components/games/bingo/BingoVictory.tsx` (shared with Bingo Duel), `UnifiedGameWaitingRoom.tsx`. Engine behaviour was driven with `npx tsx` scripts (`t1.ts`, `t2.ts`, `t3.ts` in this directory). Bingo Duel logic not reviewed.

### Findings

| ID | Severity | Title | Evidence | Location |
|----|----------|-------|----------|----------|
| TA-1 | Critical | Server broadcasts the entire future draw order (`callQueue`) and every player's ticket to every client | VERIFIED (state) + CODE (broadcast) | GameRoomManager.ts:395-406, 795-805, 1124-1133, 2113-2123; BingoEngine.ts:280-299 |
| TA-2 | High | Tambola rooms for 5-20 players cannot be created at all (only 2-4 colour tables exist); advertised 2-20 is broken | VERIFIED | GameDefinitions.ts:80-92; GameRoomManager.ts:210-211; index.ts:2095-2104 |
| TA-3 | High | "CLAIM TAMBOLA!" button always claims a fixed-priority prize from local marks; middle/bottom line and four corners often unclaimable, false claims spammed | CODE | tambola/page.tsx:598-612 |
| TA-4 | High | Claims are accepted after the game is FINISHED; scores and winner change after game over | VERIFIED | BingoEngine.ts:550-715; GameRoomManager.ts:967-1095 |
| TA-5 | High | Auto-call timer is never restarted after server restart; game freezes forever (no number is ever drawn again) | CODE | GameRoomManager.ts:54, 704-722, 2060-2123 |
| TA-6 | Medium | Winner display name is wrong when the top scorer is not the player who made the last claim; ties resolved arbitrarily | VERIFIED | BingoEngine.ts:675-689 |
| TA-7 | Medium | Unsupported/empty-target conditions can be claimed with zero numbers called (free points) | VERIFIED | BingoEngine.ts:606-620 |
| TA-8 | Medium | `bingo:mark` accepts any number (uncalled, off-ticket, NaN, unbounded) and any socket; unbounded state growth broadcast to all | VERIFIED | GameRoomManager.ts:1097-1135, 2224-2227; BingoEngine.ts:355-374 |
| TA-9 | Medium | Host `config` is spread unvalidated: NaN `callingSpeed` makes timer fire every 1 ms, `winConditions:null` throws and strands a running game, `mode:'75-ball'` swaps tickets | VERIFIED (engine/arith) + CODE | GameRoomManager.ts:706, 829-835, 1253-1275; BingoEngine.ts:261-276 |
| TA-10 | Medium | `bingo:start` has no status / player-count guard: host can restart a running game (new tickets) or start alone | CODE | GameRoomManager.ts:823-837 |
| TA-11 | Medium | "Last Numbers" strip shows the first five numbers ever called, not the last five | CODE | tambola/page.tsx:471, 1001-1013; useGameRoom.ts:743-754; GameRoomManager.ts:795-805 |
| TA-12 | Medium | Local marks are never reset between games: after a rematch old marks persist on the new ticket and drive progress/claim logic | CODE | tambola/page.tsx:481-510, 541-562 |
| TA-13 | Medium | UI is a hard-coded 2-player duel (one "opponent", "Call (x/2)", "2 Players"); 3-4 player rooms show only one rival; no pause/call UI for host | CODE | tambola/page.tsx:269-270, 544-548, 778-857, 1181 |
| TA-14 | Medium | Player leaving a 2-player Tambola game: room set FINISHED but game state has no winner/phase; Victory modal says "Winner Wins!" with no winner | CODE | GameRoomManager.ts:2442-2530; tambola/page.tsx:275, 1456-1469 |
| TA-15 | Medium | Victory scoreboard labels every other player with the winner's name and is not sorted | CODE | BingoVictory.tsx:139-146 |
| TA-16 | Low | `bingo:config_update` and `tambolaConfig` are stored on a throw-away DB object: settings are lost, rematch uses defaults | CODE | GameRoomManager.ts:829-835, 1253-1275; database.ts:2187-2210 |
| TA-17 | Low | Rematch needs votes from every player ever seated (incl. leavers); can be triggered mid-game; stale votes | CODE | GameRoomManager.ts:529-584 |
| TA-18 | Low | No host transfer: if the host leaves/disconnects, pause/manual call/start are dead | CODE | GameRoomManager.ts:839-846, 883-890, 2560-2640 |
| TA-19 | Low | Game that exhausts all 90 numbers ends with no winner or summary (e.g. housefull disabled); modal shows "Winner" | VERIFIED | BingoEngine.ts:322-326; tambola/page.tsx:1456-1463 |
| TA-20 | Low | Unmark sends a toggle (`forceMark:false`): if the server lacks the mark, the "unmark" marks it; preview mode mutates a memoised Set | CODE | tambola/page.tsx:565-595; BingoEngine.ts:364-372 |
| TA-21 | Low | Tambola page accepts `bingo` (Duel) rooms without redirecting | CODE | tambola/page.tsx:261-263 |

### Details

#### TA-1 Future draw order and all tickets leaked (Critical)
**What:** `BingoGameState` contains `callQueue` (the remaining shuffled numbers in exact draw order) and `tickets` (every player's ticket). The whole state object is put in `game:started`, `game:sync` (reconnect), `bingo:number_called`, `bingo:number_marked`, `bingo:claim_result` and `bingo:condition_won` payloads. There is no sanitiser for Tambola (the Doodle game has one).
**Repro:** open the WS as any player, read `payload.gameState.callQueue` from the first `game:started`/`game:sync`: it lists all 89 upcoming numbers. `t1.ts`: `createInitialState` returns `callQueue length 90` and tickets for every user.
**Why:** a client can know every future number and every opponent's ticket, so it can compute exactly when anybody will complete a prize and claim first (claims are first-come, server time). Defeats the game.
**Fix:** keep `callQueue` server-side only (a separate map or strip before send) and send each client only its own ticket; send others only marked counts.

#### TA-2 Rooms of 5-20 cannot be created (High)
**What:** `GAME_DEFINITIONS.tambola.playerOptions` is `[2,3,4,5,6,7,8,10,15,20]` but `colorAssignments` only has keys 2, 3, 4. `createGameRoom` does `colors = def.colorAssignments[maxPlayers]; colors[0]` and throws `TypeError` for 5+. `joinRoom` has the same lookup. The WS auto-create path (`index.ts:2095`) uses `maxPlayers = 20` for tambola, so it always throws; the catch only logs and the client gets "Game room does not exist". The partner/matchmake endpoints always create 2-player rooms (index.ts:1398, 1456), so in practice only 2-4 is reachable.
**Repro (`t2.ts`):** `createGameRoom({gameType:'tambola', maxPlayers: n})` for n=2,3,4 ok; 5,6,8,10,20 throw "Cannot read properties of undefined (reading '0')".
**Fix:** add colour (or just seat-index) fallbacks for all player counts, e.g. cycle a palette, and fail with a clear error.

#### TA-3 Claim button logic (High)
**What:** `handleClaimOrStart` picks a prize in fixed order (housefull, top, middle, bottom, corners, early5) from the user's *local marks*, ignoring which prizes are already claimed and what was actually called. If the top line is complete but already won by someone else, the button keeps sending `topLine` ("already claimed") and can never send `middleLine`/`bottomLine`/`fourCorners` for that player until the top row stops being full (never). When nothing is complete it still sends `early5` (a false claim, which with a non-zero penalty locks the player out). Early5 is also sent in preference over nothing even when the early-5 prize is gone.
**Repro:** player holds complete top and middle rows (called numbers); top line claimed by player B first. Player A presses CLAIM repeatedly: server replies "Top Line was already claimed by B" every time; A cannot claim the middle line.
**Fix:** provide per-prize claim buttons (or choose the first prize that is met on `calledNumbers` and not in `claimedConditions`), and disable the button when nothing is claimable.

#### TA-4 Claims after game over (High)
**What:** `validateClaim` never checks `state.phase`. After housefull ends the game, any unclaimed prize can still be claimed: points are added, the finished block re-runs, `gameSummary`/winner are recomputed, `condition_won` and `game_over` are broadcast again. Also after the last number is called but before the next tick marks FINISHED.
**Repro (`t3.ts`):** all 90 numbers called; A claims housefull -> `phase FINISHED`, scores `{A:100,B:0}`; B then claims `topLine` -> valid, scores `{A:100,B:20}` and `gameSummary.finalScores` is rewritten. With other point values the winner can flip after the victory screen.
**Fix:** reject claims when `state.phase !== 'PLAYING'` (and add a short settle rule if desired).

#### TA-5 Timer lost on server restart (High)
**What:** the draw timer lives in the in-memory `bingoTimers` map and is only started from `startGame` (and next-round of Duel). On server restart/deploy the room remains `PLAYING` in the DB, but nothing restarts the interval, and `registerClient` (reconnect) re-arms only the doodle timer. Players see the game stuck on the last number indefinitely; the UI has no manual call/pause for the host, and there is no timeout cleanup of such a room.
**Fix:** in `registerClient`, if a Tambola room is `PLAYING` with `autoCall` and no timer, call `startBingoAutoCall`; also expose the host call-next control in the UI.

#### TA-6 Wrong winner name / ties (Medium)
**What:** at game end `winnerUserId` = highest score (first in iteration order on ties) but `winnerDisplayName` is `displayName` of the last claimer if that is the top user, else the **housefull claimer's** name, which may not be the top scorer.
**Repro (`t1.ts`):** A claims early5, top, middle, bottom, fourCorners (100 pts); B claims housefull (100 pts). Result: `winnerUserId A`, `winnerDisplayName Bob`. With A at 110 and B at 100 the name is still Bob. Ties are always won by whoever is first in the scores map, with no tie handling.
**Fix:** derive the name from `players`/`topUser`, and define a tie-break (e.g. housefull holder).

#### TA-7 Free claims via empty targets (Medium)
**What:** `getTargetNumbersForCondition` returns `[]` for conditions unsupported by the mode (xPattern, crossPattern, starPattern, diamond, fullBorder, customPattern on 90-ball; starPattern always; customPattern without a pattern). `validateClaim` then computes `matched(0) >= length(0)` -> met.
**Repro (`t3.ts`):** config with `xPattern:true`; before any number is called, `validateClaim(..., 'xPattern')` returns `valid:true, +25`. Since the host's config comes from the client (TA-9), a host can enable such a prize and claim it instantly. Also those prizes can never be completed on `calculateAllProgress` (total 0).
**Fix:** treat empty target as not claimable and whitelist valid conditions per mode in config validation.

#### TA-8 Unvalidated mark messages (Medium)
**What:** `Number(msg.payload.number)` is passed straight to `markNumber`: no integer/1-90 check, no check that the number is on the player's ticket or has been called, no phase check, no membership check, no cap. `NaN` is stored (becomes `null` in JSON). Each mark persists the full state to the DB and broadcasts the full state (including all tickets) to all clients.
**Repro (`t1.ts`/`t3.ts`):** marks 999, NaN and a non-player id `zzz` are all accepted; 100,000 unique marks grow one list to ~600 KB of state which is rewritten and broadcast on every subsequent event (rate limit 120/s makes this reachable in under a minute).
**Why:** marks are cosmetic for claims (server uses `calledNumbers`), but opponent progress counters (`opponentMarkedList.length`, page.tsx:544) are fed by junk, and state bloat is a DoS vector for the room.
**Fix:** accept only integers 1-90 that are on the caller's own ticket, only while PLAYING, dedupe, and broadcast only the delta.

#### TA-9 Unvalidated host config (Medium)
**What:** `{...DEFAULT_BINGO_CONFIG, ...config}` takes any client object. `callingSpeed:"abc"` gives `Math.max(800,"abc"||3000)=NaN` and Node clamps `setInterval(NaN)` to 1 ms (verified `TimeoutNaNWarning ... set to 1`), so all 90 numbers are drawn in ~0.1-0.2 s. `winConditions:null` throws a TypeError in `createInitialState` (verified); because `startGame` has already `stopBingoAutoCall`'d, restarting a running room with this payload stops its timer and leaves it frozen. `mode:'75-ball'` creates 5x5 tickets that the Tambola UI cannot show (ticket falls back to the preview grid). Negative/NaN `points` and `falseClaimPenalty` are accepted. `bingo:config_update` has the same problem.
**Fix:** validate the config against a schema (known keys, booleans, speed clamp 800-30000, mode fixed to 90-ball for Tambola).

#### TA-10 No guard on `bingo:start` (Medium)
**What:** `handleBingoStart` only checks host. It does not check `room.status === 'WAITING'`, nor the minimum of 2 players (the UI checks `hasOpponent`, the server doesn't). A host can send `bingo:start` mid-game and wipe the game with fresh tickets, or start alone / after finish bypassing rematch votes.
**Fix:** require status WAITING (or FINISHED via the rematch path) and `players.length >= 2`.

#### TA-11 "Last Numbers" shows the first five called (Medium)
**What:** the tambola `bingo:number_called` payload carries `calledNumbers` = the full call history (chronological). The hook stores it in `lastBingoCall.calledNumbers`, and the page uses `lastBingoCall?.calledNumbers ?? gameState.lastCalledNumbers` then `.slice(0,5)`. So after the 5th call the strip is frozen on the first five numbers drawn (idx 0 is highlighted as "latest"). The correct `gameState.lastCalledNumbers` is shadowed.
**Fix:** use `gameState.lastCalledNumbers` (or `calledNumbers.slice(-6, -1).reverse()`); there is also no full 1-90 called-board for missed numbers.

#### TA-12 Stale local marks after rematch (Medium)
**What:** `localMarked` and `markedSentRef` are component state that is never reset on `game:started`. After a rematch (same mounted page) every number marked in game 1 that appears on the new random ticket is displayed as marked, counted toward Early5/lines/housefull progress, and `markedSentRef` stops auto-mark from re-sending it. The claim button then picks a prize from these counts, producing false claims, and genuine called numbers look "unmarked-vs-marked" inconsistently.
**Fix:** reset both when `gameState.startedAt`/ticket changes or on `game:started`.

#### TA-13 Page is a 2-player duel (Medium)
**What:** only `opponent = first other player` is rendered (name, score, marked count); header says "2 Players"; the call window says `Call (n/2)`; scores of the other 2-18 players are invisible until the final modal. The host has no pause or manual-call control in the arena (`toggleBingoPause` / `callNextBingoNumber` exist in the hook but are unused), and config (speed, prizes) cannot be set. Combined with TA-2 this means the 2-20 player design is not actually playable.
**Fix:** render a player list/leaderboard from `gameState.scores`; add host controls.

#### TA-14 Leaving a 2-player game (Medium)
**What:** `handleClientLeave` / disconnect-grace code has branches for ludo, 4-in-a-row, tic-tac-toe, bingo (Duel), doodle and chess but **none for tambola**. With 2 players, the remaining player gets room status FINISHED and `game:player_left` with `isWinner:true`, but `gameState.phase` stays `PLAYING`, `winnerUserId` is null and the timer is only stopped lazily on the next tick. The page treats `room.status==='FINISHED'` as finished and opens `BingoVictory` with `winnerDisplayName` falling back to "Winner" ("Winner Wins!"), `winnerUserId ''`.
**Fix:** add a tambola branch: stop timer, set phase FINISHED, winner = remaining player, and give a proper message.

#### TA-15 Victory scoreboard labels (Medium; shared component, also affects Bingo Duel)
`BingoVictory.tsx:145`: `uid === myUserId ? 'You' : winnerDisplayName`. Every other player in the final score list is named after the winner (if I won, I see "You" and the rest show my own name as the "winner"); the first entry is highlighted by object order, not by score. Fix: map uid to display name via players and sort by score.

#### TA-16 Config not persisted (Low)
`getGameRoomById` builds a new object from the DB row each call (`database.ts:2187`), so `(room as any).tambolaConfig = ...` in `handleBingoConfigUpdate` is dropped immediately (only the broadcast survives). `handleBingoStart` works because it passes the same object to `startGame`, but rematch (`freshRoom`) always starts with `DEFAULT_BINGO_CONFIG`. Fix: store config in the game state/room record.

#### TA-17 Rematch semantics (Low)
`totalNeeded = room.players.length` counts players who left (PLAYING rows are not removed), so with 3-4 players one leaver makes rematch unreachable. `handleRematch` also works while the game is still PLAYING (any player can send `game:rematch`; if all do, the game restarts), and votes persist in `rematchVotes` until all vote or someone leaves.

#### TA-18 No host transfer (Low)
`hostUserId` is never changed. If the host leaves a multi-player room or disconnects, pause/resume, manual call and start are impossible (auto-call keeps running, so it is not fatal with default config).

#### TA-19 No winner when numbers run out (Low)
When `callQueue` empties (possible if housefull is disabled and not every enabled prize is claimed) `callNext` sets `FINISHED` but `winnerUserId`, `winnerDisplayName` and `gameSummary` stay null; scores are not summarised, the modal shows "Winner Wins!" (verified: `winner null summary null` after 90 calls with housefull disabled). Also the 90th number is followed by a tick that finishes the game, so claims on the last number are only valid by TA-4.

#### TA-20 Unmark toggle desync (Low)
Client unmark sends `forceMark:false`, which the server implements as a toggle. If the server never recorded the mark (dropped/rate-limited message, auto-mark race) the unmark message adds it. In preview (non-playing) mode `handleCellClick` mutates the `useMemo` Set `myMarkedSet` directly.

#### TA-21 Bingo Duel room opened in Tambola page (Low)
The guard only redirects when `room.gameType` is neither `tambola` nor `bingo`, so `/games/tambola?room=BINGO-XXXX` renders the Tambola UI over a Duel game state (`tickets` undefined -> preview ticket). Fix: redirect `bingo` rooms to `/games/bingo`.

### Areas checked and found correct
- Ticket generation (`generateTambolaTicket`): 20,000 generated tickets, 0 invalid. Each has 3 rows x 9 columns, exactly 15 numbers, 5 per row, 1-3 per column, no empty column, numbers within column ranges (1-9, 10-19, ..., 80-90), no duplicates, sorted top-to-bottom. Uses `secureRandom`. (A failed placement after 100 attempts would return a bad grid, but it did not occur.) Cross-player uniqueness is not enforced but collisions are astronomically unlikely.
- Draw: Fisher-Yates shuffle with `secureRandom` over 1-90, no repeats, numbers shifted off the queue so no duplicates; draw is server-authoritative and the timer is cleared on finish/status change; interval clamped to >= 800 ms for valid numeric speeds; first call fires immediately on start when autoCall.
- Claims are validated against server `calledNumbers`, not client marks; early5 (>=5 called numbers on ticket), top/middle/bottom lines and housefull are correct; four corners (first and last of top and bottom rows) correct; disabled and already-claimed prizes rejected; two simultaneous claims resolve first-come (single-threaded) and the second gets "already claimed"; false-claim penalty works when configured (default 0); prototype keys (`__proto__`, `constructor`) as condition are rejected.
- Authorization: only host can start/pause/call/config; marks and claims are keyed on the authenticated socket user, so a client cannot mark or claim on another player's ticket; join after start is refused for new users; rejoin of own seat works and reconnect sends `game:sync` with the ticket.
- Room limits: `createGameRoom` validates `maxPlayers` against `playerOptions` (but see TA-2); room full check on join.
- Client: listeners for PiP drag are removed on unmount, toast/celebration timers are cleaned up; no text-to-speech or sound exists in the Tambola page (nothing to leak).


---

## Chess audit (read-only)

**Reviewed:** `apps/server/src/games/ChessEngine.ts` (all), `packages/common/src/chess.ts`, chess handlers/clock/rematch/leave/disconnect paths in `GameRoomManager.ts` (L380-440, 527-600, 1724-1990, 2160-2320, 2400-2640), `GameDefinitions.ts`, `apps/server/src/index.ts` WS entry, `apps/web/src/app/games/chess/page.tsx`, `components/games/chess/*` (Board, Promotion, Clock, PlayerCard, PlayersPanel, MoveHistory, GameEnd, Review, Modals, Left/Info/Chat), and the chess cases in `hooks/useGameRoom.ts`.
**Method:** move generation is delegated to chess.js 1.4.0 and is correct (perft 20/400/8902/197281, Kiwipete 48/2039/97862, castling-through-check, ep pin all OK). Bugs are in the wrapper: state, clocks, draw/takeback/resign handlers, membership checks, lifecycle. Scripts: `t1.ts`, `t2.ts` in this directory (run with `./node_modules/.bin/tsx`).

### Findings

| ID | Severity | Title | Evidence | Location |
|---|---|---|---|---|
| CH-1 | Critical | `chess:draw_response` with `accept:true` and no valid offer freezes/ends the room (offerer even gets Accept button on own offer) | CODE (engine no-op VERIFIED) | GameRoomManager.ts:1912-1939; ChessEngine.ts:261-264; useGameRoom.ts:979; page.tsx:815 |
| CH-2 | High | No player-membership check: any connected user (spectator/outsider with room code) can resign Black, offer/accept draws, request/answer takebacks | VERIFIED (engine) + CODE | ChessEngine.ts:229-298; GameRoomManager.ts:1871-1973, 2294-2312; index.ts:2053-2119 |
| CH-3 | High | Clock double-deducted: 1s ticker subtracts AND `makeMove` subtracts full elapsed time again | VERIFIED | GameRoomManager.ts:1745; ChessEngine.ts:96-100 |
| CH-4 | High | Takeback does not restore the position (FEN/turn unchanged, moves popped) -> state desync | VERIFIED | ChessEngine.ts:299-329 |
| CH-5 | High | Leaving/disconnecting after game over rewrites result to ABANDONED and gives the win to the other player (winner leaving makes loser the "winner") | CODE | GameRoomManager.ts:2415-2436 (leave), 2594-2630 (grace timer) |
| CH-6 | High | Threefold repetition is never detected (fresh `Chess(fen)` has no history) | VERIFIED | ChessEngine.ts:108,192 |
| CH-7 | Medium | Rejected/illegal moves still burn the mover's clock (state mutated before validation) | VERIFIED | ChessEngine.ts:95-105 |
| CH-8 | Medium | Stale draw offer / takeback request still answerable after game over: CHECKMATE becomes DRAW / zombie CHECK | VERIFIED | ChessEngine.ts:261-276, 293-331; ChessEngine.ts:254 (never cleared on move) |
| CH-9 | Medium | Host can `chess:start` at any time (mid-game restart, no status check) with unvalidated client config (negative/NaN/huge clocks) | VERIFIED (config) + CODE | GameRoomManager.ts:1790-1823, 1975-1990 |
| CH-10 | Medium | Rematch accepts votes from non-players and while game is in progress; 1 player + 1 outsider restarts a live game | CODE | GameRoomManager.ts:529-580 |
| CH-11 | Medium | Time-control preset buttons in lobby do nothing (`CHESS_TIME_PRESETS` is an array indexed by string id) | CODE | page.tsx:436-437 |
| CH-12 | Medium | Non-player/spectator UI is treated as White: board enabled on White's turn, resign/draw buttons live | CODE | page.tsx:237-250, 488 |
| CH-13 | Medium | Chess clock ticker is never restarted after server restart/reload for a PLAYING room -> no flag-fall, free time | CODE | GameRoomManager.ts:2050-2145 (only doodle restarts) |
| CH-14 | Medium | Disconnect does not pause the clock; refresh/network blip >5 s forfeits the game | CODE | GameRoomManager.ts:2585-2640 |
| CH-15 | Low | Timeout-vs-insufficient-material only inspects winner's pieces; K+N/K+B/K+2N vs opponent with pawns/queen/rook is wrongly a draw | VERIFIED | ChessEngine.ts:340-426 |
| CH-16 | Low | Rematch never swaps colours (players[0] always White) | CODE | GameRoomManager.ts:393-399, 570-578 |
| CH-17 | Low | Last-move highlight lost on reconnect/refresh, stale after takeback, not cleared on rematch (uses `lastChessMove`, not `gameState.lastMove`) | CODE | page.tsx:643; useGameRoom.ts:375-382, 631-650, 994-997 |
| CH-18 | Low | Mobile clock bars show "10:00" when time is 0; bottom bar always labelled "(You)" even after manual flip | CODE | page.tsx:631, 663, 675 |
| CH-19 | Low | Draw/takeback modals not restored on reconnect, persist over game-over, never cleared when a move is played; draw offers unlimited | CODE | useGameRoom.ts:979-998; ChessEngine.ts:250-256 |
| CH-20 | Low | Client clocks only update every 1 s (no local interpolation); "critical" tenths display always `.0`; no drift correction | CODE | ChessClock.tsx:29-33; useGameRoom.ts:965-977 |
| CH-21 | Low | Auto-start path (`startGame`) drops avatarUrl; Info drawer shows local default config instead of game's real config | CODE | GameRoomManager.ts:394-399; page.tsx:752-753 |
| CH-22 | Low | White's clock runs from game creation (before anyone has seen the board); first-move time is charged | CODE | ChessEngine.ts:66-67, 96 |
| CH-23 | Low | Dead/unfinished features: `spectators` never populated, `allowSpectators` unenforced, Solo Practice mode unreachable (`setIsPracticeMode` never called) | CODE | ChessEngine.ts:65; page.tsx:107 |

### Details

#### CH-1 Critical - draw_response accept=true freezes the game
`handleChessDrawResponse` calls `ChessEngine.respondDraw`, which returns the state unchanged if there is no offer or the responder is the offerer. The manager then ignores that and, because `accept` is true, calls `stopChessClock`, sets the room to FINISHED in the DB and broadcasts `chess:game_over` with the unchanged (still ACTIVE) state. From then on `handleChessMove` returns at `room.status !== 'PLAYING'` so every move is silently dropped; the clock is dead; the UI shows an active board nobody can move.
Reproduce: (a) normal UI: player A clicks Draw; `chess:draw_offered` is broadcast to everyone including A (no exclude), `page.tsx:815` renders the modal with no `fromUserId !== me` filter, A clicks "Accept Draw". (b) Any socket in the room sends `{"type":"chess:draw_response","payload":{"accept":true}}` at any time with no offer pending.
Why: one message (or one misclick) permanently kills a live game. Fix: have `respondDraw` return a success flag and only stop the clock/finish when it actually changed status; verify sender is a player; hide the modal for the offerer.

#### CH-2 High - no membership/colour check on resign, draw, takeback
Any authenticated user who knows the room code can open `/ws/games/:code` (index.ts) and `registerClient` does not restrict non-players; `handleClientMessage` has no player check. `ChessEngine.resign(state,'spectator')` sets `isWhite=false`, so Black is resigned: VERIFIED -> `status RESIGNED, winner "W"`. `offerDraw('spectator')` then White accepting -> VERIFIED DRAW. Same for takeback requests/responses (`respondTakeback` only checks `!== requester`).
Fix: in each handler reject if `userId` is not `whitePlayer.userId` or `blackPlayer.userId`.

#### CH-3 High - clock deducted twice
Ticker (`GameRoomManager.ts:1745`) does `timeRemainingMs -= 1000` each second on the live state but never touches `lastMoveTimestamp`; `makeMove` then subtracts `now - lastMoveTimestamp` again. VERIFIED: 3 ticks + move after 3 s -> 54000 left instead of 57000 (so a player thinking N s loses 2N s; flag falls at half the real time; clocks shown also jump down when the move is made). Fix: use a single source: on tick compute from `lastMoveTimestamp` without mutating, or update `lastMoveTimestamp` on each tick.

#### CH-4 High - takeback does not change the board
`respondTakeback` builds `new Chess(state.fen)` (no history) so `chess.undo()` returns null and the FEN is not rewound, but `moves`, `historySan`, captured lists are popped. VERIFIED: after 1.e4 e5 2.Nf3, takeback leaves FEN `...4P3/5N2... b KQkq - 1 2`, `moves.length` 2, `turn` b. Move history, captured pieces and real position now disagree, `lastMove` points to the wrong move, and `Review` replays wrong. Also clock `lastMoveTimestamp` isn't reset so the pause is charged to the next mover. Fix: rebuild position by replaying `moves` (or keep prior `fenAfter`) and reset `lastMoveTimestamp`.

#### CH-5 High - leaving after game over overwrites the result
`handleClientLeave` and the 5-second disconnect timer fire whenever `room.status==='PLAYING'||'READY'||room.gameState` (always truthy after a game) and exactly one other player remains. For chess they set `status='ABANDONED'`, `winnerUserId=<remaining player>`, reason "Opponent Left" and write to DB, even if the game ended by checkmate/resign/draw. Typical flow: winner clicks "Leave Table" after checkmate -> loser is recorded as winner. Fix: skip forfeit handling when `gameState.status` is already terminal / `room.status==='FINISHED'`.

#### CH-6 High - threefold repetition never triggers
`makeMove` re-instantiates `new Chess(state.fen)` every move; chess.js repetition needs move history. VERIFIED: 12 plies of Nf3/Nf6/Ng1/Ng8 shuffling (position repeated 3+ times) stays ACTIVE. Fix: construct from replayed moves (or count FEN prefixes in `state.moves[].fenAfter` yourself).

#### CH-7 Medium - illegal moves burn the clock
`activePlayer.timeRemainingMs` is reduced before validation and `lastMoveTimestamp` is not advanced on failure. VERIFIED: start 60000, 5 s elapsed, illegal e2e5 -> 55000, repeat -> 50000. A client can also be made to flag by spamming bad moves / a hostile client can only hurt itself, but ordinary mis-submits and the `chess:move_rejected` path penalise honest players. Fix: compute elapsed in a local variable and commit only on success.

#### CH-8 Medium - stale offers resolved after game end
`drawOfferFrom`/`takebackRequestFrom` are not cleared on moves or on game end, and `respondDraw`/`respondTakeback` do not check status. VERIFIED: White offers draw, Black mates, Black "accepts" -> status DRAW while `winnerUserId` still Black. Takeback after mate -> status CHECK with moves popped but FEN still mated position (zombie state while room is FINISHED). Fix: require ACTIVE/CHECK in both responders, clear offers on move and game end.

#### CH-9 Medium - restart + unvalidated config
`handleChessStart` only checks host and >=2 players: the host can restart a game in progress (room set back to PLAYING, new state) at will. `config` from the message is passed straight in with no schema. VERIFIED via engine: `baseTimeMs:-5` -> instant TIMEOUT on first move; `'abc'` -> clock NaN (never flags, serialises as null); `1e15` effectively infinite; `incrementMs:-1e9` -> negative clock. `chess:config_update` spreads arbitrary keys into the live `gameState.config` mid-game too. Fix: whitelist/clamp numeric fields (or look up by `presetId`), refuse start when status is PLAYING.

#### CH-10 Medium - rematch votes from anyone, any time
`handleRematch` does not check the voter is a player nor that the game is over; it just needs `votes.size >= room.players.length (2)`. An outsider + one player (or any two sockets) restarts a live game via `startGame`. Fix: only count players and require terminal status.

#### CH-11 Medium - lobby time-control buttons dead
`(CHESS_TIME_PRESETS as any)[preset.id]` indexes an array with `'rapid-10-5'` etc. -> `undefined` -> `return` before any state/WS update. The only configurable thing in the lobby never works (the room also auto-starts as soon as seat 2 joins, so config can only be set while alone). Fix: `CHESS_TIME_PRESETS.find(p=>p.id===preset.id)`.

#### CH-12 Medium - spectator UI
`myPlayerInfo` falls back to `gameState.whitePlayer` for a user in neither seat, so `playerColor='w'`, `isMyTurn` true on White's turn, board interactive, resign/draw buttons enabled; with CH-2 the spectator's resign click ends the game. Fix: compute `isSpectator` and disable all controls.

#### CH-13 Medium - no clock after server restart
Timers live in `chessTimers` only; `registerClient` restarts the doodle timer for PLAYING rooms but not chess. After a restart a persisted PLAYING game has no ticker: nobody can flag by inaction and no `clock_tick` is sent (clock only corrected when a move is made). Fix: restart `startChessClock` in `registerClient` when `gameType==='chess' && status==='PLAYING' && !chessTimers.has(id)`.

#### CH-14 Medium - disconnect policy
Clock keeps running during disconnect; after 5 s the player forfeits (ABANDONED) with no chance to return. A page refresh on slow reconnect or mobile network switch loses the game. Fix: longer grace for chess (e.g. clock-based) and only forfeit on flag.

#### CH-15 Low - timeout/insufficient material rule
`hasInsufficientMaterialForMate` checks only the winner's pieces. VERIFIED draws returned for: winner K+N vs flagger K+Q; K+2N vs K+R; K+B vs K+P. Per FIDE 6.9 these are wins on time since the flagger can be mated by some legal sequence (helpmate). Also K+2N alone is treated as insufficient though helpmate exists. Fix: draw only if winner has bare K, or K+minor and flagger has only a bare king.

#### CH-16 Low - no colour swap on rematch
`startGame` assigns `players[0]` to White every time, so the host/first seat is always White. Fix: swap order (or store a toggle) on rematch.

#### CH-17 Low - last-move highlight state
Board uses `lastChessMove` (set only from `chess:move_accepted`) rather than `gameState.lastMove`. After refresh/reconnect (`game:sync`) it is null; after an accepted takeback it still highlights the undone move; `game:started` (rematch) does not reset it, so the new game's initial board shows the old highlight. Fix: derive from `gameState.lastMove`.

#### CH-18 Low - mobile bars
`timeRemainingMs || 600000` turns 0 into "10:00" when a flag falls. The bottom bar text is hard-coded "(You)" even after the user presses Flip (then it labels the opponent as you).

#### CH-19 Low - pending request UI/state
`drawOfferFrom`/`takebackRequestFrom` exist in synced state but the UI relies only on transient WS events, so a reconnecting player never sees a pending offer (server still holds it, see CH-8). Modals are not cleared on game_over and a draw offer survives subsequent moves; offers can be spammed without limit.

#### CH-20 Low - clock rendering
Only 1 s server ticks update the display; `ChessClock` tenths (`<10 s`) are therefore always `.0`, the display can lag up to 1 s, and there is no client-side interpolation or correction.

#### CH-21 Low - minor data drops
Auto-start (`startGame`) passes players without `avatarUrl`, so the in-game cards lose avatars (handleChessStart path keeps them). Info drawer's time control/increment come from the local `chessConfig` state, which for a joiner is the default and not the room's actual config.

#### CH-22 Low - first-move time
`lastMoveTimestamp = startedAt` so White's clock runs while players are still loading; combine with CH-3 and White can lose several seconds before the board renders.

#### CH-23 Low - dead features
`spectators: []` is never filled, `allowSpectators` is never checked, and Solo Practice mode (page.tsx:107-319) cannot be entered since `setIsPracticeMode` is never called.

### Checked and found correct
- Legal move generation incl. pins, check evasion, castling rights/through-check/out-of-check, en passant (incl. horizontal pin position), promotion (all 4 pieces, capture promotion) - chess.js; perft 20/400/8902/197281 and Kiwipete 48/2039/97862 match.
- Turn enforcement in `makeMove` (wrong user rejected), non-string/oversized from/to rejected without crash (caught), invalid promotion on a real promotion rejected, default auto-queen.
- Checkmate, stalemate, insufficient material, 50-move auto-draw (checkmate on the 100th half-move correctly wins) detection; check-square calculation; increment added after successful move; captured-piece list; SAN history.
- Flag detected on the mover's own move attempt and by ticker; `chess:game_over` broadcast and ticker stop on terminal states; ticker stop on leave.
- Board rendering: orientation/flip, light/dark square parity, legal-move dots and capture rings, check/mated indicator, promotion dialog flow, selection reset after move.
- Move history grouping, PGN copy (result suffix), review stepper (replays via chess.js).


---

## Doodle Duel audit

Reviewed DoodleDuelEngine.ts, packages/common/src/doodle.ts, all doodle handlers in GameRoomManager.ts (timer, bot, select_role/start/choose_word/stroke/guess/hint/config, rematch, leave/forfeit, reconnect sync), the REST room endpoints in index.ts, DrawingCanvas, GuessPanel, SecretWordPicker, DoodleVictory, the play page and the doodle parts of useGameRoom.ts. Engine and GameRoomManager were driven with tsx scripts (in-memory SQLite, fake sockets; scripts t1..t6 in this directory). Nothing in the repo was modified.

### Findings

| ID | Severity | Title | Evidence | Location |
|---|---|---|---|---|
| DD-1 | Critical | Any room client (guesser or spectator) can make themselves drawer mid-round and receive the secret word via `doodle:select_role` | VERIFIED | GameRoomManager.ts:1405-1461, 1368-1400 |
| DD-2 | Critical | Secret word leaks to the guesser through `game:player_reconnected`, `game:player_left`, and `GET /api/games/rooms/:code` | VERIFIED | GameRoomManager.ts:2111-2115, 2500-2620; index.ts:1509-1521 |
| DD-3 | High | Drawer can "guess" the word: wins the round, scores 100+50 for themselves | VERIFIED | GameRoomManager.ts:1644-1688; DoodleDuelEngine.ts:345-420 |
| DD-4 | High | `doodle:choose_word` has no phase check and no validation against offered choices (restart drawing at any time, resurrect finished game, pick any word) | VERIFIED | GameRoomManager.ts:1555-1573 |
| DD-5 | High | Stroke/undo/clear/live_draw: no phase check, no shape/size/count validation; unbounded state growth re-broadcast and re-persisted every second | VERIFIED | GameRoomManager.ts:1586-1642, 1302-1320 |
| DD-6 | High | Configured `rounds` ignored when a gameState already exists; rematch resets config to defaults; `doodleConfig` is never persisted | VERIFIED | GameRoomManager.ts:1495-1500, 1702-1722, 384; DoodleDuelEngine.ts:241 |
| DD-7 | High | Rematch can never complete in a bot game; spectators' votes count; rematch accepted mid-game | VERIFIED (bot) / CODE | GameRoomManager.ts:529-580 |
| DD-8 | Medium | Guess text unbounded / non-string crashes; whitespace guesses stored; no per-round guess cap | VERIFIED | GameRoomManager.ts:1644; Engine:360-371 |
| DD-9 | Medium | Host config (`doodle:config_update`, `doodle:start` payload) not validated; can change config mid-game, strings/NaN/huge values | VERIFIED | GameRoomManager.ts:1495-1500, 1702-1722 |
| DD-10 | Medium | Host can re-send `doodle:start` at any time: restarts current round, re-rolls word, re-picks roles, keeps scores | VERIFIED | GameRoomManager.ts:1463-1553 |
| DD-11 | Medium | Hint text is never rendered in the UI; hint button costs 50 points and shows nothing; can be clicked repeatedly | CODE | play/page.tsx:929-940, 970-972; GuessPanel.tsx:335 |
| DD-12 | Medium | Hint availability: never available for guessTime <= 30; UI threshold (35s left) does not match server threshold; button shown during DRAWING | VERIFIED (guessTime 20) / CODE | Engine:437-440; play/page.tsx:929, 972 |
| DD-13 | Medium | Forfeit/leave and ties: server writes `winnerUserId` (not `finalWinnerUserId`), `finalWinnerDisplayName` never set, tie winner arbitrary; Victory screen shows score-based winner even after forfeit | VERIFIED (tie) / CODE | Engine:526-538; GameRoomManager.ts:2509-2515, 2613-2619; DoodleVictory.tsx:30-36 |
| DD-14 | Medium | 5s disconnect grace forfeits bot games and also fires after a normally finished game | CODE | GameRoomManager.ts:2571-2630 |
| DD-15 | Medium | Bot logic is hardcoded to 60s timings and a fixed squiggle unrelated to the word; bot guesser silent if config differs | CODE | GameRoomManager.ts:1326-1361 |
| DD-16 | Medium | Custom words with non-Latin characters or only punctuation can never be guessed; accented/plural guesses never match | VERIFIED | Engine:120-146 |
| DD-17 | Low | Custom words are merged into the full pool, so they appear in only ~5% of rounds; lose hint/alias on timeout auto-pick | VERIFIED | Engine:169-193, 449-467 |
| DD-18 | Low | "Hard" pool has 5 words: repeats inside a 6-round game; `usedWords` fallback silently reuses words | VERIFIED | Engine:181-183 |
| DD-19 | Low | Guess after round ended returns misleading `doodle:guess_result` (replays previous, possibly correct, guess) | CODE | GameRoomManager.ts:1644-1687 |
| DD-20 | Low | Time bonus is measured per phase: guessing in DRAWING at 59s gets 25 pts, same wall-clock in GUESSING gets 100; message "in Ns" misleading | VERIFIED | Engine:373-376 |
| DD-21 | Low | Live-draw ghost stroke persists on guesser canvas (drawer pointer-up after phase change is swallowed; never cleared on new round/clear) | CODE | DrawingCanvas.tsx:329-338; useGameRoom.ts:851-855 |
| DD-22 | Low | DrawingCanvas re-allocates canvas and re-creates ResizeObserver on every state_sync (every second) because effect depends on `strokes` | CODE | DrawingCanvas.tsx:98-133 |
| DD-23 | Low | Live draw sends full point array every 35ms (quadratic payload); relayed with no validation | CODE | DrawingCanvas.tsx:312-325; GameRoomManager.ts:1586-1596 |
| DD-24 | Low | Round timer progress ring uses drawTime for ROUND_INTRO/WORD_CHOICE/ROUND_RESULT phases | CODE | play/page.tsx:499-507 |
| DD-25 | Low | Both players choosing "drawer" silently picks player 2; spectators treated as guessers in UI; server errors swallowed (no feedback, e.g. non-host Start) | CODE | GameRoomManager.ts:1503-1520; play/page.tsx:292-294; 2143-2147 |

### Details

#### DD-1 Role swap mid-round leaks the secret (Critical, VERIFIED)
`handleDoodleSelectRole` has no host check, no phase check and no player-membership check. Any socket in the room (including a non-player who opened `/ws/games/CODE`) can send `{type:'doodle:select_role', payload:{drawerUserId:'<own id>'}}`. It overwrites `gameState.drawerUserId`; `broadcastDoodleState` then sends the unsanitised state (with `secretWord`) to whoever is now `drawerUserId`.
Repro (t1.ts): start game, drawer picks word, `handleDoodleSelectRole(room, B, B)` while B is the guesser; next state_sync to B contains `secretWord`. Same for spectator C. The role also stays swapped, so the cheater can then draw/finish the round.
Fix: only allow select_role in LOBBY/ROLE_SELECTION, only by the host (or by the player for themselves), validate the id belongs to room.players.

#### DD-2 Secret leaked through side channels (Critical, VERIFIED)
Several paths ship the raw `room.gameState`: `game:player_reconnected` (broadcast to everyone whenever any player's socket registers, line ~2111 `room: currentRoom`), `game:player_left` (`gameState: room.gameState`, ~2527 and ~2612), and the REST endpoint `GET /api/games/rooms/:code` (and join response) which return `room` with full gameState to any authenticated user who knows the code. t1.ts: after drawer reconnect the guesser's log contains `game:player_reconnected` with `room.gameState.secretWord`; `getRoomByCode(...).gameState.secretWord` returns the word. The guesser can simply call the REST endpoint.
Fix: one `redactRoomForUser(room, userId)` helper used by every outgoing room/gameState (REST, broadcast, sync); strip `secretWord`/`wordChoices` unless user is the drawer or phase is ROUND_RESULT/FINISHED.

#### DD-3 Drawer can guess own word (High, VERIFIED)
`handleDoodleGuess` only checks the sender is a player; `submitGuess` never checks `userId !== drawerUserId` or that the sender is the guesser. t2.ts: drawer submits the word, round ends, scores `{uA:150}` (100 as guesser + 50 as drawer bonus). Any drawer can farm points every round.
Fix: reject unless `userId === state.guesserUserId`.

#### DD-4 choose_word unchecked (High, VERIFIED)
No phase check and no membership check against `state.wordChoices`. t1: drawer sends `ZZZ-not-offered` and it becomes the secret. t2: during ROUND_RESULT, `choose_word` flips the state back to DRAWING with a new word and empty strokes/guesses (same path would revive a FINISHED game while the timer is stopped, and during DRAWING it resets the clock and canvas indefinitely, stalling the round). `undefined` payload throws TypeError (swallowed, no feedback).
Fix: require `phase === 'WORD_CHOICE'`, string payload, and word in the offered list (custom word only if explicitly allowed).

#### DD-5 Drawing relay not validated (High, VERIFIED)
`stroke`, `undo`, `clear`, `live_draw` only check `userId === drawerUserId`. Accepted in any phase (GUESSING, ROUND_RESULT, FINISHED). Stroke content is stored as-is: t2 stored `{points:'xxxxxxxxxx', color:'url(javascript:)', size:1e9}` and `null` (a `null` stroke makes `strokes.map(s=>s.points)` style code throw and the Canvas `for (const stroke of ...) stroke.points` crash with TypeError on every client). 10 strokes of 20 000 points gave a 4.38 MB game state; because `tickDoodleTimer` calls `db.updateGameRoomState` (SQLite write of the whole JSON) and `broadcastDoodleState` (send of the whole state to every client) every second, one drawer can saturate bandwidth/DB with the 120 msg/s guard. Also `size` huge or `points` coordinates NaN draw giant lines for the guesser.
Fix: validate id/colour regex/size 1..40/points array length <=2000 and coordinates 0..1 numbers, cap strokes count and total points, only accept in DRAWING, and stop shipping `strokes`/`guesses` in the every-second tick (send strokes only on change/reconnect).

#### DD-6 Config lost / totalRounds wrong (High, VERIFIED)
(a) `(room as any).doodleConfig = updated` is set on a throw-away object from `db.getGameRoomById` (which re-reads SQLite each call), so it is never persisted (t5: `persisted doodleConfig? undefined`). (b) If a gameState already exists (any `select_role` creates one with default config), `handleDoodleStart` only merges `config` into `gameState.config`; `totalRounds` stays 6. t5: host sets rounds=2, start -> `config.rounds 2` but `totalRounds 6` and the game plays 6 rounds (UI shows `dState.totalRounds`). (c) Rematch calls `startGame`, which uses `room.doodleConfig || DEFAULT` -> t5: rematch after a 2-round/30s game gave `rounds 6, drawTime 60`.
Fix: persist config in the gameState/DB, and recompute `totalRounds` from `config.rounds` in `handleDoodleStart`; on rematch reuse `oldState.config`.

#### DD-7 Rematch (High, VERIFIED/CODE)
`handleRematch` requires `votes.size >= room.players.length`; in a bot game `players` includes `bot_duelist`, who never votes. t5: human votes, `totalNeeded 2, allVoted false`, no restart ever (the Victory screen shows "waiting for opponent" forever). Also any socket in the room (spectator) can add a vote, so one player plus a spectator restarts the match, and there is no check that the game is FINISHED, so two votes mid-game restart it.
Fix: auto-vote bots, count only players, require phase FINISHED.

#### DD-8 Guess payload (Medium, VERIFIED)
Only the UI limits guesses (maxLength 40 on one input). Server stores `guessText.trim()` verbatim: t3 stored a 400 000-char guess (state became 801 KB and is re-broadcast every second); whitespace-only guesses are stored and appear as wrong guesses; `undefined` throws. No cap on number of guesses.
Fix: require string, trim, reject empty, slice to ~60 chars, cap guesses per round.

#### DD-9 Config validation (Medium, VERIFIED)
`config_update` and `start.config` are spread into config unvalidated: t3 stored `drawTime:'abc'` (client shows "abc", NaN becomes null after persistence and the phase ends next tick), `customWords:'str'` (later `customWords.map` throws in `getWordChoices`, halting the game at WORD_CHOICE every tick), huge `drawTime` (1e9 = never-ending round), `rounds` odd/negative. `config_update` mid-game also swaps `gameState.config` immediately (change timers while running). Also persisted `hintsEnabled` is ignored by the engine.
Fix: whitelist and clamp (drawTime/guessTime in {30,45,60,90}, rounds even 2..10, customWords array of <=20 strings <=40 chars), only allow in LOBBY.

#### DD-10 Host restart mid-game (Medium, VERIFIED)
`handleDoodleStart` has no phase guard. t6: with round 4 and scores `{uA:300}`, host's second `doodle:start` returned `phase ROUND_INTRO round 4` (current round replayed, strokes/word discarded, role selection recalculated). Host can reroll a bad word or dodge a lost round; also used after FINISHED to restart without opponent agreeing.
Fix: only allow in LOBBY.

#### DD-11 Hint text never shown (Medium, CODE)
Server stores `hint` and sends it to the guesser once `hintUsed`, but nothing in `apps/web/src/app/games/doodle-duel` or `components/games/doodle` reads `gameState.hint`/`hintUsed` (grep confirms). The pre-room page promises "letter hints". Pressing the button deducts up to 50 points from that round's score and displays nothing; there is no disabled state after first use. Also for custom/typed words the hint is the placeholder "Custom user word"/"Word to draw".
Fix: render `hint` (and/or reveal letters in `maskedWord`) in GuessPanel, disable button once `hintUsed`.

#### DD-12 Hint availability (Medium, VERIFIED/CODE)
Server: `hintAvailable` only in GUESSING when `timeRemaining <= guessTime - 30`. t4: guessTime 20 -> never; guessTime 30 -> only at 0 (round already over). UI offers hint when `timeLeft <= 35` in any phase (so during DRAWING's last 35s and the first 5s window of GUESSING it is visible but server ignores the request silently); with guessTime 90 the real window is 60s but the UI hides the button until 35.
Fix: send `hintAvailable` in state and gate the button on it.

#### DD-13 Winner bookkeeping (Medium, VERIFIED/CODE)
`advanceToNextRound` picks the first user with the max score (t4: 0-0 tie -> `finalWinnerUserId 'a'`), and `finalWinnerDisplayName` is never set. Forfeit paths set `winnerUserId`/`winnerDisplayName`, not the doodle fields, and do not touch scores, so `DoodleVictory` (computes winner from scores) can show the player who left as winner ("Victory!") or "Draw" while the toast says "Opponent forfeited". Server never records who actually won.
Fix: set `finalWinnerUserId` (null for tie) and display name in engine and in forfeit; use it in Victory.

#### DD-14 Grace-timer forfeits (Medium, CODE)
After 5s of disconnect, if exactly one other player remains the room is FINISHED with them as winner. In a bot game the "remaining player" is the bot, so a human with a network blip >5s (mobile background, tab switch) loses the match. The branch also runs when the game was already FINISHED (gameState exists): the winner who closes the tab on the victory screen triggers a `game:player_left` forfeit message and rewrites the state. The timer is also not paused: between disconnect and forfeit it ticks on.
Fix: longer grace (30-60s), skip when status already FINISHED, don't forfeit bot games (pause instead).

#### DD-15 Bot (Medium, CODE)
Bot-as-drawer draws the same red zigzag at `timeRemaining === 55/48`, then finishes at 40, regardless of word (a human can only guess blindly; hint text is the only help). If `drawTime` is not 60 the `===55/48/40` ticks never occur, drawing stays empty for the whole phase. Bot-as-guesser acts only at 45/28/12 and its last guess requires `strokes.length > 0`; with guessTime 30 it only guesses at 28/12 and with an empty canvas never. Bot always eventually "knows" the word (guesses `state.secretWord`), so it always wins at 12s if there is any stroke. Also `handleDoodleChooseWord` for bot is gated by `timeRemaining <= 13` of 30 so a human guesser waits ~17s each bot-draw round.
Fix: schedule relative to configured times, draw something word-dependent (or simply skip drawing rounds), and make guess success probabilistic.

#### DD-16 Guess matching limits (Medium, VERIFIED)
`normalize` removes everything not `\w`, so non-ASCII text vanishes: t2 `checkGuess('日本','日本')` is false, `'!!!'` target is unguessable (normalised target empty), `élephant` and `elephants` do not match `Elephant`. Custom words from users in Hindi/Arabic/emoji cannot be won at all (round just times out).
Fix: NFKD-normalise and strip combining marks, use `\p{L}\p{N}` Unicode classes, reject custom words whose normalised form is empty; optionally accept simple plurals.

#### DD-17 Custom words (Low, VERIFIED)
With one custom word plus the 68 built-ins and `useCustomWords: true`, a custom word appeared in only 46/1000 word-choice screens. When the pick timer expires the auto-pick re-looks the word up in `DOODLE_WORDS` only, so a custom choice becomes "Objects/Spacecraft" metadata. No aliases are ever populated (`aliases` field unused).

#### DD-18 Hard pool (Low, VERIFIED)
Only 5 hard words; `getWordChoices` falls back to the full pool (including already used words) when fewer than 3 unused remain. t2: 6 hard rounds produced 2 duplicates.

#### DD-19 Guess after round end (Low, CODE)
`submitGuess` returns `isCorrect:false` for ROUND_RESULT/FINISHED but the handler still broadcasts `doodle:guess_result` built from `state.guesses[last]` (the previous guess, maybe the correct one with `isCorrect:true`), so the client replays the success chime and `lastDoodleGuess`. The guesser's late correct answer is reported as wrong.
Fix: return early in the handler when phase is not DRAWING/GUESSING.

#### DD-20 Scoring (Low, VERIFIED)
`timeTaken = phaseTotal - timeRemaining` resets when GUESSING starts: t4 a correct guess 1s into GUESSING scores 100 even though the drawing took 60s; a correct guess at 59s of DRAWING scores 25. Status text says "in 1s". Drawer bonus is a flat 50 and drawer gets nothing for failed rounds (design decision, but with DD-3 it is exploitable). Status strings hardcode "(60s)".

#### DD-21 Ghost live stroke (Low, CODE)
`handlePointerUp` returns early when `canDraw` becomes false (phase switched), so `onLiveDraw(null)` is never sent; the last relayed `liveStroke` stays in the guesser's `liveDoodleStroke` and is drawn on top of the canvas until a `stroke_added` arrives. It is also not cleared on round change, canvas_cleared, or drawer disconnect. `isDrawingRef` stays true after such an interruption.

#### DD-22 Canvas realloc each second (Low, CODE)
The resize effect depends on `strokes`; each `doodle:state_sync` creates a new `strokes` array, so the canvas width/height are reassigned (clears and reallocates the bitmap), the ResizeObserver is torn down and re-created, and everything is redrawn once per second for both players (flicker/jank on mobile, and any in-progress freehand segment is re-rendered from currentPointsRef only).

#### DD-23 Live payload size (Low, CODE)
`onLiveDraw` sends the complete `points` array every 35 ms; for a long stroke that is quadratic traffic. Server relays any JSON (`liveStroke`) to all clients unvalidated, so a malformed value (e.g. string) reaches `liveDrawingStroke.points?.length` in clients (only guarded by optional chaining).

#### DD-24 Timer ring (Low, CODE)
`DoodleGameTimer totalTime` is `guessTime` for GUESSING else `drawTime`; during ROUND_INTRO (3s), ROUND_RESULT (5s) the ring starts nearly empty/clamped and WORD_CHOICE (30s) is drawn against drawTime. `SecretWordPicker` defaults `totalTime=15` while the page passes 30 (ok), but the default is wrong for other callers.

#### DD-25 Misc (Low, CODE)
Both players selecting `drawer` -> `handleDoodleStart` condition `roles[p2]==='drawer'` makes player 2 draw regardless of host intent. `isGuesser` in the page is true for every non-drawer (spectators see guess boxes; the server rejects them silently). `socket.on('message')` swallows thrown errors (host-only start, validation) with a server log only, so UI buttons do nothing without feedback.

### Checked and found correct
- Word sanitising for the guesser in `doodle:state_sync` for normal broadcasts (`sanitizeStateForGuesser` strips `secretWord`, `wordChoices` and un-requested `hint`); `maskedWord` letters only.
- Normal guess matching: case, surrounding/inner whitespace, hyphens/punctuation (`ice-cream`, `ELEPHANT!!`, `Pac-Man`/`pacman`) match; whitespace-only guess never counts as correct.
- Engine rejects guesses outside DRAWING/GUESSING, so no scoring after round end.
- Timer: single interval per room, cleared on finish/forfeit/restart; restarted on reconnect if missing; auto-pick of first word at pick timeout works; round and finish transitions complete (t4: 2-round game with no guesses ends FINISHED after 316 ticks).
- Role swap each round (`advanceToNextRound`) and display names swap correctly; round counter and FINISHED transition correct.
- Hint penalty arithmetic (`max(10, base-50)`), time-bucket scoring table, no negative scores.
- No duplicate words in the 68-word list; no hint text contains its own word; no non-ASCII built-in words; icons all in a small known set.
- Reconnecting guesser receives strokes from state (no secret) through `game:sync`; DPR scaling and normalised coordinates in the canvas are consistent; pointer capture and `touch-action: none` set.
- Drawer-only enforcement on stroke/undo/clear/done_drawing/live_draw (the enforcement itself is correct, but see DD-1 for bypass).
- Socket guard: 512KB payload cap and 120 msg/s rate limit exist at the WebSocket level.


---

## Shared game room layer audit (read-only)

### 1. Summary
Reviewed GameRoomManager.ts (all 2,692 lines), GameDefinitions.ts, socketGuard.ts, the `/ws/games/:code` route and `/api/games/*` endpoints in index.ts, the SQLite game-room functions in database.ts, useGameRoom.ts, GameJoinLobby, GameLounge, GameFriendSelectorDrawer, ReactionGlyph, the games hub page and the game/partner functions in api.ts. Findings marked VERIFIED were reproduced with real sockets against the in-process server (scratch harness `gr.ts` in this directory, run through a throwaway mongod; scenario ids S1..S17 below). Nothing inside the repo was touched.

Note on error handling: `handleClientMessage` throws are caught and only `console.warn`ed, so users never see a rule/authorization error (see GR-24).

### 2. Findings table

| ID | Severity | Title | Evidence | Location |
|---|---|---|---|---|
| GR-1 | High | Leaving or disconnecting after a game ends rewrites the winner (the loser "wins") | VERIFIED (S1, S1b) | GameRoomManager.ts:2474, 2583 |
| GR-2 | High | A replaced/stale socket of the same user schedules a forfeit; the connected player loses after 5 s | VERIFIED (S2) | GameRoomManager.ts:2013-2021, 2560-2572 |
| GR-3 | High | No membership check: any logged-in user with a room code can join as spectator and act (force rematch, resign chess for black) | VERIFIED (S4, S11) | GameRoomManager.ts:1995-2044, 2157, 529; index.ts:2087-2119 |
| GR-4 | High | Private data sent to everyone: doodle secret word, Bingo Duel boards, REST room GET | VERIFIED (S5a, S6) | GameRoomManager.ts:2118-2122, 1450-1459, 417; index.ts:1509 |
| GR-5 | High | `doodle:select_role` lets any client become the drawer mid-round (sees the secret word) | VERIFIED (S5b) | GameRoomManager.ts:1405-1461, 2242 |
| GR-6 | High | Host can restart a running/finished game any time with arbitrary unvalidated config (chess `baseTimeMs:1` ends it instantly) | VERIFIED (S10) | GameRoomManager.ts:823-837, 1463, 1790-1823, 1975 |
| GR-7 | High | Host is never transferred; abandoned empty rooms stay matchable and host-only games are dead | VERIFIED (S7) | GameRoomManager.ts:2575-2582; database.ts:2212 |
| GR-8 | High | Tambola rooms for 5-20 players cannot be created (REST 400, WS auto-create TypeError) | VERIFIED (S8) | GameRoomManager.ts:205; GameDefinitions.ts:85-92; index.ts:2095; gameInvite.ts:21 |
| GR-9 | High | One `game:reaction` with a non-string emoji is relayed verbatim and crashes every client's render | CODE (server relay VERIFIED S13b) | GameRoomManager.ts:2382-2395; ReactionGlyph.tsx:9 |
| GR-10 | High | Host lobby settings (chess time control, bingo rounds/pattern, tambola) are silently discarded on auto-start | VERIFIED (S17) | GameRoomManager.ts:1253-1280, 1975-1990, 334-337, 366-381 |
| GR-11 | Medium | Both players disconnect: both forfeit timers fire, the last one overwrites, an absent player is declared winner | VERIFIED (S3) | GameRoomManager.ts:2572-2649 |
| GR-12 | Medium | REST join creates ghost players who count as connected and auto-start the game | VERIFIED (S9) | GameRoomManager.ts:268-338; database.ts:2313 |
| GR-13 | Medium | Per-user maps (`userClients`, `disconnectGraceTimers`) ignore rooms: joining another room cancels the forfeit in the first | VERIFIED (S12) | GameRoomManager.ts:44-46, 2001-2005, 2568 |
| GR-14 | Medium | No turn/inactivity timer and no leave handling for 3-4 player rooms; a gone player stalls the game forever | CODE | GameRoomManager.ts:2475, 2584 |
| GR-15 | Medium | 5 s reconnect grace is shorter than the client's own retry path (2 s retry + ticket fetch); refresh/network blips forfeit | CODE | GameRoomManager.ts:2572-2649; useGameRoom.ts:356-363 |
| GR-16 | Medium | Rematch voting: counts leavers, accepts votes mid-game, counts spectators, never swaps sides | VERIFIED (S13a, S15, S4) | GameRoomManager.ts:529-581, 2529 |
| GR-17 | Medium | Doodle strokes/live-draw are unvalidated and unbounded; full state is re-sent and re-persisted every second | VERIFIED (S5c) | GameRoomManager.ts:1288, 1368-1403, 1586-1612 |
| GR-18 | Medium | Client `game:player_left` always shows "You are the winner" even in lobbies, 3-4 player games or finished games | CODE | useGameRoom.ts:428-503 |
| GR-19 | Medium | `useGameRoom` does not reset state on roomCode change and its stale `onclose` reconnects to the OLD room | CODE | useGameRoom.ts:282-371, 1113-1126 |
| GR-20 | Medium | Any `error:notification` (even RATE_LIMITED) permanently disables auto-reconnect; reconnect is fixed 2 s with no backoff/cap | CODE | useGameRoom.ts:1052-1065, 341-363 |
| GR-21 | Medium | Partner link needs no consent from the other user (anyone with a partner code) | VERIFIED (S16a,b) | index.ts:941-982; mongoDatabase.ts:1151-1180 |
| GR-22 | Medium | Partner ping / invite / play have no rate limit; invites do not validate the room or game type | VERIFIED (S16c,d) | index.ts:1307, 1542, 1588 |
| GR-23 | Medium | "Notify Me" / "Stay Updated" show "Subscribed!" but nothing is stored or sent | CODE | games/page.tsx:236-243, 525-533, 690-697 |
| GR-24 | Medium | Rule/authorization errors are swallowed server-side; the client gets no feedback (host-only start, not your turn) | VERIFIED (S7c) | GameRoomManager.ts:2141-2150 |
| GR-25 | Medium | Hub card click hijacks into a friend's room (even PLAYING or full) and blocks starting your own game | CODE | games/page.tsx:517-533 |
| GR-26 | Medium | GameLounge shows Chess and Pictionary/Doodle as "Coming Soon" and has no route for them | CODE | GameLounge.tsx:143-153, 237-276 |
| GR-27 | Medium | Server restart loses chess clocks / tambola auto-call timers; rooms are never purged | CODE | GameRoomManager.ts:2124-2127; database.ts:503 |
| GR-28 | Low | Chess clock decrements a fixed 1000 ms per interval tick (drift) instead of wall/monotonic time | CODE | GameRoomManager.ts:1730-1746 |
| GR-29 | Low | Hub copy: "No bots, ever" and "12K+ friends are playing" vs doodle bot injection and hardcoded number | CODE | games/page.tsx:341, 360; GameRoomManager.ts:1471-1480 |
| GR-30 | Low | Memory: `roomChatHistory`/`roomThemes` never cleaned; 4000-char chat x 50; dead duplicate `game:nudge` case | CODE | GameRoomManager.ts:49, 2330, 2438 |
| GR-31 | Low | `getPartnerPings`/`markPartnerPingsRead` call endpoints that do not exist (unauthenticated fetch, 404 swallowed) | CODE | api.ts:536-557 |
| GR-32 | Low | Game type resolved by substring; unknown types silently become Ludo | CODE | index.ts:28-37; GameRoomManager.ts:148-164 |

### 3. Details

#### GR-1 High - winner rewritten after the game is over (VERIFIED S1, S1b)
`handleClientLeave` (game:leave) and the 5 s disconnect timer test `room.status === 'PLAYING' || 'READY' || room.gameState`. A finished room still has `gameState`, so the branch runs, sets status FINISHED again and overwrites `winnerUserId`/`statusMessage` with the remaining player.
Repro: Tic-Tac-Toe, A wins (status FINISHED, winner A). A sends `{type:'game:leave'}` (or just closes the tab and waits 5 s). Room state now has `winnerUserId = B`, message "a1 left the game. You are the winner!", and `game:player_left` carries `isWinner:true, winnerUserId:B`. Same code path for all 6 engines.
Why it matters: the normal "win, then leave" path turns the win into a loss for the loser's screen and the persisted winner_seat.
Fix: guard both branches with `room.status === 'PLAYING'` (and a not-already-finished check on the engine state) before applying a forfeit.

#### GR-2 High - stale socket close triggers a forfeit of a connected player (VERIFIED S2)
`registerClient` closes the user's older socket in the room and deletes it from the set, but the older socket's `close` event still runs `handleClientDisconnection`, which does `userClients.delete(userId)`, `setGamePlayerConnected(false)`, broadcasts `game:player_disconnected` and starts a 5 s forfeit timer (the grace timer was cleared earlier by the new registration, so this creates a fresh one).
Repro: A and B playing; A opens a second socket to the same room (second tab, or reconnect before the server noticed the old socket). After 5 s: room FINISHED, winner B, `A.isConnected=false` in the DB, `isUserOnline(A)=false` while A's new socket is open. B saw `game:player_disconnected` and `game:player_left`.
Fix: in the close handler ignore clients that are no longer the registered one (`if (userClients.get(id) !== client && !set.has(client)) return`), and clear/reset timers only for the current client.

#### GR-3 High - no membership enforcement (VERIFIED S4, S11)
`/ws/games/:code` authenticates the user but never checks they are a player; `registerClient` only auto-joins in WAITING. Any user with the code (codes are shown in URLs, friend lists, active-friends, chat invites) gets `game:sync` with the full state and can send any message. Handlers that skip the `players.find` check: `handleRematch`, chess resign/offer_draw/draw_response/takeback, `handleBingoMark/SelectNumber/SetBoard/Start...`, chat, reaction, nudge, theme, doodle role.
- S4: spectator C + player A send `game:rematch`; B never votes; `votes.size(2) >= players.length(2)` so `game:rematch_agreed` and a fresh `game:started` fire for all (game restarted without B).
- S11: spectator C sends `chess:resign` in a running chess game; `ChessEngine.resign` treats a non-white user as black: "b15 resigned. a14 wins!", room FINISHED.
A spectator can likewise set `drawOfferFrom` (chess) and pollute `playerMarks` (bingo).
Fix: in `registerClient`, mark non-members as spectators (read-only, sanitized state) and reject every game action unless `room.players.some(p => p.userId === client.userId)`; count only player ids in rematch.

#### GR-4 High - private data broadcast to opponent/spectators (VERIFIED S5a, S6)
- `game:player_reconnected` broadcasts `room: currentRoom` (including raw `gameState`) to everyone. Doodle: when the drawer reconnects mid-round the guesser receives `secretWord` ("Taco" in S5a). `doodle:role_selected` and `game:started` also carry the unsanitized state. `sanitizeStateForGuesser` is applied only in `broadcastDoodleState`/`game:sync`.
- Bingo Duel: every message includes `gameState.boards` for both users (S6a). Spectators get both boards in `game:sync` (S6b).
- `GET /api/games/rooms/:code` returns the whole room incl. `gameState` to any authenticated user (S6c: boards present, HTTP 200). `POST /rooms/:code/join` returns it to members too.
Fix: build a per-recipient `view(room, userId)` (strip `secretWord`, `wordChoices`, opponent boards/tickets) and use it for every broadcast and REST response.

#### GR-5 High - role hijack in Doodle Duel (VERIFIED S5b)
`doodle:select_role` with a user id string sets `drawerUserId` directly: no host check, no phase check, no membership check. In S5b the guesser sent his own id mid-round, became drawer, and received `doodle:role_selected` containing the secret word; he can also guess-score himself or end rounds.
Fix: accept role changes only in LOBBY/ROLE_SELECTION, only for players, and only for `userId` itself (or host).

#### GR-6 High - host restart / unvalidated config (VERIFIED S10)
`handleBingoStart`, `handleDoodleStart`, `handleChessStart` have no status check; the host can call them in PLAYING/FINISHED (loser restarts to erase the result, or kills the opponent's progress). `config` is merged straight from the client (`{...DEFAULT, ...config}`; chess uses the client object wholesale). S10: host sends `chess:start {config:{baseTimeMs:1}}` mid-game (2 moves played): moves reset to 0, white clock 1 ms, status TIMEOUT within a second, `chess:game_over` broadcast. Same for `*_config_update`, which also mutate a running game's config.
Fix: allow start only from WAITING (rematch goes through voting), and whitelist/clamp each config field per game.

#### GR-7 High - no host transfer, dead rooms (VERIFIED S7)
When the host disconnects from a WAITING room, `removePlayerFromGameRoom` runs but `hostUserId` is unchanged. S7: after 6.5 s the room has 0 players, status WAITING, host = departed A. It stays in `findOpenWaitingGameRoom` (public, WAITING, players < max), so B's matchmake returns it (`joinedExisting:true`). B sends `doodle:start` and nothing happens (host-only; no error to client, see GR-24). Same for tambola and bingo "Start"; empty rooms are never deleted (only chess/ttt/etc. auto-start hides it).
Fix: on removal reassign host to the earliest remaining player; delete or skip empty WAITING rooms in matchmaking; expire WAITING rooms.

#### GR-8 High - Tambola 5-20 players cannot be created (VERIFIED S8)
`playerOptions` lists 5..20 but `colorAssignments` only has 2,3,4, so `createGameRoom` throws `Cannot read properties of undefined (reading '0')`. REST `POST /api/games/rooms {tambola, 5}` -> HTTP 400 "Failed to create game room". The WS `create=1` path (maxPlayers 20) fails with the same TypeError and the client sees GAME_ROOM_NOT_FOUND. The chat invite (`maxPlayersFor('tambola') = 20`) hits both paths, so a chat Tambola challenge is always dead; the hub path caps at 2 (`/partner/play`). `joinRoom` has the same `colors[assignedSeat]` problem for seat >= 4.
Fix: provide colour/seat data for every option (e.g. generate palette per seat) and make the invite use a valid option.

#### GR-9 High - non-string reaction crashes all clients (CODE; server relay VERIFIED S13b)
The server forwards `emoji: msg.payload.emoji` unvalidated (any JSON, up to the 512 KB frame; S13b relayed a 50 KB object). Pages render `<ReactionGlyph value={r.emoji}/>` which falls through to `<>{value}</>`; React throws on an object child, taking down the game page for every member (and spectators can send it, see GR-3). Long strings are also rendered as floating text. No rate limit besides the 120/s socket bucket.
Fix: server: require a string <= 8 chars from an allowlist; client: coerce with `String()`.

#### GR-10 High - lobby configuration lost (VERIFIED S17)
`getGameRoomById/Code` rebuild a fresh object from SQLite on every call, but `bingoConfig`, `tambolaConfig`, `doodleConfig`, `chessConfig` are stored as ad-hoc properties on that throwaway object, and are never persisted. S17a: host sets chess `baseTimeMs=60000` (server echoes it); when the opponent joins and the room auto-starts, `whitePlayer.timeRemainingMs = 600000`. S17b: bingo config with `totalRounds/bestOf` echoed, but the started game's config has neither. Only values passed in the same `*:start` call survive (and `startGame` from auto-start never gets them).
Fix: persist config in the game_rooms row (or an in-memory Map keyed by room id) and read it in `startGame`.

#### GR-11 Medium - double forfeit when both players drop (VERIFIED S3)
Each disconnect schedules its own 5 s timer and neither checks that the room is still PLAYING or that the other player is connected. Both sockets closed together: A's timer declares B winner, B's timer then declares A winner. After 7.5 s the stored winner is A ("b8 left the game. You are the winner!") although nobody is present (a server restart or Wi-Fi outage does this to every active room).
Fix: re-read room state in the timer, skip if FINISHED, and require the opponent to be connected (otherwise abandon/draw).

#### GR-12 Medium - REST join creates ghost players (VERIFIED S9)
`POST /api/games/rooms/:code/join` and matchmaking call `addPlayerToGameRoom`, which inserts `is_connected = 1`, and `joinRoom` auto-starts when full. S9: B only called REST join (never opened a socket); after 10 s the room is PLAYING with B "connected", `getUserActiveGame(B)` = PLAYING (friends' hub shows B as active), A got `game:started` and no disconnect event. With no socket there is no close event, so no forfeit ever fires. A user can also sit in unlimited rooms at once.
Fix: insert `is_connected = 0`, start only when all seats have live sockets, and expire seats that never connect.

#### GR-13 Medium - per-user maps ignore room (VERIFIED S12)
`userClients` and `disconnectGraceTimers` are keyed by userId only. S12: A in game 1 closes that socket and opens another room's socket within 0.2 s; `registerClient` for room 2 clears A's pending forfeit timer for room 1, so game 1 never ends (still PLAYING 7 s later, A disconnected, B waiting forever). Also, `sendToUser` (claim results, `chess:move_rejected`, invites) goes only to the most recently registered room's socket, and closing either room's socket deletes the other's `userClients` entry.
Fix: key by `roomId:userId` (or userId -> Map<roomId, client>).

#### GR-14 Medium - no inactivity timer; multi-seat games stall (CODE)
Forfeit only runs when exactly one other player remains (`remainingPlayers.length === 1`). Ludo with 3-4 players: a player who leaves/disconnects stays seated; there is no skip, no bot, no turn timer, so the game freezes on their turn. In 2-player games a connected-but-AFK player also blocks forever (no turn clock for Ludo/4-in-a-row/TTT/Bingo; only chess/doodle have clocks).
Fix: per-turn deadline with auto-skip/forfeit, and remove or skip departed seats.

#### GR-15 Medium - grace period shorter than the client's retry (CODE)
`graceSeconds: 5`. Client reconnect waits 2 s, then awaits `getWsTicket()` (HTTP) and a new WebSocket handshake; mobile tab backgrounding, Wi-Fi/LTE switch or a deploy exceeds 5 s easily and forfeits a long chess/Ludo game (combined with GR-2 the forfeit can even happen with the player present).
Fix: 30-60 s grace for PLAYING rooms (shorter for WAITING), shown in the UI.

#### GR-16 Medium - rematch semantics (VERIFIED S13a, S15, S4)
- `totalNeeded = room.players.length` includes players who left. S13a: A forfeits by leaving, B votes: `votedCount 1 / totalNeeded 2`, never completes, B can't rematch or return to a lobby.
- No status check (S15): both players vote while the game is still PLAYING and the game restarts mid-match (marks 1 -> 0, new `game:started`).
- Spectators count (GR-3).
- `startGame` always gives seat 0 the first move / white / drawer; sides never alternate.
Fix: accept rematch only for FINISHED rooms, count only present players, alternate seats, clear votes on `game:started`.

#### GR-17 Medium - doodle strokes unbounded (VERIFIED S5c)
`handleDoodleStroke` pushes any object into `gameState.strokes` with no count/size/shape validation, and `tickDoodleTimer` persists the whole state to SQLite and `broadcastDoodleState` sends the entire state (all strokes) to each client every second. S5c: 300 small strokes (about 100 KB per 60-point stroke batch of messages within the socket budget) -> 540 KB state, i.e. ~540 KB per second per client and a 540 KB DB write per second until the round ends. `doodle:live_draw` relays any payload to the room.
Fix: cap strokes/points per round, validate shape, send strokes incrementally, and persist state only on phase changes.

#### GR-18 Medium - client claims a win on any `player_left` (CODE)
`useGameRoom.ts:471-495` runs for every `game:player_left` where the leaver is not me and unconditionally calls `setOpponentLeftWin(...)` and rewrites `gameState.winnerUserId` to me, ignoring `isWinner`. Cases: someone leaves a WAITING lobby (grace-timer message has no `isWinner`), a 3-4 player Ludo seat leaves, or the opponent leaves after I already lost (compounds GR-1). `status` only becomes FINISHED when `isWinner`, so the UI shows a victory banner while the room is still waiting/playing.
Fix: gate the win banner and state rewrite on `isWinner && winnerUserId === me`.

#### GR-19 Medium - hook state and stale reconnect (CODE)
`connect` closes over `roomCode`; effect cleanup sets `isUnmountedRef=true` and closes the socket, then the next effect sets it back to false before the old socket's async `onclose` runs. That `onclose` passes the guard, sets status DISCONNECTED, and 2 s later calls the OLD `connect` (old roomCode), replacing `socketRef.current` with a socket to the previous room and calling the shared message handler. Also `game:sync` only sets `gameState` when `payload.room.gameState` is truthy, and chat/rematch/opponentLeftWin/typing/reactions are never cleared on roomCode change, so a new lobby can show the previous room's board and banners.
Fix: tie handlers to a per-connection token (ignore events from superseded sockets), and reset all room state in the effect when roomCode changes.

#### GR-20 Medium - reconnect policy (CODE)
`error:notification` handler sets `hasTerminalErrorRef=true` for every code. The server also sends RATE_LIMITED (SocketGuard) and JOIN_FAILED through the same type, so one burst while the socket stays open leaves the UI "DISCONNECTED" and a later real drop is never retried. Otherwise reconnect is a flat 2 s forever (no backoff/jitter/limit), each attempt consuming a one-time ticket and an HTTP call.
Fix: treat only AUTH_REQUIRED/GAME_ROOM_NOT_FOUND as terminal; exponential backoff with cap.

#### GR-21 Medium - forced partner link (VERIFIED S16a, S16b)
`POST /api/user/partner/connect {partnerCode}` calls `connectPartner`, which upserts ACCEPTED rows in both directions with no approval from the target. S16: A connected to B using B's code; B's `/api/user/partner` immediately shows A. Partners are accepted by `areConnected` for pings, invites, nudges, active-friends. `/api/games/partner/play {partnerCode}` auto-links the same way, and the friend picker (`GameFriendSelectorDrawer.handleSelect`) calls it just to choose an opponent, silently changing the user's partner.
Fix: make partner link a request/accept flow; do not re-pair when choosing an opponent.

#### GR-22 Medium - unthrottled pings/invites (VERIFIED S16c, S16d)
Only `/rooms/:code/join` uses `joinLimiter`. S16c: 60 pings in a row, 60 accepted (each also triggers a Web Push when the target is offline). `/partner/invite` accepted a non-existent room code with a mismatched `gameType` (S16d), so push links go to a wrong game route; `/partner/play` re-sends an invite on every click.
Fix: per-sender/target rate limits, verify the room exists/is joinable and derive `gameType` from the room.

#### GR-23 Medium - fake "Subscribed" confirmation (CODE)
`handleStayUpdated` only sets a toast ("Subscribed to updates for X!"); no API call, nothing persisted, so no one is ever notified. Both "Notify Me" cards and the "Stay Updated" button use it.
Fix: store the subscription (or change the copy).

#### GR-24 Medium - errors swallowed (VERIFIED S7c)
Throws from handlers (host-only start, `Not your turn`, bad column, etc.) are only logged (`console.warn`). In S7c B pressed Start on a dead room and received no message. `chess:move_rejected` and `bingo:error` exist for two games only, so behaviour differs per game.
Fix: send a uniform `game:error {code,message}` to the acting socket.

#### GR-25 Medium - hub card hijack (CODE)
`games/page.tsx:517-533`: if any friend is in that game type (WAITING or PLAYING), the whole card (and Play Now) routes to the friend's `joinUrl`, so you cannot start your own game of that type while a friend is active; for PLAYING rooms the destination is a spectator view (GR-3) or "already started". The strip also exposes private room codes to all friends and polls every 6 s with no visibility pause.
Fix: only the explicit "Join" pill should join; hide PLAYING/private/full rooms.

#### GR-26 Medium - GameLounge routes (CODE)
`GAMES_CATALOG` marks `chess` as "Coming Soon" and Pictionary as Coming Soon; `handleGameCardClick` has no branch for chess or doodle-duel, so clicking shows the "coming soon" toast although both are playable from `/games`.
Fix: add routes/badges for chess and doodle-duel.

#### GR-27 Medium - restart & retention (CODE)
After a server restart: `setGamePlayerConnected` is reset, but chess clocks (`chessTimers`) and tambola auto-call timers are only started in `startGame`; `registerClient` restarts only the doodle timer, so PLAYING chess/tambola rooms resume with a frozen clock/no calls. SQLite `game_rooms` rows are never purged (WAITING empty rooms also stay matchable, GR-7), and `countOpenGameRoomsByHost` counts abandoned WAITING rooms forever (a user can be locked out of `create=1` after 5).
Fix: restart timers on first reconnect per room and add a TTL sweep.

#### GR-28 Low - chess clock uses tick counts (CODE)
`activePlayer.timeRemainingMs -= 1000` per `setInterval` callback; event-loop lag or timer coalescing makes clocks run slow, and nothing records the turn start. Use a monotonic `performance.now()` deadline per turn.

#### GR-29 Low - misleading hub copy (CODE)
Hero says "Real people. No bots, ever." while `handleDoodleStart` injects `bot_duelist` when the host starts alone; "12K+ friends are playing" and stock avatars are hardcoded; `isFriendDrawerOpen` is never set true on this page (drawer/`handlePlayWithFriend` unreachable).

#### GR-30 Low - memory/size (CODE)
`roomChatHistory`, `roomThemes` and `rematchVotes` (when never completed) are never deleted; chat accepts 4,000 chars (50 kept per room, replayed on every sync); anyone (including spectators) can change the room theme; the second `case 'game:nudge'` is unreachable, so targeted nudges never work.

#### GR-31 Low - dead client API (CODE)
`getPartnerPings`/`markPartnerPingsRead` target `/api/games/partner/:code/pings` and `/pings/read`, which do not exist on the server (grep); the latter sends no auth header. Currently unused.

#### GR-32 Low - substring game resolution (CODE)
`resolveGameType` and `generateRoomCode` use `includes()` and default unknown input to Ludo, so e.g. a custom WS-created code containing "tic" or "draw" is typed as Tic-Tac-Toe/Doodle, and a typo in `gameType` silently creates Ludo.

### 4. Areas checked and found correct
- Join rules: full room, join-after-start and join-after-finish are rejected for non-members (S14a); invalid player counts rejected (S14c); room code collisions are handled (custom code uniqueness check, 10 retries); codes use `secureCode` (32-char alphabet, 8 chars).
- Cross-room signalling: `webrtc:signal` is only delivered inside the sender's room.
- Authentication: WS requires a single-use ticket; REST game routes sit behind the global JWT gate; join has `joinLimiter`.
- Turn authorization for Ludo/4-in-a-row/TTT: handlers use the socket's own userId and the engine enforces turn/seat, so a player cannot move for another seat or pick their own colour/seat/score (colours/seats come from `GAME_DEFINITIONS` at start).
- SocketGuard: JSON/envelope validation, 512 KB frame cap, token bucket and abuse close work; chat length is clamped and chat sender fields come from the server (no spoofed sender); theme is sanitised to `[A-Za-z0-9_-]`.
- Rendering: no `dangerouslySetInnerHTML` in game pages/components; names/messages render as React text (apart from GR-9).
- Duplicate-join by the same user through REST returns their existing seat; matchmaking excludes rooms the user is already in; DB seat uniqueness handled by `ON CONFLICT`.
- Doodle: `broadcastDoodleState` and `game:sync` do sanitize for guessers (the leaks are in the other broadcast paths, GR-4).


---


## Mafia Night (VIP party game, 5-10 players)
Known limitations: camera and microphone are peer-to-peer streams (WebRTC) the server cannot police, so a player could talk or show their screen during the night. The UI mutes the mic and hides the video strip at night by default (still user-toggleable, with a visible notice), but this is a convenience, not a guarantee. The `MAFIA_TEST_MIN_PLAYERS` (4 or 5) switch is for development only, see BILLING.md next to the Imposter switch.

## Quiz Show Studio (Creator party game, host + 1 to 30 players)
Known limitations: the correct answer is never sent to a player or spectator before the reveal, but a buzzer answer is spoken out loud and camera / microphone are peer-to-peer streams (WebRTC) the server cannot police, so players who are on a call together can still hear each other. Typed buzzer answers are shown to the host and the answering player only, and the answering player cannot chat while their 15 s window is open. A buzzer window that runs out locks the player out without the 50 % penalty (only a host-judged Wrong costs points). A multiple choice question reveals as soon as every connected player answered (the host does not have to press Reveal now). The tie-break "total answer milliseconds" adds up the time of the correct answers only. The quiz master cannot be handed over: if the host leaves the lobby the room closes, and if they leave a running quiz it ends (ABORTED) and nobody else can continue it. Quiz hosting needs no test switch: host + 1 player (2 people, two browsers) is enough.

## Tournament Arena (Creator game, organiser + 4 to 32 players)
Known limitations: single elimination only; the match games are Tic Tac Toe, Four in a Row and Chess (Bingo Duel and Doodle Duel are not offered); best of 3 applies to the Final only. A drawn game is replayed in a new room at most twice, then the higher seed advances. A player has 120 s to open a match room; a player who leaves the tournament forfeits every remaining match; the organiser can advance a player only for a match older than 10 minutes or after a nobody-showed-up window (logged publicly). A disconnect from the tournament page is not a departure (players leave it to play). Chess matches use the default clock and can be longer than the 10 minute "stuck" threshold, so the organiser may advance a player in a long chess game by design. Camera and microphone are peer-to-peer streams the server cannot police. Nothing visual was checked in a browser when this was written.
