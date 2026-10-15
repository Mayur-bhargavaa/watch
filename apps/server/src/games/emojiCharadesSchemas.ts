import { z } from 'zod';
import { EMOJI_CHARADES_GUESS_MAX_LENGTH, EMOJI_CHARADES_MODES, EMOJI_CHARADES_ROUND_OPTIONS } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

/** Payload schemas of the Emoji Charades websocket messages (unknown keys are dropped, wrong types are refused). */
export const emojiCharadesStartSchema = z.object({
  rounds: z.number().int().refine((n) => EMOJI_CHARADES_ROUND_OPTIONS.includes(n), { message: `rounds must be ${EMOJI_CHARADES_ROUND_OPTIONS.join(' or ')}` }).default(EMOJI_CHARADES_ROUND_OPTIONS[0]),
  mode: z.enum(EMOJI_CHARADES_MODES).default(EMOJI_CHARADES_MODES[0])
});

export const emojiCharadesGuessSchema = z.object({
  guess: z.string().min(1).max(EMOJI_CHARADES_GUESS_MAX_LENGTH)
});

/** Parses a message payload; any mismatch becomes a GameRuleError the player sees as game:error INVALID_INPUT. */
export function parseEmojiCharadesPayload<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid request');
  }
  return parsed.data;
}
