export type ChatOnlineStatus = 'ONLINE' | 'OFFLINE' | 'AWAY';

export interface ChatUser {
  id: string;
  displayName: string;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
  avatar?: string;
  onlineStatus: ChatOnlineStatus;
  isOnline?: boolean;
  lastSeen?: string;
  partnerCode?: string;
  streakDays?: number;
  moviesWatched?: number;
  gamesPlayed?: number;
  plansCount?: number;
  sharedStats?: {
    moviesWatched?: number;
    gamesPlayed?: number;
    plansCompleted?: number;
  };
  friendsSince?: string;
  isFriend?: boolean;
}

export type ConversationType = 'direct' | 'group';

export type ChatMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'voice'
  | 'file'
  | 'sticker'
  | 'plan'
  | 'game'
  | 'game_invite'
  | 'movie'
  | 'movie_share'
  | 'system';

export interface ChatMessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface ChatPlanPayload {
  id?: string;
  planId?: string;
  title: string;
  date?: string;
  time?: string;
  scheduledAt?: string;
  movieTitle?: string;
  activity?: string;
  venue?: string;
  duration?: string;
  status?: string;
}

export interface ChatGamePayload {
  gameType: string;
  roomCode?: string;
  roomId?: string;
  title: string;
  mode?: string;
  playersCount?: string | number;
  maxPlayers?: number;
  hostName?: string;
  status?: string;
}

export interface ChatMoviePayload {
  movieId?: string;
  title: string;
  duration?: string;
  posterUrl?: string;
  genres?: string[];
  year?: string;
  streamUrl?: string;
  rating?: string;
}

export interface ChatVoicePayload {
  audioUrl?: string;
  durationSeconds?: number;
  duration?: number;
  waveform?: number[];
}

export interface ChatMessageMetadata {
  plan?: ChatPlanPayload;
  game?: ChatGamePayload;
  movie?: ChatMoviePayload;
  voice?: ChatVoicePayload;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  stickerUrl?: string;
  sticker?: any;
  isViewOnce?: boolean;
  viewOnceOpened?: boolean;
  viewOnceOpenedAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  type: ChatMessageType;
  content: string;
  mediaUrl?: string;
  metadata?: ChatMessageMetadata;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
    type?: ChatMessageType;
  } | null;
  reactions?: ChatMessageReaction[];
  createdAt: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  isPinned?: boolean;
}

export interface ChatConversation {
  id: string;
  type: ConversationType;
  name: string;
  title?: string;
  avatarUrl?: string | null;
  avatar?: string;
  participants: ChatUser[];
  messages?: ChatMessage[];
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
  isPinned?: boolean;
  isRequest?: boolean;
}

export interface ChatRequest {
  id: string;
  fromUser: ChatUser;
  lastMessage: string;
  createdAt: string;
}

export interface ChatMessageRequest {
  id: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  previewText?: string;
  lastMessage?: string;
  createdAt: string;
}
