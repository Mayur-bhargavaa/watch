import {
  BingoDuelPattern,
  BingoDuelMode,
  BingoDuelConfig,
  BingoDuelGameState,
  BingoDuelPatternProgress,
  BingoDuelRoundSummary,
  BingoDuelCompletedLine
} from '@synccinema/common';
import { secureRandom } from '../util/random.js';

const NUMBER_WORDS: Record<number, string> = {
  1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE',
  6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN',
  11: 'ELEVEN', 12: 'TWELVE', 13: 'THIRTEEN', 14: 'FOURTEEN', 15: 'FIFTEEN',
  16: 'SIXTEEN', 17: 'SEVENTEEN', 18: 'EIGHTEEN', 19: 'NINETEEN', 20: 'TWENTY',
  21: 'TWENTY-ONE', 22: 'TWENTY-TWO', 23: 'TWENTY-THREE', 24: 'TWENTY-FOUR', 25: 'TWENTY-FIVE'
};

export const DEFAULT_BINGO_DUEL_CONFIG: BingoDuelConfig = {
  pattern: 'fiveLines',
  mode: 'classic',
  autoCallSpeed: 5000, // 5 seconds
  voiceCaller: true,
  sound: true,
  falseBingoPenalty: 3 // 3 seconds penalty
};

export const DUEL_TURN_TIMEOUT_MS = 45000;

export const BINGO_DUEL_PATTERNS = [
  'fiveLines', 'firstRow', 'middleRow', 'lastRow', 'anyRow', 'anyCol',
  'fourCorners', 'xPattern', 'plusPattern', 'diagonal', 'fullHouse', 'custom'
] as const;
export const BINGO_DUEL_MODES = ['quick', 'classic', 'bestOf3', 'bestOf5', 'custom'] as const;

export class BingoDuelEngine {
  public static getNumberWord(n: number): string {
    return NUMBER_WORDS[n] || String(n);
  }

  /**
   * Generates a 5x5 board containing shuffled numbers 1..25
   */
  public static generateBoard(): number[][] {
    const nums = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    const board: number[][] = [];
    for (let r = 0; r < 5; r++) {
      board.push(nums.slice(r * 5, (r + 1) * 5));
    }
    return board;
  }

  /**
   * Generates a randomized call queue containing numbers 1..25 without repetition
   */
  public static generateCallQueue(): number[] {
    const queue = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  /**
   * Evaluates pattern progress on a 5x5 board given player's marked numbers that are called
   */
  public static evaluatePattern(
    board: number[][],
    pattern: BingoDuelPattern,
    playerMarks: number[],
    calledNumbers: number[],
    customPattern?: boolean[][]
  ): BingoDuelPatternProgress {
    const calledSet = new Set(calledNumbers);
    const markedSet = new Set(playerMarks.filter(n => calledSet.has(n)));

    // Helper: is cell [r, c] marked
    const isMarked = (r: number, c: number) => markedSet.has(board[r][c]);

    // Authentic Indian/School 5-Lines B-I-N-G-O evaluation (Rows, Columns, Diagonals)
    if (pattern === 'fiveLines') {
      const completedLines: BingoDuelCompletedLine[] = [];
      const allMatchedIndices: [number, number][] = [];
      const addIndices = (coords: [number, number][]) => {
        coords.forEach(([r, c]) => {
          if (!allMatchedIndices.some(([ar, ac]) => ar === r && ac === c)) {
            allMatchedIndices.push([r, c]);
          }
        });
      };

      // 1. Check 5 Horizontal Rows
      for (let r = 0; r < 5; r++) {
        const rowCoords: [number, number][] = [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]];
        if (rowCoords.every(([row, col]) => isMarked(row, col))) {
          completedLines.push({
            id: `row-${r}`,
            type: 'row',
            index: r,
            name: `Row ${r + 1}`,
            indices: rowCoords
          });
          addIndices(rowCoords);
        }
      }

      // 2. Check 5 Vertical Columns
      for (let c = 0; c < 5; c++) {
        const colCoords: [number, number][] = [[0, c], [1, c], [2, c], [3, c], [4, c]];
        if (colCoords.every(([row, col]) => isMarked(row, col))) {
          completedLines.push({
            id: `col-${c}`,
            type: 'col',
            index: c,
            name: `Column ${c + 1}`,
            indices: colCoords
          });
          addIndices(colCoords);
        }
      }

      // 3. Check Main Diagonal (top-left to bottom-right)
      const mainDiagCoords: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
      if (mainDiagCoords.every(([row, col]) => isMarked(row, col))) {
        completedLines.push({
          id: 'diag-main',
          type: 'diag',
          index: 0,
          name: 'Main Diagonal',
          indices: mainDiagCoords
        });
        addIndices(mainDiagCoords);
      }

      // 4. Check Anti Diagonal (top-right to bottom-left)
      const antiDiagCoords: [number, number][] = [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]];
      if (antiDiagCoords.every(([row, col]) => isMarked(row, col))) {
        completedLines.push({
          id: 'diag-anti',
          type: 'diag',
          index: 1,
          name: 'Anti Diagonal',
          indices: antiDiagCoords
        });
        addIndices(antiDiagCoords);
      }

      const totalLinesCompleted = completedLines.length;
      const letters = ['B', 'I', 'N', 'G', 'O'].slice(0, Math.min(5, totalLinesCompleted));
      const isCompleted = totalLinesCompleted >= 5;

      return {
        current: Math.min(5, totalLinesCompleted),
        total: 5,
        isCompleted,
        completedPatternName: isCompleted ? 'BINGO (5 Lines)!' : `${totalLinesCompleted} / 5 Lines`,
        matchedIndices: allMatchedIndices,
        completedLines,
        bingoLetters: letters
      };
    }

    if (pattern === 'firstRow') {
      const coords: [number, number][] = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]];
      const matches = coords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: 5,
        isCompleted: matches.length === 5,
        completedPatternName: 'First Row',
        matchedIndices: matches
      };
    }

    if (pattern === 'middleRow') {
      const coords: [number, number][] = [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]];
      const matches = coords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: 5,
        isCompleted: matches.length === 5,
        completedPatternName: 'Middle Row',
        matchedIndices: matches
      };
    }

    if (pattern === 'lastRow') {
      const coords: [number, number][] = [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]];
      const matches = coords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: 5,
        isCompleted: matches.length === 5,
        completedPatternName: 'Last Row',
        matchedIndices: matches
      };
    }

    if (pattern === 'anyRow') {
      let bestCount = 0;
      let bestCoords: [number, number][] = [];
      let completedRowIdx = -1;

      for (let r = 0; r < 5; r++) {
        const coords: [number, number][] = [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]];
        const matches = coords.filter(([row, c]) => isMarked(row, c));
        if (matches.length > bestCount) {
          bestCount = matches.length;
          bestCoords = matches;
        }
        if (matches.length === 5) {
          completedRowIdx = r;
          bestCoords = coords;
          break;
        }
      }

      return {
        current: bestCount,
        total: 5,
        isCompleted: completedRowIdx !== -1,
        completedPatternName: completedRowIdx !== -1 ? `Row ${completedRowIdx + 1}` : 'Any Row',
        matchedIndices: bestCoords
      };
    }

    if (pattern === 'anyCol') {
      let bestCount = 0;
      let bestCoords: [number, number][] = [];
      let completedColIdx = -1;

      for (let c = 0; c < 5; c++) {
        const coords: [number, number][] = [[0, c], [1, c], [2, c], [3, c], [4, c]];
        const matches = coords.filter(([r, col]) => isMarked(r, col));
        if (matches.length > bestCount) {
          bestCount = matches.length;
          bestCoords = matches;
        }
        if (matches.length === 5) {
          completedColIdx = c;
          bestCoords = coords;
          break;
        }
      }

      return {
        current: bestCount,
        total: 5,
        isCompleted: completedColIdx !== -1,
        completedPatternName: completedColIdx !== -1 ? `Column ${completedColIdx + 1}` : 'Any Column',
        matchedIndices: bestCoords
      };
    }

    if (pattern === 'fourCorners') {
      const coords: [number, number][] = [[0, 0], [0, 4], [4, 0], [4, 4]];
      const matches = coords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: 4,
        isCompleted: matches.length === 4,
        completedPatternName: 'Four Corners',
        matchedIndices: matches
      };
    }

    if (pattern === 'xPattern') {
      const coords: [number, number][] = [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [0, 4], [1, 3], [3, 1], [4, 0]
      ];
      const matches = coords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: coords.length,
        isCompleted: matches.length === coords.length,
        completedPatternName: 'X Pattern',
        matchedIndices: matches
      };
    }

    if (pattern === 'plusPattern') {
      const coords: [number, number][] = [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [0, 2], [1, 2], [3, 2], [4, 2]
      ];
      const matches = coords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: coords.length,
        isCompleted: matches.length === coords.length,
        completedPatternName: 'Plus Pattern',
        matchedIndices: matches
      };
    }

    if (pattern === 'diagonal') {
      const d1: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
      const d2: [number, number][] = [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]];
      const m1 = d1.filter(([r, c]) => isMarked(r, c));
      const m2 = d2.filter(([r, c]) => isMarked(r, c));

      if (m1.length === 5) {
        return { current: 5, total: 5, isCompleted: true, completedPatternName: 'Main Diagonal', matchedIndices: d1 };
      }
      if (m2.length === 5) {
        return { current: 5, total: 5, isCompleted: true, completedPatternName: 'Anti Diagonal', matchedIndices: d2 };
      }

      const best = m1.length >= m2.length ? m1 : m2;
      return {
        current: best.length,
        total: 5,
        isCompleted: false,
        completedPatternName: 'Diagonal',
        matchedIndices: best
      };
    }

    if (pattern === 'fullHouse') {
      const allCoords: [number, number][] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          allCoords.push([r, c]);
        }
      }
      const matches = allCoords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total: 25,
        isCompleted: matches.length === 25,
        completedPatternName: 'Full House',
        matchedIndices: matches
      };
    }

    if (pattern === 'custom' && customPattern) {
      const targetCoords: [number, number][] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (customPattern[r]?.[c]) {
            targetCoords.push([r, c]);
          }
        }
      }
      const total = targetCoords.length > 0 ? targetCoords.length : 1;
      const matches = targetCoords.filter(([r, c]) => isMarked(r, c));
      return {
        current: matches.length,
        total,
        isCompleted: matches.length === total && targetCoords.length > 0,
        completedPatternName: 'Custom Pattern',
        matchedIndices: matches
      };
    }

    // Default fallback to anyRow
    return this.evaluatePattern(board, 'anyRow', playerMarks, calledNumbers);
  }

  /**
   * Validates a (possibly partial, untrusted) config against known enums/ranges and merges it onto `base`.
   * Throws an Error with a user-facing message when a field is invalid.
   */
  public static sanitizeConfig(input: unknown, base: BingoDuelConfig = DEFAULT_BINGO_DUEL_CONFIG): BingoDuelConfig {
    if (input === undefined || input === null) return { ...base };
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Config must be an object.');
    }
    const src = input as Record<string, unknown>;
    const out: BingoDuelConfig = { ...base };

    if (src.pattern !== undefined) {
      if (typeof src.pattern !== 'string' || !(BINGO_DUEL_PATTERNS as readonly string[]).includes(src.pattern)) {
        throw new Error('Unknown bingo pattern.');
      }
      out.pattern = src.pattern as BingoDuelPattern;
    }
    if (src.mode !== undefined) {
      if (typeof src.mode !== 'string' || !(BINGO_DUEL_MODES as readonly string[]).includes(src.mode)) {
        throw new Error('Unknown match mode.');
      }
      out.mode = src.mode as BingoDuelMode;
    }
    if (src.autoCallSpeed !== undefined) {
      const v = Number(src.autoCallSpeed);
      if (!Number.isFinite(v) || v < 0 || v > 60000) throw new Error('autoCallSpeed must be between 0 and 60000 ms.');
      out.autoCallSpeed = Math.round(v);
    }
    if (src.falseBingoPenalty !== undefined) {
      const v = Number(src.falseBingoPenalty);
      if (!Number.isFinite(v) || v < 0 || v > 30) throw new Error('falseBingoPenalty must be between 0 and 30 seconds.');
      out.falseBingoPenalty = Math.round(v);
    }
    if (src.voiceCaller !== undefined) {
      if (typeof src.voiceCaller !== 'boolean') throw new Error('voiceCaller must be a boolean.');
      out.voiceCaller = src.voiceCaller;
    }
    if (src.sound !== undefined) {
      if (typeof src.sound !== 'boolean') throw new Error('sound must be a boolean.');
      out.sound = src.sound;
    }
    if (src.customPattern !== undefined) {
      const cp = src.customPattern;
      const ok =
        Array.isArray(cp) &&
        cp.length === 5 &&
        cp.every(row => Array.isArray(row) && row.length === 5 && row.every(c => typeof c === 'boolean'));
      if (!ok) throw new Error('customPattern must be a 5x5 grid of booleans.');
      out.customPattern = (cp as boolean[][]).map(row => [...row]);
    }
    // An empty custom pattern can never be completed
    if (out.pattern === 'custom') {
      const any = out.customPattern?.some(row => row.some(Boolean));
      if (!any) throw new Error('A custom pattern needs at least one selected cell.');
    }
    return out;
  }

  private static isValidBoard(board: unknown): board is number[][] {
    if (!Array.isArray(board) || board.length !== 5) return false;
    const seen = new Set<number>();
    for (const row of board) {
      if (!Array.isArray(row) || row.length !== 5) return false;
      for (const n of row) {
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 25 || seen.has(n)) return false;
        seen.add(n);
      }
    }
    return seen.size === 25;
  }

  /**
   * Initializes a brand new Bingo Duel Game State
   */
  public static createInitialState(
    roomId: string,
    playerUserIds: string[],
    config: Partial<BingoDuelConfig> = {},
    existingBoards?: Record<string, number[][]>,
    starterIndex?: number
  ): BingoDuelGameState {
    const fullConfig: BingoDuelConfig = this.sanitizeConfig(config);

    let targetRounds = 1;
    if (fullConfig.mode === 'bestOf3') targetRounds = 2;
    else if (fullConfig.mode === 'bestOf5') targetRounds = 3;

    const boards: Record<string, number[][]> = {};
    const boardsReady: Record<string, boolean> = {};
    const playerMarks: Record<string, number[]> = {};
    const playerPicks: Record<string, number[]> = {};
    const playerProgress: Record<string, BingoDuelPatternProgress> = {};
    const roundsWon: Record<string, number> = {};

    playerUserIds.forEach(userId => {
      // Use an existing board only if it is a fully valid 5x5 of 1..25, otherwise generate a fresh one
      if (this.isValidBoard(existingBoards?.[userId])) {
        boards[userId] = existingBoards![userId];
      } else {
        boards[userId] = this.generateBoard();
      }
      boardsReady[userId] = true;
      playerMarks[userId] = [];
      playerPicks[userId] = [];
      playerProgress[userId] = { current: 0, total: 5, isCompleted: false };
      roundsWon[userId] = 0;
    });

    const callQueue = this.generateCallQueue();

    // Random starter so the host does not always move first
    const idx = playerUserIds.length === 0
      ? 0
      : (starterIndex !== undefined && Number.isInteger(starterIndex) && starterIndex >= 0
        ? starterIndex % playerUserIds.length
        : Math.floor(secureRandom() * playerUserIds.length));
    const starter = playerUserIds[idx] || null;

    return {
      roomId,
      config: fullConfig,
      boards,
      boardsReady,
      callQueue,
      calledNumbers: [],
      currentNumber: null,
      currentNumberWord: null,
      lastCalledNumbers: [],
      playerMarks,
      playerPicks,
      playerProgress,
      currentTurnUserId: starter,
      roundStarterUserId: starter,
      turnStartedAt: Date.now(),
      turnTimeoutMs: DUEL_TURN_TIMEOUT_MS,
      phase: 'PLAYING',
      currentRound: 1,
      targetRounds,
      roundsWon,
      roundHistory: [],
      winnerUserId: null,
      winnerDisplayName: null,
      lastRoundWinnerUserId: null,
      falseBingoPenaltyUntil: {},
      callingPaused: false,
      startedAt: Date.now(),
      statusMessage: 'Game started! Pick numbers alternatively.'
    };
  }

  /**
   * Allows a player to set their custom 5x5 board (1-25 unique integers).
   * Only allowed during a pre-start setup phase and before any number has been called;
   * once the match is running boards are locked (otherwise a player could build a winning board
   * from the numbers already called).
   */
  public static setPlayerBoard(
    state: BingoDuelGameState,
    userId: string,
    customBoard: number[][],
    allPlayerUserIds?: string[]
  ): { state: BingoDuelGameState; success: boolean; message: string; allReady: boolean } {
    if (state.phase !== 'SETUP' && state.phase !== 'CONFIGURING') {
      return { state, success: false, message: 'Boards are locked once the match has started.', allReady: false };
    }
    if (state.calledNumbers.length > 0) {
      return { state, success: false, message: 'Boards are locked once numbers have been called.', allReady: false };
    }
    if (allPlayerUserIds && allPlayerUserIds.length > 0 && !allPlayerUserIds.includes(userId)) {
      return { state, success: false, message: 'You are not a player in this match.', allReady: false };
    }
    if (!this.isValidBoard(customBoard)) {
      return {
        state,
        success: false,
        message: 'Board must be a 5x5 grid of integers containing every number from 1 to 25 exactly once.',
        allReady: false
      };
    }

    state.boards[userId] = customBoard.map(row => [...row]);
    if (!state.boardsReady) state.boardsReady = {};
    state.boardsReady[userId] = true;

    const list = state.playerMarks[userId] || [];
    state.playerProgress[userId] = this.evaluatePattern(
      state.boards[userId],
      state.config.pattern,
      list,
      state.calledNumbers,
      state.config.customPattern
    );

    const players = allPlayerUserIds && allPlayerUserIds.length > 0 ? allPlayerUserIds : Object.keys(state.boards);
    const allReady = players.length >= 2 && players.every(id => state.boardsReady?.[id] === true);

    if (allReady) {
      state.phase = 'PLAYING';
      state.startedAt = Date.now();
      state.turnStartedAt = Date.now();
      state.statusMessage = 'Both players ready! Match started! Pick numbers alternatively.';
    } else {
      state.statusMessage = 'Waiting for other player to select their numbers...';
    }

    return {
      state,
      success: true,
      message: allReady ? 'All players ready! Game starts!' : 'Ticket locked! Waiting for opponent...',
      allReady
    };
  }

  private static refreshProgress(state: BingoDuelGameState, userId: string): void {
    const board = state.boards[userId];
    if (board && board.length === 5) {
      state.playerProgress[userId] = this.evaluatePattern(
        board,
        state.config.pattern,
        state.playerMarks[userId] || [],
        state.calledNumbers,
        state.config.customPattern
      );
    }
  }

  /**
   * Called when all 25 numbers are out: if nobody can claim, the round resolves as a draw
   * instead of leaving the match stuck in PLAYING.
   */
  private static resolveExhaustion(state: BingoDuelGameState, playerUserIds: string[]): void {
    const anyone = playerUserIds.some(id => state.playerProgress[id]?.isCompleted);
    if (anyone) {
      state.statusMessage = 'All 25 numbers have been called! Claim BINGO now.';
      return;
    }
    state.phase = 'FINISHED';
    state.winnerUserId = null;
    state.winnerDisplayName = null;
    state.statusMessage = 'All 25 numbers were called and nobody completed the pattern. It is a draw!';
  }

  /**
   * Turn-based number selection: Host and Opponent alternate picking uncalled numbers
   */
  public static selectNumber(
    state: BingoDuelGameState,
    userId: string,
    numberToCall: number,
    playerUserIds: string[]
  ): {
    state: BingoDuelGameState;
    success: boolean;
    message: string;
    calledNumber?: number;
    isFinished?: boolean;
  } {
    if (state.phase !== 'PLAYING') {
      return { state, success: false, message: 'Game is not in playing phase.' };
    }

    if (!playerUserIds.includes(userId)) {
      return { state, success: false, message: 'You are not a player in this match.' };
    }

    if (state.currentTurnUserId && state.currentTurnUserId !== userId) {
      return { state, success: false, message: 'It is not your turn to pick a number.' };
    }

    if (typeof numberToCall !== 'number' || !Number.isInteger(numberToCall) || numberToCall < 1 || numberToCall > 25) {
      return { state, success: false, message: 'Number must be a whole number between 1 and 25.' };
    }

    if (state.calledNumbers.includes(numberToCall)) {
      return { state, success: false, message: `Number ${numberToCall} has already been called!` };
    }

    // Remove from callQueue
    state.callQueue = state.callQueue.filter(n => n !== numberToCall);

    // Record called number
    state.calledNumbers.push(numberToCall);
    state.currentNumber = numberToCall;
    state.currentNumberWord = this.getNumberWord(numberToCall);
    state.lastCalledNumbers = [numberToCall, ...state.lastCalledNumbers.filter(n => n !== numberToCall)].slice(0, 5);
    state.callerUserId = userId;

    // Track which player picked this number
    if (!state.playerPicks) state.playerPicks = {};
    if (!state.playerPicks[userId]) state.playerPicks[userId] = [];
    if (!state.playerPicks[userId].includes(numberToCall)) {
      state.playerPicks[userId].push(numberToCall);
    }

    // Automatically mark the called number for ALL players
    playerUserIds.forEach(pId => {
      if (!state.playerMarks[pId]) state.playerMarks[pId] = [];
      if (!state.playerMarks[pId].includes(numberToCall)) {
        state.playerMarks[pId].push(numberToCall);
      }
      this.refreshProgress(state, pId);
    });

    const isFinished = state.calledNumbers.length >= 25;
    if (isFinished) {
      this.resolveExhaustion(state, playerUserIds);
    } else {
      // Alternate turn to the next player
      const currentIdx = playerUserIds.indexOf(userId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % playerUserIds.length : 0;
      state.currentTurnUserId = playerUserIds[nextIdx];
      state.turnStartedAt = Date.now();
      state.statusMessage = `Number ${numberToCall} called! Next turn: Player ${nextIdx + 1}`;
    }

    return {
      state,
      success: true,
      message: `Number ${numberToCall} called!`,
      calledNumber: numberToCall,
      isFinished: isFinished && (state.phase as string) === 'FINISHED'
    };
  }

  /**
   * Picks a random uncalled number on behalf of the player whose turn timed out.
   */
  public static autoPick(
    state: BingoDuelGameState,
    playerUserIds: string[]
  ): ReturnType<typeof BingoDuelEngine.selectNumber> | null {
    if (state.phase !== 'PLAYING' || !state.currentTurnUserId) return null;
    const remaining = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !state.calledNumbers.includes(n));
    if (remaining.length === 0) return null;
    const pick = remaining[Math.floor(secureRandom() * remaining.length)];
    return this.selectNumber(state, state.currentTurnUserId, pick, playerUserIds);
  }

  public static isTurnExpired(state: BingoDuelGameState, now: number = Date.now()): boolean {
    if (state.phase !== 'PLAYING' || !state.currentTurnUserId || state.callingPaused) return false;
    const timeout = state.turnTimeoutMs ?? DUEL_TURN_TIMEOUT_MS;
    return now - (state.turnStartedAt ?? now) >= timeout;
  }

  /**
   * Calls the next random number from the queue (host/manual path). Marks the number for every board,
   * like a turn pick does.
   */
  public static callNext(state: BingoDuelGameState): {
    state: BingoDuelGameState;
    calledNumber: number | null;
    isFinished: boolean;
  } {
    if (state.phase !== 'PLAYING' || state.callingPaused) {
      return { state, calledNumber: null, isFinished: false };
    }

    if (state.callQueue.length === 0) {
      this.resolveExhaustion(state, Object.keys(state.boards));
      return { state, calledNumber: null, isFinished: state.phase !== 'PLAYING' };
    }

    const nextNum = state.callQueue.shift()!;
    state.calledNumbers.push(nextNum);
    state.currentNumber = nextNum;
    state.currentNumberWord = this.getNumberWord(nextNum);
    state.lastCalledNumbers = [nextNum, ...state.calledNumbers.slice(-6, -1).reverse()].slice(0, 5);
    state.statusMessage = `Number called: ${nextNum} (${state.currentNumberWord})`;

    const ids = Object.keys(state.boards);
    ids.forEach(pId => {
      if (!state.playerMarks[pId]) state.playerMarks[pId] = [];
      if (!state.playerMarks[pId].includes(nextNum)) state.playerMarks[pId].push(nextNum);
      this.refreshProgress(state, pId);
    });

    let isFinished = false;
    if (state.calledNumbers.length >= 25) {
      this.resolveExhaustion(state, ids);
      isFinished = state.phase !== 'PLAYING';
    }

    return { state, calledNumber: nextNum, isFinished };
  }

  /**
   * Marks a called number for a player. Idempotent (never un-marks) and only while PLAYING.
   */
  public static markNumber(
    state: BingoDuelGameState,
    userId: string,
    numberToMark: number
  ): { state: BingoDuelGameState; success: boolean } {
    if (state.phase !== 'PLAYING') return { state, success: false };
    if (!state.boards[userId]) return { state, success: false };
    if (typeof numberToMark !== 'number' || !Number.isInteger(numberToMark)) return { state, success: false };
    // Prevent marking numbers that have not been called yet
    if (!state.calledNumbers.includes(numberToMark)) {
      return { state, success: false };
    }

    if (!state.playerMarks[userId]) {
      state.playerMarks[userId] = [];
    }

    const list = state.playerMarks[userId];
    if (!list.includes(numberToMark)) list.push(numberToMark);

    this.refreshProgress(state, userId);

    return { state, success: true };
  }

  /**
   * Authoritatively validates a BINGO claim. Only valid while a round is being played.
   * If both players completed the pattern at the same time, the player who picked the last number
   * (callerUserId) wins the round; `winnerUserId` in the result names the actual winner.
   */
  public static claimBingo(
    state: BingoDuelGameState,
    userId: string,
    displayName: string,
    displayNames?: Record<string, string>
  ): {
    valid: boolean;
    message: string;
    penaltySeconds?: number;
    isMatchOver?: boolean;
    isRoundOver?: boolean;
    winningIndices?: [number, number][];
    winnerUserId?: string;
    winnerDisplayName?: string;
  } {
    if (state.phase !== 'PLAYING') {
      return { valid: false, message: 'There is no round in progress to claim.' };
    }

    // 1. Check if user is currently serving a False Bingo penalty cooldown
    const now = Date.now();
    const penaltyUntil = state.falseBingoPenaltyUntil[userId] || 0;
    if (now < penaltyUntil) {
      const remainingSec = Math.ceil((penaltyUntil - now) / 1000);
      return {
        valid: false,
        message: `Penalty active! Please wait ${remainingSec}s before claiming again.`,
        penaltySeconds: remainingSec
      };
    }

    const board = state.boards[userId];
    if (!board) {
      return { valid: false, message: 'Board not found' };
    }

    const evalFor = (uid: string) =>
      this.evaluatePattern(
        state.boards[uid],
        state.config.pattern,
        state.playerMarks[uid] || [],
        state.calledNumbers,
        state.config.customPattern
      );

    const progress = evalFor(userId);

    if (!progress.isCompleted) {
      // FALSE BINGO!
      const penaltySec = state.config.falseBingoPenalty || 0;
      if (penaltySec > 0) {
        state.falseBingoPenaltyUntil[userId] = now + penaltySec * 1000;
      }
      return {
        valid: false,
        message: 'Not yet! Pattern is incomplete.',
        penaltySeconds: penaltySec
      };
    }

    // Tie-break: both complete -> the picker of the completing number wins
    let winnerId = userId;
    let winnerProgress = progress;
    let winnerName = displayName;
    const caller = state.callerUserId;
    if (caller && caller !== userId && state.boards[caller]) {
      const callerProgress = evalFor(caller);
      if (callerProgress.isCompleted) {
        winnerId = caller;
        winnerProgress = callerProgress;
        winnerName = displayNames?.[caller] || state.roundHistory.find(r => r.winnerUserId === caller)?.winnerDisplayName || 'Opponent';
      }
    }

    // VALID BINGO CLAIM!
    state.roundsWon[winnerId] = (state.roundsWon[winnerId] || 0) + 1;
    const roundsWonCount = state.roundsWon[winnerId];
    const duration = Math.round((Date.now() - state.startedAt) / 1000);

    const roundSummary: BingoDuelRoundSummary = {
      round: state.currentRound,
      winnerUserId: winnerId,
      winnerDisplayName: winnerName,
      patternName: winnerProgress.completedPatternName || state.config.pattern,
      numbersCalledCount: state.calledNumbers.length,
      durationSeconds: duration
    };
    state.roundHistory.push(roundSummary);
    state.lastRoundWinnerUserId = winnerId;

    const isMatchOver = roundsWonCount >= state.targetRounds;

    if (isMatchOver) {
      state.phase = 'FINISHED';
      state.winnerUserId = winnerId;
      state.winnerDisplayName = winnerName;
      state.statusMessage = `${winnerName} won the Bingo Duel!`;
    } else {
      state.phase = 'ROUND_OVER';
      state.statusMessage = `${winnerName} won Round ${state.currentRound}! (${roundsWonCount}/${state.targetRounds})`;
    }

    return {
      valid: winnerId === userId,
      message: winnerId === userId
        ? `BINGO! ${displayName} completed ${progress.completedPatternName || 'the pattern'}!`
        : `Both of you completed the pattern, but ${winnerName} picked the final number and wins the round.`,
      isMatchOver,
      isRoundOver: !isMatchOver,
      winningIndices: winnerProgress.matchedIndices,
      winnerUserId: winnerId,
      winnerDisplayName: winnerName
    };
  }

  /**
   * Resets boards and numbers for the next round in a Best-of series. Only allowed from ROUND_OVER.
   * Returns the state unchanged (check `state.phase === 'PLAYING'` and round number) otherwise.
   */
  public static startNextRound(state: BingoDuelGameState): BingoDuelGameState {
    if (state.phase !== 'ROUND_OVER') return state;
    state.currentRound += 1;
    state.phase = 'PLAYING';
    state.callQueue = this.generateCallQueue();
    state.calledNumbers = [];
    state.currentNumber = null;
    state.currentNumberWord = null;
    state.lastCalledNumbers = [];
    state.falseBingoPenaltyUntil = {};
    state.callingPaused = false;
    state.callerUserId = null;
    state.startedAt = Date.now();
    state.turnStartedAt = Date.now();
    state.statusMessage = `Round ${state.currentRound} started! Pick numbers alternately.`;

    // Re-shuffle 5x5 boards for all players
    const picks = (state.playerPicks = state.playerPicks || {});
    const ids = Object.keys(state.boards);
    ids.forEach(uid => {
      state.boards[uid] = this.generateBoard();
      state.playerMarks[uid] = [];
      picks[uid] = [];
      state.playerProgress[uid] = { current: 0, total: 5, isCompleted: false };
    });

    // Alternate who starts each round
    if (ids.length > 0) {
      const prevIdx = Math.max(0, ids.indexOf(state.roundStarterUserId || ''));
      const next = ids[(prevIdx + 1) % ids.length];
      state.roundStarterUserId = next;
      state.currentTurnUserId = next;
    }

    return state;
  }
}

/**
 * Per-viewer projection of the state. Pure: returns a new object and never mutates `state`.
 * Removes everything a player must not know:
 *  - boards of other players (and of any non-player viewer),
 *  - the future call queue (replaced by [] plus `remainingCount`),
 *  - other players' marks (replaced by `markedCounts`),
 *  - the layout-revealing parts of other players' progress (matchedIndices / completedLines).
 */
export function publicStateFor(state: BingoDuelGameState, viewerId: string | null | undefined): BingoDuelGameState {
  if (!state) return state;
  const viewer = viewerId ?? '';
  const boards: Record<string, number[][]> = {};
  if (viewer && state.boards && state.boards[viewer]) boards[viewer] = state.boards[viewer];

  const playerMarks: Record<string, number[]> = {};
  const markedCounts: Record<string, number> = {};
  Object.entries(state.playerMarks || {}).forEach(([uid, marks]) => {
    markedCounts[uid] = marks.length;
    if (uid === viewer) playerMarks[uid] = [...marks];
  });

  const playerProgress: Record<string, BingoDuelPatternProgress> = {};
  Object.entries(state.playerProgress || {}).forEach(([uid, prog]) => {
    if (uid === viewer) {
      playerProgress[uid] = prog;
    } else {
      const { matchedIndices: _m, completedLines: _c, ...rest } = prog;
      playerProgress[uid] = rest;
    }
  });

  return {
    ...state,
    boards,
    callQueue: [],
    remainingCount: Math.max(0, 25 - (state.calledNumbers?.length ?? 0)),
    playerMarks,
    markedCounts,
    playerProgress
  };
}
