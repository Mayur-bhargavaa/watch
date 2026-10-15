'use client';

import React, { useEffect } from 'react';
import { ModalPortal } from '../ModalPortal';

interface DialogShellProps {
  label: string;
  onClose: () => void;
  /** Extra classes for the panel (the default is the small rounded card used by every composer dialog). */
  panelClassName?: string;
  /** Render the panel as a <form> (submit handler) instead of a <div>. */
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
}

/** Shared modal chrome: portal, dimmed backdrop (click closes), Escape closes, proper dialog semantics. */
export const DialogShell: React.FC<DialogShellProps> = ({ label, onClose, panelClassName = '', onSubmit, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const panelProps = {
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-label': label,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    className: `w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150 ${panelClassName}`
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
        {onSubmit ? (
          <form {...panelProps} onSubmit={onSubmit}>
            {children}
          </form>
        ) : (
          <div {...panelProps}>{children}</div>
        )}
      </div>
    </ModalPortal>
  );
};

export const FIELD_CLASS =
  'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#ee1d49]/40';
export const LABEL_CLASS = 'block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1';
export const SECONDARY_BTN = 'flex-1 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50';
export const PRIMARY_BTN = 'flex-1 py-2 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-xs font-bold text-white shadow-xs cursor-pointer';
