'use client';

import { Plan, RSVPStatus, PlanChatMessage } from '../types/plans';

const STORAGE_KEY = 'stitchbyte_watch_plans_v2';

export const SEED_PLANS: Plan[] = [
  {
    id: 'plan-friday-night',
    title: 'Friday Night',
    emoji: '🍿',
    type: 'movie',
    date: '2026-09-27',
    dateFormatted: 'Saturday · 27 September',
    time: '9:00 PM',
    endTime: '1:00 AM',
    timezone: 'IST',
    description: 'Weekly cinema meetup! Deep space voyage followed by high-stakes multiplayer Ludo and late-night lounge banter.',
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
    date: '2026-10-04',
    dateFormatted: 'Sunday · 4 October',
    time: '7:00 PM',
    endTime: '11:00 PM',
    timezone: 'IST',
    description: "Celebrating Rahul's birthday with a private screening, surprise trivia quiz, and custom reactions!",
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
        title: 'Cinema Trivia & Connect 4',
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
        type: 'chat',
        time: '9:45 PM',
        title: 'Virtual Cake & Wishes',
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
      { userId: 'user-sam', displayName: 'Sam', avatarUrl: null, status: 'MAYBE' },
      { userId: 'user-tanvi', displayName: 'Tanvi', avatarUrl: null, status: 'CANT_GO' }
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
    date: '2026-10-09',
    dateFormatted: 'Friday · 9 October',
    time: '9:00 PM',
    endTime: '11:00 PM',
    timezone: 'IST',
    description: 'Casual board game tournament with voice chat and live reactions. Winner gets the Golden Crown emoji for the week!',
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
  if (typeof window === 'undefined') return SEED_PLANS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PLANS));
      return SEED_PLANS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_PLANS;
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
  const plans = getPlans();
  return plans.find((p) => p.id === id);
}

export function addPlan(plan: Plan): void {
  const plans = getPlans();
  const updated = [plan, ...plans];
  savePlans(updated);
}

export function updatePlan(id: string, updates: Partial<Plan>): Plan | undefined {
  const plans = getPlans();
  const idx = plans.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;
  const updatedPlan = { ...plans[idx], ...updates };
  plans[idx] = updatedPlan;
  savePlans([...plans]);
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
  return newMsg;
}
