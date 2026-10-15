'use client';

import React from 'react';
import { Send, Trash2 } from 'lucide-react';

interface Props {
  seconds: number;
  bars: number[];
  onCancel: () => void;
  onSend: () => void;
}

export const RecordingBar: React.FC<Props> = ({ seconds, bars, onCancel, onSend }) => {
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 animate-in fade-in w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ee1d49] animate-ping shrink-0" />
        <span className="text-xs sm:text-sm font-bold text-[#ee1d49] tabular-nums shrink-0" aria-live="off">
          {mm}:{ss}
        </span>
        <div className="hidden xs:flex items-center gap-0.5 h-5 pl-1 shrink-0" aria-hidden="true">
          {bars.map((val, idx) => (
            <div key={idx} className="w-1 bg-[#ee1d49] rounded-full transition-all duration-75" style={{ height: `${Math.max(4, (val / 100) * 18)}px` }} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button type="button" onClick={onCancel} className="p-1.5 sm:p-2 rounded-full text-slate-500 hover:text-rose-600 hover:bg-white/60 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0" title="Cancel recording" aria-label="Cancel recording">
          <Trash2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={onSend} className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-xl bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0">
          <Send className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Send Voice</span>
        </button>
      </div>
    </div>
  );
};
