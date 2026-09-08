"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectProviderFromUrl = detectProviderFromUrl;
/**
 * Detects provider from URL or input
 */
function detectProviderFromUrl(url) {
    const trimmed = url.trim();
    // YouTube detection
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
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
//# sourceMappingURL=ott.js.map