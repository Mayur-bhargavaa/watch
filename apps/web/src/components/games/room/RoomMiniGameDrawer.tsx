'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  X,
  RotateCcw,
  Bot,
  Users
} from 'lucide-react';

export interface RoomMiniGameDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  myUserId: string;
  myDisplayName: string;
  activeMembers?: Array<{ userId: string; displayName: string; avatarUrl?: string | null }>;
  sendGameAction?: (payload: any) => void;
  registerGameListener?: (listener: (senderId: string, payload: any) => void) => () => void;
}

type MiniGameType = 'tictactoe' | 'connect4';
type OpponentMode = 'ai' | 'room';

// --- TIC-TAC-TOE LOGIC ---
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

function checkTicTacToeWinner(board: (string | null)[]) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { winner: 'TIE', line: [] };
  }
  return null;
}

// --- FOUR IN A ROW LOGIC ---
const ROWS = 6;
const COLS = 7;

function createEmptyConnect4Board(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkConnect4Winner(board: (string | null)[][]): { winner: string; line: [number, number][] } | null {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p && p === board[r][c + 1] && p === board[r][c + 2] && p === board[r][c + 3]) {
        return { winner: p, line: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
      }
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const p = board[r][c];
      if (p && p === board[r + 1][c] && p === board[r + 2][c] && p === board[r + 3][c]) {
        return { winner: p, line: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
      }
    }
  }
  // Diagonal /
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p && p === board[r - 1][c + 1] && p === board[r - 2][c + 2] && p === board[r - 3][c + 3]) {
        return { winner: p, line: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
      }
    }
  }
  // Diagonal \
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p && p === board[r + 1][c + 1] && p === board[r + 2][c + 2] && p === board[r + 3][c + 3]) {
        return { winner: p, line: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
      }
    }
  }
  // Tie check
  if (board[0].every(c => c !== null)) {
    return { winner: 'TIE', line: [] };
  }
  return null;
}

export const RoomMiniGameDrawer: React.FC<RoomMiniGameDrawerProps> = ({
  isOpen,
  onClose,
  myUserId,
  myDisplayName,
  activeMembers = [],
  sendGameAction,
  registerGameListener
}) => {
  const [selectedGame, setSelectedGame] = useState<MiniGameType>('tictactoe');
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('ai');

  // Tic-Tac-Toe state
  const [tttBoard, setTttBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [tttTurn, setTttTurn] = useState<'X' | 'O'>('X');
  const [tttWinner, setTttWinner] = useState<{ winner: string; line: number[] } | null>(null);
  const [tttScores, setTttScores] = useState({ x: 0, o: 0, ties: 0 });

  // Four-in-a-Row state
  const [c4Board, setC4Board] = useState<(string | null)[][]>(createEmptyConnect4Board);
  const [c4Turn, setC4Turn] = useState<'R' | 'Y'>('R'); // R: Red, Y: Yellow
  const [c4Winner, setC4Winner] = useState<{ winner: string; line: [number, number][] } | null>(null);
  const [c4Scores, setC4Scores] = useState({ r: 0, y: 0, ties: 0 });

  // Reset games
  const resetTicTacToe = useCallback((broadcast = true) => {
    setTttBoard(Array(9).fill(null));
    setTttTurn('X');
    setTttWinner(null);
    if (broadcast && opponentMode === 'room' && sendGameAction) {
      sendGameAction({ gameType: 'tictactoe', action: 'RESET' });
    }
  }, [opponentMode, sendGameAction]);

  const resetConnect4 = useCallback((broadcast = true) => {
    setC4Board(createEmptyConnect4Board());
    setC4Turn('R');
    setC4Winner(null);
    if (broadcast && opponentMode === 'room' && sendGameAction) {
      sendGameAction({ gameType: 'connect4', action: 'RESET' });
    }
  }, [opponentMode, sendGameAction]);

  // Handle remote actions from room socket
  useEffect(() => {
    if (!registerGameListener) return;
    const unsubscribe = registerGameListener((senderId, payload) => {
      if (!payload || senderId === myUserId) return;

      if (payload.gameType === 'tictactoe') {
        if (payload.action === 'RESET') {
          resetTicTacToe(false);
        } else if (payload.action === 'MOVE' && typeof payload.cellIndex === 'number') {
          const idx = payload.cellIndex;
          setTttBoard(prev => {
            if (prev[idx] !== null) return prev;
            const next = [...prev];
            next[idx] = payload.player;
            const res = checkTicTacToeWinner(next);
            if (res) {
              setTttWinner(res);
              if (res.winner === 'X') setTttScores(s => ({ ...s, x: s.x + 1 }));
              else if (res.winner === 'O') setTttScores(s => ({ ...s, o: s.o + 1 }));
              else setTttScores(s => ({ ...s, ties: s.ties + 1 }));
            } else {
              setTttTurn(payload.player === 'X' ? 'O' : 'X');
            }
            return next;
          });
        }
      } else if (payload.gameType === 'connect4') {
        if (payload.action === 'RESET') {
          resetConnect4(false);
        } else if (payload.action === 'MOVE' && typeof payload.col === 'number') {
          const col = payload.col;
          setC4Board(prev => {
            const next = prev.map(row => [...row]);
            let targetRow = -1;
            for (let r = ROWS - 1; r >= 0; r--) {
              if (!next[r][col]) {
                targetRow = r;
                break;
              }
            }
            if (targetRow === -1) return prev;
            next[targetRow][col] = payload.player;
            const win = checkConnect4Winner(next);
            if (win) {
              setC4Winner(win);
              if (win.winner === 'R') setC4Scores(s => ({ ...s, r: s.r + 1 }));
              else if (win.winner === 'Y') setC4Scores(s => ({ ...s, y: s.y + 1 }));
              else setC4Scores(s => ({ ...s, ties: s.ties + 1 }));
            } else {
              setC4Turn(payload.player === 'R' ? 'Y' : 'R');
            }
            return next;
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [registerGameListener, myUserId, resetTicTacToe, resetConnect4]);

  // Tic-Tac-Toe AI Move
  useEffect(() => {
    if (selectedGame !== 'tictactoe' || opponentMode !== 'ai' || tttTurn !== 'O' || tttWinner) return;

    const timer = setTimeout(() => {
      const available = tttBoard.map((c, i) => (c === null ? i : null)).filter(i => i !== null) as number[];
      if (available.length === 0) return;

      // Smart check: Can bot win or block?
      let chosenMove = available[Math.floor(Math.random() * available.length)];
      for (const idx of available) {
        const testBoard = [...tttBoard];
        testBoard[idx] = 'O';
        if (checkTicTacToeWinner(testBoard)?.winner === 'O') {
          chosenMove = idx;
          break;
        }
      }
      if (chosenMove === undefined) {
        for (const idx of available) {
          const testBoard = [...tttBoard];
          testBoard[idx] = 'X';
          if (checkTicTacToeWinner(testBoard)?.winner === 'X') {
            chosenMove = idx;
            break;
          }
        }
      }

      setTttBoard(prev => {
        const next = [...prev];
        next[chosenMove] = 'O';
        const res = checkTicTacToeWinner(next);
        if (res) {
          setTttWinner(res);
          if (res.winner === 'O') setTttScores(s => ({ ...s, o: s.o + 1 }));
          else if (res.winner === 'X') setTttScores(s => ({ ...s, x: s.x + 1 }));
          else setTttScores(s => ({ ...s, ties: s.ties + 1 }));
        } else {
          setTttTurn('X');
        }
        return next;
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [tttTurn, tttBoard, tttWinner, selectedGame, opponentMode]);

  // Four-in-a-Row AI Move
  useEffect(() => {
    if (selectedGame !== 'connect4' || opponentMode !== 'ai' || c4Turn !== 'Y' || c4Winner) return;

    const timer = setTimeout(() => {
      const validCols: number[] = [];
      for (let c = 0; c < COLS; c++) {
        if (!c4Board[0][c]) validCols.push(c);
      }
      if (validCols.length === 0) return;

      const chosenCol = validCols[Math.floor(Math.random() * validCols.length)];

      setC4Board(prev => {
        const next = prev.map(row => [...row]);
        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (!next[r][chosenCol]) {
            targetRow = r;
            break;
          }
        }
        if (targetRow === -1) return prev;
        next[targetRow][chosenCol] = 'Y';
        const win = checkConnect4Winner(next);
        if (win) {
          setC4Winner(win);
          if (win.winner === 'Y') setC4Scores(s => ({ ...s, y: s.y + 1 }));
          else if (win.winner === 'R') setC4Scores(s => ({ ...s, r: s.r + 1 }));
          else setC4Scores(s => ({ ...s, ties: s.ties + 1 }));
        } else {
          setC4Turn('R');
        }
        return next;
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [c4Turn, c4Board, c4Winner, selectedGame, opponentMode]);

  const handleTttCellClick = (index: number) => {
    if (tttBoard[index] !== null || tttWinner) return;
    if (opponentMode === 'ai' && tttTurn !== 'X') return;

    const currentMark = tttTurn;
    setTttBoard(prev => {
      const next = [...prev];
      next[index] = currentMark;
      const res = checkTicTacToeWinner(next);
      if (res) {
        setTttWinner(res);
        if (res.winner === 'X') setTttScores(s => ({ ...s, x: s.x + 1 }));
        else if (res.winner === 'O') setTttScores(s => ({ ...s, o: s.o + 1 }));
        else setTttScores(s => ({ ...s, ties: s.ties + 1 }));
      } else {
        setTttTurn(currentMark === 'X' ? 'O' : 'X');
      }
      return next;
    });

    if (opponentMode === 'room' && sendGameAction) {
      sendGameAction({
        gameType: 'tictactoe',
        action: 'MOVE',
        cellIndex: index,
        player: currentMark
      });
    }
  };

  const handleC4ColumnClick = (col: number) => {
    if (c4Winner || c4Board[0][col] !== null) return;
    if (opponentMode === 'ai' && c4Turn !== 'R') return;

    const currentMark = c4Turn;
    setC4Board(prev => {
      const next = prev.map(row => [...row]);
      let targetRow = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!next[r][col]) {
          targetRow = r;
          break;
        }
      }
      if (targetRow === -1) return prev;
      next[targetRow][col] = currentMark;
      const win = checkConnect4Winner(next);
      if (win) {
        setC4Winner(win);
        if (win.winner === 'R') setC4Scores(s => ({ ...s, r: s.r + 1 }));
        else if (win.winner === 'Y') setC4Scores(s => ({ ...s, y: s.y + 1 }));
        else setC4Scores(s => ({ ...s, ties: s.ties + 1 }));
      } else {
        setC4Turn(currentMark === 'R' ? 'Y' : 'R');
      }
      return next;
    });

    if (opponentMode === 'room' && sendGameAction) {
      sendGameAction({
        gameType: 'connect4',
        action: 'MOVE',
        col,
        player: currentMark
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed sm:relative inset-y-0 right-0 z-40 w-full sm:w-[360px] md:w-[380px] bg-[#12131e]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-2xl transition-all duration-300">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#161726]/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center shadow-md shadow-pink-500/20">
            <Gamepad2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Intermission Games</h2>
            <p className="text-[10px] text-zinc-400">Play without stopping the movie</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
          title="Close Mini Games"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Game Selector Tabs */}
      <div className="flex items-center gap-2 p-3 bg-black/20 shrink-0">
        <button
          onClick={() => setSelectedGame('tictactoe')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            selectedGame === 'tictactoe'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>❌</span>
          <span>Tic Tac Toe</span>
        </button>
        <button
          onClick={() => setSelectedGame('connect4')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            selectedGame === 'connect4'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🔴</span>
          <span>Four in a Row</span>
        </button>
      </div>

      {/* Opponent Mode Selector */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/10 shrink-0 text-xs text-zinc-400">
        <span className="font-medium">Opponent:</span>
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => setOpponentMode('ai')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
              opponentMode === 'ai' ? 'bg-rose-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bot className="w-3 h-3" />
            <span>AI Bot</span>
          </button>
          <button
            onClick={() => setOpponentMode('room')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
              opponentMode === 'room' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Room Live</span>
          </button>
        </div>
      </div>

      {/* Game Arena Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-between">
        {/* Game 1: TIC TAC TOE */}
        {selectedGame === 'tictactoe' && (
          <div className="w-full flex flex-col items-center gap-4 my-auto">
            {/* Scoreboard */}
            <div className="flex items-center justify-between w-full max-w-[280px] bg-white/5 rounded-2xl p-3 border border-white/5 text-xs">
              <div className="flex flex-col items-center">
                <span className="text-rose-400 font-bold text-sm">X (You)</span>
                <span className="text-white font-mono text-lg font-black">{tttScores.x}</span>
              </div>
              <div className="flex flex-col items-center text-zinc-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Ties</span>
                <span className="font-mono text-sm">{tttScores.ties}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-indigo-400 font-bold text-sm">
                  {opponentMode === 'ai' ? 'O (Bot)' : 'O (Rival)'}
                </span>
                <span className="text-white font-mono text-lg font-black">{tttScores.o}</span>
              </div>
            </div>

            {/* Turn status */}
            <div className="text-xs font-semibold tracking-wide text-zinc-300 flex items-center gap-2">
              {tttWinner ? (
                tttWinner.winner === 'TIE' ? (
                  <span className="text-amber-400">🤝 It's a draw!</span>
                ) : (
                  <span className="text-emerald-400 font-bold">🏆 {tttWinner.winner} wins this round!</span>
                )
              ) : (
                <span>
                  Current Turn:{' '}
                  <span className={tttTurn === 'X' ? 'text-rose-400 font-bold' : 'text-indigo-400 font-bold'}>
                    {tttTurn} {tttTurn === 'X' ? '(You)' : opponentMode === 'ai' ? '(Bot)' : '(Rival)'}
                  </span>
                </span>
              )}
            </div>

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-2.5 w-[260px] h-[260px] bg-black/40 p-2.5 rounded-2xl border border-white/10 shadow-inner">
              {tttBoard.map((val, idx) => {
                const isWinningCell = tttWinner?.line?.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => handleTttCellClick(idx)}
                    disabled={Boolean(val) || Boolean(tttWinner) || (opponentMode === 'ai' && tttTurn !== 'X')}
                    className={`rounded-xl flex items-center justify-center text-3xl font-black transition-all duration-200 select-none ${
                      isWinningCell
                        ? 'bg-emerald-500/30 text-emerald-300 ring-2 ring-emerald-400 scale-95 shadow-lg shadow-emerald-500/20'
                        : val === 'X'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : val === 'O'
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        : 'bg-white/5 hover:bg-white/10 border border-white/5 active:scale-95'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>

            {/* Reset Button */}
            <button
              onClick={() => resetTicTacToe(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rematch</span>
            </button>
          </div>
        )}

        {/* Game 2: FOUR IN A ROW */}
        {selectedGame === 'connect4' && (
          <div className="w-full flex flex-col items-center gap-3 my-auto">
            {/* Scoreboard */}
            <div className="flex items-center justify-between w-full max-w-[280px] bg-white/5 rounded-2xl p-2.5 border border-white/5 text-xs">
              <div className="flex flex-col items-center">
                <span className="text-red-400 font-bold text-xs flex items-center gap-1">🔴 You</span>
                <span className="text-white font-mono text-base font-black">{c4Scores.r}</span>
              </div>
              <div className="flex flex-col items-center text-zinc-500">
                <span className="text-[9px] uppercase font-bold tracking-wider">Ties</span>
                <span className="font-mono text-xs">{c4Scores.ties}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-yellow-400 font-bold text-xs flex items-center gap-1">
                  🟡 {opponentMode === 'ai' ? 'Bot' : 'Rival'}
                </span>
                <span className="text-white font-mono text-base font-black">{c4Scores.y}</span>
              </div>
            </div>

            {/* Turn status */}
            <div className="text-xs font-semibold tracking-wide text-zinc-300">
              {c4Winner ? (
                c4Winner.winner === 'TIE' ? (
                  <span className="text-amber-400">🤝 Board Full - Draw!</span>
                ) : (
                  <span className="text-emerald-400 font-bold">
                    🏆 {c4Winner.winner === 'R' ? 'Red (You)' : 'Yellow'} Connected 4!
                  </span>
                )
              ) : (
                <span>
                  Drop Disc:{' '}
                  <span className={c4Turn === 'R' ? 'text-red-400 font-bold' : 'text-yellow-400 font-bold'}>
                    {c4Turn === 'R' ? 'Red (You)' : opponentMode === 'ai' ? 'Yellow (Bot)' : 'Yellow (Rival)'}
                  </span>
                </span>
              )}
            </div>

            {/* 7x6 Connect 4 Grid */}
            <div className="bg-blue-900/40 p-2 rounded-2xl border border-blue-500/30 shadow-xl max-w-[300px] w-full">
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: COLS }).map((_, c) => (
                  <button
                    key={c}
                    onClick={() => handleC4ColumnClick(c)}
                    disabled={Boolean(c4Winner) || c4Board[0][c] !== null || (opponentMode === 'ai' && c4Turn !== 'R')}
                    className="flex flex-col gap-1.5 p-1 rounded-xl hover:bg-white/10 transition group"
                  >
                    {Array.from({ length: ROWS }).map((_, r) => {
                      const val = c4Board[r][c];
                      const isWin = c4Winner?.line?.some(([wr, wc]) => wr === r && wc === c);
                      return (
                        <div
                          key={r}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-300 flex items-center justify-center ${
                            isWin
                              ? 'ring-2 ring-emerald-400 scale-110 shadow-lg shadow-emerald-500/40'
                              : ''
                          } ${
                            val === 'R'
                              ? 'bg-gradient-to-tr from-red-600 to-rose-400 shadow-md shadow-red-600/30'
                              : val === 'Y'
                              ? 'bg-gradient-to-tr from-yellow-500 to-amber-300 shadow-md shadow-yellow-500/30'
                              : 'bg-black/60 border border-white/5 group-hover:border-white/20'
                          }`}
                        />
                      );
                    })}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => resetConnect4(true)}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rematch</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
