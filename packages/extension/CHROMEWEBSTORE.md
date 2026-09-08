# Chrome Web Store Metadata: SyncCinema OTT Bridge

## Store Listing Information

- **Name**: SyncCinema OTT Bridge
- **Short Name**: SyncCinema
- **Version**: 1.0.0
- **Summary**: Social synchronization layer for digital entertainment that connects viewers across streaming providers without streaming or proxying copyrighted video.
- **Category**: Social & Communication

## Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `storage` | Stores the user's active room slug and synchronization preferences locally on their browser. |
| `tabs` | Allows detecting when a supported streaming tab is active to display sync status in the popup. |

## Host Permissions Justification

| Host Match | Justification |
| :--- | :--- |
| `https://*.youtube.com/*` | Observes the player playback state (play/pause/seek) to synchronize playback with friends in a SyncCinema room. |
| `https://*.netflix.com/*` | Observes playback events on the user's legitimate personal Netflix stream. |
| `https://*.disneyplus.com/*` | Observes playback events on the user's legitimate personal Disney+ stream. |
| `https://*.primevideo.com/*` | Observes playback events on the user's legitimate personal Prime Video stream. |

## Privacy & Data Use Disclosures

- **Video Content**: NEVER copied, recorded, proxied, downloaded, or redistributed.
- **Credentials/Passwords**: NEVER accessed, captured, or stored.
- **Data Collected**: Only playback timestamp (seconds) and playback state (`PLAYING` / `PAUSED`) are relayed to the user's private watch party room.
