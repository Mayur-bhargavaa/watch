'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Trophy, User, Bot, Sparkles } from 'lucide-react';

export type Disc = 'R' | 'Y' | null;

interface ConnectFourProps {
  sendGameAction?: (payload: any) => void;
  registerGameListener?: (listener: (senderId: string, payload: any) => void) => () => void;
  myUserName?: string;
  isCompact?: boolean;
}

const ROWS = 6;
const COLS = 7;

function createEmptyBoard(): Disc[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkWin(board: Disc[][]): { winner: 'R' | 'Y'; winningCells: [number, number][] } | null {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const disc = board[r][c];
      if (disc && disc === board[r][c + 1] && disc === board[r][c + 2] && disc === board[r][c + 3]) {
        return { winner: disc, winningCells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
      }
    }
  }

  // Vertical
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      const disc = board[r][c];
      if (disc && disc === board[r + 1][c] && disc === board[r + 2][c] && disc === board[r + 3][c]) {
        return { winner: disc, winningCells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
      }
    }
  }

  // Diagonal /
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const disc = board[r][c];
      if (disc && disc === board[r - 1][c + 1] && disc === board[r - 2][c + 2] && disc === board[r - 3][c + 3]) {
        return { winner: disc, winningCells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
      }
    }
  }

  // Diagonal \
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const disc = board[r][c];
      if (disc && disc === board[r + 1][c + 1] && disc === board[r + 2][c + 2] && disc === board[r + 3][c + 3]) {
        return { winner: disc, winningCells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
      }
    }
  }

  return null;
}

function findBestBotMove(board: Disc[][]): number {
  // 1. Can bot (Yellow) win immediately?
  for (let c = 0; c < COLS; c++) {
    const row = getLowestEmptyRow(board, c);
    if (row !== -1) {
      board[row][c] = 'Y';
      if (checkWin(board)?.winner === 'Y') {
        board[row][c] = null;
        return c;
      }
      board[row][c] = null;
    }
  }

  // 2. Can player (Red) win next turn? Block them!
  for (let c = 0; c < COLS; c++) {
    const row = getLowestEmptyRow(board, c);
    if (row !== -1) {
      board[row][c] = 'R';
      if (checkWin(board)?.winner === 'R') {
        board[row][c] = null;
        return c;
      }
      board[row][c] = null;
    }
  }

  // 3. Prefer center columns
  const colOrder = [3, 2, 4, 1, 5, 0, 6];
  for (const c of colOrder) {
    if (getLowestEmptyRow(board, c) !== -1) {
      return c;
    }
  }

  return 0;
}

function getLowestEmptyRow(board: Disc[][], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return -1;
}

export const ConnectFour: React.FC<ConnectFourProps> = ({
  sendGameAction,
  registerGameListener,
  myUserName = 'Player 1',
  isCompact = false
}) => {
  const [board, setBoard] = useState<Disc[][]>(createEmptyBoard);
  const [currentPlayer, setCurrentPlayer] = useState<'R' | 'Y'>('R');
  const [winnerInfo, setWinnerInfo] = useState<{ winner: 'R' | 'Y'; winningCells: [number, number][] } | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [vsBot, setVsBot] = useState(true);
  const [scores, setScores] = useState({ R: 0, Y: 0 });

  // Listen to remote WebSocket party moves
  useEffect(() => {
    if (!registerGameListener) return;
    const unregister = registerGameListener((senderId, payload) => {
      if (!payload || payload.gameType !== 'connect_four') return;

      if (payload.action === 'DROP_DISC') {
        handleDrop(payload.col, payload.player, false);
      } else if (payload.action === 'RESET_BOARD') {
        resetGame(false);
      }
    });
    return unregister;
  }, [registerGameListener, board, currentPlayer, winnerInfo]);

  const handleDrop = (col: number, player: 'R' | 'Y' = currentPlayer, broadcast = true) => {
    if (winnerInfo || isDraw) return;

    const row = getLowestEmptyRow(board, col);
    if (row === -1) return; // Column is full

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = player;
    setBoard(newBoard);

    if (broadcast && sendGameAction) {
      sendGameAction({
        gameType: 'connect_four',
        action: 'DROP_DISC',
        col,
        player
      });
    }

    const win = checkWin(newBoard);
    if (win) {
      setWinnerInfo(win);
      setScores(prev => ({ ...prev, [win.winner]: prev[win.winner] + 1 }));
      return;
    }

    // Check draw
    const isFull = newBoard.every(row => row.every(cell => cell !== null));
    if (isFull) {
      setIsDraw(true);
      return;
    }

    const nextPlayer = player === 'R' ? 'Y' : 'R';
    setCurrentPlayer(nextPlayer);

    // Bot move if active
    if (vsBot && nextPlayer === 'Y') {
      setTimeout(() => {
        const botCol = findBestBotMove(newBoard);
        const botRow = getLowestEmptyRow(newBoard, botCol);
        if (botRow !== -1) {
          newBoard[botRow][botCol] = 'Y';
          setBoard([...newBoard]);

          const botWin = checkWin(newBoard);
          if (botWin) {
            setWinnerInfo(botWin);
            setScores(prev => ({ ...prev, Y: prev.Y + 1 }));
          } else {
            const botDraw = newBoard.every(r => r.every(c => c !== null));
            if (botDraw) setIsDraw(true);
            else setCurrentPlayer('R');
          }
        }
      }, 500);
    }
  };

  const resetGame = (broadcast = true) => {
    setBoard(createEmptyBoard());
    setCurrentPlayer('R');
    setWinnerInfo(null);
    setIsDraw(false);

    if (broadcast && sendGameAction) {
      sendGameAction({
        gameType: 'connect_four',
        action: 'RESET_BOARD'
      });
    }
  };

  const isWinningCell = (r: number, c: number) => {
    return winnerInfo?.winningCells.some(([wr, wc]) => wr === r && wc === c);
  };

  return (
    <div className={`flex flex-col items-center justify-between h-full max-w-lg mx-auto select-none ${isCompact ? 'p-2 text-xs' : 'p-4'}`}>
      {/* Top Bar / Controls */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setVsBot(!vsBot);
              resetGame(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              vsBot
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {vsBot ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{vsBot ? 'vs AI Bot' : '2-Player Party'}</span>
          </button>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50" />
            <span>Red: {scores.R}</span>
          </div>
          <span className="text-zinc-600">•</span>
          <div className="flex items-center gap-1 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
            <span>Yellow: {scores.Y}</span>
          </div>
        </div>

        <button
          onClick={() => resetGame(true)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
          title="Restart Game"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Turn Indicator Banner */}
      <div className="mb-3 text-center">
        {winnerInfo ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs animate-bounce">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{winnerInfo.winner === 'R' ? '🔴 Red Wins!' : '🟡 Yellow Wins!'}</span>
          </div>
        ) : isDraw ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold">
            <span>Draw Game! Board is full.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <span>Turn:</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                currentPlayer === 'R'
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-600/30'
                  : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentPlayer === 'R' ? 'bg-rose-500' : 'bg-amber-400'}`} />
              {currentPlayer === 'R' ? `${myUserName} (Red)` : vsBot ? 'AI Bot (Yellow)' : 'Player 2 (Yellow)'}
            </span>
          </div>
        )}
      </div>

      {/* Connect Four Grid */}
      <div className="bg-blue-700/80 p-3 sm:p-4 rounded-2xl border-4 border-blue-600 shadow-2xl backdrop-blur-md">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {Array.from({ length: COLS }).map((_, c) => (
            <div
              key={c}
              onMouseEnter={() => setHoveredCol(c)}
              onMouseLeave={() => setHoveredCol(null)}
              onClick={() => handleDrop(c)}
              className="flex flex-col gap-1.5 sm:gap-2.5 cursor-pointer group"
            >
              {Array.from({ length: ROWS }).map((_, r) => {
                const cell = board[r][c];
                const winning = isWinningCell(r, c);

                return (
                  <div
                    key={`${r}-${c}`}
                    className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-inner ${
                      cell === 'R'
                        ? winning
                          ? 'bg-rose-500 ring-4 ring-amber-300 scale-105 animate-pulse shadow-lg shadow-rose-500/50'
                          : 'bg-rose-600 shadow-rose-900/50'
                        : cell === 'Y'
                        ? winning
                          ? 'bg-amber-400 ring-4 ring-white scale-105 animate-pulse shadow-lg shadow-amber-400/50'
                          : 'bg-amber-400 shadow-amber-900/50'
                        : hoveredCol === c && !winnerInfo && !isDraw && r === getLowestEmptyRow(board, c)
                        ? currentPlayer === 'R'
                          ? 'bg-rose-500/40 border border-rose-400/50'
                          : 'bg-amber-400/40 border border-amber-300/50'
                        : 'bg-[#0f121d] border border-blue-800/40'
                    }`}
                  >
                    {winning && <Sparkles className="w-4 h-4 text-white animate-spin" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full text-center text-[10px] text-zinc-500 mt-4">
        Click any column to drop a token. First to connect 4 in a row horizontally, vertically, or diagonally wins!
      </div>
    </div>
  );
};
