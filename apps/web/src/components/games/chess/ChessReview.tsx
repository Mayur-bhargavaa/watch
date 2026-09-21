'use client';

import React, { useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { ChessGameState } from '@synccinema/common';
import { ChessBoard } from './ChessBoard';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Copy,
  Check,
  X
} from 'lucide-react';

interface ChessReviewProps {
  gameState: ChessGameState;
  onClose: () => void;
}

export const ChessReview: React.FC<ChessReviewProps> = ({ gameState, onClose }) => {
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(gameState.moves.length);
  const [copiedPgn, setCopiedPgn] = useState(false);

  // Compute FEN positions at every ply index from 0 to moves.length
  const positions = useMemo(() => {
    const list: { fen: string; lastMove?: { from: string; to: string } }[] = [];
    const chess = new Chess();
    list.push({ fen: chess.fen() });

    for (const move of gameState.moves) {
      try {
        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion
        });
        list.push({
          fen: chess.fen(),
          lastMove: { from: move.from, to: move.to }
        });
      } catch {
        break;
      }
    }
    return list;
  }, [gameState.moves]);

  const currentPosition = positions[currentPlyIndex] || positions[positions.length - 1];

  const handleFirst = () => setCurrentPlyIndex(0);
  const handlePrev = () => setCurrentPlyIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentPlyIndex(prev => Math.min(positions.length - 1, prev + 1));
  const handleLast = () => setCurrentPlyIndex(positions.length - 1);

  const handleCopyPgn = () => {
    let pgn = '';
    for (let i = 0; i < gameState.moves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteSan = gameState.moves[i]?.san || '';
      const blackSan = gameState.moves[i + 1]?.san || '';
      pgn += `${moveNum}. ${whiteSan} ${blackSan} `.trim() + ' ';
    }
    if (gameState.winnerColor === 'w') pgn += '1-0';
    else if (gameState.winnerColor === 'b') pgn += '0-1';
    else if (gameState.status === 'DRAW' || gameState.status === 'STALEMATE') pgn += '1/2-1/2';

    navigator.clipboard.writeText(pgn.trim());
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-4xl bg-[#110f1c] border border-white/15 rounded-3xl p-4 sm:p-6 shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col md:flex-row gap-6 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition z-20 cursor-pointer"
          title="Exit Review"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left/Center: Replay Board */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <div className="w-full max-w-[420px]">
            <ChessBoard
              fen={currentPosition.fen}
              turn={currentPlyIndex % 2 === 0 ? 'w' : 'b'}
              lastMove={currentPosition.lastMove}
              onMove={() => {}}
              disabled={true}
            />
          </div>

          {/* Stepper Navigation Controls */}
          <div className="flex items-center gap-2 mt-4 bg-[#181528] p-2 rounded-2xl border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={handleFirst}
              disabled={currentPlyIndex === 0}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white transition cursor-pointer"
              title="First Move"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentPlyIndex === 0}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white transition cursor-pointer"
              title="Previous Move"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 text-xs font-mono font-bold text-amber-400">
              Ply {currentPlyIndex} / {positions.length - 1}
            </span>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentPlyIndex === positions.length - 1}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white transition cursor-pointer"
              title="Next Move"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleLast}
              disabled={currentPlyIndex === positions.length - 1}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-white transition cursor-pointer"
              title="Last Move"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Move List & PGN */}
        <div className="w-full md:w-80 flex flex-col justify-between bg-[#151222] border border-white/10 rounded-2xl p-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h4 className="text-sm font-black text-white">Move List Analysis</h4>
              <button
                type="button"
                onClick={handleCopyPgn}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedPgn ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPgn ? 'Copied' : 'Copy PGN'}</span>
              </button>
            </div>

            {/* SAN Moves Table */}
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
              {Array.from({ length: Math.ceil(gameState.moves.length / 2) }).map((_, moveNum) => {
                const whiteMove = gameState.moves[moveNum * 2];
                const blackMove = gameState.moves[moveNum * 2 + 1];
                const whitePly = moveNum * 2 + 1;
                const blackPly = moveNum * 2 + 2;

                return (
                  <div key={moveNum} className="flex items-center py-1 px-2 rounded-lg hover:bg-white/5">
                    <span className="w-9 text-zinc-500 font-bold">{moveNum + 1}.</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPlyIndex(whitePly)}
                      className={`flex-1 text-left py-0.5 px-1.5 rounded cursor-pointer ${
                        currentPlyIndex === whitePly
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'text-zinc-200 hover:text-white'
                      }`}
                    >
                      {whiteMove?.san}
                    </button>
                    {blackMove ? (
                      <button
                        type="button"
                        onClick={() => setCurrentPlyIndex(blackPly)}
                        className={`flex-1 text-left py-0.5 px-1.5 rounded cursor-pointer ${
                          currentPlyIndex === blackPly
                            ? 'bg-amber-500/20 text-amber-300 font-bold'
                            : 'text-zinc-200 hover:text-white'
                        }`}
                      >
                        {blackMove.san}
                      </button>
                    ) : (
                      <span className="flex-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition cursor-pointer"
            >
              Close Analysis
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
