import {
  BingoDuelPattern,
  BingoDuelMode,
  BingoDuelConfig,
  BingoDuelGameState,
  BingoDuelPatternProgress,
  BingoDuelRoundSummary,
  BingoDuelCompletedLine
} from '@synccinema/common';

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
      const j = Math.floor(Math.random() * (i + 1));
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
      const j = Math.floor(Math.random() * (i + 1));
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
   * Initializes a brand new Bingo Duel Game State
   */
  public static createInitialState(
    roomId: string,
    playerUserIds: string[],
    config: Partial<BingoDuelConfig> = {}
  ): BingoDuelGameState {
    const fullConfig: BingoDuelConfig = {
      ...DEFAULT_BINGO_DUEL_CONFIG,
      ...config
    };

    let targetRounds = 1;
    if (fullConfig.mode === 'bestOf3') targetRounds = 2;
    else if (fullConfig.mode === 'bestOf5') targetRounds = 3;

    const boards: Record<string, number[][]> = {};
    const boardsReady: Record<string, boolean> = {};
    const playerMarks: Record<string, number[]> = {};
    const playerProgress: Record<string, BingoDuelPatternProgress> = {};
    const roundsWon: Record<string, number> = {};

    playerUserIds.forEach(userId => {
      // Initialize with a default generated board so it is always populated,
      // but user can re-arrange/fill until match starts or lock in.
      boards[userId] = this.generateBoard();
      boardsReady[userId] = true; // default ready, can be customized
      playerMarks[userId] = [];
      playerProgress[userId] = { current: 0, total: 5, isCompleted: false };
      roundsWon[userId] = 0;
    });

    const callQueue = this.generateCallQueue();

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
      playerProgress,
      phase: 'PLAYING',
      currentRound: 1,
      targetRounds,
      roundsWon,
      roundHistory: [],
      winnerUserId: null,
      winnerDisplayName: null,
      falseBingoPenaltyUntil: {},
      callingPaused: false,
      startedAt: Date.now(),
      statusMessage: 'Game started! Calling numbers 1–25...'
    };
  }

  /**
   * Allows a player to set their custom 5x5 board (1-25 unique numbers)
   */
  public static setPlayerBoard(
    state: BingoDuelGameState,
    userId: string,
    customBoard: number[][]
  ): { state: BingoDuelGameState; success: boolean; message: string } {
    // Validate custom board is 5x5 containing unique numbers 1..25
    if (!Array.isArray(customBoard) || customBoard.length !== 5) {
      return { state, success: false, message: 'Board must be a 5x5 grid.' };
    }

    const flat = customBoard.flat();
    if (flat.length !== 25) {
      return { state, success: false, message: 'Board must contain exactly 25 numbers.' };
    }

    const seen = new Set<number>();
    for (const n of flat) {
      if (typeof n !== 'number' || n < 1 || n > 25 || seen.has(n)) {
        return {
          state,
          success: false,
          message: 'Board must contain all numbers from 1 to 25 without duplicates.'
        };
      }
      seen.add(n);
    }

    state.boards[userId] = customBoard;
    if (!state.boardsReady) state.boardsReady = {};
    state.boardsReady[userId] = true;

    // Reset marks and recalculate progress with existing called numbers
    const list = state.playerMarks[userId] || [];
    state.playerProgress[userId] = this.evaluatePattern(
      customBoard,
      state.config.pattern,
      list,
      state.calledNumbers,
      state.config.customPattern
    );

    return { state, success: true, message: '5×5 Board successfully saved and locked!' };
  }

  /**
   * Calls the next random number from the queue
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
      // All 25 numbers called!
      state.statusMessage = 'All 25 numbers have been called!';
      return { state, calledNumber: null, isFinished: true };
    }

    const nextNum = state.callQueue.shift()!;
    state.calledNumbers.push(nextNum);
    state.currentNumber = nextNum;
    state.currentNumberWord = this.getNumberWord(nextNum);
    state.lastCalledNumbers = [nextNum, ...state.calledNumbers.slice(-5, -1)].slice(0, 5);
    state.statusMessage = `Number called: ${nextNum} (${state.currentNumberWord})`;

    return { state, calledNumber: nextNum, isFinished: false };
  }

  /**
   * Marks or unmarks a called number for a player
   */
  public static markNumber(
    state: BingoDuelGameState,
    userId: string,
    numberToMark: number
  ): { state: BingoDuelGameState; success: boolean } {
    // Prevent marking numbers that have not been called yet
    const calledSet = new Set(state.calledNumbers);
    if (!calledSet.has(numberToMark)) {
      return { state, success: false };
    }

    if (!state.playerMarks[userId]) {
      state.playerMarks[userId] = [];
    }

    const list = state.playerMarks[userId];
    const idx = list.indexOf(numberToMark);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(numberToMark);
    }

    // Update player progress
    if (state.boards[userId]) {
      state.playerProgress[userId] = this.evaluatePattern(
        state.boards[userId],
        state.config.pattern,
        list,
        state.calledNumbers,
        state.config.customPattern
      );
    }

    return { state, success: true };
  }

  /**
   * Authoritatively validates a BINGO claim
   */
  public static claimBingo(
    state: BingoDuelGameState,
    userId: string,
    displayName: string
  ): {
    valid: boolean;
    message: string;
    penaltySeconds?: number;
    isMatchOver?: boolean;
    isRoundOver?: boolean;
    winningIndices?: [number, number][];
  } {
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

    const marks = state.playerMarks[userId] || [];
    const progress = this.evaluatePattern(
      board,
      state.config.pattern,
      marks,
      state.calledNumbers,
      state.config.customPattern
    );

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

    // VALID BINGO CLAIM!
    state.roundsWon[userId] = (state.roundsWon[userId] || 0) + 1;
    const roundsWonCount = state.roundsWon[userId];
    const duration = Math.round((Date.now() - state.startedAt) / 1000);

    const roundSummary: BingoDuelRoundSummary = {
      round: state.currentRound,
      winnerUserId: userId,
      winnerDisplayName: displayName,
      patternName: progress.completedPatternName || state.config.pattern,
      numbersCalledCount: state.calledNumbers.length,
      durationSeconds: duration
    };
    state.roundHistory.push(roundSummary);

    const isMatchOver = roundsWonCount >= state.targetRounds;

    if (isMatchOver) {
      state.phase = 'FINISHED';
      state.winnerUserId = userId;
      state.winnerDisplayName = displayName;
      state.statusMessage = `🎉 ${displayName} won the Bingo Duel!`;
    } else {
      state.phase = 'ROUND_OVER';
      state.statusMessage = `🎉 ${displayName} won Round ${state.currentRound}! (${roundsWonCount}/${state.targetRounds})`;
    }

    return {
      valid: true,
      message: `🎉 BINGO! ${displayName} completed ${progress.completedPatternName || 'the pattern'}!`,
      isMatchOver,
      isRoundOver: !isMatchOver,
      winningIndices: progress.matchedIndices
    };
  }

  /**
   * Resets boards and numbers for the next round in a Best-of series
   */
  public static startNextRound(state: BingoDuelGameState): BingoDuelGameState {
    state.currentRound += 1;
    state.phase = 'PLAYING';
    state.callQueue = this.generateCallQueue();
    state.calledNumbers = [];
    state.currentNumber = null;
    state.currentNumberWord = null;
    state.lastCalledNumbers = [];
    state.falseBingoPenaltyUntil = {};
    state.callingPaused = false;
    state.startedAt = Date.now();
    state.statusMessage = `Round ${state.currentRound} started! Calling numbers 1–25...`;

    // Re-shuffle 5x5 boards for all players
    Object.keys(state.boards).forEach(uid => {
      state.boards[uid] = this.generateBoard();
      state.playerMarks[uid] = [];
      state.playerProgress[uid] = { current: 0, total: 5, isCompleted: false };
    });

    return state;
  }
}
