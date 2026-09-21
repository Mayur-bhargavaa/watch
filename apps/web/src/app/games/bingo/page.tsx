'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  Settings,
  Users,
  Trophy,
  Sparkles,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageSquare,
  Palette,
  GripHorizontal,
  Minus,
  X as CloseIcon,
  Flame,
  Zap,
  Volume2,
  VolumeX,
  ShieldAlert,
  Send,
  HelpCircle,
  RefreshCw,
  Sun,
  Moon,
  Heart,
  UserPlus,
  CornerUpLeft,
  Unlink,
  Bell,
  Play,
  Home
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { ChatReplyTo } from '@synccinema/common';
import { ChatReplyQuote, ChatReplyingBanner } from '../../../components/chat/ChatReplyUI';
import { AlertModal, AlertModalType } from '../../../components/ui/AlertModal';
import { StickerPicker, StickerMessageView } from '../../../components/chat/StickerPicker';
import { DrawStickerModal } from '../../../components/chat/DrawStickerModal';
import { parseStickerMessage, formatStickerMessage } from '../../../components/chat/StickersData';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import {
  getStoredSession,
  UserSession,
  createGameRoomWithPartner,
  getGameRoute,
  getGameTitle,
  createGameRoom,
  getUserMe,
  getUserPartner,
  connectUserPartner,
  disconnectUserPartner,
  pingPartner,
  sendHeartbeat,
  WS_BASE
} from '../../../lib/api';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { BingoDuelLobby } from '../../../components/games/bingo-duel/BingoDuelLobby';
import { BingoDuelWaitingRoom } from '../../../components/games/bingo-duel/BingoDuelWaitingRoom';
import { BingoDuelNumberCaller } from '../../../components/games/bingo-duel/BingoDuelNumberCaller';
import { BingoDuelBoard } from '../../../components/games/bingo-duel/BingoDuelBoard';
import { BingoPlayerDuelCard } from '../../../components/games/bingo-duel/BingoPlayerDuelCard';
import { BingoDuelClaimButton } from '../../../components/games/bingo-duel/BingoDuelClaimButton';
import { BingoDuelWinModal } from '../../../components/games/bingo-duel/BingoDuelWinModal';
import {
  BingoDuelConfig,
  BingoDuelGameState,
  BingoDuelPatternProgress,
  DEFAULT_BINGO_DUEL_CONFIG
} from '@synccinema/common';

export interface BoardTheme {
  id: string;
  name: string;
  bgUrl: string;
}

const THEMES: BoardTheme[] = [
  {
    id: 'romantic',
    name: 'Romantic Candlelight',
    bgUrl: '/images/romantic_room_ambient_bg.jpg'
  },
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    bgUrl: '/images/cozy_ludo_bg.jpg'
  },
  {
    id: 'theam1',
    name: 'Candlelit Café',
    bgUrl: '/theams/theam1.jpeg'
  },
  {
    id: 'theam2',
    name: 'Neon Romance',
    bgUrl: '/theams/theam2.jpeg'
  },
  {
    id: 'theam3',
    name: 'Better Together',
    bgUrl: '/theams/theam3.jpeg'
  },
  {
    id: 'theam4',
    name: 'Watch Together',
    bgUrl: '/theams/theam4.jpeg'
  }
];

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

function BingoDuelGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  // Theme Context
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [session, setSession] = useState<UserSession | null>(null);
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('theam2');
  const [duelConfig, setDuelConfig] = useState<BingoDuelConfig>(DEFAULT_BINGO_DUEL_CONFIG);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  // Partner State
  const [myPartnerCode, setMyPartnerCode] = useState<string>('');
  const [copiedPartnerCode, setCopiedPartnerCode] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [partner, setPartner] = useState<{
    id: string;
    displayName: string;
    partnerCode: string;
    avatarUrl?: string | null;
    online: boolean;
  } | null>(null);
  const [partnerInputCode, setPartnerInputCode] = useState('');
  const [isConnectingPartner, setIsConnectingPartner] = useState(false);
  const [partnerConnectError, setPartnerConnectError] = useState<string | null>(null);
  const [partnerPingStatus, setPartnerPingStatus] = useState<string | null>(null);
  const [isPingingPartner, setIsPingingPartner] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const lastStickerSentRef = useRef<number>(0);

  // Alert Modal State
  const [alertModalState, setAlertModalState] = useState<{
    title: string;
    message: string | React.ReactNode;
    type?: AlertModalType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  } | null>(null);

  const showAlert = useCallback((
    title: string,
    message: string | React.ReactNode,
    type: AlertModalType = 'info',
    options?: {
      confirmText?: string;
      cancelText?: string;
      onConfirm?: () => void;
    }
  ) => {
    setAlertModalState({
      title,
      message,
      type,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      onConfirm: options?.onConfirm
    });
  }, []);

  // Claim Feedback Toast
  const [claimToast, setClaimToast] = useState<{
    valid: boolean;
    message: string;
    timestamp: number;
  } | null>(null);

  // Custom 5x5 Board Setup Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Load user session & partner
  useEffect(() => {
    const s = getStoredSession();
    if (s && s.token) {
      setSession(s);
      getUserMe(s.token).then(res => {
        if (res?.user?.partnerCode) {
          setMyPartnerCode(res.user.partnerCode);
        }
      }).catch(() => {});
      getUserPartner(s.token).then(res => {
        if (res?.partner) {
          setPartner(res.partner);
        }
      }).catch(() => {});
    }
  }, []);

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bingo_theme_id');
      if (saved && THEMES.some(t => t.id === saved)) {
        setSelectedTheme(saved);
      }
    }
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bingo_theme_id', themeId);
    }
  };

  const currentTheme = useMemo(() => {
    return THEMES.find(t => t.id === selectedTheme) || THEMES[0];
  }, [selectedTheme]);

  const {
    room,
    players,
    gameState: rawGameState,
    myPlayer,
    myUserId,
    lastBingoCall,
    lastBingoClaimResult,
    lastBingoConditionWon,
    chatMessages,
    floatingReactions,
    connectionStatus,
    startBingoGame,
    callNextBingoNumber,
    toggleBingoPause,
    startBingoNextRound,
    claimBingo,
    markBingoNumber,
    updateBingoConfig,
    setBingoBoard,
    sendChat,
    sendReaction,
    sendLeave,
    sendVoiceState,
    sendCameraState,
    rematch,
    rematchStatus,
    declineRematch,
    rematchDeclined,
    clearRematchDeclined,
    sendWebRTCSignal,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomCodeParam);

  const gameState = rawGameState as BingoDuelGameState | null;

  // Cross-game redirect guard: only permit BINGO- rooms and gameType === 'bingo'
  useEffect(() => {
    if (roomCodeParam) {
      const code = roomCodeParam.trim().toUpperCase();
      if (!code.startsWith('BINGO-') && (code.startsWith('TAMBOLA-') || code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-') || code.startsWith('DOODLE-'))) {
        router.replace(getGameRoute(undefined, roomCodeParam));
        return;
      }
    }
    if (room?.gameType && room.gameType !== 'bingo' && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomCodeParam, room?.gameType, room?.roomCode, router]);

  const effectiveUserId = myUserId || session?.user.id || '';

  // Determine players
  const me = players.find(p => p.userId === effectiveUserId) || players[0];
  const opponent = players.find(p => p.userId !== me?.userId);

  const isHost = room?.hostUserId === effectiveUserId;
  const isWaiting = room && (room.status === 'WAITING' || (room.status === 'PLAYING' && !gameState));
  const isPlaying = room && room.status === 'PLAYING' && gameState !== null;
  const isRoundOver = gameState?.phase === 'ROUND_OVER';
  const isFinished = room && (room.status === 'FINISHED' || gameState?.phase === 'FINISHED');

  const myBoard = gameState?.boards?.[effectiveUserId] || [];
  const myMarks = gameState?.playerMarks?.[effectiveUserId] || [];
  const myProgress = gameState?.playerProgress?.[effectiveUserId];
  const myWins = gameState?.roundsWon?.[effectiveUserId] || 0;

  const opponentUserId = opponent?.userId || '';
  const opponentMarks = gameState?.playerMarks?.[opponentUserId] || [];
  const opponentProgress = gameState?.playerProgress?.[opponentUserId];
  const opponentWins = gameState?.roundsWon?.[opponentUserId] || 0;

  // Penalty countdown
  const now = Date.now();
  const penaltyUntil = gameState?.falseBingoPenaltyUntil?.[effectiveUserId] || 0;
  const penaltySeconds = Math.max(0, Math.ceil((penaltyUntil - now) / 1000));

  const winningIndices = gameState?.phase === 'ROUND_OVER' || gameState?.phase === 'FINISHED'
    ? (lastBingoConditionWon?.winningIndices || lastBingoClaimResult?.winningIndices)
    : undefined;

  // Strict Number Marking validation
  const handleCellClick = (num: number) => {
    if (isFinished || isRoundOver) return;
    const isDrawn = gameState?.calledNumbers?.includes(num);
    if (!isDrawn) {
      setClaimToast({
        valid: false,
        message: `⚠️ Number ${num} has not been drawn yet! Wait for it to be called.`,
        timestamp: Date.now()
      });
      setTimeout(() => {
        setClaimToast(curr => (curr?.message?.includes(`Number ${num}`) ? null : curr));
      }, 3500);
      return;
    }
    const alreadyMarked = myMarks.includes(num);
    if (alreadyMarked) return;
    markBingoNumber(num);
  };

  // Custom 5x5 Board saving handler
  const handleSaveCustomBoard = (customBoard: number[][]) => {
    setBingoBoard(customBoard);
    setShowSetupModal(false);
    setClaimToast({
      valid: true,
      message: '✓ Custom 5×5 Board locked and saved!',
      timestamp: Date.now()
    });
    setTimeout(() => setClaimToast(null), 3500);
  };

  // Web Speech API Voice Caller for Bingo Duel
  const lastSpokenNumberRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) return;
    if (duelConfig.voiceCaller && lastBingoCall?.number && lastBingoCall.number !== lastSpokenNumberRef.current) {
      lastSpokenNumberRef.current = lastBingoCall.number;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(
            `${lastBingoCall.number}`
          );
          utterance.rate = 1.0;
          utterance.pitch = 1.1;
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore speech synthesis errors
        }
      }
    }
  }, [isPlaying, duelConfig.voiceCaller, lastBingoCall?.number]);

  // Web Speech API Voice Announcement on Line Completion (B - I - N - G - O)
  const lastSpokenLineCountRef = useRef<number>(0);
  const myCompletedLines = gameState?.playerProgress?.[effectiveUserId]?.completedLines || [];
  const currentLinesCount = myCompletedLines.length;

  useEffect(() => {
    if (!isPlaying) {
      lastSpokenLineCountRef.current = 0;
      return;
    }
    if (currentLinesCount > lastSpokenLineCountRef.current) {
      const letters = ['B', 'I', 'N', 'G', 'O'];
      const currentLetter = letters[Math.min(currentLinesCount - 1, 4)];
      lastSpokenLineCountRef.current = currentLinesCount;

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const phrase =
            currentLinesCount >= 5
              ? 'BINGO! BINGO! You completed all 5 lines!'
              : `Line completed! Letter ${currentLetter}!`;
          const utterance = new SpeechSynthesisUtterance(phrase);
          utterance.rate = 1.05;
          utterance.pitch = 1.2;
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore speech synthesis errors
        }
      }

      setClaimToast({
        valid: true,
        message:
          currentLinesCount >= 5
            ? '🎉 B-I-N-G-O COMPLETE! Claim your victory now!'
            : `✨ Line completed! Letter [${currentLetter}] unlocked!`,
        timestamp: Date.now()
      });
      setTimeout(() => {
        setClaimToast(curr =>
          curr?.message.includes(currentLetter) || curr?.message.includes('B-I-N-G-O') ? null : curr
        );
      }, 4000);
    }
  }, [isPlaying, currentLinesCount, effectiveUserId]);

  // WebRTC Floating PIP Call Window Setup
  const webRTCMembers = useMemo(() => {
    return players.map(p => ({
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

  // Draggable Floating Video Call Window State
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && pipPosition === null) {
      if (window.innerWidth >= 1024) {
        setPipPosition({ x: 32, y: 140 });
      } else {
        setPipPosition({ x: 16, y: Math.max(100, window.innerHeight - 170) });
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
    if (!isDraggingPip) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const windowW = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;

      const newX = Math.max(12, Math.min(windowW - 220, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(12, Math.min(windowH - 90, dragStartRef.current.initialY + deltaY));

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
  }, [isDraggingPip]);

  // Chat scroll handlers
  const handleJumpToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`bingo-chat-msg-${msgId}`);
    if (el) {
      isUserScrolledUpRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => {
        setHighlightedMsgId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isUserScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 60;
  }, []);

  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim(), replyingTo);
    setChatInput('');
    setReplyingTo(null);
    setShowStickerPicker(false);
  };

  // Sync config from gameState when active
  useEffect(() => {
    if (gameState?.config) {
      setDuelConfig(gameState.config);
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

  // Handle leave room
  const handleLeave = () => {
    showAlert(
      'Leave Match?',
      'Are you sure you want to leave this Bingo Duel match? You will disconnect from the room.',
      'warning',
      {
        confirmText: 'Leave Match',
        cancelText: 'Stay & Play',
        onConfirm: () => {
          sendLeave();
          router.push('/games/bingo');
        }
      }
    );
  };

  const handleCreateRoom = async () => {
    if (!session?.token) {
      router.push('/login');
      return;
    }
    try {
      setIsCreatingRoom(true);
      const res = await createGameRoom(session.token, 'bingo', 2);
      if (res?.room?.roomCode) {
        router.push(`/games/bingo?room=${res.room.roomCode}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = (code: string) => {
    router.push(`/games/bingo?room=${encodeURIComponent(code)}`);
  };

  const handleCopyPartnerCode = () => {
    const code = myPartnerCode || session?.user?.partnerCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedPartnerCode(true);
    setTimeout(() => setCopiedPartnerCode(false), 2000);
  };

  const handleCopyRoomCode = () => {
    if (!room?.roomCode) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleConnectPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token || !partnerInputCode.trim()) return;
    try {
      setIsConnectingPartner(true);
      setPartnerConnectError(null);
      const res = await connectUserPartner(session.token, partnerInputCode.trim());
      if (res?.partner) {
        setPartner(res.partner);
        setPartnerInputCode('');
      }
    } catch (err: any) {
      setPartnerConnectError(err.message || 'Failed to connect partner');
    } finally {
      setIsConnectingPartner(false);
    }
  };

  const handleDisconnectPartner = async () => {
    if (!session?.token) return;
    try {
      await disconnectUserPartner(session.token);
      setPartner(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePingPartner = async () => {
    if (!session?.token || !partner) return;
    try {
      setIsPingingPartner(true);
      setPartnerPingStatus('Sending invitation...');
      const res = await pingPartner({
        targetCode: partner.partnerCode,
        fromCode: myPartnerCode || session.user.partnerCode,
        fromName: session.user.displayName,
        roomCode: room?.roomCode,
        gameType: 'bingo'
      });
      if (res?.deliveredLive) {
        setPartnerPingStatus(`🚀 Game invite delivered live to ${partner.displayName}!`);
      } else {
        setPartnerPingStatus(`🔔 Game invite sent to ${partner.displayName}!`);
      }
      setTimeout(() => setPartnerPingStatus(null), 3000);
    } catch (err: any) {
      setPartnerPingStatus(err.message || 'Could not ping partner');
      setTimeout(() => setPartnerPingStatus(null), 3000);
    } finally {
      setIsPingingPartner(false);
    }
  };

  // 1. NO ROOM PARAM -> Render Bingo Duel Lobby
  if (!roomCodeParam) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-hidden">
        {/* Dynamic Background Effects */}
        <div
          className="fixed inset-0 bg-cover bg-center opacity-15 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url(${currentTheme.bgUrl})` }}
        />
        <div className="fixed inset-0 bg-gradient-to-b from-[#070913]/90 via-[#070913]/95 to-[#070913] pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-20 px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={() => router.push('/games')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Games Hub</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Bingo Duel (1–25)
            </span>
          </div>
        </header>

        {/* Lobby Content */}
        <main className="relative z-10 flex-1 flex items-center justify-center">
          <BingoDuelLobby
            session={session}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onSelectPartner={() => setShowFriendDrawer(true)}
            isCreating={isCreatingRoom}
            isJoining={isJoiningRoom}
          />
        </main>

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async friend => {
            try {
              const res = await createGameRoomWithPartner('bingo', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/bingo?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>
    );
  }

  // 2. ROOM WAITING / READY -> Render Waiting Room
  if (isWaiting && room) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-hidden">
        <div
          className="fixed inset-0 bg-cover bg-center opacity-15 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url('/images/ludo-waiting-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-gradient-to-b from-[#070913]/90 via-[#070913]/95 to-[#070913] pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-20 px-4 sm:px-8 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Duel Matchmaking
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRulesModal(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              title="Rules"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex items-center justify-center">
          <BingoDuelWaitingRoom
            room={room}
            players={players}
            myUserId={effectiveUserId}
            isHost={isHost}
            config={duelConfig}
            onUpdateConfig={partial => {
              setDuelConfig(prev => ({ ...prev, ...partial }));
              updateBingoConfig(partial);
            }}
            onStartGame={() => startBingoGame(duelConfig)}
            onSelectPartner={() => setShowFriendDrawer(true)}
            partner={partner}
            onPingPartner={handlePingPartner}
            isPingingPartner={isPingingPartner}
            onOpenBoardCustomizer={() => setShowSetupModal(true)}
            isBoardCustomized={Boolean(gameState?.boardsReady?.[effectiveUserId])}
          />
        </main>

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async friend => {
            try {
              const res = await createGameRoomWithPartner('bingo', friend.friendUser.id);
              if (res?.room?.roomCode) {
                router.push(`/games/bingo?room=${res.room.roomCode}`);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />

        {/* Custom 5x5 Board Setup Modal in Waiting Room */}
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md">
              <BingoDuelBoard
                board={myBoard.length === 5 ? myBoard : []}
                playerMarks={[]}
                calledNumbers={[]}
                onCellClick={() => {}}
                isSetupMode={true}
                onSaveBoard={handleSaveCustomBoard}
                onCancelSetup={() => setShowSetupModal(false)}
                onValidationToast={msg => {
                  setClaimToast({ valid: false, message: msg, timestamp: Date.now() });
                  setTimeout(() => setClaimToast(null), 3500);
                }}
              />
            </div>
          </div>
        )}

        {/* General Alert Modal */}
        {alertModalState && (
          <AlertModal
            isOpen={!!alertModalState}
            onClose={() => setAlertModalState(null)}
            title={alertModalState.title}
            message={alertModalState.message}
            type={alertModalState.type || 'info'}
            confirmText={alertModalState.confirmText || 'Got It'}
            cancelText={alertModalState.cancelText}
            onConfirm={() => {
              const cb = alertModalState.onConfirm;
              setAlertModalState(null);
              if (cb) cb();
            }}
          />
        )}
      </div>
    );
  }

  // 3. IN GAME OR FINISHED -> Main Arena Layout (Matching Ludo 3-column UI)
  return (
    <div className="min-h-screen bg-[#070913] text-white flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* Dynamic Background Effects */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-20 pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url(${currentTheme.bgUrl})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#070913]/90 via-[#070913]/95 to-[#070913] pointer-events-none" />

      {/* Audio listeners for remote audio streams */}
      {videoGridParticipants.map(
        p => p.stream && !p.isSelf && <RemoteAudioPlayer key={p.userId} stream={p.stream} />
      )}

      {/* Floating Reaction Bubbles */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 text-4xl animate-bounce"
            style={{
              left: `${45 + (r.timestamp % 15)}%`,
              animationDuration: '1.2s'
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* TOP NAVIGATION BAR (Exact button row matching Ludo) */}
      <header className="h-16 px-4 sm:px-8 border-b border-white/[0.08] bg-[#14151b]/85 flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200">
        {/* Left: Breadcrumbs & Leave Match */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="px-3.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white shadow-xs flex items-center gap-2 font-semibold text-xs transition-all active:scale-95 group cursor-pointer"
            title="Leave Match"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Leave Match</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
            <span
              onClick={() => router.push('/dashboard')}
              className="cursor-pointer hover:underline text-zinc-400 hover:text-white"
            >
              Watch.
            </span>
            <span className="text-zinc-600">/</span>
            <span
              onClick={() => router.push('/games')}
              className="cursor-pointer hover:underline text-zinc-400 hover:text-white"
            >
              Game Lobby
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-[#ee1d49] font-bold">Bingo Duel</span>
          </div>
        </div>

        {/* Center: Room Code Badge & Show Video button */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 flex items-center gap-2 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Room: <strong className="text-white font-bold">{room?.roomCode}</strong></span>
          </div>
          {isPipClosed && (
            <button
              onClick={() => setIsPipClosed(false)}
              className="px-3 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 shadow text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Open Floating Video Call"
            >
              <Video className="w-3.5 h-3.5 text-rose-500" />
              <span>Show Video</span>
            </button>
          )}
        </div>

        {/* Right: Cam, Mic, Chat, Theme, Rules, Rematch, Settings */}
        <div className="flex items-center gap-2">
          {/* Audio / Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer ${
              isMicMuted
                ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-white'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400 ring-2 ring-emerald-500/20'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Video / Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer ${
              isCameraOn
                ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-400 ring-2 ring-rose-500/20'
                : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-white'
            }`}
            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {/* Chat Drawer Toggle */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer ${
              isChatOpen
                ? 'bg-rose-600 border-rose-500 text-white'
                : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
            }`}
            title="Toggle Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1] text-amber-400 transition flex items-center justify-center shadow-xs cursor-pointer"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Help / Rules Button */}
          <button
            onClick={() => setShowRulesModal(true)}
            className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
            title="Bingo Duel Rules & Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Rematch / Restart Button */}
          <button
            onClick={() => {
              if (gameState?.phase === 'FINISHED' || gameState?.phase === 'ROUND_OVER') {
                rematch();
              } else {
                showAlert(
                  'Restart Match?',
                  'Would you like to reset the duel and request a rematch with your opponent?',
                  'info',
                  {
                    confirmText: 'Request Rematch',
                    cancelText: 'Cancel',
                    onConfirm: () => rematch()
                  }
                );
              }
            }}
            className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
            title="Rematch / Restart"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MOVEABLE FLOATING VIDEO CALL WINDOW (Exact match with Ludo) */}
      {!isPipClosed && (
        <div
          ref={pipRef}
          onMouseDown={handlePipDragStart}
          onTouchStart={handlePipDragStart}
          style={
            pipPosition
              ? { left: `${pipPosition.x}px`, top: `${pipPosition.y}px` }
              : { left: '32px', top: '140px' }
          }
          className={`fixed z-50 select-none bg-[#190d15]/95 border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-shadow ${
            isDraggingPip
              ? 'cursor-grabbing ring-2 ring-rose-500/60 shadow-[0_25px_60px_rgba(244,63,94,0.35)] scale-[1.02]'
              : 'cursor-grab hover:border-white/30'
          } ${isPipMinimized ? 'px-3 py-2' : 'p-2.5 sm:p-3'}`}
        >
          {/* Top Bar: Drag Grip + In-Call Controls (Mic, Cam, Minimize, Close) */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-1.5 border-b border-white/10 touch-none">
            <div className="flex items-center gap-1.5 text-zinc-300 pointer-events-none">
              <GripHorizontal className="w-4 h-4 text-rose-400/80" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-white">
                Call ({videoGridParticipants.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Mic Toggle Icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMic();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm cursor-pointer ${
                  isMicMuted
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900'
                    : 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 hover:bg-emerald-900 ring-1 ring-emerald-400/40'
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
                  toggleCamera();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm cursor-pointer ${
                  isCameraOn
                    ? 'bg-rose-950/80 border-rose-400/60 text-rose-300 hover:bg-rose-900 ring-1 ring-rose-400/40'
                    : 'bg-white/10 border-white/20 text-zinc-300 hover:bg-white/20 hover:text-white'
                }`}
                title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>

              {/* Minimize / Expand Icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPipMinimized(!isPipMinimized);
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title={isPipMinimized ? 'Expand Video Tiles' : 'Minimize Video Tiles'}
              >
                <Minus className="w-3 h-3" />
              </button>

              {/* Close Icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPipClosed(true);
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Hide Floating Call Window"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Video Boxes Side by Side */}
          {!isPipMinimized && (
            <div className="flex items-center gap-2.5 pt-1">
              {videoGridParticipants.map(participant => (
                <div
                  key={participant.userId}
                  className="relative w-28 sm:w-32 h-24 sm:h-26 rounded-2xl bg-black/60 border border-white/15 overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner"
                >
                  {participant.isCameraOn && participant.stream ? (
                    <VideoAvatar
                      stream={participant.stream}
                      isSelf={participant.isSelf}
                      displayName={participant.displayName}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-[#ff2b5e] to-[#d6143c] text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md">
                          {participant.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center absolute -bottom-0.5 -right-0.5 shadow-sm border border-[#190d15] ${
                            participant.isMuted
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {participant.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-white mt-1.5 truncate max-w-[80px]">
                        {participant.isSelf ? 'You' : participant.displayName}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-COLUMN IN-GAME ARENA LAYOUT (Exact Ludo architecture) */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-5 z-10">
        <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-6 relative">
          {/* Left Column: Floating Room Code Card & Duel Info */}
          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
            <div className="p-4 rounded-3xl bg-[#1d0c18]/90 border border-rose-500/25 shadow-xl backdrop-blur-xl">
              <span className="text-[10px] font-bold text-rose-300/80 uppercase tracking-wider block">
                Room Code
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-mono font-black text-white tracking-wider">
                  {room?.roomCode}
                </span>
                <button
                  onClick={handleCopyRoomCode}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-300 transition cursor-pointer"
                  title="Copy Room Code"
                >
                  {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-rose-300/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{players.length} Players • Bingo Duel (1–25)</span>
              </div>
              {gameState && gameState.targetRounds > 1 && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Current Round</span>
                  <span className="font-bold text-pink-300 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                    Round {gameState.currentRound} of {gameState.targetRounds}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Number Caller + Player Duel Cards + 5x5 Board + Claim Button */}
          <div className="flex-1 w-full max-w-2xl sm:max-w-3xl mx-auto flex flex-col items-center gap-4">
            {/* 1. Visual Number Caller (numbers 1-25) */}
            <BingoDuelNumberCaller
              currentNumber={gameState?.currentNumber || null}
              currentNumberWord={gameState?.currentNumberWord || null}
              lastCalledNumbers={gameState?.lastCalledNumbers || []}
              calledNumbersCount={gameState?.calledNumbers?.length || 0}
              remainingCount={gameState?.callQueue?.length || 0}
              isPaused={Boolean(gameState?.callingPaused)}
              isHost={isHost}
              voiceCallerEnabled={Boolean(duelConfig.voiceCaller)}
              onToggleVoiceCaller={() => setDuelConfig(p => ({ ...p, voiceCaller: !p.voiceCaller }))}
              onTogglePause={toggleBingoPause}
              onCallNextManually={callNextBingoNumber}
              isManualMode={duelConfig.autoCallSpeed === 0}
            />

            {/* 2. Player Duel Status Header: You vs Opponent */}
            <div className="w-full grid grid-cols-2 gap-3 sm:gap-4">
              <BingoPlayerDuelCard
                displayName={me?.displayName || 'You'}
                avatarUrl={me?.avatarUrl}
                userId={effectiveUserId}
                isMe={true}
                marksCount={myMarks.length}
                progress={myProgress}
                roundsWon={myWins}
                targetRounds={gameState?.targetRounds || 1}
                isHost={isHost}
              />
              <BingoPlayerDuelCard
                displayName={opponent?.displayName || 'Opponent'}
                avatarUrl={opponent?.avatarUrl}
                userId={opponentUserId}
                isMe={false}
                marksCount={opponentMarks.length}
                progress={opponentProgress}
                roundsWon={opponentWins}
                targetRounds={gameState?.targetRounds || 1}
                isHost={!isHost}
              />
            </div>

            {/* 3. Authoritative 5x5 Bingo Board */}
            <div className="w-full my-auto py-2 flex flex-col items-center gap-2">
              {myBoard.length > 0 ? (
                <>
                  <BingoDuelBoard
                    board={myBoard}
                    playerMarks={myMarks}
                    calledNumbers={gameState?.calledNumbers || []}
                    completedLines={myProgress?.completedLines || []}
                    bingoLetters={myProgress?.bingoLetters || []}
                    winningIndices={winningIndices}
                    onCellClick={handleCellClick}
                    disabled={isFinished || isRoundOver}
                    onValidationToast={(msg) => {
                      setClaimToast({ valid: false, message: msg, timestamp: Date.now() });
                      setTimeout(() => setClaimToast(null), 3500);
                    }}
                  />

                  {gameState?.calledNumbers?.length === 0 && !isFinished && (
                    <button
                      type="button"
                      onClick={() => setShowSetupModal(true)}
                      className="mt-1 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>🎯 Customize Board Matrix (1–25)</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center p-8 bg-slate-900/50 rounded-3xl border border-white/10">
                  <span className="text-sm text-slate-400">Loading your 5×5 duel board...</span>
                </div>
              )}
            </div>

            {/* 4. Action Claim Button */}
            <div className="w-full pt-2">
              <BingoDuelClaimButton
                onClaim={() => claimBingo('bingo')}
                isCompleted={Boolean(myProgress?.isCompleted)}
                penaltySeconds={penaltySeconds}
                patternName={myProgress?.completedPatternName || duelConfig.pattern}
                disabled={isFinished || isRoundOver}
              />
            </div>
          </div>

          {/* Right Column: Full Game Chat with Stickers, Reactions, & Drawing (Matching Ludo) */}
          {isChatOpen && (
            <div className="w-full lg:w-80 shrink-0 bg-[#1c0c16]/65 border border-rose-500/25 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col h-[580px] backdrop-blur-xl relative">
              {/* Header */}
              <div className="pb-3 border-b border-rose-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/40">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white leading-none">Game Chat</h3>
                    <p className="text-[10px] text-rose-300/70 mt-0.5 font-medium">Live table messages & stickers</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Close Chat"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Stream */}
              <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto space-y-3 py-2.5 px-2 text-xs scrollbar-none"
              >
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-rose-300/60 py-12">
                    <Heart className="w-8 h-8 mb-2 text-rose-500/40" />
                    <p className="text-xs font-medium">Say something sweet or cheer a number!</p>
                  </div>
                ) : (
                  chatMessages.map(m => {
                    const isMe = m.userId === session?.user?.id || m.userId === effectiveUserId;
                    const isSticker = parseStickerMessage(m.content);
                    const isHighlighted = highlightedMsgId === m.id;
                    return (
                      <div
                        key={m.id}
                        id={`bingo-chat-msg-${m.id}`}
                        className={`group relative flex items-start gap-2.5 rounded-2xl p-1.5 my-0.5 transition-all duration-300 ${
                          isHighlighted ? 'ring-2 ring-inset ring-rose-500/80 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.35)]' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-pink-600 text-white font-bold text-xs flex items-center justify-center shadow shrink-0">
                          {m.userName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-bold text-rose-200 truncate">
                              {isMe ? `${m.userName} (You)` : m.userName}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                              <span className="text-[9px] text-zinc-400 font-mono">
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo({ id: m.id, userName: m.userName, content: m.content });
                                  chatInputRef.current?.focus({ preventScroll: true });
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                title="Reply to this message"
                              >
                                <CornerUpLeft className="w-3 h-3 text-rose-300" />
                              </button>
                            </div>
                          </div>

                          {m.replyTo && (
                            <ChatReplyQuote
                              replyTo={m.replyTo}
                              onJumpToMessage={handleJumpToMessage}
                              accentColor="rose"
                            />
                          )}

                          {isSticker ? (
                            <StickerMessageView content={m.content} />
                          ) : (
                            <div className="p-2 rounded-2xl bg-white/10 border border-white/10 text-rose-100 text-xs break-words">
                              {m.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Reactions & Quick Chat Phrases */}
              <div className="pt-2 pb-1 space-y-2 border-t border-rose-500/20">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {['❤️', '😂', '🔥', '👏', '🎉', '🎲', '🥳', '🥺', '👍', '✨'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => sendReaction(emoji)}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 active:scale-95 transition-all text-base shrink-0 border border-white/10 hover:border-rose-400/40 flex items-center justify-center shadow-sm cursor-pointer"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {['Good Luck! 🍀', 'Nice Mark! 👏', 'Bingo soon! 🔥', 'GG! 🏆', 'Hurry Up! ⏰', 'Oops! 🙈'].map(text => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        sendChat(text, replyingTo);
                        setReplyingTo(null);
                      }}
                      className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-rose-500/20 active:scale-95 text-rose-200 hover:text-white text-[11px] font-semibold border border-white/10 hover:border-rose-400/40 whitespace-nowrap transition-all shrink-0 shadow-sm cursor-pointer"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="relative pt-1">
                {showStickerPicker && (
                  <div className="absolute bottom-12 right-0 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <StickerPicker
                      onSelectSticker={(stickerIdOrUrl, caption) => {
                        const now = Date.now();
                        if (now - lastStickerSentRef.current < 500) return;
                        lastStickerSentRef.current = now;
                        sendChat(formatStickerMessage(stickerIdOrUrl, caption), replyingTo);
                        setShowStickerPicker(false);
                        setReplyingTo(null);
                      }}
                      onOpenDrawModal={() => {
                        setShowStickerPicker(false);
                        setShowDrawModal(true);
                      }}
                      onClose={() => setShowStickerPicker(false)}
                    />
                  </div>
                )}

                {replyingTo && (
                  <ChatReplyingBanner
                    replyingTo={replyingTo}
                    onCancel={() => setReplyingTo(null)}
                    accentColor="rose"
                  />
                )}

                <DrawStickerModal
                  isOpen={showDrawModal}
                  onClose={() => setShowDrawModal(false)}
                  onSendDrawnSticker={(formattedMessage) => {
                    const now = Date.now();
                    if (now - lastStickerSentRef.current < 500) return;
                    lastStickerSentRef.current = now;
                    sendChat(formattedMessage, replyingTo);
                    setReplyingTo(null);
                  }}
                />

                <form onSubmit={handleSendChat} className="flex items-center gap-2">
                  <div className="flex-1 relative flex items-center">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="w-full pl-3 pr-8 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-rose-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStickerPicker(!showStickerPicker)}
                      className="absolute right-2 text-zinc-400 hover:text-white transition cursor-pointer"
                      title="Stickers"
                    >
                      <Sparkles className="w-4 h-4 text-pink-400" />
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm cursor-pointer"
                    title="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Claim Toast Feedback */}
      {claimToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-200">
          <div
            className={`px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border font-bold text-xs sm:text-sm backdrop-blur-xl ${
              claimToast.valid
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {claimToast.valid ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{claimToast.message}</span>
          </div>
        </div>
      )}

      {/* Custom 5x5 Board Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md">
            <BingoDuelBoard
              board={myBoard.length === 5 ? myBoard : []}
              playerMarks={[]}
              calledNumbers={[]}
              onCellClick={() => {}}
              isSetupMode={true}
              onSaveBoard={handleSaveCustomBoard}
              onCancelSetup={() => setShowSetupModal(false)}
              onValidationToast={msg => {
                setClaimToast({ valid: false, message: msg, timestamp: Date.now() });
                setTimeout(() => setClaimToast(null), 3500);
              }}
            />
          </div>
        </div>
      )}

      {/* Round & Match Victory Modal */}
      {(isRoundOver || isFinished) && gameState && (
        <BingoDuelWinModal
          isMatchOver={gameState.phase === 'FINISHED'}
          isRoundOver={gameState.phase === 'ROUND_OVER'}
          winnerDisplayName={
            gameState.winnerDisplayName ||
            lastBingoConditionWon?.displayName ||
            'Player'
          }
          isWinnerMe={
            (gameState.winnerUserId || lastBingoConditionWon?.userId) === effectiveUserId
          }
          currentRound={gameState.currentRound}
          targetRounds={gameState.targetRounds}
          myWins={myWins}
          opponentWins={opponentWins}
          roundHistory={gameState.roundHistory}
          isHost={isHost}
          onNextRound={startBingoNextRound}
          onRematch={rematch}
          onLeave={handleLeave}
          rematchStatus={rematchStatus}
        />
      )}

      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl bg-[#14151b] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">How to Play Bingo Duel</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-white/[0.03] border-white/[0.06]">
                <Sparkles className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p><strong className="text-white">Numbers 1–25:</strong> The board is a 5×5 grid with numbers 1 to 25. Numbers are called continuously.</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-white/[0.03] border-white/[0.06]">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p><strong className="text-white">Marking:</strong> When a called number appears on your card, click it to mark it immediately.</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-white/[0.03] border-white/[0.06]">
                <Trophy className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p><strong className="text-white">Winning Patterns:</strong> Complete Any 1 Line (horizontal, vertical, diagonal), Any 2 Lines, Corners, or Full House to shout BINGO!</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-white/[0.03] border-white/[0.06]">
                <ShieldAlert className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p><strong className="text-white">Anti-Spam Penalty:</strong> Claiming BINGO prematurely incurs a brief 5-second penalty lock.</p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-5 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="border border-white/10 rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[88vh] overflow-y-auto shadow-2xl bg-[#14151b] animate-in fade-in zoom-in-95 duration-150 scrollbar-none">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">Bingo Duel Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* SECTION 1: PARTNER CONNECTION */}
              <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-white">Partner Connection</span>
                      <p className="text-[11px] font-medium text-zinc-400">Link once, duel together anytime</p>
                    </div>
                  </div>
                  {partner ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30 uppercase tracking-wider">
                      Paired
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-white/5 text-zinc-400 border-white/10">
                      Not Paired
                    </span>
                  )}
                </div>

                {partner ? (
                  <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                            {partner.displayName[0]?.toUpperCase()}
                          </div>
                          <span
                            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-black ${
                              partner.online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{partner.displayName}</span>
                            <span className="text-[10px] text-emerald-500 font-medium">
                              {partner.online ? '• Online' : '• Offline'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">
                            Code: <strong className="text-zinc-200">{partner.partnerCode}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleDisconnectPartner}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-white/10 bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Disconnect</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handlePingPartner}
                        disabled={isPingingPartner}
                        className="w-full py-2.5 rounded-xl font-semibold text-xs border border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Ping Partner</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 rounded-xl border border-white/[0.06] bg-black/30 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider block text-zinc-400">
                          Your Personal Code
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-rose-500 tracking-wider">
                          {myPartnerCode || session?.user?.partnerCode || '...'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPartnerCode}
                        className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copiedPartnerCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPartnerCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <form onSubmit={handleConnectPartner} className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider block text-zinc-400">
                        Enter Partner's Code
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={partnerInputCode}
                          onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                          placeholder="E.G. MAYURD81"
                          className="flex-1 px-3 py-2 rounded-xl text-xs font-mono uppercase tracking-wider bg-[#0f1015] border border-white/[0.1] text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="submit"
                          disabled={isConnectingPartner}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isConnectingPartner ? 'Linking...' : 'Connect'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {partnerConnectError && (
                  <p className="text-xs text-rose-500 mt-2 font-medium bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">{partnerConnectError}</p>
                )}
                {partnerPingStatus && (
                  <p className="text-xs mt-2 font-medium p-2 rounded-xl border text-zinc-300 bg-white/[0.04] border-white/[0.08]">{partnerPingStatus}</p>
                )}
              </div>

              {/* Board Theme Selection */}
              <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] space-y-2.5">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-rose-500" />
                  <span className="font-semibold text-white">Board Theme</span>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-none">
                  {THEMES.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme.id)}
                        className={`group relative rounded-xl overflow-hidden border transition-all flex flex-col items-center shadow-xs text-left cursor-pointer ${
                          isSelected
                            ? 'border-rose-500 ring-2 ring-rose-500/40 scale-[1.02]'
                            : 'border-white/[0.08] hover:border-white/30'
                        }`}
                      >
                        <div className="w-full h-16 relative overflow-hidden bg-black/50">
                          <img
                            src={theme.bgUrl}
                            alt={theme.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div className="w-full py-1 px-1.5 text-[10px] font-semibold text-center truncate bg-[#14151b] text-white">
                          {theme.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice Caller Setting */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-rose-500" />
                  <span className="font-semibold text-white">Voice Number Caller</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDuelConfig(p => ({ ...p, voiceCaller: !p.voiceCaller }))}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    duelConfig.voiceCaller ? 'bg-rose-600' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      duelConfig.voiceCaller ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Alert & Confirm Modal */}
      {alertModalState && (
        <AlertModal
          isOpen={!!alertModalState}
          onClose={() => setAlertModalState(null)}
          title={alertModalState.title}
          message={alertModalState.message}
          type={alertModalState.type || 'info'}
          confirmText={alertModalState.confirmText || 'Got It'}
          cancelText={alertModalState.cancelText}
          onConfirm={() => {
            const cb = alertModalState.onConfirm;
            setAlertModalState(null);
            if (cb) cb();
          }}
        />
      )}
    </div>
  );
}

export default function BingoDuelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070913] flex items-center justify-center text-white">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-sm font-bold text-slate-300">Loading Bingo Duel...</span>
          </div>
        </div>
      }
    >
      <BingoDuelGameContent />
    </Suspense>
  );
}
