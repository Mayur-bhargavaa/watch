# 🍿 Watch (SyncCinema) — Platform Overview & Architecture Guide

> **Live Deployment:** [https://watch.stitchbyte.in](https://watch.stitchbyte.in)  
> **Brand:** `watch.` by Stitchbyte  
> **Tagline:** *Watch, play, and connect together. Even when you're miles apart.*

---

## 🎯 1. What Is This App?

**Watch** (internally known as **SyncCinema**) is a full-featured, real-time social entertainment platform. It brings friends, couples, and watch-party groups together in an immersive virtual cinema lounge and interactive game arcade.

Unlike simple video-sharing tools, **Watch strictly decouples synchronization and social interaction from copyrighted content**:
- Users watch legitimate streams (YouTube embeds, direct HTML5 video, or browser screen sharing of OTT platforms like Netflix, Prime Video, Disney+, etc.).
- The platform orchestrates **sub-second playback sync, real-time WebRTC voice & video calls, live interactive reactions, timestamped chat, and integrated multiplayer party games**.

---

## 🏛️ 2. High-Level Architecture & Monorepo Structure

The project is built as a modular TypeScript monorepo:

```
watch_party/
├── apps/
│   ├── web/                     # Next.js 14 (App Router) + React 19 + Tailwind CSS Frontend
│   │   ├── src/app/             # Pages: Landing (/), Cinema Rooms (/room/[slug]), Games (/games/*), Profile, Friends
│   │   ├── src/components/      # PixelPerfectTheater, CinemaPlayer, VoiceChat, Ludo, Connect4, TicTacToe
│   │   └── src/hooks/           # useRoomSocket, useWebRTCVoice, useSyncEngine
│   └── server/                  # Fastify + WebSocket + SQLite authoritative backend
│       ├── src/index.ts         # Fastify HTTP REST APIs & WebSocket server
│       ├── src/sync/            # RoomSyncManager (authoritative room & playback state machine)
│       ├── src/webrtc/          # WebRTC mesh signaling for voice & video
│       └── src/db/              # Relational database service (SQLite / PostgreSQL)
├── packages/
│   ├── common/                  # Shared protocol schemas (Zod), models, and Cristian's sync math
│   └── extension/               # Manifest V3 Chrome Extension for browser tab video observing
```

---

## 🌟 3. Core Features & Capabilities

### 🎬 A. Immersive 3D VIP Virtual Theater Mode & Virtual Seats
* **Ultra-Realistic Cinema Hall**:
  - Features front-row plush red velvet VIP armchairs, glowing gold-lit architectural moldings, and sconce lighting.
  - Video and screen streams fit pixel-for-pixel directly on the theater screen.
* **🪑 Interactive Virtual Cinema Seats**:
  - Every participant is assigned a dedicated seat in the cinema hall (`Seat A1`, `Seat A2`, `Seat A3`, `Seat A4` in the middle row, and `VIP Front Left`, `VIP Front Right` in the front row).
  - **Click a Seat → Profile & Status Popover**: Clicking any seat reveals the user's avatar, displayName, mic & camera states, and host status (or a 1-click room invite link if the seat is empty).
  - **Subtle Reaction Glow**: When any person sends an emoji reaction (or when you react), their seat pulses with a golden amber glow and displays their bouncing emoji right above their chair!
  - **Toggleable**: You can show or hide the virtual seat avatars anytime via the **Seats** button on the bottom pill dock.
* **Realistic Dynamic Lights-Off Transition**:
  - **Lights On (Ambient Glow)**: When idle or **whenever video or screen stream is PAUSED**, the theater cross-fades into warm wall sconce lighting (recreating theater lights during intermission).
  - **Lights Off (Dimmed Hall)**: When video or screen share is **actively PLAYING**, lights smoothly dim down over a 1-second cross-fade with ambient screen bloom.
* **Display Modes**:
  - Toggle between **Standard** (framed inside cinema screen), **Large**, and **IMAX** (expansive widescreen).
* **Multiple Ambiance Themes**:
  - 3D VIP Cinema, Candlelit Café, Neon Romance, Better Together, Watch Together, Snuggle Cinema, and Velvet Night.

---

### ⏱️ B. Sub-Second Synchronization Engine
* **NTP-Lite Clock Synchronization (Cristian's Algorithm)**:
  - Continuously calculates round-trip time (RTT) and client-server clock offset to eliminate device clock skew.
* **3-Tier Intelligent Drift Correction**:
  - **Tier 1 (< 150ms)**: Deadband zone — perfectly in sync, playing at native 1.0x.
  - **Tier 2 (150ms – 1200ms)**: Soft rate nudge (±4%, 0.96x / 1.04x) — smooth alignment without stutter or buffering.
  - **Tier 3 (> 1200ms)**: Debounced hard seek to align viewers with the host without seek loops.
* **Authoritative Host State**:
  - Host controls play, pause, seek, and URL changes with monotonic version sequence numbers.

---

### 📹 C. Real-Time Social Interaction & WebRTC Calls
* **Sleek Bottom Cam Previews**:
  - High-performance, clean horizontal video bar above the bottom dock.
  - Displays participant cameras, speaking pulses, mic mute indicators, and avatars without obscuring the cinema screen.
  - Instant one-click toggle to show or hide the camera strip (`Cam (X)` button).
* **Floating Reaction Canvas**:
  - Real-time animated emoji particles (😂, ❤️, 🔥, 👏, 😱, 😭, etc.) floating across viewers' screens with hotkeys (1–8).
  - Floating emoji quick bar closed by default for distraction-free viewing.
* **Timestamped Video Chat**:
  - Chat drawer linked directly to playback time (e.g. `[01:24:10]`), allowing viewers to jump straight to referenced scenes.
* **Post-Watch Recap & Reaction Heatmaps**:
  - Interactive SVG visual timeline showing engagement peaks and top memorable scenes.

---

### 🎮 D. Real-Time Multiplayer Party Games Arcade
Built-in games playable directly with room members or selected friends:
1. **Ludo Party**: Full 4-player turn-based board game with animated dice rolls, pawn captures, safe zones, and live video feeds.
2. **Four-in-a-Row (Connect 4)**: Classic vertical disc-dropping strategy duel.
3. **Tic-Tac-Toe**: Fast-paced 3D glass board with romantic partner selection and turn indicators.
4. **Partner & Friend Ping System**: Instant invites, watch streaks, and lighthearted playful roasts.

---

## 🔒 4. Legal & Copyright Compliance Philosophy

Watch operates as a pure **social synchronization and communication layer**:
1. **Zero Media Storage**: The server never downloads, transcodes, proxies, caches, or redistributes video bytes.
2. **Legitimate Sources**: Content plays via official YouTube APIs, direct user-provided URLs, or peer-to-peer WebRTC screen sharing where users broadcast from their own authorized browser tabs.
3. **Privacy First**: Ephemeral WebRTC mesh peer connections, guest 1-click access, secure JWTs, and GDPR-compliant data wipe endpoints.

---

## 🚀 5. Development & Deployment Workflow

- **Local Development**:
  ```bash
  pnpm dev:server   # Starts Fastify backend on port 4000
  pnpm dev:web      # Starts Next.js frontend on port 3000
  ```
- **Production Server**:
  - Hosted on Oracle Cloud (`ubuntu@92.4.81.40`).
  - Served through Nginx reverse proxy with SSL (`https://watch.stitchbyte.in`).
  - Managed via PM2 (`watch-web` and `watch-server`).
