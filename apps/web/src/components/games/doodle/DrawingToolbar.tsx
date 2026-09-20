'use client';

import React, { useState } from 'react';
import { Paintbrush, Eraser, RotateCcw, Trash2, Check, AlertCircle } from 'lucide-react';

interface DrawingToolbarProps {
  currentTool: 'brush' | 'eraser';
  currentColor: string;
  currentBrushSize: number;
  canUndo: boolean;
  onToolChange: (tool: 'brush' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const PALETTE_COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Watch Rose', hex: '#F43F5E' },
  { name: 'Hot Pink', hex: '#EC4899' },
  { name: 'Electric Purple', hex: '#8B5CF6' },
  { name: 'Neon Blue', hex: '#3B82F6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Cyan', hex: '#06B6D4' }
];

const BRUSH_SIZES = [
  { label: 'Fine', size: 3, dotSize: 'w-1.5 h-1.5' },
  { label: 'Medium', size: 7, dotSize: 'w-2.5 h-2.5' },
  { label: 'Thick', size: 14, dotSize: 'w-3.5 h-3.5' },
  { label: 'Huge', size: 24, dotSize: 'w-5 h-5' }
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  currentColor,
  currentBrushSize,
  canUndo,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  onClear,
  disabled = false
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-[#111625]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
      {/* Tool Selector: Brush vs Eraser */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        <button
          type="button"
          onClick={() => onToolChange('brush')}
          disabled={disabled}
          title="Paintbrush"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentTool === 'brush'
              ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Paintbrush className="w-4 h-4" />
          <span className="hidden sm:inline">Draw</span>
        </button>

        <button
          type="button"
          onClick={() => onToolChange('eraser')}
          disabled={disabled}
          title="Eraser"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currentTool === 'eraser'
              ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Eraser className="w-4 h-4" />
          <span className="hidden sm:inline">Eraser</span>
        </button>
      </div>

      {/* Color Palette */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        {PALETTE_COLORS.map(c => {
          const isSelected = currentColor === c.hex && currentTool === 'brush';
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => {
                onColorChange(c.hex);
                if (currentTool === 'eraser') onToolChange('brush');
              }}
              disabled={disabled}
              title={c.name}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-transform ${
                isSelected
                  ? 'scale-110 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: c.hex }}
            >
              {isSelected && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.hex === '#FFFFFF' ? '#0c101c' : '#FFFFFF' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Brush Size Selector */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        {BRUSH_SIZES.map(b => {
          const isSelected = currentBrushSize === b.size;
          return (
            <button
              key={b.size}
              type="button"
              onClick={() => onBrushSizeChange(b.size)}
              disabled={disabled}
              title={`${b.label} brush (${b.size}px)`}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-white/20 text-white ring-1 ring-white/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div
                className={`rounded-full ${b.dotSize} ${
                  isSelected ? 'bg-white' : 'bg-zinc-400'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Actions: Undo & Clear */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || disabled}
          title="Undo last stroke"
          className={`p-2 rounded-xl border border-white/10 transition-all ${
            canUndo && !disabled
              ? 'text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95'
              : 'text-zinc-600 bg-white/[0.02] cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {showClearConfirm ? (
          <div className="flex items-center gap-1 bg-red-950/60 border border-red-500/40 rounded-xl px-2 py-1">
            <span className="text-[10px] font-black text-red-300 mr-1">Clear?</span>
            <button
              type="button"
              onClick={() => {
                onClear();
                setShowClearConfirm(false);
              }}
              className="p-1 rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95"
              title="Confirm Clear"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={disabled}
            title="Clear canvas"
            className={`p-2 rounded-xl border border-white/10 transition-all ${
              !disabled
                ? 'text-zinc-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 active:scale-95'
                : 'text-zinc-600 bg-white/[0.02] cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
