'use client';

import React from 'react';
import {
  Pencil,
  Eraser,
  Minus,
  Circle,
  Square,
  Type,
  MoreHorizontal,
  Undo2,
  Redo2,
  Trash2
} from 'lucide-react';

export type DoodleToolType = 'brush' | 'eraser' | 'line' | 'circle' | 'rectangle' | 'text';

interface DrawingToolbarProps {
  currentTool: DoodleToolType;
  currentColor: string;
  currentBrushSize: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onToolChange: (tool: DoodleToolType) => void;
  onColorChange: (color: string) => void;
  onBrushSizeChange?: (size: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  isDark?: boolean;
}

const PALETTE_COLORS = [
  { name: 'Black', hex: '#18181b' },
  { name: 'Red', hex: '#ff3864' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Dark Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' }
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  currentColor,
  currentBrushSize,
  canUndo = false,
  canRedo = false,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onClear,
  disabled = false,
  isDark = false
}) => {
  return (
    <div className="w-full flex items-center justify-between bg-white dark:bg-[#111625] rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(240,160,200,0.08)] px-1.5 sm:px-3 py-1 sm:py-2 select-none overflow-x-auto scrollbar-none gap-1 sm:gap-2 shrink-0">
      {/* 1. Tool Selection Group */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {/* Pen */}
        <button
          type="button"
          onClick={() => onToolChange('brush')}
          disabled={disabled}
          title="Pencil / Freehand"
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all active:scale-95 ${
            currentTool === 'brush'
              ? 'bg-[#ff3864] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Eraser */}
        <button
          type="button"
          onClick={() => onToolChange('eraser')}
          disabled={disabled}
          title="Eraser"
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all active:scale-95 ${
            currentTool === 'eraser'
              ? 'bg-[#ff3864] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Line */}
        <button
          type="button"
          onClick={() => onToolChange('line')}
          disabled={disabled}
          title="Straight Line"
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all active:scale-95 ${
            currentTool === 'line'
              ? 'bg-[#ff3864] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 -rotate-45" />
        </button>

        {/* Circle */}
        <button
          type="button"
          onClick={() => onToolChange('circle')}
          disabled={disabled}
          title="Circle"
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all active:scale-95 ${
            currentTool === 'circle'
              ? 'bg-[#ff3864] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Square */}
        <button
          type="button"
          onClick={() => onToolChange('rectangle')}
          disabled={disabled}
          title="Rectangle"
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all active:scale-95 ${
            currentTool === 'rectangle'
              ? 'bg-[#ff3864] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Text */}
        <button
          type="button"
          onClick={() => onToolChange('text')}
          disabled={disabled}
          title="Text Tool"
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all active:scale-95 ${
            currentTool === 'text'
              ? 'bg-[#ff3864] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-[1px] h-5 sm:h-6 bg-slate-200 dark:bg-white/10 mx-0.5 sm:mx-1.5 shrink-0" />

      {/* 2. Color Palette */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {PALETTE_COLORS.map(c => {
          const isSelected = currentColor === c.hex && currentTool !== 'eraser';
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
              className={`w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 rounded-full transition-transform active:scale-90 shrink-0 ${
                isSelected
                  ? 'scale-125 ring-2 ring-[#ff3864] ring-offset-2 dark:ring-offset-[#111625]'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          );
        })}

        {/* Custom Color Picker via More dots */}
        <label
          className="relative w-5 h-5 sm:w-6 sm:h-6 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition shrink-0"
          title="More colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <input
            type="color"
            value={currentColor}
            onChange={e => {
              onColorChange(e.target.value);
              if (currentTool === 'eraser') onToolChange('brush');
            }}
            disabled={disabled}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>
      </div>

      {/* Divider */}
      <div className="w-[1px] h-5 sm:h-6 bg-slate-200 dark:bg-white/10 mx-0.5 sm:mx-1.5 shrink-0" />

      {/* 3. Action Group: Undo, Redo, Clear */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || disabled}
          title="Undo"
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo || disabled}
          title="Redo"
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={!canUndo || disabled}
          title="Clear Canvas"
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
};
