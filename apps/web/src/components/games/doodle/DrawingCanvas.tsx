'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DoodleStroke, DoodlePoint } from '@synccinema/common';

interface DrawingCanvasProps {
  isDrawer: boolean;
  strokes: DoodleStroke[];
  currentTool: 'brush' | 'eraser';
  currentColor: string;
  currentBrushSize: number;
  onStrokeComplete?: (stroke: DoodleStroke) => void;
  disabled?: boolean;
}

const CANVAS_BG_COLOR = '#0c101c';

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  strokes,
  currentTool,
  currentColor,
  currentBrushSize,
  onStrokeComplete,
  disabled = false
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
  }, []);

  // Helper to render all strokes to canvas
  const renderAllStrokes = useCallback(
    (committedStrokes: DoodleStroke[], livePoints: DoodlePoint[], w: number, h: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill canvas background
      ctx.fillStyle = CANVAS_BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      // Subtle artistic dot grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      const step = 28;
      for (let x = step; x < w; x += step) {
        for (let y = step; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

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
        ctx.strokeStyle = stroke.isEraser ? CANVAS_BG_COLOR : stroke.color;

        if (pts.length === 1) {
          ctx.fillStyle = stroke.isEraser ? CANVAS_BG_COLOR : stroke.color;
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
    [currentColor, currentBrushSize, currentTool]
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
    if (pt) {
      currentPointsRef.current.push(pt);
      // Sample update every 2 points to avoid React re-render lag during rapid drawing
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

    const pts = currentPointsRef.current;
    currentPointsRef.current = [];
    setActivePoints([]);

    if (pts.length > 0 && onStrokeComplete) {
      const stroke: DoodleStroke = {
        id: `strk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        color: currentColor,
        size: currentBrushSize,
        points: pts,
        isEraser: currentTool === 'eraser',
        timestamp: Date.now()
      };
      onStrokeComplete(stroke);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0c101c]"
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

      {/* Floating Mode Watermark for Guesser */}
      {!isDrawer && (
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 pointer-events-none select-none">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>LIVE DRAWING</span>
        </div>
      )}
    </div>
  );
};
