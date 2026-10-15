import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { secureCode, secureRandom } from '../util/random.js';
import { SocketGuard } from '../util/socketGuard.js';
import { publicMessage } from '../util/safeError.js';
import {
  GameRoom,
  GameRoomPlayer,
  LudoColor,
  LudoGameState,
  GameRoomStatus,
  GameType,
  DoodleConfig,
  DoodleGameState,
  ImposterServerState,
  IMPOSTER_ROUND_OPTIONS,
  EmojiCharadesServerState,
  EMOJI_CHARADES_MIN_PLAYERS,
  EMOJI_CHARADES_ROUND_OPTIONS,
  MafiaServerState,
  MafiaChatChannel,
  QuizServerState,
  MurderServerState,
  TournamentServerState,
  TournamentMatch,
  TOURNAMENT_GAME_NAMES,
  isTournamentMatchGame
} from '@synccinema/common';
import { DatabaseService } from '../db/database.js';
import { GAME_DEFINITIONS, seatColorsFor, parseGameType } from './GameDefinitions.js';
import { LudoEngine } from './LudoEngine.js';
import { FourInARowEngine } from './FourInARowEngine.js';
import { TicTacToeEngine } from './TicTacToeEngine.js';
import { BingoEngine, DEFAULT_BINGO_CONFIG, publicStateFor as publicTambolaStateFor } from './BingoEngine.js';
import { BingoDuelEngine, DEFAULT_BINGO_DUEL_CONFIG, publicStateFor as publicDuelStateFor } from './BingoDuelEngine.js';
import { DoodleDuelEngine, DEFAULT_DOODLE_CONFIG, DOODLE_WORDS, doodleRateAllowed, clearDoodleRate } from './DoodleDuelEngine.js';
import { ChessEngine, sanitizeChessConfig } from './ChessEngine.js';
import { DEFAULT_CHESS_CONFIG, ChessGameState } from '@synccinema/common';
import { mongoDb } from '../db/mongoDatabase.js';
import { GameRuleError } from './GameRuleError.js';
import { ImposterEngine, imposterRateAllowed, clearImposterRate, imposterMinPlayers } from './ImposterEngine.js';
import { imposterStartSchema, imposterClueSchema, imposterVoteSchema, imposterGuessSchema, parseImposterPayload } from './imposterSchemas.js';
import { EmojiCharadesEngine, emojiCharadesRateAllowed, clearEmojiCharadesRate } from './EmojiCharadesEngine.js';
import { emojiCharadesStartSchema, emojiCharadesGuessSchema, parseEmojiCharadesPayload } from './emojiCharadesSchemas.js';
import { MafiaNightEngine, mafiaRateAllowed, clearMafiaRate, mafiaMinPlayers } from './MafiaNightEngine.js';
import { mafiaNightActionSchema, mafiaNightVoteSchema, parseMafiaNightPayload } from './mafiaNightSchemas.js';
import { QuizShowEngine, quizRateAllowed, clearQuizRate, quizMinPlayers } from './QuizShowEngine.js';
import { quizEditSchema, quizAnswerSchema, quizBuzzSchema, quizBuzzAnswerSchema, quizJudgeSchema, quizControlSchema, parseQuizPayload } from './quizShowSchemas.js';
import { MOVIE_NIGHT_STARTER_PACK } from './quizStarterPack.js';
import { MurderMysteryEngine, murderRateAllowed, clearMurderRate, murderMinPlayers } from './MurderMysteryEngine.js';
import { murderPickCaseSchema, murderWhisperSchema, murderShareClueSchema, murderAccuseSchema, parseMurderPayload } from './murderMysterySchemas.js';
import { TournamentEngine, tournamentRateAllowed, clearTournamentRate, tournamentMinPlayers } from './TournamentEngine.js';
import type { TournamentEffects } from './TournamentEngine.js';
import { tournamentConfigSchema, tournamentKickSchema, tournamentAdvanceSchema, parseTournamentPayload } from './tournamentSchemas.js';

// Ludo turn timer (LU-4): after this long without an action the server rolls/moves for the seat on turn.
// Configurable via LUDO_TURN_TIMEOUT_MS (0 disables it).
const LUDO_TURN_TIMEOUT_MS = process.env.LUDO_TURN_TIMEOUT_MS !== undefined && process.env.LUDO_TURN_TIMEOUT_MS !== ''
  ? Math.max(0, Number(process.env.LUDO_TURN_TIMEOUT_MS) || 0)
  : 45_000;

interface ConnectedGameClient {
  socket: WebSocket;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  roomId: string;
  isAlive: boolean;
  lastChatMessageTime?: number;
  /** a newer socket of the same user replaced this one: its close event must not forfeit anything */
  superseded?: boolean;
  /** the user explicitly left (game:leave): the later socket close is a no-op */
  left?: boolean;
  /** read-only spectator: never a player (no seat, no votes, no forfeit); lives in `roomSpectators`, not `roomClients` */
  spectator?: boolean;
  lastReactionTime?: number;
}

/** Max read-only spectators per room (env GAME_MAX_SPECTATORS). */
const MAX_SPECTATORS = Math.max(0, Number(process.env.GAME_MAX_SPECTATORS ?? 10) || 0);
/** Spectator joins allowed per user per minute. */
const SPECTATOR_JOINS_PER_MIN = 20;
/** The only message types a spectator may send; everything else is answered with game:error SPECTATOR. */
const SPECTATOR_ALLOWED = new Set(['game:leave', 'game:heartbeat', 'ping', 'game:ping', 'game:reaction']);

/** Disconnect grace before a seat is forfeited (PLAYING) or freed (WAITING). Configurable via env / constructor. */
const DEFAULT_GRACE_PLAYING_MS = Math.max(1000, Number(process.env.GAME_DISCONNECT_GRACE_MS) || 45_000);
const DEFAULT_GRACE_WAITING_MS = Math.max(1000, Number(process.env.GAME_LOBBY_GRACE_MS) || 10_000);
/** A seat taken over REST that never opens a socket is released after this long. */
const GHOST_SEAT_TTL_MS = 2 * 60_000;
/** A WAITING room with nobody connected is cancelled after this long. */
const STALE_WAITING_ROOM_TTL_MS = 30 * 60_000;
/** A PLAYING room nobody is connected to is closed after this long (and not within BOOT_GRACE of a server start, GR-27). */
const ABANDONED_PLAYING_ROOM_TTL_MS = 30 * 60_000;
const BOOT_GRACE_MS = 10 * 60_000;
/** Finished/cancelled rooms are deleted after this long (GR-27). */
const OLD_ROOM_RETENTION_MS = 30 * 24 * 3_600_000;
const BOOT_TIME = Date.now();
const BOT_USER_IDS = new Set(['bot_duelist']);
/** Allowed reaction glyphs (anything else is dropped). */
const REACTION_MAX_LEN = 8;

const leftGameWinMessage = (name: string): string => `${name} left the game. You are the winner!`;

/**
 * Optional listener registry for finished game rooms. Only rooms somebody asked to watch (`watchGameRoom`: today only the match rooms of a
 * Tournament Arena) are ever reported, so every other room finishes exactly as before. The winner always comes from the server game state
 * of the room (`winnerUserId` of the engine state), never from a client message.
 */
export interface GameRoomFinishedEvent {
  roomId: string;
  roomCode: string;
  gameType: string;
  /** the engine's winner (a seated player), or null for a draw / a room that ended without a winner */
  winnerUserId: string | null;
  /** FINISHED: the game ended; CANCELLED: the room was closed before it started */
  status: 'FINISHED' | 'CANCELLED';
  /** whoever asked to watch the room (watchGameRoom): the tournament room id */
  watcher?: string;
}
export type GameRoomFinishedListener = (event: GameRoomFinishedEvent) => void;

/** In-app notice for a person who may not be on any game page (the web shows it as a notification with a link). */
export interface TournamentNotice {
  id: string;
  title: string;
  body: string;
  roomCode: string;
  gameType: string;
}
export type TournamentNotifier = (userId: string, notice: TournamentNotice) => void;

/** Each manager registers one handler per database; the wrapped `updateGameRoomStatus` calls them all (several managers can share a db in tests). */
type RoomEndHandler = (roomId: string, status: 'FINISHED' | 'CANCELLED') => void;

export class GameRoomManager {
  private db: DatabaseService;
  // roomId -> Set of connected WebSocket clients
  private roomClients = new Map<string, Set<ConnectedGameClient>>();
  // roomId -> read-only spectators (kept apart from roomClients so no player logic can ever count them)
  private roomSpectators = new Map<string, Set<ConnectedGameClient>>();
  // userId -> recent spectator join timestamps (rate limit)
  private spectatorJoins = new Map<string, number[]>();
  // userId -> ConnectedGameClient
  private userClients = new Map<string, ConnectedGameClient>();
  // userId -> disconnect grace timeout
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> active theme
  private roomThemes = new Map<string, string>();
  // roomId -> recent chat message history (up to 50)
  private roomChatHistory = new Map<string, any[]>();
  // roomId -> Set of userIds who voted for rematch
  private rematchVotes = new Map<string, Set<string>>();
  // roomId -> auto call timer
  private bingoTimers = new Map<string, NodeJS.Timeout>();
  private bingoConfigs = new Map<string, any>(); // roomId -> validated host config (Bingo Duel / Tambola)
  // roomId -> doodle timer
  private doodleTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> chess clock ticker timer
  private chessTimers = new Map<string, NodeJS.Timeout>();
  private ludoTurnTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> imposter phase timer
  private imposterTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> rounds (3 or 5) the host chose; kept for rematches
  private imposterRounds = new Map<string, number>();
  // roomId -> emoji charades phase timer
  private emojiCharadesTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> rounds (3 or 5) the host chose; kept for rematches
  private emojiCharadesRounds = new Map<string, number>();
  // roomId -> mafia night phase timer
  private mafiaTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> quiz show phase timer
  private quizTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> murder mystery phase timer
  private murderTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> tournament arena tick timer (results, no-shows)
  private tournamentTimers = new Map<string, NodeJS.Timeout>();
  // match room id -> tournament room id: rooms a tournament waits for a result from
  private watchedRooms = new Map<string, string>();
  // match room id -> a winner decided outside the room's game state (a player left a match room that never started)
  private watchedOutcomes = new Map<string, string | null>();
  private roomFinishedListeners = new Set<GameRoomFinishedListener>();
  private tournamentNotifier: TournamentNotifier | null = null;
  // injectable clock and random source (tournament timers and the seed shuffle)
  private clock: () => number;
  private rng: () => number;
  private roomEndHandler: RoomEndHandler | null = null;
  // roomId -> chosen chess config (room objects from the DB are fresh copies)
  private chessConfigs = new Map<string, any>();

  // `${roomId}:${userId}` -> live client (a user can sit in several rooms; the per-user map above is only "latest")
  private roomUserClients = new Map<string, ConnectedGameClient>();
  // roomId -> game type cache (so broadcast can project per viewer without a DB read)
  private roomGameTypes = new Map<string, string>();
  // roomId -> per-game lobby config chosen by the host (survives the throwaway objects returned by the DB layer)
  private roomConfigs = new Map<string, Record<string, any>>();
  // roomId -> number of games started (used to alternate sides on rematch)
  private roomGameCounts = new Map<string, number>();
  private graceMsPlaying: number;
  private graceMsWaiting: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService, opts: { graceMsPlaying?: number; graceMsWaiting?: number; sweep?: boolean; clock?: () => number; rng?: () => number } = {}) {
    this.db = db;
    this.graceMsPlaying = opts.graceMsPlaying ?? DEFAULT_GRACE_PLAYING_MS;
    this.graceMsWaiting = opts.graceMsWaiting ?? DEFAULT_GRACE_WAITING_MS;
    this.clock = opts.clock ?? Date.now;
    this.rng = opts.rng ?? secureRandom;
    this.installConfigPersistence();
    this.installRoomEndHook();
    // the Tournament Arena listens for its match rooms like any other listener would
    this.onGameRoomFinished((e) => this.onTournamentMatchRoomFinished(e));
    if (opts.sweep !== false) {
      this.sweepTimer = setInterval(() => this.sweepStaleRooms(), 60_000);
      this.sweepTimer.unref?.();
    }
  }

  /** Stops background timers (tests / graceful shutdown). */
  public dispose(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
    for (const t of this.disconnectGraceTimers.values()) clearTimeout(t);
    this.disconnectGraceTimers.clear();
    for (const map of [this.bingoTimers, this.doodleTimers, this.chessTimers, this.ludoTurnTimers, this.imposterTimers, this.emojiCharadesTimers, this.mafiaTimers, this.quizTimers, this.murderTimers, this.tournamentTimers]) {
      for (const t of map.values()) { clearTimeout(t); clearInterval(t); }
      map.clear();
    }
    const handlers: Set<RoomEndHandler> | undefined = (this.db as any).__roomEndHandlers;
    if (handlers && this.roomEndHandler) handlers.delete(this.roomEndHandler);
    this.roomEndHandler = null;
    this.watchedRooms.clear();
    this.watchedOutcomes.clear();
  }

  /**
   * GR-10: the DB layer rebuilds a fresh GameRoom object on every read, so lobby settings that handlers store as
   * ad-hoc properties (room.bingoConfig / tambolaConfig / doodleConfig / chessConfig) used to be lost. Every room object
   * returned by getGameRoomById/getGameRoomByCode now exposes those four properties as accessors backed by a
   * per-room map, so a write in one handler is visible to startGame and to every later read.
   */
  private installConfigPersistence(): void {
    const db: any = this.db;
    if (db.__configPersistenceInstalled) return;
    db.__configPersistenceInstalled = true;
    const keys = ['bingoConfig', 'tambolaConfig', 'doodleConfig', 'chessConfig'];
    const attach = (room: any) => {
      if (!room || !room.id) return room;
      for (const key of keys) {
        Object.defineProperty(room, key, {
          configurable: true,
          enumerable: false, // not serialised into room payloads / JSON
          get: () => this.roomConfigs.get(room.id)?.[key],
          set: (v: any) => {
            let cfg = this.roomConfigs.get(room.id);
            if (!cfg) { cfg = {}; this.roomConfigs.set(room.id, cfg); }
            if (v === undefined) delete cfg[key]; else cfg[key] = v;
          }
        });
      }
      return room;
    };
    for (const fn of ['getGameRoomById', 'getGameRoomByCode', 'findOpenWaitingGameRoom', 'findUserActiveGameRoom', 'findUserWaitingGameRoom']) {
      const orig = db[fn]?.bind(db);
      if (!orig) continue;
      db[fn] = (...args: any[]) => attach(orig(...args));
    }
  }

  /**
   * Every game finishes by `db.updateGameRoomStatus(room, 'FINISHED' | 'CANCELLED')` (a win, a draw, a forfeit, an abandoned room), so that
   * one call is wrapped once per database. The wrapper only forwards to the registered handlers; the original call happens first and
   * unchanged. A room nobody watches (every normal room) costs one Map lookup and nothing else.
   */
  private installRoomEndHook(): void {
    const db: any = this.db;
    let handlers: Set<RoomEndHandler> | undefined = db.__roomEndHandlers;
    if (!handlers) {
      const all = new Set<RoomEndHandler>();
      handlers = all;
      db.__roomEndHandlers = all;
      const original = db.updateGameRoomStatus.bind(db);
      db.updateGameRoomStatus = (roomId: string, status: GameRoomStatus, startedAt?: string, finishedAt?: string) => {
        original(roomId, status, startedAt, finishedAt);
        if ((status === 'FINISHED' || status === 'CANCELLED') && all.size) {
          for (const handler of Array.from(all)) {
            try { handler(roomId, status); } catch (err) { console.warn('[GameRoomManager] room end handler failed:', String((err as any)?.message ?? err).slice(0, 120)); }
          }
        }
      };
    }
    this.roomEndHandler = (roomId, status) => this.noteRoomEnded(roomId, status);
    handlers.add(this.roomEndHandler);
  }

  /** Subscribes to finished WATCHED rooms (see GameRoomFinishedEvent). Returns the unsubscribe function. */
  public onGameRoomFinished(listener: GameRoomFinishedListener): () => void {
    this.roomFinishedListeners.add(listener);
    return () => { this.roomFinishedListeners.delete(listener); };
  }

  /** Asks to be told when this room finishes. `watcher` is passed back in the event (the tournament room id). */
  public watchGameRoom(roomId: string, watcher: string): void {
    this.watchedRooms.set(roomId, watcher);
  }

  public unwatchGameRoom(roomId: string): void {
    this.watchedRooms.delete(roomId);
    this.watchedOutcomes.delete(roomId);
  }

  private noteRoomEnded(roomId: string, status: 'FINISHED' | 'CANCELLED'): void {
    if (!this.watchedRooms.has(roomId)) return; // every normal room stops here
    // Deferred to the end of the current handler: some games write the final state right AFTER the status, and the winner is read from it
    queueMicrotask(() => this.dispatchRoomFinished(roomId, status));
  }

  private dispatchRoomFinished(roomId: string, status: 'FINISHED' | 'CANCELLED'): void {
    const watcher = this.watchedRooms.get(roomId);
    if (watcher === undefined) return; // reported already (or no longer watched): a duplicate changes nothing
    const room = this.db.getGameRoomById(roomId);
    if (!room || (room.status !== 'FINISHED' && room.status !== 'CANCELLED')) return;
    const winnerUserId = this.watchedOutcomes.has(roomId) ? (this.watchedOutcomes.get(roomId) ?? null) : this.engineWinnerOf(room);
    this.watchedRooms.delete(roomId);
    this.watchedOutcomes.delete(roomId);
    const event: GameRoomFinishedEvent = { roomId, roomCode: room.roomCode, gameType: room.gameType, winnerUserId, status: room.status === 'CANCELLED' ? 'CANCELLED' : status, watcher };
    for (const listener of Array.from(this.roomFinishedListeners)) {
      try { listener(event); } catch (err) { console.warn('[GameRoomManager] room finished listener failed:', String((err as any)?.message ?? err).slice(0, 120)); }
    }
  }

  /** The winner of a two-player room taken from its server game state: a seated player, or null (draw, abandoned, no state). */
  public engineWinnerOf(room: GameRoom): string | null {
    const gs: any = room.gameState;
    if (!gs || typeof gs !== 'object' || gs.isDraw) return null;
    const w = typeof gs.winnerUserId === 'string' ? gs.winnerUserId : null;
    return w && room.players.some((p) => p.userId === w) ? w : null;
  }

  /** Players and read-only spectators of a room: everybody who receives broadcasts (each gets a non-secret projection). */
  private allViewers(roomId: string): ConnectedGameClient[] {
    const out: ConnectedGameClient[] = [];
    for (const c of this.roomClients.get(roomId) ?? []) out.push(c);
    for (const c of this.roomSpectators.get(roomId) ?? []) out.push(c);
    return out;
  }

  private liveClient(roomId: string, userId: string): ConnectedGameClient | undefined {
    const c = this.roomUserClients.get(`${roomId}:${userId}`);
    return c && !c.superseded && !c.left && c.socket.readyState === 1 ? c : undefined;
  }

  /** The seat of `userId` in `room` if (and only if) the user is an active (not LEFT) player. */
  public getActivePlayer(room: GameRoom | null | undefined, userId: string): GameRoomPlayer | undefined {
    return room?.players.find(p => p.userId === userId && p.status !== 'LEFT');
  }

  /**
   * Authoritative streak recorder: when a game is played or finishes between real users,
   * automatically record their daily friend streak in MongoDB.
   */
  public async recordGameStreaks(room: GameRoom): Promise<void> {
    if (!room || !room.players || room.players.length < 2) return;
    // Tournament Arena: the 2-player match rooms record the streaks of the people who actually play each other
    if (room.gameType === 'tournament') return;
    const realPlayers = room.players.filter(
      p => p.userId && !p.userId.startsWith('bot_') && !p.userId.startsWith('guest_')
    );
    if (realPlayers.length < 2) return;

    // Quiz Show Studio (up to 31 people): only the host's link with each player counts, not every pair
    const lastI = room.gameType === 'quiz-show' ? 1 : realPlayers.length;
    for (let i = 0; i < lastI; i++) {
      for (let j = i + 1; j < realPlayers.length; j++) {
        try {
          await mongoDb.recordSessionBetweenUsers(realPlayers[i].userId, realPlayers[j].userId, 1);
        } catch (err) {
          console.error(`[GameRoomManager] Failed to record streak between ${realPlayers[i].userId} and ${realPlayers[j].userId}:`, err);
        }
      }
    }
  }

  public updateGameRoomStatusWithStreak(
    room: GameRoom,
    status: GameRoomStatus,
    startedAt?: string,
    endedAt?: string
  ): void {
    this.db.updateGameRoomStatus(room.id, status, startedAt, endedAt);
    room.status = status;
    if (status === 'PLAYING' || status === 'FINISHED') {
      this.recordGameStreaks(room);
    }
  }

  /**
   * Returns active game information if a user is currently waiting or playing in a room.
   */
  public getUserActiveGame(userId: string): {
    roomId: string;
    roomCode: string;
    gameType: GameType;
    status: GameRoomStatus;
    playerCount: number;
    maxPlayers: number;
    hostUserId: string;
  } | null {
    // 1. Check in-memory connected user
    const client = this.userClients.get(userId);
    if (client && client.roomId) {
      const room = this.db.getGameRoomById(client.roomId);
      if (room && (room.status === 'WAITING' || room.status === 'PLAYING')) {
        return {
          roomId: room.id,
          roomCode: room.roomCode,
          gameType: room.gameType,
          status: room.status,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          hostUserId: room.hostUserId
        };
      }
    }

    // 2. Check database for active room where user is connected
    const activeRoom = this.db.findUserActiveGameRoom(userId);
    if (activeRoom) {
      return {
        roomId: activeRoom.id,
        roomCode: activeRoom.roomCode,
        gameType: activeRoom.gameType,
        status: activeRoom.status,
        playerCount: activeRoom.players.length,
        maxPlayers: activeRoom.maxPlayers,
        hostUserId: activeRoom.hostUserId
      };
    }

    return null;
  }

  /**
   * Generates a crisp, memorable temporary room code (e.g. LUDO-8F72 or FOUR-9B21)
   */
  public generateRoomCode(gameType = 'LUDO'): string {
    const PREFIXES: Record<string, string> = {
      ludo: 'LUDO', 'four-in-a-row': 'FOUR', 'tic-tac-toe': 'TIC', tambola: 'TAMBOLA',
      bingo: 'BINGO', 'doodle-duel': 'DOODLE', chess: 'CHESS', imposter: 'IMPOSTER', 'emoji-charades': 'EMOJI', 'mafia-night': 'MAFIA', 'quiz-show': 'QUIZ', 'murder-mystery': 'MURDER', tournament: 'ARENA'
    };
    const resolved = parseGameType(gameType);
    const prefix = (resolved && PREFIXES[resolved]) || String(gameType).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'GAME';
    for (let i = 0; i < 10; i++) {
      const suffix = secureCode(8);
      const code = `${prefix}-${suffix}`;
      const existing = this.db.getGameRoomByCode(code);
      if (!existing) {
        return code;
      }
    }
    return `${prefix}-${secureCode(10)}`;
  }

  /**
   * Creates a brand new game room for human players
   */
  public createGameRoom(params: {
    hostUser: { id: string; displayName: string; avatarUrl?: string | null };
    gameType: GameType;
    maxPlayers: number;
    isPrivate?: boolean;
    customCode?: string;
    /** a match room created by a Tournament Arena (never set from a client request) */
    tournament?: { id: string; code: string };
  }): GameRoom {
    const def = GAME_DEFINITIONS[params.gameType];
    if (!def) {
      throw new Error(`Unsupported game type: ${params.gameType}`);
    }

    if (!def.playerOptions.includes(params.maxPlayers)) {
      throw new Error(`Invalid player count for ${def.name}. Choose from: ${def.playerOptions.join(', ')}`);
    }

    const customCode = params.customCode ? String(params.customCode).trim().toUpperCase() : '';
    if (customCode && !/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(customCode)) {
      throw new Error('Room code must be 4-24 characters: letters, digits, "-" or "_"');
    }
    if (customCode && this.db.getGameRoomByCode(customCode)) {
      throw new Error('That room code is already in use');
    }
    const roomCode = customCode || this.generateRoomCode(params.gameType);

    const roomId = `groom_${nanoid(12)}`;
    const colors = seatColorsFor(params.gameType, params.maxPlayers);
    const hostColor = colors[0]; // Host always takes seat 0 (Red)

    const room: GameRoom = {
      id: roomId,
      roomCode,
      gameType: params.gameType,
      hostUserId: params.hostUser.id,
      maxPlayers: params.maxPlayers,
      // STRICT: requires the full human quota before starting; Imposter (4+) and Emoji Charades (2+) are lobby based (the host starts)
      minPlayers: params.gameType === 'imposter' ? imposterMinPlayers() : params.gameType === 'mafia-night' ? mafiaMinPlayers() : params.gameType === 'murder-mystery' ? murderMinPlayers() : params.gameType === 'emoji-charades' || params.gameType === 'quiz-show' ? def.minPlayers : params.gameType === 'tournament' ? tournamentMinPlayers() + 1 : params.maxPlayers,
      isPrivate: Boolean(params.isPrivate),
      status: 'WAITING',
      players: [],
      // Quiz Show Studio: the draft quiz lives in the room state from the start (the host edits it in the lobby)
      gameState: params.gameType === 'quiz-show'
        ? QuizShowEngine.createLobbyState({ userId: params.hostUser.id, displayName: params.hostUser.displayName, avatarUrl: params.hostUser.avatarUrl })
        // Murder Mystery Night: the lobby state carries the host's case choice
        : params.gameType === 'murder-mystery' ? MurderMysteryEngine.createLobbyState()
        // Tournament Arena: the lobby state carries the organiser's settings and seed order
        : params.gameType === 'tournament'
          ? TournamentEngine.createLobbyState({ userId: params.hostUser.id, displayName: params.hostUser.displayName, avatarUrl: params.hostUser.avatarUrl })
          : null,
      theme: 'romantic',
      createdAt: new Date().toISOString(),
      ...(params.tournament ? { tournamentId: params.tournament.id, tournamentCode: params.tournament.code } : {})
    };

    this.db.createGameRoom(room);
    this.roomGameTypes.set(roomId, params.gameType);
    // Not connected until the host's socket registers (GR-12)
    const hostPlayer = this.db.addPlayerToGameRoom(roomId, params.hostUser, 0, hostColor, false);
    room.players = [hostPlayer];

    return room;
  }

  /**
   * Smart Human-Only Matchmaking:
   * Finds an available waiting room with open slots or creates a new waiting room
   */
  public matchmakeOrHost(
    user: { id: string; displayName: string; avatarUrl?: string | null },
    gameType: GameType,
    maxPlayers: number
  ): { room: GameRoom; joinedExisting: boolean } {
    const openRoom = this.db.findOpenWaitingGameRoom(gameType, maxPlayers, user.id);

    if (openRoom) {
      // Join existing room
      const updatedRoom = this.joinRoom(openRoom.roomCode, user);
      return { room: updatedRoom, joinedExisting: true };
    }

    // No waiting human room found -> create new waiting room
    const created = this.createGameRoom({
      hostUser: user,
      gameType,
      maxPlayers,
      isPrivate: false
    });

    return { room: created, joinedExisting: false };
  }

  /**
   * Retrieves a room by its temporary room code
   */
  public getRoomByCode(roomCode: string): GameRoom | null {
    return this.db.getGameRoomByCode(roomCode);
  }

  /**
   * Joins a specific game room by its temporary room code
   */
  public joinRoom(
    roomCode: string,
    user: { id: string; displayName: string; avatarUrl?: string | null },
    opts: { connected?: boolean } = {}
  ): GameRoom {
    const room = this.db.getGameRoomByCode(roomCode);
    if (!room) {
      throw new Error(`Room with code "${roomCode}" not found or has expired.`);
    }

    // Check if user is already in the room
    const existingPlayer = room.players.find(p => p.userId === user.id);
    if (existingPlayer) {
      const cleanAvatar = (user.avatarUrl && !user.avatarUrl.includes('bottts') && !user.avatarUrl.includes('dicebear'))
        ? user.avatarUrl
        : null;
      if (existingPlayer.avatarUrl !== cleanAvatar) {
        existingPlayer.avatarUrl = cleanAvatar;
        this.db.updateGamePlayerProfile(room.id, user.id, existingPlayer.displayName, cleanAvatar || '');
      }
      // Rejoining own slot
      return room;
    }

    // A tournament match room is reserved for the two players the tournament seated: nobody else can take a seat, whatever the status
    if (room.tournamentId) {
      throw new Error('This match room is reserved for the two players of the match.');
    }

    if (room.status !== 'WAITING') {
      throw new Error('This match has already started or ended. Cannot join.');
    }

    if (room.gameType === 'tournament') {
      const lobby = room.gameState;
      if (lobby && TournamentEngine.isServerState(lobby) && TournamentEngine.isKicked(lobby as TournamentServerState, user.id)) {
        throw new Error('The organiser removed you from this tournament.');
      }
      if (!tournamentRateAllowed(`${room.id}:${user.id}:join`, 8, 60_000, this.clock())) {
        throw new Error('Too many attempts to join this tournament. Try again shortly.');
      }
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error(`Room is full (${room.players.length}/${room.maxPlayers} players).`);
    }

    const colors = seatColorsFor(room.gameType, room.maxPlayers);

    // Find first unoccupied seat
    const takenSeats = new Set(room.players.map(p => p.seat));
    let assignedSeat = -1;
    for (let s = 0; s < room.maxPlayers; s++) {
      if (!takenSeats.has(s)) {
        assignedSeat = s;
        break;
      }
    }

    if (assignedSeat === -1) {
      throw new Error('No seats available in this game room.');
    }

    const assignedColor = colors[assignedSeat];
    // REST joins have no socket yet: the seat is "not connected" until registerClient runs (GR-12)
    const newPlayer = this.db.addPlayerToGameRoom(room.id, user, assignedSeat, assignedColor, opts.connected ?? false);
    room.players.push(newPlayer);
    this.roomGameTypes.set(room.id, room.gameType);

    // Broadcast player joined to all room participants
    this.broadcast(room.id, {
      type: 'game:player_joined',
      roomId: room.id,
      payload: {
        room,
        player: newPlayer,
        totalPlayers: room.players.length,
        maxPlayers: room.maxPlayers
      }
    });

    // Check if room is now full of real human players -> auto-start immediately without manual click
    // Note: doodle-duel and tambola are lobby-based where host configures settings/roles and clicks Start
    if (this.shouldAutoStart(room)) {
      this.startGame(room);
    }

    return room;
  }

  /** Auto-start only when the room is full AND every seat has a live socket (REST-only joiners never trigger it). */
  private shouldAutoStart(room: GameRoom): boolean {
    if (room.status !== 'WAITING') return false;
    if (room.gameType === 'doodle-duel' || room.gameType === 'tambola' || room.gameType === 'imposter' || room.gameType === 'emoji-charades' || room.gameType === 'mafia-night' || room.gameType === 'quiz-show' || room.gameType === 'murder-mystery' || room.gameType === 'tournament') return false;
    if (room.players.length < room.maxPlayers) return false;
    return room.players.every(p => p.status !== 'LEFT' && Boolean(this.liveClient(room.id, p.userId)));
  }

  /**
   * Starts the game when all required human players are present
   */
  public startGame(room: GameRoom): void {
    const def = GAME_DEFINITIONS[room.gameType];
    const colors = def?.colorAssignments[room.maxPlayers];

    const playerConfigs = room.players.map(p => {
      const assignedColor = colors && colors[p.seat] ? colors[p.seat] : p.color;
      p.color = assignedColor;
      return {
        userId: p.userId,
        displayName: p.displayName,
        seat: p.seat,
        color: assignedColor,
        avatarUrl: p.avatarUrl ?? null
      };
    });

    // Alternate sides on every new game of the room (rematch fairness): chess colours / doodle drawer swap
    const gameNo = this.roomGameCounts.get(room.id) ?? 0;
    this.roomGameCounts.set(room.id, gameNo + 1);
    this.rematchVotes.delete(room.id); // votes never survive a new game (LU-7)
    if ((room.gameType === 'chess' || room.gameType === 'doodle-duel') && playerConfigs.length === 2 && gameNo % 2 === 1) {
      playerConfigs.reverse();
    }

    const now = new Date().toISOString();
    let initialState: any;

    if (room.gameType === 'four-in-a-row') {
      initialState = FourInARowEngine.createInitialState(playerConfigs, this.nextBoardStartingSeat(room));
    } else if (room.gameType === 'tic-tac-toe') {
      initialState = TicTacToeEngine.createInitialState(playerConfigs, this.nextBoardStartingSeat(room));
    } else if (room.gameType === 'bingo') {
      this.stopBingoAutoCall(room.id);
      const config = this.bingoConfigs.get(room.id) || DEFAULT_BINGO_DUEL_CONFIG;
      // Freshly shuffle 5x5 tickets/boards for all players on every start and rematch
      initialState = BingoDuelEngine.createInitialState(
        room.id,
        playerConfigs.map(p => p.userId),
        config
      );
    } else if (room.gameType === 'tambola') {
      this.stopBingoAutoCall(room.id);
      const config = this.bingoConfigs.get(room.id) || DEFAULT_BINGO_CONFIG;
      initialState = BingoEngine.createInitialState(playerConfigs, config);
      if (initialState.config?.autoCall) {
        BingoEngine.callNext(initialState);
      }
    } else if (room.gameType === 'doodle-duel') {
      this.stopDoodleTimer(room.id);
      const config = (room.gameState as any)?.config || (room as any).doodleConfig || DEFAULT_DOODLE_CONFIG;
      initialState = DoodleDuelEngine.createInitialState(playerConfigs, config);
      const p1 = playerConfigs[0] || { userId: 'p1', displayName: 'Player 1' };
      const p2 = playerConfigs[1] || p1;
      DoodleDuelEngine.startRoundIntro(initialState, p1.userId, p2.userId);
      initialState.drawerDisplayName = p1.displayName;
      initialState.guesserDisplayName = p2.displayName;
      initialState.currentRound = 1;
      initialState.timeLeftSeconds = 3;
    } else if (room.gameType === 'imposter') {
      // Everyone still seated plays; words of the previous game (rematch) are not repeated
      this.stopImposterTimer(room.id);
      const seated = room.players.filter(p => p.status !== 'LEFT');
      const rounds = this.imposterRounds.get(room.id) ?? IMPOSTER_ROUND_OPTIONS[0];
      initialState = ImposterEngine.createInitialState(
        playerConfigs
          .filter(c => seated.some(p => p.userId === c.userId))
          .map(c => ({ ...c, connected: Boolean(this.liveClient(room.id, c.userId)) })),
        rounds,
        Date.now(),
        { usedWords: (room.gameState as any)?.secret?.usedWords }
      );
    } else if (room.gameType === 'emoji-charades') {
      // Everyone still seated plays; puzzles of the previous game (rematch) are not repeated
      this.stopEmojiCharadesTimer(room.id);
      const seated = room.players.filter(p => p.status !== 'LEFT');
      const rounds = this.emojiCharadesRounds.get(room.id) ?? EMOJI_CHARADES_ROUND_OPTIONS[0];
      initialState = EmojiCharadesEngine.createInitialState(
        playerConfigs
          .filter(c => seated.some(p => p.userId === c.userId))
          .map(c => ({ ...c, connected: Boolean(this.liveClient(room.id, c.userId)) })),
        rounds,
        Date.now(),
        { usedPuzzleIds: (room.gameState as any)?.secret?.usedPuzzleIds }
      );
    } else if (room.gameType === 'mafia-night') {
      // Everyone still seated plays (a rematch re-deals every role)
      this.stopMafiaTimer(room.id);
      const seated = room.players.filter(p => p.status !== 'LEFT');
      initialState = MafiaNightEngine.createInitialState(
        playerConfigs
          .filter(c => seated.some(p => p.userId === c.userId))
          .map(c => ({ ...c, connected: Boolean(this.liveClient(room.id, c.userId)) })),
        Date.now()
      );
    } else if (room.gameType === 'murder-mystery') {
      // Everyone still seated plays (the host too). First game: the case the host picked in the lobby; a rematch plays another case.
      this.stopMurderTimer(room.id);
      const seated = room.players.filter(p => p.status !== 'LEFT');
      const prev: any = room.gameState && MurderMysteryEngine.isServerState(room.gameState) ? room.gameState : null;
      const rematch = Boolean(prev && prev.phase !== 'LOBBY');
      initialState = MurderMysteryEngine.createInitialState(
        playerConfigs
          .filter(c => seated.some(p => p.userId === c.userId))
          .map(c => ({ ...c, connected: Boolean(this.liveClient(room.id, c.userId)) })),
        Date.now(),
        {
          caseChoice: prev?.caseChoice,
          usedCaseIds: prev?.secret?.usedCaseIds ?? [],
          gamesPlayed: rematch ? (prev?.gamesPlayed ?? 0) + 1 : 0,
          forceDifferent: rematch
        }
      );
    } else if (room.gameType === 'quiz-show') {
      // The host is the quiz master; every other seated player competes. The quiz comes from the lobby draft (or the finished game, for a rematch).
      this.stopQuizTimer(room.id);
      const prev: any = room.gameState;
      const hostSeat = room.players.find(p => p.userId === room.hostUserId);
      initialState = QuizShowEngine.createInitialState(
        { userId: room.hostUserId, displayName: hostSeat?.displayName ?? 'Host', avatarUrl: hostSeat?.avatarUrl ?? null, connected: Boolean(this.liveClient(room.id, room.hostUserId)) },
        playerConfigs
          .filter(c => c.userId !== room.hostUserId && room.players.some(p => p.userId === c.userId && p.status !== 'LEFT'))
          .map(c => ({ userId: c.userId, displayName: c.displayName, avatarUrl: c.avatarUrl, seat: c.seat, connected: Boolean(this.liveClient(room.id, c.userId)) })),
        Array.isArray(prev?.quiz) ? prev.quiz : [],
        Date.now(),
        prev?.idSeq ?? 0
      );
    } else if (room.gameType === 'tournament') {
      // The organiser does not play: every other seated player is in the bracket (seeded by the lobby order)
      const lobby: any = room.gameState;
      if (!lobby || !TournamentEngine.isServerState(lobby)) throw new GameRuleError('NOT_PLAYING', 'The tournament lobby is not ready');
      initialState = TournamentEngine.createInitialState(
        lobby as TournamentServerState,
        room.players
          .filter(p => p.userId !== room.hostUserId && p.status !== 'LEFT')
          .map(p => ({ userId: p.userId, displayName: p.displayName, avatarUrl: p.avatarUrl ?? null, seat: p.seat, connected: Boolean(this.liveClient(room.id, p.userId)) })),
        this.clock()
      );
    } else if (room.gameType === 'chess') {
      this.stopChessClock(room.id);
      const config = this.chessConfigs.get(room.id) || DEFAULT_CHESS_CONFIG;
      const p1 = playerConfigs[0];
      const p2 = playerConfigs[1];
      initialState = ChessEngine.initGameState(
        room.id,
        { id: p1.userId, displayName: p1.displayName, avatarUrl: p1.avatarUrl },
        { id: p2.userId, displayName: p2.displayName, avatarUrl: p2.avatarUrl },
        config
      );
    } else {
      initialState = LudoEngine.createInitialState(playerConfigs, room.maxPlayers as any);
    }

    this.db.updateGameRoomStatus(room.id, 'PLAYING', now);
    this.db.updateGameRoomState(room.id, initialState, initialState?.currentTurnSeat ?? 0);

    room.status = 'PLAYING';
    room.gameState = initialState;
    room.startedAt = now;
    this.recordGameStreaks(room);

    // Broadcast game start countdown & authoritative initial state
    const startedMessage = {
      type: 'game:started',
      roomId: room.id,
      payload: {
        room,
        gameState: initialState,
        message: room.gameType === 'bingo'
          ? 'Bingo Duel started! Numbers calling...'
          : room.gameType === 'tambola'
            ? 'Tambola started! Numbers calling...'
            : room.gameType === 'doodle-duel'
              ? 'Doodle Duel started! Round intro begins.'
              : room.gameType === 'imposter'
                ? 'Imposter started! Check your role.'
                : room.gameType === 'emoji-charades'
                  ? 'Emoji Charades started! Get ready to guess.'
                  : room.gameType === 'mafia-night'
                    ? 'Mafia Night started! Check your role.'
                    : room.gameType === 'quiz-show'
                      ? 'Quiz Show Studio started! Get ready.'
                      : room.gameType === 'murder-mystery'
                        ? 'Murder Mystery Night started! Read your character card.'
                        : room.gameType === 'tournament'
                          ? 'The tournament has started! Check the bracket.'
                  : 'All human players connected! Game starting now!'
      }
    };
    if (room.gameType === 'bingo' || room.gameType === 'tambola') {
      // Per-viewer projection: no other tickets/boards, no future draw order
      this.sendBingoStateToAll(room.id, room.gameType, 'game:started', initialState,
        { message: startedMessage.payload.message }, room);
    } else {
      this.broadcast(room.id, startedMessage);
    }

    if (room.gameType === 'tambola' && initialState.config?.autoCall) {
      this.startBingoAutoCall(room.id, initialState.config.callingSpeed);
    } else if (room.gameType === 'bingo') {
      this.startBingoAutoCall(room.id, 0); // turn watchdog
    } else if (room.gameType === 'chess') {
      this.startChessClock(room.id);
    } else if (room.gameType === 'doodle-duel') {
      this.startDoodleTimer(room.id);
      this.broadcastDoodleState(room.id);
    } else if (room.gameType === 'ludo') {
      this.scheduleLudoTurnTimer(room.id);
    } else if (room.gameType === 'imposter') {
      this.startImposterTimer(room.id);
    } else if (room.gameType === 'emoji-charades') {
      this.startEmojiCharadesTimer(room.id);
    } else if (room.gameType === 'mafia-night') {
      this.startMafiaTimer(room.id);
    } else if (room.gameType === 'quiz-show') {
      this.startQuizTimer(room.id);
    } else if (room.gameType === 'murder-mystery') {
      this.startMurderTimer(room.id);
    } else if (room.gameType === 'tournament') {
      this.startTournamentTimer(room.id);
      this.openTournamentMatchRooms(room.id);
    }
    this.tournamentNoteStarted(room.id); // no-op unless this is a tournament match room
  }

  /**
   * Starting seat for Four in a Row / Tic-Tac-Toe: the first game starts with seat 0; after a finished game
   * the starter alternates (rematch fairness). The previous starter is stored on the state as `startingSeat`.
   */
  private nextBoardStartingSeat(room: GameRoom): number {
    const prev: any = room.gameState;
    if (prev && typeof prev.startingSeat === 'number') {
      const finished = !!(prev.winner || prev.isDraw);
      return finished ? (prev.startingSeat === 0 ? 1 : 0) : prev.startingSeat;
    }
    return 0;
  }

  /**
   * Common guard for Ludo / Four in a Row / Tic-Tac-Toe move handlers: right game type, game in progress,
   * sender is a seated, non-left player. Returns the player.
   */
  private assertBoardPlayer(room: GameRoom | null | undefined, userId: string, gameType: GameType, allowLeft = false): GameRoomPlayer {
    if (!room || !room.gameState) {
      throw new GameRuleError('NOT_PLAYING', 'Game room or state not found');
    }
    if (room.gameType !== gameType) {
      throw new GameRuleError('WRONG_GAME', `This action is not valid in a ${room.gameType} room`);
    }
    const player = room.players.find(p => p.userId === userId);
    if (!player || (!allowLeft && player.status === 'LEFT')) {
      throw new GameRuleError('NOT_PLAYER', 'Player not in this game room');
    }
    if (room.status === 'FINISHED') {
      throw new GameRuleError('GAME_OVER', 'Game is already finished');
    }
    if (room.status !== 'PLAYING') {
      throw new GameRuleError('NOT_PLAYING', 'Game has not started yet');
    }
    return player;
  }

  /** Strict integer parsing for board-game inputs: integers or plain digit strings; anything else is NaN. */
  private parseBoardInt(v: unknown): number {
    if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
    if (typeof v === 'string' && /^\s*-?\d{1,9}\s*$/.test(v)) return Number(v);
    return NaN;
  }

  /** Runs a board-game action; rule violations are reported to the sender as `game:error` (never consume a turn). */
  private runBoardAction(client: ConnectedGameClient, action: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      if (err instanceof GameRuleError) {
        try {
          if ((client.socket as any).readyState === 1) {
            client.socket.send(JSON.stringify({
              type: 'game:error',
              roomId: client.roomId,
              payload: { code: err.code, message: err.message, action }
            }));
          }
        } catch { /* socket gone */ }
        console.warn(`[ws:game] ${client.displayName} (${client.userId}) ${action}: ${err.code} ${err.message.slice(0, 100)}`);
        return;
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // Ludo turn timer (LU-4)
  // ---------------------------------------------------------------------

  public stopLudoTurnTimer(roomId: string): void {
    const t = this.ludoTurnTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.ludoTurnTimers.delete(roomId);
    }
  }

  public scheduleLudoTurnTimer(roomId: string): void {
    this.stopLudoTurnTimer(roomId);
    if (LUDO_TURN_TIMEOUT_MS <= 0) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'ludo' || room.status !== 'PLAYING' || !room.gameState || room.gameState.winnerColor) return;
    const seat: number = room.gameState.currentTurnSeat;
    const timer = setTimeout(() => this.autoPlayLudoTurn(roomId, seat), LUDO_TURN_TIMEOUT_MS);
    (timer as any).unref?.();
    this.ludoTurnTimers.set(roomId, timer);
    this.broadcast(roomId, {
      type: 'game:turn_timer',
      roomId,
      payload: {
        seat,
        userId: room.gameState.seats?.[seat]?.userId ?? null,
        timeoutMs: LUDO_TURN_TIMEOUT_MS,
        deadlineAt: Date.now() + LUDO_TURN_TIMEOUT_MS
      }
    });
  }

  private autoPlayLudoTurn(roomId: string, seat: number): void {
    this.ludoTurnTimers.delete(roomId);
    try {
      let room = this.db.getGameRoomById(roomId);
      if (!room || room.gameType !== 'ludo' || room.status !== 'PLAYING' || !room.gameState || room.gameState.winnerColor) return;
      if (room.gameState.currentTurnSeat !== seat) return;
      const player = room.players.find(p => p.seat === seat);
      if (!player) return;
      if (room.gameState.canRoll) {
        this.handleRollDice(roomId, player.userId, true);
        room = this.db.getGameRoomById(roomId);
      }
      const gs: LudoGameState | undefined = room?.gameState;
      if (room && gs && !gs.winnerColor && gs.currentTurnSeat === seat && !gs.canRoll && gs.legalMoves.length > 0) {
        const tokens = gs.tokens[gs.currentTurnColor];
        const best = [...gs.legalMoves].sort((a, b) => {
          const sa = tokens.find(t => t.id === a)?.step ?? -1;
          const sb = tokens.find(t => t.id === b)?.step ?? -1;
          return sb - sa;
        })[0];
        this.handleMoveToken(roomId, player.userId, best, true);
      }
    } catch (err) {
      console.warn(`[ludo] auto-play failed for room ${roomId}: ${String((err as any)?.message ?? err).slice(0, 100)}`);
    } finally {
      if (!this.ludoTurnTimers.has(roomId)) this.scheduleLudoTurnTimer(roomId);
    }
  }

  /**
   * Handle Player Roll Dice Action
   */
  public handleRollDice(roomId: string, userId: string, auto = false): void {
    const room = this.db.getGameRoomById(roomId);
    const player = this.assertBoardPlayer(room, userId, 'ludo', auto);
    if (!room) return;

    const result = LudoEngine.rollDice(room.gameState as LudoGameState, player.seat);
    this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);

    const rollId = `roll_${Date.now()}_${secureRandom().toString(36).substring(2, 7)}`;
    this.broadcast(room.id, {
      type: 'game:dice_rolled',
      roomId: room.id,
      payload: {
        rollId,
        timestamp: Date.now(),
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        diceValue: result.diceValue,
        hasLegalMoves: result.hasLegalMoves,
        legalMoves: result.state.legalMoves,
        earnedBonusRoll: result.earnedBonusRoll,
        passedTurn: result.passedTurn,
        auto,
        gameState: result.state
      }
    });
    this.scheduleLudoTurnTimer(room.id);
  }

  /**
   * Handle Player Move Token Action
   */
  public handleMoveToken(roomId: string, userId: string, tokenId: number, auto = false): void {
    const room = this.db.getGameRoomById(roomId);
    const player = this.assertBoardPlayer(room, userId, 'ludo', auto);
    if (!room) return;

    const result = LudoEngine.moveToken(room.gameState as LudoGameState, player.seat, tokenId);

    if (result.isWinner) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, player.seat);
    } else {
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);
    }

    const moveId = `move_${Date.now()}_${secureRandom().toString(36).substring(2, 7)}`;
    this.broadcast(room.id, {
      type: 'game:token_moved',
      roomId: room.id,
      payload: {
        moveId,
        timestamp: Date.now(),
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        tokenId,
        capturedToken: result.capturedToken,
        capturedTokens: result.capturedTokens,
        auto,
        reachedHome: result.reachedHome,
        earnedBonusRoll: result.earnedBonusRoll,
        isWinner: result.isWinner,
        winnerColor: result.state.winnerColor,
        winnerUserId: result.state.winnerUserId,
        gameState: result.state
      }
    });
    if (result.isWinner) this.stopLudoTurnTimer(room.id);
    else this.scheduleLudoTurnTimer(room.id);
  }

  /**
   * Handle Rematch Action. Rules (LU-7 / GR-16): only active players of a FINISHED room can vote, nobody who left
   * is counted (a rematch with a missing player is refused), votes are cleared when a new game starts or a player leaves.
   */
  public handleRematch(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    const requester = this.getActivePlayer(room, userId);
    if (!requester) throw new GameRuleError('NOT_PLAYER', 'Only players of this game can request a rematch');
    // A tournament match is played once: a rematch with the opponent would break the bracket
    if (room.tournamentId) throw new GameRuleError('REMATCH_UNAVAILABLE', 'This is a tournament match: the bracket decides what happens next, so there is no rematch');
    if (room.gameType === 'tournament') throw new GameRuleError('REMATCH_UNAVAILABLE', 'A tournament cannot be replayed');
    if (room.status !== 'FINISHED') throw new GameRuleError('REMATCH_UNAVAILABLE', 'A rematch can only be requested after the game has finished');
    if (room.gameType === 'quiz-show') {
      // the quiz master decides: no vote (see handleQuizRematch)
      this.handleQuizRematch(roomId, userId);
      return;
    }
    if (room.gameType === 'murder-mystery') {
      // the host decides: no vote (see handleMurderRematch)
      this.handleMurderRematch(roomId, userId);
      return;
    }
    if (room.gameType === 'imposter') {
      // Imposter: a rematch is played by everybody who is still seated, as long as that is at least 4 players
      if (room.players.filter(p => p.status !== 'LEFT').length < imposterMinPlayers()) {
        throw new GameRuleError('REMATCH_UNAVAILABLE', `A rematch needs at least ${imposterMinPlayers()} players still in the room`);
      }
    } else if (room.gameType === 'mafia-night') {
      // Mafia Night: a rematch is played by everybody who is still seated, as long as that is at least the minimum (5)
      if (room.players.filter(p => p.status !== 'LEFT').length < mafiaMinPlayers()) {
        throw new GameRuleError('REMATCH_UNAVAILABLE', `A rematch needs at least ${mafiaMinPlayers()} players still in the room`);
      }
    } else if (room.gameType === 'emoji-charades') {
      // Emoji Charades: a rematch is played by everybody who is still seated, as long as that is at least 2 players
      if (room.players.filter(p => p.status !== 'LEFT').length < EMOJI_CHARADES_MIN_PLAYERS) {
        throw new GameRuleError('REMATCH_UNAVAILABLE', 'A rematch needs at least 2 players still in the room');
      }
    } else if (room.players.some(p => p.status === 'LEFT')) {
      throw new GameRuleError('REMATCH_UNAVAILABLE', 'A rematch is not possible because a player has left the room');
    }

    if (!this.rematchVotes.has(roomId)) {
      this.rematchVotes.set(roomId, new Set());
    }
    const votes = this.rematchVotes.get(roomId)!;
    votes.add(userId);

    // Bots (Doodle Buddy) never vote: only human seats count (DD-7)
    const humans = room.players.filter(p => !BOT_USER_IDS.has(p.userId) && ((room.gameType !== 'imposter' && room.gameType !== 'emoji-charades' && room.gameType !== 'mafia-night') || p.status !== 'LEFT'));
    const eligible = new Set(humans.map(p => p.userId));
    for (const v of Array.from(votes)) if (!eligible.has(v)) votes.delete(v);

    const totalNeeded = humans.length;
    const votedUserIds = Array.from(votes);
    const allVoted = votes.size >= totalNeeded;

    // Broadcast rematch progress to all players in the room without kicking to waiting room
    this.broadcast(roomId, {
      type: 'game:rematch_status',
      roomId,
      payload: {
        requesterId: userId,
        requesterName: requester.displayName || 'Opponent',
        votedUserIds,
        votedCount: votes.size,
        totalNeeded,
        allVoted
      }
    });

    // Only restart game when all players agree!
    if (allVoted) {
      this.rematchVotes.delete(roomId);
      this.broadcast(roomId, {
        type: 'game:rematch_agreed',
        roomId,
        payload: {
          message: totalNeeded > 2 ? 'All players agreed! Rematch starting...' : 'Both players agreed! Rematch starting...',
          votedCount: totalNeeded,
          totalNeeded
        }
      });
      // Short delay for clean UI transition
      const t = setTimeout(() => {
        const freshRoom = this.db.getGameRoomById(roomId);
        // the room may have changed during the delay (someone left, new game already started)
        const stillComplete = freshRoom
          ? (freshRoom.gameType === 'imposter'
              ? freshRoom.players.filter(p => p.status !== 'LEFT').length >= imposterMinPlayers()
              : freshRoom.gameType === 'mafia-night'
                ? freshRoom.players.filter(p => p.status !== 'LEFT').length >= mafiaMinPlayers()
              : freshRoom.gameType === 'emoji-charades'
                ? freshRoom.players.filter(p => p.status !== 'LEFT').length >= EMOJI_CHARADES_MIN_PLAYERS
                : !freshRoom.players.some(p => p.status === 'LEFT'))
          : false;
        if (freshRoom && freshRoom.status === 'FINISHED' && stillComplete) {
          if (freshRoom.gameState) {
            delete (freshRoom.gameState as any).boards;
            delete (freshRoom.gameState as any).playerMarks;
            delete (freshRoom.gameState as any).playerPicks;
          }
          this.startGame(freshRoom);
        }
      }, 500);
      (t as any).unref?.();
    }
  }

  /**
   * Handle Rematch Decline Action
   */
  public handleRematchDecline(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    const decliner = this.getActivePlayer(room, userId);
    if (!decliner) throw new GameRuleError('NOT_PLAYER', 'Only players of this game can decline a rematch');
    if (room.status !== 'FINISHED') return;

    this.rematchVotes.delete(roomId);

    this.broadcast(roomId, {
      type: 'game:rematch_declined',
      roomId,
      payload: {
        declinerId: userId,
        declinerName: decliner.displayName || 'Opponent',
        reason: 'declined',
        message: `${decliner.displayName || 'Opponent'} declined the rematch request.`
      }
    });
  }

  /**
   * Handle Four In A Row Drop Disc Action
   */
  public handleDropDisc(roomId: string, userId: string, col: number): void {
    const room = this.db.getGameRoomById(roomId);
    const player = this.assertBoardPlayer(room, userId, 'four-in-a-row');
    if (!room) return;

    const result = FourInARowEngine.dropDisc(
      room.gameState,
      player.seat,
      col,
      { userId: player.userId, displayName: player.displayName },
      room.players
    );

    if (result.isWinner || result.isDraw) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, result.isWinner ? player.seat : undefined);
    } else {
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);
    }

    this.broadcast(room.id, {
      type: 'game:disc_dropped',
      roomId: room.id,
      payload: {
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        row: result.row,
        col: result.col,
        disc: result.disc,
        isWinner: result.isWinner,
        isDraw: result.isDraw,
        winningLine: result.state.winningLine,
        gameState: result.state
      }
    });
  }

  /**
   * Handle Tic Tac Toe Move Action
   */
  public handleTicTacToeMove(roomId: string, userId: string, cellIndex: number): void {
    const room = this.db.getGameRoomById(roomId);
    const player = this.assertBoardPlayer(room, userId, 'tic-tac-toe');
    if (!room) return;

    const result = TicTacToeEngine.makeMove(
      room.gameState,
      player.seat,
      cellIndex,
      { userId: player.userId, displayName: player.displayName },
      room.players
    );

    if (result.isWinner || result.isDraw) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, result.isWinner ? player.seat : undefined);
    } else {
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);
    }

    this.broadcast(room.id, {
      type: 'game:cell_marked',
      roomId: room.id,
      payload: {
        seat: player.seat,
        color: player.color,
        displayName: player.displayName,
        cellIndex: result.cellIndex,
        mark: result.mark,
        isWinner: result.isWinner,
        isDraw: result.isDraw,
        winningLine: result.state.winningLine,
        gameState: result.state
      }
    });
  }

  // =====================================================================
  // BINGO DUEL & TAMBOLA GAME HANDLERS
  // =====================================================================

  // ---- Bingo/Tambola helpers: per-viewer state projection and error feedback ----

  /** Per-viewer projection of a bingo/tambola state (secrets removed). Other game types are returned unchanged. */
  public publicBingoState(gameType: string, state: any, viewerId: string | null | undefined): any {
    if (!state) return state;
    if (gameType === 'bingo') return publicDuelStateFor(state, viewerId);
    if (gameType === 'tambola') return publicTambolaStateFor(state, viewerId);
    return state;
  }

  /** Room object whose gameState is the viewer's projection (for game:sync / reconnect / REST style payloads). */
  public publicRoomView<T extends { gameType: string; gameState?: any }>(room: T, viewerId: string | null | undefined): T {
    if (!room || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return room;
    return { ...room, gameState: this.publicBingoState(room.gameType, room.gameState, viewerId) };
  }

  /**
   * Sends `type` to every client of the room individually, each with only their own projection of the state.
   * `extra` may be an object or a function (viewerId, publicState) => object for per-viewer fields.
   * If `room` is given, payload.room is included with the projected state too.
   */
  private sendBingoStateToAll(
    roomId: string,
    gameType: string,
    type: string,
    state: any,
    extra?: Record<string, any> | ((viewerId: string, pub: any) => Record<string, any>),
    room?: any
  ): void {
    const clients = this.allViewers(roomId);
    if (!clients.length) return;
    for (const client of clients) {
      if (client.socket.readyState !== 1) continue;
      const pub = this.publicBingoState(gameType, state, client.userId);
      const add = typeof extra === 'function' ? extra(client.userId, pub) : (extra || {});
      const payload: Record<string, any> = { ...add, gameState: pub };
      if (room) payload.room = { ...room, gameState: pub };
      try {
        client.socket.send(JSON.stringify({ type, roomId, payload }));
      } catch {}
    }
  }

  /** Same as sendBingoStateToAll for a single recipient. */
  private sendBingoStateToUser(
    userId: string,
    roomId: string,
    gameType: string,
    type: string,
    state: any,
    extra?: Record<string, any>
  ): void {
    this.sendToUser(userId, {
      type,
      roomId,
      payload: { ...(extra || {}), gameState: this.publicBingoState(gameType, state, userId) }
    });
  }

  private bingoError(userId: string, roomId: string, message: string, code: string = 'BINGO_ERROR'): void {
    this.sendToUser(userId, { type: 'bingo:error', roomId, payload: { code, message } });
  }

  /** Loads the room and checks the actor is a seated player of a bingo/tambola room; reports to the sender otherwise. */
  private getBingoRoomForPlayer(roomId: string, userId: string, gameType?: 'bingo' | 'tambola'): { room: any; player: any } | null {
    const room: any = this.db.getGameRoomById(roomId);
    if (!room || (room.gameType !== 'bingo' && room.gameType !== 'tambola') || (gameType && room.gameType !== gameType)) return null;
    const player = room.players.find((p: any) => p.userId === userId);
    if (!player) {
      this.bingoError(userId, roomId, 'You are not a player in this game.', 'NOT_A_PLAYER');
      return null;
    }
    return { room, player };
  }

  private finishBingoRoom(roomId: string): void {
    this.stopBingoAutoCall(roomId);
    this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, new Date().toISOString());
  }

  private broadcastBingoGameOver(room: any, state: any): void {
    if (room.gameType === 'bingo') {
      this.sendBingoStateToAll(room.id, 'bingo', 'bingo:game_over', state, {
        winnerUserId: state.winnerUserId,
        winnerDisplayName: state.winnerDisplayName,
        roundHistory: state.roundHistory,
        summary: state.statusMessage
      });
    } else {
      this.sendBingoStateToAll(room.id, 'tambola', 'bingo:game_over', state, {
        winnerUserId: state.winnerUserId,
        winnerDisplayName: state.winnerDisplayName,
        scores: state.scores,
        summary: state.gameSummary
      });
    }
  }

  /** (Re)arms the right timer for a running bingo/tambola room, e.g. after a server restart or reconnect. */
  public ensureBingoTimer(roomId: string): void {
    if (this.bingoTimers.has(roomId)) return;
    const room: any = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || room.gameState.phase !== 'PLAYING') return;
    if (room.gameType === 'tambola') {
      if (room.gameState.config?.autoCall) this.startBingoAutoCall(roomId, room.gameState.config.callingSpeed);
    } else if (room.gameType === 'bingo') {
      this.startBingoAutoCall(roomId, 0);
    }
  }

  /**
   * Tambola: draws a number every `speedMs` (clamped 800..30000).
   * Bingo Duel: runs a 2 s watchdog that auto-picks for a player whose turn timed out.
   */
  public startBingoAutoCall(roomId: string, speedMs: number): void {
    this.stopBingoAutoCall(roomId);
    const room: any = this.db.getGameRoomById(roomId);
    const isDuel = room?.gameType === 'bingo';
    const requested = Number(speedMs);
    const interval = isDuel
      ? 2000
      : Math.min(30000, Math.max(800, Number.isFinite(requested) && requested > 0 ? requested : 3000));

    if (!isDuel) {
      // Call first number shortly after start (1000ms) so players see the first number right away
      setTimeout(() => {
        const r: any = this.db.getGameRoomById(roomId);
        if (r && r.status === 'PLAYING' && r.gameState && r.gameType === 'tambola' && this.bingoTimers.has(roomId)) {
          if (!r.gameState.currentNumber && r.gameState.calledNumbers.length === 0) {
            this.tickBingoAutoCall(roomId);
          }
        }
      }, 1000);
    }

    const timer = setInterval(() => {
      this.tickBingoAutoCall(roomId);
    }, interval);
    if (typeof (timer as any).unref === 'function') (timer as any).unref();
    this.bingoTimers.set(roomId, timer);
  }

  public stopBingoAutoCall(roomId: string): void {
    const existing = this.bingoTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.bingoTimers.delete(roomId);
    }
  }

  private hasLiveBingoClients(roomId: string): boolean {
    const set = this.roomClients.get(roomId);
    if (!set) return false;
    for (const c of set) if (c.socket.readyState === 1) return true;
    return false;
  }

  public tickBingoAutoCall(roomId: string): void {
    const room: any = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) {
      this.stopBingoAutoCall(roomId);
      return;
    }
    // Nobody is watching: stop; a reconnect re-arms the timer (ensureBingoTimer)
    if (!this.hasLiveBingoClients(roomId)) {
      this.stopBingoAutoCall(roomId);
      return;
    }

    if (room.gameState.phase !== 'PLAYING') {
      this.stopBingoAutoCall(roomId);
      return;
    }
    if (room.gameState.callingPaused) return;

    if (room.gameType === 'bingo') {
      // Turn watchdog: auto-pick for an idle player
      const state = room.gameState;
      if (!BingoDuelEngine.isTurnExpired(state)) return;
      const playerUserIds = room.players.map((p: any) => p.userId);
      const result = BingoDuelEngine.autoPick(state, playerUserIds);
      if (!result || !result.success) return;
      room.gameState = result.state;
      this.db.updateGameRoomState(room.id, result.state);
      this.broadcastDuelPick(room, result, true);
      return;
    }

    // Tambola 1-90
    const { state, calledNumber, isFinished } = BingoEngine.callNext(room.gameState);
    room.gameState = state;
    this.db.updateGameRoomState(room.id, state);

    if (isFinished) this.finishBingoRoom(roomId);

    this.sendBingoStateToAll(room.id, 'tambola', 'bingo:number_called', state, {
      number: calledNumber,
      word: state.currentNumberWord,
      calledNumbers: state.calledNumbers,
      remainingCount: state.callQueue.length
    });

    if (isFinished) this.broadcastBingoGameOver(room, state);
  }

  /** Broadcasts a turn pick (manual or timed-out auto pick) and, if it ended the match, the game-over event. */
  private broadcastDuelPick(room: any, result: any, auto: boolean): void {
    const state = result.state;
    if (result.isFinished) this.finishBingoRoom(room.id);

    this.sendBingoStateToAll(room.id, 'bingo', 'bingo:number_called', state, (_viewer, pub) => ({
      number: result.calledNumber,
      calledNumber: result.calledNumber,
      currentNumber: result.calledNumber,
      word: state.currentNumberWord,
      numberWord: state.currentNumberWord,
      last5: state.lastCalledNumbers,
      lastCalledNumbers: state.lastCalledNumbers,
      allCalled: state.calledNumbers,
      calledNumbers: state.calledNumbers,
      remainingCount: 25 - state.calledNumbers.length,
      currentTurnUserId: state.currentTurnUserId,
      callerUserId: state.callerUserId,
      playerProgress: pub.playerProgress,
      auto
    }));

    if (result.isFinished) this.broadcastBingoGameOver(room, state);
  }

  public handleBingoStart(roomId: string, userId: string, config?: any): void {
    const room: any = this.db.getGameRoomById(roomId);
    if (!room || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return;
    if (room.hostUserId !== userId) {
      this.bingoError(userId, roomId, 'Only the host can start the game', 'NOT_HOST');
      return;
    }
    if (room.status !== 'WAITING') {
      this.bingoError(userId, roomId, 'The game has already started.', 'ALREADY_STARTED');
      return;
    }
    if (room.players.length < 2) {
      this.bingoError(userId, roomId, 'At least 2 players are needed to start.', 'NOT_ENOUGH_PLAYERS');
      return;
    }
    if (config !== undefined && config !== null) {
      try {
        this.storeBingoConfig(room, config);
      } catch (e: any) {
        this.bingoError(userId, roomId, String(e?.message || 'Invalid config'), 'INVALID_CONFIG');
        return;
      }
    }
    this.startGame(room);
  }

  /** Validates and stores the host's config server side (survives rematch because it is keyed by room id). */
  private storeBingoConfig(room: any, partial: any): any {
    const current = this.bingoConfigs.get(room.id);
    const updated = room.gameType === 'bingo'
      ? BingoDuelEngine.sanitizeConfig(partial, current || DEFAULT_BINGO_DUEL_CONFIG)
      : BingoEngine.sanitizeConfig(partial, current || DEFAULT_BINGO_CONFIG);
    this.bingoConfigs.set(room.id, updated);
    return updated;
  }

  public handleBingoTogglePause(roomId: string, userId: string): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId);
    if (!ctx) return;
    const { room } = ctx;
    if (!room.gameState) return;
    if (room.hostUserId !== userId) {
      this.bingoError(userId, roomId, 'Only the host can pause or resume calling', 'NOT_HOST');
      return;
    }
    if (room.gameState.phase !== 'PLAYING') {
      this.bingoError(userId, roomId, 'The game is not in progress.', 'WRONG_PHASE');
      return;
    }
    room.gameState.callingPaused = !room.gameState.callingPaused;
    // Do not let a turn timeout fire the instant the game is resumed
    if (!room.gameState.callingPaused && room.gameType === 'bingo') room.gameState.turnStartedAt = Date.now();
    this.db.updateGameRoomState(room.id, room.gameState);

    this.sendBingoStateToAll(room.id, room.gameType, 'bingo:calling_paused', room.gameState, {
      callingPaused: room.gameState.callingPaused
    });
  }

  public handleBingoNextRound(roomId: string, userId: string): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId, 'bingo');
    if (!ctx) return;
    const { room } = ctx;
    if (!room.gameState) return;
    if (room.hostUserId !== userId) {
      this.bingoError(userId, roomId, 'Only the host can start the next round', 'NOT_HOST');
      return;
    }
    if (room.gameState.phase !== 'ROUND_OVER') {
      this.bingoError(userId, roomId, 'The next round can only start after a round has finished.', 'WRONG_PHASE');
      return;
    }
    const state = BingoDuelEngine.startNextRound(room.gameState);
    room.gameState = state;
    this.db.updateGameRoomState(room.id, state);

    this.sendBingoStateToAll(room.id, 'bingo', 'bingo:round_started', state, {
      currentRound: state.currentRound
    });

    // Turn watchdog for the new round (Bingo Duel is turn based: no timed number calls)
    this.startBingoAutoCall(room.id, 0);
  }

  public handleBingoCallNext(roomId: string, userId: string): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId);
    if (!ctx) return;
    const { room } = ctx;
    if (!room.gameState) return;
    if (room.hostUserId !== userId) {
      this.bingoError(userId, roomId, 'Only the host can manually call numbers', 'NOT_HOST');
      return;
    }
    if (room.gameState.phase !== 'PLAYING') {
      this.bingoError(userId, roomId, 'The game is not in progress.', 'WRONG_PHASE');
      return;
    }

    if (room.gameType === 'bingo') {
      // Bingo Duel is turn based: players pick the numbers themselves (bingo:select_number)
      this.bingoError(userId, roomId, 'Bingo Duel numbers are picked by the players on their turn.', 'TURN_BASED');
      return;
    }

    const { state, calledNumber, isFinished } = BingoEngine.callNext(room.gameState);
    room.gameState = state;
    this.db.updateGameRoomState(room.id, state);

    if (isFinished) this.finishBingoRoom(roomId);

    this.sendBingoStateToAll(room.id, 'tambola', 'bingo:number_called', state, {
      number: calledNumber,
      word: state.currentNumberWord,
      calledNumbers: state.calledNumbers,
      remainingCount: state.callQueue.length
    });

    if (isFinished) this.broadcastBingoGameOver(room, state);
  }

  public handleBingoClaim(roomId: string, userId: string, condition?: any): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId);
    if (!ctx) return;
    const { room, player } = ctx;
    if (!room.gameState) return;
    if (room.status !== 'PLAYING' || room.gameState.phase !== 'PLAYING') {
      this.bingoError(userId, roomId, 'There is nothing to claim right now.', 'WRONG_PHASE');
      return;
    }

    if (room.gameType === 'bingo') {
      const names: Record<string, string> = {};
      room.players.forEach((p: any) => { names[p.userId] = p.displayName; });
      const result = BingoDuelEngine.claimBingo(room.gameState, userId, player.displayName, names);
      this.db.updateGameRoomState(room.id, room.gameState);
      const state = room.gameState;
      const winnerName = result.winnerDisplayName || player.displayName;
      const roundDecided = Boolean(result.winnerUserId);

      this.sendBingoStateToUser(userId, room.id, 'bingo', 'bingo:claim_result', state, {
        userId,
        displayName: player.displayName,
        valid: result.valid,
        message: result.message,
        penaltySeconds: result.penaltySeconds,
        isMatchOver: result.isMatchOver,
        isRoundOver: result.isRoundOver,
        winningIndices: result.winningIndices
      });

      if (roundDecided) {
        if (result.isMatchOver) {
          this.finishBingoRoom(room.id);
        } else if (result.isRoundOver) {
          this.stopBingoAutoCall(room.id);
        }

        this.sendBingoStateToAll(room.id, 'bingo', 'bingo:condition_won', state, {
          conditionName: 'BINGO!',
          userId: result.winnerUserId,
          displayName: winnerName,
          roundsWon: state.roundsWon,
          winningIndices: result.winningIndices,
          isGameOver: result.isMatchOver,
          isRoundOver: result.isRoundOver
        });

        if (result.isMatchOver) this.broadcastBingoGameOver(room, state);
      }
    } else {
      // Tambola
      const result = BingoEngine.validateClaim(
        room.gameState,
        userId,
        player.displayName,
        condition
      );

      this.db.updateGameRoomState(room.id, room.gameState);
      const state = room.gameState;

      this.sendBingoStateToUser(userId, room.id, 'tambola', 'bingo:claim_result', state, {
        userId,
        displayName: player.displayName,
        condition,
        valid: result.valid,
        message: result.message,
        pointsEarned: result.pointsEarned,
        penaltySeconds: result.penaltySeconds
      });

      if (result.valid) {
        const isGameOver = state.phase === 'FINISHED';
        if (isGameOver) this.finishBingoRoom(room.id);

        this.sendBingoStateToAll(room.id, 'tambola', 'bingo:condition_won', state, {
          condition,
          conditionName: BingoEngine.getConditionFriendlyName(condition),
          userId,
          displayName: player.displayName,
          points: result.pointsEarned,
          scores: state.scores,
          isGameOver
        });

        if (isGameOver) this.broadcastBingoGameOver(room, state);
      }
    }
  }

  public handleBingoMark(roomId: string, userId: string, numberToMark: number, forceMark?: boolean): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId);
    if (!ctx) return;
    const { room } = ctx;
    if (!room.gameState || room.status !== 'PLAYING') return;
    if (!Number.isInteger(numberToMark)) {
      this.bingoError(userId, roomId, 'Invalid number.', 'INVALID_NUMBER');
      return;
    }

    if (room.gameType === 'bingo') {
      const { state, success } = BingoDuelEngine.markNumber(room.gameState, userId, numberToMark);
      if (!success) return;
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      // Marks are private: only the owner receives the list; everyone gets the (public) state projection
      this.sendBingoStateToAll(room.id, 'bingo', 'bingo:number_marked', state, (viewer, pub) => ({
        userId,
        number: numberToMark,
        markedCount: state.playerMarks[userId]?.length ?? 0,
        ...(viewer === userId ? { playerMarks: state.playerMarks[userId] } : {}),
        playerProgress: pub.playerProgress[userId]
      }));
    } else {
      const before = room.gameState.playerMarked[userId]?.length ?? 0;
      const updatedState = BingoEngine.markNumber(room.gameState, userId, numberToMark, forceMark);
      const after = updatedState.playerMarked[userId]?.length ?? 0;
      if (before === after) return; // nothing changed (not on ticket / not called / duplicate)
      room.gameState = updatedState;
      this.db.updateGameRoomState(room.id, updatedState);

      this.sendBingoStateToAll(room.id, 'tambola', 'bingo:number_marked', updatedState, (viewer) => ({
        userId,
        number: numberToMark,
        markedCount: after,
        ...(viewer === userId ? { playerMarked: updatedState.playerMarked[userId] } : {})
      }));
    }
  }

  public handleBingoSelectNumber(roomId: string, userId: string, numberToCall: number): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId, 'bingo');
    if (!ctx) return;
    const { room } = ctx;
    if (!room.gameState) return;

    const playerUserIds = room.players.map((p: any) => p.userId);
    const result = BingoDuelEngine.selectNumber(room.gameState, userId, numberToCall, playerUserIds);

    if (!result.success) {
      this.bingoError(userId, room.id, result.message, 'INVALID_PICK');
      return;
    }

    room.gameState = result.state;
    this.db.updateGameRoomState(room.id, result.state);
    this.broadcastDuelPick(room, result, false);
  }

  public handleBingoSetBoard(roomId: string, userId: string, board: number[][]): void {
    const ctx = this.getBingoRoomForPlayer(roomId, userId, 'bingo');
    if (!ctx) return;
    const { room } = ctx;
    if (!room.gameState) return;

    const playerUserIds = room.players.map((p: any) => p.userId);
    const { state, success, message, allReady } = BingoDuelEngine.setPlayerBoard(
      room.gameState,
      userId,
      board,
      playerUserIds
    );

    if (success) {
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      // The board itself is only sent back to its owner
      this.sendBingoStateToAll(room.id, 'bingo', 'bingo:board_updated', state, (viewer) => ({
        userId,
        ...(viewer === userId ? { board } : {}),
        playerProgress: viewer === userId ? state.playerProgress[userId] : { ...state.playerProgress[userId], matchedIndices: undefined, completedLines: undefined },
        message,
        allReady
      }));

      if (allReady) {
        this.sendBingoStateToAll(room.id, 'bingo', 'bingo:round_started', state, {
          currentRound: state.currentRound,
          message: 'Both players ready! Match started! Pick numbers alternatively.'
        });
        this.startBingoAutoCall(room.id, 0);
      }
    } else {
      this.bingoError(userId, room.id, message, 'BOARD_REJECTED');
    }
  }

  public handleBingoConfigUpdate(roomId: string, userId: string, partialConfig: any): void {
    const room: any = this.db.getGameRoomById(roomId);
    if (!room || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return;
    if (room.hostUserId !== userId) {
      this.bingoError(userId, roomId, 'Only host can update room settings', 'NOT_HOST');
      return;
    }
    if (room.status !== 'WAITING') {
      this.bingoError(userId, roomId, 'Settings can only be changed before the game starts.', 'ALREADY_STARTED');
      return;
    }
    let updated: any;
    try {
      updated = this.storeBingoConfig(room, partialConfig);
    } catch (e: any) {
      this.bingoError(userId, roomId, String(e?.message || 'Invalid config'), 'INVALID_CONFIG');
      return;
    }

    this.broadcast(room.id, {
      type: 'bingo:config_updated',
      roomId: room.id,
      payload: { config: updated }
    });
  }

  // =====================================================================
  // DOODLE DUEL GAME HANDLERS
  // =====================================================================

  public startDoodleTimer(roomId: string): void {
    this.stopDoodleTimer(roomId);
    const timer = setInterval(() => {
      this.tickDoodleTimer(roomId);
    }, 1000);
    this.doodleTimers.set(roomId, timer);
  }

  public stopDoodleTimer(roomId: string): void {
    const existing = this.doodleTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.doodleTimers.delete(roomId);
    }
    clearDoodleRate(roomId);
  }

  /** Error feedback to the sender only (web shows it as a toast). */
  private doodleReject(userId: string, code: string, message: string): void {
    try {
      this.sendToUser(userId, { type: 'doodle:error', payload: { code, message } });
    } catch {}
  }

  private doodleBotStrokes(word: string, n: number): any[] {
    // Deterministic, word-dependent scribbles (a hash of the word seeds the shape)
    let h = 2166136261;
    for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const rnd = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const colors = ['#ff3864', '#3b82f6', '#22c55e', '#eab308'];
    const strokes: any[] = [];
    for (let i = 0; i < n; i++) {
      const cx = 0.25 + rnd() * 0.5;
      const cy = 0.25 + rnd() * 0.5;
      const r = 0.1 + rnd() * 0.15;
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        pts.push({ x: Math.min(1, Math.max(0, cx + Math.cos(a) * r)), y: Math.min(1, Math.max(0, cy + Math.sin(a) * r * (0.6 + rnd() * 0.6))) });
      }
      strokes.push({ id: `strk_bot_${Date.now()}_${i}`, color: colors[i % colors.length], size: 5, points: pts, isEraser: false, timestamp: Date.now() });
    }
    return strokes;
  }

  public tickDoodleTimer(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || room.gameType !== 'doodle-duel') {
      this.stopDoodleTimer(roomId);
      return;
    }

    // Nobody connected -> stop the clock (it is restarted when a player (re)connects)
    const connected = this.roomClients.get(roomId);
    if (!connected || connected.size === 0) {
      this.stopDoodleTimer(roomId);
      return;
    }

    try {
      const { state } = DoodleDuelEngine.tick(room.gameState);
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      this.broadcastDoodleState(roomId);

      if (state.phase === 'FINISHED') {
        this.stopDoodleTimer(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
        return;
      }

      // Bot duelist: timings are relative to the configured draw/guess time
      const hasBot = room.players.some(p => p.userId === 'bot_duelist');
      if (hasBot) {
        const drawTime = state.config.drawTime || 60;
        const guessTime = state.config.guessTime || 60;
        if (state.phase === 'WORD_CHOICE' && state.drawerUserId === 'bot_duelist') {
          if (state.timeRemaining <= 27) {
            const choice: any = (state.wordChoices || [])[0];
            const word = typeof choice === 'object' ? choice?.word : choice;
            if (word) this.handleDoodleChooseWord(roomId, 'bot_duelist', word);
          }
        } else if (state.phase === 'DRAWING' && state.drawerUserId === 'bot_duelist') {
          const elapsed = drawTime - state.timeRemaining;
          if (elapsed === 2 || elapsed === 4) {
            const strokes = this.doodleBotStrokes(state.secretWord || 'doodle', 2);
            this.handleDoodleStroke(roomId, 'bot_duelist', strokes[elapsed === 2 ? 0 : 1]);
          } else if (elapsed === Math.max(6, Math.ceil(drawTime * 0.6))) {
            this.handleDoodleDoneDrawing(roomId, 'bot_duelist');
          }
        } else if (state.phase === 'GUESSING' && state.guesserUserId === 'bot_duelist') {
          const elapsed = guessTime - state.timeRemaining;
          if (elapsed === Math.floor(guessTime * 0.25)) {
            this.handleDoodleGuess(roomId, 'bot_duelist', 'tree?');
          } else if (elapsed === Math.floor(guessTime * 0.5)) {
            this.handleDoodleGuess(roomId, 'bot_duelist', 'maybe a rocket');
          } else if (elapsed === Math.floor(guessTime * 0.8) && state.strokes.length > 0 && state.secretWord && secureRandom() < 0.6) {
            this.handleDoodleGuess(roomId, 'bot_duelist', state.secretWord);
          }
        }
      }
    } catch (err) {
      console.error('Error in tickDoodleTimer:', err);
    }
  }

  /** Per-viewer state: only the drawer (and everyone after the round result) sees the secret word. */
  public broadcastDoodleState(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;

    const fullState = room.gameState;
    const clients = this.allViewers(roomId);
    if (!clients.length) return;

    const cache = new Map<string, string>();
    for (const client of clients) {
      if (client.socket.readyState !== 1) continue;
      const key = client.userId === fullState.drawerUserId ? 'drawer' : 'other';
      let data = cache.get(key);
      if (!data) {
        data = JSON.stringify({
          type: 'doodle:state_sync',
          roomId,
          payload: { gameState: DoodleDuelEngine.publicStateFor(fullState, client.userId) }
        });
        cache.set(key, data);
      }
      try {
        client.socket.send(data);
      } catch {}
    }
  }

  private doodleLobbyState(room: any, config?: any): DoodleGameState {
    const def = GAME_DEFINITIONS[room.gameType];
    const colors = def?.colorAssignments[room.maxPlayers];
    const playerConfigs = room.players.map((p: any) => ({
      userId: p.userId,
      displayName: p.displayName,
      seat: p.seat,
      color: colors && colors[p.seat] ? colors[p.seat] : p.color
    }));
    return DoodleDuelEngine.createInitialState(playerConfigs, config || DEFAULT_DOODLE_CONFIG);
  }

  public handleDoodleSelectRole(roomId: string, userId: string, drawerUserIdOrRole: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'doodle-duel') return;

    if (!room.players.some(p => p.userId === userId)) {
      return this.doodleReject(userId, 'not_player', 'Only players can choose roles');
    }
    if (room.status === 'PLAYING' || room.status === 'FINISHED' ||
        (room.gameState && room.gameState.phase !== 'LOBBY' && room.gameState.phase !== 'ROLE_SELECTION')) {
      return this.doodleReject(userId, 'wrong_phase', 'Roles can only be chosen in the lobby');
    }

    if (!room.gameState) {
      room.gameState = this.doodleLobbyState(room);
    }
    const gs = room.gameState;
    if (!gs.roleSelections) gs.roleSelections = {};

    if (drawerUserIdOrRole === 'drawer' || drawerUserIdOrRole === 'guesser') {
      gs.roleSelections[userId] = drawerUserIdOrRole;
    } else if (typeof drawerUserIdOrRole === 'string') {
      if (room.hostUserId !== userId) {
        return this.doodleReject(userId, 'not_host', 'Only the host can assign the drawer');
      }
      const target = room.players.find(p => p.userId === drawerUserIdOrRole);
      if (!target) {
        return this.doodleReject(userId, 'invalid_player', 'That player is not in this room');
      }
      const other = room.players.find(p => p.userId !== target.userId);
      gs.drawerUserId = target.userId;
      gs.drawerDisplayName = target.displayName || 'Drawer';
      if (other) {
        gs.guesserUserId = other.userId;
        gs.guesserDisplayName = other.displayName || 'Guesser';
      }
      gs.roleSelections[target.userId] = 'drawer';
      if (other) gs.roleSelections[other.userId] = 'guesser';
    } else {
      return this.doodleReject(userId, 'invalid_payload', 'Invalid role selection');
    }

    this.db.updateGameRoomState(room.id, gs);

    this.broadcast(room.id, {
      type: 'doodle:role_selected',
      roomId: room.id,
      payload: {
        userId,
        role: gs.roleSelections[userId],
        drawerUserId: gs.drawerUserId,
        roleSelections: gs.roleSelections,
        gameState: DoodleDuelEngine.publicStateFor(gs, null)
      }
    });
  }

  public handleDoodleStart(roomId: string, userId: string, config?: Partial<DoodleConfig>): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'doodle-duel') return;
    if (room.hostUserId !== userId) {
      return this.doodleReject(userId, 'not_host', 'Only the host can start Doodle Duel');
    }
    const existing = room.gameState as DoodleGameState | null | undefined;
    if (room.status === 'PLAYING' || room.status === 'FINISHED' ||
        (existing && existing.phase !== 'LOBBY' && existing.phase !== 'ROLE_SELECTION')) {
      return this.doodleReject(userId, 'wrong_phase', 'The game has already started');
    }

    if (room.players.length < 2) {
      // Auto-inject friendly AI companion duelist so host can play immediately
      const botPlayer = this.db.addPlayerToGameRoom(
        room.id,
        { id: 'bot_duelist', displayName: 'Doodle Buddy' },
        1,
        'blue' as any
      );
      room.players.push(botPlayer);
    }
    const players = room.players;

    const def = GAME_DEFINITIONS[room.gameType];
    const colors = def?.colorAssignments[room.maxPlayers];
    const playerConfigs = players.map(p => {
      const assignedColor = colors && colors[p.seat] ? colors[p.seat] : p.color;
      p.color = assignedColor;
      return {
        userId: p.userId,
        displayName: p.displayName,
        seat: p.seat,
        color: assignedColor
      };
    });

    const activeConfig = DoodleDuelEngine.sanitizeConfig(config, existing?.config || DEFAULT_DOODLE_CONFIG);
    const state = DoodleDuelEngine.createInitialState(playerConfigs, activeConfig);

    const p1 = players[0].userId;
    const p2 = players[1].userId;
    const roles: Record<string, any> = {};
    for (const p of players) roles[p.userId] = existing?.roleSelections?.[p.userId] ?? null;
    state.roleSelections = roles as any;

    // Role resolution: explicit choices win; conflicts (both drawer / both guesser) are settled by the host
    let drawerId: string;
    const prefDrawer = existing && players.some(p => p.userId === existing.drawerUserId) ? existing.drawerUserId : p1;
    if (roles[p1] === roles[p2] && roles[p1]) {
      const hostRole = roles[room.hostUserId];
      if (hostRole === 'drawer') drawerId = room.hostUserId;
      else if (hostRole === 'guesser') drawerId = room.hostUserId === p1 ? p2 : p1;
      else drawerId = p1;
    } else if (roles[p1] === 'drawer' || roles[p2] === 'guesser') {
      drawerId = p1;
    } else if (roles[p2] === 'drawer' || roles[p1] === 'guesser') {
      drawerId = p2;
    } else {
      drawerId = prefDrawer;
    }
    const guesserId = drawerId === p1 ? p2 : p1;

    const drawerPlayer = players.find(p => p.userId === drawerId) || players[0];
    const guesserPlayer = players.find(p => p.userId === guesserId) || players[1];

    room.gameState = state;
    this.stopDoodleTimer(room.id);
    room.status = 'PLAYING';
    const now = new Date().toISOString();
    room.startedAt = now;
    this.db.updateGameRoomStatus(room.id, 'PLAYING', now);
    this.recordGameStreaks(room);

    DoodleDuelEngine.startRoundIntro(state, drawerPlayer.userId, guesserPlayer.userId);
    state.drawerDisplayName = drawerPlayer.displayName;
    state.guesserDisplayName = guesserPlayer.displayName;
    state.roleSelections[drawerPlayer.userId] = 'drawer';
    state.roleSelections[guesserPlayer.userId] = 'guesser';

    this.db.updateGameRoomState(room.id, state);

    // Broadcast authoritative game:started event (ROUND_INTRO: no secret word exists yet)
    this.broadcast(room.id, {
      type: 'game:started',
      roomId: room.id,
      payload: {
        room,
        gameState: DoodleDuelEngine.publicStateFor(state, null),
        message: 'Doodle Duel started! Round intro begins.'
      }
    });

    this.startDoodleTimer(room.id);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleChooseWord(roomId: string, userId: string, chosenWord: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    const gs = room.gameState;
    if (gs.drawerUserId !== userId) return this.doodleReject(userId, 'not_drawer', 'Only the drawer can choose the word');
    if (gs.phase !== 'WORD_CHOICE') return this.doodleReject(userId, 'wrong_phase', 'Not choosing a word right now');

    const wordItem = DoodleDuelEngine.resolveChosenWord(gs, chosenWord);
    if (!wordItem) return this.doodleReject(userId, 'invalid_word', 'Pick one of the offered words');

    DoodleDuelEngine.startDrawing(gs, wordItem);
    this.db.updateGameRoomState(room.id, gs);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleDoneDrawing(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    if (room.gameState.drawerUserId !== userId) return this.doodleReject(userId, 'not_drawer', 'Only the drawer can finish drawing');
    if (room.gameState.phase !== 'DRAWING') return this.doodleReject(userId, 'wrong_phase', 'Not drawing right now');

    DoodleDuelEngine.startGuessing(room.gameState);
    this.db.updateGameRoomState(room.id, room.gameState);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleLiveDraw(roomId: string, userId: string, liveStroke: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    if (room.gameState.drawerUserId !== userId || room.gameState.phase !== 'DRAWING') return;
    if (!doodleRateAllowed(`${roomId}:${userId}:live`, 40)) return;

    let safe: any = null; // null = drawer lifted the pen / clears the ghost stroke
    if (liveStroke !== null && liveStroke !== undefined) {
      safe = DoodleDuelEngine.validateStroke(liveStroke);
      if (!safe) return;
    }

    this.broadcast(room.id, {
      type: 'doodle:live_draw',
      roomId: room.id,
      payload: { liveStroke: safe }
    });
  }

  public handleDoodleStroke(roomId: string, userId: string, stroke: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    const gs = room.gameState;
    if (gs.drawerUserId !== userId) return this.doodleReject(userId, 'not_drawer', 'Only the drawer can draw');
    if (gs.phase !== 'DRAWING') return this.doodleReject(userId, 'wrong_phase', 'Drawing is over for this round');
    if (!doodleRateAllowed(`${roomId}:${userId}:stroke`, 30)) return this.doodleReject(userId, 'rate_limited', 'Slow down');

    const safe = DoodleDuelEngine.validateStroke(stroke);
    if (!safe) return this.doodleReject(userId, 'invalid_stroke', 'Invalid stroke');
    if (!DoodleDuelEngine.canAddStroke(gs, safe)) return this.doodleReject(userId, 'canvas_full', 'The canvas is full. Undo or clear to continue');

    gs.strokes.push(safe);
    this.db.updateGameRoomState(room.id, gs);

    this.broadcast(room.id, {
      type: 'doodle:stroke_added',
      roomId: room.id,
      payload: { stroke: safe }
    });
  }

  public handleDoodleUndo(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    if (room.gameState.drawerUserId !== userId) return this.doodleReject(userId, 'not_drawer', 'Only the drawer can undo');
    if (room.gameState.phase !== 'DRAWING') return this.doodleReject(userId, 'wrong_phase', 'Drawing is over for this round');
    if (!doodleRateAllowed(`${roomId}:${userId}:edit`, 10)) return;

    room.gameState.strokes.pop();
    this.db.updateGameRoomState(room.id, room.gameState);

    this.broadcast(room.id, {
      type: 'doodle:strokes_updated',
      roomId: room.id,
      payload: { strokes: room.gameState.strokes }
    });
  }

  public handleDoodleClear(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    if (room.gameState.drawerUserId !== userId) return this.doodleReject(userId, 'not_drawer', 'Only the drawer can clear');
    if (room.gameState.phase !== 'DRAWING') return this.doodleReject(userId, 'wrong_phase', 'Drawing is over for this round');
    if (!doodleRateAllowed(`${roomId}:${userId}:edit`, 10)) return;

    room.gameState.strokes = [];
    this.db.updateGameRoomState(room.id, room.gameState);

    this.broadcast(room.id, {
      type: 'doodle:canvas_cleared',
      roomId: room.id,
      payload: {}
    });
  }

  public handleDoodleGuess(roomId: string, userId: string, guessText: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    const player = room.players.find(p => p.userId === userId);
    if (!player) return;
    if (!doodleRateAllowed(`${roomId}:${userId}:guess`, 5)) return this.doodleReject(userId, 'rate_limited', 'Slow down');

    const { isCorrect, state, points, completed, rejected } = DoodleDuelEngine.submitGuess(
      room.gameState,
      userId,
      player.displayName,
      guessText
    );

    if (rejected) {
      const messages: Record<string, string> = {
        invalid: 'Invalid guess',
        empty: 'Type a guess first',
        not_guessing: 'No guessing right now',
        not_guesser: 'Only the guesser can guess',
        duplicate: 'You already tried that',
        too_many: 'Too many guesses this round'
      };
      return this.doodleReject(userId, rejected, messages[rejected] || 'Guess rejected');
    }

    const latestGuess = state.guesses[state.guesses.length - 1];

    room.gameState = state;
    this.db.updateGameRoomState(room.id, state);

    this.broadcast(room.id, {
      type: 'doodle:guess_result',
      roomId: room.id,
      payload: {
        guess: latestGuess,
        userId,
        displayName: player.displayName,
        text: latestGuess.text,
        guessText: latestGuess.text,
        isCorrect,
        pointsEarned: points,
        completed
      }
    });

    this.broadcastDoodleState(room.id);
  }

  public handleDoodleRequestHint(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'doodle-duel') return;
    const gs = room.gameState;
    // Only the guesser can request a hint (not the drawer who already knows the word)
    if (gs.guesserUserId !== userId) return this.doodleReject(userId, 'not_guesser', 'Only the guesser can ask for a hint');
    if (gs.phase !== 'GUESSING' || !gs.hintAvailable || gs.hintUsed) {
      return this.doodleReject(userId, 'hint_unavailable', 'No hint available right now');
    }

    gs.hintUsed = true;
    gs.hintAvailable = false;
    this.db.updateGameRoomState(room.id, gs);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleConfigUpdate(roomId: string, userId: string, partialConfig: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'doodle-duel') return;
    if (room.hostUserId !== userId) {
      return this.doodleReject(userId, 'not_host', 'Only the host can update room settings');
    }
    if (room.status === 'PLAYING' || room.status === 'FINISHED' ||
        (room.gameState && room.gameState.phase !== 'LOBBY' && room.gameState.phase !== 'ROLE_SELECTION')) {
      return this.doodleReject(userId, 'wrong_phase', 'Settings can only change in the lobby');
    }

    // Config is persisted inside gameState.config (the room row has no doodleConfig column)
    const base = room.gameState?.config || DEFAULT_DOODLE_CONFIG;
    const updated = DoodleDuelEngine.sanitizeConfig(partialConfig, base);
    if (!room.gameState) {
      room.gameState = this.doodleLobbyState(room, updated);
    }
    room.gameState.config = updated;
    room.gameState.totalRounds = updated.rounds;
    room.gameState.timeRemaining = updated.drawTime;
    this.db.updateGameRoomState(room.id, room.gameState);

    this.broadcast(room.id, {
      type: 'doodle:config_updated',
      roomId: room.id,
      payload: { config: updated }
    });
  }

  // =========================================================================
  // IMPOSTER (4-8 player social deduction): server timer, actions, redaction
  // The full state (secret word + imposter) lives only in the database row / this process; every recipient gets
  // ImposterEngine.publicStateFor(state, thatRecipient) through projectStateFor (players and spectators alike).
  // =========================================================================

  public startImposterTimer(roomId: string): void {
    this.stopImposterTimer(roomId);
    const timer = setInterval(() => this.tickImposter(roomId), 500);
    (timer as any).unref?.();
    this.imposterTimers.set(roomId, timer);
  }

  public stopImposterTimer(roomId: string): void {
    const existing = this.imposterTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.imposterTimers.delete(roomId);
    }
    clearImposterRate(roomId);
  }

  /** (Re)arms the phase timer of a running Imposter room (after a server restart or when a player returns). */
  public ensureImposterTimer(roomId: string): void {
    if (this.imposterTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'imposter' || room.status !== 'PLAYING' || !room.gameState) return;
    this.startImposterTimer(roomId);
  }

  /** Server-side clock: expired turns / phases advance on their own, so no client can stall the game. */
  public tickImposter(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'imposter' || room.status !== 'PLAYING' || !room.gameState) {
      this.stopImposterTimer(roomId);
      return;
    }
    // Nobody connected: deadlines are settled as soon as somebody returns (registerClient re-arms the timer)
    if (!this.roomClients.get(roomId)?.size) {
      this.stopImposterTimer(roomId);
      return;
    }
    try {
      this.mutateImposter(roomId, (state) => { ImposterEngine.tick(state, Date.now()); });
    } catch (err) {
      console.error('[imposter] tick failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /**
   * Loads the Imposter state, runs `fn`, and persists + broadcasts whenever the state changed, even when `fn` throws
   * afterwards (an action first settles expired phases, and that progress must not be lost).
   */
  private mutateImposter(roomId: string, fn: (state: ImposterServerState, room: GameRoom) => void): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'imposter') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.status !== 'PLAYING' || !room.gameState || !ImposterEngine.isServerState(room.gameState)) {
      throw new GameRuleError('NOT_PLAYING', 'The game is not in progress');
    }
    const state = room.gameState as ImposterServerState;
    const before = JSON.stringify(state);
    let failure: unknown = null;
    try {
      fn(state, room);
    } catch (err) {
      failure = err;
    }
    if (JSON.stringify(state) !== before) this.commitImposter(room, state);
    if (failure) throw failure;
  }

  /** Persists a changed state, closes the room when the game is over / aborted, and sends every recipient their own view. */
  private commitImposter(room: GameRoom, state: ImposterServerState): void {
    this.db.updateGameRoomState(room.id, state, 0);
    if ((state.phase === 'FINISHED' || state.phase === 'ABORTED') && room.status === 'PLAYING') {
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date().toISOString());
      room.status = 'FINISHED';
      this.stopImposterTimer(room.id);
      this.rematchVotes.delete(room.id);
    }
    // broadcast() projects payload.gameState per recipient (stateNeedsProjection is true for the full state)
    this.broadcast(room.id, {
      type: 'imposter:state',
      roomId: room.id,
      payload: { gameState: state, roomStatus: room.status }
    });
  }

  private imposterRate(roomId: string, userId: string, kind: string, max: number, windowMs: number): void {
    if (!imposterRateAllowed(`${roomId}:${userId}:${kind}`, max, windowMs)) {
      throw new GameRuleError('RATE_LIMITED', 'Slow down a little');
    }
  }

  /** Connection flag of a seated player (skips their clue turn / vote requirement while they are away). */
  private imposterSetConnected(roomId: string, userId: string, connected: boolean): void {
    if (this.roomGameTypes.get(roomId) !== 'imposter') return;
    try {
      this.mutateImposter(roomId, (state) => {
        ImposterEngine.setConnected(state, userId, connected);
        ImposterEngine.tick(state, Date.now());
      });
    } catch {
      // not an Imposter game in progress (lobby, finished, other game): nothing to update
    }
  }

  /** Host starts from the lobby once at least 4 players are connected; the host picks 3 or 5 rounds. */
  public handleImposterStart(roomId: string, userId: string, payload: unknown): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'imposter') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.hostUserId !== userId) throw new GameRuleError('HOST_ONLY', 'Only the host can start the game');
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The game has already started');
    this.imposterRate(roomId, userId, 'start', 3, 5000);
    const { rounds } = parseImposterPayload(imposterStartSchema, payload);
    const present = room.players.filter(p => p.status !== 'LEFT' && this.liveClient(roomId, p.userId));
    if (present.length < imposterMinPlayers()) {
      throw new GameRuleError('INVALID_INPUT', `At least ${imposterMinPlayers()} connected players are needed to start`);
    }
    this.imposterRounds.set(roomId, rounds);
    this.startGame(room);
  }

  public handleImposterClue(roomId: string, userId: string, payload: unknown): void {
    this.imposterRate(roomId, userId, 'clue', 4, 3000);
    const { word } = parseImposterPayload(imposterClueSchema, payload);
    this.mutateImposter(roomId, (state) => ImposterEngine.submitClue(state, userId, word, Date.now()));
  }

  public handleImposterReady(roomId: string, userId: string): void {
    this.imposterRate(roomId, userId, 'ready', 5, 5000);
    this.mutateImposter(roomId, (state) => { ImposterEngine.markReady(state, userId, Date.now()); });
  }

  public handleImposterVote(roomId: string, userId: string, payload: unknown): void {
    this.imposterRate(roomId, userId, 'vote', 4, 3000);
    const { targetUserId } = parseImposterPayload(imposterVoteSchema, payload);
    this.mutateImposter(roomId, (state) => { ImposterEngine.castVote(state, userId, targetUserId, Date.now()); });
  }

  public handleImposterGuess(roomId: string, userId: string, payload: unknown): void {
    this.imposterRate(roomId, userId, 'guess', 3, 3000);
    const { guess } = parseImposterPayload(imposterGuessSchema, payload);
    this.mutateImposter(roomId, (state) => ImposterEngine.submitGuess(state, userId, guess, Date.now()));
  }

  /** A player left for good during a running game: fewer than 3 left aborts it, the imposter leaving voids the round. */
  private applyImposterDeparture(room: GameRoom, userId: string, base: Record<string, any>): void {
    let aborted = false;
    try {
      this.mutateImposter(room.id, (state) => { aborted = ImposterEngine.removePlayer(state, userId, Date.now()); });
    } catch {
      return;
    }
    const fresh = this.db.getGameRoomById(room.id);
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, aborted, gameState: fresh?.gameState }
    });
  }

  // =========================================================================
  // EMOJI CHARADES (2-8 player movie puzzle race): server timer, actions, redaction
  // The full state (answer + alternates) lives only in the database row / this process; every recipient gets
  // EmojiCharadesEngine.publicStateFor(state, thatRecipient) through projectStateFor (players and spectators alike).
  // =========================================================================

  public startEmojiCharadesTimer(roomId: string): void {
    this.stopEmojiCharadesTimer(roomId);
    const timer = setInterval(() => this.tickEmojiCharades(roomId), 500);
    (timer as any).unref?.();
    this.emojiCharadesTimers.set(roomId, timer);
  }

  public stopEmojiCharadesTimer(roomId: string): void {
    const existing = this.emojiCharadesTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.emojiCharadesTimers.delete(roomId);
    }
    clearEmojiCharadesRate(roomId);
  }

  /** (Re)arms the phase timer of a running Emoji Charades room (after a server restart or when a player returns). */
  public ensureEmojiCharadesTimer(roomId: string): void {
    if (this.emojiCharadesTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'emoji-charades' || room.status !== 'PLAYING' || !room.gameState) return;
    this.startEmojiCharadesTimer(roomId);
  }

  /** Server-side clock: countdown, hints, round end and reveal advance on their own, so no client can stall the game. */
  public tickEmojiCharades(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'emoji-charades' || room.status !== 'PLAYING' || !room.gameState) {
      this.stopEmojiCharadesTimer(roomId);
      return;
    }
    // Nobody connected: deadlines are settled as soon as somebody returns (registerClient re-arms the timer)
    if (!this.roomClients.get(roomId)?.size) {
      this.stopEmojiCharadesTimer(roomId);
      return;
    }
    try {
      this.mutateEmojiCharades(roomId, (state) => { EmojiCharadesEngine.tick(state, Date.now()); });
    } catch (err) {
      console.error('[emoji-charades] tick failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /**
   * Loads the Emoji Charades state, runs `fn`, and persists + broadcasts whenever the state changed, even when `fn` throws
   * afterwards (an action first settles expired phases, and that progress must not be lost).
   */
  private mutateEmojiCharades(roomId: string, fn: (state: EmojiCharadesServerState, room: GameRoom) => void): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'emoji-charades') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.status !== 'PLAYING' || !room.gameState || !EmojiCharadesEngine.isServerState(room.gameState)) {
      throw new GameRuleError('NOT_PLAYING', 'The game is not in progress');
    }
    const state = room.gameState as EmojiCharadesServerState;
    const before = JSON.stringify(state);
    let failure: unknown = null;
    try {
      fn(state, room);
    } catch (err) {
      failure = err;
    }
    if (JSON.stringify(state) !== before) this.commitEmojiCharades(room, state);
    if (failure) throw failure;
  }

  /** Persists a changed state, closes the room when the game is over / aborted, and sends every recipient their own view. */
  private commitEmojiCharades(room: GameRoom, state: EmojiCharadesServerState): void {
    this.db.updateGameRoomState(room.id, state, 0);
    if ((state.phase === 'FINAL' || state.phase === 'ABORTED') && room.status === 'PLAYING') {
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date().toISOString());
      room.status = 'FINISHED';
      this.stopEmojiCharadesTimer(room.id);
      this.rematchVotes.delete(room.id);
    }
    // broadcast() projects payload.gameState per recipient (stateNeedsProjection is true for the full state)
    this.broadcast(room.id, {
      type: 'emoji-charades:state',
      roomId: room.id,
      payload: { gameState: state, roomStatus: room.status }
    });
  }

  private emojiCharadesRate(roomId: string, userId: string, kind: string, max: number, windowMs: number): void {
    if (!emojiCharadesRateAllowed(`${roomId}:${userId}:${kind}`, max, windowMs)) {
      throw new GameRuleError('RATE_LIMITED', 'Slow down a little');
    }
  }

  /** Connection flag of a seated player (a disconnected player scores nothing and is not waited for at the end of a round). */
  private emojiCharadesSetConnected(roomId: string, userId: string, connected: boolean): void {
    if (this.roomGameTypes.get(roomId) !== 'emoji-charades') return;
    try {
      this.mutateEmojiCharades(roomId, (state) => {
        EmojiCharadesEngine.setConnected(state, userId, connected);
        EmojiCharadesEngine.tick(state, Date.now());
      });
    } catch {
      // not an Emoji Charades game in progress (lobby, finished, other game): nothing to update
    }
  }

  /** True while the puzzle is live and this player already solved it (their chat could reveal the answer). */
  private emojiCharadesChatLocked(roomId: string, userId: string): boolean {
    if (this.roomGameTypes.get(roomId) !== 'emoji-charades') return false;
    const room = this.db.getGameRoomById(roomId);
    const st: any = room?.gameState;
    if (!room || room.status !== 'PLAYING' || !st || st.phase !== 'PLAY' || !Array.isArray(st.solves)) return false;
    return st.solves.some((x: any) => x.userId === userId);
  }

  /** Host starts from the lobby once at least 2 players are connected; the host picks 3 or 5 rounds (Race mode only). */
  public handleEmojiCharadesStart(roomId: string, userId: string, payload: unknown): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'emoji-charades') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.hostUserId !== userId) throw new GameRuleError('HOST_ONLY', 'Only the host can start the game');
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The game has already started');
    this.emojiCharadesRate(roomId, userId, 'start', 3, 5000);
    const { rounds } = parseEmojiCharadesPayload(emojiCharadesStartSchema, payload);
    const present = room.players.filter(p => p.status !== 'LEFT' && this.liveClient(roomId, p.userId));
    if (present.length < EMOJI_CHARADES_MIN_PLAYERS) {
      throw new GameRuleError('INVALID_INPUT', `At least ${EMOJI_CHARADES_MIN_PLAYERS} connected players are needed to start`);
    }
    this.emojiCharadesRounds.set(roomId, rounds);
    this.startGame(room);
  }

  /** A guess during PLAY. The sender gets their own redacted view back (with the so-close / wrong feedback) through the state broadcast. */
  public handleEmojiCharadesGuess(roomId: string, userId: string, payload: unknown): void {
    this.emojiCharadesRate(roomId, userId, 'guess', 4, 3000);
    const { guess } = parseEmojiCharadesPayload(emojiCharadesGuessSchema, payload);
    this.mutateEmojiCharades(roomId, (state) => { EmojiCharadesEngine.submitGuess(state, userId, guess, Date.now()); });
  }

  /** A player left for good during a running game: fewer than 2 left aborts it, otherwise the game goes on without them. */
  private applyEmojiCharadesDeparture(room: GameRoom, userId: string, base: Record<string, any>): void {
    let aborted = false;
    try {
      this.mutateEmojiCharades(room.id, (state) => { aborted = EmojiCharadesEngine.removePlayer(state, userId, Date.now()); });
    } catch {
      return;
    }
    const fresh = this.db.getGameRoomById(room.id);
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, aborted, gameState: fresh?.gameState }
    });
  }

  // =========================================================================
  // MAFIA NIGHT (5-10 player social deduction): server timer, actions, redaction, chat channels
  // The full state (every role + every night action) lives only in the database row / this process; every recipient gets
  // MafiaNightEngine.publicStateFor(state, thatRecipient) through projectStateFor (players and spectators alike).
  // Night actions are acknowledged to the actor (and, for the kill choice, the other mafia) only: nobody else is even told
  // that "something happened".
  // =========================================================================

  public startMafiaTimer(roomId: string): void {
    this.stopMafiaTimer(roomId);
    const timer = setInterval(() => this.tickMafia(roomId), 500);
    (timer as any).unref?.();
    this.mafiaTimers.set(roomId, timer);
  }

  public stopMafiaTimer(roomId: string): void {
    const existing = this.mafiaTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.mafiaTimers.delete(roomId);
    }
    clearMafiaRate(roomId);
  }

  /** (Re)arms the phase timer of a running Mafia Night room (after a server restart or when a player returns). */
  public ensureMafiaTimer(roomId: string): void {
    if (this.mafiaTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'mafia-night' || room.status !== 'PLAYING' || !room.gameState) return;
    this.startMafiaTimer(roomId);
  }

  /** Server-side clock: expired phases advance on their own, so no client can stall the game. */
  public tickMafia(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'mafia-night' || room.status !== 'PLAYING' || !room.gameState) {
      this.stopMafiaTimer(roomId);
      return;
    }
    // Nobody connected: deadlines are settled as soon as somebody returns (registerClient re-arms the timer)
    if (!this.roomClients.get(roomId)?.size) {
      this.stopMafiaTimer(roomId);
      return;
    }
    try {
      this.mutateMafia(roomId, (state) => { MafiaNightEngine.tick(state, Date.now()); });
    } catch (err) {
      console.error('[mafia-night] tick failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /**
   * Loads the Mafia Night state, runs `fn`, and persists + sends whenever the state changed, even when `fn` throws afterwards
   * (an action first settles expired phases, and that progress must not be lost). `quietTo`: when the change is a secret night
   * action, only these users get the new view (nobody else learns that anything happened); a phase change still goes to everyone.
   */
  private mutateMafia(roomId: string, fn: (state: MafiaServerState, room: GameRoom) => void, quietTo?: (state: MafiaServerState) => string[]): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'mafia-night') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.status !== 'PLAYING' || !room.gameState || !MafiaNightEngine.isServerState(room.gameState)) {
      throw new GameRuleError('NOT_PLAYING', 'The game is not in progress');
    }
    const state = room.gameState as MafiaServerState;
    const before = JSON.stringify(state);
    const phaseBefore = state.phase;
    const roundBefore = state.round;
    let failure: unknown = null;
    try {
      fn(state, room);
    } catch (err) {
      failure = err;
    }
    if (JSON.stringify(state) !== before) {
      const secretOnly = Boolean(quietTo) && state.phase === phaseBefore && state.round === roundBefore && state.phase === 'NIGHT';
      this.commitMafia(room, state, secretOnly && quietTo ? quietTo(state) : undefined);
    }
    if (failure) throw failure;
  }

  /** Persists a changed state, closes the room when the game is over / aborted, and sends every recipient their own view. */
  private commitMafia(room: GameRoom, state: MafiaServerState, onlyTo?: string[]): void {
    this.db.updateGameRoomState(room.id, state, 0);
    if ((state.phase === 'FINISHED' || state.phase === 'ABORTED') && room.status === 'PLAYING') {
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date().toISOString());
      room.status = 'FINISHED';
      this.stopMafiaTimer(room.id);
      this.rematchVotes.delete(room.id);
    }
    const message = {
      type: 'mafia:state',
      roomId: room.id,
      payload: { gameState: state, roomStatus: room.status }
    };
    if (onlyTo) {
      for (const uid of onlyTo) this.sendToUser(uid, message, room.id); // projected for that recipient by messageForViewer
      return;
    }
    // broadcast() projects payload.gameState per recipient (stateNeedsProjection is true for the full state)
    this.broadcast(room.id, message);
  }

  private mafiaRate(roomId: string, userId: string, kind: string, max: number, windowMs: number): void {
    if (!mafiaRateAllowed(`${roomId}:${userId}:${kind}`, max, windowMs)) {
      throw new GameRuleError('RATE_LIMITED', 'Slow down a little');
    }
  }

  /** Connection flag of a seated player (their vote is no longer waited for while they are away). */
  private mafiaSetConnected(roomId: string, userId: string, connected: boolean): void {
    if (this.roomGameTypes.get(roomId) !== 'mafia-night') return;
    try {
      this.mutateMafia(roomId, (state) => {
        MafiaNightEngine.setConnected(state, userId, connected);
        MafiaNightEngine.tick(state, Date.now());
      });
    } catch {
      // not a Mafia Night game in progress (lobby, finished, other game): nothing to update
    }
  }

  /** Host starts from the lobby once enough players (5, or 4 in the testing mode) are connected. */
  public handleMafiaStart(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'mafia-night') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.hostUserId !== userId) throw new GameRuleError('HOST_ONLY', 'Only the host can start the game');
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The game has already started');
    this.mafiaRate(roomId, userId, 'start', 3, 5000);
    const present = room.players.filter(p => p.status !== 'LEFT' && this.liveClient(roomId, p.userId));
    if (present.length < mafiaMinPlayers()) {
      throw new GameRuleError('INVALID_INPUT', `At least ${mafiaMinPlayers()} connected players are needed to start`);
    }
    this.startGame(room);
  }

  /** A secret night action. Only the actor (and, for the kill choice, the other living mafia) get an answer. */
  public handleMafiaNightAction(roomId: string, userId: string, payload: unknown): void {
    this.mafiaRate(roomId, userId, 'night', 5, 5000);
    const { action, targetUserId } = parseMafiaNightPayload(mafiaNightActionSchema, payload);
    this.mutateMafia(
      roomId,
      (state) => { MafiaNightEngine.submitNightAction(state, userId, action, targetUserId, Date.now()); },
      (state) => action === 'kill'
        ? state.players.filter(p => !p.left && p.alive && state.secret.roles[p.userId] === 'mafia').map(p => p.userId)
        : [userId]
    );
  }

  public handleMafiaReady(roomId: string, userId: string): void {
    this.mafiaRate(roomId, userId, 'ready', 5, 5000);
    this.mutateMafia(roomId, (state) => { MafiaNightEngine.markReady(state, userId, Date.now()); });
  }

  public handleMafiaVote(roomId: string, userId: string, payload: unknown): void {
    this.mafiaRate(roomId, userId, 'vote', 4, 3000);
    const { targetUserId } = parseMafiaNightPayload(mafiaNightVoteSchema, payload);
    this.mutateMafia(roomId, (state) => { MafiaNightEngine.castVote(state, userId, targetUserId, Date.now()); });
  }

  /** A player left for good during a running game: they count as dead (role revealed); fewer than 3 left aborts it. */
  private applyMafiaDeparture(room: GameRoom, userId: string, base: Record<string, any>): void {
    let aborted = false;
    try {
      this.mutateMafia(room.id, (state) => { aborted = MafiaNightEngine.removePlayer(state, userId, Date.now()); });
    } catch {
      return;
    }
    const fresh = this.db.getGameRoomById(room.id);
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, aborted, gameState: fresh?.gameState }
    });
  }

  /** The running Mafia Night state of a room, or null (other game, lobby, finished). */
  private runningMafiaState(roomId: string): MafiaServerState | null {
    if (this.roomGameTypes.get(roomId) !== 'mafia-night') return null;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || !MafiaNightEngine.isServerState(room.gameState)) return null;
    // settle anything that is already due, so a chat message never lands in a phase that has just ended
    return room.gameState as MafiaServerState;
  }

  /**
   * The channel of a chat message / reaction / typing signal of this player right now (throws CHAT_LOCKED when they may not talk).
   * Returns null when the room is not a running Mafia Night game (normal open chat).
   */
  private mafiaChannelFor(roomId: string, userId: string): MafiaChatChannel | null {
    const state = this.runningMafiaState(roomId);
    if (!state) return null;
    // work on a copy: settling an expired phase is the timer's job (it persists and broadcasts), this only needs the phase right now
    const copy = JSON.parse(JSON.stringify(state)) as MafiaServerState;
    MafiaNightEngine.tick(copy, Date.now());
    return MafiaNightEngine.chatChannelFor(copy, userId);
  }

  /** Sends `message` to the players and spectators who may read `channel` right now. */
  private sendToMafiaAudience(roomId: string, channel: MafiaChatChannel, message: any, excludeUserId?: string): void {
    const state = this.runningMafiaState(roomId);
    for (const client of this.allViewers(roomId)) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.socket.readyState !== 1) continue;
      const may = client.spectator ? channel === 'town' : MafiaNightEngine.canReadChannel(state, client.userId, channel);
      if (!may) continue;
      try { client.socket.send(JSON.stringify(message)); } catch {}
    }
  }

  /** Chat history of a room for one recipient: Mafia Night channels are filtered by what the recipient may read. */
  private chatHistoryFor(roomId: string, viewerId: string | null, spectator = false): any[] {
    const history = this.roomChatHistory.get(roomId) || [];
    if (this.roomGameTypes.get(roomId) !== 'mafia-night') return history;
    const room = this.db.getGameRoomById(roomId);
    const state = room?.gameState && MafiaNightEngine.isServerState(room.gameState) ? (room.gameState as MafiaServerState) : null;
    return history.filter((m: any) => !m.channel || m.channel === 'town' || (!spectator && MafiaNightEngine.canReadChannel(state, viewerId, m.channel)));
  }

  // =========================================================================
  // MURDER MYSTERY NIGHT (6-12 player scripted whodunit, CREATOR game): server timer, case pick, clue rounds, whispers, accusations
  // The full state (who plays whom, every whisper and accusation) lives only in the database row / this process; every recipient
  // gets MurderMysteryEngine.publicStateFor(state, thatRecipient) through projectStateFor (players and spectators alike).
  // A whisper is acknowledged to its sender and receiver only: nobody else is even told that something happened.
  // Public chat is the normal open chat of the room (spectators are read-only through the spectator allow-list).
  // =========================================================================

  public startMurderTimer(roomId: string): void {
    this.stopMurderTimer(roomId);
    const timer = setInterval(() => this.tickMurder(roomId), 500);
    (timer as any).unref?.();
    this.murderTimers.set(roomId, timer);
  }

  public stopMurderTimer(roomId: string): void {
    const existing = this.murderTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.murderTimers.delete(roomId);
    }
    clearMurderRate(roomId);
  }

  /** (Re)arms the phase timer of a running Murder Mystery room (after a server restart or when a player returns). */
  public ensureMurderTimer(roomId: string): void {
    if (this.murderTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'murder-mystery' || room.status !== 'PLAYING' || !room.gameState) return;
    this.startMurderTimer(roomId);
  }

  /** Server-side clock: expired phases advance on their own, so no client can stall the game. */
  public tickMurder(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'murder-mystery' || room.status !== 'PLAYING' || !room.gameState) {
      this.stopMurderTimer(roomId);
      return;
    }
    // Nobody connected: deadlines are settled as soon as somebody returns (registerClient re-arms the timer)
    if (!this.roomClients.get(roomId)?.size) {
      this.stopMurderTimer(roomId);
      return;
    }
    try {
      this.mutateMurder(roomId, (state) => { MurderMysteryEngine.tick(state, Date.now()); });
    } catch (err) {
      console.error('[murder-mystery] tick failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /**
   * Loads the Murder Mystery state, runs `fn`, and persists + sends whenever the state changed, even when `fn` throws afterwards
   * (an action first settles expired phases, and that progress must not be lost). `opts.lobby`: also allowed in the WAITING lobby
   * (case pick). `opts.quietTo`: when the change is only a private whisper (same phase, same round), only these users get the new
   * view; a phase change still goes to everyone.
   */
  private mutateMurder(roomId: string, fn: (state: MurderServerState, room: GameRoom) => void, opts: { lobby?: boolean; quietTo?: () => string[] } = {}): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'murder-mystery') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    const inLobby = Boolean(opts.lobby) && room.status === 'WAITING';
    if (inLobby && (!room.gameState || !MurderMysteryEngine.isServerState(room.gameState))) {
      room.gameState = MurderMysteryEngine.createLobbyState();
    }
    if ((room.status !== 'PLAYING' && !inLobby) || !room.gameState || !MurderMysteryEngine.isServerState(room.gameState)) {
      throw new GameRuleError('NOT_PLAYING', 'The game is not in progress');
    }
    const state = room.gameState as MurderServerState;
    const before = JSON.stringify(state);
    const phaseBefore = state.phase;
    const roundBefore = state.round;
    let failure: unknown = null;
    try {
      fn(state, room);
    } catch (err) {
      failure = err;
    }
    if (JSON.stringify(state) !== before) {
      const quiet = Boolean(opts.quietTo) && state.phase === phaseBefore && state.round === roundBefore;
      this.commitMurder(room, state, quiet && opts.quietTo ? opts.quietTo() : undefined);
    }
    if (failure) throw failure;
  }

  /** Persists a changed state, closes the room when the game is over / aborted, and sends every recipient their own view. */
  private commitMurder(room: GameRoom, state: MurderServerState, onlyTo?: string[]): void {
    this.db.updateGameRoomState(room.id, state, 0);
    if ((state.phase === 'FINAL' || state.phase === 'ABORTED') && room.status === 'PLAYING') {
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date().toISOString());
      room.status = 'FINISHED';
      this.stopMurderTimer(room.id);
      this.rematchVotes.delete(room.id);
    }
    const message = {
      type: 'murder-mystery:state',
      roomId: room.id,
      payload: { gameState: state, roomStatus: room.status }
    };
    if (onlyTo) {
      for (const uid of onlyTo) this.sendToUser(uid, message, room.id); // projected for that recipient by messageForViewer
      return;
    }
    // broadcast() projects payload.gameState per recipient (stateNeedsProjection is true for the full state)
    this.broadcast(room.id, message);
  }

  private murderRate(roomId: string, userId: string, kind: string, max: number, windowMs: number): void {
    if (!murderRateAllowed(`${roomId}:${userId}:${kind}`, max, windowMs)) {
      throw new GameRuleError('RATE_LIMITED', 'Slow down a little');
    }
  }

  /** The host check every host action starts with (before anything is parsed or changed). */
  private assertMurderHost(roomId: string, userId: string): GameRoom {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'murder-mystery') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.hostUserId !== userId) throw new GameRuleError('HOST_ONLY', 'Only the host can do this');
    return room;
  }

  /** Connection flag of a seated player (a round no longer waits for an absent player to be ready). */
  private murderSetConnected(roomId: string, userId: string, connected: boolean): void {
    if (this.roomGameTypes.get(roomId) !== 'murder-mystery') return;
    try {
      this.mutateMurder(roomId, (state) => {
        MurderMysteryEngine.setConnected(state, userId, connected);
        MurderMysteryEngine.tick(state, Date.now());
      });
    } catch {
      // not a Murder Mystery game in progress (lobby, finished, other game): nothing to update
    }
  }

  /** The host's case choice in the lobby (a catalogue id or `random`). */
  public handleMurderPickCase(roomId: string, userId: string, payload: unknown): void {
    const room = this.assertMurderHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The game has already started');
    this.murderRate(roomId, userId, 'pick', 10, 5000);
    const { caseId } = parseMurderPayload(murderPickCaseSchema, payload);
    this.mutateMurder(roomId, (state) => { MurderMysteryEngine.pickCase(state, caseId); }, { lobby: true });
  }

  /** Host starts from the lobby once enough players (6, fewer in the testing mode) are connected. */
  public handleMurderStart(roomId: string, userId: string): void {
    const room = this.assertMurderHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The game has already started');
    this.murderRate(roomId, userId, 'start', 3, 5000);
    const present = room.players.filter(p => p.status !== 'LEFT' && this.liveClient(roomId, p.userId));
    if (present.length < murderMinPlayers()) {
      throw new GameRuleError('INVALID_INPUT', `At least ${murderMinPlayers()} connected players are needed to start`);
    }
    this.startGame(room);
  }

  /** Host pacing: next clue round early (the last one goes to the accusation), or RESULT to the final leaderboard. */
  public handleMurderNext(roomId: string, userId: string): void {
    this.assertMurderHost(roomId, userId);
    this.murderRate(roomId, userId, 'next', 5, 5000);
    this.mutateMurder(roomId, (state) => { MurderMysteryEngine.advance(state, Date.now()); });
  }

  public handleMurderReady(roomId: string, userId: string): void {
    this.murderRate(roomId, userId, 'ready', 5, 5000);
    this.mutateMurder(roomId, (state) => { MurderMysteryEngine.markReady(state, userId, Date.now()); });
  }

  /** A private whisper: only the sender and the receiver get the new view. */
  public handleMurderWhisper(roomId: string, userId: string, payload: unknown): void {
    this.murderRate(roomId, userId, 'whisper', 6, 10000);
    const { toUserId, text } = parseMurderPayload(murderWhisperSchema, payload);
    this.mutateMurder(
      roomId,
      (state) => { MurderMysteryEngine.whisper(state, userId, toUserId, text, Date.now()); },
      { quietTo: () => [userId, toUserId] }
    );
  }

  /** "Reveal my clue to everyone": the clue joins the public evidence board. */
  public handleMurderShareClue(roomId: string, userId: string, payload: unknown): void {
    this.murderRate(roomId, userId, 'share', 5, 5000);
    const { clueId } = parseMurderPayload(murderShareClueSchema, payload);
    this.mutateMurder(roomId, (state) => { MurderMysteryEngine.shareClue(state, userId, clueId, Date.now()); });
  }

  public handleMurderAccuse(roomId: string, userId: string, payload: unknown): void {
    this.murderRate(roomId, userId, 'accuse', 4, 5000);
    const { characterId, motive } = parseMurderPayload(murderAccuseSchema, payload);
    this.mutateMurder(roomId, (state) => { MurderMysteryEngine.accuse(state, userId, characterId, motive, Date.now()); });
  }

  /** Rematch (host only): everybody still seated plays again, with another case. */
  public handleMurderRematch(roomId: string, userId: string): void {
    const room = this.assertMurderHost(roomId, userId);
    if (room.status !== 'FINISHED') throw new GameRuleError('REMATCH_UNAVAILABLE', 'A rematch can only start after the game has finished');
    const host = room.players.find(p => p.userId === userId);
    if (!host || host.status === 'LEFT') throw new GameRuleError('REMATCH_UNAVAILABLE', 'The host is not in the room');
    this.murderRate(roomId, userId, 'start', 3, 5000);
    const st: any = room.gameState;
    if (!st || !MurderMysteryEngine.isServerState(st) || (st.phase !== 'FINAL' && st.phase !== 'ABORTED')) {
      throw new GameRuleError('REMATCH_UNAVAILABLE', 'There is no finished game to replay');
    }
    if (room.players.filter(p => p.status !== 'LEFT').length < murderMinPlayers()) {
      throw new GameRuleError('REMATCH_UNAVAILABLE', `A rematch needs at least ${murderMinPlayers()} players still in the room`);
    }
    this.rematchVotes.delete(roomId);
    this.startGame(room);
  }

  /** A player left for good during a running game: withdrawn (their character left the party); fewer than 4 left aborts it. */
  private applyMurderDeparture(room: GameRoom, userId: string, base: Record<string, any>): void {
    let aborted = false;
    try {
      this.mutateMurder(room.id, (state) => { aborted = MurderMysteryEngine.removePlayer(state, userId, Date.now()); });
    } catch {
      return;
    }
    const fresh = this.db.getGameRoomById(room.id);
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, aborted, gameState: fresh?.gameState }
    });
  }

  // =========================================================================
  // QUIZ SHOW STUDIO (host-run live quiz, up to 30 players): server timer, quiz editing, answers, buzzer, redaction
  // The full state (the whole quiz with its correct answers) lives only in the database row / this process; every recipient gets
  // QuizShowEngine.publicStateFor(state, thatRecipient) through projectStateFor (host, players and spectators alike).
  // An answer is acknowledged to the host and the sender only (nobody else learns what was picked).
  // =========================================================================

  public startQuizTimer(roomId: string): void {
    this.stopQuizTimer(roomId);
    const timer = setInterval(() => this.tickQuiz(roomId), 500);
    (timer as any).unref?.();
    this.quizTimers.set(roomId, timer);
  }

  public stopQuizTimer(roomId: string): void {
    const existing = this.quizTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.quizTimers.delete(roomId);
    }
    clearQuizRate(roomId);
  }

  /** (Re)arms the phase timer of a running quiz room (after a server restart or when somebody returns). */
  public ensureQuizTimer(roomId: string): void {
    if (this.quizTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'quiz-show' || room.status !== 'PLAYING' || !room.gameState) return;
    this.startQuizTimer(roomId);
  }

  /** Server-side clock: expired phases advance on their own, so no client can stall the quiz. */
  public tickQuiz(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'quiz-show' || room.status !== 'PLAYING' || !room.gameState) {
      this.stopQuizTimer(roomId);
      return;
    }
    // Nobody connected: deadlines are settled as soon as somebody returns (registerClient re-arms the timer)
    if (!this.roomClients.get(roomId)?.size) {
      this.stopQuizTimer(roomId);
      return;
    }
    try {
      this.mutateQuiz(roomId, (state) => { QuizShowEngine.tick(state, Date.now()); });
    } catch (err) {
      console.error('[quiz-show] tick failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /**
   * Loads the quiz state, runs `fn`, and persists + sends whenever the state changed, even when `fn` throws afterwards (an action
   * first settles expired phases, and that progress must not be lost). `opts.lobby`: also allowed in the WAITING lobby (quiz editing).
   * `opts.quietTo`: when the change is only a private answer (same phase, same question), only these users get the new view.
   */
  private mutateQuiz(roomId: string, fn: (state: QuizServerState, room: GameRoom) => void, opts: { lobby?: boolean; quietTo?: () => string[] } = {}): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'quiz-show') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    const inLobby = Boolean(opts.lobby) && room.status === 'WAITING';
    if ((room.status !== 'PLAYING' && !inLobby) || !room.gameState || !QuizShowEngine.isServerState(room.gameState)) {
      throw new GameRuleError('NOT_PLAYING', 'The quiz is not in progress');
    }
    const state = room.gameState as QuizServerState;
    const before = JSON.stringify(state);
    const phaseBefore = state.phase;
    const indexBefore = state.questionIndex;
    let failure: unknown = null;
    try {
      fn(state, room);
    } catch (err) {
      failure = err;
    }
    if (JSON.stringify(state) !== before) {
      const quiet = Boolean(opts.quietTo) && state.phase === phaseBefore && state.questionIndex === indexBefore;
      this.commitQuiz(room, state, quiet && opts.quietTo ? opts.quietTo() : undefined);
    }
    if (failure) throw failure;
  }

  /** Persists a changed state, closes the room when the quiz is over / aborted, and sends every recipient their own view. */
  private commitQuiz(room: GameRoom, state: QuizServerState, onlyTo?: string[]): void {
    this.db.updateGameRoomState(room.id, state, 0);
    if ((state.phase === 'FINAL' || state.phase === 'ABORTED') && room.status === 'PLAYING') {
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date().toISOString());
      room.status = 'FINISHED';
      this.stopQuizTimer(room.id);
      this.rematchVotes.delete(room.id);
    }
    const message = {
      type: 'quiz-show:state',
      roomId: room.id,
      payload: { gameState: state, roomStatus: room.status }
    };
    if (onlyTo) {
      for (const uid of onlyTo) this.sendToUser(uid, message, room.id); // projected for that recipient by messageForViewer
      return;
    }
    // broadcast() projects payload.gameState per recipient (stateNeedsProjection is true for the full state)
    this.broadcast(room.id, message);
  }

  private quizRate(roomId: string, userId: string, kind: string, max: number, windowMs: number): void {
    if (!quizRateAllowed(`${roomId}:${userId}:${kind}`, max, windowMs)) {
      throw new GameRuleError('RATE_LIMITED', 'Slow down a little');
    }
  }

  /** The host check every host action starts with (before anything is parsed or changed). */
  private assertQuizHost(roomId: string, userId: string): GameRoom {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'quiz-show') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.hostUserId !== userId) throw new GameRuleError('HOST_ONLY', 'Only the quiz master can do this');
    return room;
  }

  /** Connection flag of the host / a player (the quiz no longer waits for an absent player's answer). */
  private quizSetConnected(roomId: string, userId: string, connected: boolean): void {
    if (this.roomGameTypes.get(roomId) !== 'quiz-show') return;
    try {
      this.mutateQuiz(roomId, (state) => {
        QuizShowEngine.setConnected(state, userId, connected);
        QuizShowEngine.tick(state, Date.now());
      });
    } catch {
      // not a quiz in progress (lobby, finished, other game): nothing to update
    }
  }

  /** The quiz master starts from the lobby: at least 1 connected player, and a quiz with at least 1 question. */
  public handleQuizStart(roomId: string, userId: string): void {
    const room = this.assertQuizHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The quiz has already started');
    this.quizRate(roomId, userId, 'start', 3, 5000);
    const state: any = room.gameState;
    if (!state || !QuizShowEngine.isServerState(state)) throw new GameRuleError('NOT_PLAYING', 'The quiz lobby is not ready');
    const problem = QuizShowEngine.startProblem(state as QuizServerState);
    if (problem) throw new GameRuleError('INVALID_INPUT', problem);
    const players = room.players.filter(p => p.userId !== room.hostUserId && p.status !== 'LEFT' && this.liveClient(roomId, p.userId));
    if (players.length < quizMinPlayers()) {
      throw new GameRuleError('INVALID_INPUT', `At least ${quizMinPlayers()} connected player is needed to start`);
    }
    if (!this.liveClient(roomId, room.hostUserId)) throw new GameRuleError('INVALID_INPUT', 'The quiz master must be connected');
    this.startGame(room);
  }

  /** Quiz building in the lobby (host only): add / update / delete / move a question, load the starter pack, clear. */
  public handleQuizEdit(roomId: string, userId: string, payload: unknown): void {
    this.assertQuizHost(roomId, userId);
    this.quizRate(roomId, userId, 'edit', 10, 5000);
    const edit = parseQuizPayload(quizEditSchema, payload);
    this.mutateQuiz(roomId, (state) => {
      switch (edit.op) {
        case 'add': QuizShowEngine.addQuestion(state, userId, edit.question); break;
        case 'update': QuizShowEngine.updateQuestion(state, userId, edit.id, edit.question); break;
        case 'delete': QuizShowEngine.deleteQuestion(state, userId, edit.id); break;
        case 'move': QuizShowEngine.moveQuestion(state, userId, edit.id, edit.direction); break;
        case 'starter': QuizShowEngine.loadQuestions(state, userId, MOVIE_NIGHT_STARTER_PACK); break;
        case 'clear': QuizShowEngine.clearQuestions(state, userId); break;
      }
    }, { lobby: true });
  }

  /** An answer to the open multiple choice question. Only the host (live counts) and the sender get an answer back. */
  public handleQuizAnswer(roomId: string, userId: string, payload: unknown): void {
    this.quizRate(roomId, userId, 'answer', 4, 3000);
    const { questionId, optionIndex } = parseQuizPayload(quizAnswerSchema, payload);
    this.mutateQuiz(
      roomId,
      (state) => { QuizShowEngine.submitAnswer(state, userId, questionId, optionIndex, Date.now()); },
      { quietTo: () => [this.quizHostId(roomId), userId] }
    );
  }

  public handleQuizBuzz(roomId: string, userId: string, payload: unknown): void {
    this.quizRate(roomId, userId, 'buzz', 4, 3000);
    const { questionId } = parseQuizPayload(quizBuzzSchema, payload);
    this.mutateQuiz(roomId, (state) => { QuizShowEngine.buzz(state, userId, questionId, Date.now()); });
  }

  /** The typed answer of the active buzzer: only the host and that player see it. */
  public handleQuizBuzzAnswer(roomId: string, userId: string, payload: unknown): void {
    this.quizRate(roomId, userId, 'buzz_answer', 4, 3000);
    const { questionId, text } = parseQuizPayload(quizBuzzAnswerSchema, payload);
    this.mutateQuiz(
      roomId,
      (state) => { QuizShowEngine.submitBuzzAnswer(state, userId, questionId, text, Date.now()); },
      { quietTo: () => [this.quizHostId(roomId), userId] }
    );
  }

  /** The host marks the active buzzer's answer Correct or Wrong. */
  public handleQuizJudge(roomId: string, userId: string, payload: unknown): void {
    this.assertQuizHost(roomId, userId);
    this.quizRate(roomId, userId, 'host', 10, 5000);
    const { questionId, correct } = parseQuizPayload(quizJudgeSchema, payload);
    this.mutateQuiz(roomId, (state) => { QuizShowEngine.judge(state, userId, questionId, correct, Date.now()); });
  }

  /** Host pacing: Skip question / Reveal now / Next question / End quiz. */
  public handleQuizControl(roomId: string, userId: string, payload: unknown): void {
    this.assertQuizHost(roomId, userId);
    this.quizRate(roomId, userId, 'host', 10, 5000);
    const { action } = parseQuizPayload(quizControlSchema, payload);
    this.mutateQuiz(roomId, (state) => { QuizShowEngine.hostControl(state, userId, action, Date.now()); });
  }

  /** Rematch (host only): the same quiz, scores reset, everybody still seated plays. */
  public handleQuizRematch(roomId: string, userId: string): void {
    const room = this.assertQuizHost(roomId, userId);
    if (room.status !== 'FINISHED') throw new GameRuleError('REMATCH_UNAVAILABLE', 'A rematch can only start after the quiz has finished');
    const host = room.players.find(p => p.userId === userId);
    if (!host || host.status === 'LEFT') throw new GameRuleError('REMATCH_UNAVAILABLE', 'The quiz master is not in the room');
    this.quizRate(roomId, userId, 'start', 3, 5000);
    const st: any = room.gameState;
    if (!st || !QuizShowEngine.isServerState(st) || (st.phase !== 'FINAL' && st.phase !== 'ABORTED') || st.quiz.length < 1) {
      throw new GameRuleError('REMATCH_UNAVAILABLE', 'There is no finished quiz to replay');
    }
    if (room.players.filter(p => p.userId !== userId && p.status !== 'LEFT').length < quizMinPlayers()) {
      throw new GameRuleError('REMATCH_UNAVAILABLE', 'A rematch needs at least 1 player still in the room');
    }
    this.rematchVotes.delete(roomId);
    this.startGame(room);
  }

  /** The host goes back to the lobby with the same quiz to edit it (players who left are removed from the room). */
  public handleQuizEditAgain(roomId: string, userId: string): void {
    const room = this.assertQuizHost(roomId, userId);
    if (room.status !== 'FINISHED') throw new GameRuleError('ILLEGAL_MOVE', 'The quiz is still running');
    const st: any = room.gameState;
    if (!st || !QuizShowEngine.isServerState(st)) throw new GameRuleError('ILLEGAL_MOVE', 'There is no finished quiz');
    this.quizRate(roomId, userId, 'start', 3, 5000);
    const lobby = QuizShowEngine.backToLobby(st as QuizServerState, userId);
    this.stopQuizTimer(roomId);
    this.rematchVotes.delete(roomId);
    for (const p of room.players.filter(p => p.status === 'LEFT')) this.db.removePlayerFromGameRoom(roomId, p.userId);
    this.db.updateGameRoomState(roomId, lobby, 0);
    this.db.updateGameRoomStatus(roomId, 'WAITING');
    room.status = 'WAITING';
    this.broadcast(roomId, { type: 'quiz-show:state', roomId, payload: { gameState: lobby, roomStatus: 'WAITING' } });
  }

  private quizHostId(roomId: string): string {
    return this.db.getGameRoomById(roomId)?.hostUserId ?? '';
  }

  /** A player (or the host) left for good during a running quiz: the host leaving ends it; a player keeps their score, marked "left". */
  private applyQuizDeparture(room: GameRoom, userId: string, base: Record<string, any>): void {
    let aborted = false;
    try {
      this.mutateQuiz(room.id, (state) => { aborted = QuizShowEngine.removePlayer(state, userId, Date.now()); });
    } catch {
      return;
    }
    const fresh = this.db.getGameRoomById(room.id);
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, aborted, gameState: fresh?.gameState }
    });
  }

  /** True while the player's own buzzer answer window is open (typed chat could leak the answer). */
  private quizChatLocked(roomId: string, userId: string): boolean {
    if (this.roomGameTypes.get(roomId) !== 'quiz-show') return false;
    const room = this.db.getGameRoomById(roomId);
    const st: any = room?.gameState;
    if (!room || room.status !== 'PLAYING' || !st || !QuizShowEngine.isServerState(st)) return false;
    // work on a copy: settling an expired phase is the timer's job, this only needs the state right now
    const copy = JSON.parse(JSON.stringify(st)) as QuizServerState;
    QuizShowEngine.tick(copy, Date.now());
    return QuizShowEngine.chatLockedFor(copy, userId);
  }

  // =========================================================================
  // TOURNAMENT ARENA (host-run single-elimination bracket of 1v1 matches, up to 32 players)
  // The tournament room is a normal room of type 'tournament'; every MATCH is a REAL private game room (tic-tac-toe, four-in-a-row or chess)
  // created by the server with exactly the two players pre-seated (see fillTournamentRooms). The result of a match is read from the SERVER state
  // of that room when it finishes (the finished-room hook: watchGameRoom / onGameRoomFinished); no message from a player or the host can set it.
  // =========================================================================

  /** Nobody in the tournament room or in any of its open match rooms for this long: the tournament ends (it would only run on no-shows). */
  private static readonly TOURNAMENT_ABANDON_MS = 5 * 60_000;
  // tournament room id -> last time anybody was around (memory only)
  private tournamentLastSeen = new Map<string, number>();
  // match id -> earliest time the next room creation may be retried after a failure
  private tournamentRetryAt = new Map<string, number>();

  /** The web / push layer can show "Your match is ready" to a player who is not on a game page. */
  public setTournamentNotifier(notifier: TournamentNotifier | null): void {
    this.tournamentNotifier = notifier;
  }

  public startTournamentTimer(roomId: string): void {
    this.stopTournamentTimer(roomId);
    this.tournamentLastSeen.set(roomId, this.clock());
    const timer = setInterval(() => this.tickTournament(roomId), 1000);
    (timer as any).unref?.();
    this.tournamentTimers.set(roomId, timer);
  }

  public stopTournamentTimer(roomId: string): void {
    const existing = this.tournamentTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.tournamentTimers.delete(roomId);
      this.tournamentLastSeen.delete(roomId);
      clearTournamentRate(roomId);
    }
  }

  /** (Re)arms the timer of a running tournament and listens again for its open match rooms (after a server restart). */
  public ensureTournamentTimer(roomId: string): void {
    if (this.tournamentTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'tournament' || room.status !== 'PLAYING' || !room.gameState || !TournamentEngine.isServerState(room.gameState)) return;
    this.roomGameTypes.set(roomId, 'tournament');
    for (const m of (room.gameState as TournamentServerState).matches) {
      if (m.roomId && m.status !== 'DONE') this.watchGameRoom(m.roomId, roomId);
    }
    this.startTournamentTimer(roomId);
  }

  /**
   * After a server restart: every running tournament gets its timer back and re-checks its match rooms at once, so a match room that
   * finished (or whose join window ran out) while the server was down is settled. Returns how many tournaments were resumed.
   */
  public resumeTournaments(): number {
    let resumed = 0;
    for (const id of this.db.listPlayingGameRoomIds('9999-12-31T23:59:59.999Z')) {
      const room = this.db.getGameRoomById(id);
      if (!room || room.gameType !== 'tournament' || room.status !== 'PLAYING') continue;
      this.ensureTournamentTimer(id);
      this.tickTournament(id);
      resumed += 1;
    }
    return resumed;
  }

  /** Server-side clock: results of finished match rooms, opened rooms, no-shows and the host's double no-show window. */
  public tickTournament(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'tournament' || room.status !== 'PLAYING' || !room.gameState) {
      this.stopTournamentTimer(roomId);
      return;
    }
    try {
      this.mutateTournament(roomId, (state) => {
        const now = this.clock();
        const effects = this.reconcileTournamentRooms(state, roomId, now);
        const ticked = TournamentEngine.tick(state, now);
        effects.closeRooms.push(...ticked.closeRooms);
        // nobody around for a while: the bracket would only advance on no-shows, so it ends instead
        if (this.tournamentPresent(room, state)) this.tournamentLastSeen.set(roomId, now);
        else if (state.phase === 'RUNNING' && now - (this.tournamentLastSeen.get(roomId) ?? now) > GameRoomManager.TOURNAMENT_ABANDON_MS) {
          effects.closeRooms.push(...TournamentEngine.abort(state, 'Nobody has been around for a while, so the tournament ended.', now).closeRooms);
        }
        return effects;
      });
    } catch (err) {
      if (!(err instanceof GameRuleError)) console.error('[tournament] tick failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  private tournamentPresent(room: GameRoom, state: TournamentServerState): boolean {
    if (this.roomClients.get(room.id)?.size) return true;
    return state.matches.some((m) => m.roomId && m.status !== 'DONE' && [m.a, m.b].some((uid) => uid && this.liveClient(m.roomId as string, uid)));
  }

  /** Looks at the match rooms: finished ones report their result (also covers a restart), opened ones are noted, a started one is LIVE. */
  private reconcileTournamentRooms(state: TournamentServerState, tournamentRoomId: string, now: number): TournamentEffects {
    const effects: TournamentEffects = { closeRooms: [] };
    for (const m of state.matches) {
      const roomId = m.roomId;
      if (!roomId || (m.status !== 'PENDING_PLAYERS' && m.status !== 'LIVE')) continue;
      const matchRoom = this.db.getGameRoomById(roomId);
      if (!matchRoom) {
        this.unwatchGameRoom(roomId);
        effects.closeRooms.push(...TournamentEngine.reportGame(state, roomId, null, now).closeRooms);
        continue;
      }
      if (matchRoom.status === 'FINISHED' || matchRoom.status === 'CANCELLED') {
        const winner = this.watchedOutcomes.has(roomId) ? (this.watchedOutcomes.get(roomId) ?? null) : this.engineWinnerOf(matchRoom);
        this.unwatchGameRoom(roomId);
        effects.closeRooms.push(...TournamentEngine.reportGame(state, roomId, winner, now).closeRooms);
        continue;
      }
      if (!this.watchedRooms.has(roomId)) this.watchGameRoom(roomId, tournamentRoomId);
      for (const uid of [m.a, m.b]) {
        if (uid && this.liveClient(roomId, uid)) TournamentEngine.noteJoined(state, roomId, uid);
      }
      if (matchRoom.status === 'PLAYING' && m.status === 'PENDING_PLAYERS') TournamentEngine.markLive(state, roomId, now);
    }
    return effects;
  }

  /**
   * Loads the tournament state, runs `fn`, opens the game rooms of every match that became ready, persists and sends whenever the state
   * changed (even when `fn` throws afterwards), then closes the match rooms the engine decided without. `opts.lobby`: also allowed in the
   * WAITING lobby (the organiser's settings).
   */
  private mutateTournament(roomId: string, fn: (state: TournamentServerState, room: GameRoom) => TournamentEffects | void, opts: { lobby?: boolean } = {}): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'tournament') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    const inLobby = Boolean(opts.lobby) && room.status === 'WAITING';
    if ((room.status !== 'PLAYING' && !inLobby) || !room.gameState || !TournamentEngine.isServerState(room.gameState)) {
      throw new GameRuleError('NOT_PLAYING', 'The tournament is not in progress');
    }
    const state = room.gameState as TournamentServerState;
    const before = JSON.stringify(state);
    let effects: TournamentEffects | void = undefined;
    let failure: unknown = null;
    try {
      effects = fn(state, room);
    } catch (err) {
      failure = err;
    }
    const opened = room.status === 'PLAYING' && state.phase === 'RUNNING' ? this.fillTournamentRooms(state, room) : [];
    if (JSON.stringify(state) !== before) this.commitTournament(room, state);
    if (effects && effects.closeRooms.length) this.closeTournamentMatchRooms(state, effects.closeRooms);
    for (const m of opened) this.notifyTournamentMatch(room, state, m);
    if (failure) throw failure;
  }

  /** Persists a changed state, closes the room when the tournament is over, and sends every recipient their own view. */
  private commitTournament(room: GameRoom, state: TournamentServerState): void {
    this.db.updateGameRoomState(room.id, state, 0);
    if ((state.phase === 'COMPLETE' || state.phase === 'ABORTED') && room.status === 'PLAYING') {
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date(this.clock()).toISOString());
      room.status = 'FINISHED';
      for (const m of state.matches) if (m.roomId) this.watchedRooms.delete(m.roomId);
      this.stopTournamentTimer(room.id);
      this.rematchVotes.delete(room.id);
    }
    // broadcast() projects payload.gameState per recipient (stateNeedsProjection is true for the full state)
    this.broadcast(room.id, { type: 'tournament:state', roomId: room.id, payload: { gameState: state, roomStatus: room.status } });
  }

  private tournamentRate(roomId: string, userId: string, kind: string, max: number, windowMs: number): void {
    if (!tournamentRateAllowed(`${roomId}:${userId}:${kind}`, max, windowMs, this.clock())) {
      throw new GameRuleError('RATE_LIMITED', 'Slow down a little');
    }
  }

  /** The host check every organiser action starts with (before anything is parsed or changed). */
  private assertTournamentHost(roomId: string, userId: string): GameRoom {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'tournament') throw new GameRuleError('WRONG_GAME', 'This action is not valid in this room');
    if (room.hostUserId !== userId) throw new GameRuleError('HOST_ONLY', 'Only the organiser can do this');
    return room;
  }

  private tournamentSetConnected(roomId: string, userId: string, connected: boolean): void {
    if (this.roomGameTypes.get(roomId) !== 'tournament') return;
    try {
      this.mutateTournament(roomId, (state) => { TournamentEngine.setConnected(state, userId, connected); }, { lobby: true });
    } catch {
      // not a tournament in progress (finished, cancelled): nothing to update
    }
  }

  /** A player opened a tournament match room: counts for the 120 s join window. No-op for every other room. */
  private tournamentNoteJoin(roomId: string, userId: string): void {
    const owner = this.watchedRooms.get(roomId);
    if (!owner) return;
    try {
      this.mutateTournament(owner, (state) => { TournamentEngine.noteJoined(state, roomId, userId); });
    } catch {
      // the tournament is over: nothing to note
    }
  }

  /** The match room started (both players are in): the match is LIVE. No-op for every other room. */
  private tournamentNoteStarted(roomId: string): void {
    const owner = this.watchedRooms.get(roomId);
    if (!owner) return;
    try {
      this.mutateTournament(owner, (state) => { TournamentEngine.markLive(state, roomId, this.clock()); });
    } catch {
      // the tournament is over: nothing to note
    }
  }

  /** The finished-room hook of a tournament match room: the engine's winner (or null) goes to the bracket. */
  private onTournamentMatchRoomFinished(event: GameRoomFinishedEvent): void {
    const owner = event.watcher;
    if (!owner) return;
    try {
      this.mutateTournament(owner, (state) => TournamentEngine.reportGame(state, event.roomId, event.winnerUserId, this.clock()));
    } catch (err) {
      if (!(err instanceof GameRuleError)) console.error('[tournament] could not record a match result:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /**
   * Creates the private game room of every match that has both players and no room yet, with exactly those two players seated (they do not
   * need the code, nobody else can take a seat). The sides alternate between the games of a match. Runs on the in-memory state before it is saved.
   */
  private fillTournamentRooms(state: TournamentServerState, room: GameRoom): TournamentMatch[] {
    const opened: TournamentMatch[] = [];
    const now = this.clock();
    for (const m of TournamentEngine.matchesNeedingRoom(state)) {
      if ((this.tournamentRetryAt.get(`${room.id}:${m.id}`) ?? 0) > now) continue;
      const order = TournamentEngine.seatOrder(m);
      if (!order || !isTournamentMatchGame(state.config.game)) continue;
      try {
        const first = state.players.find((p) => p.userId === order[0]);
        const second = state.players.find((p) => p.userId === order[1]);
        if (!first || !second) continue;
        const matchRoom = this.createGameRoom({
          hostUser: { id: first.userId, displayName: first.displayName, avatarUrl: first.avatarUrl ?? null },
          gameType: state.config.game as GameType,
          maxPlayers: 2,
          isPrivate: true,
          tournament: { id: room.id, code: room.roomCode }
        });
        const colors = seatColorsFor(matchRoom.gameType, 2);
        this.db.addPlayerToGameRoom(matchRoom.id, { id: second.userId, displayName: second.displayName, avatarUrl: second.avatarUrl ?? null }, 1, colors[1], false);
        this.watchGameRoom(matchRoom.id, room.id);
        TournamentEngine.attachRoom(state, m.id, { roomId: matchRoom.id, roomCode: matchRoom.roomCode }, now);
        this.tournamentRetryAt.delete(`${room.id}:${m.id}`);
        opened.push(m);
      } catch (err) {
        this.tournamentRetryAt.set(`${room.id}:${m.id}`, now + 5000);
        console.error('[tournament] could not create a match room:', String((err as any)?.message ?? err).slice(0, 120));
      }
    }
    return opened;
  }

  /** The first rooms of a tournament that just started. */
  public openTournamentMatchRooms(roomId: string): void {
    try {
      this.mutateTournament(roomId, () => undefined);
    } catch (err) {
      console.error('[tournament] could not open the first match rooms:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  /** Tells both players their match is ready: a WS message (when they are in the tournament room) and an in-app notification. */
  private notifyTournamentMatch(room: GameRoom, state: TournamentServerState, m: TournamentMatch): void {
    if (!m.a || !m.b || !m.roomCode) return;
    const game = TOURNAMENT_GAME_NAMES[state.config.game] ?? state.config.game;
    for (const uid of [m.a, m.b]) {
      const opponent = state.players.find((p) => p.userId === (uid === m.a ? m.b : m.a));
      this.sendToUser(uid, {
        type: 'tournament:match_ready',
        roomId: room.id,
        payload: {
          matchId: m.id,
          roundName: m.roundName,
          game: state.config.game,
          gameNo: m.gameNo,
          roomCode: m.roomCode,
          joinDeadline: m.joinDeadline,
          opponent: opponent ? { userId: opponent.userId, displayName: opponent.displayName, avatarUrl: opponent.avatarUrl ?? null } : null
        }
      }, room.id);
      try {
        this.tournamentNotifier?.(uid, {
          id: `tmatch:${room.id}:${m.id}:${m.gameNo}`,
          title: 'Your tournament match is ready',
          body: `${m.roundName}: you play ${opponent?.displayName ?? 'your opponent'} in ${game}. Open it within ${Math.round((m.joinDeadline && m.createdAt ? m.joinDeadline - m.createdAt : 120_000) / 1000)} seconds.`,
          roomCode: m.roomCode,
          gameType: state.config.game
        });
      } catch { /* a notification is a nicety */ }
    }
  }

  /** Ends the game rooms of matches the engine decided without them (a no-show, a leaver, the host's advance, an abort). */
  private closeTournamentMatchRooms(state: TournamentServerState, roomIds: string[]): void {
    for (const roomId of new Set(roomIds)) {
      const m = state.matches.find((x) => x.roomId === roomId);
      const winner = m && m.status === 'DONE' ? m.winnerUserId : null;
      const message =
        !m || m.status !== 'DONE' ? 'The tournament ended, so this match was closed.'
        : m.reason === 'forfeit' ? 'A player left the tournament, so this match was decided.'
        : m.reason === 'no_show' || m.reason === 'double_no_show' ? 'This match was decided: a player did not open the room in time.'
        : m.reason === 'host_advance' ? 'The organiser advanced a player, so this match was closed.'
        : 'This match was decided by the tournament.';
      this.closeMatchRoom(roomId, winner, message);
    }
  }

  /**
   * Ends one match room from outside its game. Not started: cancelled. Running with a decided winner: finished through the same forfeit
   * state the game pages already understand ("... left, you win"). Running without a winner (the tournament ended): finished with no winner.
   * The room is unwatched first, so its own end is not reported back to the tournament a second time.
   */
  private closeMatchRoom(roomId: string, winnerUserId: string | null, message: string): void {
    this.unwatchGameRoom(roomId);
    const matchRoom = this.db.getGameRoomById(roomId);
    if (!matchRoom || matchRoom.status === 'FINISHED' || matchRoom.status === 'CANCELLED') return;
    const winner = winnerUserId ? matchRoom.players.find((p) => p.userId === winnerUserId) : undefined;
    const loser = winner ? matchRoom.players.find((p) => p.userId !== winner.userId) : undefined;
    if (matchRoom.status === 'PLAYING' && matchRoom.gameState && winner && loser) {
      this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, new Date(this.clock()).toISOString());
      matchRoom.status = 'FINISHED';
      this.applyForfeitState(matchRoom, winner, loser.displayName);
      if (matchRoom.gameState && typeof matchRoom.gameState === 'object') {
        matchRoom.gameState.statusMessage = message;
        this.db.updateGameRoomState(roomId, matchRoom.gameState, matchRoom.gameState.currentTurnSeat, winner.seat);
      }
      this.db.setGamePlayerStatus(roomId, loser.userId, 'LEFT');
      this.broadcast(roomId, {
        type: 'game:player_left',
        roomId,
        payload: {
          userId: loser.userId,
          displayName: loser.displayName,
          reason: 'LEFT',
          hostUserId: matchRoom.hostUserId,
          forfeitMessage: message,
          isWinner: true,
          winnerUserId: winner.userId,
          winnerDisplayName: winner.displayName,
          winnerColor: winner.color,
          gameState: matchRoom.gameState
        }
      });
    } else if (matchRoom.status === 'PLAYING') {
      this.finishRoomWithoutWinner(matchRoom, message);
    } else {
      this.db.updateGameRoomStatus(roomId, 'CANCELLED', undefined, new Date(this.clock()).toISOString());
      matchRoom.status = 'CANCELLED';
    }
    this.broadcast(roomId, { type: 'tournament:match_closed', roomId, payload: { message, status: matchRoom.status, winnerUserId: winner?.userId ?? null } });
    this.cleanupRoomMemoryIfEmpty(roomId);
  }

  /** A player leaves a tournament match room that has not started: that player forfeits, the opponent advances. A disconnect keeps the seat. */
  private applyLinkedWaitingDeparture(room: GameRoom, me: GameRoomPlayer, displayName: string, reason: 'LEFT' | 'DISCONNECTED'): void {
    if (reason === 'DISCONNECTED') return; // the seat is kept; the 120 s no-show rule of the tournament decides
    this.db.setGamePlayerStatus(room.id, me.userId, 'LEFT');
    me.status = 'LEFT';
    const other = room.players.find((p) => p.userId !== me.userId);
    this.watchedOutcomes.set(room.id, other?.userId ?? null);
    this.db.updateGameRoomStatus(room.id, 'CANCELLED', undefined, new Date(this.clock()).toISOString());
    room.status = 'CANCELLED';
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { userId: me.userId, displayName, reason, isWinner: false, hostUserId: room.hostUserId, totalPlayers: room.players.length, roomClosed: true }
    });
    this.cleanupRoomMemoryIfEmpty(room.id);
  }

  /** The organiser leaving a running tournament ends it; a player leaving forfeits every remaining match (their opponent advances). */
  private applyTournamentDeparture(room: GameRoom, userId: string, base: Record<string, any>): void {
    let aborted = false;
    try {
      this.mutateTournament(room.id, (state) => {
        const now = this.clock();
        const effects = userId === state.host.userId ? TournamentEngine.hostLeft(state, now) : TournamentEngine.playerLeft(state, userId, now);
        aborted = state.phase === 'ABORTED';
        return effects;
      });
    } catch {
      return;
    }
    const fresh = this.db.getGameRoomById(room.id);
    this.broadcast(room.id, {
      type: 'game:player_left',
      roomId: room.id,
      payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, aborted, gameState: fresh?.gameState }
    });
  }

  /** Abandoned-tournament safety net used by the periodic sweep: only makes sure the timer exists (the timer itself ends an abandoned tournament). */
  private sweepTournament(room: GameRoom, _now: number): void {
    this.ensureTournamentTimer(room.id);
  }

  /** Organiser: game, third place match, length of the Final. Registration only. */
  public handleTournamentConfig(roomId: string, userId: string, payload: unknown): void {
    const room = this.assertTournamentHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('WRONG_PHASE', 'The tournament has already started');
    this.tournamentRate(roomId, userId, 'config', 10, 5000);
    const patch = parseTournamentPayload(tournamentConfigSchema, payload);
    this.mutateTournament(roomId, (state) => { TournamentEngine.setConfig(state, userId, patch); }, { lobby: true });
  }

  /** Organiser: a new random seed order. Registration only. */
  public handleTournamentShuffle(roomId: string, userId: string): void {
    const room = this.assertTournamentHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('WRONG_PHASE', 'The tournament has already started');
    this.tournamentRate(roomId, userId, 'shuffle', 6, 5000);
    this.mutateTournament(roomId, (state, r) => {
      const seats = r.players.filter((p) => p.userId !== r.hostUserId && p.status !== 'LEFT').map((p) => ({ userId: p.userId, displayName: p.displayName, avatarUrl: p.avatarUrl ?? null, seat: p.seat }));
      TournamentEngine.shuffleSeeds(state, userId, seats, this.rng);
    }, { lobby: true });
  }

  /** Organiser: removes a player before the start. The player cannot join this tournament again. */
  public handleTournamentKick(roomId: string, userId: string, payload: unknown): void {
    const room = this.assertTournamentHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('WRONG_PHASE', 'Players can only be removed before the tournament starts');
    this.tournamentRate(roomId, userId, 'kick', 10, 5000);
    const { userId: target } = parseTournamentPayload(tournamentKickSchema, payload);
    const seat = room.players.find((p) => p.userId === target && p.status !== 'LEFT');
    if (!seat || target === room.hostUserId) throw new GameRuleError('INVALID_INPUT', 'That player is not in the lobby');
    this.mutateTournament(roomId, (state) => { TournamentEngine.kick(state, userId, target); }, { lobby: true });
    const message = 'The organiser removed you from this tournament.';
    this.sendToUser(target, { type: 'tournament:kicked', roomId, payload: { message } }, roomId);
    const client = this.liveClient(roomId, target);
    if (client) {
      this.handleClientLeave(client);
      try { client.socket.close(4403, 'KICKED'); } catch { /* already gone */ }
    } else {
      this.applyDeparture(roomId, target, seat.displayName, 'LEFT');
    }
  }

  /** Organiser: starts the bracket. Needs the minimum number of players, all connected. */
  public handleTournamentStart(roomId: string, userId: string): void {
    const room = this.assertTournamentHost(roomId, userId);
    if (room.status !== 'WAITING') throw new GameRuleError('ILLEGAL_MOVE', 'The tournament has already started');
    this.tournamentRate(roomId, userId, 'start', 3, 5000);
    const lobby: any = room.gameState;
    if (!lobby || !TournamentEngine.isServerState(lobby)) throw new GameRuleError('NOT_PLAYING', 'The tournament lobby is not ready');
    const seated = room.players.filter((p) => p.userId !== room.hostUserId && p.status !== 'LEFT');
    const problem = TournamentEngine.startProblem(lobby as TournamentServerState, seated.length);
    if (problem) throw new GameRuleError('INVALID_INPUT', problem);
    if (!this.liveClient(roomId, room.hostUserId)) throw new GameRuleError('INVALID_INPUT', 'The organiser must be connected');
    const away = seated.filter((p) => !this.liveClient(roomId, p.userId));
    if (away.length) {
      throw new GameRuleError('INVALID_INPUT', `${away.map((p) => p.displayName).slice(0, 3).join(', ')}${away.length > 3 ? ' and others' : ''} ${away.length > 1 ? 'are' : 'is'} not connected. Wait for them or remove them first.`);
    }
    this.startGame(room);
  }

  /** Organiser: advances one player of a stuck match (or after a nobody-showed-up window). Logged publicly. */
  public handleTournamentAdvance(roomId: string, userId: string, payload: unknown): void {
    this.assertTournamentHost(roomId, userId);
    this.tournamentRate(roomId, userId, 'host', 10, 5000);
    const { matchId, userId: target } = parseTournamentPayload(tournamentAdvanceSchema, payload);
    this.mutateTournament(roomId, (state) => TournamentEngine.hostAdvance(state, userId, matchId, target, this.clock()));
  }

  /** Organiser: ends the tournament (in the lobby the room is closed). */
  public handleTournamentEnd(roomId: string, userId: string): void {
    const room = this.assertTournamentHost(roomId, userId);
    this.tournamentRate(roomId, userId, 'host', 10, 5000);
    if (room.status === 'WAITING') {
      this.mutateTournament(roomId, (state) => TournamentEngine.abort(state, 'The organiser closed the tournament.', this.clock()), { lobby: true });
      const fresh = this.db.getGameRoomById(roomId);
      this.db.updateGameRoomStatus(roomId, 'CANCELLED', undefined, new Date(this.clock()).toISOString());
      this.broadcast(roomId, { type: 'tournament:state', roomId, payload: { gameState: fresh?.gameState, roomStatus: 'CANCELLED' } });
      this.cleanupRoomMemoryIfEmpty(roomId);
      return;
    }
    if (room.status !== 'PLAYING') throw new GameRuleError('ILLEGAL_MOVE', 'The tournament is already over');
    this.mutateTournament(roomId, (state) => TournamentEngine.abort(state, 'The organiser ended the tournament.', this.clock()));
  }

  // =========================================================================
  // CHESS MULTIPLAYER ENGINE INTEGRATION & CLOCK TICKERS
  // =========================================================================

  public startChessClock(roomId: string): void {
    this.stopChessClock(roomId);

    let tickCount = 0;
    const timer = setInterval(() => {
      const room = this.db.getGameRoomById(roomId);
      if (!room || room.status !== 'PLAYING' || !room.gameState || room.gameType !== 'chess') {
        this.stopChessClock(roomId);
        return;
      }

      const state = room.gameState as ChessGameState;
      if (state.status !== 'ACTIVE' && state.status !== 'CHECK') {
        this.stopChessClock(roomId);
        return;
      }

      // Server-authoritative clock: derive remaining time from lastMoveTimestamp
      // without mutating state (the move handler is the only place that commits).
      // The clock does not run before White's first move.
      const activeColor = state.turn;
      const elapsed = state.moves.length === 0
        ? 0
        : Math.max(0, Date.now() - (state.lastMoveTimestamp || state.startedAt || Date.now()));
      const whiteTimeMs = Math.max(0, state.whitePlayer.timeRemainingMs - (activeColor === 'w' ? elapsed : 0));
      const blackTimeMs = Math.max(0, state.blackPlayer.timeRemainingMs - (activeColor === 'b' ? elapsed : 0));
      const activeRemaining = activeColor === 'w' ? whiteTimeMs : blackTimeMs;

      if (activeRemaining <= 0) {
        const res = ChessEngine.handleTimeout(state, activeColor);
        room.gameState = res.state;
        this.stopChessClock(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, now);
        this.db.updateGameRoomState(roomId, res.state);

        this.broadcast(roomId, {
          type: 'chess:game_over',
          roomId,
          payload: {
            gameState: res.state,
            winnerUserId: res.state.winnerUserId,
            winnerColor: res.state.winnerColor,
            reason: res.state.winnerReason
          }
        });
        return;
      }

      tickCount++;
      if (tickCount % 2 === 0) {
        // Broadcast periodic clock tick (once per second)
        this.broadcast(roomId, {
          type: 'chess:clock_tick',
          roomId,
          payload: {
            whiteTimeMs,
            blackTimeMs,
            turn: state.turn
          }
        });
      }
    }, 500);

    this.chessTimers.set(roomId, timer);
  }

  public stopChessClock(roomId: string): void {
    const timer = this.chessTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.chessTimers.delete(roomId);
    }
  }

  /** Restarts the ticker for a persisted PLAYING chess game that has none (CH-13). */
  // CH-14 (by design): the chess clock keeps running while a player is disconnected (45 s grace); it is not paused,
  // like on common chess servers. The grace only decides when the seat is forfeited, not whether the clock runs.
  public ensureChessClock(roomId: string): void {
    if (this.chessTimers.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.gameType !== 'chess' || room.status !== 'PLAYING' || !room.gameState) return;
    const st = (room.gameState as ChessGameState).status;
    if (st === 'ACTIVE' || st === 'CHECK') this.startChessClock(roomId);
  }

  private isChessPlayer(state: ChessGameState, userId: string): boolean {
    return userId === state.whitePlayer.userId || userId === state.blackPlayer.userId;
  }

  private isChessLive(state: ChessGameState): boolean {
    return state.status === 'ACTIVE' || state.status === 'CHECK';
  }

  private finishChessGame(roomId: string, state: ChessGameState, extra: Record<string, any> = {}): void {
    this.stopChessClock(roomId);
    const now = new Date().toISOString();
    this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, now);
    this.db.updateGameRoomState(roomId, state);
    this.broadcast(roomId, {
      type: 'chess:game_over',
      roomId,
      payload: {
        gameState: state,
        winnerUserId: state.winnerUserId,
        winnerColor: state.winnerColor,
        reason: state.winnerReason,
        ...extra
      }
    });
  }

  private sendChessError(roomId: string, userId: string, message: string): void {
    const client = this.userClients.get(userId);
    if (client) {
      try {
        client.socket.send(JSON.stringify({ type: 'chess:move_rejected', roomId, payload: { message } }));
      } catch { /* ignore */ }
    }
  }

  public handleChessStart(roomId: string, userId: string, config?: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.players.length < 2 || room.gameType !== 'chess') return;
    if (room.hostUserId !== userId) return;
    // A tournament match starts by itself when both players are in, and is played once (no host restart, no new game with the opponent)
    if (room.tournamentId) throw new GameRuleError('ILLEGAL_MOVE', 'This is a tournament match: it starts when both players are in');
    // Cannot restart a live game (CH-9)
    if (room.status === 'PLAYING' && room.gameState && this.isChessLive(room.gameState as ChessGameState)) return;

    this.stopChessClock(roomId);
    const chessConfig = sanitizeChessConfig(config, sanitizeChessConfig(this.chessConfigs.get(roomId)));
    this.chessConfigs.set(roomId, chessConfig);
    const p1 = room.players[0];
    const p2 = room.players[1];

    const state = ChessEngine.initGameState(
      roomId,
      { id: p1.userId, displayName: p1.displayName, avatarUrl: p1.avatarUrl },
      { id: p2.userId, displayName: p2.displayName, avatarUrl: p2.avatarUrl },
      chessConfig
    );

    const now = new Date().toISOString();
    this.db.updateGameRoomStatus(roomId, 'PLAYING', now);
    this.db.updateGameRoomState(roomId, state);

    room.status = 'PLAYING';
    room.gameState = state;
    room.startedAt = now;
    this.recordGameStreaks(room);

    this.startChessClock(roomId);

    this.broadcast(roomId, {
      type: 'chess:started',
      roomId,
      payload: { room, gameState: state, message: 'Chess match started! White to move.' }
    });
  }

  public handleChessMove(roomId: string, userId: string, from: string, to: string, promotion?: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || room.gameType !== 'chess') return;

    const res = ChessEngine.makeMove(room.gameState as ChessGameState, userId, from, to, promotion);
    if (!res.success) {
      this.sendChessError(roomId, userId, res.message);
      return;
    }

    room.gameState = res.state;
    this.db.updateGameRoomState(roomId, res.state);

    // makeMove reports success without a move when the mover's flag fell
    if (!res.move) {
      this.finishChessGame(roomId, res.state);
      return;
    }

    this.broadcast(roomId, {
      type: 'chess:move_accepted',
      roomId,
      payload: {
        move: res.move,
        gameState: res.state
      }
    });

    if (!this.isChessLive(res.state)) {
      this.finishChessGame(roomId, res.state);
    }
  }

  public handleChessResign(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'chess') return;
    const state = room.gameState as ChessGameState;
    if (!this.isChessPlayer(state, userId) || !this.isChessLive(state)) return;

    const nextState = ChessEngine.resign(state, userId);
    room.gameState = nextState;
    this.finishChessGame(roomId, nextState, { reason: 'Resignation' });
  }

  public handleChessOfferDraw(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'chess') return;

    const res = ChessEngine.offerDraw(room.gameState as ChessGameState, userId);
    if (res.success) {
      this.db.updateGameRoomState(roomId, res.state);
      this.broadcast(roomId, {
        type: 'chess:draw_offered',
        roomId,
        payload: {
          fromUserId: userId,
          fromDisplayName: userId === res.state.whitePlayer.userId ? res.state.whitePlayer.displayName : res.state.blackPlayer.displayName
        }
      });
    }
  }

  public handleChessDrawResponse(roomId: string, userId: string, accept: boolean): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'chess') return;

    const res = ChessEngine.respondDraw(room.gameState as ChessGameState, userId, accept === true);
    if (!res.success) return; // no valid offer / not a player: no state change (CH-1)

    room.gameState = res.state;
    if (res.accepted) {
      this.finishChessGame(roomId, res.state, { drawReason: 'agreement', reason: 'Mutual Agreement' });
    } else {
      this.db.updateGameRoomState(roomId, res.state);
      this.broadcast(roomId, {
        type: 'chess:draw_declined',
        roomId,
        payload: { userId }
      });
    }
  }

  public handleChessRequestTakeback(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'chess') return;

    const res = ChessEngine.requestTakeback(room.gameState as ChessGameState, userId);
    if (res.success) {
      this.db.updateGameRoomState(roomId, res.state);
      this.broadcast(roomId, {
        type: 'chess:takeback_requested',
        roomId,
        payload: {
          fromUserId: userId,
          fromDisplayName: userId === res.state.whitePlayer.userId ? res.state.whitePlayer.displayName : res.state.blackPlayer.displayName
        }
      });
    }
  }

  public handleChessTakebackResponse(roomId: string, userId: string, accept: boolean): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'chess') return;

    const res = ChessEngine.respondTakeback(room.gameState as ChessGameState, userId, accept === true);
    if (!res.success) return;
    room.gameState = res.state;
    this.db.updateGameRoomState(roomId, res.state);

    this.broadcast(roomId, {
      type: 'chess:takeback_responded',
      roomId,
      payload: { accept: res.accepted, gameState: res.state }
    });
  }

  public handleChessConfigUpdate(roomId: string, userId: string, config: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.hostUserId !== userId || room.gameType !== 'chess') return;
    if (room.tournamentId) throw new GameRuleError('ILLEGAL_MOVE', 'The settings of a tournament match cannot be changed');
    // No config changes while a game is running (CH-9)
    if (room.gameState && room.status === 'PLAYING' && this.isChessLive(room.gameState as ChessGameState)) return;

    const newConfig = sanitizeChessConfig(config, sanitizeChessConfig(this.chessConfigs.get(roomId)));
    this.chessConfigs.set(roomId, newConfig);

    this.broadcast(roomId, {
      type: 'chess:config_updated',
      roomId,
      payload: { config: newConfig, gameState: room.gameState }
    });
  }

  /**
   * Registers a WebSocket connection to a game room
   */
  public registerClient(
    socket: WebSocket,
    roomId: string,
    user: { id: string; displayName: string; avatarUrl?: string | null },
    opts: { spectate?: boolean; canSpectate?: boolean } = {}
  ): void {
    // Spectator request: only for non-players; a seated player opening ?spectate=1 is a normal player.
    if (opts.spectate) {
      const pre = this.db.getGameRoomById(roomId);
      if (pre && !pre.players.some(p => p.userId === user.id)) {
        this.registerSpectator(socket, pre, user, Boolean(opts.canSpectate));
        return;
      }
    }
    // Membership gate (GR-3): only seated players (or someone who can still take a free seat of a WAITING room)
    // may connect. Everybody else gets an error and is disconnected, so they can neither read the state nor act.
    const preRoom = this.db.getGameRoomById(roomId);
    if (preRoom) {
      const seated = preRoom.players.find(p => p.userId === user.id);
      // a tournament match room is reserved for its two players; a removed player cannot come back to the tournament lobby
      const kickedFromTournament = preRoom.gameType === 'tournament' && !seated && Boolean(preRoom.gameState) && TournamentEngine.isServerState(preRoom.gameState)
        && TournamentEngine.isKicked(preRoom.gameState as TournamentServerState, user.id);
      if (kickedFromTournament) {
        this.rejectSocket(socket, 'KICKED', 'The organiser removed you from this tournament.');
        return;
      }
      const canTakeSeat = !seated && !preRoom.tournamentId && preRoom.status === 'WAITING' && preRoom.players.length < preRoom.maxPlayers;
      const mayReturn = seated?.status === 'LEFT' && preRoom.status === 'FINISHED';
      if (seated && !mayReturn && seated.status === 'LEFT') {
        this.rejectSocket(socket, 'NOT_A_PLAYER', 'You have left this game.');
        return;
      }
      if (!seated && !canTakeSeat) {
        this.rejectSocket(socket, 'NOT_A_PLAYER', preRoom.status === 'WAITING' ? 'This room is full.' : 'This game has already started.');
        return;
      }
      if (mayReturn) this.db.setGamePlayerStatus(roomId, user.id, 'WAITING');
      this.roomGameTypes.set(roomId, preRoom.gameType);
    }

    // Clear this user's pending disconnect grace timer for THIS room only (GR-13)
    const timerKey = `${roomId}:${user.id}`;
    const timer = this.disconnectGraceTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.disconnectGraceTimers.delete(timerKey);
    }

    let clientsSet = this.roomClients.get(roomId);
    if (!clientsSet) {
      clientsSet = new Set();
      this.roomClients.set(roomId, clientsSet);
    } else {
      // Remove any existing/stale socket for this user in this room to prevent duplicate sends.
      // The replaced client is flagged so that its (later) close event is a no-op: it must not forfeit the new session (LU-1 / GR-2).
      for (const existing of Array.from(clientsSet)) {
        if (existing.userId === user.id) {
          existing.superseded = true;
          if (existing.socket !== socket) {
            try {
              existing.socket.close();
            } catch {}
          }
          clientsSet.delete(existing);
        }
      }
    }

    const client: ConnectedGameClient = {
      socket,
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roomId,
      isAlive: true
    };

    clientsSet.add(client);
    this.roomUserClients.set(timerKey, client);
    this.expiredDisconnects.delete(timerKey);
    this.userClients.set(user.id, client);
    this.db.setGamePlayerConnected(roomId, user.id, true);
    this.imposterSetConnected(roomId, user.id, true); // no-op for every other game / state
    this.emojiCharadesSetConnected(roomId, user.id, true); // no-op for every other game / state
    this.mafiaSetConnected(roomId, user.id, true); // no-op for every other game / state
    this.quizSetConnected(roomId, user.id, true); // no-op for every other game / state
    this.murderSetConnected(roomId, user.id, true); // no-op for every other game / state
    this.tournamentSetConnected(roomId, user.id, true); // no-op for every other game / state
    this.tournamentNoteJoin(roomId, user.id); // no-op unless this is a tournament match room

    // Send full authoritative current state upon connection
    let room = this.db.getGameRoomById(roomId);
    if (room) {
      let myPlayer = room.players.find(p => p.userId === user.id);
      if (!myPlayer && room.status === 'WAITING' && room.players.length < room.maxPlayers) {
        try {
          room = this.joinRoom(room.roomCode, user, { connected: true });
          myPlayer = room.players.find(p => p.userId === user.id);
        } catch (e: any) {
          console.error(`[GameRoom] Error auto-joining room ${room.roomCode} for user ${user.id}:`, e);
          socket.send(JSON.stringify({
            type: 'error:notification',
            payload: { code: 'JOIN_FAILED', message: publicMessage(e, 'Failed to join game room') }
          }));
        }
      }

      if (myPlayer) {
        const cleanAvatar = (user.avatarUrl && !user.avatarUrl.includes('bottts') && !user.avatarUrl.includes('dicebear'))
          ? user.avatarUrl
          : null;
        if (myPlayer.avatarUrl !== cleanAvatar) {
          myPlayer.avatarUrl = cleanAvatar;
          this.db.updateGamePlayerProfile(room.id, user.id, myPlayer.displayName, cleanAvatar || '');
        }
      }

      if (this.shouldAutoStart(room)) {
        this.startGame(room);
      }

      const currentRoom = this.db.getGameRoomById(roomId) || room;
      const theme = this.roomThemes.get(roomId) || currentRoom.theme || 'romantic';
      currentRoom.theme = theme;
      // Mafia Night: the history is filtered per recipient (mafia / graveyard channels), so the shared room object carries none
      const chatHistory = this.chatHistoryFor(roomId, user.id);
      currentRoom.chatHistory = currentRoom.gameType === 'mafia-night' ? [] : chatHistory;

      // For doodle-duel: If room was saved in DB with PLAYING status but phase is still LOBBY, unstick it!
      if (currentRoom.gameType === 'doodle-duel' && currentRoom.status === 'PLAYING') {
        if (!currentRoom.gameState || currentRoom.gameState.phase === 'LOBBY' || currentRoom.gameState.phase === 'ROLE_SELECTION') {
          const p1 = currentRoom.players[0] || { userId: user.id, displayName: user.displayName };
          const p2 = currentRoom.players[1] || p1;
          if (!currentRoom.gameState) {
            currentRoom.gameState = DoodleDuelEngine.createInitialState(currentRoom.players, DEFAULT_DOODLE_CONFIG);
          }
          DoodleDuelEngine.startRoundIntro(currentRoom.gameState, p1.userId, p2.userId);
          currentRoom.gameState.drawerDisplayName = p1.displayName;
          currentRoom.gameState.guesserDisplayName = p2.displayName;
          currentRoom.gameState.currentRound = 1;
          currentRoom.gameState.timeLeftSeconds = 3;
          this.db.updateGameRoomState(roomId, currentRoom.gameState);
        }
      }

      // Per-viewer projection (secret word, other players' boards/tickets...) for game:sync (GR-4)
      const syncRoom = this.projectRoomFor(currentRoom, user.id);

      socket.send(JSON.stringify({
        type: 'game:sync',
        roomId,
        payload: {
          role: 'player',
          spectatorCount: this.spectatorCount(roomId),
          room: syncRoom,
          theme,
          chatHistory,
          myUserId: user.id,
          myPlayer: myPlayer || currentRoom.players.find(p => p.userId === user.id)
        }
      }));

      this.broadcast(roomId, {
        type: 'game:player_reconnected',
        roomId,
        payload: { userId: user.id, displayName: user.displayName, room: currentRoom } // broadcast() projects `room.gameState` per recipient
      });

      // Absent players whose reconnect window already ran out are settled now that somebody is present (GR-11)
      this.settleExpiredDisconnects(roomId);

      // Re-arm the Tambola draw timer / Bingo Duel turn watchdog after a server restart or when everybody had left (TA-5)
      if (currentRoom.gameType === 'bingo' || currentRoom.gameType === 'tambola') {
        this.ensureBingoTimer(roomId);
      }

      // Ensure doodle timer is actively running if match is in progress (e.g. after server restart)
      if (currentRoom.gameType === 'doodle-duel' && currentRoom.status === 'PLAYING' && !this.doodleTimers.has(roomId)) {
        this.startDoodleTimer(roomId);
      }

      // Restart the chess ticker after a server restart (CH-13)
      if (currentRoom.gameType === 'chess') this.ensureChessClock(roomId);
      if (currentRoom.gameType === 'imposter') this.ensureImposterTimer(roomId);
      if (currentRoom.gameType === 'emoji-charades') this.ensureEmojiCharadesTimer(roomId);
      if (currentRoom.gameType === 'mafia-night') this.ensureMafiaTimer(roomId);
      if (currentRoom.gameType === 'quiz-show') this.ensureQuizTimer(roomId);
      if (currentRoom.gameType === 'murder-mystery') this.ensureMurderTimer(roomId);
      if (currentRoom.gameType === 'tournament') this.ensureTournamentTimer(roomId);

      // For active doodle games, immediately push the current state to the newly connected client
      if (currentRoom.gameType === 'doodle-duel' && currentRoom.status === 'PLAYING' && currentRoom.gameState) {
        // Small delay to ensure client is fully connected before pushing state
        setTimeout(() => {
          this.broadcastDoodleState(roomId);
        }, 200);
      }
    }

    // Handle WebSocket messages
    // Drawing games stream many small frames, so the budget is higher than for the cinema room
    const guard = new SocketGuard(socket, { label: 'game', ratePerSec: 120, burst: 400 }, `${client.displayName} (${client.userId})`);
    socket.on('message', (data: any) => {
      if (client.superseded || client.left) return; // a replaced / departed session can no longer act
      const msg = guard.accept(data);
      if (!msg) return;
      try {
        this.handleClientMessage(client, msg);
      } catch (err) {
        // Rule violations ("not your turn", "invalid move") are normal gameplay: log one line, don't count as abuse.
        // The acting socket always gets a uniform `game:error` so the UI can react (GR-24).
        const code = err instanceof GameRuleError ? err.code : 'ACTION_FAILED';
        const message = err instanceof GameRuleError
          ? err.message
          : String((err as any)?.message ?? 'Action failed').slice(0, 160);
        console.warn(`[ws:game] ${client.displayName} (${client.userId}) ${msg.type}: ${message.slice(0, 120)}`);
        this.sendRaw(client.socket, { type: 'game:error', roomId: client.roomId, payload: { code, message, action: msg.type } });
      }
    });

    socket.on('close', () => {
      this.handleClientDisconnection(client);
    });
  }

  public spectatorCount(roomId: string): number {
    return this.roomSpectators.get(roomId)?.size ?? 0;
  }

  private spectatorNames(roomId: string): string[] {
    const out: string[] = [];
    for (const c of this.roomSpectators.get(roomId) ?? []) {
      if (out.length >= 5) break;
      out.push(String(c.displayName || 'Guest').slice(0, 30));
    }
    return out;
  }

  private broadcastSpectators(roomId: string): void {
    this.broadcast(roomId, {
      type: 'game:spectators',
      roomId,
      payload: { count: this.spectatorCount(roomId), names: this.spectatorNames(roomId) }
    });
  }

  /**
   * Read-only spectator connection. `canSpectate` is decided by the route (friend of a player). Spectators live in
   * `roomSpectators` only: they never touch seats, connection flags, grace timers, votes, auto-start or turn logic.
   */
  private registerSpectator(
    socket: WebSocket,
    room: GameRoom,
    user: { id: string; displayName: string; avatarUrl?: string | null },
    canSpectate: boolean
  ): void {
    const roomId = room.id;
    if (!canSpectate) {
      this.rejectSocket(socket, 'NOT_A_PLAYER', 'Only friends of the players can watch this game.');
      return;
    }
    if (room.status !== 'PLAYING' && room.status !== 'FINISHED') {
      this.rejectSocket(socket, 'NOT_A_PLAYER', 'This game is not in progress.');
      return;
    }
    const now = Date.now();
    const joins = (this.spectatorJoins.get(user.id) || []).filter(t => now - t < 60_000);
    if (joins.length >= SPECTATOR_JOINS_PER_MIN) {
      this.spectatorJoins.set(user.id, joins);
      this.sendRaw(socket, { type: 'error:notification', payload: { code: 'RATE_LIMITED', message: 'Too many watch attempts. Try again shortly.' } });
      try { socket.close(4429, 'RATE_LIMITED'); } catch {}
      return;
    }
    joins.push(now);
    this.spectatorJoins.set(user.id, joins);

    let set = this.roomSpectators.get(roomId);
    if (!set) {
      set = new Set();
      this.roomSpectators.set(roomId, set);
    }
    // a newer socket of the same spectator replaces the older one
    for (const existing of Array.from(set)) {
      if (existing.userId === user.id) {
        existing.superseded = true;
        set.delete(existing);
        try { existing.socket.close(); } catch {}
      }
    }
    if (set.size >= MAX_SPECTATORS) {
      this.rejectSocket(socket, 'SPECTATOR_LIMIT', 'This game has reached its spectator limit.');
      if (set.size === 0) this.roomSpectators.delete(roomId);
      return;
    }

    const client: ConnectedGameClient = {
      socket, userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, roomId, isAlive: true, spectator: true
    };
    set.add(client);
    this.roomGameTypes.set(roomId, room.gameType);

    const theme = this.roomThemes.get(roomId) || room.theme || 'romantic';
    // user.id is not a player, so the projection is the public (non-player) view
    const syncRoom: any = this.projectRoomFor({ ...room, theme, chatHistory: [] } as any, user.id);
    this.sendRaw(socket, {
      type: 'game:sync',
      roomId,
      payload: {
        role: 'spectator',
        spectatorCount: set.size,
        spectators: this.spectatorNames(roomId),
        room: syncRoom,
        theme,
        chatHistory: this.chatHistoryFor(roomId, null, true),
        myUserId: user.id,
        myPlayer: null
      }
    });
    this.broadcastSpectators(roomId);

    const guard = new SocketGuard(socket, { label: 'game-spectator', ratePerSec: 20, burst: 40 }, `${client.displayName} (${client.userId}) [spectator]`);
    socket.on('message', (data: any) => {
      if (client.superseded || client.left) return;
      const msg = guard.accept(data);
      if (!msg) return;
      try {
        this.handleSpectatorMessage(client, msg);
      } catch (err) {
        const code = err instanceof GameRuleError ? err.code : 'ACTION_FAILED';
        const message = err instanceof GameRuleError ? err.message : 'Action failed';
        this.sendRaw(client.socket, { type: 'game:error', roomId, payload: { code, message, action: msg.type } });
      }
    });
    socket.on('close', () => this.detachSpectator(client));
  }

  private detachSpectator(client: ConnectedGameClient): void {
    const set = this.roomSpectators.get(client.roomId);
    const had = Boolean(set && set.delete(client));
    if (set && set.size === 0) this.roomSpectators.delete(client.roomId);
    if (had && !client.superseded) this.broadcastSpectators(client.roomId);
  }

  /** Server-side gate for spectators: an allow-list; nothing else reaches the game handlers. */
  private handleSpectatorMessage(client: ConnectedGameClient, msg: any): void {
    if (!msg || typeof msg.type !== 'string') return;
    if (!SPECTATOR_ALLOWED.has(msg.type)) {
      throw new GameRuleError('SPECTATOR', 'Spectators can only watch.');
    }
    if (msg.type === 'game:leave') {
      client.left = true;
      this.detachSpectator(client);
      try { client.socket.close(); } catch {}
      return;
    }
    if (msg.type === 'game:reaction') {
      const emoji = msg.payload?.emoji;
      if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > REACTION_MAX_LEN || !/^[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]+$/u.test(emoji)) {
        throw new GameRuleError('INVALID_REACTION', 'Invalid reaction');
      }
      const now = Date.now();
      if (client.lastReactionTime && now - client.lastReactionTime < 1000) throw new GameRuleError('RATE_LIMITED', 'Slow down');
      client.lastReactionTime = now;
      this.broadcast(client.roomId, {
        type: 'game:reaction_broadcast',
        roomId: client.roomId,
        payload: { userId: client.userId, userName: client.displayName, emoji, timestamp: now, spectator: true }
      });
    }
    // heartbeat / ping: nothing to do
  }

  private sendRaw(socket: WebSocket, message: any): void {
    try {
      if ((socket as any).readyState === 1) socket.send(JSON.stringify(message));
    } catch {}
  }

  private rejectSocket(socket: WebSocket, code: string, message: string): void {
    this.sendRaw(socket, { type: 'error:notification', payload: { code, message } });
    try { socket.close(4403, code); } catch {}
  }

  /**
   * Per-viewer view of a room (GR-4): hides the doodle secret word / word choices from non-drawers and the other
   * players' Bingo boards / Tambola tickets and draw order. Pure: never mutates `room`.
   */
  public projectRoomFor<T extends { gameType: string; gameState?: any }>(room: T, viewerId: string | null | undefined): T {
    if (!room || !room.gameState) return room;
    return { ...room, gameState: this.projectStateFor(room.gameType, room.gameState, viewerId) };
  }

  public projectStateFor(gameType: string, state: any, viewerId: string | null | undefined): any {
    if (!state) return state;
    if (gameType === 'doodle-duel') return DoodleDuelEngine.publicStateFor(state, viewerId);
    if (gameType === 'bingo' || gameType === 'tambola') return this.publicBingoState(gameType, state, viewerId);
    if (gameType === 'imposter') return ImposterEngine.publicStateFor(state, viewerId);
    if (gameType === 'emoji-charades') return EmojiCharadesEngine.publicStateFor(state, viewerId);
    if (gameType === 'mafia-night') return MafiaNightEngine.publicStateFor(state, viewerId);
    if (gameType === 'quiz-show') return QuizShowEngine.publicStateFor(state, viewerId);
    if (gameType === 'murder-mystery') return MurderMysteryEngine.publicStateFor(state, viewerId);
    if (gameType === 'tournament') return TournamentEngine.publicStateFor(state, viewerId, this.clock());
    return state;
  }

  /** True when a state still carries information that must not reach everyone (not yet projected). */
  private stateNeedsProjection(gameType: string, state: any): boolean {
    if (!state || typeof state !== 'object') return false;
    if (gameType === 'doodle-duel') return state.secretWord !== undefined || state.wordChoices !== undefined;
    if (gameType === 'bingo') return state.boards && Object.keys(state.boards).length > 1;
    if (gameType === 'imposter') return ImposterEngine.isServerState(state);
    if (gameType === 'emoji-charades') return EmojiCharadesEngine.isServerState(state);
    if (gameType === 'mafia-night') return MafiaNightEngine.isServerState(state);
    if (gameType === 'quiz-show') return QuizShowEngine.isServerState(state);
    if (gameType === 'murder-mystery') return MurderMysteryEngine.isServerState(state);
    if (gameType === 'tournament') return TournamentEngine.isServerState(state);
    if (gameType === 'tambola') return (Array.isArray(state.callQueue) && state.callQueue.length > 0) || (state.tickets && Object.keys(state.tickets).length > 1);
    return false;
  }

  private handleClientMessage(client: ConnectedGameClient, msg: any): void {
    if (!msg || !msg.type) return;
    // Spectators never reach the game handlers (they have their own dispatcher; defence in depth)
    if (client.spectator) return this.handleSpectatorMessage(client, msg);

    switch (msg.type) {
      case 'game:roll_dice':
        this.runBoardAction(client, msg.type, () => this.handleRollDice(client.roomId, client.userId));
        break;

      case 'game:move_token':
        this.runBoardAction(client, msg.type, () => this.handleMoveToken(client.roomId, client.userId, msg.payload?.tokenId));
        break;

      case 'game:rematch':
        this.handleRematch(client.roomId, client.userId);
        break;

      case 'game:rematch_decline':
        this.handleRematchDecline(client.roomId, client.userId);
        break;

      case 'game:nudge': {
        const roast = String(msg.payload?.message || '').slice(0, 200) || 'Rematch accept karle, haarne se kyu darr raha hai?';
        this.broadcast(client.roomId, {
          type: 'game:player_nudged',
          roomId: client.roomId,
          payload: {
            fromUserId: client.userId,
            fromDisplayName: client.displayName,
            message: roast,
            timestamp: Date.now()
          }
        });
        break;
      }

      case 'game:drop_disc':
        this.runBoardAction(client, msg.type, () => this.handleDropDisc(client.roomId, client.userId, this.parseBoardInt(msg.payload?.column ?? msg.payload?.col)));
        break;

      case 'game:tictactoe_move':
        this.runBoardAction(client, msg.type, () => this.handleTicTacToeMove(client.roomId, client.userId, this.parseBoardInt(msg.payload?.cellIndex ?? msg.payload?.cell)));
        break;

      case 'bingo:start':
      case 'tambola:start':
        this.handleBingoStart(client.roomId, client.userId, msg.payload?.config);
        break;

      case 'bingo:call_next':
      case 'tambola:call_next':
        this.handleBingoCallNext(client.roomId, client.userId);
        break;

      case 'bingo:toggle_pause':
      case 'tambola:toggle_pause':
        this.handleBingoTogglePause(client.roomId, client.userId);
        break;

      case 'bingo:next_round':
        this.handleBingoNextRound(client.roomId, client.userId);
        break;

      case 'bingo:claim':
      case 'tambola:claim':
        this.handleBingoClaim(client.roomId, client.userId, msg.payload?.condition);
        break;

      case 'bingo:mark':
      case 'tambola:mark':
        this.handleBingoMark(client.roomId, client.userId, Number(msg.payload?.number), msg.payload?.forceMark !== false);
        break;

      case 'bingo:set_board':
        this.handleBingoSetBoard(client.roomId, client.userId, msg.payload?.board);
        break;

      case 'bingo:select_number':
        this.handleBingoSelectNumber(client.roomId, client.userId, Number(msg.payload?.number));
        break;

      case 'bingo:config_update':
      case 'tambola:config_update':
        this.handleBingoConfigUpdate(client.roomId, client.userId, msg.payload?.config);
        break;

      case 'doodle:select_role':
        this.handleDoodleSelectRole(client.roomId, client.userId, msg.payload?.drawerUserId);
        break;

      case 'doodle:start':
        this.handleDoodleStart(client.roomId, client.userId, msg.payload?.config);
        break;

      case 'doodle:choose_word':
        this.handleDoodleChooseWord(client.roomId, client.userId, msg.payload?.word);
        break;

      case 'doodle:stroke':
        this.handleDoodleStroke(client.roomId, client.userId, msg.payload?.stroke);
        break;

      case 'doodle:live_draw':
        this.handleDoodleLiveDraw(client.roomId, client.userId, msg.payload?.liveStroke);
        break;

      case 'doodle:done_drawing':
        this.handleDoodleDoneDrawing(client.roomId, client.userId);
        break;

      case 'doodle:undo':
        this.handleDoodleUndo(client.roomId, client.userId);
        break;

      case 'doodle:clear':
        this.handleDoodleClear(client.roomId, client.userId);
        break;

      case 'doodle:guess':
        this.handleDoodleGuess(client.roomId, client.userId, msg.payload?.guess);
        break;

      case 'doodle:request_hint':
        this.handleDoodleRequestHint(client.roomId, client.userId);
        break;

      case 'doodle:config_update':
        this.handleDoodleConfigUpdate(client.roomId, client.userId, msg.payload?.config);
        break;

      case 'imposter:start':
        this.handleImposterStart(client.roomId, client.userId, msg.payload);
        break;

      case 'imposter:clue':
        this.handleImposterClue(client.roomId, client.userId, msg.payload);
        break;

      case 'imposter:ready':
        this.handleImposterReady(client.roomId, client.userId);
        break;

      case 'imposter:vote':
        this.handleImposterVote(client.roomId, client.userId, msg.payload);
        break;

      case 'imposter:guess':
        this.handleImposterGuess(client.roomId, client.userId, msg.payload);
        break;

      case 'emoji-charades:start':
        this.handleEmojiCharadesStart(client.roomId, client.userId, msg.payload);
        break;

      case 'emoji-charades:guess':
        this.handleEmojiCharadesGuess(client.roomId, client.userId, msg.payload);
        break;

      case 'mafia:start':
        this.handleMafiaStart(client.roomId, client.userId);
        break;

      case 'mafia:night_action':
        this.handleMafiaNightAction(client.roomId, client.userId, msg.payload);
        break;

      case 'mafia:ready':
        this.handleMafiaReady(client.roomId, client.userId);
        break;

      case 'mafia:vote':
        this.handleMafiaVote(client.roomId, client.userId, msg.payload);
        break;

      case 'murder-mystery:pick_case':
        this.handleMurderPickCase(client.roomId, client.userId, msg.payload);
        break;

      case 'murder-mystery:start':
        this.handleMurderStart(client.roomId, client.userId);
        break;

      case 'murder-mystery:next':
        this.handleMurderNext(client.roomId, client.userId);
        break;

      case 'murder-mystery:ready':
        this.handleMurderReady(client.roomId, client.userId);
        break;

      case 'murder-mystery:whisper':
        this.handleMurderWhisper(client.roomId, client.userId, msg.payload);
        break;

      case 'murder-mystery:share_clue':
        this.handleMurderShareClue(client.roomId, client.userId, msg.payload);
        break;

      case 'murder-mystery:accuse':
        this.handleMurderAccuse(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:start':
        this.handleQuizStart(client.roomId, client.userId);
        break;

      case 'quiz-show:edit':
        this.handleQuizEdit(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:answer':
        this.handleQuizAnswer(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:buzz':
        this.handleQuizBuzz(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:buzz_answer':
        this.handleQuizBuzzAnswer(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:judge':
        this.handleQuizJudge(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:control':
        this.handleQuizControl(client.roomId, client.userId, msg.payload);
        break;

      case 'quiz-show:rematch':
        this.handleQuizRematch(client.roomId, client.userId);
        break;

      case 'quiz-show:edit_again':
        this.handleQuizEditAgain(client.roomId, client.userId);
        break;

      case 'tournament:config':
        this.handleTournamentConfig(client.roomId, client.userId, msg.payload);
        break;

      case 'tournament:shuffle':
        this.handleTournamentShuffle(client.roomId, client.userId);
        break;

      case 'tournament:kick':
        this.handleTournamentKick(client.roomId, client.userId, msg.payload);
        break;

      case 'tournament:start':
        this.handleTournamentStart(client.roomId, client.userId);
        break;

      case 'tournament:advance':
        this.handleTournamentAdvance(client.roomId, client.userId, msg.payload);
        break;

      case 'tournament:end':
        this.handleTournamentEnd(client.roomId, client.userId);
        break;

      // Results come from the server game state of the match room only: nobody can submit one
      case 'tournament:report':
      case 'tournament:result':
      case 'tournament:set_winner':
        throw new GameRuleError('INVALID_INPUT', 'Results come from the game itself: nobody can report a winner');

      case 'chess:start':
        this.handleChessStart(client.roomId, client.userId, msg.payload?.config);
        break;

      case 'chess:move':
        this.handleChessMove(client.roomId, client.userId, msg.payload?.from, msg.payload?.to, msg.payload?.promotion);
        break;

      case 'chess:resign':
        this.handleChessResign(client.roomId, client.userId);
        break;

      case 'chess:offer_draw':
        this.handleChessOfferDraw(client.roomId, client.userId);
        break;

      case 'chess:draw_response':
        this.handleChessDrawResponse(client.roomId, client.userId, Boolean(msg.payload?.accept));
        break;

      case 'chess:request_takeback':
        this.handleChessRequestTakeback(client.roomId, client.userId);
        break;

      case 'chess:takeback_response':
        this.handleChessTakebackResponse(client.roomId, client.userId, Boolean(msg.payload?.accept));
        break;

      case 'chess:config_update':
        this.handleChessConfigUpdate(client.roomId, client.userId, msg.payload?.config);
        break;

      case 'game:chat': {
        // Emoji Charades: a player who already solved the puzzle must not be able to hand the answer to the others in the chat
        if (this.emojiCharadesChatLocked(client.roomId, client.userId)) {
          throw new GameRuleError('CHAT_LOCKED', 'Chat is locked until the round ends, so you cannot give the answer away');
        }
        // Quiz Show Studio: the player whose buzzer answer window is open cannot chat (a typed message could leak the answer)
        if (this.quizChatLocked(client.roomId, client.userId)) {
          throw new GameRuleError('CHAT_LOCKED', 'Chat is locked while you are answering');
        }
        // Mafia Night: the channel (town / mafia / graveyard) is decided by the server from the phase and the sender's state
        const mafiaChannel = this.mafiaChannelFor(client.roomId, client.userId);
        if (mafiaChannel) this.mafiaRate(client.roomId, client.userId, 'chat', 6, 5000);
        const now = Date.now();
        if (client.lastChatMessageTime && now - client.lastChatMessageTime < 350) {
          break;
        }
        client.lastChatMessageTime = now;
        if (msg.payload?.content) {
          const chatMsg: any = {
            id: `gchat_${nanoid(8)}`,
            userId: client.userId,
            userName: client.displayName,
            avatarUrl: client.avatarUrl,
            content: String(msg.payload.content).slice(0, 1000),
            timestamp: now,
            replyTo: msg.payload?.replyTo ? {
              id: String(msg.payload.replyTo.id).slice(0, 64),
              userName: String(msg.payload.replyTo.userName || 'Player').slice(0, 60),
              content: String(msg.payload.replyTo.content || '').slice(0, 300)
            } : null
          };

          let history = this.roomChatHistory.get(client.roomId);
          if (!history) {
            history = [];
            this.roomChatHistory.set(client.roomId, history);
          }
          if (mafiaChannel) chatMsg.channel = mafiaChannel;
          history.push(chatMsg);
          if (history.length > (mafiaChannel ? 150 : 50)) history.shift();

          const chatOut = {
            type: 'game:chat_message',
            roomId: client.roomId,
            payload: chatMsg
          };
          if (mafiaChannel) this.sendToMafiaAudience(client.roomId, mafiaChannel, chatOut);
          else this.broadcast(client.roomId, chatOut);
        }
        break;
      }

      case 'game:change_theme': {
        const theme = String(msg.payload?.theme || 'romantic').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'romantic';
        this.roomThemes.set(client.roomId, theme);
        const r = this.db.getGameRoomById(client.roomId);
        if (r) r.theme = theme;
        this.broadcast(client.roomId, {
          type: 'game:theme_changed',
          roomId: client.roomId,
          payload: { theme }
        });
        break;
      }

      case 'game:typing': {
        // Mafia Night: a typing signal only goes to the people who could read the message (it must not show who is awake)
        const typingChannel = (() => { try { return this.mafiaChannelFor(client.roomId, client.userId); } catch { return 'blocked' as const; } })();
        if (typingChannel === 'blocked') break;
        if (typingChannel) {
          this.sendToMafiaAudience(client.roomId, typingChannel, {
            type: 'game:typing',
            roomId: client.roomId,
            payload: { userId: client.userId, userName: client.displayName, isTyping: Boolean(msg.payload?.isTyping) }
          }, client.userId);
          break;
        }
        this.broadcast(client.roomId, {
          type: 'game:typing',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            userName: client.displayName,
            isTyping: Boolean(msg.payload?.isTyping)
          }
        }, client.userId); // broadcast to other participants in room
        break;
      }

      case 'game:reaction': {
        // Only a short string of emoji glyphs is relayed: objects / long strings / markup crash or spam every client (GR-9)
        const emoji = msg.payload?.emoji;
        if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > REACTION_MAX_LEN || !/^[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]+$/u.test(emoji)) {
          throw new GameRuleError('INVALID_REACTION', 'Invalid reaction');
        }
        const reactionOut = {
          type: 'game:reaction_broadcast',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            userName: client.displayName,
            emoji,
            timestamp: Date.now()
          }
        };
        // Mafia Night: reactions follow the same channel rules as chat (a reaction at night would show who is awake)
        const reactionChannel = this.mafiaChannelFor(client.roomId, client.userId);
        if (reactionChannel === 'mafia') throw new GameRuleError('CHAT_LOCKED', 'The town is asleep');
        if (reactionChannel) this.sendToMafiaAudience(client.roomId, reactionChannel, reactionOut);
        else this.broadcast(client.roomId, reactionOut);
        break;
      }

      case 'webrtc:signal':
      case 'voice:signal':
        // Only relay inside the sender's own room (never to an arbitrary connected user)
        if (
          typeof msg.payload?.targetUserId === 'string' &&
          msg.payload?.signal &&
          this.liveClient(client.roomId, msg.payload.targetUserId)
        ) {
          this.sendToUser(msg.payload.targetUserId, {
            type: 'webrtc:signal',
            roomId: client.roomId,
            payload: {
              fromUserId: client.userId,
              signal: msg.payload.signal
            }
          });
        }
        break;

      case 'voice:state':
        this.broadcast(client.roomId, {
          type: 'voice:state',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            isMuted: Boolean(msg.payload?.isMuted)
          }
        }, client.userId);
        break;

      case 'camera:state':
        this.broadcast(client.roomId, {
          type: 'camera:state',
          roomId: client.roomId,
          payload: {
            userId: client.userId,
            isCameraOn: Boolean(msg.payload?.isCameraOn)
          }
        }, client.userId);
        break;

      case 'game:leave':
        this.handleClientLeave(client);
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Leaving / disconnecting (LU-1, LU-2, LU-3, LU-5, LU-17, GR-1, GR-2, GR-7, GR-11, GR-13, GR-14, GR-15)
  // ---------------------------------------------------------------------

  /** Removes a client from every in-memory index (only the entries that still point at this very client). */
  private detach(client: ConnectedGameClient): void {
    const set = this.roomClients.get(client.roomId);
    if (set) {
      set.delete(client);
      if (set.size === 0) this.roomClients.delete(client.roomId);
    }
    const key = `${client.roomId}:${client.userId}`;
    if (this.roomUserClients.get(key) === client) this.roomUserClients.delete(key);
    if (this.userClients.get(client.userId) === client) {
      this.userClients.delete(client.userId);
      // fall back to another live session of the same user in a different room
      for (const other of this.roomUserClients.values()) {
        if (other.userId === client.userId && !other.superseded && !other.left && other.socket.readyState === 1) {
          this.userClients.set(client.userId, other);
          break;
        }
      }
    }
  }

  private hasPendingGrace(roomId: string, userId: string): boolean {
    return this.disconnectGraceTimers.has(`${roomId}:${userId}`);
  }

  private expiredDisconnects = new Map<string, string>(); // `${roomId}:${userId}` -> displayName

  private handleClientLeave(client: ConnectedGameClient): void {
    if (client.superseded || client.left) return; // LU-17: one departure, one broadcast
    client.left = true;
    const key = `${client.roomId}:${client.userId}`;
    const timer = this.disconnectGraceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.disconnectGraceTimers.delete(key);
    }
    this.expiredDisconnects.delete(key);
    this.detach(client);
    this.db.setGamePlayerConnected(client.roomId, client.userId, false);
    this.applyDeparture(client.roomId, client.userId, client.displayName, 'LEFT');
  }

  private handleClientDisconnection(client: ConnectedGameClient): void {
    // A replaced socket, or one that already left explicitly, must not forfeit anything (LU-1 / GR-2 / LU-17)
    if (client.superseded || client.left) {
      this.detach(client);
      return;
    }
    const key = `${client.roomId}:${client.userId}`;
    const current = this.roomUserClients.get(key);
    if (current && current !== client) {
      this.detach(client);
      return;
    }
    this.detach(client);
    this.db.setGamePlayerConnected(client.roomId, client.userId, false);

    const room = this.db.getGameRoomById(client.roomId);
    if (!room || !room.players.some(p => p.userId === client.userId && p.status !== 'LEFT')) return;
    if (room.gameType === 'imposter') this.imposterSetConnected(client.roomId, client.userId, false); // their turn / vote is skipped while away
    if (room.gameType === 'emoji-charades') this.emojiCharadesSetConnected(client.roomId, client.userId, false); // they score nothing while away
    if (room.gameType === 'mafia-night') this.mafiaSetConnected(client.roomId, client.userId, false); // their vote is no longer waited for while they are away
    if (room.gameType === 'quiz-show') this.quizSetConnected(client.roomId, client.userId, false); // the quiz no longer waits for their answer
    if (room.gameType === 'murder-mystery') this.murderSetConnected(client.roomId, client.userId, false); // the round no longer waits for them to be ready
    if (room.gameType === 'tournament') this.tournamentSetConnected(client.roomId, client.userId, false); // shown as away: their match does not wait for the tournament page
    const graceMs = room.status === 'PLAYING' || room.status === 'READY' ? this.graceMsPlaying : this.graceMsWaiting;

    const prev = this.disconnectGraceTimers.get(key);
    if (prev) clearTimeout(prev);
    const graceTimer = setTimeout(() => {
      this.disconnectGraceTimers.delete(key);
      this.onGraceExpired(client.roomId, client.userId, client.displayName);
    }, graceMs);
    (graceTimer as any).unref?.();
    this.disconnectGraceTimers.set(key, graceTimer);

    // Broadcast disconnected alert to other players
    this.broadcast(client.roomId, {
      type: 'game:player_disconnected',
      roomId: client.roomId,
      payload: {
        userId: client.userId,
        displayName: client.displayName,
        graceSeconds: Math.round(graceMs / 1000)
      }
    });
  }

  /** The reconnect window of a user ran out (and nobody re-registered for that user in that room). */
  private onGraceExpired(roomId: string, userId: string, displayName: string): void {
    if (this.liveClient(roomId, userId)) return; // reconnected in the meantime
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    const me = room.players.find(p => p.userId === userId);
    if (!me || me.status === 'LEFT') return;
    const key = `${roomId}:${userId}`;
    // A tournament player who is away from the tournament page (playing a match in its own room, or just offline) has NOT left: a match they
    // never open is lost by the no-show rule, and only an explicit leave removes them from the bracket
    if (room.gameType === 'tournament' && room.status === 'PLAYING') return;

    if (room.status === 'PLAYING' || room.status === 'READY') {
      const others = room.players.filter(p => p.userId !== userId && p.status !== 'LEFT');
      const anyOtherLive = others.some(p => this.liveClient(roomId, p.userId));
      if (!anyOtherLive && others.length > 0) {
        // Nobody is present. If another absent player is still inside his own reconnect window, wait for him (GR-11).
        if (others.some(p => this.hasPendingGrace(roomId, p.userId))) {
          this.expiredDisconnects.set(key, displayName);
          return;
        }
        // Everybody is gone: abandon the match without declaring a winner
        for (const p of room.players) {
          this.db.setGamePlayerStatus(roomId, p.userId, 'LEFT');
          this.expiredDisconnects.delete(`${roomId}:${p.userId}`);
        }
        this.finishRoomWithoutWinner(room, 'Game abandoned: all players disconnected.');
        return;
      }
    }
    this.expiredDisconnects.delete(key);
    this.applyDeparture(roomId, userId, displayName, 'DISCONNECTED');
  }

  /** When a player returns, absent players whose reconnect window already ran out are settled now (they were waiting for someone to be present). */
  private settleExpiredDisconnects(roomId: string): void {
    for (const [key, name] of Array.from(this.expiredDisconnects.entries())) {
      if (!key.startsWith(`${roomId}:`)) continue;
      const userId = key.slice(roomId.length + 1);
      this.expiredDisconnects.delete(key);
      if (this.liveClient(roomId, userId)) continue;
      this.applyDeparture(roomId, userId, name, 'DISCONNECTED');
    }
  }

  private stopRoomTimers(roomId: string): void {
    this.stopBingoAutoCall(roomId);
    this.stopDoodleTimer(roomId);
    this.stopChessClock(roomId);
    this.stopLudoTurnTimer(roomId);
    this.stopImposterTimer(roomId);
    this.stopEmojiCharadesTimer(roomId);
    this.stopMafiaTimer(roomId);
    this.stopQuizTimer(roomId);
    this.stopMurderTimer(roomId);
    this.stopTournamentTimer(roomId);
  }

  private finishRoomWithoutWinner(room: GameRoom, message: string): void {
    this.stopRoomTimers(room.id);
    if (room.gameType === 'imposter' && room.gameState && ImposterEngine.isServerState(room.gameState)) {
      ImposterEngine.abort(room.gameState as ImposterServerState, message);
    }
    if (room.gameType === 'emoji-charades' && room.gameState && EmojiCharadesEngine.isServerState(room.gameState)) {
      EmojiCharadesEngine.abort(room.gameState as EmojiCharadesServerState, message);
    }
    if (room.gameType === 'mafia-night' && room.gameState && MafiaNightEngine.isServerState(room.gameState)) {
      MafiaNightEngine.abort(room.gameState as MafiaServerState, message);
    }
    if (room.gameType === 'quiz-show' && room.gameState && QuizShowEngine.isServerState(room.gameState)) {
      QuizShowEngine.abort(room.gameState as QuizServerState, message);
    }
    if (room.gameType === 'murder-mystery' && room.gameState && MurderMysteryEngine.isServerState(room.gameState)) {
      MurderMysteryEngine.abort(room.gameState as MurderServerState, message);
    }
    this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, new Date().toISOString());
    if (room.gameState && typeof room.gameState === 'object') {
      room.gameState.statusMessage = message;
      this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat);
    }
    room.status = 'FINISHED';
    this.rematchVotes.delete(room.id);
    this.cleanupRoomMemoryIfEmpty(room.id);
  }

  private cleanupRoomMemoryIfEmpty(roomId: string): void {
    if (this.roomClients.has(roomId)) return;
    const room = this.db.getGameRoomById(roomId);
    if (room && (room.status === 'FINISHED' || room.status === 'CANCELLED')) {
      this.roomChatHistory.delete(roomId);
      this.roomThemes.delete(roomId);
      this.roomConfigs.delete(roomId);
      this.rematchVotes.delete(roomId);
      this.roomGameCounts.delete(roomId);
      this.roomGameTypes.delete(roomId);
    }
  }

  /** Mutates `room.gameState` so that `winner` wins because `leaverName` left. */
  private applyForfeitState(room: GameRoom, winner: GameRoomPlayer, leaverName: string): void {
    const gs: any = room.gameState;
    this.stopRoomTimers(room.id);
    if (!gs) return;
    if (room.gameType === 'ludo') {
      gs.winnerColor = winner.color;
      gs.winnerUserId = winner.userId;
      gs.statusMessage = leftGameWinMessage(leaverName);
      this.db.updateGameRoomState(room.id, gs, gs.currentTurnSeat, winner.seat);
    } else if (room.gameType === 'four-in-a-row') {
      gs.winner = winner.color === 'red' ? 'R' : 'Y';
      gs.winnerColor = winner.color;
      gs.winnerUserId = winner.userId;
      gs.statusMessage = leftGameWinMessage(leaverName);
      this.db.updateGameRoomState(room.id, gs, gs.currentTurnSeat, winner.seat);
    } else if (room.gameType === 'tic-tac-toe') {
      gs.winner = winner.seat === 0 ? 'X' : 'O';
      gs.winnerUserId = winner.userId;
      gs.statusMessage = leftGameWinMessage(leaverName);
      this.db.updateGameRoomState(room.id, gs, gs.currentTurnSeat, winner.seat);
    } else if (room.gameType === 'bingo' || room.gameType === 'doodle-duel') {
      gs.phase = 'FINISHED';
      gs.winnerUserId = winner.userId;
      gs.winnerDisplayName = winner.displayName;
      if (room.gameType === 'doodle-duel') {
        // DD-13: the victory screen reads finalWinner*; a forfeit always has a winner
        gs.finalWinnerUserId = winner.userId;
        gs.finalWinnerDisplayName = winner.displayName;
        gs.forfeit = true;
      }
      gs.statusMessage = leftGameWinMessage(leaverName);
      this.db.updateGameRoomState(room.id, gs, 0, winner.seat);
    } else if (room.gameType === 'tambola') {
      // TA-14: a 2-player tambola forfeit needs a real finished state with a winner
      gs.phase = 'FINISHED';
      gs.winnerUserId = winner.userId;
      gs.winnerDisplayName = winner.displayName;
      gs.gameSummary = {
        finalScores: { ...(gs.scores || {}) },
        roundsWon: [],
        ...(gs.gameSummary || {}),
        winnerUserId: winner.userId,
        winnerDisplayName: winner.displayName,
        forfeit: true
      };
      gs.statusMessage = leftGameWinMessage(leaverName);
      this.db.updateGameRoomState(room.id, gs, 0, winner.seat);
    } else if (room.gameType === 'chess') {
      gs.status = 'ABANDONED';
      gs.winnerUserId = winner.userId;
      gs.winnerDisplayName = winner.displayName;
      gs.winnerColor = winner.userId === gs.whitePlayer.userId ? 'w' : 'b';
      gs.winnerReason = 'Opponent Left';
      gs.statusMessage = leftGameWinMessage(leaverName);
      this.db.updateGameRoomState(room.id, gs, 0, winner.seat);
    } else {
      this.db.updateGameRoomState(room.id, gs, gs.currentTurnSeat, winner.seat);
    }
  }

  /**
   * THE single place where a player's departure (explicit leave or expired reconnect window) is applied and broadcast.
   *  - WAITING room: the seat is freed, the host is transferred, an empty room is cancelled.
   *  - PLAYING room: the seat is marked LEFT; with one active player left that player wins by forfeit; in 3-4 player games
   *    the seat is eliminated (skipped) and the game goes on.
   *  - FINISHED room: nothing about the result changes (GR-1 / LU-2); the player is only marked LEFT and rematch votes are reset.
   * A player already marked LEFT is ignored, so a leave followed by the socket close never broadcasts twice (LU-17).
   */
  private applyDeparture(roomId: string, userId: string, displayName: string, reason: 'LEFT' | 'DISCONNECTED'): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    const me = room.players.find(p => p.userId === userId);
    if (!me || me.status === 'LEFT') return;

    // Host transfer helper (earliest remaining active seat; prefer someone who is connected)
    const transferHost = (): string => {
      if (room.hostUserId !== userId) return room.hostUserId;
      if (room.gameType === 'quiz-show') return room.hostUserId; // the quiz master cannot be handed over: the quiz ends (or the lobby closes) instead
      if (room.gameType === 'tournament') return room.hostUserId; // the organiser cannot be handed over: the tournament ends (or the lobby closes) instead
      const candidates = room.players.filter(p => p.userId !== userId && p.status !== 'LEFT').sort((a, b) => a.seat - b.seat);
      const next = candidates.find(p => this.liveClient(roomId, p.userId)) || candidates[0];
      if (next) {
        this.db.updateGameRoomHost(roomId, next.userId);
        room.hostUserId = next.userId;
      }
      return room.hostUserId;
    };

    // A tournament match room that has not started: the two seats belong to the two players and are never freed
    if (room.status === 'WAITING' && room.tournamentId) {
      this.applyLinkedWaitingDeparture(room, me, displayName, reason);
      return;
    }

    if (room.status === 'WAITING' && (room.gameType === 'quiz-show' || room.gameType === 'tournament') && userId === room.hostUserId) {
      // The quiz master / tournament organiser left the lobby: nobody else can run it, so the room closes
      this.db.removePlayerFromGameRoom(roomId, userId);
      room.players = room.players.filter(p => p.userId !== userId);
      this.db.updateGameRoomStatus(roomId, 'CANCELLED', undefined, new Date().toISOString());
      room.status = 'CANCELLED';
      this.broadcast(roomId, {
        type: 'game:player_left',
        roomId,
        payload: { userId, displayName, reason, isWinner: false, hostUserId: userId, totalPlayers: room.players.length, roomClosed: true }
      });
      this.cleanupRoomMemoryIfEmpty(roomId);
      return;
    }

    if (room.status === 'WAITING') {
      this.db.removePlayerFromGameRoom(roomId, userId);
      room.players = room.players.filter(p => p.userId !== userId);
      const hostUserId = transferHost();
      if (room.players.length === 0) {
        this.db.updateGameRoomStatus(roomId, 'CANCELLED', undefined, new Date().toISOString());
        room.status = 'CANCELLED';
      }
      this.broadcast(roomId, {
        type: 'game:player_left',
        roomId,
        payload: { userId, displayName, reason, isWinner: false, hostUserId, totalPlayers: room.players.length }
      });
      this.cleanupRoomMemoryIfEmpty(roomId);
      return;
    }

    this.db.setGamePlayerStatus(roomId, userId, 'LEFT');
    me.status = 'LEFT';
    const hostUserId = transferHost();

    if (this.rematchVotes.has(roomId)) {
      this.rematchVotes.delete(roomId);
      this.broadcast(roomId, {
        type: 'game:rematch_declined',
        roomId,
        payload: {
          declinerId: userId,
          declinerName: displayName,
          reason: 'opponent_left',
          message: `${displayName} left the game.`
        }
      });
    }

    const base = { userId, displayName, reason, hostUserId, forfeitMessage: leftGameWinMessage(displayName) };

    if (room.status !== 'PLAYING' && room.status !== 'READY') {
      // Game already over (or never started): the result must not change
      this.broadcast(roomId, {
        type: 'game:player_left',
        roomId,
        payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, gameState: room.gameState }
      });
      this.cleanupRoomMemoryIfEmpty(roomId);
      return;
    }

    if (room.gameType === 'imposter') {
      this.applyImposterDeparture(room, userId, base);
      return;
    }
    if (room.gameType === 'emoji-charades') {
      this.applyEmojiCharadesDeparture(room, userId, base);
      return;
    }
    if (room.gameType === 'mafia-night') {
      this.applyMafiaDeparture(room, userId, base);
      return;
    }
    if (room.gameType === 'quiz-show') {
      this.applyQuizDeparture(room, userId, base);
      return;
    }
    if (room.gameType === 'murder-mystery') {
      this.applyMurderDeparture(room, userId, base);
      return;
    }
    if (room.gameType === 'tournament') {
      this.applyTournamentDeparture(room, userId, base);
      return;
    }

    const active = room.players.filter(p => p.status !== 'LEFT');
    if (active.length === 1 && BOT_USER_IDS.has(active[0].userId)) {
      // DD-14: a bot never "wins by forfeit"; the practice game is just over
      this.finishRoomWithoutWinner(room, `${displayName} left the game.`);
      this.broadcast(roomId, {
        type: 'game:player_left',
        roomId,
        payload: { ...base, isWinner: false, winnerUserId: null, winnerDisplayName: null, winnerColor: null, gameState: room.gameState }
      });
      return;
    }
    if (active.length === 1) {
      const winner = active[0];
      this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, new Date().toISOString());
      room.status = 'FINISHED';
      this.applyForfeitState(room, winner, displayName);
      this.broadcast(roomId, {
        type: 'game:player_left',
        roomId,
        payload: {
          ...base,
          isWinner: true,
          winnerUserId: winner.userId,
          winnerDisplayName: winner.displayName,
          winnerColor: winner.color,
          gameState: room.gameState
        }
      });
      this.cleanupRoomMemoryIfEmpty(roomId);
      return;
    }
    if (active.length === 0) {
      this.finishRoomWithoutWinner(room, 'Game abandoned: all players left.');
      return;
    }

    // 3+ seat game continues without the leaver: skip that seat (LU-3 / GR-14)
    this.eliminateSeat(room, me);
    this.broadcast(roomId, {
      type: 'game:player_left',
      roomId,
      payload: {
        ...base,
        isWinner: false,
        winnerUserId: null,
        winnerDisplayName: null,
        winnerColor: null,
        eliminatedSeat: me.seat,
        gameState: room.gameState
      }
    });
  }

  /** Removes a departed seat from the turn rotation of a multi-seat game and persists the result. */
  private eliminateSeat(room: GameRoom, player: GameRoomPlayer): void {
    const gs: any = room.gameState;
    if (!gs) return;
    if (room.gameType === 'ludo') {
      const eliminated: number[] = Array.isArray(gs.eliminatedSeats) ? gs.eliminatedSeats : [];
      if (!eliminated.includes(player.seat)) eliminated.push(player.seat);
      gs.eliminatedSeats = eliminated;
      if (gs.currentTurnSeat === player.seat) {
        // pass the turn to the next seat that is still in the game
        let seat = gs.currentTurnSeat;
        for (let i = 0; i < gs.playersCount; i++) {
          seat = (seat + 1) % gs.playersCount;
          if (!eliminated.includes(seat) && gs.seats?.[seat]) break;
        }
        const next = gs.seats?.[seat];
        if (next) {
          gs.currentTurnSeat = seat;
          gs.currentTurnColor = next.color;
          gs.canRoll = true;
          gs.legalMoves = [];
          gs.consecutiveSixes = 0;
          gs.statusMessage = `${player.displayName} left the game. ${next.displayName}'s turn!`;
        }
      }
      this.db.updateGameRoomState(room.id, gs, gs.currentTurnSeat);
      this.scheduleLudoTurnTimer(room.id);
    }
    // Tambola: a departed player simply stops participating; claims are validated against active players by its handlers.
  }

  /** Cancels abandoned lobbies and releases seats that were taken over REST but never connected (GR-7, GR-12, GR-27). */
  public sweepStaleRooms(now = Date.now()): void {
    try {
      const cutoff = new Date(now - GHOST_SEAT_TTL_MS).toISOString();
      for (const id of this.db.listWaitingGameRoomIds(cutoff)) {
        const room = this.db.getGameRoomById(id);
        if (!room || room.status !== 'WAITING') continue;
        for (const p of room.players) {
          const joinedAt = Date.parse(p.joinedAt);
          if (!this.liveClient(id, p.userId) && !this.hasPendingGrace(id, p.userId) && Number.isFinite(joinedAt) && now - joinedAt > GHOST_SEAT_TTL_MS) {
            this.applyDeparture(id, p.userId, p.displayName, 'DISCONNECTED');
          }
        }
        const fresh = this.db.getGameRoomById(id);
        if (fresh && fresh.status === 'WAITING' && !this.roomClients.has(id) && now - Date.parse(fresh.createdAt) > STALE_WAITING_ROOM_TTL_MS) {
          this.db.updateGameRoomStatus(id, 'CANCELLED', undefined, new Date().toISOString());
          this.cleanupRoomMemoryIfEmpty(id);
        }
      }
      // GR-27: abandoned PLAYING rooms (e.g. everyone gone after a restart) are closed, old finished rows are purged
      if (now - BOOT_TIME > BOOT_GRACE_MS) {
        for (const id of this.db.listPlayingGameRoomIds(new Date(now - ABANDONED_PLAYING_ROOM_TTL_MS).toISOString())) {
          if (this.roomClients.get(id)?.size) continue;
          const room = this.db.getGameRoomById(id);
          if (!room || room.status !== 'PLAYING') continue;
          if (room.gameType === 'tournament') { this.sweepTournament(room, now); continue; }
          if (room.players.some(p => this.liveClient(id, p.userId) || this.hasPendingGrace(id, p.userId))) continue;
          this.db.updateGameRoomStatus(id, 'FINISHED', undefined, new Date(now).toISOString());
          this.stopChessClock(id);
          this.stopImposterTimer(id);
          this.stopEmojiCharadesTimer(id);
          this.stopMafiaTimer(id);
          this.stopQuizTimer(id);
          this.stopMurderTimer(id);
          this.cleanupRoomMemoryIfEmpty(id);
        }
      }
      this.db.purgeOldGameRooms(new Date(now - OLD_ROOM_RETENTION_MS).toISOString());
    } catch (err) {
      console.warn('[GameRoomManager] sweep failed:', String((err as any)?.message ?? err).slice(0, 120));
    }
  }

  public isUserOnline(userId: string): boolean {
    const client = this.userClients.get(userId);
    return Boolean(client && client.socket.readyState === 1);
  }

  /**
   * Sends to one user. If the message carries a `roomId` (or `roomId` is passed) it goes to the user's socket in THAT
   * room (a user may sit in several rooms, GR-13); otherwise to their most recent live session.
   */
  public sendToUser(userId: string, message: any, roomId?: string): boolean {
    const rid = roomId ?? (typeof message?.roomId === 'string' ? message.roomId : undefined);
    let client: ConnectedGameClient | undefined;
    if (rid) client = this.liveClient(rid, userId);
    if (!client) {
      const latest = this.userClients.get(userId);
      if (latest && latest.socket.readyState === 1 && (!rid || latest.roomId === rid)) client = latest;
    }
    if (client) {
      try {
        client.socket.send(JSON.stringify(this.messageForViewer(client.roomId, message, client.userId)));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Game type used to decide whether a payload needs per-recipient projection. If the room is not in the cache (e.g. after a
   * restart) an Imposter state is still recognised by its own marker, so the full state can never be sent as shared JSON.
   */
  private gameTypeForMessage(roomId: string, message: any): string | undefined {
    const cached = this.roomGameTypes.get(roomId);
    if (cached) return cached;
    const p = message?.payload;
    if (p && typeof p === 'object' && (p.gameState?.game === 'imposter' || p.room?.gameState?.game === 'imposter')) return 'imposter';
    if (p && typeof p === 'object' && (p.gameState?.game === 'emoji-charades' || p.room?.gameState?.game === 'emoji-charades')) return 'emoji-charades';
    if (p && typeof p === 'object' && (p.gameState?.game === 'mafia-night' || p.room?.gameState?.game === 'mafia-night')) return 'mafia-night';
    if (p && typeof p === 'object' && (p.gameState?.game === 'quiz-show' || p.room?.gameState?.game === 'quiz-show')) return 'quiz-show';
    if (p && typeof p === 'object' && (p.gameState?.game === 'murder-mystery' || p.room?.gameState?.game === 'murder-mystery')) return 'murder-mystery';
    if (p && typeof p === 'object' && (p.gameState?.game === 'tournament' || p.room?.gameState?.game === 'tournament')) return 'tournament';
    return undefined;
  }

  /** Per-recipient copy of `message` with any secret game state projected (GR-4). Returns `message` itself if nothing to hide. */
  private messageForViewer(roomId: string, message: any, viewerId: string): any {
    const gt = this.gameTypeForMessage(roomId, message);
    const p = message?.payload;
    if (!gt || !p || typeof p !== 'object') return message;
    let payload = p;
    if (p.gameState && this.stateNeedsProjection(gt, p.gameState)) {
      payload = { ...payload, gameState: this.projectStateFor(gt, p.gameState, viewerId) };
    }
    if (p.room && typeof p.room === 'object' && p.room.gameState && this.stateNeedsProjection(gt, p.room.gameState)) {
      payload = { ...payload, room: { ...p.room, gameState: this.projectStateFor(gt, p.room.gameState, viewerId) } };
    }
    return payload === p ? message : { ...message, payload };
  }

  public broadcast(roomId: string, message: any, excludeUserId?: string): void {
    const clients = this.allViewers(roomId);
    if (!clients.length) return;
    const gt = this.gameTypeForMessage(roomId, message);
    const p = message?.payload;
    const secret = Boolean(gt && p && typeof p === 'object' &&
      ((p.gameState && this.stateNeedsProjection(gt, p.gameState)) || (p.room?.gameState && this.stateNeedsProjection(gt, p.room.gameState))));
    const shared = secret ? null : JSON.stringify(message);
    for (const client of clients) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.socket.readyState === 1) {
        try {
          client.socket.send(shared ?? JSON.stringify(this.messageForViewer(roomId, message, client.userId)));
        } catch {}
      }
    }
  }
}
