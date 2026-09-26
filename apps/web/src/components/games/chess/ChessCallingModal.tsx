'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GripHorizontal,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  Minus,
  X as CloseIcon,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../LudoGame';

interface ChessCallingModalProps {
  videoGridParticipants: VideoGridParticipant[];
  isMicMuted: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const ChessCallingModal: React.FC<ChessCallingModalProps> = ({
  videoGridParticipants = [],
  isMicMuted,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  isChatOpen,
  isOpen,
  onClose
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  // Set default initial position on screen
  useEffect(() => {
    if (typeof window !== 'undefined' && position === null) {
      const initX = Math.max(20, window.innerWidth - 380);
      const initY = Math.max(80, window.innerHeight - 240);
      setPosition({ x: initX, y: initY });
    }
  }, [position]);

  // Handle Dragging
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = pipRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : 32;
    const currentY = rect ? rect.top : 140;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const windowW = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;

      const newX = Math.max(12, Math.min(windowW - 200, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(12, Math.min(windowH - 80, dragStartRef.current.initialY + deltaY));

      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      dragStartRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <div
      ref={pipRef}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : { right: '28px', bottom: '28px' }
      }
      className={`fixed z-50 select-none bg-white/95 dark:bg-[#1a1628]/95 border border-pink-200/90 dark:border-white/10 rounded-3xl shadow-[0_15px_45px_rgba(255,43,112,0.15)] backdrop-blur-2xl transition-shadow ${
        isDragging
          ? 'cursor-grabbing ring-2 ring-[#ff2b70]/60 shadow-[0_25px_60px_rgba(255,43,112,0.3)] scale-[1.02]'
          : 'cursor-grab hover:border-pink-300'
      } ${isMinimized ? 'px-3.5 py-2' : 'p-3'}`}
    >
      {/* Top Bar: Drag Grip + In-Call Controls */}
      <div className="flex items-center justify-between gap-3 pb-2 mb-1 border-b border-pink-100 dark:border-white/10 touch-none">
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 pointer-events-none">
          <GripHorizontal className="w-4 h-4 text-[#ff2b70]" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-wider text-[#16132b] dark:text-white">
            Call ({Math.max(1, videoGridParticipants.length)})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Rotate Orientation Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:text-[#ff2b70] shadow-xs cursor-pointer"
            title={`Rotate Layout (${orientation === 'horizontal' ? 'Switch to Vertical' : 'Switch to Horizontal'})`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Mic Toggle Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMic();
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-xs cursor-pointer ${
              isMicMuted
                ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-300/60'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 animate-pulse" />}
          </button>

          {/* Cam Toggle Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCamera();
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-xs cursor-pointer ${
              isCameraOn
                ? 'bg-pink-100 border-pink-300 text-[#ff2b70] hover:bg-pink-200 ring-1 ring-pink-400/40'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10'
            }`}
            title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </button>

          {/* Chat Toggle Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleChat();
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-xs cursor-pointer ${
              isChatOpen
                ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-sm'
                : 'bg-pink-50 border-pink-200 text-[#ff2b70] hover:bg-pink-100 dark:bg-pink-950/40'
            }`}
            title={isChatOpen ? 'Close Chat Drawer' : 'Open Match Chat'}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          {/* Minimize / Expand Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            title={isMinimized ? 'Expand Video Tiles' : 'Minimize Video Tiles'}
          >
            <Minus className="w-3 h-3" />
          </button>

          {/* Close Icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            title="Hide Floating Call Window"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Video Boxes */}
      {!isMinimized && (
        <div className={`flex gap-2.5 pt-1 ${orientation === 'horizontal' ? 'flex-row items-center' : 'flex-col items-center'}`}>
          {videoGridParticipants.length === 0 ? (
            <div className="text-center py-4 px-6 text-xs text-slate-400">
              Connecting audio & video...
            </div>
          ) : (
            videoGridParticipants.map(participant => {
              const isSelfPlayer = participant.isSelf;
              const hasLiveVideoTrack = Boolean(
                participant.stream &&
                participant.stream.getVideoTracks().length > 0 &&
                participant.stream.getVideoTracks().some(t => t.readyState !== 'ended')
              );
              const shouldShowVideo = Boolean(
                (participant.isCameraOn || hasLiveVideoTrack) &&
                participant.stream &&
                hasLiveVideoTrack
              );

              return (
                <div
                  key={participant.userId}
                  className="relative w-28 sm:w-32 h-24 sm:h-26 rounded-2xl bg-slate-50/80 dark:bg-white/5 border border-pink-100 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner"
                >
                  {shouldShowVideo && participant.stream ? (
                    <VideoAvatar
                      stream={participant.stream}
                      isSelf={participant.isSelf}
                      displayName={participant.displayName}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative">
                        <div
                          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md ${
                            isSelfPlayer
                              ? 'bg-gradient-to-tr from-[#ff2b70] to-[#f43f5e]'
                              : 'bg-gradient-to-tr from-[#7c3aed] to-[#a855f7]'
                          }`}
                        >
                          {participant.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center absolute -bottom-0.5 -right-0.5 shadow-xs border border-white ${
                            participant.isMuted
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {participant.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 mt-1.5 truncate max-w-[80px]">
                        {participant.isSelf ? 'You' : participant.displayName}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
