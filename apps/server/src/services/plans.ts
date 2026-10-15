import { z } from 'zod';
import {
  getPlanWindow,
  isPlanPast,
  isValidPlanDate,
  parseTimeOfDay,
  safeUrl,
  REMINDER_MINUTES,
  type PlanTimeFields
} from '@synccinema/common';

/** RSVP values the UI knows. INVITED = has not answered yet. */
export const RSVP_STATUSES = ['INVITED', 'GOING', 'MAYBE', 'CANT_GO'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const MAX_ACTIVITIES = 30;
export const MAX_PARTICIPANTS = 100;
export const MAX_VOTE_OPTIONS = 12;

const noMarkup = (max: number) => z.string().max(max).transform((s) => s.replace(/[<>]/g, '').trim());
const optText = (max: number) => noMarkup(max).optional();
/** In-app paths only: an activity button must never lead off-site (phishing) or run script. */
const inAppPath = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[A-Za-z0-9\/_\-?=&%.#:+]*$/, 'Links must stay inside the app');
const httpsUrl = z
  .string()
  .max(1000)
  .refine((u) => (safeUrl(u, { maxLength: 1000 }) || '').startsWith('https://'), 'Only https links are allowed');

const idLike = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const activitySchema = z.object({
  id: idLike.optional(),
  type: z.enum(['movie', 'game', 'hangout', 'chat']),
  time: optText(20),
  title: noMarkup(120).refine((s) => s.length > 0, 'Activity title is required'),
  subtitle: optText(160),
  actionLabel: optText(40),
  actionUrl: inAppPath.optional(),
  movieDetails: z
    .object({
      title: noMarkup(150),
      duration: noMarkup(30).optional().default(''),
      provider: z.enum(['youtube', 'direct', 'screen', 'catalog']).default('youtube'),
      posterUrl: httpsUrl.optional(),
      sourceUrl: z.union([httpsUrl, inAppPath]).optional()
    })
    .optional(),
  gameDetails: z.object({ gameId: noMarkup(40), title: noMarkup(80), icon: noMarkup(8), players: noMarkup(30) }).optional()
});

const votingInputSchema = z.object({
  question: noMarkup(120),
  type: z.enum(['movie', 'game']),
  options: z
    .array(z.object({ id: idLike.optional(), title: noMarkup(80).refine((s) => s.length > 0), subtitle: optText(120), type: z.enum(['movie', 'game']).optional() }))
    .max(MAX_VOTE_OPTIONS)
});

const baseFields = {
  title: noMarkup(120).refine((s) => s.length > 0, 'Title is required'),
  emoji: noMarkup(8),
  type: z.enum(['movie', 'game', 'birthday', 'anniversary', 'party', 'hangout', 'custom']),
  tagLabel: optText(40),
  posterUrl: httpsUrl.optional(),
  posterOverlayText: optText(80),
  date: z.string().refine(isValidPlanDate, 'A valid date is required'),
  time: z.string().max(20).refine((t) => parseTimeOfDay(t) !== null, 'A valid start time is required'),
  endTime: z
    .string()
    .max(20)
    .refine((t) => t === '' || parseTimeOfDay(t) !== null, 'End time is not valid')
    .optional(),
  timezone: noMarkup(40),
  description: optText(2000),
  activities: z.array(activitySchema).max(MAX_ACTIVITIES),
  reminder: z.enum(['30m', '1h', '1d', 'none']),
  recurring: z.enum(['weekly', 'monthly', 'none'])
};

export const createPlanSchema = z.object({
  ...baseFields,
  emoji: baseFields.emoji.default(''),
  type: baseFields.type.default('custom'),
  timezone: baseFields.timezone.default('UTC (UTC+0)'),
  activities: baseFields.activities.default([]),
  reminder: baseFields.reminder.default('30m'),
  recurring: baseFields.recurring.default('none'),
  voting: votingInputSchema.optional(),
  invitedUserIds: z.array(idLike).max(MAX_PARTICIPANTS).default([])
});

/** Host edits: any descriptive field, but never participants, chat, votes, host or ids. */
export const updatePlanSchema = z.object(baseFields).partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue ? `${issue.path.join('.') || 'plan'}: ${issue.message}` : 'Invalid plan';
}

/** Time fields derived from the plan, stored next to it so Mongo can find plans that are due. */
export function planSchedule(plan: PlanTimeFields & { reminder?: string }): { startsAt: number | null; endsAt: number | null; reminderDueAt: number | null } {
  const w = getPlanWindow(plan);
  if (!w) return { startsAt: null, endsAt: null, reminderDueAt: null };
  const minutes = REMINDER_MINUTES[plan.reminder || ''];
  return { startsAt: w.startMs, endsAt: w.endMs, reminderDueAt: minutes ? w.startMs - minutes * 60_000 : null };
}

/** createdAt used to be a number for some plans and an ISO string for others. */
export function normalizeCreatedAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function isParticipant(plan: any, userId: string): boolean {
  return plan.hostId === userId || (plan.participants || []).some((p: any) => p.userId === userId);
}

/** What the API returns. Internal bookkeeping stays on the server; the invite token only goes to members. */
export function presentPlan(doc: any, viewerId: string, now = Date.now()) {
  if (!doc) return null;
  const member = isParticipant(doc, viewerId);
  const { _id, reminderSentAt, reminderDueAt, invitedUserIds, inviteToken, dateFormatted, ...rest } = doc;
  void _id; void reminderSentAt; void reminderDueAt; void invitedUserIds; void dateFormatted;
  return {
    ...rest,
    id: doc.id || doc._id,
    createdAt: normalizeCreatedAt(doc.createdAt),
    isPast: isPlanPast(doc, now),
    ...(member ? { inviteToken } : {})
  };
}

/** Minimal view for someone who only holds an invite link. */
export function presentPlanPreview(doc: any, now = Date.now()) {
  const host = (doc.participants || []).find((p: any) => p.userId === doc.hostId);
  return {
    id: doc.id || doc._id,
    title: doc.title,
    emoji: doc.emoji,
    type: doc.type,
    date: doc.date,
    time: doc.time,
    endTime: doc.endTime,
    timezone: doc.timezone,
    hostName: host?.displayName || 'A friend',
    participantCount: (doc.participants || []).length,
    isPast: isPlanPast(doc, now),
    needsJoin: true
  };
}
