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
    gameType?: 'trivia' | 'pictionary' | 'reaction' | 'ludo';
    answerIndex?: number;
    strokeData?: any;
    reactionTimeMs?: number;
}
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
    seat: number;
    color: LudoColor;
    status: GamePlayerStatus;
    isConnected: boolean;
    joinedAt: string;
}
export interface LudoToken {
    id: number;
    color: LudoColor;
    step: number;
}
export interface LudoGameState {
    playersCount: 2 | 3 | 4;
    seats: Record<number, {
        userId: string;
        displayName: string;
        color: LudoColor;
    }>;
    currentTurnSeat: number;
    currentTurnColor: LudoColor;
    diceValue: number | null;
    isRolling: boolean;
    canRoll: boolean;
    legalMoves: number[];
    tokens: Record<LudoColor, LudoToken[]>;
    winnerColor: LudoColor | null;
    winnerUserId: string | null;
    statusMessage: string;
    consecutiveSixes: number;
}
export type GameType = 'ludo' | 'four-in-a-row';
export type FourInARowDisc = 'R' | 'Y' | null;
export interface FourInARowGameState {
    board: FourInARowDisc[][];
    currentTurnSeat: number;
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
    roomCode: string;
    gameType: GameType;
    hostUserId: string;
    maxPlayers: number;
    minPlayers: number;
    isPrivate: boolean;
    status: GameRoomStatus;
    players: GameRoomPlayer[];
    gameState?: LudoGameState | FourInARowGameState | any | null;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
}
//# sourceMappingURL=types.d.ts.map