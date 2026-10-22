'use client';

import { TIC_TAC_TOE_REACTIONS } from '../../../lib/reactionEmojis';
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useRouter, useSearchParams } from 'next/navigation';
import { SpectatorBanner } from '../../../components/games/common/SpectatorBanner';
import { TournamentMatchBanner } from '../../../components/games/common/TournamentMatchBanner';
import { NewGameWithOpponent } from '../../../components/games/common/NewGameWithOpponent';
import { isSpectateRequested } from '../../../lib/spectator';
import {
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Trophy,
  Heart,
  Settings,
  HelpCircle,
  Volume2,
  VolumeX,
  X as CloseIcon,
  Check,
  Copy,
  UserPlus,
  Unlink,
  Bell,
  Play,
  MessageSquare,
  Send,
  Smile,
  ChevronRight,
  Palette,
  Crown,
  Share2,
  Shield,
  ShieldCheck,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Radio,
  Users,
  GripHorizontal,
  Minus,
  CornerUpLeft,
  Sun,
  Moon,
  Lock,
  Film,
  Gamepad2,
  LogOut,
  User,
  ArrowRight,
  RefreshCw,
  Home,
  Flame
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { ChatReplyTo } from '@synccinema/common';
import { ChatReplyQuote, ChatReplyingBanner } from '../../../components/chat/ChatReplyUI';
import { AlertModal, AlertModalType } from '../../../components/ui/AlertModal';
import {
  getStoredSession,
  clearStoredSession,
  ensureSession,
  getUserMe,
  getUserPartner,
  connectUserPartner,
  partnerRequestNotice,
  disconnectUserPartner,
  pingPartner,
  createGameRoom,
  getGameRoom,
  joinGameRoom,
  playWithPartner,
  invitePartnerToGame,
  sendHeartbeat,
  recordFriendStreak,
  UserSession,
  FriendWithStreak,
  getGameRoute,
  getGameTitle
} from '../../../lib/api';
import { useGameRoom, TicTacToeCellMarkEvent } from '../../../hooks/useGameRoom';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import { StickerPicker, StickerMessageView } from '../../../components/chat/StickerPicker';
import { parseStickerMessage, formatStickerMessage } from '../../../components/chat/StickersData';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { AddFriendModal } from '../../../components/streaks/AddFriendModal';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { getRandomRoast } from '../../../lib/roastMessages';
import { UnifiedGameWaitingRoom } from '../../../components/games/common/waiting/UnifiedGameWaitingRoom';
import { PartyPoppers } from '../../../components/games/common/PartyPoppers';
import { PenFightBoard } from '../pen-fight/PenFightBoard';
import { ZeroCrossBoard, ZeroCrossClock } from '../zero-cross/ZeroCrossBoard';
import { DURATION_CHOICES, markOfSeat, resultText } from '../../../lib/zeroCrossView';
import { RpsBoard } from '../rps/RpsBoard';
import { FORMAT_CHOICES, phaseLabel as rpsPhaseLabel } from '../../../lib/rpsView';

export interface BoardTheme {
  id: string;
  name: string;
  bgUrl: string;
  accent: string;
  gridBorder: string;
  cellBg: string;
}

const THEMES: BoardTheme[] = [
  {
    id: 'rps',
    name: 'Showdown',
    bgUrl: '/images/rps-bg.jpg',
    accent: '#f59e0b',
    gridBorder: 'border-amber-500/20',
    cellBg: 'bg-amber-950/20 hover:bg-amber-900/30'
  },
  {
    id: 'zero-cross',
    name: 'Zero Cross Night',
    bgUrl: '/images/zero-cross-bg.jpg',
    accent: '#38bdf8',
    gridBorder: 'border-cyan-500/20',
    cellBg: 'bg-cyan-950/20 hover:bg-cyan-900/30'
  },
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    bgUrl: '/images/cozy_ludo_bg.jpg',
    accent: '#f43f5e',
    gridBorder: 'border-rose-500/20',
    cellBg: 'bg-rose-950/20 hover:bg-rose-900/30'
  },
  {
    id: 'theam1',
    name: 'Theme 1 • Candlelit Café',
    bgUrl: '/theams/theam1.jpeg',
    accent: '#fbbf24',
    gridBorder: 'border-amber-500/20',
    cellBg: 'bg-amber-950/20 hover:bg-amber-900/30'
  },
  {
    id: 'theam2',
    name: 'Theme 2 • Neon Romance',
    bgUrl: '/theams/theam2.jpeg',
    accent: '#ec4899',
    gridBorder: 'border-pink-500/30',
    cellBg: 'bg-pink-950/25 hover:bg-pink-900/35'
  },
  {
    id: 'theam3',
    name: 'Theme 3 • Better Together',
    bgUrl: '/theams/theam3.jpeg',
    accent: '#8b5cf6',
    gridBorder: 'border-purple-500/20',
    cellBg: 'bg-purple-950/20 hover:bg-purple-900/30'
  },
  {
    id: 'theam4',
    name: 'Theme 4 • Watch Together',
    bgUrl: '/theams/theam4.jpeg',
    accent: '#3b82f6',
    gridBorder: 'border-blue-500/20',
    cellBg: 'bg-blue-950/20 hover:bg-blue-900/30'
  },
  {
    id: 'theam5',
    name: 'Theme 5 • Snuggle Cinema',
    bgUrl: '/theams/theam5.jpeg',
    accent: '#f43f5e',
    gridBorder: 'border-rose-500/20',
    cellBg: 'bg-rose-950/20 hover:bg-rose-900/30'
  },
  {
    id: 'theam6',
    name: 'Theme 6 • Velvet Night',
    bgUrl: '/theams/theam6.jpeg',
    accent: '#06b6d4',
    gridBorder: 'border-cyan-500/20',
    cellBg: 'bg-cyan-950/20 hover:bg-cyan-900/30'
  }
];

const QUICK_CHAT_PHRASES = [
  'Your turn!',
  'So close!!',
  'Nice move!',
  'Rematch after this!',
  'Watch this line!',
  'Oops haha!'
];

const EMOJI_REACTIONS = TIC_TAC_TOE_REACTIONS;

const FEATURED_QUICK_STICKERS = [
  { id: 'bubu_dance', name: 'Dance', gifUrl: 'https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif', tagline: 'HAPPY DANCE!' },
  { id: 'bubu_kiss', name: 'Kiss', gifUrl: 'https://media2.giphy.com/media/fX5NLVCyAnWyGsERta/giphy.gif', tagline: 'MWAHH!' },
  { id: 'bubu_hug', name: 'Hug', gifUrl: 'https://media3.giphy.com/media/GhUy4fOxwX1YGyIgEJ/giphy.gif', tagline: 'TIGHT HUG' },
  { id: 'bubu_love', name: 'Love', gifUrl: 'https://media1.giphy.com/media/R6gvnAxj2ISzJdbAht/giphy.gif', tagline: 'I LOVE YOU!' },
  { id: 'bubu_heart', name: 'Heart', gifUrl: 'https://media0.giphy.com/media/c76IJLufpNwSULPk77/giphy.gif', tagline: 'FOR YOU' }
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

export type BoardVariant = 'zero-cross' | 'pen-fight' | 'rock-paper-scissors';
const VARIANTS: Record<BoardVariant, { name: string; route: string }> = {
  'zero-cross': { name: 'Zero Cross', route: '/games/zero-cross' },
  'pen-fight': { name: 'Pen Fight', route: '/games/pen-fight' },
  'rock-paper-scissors': { name: 'Rock Paper Scissors', route: '/games/rock-paper-scissors' }
};

/**
 * Tic Tac Toe and Zero Cross are the same 3x3 game on the server (only the name, the route and the room type differ). Pen Fight
 * shares everything around the board (lobby, waiting room, players, video, chat, reactions, rematch) and swaps the 3x3 grid for the desk.
 */
function BoardDuelContent({ variant }: { variant: BoardVariant }) {
  const GAME_ID = variant;
  const GAME_NAME = VARIANTS[variant].name;
  const GAME_ROUTE = VARIANTS[variant].route;
  const isPen = variant === 'pen-fight';
  const isZero = variant === 'zero-cross';
  const isRps = variant === 'rock-paper-scissors';
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // the mark glyphs on the player cards and the turn banner
  const MARK_X = isPen ? '✎' : isRps ? '1' : '✕';
  const MARK_O = isPen ? '✎' : isRps ? '2' : '◯';
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');
  const spectateMode = isSpectateRequested(searchParams.get('spectate'));

  // User identity & Partner
  const [session, setSession] = useState<UserSession | null>(null);
  const [myPartnerCode, setMyPartnerCode] = useState<string>('');
  const [partnerInputCode, setPartnerInputCode] = useState('');
  const [copiedPartnerCode, setCopiedPartnerCode] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);
  const [showPartnerConnectInput, setShowPartnerConnectInput] = useState(false);
  const [isConnectingPartner, setIsConnectingPartner] = useState(false);
  const [partnerConnectError, setPartnerConnectError] = useState<string | null>(null);

  const [partner, setPartner] = useState<{
    id: string;
    displayName: string;
    partnerCode: string;
    avatarUrl?: string | null;
    online: boolean;
  } | null>(null);
  const [isPingingPartner, setIsPingingPartner] = useState(false);
  const [partnerPingStatus, setPartnerPingStatus] = useState<string | null>(null);

  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);

  // Theme
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  // Lobby modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createIsPrivate, setCreateIsPrivate] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  // Modals & UI Controls
  const [activeTheme, setActiveTheme] = useState<string>(variant === 'zero-cross' ? 'zero-cross' : variant === 'rock-paper-scissors' ? 'rps' : 'cozy');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);

  // Scoreboard tracking within session
  const [scores, setScores] = useState<{ xWins: number; oWins: number; draws: number }>({
    xWins: 0,
    oWins: 0,
    draws: 0
  });

  // Friend streak celebration state
  const [streakCelebration, setStreakCelebration] = useState<{
    friendName: string;
    streakCount: number;
    isExtended: boolean;
  } | null>(null);
  const streakRecordedPairRef = useRef<string | null>(null);

  // Dismiss Victory Modal
  const [dismissVictoryModal, setDismissVictoryModal] = useState(false);
  const [showPartyPoppers, setShowPartyPoppers] = useState(false);
  const [showDelayedWinModal, setShowDelayedWinModal] = useState(false);

  // Alert modal state
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

  // Web Audio Context for synthesized sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const chatBottomMobileRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);

  const handleChatScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isUserScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 60;
  }, []);

  // Real-Time Room WebSocket Hook
  const {
    room,
    players,
    gameState,
    myPlayer,
    myUserId,
    isMyTurn,
    connectionStatus,
    error: roomError,
    gameError,
    clearGameError,
    disconnectedPlayer,
    opponentLeftWin,
    clearOpponentLeftWin,
    nudgeAlert,
    clearNudgeAlert,
    makeTicTacToeMove,
    lastTicTacToeMove,
    makePenFlick,
    lastPenFlick,
    applyPenState,
    sendZeroCrossAction,
    surrenderZeroCross,
    cancelZeroCross,
    chooseZeroCrossDuration,
    zeroCrossDuration,
    zeroCrossOffset,
    zeroCrossRejected,
    sendRpsChoose,
    sendRpsLock,
    cancelRps,
    chooseRpsFormat,
    rpsMyPick,
    rpsFormat,
    rematch,
    rematchStatus,
    declineRematch,
    rematchDeclined,
    clearRematchDeclined,
    chatMessages,
    typingUsers,
    floatingReactions,
    sendChat,
    sendReaction,
    sendNudge,
    sendLeave,
    sendTyping,
    isSpectator,
    spectatorCount,
    spectators,
    rematchUnavailable,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomParam || null, undefined, { spectate: spectateMode });

  // If the room joined belongs to a different game type, redirect to the appropriate game page
  useEffect(() => {
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      if (!code.startsWith('TIC-') && (code.startsWith('BINGO-') || code.startsWith('LUDO-') || code.startsWith('FOUR-') || code.startsWith('DOODLE-'))) {
        router.replace(getGameRoute(undefined, roomParam));
        return;
      }
    }
    if (room?.gameType && room.gameType !== GAME_ID && room?.roomCode) {
      router.replace(getGameRoute(room.gameType, room.roomCode));
    }
  }, [roomParam, room?.gameType, room?.roomCode, router]);

  const effectiveUserId = myUserId || session?.user?.id || '';

  // Active players
  const hostPlayer = useMemo(() => {
    if (!room) return null;
    return room.players.find(p => p.seat === 0) || null;
  }, [room]);

  const guestPlayer = useMemo(() => {
    if (!room) return null;
    return room.players.find(p => p.seat === 1) || null;
  }, [room]);

  const opponentPlayer = useMemo(() => {
    if (!room || isSpectator) return null;
    return room.players.find(p => p.userId !== effectiveUserId) || null;
  }, [room, effectiveUserId]);

  const opponentGone = !isSpectator && (!!opponentLeftWin || !opponentPlayer || opponentPlayer.status === 'LEFT');
  const turnPlayer = room?.players.find(p => p.seat === gameState?.currentTurnSeat) || null;
  const winnerPlayer = gameState?.winner ? room?.players.find(p => p.seat === (gameState.winner === 'X' ? 0 : 1)) || null : null;
  const spectatorStatus = gameState?.winner
    ? `${winnerPlayer?.displayName || gameState.winner} won`
    : gameState?.isDraw
      ? 'Draw'
      : turnPlayer
        ? `${turnPlayer.displayName} to move`
        : null;
  const showNewGame = !isSpectator && (opponentGone || rematchUnavailable);
  const opponentOffline = !opponentGone && opponentPlayer?.isConnected === false;
  const socketReady = connectionStatus === 'CONNECTED';

  // Auto-scroll chat to newest message unless the user scrolled up (TT-17)
  useEffect(() => {
    if (isUserScrolledUpRef.current) return;
    chatBottomRef.current?.scrollIntoView({ block: 'end' });
    chatBottomMobileRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages.length]);

  // Show server move rejections (game:error) briefly (TT-14)
  useEffect(() => {
    if (!gameError) return;
    const t = setTimeout(() => clearGameError(), 3500);
    return () => clearTimeout(t);
  }, [gameError, clearGameError]);

  const isWaiting = room?.status === 'WAITING';
  const isPlayingOrFinished = room?.status === 'PLAYING' || room?.status === 'FINISHED';

  useEffect(() => {
    if (isPlayingOrFinished && (gameState?.winner || gameState?.isDraw)) {
      setShowPartyPoppers(true);
      const timer = setTimeout(() => {
        setShowDelayedWinModal(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowPartyPoppers(false);
      setShowDelayedWinModal(false);
      setDismissVictoryModal(false);
    }
  }, [isPlayingOrFinished, gameState?.winner, gameState?.isDraw]);

  // WebRTC Video/Voice
  const webRTCMembers = useMemo(() => {
    return (room?.players || []).map(p => ({
      id: p.userId,
      name: p.displayName,
      role: 'member',
      isConnected: p.isConnected !== false,
      joinedAt: ''
    }));
  }, [room?.players]);

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

  // Draggable Floating Video Call Window State (starts closed on mobile, opens on desktop)
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(true);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) {
        setIsChatOpen(true);
        setIsPipClosed(false);
        if (pipPosition === null) {
          setPipPosition({ x: 32, y: 205 });
        }
      } else {
        // Mobile (< 1024px): Both chat and call window start closed by default
        setIsChatOpen(false);
        setIsPipClosed(true);
        if (pipPosition === null) {
          setPipPosition({ x: 16, y: Math.max(120, window.innerHeight - 170) });
        }
      }
    }
  }, []);

  const handlePipDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = pipRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : 32;
    const currentY = rect ? rect.top : 205;

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

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const newX = Math.max(8, Math.min(window.innerWidth - 180, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(64, Math.min(window.innerHeight - 80, dragStartRef.current.initialY + deltaY));

      setPipPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDraggingPip(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDraggingPip]);

  // Unified call participants: always ensures all room players have a video slot even before/during WebRTC negotiation
  const callParticipants = useMemo(() => {
    const list = [...videoGridParticipants];
    if (opponentPlayer && !list.some(p => p.userId === opponentPlayer.userId)) {
      list.push({
        userId: opponentPlayer.userId,
        displayName: opponentPlayer.displayName,
        stream: null,
        isMuted: true,
        isSelf: false,
        isCameraOn: false
      });
    }
    return list;
  }, [videoGridParticipants, opponentPlayer]);

  const hostStream = useMemo(() => {
    if (!hostPlayer) return null;
    return callParticipants.find(p => p.userId === hostPlayer.userId) || null;
  }, [hostPlayer, callParticipants]);

  const guestStream = useMemo(() => {
    if (!guestPlayer) return null;
    return callParticipants.find(p => p.userId === guestPlayer.userId) || null;
  }, [guestPlayer, callParticipants]);

  // Streak recording on game start
  useEffect(() => {
    if (room?.status === 'PLAYING' && opponentPlayer?.userId && session?.token) {
      const todayKey = `${opponentPlayer.userId}_${new Date().toISOString().split('T')[0]}`;
      if (streakRecordedPairRef.current === todayKey) return;
      streakRecordedPairRef.current = todayKey;

      recordFriendStreak(session.token, opponentPlayer.userId, 1)
        .then((res) => {
          if (res.success && (res.status === 'EXTENDED' || res.status === 'RESET_STARTED')) {
            setStreakCelebration({
              friendName: opponentPlayer.displayName || 'Friend',
              streakCount: res.streak.currentStreak,
              isExtended: res.status === 'EXTENDED'
            });
          }
        })
        .catch(() => {});
    }
  }, [room?.status, opponentPlayer, session]);

  // Reset victory dismiss on new game
  useEffect(() => {
    if (room?.status === 'PLAYING') {
      setDismissVictoryModal(false);
    }
  }, [room?.status, gameState?.moveCount]);

  // Initialize Session & Partner
  useEffect(() => {
    async function init() {
      let s = getStoredSession();
      if (!s) {
        s = await ensureSession();
      }
      setSession(s);

      if (s?.token) {
        try {
          const me = await getUserMe(s.token);
          if (me?.user?.partnerCode) {
            setMyPartnerCode(me.user.partnerCode);
          }
        } catch {}

        try {
          const p = await getUserPartner(s.token);
          if (p?.partner) setPartner(p.partner);
        } catch {}
      }
    }
    void init();
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!session?.token) return;
    const interval = setInterval(() => {
      sendHeartbeat(session.token).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [session?.token]);

  // Web Audio Synthesizer Functions
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const triggerSound = useCallback((type: 'click' | 'mark' | 'win' | 'draw' | 'ping') => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'ping') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const playMarkSound = useCallback((mark: 'X' | 'O') => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (mark === 'X') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.1);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const playWinFanfare = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const start = ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start + idx * 0.1);
        gain.gain.setValueAtTime(0.25, start + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, start + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start + idx * 0.1);
        osc.stop(start + idx * 0.1 + 0.35);
      });
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const playDrawChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.3);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }, [soundEnabled, getAudioContext]);

  // Sound triggers on game events. Sound callbacks live in a ref so toggling sound never re-runs the
  // result accounting (TT-4); results are counted once per finished game via countedResultRef.
  const prevMoveCountRef = useRef<number>(0);
  const countedResultRef = useRef<string | null>(null);
  const soundFnsRef = useRef({ playMarkSound, playWinFanfare, playDrawChime });
  useEffect(() => {
    soundFnsRef.current = { playMarkSound, playWinFanfare, playDrawChime };
  }, [playMarkSound, playWinFanfare, playDrawChime]);
  useEffect(() => {
    if (!gameState) {
      prevMoveCountRef.current = 0;
      countedResultRef.current = null;
      return;
    }

    const moveCount = typeof gameState.moveCount === 'number' ? gameState.moveCount : 0;
    // New game (rematch) restarts moveCount at 0: re-sync so mark sounds keep playing (TT-16)
    if (moveCount < prevMoveCountRef.current) prevMoveCountRef.current = moveCount;
    if (moveCount > prevMoveCountRef.current) {
      const lastMark = lastTicTacToeMove?.mark || (gameState.currentTurnMark === 'X' ? 'O' : 'X');
      soundFnsRef.current.playMarkSound(lastMark);
      prevMoveCountRef.current = moveCount;
    }

    if (!gameState.winner && !gameState.isDraw) {
      countedResultRef.current = null;
      return;
    }
    const resultKey = `${gameState.winner || 'draw'}:${moveCount}`;
    if (countedResultRef.current === resultKey) return;
    countedResultRef.current = resultKey;
    if (gameState.winner) {
      soundFnsRef.current.playWinFanfare();
      setScores(prev => {
        if (gameState.winner === 'X') return { ...prev, xWins: prev.xWins + 1 };
        if (gameState.winner === 'O') return { ...prev, oWins: prev.oWins + 1 };
        return prev;
      });
    } else {
      soundFnsRef.current.playDrawChime();
      setScores(prev => ({ ...prev, draws: prev.draws + 1 }));
    }
  }, [gameState, lastTicTacToeMove]);

  const handleNudgeOpponent = useCallback(() => {
    const opp = players.find(p => p.userId !== myUserId);
    if (!opp) return;
    const roast = getRandomRoast();
    const roastText = typeof roast === 'string' ? roast : (roast as any).body || String(roast);
    sendNudge(opp.userId, roastText);
    setNudgeFeedback(roastText);
    setTimeout(() => setNudgeFeedback(null), 3500);
  }, [players, myUserId, sendNudge]);

  // Room Creation / Joining Handlers
  const handleCreateRoom = async (isPrivate: boolean) => {
    try {
      let currentToken = session?.token;
      if (!currentToken) {
        const ensured = await ensureSession();
        setSession(ensured);
        currentToken = ensured.token;
      }
      setIsCreatingRoom(true);
      setLobbyError(null);
      const res = await createGameRoom(currentToken, GAME_ID, 2, isPrivate);
      if (res?.room?.roomCode) {
        setShowCreateModal(false);
        router.push(`${GAME_ROUTE}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to create room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinByCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    try {
      let currentToken = session?.token;
      if (!currentToken) {
        const ensured = await ensureSession();
        setSession(ensured);
        currentToken = ensured.token;
      }
      setIsJoiningRoom(true);
      setJoinCodeError(null);
      setLobbyError(null);
      const res = await joinGameRoom(currentToken, trimmed);
      if (res?.room?.roomCode) {
        setShowJoinModal(false);
        router.push(`${GAME_ROUTE}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setJoinCodeError(err.message || 'Room not found or full');
      setLobbyError(err.message || 'Room not found or full');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handlePlayWithPartner = async () => {
    if (!partner || !session?.token) return;
    try {
      setIsCreatingRoom(true);
      const res = await playWithPartner(session.token, GAME_ID, partner.id);
      if (res?.room?.roomCode) {
        router.push(`${GAME_ROUTE}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to challenge partner');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handlePingPartner = async () => {
    if (!partner || !session?.token || isPingingPartner) return;
    try {
      setIsPingingPartner(true);
      triggerSound('ping');
      const roast = getRandomRoast('game');
      const roastText = typeof roast === 'string' ? roast : (roast as any)?.body || `Ready to play ${GAME_NAME}?`;
      await pingPartner({
        targetCode: partner.partnerCode,
        fromCode: myPartnerCode,
        fromName: session?.user?.displayName || 'Partner',
        roomCode: room?.roomCode || undefined,
        gameType: GAME_ID,
        customMessage: roastText
      });
      setPartnerPingStatus(`Ping sent to ${partner.displayName}!`);
      setTimeout(() => setPartnerPingStatus(null), 4000);
    } catch {
      setPartnerPingStatus('Could not reach partner right now.');
      setTimeout(() => setPartnerPingStatus(null), 3000);
    } finally {
      setIsPingingPartner(false);
    }
  };

  const handleConnectPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInputCode.trim() || !session?.token) return;
    try {
      setIsConnectingPartner(true);
      setPartnerConnectError(null);
      const res = await connectUserPartner(session.token, partnerInputCode.trim().toUpperCase());
      if (res?.partner) {
        setPartner(res.partner);
        setShowPartnerConnectInput(false);
        setPartnerInputCode('');
      } else if (partnerRequestNotice(res)) {
        setPartnerConnectError(partnerRequestNotice(res));
        setPartnerInputCode('');
      }
    } catch (err: any) {
      setPartnerConnectError(err.message || 'Failed to link with partner');
    } finally {
      setIsConnectingPartner(false);
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
    setIsFriendDrawerOpen(false);
  };

  const handlePlayWithFriendFromDrawer = async (friend: FriendWithStreak) => {
    try {
      let currentToken = session?.token;
      if (!currentToken) {
        const ensured = await ensureSession();
        setSession(ensured);
        currentToken = ensured.token;
      }
      setIsCreatingRoom(true);
      const res = await createGameRoom(currentToken, GAME_ID, 2, true);
      if (res?.room?.roomCode) {
        await invitePartnerToGame(currentToken, friend.friendUser.partnerCode, res.room.roomCode, GAME_ID);
        setIsFriendDrawerOpen(false);
        router.push(`${GAME_ROUTE}?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to challenge friend');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCopyRoomCode = () => {
    if (!room?.roomCode) return;
    void navigator.clipboard.writeText(room.roomCode);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleCopyRoomLink = () => {
    if (!room?.roomCode) return;
    const link = `${window.location.origin}${GAME_ROUTE}?room=${room.roomCode}`;
    void navigator.clipboard.writeText(link);
    setCopiedRoomLink(true);
    setTimeout(() => setCopiedRoomLink(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim(), replyingTo);
    setChatInput('');
    setReplyingTo(null);
  };

  const currentTheme = useMemo(() => {
    return THEMES.find(t => t.id === activeTheme) || THEMES[0];
  }, [activeTheme]);

  // Current mark for player
  const myMark = myPlayer?.seat === 0 ? 'X' : myPlayer?.seat === 1 ? 'O' : null;

  // Board winning line positions (SVG line coordinates for 3x3)
  const winningLineCoords = useMemo(() => {
    if (!gameState?.winningLine || !Array.isArray(gameState.winningLine) || gameState.winningLine.length < 3) return null;
    const [a, b, c] = gameState.winningLine;

    const getPos = (idx: number) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      return {
        x: col === 0 ? 16.66 : col === 1 ? 50 : 83.33,
        y: row === 0 ? 16.66 : row === 1 ? 50 : 83.33
      };
    };

    const p1 = getPos(a);
    const p3 = getPos(c);
    return { x1: `${p1.x}%`, y1: `${p1.y}%`, x2: `${p3.x}%`, y2: `${p3.y}%` };
  }, [gameState?.winningLine]);

  // Unified Waiting Room Screen
  if (roomParam && isWaiting && room) {
    return (
      <UnifiedGameWaitingRoom
        gameType={GAME_ID}
        room={room}
        myUserId={session?.user?.id || ''}
        gameState={gameState}
        chatMessages={chatMessages}
        isMicMuted={isMicMuted}
        isCameraOn={isCameraOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onSendChat={sendChat}
        onSendReaction={sendReaction}
        onStartGame={() => {}}
        lobbyExtra={isZero ? (
          <div className="relative w-full rounded-2xl p-3 bg-white/70 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 space-y-2" aria-label="Match length">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">Match length</h3>
              <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                {room.hostUserId === effectiveUserId ? 'You choose' : 'The host chooses'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Match length">
              {DURATION_CHOICES.map((d) => {
                const on = zeroCrossDuration === d.seconds;
                const canPick = room.hostUserId === effectiveUserId;
                return (
                  <button
                    key={String(d.seconds)}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!canPick && !on}
                    onClick={() => canPick && chooseZeroCrossDuration(d.seconds)}
                    className={`py-2 px-2 rounded-xl border text-left transition ${on ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-md' : 'bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200'} ${canPick ? 'cursor-pointer hover:border-[#ff2b70]/60' : 'cursor-default opacity-80'}`}
                  >
                    <span className="block text-xs font-black">{d.label}</span>
                    <span className={`block text-[10px] ${on ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'}`}>{d.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : isRps ? (
          <div className="relative w-full rounded-2xl p-3 bg-white/70 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 space-y-2" aria-label="Match format">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">Match format</h3>
              <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">{room.hostUserId === effectiveUserId ? 'You choose' : 'The host chooses'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Match format">
              {FORMAT_CHOICES.map((f) => {
                const on = rpsFormat === f.id;
                const canPick = room.hostUserId === effectiveUserId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!canPick && !on}
                    onClick={() => canPick && chooseRpsFormat(f.id)}
                    className={`py-2 px-1.5 rounded-xl border text-center transition ${on ? 'bg-[#ff2b70] border-[#ff2b70] text-white shadow-md' : 'bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200'} ${canPick ? 'cursor-pointer hover:border-[#ff2b70]/60' : 'cursor-default opacity-80'}`}
                  >
                    <span className="block text-xs font-black">{f.label}</span>
                    <span className={`block text-[10px] ${on ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'}`}>{f.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : undefined}
        onLeave={() => {
          sendLeave();
          router.push(GAME_ROUTE);
        }}
      />
    );
  }

  return (
    <div className={`flex w-full min-h-screen transition-colors duration-200 relative ${
      roomParam ? 'bg-[#0c0a14] text-white' : (isDark ? 'bg-[#0c0d12] text-white' : 'bg-white text-zinc-900')
    }`}>
      {/* Full-screen atmospheric background wallpaper for in-game and waiting room */}
      {roomParam && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat select-none pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url('${currentTheme.bgUrl || '/images/cozy_ludo_bg.jpg'}')` }}
        >
          {/* Ambient overlay: dark semi-translucent backdrop filter so text and game elements pop with gorgeous contrast */}
          <div className={`absolute inset-0 ${isDark ? 'bg-black/60 backdrop-blur-[1.5px]' : 'bg-black/45 backdrop-blur-[1px]'}`} />
          {/* Radial ambient glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Background Ambience / Effects */}
      {roomParam && <DynamicThemeEffects themeId={activeTheme} />}

      {/* Rematch Request Popup from Opponent */}
      {rematchStatus && !rematchStatus.allVoted && !rematchStatus.votedUserIds?.includes(effectiveUserId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 bg-[#161220]/95 border border-rose-500/40 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(244,63,94,0.25)] text-center space-y-4 relative">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-rose-500/30 animate-bounce">
              <AppIcon name="swords" className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">Rematch Challenge!</h3>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                <strong className="text-[#ff3864] font-bold">{rematchStatus.requesterName || opponentPlayer?.displayName || 'Your Opponent'}</strong> has requested a rematch!
                <br />
                Do you want to play again?
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  rematch();
                  setDismissVictoryModal(true);
                }}
                className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Accept Rematch (Yes!)</span>
              </button>
              <button
                type="button"
                onClick={declineRematch}
                className="w-full py-2 sm:py-2.5 px-4 bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-zinc-300 rounded-xl transition cursor-pointer"
              >
                Decline (No)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rematch Waiting Modal for the player who requested */}
      {rematchStatus && !rematchStatus.allVoted && rematchStatus.votedUserIds?.includes(effectiveUserId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 bg-[#161220]/95 border border-white/20 text-white shadow-2xl text-center space-y-4 relative">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-2xl sm:text-3xl animate-pulse">
              <AppIcon name="clock" className="w-7 h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white">Rematch Requested</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Waiting for <strong className="text-rose-400 font-bold">{opponentPlayer?.displayName || 'Opponent'}</strong> to accept the rematch...
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={declineRematch}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-zinc-300 transition cursor-pointer"
              >
                Cancel Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rematch Agreed (Starting) Modal */}
      {rematchStatus?.allVoted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 bg-[#161220]/95 border border-emerald-500/30 text-white shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl sm:text-3xl animate-spin">
              <AppIcon name="refresh" className="w-7 h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white">Rematch Accepted!</h3>
            <p className="text-xs text-emerald-300">
              Both players agreed! Starting new match now...
            </p>
          </div>
        </div>
      )}

      {/* Rematch Declined / Opponent Left Modal */}
      {rematchDeclined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 bg-[#161220]/95 border border-white/20 text-white shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-2xl sm:text-3xl">
              <AppIcon name="share" className="w-7 h-7 -scale-x-100" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white">Rematch Declined</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {rematchDeclined.message || 'Opponent declined the rematch or left the game.'}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  clearRematchDeclined();
                  router.push('/games');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
              >
                Games Hub
              </button>
              <button
                type="button"
                onClick={clearRematchDeclined}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff2b5e] hover:bg-rose-600 text-xs font-bold text-white transition cursor-pointer"
              >
                Stay on Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Left Match Instant Win Modal */}
      {opponentLeftWin && (
        <AlertModal
          isOpen={!!opponentLeftWin}
          onClose={clearOpponentLeftWin}
          title="YOU WON THE MATCH!"
          message={
            <div className="space-y-2 text-center">
              <p className="font-bold text-white text-base">
                {opponentLeftWin.opponentDisplayName} has left the game.
              </p>
              <p className="text-rose-200/90 text-sm">
                You are the winner by default!
              </p>
            </div>
          }
          type="success"
          confirmText="Back to Lounge"
          cancelText="Stay on Board"
          onConfirm={() => router.push('/dashboard?tab=games')}
        />
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

      {/* Snapchat-Style Friend Streak Celebration Modal */}
      {streakCelebration && (
        <StreakCelebrationModal
          isOpen={!!streakCelebration}
          onClose={() => setStreakCelebration(null)}
          friendName={streakCelebration.friendName}
          streakCount={streakCelebration.streakCount}
          isExtended={streakCelebration.isExtended}
        />
      )}

      {/* Game Friend / Opponent Selector Drawer */}
      <GameFriendSelectorDrawer
        isOpen={isFriendDrawerOpen}
        onClose={() => setIsFriendDrawerOpen(false)}
        token={session?.token}
        currentPartnerId={partner?.id}
        currentPartnerCode={partner?.partnerCode}
        gameTitle={GAME_NAME}
        onSelectFriend={handleSelectFriendFromDrawer}
        onPlayWithFriend={handlePlayWithFriendFromDrawer}
        onOpenAddFriend={() => setIsAddFriendModalOpen(true)}
      />

      {/* Add Friend Modal */}
      {session?.token && isAddFriendModalOpen && (
        <AddFriendModal
          isOpen={isAddFriendModalOpen}
          onClose={() => setIsAddFriendModalOpen(false)}
          myFriendCode={myPartnerCode}
          token={session.token}
          onFriendAdded={(newFriend) => {
            handleSelectFriendFromDrawer(newFriend);
          }}
        />
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-base sm:text-lg">Create a Room</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Create a custom 1v1 {GAME_NAME} arena. Share the generated code with your partner or friend to play.
            </p>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none pt-1">
              <input
                type="checkbox"
                checked={createIsPrivate}
                onChange={(e) => setCreateIsPrivate(e.target.checked)}
                className="rounded border-zinc-600 text-rose-500 focus:ring-rose-500 h-4 w-4 bg-black/40"
              />
              <span>Private Room (Requires link or code to join)</span>
            </label>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateRoom(createIsPrivate)}
                disabled={isCreatingRoom}
                className="flex-1 py-2.5 rounded-xl bg-[#ed1c46] hover:bg-[#d6143c] text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <span>{isCreatingRoom ? 'Creating...' : 'Create Room'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6 bg-[#121626] border border-white/20 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base sm:text-lg">Join a Room</h3>
              </div>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinCodeError(null);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Enter the room code shared by your friend to join the match instantly.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleJoinByCode(joinCodeInput);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value.toUpperCase());
                  setJoinCodeError(null);
                }}
                placeholder="ROOM CODE (e.g. AB12CD)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white placeholder-zinc-500 font-mono text-center tracking-widest text-sm focus:outline-none focus:border-blue-400"
                maxLength={10}
                autoFocus
              />

              {joinCodeError && (
                <p className="text-xs text-rose-400 font-medium text-center">{joinCodeError}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinCodeError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoiningRoom || !joinCodeInput.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#185df2] hover:bg-[#144ecc] text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  <span>{isJoiningRoom ? 'Joining...' : 'Join Room'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base sm:text-lg">{GAME_NAME} Rules</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {isRps ? (
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">The rules</span>
                Rock beats scissors, scissors beats paper, paper beats rock. The same choice is a draw.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Secret picks</span>
                After the countdown, pick one and lock it within 10 seconds. Nobody can see your choice until both are locked: then both are revealed together. If you do not lock in time, a player who did lock wins the round.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Match formats</span>
                A single round, best of 3 (first to 2 wins) or best of 5 (first to 3). Draws do not count.
              </div>
            </div>
            ) : isZero ? (
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Objective</span>
                Line up your 3 pieces in a row, column or diagonal. Each player has exactly 3 pieces: Cross (✕) or Zero (◯).
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Place, then move</span>
                First you take turns placing your 3 pieces. When all 6 are down, you take turns moving one of your pieces to any empty square. The same pieces keep moving, none disappear.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Clock and surrender</span>
                The match clock runs on the server. If time runs out with no line of three, it is a draw. You can surrender at any time; it counts as a loss.
              </div>
            </div>
            ) : isPen ? (
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Objective</span>
                Slide the other pen past the edge of the desk to win the round. The first player to win 3 rounds wins the Pen Fight.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">How to flick</span>
                On your turn, drag back anywhere on the desk (like a catapult) to aim and set the power, then let go. The longer you pull, the harder the flick.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Careful!</span>
                Flick too hard and your own pen can slide off the desk, which gives the round to your rival. After 6 flicks each with no knock-out, the pen nearer the middle of the desk wins the round.
              </div>
            </div>
            ) : (
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Objective</span>
                Place 3 of your marks (✕ or ◯) in a horizontal, vertical, or diagonal row before your opponent does.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Turns</span>
                Host starts as ✕ (Red). Guest plays as ◯ (Blue). Players alternate one turn at a time.
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white block mb-1">Draw / Tie</span>
                If all 9 cells are occupied with no 3-in-a-row alignment, the duel ends in a Draw.
              </div>
            </div>
            )}

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
            >
              Got it! Let's Play
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[calc(100vw-2rem)] max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-3xl p-5 sm:p-6 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-zinc-300" />
                <h3 className="font-bold text-base sm:text-lg">Game Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Audio SFX Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <span className="font-bold text-white block">Sound Effects</span>
                  <span className="text-zinc-400 text-[11px]">Play audio chimes on drops and moves</span>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                    soundEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {soundEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Theme Selector */}
              <div>
                <span className="font-bold text-white block mb-2">Arena Ambience</span>
                <div className="grid grid-cols-2 gap-2">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setActiveTheme(theme.id)}
                      className={`p-2 rounded-xl text-left border transition text-xs cursor-pointer ${
                        activeTheme === theme.id
                          ? 'border-rose-500 bg-rose-500/20 text-white font-bold'
                          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partner code link */}
              {myPartnerCode && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="font-bold text-white block mb-1">Your Partner Code</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-rose-300">{myPartnerCode}</span>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(myPartnerCode);
                        setCopiedPartnerCode(true);
                        setTimeout(() => setCopiedPartnerCode(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-medium cursor-pointer"
                    >
                      {copiedPartnerCode ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                </div>
              )}

              {/* Room Code (convenient for mobile users) */}
              {roomParam && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="font-bold text-white block mb-1">Room Code</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-rose-300">{roomParam}</span>
                    <button
                      onClick={handleCopyRoomCode}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition cursor-pointer"
                    >
                      {copiedRoomCode ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 1. Grand Party Poppers Celebration (Fires Immediately inside Game) */}
      {showPartyPoppers && <PartyPoppers />}

      {/* Victory / Game Over Celebration Modal (Appears After 3s Delay) */}
      {(isZero || isRps) && (confirmSurrender || confirmCancel) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="zc-confirm-title">
          <div className="w-[calc(100vw-2rem)] max-w-sm rounded-3xl p-5 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-3">
            <h3 id="zc-confirm-title" className="text-lg font-black">{confirmSurrender ? 'Surrender this match?' : 'Cancel this match?'}</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {confirmSurrender
                ? 'Surrendering ends the match right now and counts as a loss. Your opponent wins.'
                : 'This ends the match for both players with no winner.'}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => { setConfirmSurrender(false); setConfirmCancel(false); }}
                className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
              >
                Keep playing
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmSurrender) surrenderZeroCross();
                  else if (isRps) cancelRps();
                  else cancelZeroCross();
                  setConfirmSurrender(false);
                  setConfirmCancel(false);
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black cursor-pointer"
              >
                {confirmSurrender ? 'Yes, surrender' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPlayingOrFinished && (gameState?.winner || gameState?.isDraw) && showDelayedWinModal && !dismissVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-[calc(100vw-2rem)] max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 bg-[#161220]/95 border border-white/25 text-white shadow-2xl text-center space-y-4 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/25 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={() => setDismissVictoryModal(true)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Close modal and view board"
            >
              <CloseIcon className="w-4 h-4" />
            </button>

            {isRps && gameState?.status ? (() => {
              const iWon = !isSpectator && !!gameState.winner && gameState.winner === myMark;
              const title = gameState.status === 'cancelled' ? 'MATCH CANCELLED' : gameState.winner ? (isSpectator ? `${winnerPlayer?.displayName || 'A player'} WON!` : iWon ? 'VICTORY!' : 'OPPONENT WON!') : 'MATCH DRAW!';
              return (
                <>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-2xl ${iWon ? 'bg-gradient-to-tr from-amber-500 to-yellow-300' : 'bg-white/10 border border-white/20'}`}>
                    <AppIcon name={gameState.winner ? 'trophy' : 'handshake'} className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">{title}</h3>
                  <p className="text-xs text-zinc-300">{gameState.statusMessage}</p>
                  <div className="flex items-center justify-center gap-3 text-2xl font-black tabular-nums" aria-label="Final score">
                    <span className="text-rose-300">{gameState.scores?.[0] ?? 0}</span><span className="text-zinc-500 text-base">-</span><span className="text-cyan-300">{gameState.scores?.[1] ?? 0}</span>
                  </div>
                </>
              );
            })() : isZero && gameState?.status && gameState.status !== 'active' ? (() => {
              const res = resultText(gameState, markOfSeat(myPlayer ? myPlayer.seat : null), { X: hostPlayer?.displayName || 'Cross', O: guestPlayer?.displayName || 'Zero' });
              const won = gameState.winner && !isSpectator && gameState.winner === myMark;
              return (
                <>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-2xl ${won ? 'bg-gradient-to-tr from-amber-500 to-yellow-300' : 'bg-white/10 border border-white/20'}`}>
                    <AppIcon name={gameState.winner ? 'trophy' : 'handshake'} className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">{res.title}</h3>
                  <p className="text-xs text-zinc-300">{res.detail}</p>
                  {/* the final board, small, so the result is clear even after the board is dismissed */}
                  <div className="mx-auto grid grid-cols-3 gap-1 w-24" aria-label="Final board">
                    {gameState.board.map((c: string | null, i: number) => (
                      <span key={i} className={`aspect-square rounded-md flex items-center justify-center text-[11px] font-black ${gameState.winningLine?.includes(i) ? 'bg-amber-400/30 border border-amber-300' : 'bg-white/5 border border-white/10'} ${c === 'X' ? 'text-rose-300' : 'text-cyan-300'}`}>{c === 'X' ? '✕' : c === 'O' ? '◯' : ''}</span>
                    ))}
                  </div>
                </>
              );
            })() : gameState?.winner ? (
              <>
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-amber-500/30 animate-bounce">
                  <AppIcon name="trophy" className="w-7 h-7" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {isSpectator ? `${winnerPlayer?.displayName || gameState.winner} WON!` : gameState.winner === myMark ? 'VICTORY!' : 'OPPONENT WON!'}
                </h3>
                <p className="text-xs text-zinc-300">
                  {isSpectator
                    ? 'Three in a row. Well played!'
                    : gameState.winner === myMark
                    ? 'Outstanding strategy! You aligned three marks in a row.'
                    : 'Good try! Practice makes perfect duels.'}
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-2xl sm:text-3xl">
                  <AppIcon name="handshake" className="w-7 h-7" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">STALEMATE DRAW!</h3>
                <p className="text-xs text-zinc-300">
                  All 9 cells placed with no victor. A perfectly balanced match!
                </p>
              </>
            )}

            {/* Action Buttons: Rematch (Primary) & Roast / Leave (Secondary Row) */}
            <div className="flex flex-col gap-2.5 pt-1">
              {showNewGame ? (
                <NewGameWithOpponent
                  gameType={GAME_ID}
                  opponentUserId={players.find(p => p.userId !== effectiveUserId)?.userId}
                  opponentName={players.find(p => p.userId !== effectiveUserId)?.displayName}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#ff2b5e] via-rose-500 to-[#f43f5e] text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-rose-500/30 transition active:scale-95 cursor-pointer"
                />
              ) : !isSpectator && (
              <button
                type="button"
                onClick={rematch}
                disabled={opponentGone}
                className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-3 px-4 bg-gradient-to-r from-[#ff2b5e] via-rose-500 to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-rose-500/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>
                  {rematchStatus
                    ? `Play Rematch (${rematchStatus.votedCount}/${rematchStatus.totalNeeded})`
                    : 'Play Rematch'}
                </span>
              </button>
              )}

              <div className="grid grid-cols-2 gap-2 w-full">
                {!isSpectator && <button
                  type="button"
                  onClick={handleNudgeOpponent}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 text-rose-300 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span>Roast</span>
                </button>}

                <button
                  type="button"
                  onClick={() => {
                    sendLeave();
                    router.push('/games');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 text-zinc-300 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  <span>Leave Game</span>
                </button>
              </div>
            </div>

            {nudgeFeedback && (
              <p className="text-[11px] text-rose-400 font-mono animate-in fade-in">{nudgeFeedback}</p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CENTRALIZED APPSIDEBAR NAVIGATION (WHEN IN LOBBY)                         */}
      {!roomParam && (
        <AppSidebar
          activeNav="games"
        />
      )}

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col relative min-h-screen overflow-y-auto">
        {/* TOP NAVIGATION HEADER BAR */}
        <header className={`h-14 sm:h-16 px-2 xs:px-3 sm:px-6 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200 gap-1.5 sm:gap-2 ${
          roomParam
            ? 'bg-[#0e0c18]/90 border-white/10 text-white'
            : (isDark ? 'bg-[#14151b]/85 border-white/[0.08]' : 'bg-white/95 border-zinc-200/80 shadow-xs')
        }`}>
          {/* Left: Breadcrumbs or Leave Match */}
          <div className="flex items-center gap-1.5 xs:gap-3 shrink-0">
            {roomParam ? (
              <button
                onClick={() => {
                  showAlert(
                    'Leave Match?',
                    'Are you sure you want to leave this game? You will disconnect from the match and return to the lounge.',
                    'warning',
                    {
                      confirmText: 'Leave Match',
                      cancelText: 'Stay & Play',
                      onConfirm: () => {
                        sendLeave();
                        router.push(GAME_ROUTE);
                      }
                    }
                  );
                }}
                className="h-8 sm:h-9 px-2 sm:px-3.5 rounded-xl border shadow-xs flex items-center justify-center gap-1.5 font-semibold text-xs transition-all active:scale-95 group bg-white/10 hover:bg-white/20 text-white border-white/15 shrink-0 cursor-pointer"
                title="Leave Match"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                <span className="hidden sm:inline">Leave Match</span>
                <span className="hidden xs:inline sm:hidden">Leave</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => router.push('/games')}
                  className={`lg:hidden h-9 px-3 rounded-xl border flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap shrink-0 transition-all active:scale-95 shadow-2xs cursor-pointer ${
                    isDark ? 'bg-white/[0.05] hover:bg-white/10 text-zinc-300 border-white/[0.08]' : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 border-zinc-200'
                  }`}
                  title="Back to Game Lobby"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xs:inline">Game </span>
                  <span>Lobby</span>
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
                  <span className="text-[#ee1d49] font-bold">{GAME_NAME}</span>
                </div>
              </div>
            )}
          </div>

          {/* Center Header: Room Param or Call Pill (hidden on < sm to prevent mobile collision) */}
          {roomParam && (
            <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="px-2.5 sm:px-3 py-1 rounded-full border border-white/15 bg-white/10 flex items-center gap-1.5 sm:gap-2 font-mono text-[11px] sm:text-xs text-white shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Room:</span>
                <strong className="text-white font-bold">{roomParam}</strong>
              </div>
              {isPipClosed && (
                <button
                  onClick={() => setIsPipClosed(false)}
                  className="px-2 sm:px-3 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition shrink-0 cursor-pointer"
                  title="Open Floating Video Call"
                >
                  <Video className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="hidden md:inline">Show Video</span>
                </button>
              )}
            </div>
          )}

          {/* Right: Controls & Theme Toggle */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Audio SFX Toggle (desktop/tablet; also available in Settings modal) */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                triggerSound('click');
              }}
              title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
              className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition items-center justify-center shadow-xs cursor-pointer ${
                roomParam
                  ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                  : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950')
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />}
            </button>

            {/* Microphone Toggle Button */}
            {roomParam && !isSpectator && (
              <button
                onClick={toggleMic}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer ${
                  isMicMuted
                    ? (roomParam ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white/70 hover:text-white' : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-500 hover:text-zinc-800'))
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400 ring-2 ring-emerald-500/20'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
            )}

            {/* Video Call Window Toggle Button */}
            {roomParam && !isSpectator && (
              <button
                onClick={() => setIsPipClosed(!isPipClosed)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer ${
                  !isPipClosed
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-400 ring-2 ring-rose-500/20'
                    : (roomParam ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white/70 hover:text-white' : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-500 hover:text-zinc-800'))
                }`}
                title={!isPipClosed ? 'Hide Video Call' : 'Open Video Call'}
              >
                {!isPipClosed ? <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
            )}

            {/* Chat Drawer Toggle */}
            {roomParam && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer relative ${
                  isChatOpen
                    ? 'bg-rose-600 border-rose-500 text-white'
                    : (roomParam ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white/70 hover:text-white' : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'))
                }`}
                title={isChatOpen ? 'Close Chat' : 'Open Chat'}
              >
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {chatMessages.length > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-black animate-pulse" />
                )}
              </button>
            )}

            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={toggleTheme}
              className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition items-center justify-center shadow-xs cursor-pointer ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-amber-400'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-amber-600'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Rules Modal (?) */}
            <button
              onClick={() => setShowRulesModal(true)}
              className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition items-center justify-center shadow-xs cursor-pointer ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
              }`}
              title={`${GAME_NAME} Rules`}
            >
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Rematch Button - header shortcut only for desktop */}
            {roomParam && isPlayingOrFinished && !isSpectator && !showNewGame && (
              <button
                onClick={() => {
                  triggerSound('click');
                  if (!opponentGone) rematch();
                }}
                className={`hidden md:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition items-center justify-center shadow-xs cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
                }`}
                title="Rematch"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Settings Modal (⚙) */}
            {!isSpectator && <button
              onClick={() => setShowSettingsModal(true)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition flex items-center justify-center shadow-xs cursor-pointer ${
                roomParam
                  ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white/70 hover:text-white'
                  : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950')
              }`}
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>}
          </div>
        </header>

        {/* MOVEABLE FLOATING VIDEO CALL WINDOW */}
        {roomParam && !isPipClosed && !isSpectator && (
          <div
            ref={pipRef}
            onMouseDown={handlePipDragStart}
            onTouchStart={handlePipDragStart}
            style={
              pipPosition
                ? { left: `${pipPosition.x}px`, top: `${pipPosition.y}px` }
                : { left: '32px', top: '205px' }
            }
            className={`fixed z-50 select-none bg-[#190d15]/95 border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-shadow max-w-[calc(100vw-24px)] ${
              isDraggingPip
                ? 'cursor-grabbing ring-2 ring-rose-500/60 shadow-[0_25px_60px_rgba(244,63,94,0.35)] scale-[1.02]'
                : 'cursor-grab hover:border-white/30'
            } ${isPipMinimized ? 'px-3 py-2' : 'p-2 xs:p-2.5 sm:p-3'}`}
          >
            {/* Top Bar: Drag Grip + In-Call Controls */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 pb-2 mb-1.5 border-b border-white/10 touch-none">
              <div className="flex items-center gap-1.5 text-zinc-300 pointer-events-none">
                <GripHorizontal className="w-4 h-4 text-rose-400/80" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  Call ({callParticipants.length}{room ? `/${Math.max(2, room.players.length)}` : ''})
                </span>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleMic();
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

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleCamera();
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

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPipClosed(true);
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Close Floating Call"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Video Call Tiles Grid */}
            {!isPipMinimized && (
              <div className="flex items-center gap-1.5 xs:gap-2 pt-1 overflow-x-auto">
                {callParticipants.map(participant => (
                  <div
                    key={participant.userId}
                    className="relative w-24 xs:w-28 sm:w-34 h-18 sm:h-24 rounded-2xl bg-black/70 border border-white/15 overflow-hidden flex items-center justify-center shadow-inner group shrink-0"
                  >
                    {participant.stream && participant.isCameraOn ? (
                      <VideoAvatar
                        stream={participant.stream}
                        isSelf={participant.isSelf}
                        displayName={participant.displayName}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-1.5 xs:p-2">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-black text-xs flex items-center justify-center mb-1 shadow">
                          {participant.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-zinc-300 font-bold truncate max-w-[70px] xs:max-w-[90px]">
                          {participant.displayName}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-bold text-white/90 drop-shadow pointer-events-none">
                      <span className="truncate max-w-[55px] xs:max-w-[65px]">{participant.displayName}</span>
                      <span className="shrink-0"><span className={`inline-block w-2 h-2 rounded-full ${participant.isMuted ? 'bg-red-500' : 'bg-green-500'}`} /></span>
                    </div>
                  </div>
                ))}

                {callParticipants.length < 2 && (
                  <div className="relative w-24 xs:w-28 sm:w-34 h-18 sm:h-24 rounded-2xl bg-black/45 border border-dashed border-white/20 overflow-hidden flex flex-col items-center justify-center p-1.5 xs:p-2 text-center shadow-inner shrink-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1 text-zinc-400">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-300 animate-pulse" />
                    </div>
                    <span className="text-[10px] text-zinc-200 font-bold leading-tight truncate max-w-[80px]">
                      {opponentPlayer ? opponentPlayer.displayName : 'Waiting for P2'}
                    </span>
                    <span className="text-[9px] text-rose-300/80 font-medium">
                      {opponentPlayer ? (opponentPlayer.isConnected ? 'Connecting...' : 'Offline') : 'Invite friend'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            MAIN VIEW CONTAINER: LOBBY vs WAITING ROOM vs 3-COLUMN IN-GAME ARENA
           ========================================================================= */}
        <main className={`flex-1 w-full flex flex-col justify-start z-10 ${
          roomParam && !isWaiting
            ? 'max-w-[1600px] mx-auto p-2.5 xs:p-3 sm:p-5'
            : (roomParam && isWaiting
                ? 'max-w-none p-0 min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] relative'
                : 'min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] max-w-none p-0 overflow-y-auto')
        }`}>
          {/* -----------------------------------------------------------------------
              SCENARIO 1: LOBBY VIEW (No ?room= parameter)
             ----------------------------------------------------------------------- */}
          {!roomParam && (
            <div className={`w-full min-h-full flex flex-col justify-between relative z-10 select-none px-6 sm:px-10 lg:px-14 py-4 sm:py-6 overflow-y-auto transition-colors duration-200 ${
              isDark ? 'bg-[#0c0d12] text-white' : 'bg-white text-zinc-900'
            }`}>
              {/* Top / Main Hero Container */}
              <div className="w-full flex-1 flex items-center max-w-7xl mx-auto">
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  
                  {/* Left Column: Eyebrow, Title, Subtitle, Connected Partner, Two Action Cards */}
                  <div className="lg:col-span-7 flex flex-col justify-center">
                    
                    {/* Eyebrow */}
                    <div className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-[#f43f5e] uppercase mb-2 sm:mb-3">
                      CONNECT • THREE • WIN
                    </div>

                    {/* Main Hero Heading */}
                    <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-tight mb-3 sm:mb-4">
                      <span className="text-[#ee1d49]">Tic Tac</span>{' '}
                      <span className={isDark ? 'text-white' : 'text-[#131727]'}>Toe</span>
                    </h1>

                    {/* Subtitle */}
                    <p className={`text-xs sm:text-sm lg:text-base font-medium max-w-lg leading-relaxed mb-4 sm:mb-5 ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}>
                      Play real-time {GAME_NAME} with your friends. Simple. Fun.
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
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
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase whitespace-nowrap">
                                  Connected Partner
                                </span>
                                <Heart className="w-3 h-3 text-[#ee1d49] fill-[#ee1d49] shrink-0" />
                                <button
                                  type="button"
                                  onClick={() => setIsFriendDrawerOpen(true)}
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
                                {partner.online ? 'Online & ready to play' : 'Offline • Tap ping to alert'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                            <button
                              type="button"
                              onClick={handlePingPartner}
                              disabled={isPingingPartner}
                              title={`Ping ${partner.displayName || 'partner'}`}
                              className={`p-2.5 rounded-xl border transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 ${
                                isDark
                                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-rose-300'
                                  : 'border-rose-200 bg-white hover:bg-rose-50 text-rose-600'
                              }`}
                            >
                              <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPingingPartner ? 'animate-bounce' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={handlePlayWithPartner}
                              disabled={isCreatingRoom}
                              className="flex-1 sm:flex-initial py-2.5 px-4 sm:px-5 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] hover:shadow-[0_6px_20px_rgba(237,28,70,0.35)] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                              <span>{isCreatingRoom ? 'Starting...' : 'Play Together'}</span>
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
                                  Link codes to play 1-click duels together
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setIsFriendDrawerOpen(true)}
                                className="py-2 px-3 sm:px-4 bg-[#ee1d49] hover:bg-[#d6143c] text-white font-semibold text-xs rounded-xl sm:rounded-2xl shadow-[0_4px_14px_rgba(237,28,70,0.2)] transition flex items-center gap-1.5 cursor-pointer active:scale-95"
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
                                    onClick={() => {
                                      void navigator.clipboard.writeText(myPartnerCode);
                                      setCopiedPartnerCode(true);
                                      triggerSound('click');
                                      setTimeout(() => setCopiedPartnerCode(false), 2000);
                                    }}
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
                          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
                            isDark ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' : 'bg-[#fee1e7] text-[#ee1d49]'
                          }`}>
                            <Users className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                          </div>

                          <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                            isDark ? 'text-white' : 'text-zinc-900'
                          }`}>
                            Create a Room
                          </h3>

                          <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mb-5 sm:mb-6 ${
                            isDark ? 'text-zinc-400' : 'text-zinc-500'
                          }`}>
                            Start a new 1v1 duel and invite your friend.
                          </p>
                        </div>

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
                          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
                            isDark ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' : 'bg-[#dce8fe] text-[#185df2]'
                          }`}>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          </div>

                          <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1.5 ${
                            isDark ? 'text-white' : 'text-zinc-900'
                          }`}>
                            Join a Room
                          </h3>

                          <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mb-5 sm:mb-6 ${
                            isDark ? 'text-zinc-400' : 'text-zinc-500'
                          }`}>
                            Enter a room code to join your friend's game.
                          </p>
                        </div>

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

                  {/* Right Column: 3D Isometric Board Graphic */}
                  <div className="lg:col-span-5 flex items-center justify-center relative">
                    <div className="relative w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[460px] max-h-[50vh] aspect-square flex items-center justify-center">
                      <img
                        src={variant === 'pen-fight' ? '/images/card-pen-fight.png' : variant === 'zero-cross' ? '/images/card-zero-cross.png' : isDark ? "/images/tic-tac-toe-3d-dark.png" : "/images/tic-tac-toe-3d.png"}
                        alt={`${GAME_NAME} 3D Board`}
                        className="max-w-full max-h-full object-contain select-none pointer-events-none transform hover:scale-[1.02] transition-transform duration-300 drop-shadow-2xl"
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

          {/* ROOM VIEW: CONNECTING OR ERROR STATE */}
          {roomParam && !isWaiting && !isPlayingOrFinished && (
            <div className="w-full max-w-md mx-auto my-auto p-8 rounded-3xl bg-black/60 border border-white/20 backdrop-blur-2xl text-center space-y-4 shadow-2xl">
              {roomError ? (
                <>
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <CloseIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Room Error</h3>
                  <p className="text-xs text-rose-200/80">{roomError}</p>
                  <button
                    onClick={() => router.push(GAME_ROUTE)}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
                  >
                    Back to Lobby
                  </button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 mx-auto rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                  <h3 className="text-base font-bold text-white">Connecting to Room...</h3>
                  <p className="text-xs text-zinc-400">Room Code: {roomParam}</p>
                  <button
                    onClick={() => router.push(GAME_ROUTE)}
                    className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------------
              SCENARIO 2: WAITING ROOM SCREEN (roomParam exists & status === 'WAITING')
             ----------------------------------------------------------------------- */}
          {roomParam && isWaiting && (
            <div className="relative w-full h-full min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] flex items-center justify-center p-3.5 sm:p-6 overflow-y-auto">
              <div
                className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat select-none pointer-events-none"
                style={{ backgroundImage: `url('/images/cozy_ludo_bg.jpg')` }}
              >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
              </div>

              {/* Floating Glassmorphic Waiting Card */}
              <div className="relative z-10 w-full max-w-xl my-auto rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 bg-[#0e0c18]/80 border border-white/20 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_35px_rgba(255,43,94,0.12)] text-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Strict Zero-Bots Matchmaking Pill */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[10px] sm:text-[11px] font-semibold tracking-wide mb-3 sm:mb-4 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
                  <span>Strict Zero-Bots Matchmaking</span>
                </div>

                {/* Waiting for Players Heading */}
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
                  Waiting <span className="font-medium text-white/90">for</span> <span className="text-[#ff2b5e]">Players</span>
                </h2>

                {/* Match Subtitle */}
                <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-4 sm:mb-6">
                  Match will begin automatically when <span className="text-[#ff2b5e] font-semibold">2 human players</span> join.
                  <br />
                  No bots will ever be injected.
                </p>

                {/* Room Code Card */}
                <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-3.5 sm:p-4.5 flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-3 mb-4 sm:mb-5 shadow-inner">
                  <div className="text-left min-w-0">
                    <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">
                      ROOM CODE
                    </span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-[#ff2b5e] tracking-wider block mt-0.5 leading-tight">
                      {room.roomCode}
                    </span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                      Share this code with your friend
                    </span>
                  </div>

                  <div className="flex items-center gap-2 justify-end shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyRoomCode}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95 shrink-0"
                      title="Copy Code"
                    >
                      {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyRoomLink}
                      className="py-2.5 px-3.5 sm:px-5 bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(255,43,94,0.4)] transition active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shrink-0"
                    >
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>{copiedRoomLink ? 'Copied!' : 'Share Link'}</span>
                    </button>
                  </div>
                </div>

                {/* Joined Seats Section */}
                <div className="w-full mb-4 sm:mb-5">
                  <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-2.5 sm:mb-3 px-0.5">
                    <span>Joined Seats ({room.players.length}/{room.maxPlayers || 2})</span>
                    <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-normal">
                      <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80 inline-block shrink-0" />
                      <span>{Math.max(0, (room.maxPlayers || 2) - room.players.length)} seat remaining</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    {Array.from({ length: room.maxPlayers || 2 }).map((_, seatIdx) => {
                      const player = room.players.find(p => p.seat === seatIdx);
                      if (player) {
                        return (
                          <div
                            key={seatIdx}
                            className="bg-[#181322]/90 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[105px] sm:min-h-[120px] min-w-0"
                          >
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-white font-black text-base sm:text-lg flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm ${
                              seatIdx === 0
                                ? 'bg-gradient-to-br from-[#ff2b5e] to-[#d6143c]'
                                : 'bg-gradient-to-br from-[#06b6d4] to-[#0284c7]'
                            }`}>
                              {seatIdx === 0 ? '✕' : '◯'}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-white truncate w-full px-1">
                              {player.displayName}
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5 truncate max-w-full">
                              {player.seat === 0 ? (
                                <>
                                  <Crown className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                  <span className="truncate">Host (✕ Red)</span>
                                </>
                              ) : (
                                <>
                                  <User className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-zinc-400 shrink-0" />
                                  <span className="truncate">P2 (◯ Blue)</span>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={seatIdx}
                          className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[105px] sm:min-h-[120px] min-w-0"
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-1.5 sm:mb-2">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                          <span className="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5">Player {seatIdx + 1} (◯ Blue)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Partner Quick-Invite Container */}
                <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-3 sm:p-3.5 flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-2.5 sm:gap-3 shadow-inner">
                  {partner ? (
                    <>
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 text-left">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-xs flex items-center justify-center shrink-0">
                          {(partner.displayName?.[0] || partner.partnerCode?.[0] || 'P').toUpperCase()}
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">
                              Partner: {partner.displayName}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                              <span>{partner.online ? 'Online' : 'Offline'}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block">Code: {partner.partnerCode}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePingPartner}
                        disabled={isPingingPartner}
                        className="py-2 px-3.5 sm:px-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-white" />
                        <span>{isPingingPartner ? 'Inviting...' : 'Invite Partner'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 text-left min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/5 border border-white/10 text-rose-400 flex items-center justify-center shrink-0">
                          <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">Invite your Partner</span>
                          <span className="text-[10px] text-zinc-400 block truncate">Link codes to invite with 1-click</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSettingsModal(true)}
                        className="py-2 px-3.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Connect</span>
                      </button>
                    </>
                  )}
                </div>

                {partnerPingStatus && (
                  <div className="mt-2.5 text-[11px] font-medium text-rose-300 text-center animate-in fade-in">
                    {partnerPingStatus}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------------
              SCENARIO 3: ACTIVE PLAYING / FINISHED MATCH (3-Column Layout)
             ----------------------------------------------------------------------- */}
          {roomParam && isPlayingOrFinished && (
            <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-between gap-4 sm:gap-6 relative">
              {/* Left Column: Floating Room Code Card & Ambient Quotes (Desktop Left, Mobile Below Board) */}
              <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 sm:gap-4 lg:gap-6 order-2 lg:order-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 lg:gap-6 w-full">
                  {/* Floating Room Code Card */}
                  <div className="p-3.5 sm:p-4 rounded-3xl bg-[#1d0c18]/90 border border-rose-500/25 shadow-xl backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-left min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-rose-300/60 font-mono">ROOM CODE</span>
                        <div className="text-lg sm:text-xl font-black text-rose-100 font-mono truncate">{room.roomCode}</div>
                      </div>
                      <button
                        onClick={handleCopyRoomCode}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-300 transition cursor-pointer shrink-0"
                        title="Copy Room Code"
                      >
                        {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 text-[11px] font-medium text-rose-300/80">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>{room.players.length} Players • 1v1 Human Duel</span>
                    </div>
                  </div>

                  {/* Scoreboard Card */}
                  <div className="p-3.5 sm:p-4 rounded-3xl bg-black/40 border border-white/10 shadow-lg backdrop-blur-md">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">SESSION SCOREBOARD</div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                      <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/15 border border-rose-500/30">
                        <span className="text-[11px] sm:text-xs text-rose-300 block font-bold">✕ (X)</span>
                        <span className="text-base sm:text-lg font-black text-white">{scores.xWins}</span>
                      </div>
                      <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30">
                        <span className="text-[11px] sm:text-xs text-cyan-300 block font-bold">◯ (O)</span>
                        <span className="text-base sm:text-lg font-black text-white">{scores.oWins}</span>
                      </div>
                      <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[11px] sm:text-xs text-zinc-400 block font-bold">Draws</span>
                        <span className="text-base sm:text-lg font-black text-white">{scores.draws}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ambient Decorative Slogans (Desktop Only) */}
                <div className="hidden lg:flex flex-col gap-6 px-2 select-none">
                  <div className="text-rose-400/30 font-serif italic text-lg leading-snug drop-shadow">
                    “Good Friends,<br />Great Games,<br />Better Together”
                  </div>

                  <div className="p-3 rounded-2xl bg-black/30 border border-rose-500/15 text-rose-300/40 text-center font-mono text-xs shadow-inner">
                    Same Moves,<br />Different Hearts
                  </div>

                  <div className="text-rose-500/25 font-bold text-sm uppercase tracking-wider">
                    Three in a Row • Win
                  </div>
                </div>
              </div>

              {/* Center Column: 3x3 Board with Flanking Player Video Cards (Order-1 on Mobile!) */}
              <div className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center order-1 lg:order-2">
                {/* Live status: connection, opponent presence, move rejections, nudges, reactions, typing */}
                <div className="w-full max-w-md mb-2 space-y-1.5" aria-live="polite">
                  <TournamentMatchBanner room={room} />
                  {isSpectator && (
                    <SpectatorBanner
                      count={spectatorCount}
                      names={spectators}
                      status={spectatorStatus}
                      onLeave={() => { sendLeave(); router.push('/games'); }}
                    />
                  )}
                  {!socketReady && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[11px] font-semibold text-center">
                      Reconnecting... moves are paused until you are back online.
                    </div>
                  )}
                  {opponentOffline && !gameState?.winner && !gameState?.isDraw && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[11px] font-semibold text-center">
                      {opponentPlayer?.displayName || 'Opponent'} disconnected. Waiting for them to reconnect...
                    </div>
                  )}
                  {opponentGone && !opponentLeftWin && (
                    <div className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-[11px] font-semibold text-center">
                      Your opponent has left the game.
                    </div>
                  )}
                  {gameError && (
                    <div role="alert" className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-[11px] font-semibold text-center">
                      {gameError.message}
                    </div>
                  )}
                  {nudgeAlert && (
                    <div className="px-3 py-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 text-[11px] font-semibold text-center flex items-center justify-between gap-2">
                      <span className="truncate">{nudgeAlert.fromDisplayName}: {nudgeAlert.message || 'Your move!'}</span>
                      <button type="button" onClick={clearNudgeAlert} className="shrink-0 underline cursor-pointer">Dismiss</button>
                    </div>
                  )}
                  {Object.entries(typingUsers).some(([uid]) => uid !== effectiveUserId) && (
                    <div className="text-[10px] text-zinc-400 text-center">
                      {opponentPlayer?.displayName || 'Opponent'} is typing...
                    </div>
                  )}
                  {floatingReactions.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {floatingReactions.slice(-6).map(r => (
                        <span key={r.id} className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-base animate-bounce" title={r.userName}>
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Turn Banner with Active Turn Indicator */}
                <div className="w-full max-w-md mb-2.5 sm:mb-3 flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${gameState?.currentTurnSeat === 0 ? 'bg-rose-500' : 'bg-cyan-400'} animate-pulse shrink-0`} />
                    <span className="text-[11px] sm:text-xs font-black tracking-wide uppercase text-white truncate">
                      {isRps && gameState?.status && !gameState?.winner && !gameState?.isDraw
                        ? `ROUND ${gameState.round} · ${rpsPhaseLabel(gameState)}`
                        : gameState?.winner
                        ? `${gameState.winner === 'X' ? `RED (${MARK_X})` : `BLUE (${MARK_O})`} WON!`
                        : gameState?.isDraw
                        ? 'MATCH DRAW!'
                        : gameState?.currentTurnSeat === 0
                        ? `RED'S ${isPen ? 'FLICK' : 'TURN'} (${MARK_X})`
                        : `BLUE'S ${isPen ? 'FLICK' : 'TURN'} (${MARK_O})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-rose-300 font-bold shrink-0">
                    {isRps ? <span>{gameState?.format === 'single' ? 'SINGLE ROUND' : String(gameState?.format ?? 'best-of-3').toUpperCase().replace(/-/g, ' ')}</span> : isZero ? <ZeroCrossClock state={gameState} clockOffsetMs={zeroCrossOffset} /> : <span>{isPen ? 'FLICK' : 'MOVE'} #{gameState?.moveCount || 0}</span>}
                  </div>
                </div>

                {/* Flanking Player Cards (Host Red on Left, Guest Blue on Right) */}
                <div className="w-full max-w-lg flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 px-0.5">
                  {/* Player 1: Host Red */}
                  <div
                    className={`flex-1 min-w-0 flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-2xl transition-all ${
                      gameState?.currentTurnSeat === 0 && !gameState?.winner && !gameState?.isDraw
                        ? 'bg-rose-500/25 border-2 border-rose-400 shadow-xl shadow-rose-600/30'
                        : 'bg-black/40 border border-white/10 opacity-75'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {gameState?.currentTurnSeat === 0 && !gameState?.winner && !gameState?.isDraw && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-40 pointer-events-none">
                          <svg width="18" height="16" viewBox="0 0 24 22" fill="none">
                            <path d="M 12 21 L 2 4 L 12 7 Z" fill="#eab308" />
                            <path d="M 12 21 L 22 4 L 12 7 Z" fill="#fde047" />
                          </svg>
                        </div>
                      )}
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full p-0.5 border-2 border-rose-400 bg-black/60 flex items-center justify-center overflow-hidden">
                        {hostStream?.stream && hostStream.isCameraOn ? (
                          <VideoAvatar stream={hostStream.stream} isSelf={hostStream.isSelf} displayName={hostPlayer?.displayName || 'Host'} />
                        ) : (hostPlayer?.avatarUrl && !hostPlayer.avatarUrl.includes('bottts')) ? (
                          <img src={hostPlayer.avatarUrl} alt="Host" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white font-black text-xs sm:text-sm">
                            {hostPlayer?.displayName?.[0]?.toUpperCase() || 'R'}
                          </div>
                        )}
                      </div>
                      {hostPlayer && hostPlayer.userId !== effectiveUserId && hostStream?.stream && (
                        <RemoteAudioPlayer stream={hostStream.stream} />
                      )}
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-rose-600 border-2 border-black flex items-center justify-center text-[7px] sm:text-[8px] font-black text-white">
                        {MARK_X}
                      </span>
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[11px] sm:text-xs font-black text-white truncate">
                          {hostPlayer?.displayName || 'Player 1'}
                        </span>
                        {hostPlayer?.userId === effectiveUserId && <span className="text-[9px] text-rose-300 shrink-0">(You)</span>}
                      </div>
                      <span className="text-[10px] text-rose-300/80 font-mono block">Red ({MARK_X})</span>
                    </div>
                  </div>

                  {/* VS Badge */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-rose-600 to-cyan-500 text-white font-black text-[10px] sm:text-xs flex items-center justify-center shadow-lg">
                      VS
                    </div>
                  </div>

                  {/* Player 2: Guest Blue */}
                  <div
                    className={`flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3 p-2 sm:p-3 rounded-2xl transition-all ${
                      gameState?.currentTurnSeat === 1 && !gameState?.winner && !gameState?.isDraw
                        ? 'bg-cyan-500/25 border-2 border-cyan-400 shadow-xl shadow-cyan-600/30'
                        : 'bg-black/40 border border-white/10 opacity-75'
                    }`}
                  >
                    <div className="text-right min-w-0 flex-1">
                      <div className="flex items-center justify-end gap-1 min-w-0">
                        {guestPlayer?.userId === effectiveUserId && <span className="text-[9px] text-cyan-300 shrink-0">(You)</span>}
                        <span className="text-[11px] sm:text-xs font-black text-white truncate">
                          {guestPlayer?.displayName || 'Waiting...'}
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-300/80 font-mono block">Blue ({MARK_O})</span>
                    </div>
                    <div className="relative shrink-0">
                      {gameState?.currentTurnSeat === 1 && !gameState?.winner && !gameState?.isDraw && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-40 pointer-events-none">
                          <svg width="18" height="16" viewBox="0 0 24 22" fill="none">
                            <path d="M 12 21 L 2 4 L 12 7 Z" fill="#eab308" />
                            <path d="M 12 21 L 22 4 L 12 7 Z" fill="#fde047" />
                          </svg>
                        </div>
                      )}
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full p-0.5 border-2 border-cyan-400 bg-black/60 flex items-center justify-center overflow-hidden">
                        {guestStream?.stream && guestStream.isCameraOn ? (
                          <VideoAvatar stream={guestStream.stream} isSelf={guestStream.isSelf} displayName={guestPlayer?.displayName || 'Guest'} />
                        ) : (guestPlayer?.avatarUrl && !guestPlayer.avatarUrl.includes('bottts')) ? (
                          <img src={guestPlayer.avatarUrl} alt="Guest" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-xs sm:text-sm">
                            {guestPlayer?.displayName?.[0]?.toUpperCase() || 'B'}
                          </div>
                        )}
                      </div>
                      {guestPlayer && guestPlayer.userId !== effectiveUserId && guestStream?.stream && (
                        <RemoteAudioPlayer stream={guestStream.stream} />
                      )}
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-cyan-600 border-2 border-black flex items-center justify-center text-[7px] sm:text-[8px] font-black text-white">
                        {MARK_O}
                      </span>
                    </div>
                  </div>
                </div>

                {isRps ? (
                  /* ROCK PAPER SCISSORS ARENA */
                  <RpsBoard
                    state={gameState}
                    mySeat={myPlayer ? myPlayer.seat : null}
                    online={socketReady && !isSpectator}
                    clockOffsetMs={zeroCrossOffset}
                    myPick={rpsMyPick}
                    onChoose={(roundId, choice) => { triggerSound('click'); sendRpsChoose(roundId, choice); }}
                    onLock={(roundId, choice) => { triggerSound('click'); sendRpsLock(roundId, choice); }}
                    names={[hostPlayer?.displayName || 'Red', guestPlayer?.displayName || 'Blue']}
                  />
                ) : isZero ? (
                  /* ZERO CROSS BOARD */
                  <ZeroCrossBoard
                    state={gameState}
                    mySeat={myPlayer ? myPlayer.seat : null}
                    online={socketReady && !isSpectator}
                    clockOffsetMs={zeroCrossOffset}
                    onAct={(action, moveId, baseVersion) => { triggerSound('click'); sendZeroCrossAction(action, moveId, baseVersion); }}
                    rejection={zeroCrossRejected?.reason === 'TIME_UP' ? { id: zeroCrossRejected.id, message: "Time ran out before your move" } : null}
                    names={{ X: hostPlayer?.displayName || 'Cross', O: guestPlayer?.displayName || 'Zero' }}
                  />
                ) : isPen ? (
                  /* PEN FIGHT DESK */
                  <div className="w-full max-w-[560px] sm:max-w-[640px]">
                    <PenFightBoard
                      state={gameState}
                      flick={lastPenFlick}
                      onReplayDone={applyPenState}
                      mySeat={myPlayer ? myPlayer.seat : null}
                      canFlick={Boolean(isMyTurn && socketReady && !gameState?.winner && !gameState?.isDraw && !isSpectator)}
                      onFlick={(angle, power) => { triggerSound('click'); makePenFlick(angle, power); }}
                      names={[hostPlayer?.displayName || 'Red', guestPlayer?.displayName || 'Blue']}
                    />
                  </div>
                ) : null}

                {/* Rock Paper Scissors: the host may cancel a running match (a player who leaves forfeits) */}
                {isRps && gameState?.status && !['match-result', 'cancelled', 'forfeit'].includes(gameState.status) && !isSpectator && room?.hostUserId === effectiveUserId && (
                  <div className="w-full max-w-[460px] mt-3 flex justify-center">
                    <button type="button" onClick={() => setConfirmCancel(true)} className="py-2 px-4 rounded-2xl border border-white/15 text-zinc-300 hover:bg-white/10 text-xs font-semibold transition cursor-pointer">
                      Cancel match
                    </button>
                  </div>
                )}

                {/* Zero Cross: surrender (and the host's cancel) while the match is running */}
                {isZero && gameState?.status === 'active' && !isSpectator && (
                  <div className="w-full max-w-[340px] sm:max-w-[420px] mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmSurrender(true)}
                      className="flex-1 py-2 px-3 rounded-2xl border border-rose-500/60 text-rose-300 hover:bg-rose-500/15 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Surrender
                    </button>
                    {room?.hostUserId === effectiveUserId && (
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(true)}
                        className="py-2 px-3 rounded-2xl border border-white/15 text-zinc-300 hover:bg-white/10 text-xs font-semibold transition cursor-pointer"
                      >
                        Cancel match
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom Controls / Rematch / Reaction Bar */}
                <div className="w-full max-w-[310px] xs:max-w-[350px] sm:max-w-md mt-3 sm:mt-4 flex items-center justify-between gap-2">
                  {(gameState?.winner || gameState?.isDraw) && showNewGame ? (
                    <NewGameWithOpponent
                      gameType={GAME_ID}
                      opponentUserId={players.find(p => p.userId !== effectiveUserId)?.userId}
                      opponentName={players.find(p => p.userId !== effectiveUserId)?.displayName}
                      className="flex-1 py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-500/30 cursor-pointer active:scale-95"
                    />
                  ) : (gameState?.winner || gameState?.isDraw) && isSpectator ? (
                    <div className="flex-1 text-center text-xs text-zinc-300 py-2">Game over. {spectatorStatus}</div>
                  ) : (gameState?.winner || gameState?.isDraw) ? (
                    <button
                      onClick={rematch}
                      disabled={opponentGone}
                      className="disabled:opacity-40 disabled:cursor-not-allowed flex-1 py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        {rematchStatus
                          ? `Rematch (${rematchStatus.votedCount}/${rematchStatus.totalNeeded})`
                          : 'Vote Rematch'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-between xs:justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl bg-[#121420]/80 border border-white/10 backdrop-blur-md overflow-x-auto no-scrollbar">
                      {EMOJI_REACTIONS.slice(0, 5).map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => sendReaction(emoji)}
                          className="p-1 sm:p-1.5 text-base sm:text-lg hover:scale-125 transition transform shrink-0 cursor-pointer"
                          title={`Send ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {!isSpectator && <button
                        onClick={handleNudgeOpponent}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] sm:text-xs text-rose-300 font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer"
                        title="Send Friendly Roast"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Roast</span>
                      </button>}
                    </div>
                  )}
                </div>

              </div>

              {/* Desktop In-Game Chat Column (lg:flex, Order-3) */}
              {isChatOpen && (
                <div className="hidden lg:flex w-80 shrink-0 h-[580px] rounded-3xl bg-[#13111c]/90 border border-white/15 shadow-2xl backdrop-blur-xl flex-col overflow-hidden order-3">
                  {/* Chat Header */}
                  <div className="p-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-rose-400" />
                      <span className="font-bold text-xs text-white">Match Chat</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Live WebSocket</span>
                  </div>

                  {/* Chat Messages */}
                  <div
                    ref={chatContainerRef}
                    onScroll={handleChatScroll}
                    className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                        <Smile className="w-8 h-8 mb-2 opacity-50 text-rose-300" />
                        <span>Say hi or cheer for your opponent!</span>
                      </div>
                    ) : (
                      chatMessages.map(msg => {
                        const isMe = msg.userId === effectiveUserId;
                        const sticker = parseStickerMessage(msg.content);

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <span className="text-[10px] text-zinc-400 mb-0.5 px-1 font-medium">
                              {isMe ? 'You' : msg.userName}
                            </span>
                            {sticker ? (
                              <StickerMessageView content={msg.content} />
                            ) : (
                              <div
                                className={`px-3 py-2 rounded-2xl max-w-[85%] break-words ${
                                  isMe
                                    ? 'bg-rose-600 text-white rounded-tr-none'
                                    : 'bg-white/10 text-zinc-200 rounded-tl-none border border-white/10'
                                }`}
                              >
                                {msg.replyTo && (
                                  <div className="mb-1 pb-1 border-b border-white/20 text-[10px] opacity-75">
                                    Replying to {msg.replyTo.userName}: {msg.replyTo.content}
                                  </div>
                                )}
                                <span>{msg.content}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Quick Chat Buttons */}
                  {!isSpectator && <div className="px-2 py-1.5 border-t border-white/10 flex items-center gap-1 overflow-x-auto bg-black/20 shrink-0">
                    {QUICK_CHAT_PHRASES.map(phrase => (
                      <button
                        key={phrase}
                        onClick={() => sendChat(phrase, null)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300 whitespace-nowrap transition cursor-pointer shrink-0"
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>}

                  {/* Chat Input */}
                  {isSpectator ? (
                    <div className="p-2.5 border-t border-white/10 text-center text-[11px] text-zinc-400 bg-black/40 shrink-0">Chat is read-only while watching.</div>
                  ) : (
                  <form onSubmit={handleSendChat} className="p-2.5 border-t border-white/10 flex items-center gap-1.5 bg-black/40 shrink-0">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-400"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 transition cursor-pointer shrink-0"
                      title="Send"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                  )}
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* Mobile Slide-Over Chat Drawer (< lg) - Root Level Viewport Portal */}
      {roomParam && isChatOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none lg:hidden pointer-events-auto">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsChatOpen(false)}
          />

          {/* Slide-over Panel */}
          <div className="absolute inset-y-0 right-0 w-[calc(100vw-2.5rem)] xs:w-[350px] sm:w-[380px] max-w-full bg-[#13111c]/98 border-l border-white/15 shadow-2xl backdrop-blur-2xl flex flex-col h-full h-[100dvh] animate-in slide-in-from-right duration-200">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-white block leading-tight">Match Chat</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Live WebSocket</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Close Chat"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="flex-1 min-h-0 p-3.5 overflow-y-auto space-y-2.5 text-xs"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                  <Smile className="w-8 h-8 mb-2 opacity-50 text-rose-300" />
                  <span>Say hi or cheer for your opponent!</span>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.userId === effectiveUserId;
                  const sticker = parseStickerMessage(msg.content);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-zinc-400 mb-0.5 px-1 font-medium">
                        {isMe ? 'You' : msg.userName}
                      </span>
                      {sticker ? (
                        <StickerMessageView content={msg.content} />
                      ) : (
                        <div
                          className={`px-3 py-2 rounded-2xl max-w-[85%] break-words ${
                            isMe
                              ? 'bg-rose-600 text-white rounded-tr-none'
                              : 'bg-white/10 text-zinc-200 rounded-tl-none border border-white/10'
                          }`}
                        >
                          {msg.replyTo && (
                            <div className="mb-1 pb-1 border-b border-white/20 text-[10px] opacity-75">
                              Replying to {msg.replyTo.userName}: {msg.replyTo.content}
                            </div>
                          )}
                          <span>{msg.content}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatBottomMobileRef} />
            </div>

            {/* Quick Chat Buttons */}
            {!isSpectator && <div className="px-2.5 py-2 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-black/30 shrink-0">
              {QUICK_CHAT_PHRASES.map(phrase => (
                <button
                  key={phrase}
                  onClick={() => sendChat(phrase, null)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-zinc-300 hover:text-white whitespace-nowrap transition cursor-pointer shrink-0"
                >
                  {phrase}
                </button>
              ))}
            </div>}

            {/* Chat Input */}
            {isSpectator ? (
              <div className="p-2.5 border-t border-white/10 text-center text-[11px] text-zinc-400 bg-[#0e0c18] shrink-0">Chat is read-only while watching.</div>
            ) : (
            <form onSubmit={handleSendChat} className="p-2.5 sm:p-3 border-t border-white/10 flex items-center gap-2 bg-[#0e0c18] shrink-0">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-400"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shrink-0 shadow-md shadow-rose-600/30"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BoardDuelGame({ variant = 'zero-cross' }: { variant?: BoardVariant }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0c0d12] text-white">
        <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
      </div>
    }>
      <BoardDuelContent variant={variant} />
    </Suspense>
  );
}
