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
  },
  {
    id: 'plan-friday-night',
    title: 'Friday Night',
    emoji: '🍿',
    type: 'movie',
    tagLabel: 'Movie + Game',
    posterUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
    posterOverlayText: 'INTERSTELLAR',
    date: '2024-09-27',
    dateFormatted: 'Sat, 27 September',
    time: '9:00 PM – 1:00 AM (IST)',
    timezone: 'IST',
    description: 'A movie, a game, and great company.',
    activities: [
      {
        id: 'act-1',
        type: 'movie',
        time: '9:00 PM',
        title: 'Interstellar',
        subtitle: 'Duration: 2h 49m · 4K IMAX',
        actionLabel: 'Enter Cinema',
        actionUrl: '/dashboard?autojoin=interstellar',
        movieDetails: {
          title: 'Interstellar',
          duration: '2h 49m',
          provider: 'youtube',
          posterUrl: 'https://img.youtube.com/vi/zSWdZVtXT7E/maxresdefault.jpg',
          sourceUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E'
        }
      },
      {
        id: 'act-2',
        type: 'game',
        time: '11:50 PM',
        title: 'Ludo Party',
        subtitle: 'After the movie · 4 Players',
        actionLabel: 'Play Together',
        actionUrl: '/games/ludo',
        gameDetails: {
          gameId: 'ludo',
          title: 'Ludo Party',
          icon: '🎲',
          players: '2-4 Players'
        }
      },
      {
        id: 'act-3',
        type: 'hangout',
        time: '12:30 AM',
        title: 'Late Night Chat',
        subtitle: 'Hangout & recap thoughts',
        actionLabel: 'Join Chat'
      }
    ],
    participants: [
      { userId: 'user-mayur', displayName: 'Mayur', avatarUrl: '/avatars/batman.png', status: 'GOING', isHost: true },
      { userId: 'user-rahul', displayName: 'Rahul', avatarUrl: '/avatars/deadpool.png', status: 'GOING' },
      { userId: 'user-dhruv', displayName: 'Dhruv', avatarUrl: '/avatars/ironman.png', status: 'GOING' },
      { userId: 'user-mansi', displayName: 'Mansi', avatarUrl: '/avatars/wonderwoman.png', status: 'GOING' },
      { userId: 'user-kunal', displayName: 'Kunal', avatarUrl: '/avatars/spiderman.png', status: 'GOING' },
      { userId: 'user-ananya', displayName: 'Ananya', avatarUrl: '/avatars/harley.png', status: 'MAYBE' },
      { userId: 'user-rohit', displayName: 'Rohit', avatarUrl: null, status: 'MAYBE' }
    ],
    voting: {
      id: 'vote-1',
      question: 'What should we watch?',
      type: 'movie',
      options: [
        { id: 'opt-1', title: 'Interstellar', subtitle: 'Christopher Nolan · Sci-Fi', votes: ['user-mayur', 'user-rahul', 'user-dhruv', 'user-mansi'], type: 'movie' },
        { id: 'opt-2', title: 'Inception', subtitle: 'Mind-Bending Thriller', votes: ['user-kunal', 'user-ananya'], type: 'movie' },
        { id: 'opt-3', title: 'The Dark Knight', subtitle: 'Action · Crime', votes: ['user-rohit'], type: 'movie' }
      ],
      isClosed: true,
      confirmedTitle: 'Interstellar'
    },
    reminder: '30m',
    recurring: 'weekly',
    chatMessages: [
      { id: 'm1', userId: 'user-rahul', displayName: 'Rahul', avatarUrl: '/avatars/deadpool.png', text: 'Popcorn is already loaded! IMAX mode tonight? 🍿', createdAt: Date.now() - 3600000 },
      { id: 'm2', userId: 'user-mayur', displayName: 'Mayur', avatarUrl: '/avatars/batman.png', text: 'Yes! Virtual theater front seats ready. Ludo right after.', createdAt: Date.now() - 1800000 },
      { id: 'm3', userId: 'user-dhruv', displayName: 'Dhruv', avatarUrl: '/avatars/ironman.png', text: 'Ready for the soundtrack drop. Let’s go! 🚀', createdAt: Date.now() - 600000 }
    ],
    createdAt: Date.now() - 86400000,
    isPast: false
  },
  {
    id: 'plan-rahuls-birthday',
    title: "Rahul's Birthday",
    emoji: '🎂',
    type: 'birthday',
    tagLabel: 'Birthday',
    posterUrl: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=600&auto=format&fit=crop&q=80',
    posterOverlayText: 'Good Friends\nBrighter\nBirthdays\n♡',
    date: '2024-10-04',
    dateFormatted: 'Sun, 4 October',
    time: '7:00 PM – 11:00 PM (IST)',
    timezone: 'IST',
    description: "Let's make it special! 🎉",
    activities: [
      {
        id: 'act-b1',
        type: 'movie',
        time: '7:00 PM',
        title: 'Tears of Steel',
        subtitle: 'Sci-Fi Cyberpunk Special',
        actionLabel: 'Enter Cinema',
        actionUrl: '/dashboard?autojoin=tears-of-steel',
        movieDetails: {
          title: 'Tears of Steel',
          duration: '12m',
          provider: 'youtube',
          posterUrl: 'https://img.youtube.com/vi/R6MlUcmOul8/maxresdefault.jpg',
          sourceUrl: 'https://www.youtube.com/watch?v=R6MlUcmOul8'
        }
      },
      {
        id: 'act-b2',
        type: 'game',
        time: '8:30 PM',
        title: 'Trivia & Games',
        subtitle: 'Birthday showdown · Everyone invited',
        actionLabel: 'Play Together',
        actionUrl: '/games/four-in-a-row',
        gameDetails: {
          gameId: 'connect4',
          title: 'Four in a Row',
          icon: '🔴',
          players: '2-4 Players'
        }
      },
      {
        id: 'act-b3',
        type: 'hangout',
        time: '9:45 PM',
        title: 'Cake & Wishes',
        subtitle: 'Live video party with camera previews',
        actionLabel: 'Join Chat'
      }
    ],
    participants: [
      { userId: 'user-rahul', displayName: 'Rahul', avatarUrl: '/avatars/deadpool.png', status: 'GOING', isHost: true },
      { userId: 'user-mayur', displayName: 'Mayur', avatarUrl: '/avatars/batman.png', status: 'GOING' },
      { userId: 'user-mansi', displayName: 'Mansi', avatarUrl: '/avatars/wonderwoman.png', status: 'GOING' },
      { userId: 'user-dhruv', displayName: 'Dhruv', avatarUrl: '/avatars/ironman.png', status: 'GOING' },
      { userId: 'user-kunal', displayName: 'Kunal', avatarUrl: '/avatars/spiderman.png', status: 'GOING' },
      { userId: 'user-priya', displayName: 'Priya', avatarUrl: null, status: 'MAYBE' },
      { userId: 'user-sam', displayName: 'Sam', avatarUrl: null, status: 'MAYBE' }
    ],
    reminder: '1d',
    recurring: 'none',
    chatMessages: [
      { id: 'mb1', userId: 'user-mayur', displayName: 'Mayur', avatarUrl: '/avatars/batman.png', text: 'Shhh, do not spoil the intro video we prepared! 🤫🎂', createdAt: Date.now() - 7200000 },
      { id: 'mb2', userId: 'user-mansi', displayName: 'Mansi', avatarUrl: '/avatars/wonderwoman.png', text: 'I got the party stickers loaded up 🎉', createdAt: Date.now() - 3600000 }
    ],
    createdAt: Date.now() - 172800000,
    isPast: false
  },
  {
    id: 'plan-ludo-night',
    title: 'Ludo Night',
    emoji: '🎮',
    type: 'game',
    tagLabel: 'Game',
    posterUrl: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=600&auto=format&fit=crop&q=80',
    posterOverlayText: 'Game Friends\nAre The\nBest Friends',
    date: '2024-10-09',
    dateFormatted: 'Fri, 9 October',
    time: '9:00 PM – 11:00 PM (IST)',
    timezone: 'IST',
    description: 'Roll. Play. Repeat. 🎲',
    activities: [
      {
        id: 'act-l1',
        type: 'game',
        time: '9:00 PM',
        title: 'Ludo Party',
        subtitle: '4 Players · Safe star rules active',
        actionLabel: 'Play Together',
        actionUrl: '/games/ludo',
        gameDetails: {
          gameId: 'ludo',
          title: 'Ludo Party',
          icon: '🎲',
          players: '4 Players'
        }
      },
      {
        id: 'act-l2',
        type: 'game',
        time: '10:00 PM',
        title: 'Tic-Tac-Toe Quickfire',
        subtitle: 'Double elimination tie-breaker',
        actionLabel: 'Play Together',
        actionUrl: '/games/tic-tac-toe',
        gameDetails: {
          gameId: 'tic-tac-toe',
          title: 'Tic-Tac-Toe',
          icon: '⭕',
          players: '2 Players'
        }
      }
    ],
    participants: [
      { userId: 'user-mayur', displayName: 'Mayur', avatarUrl: '/avatars/batman.png', status: 'GOING', isHost: true },
      { userId: 'user-rahul', displayName: 'Rahul', avatarUrl: '/avatars/deadpool.png', status: 'GOING' },
      { userId: 'user-dhruv', displayName: 'Dhruv', avatarUrl: '/avatars/ironman.png', status: 'GOING' },
      { userId: 'user-kunal', displayName: 'Kunal', avatarUrl: '/avatars/spiderman.png', status: 'GOING' }
    ],
    reminder: '1h',
    recurring: 'weekly',
    chatMessages: [
      { id: 'ml1', userId: 'user-dhruv', displayName: 'Dhruv', avatarUrl: '/avatars/ironman.png', text: 'My green token is taking revenge on Rahul’s red one this time! 😈', createdAt: Date.now() - 5400000 }
    ],
    createdAt: Date.now() - 259200000,
    isPast: false
  },
  {
    id: 'plan-retro-cinema',
    title: 'Retro Sci-Fi Night',
    emoji: '✨',
    type: 'movie',
    date: '2026-09-12',
    dateFormatted: 'Friday · 12 September',
    time: '8:30 PM',
    endTime: '11:00 PM',
    timezone: 'IST',
    description: 'Blender Open Movie classics marathon with popcorn and live voice banter.',
    activities: [
      {
        id: 'act-r1',
        type: 'movie',
        time: '8:30 PM',
        title: 'Big Buck Bunny',
        subtitle: '4K Animation Classic · 10m',
        actionLabel: 'Enter Cinema',
        actionUrl: '/dashboard?autojoin=big-buck-bunny'
      }
    ],
    participants: [
      { userId: 'user-mayur', displayName: 'Mayur', avatarUrl: '/avatars/batman.png', status: 'GOING', isHost: true },
      { userId: 'user-mansi', displayName: 'Mansi', avatarUrl: '/avatars/wonderwoman.png', status: 'GOING' }
    ],
    reminder: 'none',
    recurring: 'none',
    chatMessages: [],
    createdAt: Date.now() - 800000000,
    isPast: true
  }
];

export function getPlans(): Plan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
  const plans = getPlans();
  const found = plans.find((p) => p.id === id);
  if (found) return found;
  return SEED_PLANS.find((p) => p.id === id);
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
