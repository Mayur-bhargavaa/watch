import { z } from 'zod';
import { TOURNAMENT_MATCH_GAMES } from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

const userId = z.string({ invalid_type_error: 'A player id is required' }).min(1, 'A player id is required').max(80, 'That player id is too long');
const matchId = z
  .string({ invalid_type_error: 'A match id is required' })
  .min(1, 'A match id is required')
  .max(24, 'That match id is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'That match id is not valid');

/** Registration settings (host only). Unknown keys are refused; at least one setting must be given. */
export const tournamentConfigSchema = z
  .object({
    game: z.enum(TOURNAMENT_MATCH_GAMES, { errorMap: () => ({ message: `The game must be one of: ${TOURNAMENT_MATCH_GAMES.join(', ')}` }) }).optional(),
    thirdPlace: z.boolean({ invalid_type_error: 'thirdPlace must be true or false' }).optional(),
    finalBestOf: z.union([z.literal(1), z.literal(3)], { errorMap: () => ({ message: 'The Final can be best of 1 or best of 3' }) }).optional()
  })
  .strict()
  .refine((c) => c.game !== undefined || c.thirdPlace !== undefined || c.finalBestOf !== undefined, { message: 'Nothing to change' });

export const tournamentKickSchema = z.object({ userId }).strict();

export const tournamentAdvanceSchema = z.object({ matchId, userId }).strict();

/** Parses a message payload; any mismatch becomes a GameRuleError the player sees as game:error INVALID_INPUT. */
export function parseTournamentPayload<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid request');
  }
  return parsed.data;
}
