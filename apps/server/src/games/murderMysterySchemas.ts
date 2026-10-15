import { z } from 'zod';
import { MURDER_MOTIVE_MAX, MURDER_WHISPER_MAX } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

/** Payload schemas of the Murder Mystery Night websocket messages (unknown keys are dropped, wrong types are refused). */
export const murderPickCaseSchema = z.object({
  caseId: z.string().min(1).max(60)
});

export const murderWhisperSchema = z.object({
  toUserId: z.string().min(1).max(120),
  text: z.string().max(MURDER_WHISPER_MAX * 4)
});

export const murderShareClueSchema = z.object({
  clueId: z.string().min(1).max(60)
});

export const murderAccuseSchema = z.object({
  characterId: z.string().min(1).max(60),
  motive: z.string().max(MURDER_MOTIVE_MAX * 4).default('')
});

/** Parses a message payload; any mismatch becomes a GameRuleError the player sees as game:error INVALID_INPUT. */
export function parseMurderPayload<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid request');
  }
  return parsed.data;
}
