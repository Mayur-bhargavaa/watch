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
  ArrowRight
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { ChatReplyTo } from '@synccinema/common';
import { ChatReplyQuote, ChatReplyingBanner } from '../../../components/chat/ChatReplyUI';
import { AlertModal, AlertModalType } from '../../../components/ui/AlertModal';
import {
  getStoredSession,
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
  WS_BASE,
  UserSession
} from '../../../lib/api';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { LudoGame, VideoAvatar } from '../../../components/games/LudoGame';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
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

  // Live presence heartbeat every 2.5s
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
    }, 2500);

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
    setPartnerPingStatus(null);
    try {
      if (room?.roomCode) {
        const res = await invitePartnerToGame(session.token, partner.partnerCode, room.roomCode, 'ludo');
        if (res.deliveredLive) {
          setPartnerPingStatus(`🚀 Game invite delivered live to ${partner.displayName}!`);
        } else {
          setPartnerPingStatus(`🔔 Game invite sent to ${partner.displayName}!`);
        }
      } else {
        const res = await pingPartner({
          targetCode: partner.partnerCode,
          fromCode: myPartnerCode,
          fromName: session.user.displayName,
          roomCode: undefined,
          gameType: 'ludo'
        });
        if (res.deliveredLive) {
          setPartnerPingStatus(`🚀 Live notification delivered to ${partner.displayName}!`);
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
  const handlePlayWithPartner = async () => {
    if (!partner || !session?.token) return;
    setIsMatchmaking(true);
    setLobbyError(null);
    try {
      const res = await playWithPartner(session.token);
      router.push(`/games/ludo?room=${res.room.roomCode}`);
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to connect with partner');
      setIsMatchmaking(false);
    }
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

  // Opponent status and disconnection detection
  const isOpponentDisconnected = useMemo(() => {
    if (opponentPlayer && !opponentPlayer.isConnected) return true;
    if (disconnectedPlayer && disconnectedPlayer.userId !== myPlayer?.userId) return true;
    return false;
  }, [opponentPlayer, disconnectedPlayer, myPlayer]);

  const disconnectedOpponentName = opponentPlayer?.displayName || disconnectedPlayer?.displayName || 'Partner';

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-rose-600 selection:text-white relative overflow-x-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#111217] text-white' : 'bg-[#f8fafc] text-zinc-900'
    }`}>
      {/* Active Match Background & Atmosphere */}
      {roomParam ? (
        <>
          <div
            className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
            style={{
              backgroundImage: `url('${currentTheme.bgUrl}')`
            }}
          />
          {/* Live Animated Theme Atmosphere */}
          <DynamicThemeEffects themeId={currentTheme.id} />

          {/* Subtle overlay */}
          <div className={`fixed inset-0 pointer-events-none z-0 ${
            isDark ? 'bg-black/50 backdrop-blur-[0.2px]' : 'bg-white/70 backdrop-blur-[0.2px]'
          }`} />
        </>
      ) : (
        /* Modern Background for Lobby */
        <div className="fixed inset-0 pointer-events-none z-0">
          {isDark ? (
            <div className="absolute inset-0 bg-[#111217]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.06),rgba(255,255,255,0))]" />
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-[#f8fafc]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.08),rgba(0,0,0,0))]" />
              <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:32px_32px]" />
            </div>
          )}
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-300 ${
        isDark ? 'bg-[#14151b]/80 border-white/[0.08]' : 'bg-white/85 border-zinc-200/90 shadow-xs'
      }`}>
        {/* Left: [Back to Games] + Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (roomParam) {
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
              } else {
                router.push('/games');
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl border shadow-xs flex items-center gap-2 font-semibold text-xs transition-all active:scale-95 group ${
              isDark
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border-white/[0.08]'
                : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 hover:text-zinc-950 border-zinc-200'
            }`}
            title={roomParam ? 'Leave Match' : 'Back to Games Lounge'}
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{roomParam ? 'Leave Match' : 'Games'}</span>
          </button>

          <div className={`h-4 w-px hidden sm:block ${isDark ? 'bg-white/[0.1]' : 'bg-zinc-200'}`} />

          <div className="hidden sm:flex items-center gap-2">
            <span className={`font-extrabold text-sm tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Watch<span className="text-rose-500">.</span>
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
              isDark ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-rose-50 border border-rose-200 text-rose-600'
            }`}>
              Ludo Arena
            </span>
          </div>
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
            <div className="flex items-center gap-2.5">
              {videoGridParticipants.map(participant => (
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
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 via-pink-600 to-rose-500 text-white font-bold text-xs flex items-center justify-center shadow">
                        {participant.displayName?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-[9px] text-zinc-400 font-semibold">Cam Off</span>
                    </div>
                  )}

                  {/* Bottom Bar: Name on Left, Round Red/Green Mic Icon on Right (Exact layout as screenshot) */}
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
          onConfirm={() => router.push('/games')}
        />
      )}


      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-5 flex flex-col justify-start z-10">
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
                  className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* ROOM VIEW: WAITING ROOM */}
        {roomParam && isWaiting && (
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-5 py-6 animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-full border rounded-2xl p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center ${
              isDark ? 'bg-[#14151b] border-white/[0.08]' : 'bg-white border-zinc-200 shadow-xl'
            }`}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Strict Zero-Bots Matchmaking</span>
              </div>

              <h2 className={`text-2xl sm:text-3xl font-extrabold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Waiting for Players
              </h2>
              <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Match will begin automatically when <strong>{room.maxPlayers} human players</strong> join. No bots will ever be injected.
              </p>

              {/* Temporary Room Code Badge */}
              <div className={`mt-5 p-4 rounded-xl border flex flex-col sm:flex-row items-center gap-4 w-full justify-between ${
                isDark ? 'bg-black/30 border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="text-left">
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    Temporary Room Code
                  </span>
                  <span className="text-2xl font-mono font-bold text-rose-500 tracking-wider">
                    {room.roomCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRoomCode}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                      isDark
                        ? 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 hover:text-white border-white/[0.08]'
                        : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 border-zinc-200 shadow-xs'
                    }`}
                  >
                    {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRoomCode ? 'Code Copied' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleCopyRoomLink}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                  >
                    {copiedRoomLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedRoomLink ? 'Link Copied' : 'Share Link'}</span>
                  </button>
                </div>
              </div>

              {/* Player Slots Progress */}
              <div className="mt-6 w-full">
                <div className={`flex items-center justify-between text-xs font-semibold mb-2.5 ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}>
                  <span>Joined Seats ({room.players.length}/{room.maxPlayers})</span>
                  <span className="text-emerald-500 font-mono text-[11px]">
                    {room.maxPlayers - room.players.length} seat(s) remaining
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: room.maxPlayers }).map((_, seatIdx) => {
                    const player = room.players.find(p => p.seat === seatIdx);
                    return (
                      <div
                        key={seatIdx}
                        className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center transition ${
                          player
                            ? (isDark
                                ? 'bg-white/[0.04] border-white/[0.1] text-white shadow-xs'
                                : 'bg-white border-zinc-200 text-zinc-900 shadow-xs')
                            : (isDark
                                ? 'bg-white/[0.02] border-dashed border-white/[0.06] text-zinc-500'
                                : 'bg-zinc-50/70 border-dashed border-zinc-200 text-zinc-400')
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm mb-2 shadow-xs ${
                            player
                              ? 'bg-gradient-to-tr from-rose-600 to-pink-600 text-white'
                              : (isDark ? 'bg-white/[0.05] text-zinc-600' : 'bg-zinc-100 text-zinc-400')
                          }`}
                        >
                          {player ? player.displayName[0]?.toUpperCase() : seatIdx + 1}
                        </div>

                        <span className={`text-xs font-semibold truncate max-w-full ${
                          player ? (isDark ? 'text-white' : 'text-zinc-900') : (isDark ? 'text-zinc-500' : 'text-zinc-400')
                        }`}>
                          {player ? player.displayName : 'Waiting...'}
                        </span>

                        <span className="text-[10px] text-zinc-400 mt-1 flex items-center justify-center">
                          {player ? (
                            player.seat === 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                                <Crown className="w-3 h-3" /> Host
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                <User className="w-3 h-3" /> Player
                              </span>
                            )
                          ) : (
                            'Empty Seat'
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invite Connected Partner CTA */}
              {partner && (
                <div className={`mt-6 w-full p-4 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="text-left flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-pink-600 text-white font-bold flex items-center justify-center text-xs">
                      {partner.displayName[0]}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold flex items-center gap-1.5 ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}>
                        <span>Partner: {partner.displayName}</span>
                        {partner.online ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-zinc-400" title="Offline" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">{partner.partnerCode}</span>
                    </div>
                  </div>

                  <button
                    onClick={handlePingPartner}
                    disabled={isPingingPartner}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{isPingingPartner ? 'Inviting...' : 'Invite Partner'}</span>
                  </button>
                </div>
              )}

              {partnerPingStatus && (
                <div className="mt-3 text-xs text-rose-500 font-medium">
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
          <div className="w-full max-w-4xl mx-auto space-y-8 sm:space-y-10 py-6 pb-16 animate-in fade-in zoom-in-95 duration-300 relative z-10">
            {/* Header Hero */}
            <div className="text-center pt-2 pb-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold mb-4">
                <Dice5 className="w-3.5 h-3.5" />
                <span>Classic Real-Time Board Game</span>
              </div>
              <h1 className={`text-3xl sm:text-5xl font-extrabold tracking-tight ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                Ludo Arena
              </h1>
              <p className={`text-sm sm:text-base mt-2 max-w-lg mx-auto leading-relaxed ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                Play real-time Ludo with your partner or create a private room with friends. Zero bots, pure co-play.
              </p>

              {/* Feature Highlights Bar */}
              <div className="flex items-center justify-center gap-2.5 mt-5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                  isDark ? 'bg-[#14151b] border-white/[0.08] text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700 shadow-xs'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Strict Zero-Bots
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                  isDark ? 'bg-[#14151b] border-white/[0.08] text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700 shadow-xs'
                }`}>
                  <Video className="w-3.5 h-3.5 text-sky-500" />
                  Live Voice & Cam
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                  isDark ? 'bg-[#14151b] border-white/[0.08] text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700 shadow-xs'
                }`}>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Low-Latency Sync
                </span>
              </div>
            </div>

            {lobbyError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-semibold text-center">
                {lobbyError}
              </div>
            )}

            {/* ========================================================================= */}
            {/* DEDICATED SECTION 1: PLAY WITH LOVED ONES • ONE-TIME CODE (EXCLUSIVE)     */}
            {/* ========================================================================= */}
            <div className={`w-full rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all shadow-xl ${
              isDark
                ? 'bg-gradient-to-b from-rose-950/25 via-[#16121b]/90 to-[#14151b]/90 border-rose-500/20 shadow-rose-950/20'
                : 'bg-gradient-to-b from-rose-50/90 via-white to-pink-50/50 border-rose-200 shadow-rose-100/50'
            }`}>
              {/* Subtle Ambient Heart Glow */}
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />

              {/* Section Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-rose-500/15 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 shrink-0">
                    <Heart className="w-6 h-6 fill-current animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${
                        isDark ? 'text-white' : 'text-zinc-900'
                      }`}>
                        Play with Loved Ones
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-500 text-[10px] font-bold uppercase tracking-wider">
                        One-Time Code Only
                      </span>
                    </div>
                    <p className={`text-xs sm:text-sm mt-0.5 ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      Private 2-player intimate duel. Generate a single-use pass or enter your loved one's code to play immediately.
                    </p>
                  </div>
                </div>
              </div>

              {loveSectionError && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-xl text-xs font-semibold text-center">
                  {loveSectionError}
                </div>
              )}

              {/* If Linked Partner exists: Quick status banner */}
              {partner && (
                <div className={`mt-5 p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                  isDark ? 'bg-black/30 border-white/[0.08]' : 'bg-white/80 border-rose-100 shadow-xs'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {partner.displayName[0]?.toUpperCase()}
                      </div>
                      <span
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${
                          isDark ? 'border-[#14151b]' : 'border-white'
                        } ${partner.online ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}
                        title={partner.online ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {partner.displayName}
                        </span>
                        {partner.online ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-500 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            Offline
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] block mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Linked Co-Play Partner
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {partner.online ? (
                      <button
                        onClick={handlePlayWithPartner}
                        disabled={isMatchmaking}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-xs transition active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Together</span>
                      </button>
                    ) : (
                      <button
                        onClick={handlePingPartner}
                        disabled={isPingingPartner}
                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                          isDark
                            ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-200'
                            : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 shadow-xs'
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{isPingingPartner ? 'Pinging...' : 'Ping Partner'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Loved Ones Action Cards: Generate Code vs Join with Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 relative z-10">
                {/* SUB-CARD 1: Generate One-Time Love Pass */}
                <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isDark
                    ? 'bg-[#0f1015]/80 border-rose-500/20 shadow-lg'
                    : 'bg-white/90 border-rose-200 shadow-sm'
                }`}>
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className={`text-sm sm:text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-zinc-900'
                        }`}>
                          Host 1-Time Love Table
                        </h3>
                        <p className={`text-[11px] font-medium ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          Generates a single-use 2-player private board
                        </p>
                      </div>
                    </div>

                    {!generatedLoveCode ? (
                      <p className={`text-xs mt-3 leading-relaxed ${
                        isDark ? 'text-zinc-400' : 'text-zinc-600'
                      }`}>
                        Create an intimate table for just you two. Once generated, send your loved one the one-time code or link and enjoy live zero-latency gameplay.
                      </p>
                    ) : (
                      /* Love Pass Generated Ticket */
                      <div className={`mt-4 p-4 rounded-xl border space-y-3 ${
                        isDark ? 'bg-rose-950/20 border-rose-500/30' : 'bg-rose-50/80 border-rose-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                            <Heart className="w-3 h-3 fill-current" />
                            Your One-Time Love Pass
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium">Single-Use</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-mono font-black text-rose-500 tracking-wider">
                            {generatedLoveCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCopyLoveCode}
                              className={`p-2 rounded-lg border transition ${
                                isDark
                                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-200'
                                  : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 shadow-xs'
                              }`}
                              title="Copy Code"
                            >
                              {copiedLoveCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyLoveLink}
                              className={`p-2 rounded-lg border transition ${
                                isDark
                                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-200'
                                  : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 shadow-xs'
                              }`}
                              title="Copy Direct Link"
                            >
                              {copiedLoveLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-zinc-500">
                          {copiedLoveCode ? 'Code copied to clipboard!' : copiedLoveLink ? 'Direct link copied!' : 'Share this code with your loved one.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-rose-500/15">
                    {!generatedLoveCode ? (
                      <button
                        type="button"
                        onClick={handleGenerateLoveCode}
                        disabled={isGeneratingLoveCode}
                        className="w-full py-3 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 hover:opacity-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{isGeneratingLoveCode ? 'Generating Code...' : 'Generate 1-Time Love Code'}</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/games/ludo?room=${generatedLoveCode}`)}
                          className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Enter Table as Host</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateLoveCode}
                          disabled={isGeneratingLoveCode}
                          className={`w-full py-2 text-[11px] font-medium transition text-center ${
                            isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                        >
                          Generate a different code
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SUB-CARD 2: Join Loved One's Table */}
                <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isDark
                    ? 'bg-[#0f1015]/80 border-rose-500/20 shadow-lg'
                    : 'bg-white/90 border-rose-200 shadow-sm'
                }`}>
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-500">
                        <Heart className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className={`text-sm sm:text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-zinc-900'
                        }`}>
                          Join Your Loved One
                        </h3>
                        <p className={`text-[11px] font-medium ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          Enter the one-time code they shared with you
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleJoinWithLoveCode} className="space-y-3 mt-4">
                      <label className={`text-xs font-semibold block ${
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      }`}>
                        One-Time Love Code
                      </label>
                      <input
                        type="text"
                        value={loveCodeInput}
                        onChange={e => setLoveCodeInput(e.target.value.toUpperCase())}
                        placeholder="E.G. LUDO-LOVE"
                        className={`w-full px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/50 ${
                          isDark
                            ? 'bg-[#14151b] border border-white/[0.1] text-white placeholder-zinc-500 focus:border-rose-500'
                            : 'bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-rose-500 focus:bg-white'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={isJoiningLoveRoom || !loveCodeInput.trim()}
                        className="w-full mt-3 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{isJoiningLoveRoom ? 'Entering Table...' : 'Enter Love Table'}</span>
                      </button>
                    </form>
                  </div>

                  <div className="mt-5 pt-3 border-t border-rose-500/15 text-center">
                    <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      Only 2 seats per love table. Real-time audio & video available once connected.
                    </span>
                  </div>
                </div>
              </div>

              {/* Romantic tip if not permanently paired */}
              {!partner && (
                <div className="mt-6 text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(true)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition group border ${
                      isDark
                        ? 'bg-black/20 hover:bg-white/[0.05] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                        : 'bg-white/60 hover:bg-white border-rose-200 text-zinc-600 hover:text-zinc-900 shadow-xs'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                    <span>Tip: Connect your partner in <strong className={isDark ? 'text-zinc-200 underline' : 'text-zinc-900 underline'}>Settings</strong> for 1-click duo invites anytime</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* DISTINCT SECTION 2: MULTIPLAYER & PARTY TABLES (GENERAL)                  */}
            {/* ========================================================================= */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-base sm:text-lg font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}>
                    Multiplayer & Party Tables
                  </h2>
                  <p className={`text-xs font-medium ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    Host or join games with friends and family (2 to 4 players)
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  isDark ? 'bg-white/[0.04] border-white/[0.08] text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                }`}>
                  Up to 4 Players
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Card 1: Host Table */}
                <div className={`border rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#14151b] border-white/[0.08]' : 'bg-white border-zinc-200'
                }`}>
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                        <Crown className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-zinc-900'
                        }`}>
                          Host Private Table
                        </h3>
                        <p className={`text-xs font-medium ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          Create a new room and invite players
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-5">
                      <label className={`text-xs font-semibold block ${
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      }`}>
                        Select Table Size
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([2, 3, 4] as const).map(count => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setSelectedMaxPlayers(count)}
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border ${
                              selectedMaxPlayers === count
                                ? 'bg-rose-600 border-rose-500 text-white shadow-xs'
                                : (isDark
                                    ? 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100')
                            }`}
                          >
                            {count} Players {count === 2 ? '(Duel)' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`mt-6 pt-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                    <button
                      type="button"
                      onClick={handleCreateCustomRoom}
                      disabled={isMatchmaking}
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Create {selectedMaxPlayers}-Player Room</span>
                    </button>
                  </div>
                </div>

                {/* Card 2: Join with Code */}
                <div className={`border rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all ${
                  isDark ? 'bg-[#14151b] border-white/[0.08]' : 'bg-white border-zinc-200'
                }`}>
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                        isDark ? 'bg-white/[0.05] border-white/[0.08] text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                      }`}>
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-zinc-900'
                        }`}>
                          Join with Code
                        </h3>
                        <p className={`text-xs font-medium ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          Enter a room code shared by your friend
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleJoinWithCode} className="space-y-3 mt-5">
                      <label className={`text-xs font-semibold block ${
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      }`}>
                        Room Code
                      </label>
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                        placeholder="E.G. LUDO-8F72"
                        className={`w-full px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest transition-all focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                          isDark
                            ? 'bg-[#0f1015] border border-white/[0.1] text-white placeholder-zinc-500 focus:border-rose-500'
                            : 'bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-rose-500 focus:bg-white'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={isJoiningRoom || !roomCodeInput.trim()}
                        className={`w-full mt-4 py-3.5 border font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark
                            ? 'bg-white/[0.08] hover:bg-white/[0.12] border-white/[0.1] text-white'
                            : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-900 text-white'
                        }`}
                      >
                        <Play className="w-4 h-4 fill-current text-white" />
                        <span>{isJoiningRoom ? 'Joining...' : 'Join Table'}</span>
                      </button>
                    </form>
                  </div>

                  <div className={`mt-6 pt-4 border-t text-center ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                    <span className="text-xs text-zinc-500">
                      Need help? Click the <button type="button" onClick={() => setShowRulesModal(true)} className="text-rose-500 underline hover:text-rose-400">Rules</button> guide above.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Rules Reference Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition ${
                isDark ? 'bg-[#14151b] border-white/[0.06]' : 'bg-white border-zinc-200 shadow-xs'
              }`}>
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <Dice5 className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Roll a 6</span>
                <p className={`text-[11px] leading-tight ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Unlocks pawns from yard onto the board track.</p>
              </div>

              <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition ${
                isDark ? 'bg-[#14151b] border-white/[0.06]' : 'bg-white border-zinc-200 shadow-xs'
              }`}>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Bonus Turn</span>
                <p className={`text-[11px] leading-tight ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Rolling a 6 or capturing grants an extra roll.</p>
              </div>

              <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition ${
                isDark ? 'bg-[#14151b] border-white/[0.06]' : 'bg-white border-zinc-200 shadow-xs'
              }`}>
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <Zap className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Capture Rivals</span>
                <p className={`text-[11px] leading-tight ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Land on opponents to send them back home.</p>
              </div>

              <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition ${
                isDark ? 'bg-[#14151b] border-white/[0.06]' : 'bg-white border-zinc-200 shadow-xs'
              }`}>
                <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                  <Star className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Safe Zones</span>
                <p className={`text-[11px] leading-tight ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Star tiles protect pawns from being captured.</p>
              </div>
            </div>
          </div>
        )}
      </main>

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
