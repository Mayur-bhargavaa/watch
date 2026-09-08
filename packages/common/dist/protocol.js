"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceStatePayloadSchema = exports.VoiceSignalPayloadSchema = exports.HostTransferPayloadSchema = exports.MediaChangePayloadSchema = exports.ChatSendPayloadSchema = exports.ReactionSendPayloadSchema = exports.PlaybackBufferPayloadSchema = exports.PlaybackCommandPayloadSchema = exports.RoomJoinPayloadSchema = exports.SyncPingPayloadSchema = void 0;
const zod_1 = require("zod");
// Client -> Server Payloads
exports.SyncPingPayloadSchema = zod_1.z.object({
    t1: zod_1.z.number()
});
exports.RoomJoinPayloadSchema = zod_1.z.object({
    guestName: zod_1.z.string().min(1).max(32).optional(),
    avatarUrl: zod_1.z.string().url().optional()
});
exports.PlaybackCommandPayloadSchema = zod_1.z.object({
    action: zod_1.z.enum(['PLAY', 'PAUSE', 'SEEK']),
    position: zod_1.z.number().min(0),
    version: zod_1.z.number().int().nonnegative()
});
exports.PlaybackBufferPayloadSchema = zod_1.z.object({
    isBuffering: zod_1.z.boolean(),
    position: zod_1.z.number().min(0)
});
exports.ReactionSendPayloadSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(16),
    emoji: zod_1.z.string().min(1).max(8),
    mediaTimestamp: zod_1.z.number().min(0)
});
exports.ChatSendPayloadSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(1000),
    mediaTimestamp: zod_1.z.number().min(0).optional().nullable()
});
exports.MediaChangePayloadSchema = zod_1.z.object({
    sourceUrl: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1).max(255),
    provider: zod_1.z.enum(['youtube', 'direct_html5', 'ott_fallback', 'netflix', 'disney', 'prime']),
    providerMediaId: zod_1.z.string().optional(),
    posterUrl: zod_1.z.string().url().optional(),
    durationSeconds: zod_1.z.number().min(0).default(0)
});
exports.HostTransferPayloadSchema = zod_1.z.object({
    targetUserId: zod_1.z.string().min(1)
});
exports.VoiceSignalPayloadSchema = zod_1.z.object({
    targetUserId: zod_1.z.string().min(1),
    signal: zod_1.z.any()
});
exports.VoiceStatePayloadSchema = zod_1.z.object({
    isMuted: zod_1.z.boolean(),
    isDeafened: zod_1.z.boolean(),
    isSpeaking: zod_1.z.boolean()
});
//# sourceMappingURL=protocol.js.map