'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { PendingImage } from './usePendingImage';

interface Props {
  image: PendingImage;
  onToggleViewOnce: () => void;
  onRemove: () => void;
}

/** Preview strip shown after picking a photo and before sending it. */
export const PendingImageBar: React.FC<Props> = ({ image, onToggleViewOnce, onRemove }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800/95 border border-slate-200/80 dark:border-zinc-700/60 shadow-xs animate-in fade-in slide-in-from-bottom-2">
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/10 shrink-0 border border-black/10 dark:border-white/10">
        <img src={image.previewUrl} alt="Selected preview" className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate max-w-[140px] sm:max-w-xs">{image.file.name}</p>
        <p className="text-[10px] text-slate-500 dark:text-zinc-400">{(image.file.size / 1024).toFixed(0)} KB • Ready to send</p>
      </div>
    </div>

    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onToggleViewOnce}
        aria-pressed={image.isViewOnce}
        className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold transition cursor-pointer select-none ${
          image.isViewOnce
            ? 'bg-[#ee1d49] text-white shadow-xs shadow-[#ee1d49]/30 ring-2 ring-[#ee1d49]/40'
            : 'bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 hover:border-[#ee1d49]/50'
        }`}
        title={image.isViewOnce ? 'View once is enabled (tap to disable)' : 'Set photo to view once (tap to enable)'}
      >
        <div className={`w-4 h-4 rounded-full border-1.5 flex items-center justify-center text-[10px] font-black ${image.isViewOnce ? 'border-white text-white' : 'border-current'}`}>
          1
        </div>
        <span className="text-[11px] font-semibold">{image.isViewOnce ? 'View once ON' : 'View once'}</span>
      </button>

      <button type="button" onClick={onRemove} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700 transition cursor-pointer" title="Remove image" aria-label="Remove image">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);
