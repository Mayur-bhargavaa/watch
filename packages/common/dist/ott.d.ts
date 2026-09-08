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
export declare function detectProviderFromUrl(url: string): {
    provider: MediaItem['provider'];
    providerMediaId?: string;
};
//# sourceMappingURL=ott.d.ts.map