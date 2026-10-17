import { z } from 'zod';

/**
 * Server-side payload schemas for the cinema-room WebSocket. Deliberately a little more tolerant than the
 * strict ones in @synccinema/common (real clients send optional extras), but every field the handlers read is
 * type- and range-checked, so a bad frame can never reach handler code as `undefined.x`.
 */
const finite = z.number().finite();
const shortStr = (max: number) => z.string().max(max);

// --- Cineverse party queue (strict: unknown or oversized fields are rejected, not ignored) ---
const titleKey = z.string().min(1).max(40);
const providerRef = z.object({ id: z.string().min(1).max(32), name: z.string().min(1).max(80) }).strict();
const snapshotSchema = z
  .object({
    titleKey,
    title: z.string().min(1).max(300),
    posterPath: z.string().max(100).nullable().optional(),
    year: z.number().int().min(1800).max(2200).nullable().optional(),
    mediaType: z.enum(['movie', 'tv'])
  })
  .strict();
const stateVersion = z.number().int().min(0).max(1_000_000_000).optional();
export const TITLE_PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'room:title_propose': z.object({ titleKey, snapshot: snapshotSchema, provider: providerRef.nullable().optional() }).strict(),
  'room:title_vote': z.object({ titleKey }).strict(),
  'room:title_confirm': z
    .object({
      titleKey,
      snapshot: snapshotSchema.optional(),
      provider: providerRef.nullable().optional(),
      region: z.string().length(2).optional(),
      startAt: finite.nullable().optional(),
      version: stateVersion
    })
    .strict(),
  'room:title_ready': z.object({ titleKey, version: stateVersion }).strict(),
  'room:title_clear': z.object({ version: stateVersion }).strict()
};

export const ROOM_PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'sync:ping': z.object({ t1: finite }).passthrough(),
  'playback:command': z
    .object({
      action: z.enum(['PLAY', 'PAUSE', 'SEEK']),
      position: finite.min(0).max(60 * 60 * 24 * 30),
      version: z.number().int().nonnegative().optional()
    })
    .passthrough(),
  'reaction:send': z
    .object({
      code: shortStr(32),
      emoji: z.string().min(1).max(32),
      mediaTimestamp: finite.min(0).optional()
    })
    .passthrough(),
  'chat:send': z
    .object({
      content: z.string().min(1).max(4000),
      mediaTimestamp: finite.min(0).optional().nullable(),
      replyTo: z
        .object({ id: shortStr(64), userName: shortStr(100).optional(), content: shortStr(2000).optional() })
        .passthrough()
        .optional()
        .nullable()
    })
    .passthrough(),
  'chat:delete': z.object({ messageId: z.string().min(1).max(64) }).passthrough(),
  'host:transfer': z.object({ targetUserId: z.string().min(1).max(64) }).passthrough(),
  'voice:signal': z.object({ targetUserId: z.string().min(1).max(64), signal: z.any() }).passthrough(),
  'webrtc:signal': z.object({ targetUserId: z.string().min(1).max(64), signal: z.any() }).passthrough(),
  'room:theme': z.object({ themeId: z.string().min(1).max(64) }).passthrough(),
  'presence:state': z.object({ status: z.enum(['ONLINE', 'CONNECTING', 'WATCHING', 'AWAY']) }).passthrough(),
  ...TITLE_PAYLOAD_SCHEMAS
};
