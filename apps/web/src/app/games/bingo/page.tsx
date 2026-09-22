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
  Home,
  Crown,
  User
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
  playWithPartner,
  FriendWithStreak,
  WS_BASE
} from '../../../lib/api';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { AppSidebar } from '../../../components/layout/AppSidebar';
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

  // Lobby Modal & Matchmaking States (matching Ludo)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPartnerConnectInput, setShowPartnerConnectInput] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null);

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
    selectBingoNumber,
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
  const isPlayingOrFinished = Boolean(room && (isPlaying || isFinished || isRoundOver));

  // Auto-start Bingo Duel as soon as 2 human players have joined
  useEffect(() => {
    if (isHost && isWaiting && room && players.length >= (room.maxPlayers || 2) && !isPlayingOrFinished) {
      console.log('[Bingo] 2 human players joined! Auto-starting Bingo Duel...');
      startBingoGame(duelConfig);
    }
  }, [isHost, isWaiting, room, players.length, isPlayingOrFinished, startBingoGame, duelConfig]);

  const myBoard = gameState?.boards?.[effectiveUserId] || [];
  const myMarks = gameState?.playerMarks?.[effectiveUserId] || [];
  const myProgress = gameState?.playerProgress?.[effectiveUserId];
  const myWins = gameState?.roundsWon?.[effectiveUserId] || 0;

  const opponentUserId = opponent?.userId || '';
  const opponentMarks = gameState?.playerMarks?.[opponentUserId] || [];
  const opponentProgress = gameState?.playerProgress?.[opponentUserId];
  const opponentWins = gameState?.roundsWon?.[opponentUserId] || 0;

  // Alternating Turn Calculation
  const currentTurnUserId = gameState?.currentTurnUserId || room?.hostUserId;
  const isMyTurn = currentTurnUserId === effectiveUserId;
  const currentTurnPlayer = players.find(p => p.userId === currentTurnUserId);
  const currentTurnDisplayName = isMyTurn ? 'You' : currentTurnPlayer?.displayName || 'Opponent';

  // Penalty countdown
  const now = Date.now();
  const penaltyUntil = gameState?.falseBingoPenaltyUntil?.[effectiveUserId] || 0;
  const penaltySeconds = Math.max(0, Math.ceil((penaltyUntil - now) / 1000));

  const winningIndices = gameState?.phase === 'ROUND_OVER' || gameState?.phase === 'FINISHED'
    ? (lastBingoConditionWon?.winningIndices || lastBingoClaimResult?.winningIndices)
    : undefined;

  // Alternating Turn Number Picking / Marking
  const handleCellClick = (num: number) => {
    if (isFinished || isRoundOver) return;

    const isAlreadyCalled = gameState?.calledNumbers?.includes(num);

    if (isAlreadyCalled) {
      // Number is already called - verify mark
      const alreadyMarked = myMarks.includes(num);
      if (!alreadyMarked) {
        markBingoNumber(num);
      }
      return;
    }

    // Number is uncalled: can only be called if it's currently this player's turn
    if (!isMyTurn) {
      setClaimToast({
        valid: false,
        message: `⏳ It's ${currentTurnDisplayName}'s turn to pick a number! Please wait.`,
        timestamp: Date.now()
      });
      setTimeout(() => {
        setClaimToast(curr => (curr?.message?.includes('turn to pick') ? null : curr));
      }, 3500);
      return;
    }

    // It IS this player's turn: select the number to call it!
    selectBingoNumber(num);
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

  const handlePlayWithPartner = async (customFriendId?: string | React.MouseEvent) => {
    if ((!partner && typeof customFriendId !== 'string') || !session?.token) return;
    setIsMatchmaking(true);
    setLobbyError(null);
    try {
      const targetId = typeof customFriendId === 'string' ? customFriendId : partner?.id;
      const res = await playWithPartner(session.token, 'bingo', targetId);
      router.push(`/games/bingo?room=${res.room.roomCode}`);
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to connect with partner');
      setIsMatchmaking(false);
    }
  };

  const handleSelectFriendFromDrawer = (friend: FriendWithStreak) => {
    setPartner({
      id: friend.friendUser.id,
      displayName: friend.friendUser.displayName,
      partnerCode: friend.friendUser.partnerCode,
      avatarUrl: friend.friendUser.avatarUrl,
      online: Boolean(friend.friendUser.isOnline)
    });
  };

  const handlePlayWithFriendFromDrawer = (friend: FriendWithStreak) => {
    handleSelectFriendFromDrawer(friend);
    handlePlayWithPartner(friend.friendUser.id);
  };

  const handleCreateCustomRoom = async () => {
    if (!session?.token) {
      router.push('/login');
      return;
    }
    try {
      setIsMatchmaking(true);
      const res = await createGameRoom(session.token, 'bingo', 2);
      if (res?.room?.roomCode) {
        router.push(`/games/bingo?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to create room');
      setIsMatchmaking(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (!clean) {
      setJoinRoomError('Please enter a room code');
      return;
    }
    setJoinRoomError(null);
    setShowJoinModal(false);
    router.push(`/games/bingo?room=${encodeURIComponent(clean)}`);
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

  // Unified Ludo-Style Return (Lobby, Waiting Room, and In-Game Arena)
  return (
    <div className={`flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden transition-colors duration-150 ${
      roomCodeParam ? 'min-h-screen overflow-y-auto' : 'h-screen w-screen overflow-hidden'
    } ${
      isDark ? 'bg-[#111217] text-white' : 'bg-white text-zinc-900'
    }`}>
      {/* Active Match Background & Atmosphere */}
      {roomCodeParam ? (
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{ backgroundImage: `url('${currentTheme.bgUrl}')` }}
        />
      ) : (
        /* Modern Background for Lobby */
        <div className="fixed inset-0 pointer-events-none z-0">
          {isDark ? (
            <div className="absolute inset-0 bg-[#111217]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.06),rgba(255,255,255,0))]" />
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-white" />
          )}
        </div>
      )}

      {/* 1. CENTRALIZED APPSIDEBAR NAVIGATION (WHEN IN LOBBY) */}
      {!roomCodeParam && (
        <AppSidebar
          activeNav="games"
        />
      )}

      {/* 2. MAIN CONTENT AREA (FULL-SCREEN IN MATCH, ADAPTIVE IN LOBBY) */}
      <div className="flex-1 flex flex-col relative h-screen overflow-hidden">
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

        {/* TOP NAVIGATION BAR (Exact match with Ludo) */}
        <header className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200 ${
          isDark || isWaiting ? 'bg-[#14151b]/85 border-white/[0.08]' : 'bg-white/95 border-zinc-200/80 shadow-xs'
        }`}>
          {/* Left: Breadcrumbs or Leave Match */}
          <div className="flex items-center gap-3">
            {roomCodeParam ? (
              <button
                onClick={handleLeave}
                className={`px-3.5 py-1.5 rounded-xl border shadow-xs flex items-center gap-2 font-semibold text-xs transition-all active:scale-95 group cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border-white/[0.08]'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 hover:text-zinc-950 border-zinc-200'
                }`}
                title="Leave Match"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Leave Match</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => router.push('/games')}
                  className={`lg:hidden px-2.5 py-1.5 rounded-xl border flex items-center gap-1 font-semibold ${
                    isDark ? 'bg-white/[0.05] text-zinc-300 border-white/[0.08]' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Game Lobby</span>
                </button>

                <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
                  <span
                    onClick={() => router.push('/dashboard')}
                    className={`cursor-pointer hover:underline ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                  >
                    Watch.
                  </span>
                  <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>/</span>
                  <span
                    onClick={() => router.push('/games')}
                    className={`cursor-pointer hover:underline ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                  >
                    Game Lobby
                  </span>
                  <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>/</span>
                  <span className="text-[#ee1d49] font-bold">Bingo Duel</span>
                </div>
              </div>
            )}
          </div>


        {/* Center: Room Code Badge & Show Video button (ONLY WHEN IN ROOM) */}
        {roomCodeParam && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 flex items-center gap-2 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Room: <strong className="text-white font-bold">{room?.roomCode || roomCodeParam}</strong></span>
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
        )}

        {/* Right: Cam, Mic, Chat (WHEN IN ROOM), Theme, Rules, Rematch (WHEN IN ROOM), Settings */}
        <div className="flex items-center gap-2">
          {roomCodeParam && (
            <>
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
            </>
          )}

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

          {/* Rematch / Restart Button (ONLY IN ROOM) */}
          {roomCodeParam && (
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
          )}

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

      {/* MOVEABLE FLOATING VIDEO CALL WINDOW (ONLY WHEN IN ACTIVE ROOM) */}
      {roomCodeParam && !isPipClosed && (
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

      {/* MAIN CONTAINER */}
      <main className={`flex-1 w-full flex flex-col justify-start z-10 ${
        roomCodeParam && !isWaiting
          ? 'max-w-[1600px] mx-auto px-3 sm:px-6 py-2 sm:py-2.5 h-[calc(100vh-4rem)] overflow-hidden'
          : (roomCodeParam && isWaiting
              ? 'max-w-none p-0 h-[calc(100vh-4rem)] relative overflow-hidden'
              : 'h-[calc(100vh-4rem)] max-w-none p-0 overflow-hidden')
      }`}>
        {/* ROOM VIEW: CONNECTING OR ERROR STATE */}
        {roomCodeParam && !isWaiting && !isPlayingOrFinished && (
          <div className="w-full max-w-md mx-auto my-auto p-8 rounded-3xl bg-black/60 border border-white/20 backdrop-blur-2xl text-center space-y-4 shadow-2xl">
            {connectionStatus === 'DISCONNECTED' ? (
              <>
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <CloseIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Room Error</h3>
                <p className="text-xs text-rose-200/80">Could not connect to the Bingo room.</p>
                <button
                  onClick={() => router.push('/games/bingo')}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
                >
                  Back to Lobby
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mx-auto rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                <h3 className="text-base font-bold text-white">Connecting to Duel...</h3>
                <p className="text-xs text-zinc-400 font-mono">Room: {roomCodeParam}</p>
                <button
                  onClick={() => router.push('/games/bingo')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* ROOM VIEW: WAITING ROOM */}
        {roomCodeParam && isWaiting && room && (
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
        )}

        {/* ROOM VIEW: ACTIVE / FINISHED MATCH (Exact Layout from Reference Image) */}
        {roomCodeParam && isPlayingOrFinished && (
          <div className="w-full h-full flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-3 lg:gap-5 relative overflow-hidden">
          {/* Left Column: Floating Room Code Card & Duel Info matching reference image */}
          <div className="w-full lg:w-56 xl:w-60 shrink-0 flex flex-col gap-2.5 justify-start">
            {/* Badge Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#2a1222]/90 to-[#180a14]/90 border border-rose-500/30 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-[#ff8ca1] uppercase tracking-wider block">
                    BINGO DUEL
                  </span>
                  <span className="text-lg font-mono font-black text-white tracking-wider">
                    {room?.roomCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyRoomCode}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-300 transition cursor-pointer border border-white/10"
                  title="Copy Room Code"
                >
                  {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Winning Target</span>
                  <span className="font-extrabold text-[#ff8ca1]">5 Lines</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Calling Mode</span>
                  <span className="font-extrabold text-white">Turn-by-Turn</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Numbers Left</span>
                  <span className="font-mono font-black text-white bg-white/10 px-1.5 py-0.5 rounded">
                    {25 - (gameState?.calledNumbers?.length || 0)} / 25
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Voice Announce</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Turn Indicator / Setup Phase Banner */}
            {gameState?.phase === 'SETUP' ? (
              <div className="p-3 rounded-2xl border transition-all backdrop-blur-xl bg-gradient-to-br from-[#ff4d79]/20 to-[#ff758c]/10 border-[#ff6b8b] shadow-[0_10px_25px_rgba(255,77,121,0.25)]">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
                  Game Setup
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d79] animate-pulse" />
                  <span className="text-xs sm:text-sm font-extrabold text-white">
                    {!gameState?.boardsReady?.[effectiveUserId]
                      ? 'Step 1: Fill Your Board'
                      : 'Waiting for Opponent...'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                  {!gameState?.boardsReady?.[effectiveUserId]
                    ? 'Place numbers 1–25 on your 5×5 grid, then save!'
                    : 'Opponent is filling their board. Game starts when both are ready.'}
                </p>
              </div>
            ) : (
              <div className={`p-3 rounded-2xl border transition-all backdrop-blur-xl ${
                isMyTurn
                  ? 'bg-gradient-to-br from-[#ff4d79]/20 to-[#ff758c]/10 border-[#ff6b8b] shadow-[0_10px_25px_rgba(255,77,121,0.25)]'
                  : 'bg-[#180a14]/70 border-white/10'
              }`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
                  Active Player
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? 'bg-[#ff4d79] animate-ping' : 'bg-zinc-500'}`} />
                  <span className="text-xs sm:text-sm font-extrabold text-white">
                    {isMyTurn ? 'Your Turn to Pick' : `${currentTurnDisplayName}'s Turn`}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                  {isMyTurn
                    ? 'Tap any uncalled number on your ticket to call it aloud!'
                    : 'Wait for opponent to pick their next number.'}
                </p>
              </div>
            )}
          </div>

          {/* Center Column: Number Caller + Player Duel Cards + 5x5 Board + Claim Button */}
          <div className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center justify-between gap-1.5 h-full overflow-hidden">
            {/* 1. Visual Number Caller (numbers 1-25) — hidden during SETUP phase */}
            {gameState?.phase !== 'SETUP' && (
              <BingoDuelNumberCaller
                currentNumber={gameState?.currentNumber || null}
                currentNumberWord={gameState?.currentNumberWord || null}
                lastCalledNumbers={gameState?.lastCalledNumbers || []}
                calledNumbersCount={gameState?.calledNumbers?.length || 0}
                remainingCount={25 - (gameState?.calledNumbers?.length || 0)}
                isPaused={Boolean(gameState?.callingPaused)}
                isHost={isHost}
                voiceCallerEnabled={Boolean(duelConfig.voiceCaller)}
                onToggleVoiceCaller={() => setDuelConfig(p => ({ ...p, voiceCaller: !p.voiceCaller }))}
                currentTurnDisplayName={currentTurnDisplayName}
                isMyTurn={isMyTurn}
              />
            )}

            {/* 2. Player Duel Status Header: You vs Opponent */}
            <div className="w-full grid grid-cols-2 gap-2">
              <BingoPlayerDuelCard
                displayName={me?.displayName || 'You'}
                avatarUrl={me?.avatarUrl}
                userId={effectiveUserId}
                isMe={true}
                isTurn={isMyTurn}
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
                isTurn={!isMyTurn && Boolean(opponentUserId)}
                marksCount={opponentMarks.length}
                progress={opponentProgress}
                roundsWon={opponentWins}
                targetRounds={gameState?.targetRounds || 1}
                isHost={!isHost}
              />
            </div>

            {/* 3. Authoritative 5x5 Bingo Board (inline setup during SETUP phase) */}
            <div className="w-full my-auto flex flex-col items-center justify-center">
              {gameState?.phase === 'SETUP' && !gameState?.boardsReady?.[effectiveUserId] ? (
                /* Step 1: Player hasn't saved their board yet — show inline setup */
                <div className="w-full max-w-sm mx-auto">
                  <div className="text-center mb-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ff4d79]/20 to-[#ff758c]/10 border border-[#ff6b8b]/30 text-[#ff8ca1] text-[10px] font-black uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d79] animate-pulse" />
                      Step 1 — Fill Your Board
                    </span>
                  </div>
                  <BingoDuelBoard
                    board={[]}
                    playerMarks={[]}
                    calledNumbers={[]}
                    onCellClick={() => {}}
                    isSetupMode={true}
                    onSaveBoard={handleSaveCustomBoard}
                    onCancelSetup={() => {}}
                    onValidationToast={(msg) => {
                      setClaimToast({ valid: false, message: msg, timestamp: Date.now() });
                      setTimeout(() => setClaimToast(null), 3500);
                    }}
                  />
                </div>
              ) : gameState?.phase === 'SETUP' && gameState?.boardsReady?.[effectiveUserId] ? (
                /* Step 1b: Player saved their board but opponent hasn't — show waiting */
                <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-2">
                  <div className="text-center p-5 bg-gradient-to-br from-[#2a1222]/90 to-[#180a14]/90 rounded-2xl border border-rose-500/30 shadow-xl backdrop-blur-xl">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff4d79] to-[#ff758c] flex items-center justify-center mx-auto mb-2.5 shadow-md shadow-rose-950/40">
                      <span className="text-xl">✅</span>
                    </div>
                    <h3 className="text-base font-black text-white mb-1">Your Board is Ready!</h3>
                    <p className="text-xs text-zinc-400 mb-3">Waiting for opponent to fill their board...</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#ff4d79] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#ff758c] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#ff8ca1] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              ) : myBoard.length > 0 ? (
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
                      className="mt-1 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[#ff8ca1] hover:text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>🎯 Customize Board Matrix (1–25)</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center p-6 bg-slate-900/50 rounded-2xl border border-white/10">
                  <span className="text-xs text-slate-400">Loading your 5×5 duel board...</span>
                </div>
              )}
            </div>

            {/* 4. Action Claim Button — hidden during SETUP phase */}
            {gameState?.phase !== 'SETUP' && (
              <div className="w-full pt-0.5">
                <BingoDuelClaimButton
                  onClaim={() => claimBingo('bingo')}
                  isCompleted={Boolean(myProgress?.isCompleted)}
                  penaltySeconds={penaltySeconds}
                  patternName={myProgress?.completedPatternName || duelConfig.pattern}
                  disabled={isFinished || isRoundOver}
                />
              </div>
            )}
          </div>

          {/* Right Column: Full Game Chat with Stickers, Reactions, & Drawing (Matching Ludo) */}
          {isChatOpen && (
            <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-[#1c0c16]/65 border border-rose-500/25 rounded-2xl p-3 shadow-xl flex flex-col h-full max-h-[calc(100vh-5.5rem)] backdrop-blur-xl relative">
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
      )}

      {/* LOBBY VIEW (When not in an active room) */}
      {!roomCodeParam && (
        <div className={`w-full h-full flex flex-col justify-between relative z-10 select-none px-6 sm:px-10 lg:px-14 py-4 sm:py-6 overflow-hidden transition-colors duration-200 ${
          isDark ? 'bg-[#0c0d12] text-white' : 'bg-white text-zinc-900'
        }`}>
          {/* Top / Main Hero Container */}
          <div className="w-full flex-1 flex items-center max-w-7xl mx-auto">
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column: Eyebrow, Title, Subtitle, Action Cards */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                
                {/* Eyebrow */}
                <div className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-[#f43f5e] uppercase mb-2 sm:mb-3">
                  CALL • LINE UP • SHOUT BINGO
                </div>

                {/* Main Hero Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-none mb-3 sm:mb-4">
                  <span className="text-[#ee1d49]">Bingo</span>{' '}
                  <span className={isDark ? 'text-white' : 'text-[#131727]'}>Duel</span>
                </h1>

                {/* Subtitle */}
                <p className={`text-xs sm:text-sm lg:text-base font-medium max-w-lg leading-relaxed mb-4 sm:mb-5 ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}>
                  Play real-time 5×5 Bingo with your friends. Simple. Fun.
                  <br className="hidden sm:inline" />
                  No bots, just real players.
                </p>

                {/* Error banner if any */}
                {lobbyError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold">
                    {lobbyError}
                  </div>
                )}

                {/* Container: Play with Connected Person */}
                {partner ? (
                  <div className={`mb-4 sm:mb-5 rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-4.5 max-w-xl transition-all ${
                    isDark
                      ? 'bg-[#18121f]/90 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
                      : 'bg-[#fff5f7] border border-[#fde4eb] shadow-[0_4px_20px_rgba(238,29,73,0.05)]'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#ee1d49] to-[#f43f5e] text-white flex items-center justify-center font-bold text-sm shadow-xs ring-2 ring-white overflow-hidden">
                            {partner.avatarUrl ? (
                              <img src={partner.avatarUrl} alt={partner.displayName} className="w-full h-full object-cover" />
                            ) : (
                              (partner.displayName || partner.partnerCode || 'P').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white">
                            <span className="relative flex h-2 w-2">
                              <span className={`absolute inline-flex h-full w-full rounded-full ${partner.online ? 'animate-ping bg-emerald-400 opacity-75' : 'bg-zinc-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${partner.online ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                            </span>
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase">
                              Connected Partner
                            </span>
                            <Heart className="w-3 h-3 text-[#ee1d49] fill-[#ee1d49]" />
                            <button
                              type="button"
                              onClick={() => setShowFriendDrawer(true)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ee1d49]/10 hover:bg-[#ee1d49]/20 text-[#ee1d49] text-[10px] font-bold tracking-tight transition cursor-pointer active:scale-95"
                              title="Change or switch friend to play with"
                            >
                              <Users className="w-2.5 h-2.5" />
                              <span>Switch</span>
                            </button>
                          </div>
                          <h4 className={`text-sm sm:text-base font-bold truncate ${
                            isDark ? 'text-white' : 'text-zinc-900'
                          }`}>
                            {partner.displayName || partner.partnerCode}
                          </h4>
                          <p className={`text-[11px] truncate ${
                            isDark ? 'text-zinc-400' : 'text-zinc-500'
                          }`}>
                            {partner.online ? 'Online & ready to duel' : 'Offline • Tap ping to alert'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handlePingPartner}
                          disabled={isPingingPartner}
                          title={`Ping ${partner.displayName || 'partner'}`}
                          className={`p-2 sm:p-2.5 rounded-xl border transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 ${
                            isDark
                              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-rose-300'
                              : 'border-rose-200 bg-white hover:bg-rose-50 text-rose-600'
                          }`}
                        >
                          <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPingingPartner ? 'animate-bounce' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayWithPartner()}
                          disabled={isMatchmaking}
                          className="py-2.5 px-4 sm:px-5 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] hover:shadow-[0_6px_20px_rgba(237,28,70,0.35)] transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          <span>{isMatchmaking ? 'Starting...' : 'Play Together'}</span>
                          <span className="text-sm sm:text-base font-bold">→</span>
                        </button>
                      </div>
                    </div>
                    {partnerPingStatus && (
                      <div className="mt-2.5 pt-2 border-t border-rose-200/60 text-[11px] font-medium text-rose-400 flex items-center gap-1.5">
                        <span>{partnerPingStatus}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`mb-4 sm:mb-5 rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-4 max-w-xl transition-all ${
                    isDark
                      ? 'bg-[#18121f]/90 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
                      : 'bg-[#fff5f7] border border-[#fde4eb] shadow-[0_4px_20px_rgba(238,29,73,0.04)]'
                  }`}>
                    {!showPartnerConnectInput ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[#ee1d49] shrink-0 ${
                            isDark ? 'bg-rose-500/15' : 'bg-[#fee1e7]'
                          }`}>
                            <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase">
                                Play With Partner
                              </span>
                            </div>
                            <h4 className={`text-xs sm:text-sm font-bold truncate ${
                              isDark ? 'text-white' : 'text-zinc-900'
                            }`}>
                              Play with your connected person
                            </h4>
                            <p className={`text-[11px] truncate ${
                              isDark ? 'text-zinc-400' : 'text-zinc-500'
                            }`}>
                              Link codes to play 1-click matches together
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowFriendDrawer(true)}
                            className="py-2 px-3 sm:px-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs rounded-xl sm:rounded-2xl shadow-[0_4px_14px_rgba(237,28,70,0.2)] transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Choose Friend</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPartnerConnectInput(true)}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                              isDark
                                ? 'border-white/10 text-zinc-300 hover:bg-white/5'
                                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                            }`}
                            title="Enter partner code manually"
                          >
                            Code
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5 text-[#ee1d49] fill-[#ee1d49]" />
                            <span className={`text-xs font-bold ${
                              isDark ? 'text-white' : 'text-zinc-900'
                            }`}>Connect with your Partner</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPartnerConnectInput(false)}
                            className="text-zinc-400 hover:text-zinc-300 p-1 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {myPartnerCode && (
                            <div className={`flex items-center justify-between p-2 rounded-xl border ${
                              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-[#fde4eb]'
                            }`}>
                              <div className="min-w-0">
                                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Your Code</span>
                                <span className={`font-mono font-bold text-xs tracking-wider ${
                                  isDark ? 'text-white' : 'text-zinc-800'
                                }`}>{myPartnerCode}</span>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyPartnerCode}
                                className={`px-2 py-1 font-medium text-[10px] rounded-lg transition cursor-pointer ${
                                  isDark ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300' : 'bg-rose-50 hover:bg-rose-100 text-[#ee1d49]'
                                }`}
                              >
                                {copiedPartnerCode ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          )}

                          <form onSubmit={handleConnectPartner} className="flex gap-1.5">
                            <input
                              type="text"
                              value={partnerInputCode}
                              onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                              placeholder="THEIR CODE"
                              className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#ee1d49] ${
                                isDark ? 'bg-black/40 border border-white/10 text-white placeholder-zinc-500' : 'bg-white border border-[#fde4eb] text-zinc-900 placeholder-zinc-400'
                              }`}
                            />
                            <button
                              type="submit"
                              disabled={isConnectingPartner || !partnerInputCode.trim()}
                              className="px-3 py-1.5 bg-[#ed1c46] hover:bg-[#d6143c] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
                            >
                              {isConnectingPartner ? '...' : 'Link'}
                            </button>
                          </form>
                        </div>

                        {partnerConnectError && (
                          <p className="text-[11px] text-rose-400 font-medium">{partnerConnectError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Two Pastel Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-xl">
                  
                  {/* Card 1: Create a Room */}
                  <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between transition-all ${
                    isDark
                      ? 'bg-[#18121f]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-white/20'
                      : 'bg-[#fff5f7] border border-[#fde4eb] shadow-[0_4px_24px_rgba(238,29,73,0.04)] hover:shadow-[0_8px_30px_rgba(238,29,73,0.08)]'
                  }`}>
                    <div>
                      {/* Icon Badge */}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
                        isDark ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' : 'bg-[#fee1e7] text-[#ee1d49]'
                      }`}>
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                      </div>

                      {/* Title */}
                      <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}>
                        Create a Room
                      </h3>

                      {/* Description */}
                      <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mb-5 sm:mb-6 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        Start a 1v1 Bingo Duel table and invite your friend.
                      </p>
                    </div>

                    {/* Button */}
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="w-full py-3 px-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] hover:shadow-[0_6px_20px_rgba(237,28,70,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="text-base sm:text-lg leading-none font-bold">+</span>
                      <span>Create Room</span>
                    </button>
                  </div>

                  {/* Card 2: Join a Room */}
                  <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between transition-all ${
                    isDark
                      ? 'bg-[#121626]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-white/20'
                      : 'bg-[#f5f9ff] border border-[#e3eeff] shadow-[0_4px_24px_rgba(24,93,242,0.04)] hover:shadow-[0_8px_30px_rgba(24,93,242,0.08)]'
                  }`}>
                    <div>
                      {/* Icon Badge */}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
                        isDark ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' : 'bg-[#dce8fe] text-[#185df2]'
                      }`}>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </div>

                      {/* Title */}
                      <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}>
                        Join a Room
                      </h3>

                      {/* Description */}
                      <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mb-5 sm:mb-6 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        Enter a room code to join your rival's duel.
                      </p>
                    </div>

                    {/* Button */}
                    <button
                      type="button"
                      onClick={() => setShowJoinModal(true)}
                      className="w-full py-3 px-4 bg-[#185df2] hover:bg-[#144ecc] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(24,93,242,0.25)] hover:shadow-[0_6px_20px_rgba(24,93,242,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="text-sm sm:text-base font-bold">→</span>
                      <span>Join Room</span>
                    </button>
                  </div>

                </div>

              </div>

              {/* Right Column: 3D Game Card Graphic */}
              <div className="lg:col-span-5 flex items-center justify-center relative">
                <div className="relative w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[460px] max-h-[50vh] aspect-square flex items-center justify-center">
                  <img
                    src="/images/card-bingo-duel.png"
                    alt="Bingo Duel 5x5 Grid"
                    className="max-w-full max-h-full object-contain select-none pointer-events-none rounded-3xl shadow-2xl transform hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Row / Footer Decoration */}
          <div className="w-full max-w-7xl mx-auto pt-2 pb-1 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 shrink-0">
            {/* Bottom Left: Handwritten flourish */}
            <div className="flex items-center">
              <img
                src={isDark ? "/images/ludo-flourish-dark.png" : "/images/ludo-flourish.png"}
                alt="Good Games, Brighter Friendships"
                className="h-14 sm:h-18 lg:h-20 w-auto object-contain select-none pointer-events-none"
              />
            </div>

            {/* Bottom Right: PLAY • CONNECT • REPEAT */}
            <div className={`text-[10px] sm:text-[11px] font-bold tracking-[0.3em] uppercase ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              PLAY • CONNECT • REPEAT
            </div>
          </div>
        </div>
      )}
    </main>
  </div>

  {/* CREATE ROOM MODAL */}
  {showCreateModal && (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`border rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative ${
        isDark ? 'bg-[#14151b] border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
      }`}>
        <button
          type="button"
          onClick={() => setShowCreateModal(false)}
          className={`absolute top-5 right-5 p-2 rounded-full transition cursor-pointer ${
            isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
            isDark ? 'bg-[#ee1d49]/20 text-[#ee1d49]' : 'bg-[#fee1e7] text-[#ee1d49]'
          }`}>
            <Users className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Create a Room
            </h3>
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Instant 1v1 tactical 5×5 duel with voice calls
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              Game Type
            </label>
            <div className="p-3.5 rounded-2xl border flex items-center justify-between bg-[#ed1c46]/10 border-[#ed1c46]/30 text-[#ee1d49]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold">2-Player Bingo Duel (1–25)</span>
              </div>
              <span className="text-[10px] font-extrabold uppercase bg-[#ed1c46] text-white px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          </div>

          {partner && (
            <div className={`p-3.5 border rounded-2xl flex items-center justify-between ${
              isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-200' : 'bg-rose-50/70 border-rose-100 text-zinc-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span className="text-xs font-semibold">
                  Partner: {partner.displayName}
                </span>
              </div>
              {partner.online && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  Online
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              setShowCreateModal(false);
              await handleCreateCustomRoom();
            }}
            disabled={isMatchmaking}
            className="w-full py-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-sm rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>{isMatchmaking ? 'Setting up Room...' : 'Create Duel Room'}</span>
          </button>
        </div>
      </div>
    </div>
  )}

  {/* JOIN ROOM MODAL */}
  {showJoinModal && (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`border rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative ${
        isDark ? 'bg-[#14151b] border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
      }`}>
        <button
          type="button"
          onClick={() => setShowJoinModal(false)}
          className={`absolute top-5 right-5 p-2 rounded-full transition cursor-pointer ${
            isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
            isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-[#dce8fe] text-[#185df2]'
          }`}>
            <svg className="w-5 h-5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Join a Room
            </h3>
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Enter your rival's code to enter their table
            </p>
          </div>
        </div>

        <form onSubmit={handleJoinByCode} className="space-y-4">
          <div>
            <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              Room Code
            </label>
            <input
              type="text"
              value={roomCodeInput}
              onChange={e => {
                setRoomCodeInput(e.target.value.toUpperCase());
                if (joinRoomError) setJoinRoomError(null);
              }}
              placeholder="e.g. BINGO-E34C"
              maxLength={12}
              className={`w-full px-4 py-3.5 rounded-2xl font-mono text-sm uppercase tracking-wider focus:outline-none transition border ${
                isDark
                  ? 'bg-black/40 border-white/15 text-white placeholder-zinc-500 focus:border-[#185df2]'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-[#185df2]'
              }`}
              autoFocus
            />
            {joinRoomError && (
              <p className="text-xs text-rose-500 mt-1.5 font-medium">{joinRoomError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!roomCodeInput.trim()}
            className="w-full py-4 bg-[#185df2] hover:bg-[#144ecc] disabled:opacity-50 text-white font-semibold text-sm rounded-2xl shadow-[0_4px_16px_rgba(24,93,242,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Join Game</span>
            <span className="text-base font-bold">→</span>
          </button>
        </form>
      </div>
    </div>
  )}

  {/* Game Friend / Opponent Selector Drawer */}
  <GameFriendSelectorDrawer
    isOpen={showFriendDrawer}
    onClose={() => setShowFriendDrawer(false)}
    token={session?.token}
    gameTitle="Bingo Duel"
    onSelectFriend={handlePlayWithFriendFromDrawer}
  />

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
