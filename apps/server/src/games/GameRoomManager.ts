import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import {
  GameRoom,
  GameRoomPlayer,
  LudoColor,
  LudoGameState,
  GameRoomStatus,
  GameType,
  DoodleConfig
} from '@synccinema/common';
import { DatabaseService } from '../db/database.js';
import { GAME_DEFINITIONS } from './GameDefinitions.js';
import { LudoEngine } from './LudoEngine.js';
import { FourInARowEngine } from './FourInARowEngine.js';
import { TicTacToeEngine } from './TicTacToeEngine.js';
import { BingoEngine, DEFAULT_BINGO_CONFIG } from './BingoEngine.js';
import { BingoDuelEngine, DEFAULT_BINGO_DUEL_CONFIG } from './BingoDuelEngine.js';
import { DoodleDuelEngine, DEFAULT_DOODLE_CONFIG, DOODLE_WORDS } from './DoodleDuelEngine.js';
import { ChessEngine } from './ChessEngine.js';
import { DEFAULT_CHESS_CONFIG, ChessGameState } from '@synccinema/common';
import { mongoDb } from '../db/mongoDatabase.js';

interface ConnectedGameClient {
  socket: WebSocket;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  roomId: string;
  isAlive: boolean;
  lastChatMessageTime?: number;
}

export class GameRoomManager {
  private db: DatabaseService;
  // roomId -> Set of connected WebSocket clients
  private roomClients = new Map<string, Set<ConnectedGameClient>>();
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
  // roomId -> doodle timer
  private doodleTimers = new Map<string, NodeJS.Timeout>();
  // roomId -> chess clock ticker timer
  private chessTimers = new Map<string, NodeJS.Timeout>();

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Authoritative streak recorder: when a game is played or finishes between real users,
   * automatically record their daily friend streak in MongoDB.
   */
  public async recordGameStreaks(room: GameRoom): Promise<void> {
    if (!room || !room.players || room.players.length < 2) return;
    const realPlayers = room.players.filter(
      p => p.userId && !p.userId.startsWith('bot_') && !p.userId.startsWith('guest_')
    );
    if (realPlayers.length < 2) return;

    for (let i = 0; i < realPlayers.length; i++) {
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
    let prefix = 'LUDO';
    if (gameType.toLowerCase().includes('four') || gameType.toLowerCase().includes('connect')) {
      prefix = 'FOUR';
    } else if (gameType.toLowerCase().includes('tic')) {
      prefix = 'TIC';
    } else if (gameType.toLowerCase().includes('tambola') || gameType.toLowerCase().includes('housie')) {
      prefix = 'TAMBOLA';
    } else if (gameType.toLowerCase().includes('bingo')) {
      prefix = 'BINGO';
    } else if (gameType.toLowerCase().includes('doodle')) {
      prefix = 'DOODLE';
    } else if (gameType.toLowerCase().includes('chess')) {
      prefix = 'CHESS';
    } else {
      prefix = gameType.toUpperCase();
    }
    for (let i = 0; i < 10; i++) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${prefix}-${suffix}`;
      const existing = this.db.getGameRoomByCode(code);
      if (!existing) {
        return code;
      }
    }
    return `${prefix}-${nanoid(4).toUpperCase()}`;
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
  }): GameRoom {
    const def = GAME_DEFINITIONS[params.gameType];
    if (!def) {
      throw new Error(`Unsupported game type: ${params.gameType}`);
    }

    if (!def.playerOptions.includes(params.maxPlayers)) {
      throw new Error(`Invalid player count for ${def.name}. Choose from: ${def.playerOptions.join(', ')}`);
    }

    const roomCode = params.customCode
      ? params.customCode.trim().toUpperCase()
      : this.generateRoomCode(params.gameType);

    const roomId = `groom_${nanoid(12)}`;
    const colors = def.colorAssignments[params.maxPlayers];
    const hostColor = colors[0]; // Host always takes seat 0 (Red)

    const room: GameRoom = {
      id: roomId,
      roomCode,
      gameType: params.gameType,
      hostUserId: params.hostUser.id,
      maxPlayers: params.maxPlayers,
      minPlayers: params.maxPlayers, // STRICT: Requires full human quota before starting
      isPrivate: Boolean(params.isPrivate),
      status: 'WAITING',
      players: [],
      gameState: null,
      theme: 'romantic',
      createdAt: new Date().toISOString()
    };

    this.db.createGameRoom(room);
    const hostPlayer = this.db.addPlayerToGameRoom(roomId, params.hostUser, 0, hostColor);
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
    user: { id: string; displayName: string; avatarUrl?: string | null }
  ): GameRoom {
    const room = this.db.getGameRoomByCode(roomCode);
    if (!room) {
      throw new Error(`Room with code "${roomCode}" not found or has expired.`);
    }

    // Check if user is already in the room
    const existingPlayer = room.players.find(p => p.userId === user.id);
    if (existingPlayer) {
      // Rejoining own slot
      return room;
    }

    if (room.status !== 'WAITING') {
      throw new Error('This match has already started or ended. Cannot join.');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error(`Room is full (${room.players.length}/${room.maxPlayers} players).`);
    }

    const def = GAME_DEFINITIONS[room.gameType];
    const colors = def.colorAssignments[room.maxPlayers];

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
    const newPlayer = this.db.addPlayerToGameRoom(room.id, user, assignedSeat, assignedColor);
    room.players.push(newPlayer);

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
    if (room.players.length >= room.maxPlayers) {
      this.startGame(room);
    }

    return room;
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
        color: assignedColor
      };
    });

    const now = new Date().toISOString();
    let initialState: any;

    if (room.gameType === 'four-in-a-row') {
      initialState = FourInARowEngine.createInitialState(playerConfigs, 0);
    } else if (room.gameType === 'tic-tac-toe') {
      initialState = TicTacToeEngine.createInitialState(playerConfigs, 0);
    } else if (room.gameType === 'bingo') {
      this.stopBingoAutoCall(room.id);
      const config = (room as any).bingoConfig || DEFAULT_BINGO_DUEL_CONFIG;
      // Freshly shuffle 5x5 tickets/boards for all players on every start and rematch
      initialState = BingoDuelEngine.createInitialState(
        room.id,
        playerConfigs.map(p => p.userId),
        config
      );
    } else if (room.gameType === 'tambola') {
      this.stopBingoAutoCall(room.id);
      const config = (room as any).tambolaConfig || DEFAULT_BINGO_CONFIG;
      initialState = BingoEngine.createInitialState(playerConfigs, config);
      if (initialState.config?.autoCall) {
        BingoEngine.callNext(initialState);
      }
    } else if (room.gameType === 'doodle-duel') {
      this.stopDoodleTimer(room.id);
      const config = (room as any).doodleConfig || DEFAULT_DOODLE_CONFIG;
      initialState = DoodleDuelEngine.createInitialState(playerConfigs, config);
    } else if (room.gameType === 'chess') {
      this.stopChessClock(room.id);
      const config = (room as any).chessConfig || DEFAULT_CHESS_CONFIG;
      const p1 = playerConfigs[0];
      const p2 = playerConfigs[1];
      initialState = ChessEngine.initGameState(
        room.id,
        { id: p1.userId, displayName: p1.displayName },
        { id: p2.userId, displayName: p2.displayName },
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
    this.broadcast(room.id, {
      type: 'game:started',
      roomId: room.id,
      payload: {
        room,
        gameState: initialState,
        message: room.gameType === 'bingo'
          ? 'Bingo Duel started! Numbers calling...'
          : room.gameType === 'tambola'
            ? 'Tambola started! Numbers calling...'
            : 'All human players connected! Game starting now!'
      }
    });

    if (room.gameType === 'tambola' && initialState.config?.autoCall) {
      this.startBingoAutoCall(room.id, initialState.config.callingSpeed);
    } else if (room.gameType === 'chess') {
      this.startChessClock(room.id);
    }
  }

  /**
   * Handle Player Roll Dice Action
   */
  public handleRollDice(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = LudoEngine.rollDice(room.gameState, player.seat);
    this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);

    const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        gameState: result.state
      }
    });
  }

  /**
   * Handle Player Move Token Action
   */
  public handleMoveToken(roomId: string, userId: string, tokenId: number): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = LudoEngine.moveToken(room.gameState, player.seat, tokenId);

    if (result.isWinner) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, player.seat);
    } else {
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat);
    }

    const moveId = `move_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        reachedHome: result.reachedHome,
        earnedBonusRoll: result.earnedBonusRoll,
        isWinner: result.isWinner,
        winnerColor: result.state.winnerColor,
        winnerUserId: result.state.winnerUserId,
        gameState: result.state
      }
    });
  }

  /**
   * Handle Rematch Action (requires agreement from both players)
   */
  public handleRematch(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;

    if (!this.rematchVotes.has(roomId)) {
      this.rematchVotes.set(roomId, new Set());
    }
    const votes = this.rematchVotes.get(roomId)!;
    votes.add(userId);

    const totalNeeded = room.players.length;
    const votedUserIds = Array.from(votes);
    const allVoted = votes.size >= totalNeeded;
    const requester = room.players.find(p => p.userId === userId);

    // Broadcast rematch progress to all players in the room without kicking to waiting room
    this.broadcast(roomId, {
      type: 'game:rematch_status',
      roomId,
      payload: {
        requesterId: userId,
        requesterName: requester?.displayName || 'Opponent',
        votedUserIds,
        votedCount: votes.size,
        totalNeeded,
        allVoted
      }
    });

    // Only restart game when all connected players agree!
    if (allVoted) {
      this.rematchVotes.delete(roomId);
      this.broadcast(roomId, {
        type: 'game:rematch_agreed',
        roomId,
        payload: {
          message: 'Both players agreed! Rematch starting...'
        }
      });
      // Short delay for clean UI transition
      setTimeout(() => {
        const freshRoom = this.db.getGameRoomById(roomId);
        if (freshRoom) {
          if (freshRoom.gameState) {
            delete (freshRoom.gameState as any).boards;
            delete (freshRoom.gameState as any).playerMarks;
            delete (freshRoom.gameState as any).playerPicks;
          }
          this.startGame(freshRoom);
        }
      }, 500);
    }
  }

  /**
   * Handle Rematch Decline Action
   */
  public handleRematchDecline(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;

    this.rematchVotes.delete(roomId);
    const decliner = room.players.find(p => p.userId === userId);

    this.broadcast(roomId, {
      type: 'game:rematch_declined',
      roomId,
      payload: {
        declinerId: userId,
        declinerName: decliner?.displayName || 'Opponent',
        reason: 'declined',
        message: `${decliner?.displayName || 'Opponent'} declined the rematch request.`
      }
    });
  }

  /**
   * Handle Four In A Row Drop Disc Action
   */
  public handleDropDisc(roomId: string, userId: string, col: number): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = FourInARowEngine.dropDisc(
      room.gameState,
      player.seat,
      col,
      { userId: player.userId, displayName: player.displayName },
      room.players
    );

    if (result.isWinner) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, player.seat);
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
    if (!room || !room.gameState) {
      throw new Error('Game room or state not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not in this game room');
    }

    const result = TicTacToeEngine.makeMove(
      room.gameState,
      player.seat,
      cellIndex,
      { userId: player.userId, displayName: player.displayName },
      room.players
    );

    if (result.isWinner) {
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      this.db.updateGameRoomState(room.id, result.state, result.state.currentTurnSeat, player.seat);
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

  public startBingoAutoCall(roomId: string, speedMs: number): void {
    this.stopBingoAutoCall(roomId);
    const interval = Math.max(800, speedMs || 3000);

    // Call first number shortly after start (1000ms) so players see the first number right away
    setTimeout(() => {
      const room = this.db.getGameRoomById(roomId);
      if (room && room.status === 'PLAYING' && room.gameState && (room.gameType === 'bingo' || room.gameType === 'tambola')) {
        if (!room.gameState.currentNumber && room.gameState.calledNumbers.length === 0) {
          this.tickBingoAutoCall(roomId);
        }
      }
    }, 1000);

    const timer = setInterval(() => {
      this.tickBingoAutoCall(roomId);
    }, interval);
    this.bingoTimers.set(roomId, timer);
  }

  public stopBingoAutoCall(roomId: string): void {
    const existing = this.bingoTimers.get(roomId);
    if (existing) {
      clearInterval(existing);
      this.bingoTimers.delete(roomId);
    }
  }

  public tickBingoAutoCall(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) {
      this.stopBingoAutoCall(roomId);
      return;
    }

    if (room.gameState.callingPaused || room.gameState.phase === 'FINISHED' || room.gameState.phase === 'ROUND_OVER') {
      if (room.gameState.phase === 'FINISHED' || room.gameState.phase === 'ROUND_OVER') {
        this.stopBingoAutoCall(roomId);
      }
      return;
    }

    if (room.gameType === 'bingo') {
      const { state, calledNumber, isFinished } = BingoDuelEngine.callNext(room.gameState);
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      if (isFinished) {
        this.stopBingoAutoCall(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      }

      this.broadcast(room.id, {
        type: 'bingo:number_called',
        roomId: room.id,
        payload: {
          number: calledNumber,
          word: state.currentNumberWord,
          calledNumbers: state.calledNumbers,
          remainingCount: state.callQueue.length,
          lastCalledNumbers: state.lastCalledNumbers,
          gameState: state
        }
      });

      if (isFinished) {
        this.broadcast(room.id, {
          type: 'bingo:game_over',
          roomId: room.id,
          payload: {
            winnerUserId: state.winnerUserId,
            winnerDisplayName: state.winnerDisplayName,
            roundHistory: state.roundHistory,
            summary: state.statusMessage,
            gameState: state
          }
        });
      }
    } else {
      // Tambola 1-90
      const { state, calledNumber, isFinished } = BingoEngine.callNext(room.gameState);
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      if (isFinished) {
        this.stopBingoAutoCall(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      }

      this.broadcast(room.id, {
        type: 'bingo:number_called',
        roomId: room.id,
        payload: {
          number: calledNumber,
          word: state.currentNumberWord,
          calledNumbers: state.calledNumbers,
          remainingCount: state.callQueue.length,
          gameState: state
        }
      });

      if (isFinished) {
        this.broadcast(room.id, {
          type: 'bingo:game_over',
          roomId: room.id,
          payload: {
            winnerUserId: state.winnerUserId,
            winnerDisplayName: state.winnerDisplayName,
            scores: state.scores,
            summary: state.gameSummary,
            gameState: state
          }
        });
      }
    }
  }

  public handleBingoStart(roomId: string, userId: string, config?: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) throw new Error('Game room not found');
    if (room.hostUserId !== userId) {
      throw new Error('Only the host can start the game');
    }
    if (config) {
      if (room.gameType === 'bingo') {
        (room as any).bingoConfig = { ...DEFAULT_BINGO_DUEL_CONFIG, ...config };
      } else {
        (room as any).tambolaConfig = { ...DEFAULT_BINGO_CONFIG, ...config };
      }
    }
    this.startGame(room);
  }

  public handleBingoTogglePause(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return;
    if (room.hostUserId !== userId) {
      throw new Error('Only the host can pause or resume calling');
    }
    room.gameState.callingPaused = !room.gameState.callingPaused;
    this.db.updateGameRoomState(room.id, room.gameState);

    this.broadcast(room.id, {
      type: 'bingo:calling_paused',
      roomId: room.id,
      payload: {
        callingPaused: room.gameState.callingPaused,
        gameState: room.gameState
      }
    });
  }

  public handleBingoNextRound(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'bingo') return;
    if (room.hostUserId !== userId) {
      throw new Error('Only the host can start the next round');
    }
    const state = BingoDuelEngine.startNextRound(room.gameState);
    room.gameState = state;
    this.db.updateGameRoomState(room.id, state);

    this.broadcast(room.id, {
      type: 'bingo:round_started',
      roomId: room.id,
      payload: {
        currentRound: state.currentRound,
        gameState: state
      }
    });

    const speed = state.config?.autoCallSpeed;
    if (speed && speed > 0) {
      this.startBingoAutoCall(room.id, speed);
    }
  }

  public handleBingoCallNext(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return;
    if (room.hostUserId !== userId) {
      throw new Error('Only the host can manually call numbers');
    }
    if (room.gameState.phase === 'FINISHED' || room.gameState.phase === 'ROUND_OVER') return;

    if (room.gameType === 'bingo') {
      const { state, calledNumber, isFinished } = BingoDuelEngine.callNext(room.gameState);
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      if (isFinished) {
        this.stopBingoAutoCall(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      }

      this.broadcast(room.id, {
        type: 'bingo:number_called',
        roomId: room.id,
        payload: {
          number: calledNumber,
          word: state.currentNumberWord,
          calledNumbers: state.calledNumbers,
          remainingCount: state.callQueue.length,
          lastCalledNumbers: state.lastCalledNumbers,
          gameState: state
        }
      });

      if (isFinished) {
        this.broadcast(room.id, {
          type: 'bingo:game_over',
          roomId: room.id,
          payload: {
            winnerUserId: state.winnerUserId,
            winnerDisplayName: state.winnerDisplayName,
            roundHistory: state.roundHistory,
            summary: state.statusMessage,
            gameState: state
          }
        });
      }
    } else {
      const { state, calledNumber, isFinished } = BingoEngine.callNext(room.gameState);
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      if (isFinished) {
        this.stopBingoAutoCall(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      }

      this.broadcast(room.id, {
        type: 'bingo:number_called',
        roomId: room.id,
        payload: {
          number: calledNumber,
          word: state.currentNumberWord,
          calledNumbers: state.calledNumbers,
          remainingCount: state.callQueue.length,
          gameState: state
        }
      });

      if (isFinished) {
        this.broadcast(room.id, {
          type: 'bingo:game_over',
          roomId: room.id,
          payload: {
            winnerUserId: state.winnerUserId,
            winnerDisplayName: state.winnerDisplayName,
            scores: state.scores,
            summary: state.gameSummary,
            gameState: state
          }
        });
      }
    }
  }

  public handleBingoClaim(roomId: string, userId: string, condition?: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return;
    const player = room.players.find(p => p.userId === userId);
    if (!player) return;

    if (room.gameType === 'bingo') {
      const result = BingoDuelEngine.claimBingo(room.gameState, userId, player.displayName);
      this.db.updateGameRoomState(room.id, room.gameState);

      this.sendToUser(userId, {
        type: 'bingo:claim_result',
        roomId: room.id,
        payload: {
          userId,
          displayName: player.displayName,
          valid: result.valid,
          message: result.message,
          penaltySeconds: result.penaltySeconds,
          isMatchOver: result.isMatchOver,
          isRoundOver: result.isRoundOver,
          winningIndices: result.winningIndices,
          gameState: room.gameState
        }
      });

      if (result.valid) {
        if (result.isMatchOver) {
          this.stopBingoAutoCall(room.id);
          const now = new Date().toISOString();
          this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
        } else if (result.isRoundOver) {
          this.stopBingoAutoCall(room.id);
        }

        this.broadcast(room.id, {
          type: 'bingo:condition_won',
          roomId: room.id,
          payload: {
            conditionName: 'BINGO!',
            userId,
            displayName: player.displayName,
            roundsWon: room.gameState.roundsWon,
            winningIndices: result.winningIndices,
            gameState: room.gameState,
            isGameOver: result.isMatchOver,
            isRoundOver: result.isRoundOver
          }
        });

        if (result.isMatchOver) {
          this.broadcast(room.id, {
            type: 'bingo:game_over',
            roomId: room.id,
            payload: {
              winnerUserId: room.gameState.winnerUserId,
              winnerDisplayName: room.gameState.winnerDisplayName,
              roundHistory: room.gameState.roundHistory,
              summary: room.gameState.statusMessage,
              gameState: room.gameState
            }
          });
        }
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

      this.sendToUser(userId, {
        type: 'bingo:claim_result',
        roomId: room.id,
        payload: {
          userId,
          displayName: player.displayName,
          condition,
          valid: result.valid,
          message: result.message,
          pointsEarned: result.pointsEarned,
          penaltySeconds: result.penaltySeconds,
          gameState: room.gameState
        }
      });

      if (result.valid) {
        const isGameOver = room.gameState.phase === 'FINISHED';
        if (isGameOver) {
          this.stopBingoAutoCall(room.id);
          const now = new Date().toISOString();
          this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
        }

        this.broadcast(room.id, {
          type: 'bingo:condition_won',
          roomId: room.id,
          payload: {
            condition,
            conditionName: BingoEngine.getConditionFriendlyName(condition),
            userId,
            displayName: player.displayName,
            points: result.pointsEarned,
            scores: room.gameState.scores,
            gameState: room.gameState,
            isGameOver
          }
        });

        if (isGameOver) {
          this.broadcast(room.id, {
            type: 'bingo:game_over',
            roomId: room.id,
            payload: {
              winnerUserId: room.gameState.winnerUserId,
              winnerDisplayName: room.gameState.winnerDisplayName,
              scores: room.gameState.scores,
              summary: room.gameState.gameSummary,
              gameState: room.gameState
            }
          });
        }
      }
    }
  }

  public handleBingoMark(roomId: string, userId: string, numberToMark: number): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || (room.gameType !== 'bingo' && room.gameType !== 'tambola')) return;

    if (room.gameType === 'bingo') {
      const { state, success } = BingoDuelEngine.markNumber(room.gameState, userId, numberToMark);
      if (success) {
        room.gameState = state;
        this.db.updateGameRoomState(room.id, state);

        this.broadcast(room.id, {
          type: 'bingo:number_marked',
          roomId: room.id,
          payload: {
            userId,
            number: numberToMark,
            playerMarks: state.playerMarks[userId],
            playerProgress: state.playerProgress[userId],
            gameState: state
          }
        });
      }
    } else {
      const updatedState = BingoEngine.markNumber(room.gameState, userId, numberToMark);
      room.gameState = updatedState;
      this.db.updateGameRoomState(room.id, updatedState);

      this.broadcast(room.id, {
        type: 'bingo:number_marked',
        roomId: room.id,
        payload: {
          userId,
          number: numberToMark,
          playerMarked: updatedState.playerMarked[userId]
        }
      });
    }
  }

  public handleBingoSelectNumber(roomId: string, userId: string, numberToCall: number): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'bingo') return;

    // Self-healing: if an existing room is stuck in SETUP phase or has missing boards, heal into PLAYING
    if (room.gameState.phase === 'SETUP' || !room.gameState.boards || !room.gameState.boards[userId] || room.gameState.boards[userId].length === 0) {
      room.gameState.phase = 'PLAYING';
      if (!room.gameState.boards) room.gameState.boards = {};
      room.players.forEach(p => {
        if (!room.gameState.boards[p.userId] || room.gameState.boards[p.userId].length !== 5) {
          room.gameState.boards[p.userId] = BingoDuelEngine.generateBoard();
        }
      });
      this.db.updateGameRoomState(room.id, room.gameState);
    }

    const playerUserIds = room.players.map(p => p.userId);
    const result = BingoDuelEngine.selectNumber(room.gameState, userId, numberToCall, playerUserIds);

    if (!result.success) {
      this.sendToUser(userId, {
        type: 'bingo:error',
        roomId: room.id,
        payload: { message: result.message }
      });
      return;
    }

    room.gameState = result.state;
    this.db.updateGameRoomState(room.id, result.state);

    // Broadcast number called event to all players
    this.broadcast(room.id, {
      type: 'bingo:number_called',
      roomId: room.id,
      payload: {
        number: result.calledNumber,
        calledNumber: result.calledNumber,
        currentNumber: result.calledNumber,
        word: result.state.currentNumberWord,
        numberWord: result.state.currentNumberWord,
        last5: result.state.lastCalledNumbers,
        allCalled: result.state.calledNumbers,
        calledNumbers: result.state.calledNumbers,
        remainingCount: 25 - result.state.calledNumbers.length,
        currentTurnUserId: result.state.currentTurnUserId,
        callerUserId: result.state.callerUserId,
        playerProgress: result.state.playerProgress,
        gameState: result.state
      }
    });

    if (result.isFinished) {
      this.broadcast(room.id, {
        type: 'bingo:game_over',
        roomId: room.id,
        payload: {
          winnerUserId: room.gameState.winnerUserId,
          winnerDisplayName: room.gameState.winnerDisplayName,
          roundHistory: room.gameState.roundHistory,
          summary: room.gameState.statusMessage,
          gameState: room.gameState
        }
      });
    }
  }

  public handleBingoSetBoard(roomId: string, userId: string, board: number[][]): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'bingo') return;

    const playerUserIds = room.players.map(p => p.userId);
    const { state, success, message, allReady } = BingoDuelEngine.setPlayerBoard(
      room.gameState,
      userId,
      board,
      playerUserIds
    );

    if (success) {
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      this.broadcast(room.id, {
        type: 'bingo:board_updated',
        roomId: room.id,
        payload: {
          userId,
          board,
          playerProgress: state.playerProgress[userId],
          gameState: state,
          message,
          allReady
        }
      });

      if (allReady) {
        this.broadcast(room.id, {
          type: 'bingo:round_started',
          roomId: room.id,
          payload: {
            currentRound: state.currentRound,
            gameState: state,
            message: 'Both players ready! Match started! Pick numbers alternatively.'
          }
        });
      }
    } else {
      this.sendToUser(userId, {
        type: 'bingo:error',
        roomId: room.id,
        payload: { message }
      });
    }
  }

  public handleBingoConfigUpdate(roomId: string, userId: string, partialConfig: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    if (room.hostUserId !== userId) {
      throw new Error('Only host can update room settings');
    }
    if (room.gameType === 'bingo') {
      const currentConfig = (room as any).bingoConfig || DEFAULT_BINGO_DUEL_CONFIG;
      const updated = { ...currentConfig, ...partialConfig };
      (room as any).bingoConfig = updated;

      this.broadcast(room.id, {
        type: 'bingo:config_updated',
        roomId: room.id,
        payload: { config: updated }
      });
    } else {
      const currentConfig = (room as any).tambolaConfig || DEFAULT_BINGO_CONFIG;
      const updated = { ...currentConfig, ...partialConfig };
      (room as any).tambolaConfig = updated;

      this.broadcast(room.id, {
        type: 'bingo:config_updated',
        roomId: room.id,
        payload: { config: updated }
      });
    }
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
  }

  public tickDoodleTimer(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.status !== 'PLAYING' || !room.gameState || room.gameType !== 'doodle-duel') {
      this.stopDoodleTimer(roomId);
      return;
    }

    try {
      const { state, phaseChanged, isTimeUp } = DoodleDuelEngine.tick(room.gameState);
      room.gameState = state;
      this.db.updateGameRoomState(room.id, state);

      // Broadcast doodle state on every second so timer counts down smoothly and never freezes
      this.broadcastDoodleState(roomId);

      if (state.phase === 'FINISHED') {
        this.stopDoodleTimer(roomId);
        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);
      }
    } catch (err) {
      console.error('Error in tickDoodleTimer:', err);
    }
  }

  public broadcastDoodleState(roomId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;

    const fullState = room.gameState;
    fullState.currentRound = fullState.round;
    fullState.timeLeftSeconds = fullState.timeRemaining;
    fullState.category = fullState.secretWordCategory;
    fullState.currentGuesses = fullState.guesses;

    const sanitizedState = DoodleDuelEngine.sanitizeStateForGuesser(fullState);
    sanitizedState.currentRound = fullState.round;
    sanitizedState.timeLeftSeconds = fullState.timeRemaining;
    sanitizedState.category = fullState.secretWordCategory;
    sanitizedState.currentGuesses = fullState.guesses;

    const clients = this.roomClients.get(roomId);
    if (!clients) return;

    for (const client of clients) {
      const isDrawer = client.userId === fullState.drawerUserId;
      const payloadState = isDrawer || fullState.phase === 'ROUND_RESULT' || fullState.phase === 'FINISHED'
        ? fullState
        : sanitizedState;

      if (client.socket.readyState === 1) {
        try {
          client.socket.send(JSON.stringify({
            type: 'doodle:state_sync',
            roomId,
            payload: { gameState: payloadState }
          }));
        } catch {}
      }
    }
  }

  public handleDoodleSelectRole(roomId: string, userId: string, drawerUserIdOrRole: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;

    if (!room.gameState) {
      const def = GAME_DEFINITIONS[room.gameType];
      const colors = def?.colorAssignments[room.maxPlayers];
      const playerConfigs = room.players.map(p => ({
        userId: p.userId,
        displayName: p.displayName,
        seat: p.seat,
        color: colors && colors[p.seat] ? colors[p.seat] : p.color
      }));
      const config = (room as any).doodleConfig || DEFAULT_DOODLE_CONFIG;
      room.gameState = DoodleDuelEngine.createInitialState(playerConfigs, config);
    }

    if (!room.gameState.roleSelections) {
      room.gameState.roleSelections = {};
    }

    // Support both direct drawerUserId or role string
    if (typeof drawerUserIdOrRole === 'string') {
      if (drawerUserIdOrRole === 'drawer' || drawerUserIdOrRole === 'guesser') {
        room.gameState.roleSelections[userId] = drawerUserIdOrRole;
      } else {
        // drawerUserId passed directly
        const targetDrawerId = drawerUserIdOrRole;
        const targetDrawerPlayer = room.players.find(p => p.userId === targetDrawerId);
        const otherPlayer = room.players.find(p => p.userId !== targetDrawerId);
        room.gameState.drawerUserId = targetDrawerId;
        room.gameState.drawerDisplayName = targetDrawerPlayer?.displayName || 'Drawer';
        if (otherPlayer) {
          room.gameState.guesserUserId = otherPlayer.userId;
          room.gameState.guesserDisplayName = otherPlayer.displayName || 'Guesser';
        }
        room.gameState.roleSelections[targetDrawerId] = 'drawer';
        if (otherPlayer) {
          room.gameState.roleSelections[otherPlayer.userId] = 'guesser';
        }
      }
    }

    this.db.updateGameRoomState(room.id, room.gameState);

    this.broadcast(room.id, {
      type: 'doodle:role_selected',
      roomId: room.id,
      payload: {
        userId,
        role: room.gameState.roleSelections[userId],
        drawerUserId: room.gameState.drawerUserId,
        roleSelections: room.gameState.roleSelections,
        gameState: room.gameState
      }
    });
  }

  public handleDoodleStart(roomId: string, userId: string, config?: Partial<DoodleConfig>): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    if (room.hostUserId !== userId) {
      throw new Error('Only the host can start Doodle Duel');
    }

    const players = room.players;
    if (players.length < 2) {
      throw new Error('Need 2 players to start Doodle Duel');
    }

    const def = GAME_DEFINITIONS[room.gameType];
    const colors = def?.colorAssignments[room.maxPlayers];
    const playerConfigs = room.players.map(p => {
      const assignedColor = colors && colors[p.seat] ? colors[p.seat] : p.color;
      p.color = assignedColor;
      return {
        userId: p.userId,
        displayName: p.displayName,
        seat: p.seat,
        color: assignedColor
      };
    });

    const activeConfig: DoodleConfig = {
      ...DEFAULT_DOODLE_CONFIG,
      ...((room as any).doodleConfig || {}),
      ...(config || {})
    };

    if (!room.gameState) {
      this.stopDoodleTimer(room.id);
      room.gameState = DoodleDuelEngine.createInitialState(playerConfigs, activeConfig);
    } else {
      room.gameState.config = { ...room.gameState.config, ...activeConfig };
    }

    const p1 = players[0].userId;
    const p2 = players[1].userId;
    const roles = room.gameState.roleSelections || {};

    let drawerId = room.gameState.drawerUserId || p1;
    let guesserId = room.gameState.guesserUserId || (drawerId === p1 ? p2 : p1);

    if (roles[p1] === 'guesser' || roles[p2] === 'drawer') {
      drawerId = p2;
      guesserId = p1;
    } else if (roles[p1] === 'drawer' || roles[p2] === 'guesser') {
      drawerId = p1;
      guesserId = p2;
    }

    const drawerPlayer = players.find(p => p.userId === drawerId) || players[0];
    const guesserPlayer = players.find(p => p.userId === guesserId) || players[1];

    room.status = 'PLAYING';
    const now = new Date().toISOString();
    room.startedAt = now;
    this.db.updateGameRoomStatus(room.id, 'PLAYING', now);
    this.recordGameStreaks(room);

    DoodleDuelEngine.startRoundIntro(room.gameState, drawerPlayer.userId, guesserPlayer.userId);
    room.gameState.drawerDisplayName = drawerPlayer.displayName;
    room.gameState.guesserDisplayName = guesserPlayer.displayName;
    room.gameState.currentRound = room.gameState.round;
    room.gameState.timeLeftSeconds = room.gameState.timeRemaining;

    this.db.updateGameRoomState(room.id, room.gameState);

    // Broadcast authoritative game:started event
    this.broadcast(room.id, {
      type: 'game:started',
      roomId: room.id,
      payload: {
        room,
        gameState: room.gameState,
        message: 'Doodle Duel started! Round intro begins.'
      }
    });

    this.startDoodleTimer(room.id);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleChooseWord(roomId: string, userId: string, chosenWord: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;
    if (room.gameState.drawerUserId !== userId) return;

    const raw = chosenWord.replace(/^[^\w\s]+\s*/, '').trim();
    const wordItem = DOODLE_WORDS.find(w => w.word.toLowerCase() === raw.toLowerCase()) || {
      word: raw,
      emoji: '🎨',
      category: 'Drawing',
      difficulty: 'easy' as const,
      hint: 'Word to draw'
    };

    DoodleDuelEngine.startDrawing(room.gameState, wordItem);
    this.db.updateGameRoomState(room.id, room.gameState);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleStroke(roomId: string, userId: string, stroke: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;
    if (room.gameState.drawerUserId !== userId) return;

    room.gameState.strokes.push(stroke);
    this.db.updateGameRoomState(room.id, room.gameState);

    // Broadcast stroke to all players in the room with minimal latency
    this.broadcast(room.id, {
      type: 'doodle:stroke_added',
      roomId: room.id,
      payload: { stroke }
    });
  }

  public handleDoodleUndo(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;
    if (room.gameState.drawerUserId !== userId) return;

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
    if (!room || !room.gameState) return;
    if (room.gameState.drawerUserId !== userId) return;

    room.gameState.strokes = [];
    this.db.updateGameRoomState(room.id, room.gameState);

    this.broadcast(room.id, {
      type: 'doodle:canvas_cleared',
      roomId: room.id,
      payload: {}
    });
  }

  public handleDoodleGuess(roomId: string, userId: string, guessText: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;
    const player = room.players.find(p => p.userId === userId);
    if (!player) return;

    const { isCorrect, state, points, completed } = DoodleDuelEngine.submitGuess(
      room.gameState,
      userId,
      player.displayName,
      guessText
    );

    const latestGuess = state.guesses[state.guesses.length - 1] || {
      id: `guess_${Date.now()}`,
      userId,
      displayName: player.displayName,
      text: guessText,
      guess: guessText,
      isCorrect,
      timestamp: Date.now()
    };
    (latestGuess as any).guess = latestGuess.text || guessText;

    room.gameState = state;
    this.db.updateGameRoomState(room.id, state);

    this.broadcast(room.id, {
      type: 'doodle:guess_result',
      roomId: room.id,
      payload: {
        guess: latestGuess,
        userId,
        displayName: player.displayName,
        text: guessText,
        guessText,
        isCorrect,
        pointsEarned: points,
        completed
      }
    });

    // Always broadcast sanitized state sync to keep guesses, scores, and round status identical across both clients
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleRequestHint(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState) return;
    if (room.gameState.drawerUserId !== userId) return;

    room.gameState.hintUsed = true;
    this.db.updateGameRoomState(room.id, room.gameState);
    this.broadcastDoodleState(room.id);
  }

  public handleDoodleConfigUpdate(roomId: string, userId: string, partialConfig: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room) return;
    if (room.hostUserId !== userId) {
      throw new Error('Only host can update room settings');
    }
    const currentConfig = (room as any).doodleConfig || DEFAULT_DOODLE_CONFIG;
    const updated = { ...currentConfig, ...partialConfig };
    (room as any).doodleConfig = updated;
    if (room.gameState) {
      room.gameState.config = updated;
      this.db.updateGameRoomState(room.id, room.gameState);
    }

    this.broadcast(room.id, {
      type: 'doodle:config_updated',
      roomId: room.id,
      payload: { config: updated }
    });
  }

  // =========================================================================
  // CHESS MULTIPLAYER ENGINE INTEGRATION & CLOCK TICKERS
  // =========================================================================

  public startChessClock(roomId: string): void {
    this.stopChessClock(roomId);

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

      const activeColor = state.turn;
      const activePlayer = activeColor === 'w' ? state.whitePlayer : state.blackPlayer;
      activePlayer.timeRemainingMs = Math.max(0, activePlayer.timeRemainingMs - 1000);

      if (activePlayer.timeRemainingMs <= 0) {
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
      } else {
        // Broadcast periodic clock tick
        this.broadcast(roomId, {
          type: 'chess:clock_tick',
          roomId,
          payload: {
            whiteTimeMs: state.whitePlayer.timeRemainingMs,
            blackTimeMs: state.blackPlayer.timeRemainingMs,
            turn: state.turn
          }
        });
      }
    }, 1000);

    this.chessTimers.set(roomId, timer);
  }

  public stopChessClock(roomId: string): void {
    const timer = this.chessTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.chessTimers.delete(roomId);
    }
  }

  public handleChessStart(roomId: string, userId: string, config?: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.players.length < 2) return;
    if (room.hostUserId !== userId) return;

    this.stopChessClock(roomId);
    const chessConfig = config || (room as any).chessConfig || DEFAULT_CHESS_CONFIG;
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
      const client = this.userClients.get(userId);
      if (client) {
        client.socket.send(JSON.stringify({
          type: 'chess:move_rejected',
          roomId,
          payload: { message: res.message }
        }));
      }
      return;
    }

    room.gameState = res.state;
    this.db.updateGameRoomState(roomId, res.state);

    if (res.state.status === 'CHECKMATE' || res.state.status === 'STALEMATE' || res.state.status === 'DRAW' || res.state.status === 'TIMEOUT') {
      this.stopChessClock(roomId);
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, now);
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
    }

    this.broadcast(roomId, {
      type: 'chess:move_accepted',
      roomId,
      payload: {
        move: res.move,
        gameState: res.state
      }
    });
  }

  public handleChessResign(roomId: string, userId: string): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || !room.gameState || room.gameType !== 'chess') return;

    const nextState = ChessEngine.resign(room.gameState as ChessGameState, userId);
    room.gameState = nextState;
    this.stopChessClock(roomId);
    const now = new Date().toISOString();
    this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, now);
    this.db.updateGameRoomState(roomId, nextState);

    this.broadcast(roomId, {
      type: 'chess:game_over',
      roomId,
      payload: {
        gameState: nextState,
        winnerUserId: nextState.winnerUserId,
        winnerColor: nextState.winnerColor,
        reason: 'Resignation'
      }
    });
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

    const nextState = ChessEngine.respondDraw(room.gameState as ChessGameState, userId, accept);
    room.gameState = nextState;
    this.db.updateGameRoomState(roomId, nextState);

    if (accept) {
      this.stopChessClock(roomId);
      const now = new Date().toISOString();
      this.db.updateGameRoomStatus(roomId, 'FINISHED', undefined, now);
      this.broadcast(roomId, {
        type: 'chess:game_over',
        roomId,
        payload: {
          gameState: nextState,
          drawReason: 'agreement',
          reason: 'Mutual Agreement'
        }
      });
    } else {
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

    const nextState = ChessEngine.respondTakeback(room.gameState as ChessGameState, userId, accept);
    room.gameState = nextState;
    this.db.updateGameRoomState(roomId, nextState);

    this.broadcast(roomId, {
      type: 'chess:takeback_responded',
      roomId,
      payload: { accept, gameState: nextState }
    });
  }

  public handleChessConfigUpdate(roomId: string, userId: string, config: any): void {
    const room = this.db.getGameRoomById(roomId);
    if (!room || room.hostUserId !== userId) return;

    (room as any).chessConfig = { ...((room as any).chessConfig || DEFAULT_CHESS_CONFIG), ...config };
    if (room.gameState) {
      room.gameState.config = { ...room.gameState.config, ...config };
      this.db.updateGameRoomState(roomId, room.gameState);
    }

    this.broadcast(roomId, {
      type: 'chess:config_updated',
      roomId,
      payload: { config: (room as any).chessConfig, gameState: room.gameState }
    });
  }

  /**
   * Registers a WebSocket connection to a game room
   */
  public registerClient(
    socket: WebSocket,
    roomId: string,
    user: { id: string; displayName: string; avatarUrl?: string | null }
  ): void {
    // Clear any pending disconnect grace timer
    const timer = this.disconnectGraceTimers.get(user.id);
    if (timer) {
      clearTimeout(timer);
      this.disconnectGraceTimers.delete(user.id);
    }

    let clientsSet = this.roomClients.get(roomId);
    if (!clientsSet) {
      clientsSet = new Set();
      this.roomClients.set(roomId, clientsSet);
    } else {
      // Remove any existing/stale socket for this user in this room to prevent duplicate sends
      for (const existing of Array.from(clientsSet)) {
        if (existing.userId === user.id) {
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
    this.userClients.set(user.id, client);
    this.db.setGamePlayerConnected(roomId, user.id, true);

    // Send full authoritative current state upon connection
    let room = this.db.getGameRoomById(roomId);
    if (room) {
      let myPlayer = room.players.find(p => p.userId === user.id);
      if (!myPlayer && room.status === 'WAITING' && room.players.length < room.maxPlayers) {
        try {
          room = this.joinRoom(room.roomCode, user);
          myPlayer = room.players.find(p => p.userId === user.id);
        } catch (e: any) {
          console.error(`[GameRoom] Error auto-joining room ${room.roomCode} for user ${user.id}:`, e);
          socket.send(JSON.stringify({
            type: 'error:notification',
            payload: { code: 'JOIN_FAILED', message: e?.message || 'Failed to join game room' }
          }));
        }
      }

      if (room.status === 'WAITING' && room.players.length >= room.maxPlayers) {
        this.startGame(room);
      }

      const currentRoom = this.db.getGameRoomById(roomId) || room;
      const theme = this.roomThemes.get(roomId) || currentRoom.theme || 'romantic';
      currentRoom.theme = theme;
      const chatHistory = this.roomChatHistory.get(roomId) || [];
      currentRoom.chatHistory = chatHistory;

      socket.send(JSON.stringify({
        type: 'game:sync',
        roomId,
        payload: {
          room: currentRoom,
          theme,
          chatHistory,
          myUserId: user.id,
          myPlayer: myPlayer || currentRoom.players.find(p => p.userId === user.id)
        }
      }));

      this.broadcast(roomId, {
        type: 'game:player_reconnected',
        roomId,
        payload: { userId: user.id, displayName: user.displayName, room: currentRoom }
      });

      // Ensure doodle timer is actively running if match is in progress (e.g. after server restart)
      if (currentRoom.gameType === 'doodle-duel' && currentRoom.status === 'PLAYING' && !this.doodleTimers.has(roomId)) {
        this.startDoodleTimer(roomId);
      }
    }

    // Handle WebSocket messages
    socket.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleClientMessage(client, msg);
      } catch (err) {
        console.error('Failed to parse game client message:', err);
      }
    });

    socket.on('close', () => {
      this.handleClientDisconnection(client);
    });
  }

  private handleClientMessage(client: ConnectedGameClient, msg: any): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'game:roll_dice':
        this.handleRollDice(client.roomId, client.userId);
        break;

      case 'game:move_token':
        this.handleMoveToken(client.roomId, client.userId, msg.payload?.tokenId);
        break;

      case 'game:rematch':
        this.handleRematch(client.roomId, client.userId);
        break;

      case 'game:rematch_decline':
        this.handleRematchDecline(client.roomId, client.userId);
        break;

      case 'game:nudge': {
        const roast = msg.payload?.message || 'Rematch accept karle, haarne se kyu darr raha hai? 😉';
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
        this.handleDropDisc(client.roomId, client.userId, Number(msg.payload?.column ?? msg.payload?.col));
        break;

      case 'game:tictactoe_move':
        this.handleTicTacToeMove(client.roomId, client.userId, Number(msg.payload?.cellIndex ?? msg.payload?.cell));
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
        this.handleBingoMark(client.roomId, client.userId, Number(msg.payload?.number));
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
        const now = Date.now();
        if (client.lastChatMessageTime && now - client.lastChatMessageTime < 350) {
          break;
        }
        client.lastChatMessageTime = now;
        if (msg.payload?.content) {
          const chatMsg = {
            id: `gchat_${nanoid(8)}`,
            userId: client.userId,
            userName: client.displayName,
            avatarUrl: client.avatarUrl,
            content: String(msg.payload.content).slice(0, 4000),
            timestamp: now,
            replyTo: msg.payload?.replyTo ? {
              id: String(msg.payload.replyTo.id),
              userName: String(msg.payload.replyTo.userName || 'Player'),
              content: String(msg.payload.replyTo.content || '').slice(0, 300)
            } : null
          };

          let history = this.roomChatHistory.get(client.roomId);
          if (!history) {
            history = [];
            this.roomChatHistory.set(client.roomId, history);
          }
          history.push(chatMsg);
          if (history.length > 50) history.shift();

          this.broadcast(client.roomId, {
            type: 'game:chat_message',
            roomId: client.roomId,
            payload: chatMsg
          });
        }
        break;
      }

      case 'game:change_theme': {
        const theme = String(msg.payload?.theme || 'romantic');
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

      case 'game:reaction':
        if (msg.payload?.emoji) {
          this.broadcast(client.roomId, {
            type: 'game:reaction_broadcast',
            roomId: client.roomId,
            payload: {
              userId: client.userId,
              userName: client.displayName,
              emoji: msg.payload.emoji,
              timestamp: Date.now()
            }
          });
        }
        break;

      case 'webrtc:signal':
      case 'voice:signal':
        if (msg.payload?.targetUserId && msg.payload?.signal) {
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

      case 'game:nudge':
        this.broadcast(client.roomId, {
          type: 'game:nudge',
          roomId: client.roomId,
          payload: {
            fromUserId: client.userId,
            fromDisplayName: client.displayName,
            targetUserId: msg.payload?.targetUserId,
            timestamp: Date.now()
          }
        }, client.userId);
        break;

      case 'game:leave':
        this.handleClientLeave(client);
        break;
    }
  }

  private handleClientLeave(client: ConnectedGameClient): void {
    const set = this.roomClients.get(client.roomId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        this.roomClients.delete(client.roomId);
      }
    }
    this.userClients.delete(client.userId);
    this.db.setGamePlayerConnected(client.roomId, client.userId, false);

    const room = this.db.getGameRoomById(client.roomId);
    let isWinner = false;
    let winnerUserId: string | null = null;
    let winnerDisplayName: string | null = null;
    let winnerColor: any = null;

    if (room && (room.status === 'PLAYING' || room.status === 'READY' || room.gameState)) {
      const remainingPlayers = room.players.filter(p => p.userId !== client.userId);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        isWinner = true;
        winnerUserId = winner.userId;
        winnerDisplayName = winner.displayName;
        winnerColor = winner.color;

        const now = new Date().toISOString();
        this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);

        if (room.gameType === 'ludo' && room.gameState) {
          room.gameState.winnerColor = winner.color;
          room.gameState.winnerUserId = winner.userId;
          room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
          this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat, winner.seat);
        } else if (room.gameType === 'four-in-a-row' && room.gameState) {
          room.gameState.winner = winner.color === 'red' ? 'R' : 'Y';
          room.gameState.winnerColor = winner.color;
          room.gameState.winnerUserId = winner.userId;
          room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
          this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat, winner.seat);
        } else if (room.gameType === 'tic-tac-toe' && room.gameState) {
          room.gameState.winner = winner.seat === 0 ? 'X' : 'O';
          room.gameState.winnerUserId = winner.userId;
          room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
          this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat, winner.seat);
        } else if (room.gameType === 'bingo' && room.gameState) {
          this.stopBingoAutoCall(room.id);
          room.gameState.phase = 'FINISHED';
          room.gameState.winnerUserId = winner.userId;
          room.gameState.winnerDisplayName = winner.displayName;
          room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
          this.db.updateGameRoomState(room.id, room.gameState, 0, winner.seat);
        } else if (room.gameType === 'doodle-duel' && room.gameState) {
          this.stopDoodleTimer(room.id);
          room.gameState.phase = 'FINISHED';
          room.gameState.winnerUserId = winner.userId;
          room.gameState.winnerDisplayName = winner.displayName;
          room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
          this.db.updateGameRoomState(room.id, room.gameState, 0, winner.seat);
        } else if (room.gameType === 'chess' && room.gameState) {
          this.stopChessClock(room.id);
          room.gameState.status = 'ABANDONED';
          room.gameState.winnerUserId = winner.userId;
          room.gameState.winnerDisplayName = winner.displayName;
          room.gameState.winnerColor = winner.userId === room.gameState.whitePlayer.userId ? 'w' : 'b';
          room.gameState.winnerReason = 'Opponent Left';
          room.gameState.statusMessage = `${client.displayName} left the game. You win! 🏆`;
          this.db.updateGameRoomState(room.id, room.gameState, 0, winner.seat);
        }
      }
    }

    if (this.rematchVotes.has(client.roomId)) {
      this.rematchVotes.delete(client.roomId);
      this.broadcast(client.roomId, {
        type: 'game:rematch_declined',
        roomId: client.roomId,
        payload: {
          declinerId: client.userId,
          declinerName: client.displayName,
          reason: 'opponent_left',
          message: `${client.displayName} left the game.`
        }
      });
    }

    this.broadcast(client.roomId, {
      type: 'game:player_left',
      roomId: client.roomId,
      payload: {
        userId: client.userId,
        displayName: client.displayName,
        reason: 'LEFT',
        isWinner,
        winnerUserId,
        winnerDisplayName,
        winnerColor,
        forfeitMessage: `${client.displayName} left the game. You are the winner! 🏆`,
        gameState: room?.gameState
      }
    });
  }

  private handleClientDisconnection(client: ConnectedGameClient): void {
    const set = this.roomClients.get(client.roomId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        this.roomClients.delete(client.roomId);
      }
    }
    this.userClients.delete(client.userId);
    this.db.setGamePlayerConnected(client.roomId, client.userId, false);

    // 5-second grace timer for human reconnection
    const graceTimer = setTimeout(() => {
      this.disconnectGraceTimers.delete(client.userId);
      const room = this.db.getGameRoomById(client.roomId);
      if (room && room.status === 'WAITING') {
        // If room is still waiting, free seat
        this.db.removePlayerFromGameRoom(room.id, client.userId);
        this.broadcast(room.id, {
          type: 'game:player_left',
          roomId: room.id,
          payload: { userId: client.userId, displayName: client.displayName, reason: 'LEFT' }
        });
      } else if (room && (room.status === 'PLAYING' || room.status === 'READY' || room.gameState)) {
        const remainingPlayers = room.players.filter(p => p.userId !== client.userId);
        if (remainingPlayers.length === 1) {
          const winner = remainingPlayers[0];
          const now = new Date().toISOString();
          this.db.updateGameRoomStatus(room.id, 'FINISHED', undefined, now);

          if (room.gameType === 'ludo' && room.gameState) {
            room.gameState.winnerColor = winner.color;
            room.gameState.winnerUserId = winner.userId;
            room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
            this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat, winner.seat);
          } else if (room.gameType === 'four-in-a-row' && room.gameState) {
            room.gameState.winner = winner.color === 'red' ? 'R' : 'Y';
            room.gameState.winnerColor = winner.color;
            room.gameState.winnerUserId = winner.userId;
            room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
            this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat, winner.seat);
          } else if (room.gameType === 'tic-tac-toe' && room.gameState) {
            room.gameState.winner = winner.seat === 0 ? 'X' : 'O';
            room.gameState.winnerUserId = winner.userId;
            room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
            this.db.updateGameRoomState(room.id, room.gameState, room.gameState.currentTurnSeat, winner.seat);
          } else if (room.gameType === 'bingo' && room.gameState) {
            this.stopBingoAutoCall(room.id);
            room.gameState.phase = 'FINISHED';
            room.gameState.winnerUserId = winner.userId;
            room.gameState.winnerDisplayName = winner.displayName;
            room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
            this.db.updateGameRoomState(room.id, room.gameState, 0, winner.seat);
          } else if (room.gameType === 'doodle-duel' && room.gameState) {
            this.stopDoodleTimer(room.id);
            room.gameState.phase = 'FINISHED';
            room.gameState.winnerUserId = winner.userId;
            room.gameState.winnerDisplayName = winner.displayName;
            room.gameState.statusMessage = `${client.displayName} left the game. You are the winner! 🏆`;
            this.db.updateGameRoomState(room.id, room.gameState, 0, winner.seat);
          } else if (room.gameType === 'chess' && room.gameState) {
            this.stopChessClock(room.id);
            room.gameState.status = 'ABANDONED';
            room.gameState.winnerUserId = winner.userId;
            room.gameState.winnerDisplayName = winner.displayName;
            room.gameState.winnerColor = winner.userId === room.gameState.whitePlayer.userId ? 'w' : 'b';
            room.gameState.winnerReason = 'Opponent Left';
            room.gameState.statusMessage = `${client.displayName} left the game. You win! 🏆`;
            this.db.updateGameRoomState(room.id, room.gameState, 0, winner.seat);
          }


          this.broadcast(room.id, {
            type: 'game:player_left',
            roomId: room.id,
            payload: {
              userId: client.userId,
              displayName: client.displayName,
              reason: 'DISCONNECTED',
              isWinner: true,
              winnerUserId: winner.userId,
              winnerDisplayName: winner.displayName,
              winnerColor: winner.color,
              forfeitMessage: `${client.displayName} left the game. You are the winner! 🏆`,
              gameState: room.gameState
            }
          });
        }
      }
    }, 5000);

    this.disconnectGraceTimers.set(client.userId, graceTimer);

    // Broadcast disconnected alert to other players
    this.broadcast(client.roomId, {
      type: 'game:player_disconnected',
      roomId: client.roomId,
      payload: {
        userId: client.userId,
        displayName: client.displayName,
        graceSeconds: 5
      }
    });
  }

  public isUserOnline(userId: string): boolean {
    const client = this.userClients.get(userId);
    return Boolean(client && client.socket.readyState === 1);
  }

  public sendToUser(userId: string, message: any): boolean {
    const client = this.userClients.get(userId);
    if (client && client.socket.readyState === 1) {
      client.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public broadcast(roomId: string, message: any, excludeUserId?: string): void {
    const clients = this.roomClients.get(roomId);
    if (!clients) return;
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.socket.readyState === 1) {
        try {
          client.socket.send(data);
        } catch {}
      }
    }
  }
}
