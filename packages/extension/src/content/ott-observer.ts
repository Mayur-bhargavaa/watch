// SyncCinema OTT Content Script Observer
// Detects active video element and relays playback states legitimately

function detectPlatform(): string {
  const host = window.location.hostname;
  if (host.includes('youtube.com')) return 'YouTube';
  if (host.includes('netflix.com')) return 'Netflix';
  if (host.includes('disneyplus.com')) return 'Disney+';
  if (host.includes('primevideo.com') || host.includes('amazon.')) return 'Prime Video';
  return 'Generic Web Player';
}

function initVideoObserver() {
  const platform = detectPlatform();
  let observedVideo: HTMLVideoElement | null = null;

  function attachListeners(video: HTMLVideoElement) {
    if (observedVideo === video) return;
    observedVideo = video;

    chrome.runtime.sendMessage({
      type: 'OTT_PLAYER_DETECTED',
      payload: { platform, duration: video.duration }
    });

    video.addEventListener('play', () => {
      chrome.runtime.sendMessage({
        type: 'OTT_PLAYBACK_EVENT',
        payload: { action: 'PLAY', position: video.currentTime }
      });
    });

    video.addEventListener('pause', () => {
      chrome.runtime.sendMessage({
        type: 'OTT_PLAYBACK_EVENT',
        payload: { action: 'PAUSE', position: video.currentTime }
      });
    });

    video.addEventListener('seeked', () => {
      chrome.runtime.sendMessage({
        type: 'OTT_PLAYBACK_EVENT',
        payload: { action: 'SEEK', position: video.currentTime }
      });
    });
  }

  // Find video in DOM or observe dynamic insertion
  const existingVideo = document.querySelector('video');
  if (existingVideo) {
    attachListeners(existingVideo);
  }

  const mutationObserver = new MutationObserver(() => {
    const video = document.querySelector('video');
    if (video && video !== observedVideo) {
      attachListeners(video);
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVideoObserver);
} else {
  initVideoObserver();
}
