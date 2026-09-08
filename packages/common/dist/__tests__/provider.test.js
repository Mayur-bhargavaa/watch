"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const provider_js_1 = require("../provider.js");
(0, node_test_1.default)('Provider Abstraction - Detection & Embedding Policy', () => {
    // YouTube Detection
    const yt = (0, provider_js_1.detectVideoProvider)('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    strict_1.default.equal(yt.provider, 'youtube');
    strict_1.default.equal(yt.canEmbed, true);
    strict_1.default.equal(yt.mediaId, 'dQw4w9WgXcQ');
    // Vimeo Detection
    const vimeo = (0, provider_js_1.detectVideoProvider)('https://vimeo.com/76979871');
    strict_1.default.equal(vimeo.provider, 'vimeo');
    strict_1.default.equal(vimeo.canEmbed, true);
    strict_1.default.equal(vimeo.mediaId, '76979871');
    // Direct HTML5 Video Detection
    const html5 = (0, provider_js_1.detectVideoProvider)('https://example.com/stream.mp4');
    strict_1.default.equal(html5.provider, 'html5');
    strict_1.default.equal(html5.canEmbed, true);
    // External / Non-embeddable OTT Providers (Netflix, Prime, Disney+)
    const netflix = (0, provider_js_1.detectVideoProvider)('https://www.netflix.com/watch/81234567');
    strict_1.default.equal(netflix.provider, 'external_session');
    strict_1.default.equal(netflix.canEmbed, false);
    strict_1.default.equal(netflix.warningMessage, provider_js_1.NON_EMBEDDABLE_WARNING);
    const disney = (0, provider_js_1.detectVideoProvider)('https://www.disneyplus.com/video/12345');
    strict_1.default.equal(disney.provider, 'external_session');
    strict_1.default.equal(disney.canEmbed, false);
    strict_1.default.equal(disney.warningMessage, provider_js_1.NON_EMBEDDABLE_WARNING);
});
//# sourceMappingURL=provider.test.js.map