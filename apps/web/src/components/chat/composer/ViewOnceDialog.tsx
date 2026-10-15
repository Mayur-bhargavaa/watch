'use client';

import React from 'react';
import { DialogShell } from './DialogShell';

export const ViewOnceDialog: React.FC<{ onConfirm: () => void; onClose: () => void }> = ({ onConfirm, onClose }) => (
  <DialogShell label="Send photo as view once" onClose={onClose} panelClassName="p-6 space-y-4 text-center">
    <div className="w-14 h-14 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-[#ee1d49] mx-auto flex items-center justify-center font-black text-xl border-2 border-[#ee1d49]">
      1
    </div>
    <div className="space-y-1.5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">Photo Set to View Once</h3>
      <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300 px-2">
        For privacy, this photo can only be opened once. However, as this is a web-based app, recipients can still take
        screenshots or screen recordings. Please send images at your own risk.
      </p>
    </div>
    <div className="pt-2 flex flex-col gap-2">
      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-2.5 rounded-2xl bg-[#ee1d49] hover:bg-[#d61840] text-white font-bold text-xs shadow-md shadow-rose-500/20 transition active:scale-98 cursor-pointer"
      >
        Send as View Once
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 text-xs font-semibold transition cursor-pointer"
      >
        Keep as Regular Photo
      </button>
    </div>
  </DialogShell>
);
