'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface FullScreenImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  caption?: string;
  senderName?: string;
  timestamp?: string;
  isViewOnce?: boolean;
}

export const FullScreenImageViewer: React.FC<FullScreenImageViewerProps> = ({
  isOpen,
  onClose,
  imageUrl,
  caption,
  senderName,
  timestamp,
  isViewOnce = false
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef(1);
  const lastTapTimeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset zoom and pan on open/close
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Keyboard navigation: Escape to close, +/- to zoom
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(4, prev + 0.5));
      } else if (e.key === '-' || e.key === '_') {
        setScale((prev) => {
          const next = Math.max(1, prev - 0.5);
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((prev) => {
      const next = Math.min(4, Math.max(1, prev + delta));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Double tap / Double click to zoom
  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (scale > 1.2) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      setScale(2.5);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = (clientX - (rect.left + rect.width / 2)) * -1;
        const offsetY = (clientY - (rect.top + rect.height / 2)) * -1;
        setPan({ x: Math.max(-200, Math.min(200, offsetX)), y: Math.max(-200, Math.min(200, offsetY)) });
      }
    }
  };

  // Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (scale > 1) {
      const maxPan = (scale - 1) * 350;
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panX + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panY + dy))
      });
    } else {
      if (dy > 0) {
        setPan({ x: 0, y: dy });
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (scale === 1 && pan.y > 100) {
        onClose();
      } else if (scale === 1) {
        setPan({ x: 0, y: 0 });
      }
    }
  };

  // Touch handlers: Pinch to zoom, swipe down to dismiss, pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
      touchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap(touch.clientX, touch.clientY);
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: pan.x,
        panY: pan.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchDistanceRef.current;
      const newScale = Math.min(4, Math.max(1, touchStartScaleRef.current * factor));
      setScale(newScale);
      if (newScale === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;

      if (scale > 1) {
        const maxPan = (scale - 1) * 350;
        setPan({
          x: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panX + dx)),
          y: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panY + dy))
        });
      } else {
        if (dy > 0) {
          setPan({ x: 0, y: dy });
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    if (isDragging) {
      setIsDragging(false);
      if (scale === 1 && pan.y > 90) {
        onClose();
      } else if (scale === 1) {
        setPan({ x: 0, y: 0 });
      }
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `watch_image_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const zoomIn = () => setScale((s) => Math.min(4, s + 0.5));
  const zoomOut = () =>
    setScale((s) => {
      const next = Math.max(1, s - 0.5);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  const resetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
        onClick={onClose}
        style={{
          opacity: scale === 1 && pan.y > 0 ? Math.max(0.3, 1 - pan.y / 300) : 1
        }}
      >
        {/* Top Header Controls */}
        <div
          className="w-full max-w-5xl mx-auto flex items-center justify-between p-3 sm:p-4 text-white z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Info */}
          <div className="flex items-center gap-3">
            {isViewOnce ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-[#ee1d49] bg-[#ee1d49] text-white flex items-center justify-center text-xs font-black">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">View Once Photo</h4>
                  <p className="text-[10px] text-zinc-400">Will be marked as Opened once closed</p>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-bold text-white">{senderName || 'Photo'}</h4>
                {timestamp && <p className="text-[11px] text-zinc-400">{timestamp}</p>}
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isViewOnce && (
              <>
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={scale <= 1}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1.5 text-zinc-300 font-semibold min-w-[42px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={scale >= 4}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {scale > 1 && (
                  <button
                    type="button"
                    onClick={resetZoom}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                    title="Reset Zoom (0)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Download image"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Image Stage */}
        <div
          ref={containerRef}
          className="flex-1 w-full flex items-center justify-center p-2 sm:p-6 overflow-hidden touch-none relative cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
        >
          <img
            src={imageUrl}
            alt="Full size preview"
            draggable={false}
            className="max-h-[82vh] max-w-[95vw] object-contain rounded-xl shadow-2xl transition-transform duration-75 select-none pointer-events-none"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
            }}
          />
        </div>

        {/* Bottom Caption & Dismiss Hint */}
        <div
          className="w-full max-w-2xl mx-auto flex flex-col items-center gap-2 p-3 sm:p-4 text-center z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {caption && (
            <p className="text-sm text-white/95 bg-black/60 border border-white/10 px-5 py-2.5 rounded-2xl backdrop-blur-md max-w-lg shadow-lg">
              {caption}
            </p>
          )}

          {isViewOnce ? (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-full bg-[#ee1d49] hover:bg-[#d61840] text-white text-xs font-bold shadow-lg shadow-rose-500/30 transition cursor-pointer"
            >
              Close photo
            </button>
          ) : (
            <span className="text-[10px] text-zinc-400 font-medium select-none">
              Pinch or double tap to zoom • Drag down to close
            </span>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
