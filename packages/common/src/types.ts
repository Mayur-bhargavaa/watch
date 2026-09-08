export type Role = 'HOST' | 'CO_HOST' | 'PARTICIPANT';

export type ParticipantStatus = 'ONLINE' | 'CONNECTING' | 'WATCHING' | 'AWAY' | 'DISCONNECTED';

export type RoomPrivacy = 'PUBLIC' | 'INVITE_ONLY' | 'PRIVATE';

export type PlaybackStateEnum = 'PLAYING' | 'PAUSED' | 'BUFFERING';

export interface User {
  id: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  isAnonymous: boolean;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  role: Role;
  status: ParticipantStatus;
  joinedAt: string;
  isConnected: boolean;
  isMuted?: boolean;
  isCameraOn?: boolean;
  isSpeaking?: boolean;
}

export interface MediaItem {
  id: string;
  provider: 'youtube' | 'direct_html5' | 'ott_fallback' | 'netflix' | 'disney' | 'prime';
  providerMediaId?: string;
  sourceUrl: string;
  title: string;
  posterUrl?: string;
  durationSeconds: number;
}

export interface RoomPlaybackState {
  roomId: string;
  state: PlaybackStateEnum;
  position: number; // in seconds
  serverTimestamp: number; // Unix epoch ms
  playbackRate: number; // e.g. 1.0
  version: number; // Monotonically increasing sequence number
  updatedBy: string; // userId who initiated
}

export interface Room {
  id: string;
  slug: string;
  title: string;
  description?: string;
  hostId: string;
  privacy: RoomPrivacy;
  isLocked: boolean;
  currentMedia: MediaItem | null;
  playbackState: RoomPlaybackState;
  activityMode?: 'CINEMA' | 'GAMING';
  createdAt: string;
  endedAt?: string | null;
}

export interface Reaction {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  mediaId: string;
  reactionCode: string; // e.g. "joy", "heart", "scream", "fire", "clap"
  emoji: string; // "😂", "❤️", "😱", "🔥", "👏"
  mediaTimestamp: number; // video timestamp in seconds
  serverTimestamp: number; // epoch ms
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  mediaTimestamp?: number | null; // optional timestamp reference
  isDeleted: boolean;
  createdAt: string;
}

export interface VoiceParticipantState {
  userId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
}

export const REACTION_EMOJIS = [
  { code: 'joy', emoji: '😂', label: 'Joy', key: '1' },
  { code: 'heart', emoji: '❤️', label: 'Love', key: '2' },
  { code: 'fire', emoji: '🔥', label: 'Fire', key: '3' },
  { code: 'scream', emoji: '😱', label: 'Shock', key: '4' },
  { code: 'clap', emoji: '👏', label: 'Clap', key: '5' },
  { code: 'rofl', emoji: '🤣', label: 'Rolling', key: '6' },
  { code: 'skull', emoji: '💀', label: 'Dead', key: '7' }
] as const;

export interface GameScoreItem {
  userId: string;
  userName: string;
  score: number;
}

export interface GameSessionState {
  activeGame: 'trivia' | 'pictionary' | 'reaction' | null;
  round: number;
  status: 'LOBBY' | 'IN_PROGRESS' | 'ROUND_OVER' | 'GAME_OVER';
  question?: string;
  options?: string[];
  correctOptionIndex?: number;
  drawingData?: string; // canvas serialized draw command / path
  scores: Record<string, number>;
  timeRemaining?: number;
}

export interface GameActionPayload {
  action: 'START_GAME' | 'ANSWER_TRIVIA' | 'DRAW_STROKE' | 'CLEAR_CANVAS' | 'REACTION_TAP' | 'RESET_GAME';
  gameType?: 'trivia' | 'pictionary' | 'reaction';
  answerIndex?: number;
  strokeData?: any;
  reactionTimeMs?: number;
}
