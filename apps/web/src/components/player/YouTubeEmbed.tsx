'use client';

import { useEffect, useRef, useState } from 'react';
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

export function YouTubeEmbed({
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
    } catch (err) {
      console.warn('Error synchronizing YouTube playback state:', err);
    } finally {
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 500);
    }
  }, [isReady, playbackState.state, playbackState.version]);

  // 3. Continuous drift evaluation loop (runs every 1000ms)
  useEffect(() => {
    if (
      !isReady ||
      !playerRef.current ||
      typeof playerRef.current.getCurrentTime !== 'function'
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (
        !playerRef.current ||
        typeof playerRef.current.getCurrentTime !== 'function' ||
        typeof playerRef.current.getPlaybackRate !== 'function'
      ) {
        return;
      }

      try {
        const localTime = playerRef.current.getCurrentTime();
        const authoritativeTime = getAuthoritativePosition();
        const currentRate = playerRef.current.getPlaybackRate() || 1.0;
        const now = Date.now();

        const action = evaluateDriftCorrection(
          localTime,
          authoritativeTime,
          currentRate,
          lastHardSeekTimeRef.current,
          now
        );

        if (onDriftUpdate) {
          onDriftUpdate(action.driftMs, currentRate);
        }

        if (action.type === 'HARD_SEEK') {
          isInternalUpdateRef.current = true;
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(action.targetPositionSeconds, true);
          }
          lastHardSeekTimeRef.current = now;
          setTimeout(() => {
            isInternalUpdateRef.current = false;
          }, 500);
        } else if (action.type === 'RATE_ADJUST') {
          if (typeof playerRef.current.setPlaybackRate === 'function') {
            playerRef.current.setPlaybackRate(action.targetRate);
          }
        }
      } catch (err) {
        console.warn('Drift evaluation error:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isReady, getAuthoritativePosition, onDriftUpdate]);

  return (
    <div className="relative w-full h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-cinema-border/50">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
