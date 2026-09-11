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
  partnerCode?: string;
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
  themeId?: string;
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

export interface ChatReplyTo {
  id: string;
  userName: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  mediaTimestamp?: number | null; // optional timestamp reference
  replyTo?: ChatReplyTo | null;
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
  gameType?: 'trivia' | 'pictionary' | 'reaction' | 'ludo';
  answerIndex?: number;
  strokeData?: any;
  reactionTimeMs?: number;
}

// =====================================================================
// Human-Only Multiplayer Platform & Ludo Interfaces
// =====================================================================

export interface PartnerConnection {
  id: string;
  userId: string;
  partnerUserId: string;
  status: 'ACCEPTED' | 'PENDING' | 'BLOCKED';
  partnerUser?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    partnerCode: string;
    isOnline?: boolean;
    currentRoomCode?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export type GameRoomStatus = 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
export type GamePlayerStatus = 'WAITING' | 'READY' | 'PLAYING' | 'DISCONNECTED' | 'LEFT';
export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export interface GameRoomPlayer {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  seat: number; // 0, 1, 2, 3
  color: LudoColor;
  status: GamePlayerStatus;
  isConnected: boolean;
  joinedAt: string;
}

export interface LudoToken {
  id: number; // 0, 1, 2, 3
  color: LudoColor;
  step: number; // -1 = yard/base, 0..50 = track, 51..55 = home stretch, 56 = finished in home
}

export interface LudoGameState {
  playersCount: 2 | 3 | 4;
  seats: Record<number, { userId: string; displayName: string; color: LudoColor }>;
  currentTurnSeat: number; // seat index 0..playersCount-1
  currentTurnColor: LudoColor;
  diceValue: number | null;
  isRolling: boolean;
  canRoll: boolean;
  legalMoves: number[]; // array of token IDs (0..3) that can legally move
  tokens: Record<LudoColor, LudoToken[]>;
  winnerColor: LudoColor | null;
  winnerUserId: string | null;
  statusMessage: string;
  consecutiveSixes: number;
}

export type GameType = 'ludo' | 'four-in-a-row';

export type FourInARowDisc = 'R' | 'Y' | null;

export interface FourInARowGameState {
  board: FourInARowDisc[][]; // 6 rows x 7 cols
  currentTurnSeat: number; // 0 for Red, 1 for Yellow
  currentTurnColor: 'red' | 'yellow';
  winner: 'R' | 'Y' | null;
  winnerColor: 'red' | 'yellow' | null;
  winnerUserId: string | null;
  winningLine: [number, number][] | null;
  isDraw: boolean;
  statusMessage: string;
  moveCount: number;
}

export interface GameRoom {
  id: string;
  roomCode: string; // e.g. "LUDO-8F72", "FOUR-8F72"
  gameType: GameType;
  hostUserId: string;
  maxPlayers: number;
  minPlayers: number;
  isPrivate: boolean;
  status: GameRoomStatus;
  players: GameRoomPlayer[];
  gameState?: LudoGameState | FourInARowGameState | any | null;
  theme?: string;
  chatHistory?: any[];
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}


