export type PlanType =
  | 'movie'
  | 'game'
  | 'birthday'
  | 'anniversary'
  | 'party'
  | 'hangout'
  | 'custom';

export type ActivityType = 'movie' | 'game' | 'hangout' | 'chat';

export interface MovieDetails {
  title: string;
  duration: string;
  provider: 'youtube' | 'direct' | 'screen' | 'catalog';
  posterUrl?: string;
  sourceUrl?: string;
}

export interface GameDetails {
  gameId: string;
  title: string;
  icon: string;
  players: string;
}

export interface PlanActivity {
  id: string;
  type: ActivityType;
  time: string; // e.g. "9:00 PM"
  title: string; // e.g. "Interstellar"
  subtitle?: string; // e.g. "Duration: 2h 49m" or "Players: 2-4"
  actionLabel: string; // e.g. "Enter Cinema", "Play Together", "Join Chat"
  actionUrl?: string; // route to cinema room or game
  movieDetails?: MovieDetails;
  gameDetails?: GameDetails;
}

export type RSVPStatus = 'GOING' | 'MAYBE' | 'CANT_GO';

export interface PlanParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  status: RSVPStatus;
  isHost?: boolean;
}

export interface VotingOption {
  id: string;
  title: string;
  votes: string[]; // array of userIds
  type: 'movie' | 'game';
  subtitle?: string;
}

export interface PlanChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: number;
}

export interface Plan {
  id: string;
  title: string;
  emoji: string;
  type: PlanType;
  tagLabel?: string;
  posterUrl?: string;
  posterOverlayText?: string;
  date: string; // e.g. "2026-09-27"
  dateFormatted: string; // e.g. "Sat, 27 September"
  time: string; // e.g. "9:00 PM – 1:00 AM (IST)"
  endTime?: string;
  timezone: string;
  description?: string;
  activities: PlanActivity[];
  participants: PlanParticipant[];
  voting?: {
    id: string;
    question: string;
    type: 'movie' | 'game';
    options: VotingOption[];
    isClosed?: boolean;
    confirmedTitle?: string;
  };
  reminder: '30m' | '1h' | '1d' | 'custom' | 'none';
  recurring?: 'weekly' | 'monthly' | 'none';
  chatMessages: PlanChatMessage[];
  createdAt: number;
  isPast?: boolean;
}
