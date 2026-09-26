'use client';

import React, { useState } from 'react';
import {
  Award,
  ScrollText,
  Copy,
  Check,
  X
} from 'lucide-react';
import { ChessMove } from '@synccinema/common';

interface ChessInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  timeControl: string;
  increment: string;
  gameType: string;
  moves: ChessMove[];
  currentMoveIndex?: number;
  onSelectMove?: (index: number) => void;
}

export const ChessInfoDrawer: React.FC<ChessInfoDrawerProps> = ({
  isOpen,
  onClose,
  roomCode,
  timeControl,
  increment,
  gameType,
  moves,
  currentMoveIndex,
  onSelectMove
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [bottomTab, setBottomTab] = useState<'info' | 'moves'>('info');

  const movePairs = React.useMemo(() => {
    const pairs: {
      number: number;
      white?: ChessMove;
      black?: ChessMove;
      whiteIndex: number;
      blackIndex?: number;
    }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i],
        whiteIndex: i,
        black: moves[i + 1],
        blackIndex: i + 1 < moves.length ? i + 1 : undefined
      });
    }
    return pairs;
  }, [moves]);

  const handleCopyPgn = () => {
    const pgn = movePairs
      .map(p => `${p.number}. ${p.white?.san || ''} ${p.black?.san || ''}`.trim())
      .join(' ');
    navigator.clipboard.writeText(pgn);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative z-10 w-80 max-w-full h-full bg-white dark:bg-[#191527] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col p-4 text-[#16132b] dark:text-white">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#ff2b70]" />
            <h3 className="font-extrabold text-sm tracking-tight">Game Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBottomTab('info')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                bottomTab === 'info'
                  ? 'bg-pink-50 text-[#ff2b70] dark:bg-pink-950/40'
                  : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Info</span>
            </button>

            <button
              type="button"
              onClick={() => setBottomTab('moves')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                bottomTab === 'moves'
                  ? 'bg-pink-50 text-[#ff2b70] dark:bg-pink-950/40'
                  : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Moves</span>
              {moves.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-300 font-mono font-bold">
                  {moves.length}
                </span>
              )}
            </button>
          </div>

          {bottomTab === 'moves' && moves.length > 0 && (
            <button
              type="button"
              onClick={handleCopyPgn}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#ff2b70] dark:bg-pink-950/40 dark:text-pink-300 text-[11px] font-bold transition cursor-pointer"
              title="Copy PGN notation"
            >
              {copiedPgn ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPgn ? 'Copied' : 'PGN'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Game Info */}
        {bottomTab === 'info' && (
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Room Code</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 font-mono font-bold text-[#16132b] dark:text-white hover:text-[#ff2b70] transition cursor-pointer"
              >
                <span>{roomCode}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Format</span>
              <span className="font-bold text-[#16132b] dark:text-white">{gameType}</span>
            </div>

            <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Time</span>
              <span className="font-bold text-[#16132b] dark:text-white">{timeControl}</span>
            </div>

            <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Increment</span>
              <span className="font-bold text-[#16132b] dark:text-white">{increment}</span>
            </div>
          </div>
        )}

        {/* Tab 2: Moves List */}
        {bottomTab === 'moves' && (
          <div className="flex-1 overflow-y-auto py-2 space-y-1 font-mono text-xs select-none pr-1">
            {movePairs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                No moves yet. White moves first!
              </div>
            ) : (
              movePairs.map(pair => (
                <div
                  key={`drawer-pair-${pair.number}`}
                  className="grid grid-cols-[32px_1fr_1fr] items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/5 transition"
                >
                  <span className="text-slate-400 font-bold text-right pr-1">
                    {pair.number}.
                  </span>

                  {pair.white ? (
                    <button
                      type="button"
                      onClick={() => onSelectMove && onSelectMove(pair.whiteIndex)}
                      className={`text-left px-2 py-1 rounded font-black transition cursor-pointer ${
                        currentMoveIndex === pair.whiteIndex
                          ? 'bg-[#ff2b70] text-white shadow-2xs'
                          : 'text-[#16132b] dark:text-zinc-200 hover:text-[#ff2b70]'
                      }`}
                    >
                      {pair.white.san}
                    </button>
                  ) : <span />}

                  {pair.black ? (
                    <button
                      type="button"
                      onClick={() => onSelectMove && pair.blackIndex !== undefined && onSelectMove(pair.blackIndex)}
                      className={`text-left px-2 py-1 rounded font-black transition cursor-pointer ${
                        currentMoveIndex === pair.blackIndex
                          ? 'bg-[#ff2b70] text-white shadow-2xs'
                          : 'text-slate-700 dark:text-zinc-300 hover:text-[#ff2b70]'
                      }`}
                    >
                      {pair.black.san}
                    </button>
                  ) : <span />}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
