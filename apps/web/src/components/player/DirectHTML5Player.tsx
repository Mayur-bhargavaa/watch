'use client';

import { useEffect, useRef } from 'react';
import { RoomPlaybackState, evaluateDriftCorrection } from '@synccinema/common';

interface DirectHTML5PlayerProps {
  sourceUrl: string;
  playbackState: RoomPlaybackState;
  isHost: boolean;
  getAuthoritativePosition: () => number;
  onHostCommand: (action: 'PLAY' | 'PAUSE' | 'SEEK', position: number) => void;
  onDriftUpdate?: (driftMs: number, rate: number) => void;
}

export function DirectHTML5Player({
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

    setTimeout(() => {
      isInternalUpdateRef.current = false;
    }, 400);
  }, [playbackState.state, playbackState.version]);

  // Drift correction loop
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const localTime = video.currentTime;
      const authoritativeTime = getAuthoritativePosition();
      const currentRate = video.playbackRate;
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
        video.currentTime = action.targetPositionSeconds;
        lastHardSeekTimeRef.current = now;
        setTimeout(() => {
          isInternalUpdateRef.current = false;
        }, 400);
      } else if (action.type === 'RATE_ADJUST') {
        video.playbackRate = action.targetRate;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [getAuthoritativePosition, onDriftUpdate]);

  return (
    <div className="relative w-full h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-cinema-border/50">
      <video
        ref={videoRef}
        src={sourceUrl}
        className="w-full h-full object-contain"
        controls={isHost}
        playsInline
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
}
