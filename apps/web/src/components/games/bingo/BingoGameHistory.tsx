'use client';

import React from 'react';
import { X, Trophy, Award, CheckCircle2 } from 'lucide-react';
import { BingoWinCondition } from '@synccinema/common';

interface BingoGameHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  winnerDisplayName?: string | null;
  finalScores?: Record<string, number>;
  roundsWon?: { condition: BingoWinCondition; winnerName: string; points: number }[];
  players?: { userId: string; displayName: string }[];
}

export const BingoGameHistory: React.FC<BingoGameHistoryProps> = ({
  isOpen,
  onClose,
  winnerDisplayName,
  finalScores = {},
  roundsWon = [],
  players = []
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0e101a] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Game Summary</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overall Match Winner */}
        {winnerDisplayName && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
            <div className="text-2xl">👑</div>
            <div>
              <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider">Match Champion</span>
              <div className="text-base font-black text-white">{winnerDisplayName}</div>
            </div>
          </div>
        )}

        {/* Rounds Won List */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Rounds Won</span>
          {roundsWon.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {roundsWon.map((r, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-zinc-200">{r.condition}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-400">{r.winnerName}</span>
                    <span className="text-[10px] text-zinc-500 ml-1.5">(+{r.points} pts)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic py-2">No rounds completed yet.</p>
          )}
        </div>

        {/* Final Scores Breakdown */}
        {Object.keys(finalScores).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Final Scores</span>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(finalScores).map(([uid, sc]) => {
                const p = players.find(player => player.userId === uid);
                return (
                  <div key={uid} className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-xs text-zinc-400 block truncate">{p?.displayName || uid}</span>
                    <span className="text-lg font-black font-mono text-white mt-0.5">{sc} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition"
        >
          Close Summary
        </button>
      </div>
    </div>
  );
};
