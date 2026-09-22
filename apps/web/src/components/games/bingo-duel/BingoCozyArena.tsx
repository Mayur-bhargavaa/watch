'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Music,
  Settings,
  Maximize,
  Minimize,
  Crown,
  User,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { BingoDuelCompletedLine } from '@synccinema/common';

export interface BingoCozyArenaProps {
  roomCode?: string;
  board: number[][]; // 5x5 numbers
  playerMarks: number[]; // Player 1 (me) marks
  opponentMarks: number[]; // Player 2 marks
  currentNumber: number | null;
  calledNumbers?: number[];
  completedLines?: BingoDuelCompletedLine[];
  winningIndices?: [number, number][];
  isMyTurn?: boolean;
  currentTurnDisplayName?: string;
  player1: {
    displayName: string;
    avatarUrl?: string | null;
    userId: string;
  };
  player2: {
    displayName: string;
    avatarUrl?: string | null;
    userId: string;
  };
  onCellClick: (num: number) => void;
  onReset?: () => void;
  onClaimBingo?: () => void;
  canClaimBingo?: boolean;
  isFinished?: boolean;
  isRoundOver?: boolean;
  onOpenSettings?: () => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  unreadChatCount?: number;
  onLeave?: () => void;
  leaveLabel?: string;
}

export const BingoCozyArena: React.FC<BingoCozyArenaProps> = ({
  roomCode,
  board,
  playerMarks = [],
  opponentMarks = [],
  currentNumber,
  calledNumbers = [],
  completedLines = [],
  winningIndices,
  isMyTurn = false,
  currentTurnDisplayName = 'You',
  player1,
  player2,
  onCellClick,
  onReset,
  onClaimBingo,
  canClaimBingo = false,
  isFinished = false,
  isRoundOver = false,
  onOpenSettings,
  onToggleChat,
  isChatOpen = false,
  unreadChatCount = 0,
  onLeave,
  leaveLabel
}) => {
  // Audio Mute and Fullscreen states
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Sets for quick membership lookups
  const p1MarkSet = useMemo(() => new Set(playerMarks), [playerMarks]);
  const p2MarkSet = useMemo(() => new Set(opponentMarks), [opponentMarks]);
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);

  const winningCoordSet = useMemo(() => {
    if (!winningIndices) return new Set<string>();
    return new Set(winningIndices.map(([r, c]) => `${r},${c}`));
  }, [winningIndices]);

  const letters = ['B', 'I', 'N', 'G', 'O'];

  // Safe fallback 5x5 board if board is initializing
  const gridBoard = useMemo(() => {
    if (board && Array.isArray(board) && board.length === 5 && board[0]?.length === 5) {
      return board;
    }
    return [
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25]
    ];
  }, [board]);

  return (
    <div className="relative w-full min-h-[calc(100vh-4.5rem)] flex flex-col items-center justify-between p-3 sm:p-5 select-none font-sans">
      {/* 1. TOP HEADER & ATMOSPHERE */}
      <div className="w-full max-w-6xl mx-auto flex items-start justify-between gap-2 z-10 pt-1 pb-3">
        {/* Top-Left: Leave / Back Button & Calligraphy */}
        <div className="flex-1 flex flex-col items-start gap-1">
          {onLeave && (
            <button
              type="button"
              onClick={onLeave}
              className="px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-purple-100/90 text-slate-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-600" />
              <span>{leaveLabel || 'Leave Match'}</span>
            </button>
          )}

          <div className="hidden sm:block">
            <div
              className="text-xl sm:text-2xl lg:text-3xl text-[#9333ea] tracking-wide font-bold drop-shadow-sm rotate-[-2deg] select-none leading-tight mt-1"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              Play Laugh
              <br />
              Stay Together ♡
            </div>
          </div>
        </div>

        {/* Center: Crown + "B I N G O" + "SAME GAME ♡ DIFFERENT HEARTS" */}
        <div className="flex flex-col items-center justify-center text-center mx-auto px-2">
          {/* Crown */}
          <div className="text-purple-600 mb-0.5 filter drop-shadow-[0_2px_8px_rgba(147,51,234,0.4)]">
            <Crown className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#ec4899] drop-shadow-[0_2px_12px_rgba(168,85,247,0.35)] pl-[0.25em]">
            B I N G O
          </h1>

          {/* Subtitle */}
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.22em] text-[#9333ea] mt-1 pl-[0.22em] uppercase">
            SAME GAME <span className="text-[#ec4899]">♡</span> DIFFERENT HEARTS
          </p>
        </div>

        {/* Top-Right: Calligraphy & Top Control Buttons */}
        <div className="flex-1 flex flex-col items-end gap-1">
          {/* Top Icons Bar: Music, Sound, Settings, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Music Toggle */}
            <button
              type="button"
              onClick={() => setIsMusicPlaying(!isMusicPlaying)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition shadow-xs cursor-pointer ${
                isMusicPlaying
                  ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm'
                  : 'bg-white/80 hover:bg-white border-purple-100 text-slate-600 hover:text-purple-700'
              }`}
              title={isMusicPlaying ? 'Stop Music' : 'Play Chill Music'}
            >
              <Music className="w-4 h-4" />
            </button>

            {/* Sound Mute Toggle */}
            <button
              type="button"
              onClick={() => setIsSoundMuted(!isSoundMuted)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition shadow-xs cursor-pointer ${
                isSoundMuted
                  ? 'bg-rose-50 border-rose-200 text-rose-500'
                  : 'bg-white/80 hover:bg-white border-purple-100 text-slate-600 hover:text-purple-700'
              }`}
              title={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Match Chat Toggle (if handler provided) */}
            {onToggleChat && (
              <button
                type="button"
                onClick={onToggleChat}
                className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition shadow-xs cursor-pointer ${
                  isChatOpen
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white/80 hover:bg-white border-purple-100 text-slate-600 hover:text-purple-700'
                }`}
                title="Toggle Match Chat"
              >
                <MessageSquare className="w-4 h-4" />
                {unreadChatCount > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            )}

            {/* Settings Modal Toggle */}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border bg-white/80 hover:bg-white border-purple-100 text-slate-600 hover:text-purple-700 flex items-center justify-center transition shadow-xs cursor-pointer"
                title="Game Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border bg-white/80 hover:bg-white border-purple-100 text-slate-600 hover:text-purple-700 flex items-center justify-center transition shadow-xs cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

          {/* Calligraphy Text: "Good Games Better Company ♡" */}
          <div
            className="hidden sm:block text-xl sm:text-2xl text-[#9333ea] tracking-wide font-bold drop-shadow-sm rotate-[2deg] select-none text-right leading-tight mt-1"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            Good Games
            <br />
            Better Company ♡
          </div>
        </div>
      </div>

      {/* 2. MAIN 3-COLUMN PLAYING ARENA */}
      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 lg:gap-6 z-10 my-auto">
        
        {/* LEFT COLUMN: PLAYERS PANEL */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-[0_10px_35px_rgba(124,58,237,0.12)] border border-purple-100/80 flex flex-col gap-5">
          {/* PLAYER 1 (ME / HOST - PURPLE THEME) */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#7c3aed] to-[#a855f7] shadow-md shadow-purple-500/25 flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {player1.avatarUrl ? (
                    <img src={player1.avatarUrl} alt={player1.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-[#7c3aed]" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-slate-800 text-base sm:text-lg leading-tight truncate">
                  {player1.displayName || 'Player 1'}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                  {playerMarks.length} numbers
                </p>
              </div>
            </div>

            {/* Marked Number Chips (Purple Gradient) */}
            <div className="flex flex-wrap gap-2 pt-1">
              {playerMarks.length > 0 ? (
                playerMarks.map(num => (
                  <div
                    key={`p1-mark-${num}`}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#a855f7] text-white font-black font-mono shadow-[0_4px_12px_rgba(124,58,237,0.35)] flex items-center justify-center text-sm ring-2 ring-purple-200/50 animate-in zoom-in-75 duration-200"
                  >
                    {num}
                  </div>
                ))
              ) : (
                <div className="w-full py-2.5 px-3 rounded-2xl bg-purple-50/60 border border-purple-100/80 text-center">
                  <span className="text-xs font-medium text-purple-400">Numbers marked by you will appear here</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full h-px bg-purple-100/80" />

          {/* PLAYER 2 (OPPONENT / GUEST - PINK THEME) */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#f43f5e] to-[#fb7185] shadow-md shadow-rose-500/25 flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {player2.avatarUrl ? (
                    <img src={player2.avatarUrl} alt={player2.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-[#f43f5e]" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-slate-800 text-base sm:text-lg leading-tight truncate">
                  {player2.displayName || 'Player 2'}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                  {opponentMarks.length} numbers
                </p>
              </div>
            </div>

            {/* Marked Number Chips (Pink Gradient) */}
            <div className="flex flex-wrap gap-2 pt-1">
              {opponentMarks.length > 0 ? (
                opponentMarks.map(num => (
                  <div
                    key={`p2-mark-${num}`}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-[#f43f5e] to-[#fb7185] text-white font-black font-mono shadow-[0_4px_12px_rgba(244,63,94,0.35)] flex items-center justify-center text-sm ring-2 ring-rose-200/50 animate-in zoom-in-75 duration-200"
                  >
                    {num}
                  </div>
                ))
              ) : (
                <div className="w-full py-2.5 px-3 rounded-2xl bg-rose-50/60 border border-rose-100/80 text-center">
                  <span className="text-xs font-medium text-rose-400">Opponent&apos;s marks will appear here</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: 5x5 BINGO BOARD */}
        <div className="w-full max-w-[420px] sm:max-w-[440px] bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-[0_10px_35px_rgba(124,58,237,0.12)] border border-purple-100/80 flex flex-col items-center">
          
          {/* B - I - N - G - O Column Headers */}
          <div className="w-full grid grid-cols-5 gap-2.5 sm:gap-3 mb-2 text-center">
            {letters.map(letter => (
              <div
                key={`header-${letter}`}
                className="font-black text-xl sm:text-2xl text-[#6366f1] drop-shadow-xs select-none"
              >
                {letter}
              </div>
            ))}
          </div>

          {/* 5x5 Matrix Board */}
          <div className="relative w-full aspect-square p-2 rounded-2xl bg-white/50 border border-purple-100 shadow-inner">
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full h-full relative z-10">
              {gridBoard.map((row, r) =>
                row.map((num, c) => {
                  const isP1Marked = p1MarkSet.has(num);
                  const isP2Marked = p2MarkSet.has(num);
                  const isCalled = calledSet.has(num);
                  const isCurrentTarget = currentNumber === num;
                  const isWinningCell = winningCoordSet.has(`${r},${c}`);

                  // Styling matching reference design:
                  // Neutral: soft white-gray `#f8fafc`
                  // P1: Royal Purple `#8b5cf6`
                  // P2: Coral Pink `#ff6497`
                  let cellStyle = 'bg-[#f8fafc] border border-slate-200/90 text-slate-800 hover:bg-slate-100';

                  if (isP1Marked && isP2Marked) {
                    cellStyle = 'bg-gradient-to-tr from-[#7c3aed] to-[#f43f5e] border-purple-400 text-white shadow-[0_4px_14px_rgba(124,58,237,0.4)]';
                  } else if (isP1Marked) {
                    cellStyle = 'bg-gradient-to-br from-[#7c3aed] to-[#8b5cf6] border-purple-400 text-white shadow-[0_4px_14px_rgba(124,58,237,0.4)] scale-[1.01]';
                  } else if (isP2Marked) {
                    cellStyle = 'bg-gradient-to-br from-[#f43f5e] to-[#fb7185] border-rose-400 text-white shadow-[0_4px_14px_rgba(244,63,94,0.4)] scale-[1.01]';
                  } else if (isCalled) {
                    cellStyle = 'bg-purple-100/90 border-2 border-purple-500 text-purple-900 font-extrabold animate-pulse';
                  }

                  return (
                    <button
                      key={`cell-${r}-${c}-${num}`}
                      type="button"
                      disabled={isFinished || isRoundOver}
                      onClick={() => onCellClick(num)}
                      className={`relative rounded-xl font-mono font-black text-sm sm:text-base flex items-center justify-center transition-all duration-150 select-none shadow-xs cursor-pointer active:scale-95 ${cellStyle} ${
                        isFinished || isRoundOver ? 'opacity-85 cursor-default' : ''
                      }`}
                    >
                      {/* Number Text */}
                      <span>{num}</span>

                      {/* Bullseye / Target Circle Indicator (like tile 1 in reference) */}
                      {isCurrentTarget && (
                        <span className="absolute inset-1 rounded-lg border-2 border-white/90 animate-ping pointer-events-none" />
                      )}

                      {/* Bullseye Icon on target / active mark */}
                      {isP1Marked && isCurrentTarget && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white shadow-xs" />
                      )}

                      {/* Sparkle on Winning cell */}
                      {isWinningCell && (
                        <span className="absolute top-0.5 right-0.5 text-amber-200 animate-spin">
                          <Sparkles className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 3. SVG Strike-Through Laser Overlay for Completed Winning Lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#ff4d79" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <filter id="laserGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {completedLines.map(line => {
                if (line.type === 'row') {
                  const y = (line.index + 0.5) * 20;
                  return (
                    <g key={line.id}>
                      <line
                        x1="10"
                        y1={y}
                        x2="90"
                        y2={y}
                        stroke="url(#laserGrad)"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        filter="url(#laserGlow)"
                      />
                      <circle cx="10" cy={y} r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                      <circle cx="90" cy={y} r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                    </g>
                  );
                }

                if (line.type === 'col') {
                  const x = (line.index + 0.5) * 20;
                  return (
                    <g key={line.id}>
                      <line
                        x1={x}
                        y1="10"
                        x2={x}
                        y2="90"
                        stroke="url(#laserGrad)"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        filter="url(#laserGlow)"
                      />
                      <circle cx={x} cy="10" r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                      <circle cx={x} cy="90" r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                    </g>
                  );
                }

                if (line.id === 'diag-main' || (line.type === 'diag' && line.index === 0)) {
                  return (
                    <g key={line.id}>
                      <line
                        x1="10"
                        y1="10"
                        x2="90"
                        y2="90"
                        stroke="url(#laserGrad)"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        filter="url(#laserGlow)"
                      />
                      <circle cx="10" cy="10" r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                      <circle cx="90" cy="90" r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                    </g>
                  );
                }

                if (line.id === 'diag-anti' || (line.type === 'diag' && line.index === 1)) {
                  return (
                    <g key={line.id}>
                      <line
                        x1="90"
                        y1="10"
                        x2="10"
                        y2="90"
                        stroke="url(#laserGrad)"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        filter="url(#laserGlow)"
                      />
                      <circle cx="90" cy="10" r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                      <circle cx="10" cy="90" r="3.2" fill="#ffffff" stroke="#ff4d79" strokeWidth="2" />
                    </g>
                  );
                }

                return null;
              })}
            </svg>
          </div>

          {/* Turn & Action Bar */}
          <div className="w-full flex items-center justify-between gap-3 mt-4 pt-3 border-t border-purple-100">
            {/* Reset / Rematch Button */}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="py-2.5 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm shadow-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Reset or Rematch"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {/* Turn Status or Claim Button */}
            {canClaimBingo && onClaimBingo ? (
              <button
                type="button"
                onClick={onClaimBingo}
                className="flex-1 py-2.5 px-5 rounded-full bg-gradient-to-r from-[#ec4899] to-[#f43f5e] hover:from-[#db2777] hover:to-[#e11d48] text-white font-black text-xs sm:text-sm shadow-[0_4px_16px_rgba(236,72,153,0.4)] animate-bounce active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>🎉 CLAIM BINGO!</span>
              </button>
            ) : (
              <div className="flex-1 py-2 px-3 rounded-full bg-purple-50/80 border border-purple-100 text-center">
                <span className="text-xs font-bold text-purple-700 flex items-center justify-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                  {isMyTurn ? 'Your Turn to Pick' : `${currentTurnDisplayName}'s Turn`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CURRENT NUMBER & WINNING LINES GUIDE */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 flex flex-col gap-4">
          {/* CURRENT NUMBER CARD */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-[0_10px_35px_rgba(124,58,237,0.12)] border border-purple-100/80 flex flex-col items-center">
            <h4 className="text-xs font-bold text-slate-600 tracking-wide mb-3">
              Current Number
            </h4>

            {/* Glowing Ring Gauge */}
            <div className="w-24 h-24 rounded-full border-4 border-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center relative bg-gradient-to-b from-purple-50/60 to-white">
              <span className="text-3xl font-black text-slate-800 font-mono tracking-tight drop-shadow-xs">
                {currentNumber !== null ? currentNumber : '--'}
              </span>
            </div>
          </div>

          {/* WINNING LINES GUIDE CARD */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-[0_10px_35px_rgba(124,58,237,0.12)] border border-purple-100/80">
            <h4 className="text-xs font-bold text-slate-600 tracking-wide mb-3 text-center">
              Winning Lines
            </h4>

            {/* 4 Mini Grids (2x2 Layout) */}
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Horizontal (Row) */}
              <div className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-purple-50/40 border border-purple-100/60">
                <div className="grid grid-cols-5 gap-0.5 w-16 h-16 p-1 bg-white rounded-lg border border-purple-100 shadow-xs">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const r = Math.floor(i / 5);
                    const isHighlight = r === 2; // Middle row
                    return (
                      <div
                        key={`guide-row-${i}`}
                        className={`rounded-xs transition ${
                          isHighlight ? 'bg-[#7c3aed]' : 'bg-purple-100/40'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold text-slate-600">Horizontal (Row)</span>
              </div>

              {/* 2. Vertical (Column) */}
              <div className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-purple-50/40 border border-purple-100/60">
                <div className="grid grid-cols-5 gap-0.5 w-16 h-16 p-1 bg-white rounded-lg border border-purple-100 shadow-xs">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const c = i % 5;
                    const isHighlight = c === 2; // Middle column
                    return (
                      <div
                        key={`guide-col-${i}`}
                        className={`rounded-xs transition ${
                          isHighlight ? 'bg-[#7c3aed]' : 'bg-purple-100/40'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold text-slate-600">Vertical (Column)</span>
              </div>

              {/* 3. Diagonal (\) */}
              <div className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-rose-50/40 border border-rose-100/60">
                <div className="grid grid-cols-5 gap-0.5 w-16 h-16 p-1 bg-white rounded-lg border border-rose-100 shadow-xs">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const r = Math.floor(i / 5);
                    const c = i % 5;
                    const isHighlight = r === c; // Main diagonal
                    return (
                      <div
                        key={`guide-diag1-${i}`}
                        className={`rounded-xs transition ${
                          isHighlight ? 'bg-[#f43f5e]' : 'bg-rose-100/40'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold text-slate-600">Diagonal (\)</span>
              </div>

              {/* 4. Diagonal (/) */}
              <div className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-purple-50/40 border border-purple-100/60">
                <div className="grid grid-cols-5 gap-0.5 w-16 h-16 p-1 bg-white rounded-lg border border-purple-100 shadow-xs">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const r = Math.floor(i / 5);
                    const c = i % 5;
                    const isHighlight = r + c === 4; // Anti diagonal
                    return (
                      <div
                        key={`guide-diag2-${i}`}
                        className={`rounded-xs transition ${
                          isHighlight ? 'bg-[#7c3aed]' : 'bg-purple-100/40'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold text-slate-600">Diagonal (/)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
