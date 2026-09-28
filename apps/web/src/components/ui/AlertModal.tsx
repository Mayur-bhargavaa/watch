'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

export type AlertModalType = 'info' | 'success' | 'warning' | 'error';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | React.ReactNode;
  type?: AlertModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  icon?: React.ReactNode;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'Got It',
  cancelText,
  onConfirm,
  icon
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getThemeDetails = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-rose-400" />,
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          buttonBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/60',
          borderGlow: 'border-rose-500/30 shadow-[0_0_35px_rgba(244,63,94,0.2)]'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-rose-400" />,
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          buttonBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/60',
          borderGlow: 'border-rose-500/30 shadow-[0_0_35px_rgba(244,63,94,0.2)]'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-8 h-8 text-rose-400" />,
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          buttonBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/60',
          borderGlow: 'border-rose-500/30 shadow-[0_0_35px_rgba(244,63,94,0.2)]'
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-8 h-8 text-rose-400" />,
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          buttonBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/60',
          borderGlow: 'border-rose-500/30 shadow-[0_0_35px_rgba(244,63,94,0.2)]'
        };
    }
  };

  const theme = getThemeDetails();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-[min(calc(100vw-24px),380px)] sm:max-w-sm bg-[#160c15]/95 border rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-2xl text-white text-center animate-in zoom-in-95 duration-200 ${theme.borderGlow}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Circle */}
        <div className={`mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center mb-3 shadow-inner ${theme.badgeBg}`}>
          {icon || theme.icon}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-black tracking-tight text-white mb-1.5 sm:mb-2">
          {title}
        </h3>

        {/* Message */}
        <div className="text-xs sm:text-sm text-rose-100/80 mb-5 sm:mb-6 leading-relaxed">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col xs:flex-row items-center gap-2 xs:gap-2.5 justify-center w-full">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className="w-full xs:flex-1 py-2.5 px-3 sm:px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer whitespace-nowrap text-center justify-center flex items-center"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full xs:flex-1 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer whitespace-nowrap text-center justify-center flex items-center ${theme.buttonBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
