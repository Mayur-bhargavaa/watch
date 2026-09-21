'use client';

import React, { useRef, useEffect } from 'react';
import { ChessMove } from '@synccinema/common';
import { ScrollText, Copy, Check } from 'lucide-react';

interface ChessMoveHistoryProps {
  moves: ChessMove[];
  currentMoveIndex?: number;
  onSelectMove?: (index: number) => void;
  className?: string;
}

export const ChessMoveHistory: React.FC<ChessMoveHistoryProps> = ({
  moves = [],
  currentMoveIndex,
  onSelectMove,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Group moves into pairs (1. white, black)
  const movePairs = React.useMemo(() => {
    const pairs: { number: number; white?: ChessMove; black?: ChessMove; whiteIndex: number; blackIndex?: number }[] = [];
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

  // Auto-scroll to latest move if viewing live
  useEffect(() => {
    if (containerRef.current && (currentMoveIndex === undefined || currentMoveIndex === moves.length - 1)) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves.length, currentMoveIndex]);

  // Generate clean PGN string for quick copying
  const handleCopyPgn = () => {
    const pgn = movePairs
      .map(p => `${p.number}. ${p.white?.san || ''} ${p.black?.san || ''}`.trim())
      .join(' ');
    navigator.clipboard.writeText(pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col rounded-2xl bg-slate-950/70 border border-white/10 p-3 sm:p-4 backdrop-blur-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-black text-white uppercase tracking-wider">Move History</span>
          <span className="text-[11px] font-mono text-slate-500 font-bold">({moves.length} half-moves)</span>
        </div>
        {moves.length > 0 && (
          <button
            type="button"
            onClick={handleCopyPgn}
            className="p-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
            title="Copy PGN Notation"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'PGN'}</span>
          </button>
        )}
      </div>

      {/* Move list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto max-h-48 sm:max-h-64 pr-1 space-y-1 font-mono text-xs select-none">
        {movePairs.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs italic">
            No moves played yet. White moves first!
          </div>
        ) : (
          movePairs.map(pair => (
            <div
              key={`pair-${pair.number}`}
              className="grid grid-cols-[36px_1fr_1fr] items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition"
            >
              {/* Move Number */}
              <span className="text-slate-500 font-bold text-right pr-1">
                {pair.number}.
              </span>

              {/* White Move */}
              {pair.white ? (
                <button
                  type="button"
                  onClick={() => onSelectMove && onSelectMove(pair.whiteIndex)}
                  className={`text-left px-2 py-0.5 rounded font-black transition ${
                    currentMoveIndex === pair.whiteIndex
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-200 hover:text-indigo-300'
                  }`}
                >
                  {pair.white.san}
                </button>
              ) : (
                <span />
              )}

              {/* Black Move */}
              {pair.black ? (
                <button
                  type="button"
                  onClick={() => onSelectMove && pair.blackIndex !== undefined && onSelectMove(pair.blackIndex)}
                  className={`text-left px-2 py-0.5 rounded font-black transition ${
                    currentMoveIndex === pair.blackIndex
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-indigo-300'
                  }`}
                >
                  {pair.black.san}
                </button>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
