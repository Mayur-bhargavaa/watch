'use client';

import { useEffect, useRef, memo } from 'react';
import { RoomPlaybackState, evaluateDriftCorrection } from '@synccinema/common';

interface DirectHTML5PlayerProps {
  sourceUrl: string;
  playbackState: RoomPlaybackState;
  isHost: boolean;
  getAuthoritativePosition: () => number;
  onHostCommand: (action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => void;
  onDriftUpdate?: (driftMs: number, rate: number) => void;
}

export const DirectHTML5Player = memo(function DirectHTML5Player({
  sourceUrl,
  playbackState,
  isHost,
  getAuthoritativePosition,
  onHostCommand,
  onDriftUpdate
}: DirectHTML5PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastHardSeekTimeRef = useRef<number>(0);
  const isInternalUpdateRef = useRef<boolean>(false);

  // Play/Pause sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    isInternalUpdateRef.current = true;
    if (playbackState.state === 'PLAYING') {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else if (playbackState.state === 'PAUSED') {
      if (!video.paused) {
        video.pause();
      }
    }

    // Align position on mount or drift immediately
    const authPos = getAuthoritativePosition();
    if (authPos > 0 && Math.abs(video.currentTime - authPos) > 1.0) {
      video.currentTime = authPos;
    }

    setTimeout(() => {
      isInternalUpdateRef.current = false;
    }, 400);
  }, [playbackState.state, playbackState.version, playbackState.position, isHost, getAuthoritativePosition]);

  // Drift correction loop for viewers
  useEffect(() => {
    // The host is the source of truth and must never seek or adjust rate on itself
    if (isHost) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const localTime = video.currentTime;
      const authoritativeTime = getAuthoritativePosition();
      const driftSeconds = localTime - authoritativeTime;
      const absDriftSeconds = Math.abs(driftSeconds);
      const now = Date.now();

      // Deadband: within 1.5 seconds, leave at normal rate 1.0
      if (absDriftSeconds <= 1.5) {
        if (video.playbackRate !== 1.0) {
          video.playbackRate = 1.0;
        }
        if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
        return;
      }

      // Soft adjustment: between 1.5s and 4.0s, gently nudge rate by 4% without rebuffering
      if (absDriftSeconds <= 4.0) {
        const targetRate = driftSeconds > 0 ? 0.96 : 1.04;
        if (video.playbackRate !== targetRate) {
          video.playbackRate = targetRate;
        }
        if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), targetRate);
        return;
      }

      // Hard seek: only if drift > 4.0s and cooldown passed (6 seconds)
      if (absDriftSeconds > 4.0 && (now - lastHardSeekTimeRef.current > 6000)) {
        isInternalUpdateRef.current = true;
        video.currentTime = authoritativeTime;
        video.playbackRate = 1.0;
        lastHardSeekTimeRef.current = now;
        if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
        setTimeout(() => {
          isInternalUpdateRef.current = false;
        }, 500);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isHost, getAuthoritativePosition, onDriftUpdate]);

  return (
    <div className="relative w-full h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-cinema-border/50">
      <video
        ref={videoRef}
        src={sourceUrl}
        className="w-full h-full object-contain"
        controls={isHost}
        playsInline
        onLoadedMetadata={(e) => {
          const authPos = getAuthoritativePosition();
          if (authPos > 0) {
            isInternalUpdateRef.current = true;
            e.currentTarget.currentTime = authPos;
            setTimeout(() => {
              isInternalUpdateRef.current = false;
            }, 300);
          }
          if (playbackState.state === 'PLAYING') {
            e.currentTarget.play().catch(() => {});
          }
        }}
        onPlay={() => {
          if (isHost && !isInternalUpdateRef.current) {
            onHostCommand('PLAY', videoRef.current?.currentTime || 0);
          }
        }}
        onPause={() => {
          if (isHost && !isInternalUpdateRef.current) {
            onHostCommand('PAUSE', videoRef.current?.currentTime || 0);
          }
        }}
        onSeeked={() => {
          if (isHost && !isInternalUpdateRef.current) {
            onHostCommand('SEEK', videoRef.current?.currentTime || 0);
          }
        }}
      />
    </div>
  );
});
