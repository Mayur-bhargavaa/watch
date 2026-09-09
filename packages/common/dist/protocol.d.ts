import { z } from 'zod';
import { Room, RoomMember, RoomPlaybackState, Reaction, ChatMessage, Role } from './types.js';
export interface WSMessage<T = unknown> {
    type: string;
    roomId: string;
    senderId?: string;
    timestamp: number;
    payload: T;
}
export declare const SyncPingPayloadSchema: z.ZodObject<{
    t1: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    t1: number;
}, {
    t1: number;
}>;
export type SyncPingPayload = z.infer<typeof SyncPingPayloadSchema>;
export declare const RoomJoinPayloadSchema: z.ZodObject<{
    guestName: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guestName?: string | undefined;
    avatarUrl?: string | undefined;
}, {
    guestName?: string | undefined;
    avatarUrl?: string | undefined;
}>;
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;
export declare const PlaybackCommandPayloadSchema: z.ZodObject<{
    action: z.ZodEnum<["PLAY", "PAUSE", "SEEK"]>;
    position: z.ZodNumber;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    action: "PLAY" | "PAUSE" | "SEEK";
    position: number;
    version: number;
}, {
    action: "PLAY" | "PAUSE" | "SEEK";
    position: number;
    version: number;
}>;
export type PlaybackCommandPayload = z.infer<typeof PlaybackCommandPayloadSchema>;
export declare const PlaybackBufferPayloadSchema: z.ZodObject<{
    isBuffering: z.ZodBoolean;
    position: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    position: number;
    isBuffering: boolean;
}, {
    position: number;
    isBuffering: boolean;
}>;
export type PlaybackBufferPayload = z.infer<typeof PlaybackBufferPayloadSchema>;
export declare const ReactionSendPayloadSchema: z.ZodObject<{
    code: z.ZodString;
    emoji: z.ZodString;
    mediaTimestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    emoji: string;
    mediaTimestamp: number;
}, {
    code: string;
    emoji: string;
    mediaTimestamp: number;
}>;
export type ReactionSendPayload = z.infer<typeof ReactionSendPayloadSchema>;
export declare const ChatSendPayloadSchema: z.ZodObject<{
    content: z.ZodString;
    mediaTimestamp: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    mediaTimestamp?: number | null | undefined;
}, {
    content: string;
    mediaTimestamp?: number | null | undefined;
}>;
export type ChatSendPayload = z.infer<typeof ChatSendPayloadSchema>;
export declare const MediaChangePayloadSchema: z.ZodObject<{
    sourceUrl: z.ZodString;
    title: z.ZodString;
    provider: z.ZodEnum<["youtube", "direct_html5", "ott_fallback", "netflix", "disney", "prime"]>;
    providerMediaId: z.ZodOptional<z.ZodString>;
    posterUrl: z.ZodOptional<z.ZodString>;
    durationSeconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sourceUrl: string;
    title: string;
    provider: "youtube" | "direct_html5" | "ott_fallback" | "netflix" | "disney" | "prime";
    durationSeconds: number;
    providerMediaId?: string | undefined;
    posterUrl?: string | undefined;
}, {
    sourceUrl: string;
    title: string;
    provider: "youtube" | "direct_html5" | "ott_fallback" | "netflix" | "disney" | "prime";
    providerMediaId?: string | undefined;
    posterUrl?: string | undefined;
    durationSeconds?: number | undefined;
}>;
export type MediaChangePayload = z.infer<typeof MediaChangePayloadSchema>;
export declare const HostTransferPayloadSchema: z.ZodObject<{
    targetUserId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    targetUserId: string;
}, {
    targetUserId: string;
}>;
export type HostTransferPayload = z.infer<typeof HostTransferPayloadSchema>;
export declare const VoiceSignalPayloadSchema: z.ZodObject<{
    targetUserId: z.ZodString;
    signal: z.ZodAny;
}, "strip", z.ZodTypeAny, {
    targetUserId: string;
    signal?: any;
}, {
    targetUserId: string;
    signal?: any;
}>;
export type VoiceSignalPayload = z.infer<typeof VoiceSignalPayloadSchema>;
export declare const VoiceStatePayloadSchema: z.ZodObject<{
    isMuted: z.ZodBoolean;
    isDeafened: z.ZodBoolean;
    isSpeaking: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    isMuted: boolean;
    isDeafened: boolean;
    isSpeaking: boolean;
}, {
    isMuted: boolean;
    isDeafened: boolean;
    isSpeaking: boolean;
}>;
export type VoiceStatePayload = z.infer<typeof VoiceStatePayloadSchema>;
export interface SyncPongPayload {
    t1: number;
    serverTime: number;
}
export interface RoomStateSnapshotPayload {
    room: Room;
    members: RoomMember[];
    myRole: Role;
    myUserId?: string;
    serverTimestamp: number;
    recentChat: ChatMessage[];
    recentReactions: Reaction[];
    activeScreenPresenter?: {
        userId: string;
        displayName: string;
    } | null;
}
export interface PlaybackUpdatePayload {
    playbackState: RoomPlaybackState;
    actorId?: string;
}
export interface PresenceUpdatePayload {
    member: RoomMember;
    status: 'JOINED' | 'LEFT' | 'DISCONNECTED' | 'RECONNECTED';
}
export interface ScreenStatePayload {
    isSharing: boolean;
    presenterId?: string | null;
    presenterName?: string | null;
}
export interface WebRTCSignalPayload {
    fromUserId?: string;
    targetUserId?: string;
    signal: any;
}
export interface ErrorNotificationPayload {
    code: string;
    message: string;
}
export interface RoomEndedPayload {
    reason: 'HOST_ENDED' | 'ROOM_CLOSED';
    message: string;
}
export declare const RoomThemePayloadSchema: z.ZodObject<{
    themeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    themeId: string;
}, {
    themeId: string;
}>;
export type RoomThemePayload = z.infer<typeof RoomThemePayloadSchema>;
//# sourceMappingURL=protocol.d.ts.map