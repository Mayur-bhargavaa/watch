'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
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
  Crown,
  Heart
} from 'lucide-react';
import { useGameRoom } from '../../../hooks/useGameRoom';
import { useWebRTC, VideoGridParticipant } from '../../../hooks/useWebRTC';
import { VideoAvatar } from '../../../components/games/LudoGame';
import { DynamicThemeEffects } from '../../../components/theme/DynamicThemeEffects';
import { getStoredSession, UserSession, createGameRoomWithPartner, getGameRoute, getGameTitle } from '../../../lib/api';
import { BingoLobby } from '../../../components/games/bingo/BingoLobby';
import { BingoWaitingRoom } from '../../../components/games/bingo/BingoWaitingRoom';
import { BingoCaller } from '../../../components/games/bingo/BingoCaller';
import { BingoTicket } from '../../../components/games/bingo/BingoTicket';
import { WinningProgress } from '../../../components/games/bingo/WinningProgress';
import { ClaimBingoButton } from '../../../components/games/bingo/ClaimBingoButton';
import { BingoVictory } from '../../../components/games/bingo/BingoVictory';
import { BingoBottomDock } from '../../../components/games/bingo/BingoBottomDock';
import { BingoChatDrawer } from '../../../components/games/bingo/BingoChatDrawer';
import { BingoRoomSettings } from '../../../components/games/bingo/BingoRoomSettings';
import { BingoGameHistory } from '../../../components/games/bingo/BingoGameHistory';
import { GameFriendSelectorDrawer } from '../../../components/games/GameFriendSelectorDrawer';
import { BingoRoomConfig, BingoWinCondition } from '@synccinema/common';

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

const QUICK_REACTION_EMOJIS = ['❤️', '😂', '🔥', '👏', '🎉', '🎱', '🥳', '🥺', '✨', '🙈', '😱'];

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

function BingoGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams.get('room');

  const [session, setSession] = useState<UserSession | null>(null);
  const [showFriendDrawer, setShowFriendDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>('cozy');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [roomConfig, setRoomConfig] = useState<BingoRoomConfig>(DEFAULT_CONFIG);

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
    connectionStatus,
    startBingoGame,
    callNextBingoNumber,
    claimBingo,
    markBingoNumber,
    updateBingoConfig,
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

  // Cross-game redirect guard
  useEffect(() => {
    if (roomCodeParam) {
      const code = roomCodeParam.trim().toUpperCase();
      if (!code.startsWith('BINGO-') && (code.startsWith('LUDO-') || code.startsWith('TIC-') || code.startsWith('FOUR-') || code.startsWith('DOODLE-'))) {
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
  const isPlaying = room && room.status === 'PLAYING' && gameState !== null;
  const isFinished = room && (room.status === 'FINISHED' || gameState?.phase === 'FINISHED');

  // WebRTC Setup
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
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const newX = Math.max(8, Math.min(window.innerWidth - 240, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(64, Math.min(window.innerHeight - 120, dragStartRef.current.initialY + deltaY));

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

  // Handle leave room
  const handleLeave = () => {
    sendLeave();
    router.push('/games');
  };

  // Handle invite friend
  const handleInviteFriend = () => {
    setShowFriendDrawer(true);
  };

  const currentTheme = useMemo(() => {
    return THEMES.find(t => t.id === activeTheme) || THEMES[0];
  }, [activeTheme]);

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

  // 1. NO ROOM PARAM -> Render Lobby
  if (!roomCodeParam) {
    return <BingoLobby />;
  }

  // 2. ROOM WAITING / READY -> Render Waiting Room
  if (!isPlaying && !isFinished && room) {
    return (
      <>
        <BingoWaitingRoom
          room={room}
          myUserId={effectiveUserId}
          config={roomConfig}
          rematchStatus={rematchStatus}
          onRematch={rematch}
          onStartGame={(cfg) => {
            startBingoGame(cfg);
          }}
          onUpdateConfig={(cfg) => {
            setRoomConfig(cfg);
            updateBingoConfig(cfg);
          }}
          onLeave={handleLeave}
          onInviteFriend={handleInviteFriend}
        />

        <GameFriendSelectorDrawer
          isOpen={showFriendDrawer}
          onClose={() => setShowFriendDrawer(false)}
          token={session?.token}
          gameTitle="Bingo Duel"
          onSelectFriend={async (friend) => {
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
      </>
    );
  }

  // 3. LIVE GAME / FINISHED SCREEN
  const currentNum = lastBingoCall?.number ?? gameState?.currentNumber ?? null;
  const currentWord = lastBingoCall?.word ?? gameState?.currentNumberWord ?? null;
  const lastCalled = lastBingoCall?.calledNumbers ?? gameState?.lastCalledNumbers ?? [];
  const remaining = lastBingoCall?.remainingCount ?? gameState?.callQueue?.length ?? 90;

  // ONLY SELF TICKET IS USED ON SCREEN
  const myTicket = gameState?.tickets?.[me?.userId || ''] || { cells: [] };
  const myMarked = gameState?.playerMarked?.[me?.userId || ''] || [];
  const myScore = gameState?.scores?.[me?.userId || ''] || 0;
  const myProgress = gameState?.conditionProgress?.[me?.userId || ''] || {};

  const opponentScore = opponent ? gameState?.scores?.[opponent.userId] || 0 : 0;
  const opponentProgress = opponent ? gameState?.conditionProgress?.[opponent.userId] || {} : {};

  // Count conditions claimed by opponent
  const opponentCompletedCount = Object.values(opponentProgress).filter((p: any) => p?.isMet).length;

  return (
    <div className="min-h-screen text-white flex flex-col justify-between selection:bg-rose-600 selection:text-white relative overflow-hidden font-sans">
      {/* Full-Screen Ambient Wallpaper Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat select-none pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url('${currentTheme.bgUrl || '/images/cozy_ludo_bg.jpg'}')` }}
      >
        <div className="absolute inset-0 bg-[#0c0818]/75 backdrop-blur-[2px]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      <DynamicThemeEffects themeId={activeTheme} />

      {/* Floating Remote Audio Player */}
      {callParticipants.map(p => (
        !p.isSelf && p.stream ? <RemoteAudioPlayer key={p.userId} stream={p.stream} /> : null
      ))}

      {/* Floating Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 animate-bounce text-3xl font-bold flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-2xl"
          >
            <span>{r.emoji}</span>
            <span className="text-xs text-rose-300 font-semibold">{r.userName}</span>
          </div>
        ))}
      </div>

      {/* Rematch Request Popup from Opponent */}
      {rematchStatus && !rematchStatus.allVoted && !rematchStatus.votedUserIds?.includes(effectiveUserId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] p-6 sm:p-8 bg-[#161220]/95 border border-rose-500/40 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(244,63,94,0.25)] text-center space-y-4 relative overflow-hidden">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg shadow-rose-500/30 animate-bounce">
              ⚔️
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Rematch Challenge!</h3>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                <strong className="text-[#ff3864] font-bold">{rematchStatus.requesterName || opponent?.displayName || 'Your Opponent'}</strong> has requested a rematch!
                <br />
                Do you want to play again?
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => rematch()}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Accept Rematch (Yes!)</span>
              </button>
              <button
                type="button"
                onClick={declineRematch}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-zinc-300 rounded-xl transition cursor-pointer"
              >
                Decline (No)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rematch Waiting Modal for requester */}
      {rematchStatus && !rematchStatus.allVoted && rematchStatus.votedUserIds?.includes(effectiveUserId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] p-6 sm:p-7 bg-[#161220]/95 border border-white/20 text-white shadow-2xl text-center space-y-4 relative overflow-hidden">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-3xl animate-pulse">
              ⏳
            </div>
            <h3 className="text-xl font-black text-white">Rematch Requested</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Waiting for <strong className="text-rose-400 font-bold">{opponent?.displayName || 'Opponent'}</strong> to accept the rematch...
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

      {/* Rematch Declined / Opponent Left Modal */}
      {rematchDeclined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] p-6 sm:p-8 bg-[#161220]/95 border border-white/20 text-white shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-3xl">
              🚪
            </div>
            <h3 className="text-xl font-black text-white">Rematch Declined</h3>
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
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
              >
                Games Hub
              </button>
              <button
                type="button"
                onClick={clearRematchDeclined}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff2b5e] hover:bg-rose-600 text-xs font-bold text-white transition"
              >
                Stay on Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Result Toast Notification */}
      {claimToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`px-5 py-3 rounded-2xl border shadow-2xl flex items-center gap-2.5 text-xs font-black ${
              claimToast.valid
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50'
            }`}
          >
            {claimToast.valid ? <Sparkles className="w-4 h-4 text-yellow-300" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{claimToast.message}</span>
          </div>
        </div>
      )}

      {/* Condition Won Banner */}
      {lastBingoConditionWon && (
        <div className="bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-rose-950/80 border-b border-rose-500/30 px-4 py-2 text-center text-xs font-black text-white flex items-center justify-center gap-2 z-20 backdrop-blur-md">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span>
            {lastBingoConditionWon.displayName} won {lastBingoConditionWon.conditionName}! (+{lastBingoConditionWon.points} pts)
          </span>
        </div>
      )}

      {/* TOP NAVIGATION HEADER BAR */}
      <header className="h-16 px-4 sm:px-8 border-b border-white/10 flex items-center justify-between bg-[#0e0c18]/80 backdrop-blur-xl z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-lg">🎱</span>
            <span className="text-sm font-black text-white tracking-wide">Bingo Duel</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] text-zinc-300 font-mono">
              Room: {room?.roomCode || roomCodeParam}
            </span>
          </div>
        </div>

        {/* Video Call Show Button (if minimized or closed) */}
        {isPipClosed && (
          <button
            onClick={() => setIsPipClosed(false)}
            className="px-3 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow text-xs font-semibold flex items-center gap-1.5 transition"
            title="Open Floating Video Call"
          >
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>Show Call</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Audio Mic Toggle */}
          <button
            type="button"
            onClick={toggleMic}
            className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
              isMicMuted
                ? 'bg-white/10 border-white/15 text-zinc-400 hover:text-white'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400 ring-2 ring-emerald-500/20'
            }`}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            onClick={() => {
              toggleCamera();
              if (isPipClosed) setIsPipClosed(false);
            }}
            className={`w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
              isCameraOn
                ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-400 ring-2 ring-rose-500/20'
                : 'bg-white/10 border-white/15 text-zinc-400 hover:text-white'
            }`}
            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {/* Chat Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`relative w-9 h-9 rounded-xl border transition flex items-center justify-center shadow-xs ${
              isChatOpen
                ? 'bg-rose-600 border-rose-500 text-white'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
            }`}
            title="Toggle Match Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {chatMessages.length > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center text-white">
                {chatMessages.length}
              </span>
            )}
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="w-9 h-9 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center shadow-xs"
            title="Change Theme Wallpaper"
          >
            <Palette className="w-4 h-4 text-amber-300" />
          </button>

          {/* Game History */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="w-9 h-9 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center shadow-xs"
            title="Scoreboard & History"
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
          </button>

          {/* Settings Modal */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="w-9 h-9 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center shadow-xs"
            title="Room Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MOVEABLE FLOATING VIDEO CALL WINDOW */}
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
          className={`fixed z-40 select-none bg-[#140f22]/95 border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-shadow ${
            isDraggingPip
              ? 'cursor-grabbing ring-2 ring-rose-500/60 shadow-[0_25px_60px_rgba(244,63,94,0.35)] scale-[1.02]'
              : 'cursor-grab hover:border-white/30'
          } ${isPipMinimized ? 'px-3 py-2' : 'p-2.5 sm:p-3'}`}
        >
          {/* Top Bar: Drag Grip + In-Call Controls */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-1.5 border-b border-white/10 touch-none">
            <div className="flex items-center gap-1.5 text-zinc-300 pointer-events-none">
              <GripHorizontal className="w-4 h-4 text-rose-400/80" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-white">
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
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm ${
                  isMicMuted
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900'
                    : 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 hover:bg-emerald-900 ring-1 ring-emerald-400/40'
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
                className={`w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm ${
                  isCameraOn
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 hover:bg-emerald-900 ring-1 ring-emerald-400/40'
                    : 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900'
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
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center transition"
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
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-500/30 text-zinc-400 hover:text-rose-200 flex items-center justify-center transition"
                title="Hide Call Box"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Video Feeds Grid */}
          {!isPipMinimized && (
            <div className="flex items-center gap-2 pt-1">
              {callParticipants.map(participant => (
                <div
                  key={participant.userId}
                  className="relative w-28 sm:w-32 h-20 sm:h-22 rounded-2xl bg-black/70 border border-white/15 overflow-hidden flex items-center justify-center shadow-inner group"
                >
                  {participant.stream && participant.isCameraOn ? (
                    <VideoAvatar
                      stream={participant.stream}
                      isSelf={participant.isSelf}
                      displayName={participant.displayName}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-2">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-black text-xs flex items-center justify-center mb-1 shadow">
                        {participant.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-zinc-300 font-bold truncate max-w-[90px]">
                        {participant.displayName}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-bold text-white/90 drop-shadow pointer-events-none">
                    <span className="truncate max-w-[65px]">{participant.displayName}</span>
                    <span className="shrink-0">{!participant.isMuted ? '🟢' : '🔴'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAIN GAME ARENA (ONLY SELF TICKET IS SHOWN) */}
      <main className="flex-1 flex flex-col justify-start p-3 sm:p-6 z-10 max-w-[1400px] mx-auto w-full space-y-4">
        
        {/* TOP OPPONENT DUEL STATUS BAR */}
        <div className="w-full bg-[#140f22]/85 border border-white/15 rounded-3xl p-3.5 sm:p-4 shadow-xl backdrop-blur-xl flex items-center justify-between gap-4">
          {/* Self Player Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-rose-300 text-sm overflow-hidden shadow-sm shrink-0">
              {me?.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.displayName} className="w-full h-full object-cover" />
              ) : (
                me?.displayName?.charAt(0).toUpperCase() || 'Y'
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-white truncate max-w-[110px] sm:max-w-[160px]">
                  {me?.displayName || 'You'}
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-rose-500/20 text-[#ff3864] text-[9px] font-black uppercase">
                  YOU
                </span>
              </div>
              <span className="text-xs text-rose-400 font-mono font-bold">
                Score: {myScore} pts
              </span>
            </div>
          </div>

          {/* VS Center Badge */}
          <div className="flex flex-col items-center">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-black tracking-widest text-amber-300 shadow-xs">
              VS
            </span>
            <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
              1v1 Tambola Duel
            </span>
          </div>

          {/* Opponent Player Badge */}
          <div className="flex items-center gap-3 min-w-0 justify-end">
            <div className="text-right min-w-0">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs sm:text-sm font-black text-white truncate max-w-[110px] sm:max-w-[160px]">
                  {opponent ? opponent.displayName : 'Opponent'}
                </span>
                {opponent && opponentCompletedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black">
                    {opponentCompletedCount} claims
                  </span>
                )}
              </div>
              <span className="text-xs text-cyan-400 font-mono font-bold">
                Score: {opponentScore} pts
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-black text-cyan-300 text-sm overflow-hidden shadow-sm shrink-0">
              {opponent?.avatarUrl ? (
                <img src={opponent.avatarUrl} alt={opponent.displayName} className="w-full h-full object-cover" />
              ) : (
                opponent?.displayName?.charAt(0).toUpperCase() || 'O'
              )}
            </div>
          </div>
        </div>

        {/* CENTER ARENA: SELF TICKET + BALL CALLER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: MY TICKET & MY PROGRESS (ONLY SELF TICKET) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl bg-[#140f22]/90 border border-white/15 shadow-2xl backdrop-blur-2xl p-4 sm:p-6 transition-all">
              <BingoTicket
                ticket={myTicket}
                mode={roomConfig.mode}
                playerName={me?.displayName || 'You'}
                avatarUrl={me?.avatarUrl}
                score={myScore}
                isHost={isHost}
                isMe={true}
                calledNumbers={gameState?.calledNumbers || []}
                markedNumbers={myMarked}
                onToggleMark={(n) => markBingoNumber(n)}
                accentColor="rose"
              />
            </div>

            <WinningProgress
              progress={myProgress}
              playerName={me?.displayName || 'You'}
            />
          </div>

          {/* RIGHT: BALL CALLER + CLAIM BUTTON + EMOJIS */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-5">
            <div className="w-full rounded-3xl bg-[#140f22]/90 border border-white/15 shadow-2xl backdrop-blur-2xl p-5 sm:p-6 flex flex-col items-center">
              <BingoCaller
                currentNumber={currentNum}
                currentNumberWord={currentWord}
                lastCalledNumbers={lastCalled}
                remainingCount={remaining}
                totalNumbers={roomConfig.mode === '75-ball' ? 75 : 90}
                isAutoCall={roomConfig.autoCall}
                callingSpeed={roomConfig.callingSpeed}
                isHost={isHost}
                onCallNext={callNextBingoNumber}
              />

              {/* Big Glowing Claim Bingo Button */}
              <div className="w-full pt-4 flex justify-center">
                <ClaimBingoButton
                  conditionProgress={myProgress}
                  claimedConditions={gameState?.claimedConditions || {}}
                  onClaim={(c) => claimBingo(c)}
                  penaltyUntil={gameState?.penaltyUntil?.[me?.userId || '']}
                  lastClaimResult={lastBingoClaimResult}
                />
              </div>
            </div>

            {/* Quick Emoji Reactions Bar */}
            <div className="w-full p-3 rounded-2xl bg-[#140f22]/80 border border-white/10 backdrop-blur-xl shadow-lg flex items-center justify-between gap-1 overflow-x-auto">
              {QUICK_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="p-1.5 text-lg hover:scale-130 transition transform active:scale-95 cursor-pointer"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Social Controls Dock */}
        <div className="pt-2 pb-2">
          <BingoBottomDock
            isMuted={isMicMuted}
            isCameraOn={isCameraOn}
            unreadChatCount={chatMessages.length}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
            onSendReaction={(emoji) => sendReaction(emoji)}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
        </div>

      </main>

      {/* Side Chat Drawer */}
      <BingoChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        myUserId={effectiveUserId}
        onSendMessage={(text) => sendChat(text)}
      />

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

      {/* Theme Selector Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-6 bg-[#161220] border border-white/20 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">Select Arena Theme</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto p-1">
              {THEMES.map((theme) => (
                <div
                  key={theme.id}
                  onClick={() => {
                    setActiveTheme(theme.id);
                    setShowThemeModal(false);
                  }}
                  className={`group relative rounded-2xl overflow-hidden border p-3 cursor-pointer transition flex flex-col justify-between h-28 ${
                    activeTheme === theme.id
                      ? 'border-rose-500 ring-2 ring-rose-500/40'
                      : 'border-white/15 hover:border-white/30'
                  }`}
                >
                  <img
                    src={theme.bgUrl}
                    alt={theme.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e0c18] via-[#0e0c18]/60 to-transparent" />
                  <div className="relative z-10 flex justify-end">
                    {activeTheme === theme.id && (
                      <span className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="relative z-10 text-xs font-bold text-white leading-tight">
                    {theme.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <BingoRoomSettings
          config={roomConfig}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSave={(cfg) => {
            setRoomConfig(cfg);
            updateBingoConfig(cfg);
          }}
          isHost={isHost}
        />
      )}

      {/* Game History Modal */}
      {showHistoryModal && (
        <BingoGameHistory
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          winnerDisplayName={gameState?.winnerDisplayName}
          finalScores={gameState?.scores}
          roundsWon={gameState?.gameSummary?.roundsWon || Object.values(gameState?.claimedConditions || {}).map((c: any) => ({
            condition: c.condition,
            winnerName: c.claimedByDisplayName,
            points: c.points
          }))}
          players={players.map(p => ({ userId: p.userId, displayName: p.displayName }))}
        />
      )}
    </div>
  );
}

export default function BingoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080a12] flex flex-col items-center justify-center text-white space-y-3">
          <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-zinc-400">Loading Bingo Duel...</span>
        </div>
      }
    >
      <BingoGameContent />
    </Suspense>
  );
}
