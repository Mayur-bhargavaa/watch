'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Ticket,
  Crown,
  Trophy,
  Sparkles,
  RotateCcw,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Send,
  X as CloseIcon,
  Minus,
  GripHorizontal,
  ScanLine,
  Shuffle,
  ChevronLeft,
  AlertTriangle,
  Play
} from 'lucide-react';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { getStoredSession, UserSession, getGameRoute } from '../../../lib/api';
import { BingoLobby } from '../../../components/games/bingo/BingoLobby';
import { BingoVictory } from '../../../components/games/bingo/BingoVictory';
import { BingoRoomConfig } from '@synccinema/common';

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function formatNumberWord(num: number | null): string {
  if (!num || num < 1) return 'READY';
  if (num < 20) return ONES[num] || 'NUMBER';
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return one > 0 ? `${TENS[ten]}-${ONES[one]}` : TENS[ten];
}

const DEFAULT_CONFIG: BingoRoomConfig = {
  mode: '90-ball',
  winConditions: {
    early5: true,
    topLine: true,
    middleLine: true,
    bottomLine: true,
    fourCorners: true,
    housefull: true,
    xPattern: false,
    crossPattern: false,
    starPattern: false,
    diamond: false,
    fullBorder: false,
    customPattern: false
  },
  callingSpeed: 3000,
  autoCall: true,
  points: {
    early5: 10,
    topLine: 20,
    middleLine: 20,
    bottomLine: 20,
    fourCorners: 30,
    housefull: 100,
    xPattern: 25,
    crossPattern: 25,
    starPattern: 40,
    diamond: 30,
    fullBorder: 35,
    customPattern: 50
  },
  falseClaimPenalty: 0
};

// Default fallback Tambola ticket (mirrors the reference screenshot)
const INITIAL_PREVIEW_TICKET: (number | null)[][] = [
  [18, null, 35, null, 46, null, 61, 85, null],
  [null, 23, 36, null, 48, null, 76, 88, null],
  [9, null, 39, null, 57, 67, 78, null, null]
];

function generateRandomTambolaGrid(): (number | null)[][] {
  const colRanges = [
    [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 90]
  ];
  const grid: (number | null)[][] = [
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null]
  ];

  for (let r = 0; r < 3; r++) {
    const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 5);
    cols.forEach(c => {
      const [min, max] = colRanges[c];
      const val = Math.floor(Math.random() * (max - min + 1)) + min;
      grid[r][c] = val;
    });
  }
  return grid;
}

function RemoteAudioPlayer({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.play().catch(() => {});
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

function TambolaGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const [session, setSession] = useState<UserSession | null>(null);
  const [roomConfig, setRoomConfig] = useState<BingoRoomConfig>(DEFAULT_CONFIG);

  // Auto-Mark switch state
  const [autoMark, setAutoMark] = useState(false);

  // Local client ticket state fallback
  const [previewTicketGrid, setPreviewTicketGrid] = useState<(number | null)[][]>(INITIAL_PREVIEW_TICKET);

  // Chat input
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Claim Feedback Toast State
  const [claimToast, setClaimToast] = useState<{
    valid: boolean;
    message: string;
    timestamp: number;
  } | null>(null);

  // Load user session
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
    }
  }, []);

  const {
    room,
    players,
    gameState,
    myPlayer,
    myUserId,
    lastBingoCall,
    lastBingoClaimResult,
    lastBingoConditionWon,
    chatMessages,
    floatingReactions,
    startBingoGame,
    claimBingo,
    markBingoNumber,
    sendChat,
    sendReaction,
    sendLeave,
    sendVoiceState,
    sendCameraState,
    rematch,
    rematchStatus,
    declineRematch,
    clearRematchDeclined,
    sendWebRTCSignal,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    streakCelebration,
    clearStreakCelebration
  } = useGameRoom(roomCodeParam);

  // Cross-game redirect guard
  useEffect(() => {
    if (roomCodeParam) {
      const code = roomCodeParam.trim().toUpperCase();
      if (!code.startsWith('TAMBOLA-') && !code.startsWith('BINGO-') && (code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-') || code.startsWith('DOODLE-'))) {
        router.replace(getGameRoute(undefined, roomCodeParam));
        return;
      }
    }
    if (room?.gameType && room.gameType !== 'tambola' && room.gameType !== 'bingo' && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomCodeParam, room?.gameType, room?.roomCode, router]);

  const effectiveUserId = myUserId || session?.user?.id || '';

  // Determine players
  const me = players.find(p => p.userId === effectiveUserId) || players[0];
  const opponent = players.find(p => p.userId !== me?.userId);

  const isHost = room?.hostUserId === effectiveUserId;
  const isPlaying = room && room.status === 'PLAYING' && gameState !== null;
  const isFinished = room && (room.status === 'FINISHED' || gameState?.phase === 'FINISHED');

  // WebRTC Setup
  const webRTCMembers = useMemo(() => {
    return players.map((p: any) => ({
      userId: p.userId,
      name: p.displayName,
      avatarUrl: p.avatarUrl || null,
      isHost: p.userId === room?.hostUserId
    }));
  }, [players, room?.hostUserId]);

  const {
    isCameraOn,
    isMicMuted,
    toggleCamera,
    toggleMic
  } = useWebRTC({
    myUserId: effectiveUserId,
    members: webRTCMembers as any,
    screenPresenter: null,
    sendWebRTCSignal,
    sendScreenState: () => {},
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  });

  // Floating Call Widget State
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isCallClosed, setIsCallClosed] = useState(false);

  // Sync config from gameState when active
  useEffect(() => {
    if (gameState?.config) {
      setRoomConfig(gameState.config);
    }
  }, [gameState?.config]);

  // Show claim result feedback toast
  useEffect(() => {
    if (lastBingoClaimResult) {
      setClaimToast({
        valid: lastBingoClaimResult.valid,
        message: lastBingoClaimResult.message,
        timestamp: Date.now()
      });
      const timer = setTimeout(() => setClaimToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [lastBingoClaimResult]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle leave room
  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // 1. NO ROOM PARAM -> Render Lobby
  if (!roomCodeParam) {
    return <BingoLobby />;
  }

  // Current Number & called list
  const currentNum = lastBingoCall?.number ?? gameState?.currentNumber ?? 69;
  const currentWord = lastBingoCall?.word ?? gameState?.currentNumberWord ?? formatNumberWord(currentNum);
  const rawCalled = lastBingoCall?.calledNumbers ?? gameState?.lastCalledNumbers ?? [84, 74, 6, 80, 90];
  const lastCalled = rawCalled.length > 0 ? rawCalled : [84, 74, 6, 80, 90];
  const remaining = lastBingoCall?.remainingCount ?? gameState?.callQueue?.length ?? 79;

  // Ticket data
  const serverTicket = gameState?.tickets?.[me?.userId || ''];
  const ticketCells = serverTicket?.cells && serverTicket.cells.length > 0
    ? serverTicket.cells
    : previewTicketGrid;

  // Marked numbers
  const myMarkedList = gameState?.playerMarked?.[me?.userId || ''] || [18];
  const myMarkedSet = new Set(myMarkedList);

  const calledSet = new Set(gameState?.calledNumbers || [18, 69, 84, 74, 6, 80, 90]);

  // Auto-mark effect
  useEffect(() => {
    if (autoMark && isPlaying && ticketCells) {
      ticketCells.flat().forEach((num: number | null) => {
        if (num !== null && calledSet.has(num) && !myMarkedSet.has(num)) {
          markBingoNumber(num);
        }
      });
    }
  }, [autoMark, calledSet, myMarkedSet, isPlaying, ticketCells, markBingoNumber]);

  // Count marked out of 15
  const allTicketNumbers = ticketCells.flat().filter((n: number | null): n is number => n !== null);
  const myMarkedCount = allTicketNumbers.filter((n: number) => myMarkedSet.has(n)).length;

  const opponentMarkedList = opponent ? (gameState?.playerMarked?.[opponent.userId] || []) : [];
  const opponentMarkedCount = opponentMarkedList.length;

  const myScore = gameState?.scores?.[me?.userId || ''] || 0;
  const opponentScore = opponent ? (gameState?.scores?.[opponent.userId] || 0) : 0;

  // Winning conditions calculation
  const row0Nums = ticketCells[0]?.filter((n: number | null): n is number => n !== null) || [];
  const row1Nums = ticketCells[1]?.filter((n: number | null): n is number => n !== null) || [];
  const row2Nums = ticketCells[2]?.filter((n: number | null): n is number => n !== null) || [];

  const early5Count = Math.min(5, myMarkedCount);
  const topLineCount = row0Nums.filter((n: number) => myMarkedSet.has(n)).length;
  const middleLineCount = row1Nums.filter((n: number) => myMarkedSet.has(n)).length;
  const bottomLineCount = row2Nums.filter((n: number) => myMarkedSet.has(n)).length;

  const cornerNums = [row0Nums[0], row0Nums[row0Nums.length - 1], row2Nums[0], row2Nums[row2Nums.length - 1]].filter(Boolean);
  const fourCornersCount = cornerNums.filter((n: number) => myMarkedSet.has(n)).length;
  const housefullCount = myMarkedCount;

  // Handler for clicking a number on ticket
  const handleCellClick = (num: number | null) => {
    if (num === null) return;
    if (isPlaying) {
      markBingoNumber(num);
    } else {
      if (myMarkedSet.has(num)) {
        myMarkedSet.delete(num);
      } else {
        myMarkedSet.add(num);
      }
      setPreviewTicketGrid([...previewTicketGrid]);
    }
  };

  // New ticket generator
  const handleNewTicket = () => {
    setPreviewTicketGrid(generateRandomTambolaGrid());
  };

  // Primary Bingo claim action
  const handleClaim = () => {
    if (!isPlaying) {
      if (isHost) {
        startBingoGame(roomConfig);
      }
      return;
    }
    if (housefullCount >= 15) claimBingo('housefull');
    else if (topLineCount >= 5) claimBingo('topLine');
    else if (middleLineCount >= 5) claimBingo('middleLine');
    else if (bottomLineCount >= 5) claimBingo('bottomLine');
    else if (fourCornersCount >= 4) claimBingo('fourCorners');
    else if (early5Count >= 5) claimBingo('early5');
    else claimBingo('early5');
  };

  // Send Chat message
  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fcf7fa] via-[#faedf5] to-[#f4e2ee] text-[#1e1435] flex flex-col justify-between selection:bg-[#ff3b77] selection:text-white relative overflow-x-hidden font-sans">
      
      {/* Soft Ambient Pastel Background Blurs */}
      <div className="fixed inset-0 pointer-events-none select-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-pink-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[550px] h-[550px] bg-purple-200/35 rounded-full blur-3xl" />
      </div>

      {/* Floating Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map((r: any) => (
          <div
            key={r.id}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 animate-bounce text-3xl font-bold flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-pink-200 shadow-2xl"
          >
            <span>{r.emoji}</span>
            <span className="text-xs text-[#ff3864] font-semibold">{r.userName}</span>
          </div>
        ))}
      </div>

      {/* Claim Result Toast Notification */}
      {claimToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`px-5 py-3 rounded-2xl border shadow-2xl flex items-center gap-2.5 text-xs font-black ${
              claimToast.valid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-emerald-200/50'
                : 'bg-rose-50 border-rose-300 text-rose-800 shadow-rose-200/50'
            }`}
          >
            {claimToast.valid ? <Sparkles className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{claimToast.message}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto p-3 sm:p-6 lg:p-8 flex flex-col gap-4">
        
        {/* 1. TOP HEADER BAR */}
        <header className="flex items-center justify-between gap-4">
          {/* Left: Ticket icon, Title & "Play Laugh Stay Together ♡" */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff2b70] via-[#ff3b77] to-[#ff6699] flex items-center justify-center text-white shadow-md shadow-pink-500/25 shrink-0">
              <Ticket className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-[#1e1435] tracking-tight">
                  Tambola
                </h1>
                {/* Play Laugh Stay Together Script */}
                <div className="font-serif italic text-[11px] leading-[1.05] text-[#ff2b70] tracking-tight select-none">
                  Play<br />Laugh<br />Stay Together ♡
                </div>
              </div>
              <p className="text-xs text-[#8a80a0] font-medium tracking-wide">
                1-90 Numbers • Classic Fun • 2 Players
              </p>
            </div>
          </div>

          {/* Right: "Same Numbers Different Hearts" Quote & Quick Navigation */}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-block font-serif italic text-base text-[#8d4b88] tracking-wide select-none">
              “Same Numbers Different Hearts” ♡
            </span>
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-bold text-[#4a3e68] border border-pink-100 shadow-xs transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </header>

        {/* 2. TOP DUEL PLAYERS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          {/* Left Player Card (You) */}
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-3.5 sm:p-4 border border-white/80 shadow-[0_6px_25px_rgba(240,160,200,0.12)] flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 ring-2 ring-pink-100 shadow-sm shrink-0 flex items-center justify-center">
              {me?.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.displayName} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${me?.displayName || 'Mayur'}&glassesProbability=100`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-[#1e1435] truncate">
                  {me?.displayName || 'Mayur Bhargava'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#ffe8f0] text-[#ff3864] text-[10px] font-black uppercase tracking-wider">
                  You
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="font-bold text-[#1e1435]">
                  Score: <span className="font-extrabold text-[#1e1435]">{myScore} pts</span>
                </span>
                <span className="text-[10px] font-semibold text-[#8a80a0]">
                  {myMarkedCount}/15 Marked
                </span>
              </div>
              {/* Pink Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[#fdebf2] overflow-hidden mt-1.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff3864] to-[#ff6b8b] transition-all duration-300"
                  style={{ width: `${Math.min(100, (myMarkedCount / 15) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Center VS Chip */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#ffeef4] border border-pink-200/80 flex items-center justify-center text-xs font-black text-[#ff3864] shadow-xs">
              VS
            </div>
            <span className="text-[10px] text-[#8a80a0] font-medium mt-1">
              1v1 Tambola Duel
            </span>
          </div>

          {/* Right Player Card (Opponent) */}
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-3.5 sm:p-4 border border-white/80 shadow-[0_6px_25px_rgba(240,160,200,0.12)] flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 ring-2 ring-purple-100 shadow-sm shrink-0 flex items-center justify-center">
              {opponent?.avatarUrl ? (
                <img src={opponent.avatarUrl} alt={opponent.displayName} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${opponent?.displayName || 'abcdghijk552'}&hair=long`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-[#1e1435] truncate">
                  {opponent?.displayName || 'abcdghijk552'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="font-bold text-[#1e1435]">
                  Score: <span className="font-extrabold text-[#7c3aed]">{opponentScore} pts</span>
                </span>
                <span className="text-[10px] font-semibold text-[#8a80a0]">
                  {opponentMarkedCount}/15 Marked
                </span>
              </div>
              {/* Lavender Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[#f3eafc] overflow-hidden mt-1.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] transition-all duration-300"
                  style={{ width: `${Math.min(100, (opponentMarkedCount / 15) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. MAIN ARENA (GRID: LEFT TICKET/PROGRESS, MIDDLE CALLER/CALL, RIGHT CHAT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          
          {/* LEFT COLUMN: TICKET & WINNING PROGRESS (8 COLS) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* TICKET + CALLER ROW */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* YOUR TAMBOLA TICKET CARD (7 COLS OF 12) */}
              <div className="md:col-span-7 bg-white/95 backdrop-blur-md rounded-[30px] p-5 sm:p-6 border border-white/90 shadow-[0_8px_30px_rgba(240,160,200,0.12)] flex flex-col justify-between">
                
                {/* Ticket Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#ffe8f0] text-[#ff3864] flex items-center justify-center shadow-xs">
                      <Crown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-[#1e1435]">
                      Your Tambola Ticket
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleNewTicket}
                    className="flex items-center gap-1 text-xs font-bold text-[#4a3e68] hover:text-[#ff3864] transition cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>New Ticket</span>
                  </button>
                </div>

                {/* The 3x9 Ticket Grid */}
                <div className="space-y-1.5 sm:space-y-2 select-none my-auto">
                  {ticketCells.map((row: (number | null)[], rIdx: number) => (
                    <div key={`row-${rIdx}`} className="grid grid-cols-9 gap-1 sm:gap-1.5">
                      {row.map((num: number | null, cIdx: number) => {
                        if (num === null) {
                          return (
                            <div
                              key={`blank-${rIdx}-${cIdx}`}
                              className="aspect-square rounded-xl bg-[#f7f8fc] border border-slate-200/50 flex items-center justify-center"
                            />
                          );
                        }

                        const isMarked = myMarkedSet.has(num);
                        const isCalled = calledSet.has(num);

                        return (
                          <button
                            key={`cell-${rIdx}-${cIdx}`}
                            type="button"
                            onClick={() => handleCellClick(num)}
                            className={`aspect-square rounded-xl border flex items-center justify-center font-mono text-xs sm:text-base font-black transition-all cursor-pointer ${
                              isMarked
                                ? 'bg-[#ffe4ec] border-2 border-[#ff3864] text-[#1e1435] shadow-xs scale-98'
                                : isCalled
                                ? 'bg-amber-50 border-amber-300 text-[#1e1435] ring-2 ring-amber-300/60 animate-pulse hover:bg-amber-100 hover:scale-105'
                                : 'bg-white border-slate-200/80 text-[#1e1435] hover:border-pink-300 hover:scale-105 shadow-xs'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Ticket Footer Legend & Auto Mark */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ff3864]" />
                      <span className="font-bold text-[#1e1435]">
                        Marked ({myMarkedCount}/15)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <span className="text-[#8a80a0] font-medium">
                        Not in your ticket
                      </span>
                    </div>
                  </div>

                  {/* Auto Mark Toggle */}
                  <div className="flex items-center gap-2">
                    <ScanLine className="w-3.5 h-3.5 text-[#4a3e68]" />
                    <span className="text-xs font-bold text-[#1e1435]">
                      Auto Mark: <span className="font-extrabold">{autoMark ? 'ON' : 'OFF'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoMark(!autoMark)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                        autoMark ? 'bg-[#ff3864]' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                          autoMark ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

              </div>

              {/* CURRENT NUMBER CALLER CARD (5 COLS OF 12) */}
              <div className="md:col-span-5 bg-white/95 backdrop-blur-md rounded-[30px] p-5 sm:p-6 border border-white/90 shadow-[0_8px_30px_rgba(240,160,200,0.12)] flex flex-col items-center justify-between text-center">
                
                <h3 className="text-sm sm:text-base font-extrabold text-[#1e1435]">
                  Current Number
                </h3>

                {/* Big Glowing Dial with Sunburst Rays */}
                <div className="relative my-3 flex items-center justify-center">
                  {/* Decorative Sunburst Rays */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <span className="absolute -left-3 w-3 h-0.5 bg-amber-400 rounded-full" />
                    <span className="absolute -right-3 w-3 h-0.5 bg-amber-400 rounded-full" />
                    <span className="absolute -top-1 -left-1 w-3 h-0.5 bg-amber-400 rounded-full -rotate-45" />
                    <span className="absolute -top-1 -right-1 w-3 h-0.5 bg-amber-400 rounded-full rotate-45" />
                  </div>

                  {/* Circular Ring */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#ff3864] flex flex-col items-center justify-center bg-white shadow-[0_4px_25px_rgba(255,56,100,0.18)]">
                    <span className="text-4xl sm:text-5xl font-black text-[#1e1435] tracking-tight font-mono">
                      {currentNum}
                    </span>
                  </div>
                </div>

                {/* Uppercase Word Label */}
                <div className="text-xs font-black tracking-widest text-[#ff3864] uppercase -mt-1 mb-2">
                  {currentWord}
                </div>

                {/* Last 5 Numbers */}
                <div className="w-full">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#8a80a0] mb-1.5 px-1">
                    <span>Last 5 Numbers</span>
                    <span>{remaining} Left</span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    {lastCalled.slice(0, 5).map((num: number, idx: number) => (
                      <div
                        key={`${num}-${idx}`}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center font-mono text-xs sm:text-sm font-bold ${
                          idx === 0
                            ? 'bg-[#ffe4ec] border-[#ff3864]/40 text-[#ff3864] shadow-xs'
                            : 'bg-[#f7f8fc] border-slate-200/80 text-[#1e1435]'
                        }`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Vibrant Pink Claim Button */}
                <button
                  type="button"
                  onClick={handleClaim}
                  className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff3864] via-[#ff2b70] to-[#e6005c] hover:brightness-105 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-[0_8px_25px_rgba(255,56,100,0.35)] flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>
                    {!isPlaying && isHost
                      ? '🎮 START TAMBOLA'
                      : '🎉 I HAVE A BINGO!'}
                  </span>
                </button>

              </div>
            </div>

            {/* WINNING PROGRESS CARD (2 ROWS X 3 COLS) */}
            <div className="bg-white/95 backdrop-blur-md rounded-[30px] p-5 sm:p-6 border border-white/90 shadow-[0_8px_30px_rgba(240,160,200,0.12)]">
              
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#1e1435]">
                  Winning Progress
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3.5">
                {/* Early 5 */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#1e1435]">
                    <span>Early 5</span>
                    <span className="text-[#8a80a0] font-medium">{early5Count} / 5</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#ff3864] transition-all duration-300"
                      style={{ width: `${Math.min(100, (early5Count / 5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Top Line */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#1e1435]">
                    <span>Top Line</span>
                    <span className="text-[#8a80a0] font-medium">{topLineCount} / 5</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#ff3864] transition-all duration-300"
                      style={{ width: `${Math.min(100, (topLineCount / 5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Middle Line */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#1e1435]">
                    <span>Middle Line</span>
                    <span className="text-[#8a80a0] font-medium">{middleLineCount} / 5</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#ff3864] transition-all duration-300"
                      style={{ width: `${Math.min(100, (middleLineCount / 5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Line */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#1e1435]">
                    <span>Bottom Line</span>
                    <span className="text-[#8a80a0] font-medium">{bottomLineCount} / 5</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#ff3864] transition-all duration-300"
                      style={{ width: `${Math.min(100, (bottomLineCount / 5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Four Corners */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#1e1435]">
                    <span>Four Corners</span>
                    <span className="text-[#8a80a0] font-medium">{fourCornersCount} / 4</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#ff3864] transition-all duration-300"
                      style={{ width: `${Math.min(100, (fourCornersCount / 4) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Housefull */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#1e1435]">
                    <span>Housefull</span>
                    <span className="text-[#8a80a0] font-medium">{housefullCount} / 15</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-[#ff3864] transition-all duration-300"
                      style={{ width: `${Math.min(100, (housefullCount / 15) * 100)}%` }}
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Row: Romantic script quote + Call Widget + Popcorn Container */}
            <div className="flex items-center justify-between pt-2">
              <div className="font-serif italic text-base sm:text-lg text-[#8d4b88] tracking-wide select-none">
                Good Games<br />Better Company ♡
              </div>

              {/* Call Widget & Popcorn */}
              <div className="flex items-end gap-3">
                {/* Floating Call Card */}
                {!isCallClosed && (
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white shadow-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-[#1e1435] font-black">
                        <GripHorizontal className="w-3.5 h-3.5 text-rose-500" />
                        <span>Call (2/2)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={toggleMic}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                            isMicMuted ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {isMicMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                            isCameraOn ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Video className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCallMinimized(!isCallMinimized)}
                          className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCallClosed(true)}
                          className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600"
                        >
                          <CloseIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {!isCallMinimized && (
                      <div className="flex items-center gap-2 pt-1">
                        {/* Self participant feed */}
                        <div className="relative w-20 sm:w-24 h-16 sm:h-18 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex flex-col items-center justify-center shadow-inner group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff3864] to-[#ff6699] text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {me?.displayName?.charAt(0).toUpperCase() || 'Y'}
                          </div>
                          <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[9px] font-bold text-[#1e1435]">
                            <span className="truncate">You</span>
                            <span className="text-[10px]">{isMicMuted ? '🔴' : '🟢'}</span>
                          </div>
                        </div>

                        {/* Opponent participant feed */}
                        <div className="relative w-20 sm:w-24 h-16 sm:h-18 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex flex-col items-center justify-center shadow-inner group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff3864] to-[#ff80a0] text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {opponent?.displayName?.charAt(0).toUpperCase() || 'A'}
                          </div>
                          <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[9px] font-bold text-[#1e1435]">
                            <span className="truncate max-w-[50px]">{opponent?.displayName || 'abcdghijk552'}</span>
                            <span className="text-[10px]">🟢</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Popcorn Bucket Decor */}
                <div className="relative w-16 h-20 select-none pointer-events-none">
                  <div className="absolute bottom-0 w-14 h-14 bg-gradient-to-b from-pink-100 to-rose-200 rounded-b-2xl rounded-t-sm border border-rose-300 shadow-lg flex flex-col items-center justify-center text-center p-1">
                    <span className="font-serif italic font-black text-[9px] text-[#ff2b70] leading-tight">
                      Good<br />Vibes<br />Only
                    </span>
                  </div>
                  {/* Popcorn kernals overflowing */}
                  <div className="absolute -top-1 left-1 flex gap-0.5">
                    <span className="w-4 h-4 rounded-full bg-amber-200 border border-amber-300 shadow-xs" />
                    <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 shadow-xs -ml-1 -mt-1" />
                    <span className="w-4 h-4 rounded-full bg-amber-200 border border-amber-300 shadow-xs -ml-1" />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: GAME CHAT CARD (4 COLS) */}
          <div className="lg:col-span-4 bg-white/95 backdrop-blur-md rounded-[30px] p-4 sm:p-5 border border-white/90 shadow-[0_8px_30px_rgba(240,160,200,0.12)] flex flex-col justify-between h-[660px]">
            
            {/* Chat Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center shadow-xs">
                    <Send className="w-4 h-4 rotate-45" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1e1435]">Game Chat</h3>
                    <p className="text-[10px] text-[#8a80a0] font-medium">Live messages, reactions & fun!</p>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div ref={chatScrollRef} className="h-[390px] overflow-y-auto py-3 space-y-3.5 pr-1">
                {chatMessages.length === 0 ? (
                  /* Initial dialogue matching the screenshot */
                  <>
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=Mayur&glassesProbability=100`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-[#1e1435]">Mayur</span>
                          <span className="text-[10px] text-slate-400">8:41 PM</span>
                        </div>
                        <div className="text-xs text-[#332a47] font-medium mt-0.5">Ready? 👀</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=abcdghijk552&hair=long`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-[#1e1435]">abcdghijk552</span>
                          <span className="text-[10px] text-slate-400">8:41 PM</span>
                        </div>
                        <div className="text-xs text-[#332a47] font-medium mt-0.5">Let's go! 🔥</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=Mayur&glassesProbability=100`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-[#1e1435]">Mayur</span>
                          <span className="text-[10px] text-slate-400">8:42 PM</span>
                        </div>
                        <div className="text-xs text-[#332a47] font-medium mt-0.5">Nice number!</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=abcdghijk552&hair=long`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-[#1e1435]">abcdghijk552</span>
                          <span className="text-[10px] text-slate-400">8:42 PM</span>
                        </div>
                        <div className="text-xs text-[#332a47] font-medium mt-0.5">So close! 😂</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=Mayur&glassesProbability=100`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-[#1e1435]">Mayur</span>
                          <span className="text-[10px] text-slate-400">8:43 PM</span>
                        </div>
                        <div className="text-xs text-[#332a47] font-medium mt-0.5">Bingo soon! 🎯</div>
                      </div>
                    </div>
                  </>
                ) : (
                  chatMessages.map((m: any) => (
                    <div key={m.id} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${m.userName}`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-[#1e1435]">{m.userName}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-[#332a47] font-medium mt-0.5">{m.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Actions: Emoji row, Quick phrases & Message Input */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {/* Emojis row */}
              <div className="flex items-center justify-between text-xl px-1">
                {['❤️', '😂', '🔥', '🎉', '🎲', '😍'].map((emoji: string) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => sendReaction(emoji)}
                    className="hover:scale-130 transition transform active:scale-95 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Quick phrases pills */}
              <div className="flex items-center justify-between gap-1 text-[10px]">
                {['Good Luck! 🍀', 'Nice Mark! 👏', 'Bingo soon! 🎯'].map((phrase: string) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => sendChat(phrase)}
                    className="flex-1 py-1 px-1.5 rounded-full bg-[#f6f7fb] hover:bg-[#ffeef4] text-[#4a3e68] hover:text-[#ff3864] font-semibold border border-slate-200/60 transition cursor-pointer text-center truncate"
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              {/* Input & Send button */}
              <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-[#f6f7fb] border border-slate-200/80 rounded-2xl px-3.5 py-2.5 text-xs text-[#1e1435] placeholder:text-slate-400 focus:outline-none focus:border-[#ff3864] transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="w-9 h-9 rounded-2xl bg-[#ff3864] hover:bg-[#e6005c] disabled:opacity-40 text-white flex items-center justify-center shadow-md shadow-pink-500/20 transition cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>

      {/* Rematch Request Popup from Opponent */}
      {rematchStatus && !rematchStatus.allVoted && !rematchStatus.votedUserIds?.includes(effectiveUserId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] p-6 bg-white border border-pink-200 text-[#1e1435] shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-pink-100 text-3xl flex items-center justify-center shadow-sm">
              ⚔️
            </div>
            <div>
              <h3 className="text-xl font-black">Rematch Challenge!</h3>
              <p className="text-xs text-[#8a80a0] mt-1">
                <strong className="text-[#ff3864]">{rematchStatus.requesterName || opponent?.displayName || 'Your Opponent'}</strong> has requested a rematch!
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => rematch()}
                className="w-full py-3 px-4 bg-[#ff3864] hover:bg-[#e6005c] text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Accept Rematch (Yes!)</span>
              </button>
              <button
                type="button"
                onClick={declineRematch}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl cursor-pointer"
              >
                Decline (No)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {isFinished && (
        <BingoVictory
          conditionWon={lastBingoConditionWon}
          isHousefull={Boolean(gameState?.claimedConditions?.housefull)}
          winnerDisplayName={gameState?.winnerDisplayName || gameState?.gameSummary?.winnerDisplayName || 'Winner'}
          winnerUserId={gameState?.winnerUserId || ''}
          myUserId={effectiveUserId}
          finalScores={gameState?.scores || gameState?.gameSummary?.finalScores || {}}
          roundsWon={gameState?.gameSummary?.roundsWon || []}
          rematchStatus={rematchStatus}
          onRematch={rematch}
          onBackToPlan={() => router.push('/plans')}
          onBackToLobby={() => router.push('/games')}
        />
      )}

      {/* Friend Streak Celebration Modal */}
      {streakCelebration && (
        <StreakCelebrationModal
          isOpen={!!streakCelebration}
          onClose={clearStreakCelebration}
          friendName={streakCelebration.friendName}
          streakCount={streakCelebration.streakCount}
          isExtended={streakCelebration.isExtended}
        />
      )}
    </div>
  );
}

export default function TambolaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fcf7fa] flex flex-col items-center justify-center text-[#1e1435] space-y-3">
          <div className="w-10 h-10 border-3 border-[#ff3864] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-[#8a80a0]">Loading Tambola...</span>
        </div>
      }
    >
      <TambolaGameContent />
    </Suspense>
  );
}
