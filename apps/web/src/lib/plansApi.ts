/**
 * Plans API. The server is the only source of truth: no local copy, no optimistic writes that can silently
 * disagree. Every call throws an Error carrying the server's message, so screens can show it.
 */
import { API_BASE, authHeaders } from './api';
import type { Plan, PlanPreview, RSVPStatus } from '../types/plans';

export const LEGACY_PLANS_KEY = 'stitchbyte_watch_plans_v5';

async function planRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api/plans${path}`, {
    method: init.method || 'GET',
    headers: { ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as Error & { status?: number; code?: string; requiredTier?: string };
    err.status = res.status;
    if (data?.code) err.code = data.code; // UPGRADE_REQUIRED / PLAN_LIMIT_REACHED
    if (data?.requiredTier) err.requiredTier = data.requiredTier;
    throw err;
  }
  return data as T;
}

export interface CreatePlanInput {
  title: string;
  emoji?: string;
  type: Plan['type'];
  date: string;
  time: string;
  endTime?: string;
  timezone: string;
  description?: string;
  reminder: Plan['reminder'];
  recurring: NonNullable<Plan['recurring']>;
  activities: Plan['activities'];
  invitedUserIds: string[];
  voting?: { question: string; type: 'movie' | 'game'; options: { title: string; subtitle?: string }[] };
}

export const listPlans = () => planRequest<{ plans: Plan[] }>('').then((r) => r.plans);
export const getPlan = (id: string, invite?: string | null) =>
  planRequest<{ plan: Plan | PlanPreview }>(`/${encodeURIComponent(id)}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`).then((r) => r.plan);
export const createPlan = (input: CreatePlanInput) => planRequest<{ plan: Plan }>('', { method: 'POST', body: input }).then((r) => r.plan);
export const updatePlan = (id: string, updates: Partial<Omit<CreatePlanInput, 'invitedUserIds' | 'voting'>>) =>
  planRequest<{ plan: Plan }>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: updates }).then((r) => r.plan);
export const deletePlan = (id: string) => planRequest<{ success: boolean }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const rsvpPlan = (id: string, status: Exclude<RSVPStatus, 'INVITED'>) =>
  planRequest<{ plan: Plan }>(`/${encodeURIComponent(id)}/rsvp`, { method: 'POST', body: { status } }).then((r) => r.plan);
export const joinPlan = (id: string, token: string) =>
  planRequest<{ plan: Plan }>(`/${encodeURIComponent(id)}/join`, { method: 'POST', body: { token } }).then((r) => r.plan);
export const invitePlanFriends = (id: string, userIds: string[]) =>
  planRequest<{ plan: Plan; invited: number }>(`/${encodeURIComponent(id)}/invite`, { method: 'POST', body: { userIds } });
export const leavePlan = (id: string) => planRequest<{ success: boolean }>(`/${encodeURIComponent(id)}/leave`, { method: 'POST' });
export const votePlan = (id: string, optionId: string) =>
  planRequest<{ plan: Plan }>(`/${encodeURIComponent(id)}/vote`, { method: 'POST', body: { optionId } }).then((r) => r.plan);
export const addPlanVoteOption = (id: string, title: string) =>
  planRequest<{ plan: Plan }>(`/${encodeURIComponent(id)}/vote-option`, { method: 'POST', body: { title } }).then((r) => r.plan);
export const confirmPlanVote = (id: string, optionId: string) =>
  planRequest<{ plan: Plan }>(`/${encodeURIComponent(id)}/vote/confirm`, { method: 'POST', body: { optionId } }).then((r) => r.plan);
export const sendPlanChat = (id: string, text: string) =>
  planRequest<{ message: Plan['chatMessages'][number] }>(`/${encodeURIComponent(id)}/chat`, { method: 'POST', body: { text } }).then((r) => r.message);

export function isPreview(plan: Plan | PlanPreview): plan is PlanPreview {
  return (plan as PlanPreview).needsJoin === true;
}

/** Link a member can share: opens a preview with a Join button for people who are not in the plan yet. */
export function planInviteLink(plan: Pick<Plan, 'id' | 'inviteToken'>): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/plans/${plan.id}${plan.inviteToken ? `?invite=${encodeURIComponent(plan.inviteToken)}` : ''}`;
}
