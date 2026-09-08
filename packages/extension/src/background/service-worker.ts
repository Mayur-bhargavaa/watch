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
  (async () => {
    try {
      switch (message.type) {
        case 'GET_EXTENSION_STATUS': {
          const data = await chrome.storage.local.get(['isSyncActive', 'currentRoomSlug', 'lastDetectedPlatform']);
          sendResponse({ status: 'ok', data });
          break;
        }

        case 'SET_SYNC_ACTIVE': {
          await chrome.storage.local.set({
            isSyncActive: message.payload.isSyncActive,
            currentRoomSlug: message.payload.roomSlug || null
          });
          sendResponse({ status: 'ok' });
          break;
        }

        case 'OTT_PLAYER_DETECTED': {
          await chrome.storage.local.set({
            lastDetectedPlatform: message.payload.platform
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
