'use client';

import React, { useState } from 'react';
import {
  Trophy,
  RotateCcw,
  Copy,
  Check,
  Eye,
  LogOut,
  Swords,
  Crown,
  Handshake,
  Clock,
  Flag
} from 'lucide-react';
import { ChessGameState } from '@synccinema/common';

interface ChessGameEndProps {
  gameState: ChessGameState;
  myUserId: string;
  onRematch?: () => void;
  onReview?: () => void;
  onLeave?: () => void;
  rematchRequested?: boolean;
  rematchStatus?: {
    requesterId?: string;
    requesterName?: string;
    votedUserIds?: string[];
  } | null;
}

export const ChessGameEnd: React.FC<ChessGameEndProps> = ({
  gameState,
  myUserId,
  onRematch,
  onReview,
  onLeave,
  rematchRequested = false,
  rematchStatus
}) => {
  const [copiedPgn, setCopiedPgn] = useState(false);

  const opponentRequestedRematch =
    Boolean(
      rematchStatus &&
      rematchStatus.requesterId &&
      rematchStatus.requesterId !== myUserId &&
      !rematchStatus.votedUserIds?.includes(myUserId)
    );

  const iRequestedRematch =
    rematchRequested || Boolean(rematchStatus?.votedUserIds?.includes(myUserId));

  let rematchLabel = 'Request Rematch';
  let rematchStyle =
    'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black shadow-amber-500/30';

  if (opponentRequestedRematch) {
    rematchLabel = `Accept Rematch from ${rematchStatus?.requesterName || 'Opponent'}`;
    rematchStyle =
      'bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-black shadow-emerald-500/40 ring-2 ring-emerald-300 animate-pulse';
  } else if (iRequestedRematch) {
    rematchLabel = 'Rematch Requested... (Waiting)';
    rematchStyle = 'bg-amber-500/30 text-amber-200 border border-amber-500/40 cursor-wait';
  }

  const isWinner = gameState.winnerUserId === myUserId;
  const isDraw = gameState.status === 'DRAW' || gameState.status === 'STALEMATE';
  const isResignation = gameState.status === 'RESIGNED';
  const isTimeout = gameState.status === 'TIMEOUT';
  const isCheckmate = gameState.status === 'CHECKMATE';

  const winnerPlayer = gameState.whitePlayer?.userId === gameState.winnerUserId
    ? gameState.whitePlayer
    : gameState.blackPlayer;
  const loserPlayer = gameState.whitePlayer?.userId === gameState.winnerUserId
    ? gameState.blackPlayer
    : gameState.whitePlayer;

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

  let title = 'Game Over';
  let badgeText = '';
  let badgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  if (isCheckmate) {
    title = isWinner ? 'Victorious Checkmate!' : 'Checkmated';
    badgeText = 'Checkmate';
    badgeColor = isWinner ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (isTimeout) {
    title = isWinner ? 'Won on Time!' : 'Flag Fell (Time Out)';
    badgeText = 'Timeout';
    badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  } else if (isResignation) {
    title = isWinner ? 'Opponent Resigned' : 'Resigned';
    badgeText = 'Resignation';
    badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  } else if (isDraw) {
    title = 'Peaceful Draw';
    const reason = gameState.drawReason || 'Agreement';
    badgeText = `Draw (${reason})`;
    badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-md bg-[#13111f] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(245,158,11,0.15)] text-center overflow-hidden">
        
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Icon & Badge */}
        <div className="flex flex-col items-center justify-center mb-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/10">
            {isWinner ? (
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            ) : isDraw ? (
              <Handshake className="w-8 h-8 text-purple-400" />
            ) : isTimeout ? (
              <Clock className="w-8 h-8 text-orange-400" />
            ) : isResignation ? (
              <Flag className="w-8 h-8 text-blue-400" />
            ) : (
              <Swords className="w-8 h-8 text-zinc-400" />
            )}
          </div>

          <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border mb-2 ${badgeColor}`}>
            {badgeText}
          </span>

          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {title}
          </h3>

          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            {isDraw
              ? 'A hard-fought stalemate or agreement concluded the battle.'
              : `${winnerPlayer?.displayName || 'White'} triumphed over ${loserPlayer?.displayName || 'Black'}.`}
          </p>
        </div>

        {/* Match Statistics */}
        <div className="w-full bg-[#1b172a] border border-white/10 rounded-2xl p-3.5 mb-5 flex items-center justify-around text-center shadow-inner relative z-10">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Moves</span>
            <span className="text-base font-black text-white font-mono">{gameState.moves.length}</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Result</span>
            <span className="text-base font-black text-amber-400 font-mono">
              {isDraw ? '½ - ½' : gameState.winnerColor === 'w' ? '1 - 0' : '0 - 1'}
            </span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Time Control</span>
            <span className="text-base font-black text-white font-mono capitalize">
              {gameState.config?.presetId?.split('-')[0] || 'Rapid'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 relative z-10">
          {onRematch && (
            <button
              type="button"
              onClick={onRematch}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${rematchStyle}`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>{rematchLabel}</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {onReview && (
              <button
                type="button"
                onClick={onReview}
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Review Game</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyPgn}
              className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              {copiedPgn ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPgn ? 'PGN Copied!' : 'Copy PGN'}</span>
            </button>
          </div>

          {onLeave && (
            <button
              type="button"
              onClick={onLeave}
              className="py-2 px-3 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Table</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
