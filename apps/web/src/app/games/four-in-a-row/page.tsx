'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  X,
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
  Dice5,
  Gamepad2,
  Tv,
  LogOut,
  User,
  ArrowRight,
  RefreshCw
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
  disconnectUserPartner,
  pingPartner,
  createGameRoom,
  getGameRoom,
  joinGameRoom,
  playWithPartner,
  sendHeartbeat,
  UserSession
} from '../../../lib/api';
import { useGameRoom, DiscDropEvent } from '../../../hooks/useGameRoom';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import { StickerPicker, StickerMessageView } from '../../../components/chat/StickerPicker';
import { parseStickerMessage, formatStickerMessage } from '../../../components/chat/StickersData';

export interface BoardTheme {
  id: string;
  name: string;
  bgUrl: string;
}

const THEMES: BoardTheme[] = [
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    bgUrl: '/images/cozy_ludo_bg.jpg'
  },
  {
    id: 'theam1',
    name: 'Theme 1 • Candlelit Café',
    bgUrl: '/theams/theam1.jpeg'
  },
  {
    id: 'theam2',
    name: 'Theme 2 • Neon Romance',
    bgUrl: '/theams/theam2.jpeg'
  },
  {
    id: 'theam3',
    name: 'Theme 3 • Better Together',
    bgUrl: '/theams/theam3.jpeg'
  },
  {
    id: 'theam4',
    name: 'Theme 4 • Watch Together',
    bgUrl: '/theams/theam4.jpeg'
  },
  {
    id: 'theam5',
    name: 'Theme 5 • Snuggle Cinema',
    bgUrl: '/theams/theam5.jpeg'
  },
  {
    id: 'theam6',
    name: 'Theme 6 • Velvet Night',
    bgUrl: '/theams/theam6.jpeg'
  }
];

export type Disc = 'R' | 'Y' | null;
const ROWS = 6;
const COLS = 7;

const QUICK_CHAT_PHRASES = [
  'Your turn, sweetie! 💖',
  'So close!! 😱',
  'Nice drop! 🔥',
  'Rematch after this! 🔄',
  'Watch this move! 😎',
  'Oops haha! 🙈'
];

const EMOJI_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '🔴', '🟡', '🥳', '🥺', '✨'];

const FEATURED_QUICK_STICKERS = [
  { id: 'bubu_dance', name: 'Dance', gifUrl: 'https://media4.giphy.com/media/Pw4DoWaNHDj8YVCWtu/giphy.gif', tagline: 'HAPPY DANCE!' },
  { id: 'bubu_kiss', name: 'Kiss', gifUrl: 'https://media2.giphy.com/media/fX5NLVCyAnWyGsERta/giphy.gif', tagline: 'MWAHH! ❤️' },
  { id: 'bubu_hug', name: 'Hug', gifUrl: 'https://media3.giphy.com/media/GhUy4fOxwX1YGyIgEJ/giphy.gif', tagline: 'TIGHT HUG ❤️' },
  { id: 'bubu_headpat', name: 'Headpat', gifUrl: 'https://media3.giphy.com/media/6FfOKVchlToDnqtd00/giphy.gif', tagline: 'GOOD JOB! 🐾' },
  { id: 'bubu_loveheart', name: 'Love', gifUrl: 'https://media4.giphy.com/media/ZO6uFYmEKnPWUQQsf7/giphy.gif', tagline: 'I LOVE YOU' },
  { id: 'milk_snuggle', name: 'Snuggle', gifUrl: 'https://media1.giphy.com/media/pGZe55TzZ6AAmZ4g9E/giphy.gif', tagline: 'SNUGGLE 💕' },
  { id: 'peach_goma_love', name: 'Peach', gifUrl: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpqZ2psdHk0NWF3N3J1dzRzcmF4dGpqYnk2bWVrOWVpaXV6c3NlciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/MDJ9IbxxvDUQM/giphy.gif', tagline: 'LOVE YOU 🐱' },
  { id: 'capy_pullup', name: 'Capy', gifUrl: 'https://media0.giphy.com/media/RtdRhc7TxBxB0YAsK6/giphy.gif', tagline: 'OK I PULL UP' }
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

function FourInARowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');

  // User identity & Partner
  const [session, setSession] = useState<UserSession | null>(null);
  const [myPartnerCode, setMyPartnerCode] = useState<string>('');
  const [copiedPartnerCode, setCopiedPartnerCode] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

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

  // Theme
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Lobby state
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPartnerConnectInput, setShowPartnerConnectInput] = useState(false);

  // Modals & UI Controls
  const [activeTheme, setActiveTheme] = useState<string>('cozy');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<'chat' | 'call' | 'players'>('chat');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);

  // Elegant Modal Alert State
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

  // Audio Context for synthesized sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastStickerSentRef = useRef<number>(0);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const prevMessagesCountRef = useRef<number>(0);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const handleJumpToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`four-chat-msg-${msgId}`);
    if (el) {
      isUserScrolledUpRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => {
        setHighlightedMsgId(prev => (prev === msgId ? null : prev));
      }, 2000);
    }
  }, []);

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
    disconnectedPlayer,
    opponentLeftWin,
    clearOpponentLeftWin,
    nudgeAlert,
    clearNudgeAlert,
    dropDisc,
    rematch,
    sendChat,
    sendReaction,
    sendNudge,
    sendLeave,
    lastDiscDrop,
    chatMessages,
    floatingReactions,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomParam);

  // Derive active players
  const hostPlayer = useMemo(() => {
    if (!room) return null;
    return room.players.find(p => p.seat === 0) || null;
  }, [room]);

  const guestPlayer = useMemo(() => {
    if (!room) return null;
    return room.players.find(p => p.seat === 1) || null;
  }, [room]);

  const opponentPlayer = useMemo(() => {
    if (!room) return null;
    return room.players.find(p => p.userId !== (session?.user?.id || myUserId)) || null;
  }, [room, session, myUserId]);

  const isHost = myPlayer?.seat === 0;
  const myColor: 'R' | 'Y' = myPlayer?.seat === 0 ? 'R' : 'Y';

  // WebRTC Audio/Video Calls
  const effectiveUserId = myPlayer?.userId || session?.user?.id || myUserId || (typeof window !== 'undefined' ? getStoredSession()?.user?.id : '') || '';
  const webRTCMembers = useMemo(() => {
    return (room?.players || []).map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isHost: p.seat === 0,
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

  const isMicOn = !isMicMuted;

  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  // Position floating call window at bottom-left of Room Info Card by default
  useEffect(() => {
    if (typeof window !== 'undefined' && pipPosition === null) {
      if (window.innerWidth >= 1024) {
        // Desktop: Left side directly below Room Info Card
        setPipPosition({ x: 32, y: 205 });
      } else {
        // Mobile / Tablet: Left bottom corner of screen
        setPipPosition({ x: 16, y: Math.max(120, window.innerHeight - 170) });
      }
    }
  }, [pipPosition]);

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
      setIsDraggingPip(false);
      dragStartRef.current = null;
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

  const participantStreamsByUserId = useMemo(() => {
    const map: Record<string, VideoGridParticipant> = {};
    for (const p of callParticipants) {
      map[p.userId] = p;
    }
    const localP = callParticipants.find(p => p.isSelf);
    if (localP) {
      if (effectiveUserId) map[effectiveUserId] = localP;
      if (myPlayer?.userId) map[myPlayer.userId] = localP;
      map['me'] = localP;
    }
    return map;
  }, [callParticipants, effectiveUserId, myPlayer]);

  // Audio generator
  const triggerSound = useCallback(
    (type: 'drop' | 'win' | 'click' | 'nudge') => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'drop') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === 'win') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.1);
          osc.frequency.setValueAtTime(783.99, now + 0.2);
          osc.frequency.setValueAtTime(1046.5, now + 0.3);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
        } else if (type === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === 'nudge') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.setValueAtTime(1200, now + 0.1);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        }
      } catch {}
    },
    [soundEnabled]
  );

  // Sound effect on disc drop
  useEffect(() => {
    if (lastDiscDrop) {
      if (lastDiscDrop.isWinner) {
        triggerSound('win');
      } else {
        triggerSound('drop');
      }
    }
  }, [lastDiscDrop, triggerSound]);

  // Load Session & Partner identity
  const loadUserAndPartner = useCallback(async () => {
    try {
      let s = getStoredSession();
      if (!s) {
        s = await ensureSession();
      }
      setSession(s);
      if (s?.user?.partnerCode) {
        setMyPartnerCode(s.user.partnerCode);
      }

      if (s?.token) {
        try {
          const userRes = await getUserMe(s.token);
          if (userRes.user?.partnerCode) {
            setMyPartnerCode(userRes.user.partnerCode);
            if (s.user) {
              s.user.partnerCode = userRes.user.partnerCode;
              try {
                localStorage.setItem('synccinema_session', JSON.stringify(s));
              } catch {}
            }
          }
        } catch {}

        try {
          const partnerRes = await getUserPartner(s.token);
          if (partnerRes.partner) {
            setPartner(partnerRes.partner);
          } else {
            setPartner(null);
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to load user and partner:', e);
    }
  }, []);

  useEffect(() => {
    loadUserAndPartner();
  }, [loadUserAndPartner]);

  // Periodic heartbeat
  useEffect(() => {
    if (!session?.token) return;
    const interval = setInterval(async () => {
      try {
        const hb = await sendHeartbeat(session.token);
        if (hb.partner) {
          setPartner(hb.partner);
        }
        if (hb.myPartnerCode) {
          setMyPartnerCode(hb.myPartnerCode);
        }
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [session?.token]);

  // Partner connect
  const handleConnectPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token) return;
    const code = partnerInputCode.trim().toUpperCase();
    if (!code) return;
    setIsConnectingPartner(true);
    setPartnerConnectError(null);
    try {
      const res = await connectUserPartner(session.token, code);
      if (res.partner) {
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
    showAlert(
      'Disconnect Partner? 💔',
      'Are you sure you want to disconnect from your partner? You can reconnect anytime with their partner code.',
      'warning',
      {
        confirmText: 'Disconnect',
        cancelText: 'Keep Partner',
        onConfirm: async () => {
          try {
            await disconnectUserPartner(session.token);
            setPartner(null);
          } catch (err: any) {
            showAlert('Disconnect Partner', err.message || 'Failed to disconnect partner', 'error');
          }
        }
      }
    );
  };

  const handlePingPartner = async () => {
    if (!partner) return;
    setIsPingingPartner(true);
    setPartnerPingStatus(null);
    try {
      await pingPartner({
        targetCode: partner.partnerCode,
        fromCode: myPartnerCode,
        fromName: session?.user?.displayName || 'Partner',
        roomCode: roomParam || undefined,
        gameType: 'four-in-a-row'
      });
      setPartnerPingStatus(`🔔 Ping notification delivered to ${partner.displayName}!`);
    } catch (err: any) {
      setPartnerPingStatus(`⚠️ ${err.message || 'Failed to ping partner'}`);
    } finally {
      setIsPingingPartner(false);
      setTimeout(() => setPartnerPingStatus(null), 5000);
    }
  };

  // Nudge opponent in-game
  const handleNudgePlayer = (targetUserId?: string, targetName?: string) => {
    sendNudge(targetUserId);
    setNudgeFeedback(`🔔 Nudged ${targetName || 'opponent'}!`);
    setTimeout(() => setNudgeFeedback(null), 3000);
  };

  // Play with Partner
  const handlePlayWithPartner = async () => {
    if (!partner || !session?.token) return;
    setIsCreatingRoom(true);
    setLobbyError(null);
    try {
      const res = await playWithPartner(session.token, 'four-in-a-row');
      router.push(`/games/four-in-a-row?room=${res.room.roomCode}`);
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to start duel with partner');
      setIsCreatingRoom(false);
    }
  };

  // Create Private Room
  const handleCreateRoom = async () => {
    if (!session?.token) {
      const ensured = await ensureSession();
      setSession(ensured);
    }
    setIsCreatingRoom(true);
    setLobbyError(null);
    try {
      const currentToken = session?.token || (getStoredSession()?.token ?? '');
      const res = await createGameRoom(currentToken, 'four-in-a-row', 2, true);
      router.push(`/games/four-in-a-row?room=${res.room.roomCode}`);
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to create private room');
      setIsCreatingRoom(false);
    }
  };

  // Join Room with Code
  const handleJoinWithCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setLobbyError('Please enter a valid room code or partner code');
      return;
    }
    setLobbyError(null);
    setIsJoiningRoom(true);

    try {
      // 1. Check if it's a valid Game Room
      const roomRes = await getGameRoom(code).catch(() => null);
      if (roomRes?.room) {
        if (roomRes.isFull) {
          setLobbyError(`Room ${code} is already full (2/2 players).`);
          setIsJoiningRoom(false);
          return;
        }
        if (session?.token) {
          await joinGameRoom(session.token, code).catch(() => null);
        }
        router.push(`/games/four-in-a-row?room=${code}`);
        return;
      }

      // 2. Check if user entered a Partner Code
      if (session?.token) {
        try {
          const partnerRes = await connectUserPartner(session.token, code);
          if (partnerRes?.partner) {
            setPartner(partnerRes.partner);
            setIsJoiningRoom(false);
            setRoomCodeInput('');
            showAlert('Partner Connected! 💕', `Connected with partner ${partnerRes.partner.displayName}! You can now challenge them to a match.`, 'success');
            return;
          }
        } catch {
          // not partner code
        }
      }

      // 3. Fallback: navigate directly to room
      router.push(`/games/four-in-a-row?room=${code}`);
    } catch (err: any) {
      setLobbyError(err.message || `Could not join room ${code}`);
      setIsJoiningRoom(false);
    }
  };

  // Copy Room code & link
  const handleCopyRoomCode = () => {
    if (!roomParam) return;
    navigator.clipboard.writeText(roomParam);
    setCopiedRoomCode(true);
    triggerSound('click');
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleCopyRoomLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedRoomLink(true);
    triggerSound('click');
    setTimeout(() => setCopiedRoomLink(false), 2000);
  };

  // Drop Disc Action
  const handleColumnClick = (col: number) => {
    if (!isMyTurn) return;
    if (!room || room.status !== 'PLAYING') return;
    if (boardState[0][col] !== null) return;
    triggerSound('click');
    dropDisc(col);
  };

  // Send Chat
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput, replyingTo);
    setChatInput('');
    setReplyingTo(null);
    isUserScrolledUpRef.current = false;
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 50);
  };

  const handleSelectSticker = (stickerIdOrUrl: string, caption?: string) => {
    const now = Date.now();
    if (now - lastStickerSentRef.current < 500) return;
    lastStickerSentRef.current = now;
    sendChat(formatStickerMessage(stickerIdOrUrl, caption || ''), replyingTo);
    setReplyingTo(null);
    setShowStickerPicker(false);
    isUserScrolledUpRef.current = false;
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 50);
  };

  // Auto-scroll chat to bottom only on new messages if user isn't reading history
  useEffect(() => {
    if (chatMessages.length > prevMessagesCountRef.current) {
      prevMessagesCountRef.current = chatMessages.length;
      if (!isUserScrolledUpRef.current && chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    } else {
      prevMessagesCountRef.current = chatMessages.length;
    }
  }, [chatMessages.length]);

  // Derived state
  const currentTheme = THEMES.find(t => t.id === activeTheme) || THEMES[0];
  const isWaiting = room && room.status === 'WAITING';
  const isPlayingOrFinished = room && (room.status === 'PLAYING' || room.status === 'FINISHED') && gameState !== null;

  const boardState: Disc[][] = useMemo(() => {
    if (gameState?.board && Array.isArray(gameState.board)) {
      return gameState.board;
    }
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }, [gameState]);

  const winnerInfo = useMemo(() => {
    if (!gameState) return null;
    if (gameState.winner) {
      return {
        winner: gameState.winner as 'R' | 'Y',
        winnerUserId: gameState.winnerUserId,
        winnerColor: gameState.winnerColor,
        winningCells: (gameState.winningLine || []) as [number, number][]
      };
    }
    return null;
  }, [gameState]);

  const isDraw = Boolean(gameState?.isDraw);

  const isOpponentDisconnected = useMemo(() => {
    if (opponentPlayer && !opponentPlayer.isConnected) return true;
    if (disconnectedPlayer && disconnectedPlayer.userId !== myPlayer?.userId) return true;
    return false;
  }, [opponentPlayer, disconnectedPlayer, myPlayer]);

  const disconnectedOpponentName = opponentPlayer?.displayName || disconnectedPlayer?.displayName || 'Opponent';

  // Flanking participant streams
  const hostStream = hostPlayer ? participantStreamsByUserId[hostPlayer.userId] : null;
  const guestStream = guestPlayer ? participantStreamsByUserId[guestPlayer.userId] : null;

  const isHostMe = Boolean(
    (hostPlayer && effectiveUserId && hostPlayer.userId === effectiveUserId) ||
    (hostPlayer && myPlayer && hostPlayer.userId === myPlayer.userId)
  );
  const isGuestMe = Boolean(
    (guestPlayer && effectiveUserId && guestPlayer.userId === effectiveUserId) ||
    (guestPlayer && myPlayer && guestPlayer.userId === myPlayer.userId)
  );

  const hostActiveStream = isHostMe ? (localUserStream || hostStream?.stream) : hostStream?.stream;
  const hostCameraOn = isHostMe ? isCameraOn : Boolean(hostStream?.isCameraOn);
  const hasHostLiveVideo = Boolean(
    hostCameraOn &&
    hostActiveStream &&
    hostActiveStream.getVideoTracks().length > 0 &&
    hostActiveStream.getVideoTracks().some(t => t.enabled && t.readyState !== 'ended')
  );

  const guestActiveStream = isGuestMe ? (localUserStream || guestStream?.stream) : guestStream?.stream;
  const guestCameraOn = isGuestMe ? isCameraOn : Boolean(guestStream?.isCameraOn);
  const hasGuestLiveVideo = Boolean(
    guestCameraOn &&
    guestActiveStream &&
    guestActiveStream.getVideoTracks().length > 0 &&
  return (
    <div className={`flex selection:bg-rose-600 selection:text-white font-sans antialiased overflow-x-hidden transition-colors duration-150 ${
      roomParam ? 'min-h-screen overflow-y-auto' : 'h-screen w-screen overflow-hidden'
    } ${
      isDark ? 'bg-[#111217] text-white' : 'bg-white text-zinc-900'
    }`}>
      {/* Active Match Background & Atmosphere (when in active room) */}
      {roomParam ? (
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={{
            backgroundImage: `url('${currentTheme.bgUrl}')`
          }}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
        </div>
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

      {/* Dynamic Flickering Candlelight & Floating Embers */}
      {roomParam && <DynamicThemeEffects themeId={activeTheme} />}

      {/* Floating Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-float-up text-3xl font-bold flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-2xl"
          >
            <span>{r.emoji}</span>
            <span className="text-xs text-rose-200 font-semibold">{r.userName}</span>
          </div>
        ))}
      </div>

      {/* Turn Nudge Alert Modal */}
      {nudgeAlert && (
        <AlertModal
          isOpen={!!nudgeAlert}
          onClose={clearNudgeAlert}
          title="It's Your Turn! 🔴"
          message={`${nudgeAlert.fromDisplayName} nudged you! It's your turn to drop a disc.`}
          type="warning"
          confirmText="Got It"
        />
      )}

      {/* Opponent Left Victory Modal */}
      {opponentLeftWin && (
        <AlertModal
          isOpen={!!opponentLeftWin}
          onClose={clearOpponentLeftWin}
          title="🎉 YOU WON THE MATCH! 🏆"
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

      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR NAVIGATION (IDENTICAL TO DASHBOARD & LUDO)                 */}
      {/* ========================================================================= */}
      {!roomParam && (
        <aside className="w-64 bg-white dark:bg-[#14151b] border-r border-zinc-200/80 dark:border-white/[0.06] p-6 flex flex-col justify-between shrink-0 hidden lg:flex select-none transition-colors duration-150 sticky top-0 h-screen z-30">
          <div className="space-y-8">
            {/* Logo: Watch. with Bold Red Accent Dot */}
            <div
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-2.5 cursor-pointer select-none"
            >
              <div className="p-1.5 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-600/30">
                <Film className="w-4 h-4 fill-current" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                  Watch<span className="text-rose-600 text-2xl leading-none">.</span>
                </span>
                <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-widest uppercase mt-0.5">
                  Powered by StitchByte
                </span>
              </div>
            </div>

            {/* Navigation Groups */}
            <div className="space-y-6">
              {/* Nav Group 1: Menu */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-2">
                  Menu
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition"
                >
                  <Film className="w-4 h-4 text-zinc-400" />
                  <span>Browse Cinema</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/dashboard?tab=watchlist')}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition"
                >
                  <Heart className="w-4 h-4 text-zinc-400" />
                  <span>Watchlist</span>
                </button>
              </div>

              {/* Nav Group 2: Social / Games */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-2">
                  Social & Games
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard?tab=myrooms')}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition"
                >
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>My Rooms</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/dashboard?tab=parties')}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition"
                >
                  <Tv className="w-4 h-4 text-zinc-400" />
                  <span>Watch Parties</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/dashboard?tab=games')}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.08] shadow-sm relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-rose-600 before:rounded-r font-bold transition"
                >
                  <Gamepad2 className="w-4 h-4 text-rose-500" />
                  <span>Game Lounge</span>
                  <span className="ml-auto text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                    PLAY
                  </span>
                </button>
              </div>

              {/* Nav Group 3: General */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-2">
                  General
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>My Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition"
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearStoredSession();
                    router.push('/');
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>

          {/* User Profile Card at Bottom of Sidebar */}
          <div
            onClick={() => router.push('/profile')}
            className="flex items-center space-x-3 p-3 rounded-2xl bg-zinc-50 dark:bg-[#1b1c24] border border-zinc-200/80 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/20 transition cursor-pointer group shadow-xs select-none"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 ring-2 ring-rose-600/40 shrink-0 flex items-center justify-center">
              {session?.user?.avatarUrl ? (
                <img
                  src={session.user.avatarUrl}
                  alt={session.user.displayName || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-pink-600 flex items-center justify-center text-white text-xs font-bold">
                  {((session?.user?.displayName || 'U')[0]).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:text-rose-600 transition">
                {session?.user?.displayName || 'Cinema Fan'}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1 font-mono">
                {partner ? `💕 Paired: ${partner.displayName}` : `Code: ${myPartnerCode || session?.user?.partnerCode || '...'}`}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA (FULL-SCREEN IN MATCH, ADAPTIVE IN LOBBY)            */}
      {/* ========================================================================= */}
      <div className={`flex-1 flex flex-col relative ${
        roomParam ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'
      }`}>
        {/* TOP NAVIGATION HEADER BAR */}
        <header className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200 ${
          isDark ? 'bg-[#14151b]/85 border-white/[0.08]' : 'bg-white/95 border-zinc-200/80 shadow-xs'
        }`}>
          {/* Left: Breadcrumbs or Leave Match */}
          <div className="flex items-center gap-3">
            {roomParam ? (
              <button
                onClick={() => {
                  showAlert(
                    'Leave Match? 🚪',
                    'Are you sure you want to leave this game? You will disconnect from the match and return to the lounge.',
                    'warning',
                    {
                      confirmText: 'Leave Match',
                      cancelText: 'Stay & Play',
                      onConfirm: () => {
                        sendLeave();
                        router.push('/games/four-in-a-row');
                      }
                    }
                  );
                }}
                className={`px-3.5 py-1.5 rounded-xl border shadow-xs flex items-center gap-2 font-semibold text-xs transition-all active:scale-95 group ${
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
                  onClick={() => router.push('/dashboard?tab=games')}
                  className={`lg:hidden px-2.5 py-1.5 rounded-xl border flex items-center gap-1 font-semibold ${
                    isDark ? 'bg-white/[0.05] text-zinc-300 border-white/[0.08]' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Games</span>
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
                    onClick={() => router.push('/dashboard?tab=games')}
                    className={`cursor-pointer hover:underline ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                  >
                    Game Lounge
                  </span>
                  <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>/</span>
                  <span className="text-[#ee1d49] font-bold">Four in a Row</span>
                </div>
              </div>
            )}
          </div>

          {/* Center Header: Room Param or Call Pill */}
          {roomParam && (
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full border flex items-center gap-2 font-mono text-xs ${
                isDark ? 'bg-white/[0.04] border-white/[0.08] text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-800'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Room: <strong className={isDark ? 'text-white font-bold' : 'text-zinc-900 font-bold'}>{roomParam}</strong></span>
              </div>
              {isPipClosed && (
                <button
                  onClick={() => setIsPipClosed(false)}
                  className="px-3 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 shadow text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Open Floating Video Call"
                >
                  <Video className="w-3.5 h-3.5 text-rose-500" />
                  <span>Show Video</span>
                </button>
              )}
            </div>
          )}

          {/* Right: Controls & Theme Toggle */}
          <div className="flex items-center gap-2">
            {/* Audio SFX Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                triggerSound('click');
              }}
              title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
              className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-400" />}
            </button>

            {/* Microphone Toggle Button */}
            {roomParam && (
              <button
                onClick={toggleMic}
                className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                  isMicMuted
                    ? (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-500 hover:text-zinc-800')
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400 ring-2 ring-emerald-500/20'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Video / Camera Toggle Button */}
            {roomParam && (
              <button
                onClick={() => {
                  toggleCamera();
                  if (isPipClosed) setIsPipClosed(false);
                }}
                className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                  isCameraOn
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-400 ring-2 ring-rose-500/20'
                    : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-500 hover:text-zinc-800')
                }`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            )}

            {/* Chat Drawer Toggle */}
            {roomParam && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                  isChatOpen
                    ? 'bg-rose-600 border-rose-500 text-white'
                    : (isDark ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950')
                }`}
                title="Toggle Chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}

            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-amber-400'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-amber-600'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Rules Modal (?) */}
            <button
              onClick={() => setShowRulesModal(true)}
              className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
              }`}
              title="Four in a Row Rules"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Rematch / Restart Button */}
            {roomParam && isPlayingOrFinished && (
              <button
                onClick={() => {
                  triggerSound('click');
                  if (gameState?.winnerDisc || isDraw) {
                    rematch();
                  } else {
                    showAlert(
                      'Restart Match? 🔄',
                      'Would you like to reset the board and restart the match with your opponent?',
                      'info',
                      {
                        confirmText: 'Restart Match',
                        cancelText: 'Cancel',
                        onConfirm: () => rematch()
                      }
                    );
                  }
                }}
                className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                  isDark
                    ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
                }`}
                title="Rematch"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {/* Settings Modal (⚙) */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

      {/* MOVEABLE FLOATING VIDEO CALL WINDOW (Draggable across the whole screen with in-box Cam & Mic controls) */}
      {roomParam && !isPipClosed && (
        <div
          ref={pipRef}
          onMouseDown={handlePipDragStart}
          onTouchStart={handlePipDragStart}
          style={
            pipPosition
              ? { left: `${pipPosition.x}px`, top: `${pipPosition.y}px` }
              : { left: '32px', top: '205px' }
          }
          className={`fixed z-50 select-none bg-[#190d15]/95 border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-shadow ${
            isDraggingPip
              ? 'cursor-grabbing ring-2 ring-rose-500/60 shadow-[0_25px_60px_rgba(244,63,94,0.35)] scale-[1.02]'
              : 'cursor-grab hover:border-white/30'
          } ${isPipMinimized ? 'px-3 py-2' : 'p-2.5 sm:p-3'}`}
        >
          {/* Top Bar: Drag Grip + In-Call Controls (Mic, Cam, Minimize, Close) */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-1.5 border-b border-white/10 touch-none">
            {/* Drag Handle & Live Call status */}
            <div className="flex items-center gap-1.5 text-zinc-300 pointer-events-none">
              <GripHorizontal className="w-4 h-4 text-rose-400/80" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-white">
                Call ({callParticipants.length}{room ? `/${Math.max(2, room.players.length)}` : ''})
              </span>
            </div>

            {/* Camera & Mic Action Icons Inside This Floating Box */}
            <div className="flex items-center gap-1.5">
              {/* Mic Toggle Icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMic();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm ${
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
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm ${
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
                className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
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
                className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
                title="Hide Floating Call Window"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Video Boxes Side by Side (matching Ludo design) */}
          {!isPipMinimized && (
            <div className="flex items-center gap-2.5">
              {callParticipants.map(participant => (
                <div
                  key={participant.userId}
                  className="relative w-28 sm:w-34 h-20 sm:h-24 rounded-2xl bg-black/75 border border-white/15 overflow-hidden flex flex-col items-center justify-center shadow-inner"
                >
                  {participant.isCameraOn && participant.stream ? (
                    <VideoAvatar
                      stream={participant.stream}
                      isSelf={participant.isSelf}
                      displayName={participant.displayName}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow">
                        {participant.displayName?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-[9px] text-zinc-400 font-semibold">Cam Off</span>
                    </div>
                  )}

                  {/* Bottom Bar: Name on Left, Round Red/Green Mic Icon on Right */}
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <span className="text-[11px] font-bold text-white drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.95)] truncate max-w-[65px]">
                      {participant.isSelf ? 'You' : participant.displayName}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shadow-md drop-shadow ${
                        participant.isMuted
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-500 text-slate-950'
                      }`}
                    >
                      {participant.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    </span>
                  </div>
                </div>
              ))}

              {/* If waiting for Player 2, show dedicated slot instead of empty void */}
              {callParticipants.length < 2 && (
                <div className="relative w-28 sm:w-34 h-20 sm:h-24 rounded-2xl bg-black/45 border border-dashed border-white/20 overflow-hidden flex flex-col items-center justify-center p-2 text-center shadow-inner">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1 text-zinc-400">
                    <Users className="w-4 h-4 text-rose-300 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-zinc-200 font-bold leading-tight">
                    {opponentPlayer ? opponentPlayer.displayName : 'Waiting for P2'}
                  </span>
                  <span className="text-[9px] text-rose-300/80 font-medium">
                    {opponentPlayer ? (opponentPlayer.isConnected ? 'Connecting...' : 'Offline') : 'Invite partner'}
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
          ? 'max-w-[1600px] mx-auto p-3 sm:p-5'
          : (roomParam && isWaiting
              ? 'max-w-none p-0 h-[calc(100vh-4rem)] relative overflow-hidden'
              : 'h-[calc(100vh-4rem)] max-w-none p-0 overflow-hidden')
      }`}>
        {/* -----------------------------------------------------------------------
            SCENARIO 1: LOBBY VIEW (No ?room= parameter)
           ----------------------------------------------------------------------- */}
        {!roomParam && (
          <div className={`w-full h-full flex flex-col justify-between relative z-10 select-none px-6 sm:px-10 lg:px-14 py-4 sm:py-6 overflow-hidden transition-colors duration-200 ${
            isDark ? 'bg-[#0c0d12] text-white' : 'bg-white text-zinc-900'
          }`}>
            {/* Top / Main Hero Container */}
            <div className="w-full flex-1 flex items-center max-w-7xl mx-auto">
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Column: Eyebrow, Title, Subtitle, Connected Partner, Two Action Cards */}
                <div className="lg:col-span-7 flex flex-col justify-center">
                  
                  {/* Eyebrow */}
                  <div className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-[#f43f5e] uppercase mb-2 sm:mb-3">
                    CONNECT • DROP • WIN
                  </div>

                  {/* Main Hero Heading */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-none mb-3 sm:mb-4">
                    <span className="text-[#ee1d49]">Four in</span>{' '}
                    <span className={isDark ? 'text-white' : 'text-[#131727]'}>a Row</span>
                  </h1>

                  {/* Subtitle */}
                  <p className={`text-xs sm:text-sm lg:text-base font-medium max-w-lg leading-relaxed mb-4 sm:mb-5 ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    Play real-time Four in a Row with your friends. Simple. Fun.
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
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold tracking-wider text-[#ee1d49] uppercase">
                                Connected Partner
                              </span>
                              <Heart className="w-3 h-3 text-[#ee1d49] fill-[#ee1d49]" />
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
                            onClick={handlePlayWithPartner}
                            disabled={isCreatingRoom}
                            className="py-2.5 px-4 sm:px-5 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] hover:shadow-[0_6px_20px_rgba(237,28,70,0.35)] transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
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

                          <button
                            type="button"
                            onClick={() => setShowPartnerConnectInput(true)}
                            className="py-2 px-3.5 sm:px-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-xs rounded-xl sm:rounded-2xl shadow-[0_4px_14px_rgba(237,28,70,0.2)] transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Connect</span>
                          </button>
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
                                    navigator.clipboard.writeText(myPartnerCode);
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
                          Start a new 1v1 duel and invite your friend.
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
                          Enter a room code to join your friend's game.
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

                {/* Right Column: 3D Isometric Board Graphic with Accents */}
                <div className="lg:col-span-5 flex items-center justify-center relative">
                  <div className="relative w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[460px] max-h-[50vh] aspect-square flex items-center justify-center">
                    <img
                      src={isDark ? "/images/four-in-a-row-3d-dark.png" : "/images/four-in-a-row-3d.png"}
                      alt="Four in a Row 3D Board"
                      className="max-w-full max-h-full object-contain select-none pointer-events-none transform hover:scale-[1.02] transition-transform duration-300"
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
                  <X className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Room Error</h3>
                <p className="text-xs text-rose-200/80">{roomError}</p>
                <button
                  onClick={() => router.push('/games/four-in-a-row')}
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
                  onClick={() => router.push('/games/four-in-a-row')}
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
          <div className="w-full max-w-xl flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 rounded-3xl bg-black/50 border border-white/20 backdrop-blur-2xl shadow-2xl w-full space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="text-left">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    Private Room Code
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-rose-300 tracking-wider">
                    {roomParam}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRoomCode}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow transition"
                  >
                    {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRoomCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleCopyRoomLink}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-zinc-200 text-xs font-bold border border-white/10 transition"
                    title="Share Room Link"
                  >
                    {copiedRoomLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Player Slots Progress */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex flex-col items-center space-y-2">
                  <div className="relative">
                    <img
                      src={
                        hostPlayer?.avatarUrl ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${hostPlayer?.userId || 'host'}`
                      }
                      alt={hostPlayer?.displayName || 'Host'}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-rose-500 shadow"
                    />
                    <span className="absolute -top-2 -right-2 text-base">👑</span>
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">
                    {hostPlayer?.displayName || 'Host'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Red 🔴 • Ready
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-yellow-950/20 border border-yellow-500/30 flex flex-col items-center justify-center space-y-2">
                  {guestPlayer ? (
                    <>
                      <img
                        src={
                          guestPlayer.avatarUrl ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${guestPlayer.userId}`
                        }
                        alt={guestPlayer.displayName}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-yellow-400 shadow"
                      />
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">
                        {guestPlayer.displayName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        Yellow 🟡 • Ready
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-yellow-400 animate-ping" />
                      </div>
                      <span className="text-xs font-bold text-zinc-400">Waiting for Player 2</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-zinc-400 border border-white/10">
                        Yellow 🟡 Slot Open
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Zero-Bots Status Notice */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Strict Zero-Bots Room: Game begins automatically as soon as Player 2 connects.</span>
              </div>

              {partner && !guestPlayer && (
                <button
                  onClick={handlePingPartner}
                  disabled={isPingingPartner}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 active:scale-95 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isPingingPartner ? 'Sending Invite...' : `Invite Partner (${partner.displayName}) 🔔`}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------------
            SCENARIO 3: ACTIVE PLAYING / FINISHED MATCH (Exact 3-Column Layout of Ludo)
           ----------------------------------------------------------------------- */}
        {roomParam && isPlayingOrFinished && (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-6 relative">
            {/* Left Column: Floating Room Code Card & Ambient Neon Quotes */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
              {/* Floating Room Code Card */}
              <div className="p-4 rounded-3xl bg-[#1d0c18]/90 border border-rose-500/25 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[10px] uppercase tracking-wider text-rose-300/60 font-mono">ROOM CODE</span>
                    <div className="text-xl font-black text-rose-100 font-mono">{room.roomCode}</div>
                  </div>
                  <button
                    onClick={handleCopyRoomCode}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-300 transition"
                    title="Copy Room Code"
                  >
                    {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-rose-300/80">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{room.players.length} Players • 1v1 Human Duel</span>
                </div>
              </div>

              {/* Ambient Decorative Slogans matching Ludo layout */}
              <div className="hidden lg:flex flex-col gap-8 px-2 select-none">
                <div className="text-rose-400/30 font-serif italic text-lg leading-snug drop-shadow">
                  “Good Friends,<br />Great Games,<br />Better Together” 💖
                </div>

                <div className="p-3.5 rounded-2xl bg-black/30 border border-rose-500/15 text-rose-300/40 text-center font-mono text-xs shadow-inner">
                  Same Moves,<br />Different Hearts 💕
                </div>

                <div className="text-rose-500/25 font-bold text-sm uppercase tracking-wider">
                  Drop • Connect • Celebrate ✨
                </div>
              </div>
            </div>

            {/* Center Column: The 3D Chassis Board with Flanking Player Video Cards */}
            <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col items-center">
              {/* Turn Banner with Active Turn Indicator */}
              <div className="w-full max-w-lg mb-3 flex items-center justify-between px-4 py-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${gameState.currentTurnSeat === 0 ? 'bg-rose-500' : 'bg-yellow-400'} animate-pulse`} />
                  <span className="text-xs font-black tracking-wide uppercase text-white">
                    {gameState.currentTurnSeat === 0 ? "🔴 RED'S TURN" : "🟡 YELLOW'S TURN"}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-rose-300 font-bold">
                  <span>MOVE #{gameState.moveCount || 0}</span>
                </div>
              </div>

              {/* Flanking Player Cards (Host Red on Left, Guest Yellow on Right) */}
              <div className="w-full max-w-xl flex items-center justify-between gap-4 mb-3">
                {/* Player 1: Host Red */}
                <div
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    gameState.currentTurnSeat === 0
                      ? 'bg-rose-500/25 border-2 border-rose-400 shadow-xl shadow-rose-600/30 scale-105'
                      : 'bg-black/40 border border-white/10 opacity-75'
                  }`}
                >
                  <div className="relative shrink-0">
                    {/* Floating Golden Arrow Pointer */}
                    {gameState.currentTurnSeat === 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-40 pointer-events-none">
                        <svg width="22" height="20" viewBox="0 0 24 22" fill="none">
                          <path d="M 12 21 L 2 4 L 12 7 Z" fill="#eab308" />
                          <path d="M 12 21 L 22 4 L 12 7 Z" fill="#fde047" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-full p-0.5 border-2 border-rose-400 bg-black/60 flex items-center justify-center overflow-hidden">
                      {hasHostLiveVideo && hostActiveStream ? (
                        <VideoAvatar stream={hostActiveStream} isSelf={isHostMe} displayName={hostPlayer?.displayName || 'Host'} />
                      ) : hostPlayer?.avatarUrl ? (
                        <img src={hostPlayer.avatarUrl} alt="Host" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white font-black text-sm">
                          {hostPlayer?.displayName?.[0]?.toUpperCase() || 'R'}
                        </div>
                      )}
                    </div>
                    {/* Remote Audio Player */}
                    {hostPlayer && hostPlayer.userId !== effectiveUserId && hostStream?.stream && (
                      <RemoteAudioPlayer stream={hostStream.stream} />
                    )}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-600 border-2 border-black flex items-center justify-center text-[8px] font-black">
                      🔴
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white truncate max-w-[100px]">
                        {hostPlayer?.displayName || 'Player 1'}
                      </span>
                      {hostPlayer?.userId === effectiveUserId && <span className="text-[9px] text-rose-300">(You)</span>}
                    </div>
                    <span className="text-[10px] text-rose-300/80 font-mono">Red Team</span>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-black text-xs flex items-center justify-center shadow-lg">
                    VS
                  </div>
                </div>

                {/* Player 2: Guest Yellow */}
                <div
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    gameState.currentTurnSeat === 1
                      ? 'bg-yellow-500/25 border-2 border-yellow-400 shadow-xl shadow-yellow-600/30 scale-105'
                      : 'bg-black/40 border border-white/10 opacity-75'
                  }`}
                >
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {guestPlayer?.userId === effectiveUserId && <span className="text-[9px] text-yellow-300">(You)</span>}
                      <span className="text-xs font-black text-white truncate max-w-[100px]">
                        {guestPlayer?.displayName || 'Player 2'}
                      </span>
                    </div>
                    <span className="text-[10px] text-yellow-300/80 font-mono">Yellow Team</span>
                  </div>
                  <div className="relative shrink-0">
                    {/* Floating Golden Arrow Pointer */}
                    {gameState.currentTurnSeat === 1 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-40 pointer-events-none">
                        <svg width="22" height="20" viewBox="0 0 24 22" fill="none">
                          <path d="M 12 21 L 2 4 L 12 7 Z" fill="#eab308" />
                          <path d="M 12 21 L 22 4 L 12 7 Z" fill="#fde047" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-full p-0.5 border-2 border-yellow-400 bg-black/60 flex items-center justify-center overflow-hidden">
                      {hasGuestLiveVideo && guestActiveStream ? (
                        <VideoAvatar stream={guestActiveStream} isSelf={isGuestMe} displayName={guestPlayer?.displayName || 'Guest'} />
                      ) : guestPlayer?.avatarUrl ? (
                        <img src={guestPlayer.avatarUrl} alt="Guest" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-slate-950 font-black text-sm">
                          {guestPlayer?.displayName?.[0]?.toUpperCase() || 'Y'}
                        </div>
                      )}
                    </div>
                    {/* Remote Audio Player */}
                    {guestPlayer && guestPlayer.userId !== effectiveUserId && guestStream?.stream && (
                      <RemoteAudioPlayer stream={guestStream.stream} />
                    )}
                    <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-yellow-500 border-2 border-black flex items-center justify-center text-[8px] font-black">
                      🟡
                    </span>
                  </div>
                </div>
              </div>

              {/* The 7x6 3D Arcade Board Chassis */}
              <div className="relative p-4 sm:p-6 rounded-[36px] bg-gradient-to-b from-[#1b1c2b] via-[#121320] to-[#0c0d16] border-4 border-white/15 shadow-2xl shadow-rose-950/40 flex flex-col items-center">
                {/* Column Hover Previews Header Row */}
                <div className="grid grid-cols-7 gap-2 sm:gap-3.5 w-full max-w-md sm:max-w-lg mb-2">
                  {Array.from({ length: COLS }).map((_, c) => (
                    <div
                      key={`preview-${c}`}
                      className="h-8 flex items-center justify-center"
                      onMouseEnter={() => setHoveredCol(c)}
                      onMouseLeave={() => setHoveredCol(null)}
                      onClick={() => handleColumnClick(c)}
                    >
                      {isMyTurn && hoveredCol === c && boardState[0][c] === null && (
                        <div
                          className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full shadow-lg animate-bounce transition-all ${
                            myColor === 'R'
                              ? 'bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-500/50'
                              : 'bg-gradient-to-br from-yellow-300 to-amber-500 shadow-yellow-400/50'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* The Blue 3D Grid Chassis */}
                <div className="relative p-3.5 sm:p-5 rounded-3xl bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 border-4 border-blue-500 shadow-inner shadow-black/60">
                  <div className="grid grid-cols-7 gap-2 sm:gap-3.5">
                    {Array.from({ length: COLS }).map((_, c) => (
                      <div
                        key={`col-${c}`}
                        className="flex flex-col gap-2 sm:gap-3.5 cursor-pointer group"
                        onMouseEnter={() => setHoveredCol(c)}
                        onMouseLeave={() => setHoveredCol(null)}
                        onClick={() => handleColumnClick(c)}
                      >
                        {Array.from({ length: ROWS }).map((_, r) => {
                          const cell = boardState[r][c];
                          const isWinningCell = winnerInfo?.winningCells.some(
                            ([winR, winC]) => winR === r && winC === c
                          );

                          return (
                            <div
                              key={`cell-${r}-${c}`}
                              className="relative w-9 h-9 sm:w-14 sm:h-14 rounded-full bg-[#0b0c16] shadow-inner shadow-black flex items-center justify-center overflow-hidden border border-blue-900/60 group-hover:border-blue-400/40 transition"
                            >
                              {!cell && (
                                <div className="absolute inset-1 rounded-full bg-black/40 shadow-inner" />
                              )}

                              {cell && (
                                <div
                                  className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-300 animate-in zoom-in-75 ${
                                    cell === 'R'
                                      ? 'bg-gradient-to-br from-rose-500 via-red-600 to-red-800 shadow-lg shadow-rose-600/40'
                                      : 'bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 shadow-lg shadow-yellow-500/40'
                                  } ${
                                    isWinningCell
                                      ? 'ring-4 ring-white animate-pulse shadow-2xl shadow-white/80 scale-105 z-10'
                                      : ''
                                  }`}
                                >
                                  <div className="w-[70%] h-[70%] rounded-full border border-white/30 flex items-center justify-center">
                                    <div className="w-[45%] h-[45%] rounded-full bg-white/20" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3D Vertical Stand Legs */}
                <div className="flex justify-between w-full px-6 -mt-2">
                  <div className="w-6 h-8 bg-blue-950 rounded-b-xl border-x-2 border-b-2 border-blue-500 shadow-lg" />
                  <div className="w-6 h-8 bg-blue-950 rounded-b-xl border-x-2 border-b-2 border-blue-500 shadow-lg" />
                </div>
              </div>


            </div>

            {/* Right Column: Floating Game Chat & Audio/Video Call Window (Exact replica of Ludo) */}
            {isChatOpen && (
              <div className="w-full lg:w-80 shrink-0 bg-[#1c0c16]/65 border border-rose-500/25 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col h-[580px] backdrop-blur-xl relative">
                {/* Header */}
                <div className="pb-3 border-b border-rose-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white">
                      {activeSideTab === 'chat' ? 'Game Chat' : activeSideTab === 'call' ? 'In-Game Call' : 'Players'}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                    title="Close Drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs: Chat | Call | Players */}
                <div className="flex items-center gap-1.5 mt-2 border-b border-rose-500/20 pb-2">
                  <button
                    onClick={() => setActiveSideTab('chat')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                      activeSideTab === 'chat'
                        ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>

                  <button
                    onClick={() => setActiveSideTab('call')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                      activeSideTab === 'call'
                        ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                        : isCameraOn || isMicOn
                        ? 'text-emerald-300 hover:text-emerald-200'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Call {(isCameraOn || isMicOn) ? '🟢' : ''}</span>
                  </button>

                  <button
                    onClick={() => setActiveSideTab('players')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
                      activeSideTab === 'players'
                        ? 'text-rose-300 font-extrabold after:absolute after:bottom-[-9px] after:left-1/4 after:right-1/4 after:h-0.5 after:bg-rose-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Players</span>
                  </button>
                </div>

                {/* Tab 1: Chat Stream */}
                {activeSideTab === 'chat' && (
                  <>
                    <div
                      ref={chatContainerRef}
                      onScroll={handleChatScroll}
                      className="flex-1 overflow-y-auto space-y-3 py-2.5 px-2 text-xs scrollbar-none"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-rose-300/60 py-12">
                          <Heart className="w-8 h-8 mb-2 text-rose-500/40" />
                          <p className="text-xs font-medium">Say something sweet or drop a sticker!</p>
                        </div>
                      ) : (
                        chatMessages.map(m => {
                          const isMe = m.userId === session?.user?.id;
                          const isSticker = parseStickerMessage(m.content);
                          const isHighlighted = highlightedMsgId === m.id;
                          return (
                            <div
                              key={m.id}
                              id={`four-chat-msg-${m.id}`}
                              className={`group relative flex items-start gap-2.5 p-1.5 my-0.5 rounded-2xl transition-all duration-300 ${
                                isHighlighted ? 'ring-2 ring-inset ring-rose-500/80 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.35)]' : ''
                              }`}
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow shrink-0">
                                {m.userName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-bold text-rose-200 truncate">
                                    {isMe ? `${m.userName} (You)` : m.userName}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
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

                                {/* Quoted reply card if replying to another message */}
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

                    {/* Quick Reactions Row */}
                    <div className="pt-2 pb-1 space-y-2 border-t border-rose-500/20">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {EMOJI_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => sendReaction(emoji)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 active:scale-95 transition-all text-base shrink-0 border border-white/10 hover:border-rose-400/40 flex items-center justify-center shadow-sm"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Quick Chat Phrases */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {QUICK_CHAT_PHRASES.map(phrase => (
                          <button
                            key={phrase}
                            type="button"
                            onClick={() => {
                              sendChat(phrase, replyingTo);
                              setReplyingTo(null);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 active:scale-95 text-[11px] font-medium text-rose-200 shrink-0 border border-rose-500/20 whitespace-nowrap transition-all shadow-sm"
                          >
                            {phrase}
                          </button>
                        ))}
                      </div>

                      {/* One-Click Quick Animated GIPHY Stickers Row */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                        <span className="text-[10px] text-rose-300/80 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Stickers:</span>
                        </span>
                        {FEATURED_QUICK_STICKERS.map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleSelectSticker(st.id, st.tagline)}
                            className="h-10 px-2 rounded-xl bg-white/5 hover:bg-rose-500/25 active:scale-95 transition-all flex items-center gap-1.5 border border-white/10 hover:border-rose-400/50 shrink-0 group shadow-sm"
                            title={`Send ${st.name} sticker`}
                          >
                            <img src={st.gifUrl} alt={st.name} className="w-7 h-7 object-contain group-hover:scale-115 transition-transform" />
                            <span className="text-[9px] font-bold text-rose-200">{st.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Floating Sticker Tray Drawer Popup */}
                    {showStickerPicker && (
                      <div className="absolute bottom-16 right-0 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <StickerPicker
                          onSelectSticker={handleSelectSticker}
                          onClose={() => setShowStickerPicker(false)}
                        />
                      </div>
                    )}

                    {/* Replying Banner */}
                    {replyingTo && (
                      <div className="pt-2">
                        <ChatReplyingBanner
                          replyingTo={replyingTo}
                          onCancel={() => setReplyingTo(null)}
                        />
                      </div>
                    )}

                    {/* Chat Input Bar */}
                    <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-rose-500/20">
                      <div className="flex-1 relative flex items-center">
                        <input
                          ref={chatInputRef}
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape' && replyingTo) {
                              setReplyingTo(null);
                            }
                          }}
                          placeholder={replyingTo ? `Replying to ${replyingTo.userName}...` : "Type a message or send stickers..."}
                          className="w-full pl-3.5 pr-16 py-2.5 rounded-2xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-400"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                          {/* Sticker Drawer Button */}
                          <button
                            type="button"
                            onClick={() => setShowStickerPicker(prev => !prev)}
                            className={`p-1 rounded-lg transition-colors ${
                              showStickerPicker
                                ? 'text-pink-300 bg-pink-500/20 ring-1 ring-pink-400/40'
                                : 'text-zinc-400 hover:text-pink-300 hover:bg-white/10'
                            }`}
                            title="Open Animated GIPHY Stickers Drawer"
                          >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                          </button>
                          {/* Smiley Emoji Shortcut */}
                          <button
                            type="button"
                            onClick={() => setChatInput(prev => `${prev} 😊`)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Add smile"
                          >
                            <Smile className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="p-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white active:scale-95 shadow-md shadow-rose-900/50 transition shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                )}

                {/* Tab 2: Call Tab */}
                {activeSideTab === 'call' && (
                  <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-500/15 via-pink-500/15 to-amber-500/15 border border-rose-500/20 text-center">
                      <p className="text-white font-bold text-xs mb-0.5">Live In-Game Video Call</p>
                      <p className="text-[11px] text-zinc-300">
                        {isCameraOn ? '📹 Your camera is on' : '📷 Camera is off'} • {isMicMuted ? '🔇 Mic muted' : '🎙️ Mic unmuted'}
                      </p>
                    </div>

                    {/* Participant Video Tiles Grid */}
                    <div className="grid grid-cols-1 gap-2.5">
                      {callParticipants.map(participant => (
                        <div
                          key={participant.userId}
                          className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/60 flex items-center justify-center shadow-lg"
                        >
                          {participant.isCameraOn && participant.stream ? (
                            <VideoAvatar
                              stream={participant.stream}
                              isSelf={participant.isSelf}
                              displayName={participant.displayName}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-zinc-400">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-rose-600 text-white font-black text-base flex items-center justify-center shadow">
                                {participant.displayName?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <span className="text-[11px] font-semibold text-zinc-300">Camera Off</span>
                            </div>
                          )}

                          {/* Overlay Name & Mic status */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-sm">
                              {participant.isSelf ? `${participant.displayName} (You)` : participant.displayName}
                            </span>
                            <span
                              className={`p-1 rounded-md backdrop-blur-sm ${
                                participant.isMuted ? 'bg-red-500/80 text-white' : 'bg-emerald-500/80 text-white'
                              }`}
                            >
                              {participant.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* If waiting for Player 2, show waiting slot in drawer */}
                      {callParticipants.length < 2 && (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-dashed border-white/20 bg-black/40 flex flex-col items-center justify-center p-3 text-center shadow-inner">
                          <Users className="w-6 h-6 text-rose-300 mb-1.5 animate-pulse" />
                          <p className="text-xs font-bold text-zinc-200">
                            {opponentPlayer ? opponentPlayer.displayName : 'Waiting for Player 2...'}
                          </p>
                          <p className="text-[10px] text-rose-300/80 mt-0.5">
                            {opponentPlayer ? (opponentPlayer.isConnected ? 'Connecting WebRTC...' : 'Player offline') : 'Invite partner to join!'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quick Call Action Buttons */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={toggleMic}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow ${
                          isMicMuted
                            ? 'bg-rose-600/30 border-rose-500 text-rose-200 hover:bg-rose-600/40'
                            : 'bg-emerald-600/30 border-emerald-400 text-emerald-200 hover:bg-emerald-600/40'
                        }`}
                      >
                        {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>{isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          toggleCamera();
                          if (isPipClosed) setIsPipClosed(false);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow ${
                          isCameraOn
                            ? 'bg-amber-600/30 border-amber-400 text-amber-200 hover:bg-amber-600/40'
                            : 'bg-white/10 border-white/20 text-zinc-300 hover:bg-white/20'
                        }`}
                      >
                        {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                        <span>{isCameraOn ? 'Turn Off Cam' : 'Turn On Cam'}</span>
                      </button>
                    </div>

                    {/* Pop-out floating call hint */}
                    {isPipClosed && (
                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => setIsPipClosed(false)}
                          className="text-[11px] text-amber-300 underline hover:text-amber-200 font-semibold"
                        >
                          Show Floating Mini-Call Window
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Players Tab */}
                {activeSideTab === 'players' && (
                  <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                    {room.players.map(p => (
                      <div
                        key={p.userId}
                        className="p-3 rounded-2xl bg-white/5 border border-rose-500/20 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                            {p.displayName[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white">
                              {p.displayName} {p.userId === effectiveUserId ? '(You)' : ''}
                            </div>
                            <span className="text-[10px] text-rose-300 font-mono">
                              Seat {p.seat === 0 ? '0 (Red 🔴)' : '1 (Yellow 🟡)'}
                            </span>
                          </div>
                        </div>
                        {p.userId !== effectiveUserId && (
                          <button
                            onClick={() => handleNudgePlayer(p.userId, p.displayName)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30"
                          >
                            Nudge
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          VICTORY / ROUND OVER POPUP MODAL
         ========================================================================= */}
      {(winnerInfo || isDraw) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-black/80 border border-white/20 backdrop-blur-2xl shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 mx-auto flex items-center justify-center shadow-xl shadow-rose-600/40 animate-bounce">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">
                {winnerInfo
                  ? winnerInfo.winner === myColor
                    ? '🎉 YOU WON!'
                    : `🎉 ${winnerInfo.winnerColor?.toUpperCase()} WINS!`
                  : '🤝 GAME DRAW!'}
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                {winnerInfo
                  ? `${winnerInfo.winnerColor?.toUpperCase()} connected 4 discs in a row!`
                  : 'All 42 grid slots were filled with no 4-in-a-row.'}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  triggerSound('click');
                  rematch();
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Rematch 🔄</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GAME SETTINGS MODAL (Partner Connection, Themes, SFX)
         ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#140a12]/95 border border-rose-500/30 backdrop-blur-2xl shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black text-white">Game Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Partner Connection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" /> Partner Connection
                </span>
                {partner && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Connected
                  </span>
                )}
              </div>

              {/* Personal Partner Code */}
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-zinc-400 font-semibold">Your Personal Code (Share with Partner)</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-black text-rose-300 tracking-wider">
                    {myPartnerCode || 'Generating...'}
                  </span>
                  <button
                    onClick={() => {
                      if (!myPartnerCode) return;
                      navigator.clipboard.writeText(myPartnerCode);
                      setCopiedPartnerCode(true);
                      triggerSound('click');
                      setTimeout(() => setCopiedPartnerCode(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-zinc-200 transition"
                  >
                    {copiedPartnerCode ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPartnerCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Partner Status / Enter Partner Code Form */}
              {partner ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/40 to-black/40 border border-rose-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={partner.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.id}`}
                      alt={partner.displayName}
                      className="w-9 h-9 rounded-xl object-cover border border-rose-400 shadow"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{partner.displayName}</h4>
                      <p className="text-[10px] text-zinc-400 font-mono">Code: {partner.partnerCode}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectPartner}
                    className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition text-xs font-bold"
                    title="Disconnect Partner"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConnectPartner} className="space-y-2">
                  <span className="text-[10px] text-zinc-400 font-semibold">Enter Partner's 8-Digit Code</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={partnerInputCode}
                      onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                      placeholder="E.G. ABC12345"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-mono uppercase text-white focus:outline-none focus:border-rose-400 placeholder:text-zinc-600"
                    />
                    <button
                      type="submit"
                      disabled={isConnectingPartner}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition"
                    >
                      {isConnectingPartner ? 'Linking...' : 'Connect'}
                    </button>
                  </div>
                  {partnerConnectError && (
                    <p className="text-[11px] text-rose-400 font-semibold">{partnerConnectError}</p>
                  )}
                </form>
              )}
            </div>

            {/* Section 2: Board Theme Selector */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-rose-400" /> Dynamic Theme
              </span>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTheme(t.id);
                      triggerSound('click');
                    }}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                      activeTheme === t.id
                        ? 'bg-rose-500/20 border-rose-400 text-white shadow'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg bg-cover bg-center shrink-0 border border-white/20"
                      style={{ backgroundImage: `url(${t.bgUrl})` }}
                    />
                    <span className="text-[11px] font-bold truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3: Sound Effects Toggle */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Audio & Sound FX</h4>
                <p className="text-[10px] text-zinc-400">Synthesized disc drop clicks and victory fanfares</p>
              </div>
              <button
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  triggerSound('click');
                }}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  soundEnabled ? 'bg-rose-600' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RULES MODAL
         ========================================================================= */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#140a12]/95 border border-rose-500/30 backdrop-blur-2xl shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black text-white">Four in a Row Rules</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-rose-100/90 space-y-3 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">1</span>
                <p>
                  <strong>Strict 2-Player Human Duel:</strong> Player 1 controls Red discs (🔴), and Player 2 controls Yellow discs (🟡).
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">2</span>
                <p>
                  <strong>Gravity Drop:</strong> On your turn, tap or click any column. The disc falls down to the lowest empty slot.
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">3</span>
                <p>
                  <strong>Win Condition:</strong> Connect 4 of your discs in a row horizontally, vertically, or diagonally before your opponent.
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">4</span>
                <p>
                  <strong>Strict Zero-Bots Policy:</strong> Rooms only admit real humans. Match begins once both players are seated.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-950/60 transition mt-2 cursor-pointer"
            >
              Got It!
            </button>
          </div>
        </div>
      )}

      {/* CREATE ROOM MODAL (Matching Ludo Modal) */}
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
              <X className="w-5 h-5" />
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
                  Generate your instant 1v1 private duel table
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Duel Mode
                </label>
                <div className="w-full py-3 px-4 rounded-2xl text-xs font-bold border bg-[#ed1c46] border-[#ed1c46] text-white shadow-sm flex items-center justify-between">
                  <span>2 Players (Head-to-Head Duel)</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase font-bold">Standard</span>
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
                  await handleCreateRoom();
                }}
                disabled={isCreatingRoom}
                className="w-full py-4 bg-[#ed1c46] hover:bg-[#d6143c] text-white font-semibold text-sm rounded-2xl shadow-[0_4px_16px_rgba(237,28,70,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>{isCreatingRoom ? 'Setting up Room...' : 'Create Duel Room'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL (Matching Ludo Modal) */}
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
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                isDark ? 'bg-[#185df2]/20 text-[#185df2]' : 'bg-[#dce8fe] text-[#185df2]'
              }`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Join a Room
                </h3>
                <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Enter a room code or your friend's invite code
                </p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleJoinWithCode(e);
                setShowJoinModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Room or Duel Code
                </label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="E.G. FOUR-8F72"
                  autoFocus
                  className={`w-full px-4 py-3.5 rounded-2xl text-base font-mono uppercase tracking-widest border transition-all text-center focus:outline-none focus:ring-1 focus:ring-[#185df2] ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-[#185df2] focus:bg-white/10'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-[#185df2] focus:bg-white'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isJoiningRoom || !roomCodeInput.trim()}
                className="w-full py-4 bg-[#185df2] hover:bg-[#144ecc] text-white font-semibold text-sm rounded-2xl shadow-[0_4px_16px_rgba(24,93,242,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isJoiningRoom ? 'Connecting...' : 'Join Game Now'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function FourInARowPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0e15] flex items-center justify-center text-white">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-zinc-400">Loading Four in a Row Arena...</span>
          </div>
        </div>
      }
    >
      <FourInARowContent />
    </Suspense>
  );
}
