'use client';

import React, { useState } from 'react';
import { ChessColor, ChessPieceType } from '@synccinema/common';
import { ChessPiece } from './ChessPiece';
import { Check, Sparkles } from 'lucide-react';

interface ChessPromotionModalProps {
  color: ChessColor;
  onSelect: (promotion: 'q' | 'r' | 'b' | 'n') => void;
  onCancel?: () => void;
}

const PROMOTION_PIECES: { type: 'q' | 'r' | 'b' | 'n'; label: string; desc: string }[] = [
  { type: 'q', label: 'Queen', desc: 'Powerful diagonal, rank & file' },
  { type: 'n', label: 'Knight', desc: 'Tactical L-jumper' },
  { type: 'r', label: 'Rook', desc: 'Direct ranks & files' },
  { type: 'b', label: 'Bishop', desc: 'Long range diagonals' }
];

export const ChessPromotionModal: React.FC<ChessPromotionModalProps> = ({
  color,
  onSelect,
  onCancel
}) => {
  const [selectedPiece, setSelectedPiece] = useState<'q' | 'r' | 'b' | 'n'>('q');

  const handleConfirm = () => {
    onSelect(selectedPiece);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm p-5 sm:p-6 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-[0_25px_60px_rgba(0,0,0,0.85)] flex flex-col items-center text-center">
        {/* Header */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        <h3 className="text-xl font-black text-white tracking-wide">
          Pawn Promotion
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Your pawn reached the final rank! Choose which royal piece to promote to:
        </p>

        {/* 4 Choices Grid */}
        <div className="grid grid-cols-2 gap-2.5 w-full my-4">
          {PROMOTION_PIECES.map(item => {
            const isSelected = selectedPiece === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedPiece(item.type)}
                className={`p-3 rounded-2xl border-2 transition-all duration-150 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-400 shadow-lg shadow-indigo-600/30 scale-[1.02] ring-2 ring-indigo-500/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center">
                  <ChessPiece type={item.type} color={color} />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-white block">{item.label}</span>
                  <span className="text-[10px] text-slate-400 block line-clamp-1">{item.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-400 transition"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 font-extrabold text-xs sm:text-sm text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Confirm Promotion</span>
          </button>
        </div>
      </div>
    </div>
  );
};
