import { Plan, RSVPStatus, PlanChatMessage } from '../types/plans';
import {
  getApiPlans,
  createApiPlan,
  updateApiPlan,
  updateApiPlanRSVP,
  voteApiPlanOption,
  sendApiPlanChatMessage,
  deleteApiPlan,
  getStoredSession
} from './api';

const STORAGE_KEY = 'stitchbyte_watch_plans_v5';

export const SEED_PLANS: Plan[] = [
  {
    id: 'plan-1789841556778',
    hostId: 'usr_hN35KGS9RX',
    title: 'Friday Movie & Game Night',
    emoji: '🍿',
    type: 'movie',
    date: '2026-09-27',
    dateFormatted: 'Sunday, September 27',
    time: '9:00 PM',
    endTime: '12:30 AM',
    timezone: 'IST',
    description: 'Watching a movie together and then jumping straight into a Ludo showdown!',
    activities: [
      {
        id: 'act-1',
        type: 'movie',
        time: '9:00 PM',
        title: 'Interstellar',
        subtitle: '2h 49m · Watch Together',
        actionLabel: 'Enter Cinema',
        actionUrl: '/dashboard?autojoin=interstellar',
        movieDetails: {
          title: 'Interstellar',
          duration: '2h 49m',
          provider: 'youtube',
          posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80'
        }
      },
      {
        id: 'act-2',
        type: 'game',
        time: '11:50 PM',
        title: 'Ludo Party',
        subtitle: '2–4 Players · Classic Board Game',
        actionLabel: 'Play Together',
        actionUrl: '/games/ludo'
      },
      {
        id: 'act-3',
        type: 'hangout',
        time: '12:30 AM',
        title: 'Late Night Chat',
        subtitle: 'Open Discussion · Voice / Video',
        actionLabel: 'Join Chat',
        actionUrl: '/rooms'
      }
    ],
    participants: [
      {
        userId: 'usr_hN35KGS9RX',
        displayName: 'Mayur Bhargava',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        status: 'GOING',
        isHost: true
      },
      {
        userId: 'usr_-jq7XMcBhu',
        displayName: 'Mayur. 1',
        avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
        status: 'GOING'
      },
      {
        userId: 'usr_rahul',
        displayName: 'Rahul',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        status: 'GOING'
      },
      {
        userId: 'usr_mansi',
        displayName: 'Mansi',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
        status: 'GOING'
      },
      {
        userId: 'usr_dhruv',
        displayName: 'Dhruv',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        status: 'GOING'
      },
      {
        userId: 'usr_kunal',
        displayName: 'Kunal',
        avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
        status: 'CANT_GO'
      }
    ],
    reminder: '30m',
    recurring: 'none',
    chatMessages: [
      {
        id: 'm1',
        userId: 'usr_rahul',
        displayName: 'Rahul',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        text: "Can't wait for this! 🚀",
        createdAt: Date.now() - 120000
      },
      {
        id: 'm2',
        userId: 'usr_mansi',
        displayName: 'Mansi',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
        text: 'Interstellar is perfect! ✨',
        createdAt: Date.now() - 300000
      },
      {
        id: 'm3',
        userId: 'usr_dhruv',
        displayName: 'Dhruv',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        text: 'Ludo after is crazy 😂',
        createdAt: Date.now() - 480000
      }
    ],
    createdAt: Date.now() - 3600000,
    isPast: false
  }
];

const DUMMY_PLAN_IDS = new Set([
  'plan-friday-night',
  'plan-rahuls-birthday',
  'plan-ludo-night',
  'plan-retro-cinema'
]);

export function getPlans(): Plan[] {
  if (typeof window === 'undefined') return SEED_PLANS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return SEED_PLANS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any stale dummy plans from older versions of localStorage
      const realOnly = parsed.filter((p: Plan) => p && !DUMMY_PLAN_IDS.has(p.id));
      if (realOnly.length === 0) {
        savePlans(SEED_PLANS);
        return SEED_PLANS;
      }
      return realOnly;
    }
    return SEED_PLANS;
  } catch {
    return SEED_PLANS;
  }
}

export function savePlans(plans: Plan[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (err) {
    console.warn('Failed to save plans to localStorage:', err);
  }
}

export function getPlanById(id: string): Plan | undefined {
  if (DUMMY_PLAN_IDS.has(id)) return undefined;
  const plans = getPlans();
  const found = plans.find((p) => p.id === id);
  if (found) return found;
  return SEED_PLANS.find((p) => p.id === id);
}

export function inviteParticipant(
  planId: string,
  participant: { userId: string; displayName: string; avatarUrl?: string | null; status?: RSVPStatus }
): Plan | undefined {
  const plans = getPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return undefined;

  const existingIdx = plan.participants.findIndex((p) => p.userId === participant.userId);
  if (existingIdx === -1) {
    plan.participants.push({
      userId: participant.userId,
      displayName: participant.displayName,
      avatarUrl: participant.avatarUrl,
      status: participant.status || 'GOING',
      isHost: false
    });
    savePlans([...plans]);
    try {
      const session = getStoredSession();
      updateApiPlan(planId, { participants: plan.participants }, session?.token).catch(() => {});
    } catch {}
  }
  return plan;
}

export function addPlan(plan: Plan): void {
  const plans = getPlans();
  const updated = [plan, ...plans];
  savePlans(updated);

  // Sync with real server backend
  try {
    const session = getStoredSession();
    createApiPlan(plan, session?.token).catch((err) => {
      console.warn('Failed to sync plan to server:', err);
    });
  } catch {}
}

export function deletePlan(id: string): void {
  const plans = getPlans();
  const updated = plans.filter((p) => p.id !== id);
  savePlans(updated);

  try {
    const session = getStoredSession();
    deleteApiPlan(id, session?.token).catch((err) => {
      console.warn('Failed to delete plan from server:', err);
    });
  } catch {}
}

export function updatePlan(id: string, updates: Partial<Plan>): Plan | undefined {
  const plans = getPlans();
  const idx = plans.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;
  const updatedPlan = { ...plans[idx], ...updates };
  plans[idx] = updatedPlan;
  savePlans([...plans]);

  try {
    const session = getStoredSession();
    updateApiPlan(id, updates, session?.token).catch(() => {});
  } catch {}

  return updatedPlan;
}

export function updateRSVP(planId: string, userId: string, status: RSVPStatus, displayName = 'You', avatarUrl?: string | null): Plan | undefined {
  const plans = getPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return undefined;

  const existingIdx = plan.participants.findIndex((p) => p.userId === userId);
  if (existingIdx !== -1) {
    plan.participants[existingIdx].status = status;
  } else {
    plan.participants.push({
      userId,
      displayName,
      avatarUrl,
      status
    });
  }

  savePlans([...plans]);

  try {
    const session = getStoredSession();
    updateApiPlanRSVP(planId, { userId, displayName, avatarUrl, status }, session?.token).catch(() => {});
  } catch {}

  return plan;
}

export function voteOption(planId: string, optionId: string, userId: string): Plan | undefined {
  const plans = getPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan || !plan.voting) return undefined;

  // Toggle user's vote
  plan.voting.options.forEach((opt) => {
    if (opt.id === optionId) {
      if (opt.votes.includes(userId)) {
        opt.votes = opt.votes.filter((id) => id !== userId);
      } else {
        opt.votes.push(userId);
      }
    } else {
      // Single vote per question
      opt.votes = opt.votes.filter((id) => id !== userId);
    }
  });

  savePlans([...plans]);

  try {
    const session = getStoredSession();
    voteApiPlanOption(planId, { optionId, userId }, session?.token).catch(() => {});
  } catch {}

  return plan;
}

export function addPlanChatMessage(planId: string, message: Omit<PlanChatMessage, 'id' | 'createdAt'>): PlanChatMessage | undefined {
  const plans = getPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return undefined;

  const newMsg: PlanChatMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    createdAt: Date.now()
  };

  plan.chatMessages = [...(plan.chatMessages || []), newMsg];
  savePlans([...plans]);

  try {
    const session = getStoredSession();
    sendApiPlanChatMessage(planId, {
      userId: message.userId,
      displayName: message.displayName,
      avatarUrl: message.avatarUrl,
      text: message.text
    }, session?.token).catch(() => {});
  } catch {}

  return newMsg;
}

export async function fetchPlansFromServer(): Promise<Plan[]> {
  try {
    const session = getStoredSession();
    const res = await getApiPlans(session?.token);
    if (res?.plans && Array.isArray(res.plans)) {
      savePlans(res.plans);
      return res.plans;
    }
  } catch (err) {
    console.warn('Could not sync plans from server, using local store:', err);
  }
  return getPlans();
}
