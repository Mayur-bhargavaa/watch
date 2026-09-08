/**
 * Section 9: VideoProvider Abstraction
 * Decouples the viewing engine from specific video streaming providers.
 */

export interface VideoProvider {
  /** Provider identifier (e.g. "youtube", "vimeo", "html5", "external_session") */
  name: string;

  /** Checks if the given URL can be embedded directly in the application */
  canEmbed(url: string): boolean;

  /** Initializes and mounts the player in the given DOM container */
  load(container: HTMLElement, url: string): Promise<void>;

  /** Commands playback to start */
  play(): Promise<void>;

  /** Commands playback to pause */
  pause(): Promise<void>;

  /** Commands player to seek to a specific position in seconds */
  seek(position: number): Promise<void>;

  /** Retrieves current player playback time in seconds */
  getCurrentTime(): number;

  /** Retrieves total video duration in seconds */
  getDuration(): number;

  /** Cleans up player instances, event listeners, and DOM nodes */
  destroy(): void;
}

export type ProviderType = 'youtube' | 'vimeo' | 'html5' | 'external_session';

export interface ProviderDetectionResult {
  provider: ProviderType;
  canEmbed: boolean;
  mediaId?: string;
  normalizedUrl: string;
  warningMessage?: string;
}

export const NON_EMBEDDABLE_WARNING =
  'This provider cannot be embedded directly. Watch together using the supported external-session mode.';

/**
 * Detects whether a URL is supported and whether it can be embedded directly
 * or requires compliant external-session synchronization.
 */
export function detectVideoProvider(rawUrl: string): ProviderDetectionResult {
  const url = rawUrl.trim();

  // 1. YouTube Detection
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      provider: 'youtube',
      canEmbed: true,
      mediaId: ytMatch[1],
      normalizedUrl: url
    };
  }

  // 2. Vimeo Detection
  const vimeoMatch = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|))(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      provider: 'vimeo',
      canEmbed: true,
      mediaId: vimeoMatch[1],
      normalizedUrl: url
    };
  }

  // 3. Direct HTML5 Video File (mp4, webm, ogg, m3u8)
  if (/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url)) {
    return {
      provider: 'html5',
      canEmbed: true,
      normalizedUrl: url
    };
  }

  // 4. Closed / DRM OTT Providers (Netflix, Disney+, Prime Video, Hulu, Max, etc.)
  // Strictly adhering to Section 2 & Section 9: Do NOT attempt to bypass.
  return {
    provider: 'external_session',
    canEmbed: false,
    normalizedUrl: url,
    warningMessage: NON_EMBEDDABLE_WARNING
  };
}
