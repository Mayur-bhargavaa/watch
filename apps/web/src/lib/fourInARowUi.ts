export type FrColor = 'R' | 'Y';

/** Colour for a seat; null for viewers without a seat (never guess). */
export function colorForSeat(seat: number | null | undefined): FrColor | null {
  if (seat === 0) return 'R';
  if (seat === 1) return 'Y';
  return null;
}

export function victoryCopy(opts: {
  hasWinner: boolean;
  isDraw: boolean;
  hasWinningLine: boolean;
  winnerColor?: string | null;
  iWon: boolean;
}): { title: string; subtitle: string } {
  const color = (opts.winnerColor || '').toUpperCase();
  if (opts.hasWinner) {
    return {
      title: opts.iWon ? 'YOU WON!' : `${color || 'OPPONENT'} WINS!`,
      subtitle: opts.hasWinningLine
        ? `${color} connected 4 discs in a row!`
        : 'Won by forfeit: the opponent left the game.'
    };
  }
  if (opts.isDraw) {
    return { title: 'GAME DRAW!', subtitle: 'All 42 grid slots were filled with no 4-in-a-row.' };
  }
  return { title: 'GAME OVER', subtitle: 'The game has ended.' };
}

export function rematchButtonLabel(hasVoted: boolean, votedCount: number, totalNeeded: number): string {
  return hasVoted ? `Waiting (${votedCount}/${totalNeeded})` : 'Play Rematch';
}

/** Server-validated drop: integer column in range and top cell empty. */
export function canDropInColumn(board: (string | null)[][], col: number, rows = 6, cols = 7): boolean {
  if (!Number.isInteger(col) || col < 0 || col >= cols) return false;
  return Array.isArray(board) && board.length >= rows && board[0]?.[col] === null;
}
