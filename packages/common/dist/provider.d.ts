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
export declare const NON_EMBEDDABLE_WARNING = "This provider cannot be embedded directly. Watch together using the supported external-session mode.";
/**
 * Detects whether a URL is supported and whether it can be embedded directly
 * or requires compliant external-session synchronization.
 */
export declare function detectVideoProvider(rawUrl: string): ProviderDetectionResult;
//# sourceMappingURL=provider.d.ts.map