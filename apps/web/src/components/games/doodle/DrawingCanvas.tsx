'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Palette, Trash2 } from 'lucide-react';
import { DoodleStroke, DoodlePoint } from '@synccinema/common';
import { DoodleToolType } from './DrawingToolbar';

interface DrawingCanvasProps {
  isDrawer: boolean;
  strokes: DoodleStroke[];
  currentTool: DoodleToolType;
  currentColor: string;
  currentBrushSize: number;
  onStrokeComplete?: (stroke: DoodleStroke) => void;
  onUndo?: () => void;
  onClear?: () => void;
  onBrushSizeChange?: (size: number) => void;
  canUndo?: boolean;
  disabled?: boolean;
  isDark?: boolean;
}

const CANVAS_BG_LIGHT = '#FFFFFF';
const CANVAS_BG_DARK = '#141927';

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  strokes,
  currentTool,
  currentColor,
  currentBrushSize,
  onStrokeComplete,
  onUndo,
  onClear,
  onBrushSizeChange,
  canUndo = false,
  disabled = false,
  isDark = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activePoints, setActivePoints] = useState<DoodlePoint[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<DoodlePoint[]>([]);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600
  });

  const canvasBg = isDark ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

  // Helper to generate circle points
  const generateCirclePoints = (p1: DoodlePoint, p2: DoodlePoint): DoodlePoint[] => {
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const rx = Math.abs(p2.x - p1.x) / 2;
    const ry = Math.abs(p2.y - p1.y) / 2;
    const pts: DoodlePoint[] = [];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      pts.push({
        x: cx + rx * Math.cos(theta),
        y: cy + ry * Math.sin(theta)
      });
    }
    return pts;
  };

  // Helper to generate rectangle points
  const generateRectPoints = (p1: DoodlePoint, p2: DoodlePoint): DoodlePoint[] => {
    return [
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p1.y },
      { x: p2.x, y: p2.y },
      { x: p1.x, y: p2.y },
      { x: p1.x, y: p1.y }
    ];
  };

  // Resize canvas according to container
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const width = Math.max(rect.width, 320);
      const height = Math.max(rect.height, 240);

      setCanvasDimensions({ width, height });

      const canvas = canvasRef.current;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      renderAllStrokes(strokes, currentPointsRef.current, width, height);
    };

    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [canvasBg]);

  // Helper to render all strokes to canvas
  const renderAllStrokes = useCallback(
    (committedStrokes: DoodleStroke[], livePoints: DoodlePoint[], w: number, h: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill canvas background
      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, w, h);

      const drawStrokeOnCtx = (stroke: {
        points: DoodlePoint[];
        color: string;
        size: number;
        isEraser?: boolean;
      }) => {
        const pts = stroke.points;
        if (!pts || pts.length === 0) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke.size;
        ctx.strokeStyle = stroke.isEraser ? canvasBg : stroke.color;

        if (pts.length === 1) {
          ctx.fillStyle = stroke.isEraser ? canvasBg : stroke.color;
          ctx.beginPath();
          ctx.arc(pts[0].x * w, pts[0].y * h, stroke.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        ctx.beginPath();
        ctx.moveTo(pts[0].x * w, pts[0].y * h);

        for (let i = 1; i < pts.length - 1; i++) {
          const xc = ((pts[i].x + pts[i + 1].x) / 2) * w;
          const yc = ((pts[i].y + pts[i + 1].y) / 2) * h;
          ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, xc, yc);
        }

        const last = pts[pts.length - 1];
        ctx.lineTo(last.x * w, last.y * h);
        ctx.stroke();
        ctx.restore();
      };

      // Draw committed strokes
      for (const stroke of committedStrokes) {
        drawStrokeOnCtx(stroke);
      }

      // Draw active in-progress stroke if drawer is currently drawing
      if (livePoints.length > 0) {
        drawStrokeOnCtx({
          points: livePoints,
          color: currentColor,
          size: currentBrushSize,
          isEraser: currentTool === 'eraser'
        });
      }
    },
    [currentColor, currentBrushSize, currentTool, canvasBg]
  );

  // Re-render when strokes change or active points update
  useEffect(() => {
    renderAllStrokes(strokes, activePoints, canvasDimensions.width, canvasDimensions.height);
  }, [strokes, activePoints, canvasDimensions, renderAllStrokes]);

  // Pointer event handlers for Drawer
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): DoodlePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getNormalizedPoint(e);
    if (pt) {
      currentPointsRef.current = [pt];
      setActivePoints([pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer || disabled) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    if (currentTool === 'line') {
      const start = currentPointsRef.current[0];
      const previewPts = [start, pt];
      setActivePoints(previewPts);
    } else if (currentTool === 'circle') {
      const start = currentPointsRef.current[0];
      const previewPts = generateCirclePoints(start, pt);
      setActivePoints(previewPts);
    } else if (currentTool === 'rectangle') {
      const start = currentPointsRef.current[0];
      const previewPts = generateRectPoints(start, pt);
      setActivePoints(previewPts);
    } else {
      // Freehand brush or eraser
      currentPointsRef.current.push(pt);
      if (currentPointsRef.current.length % 2 === 0) {
        setActivePoints([...currentPointsRef.current]);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer || disabled) return;
    isDrawingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const pt = getNormalizedPoint(e);
    let finalPts: DoodlePoint[] = [];

    if (currentTool === 'line' && pt && currentPointsRef.current.length > 0) {
      finalPts = [currentPointsRef.current[0], pt];
    } else if (currentTool === 'circle' && pt && currentPointsRef.current.length > 0) {
      finalPts = generateCirclePoints(currentPointsRef.current[0], pt);
    } else if (currentTool === 'rectangle' && pt && currentPointsRef.current.length > 0) {
      finalPts = generateRectPoints(currentPointsRef.current[0], pt);
    } else {
      finalPts = currentPointsRef.current;
    }

    currentPointsRef.current = [];
    setActivePoints([]);

    if (finalPts.length > 0) {
      const stroke: DoodleStroke = {
        id: `strk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        color: currentColor,
        size: currentBrushSize,
        points: finalPts,
        isEraser: currentTool === 'eraser',
        timestamp: Date.now()
      };
      renderAllStrokes([...strokes, stroke], [], canvasDimensions.width, canvasDimensions.height);
      if (onStrokeComplete) {
        onStrokeComplete(stroke);
      }
    }
  };

  const hasStrokes = strokes.length > 0 || activePoints.length > 0;

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-3xl p-3 border transition-colors ${
        isDark
          ? 'bg-[#111625] border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
          : 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(240,160,200,0.08)]'
      }`}
    >
      {/* 1. Inner Canvas Drawing Surface with subtle dashed border */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full min-h-[340px] rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5 overflow-hidden flex items-center justify-center bg-white dark:bg-[#141927]"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full block ${
            isDrawer && !disabled ? 'cursor-crosshair' : 'cursor-default pointer-events-none'
          }`}
          style={{ touchAction: 'none' }}
        />

        {/* Center Empty State Placeholder matching Mockup */}
        {!hasStrokes && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
            <div className="w-13 h-13 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center mb-2 shadow-xs">
              <Palette className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
            </div>
            <span className="text-sm font-extrabold text-[#1e1435] dark:text-white mb-0.5">
              Start drawing...
            </span>
            <span className="text-[11px] text-[#8a80a0] dark:text-zinc-400">
              Bring your idea to life!
            </span>
            {/* Cute hand-drawn curved arrow pointing down-right */}
            <svg
              className="w-7 h-7 text-slate-300 dark:text-zinc-600 mt-2 ml-8"
              viewBox="0 0 40 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 8 C 24 14, 28 24, 24 33" />
              <path d="M19 29 L 24 34 L 28 28" />
            </svg>
          </div>
        )}

        {/* Floating Live Drawing badge for Guesser */}
        {!isDrawer && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 pointer-events-none select-none">
            <span className="w-2 h-2 rounded-full bg-[#ff3864] animate-ping" />
            <span>LIVE DRAWING</span>
          </div>
        )}
      </div>

      {/* 2. Bottom Controls Bar: Brush Size Slider + Clear Canvas */}
      <div className="flex items-center justify-between px-2 pt-2.5 select-none">
        {/* Left: Brush Size */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
            Brush Size
          </span>
          <input
            type="range"
            min={2}
            max={24}
            value={currentBrushSize}
            onChange={e => onBrushSizeChange?.(Number(e.target.value))}
            disabled={!isDrawer || disabled}
            className="w-24 sm:w-32 accent-[#ff3864] h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg cursor-pointer"
          />
        </div>

        {/* Right: Clear Canvas */}
        <button
          type="button"
          onClick={onClear}
          disabled={!isDrawer || disabled || strokes.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Canvas</span>
        </button>
      </div>
    </div>
  );
};

