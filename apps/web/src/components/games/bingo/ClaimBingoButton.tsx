'use client';

import React, { useState } from 'react';
import { Sparkles, Trophy, X, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BingoWinCondition, BingoConditionProgress } from '@synccinema/common';

interface ClaimBingoButtonProps {
  conditionProgress: Record<string, BingoConditionProgress>;
  claimedConditions: Record<string, any>;
  onClaim: (condition: BingoWinCondition) => void;
  penaltyUntil?: number;
  lastClaimResult?: {
    valid: boolean;
    message: string;
    condition: BingoWinCondition;
    timestamp: number;
  } | null;
}

const CONDITION_NAMES: Record<string, string> = {
  early5: 'Early 5',
  topLine: 'Top Line',
  middleLine: 'Middle Line',
  bottomLine: 'Bottom Line',
  fourCorners: 'Four Corners',
  housefull: 'Housefull',
  xPattern: 'X Pattern',
  crossPattern: 'Cross Pattern',
  starPattern: 'Star Pattern',
  diamond: 'Diamond',
  fullBorder: 'Full Border',
  customPattern: 'Custom Pattern'
};

export const ClaimBingoButton: React.FC<ClaimBingoButtonProps> = ({
  conditionProgress,
  claimedConditions,
  onClaim,
  penaltyUntil,
  lastClaimResult
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showResultToast, setShowResultToast] = useState(false);

  // Check if user has active penalty
  const isPenalized = Boolean(penaltyUntil && penaltyUntil > Date.now());
  const penaltySeconds = isPenalized ? Math.ceil((penaltyUntil! - Date.now()) / 1000) : 0;

  // Find conditions that are ready (completed and not yet claimed by anyone)
  const availableClaims = Object.entries(conditionProgress || {}).filter(
    ([cond, info]) => info && !info.claimed && !claimedConditions[cond]
  );

  const completedClaims = availableClaims.filter(([_, info]) => info.isMet);

  const handleOpenClaim = () => {
    if (completedClaims.length === 1) {
      // Direct instant claim if only one condition is met!
      onClaim(completedClaims[0][0] as BingoWinCondition);
    } else {
      setShowModal(true);
    }
  };

  const handleSelectCondition = (cond: BingoWinCondition) => {
    setShowModal(false);
    onClaim(cond);
  };

  return (
    <>
      <div className="flex flex-col items-center">
        {/* Main Claim Button */}
        <button
          type="button"
          disabled={isPenalized}
          onClick={handleOpenClaim}
          className={`relative group px-6 sm:px-10 py-3 sm:py-3.5 rounded-full font-black text-sm sm:text-base tracking-wider uppercase transition-all duration-200 active:scale-95 shadow-xl flex items-center gap-3 select-none cursor-pointer ${
            isPenalized
              ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              : completedClaims.length > 0
              ? 'bg-gradient-to-r from-rose-600 via-[#ee1d49] to-pink-500 text-white hover:brightness-110 shadow-rose-600/40 ring-4 ring-[#ee1d49]/30 animate-pulse'
              : 'bg-gradient-to-r from-rose-600 to-[#ee1d49] text-white hover:brightness-110 shadow-rose-600/25'
          }`}
        >
          <Sparkles className="w-5 h-5 text-yellow-300" />
          <span>{isPenalized ? `Penalty (${penaltySeconds}s)` : '🎉 I HAVE A BINGO!'}</span>
          {completedClaims.length > 0 && !isPenalized && (
            <span className="px-2 py-0.5 rounded-full bg-white text-rose-600 font-black text-xs shadow-sm">
              {completedClaims.length}
            </span>
          )}
        </button>

        {completedClaims.length > 0 && !isPenalized && (
          <span className="text-[10px] font-bold text-emerald-400 mt-1.5 animate-bounce">
            Ready to claim! Click now to secure your prize!
          </span>
        )}
      </div>

      {/* Condition Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0e101a] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-black text-white">Select Claim Condition</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Select which pattern or winning line you are claiming on your ticket:
            </p>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {availableClaims.map(([cond, info]) => {
                const name = CONDITION_NAMES[cond] || cond;
                const isReady = info.isMet;
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => handleSelectCondition(cond as BingoWinCondition)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                      isReady
                        ? 'bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25 text-white'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{name}</div>
                      <div className="text-[10px] text-zinc-400">
                        {isReady ? 'Completed! 🎯' : `${info.current} / ${info.total} numbers called`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isReady ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-[10px] font-black">
                          CLAIM
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Try Claim</span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
