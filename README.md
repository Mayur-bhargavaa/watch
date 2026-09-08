# 🎬 SyncCinema — Social Synchronization Layer for Digital Entertainment

> **Watch together. Even when you're apart.**

SyncCinema is a production-grade, distributed real-time social viewing platform. It creates a seamless shared viewing lounge across digital entertainment providers without transmitting, proxying, downloading, or redistributing copyrighted video streams.

---

## 🌟 Core Architecture Principles

The architecture strictly decouples:
- **Layer A (Content)**: Media hosted and streamed by legitimate OTT providers (YouTube official embeds, direct HTML5 video, or official personal streaming accounts on Netflix, Disney+, Prime Video). Content is **never** proxied, downloaded, or DRM-circumvented.
- **Layer B (Social Synchronization)**: Authoritative real-time engine handling room presence, sub-second clock-synchronized playback state, timestamped social reactions & heatmaps, playback-linked chat, WebRTC voice communication, and permissions.

---

## 🚀 Key Features

1. **Sub-Second Synchronization Engine**:
   - **NTP-lite Clock Sync (Cristian's Algorithm)** with RTT outlier filtering to eradicate client clock skew.
   - **Multi-Tier Drift Correction Engine**:
     - *Tier 1 (< 150ms)*: Deadband in-sync. Native playback at 1.0x.
     - *Tier 2 (150ms – 1200ms)*: Soft rate nudge ($\pm 5\%$, 0.95x / 1.05x) to eliminate audible/visual stutter.
     - *Tier 3 (> 1200ms)*: Debounced hard seek with loop prevention.
   - Authoritative server state machine with monotonic version counters.

2. **Full Social Suite**:
   - **Floating Reaction Canvas**: Real-time animated emoji particles (😂, ❤️, 😱, 😭, 🔥, 👏, 😡, 🤯) rising over the video area with keyboard hotkeys (1-8).
   - **Contextual Playback Chat**: Messages linked to specific video timestamps (e.g. `01:23:45`), clicking jumps to the exact scene.
   - **Post-Watch Recap & Reaction Heatmaps**: Interactive SVG timeline graph showing peak reaction spikes across the duration and top moments.
   - **WebRTC Voice Lounge**: Audio mesh signaling with mute/unmute, deafen, volume controls, and active speaker pulse rings.

3. **Graceful Fallback & Multi-Provider Support**:
   - YouTube Player (official IFrame API).
   - Direct HTML5 / MP4 / HLS streams.
   - **Synchronized Countdown Lounge (OTT Fallback Mode)**: For DRM-restricted OTT services (Netflix, Disney+, Prime Video), users watch on their legitimate accounts while SyncCinema provides precision synchronized countdowns, live timeline tracking, and social interaction.
   - Manifest V3 Chrome Extension scaffold for tab observer bridging.

4. **Security & Privacy by Design**:
   - Zero storage of copyrighted media bytes.
   - JWT authentication + 1-click guest anonymous joining.
   - Nanoid unguessable room slugs.
   - Anti-spam rate limiting on reactions and chat.
   - Full GDPR-compliant data deletion API (`DELETE /api/privacy/data`).

---

## 📁 Repository Structure

```
watch_party/
├── packages/
│   ├── common/                  # Shared types, protocol schemas (Zod), and sync math
│   │   ├── src/sync.ts          # Clock offset and multi-tier drift decision engine
│   │   ├── src/protocol.ts      # WebSocket payload types
│   │   └── src/types.ts         # User, Room, Media, Reaction types
│   └── extension/               # Chrome Manifest V3 extension
│       ├── src/manifest.json    # MV3 manifest
│       ├── src/background/      # Service worker
│       ├── src/content/         # Video element observer
│       └── src/popup/           # Quick status popup
└── apps/
    ├── server/                  # Fastify + WebSockets authoritative backend
    │   ├── src/index.ts         # Server entrypoint and REST routes
    │   ├── src/sync/            # RoomSyncManager state machine
    │   └── src/db/              # Relational SQLite/PostgreSQL storage service
    └── web/                     # Next.js 14 / React 19 / Tailwind CSS frontend
        ├── src/app/             # App router (Landing, Room, Recap)
        ├── src/components/      # CinemaPlayer, FloatingReactions, Chat, Voice
        └── src/hooks/           # useRoomSocket, useSyncEngine
```

---

## 🛠️ Quick Start

### Prerequisites
- Node.js >= 20 (Tested on Node v24.7.0)
- npm >= 10

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Test Suites
```bash
# Run unit tests for sync algorithm and math
npm run build --workspace=packages/common
node --test packages/common/dist/__tests__/sync.test.js

# Run end-to-end server integration tests
npm run build --workspace=apps/server
node --test apps/server/dist/__tests__/server.test.js
```

### 3. Start Development Servers
Start backend authoritative server (runs on `http://localhost:4000`):
```bash
npm run dev:server
```

In a second terminal, start the Next.js web application (runs on `http://localhost:3000`):
```bash
npm run dev:web
```

Open `http://localhost:3000` in your browser.

---

## 📡 API & WebSocket Specification

### REST Endpoints
- `GET /api/health`: Health status.
- `POST /api/auth/guest`: 1-click guest authentication with generated avatar.
- `POST /api/auth/register`: Email registration.
- `POST /api/rooms`: Create a new viewing room.
- `GET /api/rooms/:slug`: Retrieve room details.
- `GET /api/rooms/:slug/recap`: Retrieve post-watch reaction heatmap and top moments.
- `DELETE /api/privacy/data`: GDPR data erasure.

### WebSocket Protocol (`/ws/rooms/:slug`)
- `sync:ping` / `sync:pong`: Millisecond clock synchronization.
- `room:state`: Authoritative state snapshot delivered on join/reconnect.
- `playback:command`: Host commands (`PLAY`, `PAUSE`, `SEEK`).
- `playback:update`: Authoritative broadcast of position, rate, and version.
- `reaction:send` / `reaction:broadcast`: Floating emoji fan-out.
- `chat:send` / `chat:message`: Real-time contextual chat.
- `voice:signal`: WebRTC audio mesh signaling.
- `host:update`: Host authority transfer notification.
# watch
