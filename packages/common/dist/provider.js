"use strict";
/**
 * Section 9: VideoProvider Abstraction
 * Decouples the viewing engine from specific video streaming providers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NON_EMBEDDABLE_WARNING = void 0;
exports.detectVideoProvider = detectVideoProvider;
exports.NON_EMBEDDABLE_WARNING = 'This provider cannot be embedded directly. Watch together using the supported external-session mode.';
/**
 * Detects whether a URL is supported and whether it can be embedded directly
 * or requires compliant external-session synchronization.
 */
function detectVideoProvider(rawUrl) {
    const url = rawUrl.trim();
    // 1. YouTube Detection
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
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
        warningMessage: exports.NON_EMBEDDABLE_WARNING
    };
}
//# sourceMappingURL=provider.js.map