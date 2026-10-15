import { z } from 'zod';
import { GameRuleError } from './GameRuleError.js';

/** Payload schemas of the Mafia Night websocket messages (unknown keys are dropped, wrong types are refused). */
export const mafiaNightActionSchema = z.object({
  action: z.enum(['kill', 'save', 'investigate']),
  targetUserId: z.string().min(1).max(120)
});

/** A vote target is a player id or the literal `skip`. */
export const mafiaNightVoteSchema = z.object({
  targetUserId: z.string().min(1).max(120)
});

/** Parses a message payload; any mismatch becomes a GameRuleError the player sees as game:error INVALID_INPUT. */
export function parseMafiaNightPayload<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid request');
  }
  return parsed.data;
}
