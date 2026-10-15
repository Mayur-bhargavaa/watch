import { z } from 'zod';
import { IMPOSTER_CLUE_MAX_LENGTH, IMPOSTER_GUESS_MAX_LENGTH, IMPOSTER_ROUND_OPTIONS } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

/** Payload schemas of the Imposter websocket messages (unknown keys are dropped, wrong types are refused). */
export const imposterStartSchema = z.object({
  rounds: z.number().int().refine((n) => IMPOSTER_ROUND_OPTIONS.includes(n), { message: `rounds must be ${IMPOSTER_ROUND_OPTIONS.join(' or ')}` }).default(IMPOSTER_ROUND_OPTIONS[0])
});

export const imposterClueSchema = z.object({
  word: z.string().min(1).max(IMPOSTER_CLUE_MAX_LENGTH)
});

export const imposterVoteSchema = z.object({
  targetUserId: z.string().min(1).max(120)
});

export const imposterGuessSchema = z.object({
  guess: z.string().min(1).max(IMPOSTER_GUESS_MAX_LENGTH)
});

/** Parses a message payload; any mismatch becomes a GameRuleError the player sees as game:error INVALID_INPUT. */
export function parseImposterPayload<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid request');
  }
  return parsed.data;
}
