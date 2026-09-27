'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { RoomPlaybackState } from '@synccinema/common';
import { Zap } from 'lucide-react';

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
  const [syncBadge, setSyncBadge] = useState<{ isCatchingUp: boolean; text: string } | null>(null);

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

  // Drift correction loop for viewers with Smart Catch-up
  useEffect(() => {
    // The host is the source of truth and must never seek or adjust rate on itself
    if (isHost) {
      setSyncBadge(null);
      return;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const localTime = video.currentTime;
      const authoritativeTime = getAuthoritativePosition();
      const driftSeconds = localTime - authoritativeTime;
      const absDriftSeconds = Math.abs(driftSeconds);
      const now = Date.now();

      // Deadband: within 0.35 seconds, leave at normal rate 1.0
      if (absDriftSeconds <= 0.35) {
        if (video.playbackRate !== 1.0) {
          video.playbackRate = 1.0;
        }
        setSyncBadge(null);
        if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
        return;
      }

      // Smart Catch-up: between 0.35s and 3.5s, gently ramp rate without rebuffering
      if (absDriftSeconds <= 3.5) {
        // If viewer is behind (driftSeconds < 0), speed up slightly (1.10x or 1.14x)
        // If viewer is ahead (driftSeconds > 0), slow down slightly (0.92x)
        const targetRate = driftSeconds < 0
          ? (absDriftSeconds > 1.5 ? 1.14 : 1.08)
          : 0.92;

        if (video.playbackRate !== targetRate) {
          video.playbackRate = targetRate;
        }

        const badgeText = targetRate > 1.0
          ? `⚡ Syncing +${Math.round((targetRate - 1) * 100)}%`
          : `⚡ Syncing -${Math.round((1 - targetRate) * 100)}%`;

        setSyncBadge({ isCatchingUp: true, text: badgeText });
        if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), targetRate);
        return;
      }

      // Hard seek fallback: only if drift > 3.5s and cooldown passed (6 seconds)
      if (absDriftSeconds > 3.5 && (now - lastHardSeekTimeRef.current > 6000)) {
        isInternalUpdateRef.current = true;
        video.currentTime = authoritativeTime;
        video.playbackRate = 1.0;
        lastHardSeekTimeRef.current = now;
        setSyncBadge({ isCatchingUp: true, text: '⚡ Re-aligned' });
        setTimeout(() => setSyncBadge(null), 1500);
        if (onDriftUpdate) onDriftUpdate(Math.round(driftSeconds * 1000), 1.0);
        setTimeout(() => {
          isInternalUpdateRef.current = false;
        }, 500);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isHost, getAuthoritativePosition, onDriftUpdate]);

  return (
    <div className="relative w-full h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-cinema-border/50">
      {/* Smart Sync Catch-up Indicator Badge */}
      {syncBadge && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[11px] font-semibold tracking-wide shadow-lg shadow-black/40 animate-pulse select-none pointer-events-none">
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>{syncBadge.text}</span>
        </div>
      )}

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
