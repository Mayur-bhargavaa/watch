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
  FriendWithStreak
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
  'Your turn! 💖',
  'So close!! 😱',
  'Nice move! 🔥',
  'Rematch after this! 🔄',
  'Watch this line! 😎',
  'Oops haha! 🙈'
];

const EMOJI_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '❌', '⭕', '🥳', '🥺', '✨'];

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

function TicTacToeContent() {
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
  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);

  // Theme
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Lobby state
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  // Modals & UI Controls
  const [activeTheme, setActiveTheme] = useState<string>('theam2');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);

  // Scoreboard tracking within session
  const [scores, setScores] = useState<{ xWins: number; oWins: number; draws: number }>({
    xWins: 0,
    oWins: 0,
    draws: 0
  });

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
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);

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
    makeTicTacToeMove,
    lastTicTacToeMove,
    rematch,
    rematchStatus,
    chatMessages,
    typingUsers,
    floatingReactions,
    sendChat,
    sendReaction,
    sendNudge,
    sendLeave,
    sendTyping,
    sendWebRTCSignal,
    sendCameraState,
    sendVoiceState,
    registerWebRTCListener,
    registerCameraListener,
    registerVoiceListener
  } = useGameRoom(roomParam || null);

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
    myUserId: myUserId || session?.user?.id || '',
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

  const isMuted = isMicMuted;
  const isCameraOff = !isCameraOn;

  // Initialize Session
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
    init();
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

  // Sound triggers on game events
  const prevMoveCountRef = useRef<number>(0);
  useEffect(() => {
    if (!gameState) {
      prevMoveCountRef.current = 0;
      return;
    }

    if (gameState.moveCount > prevMoveCountRef.current) {
      const lastMark = lastTicTacToeMove?.mark || (gameState.currentTurnMark === 'X' ? 'O' : 'X');
      playMarkSound(lastMark);
      prevMoveCountRef.current = gameState.moveCount;
    }

    if (gameState.winner) {
      playWinFanfare();
      setScores(prev => {
        if (gameState.winner === 'X') return { ...prev, xWins: prev.xWins + 1 };
        if (gameState.winner === 'O') return { ...prev, oWins: prev.oWins + 1 };
        return prev;
      });
    } else if (gameState.isDraw) {
      playDrawChime();
      setScores(prev => ({ ...prev, draws: prev.draws + 1 }));
    }
  }, [gameState, lastTicTacToeMove, playMarkSound, playWinFanfare, playDrawChime]);

  const handleNudgeOpponent = useCallback(() => {
    const opp = players.find(p => p.userId !== myUserId);
    if (!opp) return;
    const roast = getRandomRoast();
    const roastText = typeof roast === 'string' ? roast : (roast as any).body || String(roast);
    sendNudge(opp.userId, roastText);
    setNudgeFeedback(roastText);
    setTimeout(() => setNudgeFeedback(null), 3500);
  }, [players, myUserId, sendNudge]);

  const handleChatScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isUserScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 60;
  }, []);

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
      const res = await createGameRoom(currentToken, 'tic-tac-toe', 2, isPrivate);
      if (res?.room?.roomCode) {
        router.push(`/games/tic-tac-toe?room=${res.room.roomCode}`);
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
      setLobbyError(null);
      const res = await joinGameRoom(currentToken, trimmed);
      if (res?.room?.roomCode) {
        router.push(`/games/tic-tac-toe?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err.message || 'Room not found or full');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleQuickMatch = async () => {
    await handleCreateRoom(false);
  };

  const handlePlayWithPartner = async () => {
    if (!partner || !session?.token) return;
    try {
      setIsCreatingRoom(true);
      const res = await playWithPartner(session.token, 'tic-tac-toe', partner.id);
      if (res?.room?.roomCode) {
        router.push(`/games/tic-tac-toe?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      setLobbyError(err.message || 'Failed to challenge partner');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleInviteFriend = async (friend: FriendWithStreak) => {
    try {
      let currentToken = session?.token;
      if (!currentToken) {
        const ensured = await ensureSession();
        setSession(ensured);
        currentToken = ensured.token;
      }
      const res = await createGameRoom(currentToken, 'tic-tac-toe', 2, true);
      if (res?.room?.roomCode) {
        await invitePartnerToGame(currentToken, friend.friendUser.partnerCode, res.room.roomCode, 'tic-tac-toe');
        setIsFriendDrawerOpen(false);
        router.push(`/games/tic-tac-toe?room=${res.room.roomCode}`);
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to invite friend', 'error');
    }
  };

  const handleLeaveRoom = () => {
    showAlert(
      'Leave Game?',
      'Are you sure you want to quit this Tic Tac Toe match? Quitting during a game will forfeit the match to your opponent.',
      'warning',
      {
        confirmText: 'Yes, Leave',
        cancelText: 'Stay & Play',
        onConfirm: () => {
          sendLeave();
          router.push('/games/tic-tac-toe');
        }
      }
    );
  };

  const handleCopyRoomCode = () => {
    if (!room?.roomCode) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleCopyShareLink = () => {
    if (!room?.roomCode) return;
    const link = `${window.location.origin}/games/tic-tac-toe?room=${room.roomCode}`;
    navigator.clipboard.writeText(link);
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

  // Active players
  const playerX = players.find(p => p.seat === 0);
  const playerO = players.find(p => p.seat === 1);
  const myMark = myPlayer?.seat === 0 ? 'X' : myPlayer?.seat === 1 ? 'O' : null;

  // Board winning line positions (SVG line coordinates for 3x3)
  const winningLineCoords = useMemo(() => {
    if (!gameState?.winningLine) return null;
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

  // If NO room is selected, show the Lobby / Matchmaking UI
  if (!roomParam) {
    return (
      <div className={`min-h-screen flex ${isDark ? 'bg-[#0b0c10] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <AppSidebar />
        <main className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto max-w-6xl mx-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/games')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Games</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition"
                title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
              </button>
              <button
                onClick={() => setShowRulesModal(true)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition"
                title="Rules & How to Play"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-900/40 via-purple-900/30 to-indigo-950/50 p-6 sm:p-10 border border-rose-500/20 shadow-2xl mb-8 backdrop-blur-xl">
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-12 -top-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                <span>NEW 2-PLAYER STRATEGY DUEL</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
                TIC TAC TOE <span className="text-rose-400 font-normal">NEON</span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-300 mb-6 leading-relaxed">
                Connect 3 in a row horizontally, vertically, or diagonally! High-stakes real-time duel with zero bots, live floating video chat, dynamic roasts, and interactive sound effects.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleQuickMatch}
                  disabled={isCreatingRoom}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm shadow-lg shadow-rose-500/30 transition transform hover:-translate-y-0.5"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{isCreatingRoom ? 'Creating Room...' : 'Quick Play (Host Room)'}</span>
                </button>

                <button
                  onClick={() => setIsFriendDrawerOpen(true)}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 transition"
                >
                  <UserPlus className="w-4 h-4 text-rose-400" />
                  <span>Challenge Friend</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Join by Code Card */}
            <div className="rounded-2xl bg-[#131520]/80 border border-white/10 p-6 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Join with Room Code</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Enter a friend's 8-character game code (e.g. TIC-8F9A)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="TIC-XXXX"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCode(roomCodeInput)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-zinc-500 text-sm font-mono focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={() => handleJoinByCode(roomCodeInput)}
                  disabled={isJoiningRoom || !roomCodeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm transition"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Partner Quick Match Card */}
            <div className="rounded-2xl bg-[#131520]/80 border border-white/10 p-6 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                  <Heart className="w-5 h-5 fill-rose-500/40" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Play with Partner</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  {partner
                    ? `Connected with ${partner.displayName}. Instant 1-click duel!`
                    : 'Pair your account with a partner to play together anytime.'}
                </p>
              </div>

              {partner ? (
                <button
                  onClick={handlePlayWithPartner}
                  disabled={isCreatingRoom}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Challenge {partner.displayName}</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsFriendDrawerOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition"
                >
                  Connect Friend / Partner
                </button>
              )}
            </div>

            {/* Host Private Duel Card */}
            <div className="rounded-2xl bg-[#131520]/80 border border-white/10 p-6 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Host Private Match</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Generate a private room code that only players with the direct link can join.
                </p>
              </div>
              <button
                onClick={() => handleCreateRoom(true)}
                disabled={isCreatingRoom}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Create Private Duel</span>
              </button>
            </div>
          </div>

          {/* Lobby Error Alert */}
          {lobbyError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-sm flex items-center justify-between">
              <span>{lobbyError}</span>
              <button onClick={() => setLobbyError(null)} className="text-rose-400 hover:text-rose-200">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Friend Selector Drawer */}
          <GameFriendSelectorDrawer
            isOpen={isFriendDrawerOpen}
            onClose={() => setIsFriendDrawerOpen(false)}
            token={session?.token}
            currentPartnerId={partner?.id}
            currentPartnerCode={partner?.partnerCode}
            gameTitle="Tic Tac Toe"
            onSelectFriend={handleInviteFriend}
            onPlayWithFriend={handleInviteFriend}
            onOpenAddFriend={() => {
              setIsFriendDrawerOpen(false);
              setIsAddFriendModalOpen(true);
            }}
          />

          {/* Add Friend Modal */}
          {session?.token && (
            <AddFriendModal
              isOpen={isAddFriendModalOpen}
              onClose={() => setIsAddFriendModalOpen(false)}
              myFriendCode={myPartnerCode}
              token={session.token}
              onFriendAdded={() => setIsFriendDrawerOpen(true)}
            />
          )}

          {/* Rules Modal */}
          {showRulesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-[#161824] rounded-3xl border border-white/15 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
                      ❌⭕
                    </div>
                    <h3 className="font-bold text-lg text-white">How to Play Tic Tac Toe</h3>
                  </div>
                  <button
                    onClick={() => setShowRulesModal(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
                  <p>1. <strong>Turns:</strong> Player 1 is assigned <span className="text-rose-400 font-bold">X</span> and moves first. Player 2 is assigned <span className="text-cyan-400 font-bold">O</span>.</p>
                  <p>2. <strong>Goal:</strong> Be the first player to line up 3 of your marks horizontally, vertically, or diagonally.</p>
                  <p>3. <strong>Draw:</strong> If all 9 squares are filled and neither player has 3 in a row, the match ends in a draw.</p>
                  <p>4. <strong>Rematch:</strong> After any match, either player can vote for a rematch. Once both accept, the board resets instantly with alternating turns!</p>
                  <p>5. <strong>Live Video:</strong> Turn on your camera and mic to see your rival's reactions in real-time!</p>
                </div>

                <button
                  onClick={() => setShowRulesModal(false)}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition"
                >
                  Got It, Let's Play!
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // IN-GAME ARENA VIEW
  return (
    <div className="relative min-h-screen flex flex-col text-white select-none overflow-hidden bg-black">
      {/* Background Wallpaper */}
      <div
        className="fixed inset-0 bg-cover bg-center transition-all duration-700 opacity-30 scale-105 pointer-events-none"
        style={{ backgroundImage: `url(${currentTheme.bgUrl})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 pointer-events-none" />

      {/* Floating Reactions overlay */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute text-4xl animate-bounce pointer-events-none"
            style={{
              left: `${20 + (r.timestamp % 60)}%`,
              bottom: '25%',
              animationDuration: '1.2s'
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-30 flex items-center justify-between px-4 py-3 bg-[#0d0f17]/80 backdrop-blur-xl border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>

          {/* Room Code Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold">
            <span>{room?.roomCode || roomParam}</span>
            <button
              onClick={handleCopyRoomCode}
              className="hover:text-white transition"
              title="Copy Room Code"
            >
              {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            onClick={handleCopyShareLink}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition"
          >
            <Share2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{copiedRoomLink ? 'Link Copied!' : 'Share Link'}</span>
          </button>
        </div>

        {/* Center Scoreboard Badge */}
        <div className="hidden md:flex items-center gap-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold">
          <span className="text-rose-400 font-bold">X: {scores.xWins}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400">Ties: {scores.draws}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-cyan-400 font-bold">O: {scores.oWins}</span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Theme Dropdown Toggle */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
            title="Board Theme"
          >
            <Palette className="w-4 h-4 text-rose-400" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition"
            title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

          {/* Chat Drawer Toggle */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              isChatOpen
                ? 'bg-rose-600/30 border-rose-500/50 text-rose-300'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat</span>
            {chatMessages.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Game Arena Container */}
      <div className="relative z-20 flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left/Center Game Stage */}
        <div className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto">
          {/* Players HUD Bar */}
          <div className="w-full max-w-lg flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#121420]/80 border border-white/10 backdrop-blur-md mb-4 shadow-xl">
            {/* Player 1 (X) */}
            <div
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                gameState?.currentTurnSeat === 0 && !gameState?.winner && !gameState?.isDraw
                  ? 'bg-rose-500/20 border border-rose-500/50 shadow-lg shadow-rose-500/20 scale-102'
                  : 'opacity-85'
              }`}
            >
              <div className="relative">
                {videoGridParticipants.find(p => p.userId === playerX?.userId)?.stream ? (
                  <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-rose-500 shadow-md">
                    <VideoAvatar
                      stream={videoGridParticipants.find(p => p.userId === playerX?.userId)!.stream}
                      displayName={playerX?.displayName || 'Player 1'}
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center font-black text-white text-lg shadow-md">
                    X
                  </div>
                )}
                {playerX?.userId === myUserId && (
                  <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded text-[9px] bg-rose-600 text-white font-bold">
                    YOU
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white max-w-[100px] sm:max-w-[130px] truncate">
                    {playerX?.displayName || 'Waiting...'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    X
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  {gameState?.currentTurnSeat === 0 && !gameState?.winner && !gameState?.isDraw
                    ? '🎯 Thinking...'
                    : `Wins: ${scores.xWins}`}
                </span>
              </div>
            </div>

            {/* VS Badge & Roaster */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black tracking-widest text-zinc-400 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                VS
              </span>
              <button
                onClick={handleNudgeOpponent}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline transition"
                title="Send playful roast"
              >
                Roast 🌶️
              </button>
            </div>

            {/* Player 2 (O) */}
            <div
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                gameState?.currentTurnSeat === 1 && !gameState?.winner && !gameState?.isDraw
                  ? 'bg-cyan-500/20 border border-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-102'
                  : 'opacity-85'
              }`}
            >
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    O
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white max-w-[100px] sm:max-w-[130px] truncate">
                    {playerO?.displayName || 'Waiting...'}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  {gameState?.currentTurnSeat === 1 && !gameState?.winner && !gameState?.isDraw
                    ? '🎯 Thinking...'
                    : `Wins: ${scores.oWins}`}
                </span>
              </div>
              <div className="relative">
                {videoGridParticipants.find(p => p.userId === playerO?.userId)?.stream ? (
                  <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-cyan-500 shadow-md">
                    <VideoAvatar
                      stream={videoGridParticipants.find(p => p.userId === playerO?.userId)!.stream}
                      displayName={playerO?.displayName || 'Player 2'}
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-lg shadow-md">
                    O
                  </div>
                )}
                {playerO?.userId === myUserId && (
                  <span className="absolute -bottom-1 -left-1 px-1 py-0.2 rounded text-[9px] bg-cyan-600 text-white font-bold">
                    YOU
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Message / Roast Toast */}
          <div className="min-h-[32px] flex items-center justify-center mb-3">
            {nudgeAlert ? (
              <div className="px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold animate-pulse">
                🔥 {nudgeAlert.fromDisplayName}: "{nudgeAlert.message}"
              </div>
            ) : nudgeFeedback ? (
              <div className="px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold">
                🌶️ Sent Roast: "{nudgeFeedback}"
              </div>
            ) : gameState?.winner ? (
              <div className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500/30 via-rose-500/30 to-purple-500/30 border border-amber-400/50 text-amber-200 text-sm font-black animate-bounce shadow-lg shadow-amber-500/20">
                🎉 {gameState.winnerUserId === myUserId ? 'YOU WON THE DUEL! 🏆' : `${gameState.winner === 'X' ? playerX?.displayName : playerO?.displayName} WINS! 👑`}
              </div>
            ) : gameState?.isDraw ? (
              <div className="px-5 py-2 rounded-full bg-white/10 border border-white/20 text-zinc-200 text-sm font-bold">
                🤝 Match Ended in a Draw!
              </div>
            ) : room?.status === 'WAITING' ? (
              <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Waiting for 2nd player to join code <strong>{room.roomCode}</strong></span>
              </div>
            ) : isMyTurn ? (
              <div className="px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Your turn ({myMark})! Tap an empty square to make your move!</span>
              </div>
            ) : (
              <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs">
                Opponent's turn ({gameState?.currentTurnMark})...
              </div>
            )}
          </div>

          {/* 3x3 TIC TAC TOE ARENA */}
          <div className="relative w-full max-w-[340px] sm:max-w-[420px] aspect-square rounded-3xl p-4 sm:p-6 bg-[#10121c]/90 border border-white/15 shadow-2xl backdrop-blur-2xl flex items-center justify-center">
            {/* 3x3 Grid */}
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-3 relative">
              {Array.from({ length: 9 }).map((_, idx) => {
                const mark = gameState?.board[idx] || null;
                const isHovered = hoveredCell === idx && !mark && isMyTurn && !gameState?.winner && !gameState?.isDraw;
                const isWinningCell = gameState?.winningLine?.includes(idx);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!mark && isMyTurn && !gameState?.winner && !gameState?.isDraw) {
                        makeTicTacToeMove(idx);
                      }
                    }}
                    onMouseEnter={() => setHoveredCell(idx)}
                    onMouseLeave={() => setHoveredCell(null)}
                    disabled={Boolean(mark) || !isMyTurn || Boolean(gameState?.winner) || Boolean(gameState?.isDraw)}
                    className={`relative rounded-2xl flex items-center justify-center transition-all duration-200 transform ${
                      isWinningCell
                        ? 'bg-amber-500/25 border-2 border-amber-400 shadow-xl shadow-amber-500/30 scale-102'
                        : mark
                        ? 'bg-white/[0.04] border border-white/10 cursor-default'
                        : isMyTurn
                        ? `${currentTheme.cellBg} border ${currentTheme.gridBorder} cursor-pointer active:scale-95`
                        : 'bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-70'
                    }`}
                  >
                    {/* Render Mark */}
                    {mark === 'X' ? (
                      <span className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 filter drop-shadow-[0_0_16px_rgba(244,63,94,0.6)] animate-in zoom-in-50 duration-200">
                        ✕
                      </span>
                    ) : mark === 'O' ? (
                      <span className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 via-teal-300 to-blue-400 filter drop-shadow-[0_0_16px_rgba(6,182,212,0.6)] animate-in zoom-in-50 duration-200">
                        ◯
                      </span>
                    ) : isHovered ? (
                      <span className="text-4xl sm:text-6xl font-black opacity-30 text-white animate-pulse">
                        {myMark === 'O' ? '◯' : '✕'}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {/* Winning Line SVG Overlay */}
              {winningLineCoords && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                  <line
                    x1={winningLineCoords.x1}
                    y1={winningLineCoords.y1}
                    x2={winningLineCoords.x2}
                    y2={winningLineCoords.y2}
                    stroke="#f59e0b"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="animate-pulse filter drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Bottom Rematch / Controls Bar */}
          <div className="w-full max-w-lg mt-4 flex items-center justify-between gap-3">
            {/* Rematch Button (Active when game ends) */}
            {(gameState?.winner || gameState?.isDraw) ? (
              <button
                onClick={rematch}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {rematchStatus
                    ? `Play Again (${rematchStatus.votedCount}/${rematchStatus.totalNeeded})`
                    : 'Vote Rematch 🔄'}
                </span>
              </button>
            ) : (
              /* Quick Reaction Emojis */
              <div className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-[#121420]/80 border border-white/10 backdrop-blur-md overflow-x-auto">
                {EMOJI_REACTIONS.slice(0, 6).map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="p-1.5 text-lg hover:scale-125 transition transform"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Video / Voice Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-2xl border transition ${
                  isMuted
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
                }`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleCamera}
                className={`p-3 rounded-2xl border transition ${
                  isCameraOff
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
                }`}
                title={isCameraOff ? 'Turn Video On' : 'Turn Video Off'}
              >
                {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Chat & Participants Side Drawer */}
        {isChatOpen && (
          <aside className="w-full md:w-80 lg:w-96 bg-[#0e1019]/95 border-t md:border-t-0 md:border-l border-white/10 flex flex-col shrink-0 h-64 md:h-auto z-20 backdrop-blur-xl">
            {/* Side Drawer Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">Room Chat</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-zinc-400">
                  {players.length}/2
                </span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white md:hidden"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages List */}
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="flex-1 p-3 space-y-2.5 overflow-y-auto"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500 text-xs">
                  <Smile className="w-8 h-8 mb-2 opacity-40 text-rose-400" />
                  <p>No messages yet.</p>
                  <p className="text-[11px] mt-1">Say hi or tap a quick phrase below!</p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.userId === myUserId;
                  const sticker = parseStickerMessage(msg.content);

                  return (
                    <div
                      key={msg.id}
                      id={`tic-chat-msg-${msg.id}`}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-zinc-500 mb-0.5 px-1 font-medium">
                        {msg.userName}
                      </span>
                      {msg.replyTo && (
                        <div className="text-[10px] text-zinc-400 italic bg-white/5 px-2 py-0.5 rounded mb-1 max-w-[200px] truncate border-l-2 border-rose-400">
                          Replying to {msg.replyTo.userName}: {msg.replyTo.content}
                        </div>
                      )}
                      {sticker ? (
                        <StickerMessageView content={msg.content} />
                      ) : (
                        <div
                          className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                            isMe
                              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-tr-sm shadow-md'
                              : 'bg-white/10 text-zinc-200 rounded-tl-sm border border-white/5'
                          }`}
                        >
                          {msg.content}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Phrases */}
            <div className="px-3 py-1.5 border-t border-white/5 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
              {QUICK_CHAT_PHRASES.map(phrase => (
                <button
                  key={phrase}
                  onClick={() => sendChat(phrase)}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 hover:text-white whitespace-nowrap border border-white/5 transition"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Chat Input Box */}
            <form onSubmit={handleSendChat} className="p-2.5 border-t border-white/10 flex items-center gap-2">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={e => {
                  setChatInput(e.target.value);
                  sendTyping(true);
                }}
                placeholder="Message room..."
                className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Settings / Theme Picker Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#161824] rounded-3xl border border-white/15 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm text-white">Board Atmosphere</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setActiveTheme(theme.id);
                    setShowSettingsModal(false);
                  }}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    activeTheme === theme.id
                      ? 'border-rose-500 bg-rose-500/20 text-white'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg bg-cover bg-center shrink-0 border border-white/20"
                    style={{ backgroundImage: `url(${theme.bgUrl})` }}
                  />
                  <span className="text-xs font-semibold truncate">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Opponent Left / Forfeit Modal */}
      {opponentLeftWin && (
        <AlertModal
          isOpen={Boolean(opponentLeftWin)}
          onClose={clearOpponentLeftWin}
          title="Opponent Left 🏆"
          message={opponentLeftWin.message || 'Your opponent left the room. You win by forfeit!'}
          type="success"
          confirmText="Awesome!"
        />
      )}

      {/* Generic Alert Modal */}
      {alertModalState && (
        <AlertModal
          isOpen={Boolean(alertModalState)}
          onClose={() => setAlertModalState(null)}
          title={alertModalState.title}
          message={alertModalState.message}
          type={alertModalState.type || 'info'}
          confirmText={alertModalState.confirmText || 'OK'}
          cancelText={alertModalState.cancelText}
          onConfirm={() => {
            alertModalState.onConfirm?.();
            setAlertModalState(null);
          }}
        />
      )}
    </div>
  );
}

export default function TicTacToePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Tic Tac Toe...</div>}>
      <TicTacToeContent />
    </Suspense>
  );
}
