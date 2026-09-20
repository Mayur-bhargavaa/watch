'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Gamepad2,
  Users,
  Copy,
  Check,
  Share2,
  ArrowLeft,
  Sparkles,
  Wifi,
  Bell,
  Send,
  Dice5,
  RefreshCw,
  Clock,
  ShieldCheck,
  Play,
  UserPlus,
  Unlink,
  MessageSquare,
  ChevronRight,
  Info,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Settings,
  HelpCircle,
  Heart,
  Volume2,
  VolumeX,
  X,
  Smile,
  Minus,
  GripHorizontal,
  Palette,
  Crown,
  Zap,
  Lock,
  CornerUpLeft,
  Star,
  Film,
  User,
  Sun,
  Moon,
  ArrowRight,
  RotateCw,
  Tv,
  Ticket,
  LogOut,
  RotateCcw,
  Trophy,
  Home
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
  matchmakeGame,
  createGameRoom,
  getGameRoom,
  joinGameRoom,
  invitePartnerToGame,
  pingPartner,
  sendHeartbeat,
  playWithPartner,
  recordFriendStreak,
  WS_BASE,
  UserSession
} from '../../../lib/api';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { LudoGame, VideoAvatar } from '../../../components/games/LudoGame';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import { StickerPicker, StickerMessageView } from '../../../components/chat/StickerPicker';
import { parseStickerMessage, formatStickerMessage } from '../../../components/chat/StickersData';
import { StreakCelebrationModal } from '../../../components/streaks/StreakCelebrationModal';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { AddFriendModal } from '../../../components/streaks/AddFriendModal';
import { AppSidebar } from '../../../components/layout/AppSidebar';
import { FriendWithStreak } from '../../../lib/api';
import { getRandomRoast } from '../../../lib/roastMessages';

export interface BoardTheme {
  id: string;
  name: string;
  bgUrl: string;
}

const THEMES: BoardTheme[] = [
  {
    id: 'romantic',
    name: 'Romantic Candlelight (Default)',
    bgUrl: '/images/romantic_room_ambient_bg.jpg'
  },
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

function LudoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');

  // Session & User Identity
  const [session, setSession] = useState<UserSession | null>(null);
  const [myPartnerCode, setMyPartnerCode] = useState<string>('');
  const [copiedPartnerCode, setCopiedPartnerCode] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  // Persistent Partner Connection
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
  const [showPartnerConnectInput, setShowPartnerConnectInput] = useState(false);
  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);

  // Global Theme
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Dedicated Loved Ones One-Time Code State
  const [loveCodeInput, setLoveCodeInput] = useState('');
  const [generatedLoveCode, setGeneratedLoveCode] = useState<string | null>(null);
  const [isGeneratingLoveCode, setIsGeneratingLoveCode] = useState(false);
  const [copiedLoveCode, setCopiedLoveCode] = useState(false);
  const [copiedLoveLink, setCopiedLoveLink] = useState(false);
  const [isJoiningLoveRoom, setIsJoiningLoveRoom] = useState(false);
  const [loveSectionError, setLoveSectionError] = useState<string | null>(null);
  const [lovePassTab, setLovePassTab] = useState<'create' | 'join'>('create');

  // Matchmaking Options (Lobby)
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState<2 | 3 | 4>(2);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  // Floating Panels & Drawers
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<'chat' | 'call' | 'players'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const prevMessagesCountRef = useRef<number>(0);
  const lastStickerSentRef = useRef<number>(0);

  const handleJumpToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`ludo-chat-msg-${msgId}`);
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

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  // Sound effects setting & Draggable PIP Window State
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<string>('romantic');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ludo_theme_id');
      if (saved && THEMES.some(t => t.id === saved)) {
        setSelectedTheme(saved);
      }
    }
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo_theme_id', themeId);
    }
    sendChangeTheme(themeId);
  };

  const currentTheme = useMemo(() => {
    return THEMES.find(t => t.id === selectedTheme) || THEMES[0];
  }, [selectedTheme]);

  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [isPipClosed, setIsPipClosed] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  // Position floating call window at bottom-left of Room Code Card by default
  useEffect(() => {
    if (typeof window !== 'undefined' && pipPosition === null) {
      if (window.innerWidth >= 1024) {
        // Desktop: Left side directly below Room Code Card
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

  // Active Game Room WebSocket hook
  const {
    room,
    players,
    gameState,
    myPlayer,
    isMyTurn,
    canRoll,
    canMove,
    legalMoves,
    lastDiceRoll,
    lastTokenMove,
    chatMessages,
    floatingReactions,
    connectionStatus,
    error: wsError,
    disconnectedPlayer,
    nudgeAlert,
    opponentLeftWin,
    clearOpponentLeftWin,
    roomTheme,
    typingUsers,
    rollDice,
    moveToken,
    sendChat,
    sendReaction,
    sendNudge,
    sendLeave,
    rematch,
    rematchStatus,
    sendChangeTheme,
    sendTyping,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomParam);

  // Authoritative theme sync across room players
  useEffect(() => {
    if (roomTheme && THEMES.some(t => t.id === roomTheme)) {
      setSelectedTheme(roomTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ludo_theme_id', roomTheme);
      }
    }
  }, [roomTheme]);

  // Transform active typing users dictionary into a clean list
  const typingList = useMemo(() => {
    return Object.entries(typingUsers || {}).map(([userId, data]) => ({
      userId,
      userName: data.userName
    }));
  }, [typingUsers]);

  const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);

  const handleNudgePlayer = useCallback((targetUserId?: string, targetDisplayName?: string) => {
    sendNudge(targetUserId);
    const name = targetDisplayName || 'Partner';
    setNudgeFeedback(`Nudged ${name}! 🔔`);
    setTimeout(() => setNudgeFeedback(null), 3500);
  }, [sendNudge]);

  const [dismissVictoryModal, setDismissVictoryModal] = useState<boolean>(false);

  useEffect(() => {
    if (gameState && !gameState.winnerColor) {
      setDismissVictoryModal(false);
    }
  }, [gameState?.winnerColor]);

  const handleNudgeForRematch = () => {
    const roast = getRandomRoast('game');
    sendNudge(undefined, roast.body);
    setNudgeFeedback(`🛵 Nudge sent: "${roast.body}"`);
    setTimeout(() => setNudgeFeedback(null), 4000);
  };

  // WebRTC Audio / Video Call hook for In-Game Calling
  const effectiveUserId = myPlayer?.userId || session?.user?.id || (typeof window !== 'undefined' ? getStoredSession()?.user?.id : '') || '';

  const sendScreenState = useCallback((_isSharing: boolean) => {}, []);
  const webRTCMembers = useMemo(() => {
    return (room?.players || []).map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      isHost: p.seat === 0,
      isConnected: p.isConnected !== false,
      joinedAt: ''
    }));
  }, [room?.players]);

  const {
    isCameraOn,
    isMicMuted,
    mediaNotice,
    clearMediaNotice,
    localUserStream,
    toggleCamera,
    toggleMic,
    videoGridParticipants,
    stopAllMediaTracks
  } = useWebRTC({
    myUserId: effectiveUserId,
    members: webRTCMembers as any,
    screenPresenter: null,
    sendWebRTCSignal,
    sendScreenState,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  });

  const participantStreamsByUserId = useMemo(() => {
    const map: Record<string, VideoGridParticipant> = {};
    for (const p of videoGridParticipants) {
      map[p.userId] = p;
    }
    // Also explicitly map effectiveUserId, myPlayer.userId, and 'me' to local participant
    const localP = videoGridParticipants.find(p => p.isSelf);
    if (localP) {
      if (effectiveUserId) map[effectiveUserId] = localP;
      if (myPlayer?.userId) map[myPlayer.userId] = localP;
      map['me'] = localP;
    }
    return map;
  }, [videoGridParticipants, effectiveUserId, myPlayer]);

  // Auto-scroll chat to bottom only when a new message arrives and user isn't reading history
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

  // Initialize Session & Partner Code
  const loadUserAndPartner = useCallback(async () => {
    try {
      let currentSession = getStoredSession();
      if (!currentSession) {
        currentSession = await ensureSession();
      }
      setSession(currentSession);
      if (currentSession?.user?.partnerCode) {
        setMyPartnerCode(currentSession.user.partnerCode);
      }

      if (currentSession?.token) {
        const meRes = await getUserMe(currentSession.token).catch(() => null);
        if (meRes?.user?.partnerCode) {
          setMyPartnerCode(meRes.user.partnerCode);
          if (currentSession.user) {
            currentSession.user.partnerCode = meRes.user.partnerCode;
            try {
              localStorage.setItem('synccinema_session', JSON.stringify(currentSession));
            } catch {}
          }
        }

        const queryPartnerCode = searchParams.get('partnerCode') || searchParams.get('code');
        const queryFriendId = searchParams.get('friendId');
        if (queryPartnerCode || queryFriendId) {
          try {
            const connectRes = await connectUserPartner(currentSession.token, queryPartnerCode || undefined, queryFriendId || undefined);
            if (connectRes?.partner) {
              setPartner(connectRes.partner);
              return;
            }
          } catch {}
        }

        const partnerRes = await getUserPartner(currentSession.token).catch(() => null);
        if (partnerRes?.partner) {
          setPartner(partnerRes.partner);
        }
      }
    } catch (err) {
      console.warn('Could not initialize session:', err);
    }
  }, []);

  useEffect(() => {
    loadUserAndPartner();
  }, [loadUserAndPartner]);

  // Incoming Invite
  const [incomingInvite, setIncomingInvite] = useState<{
    fromUserId: string;
    fromDisplayName: string;
    fromPartnerCode: string;
    roomCode: string;
    gameType: string;
  } | null>(null);

  // Live presence heartbeat fallback (15s interval to keep network free for video streams)
  useEffect(() => {
    if (!session?.token) return;

    sendHeartbeat(session.token)
      .then((res: any) => {
        if (res?.partner) setPartner(res.partner);
        if (res?.myPartnerCode) setMyPartnerCode(res.myPartnerCode);
      })
      .catch(() => {});

    const interval = setInterval(() => {
      sendHeartbeat(session.token)
        .then((res: any) => {
          if (res?.partner) setPartner(res.partner);
          if (res?.myPartnerCode) setMyPartnerCode(res.myPartnerCode);
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [session]);

  // Global Presence WebSocket
  useEffect(() => {
    if (!session) return;
    let wsUrl = `${WS_BASE}/ws/presence`;
    if (session.token) {
      wsUrl += `?token=${encodeURIComponent(session.token)}`;
    } else {
      wsUrl += `?guestId=${session.user.id}&guestName=${encodeURIComponent(session.user.displayName)}`;
    }

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'partner:game_invite') {
            const invite = data.payload || data.invite;
            if (invite && invite.roomCode) {
              setIncomingInvite(invite);
            }
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (socket) socket.close();
    };
  }, [session]);

  // Copy helpers
  const handleCopyPartnerCode = () => {
    if (!myPartnerCode) return;
    navigator.clipboard.writeText(myPartnerCode);
    setCopiedPartnerCode(true);
    setTimeout(() => setCopiedPartnerCode(false), 2000);
  };

  const handleCopyRoomCode = () => {
    const code = room?.roomCode || roomParam;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleCopyRoomLink = () => {
    if (typeof window === 'undefined') return;
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setCopiedRoomLink(true);
    setTimeout(() => setCopiedRoomLink(false), 2000);
  };

  // Connect Partner
  const handleConnectPartner = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = partnerInputCode.trim().toUpperCase();
    if (!code) return;

    setIsConnectingPartner(true);
    setPartnerConnectError(null);
    try {
      if (!session?.token) throw new Error('You must be logged in to connect a partner');
      const res = await connectUserPartner(session.token, code);
      setPartner(res.partner);
      setPartnerInputCode('');
    } catch (err: any) {
      setPartnerConnectError(err.message || 'Failed to connect partner');
    } finally {
      setIsConnectingPartner(false);
    }
  };

  // Disconnect Partner
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
          } catch (err) {
            console.error(err);
          }
        }
      }
    );
  };

  // Ping Partner
  const handlePingPartner = async () => {
    if (!partner || !session?.token) return;
    setIsPingingPartner(true);
    const currentRoomCode = room?.roomCode || roomParam;
    try {
      if (currentRoomCode) {
        const res = await invitePartnerToGame(session.token, partner.partnerCode, currentRoomCode, 'ludo');
        if (res.deliveredLive) {
          setPartnerPingStatus(`🚀 Game invite delivered live to ${partner.displayName}!`);
        } else {
          setPartnerPingStatus(`🔔 Game invite sent to ${partner.displayName}!`);
        }
      } else {
        const roast = getRandomRoast('game');
        const res = await pingPartner({
          targetCode: partner.partnerCode,
          fromCode: myPartnerCode,
          fromName: session.user.displayName,
          roomCode: undefined,
          gameType: 'ludo',
          customMessage: roast.body
        });
        if (res.deliveredLive) {
          setPartnerPingStatus(`🚀 Live roast delivered to ${partner.displayName}! "${roast.body}"`);
        } else {
          setPartnerPingStatus(`🔔 Ping notification queued for ${partner.displayName}!`);
        }
      }
    } catch (err: any) {
      setPartnerPingStatus(`⚠️ ${err.message || 'Failed to ping partner'}`);
    } finally {
      setIsPingingPartner(false);
      setTimeout(() => setPartnerPingStatus(null), 5000);
    }
  };

  // Play with Partner
  const handlePlayWithPartner = async (customFriendId?: string | React.MouseEvent) => {
    if ((!partner && typeof customFriendId !== 'string') || !session?.token) return;
    setIsMatchmaking(true);
    setLobbyError(null);
    try {
      const targetId = typeof customFriendId === 'string' ? customFriendId : partner?.id;
      const res = await playWithPartner(session.token, 'ludo', targetId);
      router.push(`/games/ludo?room=${res.room.roomCode}`);
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

  // Public Matchmaking
  const handleSmartMatchmake = async (count: 2 | 3 | 4) => {
    if (!session?.token) {
      const ensured = await ensureSession();
      setSession(ensured);
    }
    setIsMatchmaking(true);
    setLobbyError(null);
    try {
      const currentToken = session?.token || (getStoredSession()?.token ?? '');
      const res = await matchmakeGame(currentToken, 'ludo', count);
      router.push(`/games/ludo?room=${res.room.roomCode}`);
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to matchmake');
      setIsMatchmaking(false);
    }
  };

  // Join with Code
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
          setLobbyError(`Room ${code} is already full (${roomRes.room.players.length}/${roomRes.room.maxPlayers} players).`);
          setIsJoiningRoom(false);
          return;
        }
        if (session?.token) {
          await joinGameRoom(session.token, code).catch(() => null);
        }
        router.push(`/games/ludo?room=${code}`);
        return;
      }

      // 2. Check if user entered their Partner's Code
      if (session?.token) {
        try {
          const partnerRes = await connectUserPartner(session.token, code);
          if (partnerRes?.partner) {
            setPartner(partnerRes.partner);
            setIsJoiningRoom(false);
            setRoomCodeInput('');
            showAlert(
              'Partner Connected! 💕',
              `Connected with partner ${partnerRes.partner.displayName}! You can now click "Play Together" to start a match.`,
              'success'
            );
            return;
          }
        } catch {
          // not partner code
        }
      }

      // 3. Fallback: navigate to room directly
      router.push(`/games/ludo?room=${code}`);
    } catch (err: any) {
      setLobbyError(err.message || `Could not join room ${code}`);
      setIsJoiningRoom(false);
    }
  };

  // Create Private Room
  const handleCreateCustomRoom = async () => {
    if (!session?.token) return;
    setIsMatchmaking(true);
    setLobbyError(null);
    try {
      const res = await createGameRoom(session.token, 'ludo', selectedMaxPlayers, true);
      router.push(`/games/ludo?room=${res.room.roomCode}`);
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to create room');
      setIsMatchmaking(false);
    }
  };

  // Generate One-Time Love Code (2-Player Intimate Duel for Loved Ones)
  const handleGenerateLoveCode = async () => {
    if (!session?.token) {
      setLoveSectionError('Please make sure you are logged in to generate a room code.');
      return;
    }
    setIsGeneratingLoveCode(true);
    setLoveSectionError(null);
    try {
      const res = await createGameRoom(session.token, 'ludo', 2, true);
      setGeneratedLoveCode(res.room.roomCode);
    } catch (err: any) {
      setLoveSectionError(err.message || 'Failed to generate one-time love code.');
    } finally {
      setIsGeneratingLoveCode(false);
    }
  };

  const handleCopyLoveCode = () => {
    if (!generatedLoveCode) return;
    navigator.clipboard.writeText(generatedLoveCode);
    setCopiedLoveCode(true);
    setTimeout(() => setCopiedLoveCode(false), 2000);
  };

  const handleCopyLoveLink = () => {
    if (!generatedLoveCode) return;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/games/ludo?room=${generatedLoveCode}` : '';
    navigator.clipboard.writeText(url);
    setCopiedLoveLink(true);
    setTimeout(() => setCopiedLoveLink(false), 2000);
  };

  const handleJoinWithLoveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = loveCodeInput.trim().toUpperCase();
    if (!code) return;
    setIsJoiningLoveRoom(true);
    setLoveSectionError(null);
    try {
      router.push(`/games/ludo?room=${code}`);
    } catch (err: any) {
      setLoveSectionError(err.message || 'Failed to join love room.');
      setIsJoiningLoveRoom(false);
    }
  };

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChatInput(val);
    if (val.trim()) {
      sendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2500);
    } else {
      sendTyping(false);
    }
  };

  // Send Chat
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(false);
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

  const isWaiting = room && room.status === 'WAITING';
  const isPlayingOrFinished = room && (room.status === 'PLAYING' || room.status === 'FINISHED') && gameState !== null;

  // Find opponent player
  const opponentPlayer = useMemo(() => {
    if (!room) return null;
    return room.players.find(p => p.userId !== session?.user?.id) || null;
  }, [room, session]);

  // Friend streak celebration state
  const [streakCelebration, setStreakCelebration] = useState<{
    friendName: string;
    streakCount: number;
    isExtended: boolean;
  } | null>(null);
  const streakRecordedPairRef = useRef<string | null>(null);

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
        .catch(() => {
          // Silently ignore if opponent is not added as friend
        });
    }
  }, [room?.status, opponentPlayer?.userId, session?.token, opponentPlayer?.displayName]);

  // Opponent status and disconnection detection
  const isOpponentDisconnected = useMemo(() => {
    if (opponentPlayer && !opponentPlayer.isConnected) return true;
    if (disconnectedPlayer && disconnectedPlayer.userId !== myPlayer?.userId) return true;
    return false;
  }, [opponentPlayer, disconnectedPlayer, myPlayer]);

  const disconnectedOpponentName = opponentPlayer?.displayName || disconnectedPlayer?.displayName || 'Partner';

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

      {/* ========================================================================= */}
      {/* 1. CENTRALIZED APPSIDEBAR NAVIGATION (WHEN IN LOBBY)                       */}
      {/* ========================================================================= */}
      {!roomParam && (
        <AppSidebar
          activeNav="games"
        />
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA (FULL-SCREEN IN MATCH, ADAPTIVE IN LOBBY)            */}
      {/* ========================================================================= */}
      <div className={`flex-1 flex flex-col relative ${
        roomParam ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'
      }`}>
        {/* TOP NAVIGATION BAR */}
        <header className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200 ${
          isDark || isWaiting ? 'bg-[#14151b]/85 border-white/[0.08]' : 'bg-white/95 border-zinc-200/80 shadow-xs'
        }`}>
          {/* Left: Breadcrumbs or Leave Match */}
          <div className="flex items-center gap-3">
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
                        router.push('/games/ludo');
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
                  <span className="text-[#ee1d49] font-bold">Ludo Arena</span>
                </div>
              </div>
            )}
          </div>

        {/* Center Header: Room Param or Show Call pill */}
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
          {/* Audio / Mic Toggle Button */}
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
              onClick={toggleCamera}
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

          {/* Help / Rules Button */}
          <button
            onClick={() => setShowRulesModal(true)}
            className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
              isDark
                ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300 hover:text-white'
                : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-950'
            }`}
            title="Ludo Rules & Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Rematch / Restart Button */}
          {roomParam && (
            <button
              onClick={() => {
                if (gameState?.winnerColor) {
                  rematch();
                } else {
                  showAlert(
                    'Restart Match?',
                    'Would you like to reset the board and request a rematch with all players in the room?',
                    'info',
                    {
                      confirmText: 'Request Rematch',
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
              title="Rematch / Restart"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Settings Button */}
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
                Call ({videoGridParticipants.length})
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

          {/* Video Boxes Side by Side (matching user reference image) */}
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

      {/* Media Notice Modal */}
      {mediaNotice && (
        <AlertModal
          isOpen={!!mediaNotice}
          onClose={clearMediaNotice}
          title="Device Notice"
          message={mediaNotice}
          type="warning"
          confirmText="Understood"
        />
      )}

      {/* Live Incoming Partner Game Invite Modal */}
      {incomingInvite && (
        <AlertModal
          isOpen={!!incomingInvite}
          onClose={() => setIncomingInvite(null)}
          title="Game Invite Received"
          message={
            <div className="space-y-2 text-center">
              <p className="text-white font-medium">
                <span className="text-rose-300 font-bold">{incomingInvite.fromDisplayName}</span> invited you to play Ludo together!
              </p>
              <div className="inline-block px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 font-mono text-xs text-rose-200">
                Room: {incomingInvite.roomCode}
              </div>
            </div>
          }
          type="info"
          confirmText="Accept & Play"
          cancelText="Dismiss"
          onConfirm={() => {
            const code = incomingInvite.roomCode;
            setIncomingInvite(null);
            router.push(`/games/ludo?room=${code}`);
          }}
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
        gameTitle="Ludo"
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

      {/* Opponent Left Victory Modal */}
      {opponentLeftWin && (
        <AlertModal
          isOpen={!!opponentLeftWin}
          onClose={clearOpponentLeftWin}
          title="Match Won!"
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


      {/* MAIN CONTAINER */}
      <main className={`flex-1 w-full flex flex-col justify-start z-10 ${
        roomParam && !isWaiting
          ? 'max-w-[1600px] mx-auto p-3 sm:p-5'
          : (roomParam && isWaiting
              ? 'max-w-none p-0 h-[calc(100vh-4rem)] relative overflow-hidden'
              : 'h-[calc(100vh-4rem)] max-w-none p-0 overflow-hidden')
      }`}>
        {/* ROOM VIEW: CONNECTING OR ERROR STATE */}
        {roomParam && !isWaiting && !isPlayingOrFinished && (
          <div className="w-full max-w-md mx-auto my-auto p-8 rounded-3xl bg-black/60 border border-white/20 backdrop-blur-2xl text-center space-y-4 shadow-2xl">
            {wsError ? (
              <>
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <X className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Room Error</h3>
                <p className="text-xs text-rose-200/80">{wsError}</p>
                <button
                  onClick={() => router.push('/games/ludo')}
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
                  onClick={() => router.push('/games/ludo')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* ROOM VIEW: WAITING ROOM (Exact pixel-to-pixel match with reference mockup) */}
        {roomParam && isWaiting && (
          <div className="relative w-full h-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Cozy cinematic waiting room background */}
            <div
              className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat select-none pointer-events-none"
              style={{ backgroundImage: `url('/images/ludo-waiting-bg.jpg')` }}
            >
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />
            </div>

            {/* Floating Glassmorphic Waiting Card */}
            <div className="relative z-10 w-full max-w-xl my-auto rounded-[32px] sm:rounded-[36px] p-6 sm:p-8 bg-[#0e0c18]/70 border border-white/20 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.7),0_0_35px_rgba(255,43,94,0.12)] text-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              {/* Strict Zero-Bots Matchmaking Pill */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0d2a20]/90 border border-[#10b981]/50 text-[#34d399] text-[11px] font-semibold tracking-wide mb-4 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Strict Zero-Bots Matchmaking</span>
              </div>

              {/* Waiting for Players Heading */}
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
                Waiting <span className="font-medium text-white/90">for</span> <span className="text-[#ff2b5e]">Players</span>
              </h2>

              {/* Match Subtitle */}
              <p className="text-xs sm:text-[13px] text-zinc-300 font-normal leading-relaxed max-w-sm mx-auto mb-6">
                Match will begin automatically when <span className="text-[#ff2b5e] font-semibold">{room.maxPlayers} human players</span> join.
                <br />
                No bots will ever be injected.
              </p>

              {/* Room Code Card */}
              <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 mb-5 shadow-inner">
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

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyRoomCode}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white transition cursor-pointer active:scale-95"
                    title="Copy Code"
                  >
                    {copiedRoomCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyRoomLink}
                    className="py-2.5 px-4 sm:px-5 bg-gradient-to-r from-[#ff2b5e] to-[#f43f5e] hover:from-[#e11d48] hover:to-[#be123c] text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(255,43,94,0.4)] transition active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{copiedRoomLink ? 'Link Copied!' : 'Share Link'}</span>
                  </button>
                </div>
              </div>

              {/* Joined Seats Section */}
              <div className="w-full mb-5">
                <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-3 px-0.5">
                  <span>Joined Seats ({room.players.length}/{room.maxPlayers})</span>
                  <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-normal">
                    <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80 inline-block shrink-0" />
                    <span>{room.maxPlayers - room.players.length} seat remaining</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {Array.from({ length: room.maxPlayers }).map((_, seatIdx) => {
                    const player = room.players.find(p => p.seat === seatIdx);
                    if (player) {
                      return (
                        <div
                          key={seatIdx}
                          className="bg-[#181322]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md min-h-[120px]"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                            {(player.displayName?.[0] || 'P').toUpperCase()}
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                            {player.displayName}
                          </span>
                          <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                            {player.seat === 0 ? (
                              <>
                                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Host
                              </>
                            ) : (
                              <>
                                <User className="w-3.5 h-3.5 text-zinc-400" /> Player
                              </>
                            )}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={seatIdx}
                        className="bg-[#14111d]/60 border border-dashed border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner min-h-[120px]"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mb-2">
                          <User className="w-5 h-5 text-zinc-400" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-zinc-300">Waiting...</span>
                        <span className="text-[11px] text-zinc-500 mt-0.5">Player {seatIdx + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Partner Quick-Invite Container */}
              <div className="w-full bg-[#161220]/90 border border-white/10 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-inner">
                {partner ? (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#ff2b5e] to-[#d6143c] text-white font-black text-xs flex items-center justify-center shrink-0">
                        {(partner.displayName?.[0] || partner.partnerCode?.[0] || 'P').toUpperCase()}
                      </div>
                      <div className="text-left min-w-0">
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
                      className="py-2 px-3.5 sm:px-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-white" />
                      <span>{isPingingPartner ? 'Inviting...' : 'Invite Partner'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 text-left min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-rose-400 flex items-center justify-center shrink-0">
                        <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Invite your Partner</span>
                        <span className="text-[10px] text-zinc-400 block">Link codes to invite with 1-click</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(true)}
                      className="py-2 px-3.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
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

        {/* ROOM VIEW: ACTIVE / FINISHED MATCH (Exact Layout from Reference Image) */}
        {roomParam && isPlayingOrFinished && (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-6 relative">
            {/* Left Column: Floating Room Code Card & Ambient Neon Quotes */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
              {/* Floating Room Code Card */}
              <div className="p-4 rounded-3xl bg-[#1d0c18]/90 border border-rose-500/25 shadow-xl backdrop-blur-xl">
                <span className="text-[10px] font-bold text-rose-300/80 uppercase tracking-wider block">
                  Room Code
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xl font-mono font-black text-white tracking-wider">
                    {room.roomCode}
                  </span>
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
                  <span>{room.players.length} Players • {room.isPrivate ? 'Private Room' : 'Public Room'}</span>
                </div>
              </div>
            </div>

            {/* Center Column: The 3D Wooden Board with Flanking Cards & Bottom Controls */}
            <div className="flex-1 w-full max-w-2xl sm:max-w-3xl mx-auto flex flex-col items-center">
              <LudoGame
                room={room}
                gameState={gameState}
                myPlayer={myPlayer}
                isMyTurn={isMyTurn}
                canRoll={canRoll}
                canMove={canMove}
                legalMoves={legalMoves}
                onRollDice={rollDice}
                onMoveToken={moveToken}
                onRematch={rematch}
                onSendReaction={sendReaction}
                onSendQuickChat={sendChat}
                onNudgePlayer={handleNudgePlayer}
                floatingReactions={floatingReactions}
                participantStreamsByUserId={participantStreamsByUserId}
                localUserStream={localUserStream}
                isCameraOn={isCameraOn}
                isMicMuted={isMicMuted}
                lastDiceRoll={lastDiceRoll}
                lastTokenMove={lastTokenMove}
              />
            </div>

            {/* Right Column: Floating Game Chat & Audio/Video Call Window */}
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
                        : isCameraOn || !isMicMuted
                        ? 'text-emerald-300 hover:text-emerald-200'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Call {(isCameraOn || videoGridParticipants.some(p => p.isCameraOn)) ? '🔴' : ''}</span>
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
                          <p className="text-xs font-medium">Say something sweet or cheer a move!</p>
                        </div>
                      ) : (
                        chatMessages.map(m => {
                          const isMe = m.userId === session?.user?.id;
                          const isSticker = parseStickerMessage(m.content);
                          const isHighlighted = highlightedMsgId === m.id;
                          return (
                            <div
                              key={m.id}
                              id={`ludo-chat-msg-${m.id}`}
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
                                    {/* Reply action button */}
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

                    {/* Quick Reactions & Quick Chat Phrases inside Chat Options */}
                    <div className="pt-2 pb-1 space-y-2 border-t border-rose-500/20">
                      {/* Emoji Reactions Row */}
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

                      {/* Quick Chat Phrases Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {['Good Luck! 🍀', 'Nice Move! 👏', 'Oops! 🙈', 'Well Played! 🌟', 'Hurry Up! ⏰', 'GG! 🏆'].map(text => (
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
                      {/* Live Typing Indicator */}
                      {typingList.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 mb-1.5 text-[11px] text-pink-300 animate-pulse font-medium bg-pink-950/40 rounded-full border border-pink-500/20 w-fit backdrop-blur-sm">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                          <span>
                            {typingList.map(u => u.userName).join(', ')} is typing...
                          </span>
                        </div>
                      )}

                      {/* Floating Sticker Picker Tray */}
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
                            onClose={() => setShowStickerPicker(false)}
                          />
                        </div>
                      )}

                      {/* Replying-to Preview Bar */}
                      {replyingTo && (
                        <ChatReplyingBanner
                          replyingTo={replyingTo}
                          onCancel={() => setReplyingTo(null)}
                          accentColor="rose"
                        />
                      )}

                      <form onSubmit={handleSendChat} className="flex items-center gap-2">
                        <div className="flex-1 relative flex items-center">
                          <input
                            ref={chatInputRef}
                            type="text"
                            value={chatInput}
                            onChange={handleChatInputChange}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' && replyingTo) {
                                setReplyingTo(null);
                              }
                            }}
                            onBlur={() => sendTyping(false)}
                            placeholder={replyingTo ? `Replying to ${replyingTo.userName}...` : "Type a message or send stickers..."}
                            className="w-full pl-3.5 pr-16 py-2.5 bg-black/40 border border-rose-500/30 rounded-2xl text-xs text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400"
                          />
                          <div className="absolute right-2 flex items-center gap-1">
                            {/* Sticker Button */}
                            <button
                              type="button"
                              onClick={() => setShowStickerPicker(prev => !prev)}
                              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                showStickerPicker
                                  ? 'text-pink-400 bg-pink-500/20'
                                  : 'text-zinc-400 hover:text-pink-300 hover:bg-white/10'
                              }`}
                              title="Send stickers"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            {/* Smiley Button */}
                            <button
                              type="button"
                              onClick={() => setChatInput(prev => `${prev} 😊`)}
                              className="p-1 rounded-lg text-rose-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              title="Add smile"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="p-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-rose-900/50 shrink-0 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </>
                )}

                {/* Tab 2: Live Audio & Video Call */}
                {activeSideTab === 'call' && (
                  <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-purple-500/10 border border-rose-500/20 text-center">
                      <p className="text-white font-bold text-xs mb-0.5">Live In-Game Video Call</p>
                      <p className="text-[11px] text-zinc-300">
                        {isCameraOn ? '📹 Your camera is on' : '📷 Camera is off'} • {isMicMuted ? '🔇 Mic muted' : '🎙️ Mic unmuted'}
                      </p>
                    </div>

                    {/* Participant Video Tiles Grid */}
                    <div className="grid grid-cols-1 gap-2.5">
                      {videoGridParticipants.map(participant => (
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
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600 text-white font-black text-base flex items-center justify-center shadow">
                                {participant.displayName[0]?.toUpperCase()}
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
                        onClick={toggleCamera}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow ${
                          isCameraOn
                            ? 'bg-rose-600/30 border-rose-500 text-rose-200 hover:bg-rose-600/40'
                            : 'bg-white/10 border-white/20 text-zinc-300 hover:bg-white/20'
                        }`}
                      >
                        {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                        <span>{isCameraOn ? 'Turn Cam Off' : 'Turn Cam On'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 3: Players Roster */}
                {activeSideTab === 'players' && (
                  <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                    {room.players.map((p) => {
                      const isMe = p.userId === session?.user?.id;
                      const pColor = p.color || 'red';
                      const tokens = gameState.tokens[pColor] || [];
                      const finishedCount = tokens.filter((t: any) => t.step === 56).length;

                      return (
                        <div
                          key={p.userId}
                          className="p-3 rounded-2xl bg-white/5 border border-rose-500/20 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow"
                              style={{
                                backgroundColor:
                                  pColor === 'red' ? '#e62446' :
                                  pColor === 'green' ? '#0eb563' :
                                  pColor === 'yellow' ? '#f59e0b' : '#1d70e8'
                              }}
                            >
                              {p.displayName[0]?.toUpperCase()}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-xs">{p.displayName}</span>
                                {p.seat === 0 && <Crown className="w-3 h-3 text-amber-400 inline" />}
                                {isMe && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                                    You
                                  </span>
                                )}
                              </div>

                              <span className="text-[10px] text-zinc-400 capitalize block mt-0.5">
                                {pColor} • {finishedCount}/4 In Home
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOBBY VIEW (When not in an active room) */}
        {!roomParam && (
          <div className={`w-full h-full flex flex-col justify-between relative z-10 select-none px-6 sm:px-10 lg:px-14 py-4 sm:py-6 overflow-hidden transition-colors duration-200 ${
            isDark ? 'bg-[#0c0d12] text-white' : 'bg-white text-zinc-900'
          }`}>
            {/* Top / Main Hero Container */}
            <div className="w-full flex-1 flex items-center max-w-7xl mx-auto">
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Column: Eyebrow, Title, Subtitle, Two Action Cards */}
                <div className="lg:col-span-7 flex flex-col justify-center">
                  
                  {/* Eyebrow */}
                  <div className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-[#f43f5e] uppercase mb-2 sm:mb-3">
                    ROLL • MOVE • HAVE FUN
                  </div>

                  {/* Main Hero Heading */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-none mb-3 sm:mb-4">
                    <span className="text-[#ee1d49]">Ludo</span>{' '}
                    <span className={isDark ? 'text-white' : 'text-[#131727]'}>Arena</span>
                  </h1>

                  {/* Subtitle */}
                  <p className={`text-xs sm:text-sm lg:text-base font-medium max-w-lg leading-relaxed mb-4 sm:mb-5 ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    Play real-time Ludo with your friends. Simple. Fun.
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
                              onClick={() => setIsFriendDrawerOpen(true)}
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
                          Start a new game and invite your friends.
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
                      src={isDark ? "/images/ludo-3d-board-dark.png" : "/images/ludo-3d-board.png"}
                      alt="Ludo Arena 3D Board"
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
      </main>


      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative ${
            isDark ? 'bg-[#14151b] border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
          }`}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={`absolute top-5 right-5 p-2 rounded-full transition ${
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
                  Select players and generate your instant table
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs font-semibold block mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Number of Players
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {([2, 3, 4] as const).map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSelectedMaxPlayers(count)}
                      className={`py-3 px-3 rounded-2xl text-xs font-bold transition-all border ${
                        selectedMaxPlayers === count
                          ? 'bg-[#ed1c46] border-[#ed1c46] text-white shadow-sm'
                          : isDark
                          ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }`}
                    >
                      {count} Players {count === 2 ? '(Duel)' : ''}
                    </button>
                  ))}
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
                <span>{isMatchmaking ? 'Setting up Room...' : `Create ${selectedMaxPlayers}-Player Room`}</span>
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
              className={`absolute top-5 right-5 p-2 rounded-full transition ${
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
                  placeholder="E.G. LUDO-8F72"
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


      {/* =========================================================================
          VICTORY / ROUND OVER POPUP MODAL (2-Player Agreement, Waiting Screen, Nudge & Home)
         ========================================================================= */}
      {gameState?.winnerColor && !dismissVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#140a15]/95 border border-white/20 backdrop-blur-2xl shadow-2xl text-center space-y-4 relative">
            {/* Close button to inspect winning board */}
            <button
              type="button"
              onClick={() => setDismissVictoryModal(true)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Inspect Board"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 mx-auto flex items-center justify-center shadow-xl shadow-rose-600/40 animate-bounce">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">
                {myPlayer?.color === gameState.winnerColor
                  ? '🎉 YOU WON!'
                  : `🎉 ${gameState.winnerColor.toUpperCase()} WINS!`}
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                {gameState.winnerColor.toUpperCase()} has moved all pawns Home and won the Ludo Arena!
              </p>
            </div>

            {/* Rematch Agreement & Waiting Status */}
            {(() => {
              const myId = session?.user?.id || myPlayer?.userId || '';
              const hasVoted = Boolean(rematchStatus?.votedUserIds?.includes(myId));
              const votedCount = rematchStatus?.votedCount ?? 0;
              const totalNeeded = rematchStatus?.totalNeeded ?? 2;
              const allVoted = Boolean(rematchStatus?.allVoted);

              if (allVoted) {
                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-emerald-400 text-xs font-black">
                      <Check className="w-4 h-4" />
                      <span>Both players agreed! Starting rematch...</span>
                    </div>
                  </div>
                );
              }

              if (hasVoted) {
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-center space-x-2 text-amber-400 text-xs font-black">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      <span>Waiting for partner to accept rematch ({votedCount}/{totalNeeded})</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Match will start as soon as both players click rematch.
                    </p>

                    {/* Nudge Partner Button */}
                    <button
                      type="button"
                      onClick={handleNudgeForRematch}
                      className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <span>🛵</span>
                      <span>Nudge Partner to Rematch 💬</span>
                    </button>
                    {nudgeFeedback && (
                      <p className="text-[10px] text-emerald-400 font-semibold animate-fadeIn">
                        {nudgeFeedback}
                      </p>
                    )}
                  </div>
                );
              }

              if (votedCount > 0 && !hasVoted) {
                return (
                  <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-center space-y-1 animate-pulse">
                    <p className="text-xs font-black text-rose-300">
                      🔥 Partner requested a rematch! ({votedCount}/{totalNeeded})
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      Click Play Rematch below to accept and begin!
                    </p>
                  </div>
                );
              }

              return (
                <div className="text-[11px] text-zinc-400">
                  Both players must agree to start a rematch.
                </div>
              );
            })()}

            {/* Action Buttons: Home & Rematch */}
            <div className="flex gap-2.5 pt-2">
              {/* Go Home */}
              <button
                type="button"
                onClick={() => {
                  sendLeave();
                  router.push('/games');
                }}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-bold border border-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-4 h-4 text-zinc-400" />
                <span>Go Home 🏠</span>
              </button>

              {/* Rematch */}
              <button
                type="button"
                disabled={rematchStatus?.votedUserIds?.includes(session?.user?.id || myPlayer?.userId || '')}
                onClick={() => {
                  rematch();
                }}
                className={`flex-1 py-3 rounded-2xl text-white text-xs font-black shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  rematchStatus?.votedUserIds?.includes(session?.user?.id || myPlayer?.userId || '')
                    ? 'bg-zinc-700 opacity-60 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 active:scale-95 shadow-rose-600/30'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {rematchStatus?.votedUserIds?.includes(session?.user?.id || myPlayer?.userId || '')
                    ? 'Waiting (1/2)'
                    : 'Play Rematch 🔄'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Header Banner when Victory Modal is closed to inspect board */}
      {gameState?.winnerColor && dismissVictoryModal && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 shadow-2xl animate-fadeIn">
          <span className="text-xs font-black text-white">
            🏆 {gameState.winnerColor.toUpperCase()} Won the Game!
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => setDismissVictoryModal(false)}
            className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
          >
            Rematch Menu 🔄
          </button>
          <button
            type="button"
            onClick={() => {
              sendLeave();
              router.push('/games');
            }}
            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition cursor-pointer"
          >
            Home 🏠
          </button>
        </div>
      )}

      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            isDark ? 'bg-[#14151b] border-white/[0.1]' : 'bg-white border-zinc-200'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b mb-4 ${
              isDark ? 'border-white/[0.08]' : 'border-zinc-200'
            }`}>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-rose-500" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>How to Play Ludo</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className={`p-1.5 rounded-xl transition ${
                  isDark ? 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`space-y-3 text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <Dice5 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p><strong className={isDark ? 'text-white' : 'text-zinc-900'}>Roll a 6:</strong> You must roll a 6 to release a pawn from your Yard onto your Start tile.</p>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <RefreshCw className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p><strong className={isDark ? 'text-white' : 'text-zinc-900'}>Bonus Turn:</strong> Rolling a 6 grants you an immediate extra turn!</p>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <Zap className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p><strong className={isDark ? 'text-white' : 'text-zinc-900'}>Capturing:</strong> Land on an opponent's pawn to capture it and send it back to their yard, earning a bonus turn.</p>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p><strong className={isDark ? 'text-white' : 'text-zinc-900'}>Safe Zones:</strong> Tiles marked with a Star are safe zones. Pawns cannot be captured on star tiles.</p>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <Crown className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p><strong className={isDark ? 'text-white' : 'text-zinc-900'}>Victory:</strong> Move all 4 pawns completely around the board and into your Home triangle to win!</p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-5 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`border rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[88vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-150 scrollbar-none ${
            isDark ? 'bg-[#14151b] border-white/[0.1]' : 'bg-white border-zinc-200'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b mb-4 ${
              isDark ? 'border-white/[0.08]' : 'border-zinc-200'
            }`}>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-500" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Game Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className={`p-1.5 rounded-xl transition ${
                  isDark ? 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* SECTION 1: PARTNER CONNECTION */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    <div>
                      <span className={`font-bold text-xs sm:text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>Partner Connection</span>
                      <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Link once, play together anytime</p>
                    </div>
                  </div>
                  {partner ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30 uppercase tracking-wider">
                      Paired
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      isDark ? 'bg-white/5 text-zinc-400 border-white/10' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                    }`}>
                      Not Paired
                    </span>
                  )}
                </div>

                {partner ? (
                  /* Connected Partner inside Settings */
                  <div className={`p-3.5 rounded-xl border space-y-3 ${
                    isDark ? 'bg-black/30 border-white/[0.06]' : 'bg-white border-zinc-200 shadow-xs'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                            {partner.displayName[0]?.toUpperCase()}
                          </div>
                          <span
                            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border ${
                              isDark ? 'border-black' : 'border-white'
                            } ${partner.online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{partner.displayName}</span>
                            <span className="text-[10px] text-emerald-500 font-medium">
                              {partner.online ? '• Online' : '• Offline'}
                            </span>
                          </div>
                          <span className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            Code: <strong className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>{partner.partnerCode}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleDisconnectPartner}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition flex items-center gap-1 ${
                          isDark ? 'bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border-white/10' : 'bg-zinc-50 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 border-zinc-200'
                        }`}
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Disconnect</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowSettingsModal(false);
                          handlePlayWithPartner();
                        }}
                        disabled={isMatchmaking}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Together</span>
                      </button>

                      <button
                        onClick={handlePingPartner}
                        disabled={isPingingPartner}
                        className={`px-3.5 py-2.5 rounded-xl font-semibold text-xs border transition flex items-center justify-center gap-1 ${
                          isDark
                            ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-200'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 shadow-xs'
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Ping</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Connected: One-Time Pairing Setup inside Settings */
                  <div className="space-y-3 pt-1">
                    {/* Your Personal Code */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-black/30 border-white/[0.06]' : 'bg-white border-zinc-200 shadow-xs'
                    }`}>
                      <div>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider block ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          Your Personal Code
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-rose-500 tracking-wider">
                          {myPartnerCode || session?.user?.partnerCode || '...'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPartnerCode}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                          isDark
                            ? 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.08] text-zinc-200'
                            : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700 shadow-xs'
                        }`}
                      >
                        {copiedPartnerCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPartnerCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Enter Partner's Code */}
                    <form onSubmit={handleConnectPartner} className="space-y-1.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider block ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        Enter Partner's Code
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={partnerInputCode}
                          onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                          placeholder="E.G. MAYURD81"
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-rose-500 ${
                            isDark
                              ? 'bg-[#0f1015] border border-white/[0.1] text-white placeholder-zinc-500'
                              : 'bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400'
                          }`}
                        />
                        <button
                          type="submit"
                          disabled={isConnectingPartner}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0"
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
                  <p className={`text-xs mt-2 font-medium p-2 rounded-xl border ${
                    isDark ? 'text-zinc-300 bg-white/[0.04] border-white/[0.08]' : 'text-zinc-700 bg-white border-zinc-200'
                  }`}>{partnerPingStatus}</p>
                )}
              </div>

              {/* Board Theme Selection */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-rose-500" />
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Board Theme</span>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-none">
                  {THEMES.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme.id)}
                        className={`group relative rounded-xl overflow-hidden border transition-all flex flex-col items-center shadow-xs text-left ${
                          isSelected
                            ? 'border-rose-500 ring-2 ring-rose-500/40 scale-[1.02]'
                            : (isDark ? 'border-white/[0.08] hover:border-white/30' : 'border-zinc-200 hover:border-zinc-400')
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
                        <div className={`w-full py-1 px-1.5 text-[10px] font-semibold text-center truncate ${
                          isDark ? 'bg-[#14151b] text-white' : 'bg-white text-zinc-900 border-t border-zinc-200'
                        }`}>
                          {theme.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-rose-500" />
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Sound Effects</span>
                </div>
                <button
                  onClick={() => setSoundEffectsEnabled(!soundEffectsEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    soundEffectsEnabled ? 'bg-rose-600' : (isDark ? 'bg-zinc-700' : 'bg-zinc-300')
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      soundEffectsEnabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-rose-500" />
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Microphone</span>
                </div>
                <button
                  onClick={toggleMic}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    !isMicMuted ? 'bg-emerald-600' : (isDark ? 'bg-zinc-700' : 'bg-zinc-300')
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      !isMicMuted ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-rose-500" />
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Camera Preview</span>
                </div>
                <button
                  onClick={toggleCamera}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    isCameraOn ? 'bg-emerald-600' : (isDark ? 'bg-zinc-700' : 'bg-zinc-300')
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      isCameraOn ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="mt-5 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function LudoPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#111217] flex items-center justify-center text-zinc-400 text-xs font-semibold">
          Loading Ludo Arena...
        </div>
      }
    >
      <LudoPageContent />
    </React.Suspense>
  );
}
