'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
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
  Play,
  Copy,
  Check,
  UserPlus,
  Share2,
  ShieldCheck,
  User,
  MessageSquare
} from 'lucide-react';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { getStoredSession, UserSession, getGameRoute, createGameRoomWithPartner } from '../../../lib/api';
import { BingoLobby } from '../../../components/games/bingo/BingoLobby';
import { BingoVictory } from '../../../components/games/bingo/BingoVictory';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
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

// Initial default Tambola ticket
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

const VideoAvatar = React.memo(function VideoAvatar({
  stream,
  isSelf,
  displayName
}: {
  stream: MediaStream | null;
  isSelf?: boolean;
  displayName: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.defaultMuted = Boolean(isSelf);
    video.muted = Boolean(isSelf);

    const playVideo = () => {
      video.play().catch(() => {});
    };

    playVideo();
    video.addEventListener('loadedmetadata', playVideo);
    return () => {
      video.removeEventListener('loadedmetadata', playVideo);
    };
  }, [stream, isSelf]);

  if (!stream) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white font-bold text-xs">
        {displayName?.[0]?.toUpperCase() || 'U'}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={Boolean(isSelf)}
      className="w-full h-full object-cover rounded-xl"
    />
  );
});

function TambolaGameRoom({ roomCode }: { roomCode: string }) {
  const router = useRouter();

  const [session, setSession] = useState<UserSession | null>(null);
  const [roomConfig, setRoomConfig] = useState<BingoRoomConfig>(DEFAULT_CONFIG);
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Chat Bubble state (compact height, toggleable anytime)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-Mark switch state
  const [autoMark, setAutoMark] = useState(false);

  // Local client ticket state fallback
  const [previewTicketGrid, setPreviewTicketGrid] = useState<(number | null)[][]>(INITIAL_PREVIEW_TICKET);

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
    sendWebRTCSignal,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener,
    streakCelebration,
    clearStreakCelebration
  } = useGameRoom(roomCode);

  // Cross-game redirect guard
  useEffect(() => {
    if (roomCode) {
      const code = roomCode.trim().toUpperCase();
      if (!code.startsWith('TAMBOLA-') && !code.startsWith('BINGO-') && (code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-') || code.startsWith('DOODLE-'))) {
        router.replace(getGameRoute(undefined, roomCode));
        return;
      }
    }
    if (room?.gameType && room.gameType !== 'tambola' && room.gameType !== 'bingo' && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomCode, room?.gameType, room?.roomCode, router]);

  const effectiveUserId = myUserId || session?.user?.id || '';

  // Determine real players from WebSocket room state
  const me = players.find((p: any) => p.userId === effectiveUserId) || players[0];
  const opponent = players.find((p: any) => p.userId !== me?.userId);

  const isHost = room?.hostUserId === effectiveUserId;
  const isWaiting = Boolean(room && room.status === 'WAITING');
  const isPlaying = Boolean(room && room.status === 'PLAYING' && gameState !== null);
  const isFinished = Boolean(room && (room.status === 'FINISHED' || gameState?.phase === 'FINISHED'));

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
    localUserStream,
    toggleCamera,
    toggleMic,
    videoGridParticipants
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

  // Draggable Moveable Video Call Window State
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && pipPosition === null) {
      if (window.innerWidth >= 1024) {
        setPipPosition({ x: window.innerWidth - 320, y: window.innerHeight - 200 });
      } else {
        setPipPosition({ x: 16, y: Math.max(80, window.innerHeight - 180) });
      }
    }
  }, [pipPosition]);

  const handlePipDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
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
    setIsDraggingPip(true);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const newX = Math.max(8, Math.min(window.innerWidth - 260, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(64, Math.min(window.innerHeight - 140, dragStartRef.current.initialY + deltaY));

      setPipPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      dragStartRef.current = null;
      setIsDraggingPip(false);
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
  }, []);

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
  }, [chatMessages, isChatOpen]);

  // Copy room invite link
  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Copy room code
  const handleCopyCode = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(room?.roomCode || roomCode || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Handle leave room
  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // Participants for call
  const callParticipants = useMemo(() => {
    const list = [...videoGridParticipants];
    if (opponent && !list.some(p => p.userId === opponent.userId)) {
      list.push({
        userId: opponent.userId,
        displayName: opponent.displayName,
        stream: null,
        isMuted: true,
        isSelf: false,
        isCameraOn: false
      });
    }
    return list;
  }, [videoGridParticipants, opponent]);

  // Derived state for live game arena & ticket calculations
  const currentNum = lastBingoCall?.number ?? gameState?.currentNumber ?? null;
  const currentWord = lastBingoCall?.word ?? gameState?.currentNumberWord ?? (currentNum ? formatNumberWord(currentNum) : 'READY');
  const lastCalled: number[] = lastBingoCall?.calledNumbers ?? gameState?.lastCalledNumbers ?? [];
  const remaining: number = lastBingoCall?.remainingCount ?? gameState?.callQueue?.length ?? 90;

  // Real Ticket data
  const serverTicket = gameState?.tickets?.[me?.userId || ''];
  const ticketCells = serverTicket?.cells && serverTicket.cells.length > 0
    ? serverTicket.cells
    : previewTicketGrid;

  // Optimistic local marking for 0ms instant feedback
  const [localMarked, setLocalMarked] = useState<Set<number>>(new Set());
  const markedSentRef = useRef<Set<number>>(new Set());

  // Real Marked numbers from server
  const serverMarkedList: number[] = gameState?.playerMarked?.[me?.userId || ''] || [];
  const myMarkedSet = useMemo(() => {
    const s = new Set<number>(serverMarkedList);
    localMarked.forEach((n: number) => s.add(n));
    return s;
  }, [serverMarkedList, localMarked]);

  const calledSet = useMemo(() => new Set<number>(gameState?.calledNumbers || []), [gameState?.calledNumbers]);

  // Sync server marks to local marks when server state arrives
  useEffect(() => {
    if (serverMarkedList.length > 0) {
      setLocalMarked(prev => {
        let changed = false;
        const next = new Set(prev);
        serverMarkedList.forEach((n: number) => {
          if (!next.has(n)) {
            next.add(n);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      serverMarkedList.forEach((n: number) => markedSentRef.current.add(n));
    }
  }, [serverMarkedList]);

  // Full working Auto-Mark effect: scans called numbers on ticket and marks them instantly
  useEffect(() => {
    if (autoMark && isPlaying && ticketCells) {
      const allNums: number[] = ticketCells.flat().filter((n: number | null): n is number => n !== null);
      const toMark: number[] = [];
      allNums.forEach((num: number) => {
        if (calledSet.has(num) && !myMarkedSet.has(num) && !markedSentRef.current.has(num)) {
          toMark.push(num);
          markedSentRef.current.add(num);
        }
      });

      if (toMark.length > 0) {
        // Optimistically mark all instantly on screen
        setLocalMarked(prev => {
          const next = new Set(prev);
          toMark.forEach((n: number) => next.add(n));
          return next;
        });

        // Dispatch forceMark to server for all numbers
        toMark.forEach((num: number) => {
          markBingoNumber(num, true);
        });
      }
    }
  }, [autoMark, calledSet, myMarkedSet, isPlaying, ticketCells, markBingoNumber]);

  // Count marked out of 15
  const allTicketNumbers = ticketCells.flat().filter((n: number | null): n is number => n !== null);
  const myMarkedCount = allTicketNumbers.filter((n: number) => myMarkedSet.has(n)).length;

  const opponentMarkedList: number[] = opponent ? (gameState?.playerMarked?.[opponent.userId] || []) : [];
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

  // Handler for clicking a number on ticket (Instant optimistic response)
  const handleCellClick = (num: number | null) => {
    if (num === null) return;
    if (isPlaying) {
      if (myMarkedSet.has(num)) {
        // Optimistic unmark
        setLocalMarked(prev => {
          const next = new Set(prev);
          next.delete(num);
          return next;
        });
        markedSentRef.current.delete(num);
        markBingoNumber(num, false);
      } else {
        // Optimistic mark
        setLocalMarked(prev => {
          const next = new Set(prev);
          next.add(num);
          return next;
        });
        markedSentRef.current.add(num);
        markBingoNumber(num, true);
      }
    } else {
      if (myMarkedSet.has(num)) {
        myMarkedSet.delete(num);
      } else {
        myMarkedSet.add(num);
      }
      setPreviewTicketGrid([...previewTicketGrid]);
    }
  };

  // Primary Tambola action (Claim or Start)
  const handleClaimOrStart = () => {
    if (!isPlaying) {
      if (isHost && opponent) {
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

  // =========================================================================
  // 2. WAITING ROOM SCREEN (MATCHING LUDO / 6 GAMES STYLE)
  // =========================================================================
  if (isWaiting && room) {
    const isReadyToStart = room.players.length >= 2;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#120e20] via-[#161226] to-[#0c0915] text-white flex flex-col justify-between selection:bg-[#ff3b77] selection:text-white relative overflow-x-hidden font-sans">
        
        {/* Background Ambience */}
        <div className="fixed inset-0 pointer-events-none select-none z-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-3xl" />
        </div>

        {/* Top Header */}
        <header className="h-16 px-4 sm:px-8 border-b border-white/10 flex items-center justify-between bg-[#120e20]/80 backdrop-blur-xl z-30 sticky top-0">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>

          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-rose-400" />
            <span className="text-sm font-black text-white tracking-wide">Tambola 1v1 Duel</span>
          </div>

          <div className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-zinc-300">
            {room.roomCode}
          </div>
        </header>

        {/* Center Glassmorphic Waiting Card (Ludo Style) */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
          <div className="relative z-10 w-full max-w-xl my-auto rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 bg-[#181326]/80 border border-white/20 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_35px_rgba(255,59,119,0.15)] text-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Zero-Bots Matchmaking Pill */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[11px] font-semibold tracking-wide mb-4 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
              <span>Strict Zero-Bots Matchmaking</span>
            </div>

            {/* Waiting for Players Heading */}
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              Waiting <span className="font-medium text-white/90">for</span> <span className="text-[#ff3864]">Opponent</span>
            </h2>

            {/* Match Subtitle */}
            <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-6">
              Match will begin when <span className="text-[#ff3864] font-semibold">2 human players</span> join.
              <br />
              No bots will ever be injected.
            </p>

            {/* Room Code Card */}
            <div className="w-full bg-[#201933]/90 border border-white/10 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 mb-5 shadow-inner">
              <div className="text-left min-w-0">
                <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">
                  ROOM CODE
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-[#ff3864] tracking-wider block mt-0.5 leading-tight">
                  {room.roomCode}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                  Share this code with your friend
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95"
                  title="Copy Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-4 sm:px-5 bg-gradient-to-r from-[#ff3864] to-[#ff6699] hover:brightness-110 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(255,56,100,0.4)] transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
                </button>
              </div>
            </div>

            {/* Joined Seats Section */}
            <div className="w-full mb-5">
              <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-3 px-0.5">
                <span>Joined Seats ({room.players.length}/2)</span>
                <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-normal">
                  <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80 inline-block shrink-0" />
                  <span>{2 - room.players.length} seat remaining</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Seat 1: Host */}
                <div className="bg-[#201933]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff3864] to-[#e6005c] text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                    {(room.players[0]?.displayName?.[0] || 'P').toUpperCase()}
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                    {room.players[0]?.displayName || 'Host'}
                  </span>
                  <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Host
                  </span>
                </div>

                {/* Seat 2: Opponent / Waiting */}
                {room.players[1] ? (
                  <div className="bg-[#201933]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                      {(room.players[1]?.displayName?.[0] || 'O').toUpperCase()}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                      {room.players[1]?.displayName}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                      <User className="w-3.5 h-3.5" /> Player 2
                    </span>
                  </div>
                ) : (
                  <div className="bg-[#181326]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[120px]">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2 animate-pulse">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                    <span className="text-[11px] text-zinc-500 mt-0.5">Player 2</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Invite Button */}
            <div className="w-full flex flex-col gap-2.5">
              {isHost && isReadyToStart ? (
                <button
                  type="button"
                  onClick={() => startBingoGame(roomConfig)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer animate-bounce"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Tambola Match</span>
                </button>
              ) : isHost ? (
                <button
                  type="button"
                  onClick={() => setShowFriendDrawer(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <UserPlus className="w-4 h-4 text-[#ff3864]" />
                  <span>Invite from Online Friends</span>
                </button>
              ) : (
                <div className="w-full py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                  <span>⏳ Waiting for Host to start match...</span>
                </div>
              )}
            </div>

          </div>
        </main>

        {/* Friend Selector Drawer */}
        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Tambola"
          onSelectFriend={async (friend: any) => {
            try {
              const res = await createGameRoomWithPartner('tambola', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/tambola?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // 3. LIVE MATCH GAME ARENA (EXACT PIXEL-PERFECT MOCKUP)
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fcf7fa] via-[#faedf5] to-[#f4e2ee] text-[#1e1435] flex flex-col justify-between selection:bg-[#ff3b77] selection:text-white relative overflow-x-hidden font-sans">
      
      {/* Remote Audio Players */}
      {callParticipants.map(p => (
        !p.isSelf && p.stream ? <RemoteAudioPlayer key={p.userId} stream={p.stream} /> : null
      ))}

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

      {/* Condition Won Banner */}
      {lastBingoConditionWon && (
        <div className="bg-gradient-to-r from-rose-100 via-pink-100 to-rose-100 border-b border-rose-300 px-4 py-2 text-center text-xs font-black text-[#1e1435] flex items-center justify-center gap-2 z-20 backdrop-blur-md">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span>
            {lastBingoConditionWon.displayName} won {lastBingoConditionWon.conditionName}! (+{lastBingoConditionWon.points} pts)
          </span>
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
                <div className="font-serif italic text-[11px] leading-[1.05] text-[#ff2b70] tracking-tight select-none">
                  Play<br />Laugh<br />Stay Together ♡
                </div>
              </div>
              <p className="text-xs text-[#8a80a0] font-medium tracking-wide">
                1-90 Numbers • Classic Fun • 2 Players
              </p>
            </div>
          </div>

          {/* Right: "Same Numbers Different Hearts" Quote & Controls */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block font-serif italic text-base text-[#8d4b88] tracking-wide select-none mr-2">
              “Same Numbers Different Hearts” ♡
            </span>

            {/* Show Call Button (if closed) */}
            {isPipClosed && (
              <button
                type="button"
                onClick={() => setIsPipClosed(false)}
                className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Show Call Window"
              >
                <Video className="w-3.5 h-3.5 text-rose-500" />
                <span>Show Call</span>
              </button>
            )}

            {/* Chat Bubble Toggle Button */}
            <button
              type="button"
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`relative px-3.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isChatOpen
                  ? 'bg-[#ff3864] text-white border-[#ff3864]'
                  : 'bg-white/80 hover:bg-white text-[#4a3e68] border-pink-100'
              }`}
              title="Toggle Game Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {chatMessages.length > 0 && !isChatOpen && (
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>

            {/* Leave Match */}
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-bold text-[#4a3e68] border border-pink-100 shadow-xs transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </header>

        {/* 2. TOP DUEL PLAYERS BAR (REAL PLAYERS) */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          {/* Left Player Card (You) */}
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-3.5 sm:p-4 border border-white/80 shadow-[0_6px_25px_rgba(240,160,200,0.12)] flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 ring-2 ring-pink-100 shadow-sm shrink-0 flex items-center justify-center font-bold text-[#ff3864] text-lg">
              {me?.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.displayName} className="w-full h-full object-cover" />
              ) : (
                me?.displayName?.charAt(0).toUpperCase() || 'Y'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-[#1e1435] truncate">
                  {me?.displayName || session?.user?.displayName || 'You'}
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

          {/* Right Player Card (Real Opponent) */}
          <div className="bg-white/95 backdrop-blur-md rounded-[26px] p-3.5 sm:p-4 border border-white/80 shadow-[0_6px_25px_rgba(240,160,200,0.12)] flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 ring-2 ring-purple-100 shadow-sm shrink-0 flex items-center justify-center font-bold text-purple-600 text-lg">
              {opponent?.avatarUrl ? (
                <img src={opponent.avatarUrl} alt={opponent.displayName} className="w-full h-full object-cover" />
              ) : (
                opponent?.displayName?.charAt(0).toUpperCase() || 'O'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-[#1e1435] truncate">
                  {opponent ? opponent.displayName : 'Opponent'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-wider">
                  Opponent
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

        {/* 3. MAIN ARENA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          
          {/* TICKET & CALLER ROW (12 COLS OR ADAPTIVE) */}
          <div className="lg:col-span-12 flex flex-col gap-4">
            
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

                  {!isPlaying && (
                    <button
                      type="button"
                      onClick={() => setPreviewTicketGrid(generateRandomTambolaGrid())}
                      className="flex items-center gap-1 text-xs font-bold text-[#4a3e68] hover:text-[#ff3864] transition cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>New Ticket</span>
                    </button>
                  )}
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

                {isPlaying && currentNum !== null ? (
                  <>
                    {/* Big Glowing Dial with Sunburst Rays */}
                    <div className="relative my-3 flex items-center justify-center">
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <span className="absolute -left-3 w-3 h-0.5 bg-amber-400 rounded-full" />
                        <span className="absolute -right-3 w-3 h-0.5 bg-amber-400 rounded-full" />
                        <span className="absolute -top-1 -left-1 w-3 h-0.5 bg-amber-400 rounded-full -rotate-45" />
                        <span className="absolute -top-1 -right-1 w-3 h-0.5 bg-amber-400 rounded-full rotate-45" />
                      </div>

                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#ff3864] flex flex-col items-center justify-center bg-white shadow-[0_4px_25px_rgba(255,56,100,0.18)]">
                        <span className="text-4xl sm:text-5xl font-black text-[#1e1435] tracking-tight font-mono">
                          {currentNum}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs font-black tracking-widest text-[#ff3864] uppercase -mt-1 mb-2">
                      {currentWord}
                    </div>

                    {/* Real Last Numbers */}
                    <div className="w-full">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#8a80a0] mb-1.5 px-1">
                        <span>Last Numbers</span>
                        <span>{remaining} Left</span>
                      </div>

                      <div className="flex items-center justify-center gap-1.5">
                        {lastCalled.length > 0 ? (
                          lastCalled.slice(0, 5).map((num: number, idx: number) => (
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
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 py-1 font-medium">Numbers will appear here</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Dial when waiting / ready */
                  <div className="my-auto flex flex-col items-center justify-center py-4">
                    <div className="w-24 h-24 rounded-full border-3 border-dashed border-[#ff3864]/40 bg-[#fff5f8] flex flex-col items-center justify-center mb-2">
                      <Sparkles className="w-8 h-8 text-[#ff3864] animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#ff3864] mt-1">Ready</span>
                    </div>
                    <span className="text-xs font-bold text-[#1e1435]">Tambola Duel Arena</span>
                    <span className="text-[11px] text-[#8a80a0] mt-0.5">
                      Ready to start the match!
                    </span>
                  </div>
                )}

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleClaimOrStart}
                  className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff3864] via-[#ff2b70] to-[#e6005c] hover:brightness-105 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition shadow-[0_8px_25px_rgba(255,56,100,0.35)] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>
                    {!isPlaying && isHost
                      ? '🚀 START TAMBOLA MATCH'
                      : '🎉 CLAIM TAMBOLA!'}
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

            {/* Bottom Row: Romantic script quote + Popcorn Container */}
            <div className="flex items-center justify-between pt-2">
              <div className="font-serif italic text-base sm:text-lg text-[#8d4b88] tracking-wide select-none">
                Good Games<br />Better Company ♡
              </div>

              {/* Popcorn Bucket Decor */}
              <div className="relative w-16 h-20 select-none pointer-events-none">
                <div className="absolute bottom-0 w-14 h-14 bg-gradient-to-b from-pink-100 to-rose-200 rounded-b-2xl rounded-t-sm border border-rose-300 shadow-lg flex flex-col items-center justify-center text-center p-1">
                  <span className="font-serif italic font-black text-[9px] text-[#ff2b70] leading-tight">
                    Good<br />Vibes<br />Only
                  </span>
                </div>
                <div className="absolute -top-1 left-1 flex gap-0.5">
                  <span className="w-4 h-4 rounded-full bg-amber-200 border border-amber-300 shadow-xs" />
                  <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 shadow-xs -ml-1 -mt-1" />
                  <span className="w-4 h-4 rounded-full bg-amber-200 border border-amber-300 shadow-xs -ml-1" />
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. DRAGGABLE MOVEABLE VIDEO CALL WINDOW                                    */}
      {/* ========================================================================= */}
      {!isPipClosed && (
        <div
          ref={pipRef}
          onMouseDown={handlePipDragStart}
          onTouchStart={handlePipDragStart}
          style={
            pipPosition
              ? { left: `${pipPosition.x}px`, top: `${pipPosition.y}px` }
              : { right: '32px', bottom: '100px' }
          }
          className={`fixed z-40 select-none bg-white/95 border border-white/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-shadow ${
            isDraggingPip
              ? 'cursor-grabbing ring-2 ring-[#ff3864]/60 scale-[1.02]'
              : 'cursor-grab hover:border-pink-200'
          } ${isPipMinimized ? 'px-3 py-2' : 'p-3'}`}
        >
          {/* Header Bar: Drag Grip + In-Call Controls */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-1.5 border-b border-slate-100 touch-none">
            <div className="flex items-center gap-1.5 text-slate-700 pointer-events-none">
              <GripHorizontal className="w-4 h-4 text-rose-500" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#1e1435]">
                Call ({callParticipants.length}/2)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMic();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-xs cursor-pointer ${
                  isMicMuted
                    ? 'bg-rose-100 border-rose-200 text-rose-600'
                    : 'bg-emerald-100 border-emerald-200 text-emerald-600'
                }`}
                title={isMicMuted ? 'Unmute' : 'Mute'}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 animate-pulse" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCamera();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-xs cursor-pointer ${
                  isCameraOn
                    ? 'bg-emerald-100 border-emerald-200 text-emerald-600'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
                title={isCameraOn ? 'Turn Off Cam' : 'Turn On Cam'}
              >
                {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPipMinimized(!isPipMinimized);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                title={isPipMinimized ? 'Expand' : 'Minimize'}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPipClosed(true);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                title="Hide Call Box"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Working Video Feeds */}
          {!isPipMinimized && (
            <div className="flex items-center gap-2 pt-1">
              {/* Self Video Feed */}
              <div className="relative w-28 sm:w-32 h-20 sm:h-22 rounded-2xl bg-black/80 border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner group">
                {localUserStream && isCameraOn ? (
                  <VideoAvatar
                    stream={localUserStream}
                    isSelf={true}
                    displayName={me?.displayName || 'You'}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ff3864] to-[#ff6699] text-white font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                      {me?.displayName?.charAt(0).toUpperCase() || 'Y'}
                    </div>
                    <span className="text-[10px] text-zinc-300 font-bold truncate max-w-[90px]">You</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-bold text-white drop-shadow pointer-events-none">
                  <span className="truncate max-w-[65px]">You</span>
                  <span>{isMicMuted ? '🔴' : '🟢'}</span>
                </div>
              </div>

              {/* Opponent Video Feed */}
              <div className="relative w-28 sm:w-32 h-20 sm:h-22 rounded-2xl bg-black/80 border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner group">
                {opponent ? (
                  (() => {
                    const oppParticipant = callParticipants.find(p => p.userId === opponent.userId);
                    return oppParticipant && oppParticipant.stream && oppParticipant.isCameraOn ? (
                      <VideoAvatar
                        stream={oppParticipant.stream}
                        isSelf={false}
                        displayName={opponent.displayName}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#6d28d9] text-white font-black text-xs flex items-center justify-center mb-1 shadow-sm">
                          {opponent.displayName?.charAt(0).toUpperCase() || 'O'}
                        </div>
                        <span className="text-[10px] text-zinc-300 font-bold truncate max-w-[90px]">
                          {opponent.displayName}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <span className="text-[10px] text-zinc-400 font-bold">Waiting...</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-bold text-white drop-shadow pointer-events-none">
                  <span className="truncate max-w-[65px]">{opponent?.displayName || 'Opponent'}</span>
                  <span>🟢</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CHAT BUBBLE TRIGGER & COMPACT POPUP CHAT WINDOW                        */}
      {/* ========================================================================= */}
      {/* Floating Chat Bubble Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#ff3864] via-[#ff2b70] to-[#ff6699] text-white flex items-center justify-center shadow-[0_8px_30px_rgba(255,56,100,0.45)] hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer relative"
          title="Open Match Chat"
        >
          <MessageSquare className="w-6 h-6 stroke-[2.2]" />
          {chatMessages.length > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white font-black text-[10px] flex items-center justify-center border-2 border-white shadow-xs">
              {chatMessages.length}
            </span>
          )}
        </button>
      </div>

      {/* Floating Compact Chat Window */}
      {isChatOpen && (
        <div className="fixed bottom-22 right-6 z-40 w-80 sm:w-92 h-[420px] max-h-[80vh] bg-white/95 backdrop-blur-xl rounded-[28px] p-4 border border-white/90 shadow-[0_15px_50px_rgba(0,0,0,0.22)] flex flex-col justify-between animate-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#7c3aed] text-white flex items-center justify-center shadow-xs">
                <Send className="w-3.5 h-3.5 rotate-45" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#1e1435]">Game Chat</h3>
                <p className="text-[10px] text-[#8a80a0]">Live messages & reactions</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-2.5 space-y-2.5 pr-1">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <div className="w-10 h-10 rounded-full bg-pink-50 text-[#ff3864] flex items-center justify-center mb-1.5">
                  <Send className="w-4 h-4 rotate-45" />
                </div>
                <p className="text-xs font-bold text-[#1e1435]">No messages yet</p>
                <p className="text-[10px] text-[#8a80a0] mt-0.5">Send a message to start!</p>
              </div>
            ) : (
              chatMessages.map((m: any) => (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0 flex items-center justify-center font-bold text-[10px] text-[#ff3864]">
                    {m.userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-[#1e1435] truncate">{m.userName}</span>
                      <span className="text-[9px] text-slate-400">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-[#332a47] font-medium mt-0.5 break-words">{m.content}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Controls: Emojis, Phrases, Input */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {/* Emojis row */}
            <div className="flex items-center justify-between text-lg px-0.5">
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
            <div className="flex items-center justify-between gap-1 text-[9px]">
              {['Good Luck! 🍀', 'Nice Mark! 👏', 'Tambola soon! 🎯'].map((phrase: string) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => sendChat(phrase)}
                  className="flex-1 py-1 px-1 rounded-full bg-[#f6f7fb] hover:bg-[#ffeef4] text-[#4a3e68] hover:text-[#ff3864] font-semibold border border-slate-200/60 transition cursor-pointer text-center truncate"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Input & Send */}
            <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-0.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-[#f6f7fb] border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs text-[#1e1435] placeholder:text-slate-400 focus:outline-none focus:border-[#ff3864] transition"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="w-8 h-8 rounded-xl bg-[#ff3864] hover:bg-[#e6005c] disabled:opacity-40 text-white flex items-center justify-center shadow-md shadow-pink-500/20 transition cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </div>
      )}

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

function TambolaPageInner() {
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  if (!roomCodeParam) {
    return <BingoLobby />;
  }

  return <TambolaGameRoom roomCode={roomCodeParam} />;
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
      <TambolaPageInner />
    </Suspense>
  );
}
