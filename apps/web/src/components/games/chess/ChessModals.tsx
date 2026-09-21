'use client';

import React from 'react';
import { Flag, Handshake, RotateCcw, Check, X, AlertTriangle } from 'lucide-react';

interface ChessResignModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ChessResignModal: React.FC<ChessResignModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm p-5 sm:p-6 rounded-3xl bg-slate-900 border border-rose-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-3">
          <Flag className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-black text-white">Resign Game?</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Are you sure you want to forfeit this match? Your opponent will be awarded victory.
        </p>

        <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95"
          >
            Resign
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChessDrawOfferModalProps {
  isOpen: boolean;
  fromDisplayName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const ChessDrawOfferModal: React.FC<ChessDrawOfferModalProps> = ({
  isOpen,
  fromDisplayName,
  onAccept,
  onDecline
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm p-5 sm:p-6 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-3">
          <Handshake className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-black text-white">Draw Offered</h3>
        <p className="text-xs text-slate-300 mt-1 max-w-xs">
          <strong className="text-indigo-300">{fromDisplayName}</strong> is offering a draw. Do you accept a shared half point?
        </p>

        <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
          <button
            type="button"
            onClick={onDecline}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-400 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" /> Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" /> Accept Draw
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChessTakebackModalProps {
  isOpen: boolean;
  fromDisplayName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const ChessTakebackModal: React.FC<ChessTakebackModalProps> = ({
  isOpen,
  fromDisplayName,
  onAccept,
  onDecline
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm p-5 sm:p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3">
          <RotateCcw className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-black text-white">Takeback Request</h3>
        <p className="text-xs text-slate-300 mt-1 max-w-xs">
          <strong className="text-amber-300">{fromDisplayName}</strong> is requesting to take back their last move. Allow?
        </p>

        <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
          <button
            type="button"
            onClick={onDecline}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-400 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" /> Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-xs font-bold text-white shadow-lg shadow-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" /> Allow Takeback
          </button>
        </div>
      </div>
    </div>
  );
};
