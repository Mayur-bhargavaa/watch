"use strict";
// Popup script for SyncCinema Chrome Extension
document.addEventListener('DOMContentLoaded', async () => {
    const platformEl = document.getElementById('detectedPlatform');
    const syncStatusEl = document.getElementById('syncStatus');
    const toggleBtn = document.getElementById('toggleBtn');
    // Request status from service worker
    chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATUS' }, (res) => {
        if (res && res.data) {
            if (platformEl)
                platformEl.innerText = res.data.lastDetectedPlatform || 'None';
            if (syncStatusEl)
                syncStatusEl.innerText = res.data.isSyncActive ? 'Active' : 'Inactive';
            if (toggleBtn) {
                toggleBtn.innerText = res.data.isSyncActive ? 'Disconnect Sync' : 'Connect to Watch Room';
            }
        }
    });
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            const { isSyncActive = false } = await chrome.storage.local.get('isSyncActive');
            const nextState = !isSyncActive;
            await chrome.storage.local.set({ isSyncActive: nextState });
            if (syncStatusEl)
                syncStatusEl.innerText = nextState ? 'Active' : 'Inactive';
            toggleBtn.innerText = nextState ? 'Disconnect Sync' : 'Connect to Watch Room';
        });
    }
});
