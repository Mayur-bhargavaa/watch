import { MediaItem, PlaybackStateEnum } from './types.js';

export interface OTTAdapter {
  readonly providerName: string;
  readonly isEmbedded: boolean;

  /**
   * Initializes player in container with given media.
   */
  init(container: HTMLElement, media: MediaItem): Promise<void>;

  /**
   * Commands playback to play.
   */
  play(): Promise<void>;

  /**
   * Commands playback to pause.
   */
  pause(): Promise<void>;

  /**
   * Seeks to specific seconds.
   */
  seek(positionSeconds: number): Promise<void>;

  /**
   * Sets subtle playback rate for drift correction.
   */
  setPlaybackRate(rate: number): Promise<void>;

  /**
   * Retrieves current player time in seconds.
   */
  getCurrentTime(): Promise<number>;

  /**
   * Retrieves player duration in seconds.
   */
  getDuration(): Promise<number>;

  /**
   * Retrieves current player state.
   */
  getPlaybackState(): Promise<PlaybackStateEnum>;

  /**
   * Registers listener for player events (state change, time update, buffering).
   */
  onStateChange(listener: (state: PlaybackStateEnum, position: number) => void): void;

  /**
   * Cleans up player instances, listeners, and dom elements.
   */
  destroy(): void;
}

/**
 * Detects provider from URL or input
 */
export function detectProviderFromUrl(url: string): {
  provider: MediaItem['provider'];
  providerMediaId?: string;
} {
  const trimmed = url.trim();
  
  // YouTube detection
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      provider: 'youtube',
      providerMediaId: ytMatch[1]
    };
  }

  // Direct video file extensions
  if (/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(trimmed)) {
    return {
      provider: 'direct_html5'
    };
  }

  // Netflix check
  if (/netflix\.com\/watch/i.test(trimmed)) {
    return { provider: 'netflix' };
  }

  // Disney+ check
  if (/disneyplus\.com/i.test(trimmed)) {
    return { provider: 'disney' };
  }

  // Prime Video check
  if (/primevideo\.com|amazon\.com\/(gp\/video|dp)/i.test(trimmed)) {
    return { provider: 'prime' };
  }

  // Default fallback for external media
  return {
    provider: 'ott_fallback'
  };
}
