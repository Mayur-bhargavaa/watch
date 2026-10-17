'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { RoomPlaybackState } from '@synccinema/common';
import { Zap, AlertCircle } from 'lucide-react';

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
  const [embedError, setEmbedError] = useState<number | null>(null);
  const [syncBadge, setSyncBadge] = useState<{ isCatchingUp: boolean; text: string } | null>(null);
  const lastHardSeekTimeRef = useRef<number>(0);
  const isInternalUpdateRef = useRef<boolean>(false);

  // Keep references to incoming callbacks so useEffect doesn't tear down and re-create the YouTube iframe
  const getAuthPosRef = useRef(getAuthoritativePosition);
  getAuthPosRef.current = getAuthoritativePosition;

  const onHostCommandRef = useRef(onHostCommand);
  onHostCommandRef.current = onHostCommand;

  const playbackStateRef = useRef(playbackState);
  playbackStateRef.current = playbackState;

  // 1. Load YouTube IFrame Player API script and initialize ONCE per videoId
  useEffect(() => {
    let isCancelled = false;

    if (!window.YT) {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    }

    const initPlayer = () => {
      if (isCancelled || !containerRef.current) return;

      // Provide an unmanaged target element inside containerRef so YouTube replaces THAT element,
      // leaving containerRef.current intact in React's DOM tree to prevent insertBefore DOM errors.
      containerRef.current.innerHTML = '';
      const targetDiv = document.createElement('div');
      targetDiv.style.width = '100%';
      targetDiv.style.height = '100%';
      containerRef.current.appendChild(targetDiv);

      try {
        playerRef.current = new window.YT.Player(targetDiv, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: isHost ? 1 : 0, // participants use social synchronized controls
            disablekb: isHost ? 0 : 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined
          },
          events: {
            onReady: (event: any) => {
              if (isCancelled) return;
              setIsReady(true);
              const authPos = getAuthPosRef.current ? getAuthPosRef.current() : 0;
              if (authPos > 0 && typeof event?.target?.seekTo === 'function') {
                isInternalUpdateRef.current = true;
                event.target.seekTo(authPos, true);
                setTimeout(() => {
                  isInternalUpdateRef.current = false;
                }, 400);
              }
              if (playbackStateRef.current?.state === 'PLAYING' && typeof event?.target?.playVideo === 'function') {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              if (isCancelled || !isHost || isInternalUpdateRef.current) return;
              const currentTime =
                playerRef.current && typeof playerRef.current.getCurrentTime === 'function'
                  ? playerRef.current.getCurrentTime()
                  : 0;
              const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
              const pausedState = window.YT?.PlayerState?.PAUSED ?? 2;

              if (event.data === playingState) {
                onHostCommandRef.current?.('PLAY', currentTime);
              } else if (event.data === pausedState) {
                onHostCommandRef.current?.('PAUSE', currentTime);
              }
            },
            onError: (event: any) => {
              if (isCancelled) return;
              console.warn('YouTube Player error code:', event.data);
              setEmbedError(event.data);
            }
          }
        });
      } catch (err) {
        console.warn('Failed to initialize YouTube player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevHandler) prevHandler();
        initPlayer();
      };
    }

    return () => {
      isCancelled = true;
      setIsReady(false);
      setSyncBadge(null);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [videoId, isHost]);

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

      // On seek / state command or initial mount, align position immediately if drift > 2.0s
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const localTime = playerRef.current.getCurrentTime();
        const authoritativeTime = getAuthoritativePosition();
        if (authoritativeTime > 0 && Math.abs(localTime - authoritativeTime) > 2.0) {
          isInternalUpdateRef.current = true;
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

  // 3. Continuous drift evaluation loop for viewers with Smart Catch-up
  useEffect(() => {
    // The host is the source of truth and must never seek or adjust rate on itself
    if (
      isHost ||
      !isReady ||
      !playerRef.current ||
      typeof playerRef.current.getCurrentTime !== 'function'
    ) {
      setSyncBadge(null);
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

        // Deadband: within 0.4s is in perfect lock
        if (absDriftSeconds <= 0.4) {
          if (typeof playerRef.current.getPlaybackRate === 'function' && playerRef.current.getPlaybackRate() !== 1) {
            playerRef.current.setPlaybackRate(1);
          }
          setSyncBadge(null);
          if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
          return;
        }

        // Smart Rate Adjustment: between 0.4s and 3.5s, gently ramp rate without rebuffering
        if (absDriftSeconds <= 3.5) {
          if (typeof playerRef.current.setPlaybackRate === 'function') {
            // If viewer is behind, speed up (1.15x or 1.25x). If ahead, slow down (0.9x or 0.75x)
            const targetRate = driftSeconds < 0
              ? (absDriftSeconds > 1.5 ? 1.25 : 1.15)
              : 0.9;

            playerRef.current.setPlaybackRate(targetRate);

            const badgeText = targetRate > 1.0
              ? `Syncing +${Math.round((targetRate - 1) * 100)}%`
              : `Syncing -${Math.round((1 - targetRate) * 100)}%`;

            setSyncBadge({ isCatchingUp: true, text: badgeText });
            if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), targetRate);
            return;
          }
        }

        // Only hard seek if drift is severe (> 3.5s) AND cooldown has passed (6 seconds)
        if (absDriftSeconds > 3.5 && (now - lastHardSeekTimeRef.current > 6000)) {
          isInternalUpdateRef.current = true;
          playerRef.current.seekTo(authoritativeTime, true);
          if (typeof playerRef.current.setPlaybackRate === 'function') {
            playerRef.current.setPlaybackRate(1);
          }
          lastHardSeekTimeRef.current = now;
          setSyncBadge({ isCatchingUp: true, text: 'Re-aligned' });
          setTimeout(() => setSyncBadge(null), 1500);
          if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
          setTimeout(() => {
            isInternalUpdateRef.current = false;
          }, 600);
        }
      } catch (err) {
        console.warn('Drift evaluation error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isHost, isReady, getAuthoritativePosition, onDriftUpdate]);

  return (
    <div className="relative w-full h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-cinema-border/50">
      <div ref={containerRef} className="w-full h-full" />

      {/* YouTube Restricted / Video Unavailable Error Overlay */}
      {embedError && (
        <div className="absolute inset-0 z-40 bg-[#0f1118]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
            YouTube Video Unavailable
          </h4>
          <p className="text-[11px] sm:text-xs text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
            This YouTube video has restricted playback or was removed (error code {embedError}). You can choose a verified movie from the Free Movies collection or stream a direct video URL.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <a
              href="/discover"
              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition cursor-pointer"
            >
              Browse Free Movies
            </a>
          </div>
        </div>
      )}

      {/* Smart Sync Catch-up Indicator Badge */}
      {syncBadge && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[11px] font-semibold tracking-wide shadow-lg shadow-black/40 animate-pulse select-none pointer-events-none">
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>{syncBadge.text}</span>
        </div>
      )}
    </div>
  );
});
