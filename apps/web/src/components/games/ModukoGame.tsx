'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Trophy, Lightbulb, Eraser, Edit3, CheckCircle2 } from 'lucide-react';

interface ModukoGameProps {
  sendGameAction?: (payload: any) => void;
  registerGameListener?: (listener: (senderId: string, payload: any) => void) => () => void;
  myUserName?: string;
  isCompact?: boolean;
}

// Pre-computed balanced Sudoku puzzles (0 denotes empty cell)
const PUZZLES = {
  easy: {
    initial: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ],
    solution: [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9]
    ]
  },
  medium: {
    initial: [
      [0, 0, 0, 2, 6, 0, 7, 0, 1],
      [6, 8, 0, 0, 7, 0, 0, 9, 0],
      [1, 9, 0, 0, 0, 4, 5, 0, 0],
      [8, 2, 0, 1, 0, 0, 0, 4, 0],
      [0, 0, 4, 6, 0, 2, 9, 0, 0],
      [0, 5, 0, 0, 0, 3, 0, 2, 8],
      [0, 0, 9, 3, 0, 0, 0, 7, 4],
      [0, 4, 0, 0, 5, 0, 0, 3, 6],
      [7, 0, 3, 0, 1, 8, 0, 0, 0]
    ],
    solution: [
      [4, 3, 5, 2, 6, 9, 7, 8, 1],
      [6, 8, 2, 5, 7, 1, 4, 9, 3],
      [1, 9, 7, 8, 3, 4, 5, 6, 2],
      [8, 2, 6, 1, 9, 5, 3, 4, 7],
      [3, 7, 4, 6, 8, 2, 9, 1, 5],
      [9, 5, 1, 7, 4, 3, 6, 2, 8],
      [5, 1, 9, 3, 2, 6, 8, 7, 4],
      [2, 4, 8, 9, 5, 7, 1, 3, 6],
      [7, 6, 3, 4, 1, 8, 2, 5, 9]
    ]
  }
};

export const ModukoGame: React.FC<ModukoGameProps> = ({
  myUserName = 'Player',
  isCompact = false
}) => {
  const [difficulty, setDifficulty] = useState<'easy' | 'medium'>('easy');
  const [grid, setGrid] = useState<number[][]>(() => PUZZLES.easy.initial.map(r => [...r]));
  const [initialMask, setInitialMask] = useState<boolean[][]>(() =>
    PUZZLES.easy.initial.map(r => r.map(c => c !== 0))
  );
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>([0, 0]);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Record<string, number[]>>({});
  const [mistakes, setMistakes] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isWon, setIsWon] = useState(false);

  // Timer
  useEffect(() => {
    if (isWon) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isWon]);

  // Restart / Switch Difficulty
  const handleSelectDifficulty = (diff: 'easy' | 'medium') => {
    setDifficulty(diff);
    setGrid(PUZZLES[diff].initial.map(r => [...r]));
    setInitialMask(PUZZLES[diff].initial.map(r => r.map(c => c !== 0)));
    setSelectedCell([0, 0]);
    setNotes({});
    setMistakes(0);
    setTimerSeconds(0);
    setIsWon(false);
  };

  const handleInputNumber = (num: number) => {
    if (!selectedCell || isWon) return;
    const [r, c] = selectedCell;
    if (initialMask[r][c]) return; // Cannot edit original puzzle clues

    if (notesMode) {
      const key = `${r}-${c}`;
      setNotes(prev => {
        const current = prev[key] || [];
        const updated = current.includes(num)
          ? current.filter(n => n !== num)
          : [...current, num].sort();
        return { ...prev, [key]: updated };
      });
      return;
    }

    const solutionNum = PUZZLES[difficulty].solution[r][c];
    if (num !== solutionNum) {
      setMistakes(m => m + 1);
    }

    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = num;
    setGrid(newGrid);

    // Check completion
    const isComplete = newGrid.every((row, ri) =>
      row.every((val, ci) => val === PUZZLES[difficulty].solution[ri][ci])
    );
    if (isComplete) {
      setIsWon(true);
    }
  };

  const handleErase = () => {
    if (!selectedCell || isWon) return;
    const [r, c] = selectedCell;
    if (initialMask[r][c]) return;

    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = 0;
    setGrid(newGrid);

    const key = `${r}-${c}`;
    setNotes(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleHint = () => {
    if (!selectedCell || isWon) return;
    const [r, c] = selectedCell;
    if (initialMask[r][c]) return;

    const correct = PUZZLES[difficulty].solution[r][c];
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = correct;
    setGrid(newGrid);

    const isComplete = newGrid.every((row, ri) =>
      row.every((val, ci) => val === PUZZLES[difficulty].solution[ri][ci])
    );
    if (isComplete) setIsWon(true);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const selectedValue = selectedCell ? grid[selectedCell[0]][selectedCell[1]] : 0;

  return (
    <div className={`flex flex-col items-center justify-between h-full max-w-lg mx-auto select-none ${isCompact ? 'p-2 text-xs' : 'p-4'}`}>
      {/* Top Controls */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-white/[0.08] mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSelectDifficulty('easy')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              difficulty === 'easy'
                ? 'bg-emerald-600 text-white'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            Easy
          </button>
          <button
            onClick={() => handleSelectDifficulty('medium')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              difficulty === 'medium'
                ? 'bg-amber-600 text-white'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            Medium
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-zinc-400 font-mono">
          <span>⏱ {formatTimer(timerSeconds)}</span>
          <span>Mistakes: {mistakes}</span>
        </div>

        <button
          onClick={() => handleSelectDifficulty(difficulty)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
          title="Restart Puzzle"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isWon && (
        <div className="mb-2 p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>Puzzle Solved in {formatTimer(timerSeconds)}! Fantastic job, {myUserName}!</span>
        </div>
      )}

      {/* 9x9 SUDOKU / MODUKO GRID */}
      <div className="bg-[#12141f] p-2 rounded-2xl border-2 border-white/10 shadow-2xl">
        <div className="grid grid-cols-9 gap-0 border-2 border-white/20">
          {grid.map((row, r) =>
            row.map((val, c) => {
              const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c;
              const isRelated =
                selectedCell && (selectedCell[0] === r || selectedCell[1] === c);
              const isSameNumber = selectedValue !== 0 && val === selectedValue;
              const isClue = initialMask[r][c];
              const noteList = notes[`${r}-${c}`] || [];

              // 3x3 Block borders
              const borderRight = (c + 1) % 3 === 0 && c !== 8 ? 'border-r-2 border-r-white/30' : 'border-r border-r-white/10';
              const borderBottom = (r + 1) % 3 === 0 && r !== 8 ? 'border-b-2 border-b-white/30' : 'border-b border-b-white/10';

              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => setSelectedCell([r, c])}
                  className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold text-xs sm:text-sm transition-colors relative ${borderRight} ${borderBottom} ${
                    isSelected
                      ? 'bg-rose-600 text-white font-black'
                      : isSameNumber
                      ? 'bg-rose-600/30 text-rose-200'
                      : isRelated
                      ? 'bg-white/[0.04]'
                      : 'hover:bg-white/[0.06]'
                  } ${isClue ? 'text-white font-extrabold' : 'text-rose-400 font-medium'}`}
                >
                  {val !== 0 ? (
                    val
                  ) : noteList.length > 0 ? (
                    <div className="grid grid-cols-3 gap-0.5 text-[8px] text-zinc-400 leading-none">
                      {noteList.slice(0, 4).map(n => (
                        <span key={n}>{n}</span>
                      ))}
                    </div>
                  ) : (
                    ''
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Action Tools */}
      <div className="w-full flex items-center justify-center gap-3 my-2 text-xs">
        <button
          onClick={handleErase}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold transition"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Erase</span>
        </button>

        <button
          onClick={() => setNotesMode(!notesMode)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition ${
            notesMode
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-white/5 border-transparent text-zinc-300 hover:bg-white/10'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Notes {notesMode ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={handleHint}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 font-semibold transition"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Hint</span>
        </button>
      </div>

      {/* 1-9 Number Keypad */}
      <div className="grid grid-cols-9 gap-1.5 w-full max-w-sm">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleInputNumber(num)}
            className="h-10 rounded-xl bg-white/[0.05] hover:bg-rose-600 hover:text-white border border-white/[0.08] text-white font-black text-sm flex items-center justify-center shadow transition active:scale-95"
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
};
