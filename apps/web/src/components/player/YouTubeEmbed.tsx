'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { RoomPlaybackState, evaluateDriftCorrection } from '@synccinema/common';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubeEmbedProps {
  videoId: string;
  playbackState: RoomPlaybackState;
  isHost: boolean;
  getAuthoritativePosition: () => number;
  onHostCommand: (action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => void;
  onDriftUpdate?: (driftMs: number, rate: number) => void;
}

export const YouTubeEmbed = memo(function YouTubeEmbed({
  videoId,
  playbackState,
  isHost,
  getAuthoritativePosition,
  onHostCommand,
  onDriftUpdate
}: YouTubeEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const lastHardSeekTimeRef = useRef<number>(0);
  const isInternalUpdateRef = useRef<boolean>(false);

  // 1. Load YouTube IFrame Player API script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0, // participants use social synchronized controls
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            setIsReady(true);
          },
          onStateChange: (event: any) => {
            if (!isHost || isInternalUpdateRef.current) return;
            const currentTime =
              playerRef.current && typeof playerRef.current.getCurrentTime === 'function'
                ? playerRef.current.getCurrentTime()
                : 0;
            const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
            const pausedState = window.YT?.PlayerState?.PAUSED ?? 2;

            if (event.data === playingState) {
              onHostCommand('PLAY', currentTime);
            } else if (event.data === pausedState) {
              onHostCommand('PAUSE', currentTime);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      setIsReady(false);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId, isHost, onHostCommand]);

  // 2. Play/Pause state synchronization
  useEffect(() => {
    if (
      !isReady ||
      !playerRef.current ||
      typeof playerRef.current.getPlayerState !== 'function'
    ) {
      return;
    }

    try {
      isInternalUpdateRef.current = true;
      const playerState = playerRef.current.getPlayerState();
      const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
      const pausedState = window.YT?.PlayerState?.PAUSED ?? 2;

      if (playbackState.state === 'PLAYING') {
        if (playerState !== playingState && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      } else if (playbackState.state === 'PAUSED') {
        if (playerState !== pausedState && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      }

      // On seek / state command from host, align position immediately if drift > 2.0s
      if (!isHost && typeof playerRef.current.getCurrentTime === 'function') {
        const localTime = playerRef.current.getCurrentTime();
        const authoritativeTime = getAuthoritativePosition();
        if (Math.abs(localTime - authoritativeTime) > 2.0) {
          playerRef.current.seekTo(authoritativeTime, true);
        }
      }
    } catch (err) {
      console.warn('Error synchronizing YouTube playback state:', err);
    } finally {
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 500);
    }
  }, [isReady, playbackState.state, playbackState.version, playbackState.position, isHost, getAuthoritativePosition]);

  // 3. Continuous drift evaluation loop for viewers (runs every 2000ms)
  useEffect(() => {
    // The host is the source of truth and must never seek or adjust rate on itself
    if (
      isHost ||
      !isReady ||
      !playerRef.current ||
      typeof playerRef.current.getCurrentTime !== 'function'
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (
        !playerRef.current ||
        typeof playerRef.current.getCurrentTime !== 'function'
      ) {
        return;
      }

      try {
        const localTime = playerRef.current.getCurrentTime();
        const authoritativeTime = getAuthoritativePosition();
        const driftSeconds = localTime - authoritativeTime;
        const absDriftSeconds = Math.abs(driftSeconds);
        const now = Date.now();

        // Under 3.0 seconds drift is completely unnoticeable when watching together
        // Leaving it alone guarantees 100% smooth, continuous playback without buffering pauses
        if (absDriftSeconds <= 3.0) {
          if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
          return;
        }

        // Only hard seek if drift is severe (> 3.5s) AND cooldown has passed (6 seconds)
        if (absDriftSeconds > 3.5 && (now - lastHardSeekTimeRef.current > 6000)) {
          isInternalUpdateRef.current = true;
          playerRef.current.seekTo(authoritativeTime, true);
          lastHardSeekTimeRef.current = now;
          if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
          setTimeout(() => {
            isInternalUpdateRef.current = false;
          }, 600);
        }
      } catch (err) {
        console.warn('Drift evaluation error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isHost, isReady, getAuthoritativePosition, onDriftUpdate]);

  return (
    <div className="relative w-full h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-cinema-border/50">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});
