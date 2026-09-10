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
  Lock
} from 'lucide-react';
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
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const lastStickerSentRef = useRef<number>(0);

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
    if (!confirm('Disconnect from your partner? You can reconnect anytime with their code.')) return;
    if (!session?.token) return;
    try {
      await disconnectUserPartner(session.token);
      setPartner(null);
    } catch (err) {
      console.error(err);
    }
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
            alert(`Connected with partner ${partnerRes.partner.displayName}! You can now click "Play Together" to start a match.`);
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
    sendChat(chatInput);
    setChatInput('');
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
    <div className="min-h-screen bg-[#1c1815] text-slate-800 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 relative overflow-x-hidden">
      {/* Customizable Game Theme Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: `url('${currentTheme.bgUrl}')`
        }}
      />
      {/* Live Animated Candle Flames, Flickering Glow, Mug Steam & Floating Warm Embers */}
      <DynamicThemeEffects themeId={currentTheme.id} />

      {/* Subtle warm daylight tint */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-amber-900/[0.04] backdrop-blur-[0.2px]" />

      {/* TOP NAVIGATION BAR (Exact replica of reference UI) */}
      <header className="h-16 px-4 sm:px-8 bg-transparent flex items-center justify-between shrink-0 sticky top-0 z-40">
        {/* Left: [← Back to Lounge] Pill Button */}
        <div>
          <button
            onClick={() => {
              if (roomParam) {
                if (confirm('Leave current match?')) {
                  sendLeave();
                  router.push('/games/ludo');
                }
              } else {
                router.push('/games');
              }
            }}
            className="px-4 py-2 rounded-full bg-black/60 hover:bg-black/80 text-rose-300 hover:text-rose-200 border border-white/15 shadow-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all backdrop-blur-xl group"
            title={roomParam ? 'Leave Match' : 'Back to Lounge'}
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{roomParam ? 'LEAVE' : 'Back to Lounge'}</span>
          </button>
        </div>

        {/* Center Header: Show Call pill if floating window was closed */}
        {roomParam && isPipClosed && (
          <button
            onClick={() => setIsPipClosed(false)}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1e1e]/90 hover:bg-[#2b2b2b] text-amber-300 border border-amber-400/40 shadow-lg text-xs font-bold flex items-center gap-1.5 transition backdrop-blur-md animate-fade-in"
            title="Open Floating Video Call"
          >
            <Video className="w-3.5 h-3.5 text-amber-300" />
            <span>Show Video Call</span>
          </button>
        )}

        {/* Right: Round Glassmorphic Buttons [Mic] [Cam] [Chat] [?] [⟲] [⚙] */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Audio / Mic Toggle Button */}
          {roomParam && (
            <button
              onClick={toggleMic}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border transition flex items-center justify-center shadow-md backdrop-blur-md ${
                isMicMuted
                  ? 'bg-[#1e1e1e]/85 hover:bg-[#2a2a2a] border-white/15 text-rose-400'
                  : 'bg-emerald-950/80 hover:bg-emerald-900/90 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
              }`}
              title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 animate-pulse" />}
            </button>
          )}

          {/* Video / Camera Toggle Button */}
          {roomParam && (
            <button
              onClick={toggleCamera}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border transition flex items-center justify-center shadow-md backdrop-blur-md ${
                isCameraOn
                  ? 'bg-amber-950/80 hover:bg-amber-900/90 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                  : 'bg-[#1e1e1e]/85 hover:bg-[#2a2a2a] border-white/15 text-zinc-300 hover:text-white'
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
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border transition flex items-center justify-center shadow-md backdrop-blur-md ${
                isChatOpen
                  ? 'bg-[#1e1e1e] border-amber-400 text-amber-300'
                  : 'bg-[#1e1e1e]/85 hover:bg-[#2a2a2a] border-white/15 text-white'
              }`}
              title="Toggle Chat & Call"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          {/* Help / Rules Button [?] */}
          <button
            onClick={() => setShowRulesModal(true)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1e1e1e]/85 hover:bg-[#2a2a2a] border border-white/15 text-white transition flex items-center justify-center font-bold text-base shadow-md backdrop-blur-md"
            title="Ludo Rules & Guide"
          >
            ?
          </button>

          {/* Rematch / Restart Button [⟲] */}
          {roomParam && (
            <button
              onClick={() => {
                if (gameState?.winnerColor) {
                  rematch();
                } else if (confirm('Restart / Request Rematch?')) {
                  rematch();
                }
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1e1e1e]/85 hover:bg-[#2a2a2a] border border-white/15 text-white transition flex items-center justify-center shadow-md backdrop-blur-md"
              title="Rematch / Restart"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Settings Button [⚙] */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1e1e1e]/85 hover:bg-[#2a2a2a] border border-white/15 text-white transition flex items-center justify-center shadow-md backdrop-blur-md"
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
              <GripHorizontal className="w-4 h-4 text-amber-400/80" />
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
                    ? 'bg-amber-950/80 border-amber-400/60 text-amber-300 hover:bg-amber-900 ring-1 ring-amber-400/40'
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
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-rose-600 text-white font-bold text-xs flex items-center justify-center shadow">
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

      {/* Media Notice (e.g. Camera or Mic fallback / permission reminder) */}
      {mediaNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c0d16]/95 border border-amber-400 text-amber-200 text-xs px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <span>📷 {mediaNotice}</span>
          <button
            onClick={clearMediaNotice}
            className="p-0.5 hover:text-white rounded-full bg-white/10"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Incoming Partner Game Invite Toast */}
      {incomingInvite && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 p-4 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 text-white border-2 border-white/20 animate-bounce">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎲</span>
            <div className="text-left">
              <span className="text-xs font-black block">
                {incomingInvite.fromDisplayName} invited you to play Ludo!
              </span>
              <span className="text-[10px] text-amber-200 font-mono">
                Room: {incomingInvite.roomCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const code = incomingInvite.roomCode;
                setIncomingInvite(null);
                router.push(`/games/ludo?room=${code}`);
              }}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-lg transition"
            >
              Accept & Play 🚀
            </button>
            <button
              onClick={() => setIncomingInvite(null)}
              className="px-2.5 py-2 text-white/80 hover:text-white text-xs font-bold transition"
            >
              Dismiss
            </button>
          </div>
        </div>
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
                <div className="w-10 h-10 mx-auto rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
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
            <div className="w-full bg-[#1c0c16]/90 border border-rose-500/20 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Strict Zero-Bots Matchmaking</span>
              </div>

              <h2 className="text-2xl font-black text-white">Waiting for Players</h2>
              <p className="text-xs text-rose-200/70 mt-1 max-w-md">
                Match will begin automatically when <strong>{room.maxPlayers} human players</strong> join. No bots will ever be injected.
              </p>

              {/* Temporary Room Code Badge */}
              <div className="mt-5 p-4 rounded-2xl bg-black/40 border border-rose-500/20 flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                    Temporary Room Code
                  </span>
                  <span className="text-2xl font-mono font-black text-rose-400 tracking-wider">
                    {room.roomCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRoomCode}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition flex items-center gap-1.5"
                  >
                    {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRoomCode ? 'Code Copied' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleCopyRoomLink}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
                  >
                    {copiedRoomLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedRoomLink ? 'Link Copied' : 'Share Link'}</span>
                  </button>
                </div>
              </div>

              {/* Player Slots Progress */}
              <div className="mt-6 w-full">
                <div className="flex items-center justify-between text-xs font-bold mb-2 text-rose-200">
                  <span>Joined Seats ({room.players.length}/{room.maxPlayers})</span>
                  <span className="text-emerald-400 font-mono">
                    {room.maxPlayers - room.players.length} seat(s) remaining
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: room.maxPlayers }).map((_, seatIdx) => {
                    const player = room.players.find(p => p.seat === seatIdx);
                    return (
                      <div
                        key={seatIdx}
                        className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center transition ${
                          player
                            ? 'bg-rose-500/10 border-rose-500/40 text-white shadow-lg'
                            : 'bg-black/20 border-dashed border-white/10 text-zinc-500'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm mb-2 shadow ${
                            player
                              ? 'bg-gradient-to-tr from-rose-600 to-amber-600 text-white'
                              : 'bg-zinc-800 text-zinc-600'
                          }`}
                        >
                          {player ? player.displayName[0]?.toUpperCase() : seatIdx + 1}
                        </div>

                        <span className="text-xs font-bold truncate max-w-full">
                          {player ? player.displayName : 'Waiting...'}
                        </span>

                        <span className="text-[10px] text-rose-300/70 mt-0.5">
                          {player ? (player.seat === 0 ? '👑 Host' : '👤 Player') : 'Empty Seat'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invite Connected Partner CTA */}
              {partner && (
                <div className="mt-6 w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="text-left flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 font-black flex items-center justify-center text-xs">
                      {partner.displayName[0]}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Partner: {partner.displayName}</span>
                        {partner.online ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-zinc-500" title="Offline" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">{partner.partnerCode}</span>
                    </div>
                  </div>

                  <button
                    onClick={handlePingPartner}
                    disabled={isPingingPartner}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-xs rounded-xl transition shadow flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{isPingingPartner ? 'Inviting...' : 'Invite Partner 🔔'}</span>
                  </button>
                </div>
              )}

              {partnerPingStatus && (
                <div className="mt-3 text-xs text-amber-300 font-medium">
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
              {/* Opponent Left / Disconnected Notification Banner */}
              {isOpponentDisconnected && (
                <div className="w-full max-w-xl mb-3.5 p-3.5 sm:p-4 rounded-3xl bg-[#1d0b17]/95 border-2 border-amber-500/50 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 z-30">
                  <div className="flex items-center gap-3 text-left w-full sm:w-auto">
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center font-bold text-sm text-rose-200 uppercase overflow-hidden shadow-md">
                        {opponentPlayer?.avatarUrl ? (
                          <img
                            src={opponentPlayer.avatarUrl}
                            alt={disconnectedOpponentName}
                            className="w-full h-full object-cover grayscale opacity-75"
                          />
                        ) : (
                          <span>{disconnectedOpponentName[0]}</span>
                        )}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 ring-2 ring-[#1d0b17] animate-pulse" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">{disconnectedOpponentName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                          Left Match
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 mt-0.5">
                        {nudgeFeedback || 'Player left or disconnected. Nudge them to return or copy room link!'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                    <button
                      onClick={() => handleNudgePlayer(opponentPlayer?.userId || disconnectedPlayer?.userId, disconnectedOpponentName)}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Nudge {disconnectedOpponentName} 🔔</span>
                    </button>

                    <button
                      onClick={handleCopyRoomLink}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition border border-white/15 shadow-sm"
                      title="Copy Game Link to Send to Partner"
                    >
                      {copiedRoomLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

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
                    <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-rose-300/60 py-12">
                          <Heart className="w-8 h-8 mb-2 text-rose-500/40" />
                          <p className="text-xs font-medium">Say something sweet or cheer a move!</p>
                        </div>
                      ) : (
                        chatMessages.map(m => {
                          const isMe = m.userId === session?.user?.id;
                          const isSticker = parseStickerMessage(m.content);
                          return (
                            <div key={m.id} className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow shrink-0">
                                {m.userName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-bold text-rose-200 truncate">
                                    {isMe ? `${m.userName} (You)` : m.userName}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
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
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 active:scale-95 transition-all text-base shrink-0 border border-white/10 hover:border-rose-400/40 flex items-center justify-center shadow-sm"
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
                            onClick={() => sendChat(text)}
                            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-rose-500/20 active:scale-95 text-rose-200 hover:text-white text-[11px] font-semibold border border-white/10 hover:border-rose-400/40 whitespace-nowrap transition-all shrink-0 shadow-sm"
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
                              sendChat(formatStickerMessage(stickerIdOrUrl, caption));
                              setShowStickerPicker(false);
                            }}
                            onClose={() => setShowStickerPicker(false)}
                          />
                        </div>
                      )}

                      <form onSubmit={handleSendChat} className="flex items-center gap-2">
                        <div className="flex-1 relative flex items-center">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={handleChatInputChange}
                            onBlur={() => sendTyping(false)}
                            placeholder="Type a message or send stickers..."
                            className="w-full pl-3.5 pr-16 py-2.5 bg-black/40 border border-rose-500/30 rounded-2xl text-xs text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400"
                          />
                          <div className="absolute right-2 flex items-center gap-1">
                            {/* Sticker Button */}
                            <button
                              type="button"
                              onClick={() => setShowStickerPicker(prev => !prev)}
                              className={`p-1 rounded-lg transition-colors ${
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
                              className="p-1 rounded-lg text-rose-300/70 hover:text-white hover:bg-white/10 transition-colors"
                              title="Add smile"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="p-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-rose-900/50 shrink-0"
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
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-pink-500/10 border border-amber-500/20 text-center">
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
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-rose-600 text-white font-black text-base flex items-center justify-center shadow">
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
                            ? 'bg-amber-600/30 border-amber-400 text-amber-200 hover:bg-amber-600/40'
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
                                {p.seat === 0 && <span className="text-[10px]">👑</span>}
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
          <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 py-2 pb-12 animate-in fade-in zoom-in-95 duration-300">
            {/* Header Hero */}
            <div className="text-center pt-2 pb-1">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-200 text-xs font-semibold backdrop-blur-xl shadow-[0_0_20px_rgba(244,63,94,0.18)] mb-3 transition-all hover:scale-105">
                <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span className="tracking-wide">Couples & Best Friends Co-Play</span>
                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-amber-200 drop-shadow-[0_2px_24px_rgba(244,63,94,0.35)]">
                LudoLove Arena
              </h1>
              <p className="text-sm sm:text-base text-rose-100/75 mt-2 max-w-xl mx-auto font-medium leading-relaxed drop-shadow">
                Play real-time Ludo with your partner or create a private room with friends. Zero bots, pure cozy co-play.
              </p>

              {/* Feature Highlights Pill Bar */}
              <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-3.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-semibold text-emerald-300 backdrop-blur-md shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Strict Zero-Bots
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-semibold text-amber-200 backdrop-blur-md shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Live Voice & Cam
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-semibold text-rose-200 backdrop-blur-md shadow-sm">
                  <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                  Instant Co-Play
                </span>
              </div>
            </div>

            {lobbyError && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-500/40 text-rose-200 rounded-2xl text-xs font-semibold text-center backdrop-blur-xl shadow-lg animate-in fade-in slide-in-from-top-2">
                {lobbyError}
              </div>
            )}

            {/* If Partner is Connected: Quick Duo Action Bar */}
            {partner && (
              <div className="max-w-2xl mx-auto w-full relative overflow-hidden rounded-3xl p-4 sm:p-5 backdrop-blur-2xl bg-black/40 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-rose-500/30">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600 text-white font-black flex items-center justify-center text-lg shadow-lg ring-2 ring-rose-400/40">
                        {partner.displayName[0]?.toUpperCase()}
                      </div>
                      <span
                        className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                          partner.online ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                        }`}
                        title={partner.online ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{partner.displayName}</span>
                        {partner.online ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            Offline
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-rose-300/80 font-mono block mt-0.5">
                        Linked Co-Play Partner ♡
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    {partner.online ? (
                      <button
                        onClick={handlePlayWithPartner}
                        disabled={isMatchmaking}
                        className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play Together 🎮</span>
                      </button>
                    ) : (
                      <button
                        onClick={handlePingPartner}
                        disabled={isPingingPartner}
                        className="flex-1 sm:flex-initial px-5 py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span>{isPingingPartner ? 'Pinging...' : 'Ping Partner 🔔'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* If Not Paired: Subtle Link to Settings */}
            {!partner && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 hover:border-rose-400/40 text-rose-200/90 hover:text-white text-xs font-semibold backdrop-blur-xl shadow-lg transition-all group active:scale-98"
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span>Pair with your partner once in <strong>Settings (⚙)</strong> to co-play anytime</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}

            {/* PRIVATE ROOM & TABLE CODE SECTION */}
            <div className="max-w-2xl mx-auto w-full relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-2xl bg-black/40 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-amber-500/30">
              {/* Soft ambient backlight flare */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Private Room</h3>
                      <p className="text-xs text-rose-200/60 font-medium">Join a friend's table with a code, or host your own match</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300">
                    Friends Only 🔒
                  </span>
                </div>

                {/* Section A: Enter Code */}
                <form onSubmit={handleJoinWithCode} className="space-y-2 mt-4">
                  <label className="text-[11px] font-bold text-rose-200/80 uppercase tracking-wider block">
                    Have a Room Code?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roomCodeInput}
                      onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                      placeholder="E.G. LUDO-8F72"
                      className="flex-1 px-4 py-3 bg-black/60 border border-white/15 rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 font-mono uppercase tracking-widest focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={isJoiningRoom}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs sm:text-sm rounded-2xl transition flex items-center gap-2 shrink-0 active:scale-98"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isJoiningRoom ? 'Joining...' : 'Join Room'}</span>
                    </button>
                  </div>
                </form>

                {/* Divider */}
                <div className="relative my-5 flex items-center justify-center">
                  <div className="w-full border-t border-white/10" />
                  <span className="absolute px-3 bg-[#160c14] text-[10px] uppercase font-bold text-zinc-400 rounded-full border border-white/10">
                    OR HOST A NEW TABLE
                  </span>
                </div>

                {/* Section B: Host Private Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-200/80 uppercase tracking-wider">
                      Select Table Size:
                    </span>
                    <div className="inline-flex gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
                      {([2, 3, 4] as const).map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setSelectedMaxPlayers(count)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            selectedMaxPlayers === count
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50 shadow'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {count}P {count === 2 ? '(Duel)' : count === 3 ? '(3P)' : '(4P)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateCustomRoom}
                    disabled={isMatchmaking}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4 text-amber-300" />
                    <span>Create Private Room ({selectedMaxPlayers} Players) 👑</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#140a12]/95 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-rose-500/20 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">How to Play Ludo</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-rose-100/90 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="text-base">🎲</span>
                <p><strong>Roll a 6:</strong> You must roll a 6 to release a pawn from your Yard onto your Start tile.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="text-base">🔄</span>
                <p><strong>Bonus Turn:</strong> Rolling a 6 grants you an immediate extra turn!</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="text-base">⚔️</span>
                <p><strong>Capturing:</strong> Land on an opponent's pawn to capture it and send it back to their yard, earning a bonus turn.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="text-base">⭐</span>
                <p><strong>Safe Zones:</strong> Tiles marked with a Star are safe zones. Pawns cannot be captured on star tiles.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5">
                <span className="text-base">🏆</span>
                <p><strong>Victory:</strong> Move all 4 pawns completely around the board and into your Home triangle to win!</p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-5 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition"
            >
              Got It!
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#140a12]/95 border border-rose-500/30 rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[88vh] overflow-y-auto shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 scrollbar-thin scrollbar-thumb-rose-500/20">
            <div className="flex items-center justify-between pb-3 border-b border-rose-500/20 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Game Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* SECTION 1: PARTNER CONNECTION (Permanent One-Time Setup & Management) */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-rose-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    <div>
                      <span className="font-bold text-white text-xs sm:text-sm">Partner Connection</span>
                      <p className="text-[11px] text-rose-200/60 font-medium">Link once, play together anytime</p>
                    </div>
                  </div>
                  {partner ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                      Paired ♡
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400 border border-white/10">
                      Not Paired
                    </span>
                  )}
                </div>

                {partner ? (
                  /* Connected Partner inside Settings */
                  <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600 text-white font-black flex items-center justify-center text-sm shadow">
                            {partner.displayName[0]?.toUpperCase()}
                          </div>
                          <span
                            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-black ${
                              partner.online ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{partner.displayName}</span>
                            <span className="text-[10px] text-emerald-300 font-semibold">
                              {partner.online ? '• Online' : '• Offline'}
                            </span>
                          </div>
                          <span className="text-[11px] text-rose-300/80 font-mono">
                            Code: <strong className="text-amber-300">{partner.partnerCode}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleDisconnectPartner}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 text-[11px] font-semibold border border-white/10 transition flex items-center gap-1"
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
                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Together 🎮</span>
                      </button>

                      <button
                        onClick={handlePingPartner}
                        disabled={isPingingPartner}
                        className="px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ping 🔔</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Connected: One-Time Pairing Setup inside Settings */
                  <div className="space-y-3 pt-1">
                    {/* Your Personal Code */}
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                          Your Personal Code
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-black text-amber-300 tracking-wider">
                          {myPartnerCode || session?.user?.partnerCode || '...'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPartnerCode}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                      >
                        {copiedPartnerCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPartnerCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Enter Partner's Code */}
                    <form onSubmit={handleConnectPartner} className="space-y-1.5">
                      <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                        Enter Partner's Code
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={partnerInputCode}
                          onChange={e => setPartnerInputCode(e.target.value.toUpperCase())}
                          placeholder="E.G. MAYURD81"
                          className="flex-1 px-3 py-2 bg-black/60 border border-white/15 rounded-xl text-xs text-white placeholder-zinc-500 font-mono uppercase tracking-wider focus:outline-none focus:border-rose-400"
                        />
                        <button
                          type="submit"
                          disabled={isConnectingPartner}
                          className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isConnectingPartner ? 'Linking...' : 'Connect'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {partnerConnectError && (
                  <p className="text-xs text-rose-400 mt-2 font-medium bg-rose-950/60 p-2 rounded-xl border border-rose-500/30">{partnerConnectError}</p>
                )}
                {partnerPingStatus && (
                  <p className="text-xs text-amber-300 mt-2 font-medium bg-amber-950/60 p-2 rounded-xl border border-amber-500/30">{partnerPingStatus}</p>
                )}
              </div>

              {/* Board Theme Selection */}
              <div className="p-3 rounded-2xl bg-white/5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-white">Board Theme</span>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-rose-500/20">
                  {THEMES.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme.id)}
                        className={`group relative rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center shadow-md text-left ${
                          isSelected
                            ? 'border-rose-500 ring-2 ring-rose-500/40 scale-[1.03]'
                            : 'border-white/10 hover:border-white/30 hover:scale-[1.01]'
                        }`}
                      >
                        <div className="w-full h-16 relative overflow-hidden bg-black/50">
                          <img
                            src={theme.bgUrl}
                            alt={theme.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div className="w-full py-1 px-1.5 bg-[#1b0d18] text-[10px] font-bold text-white text-center truncate">
                          {theme.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-white">Sound Effects</span>
                </div>
                <button
                  onClick={() => setSoundEffectsEnabled(!soundEffectsEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    soundEffectsEnabled ? 'bg-rose-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      soundEffectsEnabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-white">Microphone</span>
                </div>
                <button
                  onClick={toggleMic}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    !isMicMuted ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      !isMicMuted ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-white">Camera Preview</span>
                </div>
                <button
                  onClick={toggleCamera}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    isCameraOn ? 'bg-emerald-600' : 'bg-zinc-700'
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
              className="mt-5 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition"
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
        <div className="min-h-screen bg-[#13070f] flex items-center justify-center text-rose-300 text-xs font-semibold">
          Loading LudoLove...
        </div>
      }
    >
      <LudoPageContent />
    </React.Suspense>
  );
}
