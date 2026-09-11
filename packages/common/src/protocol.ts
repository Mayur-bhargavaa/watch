import { z } from 'zod';
import { Room, RoomMember, RoomPlaybackState, Reaction, ChatMessage, MediaItem, Role } from './types.js';

// Base WebSocket envelope
export interface WSMessage<T = unknown> {
  type: string;
  roomId: string;
  senderId?: string;
  timestamp: number;
  payload: T;
}

// Client -> Server Payloads
export const SyncPingPayloadSchema = z.object({
  t1: z.number()
});
export type SyncPingPayload = z.infer<typeof SyncPingPayloadSchema>;

export const RoomJoinPayloadSchema = z.object({
  guestName: z.string().min(1).max(32).optional(),
  avatarUrl: z.string().url().optional()
});
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;

export const PlaybackCommandPayloadSchema = z.object({
  action: z.enum(['PLAY', 'PAUSE', 'SEEK']),
  position: z.number().min(0),
  version: z.number().int().nonnegative()
});
export type PlaybackCommandPayload = z.infer<typeof PlaybackCommandPayloadSchema>;

export const PlaybackBufferPayloadSchema = z.object({
  isBuffering: z.boolean(),
  position: z.number().min(0)
});
export type PlaybackBufferPayload = z.infer<typeof PlaybackBufferPayloadSchema>;

export const ReactionSendPayloadSchema = z.object({
  code: z.string().min(1).max(16),
  emoji: z.string().min(1).max(8),
  mediaTimestamp: z.number().min(0)
});
export type ReactionSendPayload = z.infer<typeof ReactionSendPayloadSchema>;

export const ChatReplyToSchema = z.object({
  id: z.string(),
  userName: z.string(),
  content: z.string()
});

export const ChatSendPayloadSchema = z.object({
  content: z.string().min(1).max(1000),
  mediaTimestamp: z.number().min(0).optional().nullable(),
  replyTo: ChatReplyToSchema.optional().nullable()
});
export type ChatSendPayload = z.infer<typeof ChatSendPayloadSchema>;

export const MediaChangePayloadSchema = z.object({
  sourceUrl: z.string().min(1),
  title: z.string().min(1).max(255),
  provider: z.enum(['youtube', 'direct_html5', 'ott_fallback', 'netflix', 'disney', 'prime']),
  providerMediaId: z.string().optional(),
  posterUrl: z.string().url().optional(),
  durationSeconds: z.number().min(0).default(0)
});
export type MediaChangePayload = z.infer<typeof MediaChangePayloadSchema>;

export const HostTransferPayloadSchema = z.object({
  targetUserId: z.string().min(1)
});
export type HostTransferPayload = z.infer<typeof HostTransferPayloadSchema>;

export const VoiceSignalPayloadSchema = z.object({
  targetUserId: z.string().min(1),
  signal: z.any()
});
export type VoiceSignalPayload = z.infer<typeof VoiceSignalPayloadSchema>;

export const VoiceStatePayloadSchema = z.object({
  isMuted: z.boolean(),
  isDeafened: z.boolean(),
  isSpeaking: z.boolean()
});
export type VoiceStatePayload = z.infer<typeof VoiceStatePayloadSchema>;

// Server -> Client Payloads
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
  activeScreenPresenter?: { userId: string; displayName: string } | null;
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

export const RoomThemePayloadSchema = z.object({
  themeId: z.string().min(1).max(64)
});
export type RoomThemePayload = z.infer<typeof RoomThemePayloadSchema>;
