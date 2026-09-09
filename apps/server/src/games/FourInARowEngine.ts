import { FourInARowGameState, FourInARowDisc } from '@synccinema/common';

export const FOUR_IN_A_ROW_ROWS = 6;
export const FOUR_IN_A_ROW_COLS = 7;

export class FourInARowEngine {
  /**
   * Initializes a brand new authoritative Four in a Row game state
   */
  public static createInitialState(
    players: Array<{ userId: string; displayName: string; seat: number }>,
    startingSeat = 0
  ): FourInARowGameState {
    const board: FourInARowDisc[][] = Array.from({ length: FOUR_IN_A_ROW_ROWS }, () =>
      Array(FOUR_IN_A_ROW_COLS).fill(null)
    );

    const firstPlayer = players.find(p => p.seat === startingSeat) || players[0];
    const initialColor: 'red' | 'yellow' = startingSeat === 0 ? 'red' : 'yellow';

    return {
      board,
      currentTurnSeat: startingSeat,
      currentTurnColor: initialColor,
      winner: null,
      winnerColor: null,
      winnerUserId: null,
      winningLine: null,
      isDraw: false,
      statusMessage: `${firstPlayer?.displayName || 'Player 1'}'s turn (${initialColor.toUpperCase()}) — Drop a disc!`,
      moveCount: 0
    };
  }

  /**
   * Finds the lowest available row index in a given column (5 is bottom, 0 is top)
   */
  public static getLowestEmptyRow(board: FourInARowDisc[][], col: number): number {
    if (col < 0 || col >= FOUR_IN_A_ROW_COLS) return -1;
    for (let r = FOUR_IN_A_ROW_ROWS - 1; r >= 0; r--) {
      if (!board[r][col]) return r;
    }
    return -1;
  }

  /**
   * Checks for 4-in-a-row connection across horizontal, vertical, and diagonals
   */
  public static checkWin(
    board: FourInARowDisc[][]
  ): { winner: 'R' | 'Y'; winningLine: [number, number][] } | null {
    // 1. Horizontal
    for (let r = 0; r < FOUR_IN_A_ROW_ROWS; r++) {
      for (let c = 0; c <= FOUR_IN_A_ROW_COLS - 4; c++) {
        const disc = board[r][c];
        if (
          disc &&
          disc === board[r][c + 1] &&
          disc === board[r][c + 2] &&
          disc === board[r][c + 3]
        ) {
          return {
            winner: disc,
            winningLine: [
              [r, c],
              [r, c + 1],
              [r, c + 2],
              [r, c + 3]
            ]
          };
        }
      }
    }

    // 2. Vertical
    for (let r = 0; r <= FOUR_IN_A_ROW_ROWS - 4; r++) {
      for (let c = 0; c < FOUR_IN_A_ROW_COLS; c++) {
        const disc = board[r][c];
        if (
          disc &&
          disc === board[r + 1][c] &&
          disc === board[r + 2][c] &&
          disc === board[r + 3][c]
        ) {
          return {
            winner: disc,
            winningLine: [
              [r, c],
              [r + 1, c],
              [r + 2, c],
              [r + 3, c]
            ]
          };
        }
      }
    }

    // 3. Diagonal / (bottom-left to top-right)
    for (let r = 3; r < FOUR_IN_A_ROW_ROWS; r++) {
      for (let c = 0; c <= FOUR_IN_A_ROW_COLS - 4; c++) {
        const disc = board[r][c];
        if (
          disc &&
          disc === board[r - 1][c + 1] &&
          disc === board[r - 2][c + 2] &&
          disc === board[r - 3][c + 3]
        ) {
          return {
            winner: disc,
            winningLine: [
              [r, c],
              [r - 1, c + 1],
              [r - 2, c + 2],
              [r - 3, c + 3]
            ]
          };
        }
      }
    }

    // 4. Diagonal \ (top-left to bottom-right)
    for (let r = 0; r <= FOUR_IN_A_ROW_ROWS - 4; r++) {
      for (let c = 0; c <= FOUR_IN_A_ROW_COLS - 4; c++) {
        const disc = board[r][c];
        if (
          disc &&
          disc === board[r + 1][c + 1] &&
          disc === board[r + 2][c + 2] &&
          disc === board[r + 3][c + 3]
        ) {
          return {
            winner: disc,
            winningLine: [
              [r, c],
              [r + 1, c + 1],
              [r + 2, c + 2],
              [r + 3, c + 3]
            ]
          };
        }
      }
    }

    return null;
  }

  /**
   * Executes a disc drop move authoritatively
   */
  public static dropDisc(
    state: FourInARowGameState,
    seat: number,
    col: number,
    player: { userId: string; displayName: string },
    players: Array<{ userId: string; displayName: string; seat: number }>
  ): {
    state: FourInARowGameState;
    row: number;
    col: number;
    disc: 'R' | 'Y';
    isWinner: boolean;
    isDraw: boolean;
  } {
    if (state.winner || state.isDraw) {
      throw new Error('Game is already finished');
    }

    if (seat !== state.currentTurnSeat) {
      throw new Error(`It is not your turn (Current seat: ${state.currentTurnSeat})`);
    }

    if (col < 0 || col >= FOUR_IN_A_ROW_COLS) {
      throw new Error(`Invalid column: ${col}`);
    }

    const row = this.getLowestEmptyRow(state.board, col);
    if (row === -1) {
      throw new Error(`Column ${col} is already full`);
    }

    const disc: 'R' | 'Y' = seat === 0 ? 'R' : 'Y';
    const discColor: 'red' | 'yellow' = seat === 0 ? 'red' : 'yellow';

    // Clone board
    const nextBoard = state.board.map(r => [...r]);
    nextBoard[row][col] = disc;

    const nextState: FourInARowGameState = {
      ...state,
      board: nextBoard,
      moveCount: state.moveCount + 1
    };

    // Check Win
    const winResult = this.checkWin(nextBoard);
    if (winResult) {
      nextState.winner = winResult.winner;
      nextState.winnerColor = discColor;
      nextState.winnerUserId = player.userId;
      nextState.winningLine = winResult.winningLine;
      nextState.statusMessage = `🎉 ${player.displayName} wins with 4 in a row!`;

      return {
        state: nextState,
        row,
        col,
        disc,
        isWinner: true,
        isDraw: false
      };
    }

    // Check Draw (all columns full)
    const isFull = nextBoard.every(r => r.every(cell => cell !== null));
    if (isFull) {
      nextState.isDraw = true;
      nextState.statusMessage = `🤝 Game Draw! All slots filled!`;

      return {
        state: nextState,
        row,
        col,
        disc,
        isWinner: false,
        isDraw: true
      };
    }

    // Switch turns
    const nextSeat = seat === 0 ? 1 : 0;
    const nextPlayer = players.find(p => p.seat === nextSeat);
    const nextColor: 'red' | 'yellow' = nextSeat === 0 ? 'red' : 'yellow';

    nextState.currentTurnSeat = nextSeat;
    nextState.currentTurnColor = nextColor;
    nextState.statusMessage = `${nextPlayer?.displayName || 'Next Player'}'s turn (${nextColor.toUpperCase()})`;

    return {
      state: nextState,
      row,
      col,
      disc,
      isWinner: false,
      isDraw: false
    };
  }
}
