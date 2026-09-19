import { TicTacToeGameState, TicTacToeMark } from '@synccinema/common';

export const WINNING_LINES: [number, number, number][] = [
  // Rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // Columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // Diagonals
  [0, 4, 8],
  [2, 4, 6]
];

export class TicTacToeEngine {
  /**
   * Initializes authoritative Tic Tac Toe state
   * Seat 0 = 'X', Seat 1 = 'O'
   */
  public static createInitialState(
    players: Array<{ userId: string; displayName: string; seat: number }>,
    startingSeat = 0
  ): TicTacToeGameState {
    const board: TicTacToeMark[] = Array(9).fill(null);
    const firstPlayer = players.find(p => p.seat === startingSeat) || players[0];
    const initialMark: 'X' | 'O' = startingSeat === 0 ? 'X' : 'O';

    return {
      board,
      currentTurnSeat: startingSeat,
      currentTurnMark: initialMark,
      winner: null,
      winnerUserId: null,
      winningLine: null,
      isDraw: false,
      statusMessage: `${firstPlayer?.displayName || 'Player 1'}'s turn (${initialMark}) — Tap an empty square!`,
      moveCount: 0
    };
  }

  /**
   * Checks for a 3-in-a-row line
   */
  public static checkWin(board: TicTacToeMark[]): { winner: 'X' | 'O'; winningLine: [number, number, number] } | null {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return {
          winner: board[a] as 'X' | 'O',
          winningLine: line
        };
      }
    }
    return null;
  }

  /**
   * Executes a Tic Tac Toe move authoritatively
   */
  public static makeMove(
    state: TicTacToeGameState,
    seat: number,
    cellIndex: number,
    player: { userId: string; displayName: string },
    players: Array<{ userId: string; displayName: string; seat: number }>
  ): {
    state: TicTacToeGameState;
    cellIndex: number;
    mark: 'X' | 'O';
    isWinner: boolean;
    isDraw: boolean;
  } {
    if (state.winner || state.isDraw) {
      throw new Error('Game is already finished');
    }

    if (seat !== state.currentTurnSeat) {
      throw new Error(`It is not your turn (Current seat: ${state.currentTurnSeat})`);
    }

    if (cellIndex < 0 || cellIndex >= 9) {
      throw new Error(`Invalid cell index: ${cellIndex}`);
    }

    if (state.board[cellIndex] !== null) {
      throw new Error(`Square ${cellIndex} is already occupied!`);
    }

    const mark: 'X' | 'O' = seat === 0 ? 'X' : 'O';
    const nextBoard = [...state.board];
    nextBoard[cellIndex] = mark;

    const nextState: TicTacToeGameState = {
      ...state,
      board: nextBoard,
      moveCount: state.moveCount + 1
    };

    // 1. Check Win
    const winResult = this.checkWin(nextBoard);
    if (winResult) {
      nextState.winner = winResult.winner;
      nextState.winnerUserId = player.userId;
      nextState.winningLine = winResult.winningLine;
      nextState.statusMessage = `🎉 ${player.displayName} wins with 3 in a row!`;

      return {
        state: nextState,
        cellIndex,
        mark,
        isWinner: true,
        isDraw: false
      };
    }

    // 2. Check Draw (all 9 cells filled)
    const isFull = nextBoard.every(cell => cell !== null);
    if (isFull) {
      nextState.isDraw = true;
      nextState.statusMessage = `🤝 Game Draw! Well played by both!`;

      return {
        state: nextState,
        cellIndex,
        mark,
        isWinner: false,
        isDraw: true
      };
    }

    // 3. Switch turn to other player
    const nextSeat = seat === 0 ? 1 : 0;
    const nextPlayer = players.find(p => p.seat === nextSeat);
    const nextMark: 'X' | 'O' = nextSeat === 0 ? 'X' : 'O';

    nextState.currentTurnSeat = nextSeat;
    nextState.currentTurnMark = nextMark;
    nextState.statusMessage = `${nextPlayer?.displayName || 'Opponent'}'s turn (${nextMark})`;

    return {
      state: nextState,
      cellIndex,
      mark,
      isWinner: false,
      isDraw: false
    };
  }
}
