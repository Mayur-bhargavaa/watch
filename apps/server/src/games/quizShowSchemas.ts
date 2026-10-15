import { z } from 'zod';
import {
  QUIZ_ANSWER_MAX,
  QUIZ_BUZZER_QUESTION_SEC,
  QUIZ_DEFAULT_POINTS,
  QUIZ_DEFAULT_TIME_LIMIT,
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_NOTE_MAX,
  QUIZ_OPTION_MAX,
  QUIZ_POINT_VALUES,
  QUIZ_TEXT_MAX,
  QUIZ_TIME_LIMITS,
  QuizPointValue,
  QuizQuestionInput
} from '@synccinema/common';
import { GameRuleError } from './GameRuleError.js';

/** Strips control / invisible characters, collapses every run of whitespace to one space and trims. User text only ever reaches the UI as plain text. */
export function sanitizeQuizText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A sanitised text field: at most `max` characters AFTER cleaning (a hard cap on the raw input stops huge payloads early). */
const cleanText = (max: number, label: string, opts: { min?: number } = {}) =>
  z
    .string({ invalid_type_error: `${label} must be text` })
    .max(max * 6, `${label} is too long`)
    .transform(sanitizeQuizText)
    .pipe(z.string().min(opts.min ?? 0, `${label} cannot be empty`).max(max, `${label} can be at most ${max} characters`));

/**
 * One question as the host writes it. The result is canonical: a BUZZER question always has no options, correctIndex -1 and the
 * fixed 45 s clock; a MULTIPLE_CHOICE question has 2 to 4 distinct options and exactly one correct index.
 */
export const quizQuestionInputSchema = z
  .object({
    type: z.enum(['MULTIPLE_CHOICE', 'BUZZER'], { errorMap: () => ({ message: 'Question type must be MULTIPLE_CHOICE or BUZZER' }) }),
    text: cleanText(QUIZ_TEXT_MAX, 'The question', { min: 1 }),
    options: z.array(z.string({ invalid_type_error: 'Options must be text' }).max(QUIZ_OPTION_MAX * 6, 'An option is too long')).max(12, 'Too many options').optional(),
    correctIndex: z.number().int().optional(),
    timeLimitSec: z.number().int().optional(),
    points: z.number().int().optional(),
    note: cleanText(QUIZ_NOTE_MAX, 'The note').optional()
  })
  .transform((q, ctx): QuizQuestionInput => {
    const fail = (message: string, path: string[] = []): never => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
      return z.NEVER;
    };
    const points = q.points ?? QUIZ_DEFAULT_POINTS;
    if (!(QUIZ_POINT_VALUES as readonly number[]).includes(points)) fail(`Points must be ${QUIZ_POINT_VALUES.join(', ')}`, ['points']);
    const note = q.note ?? '';
    if (q.type === 'BUZZER') {
      return { type: 'BUZZER', text: q.text, options: [], correctIndex: -1, timeLimitSec: QUIZ_BUZZER_QUESTION_SEC, points: points as QuizPointValue, note };
    }
    const options = (q.options ?? []).map(sanitizeQuizText);
    if (options.length < QUIZ_MIN_OPTIONS || options.length > QUIZ_MAX_OPTIONS) fail(`A multiple choice question needs ${QUIZ_MIN_OPTIONS} to ${QUIZ_MAX_OPTIONS} options`, ['options']);
    options.forEach((o, i) => {
      if (!o) fail(`Option ${i + 1} cannot be empty`, ['options', String(i)]);
      if (o.length > QUIZ_OPTION_MAX) fail(`An option can be at most ${QUIZ_OPTION_MAX} characters`, ['options', String(i)]);
    });
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) fail('Options must be different from each other', ['options']);
    if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= options.length) fail('Pick exactly one correct option', ['correctIndex']);
    const timeLimitSec = q.timeLimitSec ?? QUIZ_DEFAULT_TIME_LIMIT;
    if (!(QUIZ_TIME_LIMITS as readonly number[]).includes(timeLimitSec)) fail(`Time limit must be ${QUIZ_TIME_LIMITS.join(', ')} seconds`, ['timeLimitSec']);
    return { type: 'MULTIPLE_CHOICE', text: q.text, options, correctIndex: q.correctIndex as number, timeLimitSec, points: points as QuizPointValue, note };
  });

const questionId = z.string().min(1).max(40);

export const quizEditSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), question: quizQuestionInputSchema }),
  z.object({ op: z.literal('update'), id: questionId, question: quizQuestionInputSchema }),
  z.object({ op: z.literal('delete'), id: questionId }),
  z.object({ op: z.literal('move'), id: questionId, direction: z.enum(['up', 'down']) }),
  z.object({ op: z.literal('starter') }),
  z.object({ op: z.literal('clear') })
]);

export const quizAnswerSchema = z.object({
  questionId,
  optionIndex: z.number().int().min(0).max(QUIZ_MAX_OPTIONS - 1)
});

export const quizBuzzSchema = z.object({ questionId });

export const quizBuzzAnswerSchema = z.object({
  questionId,
  text: cleanText(QUIZ_ANSWER_MAX, 'The answer', { min: 1 })
});

export const quizJudgeSchema = z.object({ questionId, correct: z.boolean() });

export const quizControlSchema = z.object({ action: z.enum(['skip', 'reveal', 'next', 'end']) });

/** Parses a message payload; any mismatch becomes a GameRuleError the player sees as game:error INVALID_INPUT. */
export function parseQuizPayload<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new GameRuleError('INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid request');
  }
  return parsed.data;
}
