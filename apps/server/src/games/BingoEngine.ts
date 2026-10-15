import {
  BingoMode,
  BingoWinCondition,
  BingoTicket,
  BingoRoomConfig,
  BingoGameState,
  BingoConditionProgress,
  BingoConditionClaim
} from '@synccinema/common';
import { secureRandom } from '../util/random.js';

const NUMBER_WORDS: Record<number, string> = {
  1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE',
  6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN',
  11: 'ELEVEN', 12: 'TWELVE', 13: 'THIRTEEN', 14: 'FOURTEEN', 15: 'FIFTEEN',
  16: 'SIXTEEN', 17: 'SEVENTEEN', 18: 'EIGHTEEN', 19: 'NINETEEN', 20: 'TWENTY',
  21: 'TWENTY-ONE', 22: 'TWENTY-TWO', 23: 'TWENTY-THREE', 24: 'TWENTY-FOUR', 25: 'TWENTY-FIVE',
  26: 'TWENTY-SIX', 27: 'TWENTY-SEVEN', 28: 'TWENTY-EIGHT', 29: 'TWENTY-NINE', 30: 'THIRTY',
  31: 'THIRTY-ONE', 32: 'THIRTY-TWO', 33: 'THIRTY-THREE', 34: 'THIRTY-FOUR', 35: 'THIRTY-FIVE',
  36: 'THIRTY-SIX', 37: 'THIRTY-SEVEN', 38: 'THIRTY-EIGHT', 39: 'THIRTY-NINE', 40: 'FORTY',
  41: 'FORTY-ONE', 42: 'FORTY-TWO', 43: 'FORTY-THREE', 44: 'FORTY-FOUR', 45: 'FORTY-FIVE',
  46: 'FORTY-SIX', 47: 'FORTY-SEVEN', 48: 'FORTY-EIGHT', 49: 'FORTY-NINE', 50: 'FIFTY',
  51: 'FIFTY-ONE', 52: 'FIFTY-TWO', 53: 'FIFTY-THREE', 54: 'FIFTY-FOUR', 55: 'FIFTY-FIVE',
  56: 'FIFTY-SIX', 57: 'FIFTY-SEVEN', 58: 'FIFTY-EIGHT', 59: 'FIFTY-NINE', 60: 'SIXTY',
  61: 'SIXTY-ONE', 62: 'SIXTY-TWO', 63: 'SIXTY-THREE', 64: 'SIXTY-FOUR', 65: 'SIXTY-FIVE',
  66: 'SIXTY-SIX', 67: 'SIXTY-SEVEN', 68: 'SIXTY-EIGHT', 69: 'SIXTY-NINE', 70: 'SEVENTY',
  71: 'SEVENTY-ONE', 72: 'SEVENTY-TWO', 73: 'SEVENTY-THREE', 74: 'SEVENTY-FOUR', 75: 'SEVENTY-FIVE',
  76: 'SEVENTY-SIX', 77: 'SEVENTY-SEVEN', 78: 'SEVENTY-EIGHT', 79: 'SEVENTY-NINE', 80: 'EIGHTY',
  81: 'EIGHTY-ONE', 82: 'EIGHTY-TWO', 83: 'EIGHTY-THREE', 84: 'EIGHTY-FOUR', 85: 'EIGHTY-FIVE',
  86: 'EIGHTY-SIX', 87: 'EIGHTY-SEVEN', 88: 'EIGHTY-EIGHT', 89: 'EIGHTY-NINE', 90: 'NINETY'
};

export const DEFAULT_BINGO_CONFIG: BingoRoomConfig = {
  mode: '90-ball',
  winConditions: {
    early5: true,
    topLine: true,
    middleLine: true,
    bottomLine: true,
    fourCorners: true,
    housefull: true,
    xPattern: false,
    crossPattern: false,
    starPattern: false,
    diamond: false,
    fullBorder: false,
    customPattern: false
  },
  callingSpeed: 3000,
  autoCall: true,
  points: {
    early5: 10,
    topLine: 20,
    middleLine: 20,
    bottomLine: 20,
    fourCorners: 30,
    housefull: 100,
    xPattern: 25,
    crossPattern: 25,
    starPattern: 40,
    diamond: 30,
    fullBorder: 35,
    customPattern: 50
  },
  falseClaimPenalty: 0
};

export class BingoEngine {
  public static getNumberWord(n: number): string {
    return NUMBER_WORDS[n] || String(n);
  }

  /**
   * Generates a genuine 90-ball Tambola ticket (3 rows x 9 columns, 5 numbers per row).
   * Column ranges:
   * Col 0: 1-9
   * Col 1: 10-19
   * Col 2: 20-29
   * Col 3: 30-39
   * Col 4: 40-49
   * Col 5: 50-59
   * Col 6: 60-69
   * Col 7: 70-79
   * Col 8: 80-90
   */
  public static generateTambolaTicket(): BingoTicket {
    const colRanges = [
      { min: 1, max: 9 },
      { min: 10, max: 19 },
      { min: 20, max: 29 },
      { min: 30, max: 39 },
      { min: 40, max: 49 },
      { min: 50, max: 59 },
      { min: 60, max: 69 },
      { min: 70, max: 79 },
      { min: 80, max: 90 }
    ];

    let grid: (number | null)[][] = [
      new Array(9).fill(null),
      new Array(9).fill(null),
      new Array(9).fill(null)
    ];

    let success = false;
    let attempts = 0;

    while (!success && attempts < 5000) {
      attempts++;
      grid = [
        new Array(9).fill(null),
        new Array(9).fill(null),
        new Array(9).fill(null)
      ];

      // Assign column counts such that sum is 15 and each col has at least 1 and at most 3
      const colCounts = new Array(9).fill(1); // 9 numbers assigned
      let remaining = 6;
      while (remaining > 0) {
        const c = Math.floor(secureRandom() * 9);
        if (colCounts[c] < 3) {
          colCounts[c]++;
          remaining--;
        }
      }

      // Pick numbers for each column
      const colNumbers: number[][] = [];
      for (let c = 0; c < 9; c++) {
        const { min, max } = colRanges[c];
        const pool: number[] = [];
        for (let num = min; num <= max; num++) pool.push(num);
        // Shuffle pool
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(secureRandom() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const picked = pool.slice(0, colCounts[c]).sort((a, b) => a - b);
        colNumbers.push(picked);
      }

      // Now place these into rows ensuring each row has exactly 5 numbers
      const rowCounts = [0, 0, 0];
      let placementOk = true;

      // First place columns with 3 items (must cover all 3 rows)
      for (let c = 0; c < 9; c++) {
        if (colCounts[c] === 3) {
          grid[0][c] = colNumbers[c][0];
          grid[1][c] = colNumbers[c][1];
          grid[2][c] = colNumbers[c][2];
          rowCounts[0]++;
          rowCounts[1]++;
          rowCounts[2]++;
        }
      }

      // Next place columns with 2 items
      for (let c = 0; c < 9; c++) {
        if (colCounts[c] === 2) {
          // pick 2 rows with smallest counts
          const candidateRows = [0, 1, 2].sort((r1, r2) => rowCounts[r1] - rowCounts[r2]);
          const rA = candidateRows[0];
          const rB = candidateRows[1];
          if (rowCounts[rA] >= 5 || rowCounts[rB] >= 5) {
            placementOk = false;
            break;
          }
          const [topR, botR] = rA < rB ? [rA, rB] : [rB, rA];
          grid[topR][c] = colNumbers[c][0];
          grid[botR][c] = colNumbers[c][1];
          rowCounts[topR]++;
          rowCounts[botR]++;
        }
      }

      if (!placementOk) continue;

      // Next place columns with 1 item
      for (let c = 0; c < 9; c++) {
        if (colCounts[c] === 1) {
          const eligibleRows = [0, 1, 2].filter(r => rowCounts[r] < 5);
          if (eligibleRows.length === 0) {
            placementOk = false;
            break;
          }
          eligibleRows.sort((r1, r2) => rowCounts[r1] - rowCounts[r2]);
          const chosenRow = eligibleRows[0];
          grid[chosenRow][c] = colNumbers[c][0];
          rowCounts[chosenRow]++;
        }
      }

      if (rowCounts[0] === 5 && rowCounts[1] === 5 && rowCounts[2] === 5 && this.isValidTambolaTicket({ cells: grid })) {
        success = true;
      }
    }

    if (!success) {
      // Never hand out a malformed ticket
      throw new Error('Failed to generate a valid Tambola ticket');
    }

    return { cells: grid };
  }

  /**
   * A valid 90-ball ticket: 3x9, exactly 5 numbers per row, 15 unique numbers, every column has 1-3 numbers
   * within its range (1-9, 10-19, ... 80-90) in ascending order from top to bottom.
   */
  public static isValidTambolaTicket(ticket: BingoTicket): boolean {
    const cells = ticket?.cells;
    if (!Array.isArray(cells) || cells.length !== 3) return false;
    const seen = new Set<number>();
    for (const row of cells) {
      if (!Array.isArray(row) || row.length !== 9) return false;
      if (row.filter(n => n !== null).length !== 5) return false;
    }
    for (let c = 0; c < 9; c++) {
      const min = c === 0 ? 1 : c * 10;
      const max = c === 8 ? 90 : c * 10 + 9;
      const col = [cells[0][c], cells[1][c], cells[2][c]].filter((n): n is number => n !== null);
      if (col.length < 1 || col.length > 3) return false;
      for (let i = 0; i < col.length; i++) {
        const n = col[i];
        if (!Number.isInteger(n) || n < min || n > max || seen.has(n)) return false;
        if (i > 0 && n <= col[i - 1]) return false;
        seen.add(n);
      }
    }
    return seen.size === 15;
  }

  /** Conditions that exist on a 90-ball ticket (the only mode offered for Tambola) */
  public static readonly SUPPORTED_CONDITIONS: BingoWinCondition[] = [
    'early5', 'topLine', 'middleLine', 'bottomLine', 'fourCorners', 'housefull'
  ];

  /**
   * Validates an untrusted (partial) host config and merges it onto `base`. Throws Error with a user-facing message.
   * Mode is always 90-ball; unsupported prizes are forced off.
   */
  public static sanitizeConfig(input: unknown, base: BingoRoomConfig = DEFAULT_BINGO_CONFIG): BingoRoomConfig {
    const out: BingoRoomConfig = {
      ...base,
      mode: '90-ball',
      winConditions: { ...base.winConditions },
      points: { ...base.points }
    };
    delete (out as any).customPattern;
    if (input === undefined || input === null) return this.finalizeConfig(out);
    if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Config must be an object.');
    const src = input as Record<string, any>;

    if (src.mode !== undefined && src.mode !== '90-ball') {
      throw new Error('Tambola only supports the 90-ball mode.');
    }
    if (src.callingSpeed !== undefined) {
      const v = Number(src.callingSpeed);
      if (src.callingSpeed === null || src.callingSpeed === '' || !Number.isFinite(v) || v < 800 || v > 30000) {
        throw new Error('callingSpeed must be between 800 and 30000 ms.');
      }
      out.callingSpeed = Math.round(v);
    }
    if (src.autoCall !== undefined) {
      if (typeof src.autoCall !== 'boolean') throw new Error('autoCall must be a boolean.');
      out.autoCall = src.autoCall;
    }
    if (src.falseClaimPenalty !== undefined) {
      const v = Number(src.falseClaimPenalty);
      if (src.falseClaimPenalty === null || !Number.isFinite(v) || v < 0 || v > 60) {
        throw new Error('falseClaimPenalty must be between 0 and 60 seconds.');
      }
      out.falseClaimPenalty = Math.round(v);
    }
    if (src.winConditions !== undefined) {
      if (!src.winConditions || typeof src.winConditions !== 'object' || Array.isArray(src.winConditions)) {
        throw new Error('winConditions must be an object.');
      }
      for (const [k, v] of Object.entries(src.winConditions)) {
        if (!(this.SUPPORTED_CONDITIONS as string[]).includes(k)) {
          if (v) throw new Error(`Prize "${k}" is not available in Tambola.`);
          continue;
        }
        if (typeof v !== 'boolean') throw new Error(`winConditions.${k} must be a boolean.`);
        (out.winConditions as any)[k] = v;
      }
    }
    if (src.points !== undefined) {
      if (!src.points || typeof src.points !== 'object' || Array.isArray(src.points)) {
        throw new Error('points must be an object.');
      }
      for (const [k, v] of Object.entries(src.points)) {
        if (!(this.SUPPORTED_CONDITIONS as string[]).includes(k)) continue;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1000) {
          throw new Error(`points.${k} must be a number between 0 and 1000.`);
        }
        (out.points as any)[k] = Math.round(v);
      }
    }
    return this.finalizeConfig(out);
  }

  private static finalizeConfig(cfg: BingoRoomConfig): BingoRoomConfig {
    const all = Object.keys(cfg.winConditions) as BingoWinCondition[];
    all.forEach(k => {
      if (!this.SUPPORTED_CONDITIONS.includes(k)) cfg.winConditions[k] = false;
    });
    if (!this.SUPPORTED_CONDITIONS.some(k => cfg.winConditions[k])) cfg.winConditions.housefull = true;
    return cfg;
  }

  /**
   * Generates a standard 75-ball 5x5 Bingo ticket (B-I-N-G-O)
   * Col 0 (B): 1-15
   * Col 1 (I): 16-30
   * Col 2 (N): 31-45 (center [2][2] is FREE space, marked as null or 0)
   * Col 3 (G): 46-60
   * Col 4 (O): 61-75
   */
  public static generate75BallTicket(): BingoTicket {
    const colRanges = [
      { min: 1, max: 15 },
      { min: 16, max: 30 },
      { min: 31, max: 45 },
      { min: 46, max: 60 },
      { min: 61, max: 75 }
    ];

    const grid: (number | null)[][] = Array.from({ length: 5 }, () => new Array(5).fill(null));

    for (let c = 0; c < 5; c++) {
      const { min, max } = colRanges[c];
      const pool: number[] = [];
      for (let num = min; num <= max; num++) pool.push(num);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(secureRandom() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      for (let r = 0; r < 5; r++) {
        if (c === 2 && r === 2) {
          grid[r][c] = null; // Free space
        } else {
          grid[r][c] = pool[r];
        }
      }
    }

    return { cells: grid };
  }

  /**
   * Generates shuffled call queue
   */
  public static generateCallQueue(mode: BingoMode): number[] {
    const total = mode === '75-ball' ? 75 : 90;
    const queue: number[] = [];
    for (let i = 1; i <= total; i++) queue.push(i);

    // Fisher-Yates shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(secureRandom() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue;
  }

  /**
   * Initializes state for a new room
   */
  public static createInitialState(
    players: { userId: string; displayName: string }[],
    config: BingoRoomConfig = DEFAULT_BINGO_CONFIG
  ): BingoGameState {
    config = this.sanitizeConfig(config);
    const tickets: Record<string, BingoTicket> = {};
    const playerMarked: Record<string, number[]> = {};
    const scores: Record<string, number> = {};
    const playerNames: Record<string, string> = {};

    players.forEach(p => {
      playerNames[p.userId] = p.displayName;
      tickets[p.userId] = this.generateTambolaTicket();
      playerMarked[p.userId] = [];
      scores[p.userId] = 0;
    });

    const callQueue = this.generateCallQueue(config.mode);

    const state: BingoGameState = {
      mode: config.mode,
      config,
      callQueue,
      calledNumbers: [],
      currentNumber: null,
      currentNumberWord: null,
      lastCalledNumbers: [],
      tickets,
      playerMarked,
      scores,
      claimedConditions: {},
      conditionProgress: {},
      phase: 'PLAYING',
      winnerUserId: null,
      winnerDisplayName: null,
      statusMessage: 'Game started! Calling numbers...',
      callingPaused: false,
      gameSummary: null,
      playerNames
    };

    // Calculate initial condition progress for all players
    players.forEach(p => {
      state.conditionProgress[p.userId] = this.calculateAllProgress(
        tickets[p.userId],
        [],
        config,
        {}
      );
    });

    return state;
  }

  /**
   * Calls the next number from the queue
   */
  public static callNext(state: BingoGameState): {
    state: BingoGameState;
    calledNumber: number | null;
    isFinished: boolean;
  } {
    if (state.phase !== 'PLAYING') {
      return { state, calledNumber: null, isFinished: state.phase === 'FINISHED' };
    }
    if (state.callQueue.length === 0) {
      this.finishGame(state, 'All numbers have been called!');
      return { state, calledNumber: null, isFinished: true };
    }

    const nextNum = state.callQueue.shift()!;
    state.calledNumbers.push(nextNum);
    state.currentNumber = nextNum;
    state.currentNumberWord = this.getNumberWord(nextNum);

    // Keep last 5 called numbers (excluding currentNumber)
    state.lastCalledNumbers = state.calledNumbers.slice(-6, -1).reverse();

    // Auto mark player numbers if desired, or sync progress based on calledNumbers
    Object.keys(state.tickets).forEach(userId => {
      state.conditionProgress[userId] = this.calculateAllProgress(
        state.tickets[userId],
        state.calledNumbers,
        state.config,
        state.claimedConditions
      );
    });

    state.statusMessage = `Number called: ${nextNum} (${state.currentNumberWord})`;

    return { state, calledNumber: nextNum, isFinished: false };
  }

  /**
   * Marks (default) or unmarks (forceMark === false) a number on the player's own ticket.
   * Idempotent. Only integers that are on the caller's ticket and already called are accepted, and only while PLAYING.
   * Returns the (possibly unchanged) state; check `state.playerMarked` for the effect.
   */
  public static markNumber(
    state: BingoGameState,
    userId: string,
    numberToMark: number,
    forceMark?: boolean
  ): BingoGameState {
    if (state.phase !== 'PLAYING') return state;
    const ticket = state.tickets[userId];
    if (!ticket) return state;
    if (typeof numberToMark !== 'number' || !Number.isInteger(numberToMark)) return state;
    const onTicket = ticket.cells.some(row => row.some(n => n === numberToMark));
    if (!onTicket) return state;
    if (!state.calledNumbers.includes(numberToMark)) return state;

    if (!state.playerMarked[userId]) state.playerMarked[userId] = [];
    const list = state.playerMarked[userId];
    const idx = list.indexOf(numberToMark);
    if (forceMark === false) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx < 0) {
      list.push(numberToMark);
    }
    return state;
  }

  /**
   * Ends the game, derives the final winner (highest score; ties go to the Housefull claimer, then the earliest
   * claim) and fills the summary.
   */
  public static finishGame(state: BingoGameState, statusMessage?: string): void {
    state.phase = 'FINISHED';
    const names = state.playerNames || {};
    const claims = Object.values(state.claimedConditions);
    const entries = Object.entries(state.scores);
    const topScore = entries.reduce((m, [, sc]) => Math.max(m, sc), 0);
    let topUser: string | null = null;
    if (topScore > 0) {
      const candidates = entries.filter(([, sc]) => sc === topScore).map(([uid]) => uid);
      const hf = state.claimedConditions.housefull?.claimedByUserId;
      if (candidates.length === 1) topUser = candidates[0];
      else if (hf && candidates.includes(hf)) topUser = hf;
      else {
        const first = (id: string) => Math.min(...claims.filter(c => c.claimedByUserId === id).map(c => c.claimedAt));
        topUser = candidates.sort((x, y) => first(x) - first(y))[0];
      }
    }

    const nameOf = (uid: string | null): string | null => {
      if (!uid) return null;
      return names[uid]
        || claims.find(c => c.claimedByUserId === uid)?.claimedByDisplayName
        || null;
    };
    state.winnerUserId = topUser;
    state.winnerDisplayName = nameOf(topUser);
    state.gameSummary = {
      winnerUserId: state.winnerUserId,
      winnerDisplayName: state.winnerDisplayName,
      finalScores: { ...state.scores },
      roundsWon: claims.map(c => ({ condition: c.condition, winnerName: c.claimedByDisplayName, points: c.points }))
    };
    if (statusMessage) state.statusMessage = statusMessage;
  }

  /**
   * Gets list of numbers in ticket that belong to a specific win condition
   */
  public static getTargetNumbersForCondition(
    ticket: BingoTicket,
    condition: BingoWinCondition,
    config: BingoRoomConfig
  ): number[] {
    const cells = ticket.cells;
    const is75 = cells.length === 5;

    if (is75) {
      // 5x5 Grid
      switch (condition) {
        case 'topLine':
          return cells[0].filter((n): n is number => n !== null);
        case 'middleLine':
          return cells[2].filter((n): n is number => n !== null);
        case 'bottomLine':
          return cells[4].filter((n): n is number => n !== null);
        case 'fourCorners': {
          const corners = [cells[0][0], cells[0][4], cells[4][0], cells[4][4]];
          return corners.filter((n): n is number => n !== null);
        }
        case 'xPattern': {
          const diag: number[] = [];
          for (let i = 0; i < 5; i++) {
            if (cells[i][i] !== null) diag.push(cells[i][i]!);
            if (cells[i][4 - i] !== null && i !== 2) diag.push(cells[i][4 - i]!);
          }
          return diag;
        }
        case 'crossPattern': {
          const cross: number[] = [];
          for (let i = 0; i < 5; i++) {
            if (cells[2][i] !== null) cross.push(cells[2][i]!);
            if (cells[i][2] !== null && i !== 2) cross.push(cells[i][2]!);
          }
          return cross;
        }
        case 'diamond': {
          const coords = [[0, 2], [1, 1], [1, 3], [2, 0], [2, 4], [3, 1], [3, 3], [4, 2]];
          const list: number[] = [];
          for (const [r, c] of coords) {
            if (cells[r][c] !== null) list.push(cells[r][c]!);
          }
          return list;
        }
        case 'fullBorder': {
          const border: number[] = [];
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              if (r === 0 || r === 4 || c === 0 || c === 4) {
                if (cells[r][c] !== null) border.push(cells[r][c]!);
              }
            }
          }
          return border;
        }
        case 'customPattern': {
          if (!config.customPattern) return [];
          const custom: number[] = [];
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              if (config.customPattern[r]?.[c] && cells[r][c] !== null) {
                custom.push(cells[r][c]!);
              }
            }
          }
          return custom;
        }
        case 'housefull': {
          const all: number[] = [];
          cells.forEach(row => row.forEach(n => { if (n !== null) all.push(n); }));
          return all;
        }
        default:
          return [];
      }
    }

    // 90-ball (3 rows x 9 cols, 15 numbers total)
    switch (condition) {
      case 'early5': {
        const all: number[] = [];
        cells.forEach(row => row.forEach(n => { if (n !== null) all.push(n); }));
        return all;
      }
      case 'topLine':
        return cells[0].filter((n): n is number => n !== null);
      case 'middleLine':
        return cells[1].filter((n): n is number => n !== null);
      case 'bottomLine':
        return cells[2].filter((n): n is number => n !== null);
      case 'fourCorners': {
        // In Tambola: first and last number of top row + first and last number of bottom row
        const topNums = cells[0].filter((n): n is number => n !== null);
        const botNums = cells[2].filter((n): n is number => n !== null);
        if (topNums.length >= 2 && botNums.length >= 2) {
          return [topNums[0], topNums[topNums.length - 1], botNums[0], botNums[botNums.length - 1]];
        }
        return [];
      }
      case 'housefull': {
        const all: number[] = [];
        cells.forEach(row => row.forEach(n => { if (n !== null) all.push(n); }));
        return all;
      }
      default:
        return [];
    }
  }

  /**
   * Calculates progress for all conditions on a ticket given the called numbers
   */
  public static calculateAllProgress(
    ticket: BingoTicket,
    calledNumbers: number[],
    config: BingoRoomConfig,
    claimedConditions: Record<string, BingoConditionClaim>
  ): Record<string, BingoConditionProgress> {
    const calledSet = new Set(calledNumbers);
    const progress: Record<string, BingoConditionProgress> = {};

    const conditions: BingoWinCondition[] = [
      'early5', 'topLine', 'middleLine', 'bottomLine',
      'fourCorners', 'housefull', 'xPattern', 'crossPattern',
      'starPattern', 'diamond', 'fullBorder', 'customPattern'
    ];

    conditions.forEach(cond => {
      if (!config.winConditions[cond]) return;

      const targetNumbers = this.getTargetNumbersForCondition(ticket, cond, config);
      const isAlreadyClaimed = Boolean(claimedConditions[cond]);
      const claimedBy = claimedConditions[cond]?.claimedByDisplayName;

      if (cond === 'early5') {
        const allTicketNums = targetNumbers;
        const markedCount = allTicketNums.filter(n => calledSet.has(n)).length;
        const current = Math.min(5, markedCount);
        progress[cond] = {
          current,
          total: 5,
          isMet: current >= 5,
          claimed: isAlreadyClaimed,
          claimedBy
        };
        return;
      }

      const total = targetNumbers.length;
      if (total === 0) {
        progress[cond] = { current: 0, total: 0, isMet: false, claimed: isAlreadyClaimed, claimedBy };
        return;
      }

      const current = targetNumbers.filter(n => calledSet.has(n)).length;
      progress[cond] = {
        current,
        total,
        isMet: current >= total,
        claimed: isAlreadyClaimed,
        claimedBy
      };
    });

    return progress;
  }

  /**
   * Server authoritative validation of a claim
   */
  public static validateClaim(
    state: BingoGameState,
    userId: string,
    displayName: string,
    condition: BingoWinCondition
  ): {
    valid: boolean;
    message: string;
    pointsEarned: number;
    penaltySeconds: number;
  } {
    if (state.phase !== 'PLAYING') {
      return { valid: false, message: 'The game is not in progress.', pointsEarned: 0, penaltySeconds: 0 };
    }
    if (typeof condition !== 'string' || !(this.SUPPORTED_CONDITIONS as string[]).includes(condition)) {
      return { valid: false, message: 'Unknown winning condition.', pointsEarned: 0, penaltySeconds: 0 };
    }

    // 1. Check if user is currently penalized
    if (state.penaltyUntil && state.penaltyUntil[userId]) {
      const remainingMs = state.penaltyUntil[userId] - Date.now();
      if (remainingMs > 0) {
        const remainingSec = Math.ceil(remainingMs / 1000);
        return {
          valid: false,
          message: `False claim penalty active! Please wait ${remainingSec}s before claiming again.`,
          pointsEarned: 0,
          penaltySeconds: remainingSec
        };
      }
    }

    // 2. Check if condition is enabled
    if (!state.config.winConditions[condition]) {
      return {
        valid: false,
        message: 'This winning condition is not enabled in this room.',
        pointsEarned: 0,
        penaltySeconds: 0
      };
    }

    // 3. Check if condition was already claimed by any player
    if (state.claimedConditions[condition]) {
      const claim = state.claimedConditions[condition];
      return {
        valid: false,
        message: `${this.getConditionFriendlyName(condition)} was already claimed by ${claim.claimedByDisplayName}!`,
        pointsEarned: 0,
        penaltySeconds: 0
      };
    }

    const ticket = state.tickets[userId];
    if (!ticket) {
      return {
        valid: false,
        message: 'Player ticket not found.',
        pointsEarned: 0,
        penaltySeconds: 0
      };
    }

    const targetNumbers = this.getTargetNumbersForCondition(ticket, condition, state.config);
    if (targetNumbers.length === 0) {
      return { valid: false, message: 'This prize cannot be claimed on your ticket.', pointsEarned: 0, penaltySeconds: 0 };
    }
    const calledSet = new Set(state.calledNumbers);

    let isMet = false;
    let needed = 0;

    if (condition === 'early5') {
      const matched = targetNumbers.filter(n => calledSet.has(n)).length;
      isMet = matched >= 5;
      needed = Math.max(0, 5 - matched);
    } else {
      const matched = targetNumbers.filter(n => calledSet.has(n)).length;
      isMet = matched >= targetNumbers.length;
      needed = Math.max(0, targetNumbers.length - matched);
    }

    if (!isMet) {
      // False Claim! Apply penalty if configured
      const penaltySec = state.config.falseClaimPenalty || 0;
      if (penaltySec > 0) {
        if (!state.penaltyUntil) state.penaltyUntil = {};
        state.penaltyUntil[userId] = Date.now() + penaltySec * 1000;
      }

      const condName = this.getConditionFriendlyName(condition);
      const penaltyMsg = penaltySec > 0 ? ` (${penaltySec}s penalty applied)` : '';
      return {
        valid: false,
        message: `Not yet. ${condName} needs ${needed} more number${needed > 1 ? 's' : ''}.${penaltyMsg}`,
        pointsEarned: 0,
        penaltySeconds: penaltySec
      };
    }

    // VALID CLAIM!
    const points = state.config.points[condition] ?? 10;
    state.scores[userId] = (state.scores[userId] || 0) + points;

    state.claimedConditions[condition] = {
      condition,
      claimedByUserId: userId,
      claimedByDisplayName: displayName,
      claimedAt: Date.now(),
      points
    };

    // Update condition progress across all players
    Object.keys(state.tickets).forEach(uId => {
      state.conditionProgress[uId] = this.calculateAllProgress(
        state.tickets[uId],
        state.calledNumbers,
        state.config,
        state.claimedConditions
      );
    });

    const condName = this.getConditionFriendlyName(condition);

    // Check if Housefull or all enabled conditions are completed -> End game
    const enabledConditions = Object.entries(state.config.winConditions)
      .filter(([cond, enabled]) => enabled && (this.SUPPORTED_CONDITIONS as string[]).includes(cond))
      .map(([cond]) => cond);

    const housefullClaimed = Boolean(state.claimedConditions.housefull);
    const allEnabledClaimed = enabledConditions.every(c => Boolean(state.claimedConditions[c]));

    if (housefullClaimed || allEnabledClaimed) {
      this.finishGame(state, `${displayName} completed ${condName}! Game Finished!`);
    } else {
      state.statusMessage = `${displayName} won ${condName}! (+${points} pts)`;
    }

    return {
      valid: true,
      message: `BINGO! You won ${condName}! (+${points} points)`,
      pointsEarned: points,
      penaltySeconds: 0
    };
  }

  public static getConditionFriendlyName(cond: BingoWinCondition): string {
    const names: Record<BingoWinCondition, string> = {
      early5: 'Early 5',
      topLine: 'Top Line',
      middleLine: 'Middle Line',
      bottomLine: 'Bottom Line',
      fourCorners: 'Four Corners',
      housefull: 'Housefull',
      xPattern: 'X Pattern',
      crossPattern: 'Cross Pattern',
      starPattern: 'Star Pattern',
      diamond: 'Diamond',
      fullBorder: 'Full Border',
      customPattern: 'Custom Pattern'
    };
    return names[cond] || cond;
  }
}

/**
 * Per-viewer projection of the Tambola state. Pure (never mutates `state`).
 * Removes the future draw order (callQueue -> [] plus remainingCount), every other player's ticket and marks
 * (replaced by markedCounts).
 */
export function publicStateFor(state: BingoGameState, viewerId: string | null | undefined): BingoGameState {
  if (!state) return state;
  const viewer = viewerId ?? '';
  const tickets: Record<string, BingoTicket> = {};
  if (viewer && state.tickets && state.tickets[viewer]) tickets[viewer] = state.tickets[viewer];
  const playerMarked: Record<string, number[]> = {};
  const markedCounts: Record<string, number> = {};
  Object.entries(state.playerMarked || {}).forEach(([uid, marks]) => {
    markedCounts[uid] = marks.length;
    if (uid === viewer) playerMarked[uid] = [...marks];
  });
  return {
    ...state,
    callQueue: [],
    remainingCount: state.callQueue?.length ?? 0,
    tickets,
    playerMarked,
    markedCounts
  };
}
