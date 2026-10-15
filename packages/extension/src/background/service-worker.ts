// Manifest V3 Background Service Worker for SyncCinema OTT Bridge

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    isSyncActive: false,
    currentRoomSlug: null,
    lastDetectedPlatform: 'None'
  });
  console.log('SyncCinema Extension Installed');
});

// Message router between Content Scripts, Popup, and Web App
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only our own extension contexts (popup / content scripts) may talk to the worker
  if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') {
    sendResponse({ status: 'ignored' });
    return false;
  }
  (async () => {
    try {
      switch (message.type) {
        case 'GET_EXTENSION_STATUS': {
          const data = await chrome.storage.local.get(['isSyncActive', 'currentRoomSlug', 'lastDetectedPlatform']);
          sendResponse({ status: 'ok', data });
          break;
        }

        case 'SET_SYNC_ACTIVE': {
          const slug = typeof message.payload?.roomSlug === 'string' && /^[a-z0-9_-]{1,64}$/i.test(message.payload.roomSlug) ? message.payload.roomSlug : null;
          await chrome.storage.local.set({
            isSyncActive: Boolean(message.payload?.isSyncActive),
            currentRoomSlug: slug
          });
          sendResponse({ status: 'ok' });
          break;
        }

        case 'OTT_PLAYER_DETECTED': {
          await chrome.storage.local.set({
            lastDetectedPlatform: String(message.payload?.platform ?? 'Unknown').slice(0, 40)
          });
          sendResponse({ status: 'ok' });
          break;
        }

        default:
          sendResponse({ status: 'ignored' });
      }
    } catch (err: any) {
      sendResponse({ status: 'error', error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
