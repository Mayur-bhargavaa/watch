'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkles, Trash2, Undo2, Send, X, Palette } from 'lucide-react';
import { formatDrawStickerMessage } from './StickersData';
import { useTheme } from '../../context/ThemeContext';

interface DrawStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendDrawnSticker: (formattedStickerMessage: string) => void;
}

const NEON_PALETTE = [
  { name: 'Rose Glow', color: '#ff2d75', glow: '#ff2d75' },
  { name: 'Neon Amber', color: '#fbbf24', glow: '#f59e0b' },
  { name: 'Electric Cyan', color: '#06b6d4', glow: '#22d3ee' },
  { name: 'Emerald Pop', color: '#10b981', glow: '#34d399' },
  { name: 'Cyber Violet', color: '#a855f7', glow: '#c084fc' },
  { name: 'Pure White', color: '#ffffff', glow: '#ffffff' }
];

const ANIMATION_EFFECTS = [
  { id: 'float', name: 'Floating 🎈', css: 'animate-bounce' },
  { id: 'pulse', name: 'Pulsing 💓', css: 'animate-pulse' },
  { id: 'spin', name: 'Spinning 💫', css: 'animate-spin' },
  { id: 'wiggle', name: 'Wiggle ✨', css: 'hover:rotate-6' }
];

interface PathPoint {
  x: number;
  y: number;
}

interface Stroke {
  points: PathPoint[];
  color: string;
  size: number;
  glow: string;
}

export function DrawStickerModal({ isOpen, onClose, onSendDrawnSticker }: DrawStickerModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedColor, setSelectedColor] = useState(NEON_PALETTE[0].color);
  const [brushSize, setBrushSize] = useState(6);
  const [tagline, setTagline] = useState('MADE WITH LOVE ❤️');
  const [selectedAnim, setSelectedAnim] = useState('float');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Redraw canvas with high DPI and smooth neon glow
  const renderCanvas = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid texture
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw each stroke
      strokes.forEach((stroke) => {
        if (!stroke.points || stroke.points.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Neon outer glow pass
        ctx.shadowColor = stroke.glow;
        ctx.shadowBlur = stroke.size * 2.8;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();

        // High-brightness core line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, stroke.size * 0.35);

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      });
    } catch (err) {
      console.warn('Canvas render error:', err);
    }
  }, [strokes, isDark]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    try {
      isDrawingRef.current = true;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : null;
      const clientX = touch ? touch.clientX : ('clientX' in e ? e.clientX : undefined);
      const clientY = touch ? touch.clientY : ('clientY' in e ? e.clientY : undefined);
      if (clientX === undefined || clientY === undefined) return;

      const scaleX = canvas.width / (rect.width || 280);
      const scaleY = canvas.height / (rect.height || 280);
      const point = {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };

      const paletteItem = NEON_PALETTE.find((p) => p.color === selectedColor) || NEON_PALETTE[0];
      const newStroke: Stroke = {
        points: [point],
        color: paletteItem.color,
        size: brushSize,
        glow: paletteItem.glow
      };
      currentStrokeRef.current = newStroke;
      setStrokes((prev) => [...prev, newStroke]);
    } catch (err) {
      console.warn('handleStartDraw error:', err);
    }
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : null;
      const clientX = touch ? touch.clientX : ('clientX' in e ? e.clientX : undefined);
      const clientY = touch ? touch.clientY : ('clientY' in e ? e.clientY : undefined);
      if (clientX === undefined || clientY === undefined) return;

      const scaleX = canvas.width / (rect.width || 280);
      const scaleY = canvas.height / (rect.height || 280);
      const point = {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };

      currentStrokeRef.current.points.push(point);
      setStrokes((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          ...currentStrokeRef.current!,
          points: [...currentStrokeRef.current!.points]
        };
        return copy;
      });
    } catch (err) {
      console.warn('handleDraw error:', err);
    }
  };

  const handleEndDraw = () => {
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  // Convert hand strokes to optimized SVG markup
  const handleSend = () => {
    if (strokes.length === 0) return;

    // Create SVG paths
    const pathTags = strokes.map((s) => {
      if (s.points.length === 0) return '';
      const d = s.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 ${s.size}px ${s.glow})"/>`;
    }).join('');

    const animCls = selectedAnim === 'spin' ? 'animate-spin' : selectedAnim === 'pulse' ? 'animate-pulse' : 'animate-bounce';

    const svgMarkup = `<svg viewBox="0 0 280 280" class="w-full h-full ${animCls} drop-shadow-[0_4px_12px_rgba(255,45,117,0.6)]">${pathTags}</svg>`;

    const formatted = formatDrawStickerMessage(svgMarkup, tagline.trim() || 'HAND-DRAWN ✨');
    onSendDrawnSticker(formatted);
    onClose();
    setStrokes([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm sm:max-w-md border-2 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 select-none transition-colors ${
          isDark
            ? 'bg-gradient-to-b from-[#1b1222] to-[#0d0a14] border-rose-500/40 text-white shadow-[0_25px_70px_rgba(0,0,0,0.9)]'
            : 'bg-white border-rose-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-2 border-b ${
            isDark ? 'border-rose-500/20' : 'border-rose-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <Palette className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">
                Draw Your Animated Sticker
              </h3>
              <p
                className={`text-[10px] ${
                  isDark ? 'text-rose-300/70' : 'text-rose-600/70'
                }`}
              >
                Doodle anything & send live to chat!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-white/10'
                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas Area with Glowing Border */}
        <div
          className={`relative w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto rounded-3xl overflow-hidden border-2 touch-none flex items-center justify-center transition-colors ${
            isDark
              ? 'bg-black/60 border-rose-400/30 shadow-[inset_0_0_25px_rgba(0,0,0,0.8)]'
              : 'bg-slate-950 border-rose-300 shadow-inner'
          }`}
        >
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            onMouseDown={handleStartDraw}
            onMouseMove={handleDraw}
            onMouseUp={handleEndDraw}
            onMouseLeave={handleEndDraw}
            onTouchStart={handleStartDraw}
            onTouchMove={handleDraw}
            onTouchEnd={handleEndDraw}
            className="cursor-crosshair w-full h-full block"
          />

          {strokes.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-1.5 text-rose-300/50 text-xs font-semibold">
              <Sparkles className="w-6 h-6 animate-pulse text-rose-400/70" />
              <span>Draw anything with glowing neon brush!</span>
            </div>
          )}
        </div>

        {/* Color Palette & Brush Size Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold ${
                isDark ? 'text-rose-200/90' : 'text-slate-700'
              }`}
            >
              Neon Color:
            </span>
            <div className="flex items-center gap-1.5">
              {NEON_PALETTE.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setSelectedColor(c.color)}
                  style={{ backgroundColor: c.color, boxShadow: selectedColor === c.color ? `0 0 12px ${c.glow}` : 'none' }}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                    selectedColor === c.color
                      ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-rose-500'
                      : 'opacity-80 hover:scale-110'
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div
            className={`flex items-center justify-between gap-3 text-[11px] font-bold ${
              isDark ? 'text-rose-200/90' : 'text-slate-700'
            }`}
          >
            <span>Brush Size:</span>
            <div className="flex items-center gap-2">
              {[4, 7, 11].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setBrushSize(sz)}
                  className={`px-2 py-0.5 rounded-lg border text-xs transition cursor-pointer ${
                    brushSize === sz
                      ? 'bg-rose-500 text-white font-black border-rose-500 shadow-xs'
                      : isDark
                      ? 'border-white/10 text-zinc-400 hover:text-white'
                      : 'border-slate-200 text-slate-600 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  {sz === 4 ? 'Thin' : sz === 7 ? 'Medium' : 'Thick'}
                </button>
              ))}
            </div>
          </div>

          {/* Animation Effect Selector */}
          <div
            className={`flex items-center justify-between gap-2 pt-1 border-t ${
              isDark ? 'border-rose-500/15' : 'border-slate-100'
            }`}
          >
            <span
              className={`text-[11px] font-bold ${
                isDark ? 'text-rose-200/90' : 'text-slate-700'
              }`}
            >
              Vibe:
            </span>
            <div className="flex items-center gap-1">
              {ANIMATION_EFFECTS.map((eff) => (
                <button
                  key={eff.id}
                  type="button"
                  onClick={() => setSelectedAnim(eff.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    selectedAnim === eff.id
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
                      : isDark
                      ? 'bg-white/5 text-zinc-400 hover:text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {eff.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tagline / Caption Input */}
          <div className="pt-1">
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Tagline (e.g. MISS YOU, SLAY, BOINK)..."
              maxLength={26}
              className={`w-full px-3 py-1.5 border rounded-xl text-xs focus:outline-hidden transition ${
                isDark
                  ? 'bg-black/50 border-rose-500/30 text-white placeholder-rose-300/30 focus:border-rose-400'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-rose-500'
              }`}
            />
          </div>
        </div>

        {/* Action Buttons: Undo, Clear, and Send */}
        <div
          className={`flex items-center justify-between gap-2 pt-2 border-t ${
            isDark ? 'border-rose-500/20' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className={`p-2 rounded-xl border disabled:opacity-30 transition flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="Undo last stroke"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={strokes.length === 0}
              className={`p-2 rounded-xl border disabled:opacity-30 transition flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-red-300 hover:bg-red-500/20'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-red-600 hover:bg-red-50'
              }`}
              title="Clear all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={strokes.length === 0}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-rose-500/30 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Sticker ✨</span>
          </button>
        </div>
      </div>
    </div>
  );
}
