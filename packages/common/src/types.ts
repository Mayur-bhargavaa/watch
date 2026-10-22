export type Role = 'HOST' | 'CO_HOST' | 'PARTICIPANT';

export type ParticipantStatus = 'ONLINE' | 'CONNECTING' | 'WATCHING' | 'AWAY' | 'DISCONNECTED';

export type RoomPrivacy = 'PUBLIC' | 'INVITE_ONLY' | 'PRIVATE';

export type PlaybackStateEnum = 'PLAYING' | 'PAUSED' | 'BUFFERING';

export type DeviceType = 'mobile' | 'desktop' | 'tablet';

export interface ActiveDeviceSession {
  deviceId: string;
  deviceType: DeviceType;
  deviceToken?: string;
  browserName?: string;
  lastActiveAt: number;
}

export interface User {
  id: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  isAnonymous: boolean;
  partnerCode?: string;
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  isMarried?: boolean | null;
  relationshipStatus?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  location?: string | null;
  bio?: string | null;
  favoriteGenres?: string[] | null;
  viewingVibe?: string | null;
  age?: number | null;
  activeDevice?: ActiveDeviceSession | null;
  /** When false the user is hidden from friend discovery (they can still be added by exact friend code). */
  discoverable?: boolean;
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

/** Reaction packs: Classic is free, the others need Watch+ (VIP Pass). Emoji are chat-style content, so they live here. */
export interface ReactionPack { id: string; name: string; premium: boolean; emojis: readonly string[] }
export const REACTION_PACKS: readonly ReactionPack[] = [
  { id: 'classic', name: 'Classic', premium: false, emojis: ['❤️', '😂', '🔥', '👏', '🎉', '🎲', '🥳', '🥺'] },
  { id: 'party', name: 'Party Night', premium: true, emojis: ['🥂', '🪩', '💃', '🕺', '🍾', '🎊', '🎈', '🎶'] },
  { id: 'cinema', name: 'Cinephile', premium: true, emojis: ['🍿', '🎬', '🎞️', '🎭', '🌟', '🤯', '😭', '👀'] },
  { id: 'hype', name: 'Hype', premium: true, emojis: ['👻', '🎃', '⚡', '🚀', '💎', '👑', '🧠', '🫶'] }
];
/** True when this emoji only exists in a premium pack. */
export function isPremiumReaction(emoji: unknown): boolean {
  if (typeof emoji !== 'string') return false;
  const inFree = REACTION_PACKS.some((p) => !p.premium && p.emojis.includes(emoji));
  return !inFree && REACTION_PACKS.some((p) => p.premium && p.emojis.includes(emoji));
}

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
  lastDrawnDiceValue?: number | null;
  isRolling: boolean;
  canRoll: boolean;
  legalMoves: number[]; // array of token IDs (0..3) that can legally move
  tokens: Record<LudoColor, LudoToken[]>;
  winnerColor: LudoColor | null;
  winnerUserId: string | null;
  statusMessage: string;
  consecutiveSixes: number;
}

export type GameType = 'ludo' | 'four-in-a-row' | 'tic-tac-toe' | 'zero-cross' | 'pen-fight' | 'rock-paper-scissors' | 'color-clash' | 'bingo' | 'doodle-duel' | 'tambola' | 'chess' | 'imposter' | 'emoji-charades' | 'mafia-night' | 'quiz-show' | 'murder-mystery' | 'tournament';

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

export type TicTacToeMark = 'X' | 'O' | null;

export interface TicTacToeGameState {
  board: TicTacToeMark[]; // 9 cells (indices 0..8)
  currentTurnSeat: number; // 0 for X, 1 for O
  currentTurnMark: 'X' | 'O';
  winner: 'X' | 'O' | null;
  winnerUserId: string | null;
  winningLine: [number, number, number] | null;
  isDraw: boolean;
  statusMessage: string;
  moveCount: number;
}

/**
 * Pen Fight: a 1v1 desk-flick duel. Each player owns a pen on a school desk; on your turn you flick it (aim + power) and the
 * server plays out the physics. A pen that slides past the desk edge loses the round; the first player to win `roundsToWin`
 * rounds wins the match. Positions are in desk units (the desk is `desk.width` x `desk.height`), seat 0 starts on the left.
 */
export interface PenFightPen {
  x: number;
  y: number;
  /** the pen went over the edge (only ever true in the moment a round ends) */
  out: boolean;
}

export interface PenFightRoundResult {
  round: number;
  /** the seat that won the round; null when the round was a draw */
  winnerSeat: number | null;
  reason: 'knocked_out' | 'self_out' | 'closest_to_center' | 'draw';
}

export interface PenFightGameState {
  desk: { width: number; height: number };
  penRadius: number;
  /** pens by seat (index 0 = seat 0) */
  pens: [PenFightPen, PenFightPen];
  currentTurnSeat: number;
  /** who flicks first in this match (a rematch alternates it) */
  startingSeat: number;
  round: number;
  roundsToWin: number;
  scores: [number, number];
  flicksThisRound: number;
  maxFlicksPerRound: number;
  /** set when a flick ended the previous round: tells the screen what happened (cleared by the next flick) */
  lastRound: PenFightRoundResult | null;
  /** 'X' (seat 0) or 'O' (seat 1) once a player has won the match: the same finished marker the other 3x3 / board games use */
  winner: 'X' | 'O' | null;
  /** mirrors the seat to move, like Tic Tac Toe's mark */
  currentTurnMark: 'X' | 'O';
  winnerUserId: string | null;
  isDraw: boolean;
  statusMessage: string;
  moveCount: number;
}

/** one flick as the screen replays it: the pens' positions every frame (x0, y0, x1, y1) at `fps` frames per second */
export interface PenFightFlick {
  seat: number;
  angle: number;
  power: number;
  fps: number;
  frames: number[][];
}

/**
 * Zero Cross: each player owns exactly three pieces on a 3x3 board. First every piece is placed (alternating turns); then the
 * same pieces are MOVED, one per turn, to any empty cell, until someone lines up three. The server owns the rules, the turn and
 * the match clock (`deadlineAt`); screens only draw what they are sent. Seat 0 plays X, seat 1 plays O.
 */
export type ZeroCrossMark = 'X' | 'O';
export type ZeroCrossPhase = 'placement' | 'movement' | 'finished';
export type ZeroCrossStatus = 'active' | 'won' | 'draw' | 'surrendered' | 'timeout' | 'forfeit' | 'cancelled';
/** match length choices in seconds (null = no timer) */
export const ZERO_CROSS_DURATIONS: readonly (number | null)[] = [180, 300, 600, null];
export const ZERO_CROSS_DEFAULT_DURATION = 300;

export interface ZeroCrossMove {
  seat: number;
  kind: 'place' | 'move';
  /** the cell a moved piece left (null for a placement) */
  from: number | null;
  to: number;
  moveId: string | null;
}

export interface ZeroCrossGameState {
  gameId: string;
  board: (ZeroCrossMark | null)[]; // 9 cells (indices 0..8)
  currentTurnSeat: number;
  currentTurnMark: ZeroCrossMark;
  phase: ZeroCrossPhase;
  status: ZeroCrossStatus;
  remainingPlacements: Record<ZeroCrossMark, number>;
  durationSeconds: number | null;
  /** when the match clock runs out (ISO, server time); null for an unlimited match */
  deadlineAt: string | null;
  startedAt: string;
  /** the finished marker shared with the other board games */
  winner: ZeroCrossMark | null;
  winnerUserId: string | null;
  winningLine: [number, number, number] | null;
  isDraw: boolean;
  finishReason: string | null;
  startingSeat: number;
  /** +1 for every accepted action: a screen that holds an older version is out of date */
  version: number;
  moveCount: number;
  lastMove: ZeroCrossMove | null;
  /** the most recent move ids, so a resent move is recognised and not applied twice */
  processedMoveIds: string[];
  statusMessage: string;
}

/**
 * Rock Paper Scissors: a 1v1 match of simultaneous, private choices. The server keeps every unrevealed choice to itself (see
 * RpsEngine): this PUBLIC state only says WHO has locked, and carries a choice only after the round has been revealed.
 * Seat 0 plays as "X", seat 1 as "O" in the shared finished marker used by the other 2-player games.
 */
export type RpsChoice = 'rock' | 'paper' | 'scissors';
export type RpsFormat = 'single' | 'best-of-3' | 'best-of-5';
export type RpsStatus = 'waiting' | 'ready' | 'countdown' | 'choosing' | 'revealing' | 'round-result' | 'match-result' | 'cancelled' | 'forfeit';
export const RPS_FORMATS: readonly RpsFormat[] = ['single', 'best-of-3', 'best-of-5'];
export const RPS_DEFAULT_FORMAT: RpsFormat = 'best-of-3';
/** how a round ends when a player never locked a choice */
export type RpsTimeoutPolicy = 'award-to-submitter' | 'draw';

export interface RpsRoundReveal {
  round: number;
  /** by seat */
  choices: [RpsChoice | null, RpsChoice | null];
  /** the seat that won the round, null for a draw */
  winnerSeat: number | null;
  /** why: both chose, or a missing choice was handled by the timeout policy */
  reason: 'beats' | 'draw' | 'timeout-award' | 'timeout-draw';
  /** the seats that did not lock a choice in time */
  timedOut: number[];
}

export interface RpsGameState {
  matchId: string;
  /** `${matchId}:${round}`: every action names the round it is for, so a late or replayed one cannot touch another round */
  roundId: string;
  format: RpsFormat;
  /** wins needed to take the match (1 for a single round) */
  winsNeeded: number;
  status: RpsStatus;
  round: number;
  /** by seat */
  scores: [number, number];
  /** which seats have locked a choice this round (never WHAT they chose) */
  locked: [boolean, boolean];
  /** the revealed round: present from `revealing` until the next round starts, and kept in the final result */
  reveal: RpsRoundReveal | null;
  /** when the current phase ends (ISO, server time); null in a finished match */
  deadlineAt: string | null;
  countdownSeconds: number;
  chooseSeconds: number;
  /** the finished marker shared with the other board games */
  winner: 'X' | 'O' | null;
  winnerUserId: string | null;
  isDraw: boolean;
  finishReason: string | null;
  startingSeat: number;
  currentTurnSeat: number;
  version: number;
  statusMessage: string;
}

/**
 * Color Clash: an original shedding card game for 2 to 4 players (match the colour or the value, play action cards, empty your hand
 * first). The server owns the deck, every hand and every rule. A screen only ever receives ClashPublicState: the table (counts,
 * the top card, whose turn) plus ITS OWN hand, and which cards it may legally play now.
 */
export type ClashColor = 'red' | 'blue' | 'green' | 'yellow';
export type ClashKind = 'number' | 'skip' | 'reverse' | 'draw-two' | 'wild' | 'wild-draw-four';
export const CLASH_COLORS: readonly ClashColor[] = ['red', 'blue', 'green', 'yellow'];

export interface ClashCard {
  /** unique within a deck: duplicate cards (two red 5s) still have different ids */
  id: string;
  /** null for wild cards */
  color: ClashColor | null;
  kind: ClashKind;
  /** 0-9 for number cards, null otherwise */
  value: number | null;
}

/** the rule profile: every ambiguous rule is a switch here, with the documented default */
export interface ClashRules {
  /** seconds a player has for a turn; null = no timer */
  turnSeconds: number | null;
  /** with two players Reverse acts like Skip (default) or like a normal turn */
  reverseTwoPlayers: 'skip' | 'normal';
  /** the next player may challenge a Wild Draw Four; when off, a Wild Draw Four is legal only with no card of the active colour */
  drawFourChallenge: boolean;
  /** a player may draw even when they hold a playable card */
  voluntaryDraw: boolean;
  /** a drawn card that can be played may be played at once */
  playDrawnCard: boolean;
  /** cards drawn by a player caught with one card and no declaration */
  lastCardPenalty: number;
  /** seconds in which an undeclared one-card player can be caught */
  lastCardWindowSeconds: number;
}
export const CLASH_DEFAULT_RULES: ClashRules = {
  turnSeconds: 30,
  reverseTwoPlayers: 'skip',
  drawFourChallenge: true,
  voluntaryDraw: true,
  playDrawnCard: true,
  lastCardPenalty: 2,
  lastCardWindowSeconds: 5
};
export const CLASH_TURN_SECONDS: readonly (number | null)[] = [15, 30, 60, null];

export interface ClashPlayerView {
  userId: string;
  displayName: string;
  seat: number;
  /** cards in hand (never which ones) */
  cards: number;
  /** has declared "last card" */
  declared: boolean;
  left: boolean;
}

export interface ClashEvent {
  kind: 'play' | 'draw' | 'pass' | 'declare' | 'penalty' | 'challenge' | 'timeout' | 'skip' | 'reverse' | 'color';
  seat: number | null;
  /** the card that was played (public: it goes on the pile) */
  card?: ClashCard;
  count?: number;
  target?: number | null;
  success?: boolean;
  color?: ClashColor;
  note?: string;
}

export interface ClashPublicState {
  game: 'color-clash';
  gameId: string;
  rules: ClashRules;
  status: 'active' | 'finished' | 'forfeit' | 'cancelled';
  players: ClashPlayerView[];
  currentSeat: number;
  /** 1 = clockwise (seat order), -1 = counter-clockwise */
  direction: 1 | -1;
  activeColor: ClashColor;
  top: ClashCard;
  drawCount: number;
  discardCount: number;
  /** play: choose a card or draw; drawn: the card just drawn may be played or passed; challenge: a Wild Draw Four waits for the player to accept or challenge */
  turnPhase: 'play' | 'drawn' | 'challenge';
  pending: { kind: 'wild-four'; fromSeat: number; targetSeat: number } | null;
  /** an undeclared one-card player who can be caught until `until` */
  lastCardWindow: { seat: number; until: string } | null;
  deadlineAt: string | null;
  winnerSeat: number | null;
  winnerUserId: string | null;
  /** the finished marker shared with the other games */
  winner: 'X' | 'O' | null;
  isDraw: boolean;
  /** points the winner takes (the values of the cards left in the other hands) */
  points: number | null;
  finishReason: string | null;
  version: number;
  moveCount: number;
  lastEvent: ClashEvent | null;
  statusMessage: string;
  startingSeat: number;
  currentTurnSeat: number;
  // ---- what only THIS viewer may see ----
  mySeat: number | null;
  myHand: ClashCard[] | null;
  /** ids of the cards this viewer may legally play right now */
  playable: string[];
  canDraw: boolean;
  canPass: boolean;
  canChallengeWild: boolean;
  canDeclare: boolean;
  /** seats this viewer may catch for not declaring */
  catchable: number[];
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
  /** set on a match room created by a Tournament Arena: the tournament room's id and code (lets the game page show "Back to tournament") */
  tournamentId?: string | null;
  tournamentCode?: string | null;
}


