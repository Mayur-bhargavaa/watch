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
    position: number;
    serverTimestamp: number;
    playbackRate: number;
    version: number;
    updatedBy: string;
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
    reactionCode: string;
    emoji: string;
    mediaTimestamp: number;
    serverTimestamp: number;
    createdAt: string;
}
export interface ChatMessage {
    id: string;
    roomId: string;
    userId: string;
    userName: string;
    userAvatar?: string | null;
    content: string;
    mediaTimestamp?: number | null;
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
export declare const REACTION_EMOJIS: readonly [{
    readonly code: "joy";
    readonly emoji: "😂";
    readonly label: "Joy";
    readonly key: "1";
}, {
    readonly code: "heart";
    readonly emoji: "❤️";
    readonly label: "Love";
    readonly key: "2";
}, {
    readonly code: "fire";
    readonly emoji: "🔥";
    readonly label: "Fire";
    readonly key: "3";
}, {
    readonly code: "scream";
    readonly emoji: "😱";
    readonly label: "Shock";
    readonly key: "4";
}, {
    readonly code: "clap";
    readonly emoji: "👏";
    readonly label: "Clap";
    readonly key: "5";
}, {
    readonly code: "rofl";
    readonly emoji: "🤣";
    readonly label: "Rolling";
    readonly key: "6";
}, {
    readonly code: "skull";
    readonly emoji: "💀";
    readonly label: "Dead";
    readonly key: "7";
}];
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
    drawingData?: string;
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
//# sourceMappingURL=types.d.ts.map