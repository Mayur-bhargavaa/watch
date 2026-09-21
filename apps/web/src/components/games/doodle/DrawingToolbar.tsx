'use client';

import React, { useState } from 'react';
import { Paintbrush, Eraser, RotateCcw, Trash2, Check, AlertCircle } from 'lucide-react';

interface DrawingToolbarProps {
  currentTool: 'brush' | 'eraser';
  currentColor: string;
  currentBrushSize: number;
  canUndo?: boolean;
  onToolChange: (tool: 'brush' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  isDark?: boolean;
}

const PALETTE_COLORS = [
  { name: 'Black', hex: '#111827' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Purple', hex: '#8B5CF6' }
];

const BRUSH_SIZES = [
  { size: 4, dotClass: 'w-1.5 h-1.5' },
  { size: 8, dotClass: 'w-2.5 h-2.5' },
  { size: 14, dotClass: 'w-4 h-4' }
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  currentColor,
  currentBrushSize,
  canUndo = false,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  onClear,
  disabled = false,
  isDark = false
}) => {
  return (
    <div className="w-full flex items-center justify-center pointer-events-auto">
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-colors ${
          isDark
            ? 'bg-[#111625]/90 border-white/10 text-white shadow-black/40'
            : 'bg-white border-slate-200/90 text-slate-800'
        }`}
      >
        {/* Draw Button (Pink pill when active) */}
        <button
          type="button"
          onClick={() => onToolChange('brush')}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
            currentTool === 'brush'
              ? 'bg-[#f43f5e] text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)]'
              : isDark
              ? 'text-zinc-400 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          <span>Draw</span>
        </button>

        {/* Eraser Button */}
        <button
          type="button"
          onClick={() => onToolChange('eraser')}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
            currentTool === 'eraser'
              ? 'bg-[#f43f5e] text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)]'
              : isDark
              ? 'text-zinc-400 hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Eraser</span>
        </button>

        {/* Brush Sizes (3 Dots) */}
        <div className="flex items-center gap-1.5 px-1">
          {BRUSH_SIZES.map(b => {
            const isSelected = currentBrushSize === b.size;
            return (
              <button
                key={b.size}
                type="button"
                onClick={() => onBrushSizeChange(b.size)}
                disabled={disabled}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isSelected
                    ? isDark
                      ? 'bg-white/20 ring-2 ring-white/40'
                      : 'bg-slate-100 ring-2 ring-slate-400'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
                title={`Brush size ${b.size}px`}
              >
                <div
                  className={`rounded-full ${b.dotClass} ${
                    isSelected
                      ? isDark
                        ? 'bg-white'
                        : 'bg-slate-800'
                      : isDark
                      ? 'bg-zinc-400'
                      : 'bg-slate-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div
          className={`w-[1px] h-6 mx-0.5 ${
            isDark ? 'bg-white/10' : 'bg-slate-200'
          }`}
        />

        {/* Palette Circles */}
        <div className="flex items-center gap-2">
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
                className={`w-6 h-6 rounded-full transition-transform active:scale-95 ${
                  isSelected
                    ? 'scale-125 ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-[#111625]'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}

          {/* Rainbow Color Picker Button */}
          <label
            className="relative w-6 h-6 rounded-full cursor-pointer overflow-hidden transition-transform hover:scale-110 flex items-center justify-center shadow-xs"
            style={{
              background:
                'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
            }}
            title="Custom color picker"
          >
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
      </div>
    </div>
  );
};
